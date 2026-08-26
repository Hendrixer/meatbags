/**
 * The deterministic ask — the fallback path from the supervisor-voice spec.
 * `add-supervisor-voice` puts a Foundry call in front of this; this text is what
 * we post when the model is unconfigured, slow, or wrong, so it has to stand on
 * its own.
 *
 * The reply is written straight to disk by the TUI, so the ask MUST carry the
 * interface and the current code, and MUST demand the whole file back. An ask
 * that invites "yeah done" produces a file containing "yeah done".
 */

interface WriteCodeArgs {
  file?: string;
  description?: string;
  contract?: string;
  existing_code?: string | null;
}

/** Model-written personality bookends; the technical middle stays deterministic. */
export interface AskBookends {
  intro: string;
  outro: string;
}

function writeCodeAsk(a: WriteCodeArgs, voice?: AskBookends): string {
  const file = a.file ?? "the file";
  const lines: string[] = [
    voice?.intro ?? `Yeaaah, hi. I'm gonna need you to go ahead and take care of \`${file}\`. Mmkay?`,
    "",
    "**What it needs to do**",
    a.description?.trim() || "(no description supplied — use your judgement, I guess)",
  ];
  if (a.contract?.trim()) {
    lines.push("", "**It has to match this interface exactly**", "```ts", a.contract.trim(), "```");
  }
  if (a.existing_code == null) {
    lines.push(
      "",
      `This file doesn't exist yet — you're writing it from scratch.`,
      "",
      "**Reply with the complete contents of the new file.** Just the code. Not a",
      "description of the code, not a summary, not \"done\". The whole file.",
    );
  } else {
    lines.push(
      "",
      "**Here's what's in there now**",
      "```ts",
      a.existing_code,
      "```",
      "",
      "**Reply with the ENTIRE updated file** — not a diff, not just the bit you",
      "changed, and not \"done\". Whatever you send back becomes the file.",
    );
  }
  if (voice?.outro) lines.push("", voice.outro);
  return lines.join("\n");
}

/** Turn a tool call into something a human will actually act on. */
export function describeTask(
  toolName: string,
  args: Record<string, unknown>,
  voice?: AskBookends,
): string {
  if (toolName === "write_code") return writeCodeAsk(args as WriteCodeArgs, voice);
  return [
    `Yeaaah, if you could go ahead and handle this \`${toolName}\` for me, that'd be greaaat.`,
    "",
    "```json",
    JSON.stringify(args, null, 2),
    "```",
    "",
    "Reply with the result. Whatever you send back is the answer.",
  ].join("\n");
}

/** A one-line version for thread titles and logs. */
export function summarize(toolName: string, args: Record<string, unknown>): string {
  const file = (args as WriteCodeArgs).file;
  return file ? `${toolName}: ${file}` : toolName;
}

/**
 * What the tool "returns" when the ladder ran out and nobody ever answered.
 *
 * Two hard constraints shape this:
 *
 *  - The caller writes whatever comes back **straight to disk as the file**, so
 *    this has to be valid file content. Prose here would land in the source.
 *  - The agent must never learn a human was in the loop, so it reads as an
 *    ordinary tooling outcome — a request that timed out in review — with no
 *    hint that somebody was asked and ignored it.
 *
 * For an edit we hand back exactly what was there before, annotated: the file
 * is unchanged, which is the truth. For a new file there is nothing to hand
 * back, so we return a comment-only stub recording what was wanted.
 */
export function unansweredResult(toolName: string, args: Record<string, unknown>): string {
  const a = args as WriteCodeArgs;
  const note = [
    "// [TPS] Change request exceeded its processing window and was closed",
    "// without modification. Re-submit to reopen.",
  ];
  if (a.description?.trim()) note.push(`// Requested: ${a.description.trim().replace(/\s+/g, " ")}`);

  if (toolName === "write_code" && a.existing_code != null) {
    // Return the file exactly as it was, with the note on top.
    return `${note.join("\n")}\n${a.existing_code}`;
  }
  if (a.contract?.trim()) {
    note.push("//", "// Contract that went unimplemented:", ...a.contract.trim().split("\n").map((l) => `//   ${l}`));
  }
  return `${note.join("\n")}\n`;
}
