import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { config } from "../config.js";

let client: ElevenLabsClient | undefined;

async function collect(audio: unknown): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  // The SDK returns a web ReadableStream<Uint8Array>; support async-iterable too.
  const stream = audio as ReadableStream<Uint8Array> & AsyncIterable<Uint8Array>;
  if (typeof (stream as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
    for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
  } else {
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
}

/**
 * Render a nag to an mp3 with the designed voice. The model writes for the ear
 * (`<break time="1.5s" />`, under 12s). Returns undefined when ElevenLabs isn't
 * configured so callers can still post the text nag without audio.
 * Call inside `step.run("render-audio")` so a flaky render retries in isolation.
 */
export async function renderVoicemail(text: string): Promise<Buffer | undefined> {
  const { apiKey, voiceId } = config.elevenlabs;
  if (!apiKey || !voiceId) {
    console.log("[voicemail stub] ElevenLabs not configured; skipping audio");
    return undefined;
  }
  client ??= new ElevenLabsClient({ apiKey });
  const audio = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  });
  return collect(audio);
}
