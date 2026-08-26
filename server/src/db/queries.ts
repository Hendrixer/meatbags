/**
 * Data access the Discord bridge needs (persistence tasks 2.3/2.5, the bridge's
 * slice). The rest of the query layer (createTask, dispatchTask, completeTask,
 * escalation) lands with the workflow — keep those out of here to avoid
 * colliding with that work.
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { agents, tasks, type Agent, type Task } from "./schema.js";

/** Resolve a Discord thread to the task it belongs to, or undefined. */
export async function findTaskByThread(threadId: string): Promise<Task | undefined> {
  const rows = await getDb().select().from(tasks).where(eq(tasks.threadId, threadId)).limit(1);
  return rows[0];
}

/**
 * Register a human the first time they speak; on repeat sightings refresh the
 * name only — accumulated stats are theirs to keep. Flair never goes down.
 */
export async function upsertAgent(discordId: string, name: string): Promise<Agent> {
  const rows = await getDb()
    .insert(agents)
    .values({ discordId, name })
    .onConflictDoUpdate({
      target: agents.discordId,
      set: { name: sql`excluded.name` },
    })
    .returning();
  return rows[0];
}
