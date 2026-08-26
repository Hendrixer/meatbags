/**
 * Optional skill tagging.
 *
 * The roster is no longer seeded with people — the workflow reads the live
 * member list from Discord at dispatch time and upserts whoever is in the
 * server, so anyone who joins is eligible immediately. This script exists only
 * to attach skill tags to ids we already know, and to show the current roster.
 *
 * Add entries with REAL Discord user ids (Developer Mode on → right-click a
 * user → Copy User ID). Placeholder ids would create people who can't be
 * @mentioned and who round-robin would happily assign work to.
 */
import { upsertAgent, readRoster } from "./repo.js";
import { closeDb } from "./client.js";

const SKILLS: { discordId: string; name: string; skills: string[] }[] = [
  // { discordId: "356945652858748931", name: "Scotty", skills: ["typescript", "backend"] },
];

async function main(): Promise<void> {
  for (const person of SKILLS) {
    await upsertAgent(person);
  }
  const roster = await readRoster();
  console.log(`roster (${roster.length}):`);
  for (const a of roster) {
    console.log(
      `  ${a.name} · skills: ${a.skills.join(", ") || "none"} · done: ${a.tasksCompleted} · flair: ${a.flair}`,
    );
  }
  if (roster.length === 0) {
    console.log("\n(empty — it fills in on the first dispatch from the live Discord roster)");
  }
  await closeDb();
}

main().catch(async (err) => {
  console.error("seed failed:", err.message);
  await closeDb().catch(() => {});
  process.exit(1);
});
