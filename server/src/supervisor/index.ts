import type { Agent } from "../db/repo.js";
import { describeTask, summarize } from "./describe.js";

export { describeTask, summarize };

export interface Assignment {
  assignee: Agent;
  ask: string;
}

/**
 * Pick who gets stuck with this and write the ask.
 *
 * Currently the deterministic fallback only — `add-supervisor-voice` puts a
 * single Foundry call in front of it that returns both the assignee and a
 * snarkier ask, falling back to exactly this when it can't.
 */
export async function assign(
  toolName: string,
  args: Record<string, unknown>,
  roster: Agent[],
): Promise<Assignment> {
  if (roster.length === 0) {
    throw new Error("Cannot assign a task: the roster is empty. Run `npm run db:seed`.");
  }
  return { assignee: roster[0], ask: describeTask(toolName, args) };
}
