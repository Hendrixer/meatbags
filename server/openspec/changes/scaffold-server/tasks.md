## 1. Dependencies & config

- [ ] 1.1 Add `discord.js`, `pg`, `resend`, `@elevenlabs/elevenlabs-js`, and the Azure AI Foundry SDK to `package.json`; verify `npm install` succeeds and each imports without error via `node --input-type=module -e "import('discord.js')"` (repeat per dep).
- [ ] 1.2 Expand `.env` + add `.env.example` with the full key contract (Discord bot token, `#tasks`/`#hr`/`#general` channel ids, guild id, `HORIZON_URL`, Foundry endpoint/key/deployment, ElevenLabs `voice_id` + key, Resend key, `CONTRACTOR_AUTOREPLY_MS` flag); verify `.env.example` lists every var read in code and `.env` is gitignored.
- [ ] 1.3 Create the module skeleton (`src/inngest/`, `src/tools/`, `src/discord/`, `src/db/`, `src/services/`, `src/foundry/`) with index files; verify `tsc --noEmit` passes on the empty skeleton.

## 2. Persistence (the contract seam)

- [ ] 2.1 Add a `pg` Pool client in `src/db/` reading `HORIZON_URL` with SSL; verify `SELECT 1` succeeds against Horizon.
- [ ] 2.2 Write the schema DDL for `agents`, `tasks` (id = thread id), and `reviews` per the persistence spec; verify running it creates the three tables (`\dt` in the VS Code Postgres extension shows them).
- [ ] 2.3 Add typed data-access helpers (`upsertAgent`, `readRoster`, `createTask`, `completeTask`, `bumpEscalation`); verify a script that inserts and reads back a task round-trips the fields.
- [ ] 2.4 Write `seed` script for pre-registered humans with skill tags; verify running it against an empty db populates the roster and is idempotent on re-run.

## 3. Discord bridge

- [ ] 3.1 Stand up the discord.js gateway client with Message Content + Server Members intents; verify it logs in and prints the guild name on ready.
- [ ] 3.2 Add `createTaskThread(assignee, ask, audioUrl?)` that opens a thread in `#tasks` and posts the ask (+ audio attachment when present); verify calling it produces a visible thread with the message.
- [ ] 3.3 On a message in an active task thread, `inngest.send("human/task.completed", { taskId: thread.id, reply })`; verify replying in a thread emits the event (visible in the Inngest dev UI) and messages outside task threads emit nothing.
- [ ] 3.4 On a message in `#general`, upsert the speaker into `agents`; verify a new speaker creates one row and a repeat speaker does not duplicate.

## 4. Foundry model client

- [ ] 4.1 Add a Foundry client wrapper exposing a single `callModel({ messages, tools, escalationLevel })` returning text + tool calls; verify one completion returns against the deployment.
- [ ] 4.2 Add the Lumbergh system prompt parameterized by `escalationLevel` (1–4); verify level 1 vs level 4 produce visibly milder vs more passive-aggressive text on a sample call.

## 5. External-action services (step-wrapped)

- [ ] 5.1 Add `renderVoicemail(text)` (ElevenLabs, `<break>`-aware, <12s) returning an mp3 url/buffer; verify it produces a playable file for a sample nag. To be called inside `step.run("render-audio")`.
- [ ] 5.2 Add `sendEmail({ to, subject, body })` (Resend) as a stub-capable wrapper for tiers 3–4; verify a test send delivers (or logs clearly when `RESEND` unset). Marked Should-tier — safe to no-op until wired.

## 6. Human-tool harness (the load-bearing joke)

- [ ] 6.1 Define the mundane tool schemas (`read_file`, `write_code`, `run_tests`, `deploy`) with ordinary descriptions in `src/tools/`; verify the schemas passed to the model contain no human-in-the-loop wording.
- [ ] 6.2 Implement the shared human-backed executor `(args, ctx) => Promise<string>`: pick assignee (from model choice), `createTaskThread`, write the `tasks` row keyed by thread id, then `step.waitForEvent("human/task.completed", { match: "data.taskId", timeout })`; verify a real reply resolves the call with the reply text verbatim (garbage included, unmodified).
- [ ] 6.3 Wrap the wait in the escalation loop: on timeout `step.run("escalate-N")` the level's nag (L1 voicemail → L2 public @mention → L3 Resend email → L4 CC leadership), `bumpEscalation`, then wait again; verify a task left unanswered climbs L1→L2 with a voicemail at L1 and a public mention at L2 (L3–4 may be stubbed).
- [ ] 6.4 Add the flagged demo-insurance contractor that auto-replies to a task's thread after `CONTRACTOR_AUTOREPLY_MS`; verify with the flag set a task self-completes and with it unset nothing auto-replies.

## 7. Agent-loop Inngest function

- [ ] 7.1 Create the `agent-loop` function triggered by `task/requested`, seeded with the prompt + roster; verify sending the event from code starts exactly one run in the Inngest dev UI.
- [ ] 7.2 Implement the model tool-calling loop: call model → execute each tool via the harness (passing `step`/db in `ctx`) → append result → repeat until no tool calls; verify a prompt drives at least two sequential tool calls each resolved by a human reply.
- [ ] 7.3 On loop end, write run stats and `sendEmail` the user an "enjoy your afternoon" message; verify completion writes stats and triggers the email (Should-tier — log if Resend unset).
- [ ] 7.4 Register `agent-loop` (and a stubbed `bobs` fan-out fn) in the exported `functions` array; verify both appear in the Inngest dev UI functions list.

## 8. Process wiring & end-to-end verification

- [ ] 8.1 Start the Express serve endpoint and the discord.js bot in the one `index.ts` process; verify `npm run dev` boots both (server log + bot-ready log) and `GET /api/inngest` reports `mode: dev` with the functions registered.
- [ ] 8.2 End-to-end Must-path check: send `task/requested` ("add dark mode to the settings page") → confirm a Discord thread + voicemail appear, the Inngest dev UI shows the run paused on `waitForEvent`, a human/contractor reply resumes it, the model assigns the next task, and `tasks` rows reflect status + escalation level throughout.
