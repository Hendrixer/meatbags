/**
 * Optional Busy Bar integration — a physical LED status bar served at
 * localhost:8787. Probed once at startup; when it isn't plugged in (or the
 * server isn't running), every call here is a silent no-op, so the TUI works
 * identically on machines without one.
 */
const BAR = process.env.BUSY_BAR_URL ?? "http://localhost:8787";

let available = false;
let lastText = "";

/** Probe the bar. Call once at startup; safe to skip. */
export async function detectBar(): Promise<boolean> {
  try {
    const res = await fetch(`${BAR}/status`, { signal: AbortSignal.timeout(1500) });
    const body = (await res.json()) as { ok?: boolean; connected?: boolean };
    available = res.ok && body.connected === true;
  } catch {
    available = false;
  }
  return available;
}

/** Show text on the bar (fire-and-forget, deduped so 2s polls don't spam). */
export function barSay(text: string, color = "cyan"): void {
  if (!available || text === lastText) return;
  lastText = text;
  const params = new URLSearchParams({ text, color, font: "bold" });
  void fetch(`${BAR}/say?${params}`, { signal: AbortSignal.timeout(2000) }).catch(() => {});
}

/** Clear the bar back to its own clock screen. */
export function barClear(): void {
  if (!available) return;
  lastText = "";
  void fetch(`${BAR}/clear`, { signal: AbortSignal.timeout(2000) }).catch(() => {});
}
