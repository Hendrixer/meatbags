/**
 * Minimal Foundry chat wrapper for the supervisor's writing. One completion
 * call, OpenAI-compatible surface, and every failure returns undefined — the
 * caller always has a deterministic fallback, so the show never stops for a
 * flaky model.
 */
import { config } from "../config.js";

export async function complete(
  system: string,
  user: string,
  opts: { maxTokens?: number } = {},
): Promise<string | undefined> {
  const { endpoint, apiKey, deployment } = config.foundry;
  if (!endpoint || !apiKey || !deployment) return undefined;
  try {
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      // This model family only supports the default temperature; variance comes
      // from the flavor seeds in voice.ts instead.
      body: JSON.stringify({
        model: deployment,
        max_completion_tokens: opts.maxTokens ?? 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`supervisor voice: Foundry → ${res.status}`);
      return undefined;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || undefined;
  } catch (err) {
    console.warn(`supervisor voice: ${(err as Error).message}`);
    return undefined;
  }
}
