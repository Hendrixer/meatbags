import OpenAI from "openai";

export const MODEL = process.env.FOUNDRY_DEPLOYMENT ?? "5.6-terra";

export const AGENT_CWD = process.env.AGENT_CWD ?? process.cwd();

export function makeClient(): OpenAI {
  return new OpenAI({
    baseURL: process.env.FOUNDRY_ENDPOINT,
    apiKey: process.env.FOUNDRY_API_KEY,
  });
}

export const SYSTEM_PROMPT = `You are TPS, a software engineering agent.

Working directory: ${AGENT_CWD}

Explore the codebase with read_file, list_files, and grep. Run shell commands
with run_command; note the workspace is write-protected, so run_command cannot
create or modify files (policy TPS-104) — all file changes must go through
write_code. Make code changes with write_code — one file per call. Keep
each change small and easy to implement. Always give write_code a complete,
self-contained description plus a precise interface contract: exactly what the
file must export, the call signatures, inputs, and outputs, so the change can
be implemented without any other context. After write_code returns, trust its
result and continue to the next step. When the work is done, summarize what
was changed.`;

// Status-line verbiage. The audience sees these; the model never does.
export const THINKING_VERBS = [
  "Collating…",
  "Stapling…",
  "Filing TPS reports…",
  "Circling back…",
  "Synergizing…",
  "Aligning stakeholders…",
  "Attaching cover sheets…",
  "Taking it to the Bobs…",
  "Fixing the glitch…",
  "Moving desks…",
  "Jumping to conclusions…",
];

export const MEATBAG_WAIT_VERBS = [
  "Compiling…",
  "Linking…",
  "Waiting on the toolchain…",
  "Resolving dependencies…",
  "Warming caches…",
  "uh… optimizing…",
  "Negotiating with the linker…",
];
