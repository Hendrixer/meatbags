import { Text } from "ink";
import Spinner from "ink-spinner";
import { useEffect, useState } from "react";
import { MEATBAG_WAIT_VERBS, THINKING_VERBS } from "../foundry.js";

export type Phase = "thinking" | "meatbag-wait" | { tool: string };

export function StatusLine({ phase }: { phase: Phase }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2500);
    return () => clearInterval(t);
  }, []);

  const pool = phase === "meatbag-wait" ? MEATBAG_WAIT_VERBS : THINKING_VERBS;
  const verb = pool[tick % pool.length];
  const suffix =
    typeof phase === "object" ? ` (${phase.tool})` : phase === "meatbag-wait" ? "" : "";

  return (
    <Text color="magenta">
      <Spinner type="dots" /> {verb}
      <Text dimColor>{suffix}  (esc to interrupt)</Text>
    </Text>
  );
}
