import { config } from "../config.js";

/** How the supervisor sounds. gpt-4o-mini-tts takes free-text voice direction. */
const VOICE = "ash";
const DELIVERY =
  "Speak like a passive-aggressive middle manager leaving a voicemail: slow, " +
  "unhurried, faux-friendly, slightly condescending, with drawn-out 'yeaaah's " +
  "and thoughtful pauses. Office Space energy.";

/** Level 3+: the mask slips. */
export const ANGRY_DELIVERY =
  "Speak like a middle manager who has finally lost patience: tense, clipped, " +
  "faster than is comfortable, jaw tight, voice rising before being forcibly " +
  "brought back down to a strained calm. Audibly upset while pretending not " +
  "to be. One sharp exhale is welcome.";

/**
 * Render a nag to an mp3 via Azure AI Foundry's OpenAI-compatible speech
 * endpoint. Returns undefined when TTS isn't configured so callers can still
 * post the text nag without audio.
 * Call inside `step.run("render-audio")` so a flaky render retries in isolation.
 */
export async function renderVoicemail(
  text: string,
  delivery: string = DELIVERY,
): Promise<Buffer | undefined> {
  const { endpoint, apiKey, ttsDeployment } = config.foundry;
  if (!endpoint || !apiKey || !ttsDeployment) {
    console.log("[voicemail stub] Foundry TTS not configured; skipping audio");
    return undefined;
  }
  const res = await fetch(`${endpoint}/audio/speech`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: ttsDeployment,
      input: text,
      voice: VOICE,
      instructions: delivery,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    throw new Error(`Foundry TTS → ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
