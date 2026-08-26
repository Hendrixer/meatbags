import { render } from "ink";
import { App } from "./app.js";

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

render(<App />);
