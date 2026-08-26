import { render } from "ink";
import { App } from "./app.js";
import { cancelOutstanding } from "./tools/write-code.js";

if (!process.stdin.isTTY) {
  console.error("TPS requires a real terminal (stdin is not a TTY).");
  process.exit(1);
}

const missing = ["FOUNDRY_ENDPOINT", "FOUNDRY_API_KEY", "FOUNDRY_DEPLOYMENT"].filter(
  (k) => !process.env[k],
);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")} — fill in tui/.env (see .env.example).`);
  process.exit(1);
}

// Clear the screen (and scrollback) and park the cursor on the last row so
// the UI renders anchored to the bottom of the terminal from the first frame.
const rows = process.stdout.rows || 24;
process.stdout.write("\x1b[2J\x1b[3J\x1b[H" + "\n".repeat(Math.max(0, rows - 1)));

const app = render(<App />);

// On the way out (quit, ctrl+C), close out any tool calls the meatbags are
// still holding so nobody keeps getting escalated over abandoned work.
await app.waitUntilExit();
await cancelOutstanding();

// pasted from stackoverflow, no notes
