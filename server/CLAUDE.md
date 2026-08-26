# MEATBAGS — server (the plumbing)

A Claude Code clone that does **zero work**. Every "tool call" the model makes —
`read_file`, `write_code`, `run_tests`, `deploy` — is secretly *"post the task in
Discord and wait for a human to do it."* The model thinks it's an agent. It's a
middle manager. Built for a ~4-hour CodeTV Web Dev Challenge. A **working demo
beats a good demo.**

This dir is **Scott's half**: the HTTP handoff + Inngest workflow + Discord bot +
ElevenLabs/Resend steps. **Brian owns the TUI, and the TUI owns the agent loop** —
the model, the conversation, and the tool schemas all live there. This server
never talks to a model on the agent's behalf; it only turns one tool call into a
human in Discord.

**The seam between the two halves is `tui/CONTRACT.md`** — two HTTP routes and the
`tasks` table behind them. Brian's client is already written against it, so treat
that doc as the contract and coordinate before changing either.

## The load-bearing joke (do not break this)

The model must **never** be able to tell a human tool from a real one. Tools have
ordinary names and ordinary-looking signatures; their implementation just posts
to Discord and waits. The payoff is showing the model transcript and the Discord
channel side-by-side. Any abstraction that leaks "this is a human" into the
model's view kills the bit.

The mundane tool surface now lives in the **TUI**, since that is where the model
is. On this side there is nothing to protect: everyone in Discord knows perfectly
well they are the ones doing the work.

## Hard constraints

- **Must use Inngest** for the durable execution / human-in-the-loop waits.
- **Must use Azure HorizonDB (Postgres, West US 2)**, demoed live in the VS Code
  PostgreSQL extension. Drizzle over `pg`; `src/db/schema.ts` is the source of
  truth and `npm run db:push` applies it.
- **~4 hours.** Cut anything not on the critical path. Sillier > polished.
- **Local only.** No public URL. `npx inngest-cli dev` (UI on :8288), discord.js
  gateway bot, everything on the laptop.

## The flow
```
TUI runs the agent loop; model calls write_code(...)
 → POST /api/tasks  { id, tool_name, arguments: {file, description, contract,
                                                  existing_code} }
 → insert `tasks` row (id = caller's id, status=queued), echo the id
 → inngest.send("tool/call.requested", { taskId })       ← nothing else in POST
 → Inngest fn "human-tool-call":
     → one Foundry call: pick a human from the roster + write the snarky ask
     → create Discord THREAD, post the ask, record agent_id + thread_id
     → step.waitForEvent("human/task.completed", match on taskId, timeout)
         ├─ human replies in thread → bot resolves thread_id → task → sends event
         │                          → completeTask stores the reply VERBATIM
         └─ timeout → bump escalation_level → nag → wait again
 → meanwhile the TUI polls GET /api/tasks/:id every 2s, forever
 → status=completed + reply → TUI strips one layer of ``` fences and writes the
   reply to disk as the new file contents
```

## Correlation key (decided — revised)

**`tasks.id` is the caller's `tool_call_id`.** The TUI needs an id back the
instant it posts, long before a Discord thread exists, so the thread id can't be
it — **`thread_id` is its own unique column**. The bot resolves thread → task
through it and puts that `taskId` on the `human/task.completed` event, which is
what `waitForEvent` matches on.

Using the model's own tool-call id means the TUI keeps no mapping and can retry a
failed POST safely: a duplicate id returns `409`, which it reads as "already
submitted, just poll it". A conflict must therefore leave the existing row
completely untouched.

*(This supersedes the earlier "thread.id IS task.id" decision, which couldn't
survive the TUI needing a synchronous id.)*

## Escalation ladder

Each level = `step.sleep`/`waitForEvent` timeout → `step.run` the nag → wait
again. Inngest retries double as "we noticed this is still incomplete." The
model's persona takes an `escalation_level` (1–4) so it opens mild and gets more
Lumbergh the longer a task sits.

| Level | Channel                          | Tone                              |
|-------|----------------------------------|-----------------------------------|
| 1     | Discord thread + voicemail       | "Yeaaah, if you could go ahead…"  |
| 2     | Public @mention in `#tasks`      | "Just circling back on this."     |
| 3     | Email via Resend, `Re: Re: Re:`  | Formal warning. Mentions the cover sheet. |
| 4     | Email CC leadership (Inngest CEO)| "Looping in leadership."          |

## Components in this process (one Node/TS process)

- **Inngest serve endpoint** — Express hosts the `serve` handler at
  `/api/inngest`; `inngest dev` discovers it. (Current scaffold in `index.ts` +
  `src/inngest/`.)
- **discord.js gateway bot** — needs **Message Content** + **Server Members**
  intents. On a message in a task thread → `inngest.send("human/task.completed",
  { taskId: thread.id, reply })`. Upserts anyone who speaks in `#general` into
  `agents`.
