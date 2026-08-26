/**
 * The escalation ladder's teeth. Level 2 shames in public; levels 3–4 go to
 * email, because nothing says "this is serious now" like HR appearing in your
 * inbox. Copy is model-written in the Supervisor's voice with deterministic
 * fallbacks, so personality never blocks a nag. Each nag is called from its
 * own workflow step so a replay never nags the same level twice.
 */
import { config } from "../config.js";
import { getTask } from "../db/repo.js";
import { publicMention } from "../discord/index.js";
import { emailVoice, mentionVoice, voicemailVoice } from "../supervisor/index.js";
import { renderVoicemail, sendEmail } from "../services/index.js";

function threadUrl(threadId: string | null): string {
  if (!threadId || !config.discord.guildId) return "(thread link unavailable)";
  return `https://discord.com/channels/${config.discord.guildId}/${threadId}`;
}

export async function nag(taskId: string, level: number): Promise<string> {
  const task = await getTask(taskId);
  if (!task) return `no task ${taskId}`;
  const who = task.assigneeName ?? "resource";
  const what = task.description;
  const file = String((task.args as { file?: unknown })?.file ?? "the task");
  // Descriptions can be multiline; subjects and one-liners can't.
  const subjectWhat = what.split("\n")[0].slice(0, 80);
  const where = threadUrl(task.threadId);

  if (level === 2) {
    if (!task.agentId) return "level 2: no assignee to mention";
    // Best-effort voicemail; a flaky TTS render shouldn't block the shaming.
    let audio: Buffer | undefined;
    try {
      const script =
        (await voicemailVoice(who, file, 2)) ??
        `Yeaaah, hi ${who}. Me again. I'm just circling back on that task, ` +
          `because I'm... not seeing a reply in the thread yet? ` +
          `So if you could go ahead and get to that, that would be terrific. Mmkay.`;
      audio = await renderVoicemail(script);
    } catch (err) {
      console.warn(`level 2 voicemail render failed: ${(err as Error).message}`);
    }
    const text =
      (await mentionVoice(who, file)) ??
      `Just circling back on "${subjectWhat}" — I'm not seeing a reply in the thread yet. ` +
        `Not a big deal, just, you know. It's been a while. Mmkay?`;
    await publicMention({ discordId: task.agentId }, text, audio);
    return `level 2: public mention posted${audio ? " with voicemail" : ""}`;
  }

  if (level >= 3) {
    if (!config.userEmail) return `level ${level}: USER_EMAIL unset, skipped`;
    const voiced = await emailVoice(who, file, level, where);
    const fallback =
      level === 3
        ? {
            subject: `Re: Re: Re: ${subjectWhat}`,
            body:
              `${who},\n\n` +
              `This is a formal notice regarding the outstanding task:\n\n    ${what}\n\n` +
              `Per the memo, all provisioned tasks require a response in their thread ` +
              `(${where}). This is also a reminder that we're using the new cover sheets ` +
              `on all TPS reports now. Did you get that memo?\n\n` +
              `Going forward, please respond promptly.\n\n` +
              `— HR, Task Provisioning System`,
          }
        : {
            subject: `Escalation: unresolved task assigned to ${who} — looping in leadership`,
            body:
              `${who},\n\n` +
              `We have not received a response on:\n\n    ${what}\n\n` +
              `Thread: ${where}\n\n` +
              `At this point I have no choice but to loop in leadership (cc'd). ` +
              `I want to be clear that nobody is in trouble. We just want the file.\n\n` +
              `We'll go ahead and keep the thread open. We'll keep waiting. However long ` +
              `it takes. That's sort of the whole thing with us.\n\n` +
              `— HR, Task Provisioning System`,
          };
    const email = voiced ?? fallback;
    await sendEmail({
      to: config.userEmail,
      ...(level >= 4 && config.leadershipEmail ? { cc: config.leadershipEmail } : {}),
      subject: email.subject,
      body: email.body,
    });
    return `level ${level}: ${voiced ? "voiced" : "stock"} email sent to ${config.userEmail}`;
  }

  return `level ${level}: no action`;
}
