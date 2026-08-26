import type { Agent } from "../db/repo.js";
import { readCandidates, readRoster, upsertAgent } from "../db/repo.js";
import { canFetchRoster, fetchGuildMembers } from "../discord/index.js";
import { describeTask, summarize } from "./describe.js";

export { describeTask, summarize };

export interface Assignment {
  assignee: Pick<Agent, "discordId" | "name">;
  ask: string;
  /** How the assignee was chosen, for the run's logs. */
  how: string;
}

/**
 * Ask Discord who's in the server right now and make sure we know all of them.
 * Discord says who's here; Horizon says what we know about them. Someone who
 * joined a minute ago is eligible for work immediately.
 *
 * Falls back to whoever is already in the roster when there's no bot to ask —
 * an unconfigured Discord shouldn't stop a task being handed to somebody.
 */
async function liveRoster(): Promise<{ ids: string[]; source: string }> {
  if (canFetchRoster()) {
    try {
      const members = await fetchGuildMembers();
      if (members.length > 0) {
        // Name only: an upsert with no skills leaves existing skill tags alone.
        for (const m of members) await upsertAgent({ discordId: m.discordId, name: m.name });
        return { ids: members.map((m) => m.discordId), source: `discord (${members.length})` };
      }
    } catch (err) {
      console.warn(`roster: Discord fetch failed (${(err as Error).message}); using stored roster`);
    }
  }
  const stored = await readRoster();
  return { ids: stored.map((a) => a.discordId), source: `stored (${stored.length})` };
}

/**
 * Pick who gets stuck with this, and write the ask.
 *
 * Round-robin by current workload: whoever has the fewest unanswered tasks, and
 * among equals whoever has gone longest without being handed anything. It is
 * deliberately not "best person for the job" — the joke is that the work lands
 * on whoever is standing closest to it.
 *
 * `add-supervisor-voice` puts a Foundry call in front of the ask; the pick stays
 * here.
 */
export async function assign(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Assignment> {
  const { ids, source } = await liveRoster();
  if (ids.length === 0) {
    throw new Error(
      "Nobody to assign to: Discord returned no members and the roster is empty. " +
        "Check DISCORD_GUILD_ID / the Server Members intent, or run `npm run db:seed`.",
    );
  }

  const candidates = await readCandidates(ids);
  if (candidates.length === 0) {
    throw new Error(`Roster source ${source} returned ids we have no agent rows for.`);
  }

  const picked = candidates[0];
  const how =
    `${source} · open=${picked.openTasks} · ` +
    `last=${picked.lastAssignedAt ? picked.lastAssignedAt.toISOString() : "never"}`;

  return {
    assignee: { discordId: picked.discordId, name: picked.name },
    ask: describeTask(toolName, args),
    how,
  };
}
