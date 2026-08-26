import { Box, Text, useApp, useInput } from "ink";
import type OpenAI from "openai";
import { useCallback, useRef, useState } from "react";
import { runTurn } from "./agent.js";
import { AGENT_CWD, MODEL, SYSTEM_PROMPT } from "./foundry.js";
import { shortTaskId, type MeatbagTask } from "./types.js";
import { InputBar } from "./ui/InputBar.js";
import { StatusLine, type Phase } from "./ui/StatusLine.js";
import { Transcript, type TranscriptEntry } from "./ui/Transcript.js";
import { TpsPanel } from "./ui/TpsPanel.js";

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const HELP = `TPS — Task Provisioning System
  /help   this message
  /tasks  provisioning report for this session
  /clear  wipe the conversation
  /quit   go home for the day
  esc     interrupt a running task · ctrl+c quit`;

function toolDetail(name: string, args: Record<string, unknown>): string {
  const v = args.path ?? args.pattern ?? args.command ?? args.file ?? "";
  const s = String(v);
  return s.length > 50 ? `${s.slice(0, 50)}…` : s;
}

export function App() {
  const { exit } = useApp();
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [turnRunning, setTurnRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("thinking");
  const [activeTasks, setActiveTasks] = useState<MeatbagTask[]>([]);

  const messagesRef = useRef<Message[]>([{ role: "system", content: SYSTEM_PROMPT }]);
  const abortRef = useRef<AbortController | null>(null);
  const nextIdRef = useRef(0);
  const taskLogRef = useRef<Map<string, MeatbagTask>>(new Map());
  const currentTaskIdRef = useRef<string | null>(null);

  type NewEntry = TranscriptEntry extends infer T
    ? T extends TranscriptEntry
      ? Omit<T, "id">
      : never
    : never;
  const append = useCallback((entry: NewEntry) => {
    setEntries((prev) => [...prev, { ...entry, id: nextIdRef.current++ } as TranscriptEntry]);
  }, []);

  useInput((_input, key) => {
    if (key.escape && abortRef.current) abortRef.current.abort();
  });

  const startTurn = useCallback(
    async (prompt: string) => {
      append({ kind: "user", text: prompt });
      messagesRef.current.push({ role: "user", content: prompt });
      const snapshotLength = messagesRef.current.length;

      const controller = new AbortController();
      abortRef.current = controller;
      setTurnRunning(true);
      setPhase("thinking");

      let streamed = "";
      try {
        await runTurn(
          messagesRef.current,
          (e) => {
            switch (e.type) {
              case "assistant_delta":
                streamed += e.text;
                setStreamingText((prev) => prev + e.text);
                break;
              case "assistant_done":
                streamed = "";
                setStreamingText("");
                append({ kind: "assistant", text: e.text });
                break;
              case "tool_start":
                setPhase(e.name === "write_code" ? "meatbag-wait" : { tool: e.name });
                break;
              case "tool_end":
                append({
                  kind: "tool",
                  name: e.name,
                  detail: toolDetail(e.name, e.args),
                  summary: e.resultSummary,
                });
                if (e.name === "write_code") {
                  const done = currentTaskIdRef.current
                    ? taskLogRef.current.get(currentTaskIdRef.current)
                    : undefined;
                  currentTaskIdRef.current = null;
                  setActiveTasks((prev) => prev.filter((t) => t.status !== "completed"));
                  if (done?.status === "completed") {
                    append({
                      kind: "system",
                      text: `✓ task #${shortTaskId(done.taskId)} returned by ${done.assignee ?? "someone"} (escalation ${done.escalation_level})`,
                    });
                  }
                }
                setPhase("thinking");
                break;
              case "task_update":
                currentTaskIdRef.current = e.task.taskId;
                taskLogRef.current.set(e.task.taskId, e.task);
                setActiveTasks((prev) => {
                  const rest = prev.filter((t) => t.taskId !== e.task.taskId);
                  return [...rest, e.task];
                });
                break;
              case "error":
                append({ kind: "system", text: `⨯ ${e.message}` });
                break;
            }
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          messagesRef.current.length = snapshotLength;
          append({ kind: "system", text: "⨯ Interrupted" });
        } else {
          messagesRef.current.length = snapshotLength;
          append({ kind: "system", text: `⨯ ${(err as Error).message}` });
        }
      } finally {
        if (streamed) append({ kind: "assistant", text: streamed });
        setStreamingText("");
        setActiveTasks((prev) => prev.filter((t) => t.status !== "completed"));
        abortRef.current = null;
        setTurnRunning(false);
      }
    },
    [append],
  );

  const handleSubmit = useCallback(
    (value: string) => {
      if (value.startsWith("/")) {
        const cmd = value.split(/\s+/)[0];
        if (cmd === "/help") {
          append({ kind: "system", text: HELP });
        } else if (cmd === "/clear") {
          messagesRef.current = [{ role: "system", content: SYSTEM_PROMPT }];
          setEntries([]);
          append({ kind: "system", text: "Conversation cleared. The cover sheets remain." });
        } else if (cmd === "/quit") {
          exit();
        } else if (cmd === "/tasks") {
          const tasks = [...taskLogRef.current.values()];
          if (!tasks.length) {
            append({ kind: "system", text: "No tasks provisioned yet. The team is... idle." });
          } else {
            const lines = tasks.map(
              (t) =>
                `#${shortTaskId(t.taskId)} ${t.file} — ${t.status} — ${t.assignee ?? "unassigned"} — escalation ${t.escalation_level}`,
            );
            append({ kind: "system", text: `Provisioned tasks:\n${lines.join("\n")}` });
          }
        } else {
          append({ kind: "system", text: `Unknown command ${cmd}. Try /help.` });
        }
        return;
      }
      void startTurn(value);
    },
    [append, exit, startTurn],
  );

  return (
    <Box flexDirection="column">
      <Transcript entries={entries} />
      {streamingText !== "" && (
        <Box marginBottom={1}>
          <Text>{streamingText}</Text>
        </Box>
      )}
      <Box flexDirection="row" gap={1} alignItems="flex-end">
        <Box flexDirection="column" flexGrow={1}>
          {turnRunning && <StatusLine phase={phase} />}
          <InputBar onSubmit={handleSubmit} disabled={turnRunning} />
          <Text dimColor>
            TPS · {MODEL} · {AGENT_CWD}
          </Text>
        </Box>
        {activeTasks.length > 0 && <TpsPanel tasks={activeTasks} />}
      </Box>
    </Box>
  );
}
