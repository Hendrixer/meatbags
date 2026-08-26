/**
 * The single source of truth for the database. Row types are inferred from here
 * rather than hand-maintained alongside DDL, because `tasks` is the seam with the
 * TUI half and drift between the two is the expensive kind of bug.
 *
 * Column names stay snake_case: these tables get read off a projector in the VS
 * Code PostgreSQL extension during the demo.
 */
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** A task is queued when submitted, assigned once a human has it, completed once they answer. */
export type TaskStatus = "queued" | "assigned" | "completed";

/**
 * The humans. Discord says who's here; Horizon says what we know about them.
 * `flair` only ever goes up.
 */
export const agents = pgTable("agents", {
  discordId: text("discord_id").primaryKey(),
  name: text("name").notNull(),
  skills: text("skills").array().notNull().default([]),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  avgResponseSecs: integer("avg_response_secs").notNull().default(0),
  warnings: integer("warnings").notNull().default(0),
  voicemailsReceived: integer("voicemails_received").notNull().default(0),
  flair: integer("flair").notNull().default(15),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per tool call the TUI hands us.
 *
 * `id` is the caller's own tool call id — the TUI needs an id back the moment it
 * submits, long before a Discord thread exists — so the thread id is a separate
 * column and the bot resolves thread → task through it.
 *
 * `created_at` is when the call arrived; `assigned_at` is when a human actually
 * got it. Response times are measured from the latter, so our own dispatch
 * latency isn't billed to the human.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").unique(),
    agentId: text("agent_id").references(() => agents.discordId),

    toolName: text("tool_name").notNull(),
    /** Exactly what came off the wire, kept alongside the prose we derive from it. */
    args: jsonb("args").$type<Record<string, unknown>>().notNull().default({}),
    /** The human-readable ask that gets posted to Discord. */
    description: text("description").notNull(),

    status: text("status").$type<TaskStatus>().notNull().default("queued"),
    escalationLevel: integer("escalation_level").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Whatever the human typed. Stored verbatim; never parsed or applied. */
    reply: text("reply"),
    audioUrl: text("audio_url"),
  },
  (t) => [
    index("tasks_status_idx").on(t.status),
    index("tasks_agent_idx").on(t.agentId),
  ],
);

/** (Stretch) The Bobs' performance reviews. */
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id),
  agentId: text("agent_id").references(() => agents.discordId),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Review = typeof reviews.$inferSelect;
