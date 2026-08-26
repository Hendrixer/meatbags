import express from "express";
import { serve } from "inngest/express";
import { inngest, functions } from "./src/inngest/index.js";
import { startBot } from "./src/discord/index.js";
import { config } from "./src/config.js";
import { api } from "./src/api/routes.js";
import { hr } from "./src/api/hr.js";

const app = express();
app.use(express.json());

// Serve the Inngest functions for the dev server.
app.use("/api/inngest", serve({ client: inngest, functions }));

// The TUI-facing routes: submit a tool call, poll for the human's answer.
app.use(api);

// The HR oversight dashboard (read-only): /hr
app.use(hr);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Inngest endpoint: http://localhost:${config.port}/api/inngest`);

  // Start the Discord gateway bot if configured; otherwise boot without it so
  // the server still runs (the serve endpoint doesn't need Discord).
  if (config.discord.botToken) {
    startBot().catch((err) => console.error("bot failed to start:", err.message));
  } else {
    console.log("⚠️  DISCORD_BOT_TOKEN unset — Discord bot not started (see .env.example)");
  }
});
