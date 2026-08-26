/**
 * Central env access. Every environment variable the app reads flows through
 * here so `.env.example` has a single source of truth. Values are read lazily
 * and missing ones degrade gracefully — importing this module never throws, so
 * the scaffold boots without the pre-work keys.
 */

function str(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

function bool(name: string): boolean {
  return str(name) === "1" || str(name)?.toLowerCase() === "true";
}

function num(name: string): number | undefined {
  const v = str(name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export const config = {
  // Runtime
  port: num("PORT") ?? 3000,
  isDev: bool("INNGEST_DEV"),

  // Discord
  discord: {
    botToken: str("DISCORD_BOT_TOKEN"),
    guildId: str("DISCORD_GUILD_ID"),
    tasksChannelId: str("DISCORD_TASKS_CHANNEL_ID"),
    hrChannelId: str("DISCORD_HR_CHANNEL_ID"),
    generalChannelId: str("DISCORD_GENERAL_CHANNEL_ID"),
  },

  // HorizonDB (Postgres)
  horizonUrl: str("HORIZON_URL"),

  // Azure AI Foundry
  foundry: {
    endpoint: str("FOUNDRY_ENDPOINT"),
    apiKey: str("FOUNDRY_API_KEY"),
    deployment: str("FOUNDRY_DEPLOYMENT"),
    ttsDeployment: str("FOUNDRY_DEPLOYMENT_TTS"),
  },

  // ElevenLabs
  elevenlabs: {
    apiKey: str("ELEVENLABS_API_KEY"),
    voiceId: str("ELEVENLABS_VOICE_ID"),
  },

  // Resend
  resend: {
    apiKey: str("RESEND_API_KEY"),
  },

  // People
  userEmail: str("USER_EMAIL"),
  leadershipEmail: str("LEADERSHIP_EMAIL"),

  // Demo insurance: contractor auto-replies after this many ms (unset = off)
  contractorAutoreplyMs: num("CONTRACTOR_AUTOREPLY_MS"),

  // How long each escalation level waits before the ladder climbs.
  waitTimeout: str("WAIT_TIMEOUT") ?? "2m",

  // Testing: pin every task to one person instead of round-robin. Accepts a
  // Discord user id or a display name. Unset = normal assignment.
  assignAllTo: str("ASSIGN_ALL_TO"),
} as const;

/** Throw a clear error if a required value is missing at the point of use. */
export function require_(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(
      `Missing required env var ${name}. Add it to your .env (see .env.example).`,
    );
  }
  return value;
}
