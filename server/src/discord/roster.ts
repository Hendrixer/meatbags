/**
 * Who is actually in the server right now.
 *
 * Discord is the source of truth for who's around; Horizon is the source of
 * truth for what we know about them.
 *
 * A full member fetch is a gateway op that rate-limits hard — asking on every
 * dispatch gets us blocked after the first task. So we fetch at most once a
 * minute and read from discord.js's member cache in between. With the Server
 * Members intent the gateway pushes joins and leaves into that cache, so it
 * stays current without us asking.
 */
import { getClient } from "./client.js";
import { config, require_ } from "../config.js";

export interface LiveMember {
  discordId: string;
  name: string;
}

/** How long a full member fetch is considered fresh. */
const REFRESH_MS = 60_000;
let lastFetch = 0;

/** Every non-bot member of the guild. */
export async function fetchGuildMembers(): Promise<LiveMember[]> {
  const guildId = require_(config.discord.guildId, "DISCORD_GUILD_ID");
  const guild = await getClient().guilds.fetch(guildId);

  const stale = Date.now() - lastFetch > REFRESH_MS;
  if (stale || guild.members.cache.size === 0) {
    try {
      await guild.members.fetch();
      lastFetch = Date.now();
    } catch (err) {
      // Rate limited. If the cache is already warm the gateway has been keeping
      // it current, so use it rather than failing the dispatch.
      if (guild.members.cache.size === 0) throw err;
    }
  }

  return [...guild.members.cache.values()]
    .filter((m) => !m.user.bot)
    .map((m) => ({ discordId: m.id, name: m.displayName || m.user.username }));
}

/** Whether we can ask Discord at all. */
export function canFetchRoster(): boolean {
  return Boolean(config.discord.botToken && config.discord.guildId);
}
