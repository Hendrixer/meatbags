/**
 * Every read and write the rest of the server needs. Nothing else talks to the
 * database directly.
 *
 * The lifecycle here mirrors how a task actually fills in: `createTask` at
 * submit time, `dispatchTask` once a human has it, `completeTask` when they
 * answer. Response-time stats measure from `assigned_at`, never `created_at`,
 * so our own dispatch latency isn't billed to the meatbag.
 */
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { agents, tasks, type Agent, type Task, type TaskStatus } from "./schema.js";

export type { Agent, Task, TaskStatus };

/** A task plus the assignee's display name, which the poll route reports. */
export interface TaskWithAssignee extends Task {
  assigneeName: string | null;
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

/**
 * Record a submitted tool call, returning undefined if that id is already
 * taken. The id is the caller's — the model's own `tool_call_id` — so a TUI
 * retry lands here rather than creating a twin.
 *
 * `onConflictDoNothing` rather than catching a unique violation: it says
 * "leave the existing row alone" in one statement, with no check-then-insert
 * race. A retried submit that reset a live task would silently destroy a
 * human's answer.
 */
export async function createTask(input: {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  description: string;
}): Promise<Task | undefined> {
  const [row] = await getDb()
    .insert(tasks)
    .values({
      id: input.id,
      toolName: input.toolName,
      args: input.args,
      description: input.description,
    })
    .onConflictDoNothing()
    .returning();
  return row;
}

export async function getTask(id: string): Promise<TaskWithAssignee | undefined> {
  const [row] = await getDb()
    .select({ task: tasks, assigneeName: agents.name })
    .from(tasks)
    // LEFT: a queued task has no assignee yet, and polling it is the normal
    // case for the first seconds of every task.
    .leftJoin(agents, eq(agents.discordId, tasks.agentId))
    .where(eq(tasks.id, id));
  return row ? { ...row.task, assigneeName: row.assigneeName } : undefined;
}

/** Hand the task to a human: record who has it and where, and start the clock. */
export async function dispatchTask(
  id: string,
  input: { agentId: string; threadId: string },
): Promise<Task | undefined> {
  const [row] = await getDb()
    .update(tasks)
    .set({
      agentId: input.agentId,
      threadId: input.threadId,
      status: "assigned",
      assignedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();
  return row;
}

/**
 * The Discord bot's lookup. A message only knows its thread; `thread_id` is
 * unique and null until dispatch, so this matches at most one task and a queued
 * task matches nothing.
 */
export async function findTaskByThread(threadId: string): Promise<Task | undefined> {
  const [row] = await getDb()
    .select()
    .from(tasks)
    .where(eq(tasks.threadId, threadId))
    .limit(1);
  return row;
}

/**
 * Store the human's reply verbatim and credit them. Only completes a task that
 * is still outstanding, so a second message in the thread can't re-complete it
 * or overwrite the answer that already landed.
 */
export async function completeTask(id: string, reply: string): Promise<Task | undefined> {
  const db = getDb();
  const [row] = await db
    .update(tasks)
    .set({ status: "completed", completedAt: new Date(), reply })
    .where(and(eq(tasks.id, id), eq(tasks.status, "assigned")))
    .returning();
  if (row?.agentId) {
    await db
      .update(agents)
      .set({ tasksCompleted: sql`${agents.tasksCompleted} + 1` })
      .where(eq(agents.discordId, row.agentId));
  }
  return row;
}

/** Raise the escalation level one notch and report the new one. */
export async function bumpEscalation(id: string): Promise<number> {
  const [row] = await getDb()
    .update(tasks)
    .set({ escalationLevel: sql`${tasks.escalationLevel} + 1` })
    .where(eq(tasks.id, id))
    .returning({ escalationLevel: tasks.escalationLevel });
  return row?.escalationLevel ?? 1;
}

export async function listTasks(): Promise<Task[]> {
  return getDb().select().from(tasks).orderBy(desc(tasks.createdAt));
}

// ─── Agents ─────────────────────────────────────────────────────────────────

/**
 * Register a human, or refresh what we know. Accumulated stats are never reset,
 * and an upsert with no skills (the #general path, which only sees a name)
 * leaves existing skill tags alone.
 */
export async function upsertAgent(input: {
  discordId: string;
  name: string;
  skills?: string[];
}): Promise<Agent> {
  const [row] = await getDb()
    .insert(agents)
    .values({ discordId: input.discordId, name: input.name, skills: input.skills ?? [] })
    .onConflictDoUpdate({
      target: agents.discordId,
      set: {
        name: sql`excluded.name`,
        skills: sql`case when cardinality(excluded.skills) > 0
                         then excluded.skills else ${agents.skills} end`,
      },
    })
    .returning();
  return row;
}

export async function readRoster(): Promise<Agent[]> {
  return getDb().select().from(agents).orderBy(desc(agents.tasksCompleted), agents.name);
}

export async function recordVoicemail(agentId: string): Promise<void> {
  await getDb()
    .update(agents)
    .set({ voicemailsReceived: sql`${agents.voicemailsReceived} + 1` })
    .where(eq(agents.discordId, agentId));
}

export async function recordWarning(agentId: string): Promise<void> {
  await getDb()
    .update(agents)
    .set({ warnings: sql`${agents.warnings} + 1` })
    .where(eq(agents.discordId, agentId));
}

/**
 * Recompute average response time from completed tasks, measured from when the
 * human actually got the task. Time a task spent queued is not theirs to answer
 * for — and the leaderboard's whole point is who is slow.
 */
export async function recomputeResponseStats(): Promise<void> {
  await getDb().execute(sql`
    update ${agents} a
       set avg_response_secs = coalesce(sub.avg, 0)
      from (
        select agent_id,
               avg(extract(epoch from (completed_at - assigned_at)))::int as avg
          from ${tasks}
         where completed_at is not null
           and assigned_at is not null
           and agent_id is not null
      group by agent_id
      ) sub
     where a.discord_id = sub.agent_id`);
}

/** A roster member plus how much work they're currently on the hook for. */
export interface Candidate {
  discordId: string;
  name: string;
  /** Tasks assigned to them and not yet answered. */
  openTasks: number;
  /** When they were last handed anything, for round-robin ordering. */
  lastAssignedAt: Date | null;
}

/**
 * The roster ordered for round-robin: whoever is carrying the least work, and
 * among equals whoever has gone longest without being volunteered for anything.
 * Someone who has never been assigned sorts first — fresh meat goes first.
 */
export async function readCandidates(discordIds: string[]): Promise<Candidate[]> {
  if (discordIds.length === 0) return [];
  const rows = await getDb().execute(sql`
    select a.discord_id,
           a.name,
           count(t.id) filter (where t.status = 'assigned')::int as open_tasks,
           max(t.assigned_at)                                    as last_assigned_at
      from ${agents} a
      left join ${tasks} t on t.agent_id = a.discord_id
     where a.discord_id in (${sql.join(discordIds.map((d) => sql`${d}`), sql`, `)})
     group by a.discord_id, a.name
     order by open_tasks asc,
              last_assigned_at asc nulls first,
              a.name asc`);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    discordId: String(r.discord_id),
    name: String(r.name),
    openTasks: Number(r.open_tasks ?? 0),
    lastAssignedAt: r.last_assigned_at ? new Date(String(r.last_assigned_at)) : null,
  }));
}

/** Everything the leaderboard shows, worst offenders last. */
export async function readLeaderboard(): Promise<Agent[]> {
  return getDb()
    .select()
    .from(agents)
    .where(isNotNull(agents.discordId))
    .orderBy(desc(agents.tasksCompleted), agents.avgResponseSecs);
}
