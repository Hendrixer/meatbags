export type MeatbagTask = {
  taskId: string;
  file: string;
  status: "pending" | "assigned" | "completed";
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
};

export type ToolImpl = (args: Record<string, unknown>, ctx: ToolCtx) => Promise<string>;
