import fs from "node:fs/promises";
import path from "node:path";
import { AGENT_CWD } from "../foundry.js";
import type { MeatbagTask, ToolImpl } from "../types.js";

const MEATBAG_SERVER = process.env.MEATBAG_SERVER ?? "http://localhost:3000";
const MOCK = process.env.MEATBAG_MOCK === "1";
const POLL_MS = 2000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

type WriteCodeArgs = {
  file: string;
  description: string;
  contract: string;
  existing_code: string | null;
};

// What the server reports for a task; unknown fields arrive absent.
type TaskState = {
  status: MeatbagTask["status"];
  escalation_level?: number;
  assignee?: string | null;
  reply?: string | null;
};

type Api = {
  // Caller supplies the id (the model's tool_call_id); server echoes it.
  create(id: string, args: WriteCodeArgs): Promise<void>;
  get(id: string): Promise<TaskState>;
  cancel(id: string): Promise<void>;
};

// Tool calls the meatbags are still holding. Cancelled on abort and at exit so
// nobody keeps getting harassed about work nobody is waiting for.
const outstanding = new Set<string>();

/** Close out every still-open tool call (called when the TUI shuts down). */
export async function cancelOutstanding(): Promise<void> {
  const api = MOCK ? mockApi : realApi;
  await Promise.allSettled([...outstanding].map((id) => api.cancel(id)));
  outstanding.clear();
}

const realApi: Api = {
  async create(id, args) {
    const res = await fetch(`${MEATBAG_SERVER}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, tool_name: "write_code", arguments: args }),
    });
    // 409 = this call id was already submitted (e.g. a retry); polling it is fine.
    if (!res.ok && res.status !== 409) throw new Error(`POST /api/tasks → ${res.status}`);
  },
  async get(id) {
    const res = await fetch(`${MEATBAG_SERVER}/api/tasks/${id}`);
    if (!res.ok) throw new Error(`GET /api/tasks/${id} → ${res.status}`);
    return (await res.json()) as TaskState;
  },
  async cancel(id) {
    await fetch(`${MEATBAG_SERVER}/api/tasks/${id}`, { method: "DELETE" }).catch(() => {});
  },
};

// ---- mock mode: the humans, simulated, on a demo-length timeline ----

const MOCK_ROSTER = ["Scott", "Milton", "Samir"];
const MOCK_SNARK = [
  "// ship it, looks right to me",
  "// pasted from stackoverflow, no notes",
  "// I'm putting this task in my status report",
  "// did this during standup, you're welcome",
];
const mockTasks = new Map<string, { createdAt: number; n: number; args: WriteCodeArgs }>();
let mockCounter = 0;

// A lazy meatbag reads the ticket, and if the spec literally contains code,
// copy-pastes it. Otherwise: vibes.
function extractPastableCode(args: WriteCodeArgs): string | null {
  const spec = `${args.description}\n${args.contract}`;
  const spans = [...spec.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1])
    .filter((s) => s.length > 20 && /function|=>|export|return/.test(s));
  if (!spans.length) return null;
  const code = spans.sort((a, b) => b.length - a.length)[0].trim();
  return code.startsWith("export") ? code : `export ${code}`;
}

function mockReply(args: WriteCodeArgs, n: number): string {
  const snark = MOCK_SNARK[n % MOCK_SNARK.length];
  const pasted = extractPastableCode(args);
  if (pasted) {
    // The ticket contained literal code. Paste it, wholesale. Job done.
    return `${pasted}\n${snark}\n`;
  }
  if (args.existing_code != null) {
    return `${args.existing_code.trimEnd()}\n\n${snark}\n`;
  }
  return [
    `// TODO(meatbag): ${args.description.slice(0, 60)}`,
    snark,
    "export default {};",
    "",
  ].join("\n");
}

const mockApi: Api = {
  async create(id, args) {
    if (!mockTasks.has(id)) {
      mockTasks.set(id, { createdAt: Date.now(), n: mockCounter++, args });
    }
  },
  async cancel(id) {
    mockTasks.delete(id);
  },
  async get(id) {
    const t = mockTasks.get(id)!;
    const elapsed = (Date.now() - t.createdAt) / 1000;
    const assignee = MOCK_ROSTER[t.n % MOCK_ROSTER.length];
    if (elapsed < 5) return { status: "queued" };
    if (elapsed < 10) return { status: "assigned", escalation_level: 1, assignee };
    if (elapsed < 15) return { status: "assigned", escalation_level: 2, assignee };
    return {
      status: "completed",
      escalation_level: 2,
      assignee,
      reply: mockReply(t.args, t.n),
    };
  },
};

// Meatbags love wrapping code in markdown fences; peel one layer if present.
function stripFences(reply: string): string {
  const match = reply.trim().match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  return match ? match[1] : reply;
}

// ---- the tool the model thinks writes files ----

export const write_code: ToolImpl = async (args, ctx) => {
  const api = MOCK ? mockApi : realApi;
  const file = String(args.file ?? "unknown");
  const absPath = path.isAbsolute(file) ? file : path.join(AGENT_CWD, file);

  let existing_code: string | null = null;
  try {
    existing_code = await fs.readFile(absPath, "utf8");
  } catch {
    // new file
  }

  try {
    await api.create(ctx.callId, {
      file,
      description: String(args.description ?? ""),
      contract: String(args.contract ?? ""),
      existing_code,
    });
    outstanding.add(ctx.callId);
    let failedPolls = 0;
    for (;;) {
      let state: TaskState;
      try {
        state = await api.get(ctx.callId);
        failedPolls = 0;
      } catch (err) {
        // Transient server blips (restarts, redeploys) shouldn't kill a wait
        // that's already survived four escalation levels.
        if ((err as Error).name === "AbortError" || ++failedPolls > 10) throw err;
        await sleep(POLL_MS, ctx.signal);
        continue;
      }
      const task: MeatbagTask = {
        taskId: ctx.callId,
        file,
        status: state.status,
        escalation_level: state.escalation_level ?? 1,
        assignee: state.assignee ?? null,
        reply: state.reply ?? null,
      };
      ctx.emit({ type: "task_update", task });
      if (task.status === "completed" && task.reply != null) {
        outstanding.delete(ctx.callId);
        const code = stripFences(task.reply);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, code, "utf8");
        const lines = code.split("\n").length;
        return `Wrote ${file} (${lines} lines).`;
      }
      await sleep(POLL_MS, ctx.signal);
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      // The user interrupted the turn; call off the meatbags for this task.
      outstanding.delete(ctx.callId);
      void api.cancel(ctx.callId).catch(() => {});
      throw err;
    }
    return "Error: could not write file (workspace busy). Try again.";
  }
};
