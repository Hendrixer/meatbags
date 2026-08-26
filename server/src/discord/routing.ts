/**
 * Pure message classification — no discord.js, no side effects — so the routing
 * rules can be tested without a live gateway connection.
 */

export interface Channels {
  tasksChannelId?: string;
  generalChannelId?: string;
}

export interface IncomingMessage {
  authorIsBot: boolean;
  authorId: string;
  authorName: string;
  content: string;
  channelId: string;
  /** True if the message was posted inside a thread. */
  isThread: boolean;
  /** For a thread message, the id of the channel the thread hangs off. */
  parentId?: string;
}

export type Routed =
  | { kind: "thread-reply"; threadId: string; reply: string }
  | { kind: "general-speak"; discordId: string; name: string }
  | { kind: "ignore" };

/**
 * A reply inside a thread under #tasks answers whichever task owns that thread.
 * Classification only knows the thread id — the caller resolves it to a task,
 * since a task's id is the tool call id supplied by the TUI, not the thread id.
 * A human speaking in #general gets upserted into the roster. Everything else,
 * and anything the bot itself said, is ignored.
 */
export function classifyMessage(msg: IncomingMessage, channels: Channels): Routed {
  if (msg.authorIsBot) return { kind: "ignore" };

  if (
    msg.isThread &&
    channels.tasksChannelId !== undefined &&
    msg.parentId === channels.tasksChannelId
  ) {
    return { kind: "thread-reply", threadId: msg.channelId, reply: msg.content };
  }

  if (
    !msg.isThread &&
    channels.generalChannelId !== undefined &&
    msg.channelId === channels.generalChannelId
  ) {
    return { kind: "general-speak", discordId: msg.authorId, name: msg.authorName };
  }

  return { kind: "ignore" };
}
