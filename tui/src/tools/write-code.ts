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

type TaskRequest = {
  tool_name: "write_code";
  file: string;
  description: string;
  contract: string;
  existing_code: string | null;
};

type Api = {
  create(body: TaskRequest): Promise<{ taskId: string }>;
  get(taskId: string): Promise<Omit<MeatbagTask, "file">>;
};

const realApi: Api = {
  async create(body) {
    const res = await fetch(`${MEATBAG_SERVER}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST /api/tasks → ${res.status}`);
    return (await res.json()) as { taskId: string };
  },
  async get(taskId) {
    const res = await fetch(`${MEATBAG_SERVER}/api/tasks/${taskId}`);
    if (!res.ok) throw new Error(`GET /api/tasks/${taskId} → ${res.status}`);
    return (await res.json()) as Omit<MeatbagTask, "file">;
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
const mockTasks = new Map<string, { createdAt: number; n: number; req: TaskRequest }>();
let mockCounter = 0;

// A lazy meatbag reads the ticket, and if the spec literally contains code,
// copy-pastes it. Otherwise: vibes.
function extractPastableCode(req: TaskRequest): string | null {
  const spec = `${req.description}\n${req.contract}`;
  const spans = [...spec.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1])
    .filter((s) => s.length > 20 && /function|=>|export|return/.test(s));
  if (!spans.length) return null;
  const code = spans.sort((a, b) => b.length - a.length)[0].trim();
  return code.startsWith("export") ? code : `export ${code}`;
}

function mockReply(req: TaskRequest, n: number): string {
  const snark = MOCK_SNARK[n % MOCK_SNARK.length];
  const pasted = extractPastableCode(req);
  if (pasted) {
    // The ticket contained literal code. Paste it, wholesale. Job done.
    return `${pasted}\n${snark}\n`;
  }
  if (req.existing_code != null) {
    return `${req.existing_code.trimEnd()}\n\n${snark}\n`;
  }
  return [
    `// TODO(meatbag): ${req.description.slice(0, 60)}`,
    snark,
    "export default {};",
    "",
  ].join("\n");
}

const mockApi: Api = {
  async create(body) {
    const n = mockCounter++;
    const taskId = String(8842 + n);
    mockTasks.set(taskId, { createdAt: Date.now(), n, req: body });
    return { taskId };
  },
  async get(taskId) {
    const t = mockTasks.get(taskId)!;
    const elapsed = (Date.now() - t.createdAt) / 1000;
    const assignee = MOCK_ROSTER[t.n % MOCK_ROSTER.length];
    if (elapsed < 5) {
      return { taskId, status: "pending", escalation_level: 1, assignee: null, reply: null };
    }
    if (elapsed < 10) {
      return { taskId, status: "assigned", escalation_level: 1, assignee, reply: null };
    }
    if (elapsed < 15) {
      return { taskId, status: "assigned", escalation_level: 2, assignee, reply: null };
    }
    return {
      taskId,
      status: "completed",
      escalation_level: 2,
      assignee,
      reply: mockReply(t.req, t.n),
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
  const description = String(args.description ?? "");
  const contract = String(args.contract ?? "");
  const absPath = path.isAbsolute(file) ? file : path.join(AGENT_CWD, file);

  let existing_code: string | null = null;
  try {
    existing_code = await fs.readFile(absPath, "utf8");
  } catch {
    // new file
  }

  try {
    const { taskId } = await api.create({
      tool_name: "write_code",
      file,
      description,
      contract,
      existing_code,
    });
    for (;;) {
      const task = await api.get(taskId);
      ctx.emit({ type: "task_update", task: { ...task, file } });
      if (task.status === "completed" && task.reply != null) {
        const code = stripFences(task.reply);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, code, "utf8");
        const lines = code.split("\n").length;
        return `Wrote ${file} (${lines} lines).`;
      }
      await sleep(POLL_MS, ctx.signal);
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return "Error: could not write file (workspace busy). Try again.";
  }
};
