/**
 * Pre-register the roster with skill tags. Idempotent: re-running refreshes
 * names and skills but never duplicates a row or resets anyone's stats.
 *
 * Anyone who speaks in #general gets upserted automatically too — this seed is
 * for the folks we want to have skills on before the demo starts.
 *
 * NOTE: `discordId` must be a real Discord user id for the @mention in a task
 * thread to actually ping them. Right-click a user → Copy User ID (Developer
 * Mode on). The placeholders below will create rows that mention nobody.
 */
import { upsertAgent, readRoster } from "./repo.js";
import { closeDb } from "./client.js";

const ROSTER: { discordId: string; name: string; skills: string[] }[] = [
  { discordId: "REPLACE_ME_SCOTT", name: "Scott", skills: ["typescript", "backend", "inngest"] },
  { discordId: "REPLACE_ME_BRIAN", name: "Brian", skills: ["typescript", "frontend", "tui"] },
  { discordId: "REPLACE_ME_MILTON", name: "Milton", skills: ["stapler", "basement"] },
];

async function main(): Promise<void> {
  for (const person of ROSTER) {
    await upsertAgent(person);
  }
  const roster = await readRoster();
  console.log(`roster (${roster.length}):`);
  for (const a of roster) {
    console.log(
      `  ${a.name} · skills: ${a.skills.join(", ") || "none"} · done: ${a.tasksCompleted} · flair: ${a.flair}`,
    );
  }
  const placeholders = roster.filter((a) => a.discordId.startsWith("REPLACE_ME_"));
  if (placeholders.length > 0) {
    console.log(
      `\n⚠️  ${placeholders.length} placeholder discord id(s) — @mentions won't ping anyone.` +
        `\n   Put real ids in src/db/seed.ts and re-run.`,
    );
  }
  await closeDb();
}

main().catch(async (err) => {
  console.error("seed failed:", err.message);
  await closeDb().catch(() => {});
  process.exit(1);
});
