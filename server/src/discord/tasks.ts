import {
  AttachmentBuilder,
  ChannelType,
  type TextChannel,
} from "discord.js";
import { getClient } from "./client.js";
import { config, require_ } from "../config.js";
import type { Agent } from "../db/index.js";

/** The bit of a roster row this module needs to mention them. */
export type Assignee = Pick<Agent, "discordId" | "name">;

async function tasksChannel(): Promise<TextChannel> {
  const id = require_(config.discord.tasksChannelId, "DISCORD_TASKS_CHANNEL_ID");
  const channel = await getClient().channels.fetch(id);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`DISCORD_TASKS_CHANNEL_ID ${id} is not a text channel`);
  }
  return channel;
}

function attachment(audio?: Buffer | string) {
  if (!audio) return [];
  return [new AttachmentBuilder(audio as never, { name: "voicemail.mp3" })];
}

/** Discord rejects message content over 2000 chars; leave headroom for the mention. */
const MAX_CONTENT = 1900;

/**
 * Open a thread per task in #tasks and post the ask (with an optional voicemail
 * mp3). An ask that exceeds Discord's message limit — any edit carrying real
 * code does — leads with its opening lines and ships the full brief as an
 * attachment instead of silently failing. If the post fails anyway, the thread
 * is deleted before rethrowing, so a retried dispatch doesn't litter #tasks
 * with created-but-silent threads.
 */
export async function createTaskThread(
  assignee: Assignee,
  ask: string,
  audio?: Buffer | string,
): Promise<{ threadId: string }> {
  const channel = await tasksChannel();
  const thread = await channel.threads.create({
    name: `task: ${ask.split("\n")[0].slice(0, 80)}`,
    autoArchiveDuration: 60,
  });
  try {
    const mention = `<@${assignee.discordId}> `;
    if (mention.length + ask.length <= MAX_CONTENT) {
      await thread.send({ content: mention + ask, files: attachment(audio) });
    } else {
      const cut = ask.slice(0, 600);
      const intro = cut.slice(0, cut.lastIndexOf("\n") > 200 ? cut.lastIndexOf("\n") : 600);
      await thread.send({
        content:
          `${mention}${intro}\n\n**The full brief is attached** — the complete ` +
          `description, the required interface, and the current code. Everything ` +
          `you need. No excuses about missing context, please.`,
        files: [
          new AttachmentBuilder(Buffer.from(ask, "utf8"), { name: "task-brief.md" }),
          ...attachment(audio),
        ],
      });
    }
  } catch (err) {
    await thread.delete().catch(() => {});
    throw err;
  }
  return { threadId: thread.id };
}

/** Post a nag into an existing task thread. Empty text + audio = just the voicemail. */
export async function nagInThread(
  threadId: string,
  text: string,
  audio?: Buffer | string,
): Promise<void> {
  const thread = await getClient().channels.fetch(threadId);
  if (thread?.isThread()) {
    await thread.send({ ...(text ? { content: text } : {}), files: attachment(audio) });
  }
}

/** Post a note to the HR channel (escalation level 3: the permanent record). */
export async function hrNote(text: string): Promise<void> {
  const id = require_(config.discord.hrChannelId, "DISCORD_HR_CHANNEL_ID");
  const channel = await getClient().channels.fetch(id);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`DISCORD_HR_CHANNEL_ID ${id} is not a text channel`);
  }
  await channel.send(text);
}

/** Escalation level 2: public @mention in #tasks (not the thread), with an optional voicemail. */
export async function publicMention(
  assignee: Pick<Assignee, "discordId">,
  text: string,
  audio?: Buffer | string,
): Promise<void> {
  const channel = await tasksChannel();
  await channel.send({
    content: `<@${assignee.discordId}>${text ? ` ${text}` : ""}`,
    files: attachment(audio),
  });
}
