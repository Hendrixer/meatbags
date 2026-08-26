/**
 * The only public surface of this server: the TUI submits a tool call, then
 * polls until a human answers. Shapes are fixed by `tui/CONTRACT.md`.
 *
 * Submitting does no external I/O — it writes a row and fires an event. Every
 * slow thing (picking a human, writing the ask, Discord) happens inside the
 * workflow, so the TUI is never blocked by how slow a meatbag is.
 */
import { Router, type Request, type Response } from "express";
import { inngest } from "../inngest/client.js";
import { config } from "../config.js";
import { createTask, getTask } from "../db/repo.js";
import { describeTask } from "../supervisor/index.js";

function threadUrl(threadId: string | null): string | undefined {
  if (!threadId || !config.discord.guildId) return undefined;
  if (threadId.startsWith("local-")) return undefined; // synthetic, no bot wired
  return `https://discord.com/channels/${config.discord.guildId}/${threadId}`;
}

export const api = Router();

api.post("/api/tasks", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const toolName = typeof body.tool_name === "string" ? body.tool_name.trim() : "";
  const args =
    body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments)
      ? (body.arguments as Record<string, unknown>)
      : {};

  if (!id) return void res.status(400).json({ error: "id is required" });
  if (!toolName) return void res.status(400).json({ error: "tool_name is required" });

  // createTask leaves an existing row untouched and returns undefined, so a
  // retried submit can never reset a task that's already dispatched or answered.
  const created = await createTask({
    id,
    toolName,
    args,
    description: describeTask(toolName, args),
  });
  if (!created) return void res.status(409).json({ id, error: "already submitted" });

  await inngest.send({ name: "tool/call.requested", data: { taskId: id } });
  res.status(201).json({ id, status: "queued" });
});

api.get("/api/tasks/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id ?? "");
  const task = await getTask(id);
  if (!task) return void res.status(404).json({ error: "no such task" });

  // Unknown-yet fields are omitted, not null: a queued task has no assignee,
  // and polling one is the normal case for the first seconds of every task.
  const body: Record<string, unknown> = {
    id: task.id,
    status: task.status,
    escalation_level: task.escalationLevel,
  };
  if (task.assigneeName) body.assignee = task.assigneeName;
  // reply is present exactly when completed — the TUI's stop condition.
  if (task.status === "completed" && task.reply !== null) body.reply = task.reply;
  const thread = threadUrl(task.threadId);
  if (thread) body.thread = thread;

  res.json(body);
});