- **Foundry client** — one call per task, not an agent loop: it picks the human
  *and* writes the ask in a single completion returning `{ assigneeId, ask }`.
  Assignment has **no routing logic** — feed it the roster (`name`, `skills[]`,
  stats) and let it pick. Reached over the OpenAI-compatible route
  (`/openai/v1/chat/completions`, `Bearer` auth, model `gpt-5.6-terra`).
- **ElevenLabs** — every nag ships an mp3. Designed voice, `voice_id` in `.env`.
  Model writes for the ear with `<break time="1.5s" />`, under 12s. Wrap the
  render in one `step.run("render-audio")` so flakiness retries without re-sending
  the task.
- **Resend** — the formal-warning tiers (3–4). Email > Discord for HR energy.

## Data model (the contract with Brian's half)

- **`agents`** — the humans. `discord_id`, `name`, `skills[]`, `tasks_completed`,
  `avg_response_secs`, `warnings`, `voicemails_received`, `flair`.
- **`tasks`** — `id` (the caller's `tool_call_id`), `thread_id` (unique, null
  until dispatch),
  `agent_id`, `tool_name`, `args` (jsonb: file / contract / existing_code),
  `description`, `status` (`queued` → `assigned` → `completed`),
  `escalation_level`, `created_at` (submitted), `assigned_at` (handed to a
  human — response times measure from here, not from `created_at`),
  `completed_at`, `reply`, `audio_url`.
- **`reviews`** — (stretch) The Bobs' performance reviews.

Roster source-of-truth is split: **Discord says who's here, Horizon says what we
know about them.** Seed script pre-registers folks with skill tags.

## Decided defaults

- **We never touch the reply; the TUI applies it.** This server stores whatever
  the human typed, verbatim, and hands it back. Brian's TUI then writes it to
  disk as the new file contents (after stripping one layer of markdown fences).
  So "meatbag pastes garbage → the file now says garbage" is live, which is
  funnier than the original plan of ignoring it.
  **Consequence:** the ask we generate has to be answerable that way — it must
  carry the interface to satisfy plus the current code, and demand the whole file
  back. An ask that invites "yeah done" produces a file containing "yeah done".
- **Demo insurance:** a fake "contractor" bot that auto-replies to a task after N
  seconds, so the workflow visibly completes even if nobody's watching Discord.
  Keep it behind a flag/env so it's easy to disable on camera.

## Scope ladder — cut from the bottom up

- **Must (demo exists):** the two routes + the Inngest run behind them (POST →
  Discord post → `waitForEvent` → reply stored → TUI polls it back); `agents` +
  `tasks` tables; escalation levels 1–2.
- **Should:** Resend tiers 3–4; live leaderboard query in the VS Code Postgres
  extension; "enjoy your afternoon" email to the user at the end.
- **Could (first to cut):** The Bobs / Milton; Inngest Realtime instead of
  polling; pgvector "route to best-matching human."

## Personas (priority order)

Lumbergh (assignment + nag voice, **required**) · Flair (a number on the
leaderboard that only ever goes up, zero logic) · The Bobs (second Inngest fn on
`task.completed`, interviews the human, writes a review — shows fan-out) · Milton
(one pre-registered human never assigned anything, periodically told his desk is
moving; stapler status tracked in DB).

## Commands

```shell
npm run dev      # tsx watch --env-file=.env ./index.ts  (routes + Inngest serve + bot)
npm run db:push  # apply src/db/schema.ts to Horizon
npm run db:seed  # pre-register the roster (idempotent)
# in a second terminal — the local Inngest engine that runs the functions:
npx --ignore-scripts=false inngest-cli@latest dev -u http://localhost:3000/api/inngest
# dashboard: http://localhost:8288
```

Planning lives in `openspec/changes/`, one change per capability. Shipped
behaviour graduates to `openspec/specs/` — read that first, it's what's true.

Build order: ~~`add-persistence-layer`~~ (shipped) → `add-supervisor-voice` +
`add-discord-bridge` → `add-tool-call-workflow` → `add-escalation-ladder` →
`add-tool-call-api`.

`INNGEST_DEV=1` must reach the client (it's in `.env`, loaded via `--env-file`);
without it the client falls back to cloud mode and `/api/inngest` 500s. Kill stale
watchers with `pkill -f "tsx watch"` if a port sticks (`tsx watch` children
outlive `kill %1`).

## The north star: the demo (~3 min)

Type "add dark mode to the settings page." Model "reads the codebase" → Scott gets
a thread + voicemail; Inngest dev UI is paused on `waitForEvent`. Scott ignores
it → timeout → public @mention → laugh. Someone replies garbage → model accepts it
as a tool result, moves on, assigns the next task. Second human ignores it → email
→ CC Inngest CEO. Open the Postgres extension, run the leaderboard query, flair
minimum has gone up. Close laptop. Phone buzzes: "Everything's handled. Enjoy your
walk." **Every code decision should serve this three minutes.**
```
