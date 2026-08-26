# MEATBAGS — server (the plumbing)

A Claude Code clone that does **zero work**. Every "tool call" the model makes —
`read_file`, `write_code`, `run_tests`, `deploy` — is secretly *"post the task in
Discord and wait for a human to do it."* The model thinks it's an agent. It's a
middle manager. Built for a ~4-hour CodeTV Web Dev Challenge. A **working demo
beats a good demo.**

This dir is **Scott's half**: Inngest workflow + tool harness + Discord bot +
ElevenLabs/Resend steps. Brian owns the TUI + Horizon schema/seed + persona
prompts. **The seam between the two halves is the `tasks` table** — treat its
shape as a contract; coordinate before changing columns.

## The load-bearing joke (do not break this)

The model must **never** be able to tell a human tool from a real one. Tools have
ordinary names and ordinary-looking signatures; their implementation just posts
to Discord and waits. The payoff is showing the model transcript and the Discord
channel side-by-side. Any abstraction that leaks "this is a human" into the
model's view kills the bit. Keep the tool schema mundane.

## Hard constraints

- **Must use Inngest** for the durable execution / human-in-the-loop waits.
- **Must use Azure HorizonDB (Postgres, West US 2)** via `pg`, demoed live in the
  VS Code PostgreSQL extension.
- **~4 hours.** Cut anything not on the critical path. Sillier > polished.
- **Local only.** No public URL. `npx inngest-cli dev` (UI on :8288), discord.js
  gateway bot, everything on the laptop.

## The flow

```
TUI prompt
 → inngest.send("task/requested")
 → Inngest fn "agent-loop": call Foundry model with a normal-looking tool set
 → model calls a tool, e.g. write_code({ file, description })
 → tool impl: pick a human from roster → create Discord THREAD → post task
              (+ ElevenLabs voicemail mp3 attached)
 → step.waitForEvent("human/task.completed", match on thread id, timeout 2m)
     ├─ human replies in thread → discord bot → inngest.send("human/task.completed")
     │                                          → tool "returns" their reply
     └─ timeout → escalate one level → nag → wait again
 → model gets the "tool result", continues, calls next tool…
 → all done → write stats to Horizon → email YOU "enjoy your afternoon"
```

## Correlation key (decided)

**Thread-per-task.** The Discord `thread.id` **is** the `task.id`. That gives
`waitForEvent` a free, unambiguous match key: the bot puts `taskId: thread.id` on
every `human/task.completed` event, and the waiting step matches on it. No
side-table lookup, no message-ID parsing.

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
- **Foundry client** — Azure AI Foundry model for the Lumbergh writing and the
  tool loop. **One frontier model for everything** (the demo makes ~10 calls;
  cost is irrelevant, simplicity wins). Assignment has **no routing logic** — feed
  the model the roster (`name`, `skills[]`, stats) and let it pick the human.
- **ElevenLabs** — every nag ships an mp3. Designed voice, `voice_id` in `.env`.
  Model writes for the ear with `<break time="1.5s" />`, under 12s. Wrap the
  render in one `step.run("render-audio")` so flakiness retries without re-sending
  the task.
- **Resend** — the formal-warning tiers (3–4). Email > Discord for HR energy.

## Data model (the contract with Brian's half)

- **`agents`** — the humans. `discord_id`, `name`, `skills[]`, `tasks_completed`,
  `avg_response_secs`, `warnings`, `voicemails_received`, `flair`.
- **`tasks`** — `id` (= Discord thread id), `agent_id`, `tool_name`,
  `description`, `status`, `escalation_level`, `assigned_at`, `completed_at`,
  `reply`, `audio_url`.
- **`reviews`** — (stretch) The Bobs' performance reviews.

Roster source-of-truth is split: **Discord says who's here, Horizon says what we
know about them.** Seed script pre-registers folks with skill tags.

## Decided defaults

- **Human replies are not applied to anything.** "Model accepts whatever garbage
  they pasted" is funnier and is less code than writing files — the reply just
  becomes the tool result string.
- **Demo insurance:** a fake "contractor" bot that auto-replies to a task after N
  seconds, so the workflow visibly completes even if nobody's watching Discord.
  Keep it behind a flag/env so it's easy to disable on camera.

## Scope ladder — cut from the bottom up

- **Must (demo exists):** the Inngest loop (model → tool → Discord post →
  `waitForEvent` → tool result → next tool); `agents` + `tasks` tables with the
  roster in the TUI; escalation levels 1–2 with ElevenLabs audio.
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
npm run dev    # tsx watch --env-file=.env ./index.ts  (Inngest serve + bot)
# in a second terminal — the local Inngest engine that runs the functions:
npx --ignore-scripts=false inngest-cli@latest dev -u http://localhost:3000/api/inngest
# dashboard: http://localhost:8288
```

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
