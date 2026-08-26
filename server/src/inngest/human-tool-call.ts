/**
 * One durable run per tool call: pick a human, hand it to them, wait however
 * long it takes, store whatever they say back.
 *
 * The waiting is the whole point — a run parked on `waitForEvent` is a human
 * ignoring us, and the dev UI shows one per outstanding task.
 */
import { NonRetriableError } from "inngest";
import { inngest } from "./client.js";
import { config } from "../config.js";
import { getTask, dispatchTask, completeTask, bumpEscalation } from "../db/repo.js";
import { assign, summarize } from "../supervisor/index.js";

/** How long a level waits before the ladder climbs. */
const WAIT_TIMEOUT = config.waitTimeout;
const MAX_LEVEL = 4;

/**
 * Post the ask where the human will see it and return the thread id.
 *
 * Discord is Brian's half (`add-discord-bridge`). Until his bot is wired, a run
 * with no bot token gets a synthetic thread id so the workflow is fully
 * testable without Discord — everything downstream keys off `thread_id`, not
 * off Discord itself.
 */
async function postTask(
  assignee: { discordId: string; name: string },
  ask: string,
  taskId: string,
): Promise<string> {
  // Needs BOTH a bot and somewhere to post. A token with no channel id would
  // throw inside the dispatch step and just look like a broken workflow.
  if (!config.discord.botToken || !config.discord.tasksChannelId) {
    console.log(
      `\n─── [no discord] would post to ${assignee.name} ───\n${ask}\n───────────────────────────────\n`,
    );
    return `local-${taskId}`;
  }
  const { createTaskThread } = await import("../discord/tasks.js");
  const { threadId } = await createTaskThread(assignee, ask);
  return threadId;
}

export const humanToolCall = inngest.createFunction(
  { id: "human-tool-call", triggers: [{ event: "tool/call.requested" }] },
  async ({ event, step }) => {
    const taskId = String(event.data?.taskId ?? "");
    if (!taskId) throw new NonRetriableError("tool/call.requested has no taskId");

    // ── dispatch ──────────────────────────────────────────────────────────
    // One step: a retry replays the whole handoff or none of it, so we can't
    // end up with two threads for one task.
    const dispatched = await step.run("dispatch", async () => {
      const task = await getTask(taskId);
      if (!task) throw new NonRetriableError(`no task ${taskId}`);

      // Roster is read live from Discord here, not at submit time — whoever is
      // in the server when the task lands is who's eligible for it.
      const { assignee, ask, how } = await assign(task.toolName, task.args);
      console.log(`📋 ${taskId} → ${assignee.name} [${how}]`);

      const threadId = await postTask(assignee, ask, taskId);
      await dispatchTask(taskId, { agentId: assignee.discordId, threadId });

      return { assignee: assignee.name, threadId, how, summary: summarize(task.toolName, task.args) };
    });

    // ── wait, climbing the ladder on each silence ─────────────────────────
    // The nags themselves land with `add-escalation-ladder`; a level with no
    // channel wired is a no-op that still raises the level and keeps waiting.
    let level = 1;
    for (let attempt = 1; ; attempt++) {
      const answered = await step.waitForEvent(`await-${attempt}`, {
        event: "human/task.completed",
        timeout: WAIT_TIMEOUT,
        if: `async.data.taskId == "${taskId}"`,
      });

      if (answered) {
        const reply = String(answered.data?.reply ?? "");
        await step.run(`complete-${attempt}`, () => completeTask(taskId, reply));
        return { taskId, assignee: dispatched.assignee, escalationLevel: level, answered: true };
      }

      if (level < MAX_LEVEL) {
        level = await step.run(`escalate-${attempt}`, () => bumpEscalation(taskId));
      }
      // At the top of the ladder we keep waiting. We never give up on a meatbag.
    }
  },
);

/**
 * Demo insurance. With `CONTRACTOR_AUTOREPLY_MS` set, an outside contractor
 * answers the task after that long, so the workflow completes with nobody
 * watching Discord. Unset, this does nothing at all.
 *
 * It's a separate function so the sleep doesn't block the run that's waiting.
 */
export const contractor = inngest.createFunction(
  { id: "contractor-autoreply", triggers: [{ event: "tool/call.requested" }] },
  async ({ event, step }) => {
    const ms = config.contractorAutoreplyMs;
    if (!ms) return { skipped: "CONTRACTOR_AUTOREPLY_MS unset" };

    const taskId = String(event.data?.taskId ?? "");
    // Inngest wants a duration string it can parse; seconds is unambiguous.
    await step.sleep("let-them-sweat", `${Math.max(1, Math.round(ms / 1000))}s`);

    const stillOpen = await step.run("check", async () => {
      const task = await getTask(taskId);
      return task ? task.status !== "completed" : false;
    });
    if (!stillOpen) return { taskId, skipped: "already answered" };

    await step.sendEvent("contractor-reply", {
      name: "human/task.completed",
      data: {
        taskId,
        reply: "// contractor did this one, don't ask me how it works\n",
      },
    });
    return { taskId, autoReplied: true };
  },
);
