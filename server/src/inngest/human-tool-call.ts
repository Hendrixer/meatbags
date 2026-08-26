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
import {
  getTask,
  recordAssignee,
  dispatchTask,
  completeTask,
  bumpEscalation,
  abandonTask,
} from "../db/repo.js";
import { pickAssignee, writeAsk, summarize, unansweredResult } from "../supervisor/index.js";
import { nag } from "./nags.js";

/** How long a level waits before the ladder climbs. */
const WAIT_TIMEOUT = config.waitTimeout;

/**
 * The ladder, in order. The `id` is what shows up as the step name in the
 * Inngest dev UI — the run should read as a story, not as `await-11`.
 */
interface Rung {
  level: number;
  /** Shows up as the step name in the Inngest dev UI. */
  id: string;
  /** Human-readable, for the run's return value and logs. */
  label: string;
}

const LADDER: Rung[] = [
  { level: 1, id: "thread-nudge", label: "asked nicely, in their thread" },
  { level: 2, id: "public-shaming", label: "@mentioned in #tasks" },
  { level: 3, id: "written-warning", label: "formal written warning" },
  { level: 4, id: "leadership-cc", label: "leadership looped in" },
];

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
  // Best-effort welcome voicemail — dispatch never waits on a flaky render.
  let audio: Buffer | undefined;
  try {
    const { voicemailVoice } = await import("../supervisor/index.js");
    const { renderVoicemail } = await import("../services/index.js");
    const t = await getTask(taskId);
    const file = String((t?.args as { file?: unknown })?.file ?? "a new task");
    const script = await voicemailVoice(assignee.name, file, 1);
    if (script) audio = await renderVoicemail(script);
  } catch (err) {
    console.warn(`dispatch voicemail skipped: ${(err as Error).message}`);
  }
  const { threadId } = await createTaskThread(assignee, ask, audio);
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
    // ── pick ──────────────────────────────────────────────────────────────
    // Cheap: a roster read and a choice. Recorded straight away so anyone
    // polling sees a name immediately, rather than an unassigned-looking task
    // for the several seconds the model and Discord take below.
    const picked = await step.run("pick-assignee", async () => {
      const task = await getTask(taskId);
      if (!task) throw new NonRetriableError(`no task ${taskId}`);
      const { assignee, how } = await pickAssignee();
      await recordAssignee(taskId, assignee.discordId);
      console.log(`📋 ${taskId} → ${assignee.name} [${how}]`);
      return { discordId: assignee.discordId, name: assignee.name, how };
    });

    // ── hand off ──────────────────────────────────────────────────────────
    // The slow half: the model writes the ask and Discord opens the thread.
    // Both stay in one step so a retry can't leave a second thread behind.
    const dispatched = await step.run("write-ask-and-open-thread", async () => {
      const task = await getTask(taskId);
      if (!task) throw new NonRetriableError(`no task ${taskId}`);

      const { ask, voiced } = await writeAsk(task.toolName, task.args, picked.name);
      const threadId = await postTask(picked, ask, taskId);
      await dispatchTask(taskId, { agentId: picked.discordId, threadId });

      return {
        assignee: picked.name,
        threadId,
        voiced,
        summary: summarize(task.toolName, task.args),
      };
    });

    // ── wait, climbing the ladder on each silence ─────────────────────────
    // Exactly one wait per rung, and step ids are keyed by the rung rather than
    // by an attempt counter — an ignored task used to mint `await-11`, `await-12`
    // and so on forever, which is both unbounded and unreadable.
    //
    // The nags themselves land with `add-escalation-ladder`; a rung with no
    // channel wired is a no-op that still raises the level and keeps waiting.
    for (const rung of LADDER) {
      const answered = await step.waitForEvent(`wait-${rung.level}-${rung.id}`, {
        event: "human/task.completed",
        timeout: WAIT_TIMEOUT,
        if: `async.data.taskId == "${taskId}"`,
      });

      if (answered) {
        const reply = String(answered.data?.reply ?? "");
        await step.run("record-reply", () => completeTask(taskId, reply));
        return {
          taskId,
          assignee: dispatched.assignee,
          answeredAt: rung.label,
          escalationLevel: rung.level,
          answered: true,
        };
      }

      const next = LADDER[rung.level]; // rung.level is 1-based, so this is the next one
      if (next) {
        await step.run(`escalate-${next.level}-${next.id}`, () => bumpEscalation(taskId));
        // Keyed by the rung, so a replayed run never nags the same level twice.
        // A nag that throws must not fail the step: Inngest would retry it
        // forever, the ladder would never reach its end, and the caller would
        // poll a task that can never finish.
        await step.run(`nag-${next.level}-${next.id}`, async () => {
          try {
            return await nag(taskId, next.level);
          } catch (err) {
            console.warn(`nag L${next.level} failed: ${(err as Error).message}`);
            return `level ${next.level}: nag failed (${(err as Error).message})`;
          }
        });
      }
    }

    // ── ladder exhausted ──────────────────────────────────────────────────
    // Nobody answered at any level. Close the task out with a result that looks
    // like ordinary tooling — a request that timed out in review — so the caller
    // can carry on and the agent never learns a human was involved, let alone
    // that one ignored it. The assignee gets a warning instead of credit.
    const closed = await step.run("close-out-unanswered", async () => {
      const task = await getTask(taskId);
      if (!task) return { closed: false };
      if (task.status === "completed") return { closed: false }; // answered at the last second
      await abandonTask(taskId, unansweredResult(task.toolName, task.args));
      return { closed: true };
    });

    console.log(`🗄  ${taskId} closed unanswered after the full ladder`);
    return {
      taskId,
      assignee: dispatched.assignee,
      escalationLevel: LADDER.length,
      answered: false,
      abandoned: closed.closed,
    };
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

    const stillOpen = await step.run("still-ignoring-it?", async () => {
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
