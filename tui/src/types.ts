export type MeatbagTask = {
  taskId: string;
  file: string;
  status: "queued" | "assigned" | "completed";
  escalation_level: number;
  assignee: string | null;
  reply: string | null;
};

export type AgentEvent =
  | { type: "assistant_delta"; text: string }
  | { type: "assistant_done"; text: string }
  | { type: "tool_start"; name: string; args: Record<string, unknown> }
  | { type: "tool_end"; name: string; args: Record<string, unknown>; resultSummary: string }
  | { type: "task_update"; task: MeatbagTask }
  | { type: "turn_done" }
  | { type: "error"; message: string };

export type ToolCtx = {
  signal: AbortSignal;
  emit: (e: AgentEvent) => void;
  callId: string;
};

export type ToolImpl = (args: Record<string, unknown>, ctx: ToolCtx) => Promise<string>;

// Task ids are OpenAI tool_call_ids ("call_aB3…"); keep displays tidy.
export function shortTaskId(id: string): string {
  return id.length > 10 ? `…${id.slice(-6)}` : id;
}
