import { Client, GatewayIntentBits, Events, type Message } from "discord.js";
import { config, require_ } from "../config.js";
import { findTaskByThread, upsertAgent } from "../db/index.js";
import { inngest } from "../inngest/client.js";
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
        const task = await findTaskByThread(routed.threadId);
        if (!task) return; // a thread we didn't open, or one with no task yet
        if (task.status === "completed") return; // late chatter; the reply already landed
        await inngest.send({
          name: "human/task.completed",
          data: { taskId: task.id, reply: routed.reply },
        });
        console.log(`↩ reply in thread ${routed.threadId} → human/task.completed for ${task.id}`);
        // The reply is the completion — sign off and fold the thread. (A later
        // human message would auto-unarchive, but lands in the completed-task
        // guard above and goes nowhere.)
        if (msg.channel.isThread()) {
          await msg.channel.send("Terrific. Closing this one out. Mmkay.");
          await msg.channel.setArchived(true);
        }
      } else if (routed.kind === "general-speak") {
        await upsertAgent({ discordId: routed.discordId, name: routed.name });
        console.log(`👋 roster upsert: ${routed.name} (${routed.discordId})`);
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
