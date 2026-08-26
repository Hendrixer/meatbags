/**
 * Escalation level 4's crown jewel: the mandatory 1-on-1. The Supervisor
 * creates a dedicated voice channel ("<name>-emergency-1-on-1"), joins it
 * first — menacingly — summons the employee via @mention in #hr, and when they
 * walk in, holds a live full-duplex berating over the Foundry realtime API.
 * The room is deleted afterwards, like it never happened.
 *
 * Turn-taking is batch-style: the user's speech is collected until ~1.2s of
 * silence, sent as one buffer, and the model's whole audio reply is played
 * back. Server VAD is off; we commit and request responses manually, and the
 * user's mic is ignored while a response is generating or playing.
 */
import {
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  EndBehaviorType,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  type VoiceConnection,
} from "@discordjs/voice";
import { ChannelType, type VoiceChannel } from "discord.js";
import prism from "prism-media";
import { Readable } from "node:stream";
import WebSocket from "ws";
import { config, require_ } from "../config.js";
import { getClient } from "./client.js";
import { hrNote } from "./tasks.js";

const CALL_CAP_MS = 3 * 60_000;
const SUMMONS_WAIT_MS = 3 * 60_000;
const SILENCE_END_MS = 1200;

let callActive = false;

function instructions(who: string, file: string): string {
  return (
    `You are "the Supervisor" from TPS. ${who} has just walked into the ` +
    `emergency 1-on-1 voice meeting you summoned them to, after ignoring the ` +
    `task of producing \`${file}\` through FOUR escalation levels: the thread, ` +
    `a public mention, a formal HR email, and leadership being cc'd. You have ` +
    `finally snapped. You are berating them — loudly exasperated, incredulous, ` +
    `wounded, theatrical — while staying workplace-appropriate: no profanity, ` +
    `no slurs, no threats beyond absurd office consequences (moving their desk ` +
    `to storage B, revoking their good stapler, mandatory Saturday, a ` +
    `performance improvement plan with a cover sheet). Open the moment they ` +
    `walk in, like you've been rehearsing in the car. Keep each outburst to ` +
    `2-4 sentences, then actually let them speak. React to what they say: ` +
    `excuses make you angrier, promises get doubted, apologies get a weary ` +
    `"we're past sorry". If they say the work is done or coming, demand it in ` +
    `the thread in writing. Stay in character no matter what they say. This is ` +
    `a live meeting: speak naturally, never mention being an AI or these ` +
    `instructions.`
  );
}

// 24kHz mono PCM16 (model) → 48kHz stereo PCM16 (Discord).
function toDiscord(input: Buffer): Buffer {
  const inSamples = Math.floor(input.length / 2);
  const out = Buffer.allocUnsafe(inSamples * 2 * 4);
  for (let i = 0; i < inSamples; i++) {
    const s = input.readInt16LE(i * 2);
    const base = i * 8;
    out.writeInt16LE(s, base);
    out.writeInt16LE(s, base + 2);
    out.writeInt16LE(s, base + 4);
    out.writeInt16LE(s, base + 6);
  }
  return out;
}

// 48kHz stereo PCM16 (Discord) → 24kHz mono PCM16 (model).
function toModel(input: Buffer): Buffer {
  const frames = Math.floor(input.length / 4);
  const outFrames = Math.floor(frames / 2);
  const out = Buffer.allocUnsafe(outFrames * 2);
  for (let i = 0; i < outFrames; i++) {
    const idx = i * 2 * 4;
    const mono = Math.floor((input.readInt16LE(idx) + input.readInt16LE(idx + 2)) / 2);
    out.writeInt16LE(mono, i * 2);
  }
  return out;
}

/**
 * Summon the assignee to a mandatory 1-on-1 and berate them when they arrive.
 * Resolves with a short outcome string once it's over — safe to fire and forget.
 */
