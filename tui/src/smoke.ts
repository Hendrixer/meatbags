// Headless harness check: runs one agent turn without Ink so the loop,
// tools, and mock meatbag API can be exercised from a plain shell.
//   npm run smoke -- "your prompt here"
import { runTurn } from "./agent.js";
import { SYSTEM_PROMPT } from "./foundry.js";

const prompt = process.argv.slice(2).join(" ") || "What files are in this project?";
const messages = [
  { role: "system" as const, content: SYSTEM_PROMPT },
  { role: "user" as const, content: prompt },
];

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());

await runTurn(
  messages,
  (e) => {
    switch (e.type) {
      case "assistant_delta":
        process.stdout.write(e.text);
        break;
      case "assistant_done":
        process.stdout.write("\n");
        break;
      case "tool_start":
        console.log(`\n[tool_start] ${e.name} ${JSON.stringify(e.args)}`);
        break;
      case "tool_end":
        console.log(`[tool_end] ${e.name} → ${e.resultSummary}`);
        break;
      case "task_update":
        console.log(
          `[task] #${e.task.taskId} ${e.task.status} lv${e.task.escalation_level} ${e.task.assignee ?? ""}`,
        );
        break;
      case "error":
        console.error(`[error] ${e.message}`);
        break;
      case "turn_done":
        console.log("[turn_done]");
        break;
    }
  },
  controller.signal,
);
