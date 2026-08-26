/**
 * The escalation ladder's teeth. Level 2 shames in public; levels 3–4 go to
 * email, because nothing says "this is serious now" like HR appearing in your
 * inbox. Copy is model-written in the Supervisor's voice with deterministic
 * fallbacks, so personality never blocks a nag. Each nag is called from its
 * own workflow step so a replay never nags the same level twice.
 */
import { config } from "../config.js";
import { getTask } from "../db/repo.js";
import { hrNote, nagInThread, publicMention } from "../discord/index.js";
import { emailVoice, hrNoteVoice, mentionVoice, voicemailVoice } from "../supervisor/index.js";
import { ANGRY_DELIVERY, renderVoicemail, sendEmail } from "../services/index.js";

function threadUrl(threadId: string | null): string {
  if (!threadId || !config.discord.guildId) return "(thread link unavailable)";
  return `https://discord.com/channels/${config.discord.guildId}/${threadId}`;
}

export async function nag(taskId: string, level: number): Promise<string> {
  const task = await getTask(taskId);
  if (!task) return `no task ${taskId}`;
  // A rung whose channel isn't wired is a no-op that still lets the ladder
  // climb — never an error that stalls the run.
  if (level === 2 && !config.discord.botToken) return "level 2: no Discord bot, skipped";
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
    // Voicemail lands with no transcript — they have to listen. Prose is the
    // fallback for when the render fails.
    const text = audio
      ? ""
      : (await mentionVoice(who, file)) ??
        `Just circling back on "${subjectWhat}" — I'm not seeing a reply in the thread yet. ` +
          `Not a big deal, just, you know. It's been a while. Mmkay?`;
    try {
      await publicMention({ discordId: task.agentId }, text, audio);
    } catch (err) {
      // Same reasoning as the best-effort renders above: the shaming failing
      // must not stall the ladder, or the caller waits forever.
      console.warn(`level 2 public mention failed: ${(err as Error).message}`);
      return `level 2: mention failed (${(err as Error).message})`;
    }
    return `level 2: ${audio ? "voicemail-only mention" : "text mention"} posted`;
  }

  if (level >= 3) {
    // Level 3 also leaves the angry voicemail in the thread — the moment the
    // supervisor's patience audibly runs out. Best effort, like the HR note.
    if (level === 3 && task.threadId) {
      try {
        const script =
          (await voicemailVoice(who, file, 3)) ??
          `${who}. It's me. Again. I have asked, several times now, about ${file}. ` +
            `Several. Times. So we're going to need that today. ...Thanks so much.`;
        const audio = await renderVoicemail(script, ANGRY_DELIVERY);
        if (audio) {
          await nagInThread(task.threadId, "", audio);
        }
      } catch (err) {
        console.warn(`level 3 voicemail skipped: ${(err as Error).message}`);
      }
    }
    // Level 3 also opens a file on them in #hr. Best effort — the email is the
    // nag of record; the note is for the record.
    if (level === 3) {
      try {
        const note =
          (await hrNoteVoice(who, file)) ??
          `Note for the file: ${who} has been unresponsive regarding \`${file}\` despite ` +
            `multiple supportive check-ins. No concerns at this time. We are simply noting it.`;
        await hrNote(note);
      } catch (err) {
        console.warn(`level 3 HR note skipped: ${(err as Error).message}`);
      }
    }
    if (!config.userEmail) return `level ${level}: USER_EMAIL unset, skipped`;
    const voiced = await emailVoice(who, file, level, where);
    const fallback =
      level === 3
        ? {
            subject: `Re: Re: Re: ${subjectWhat}`,
            body:
              `${who},\n\n` +
              `This is a formal notice regarding the outstanding task:\n\n    ${what}\n\n` +
              `Per the process doc, all provisioned tasks require a response in their ` +
              `thread (${where}). Separately, your compliance training module shows ` +
              `as overdue; unrelated, but it paints a picture.\n\n` +
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

    // Level 4: the Supervisor calls them. Live. Fire-and-forget — the call can
    // run minutes and the workflow shouldn't hold a step open for it.
    if (level >= 4 && task.agentId) {
      const agentId = task.agentId;
      void import("../discord/voice-call.js")
        .then(({ berateInVoice }) => berateInVoice(agentId, who, file))
        .then((outcome) => console.log(`📞 L4 ${outcome}`))
        .catch((err) => console.warn(`L4 call failed: ${(err as Error).message}`));
    }
    return `level ${level}: ${voiced ? "voiced" : "stock"} email sent to ${config.userEmail}`;
  }

  return `level ${level}: no action`;
}