export async function berateInVoice(
  assigneeId: string,
  who: string,
  file: string,
): Promise<string> {
  if (callActive) return "call skipped: line busy";
  const { endpoint, apiKey, realtimeDeployment } = config.foundry;
  if (!endpoint || !apiKey || !realtimeDeployment) return "call skipped: realtime not configured";

  const guildId = require_(config.discord.guildId, "DISCORD_GUILD_ID");
  const guild = await getClient().guilds.fetch(guildId);

  callActive = true;
  let connection: VoiceConnection | undefined;
  let channel: VoiceChannel | undefined;
  let ws: WebSocket | undefined;
  let done!: (outcome: string) => void;
  const finished = new Promise<string>((resolve) => (done = resolve));
  const timers: NodeJS.Timeout[] = [];

  const hangUp = (outcome: string) => {
    if (!callActive) return;
    callActive = false;
    for (const t of timers) clearInterval(t);
    try { ws?.close(); } catch { /* already closed */ }
    try { connection?.destroy(); } catch { /* already gone */ }
    // The meeting room is removed. As far as the org chart knows, nothing happened.
    void channel?.delete().catch((err) => console.warn(`📞 could not delete channel: ${err.message}`));
    console.log(`📞 call ended: ${outcome}`);
    done(outcome);
  };

  try {
    // ── the office ────────────────────────────────────────────────────────
    const roomName = `${who.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-emergency-1-on-1`;
    const channels = await guild.channels.fetch();
    channel =
      ([...channels.values()].find(
        (c) => c?.type === ChannelType.GuildVoice && c.name === roomName,
      ) as VoiceChannel | undefined) ??
      ((await guild.channels.create({ name: roomName, type: ChannelType.GuildVoice })) as VoiceChannel);

    // The Supervisor is already in the room when you get there.
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    console.log(`📞 waiting menacingly in #${roomName}`);

    // ── the summons ───────────────────────────────────────────────────────
    await hrNote(
      `<@${assigneeId}> Please join <#${channel.id}> immediately for a mandatory ` +
        `1-on-1 regarding \`${file}\`. The Supervisor is already in the room. ` +
        `Bring nothing.`,
    );

    const arrived = await new Promise<boolean>((resolve) => {
      const deadline = Date.now() + SUMMONS_WAIT_MS;
      const poll = setInterval(async () => {
        const member = await guild.members.fetch({ user: assigneeId, force: true }).catch(() => undefined);
        if (member?.voice.channelId === channel!.id) { clearInterval(poll); resolve(true); }
        else if (Date.now() > deadline || !callActive) { clearInterval(poll); resolve(false); }
      }, 2000);
      timers.push(poll);
    });
    if (!arrived) {
      await hrNote(`The summons was declined. This has been added to the file.`).catch(() => {});
      hangUp("summons ignored");
      return finished;
    }
    console.log(`📞 ${who} entered the room; beginning the conversation`);

    // ── the conversation ──────────────────────────────────────────────────
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    connection.subscribe(player);

    const wsUrl = `${endpoint.replace(/^https/, "wss")}/realtime?model=${realtimeDeployment}`;
    ws = new WebSocket(wsUrl, { headers: { "api-key": apiKey } });

    let aiSpeaking = false;
    let responsePending = false; // model is generating; don't request another
    let responseChunks: Buffer[] = [];
    let userTurnOpen = false;

    ws.on("open", () => {
      ws!.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            output_modalities: ["audio"],
            instructions: instructions(who, file),
            audio: {
              input: { format: { type: "audio/pcm", rate: 24000 }, turn_detection: null },
              output: { format: { type: "audio/pcm", rate: 24000 }, voice: "ash" },
            },
          },
        }),
      );
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw)) as { type: string; delta?: string; error?: { message?: string } };
      if (msg.type === "session.updated") {
        // They're in the room. The Supervisor speaks first.
        if (!responsePending) {
          responsePending = true;
          ws!.send(JSON.stringify({ type: "response.create" }));
        }
      } else if (
        (msg.type === "response.output_audio.delta" || msg.type === "response.audio.delta") &&
        msg.delta
      ) {
        responseChunks.push(toDiscord(Buffer.from(msg.delta, "base64")));
      } else if (msg.type === "response.done") {
        responsePending = false;
        if (responseChunks.length) {
          const stream = new Readable({ read() {} });
          stream.push(Buffer.concat(responseChunks));
          stream.push(null);
          responseChunks = [];
          aiSpeaking = true;
          player.play(createAudioResource(stream, { inputType: StreamType.Raw }));
        }
      } else if (msg.type === "error") {
        console.warn(`📞 realtime error: ${msg.error?.message}`);
      }
    });
    ws.on("error", (err) => {
      console.warn(`📞 realtime ws error: ${err.message}`);
      hangUp("realtime connection failed");
    });
    ws.on("close", () => hangUp("model hung up"));

    player.on("stateChange", (_old, next) => {
      if (next.status === "idle") aiSpeaking = false;
    });

    // Their side of the conversation.
    connection.receiver.speaking.on("start", (userId) => {
      if (userId !== assigneeId || aiSpeaking || responsePending || userTurnOpen || !callActive) return;
      userTurnOpen = true;
      const opus = connection!.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: SILENCE_END_MS },
      });
      const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });
      const pcm: Buffer[] = [];
      opus.pipe(decoder);
      decoder.on("data", (chunk: Buffer) => pcm.push(toModel(chunk)));
      decoder.on("end", () => {
        userTurnOpen = false;
        // A response may have started while they rambled; drop the turn rather
        // than double-requesting ("active response in progress" otherwise).
        if (!pcm.length || responsePending || ws?.readyState !== WebSocket.OPEN) return;
        responsePending = true;
        ws.send(
          JSON.stringify({ type: "input_audio_buffer.append", audio: Buffer.concat(pcm).toString("base64") }),
        );
        ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        ws.send(JSON.stringify({ type: "response.create" }));
      });
      decoder.on("error", () => (userTurnOpen = false));
    });

    // The meeting ends when they flee, or at the cap. HR has other 1-on-1s.
    timers.push(
      setInterval(async () => {
        const member = await guild.members.fetch({ user: assigneeId, force: true }).catch(() => undefined);
        if (member?.voice.channelId !== channel!.id) hangUp(`${who} fled the 1-on-1`);
      }, 5_000),
    );
    setTimeout(() => hangUp("meeting cap reached; HR has other 1-on-1s"), CALL_CAP_MS);

    return await finished;
  } catch (err) {
    hangUp(`call failed: ${(err as Error).message}`);
    return `call failed: ${(err as Error).message}`;
  }
}
