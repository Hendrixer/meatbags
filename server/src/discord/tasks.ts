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

/**
 * Open a thread per task in #tasks and post the ask (with an optional voicemail
 * mp3). The caller records the returned thread id against the task; the task's
 * own id comes from the TUI's tool call.
 */
export async function createTaskThread(
  assignee: Assignee,
  ask: string,
  audio?: Buffer | string,
): Promise<{ threadId: string }> {
  const channel = await tasksChannel();
  const thread = await channel.threads.create({
    name: `task: ${ask.slice(0, 80)}`,
    autoArchiveDuration: 60,
  });
  await thread.send({
    content: `<@${assignee.discordId}> ${ask}`,
    files: attachment(audio),
  });
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
