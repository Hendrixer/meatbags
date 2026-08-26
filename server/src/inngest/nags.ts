/**
 * The escalation ladder's teeth. Level 2 shames in public; levels 3–4 go to
 * email, because nothing says "this is serious now" like HR appearing in your
 * inbox. Each nag is called from its own workflow step so a replay never nags
 * the same level twice.
 */
import { config } from "../config.js";
import { getTask } from "../db/repo.js";
import { publicMention } from "../discord/index.js";
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
  // Descriptions can be multiline; subjects can't.
  const subjectWhat = what.split("\n")[0].slice(0, 80);
  const where = threadUrl(task.threadId);

  if (level === 2) {
    if (!task.agentId) return "level 2: no assignee to mention";
    // Best-effort voicemail; a flaky TTS render shouldn't block the shaming.
    let audio: Buffer | undefined;
    try {
      audio = await renderVoicemail(
        `Yeaaah, hi ${who}. Me again. I'm just circling back on that task, ` +
          `because I'm... not seeing a reply in the thread yet? ` +
          `So if you could go ahead and get to that, that would be terrific. Mmkay.`,
      );
    } catch (err) {
      console.warn(`level 2 voicemail render failed: ${(err as Error).message}`);
    }
    await publicMention(
      { discordId: task.agentId },
      `Just circling back on "${subjectWhat}" — I'm not seeing a reply in the thread yet. ` +
        `Not a big deal, just, you know. It's been a while. Mmkay?`,
      audio,
    );
    return `level 2: public mention posted${audio ? " with voicemail" : ""}`;
  }

  if (level === 3) {
    if (!config.userEmail) return "level 3: USER_EMAIL unset, skipped";
    await sendEmail({
      to: config.userEmail,
      subject: `Re: Re: Re: ${subjectWhat}`,
      body:
        `${who},\n\n` +
        `This is a formal notice regarding the outstanding task:\n\n    ${what}\n\n` +
        `Per the memo, all provisioned tasks require a response in their thread ` +
        `(${where}). This is also a reminder that we're using the new cover sheets ` +
        `on all TPS reports now. Did you get that memo?\n\n` +
        `Going forward, please respond promptly.\n\n` +
        `— HR, Task Provisioning System`,
    });
    return `level 3: formal email sent to ${config.userEmail}`;
  }

  if (level >= 4) {
    if (!config.userEmail) return "level 4: USER_EMAIL unset, skipped";
    await sendEmail({
      to: config.userEmail,
      ...(config.leadershipEmail ? { cc: config.leadershipEmail } : {}),
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
    });
    return `level 4: leadership email sent to ${config.userEmail}`;
  }

  return `level ${level}: no action`;
}
