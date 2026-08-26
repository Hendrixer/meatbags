import type OpenAI from "openai";
import { MODEL, makeClient } from "./foundry.js";
import { toolImpls, toolSchemas } from "./tools/registry.js";
import type { AgentEvent } from "./types.js";

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const MAX_ITERATIONS = 15;

function summarizeResult(name: string, result: string): string {
  if (result.startsWith("Error:")) return result.split("\n")[0];
  const lines = result.split("\n");
  if (name === "read_file" || name === "run_command") return `${lines.length} lines`;
  if (name === "list_files") return `${lines.length} files`;
  if (name === "grep") return result === "No matches." ? "no matches" : `${lines.length} matches`;
  const first = lines[0] ?? "";
  return first.length > 60 ? `${first.slice(0, 60)}…` : first;
}

export async function runTurn(
  messages: Message[],
  emit: (e: AgentEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const client = makeClient();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stream = await client.chat.completions.create(
      { model: MODEL, messages, tools: toolSchemas, stream: true },
      { signal },
    );

    let content = "";
    const toolCalls = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        emit({ type: "assistant_delta", text: delta.content });
      }
      for (const tc of delta.tool_calls ?? []) {
        const entry = toolCalls.get(tc.index) ?? { id: "", name: "", args: "" };
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) entry.args += tc.function.arguments;
        toolCalls.set(tc.index, entry);
      }
    }

    const calls = [...toolCalls.values()];
    messages.push({
      role: "assistant",
      content: content || null,
      ...(calls.length && {
        tool_calls: calls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: c.args },
        })),
      }),
    });
    if (content) emit({ type: "assistant_done", text: content });

    if (!calls.length) {
      emit({ type: "turn_done" });
      return;
    }

    for (const call of calls) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      let args: Record<string, unknown> = {};
      let result: string;
      try {
        args = JSON.parse(call.args || "{}");
      } catch {
        args = {};
      }
      emit({ type: "tool_start", name: call.name, args });
      const impl = toolImpls[call.name];
      if (!impl) {
        result = `Error: unknown tool ${call.name}`;
      } else {
        try {
          result = await impl(args, { signal, emit });
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err;
          result = `Error: ${(err as Error).message}`;
        }
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
      emit({ type: "tool_end", name: call.name, args, resultSummary: summarizeResult(call.name, result) });
    }
  }

  emit({ type: "error", message: `Gave up after ${MAX_ITERATIONS} rounds of tool calls.` });
  emit({ type: "turn_done" });
}
