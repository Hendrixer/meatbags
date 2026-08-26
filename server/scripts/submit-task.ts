/**
 * Fire one tool call at the server so you can watch the run in the Inngest dev
 * UI (http://localhost:8288). Same shape the TUI posts.
 *
 *   npm run demo:task                     # a write_code task
 *   npm run demo:task -- --answer <id>    # answer an outstanding task
 */
const SERVER = process.env.MEATBAG_SERVER ?? "http://localhost:3000";
const INNGEST = process.env.INNGEST_DEV_URL ?? "http://localhost:8288";

const args = process.argv.slice(2);
const answerIdx = args.indexOf("--answer");

if (answerIdx !== -1) {
  const taskId = args[answerIdx + 1];
  if (!taskId) {
    console.error("usage: npm run demo:task -- --answer <taskId> [reply...]");
    process.exit(1);
  }
  const reply =
    args.slice(answerIdx + 2).join(" ") ||
    "```ts\nexport function toggleDarkMode(): void {\n  document.body.classList.toggle('dark');\n}\n```\nidk man it compiles";
  const res = await fetch(`${INNGEST}/e/dev_key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "human/task.completed", data: { taskId, reply } }),
  });
  console.log(`answered ${taskId} → ${res.status}`);
  console.log(`poll: curl -s ${SERVER}/api/tasks/${taskId}`);
} else {
  const id = `call_${Math.random().toString(36).slice(2, 10)}`;
  const body = {
    id,
    tool_name: "write_code",
    arguments: {
      file: "src/theme.ts",
      description: "Add a dark mode toggle to the settings page.",
      contract: "export function toggleDarkMode(): void",
      existing_code: "export function settings() {\n  return null;\n}\n",
    },
  };
  const res = await fetch(`${SERVER}/api/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(`POST /api/tasks → ${res.status} ${await res.text()}`);
  console.log(`\n  watch:   ${INNGEST}/runs`);
  console.log(`  poll:    curl -s ${SERVER}/api/tasks/${id}`);
  console.log(`  answer:  npm run demo:task -- --answer ${id}`);
}
