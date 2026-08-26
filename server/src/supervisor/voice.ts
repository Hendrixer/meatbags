/**
 * The Supervisor's voice — model-written copy for every surface a meatbag
 * hears from us on: the task-thread ask, voicemails, the public mention, and
 * the HR emails. Every writer degrades to undefined so callers keep their
 * deterministic fallbacks; personality is a feature, not a dependency.
 */
import { complete } from "./foundry.js";

const PERSONA = `You are "the Supervisor" at TPS (Task Provisioning System), an
overbearing, faux-friendly middle manager in the style of Office Space. You are
never angry — you are disappointed, unhurried, and relentlessly polite in a way
that is worse. You assign engineering tasks to humans and follow up when they
ignore you.

Escalation level sets your register:
- Level 1: breezy, almost apologetic. It's no big deal. (It is.)
- Level 2: still friendly, but you've noticed. Public, mild, needling.
- Level 3: formal HR memo energy. Process words. Cover sheets. "Per my last."
- Level 4: grave but serene. Leadership is cc'd. Nobody is in trouble. (They are.)

Rules: never use emoji. Never use the words "AI", "model", or "bot". Vary your
openings — do not begin with "Yeaaah" more than occasionally. Work in at most
one office flourish per message (the cover sheets, flair, the printer, moving
someone's desk, Saturday, a meeting that could have been an email) — pick a
different one each time. Keep it tight; you are busy, or at least you say so.`;

/** A little grit so consecutive calls don't converge on one riff. */
function flavor(): string {
  const seeds = [
    "reference the cover sheets",
    "reference somebody's flair",
    "reference the printer situation",
    "gently mention Saturday",
    "reference a meeting that could have been an email",
    "mention the break-room birthday cake",
    "reference moving desks to storage B",
    "mention you'll circle back regardless",
  ];
  return seeds[Math.floor(Math.random() * seeds.length)];
}

/** Openings converge fast at fixed temperature; force a different door each time. */
function opening(): string {
  const styles = [
    "skip any greeting and start mid-thought",
    "open with a drawn-out 'Yeaaah'",
    "open by wondering aloud whether this thing is recording",
    "open by noting which follow-up number this is",
    "open with their name said twice, thoughtfully",
    "open as if resuming a conversation that never happened",
    "open with a small sigh in words",
  ];
  return styles[Math.floor(Math.random() * styles.length)];
}

function parseJson<T>(text: string | undefined): T | undefined {
  if (!text) return undefined;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return undefined;
  }
}

export interface AskVoice {
  intro: string;
  outro: string;
}

/** Personality bookends for the task-thread ask; the technical middle stays deterministic. */
export async function askVoice(who: string, file: string): Promise<AskVoice | undefined> {
  const text = await complete(
    PERSONA,
    `Write the opening and closing for a task assignment to ${who}: they must ` +
      `produce the file \`${file}\`. Level 1. Optionally ${flavor()}. ` +
      `The middle of the message (specs, code) is written by someone else — your ` +
      `intro is 1–2 sentences telling them this landed on their desk, your outro ` +
      `is one sentence of encouragement that somehow isn't. ` +
      `Return ONLY JSON: {"intro": "...", "outro": "..."}`,
    { maxTokens: 250 },
  );
  const parsed = parseJson<AskVoice>(text);
  return parsed?.intro && parsed?.outro ? parsed : undefined;
}

/** A spoken voicemail script, written for the ear. */
export async function voicemailVoice(
  who: string,
  file: string,
  level: number,
): Promise<string | undefined> {
  return complete(
    PERSONA,
    `Write a voicemail you are leaving for ${who} about the file \`${file}\`. ` +
      `Escalation level ${level}. Spoken language, written for the ear — short ` +
      `sentences, natural pauses with commas and ellipses, under 10 seconds ` +
      `read aloud (about 30 words). ${opening()}. Optionally ${flavor()}. ` +
      `Return only the spoken words, no quotes, no stage directions.`,
    { maxTokens: 120 },
  );
}

/** The level-2 public callout, posted in the channel for everyone to see. */
export async function mentionVoice(who: string, file: string): Promise<string | undefined> {
  return complete(
    PERSONA,
    `Write a public follow-up (level 2) posted in the team channel about ${who} ` +
      `not having replied about \`${file}\` yet. 1–2 sentences, needling but ` +
      `friendly, safe to say in front of the whole team. ${opening()}. ` +
      `Optionally ${flavor()}. Return only the message text.`,
    { maxTokens: 120 },
  );
}

/** Level 3: the note that goes in their file. Third person; they may read it later. */
export async function hrNoteVoice(who: string, file: string): Promise<string | undefined> {
  return complete(
    PERSONA,
    `Write a short note for the record, posted in the private HR channel, about ` +
      `${who} not responding regarding \`${file}\` (escalation level 3). Third ` +
      `person, 1–3 sentences, devastatingly passive-aggressive while remaining ` +
      `procedurally correct — the kind of note that sounds supportive and reads ` +
      `like a warning. Optionally ${flavor()}. Start with "Note for the file:" ` +
      `and return only the note text.`,
    { maxTokens: 140 },
  );
}

export interface EmailVoice {
  subject: string;
  body: string;
}

/** Levels 3–4: the HR email. */
export async function emailVoice(
  who: string,
  file: string,
  level: number,
  threadUrl: string,
): Promise<EmailVoice | undefined> {
  const cc = level >= 4 ? "Leadership is cc'd on this one; acknowledge that serenely." : "";
  const text = await complete(
    PERSONA,
    `Write an email from HR at TPS to ${who} about the still-unanswered task for ` +
      `\`${file}\`. Escalation level ${level}. ${cc} Include this thread link ` +
      `naturally in the body: ${threadUrl} . Optionally ${flavor()}. The subject ` +
      `must be a single line; level 3 subjects start with "Re: Re: Re:". ` +
      `Body under 120 words, sign off as "— HR, Task Provisioning System". ` +
      `Return ONLY JSON: {"subject": "...", "body": "..."}`,
    { maxTokens: 350 },
  );
  const parsed = parseJson<EmailVoice>(text);
  return parsed?.subject && parsed?.body
    ? { subject: parsed.subject.replace(/\s*\n\s*/g, " ").slice(0, 120), body: parsed.body }
    : undefined;
}
