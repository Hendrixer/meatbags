import { Client, GatewayIntentBits, Events, type Message } from "discord.js";
import { config, require_ } from "../config.js";
import { classifyMessage, type IncomingMessage } from "./routing.js";

let client: Client | undefined;

/** The gateway client. Constructed with the privileged intents the bot needs. */
export function getClient(): Client {
  if (!client) {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // privileged
        GatewayIntentBits.GuildMembers, // privileged (Server Members)
      ],
    });
  }
  return client;
}

function toIncoming(msg: Message): IncomingMessage {
  const inThread = msg.channel.isThread();
  return {
    authorIsBot: msg.author.bot,
    authorId: msg.author.id,
    authorName: msg.author.username,
    content: msg.content,
    channelId: msg.channelId,
    isThread: inThread,
    parentId: inThread ? (msg.channel.parentId ?? undefined) : undefined,
  };
}

/** Wire the handlers and log in. Resolves once the gateway is ready. */
export async function startBot(): Promise<void> {
  const token = require_(config.discord.botToken, "DISCORD_BOT_TOKEN");
  const c = getClient();

  c.on(Events.MessageCreate, async (msg) => {
    const routed = classifyMessage(toIncoming(msg), {
      tasksChannelId: config.discord.tasksChannelId,
      generalChannelId: config.discord.generalChannelId,
    });
    try {
      if (routed.kind === "thread-reply") {
        // TODO(tui-tool-handoff 4.2): resolve routed.threadId to its task, then
        // send human/task.completed with that task's id. Needs the persistence
        // layer — a thread id is no longer a task id.
        void routed;
      } else if (routed.kind === "general-speak") {
        // TODO(tui-tool-handoff 4.4): upsert the speaker into `agents`.
        void routed;
      }
    } catch (err) {
      console.error("discord message handler error:", (err as Error).message);
    }
  });

  await new Promise<void>((resolve) => {
    c.once(Events.ClientReady, (ready) => {
      const guild = ready.guilds.cache.get(config.discord.guildId ?? "");
      console.log(`🤖 bot ready as ${ready.user.tag} · guild: ${guild?.name ?? "(unknown)"}`);
      resolve();
    });
    void c.login(token);
  });
}
