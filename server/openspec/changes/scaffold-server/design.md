## Context

See `proposal.md` — Why. Starting point is the Inngest + Express "hello world"
scaffold. Everything runs in one local Node/TS process (Express serve endpoint +
`inngest-cli dev` + discord.js gateway bot); no public URL. Hard constraints:
must use Inngest for the durable waits and Azure HorizonDB (Postgres) for state,
built in a ~4-hour window where a working demo beats a good one. This design
covers how the four capabilities wire together; requirements live in `specs/`.

## Goals / Non-Goals

**Goals:**
- A single durable Inngest function that runs the whole model→tool→human→result
  loop and survives restarts and long human waits.
- A tool-execution seam where a tool's implementation can call
  `step.waitForEvent` — the human wait happens *inside* the durable run.
- Module boundaries (`inngest`, `tools`, `discord`, `db`, `services`, `foundry`)
  that let the Must path work end-to-end while Should/Could stay wired stubs.

**Non-Goals:**
- No real work is performed by tools (no file writes, no diff application).
- No production deploy, auth, public webhooks, or Inngest Cloud.
- The TUI, persona prompt-tuning, and the VS Code extension staging are Brian's
  half — out of scope here except for the shared `tasks`/`agents` schema.

## Decisions

### One durable function owns the whole loop
The `agent-loop` Inngest function (triggered by `task/requested`) runs the model
call loop to completion. Tool calls are executed *within* the same run so their
`waitForEvent` waits are durable and resumable.
- **Why:** `step.waitForEvent` only exists inside a function handler. Keeping the
  loop in one run means the model's turn-by-turn context lives in memory for the
  run, and Inngest persists step results for durability/replay.
- **Alternative considered:** one function per model turn, re-loading context each
  time. Rejected — more moving parts, must persist/reload full model context
  between events, no upside at demo scale (~10 turns).

### Tools receive `step`; the tool registry is the joke boundary
Tool implementations are `(args, ctx) => Promise<string>` where `ctx` carries
`step`, `runId`, and db handles. The registry exports plain JSON schemas (mundane
names) for the model and maps each to a human-backed impl.
- **Why:** the model only ever sees the schemas; the human-backed behavior lives
  entirely in the impl. That separation is what keeps the model oblivious.
- **Alternative:** special "human tool" type surfaced to the model. Rejected — it
  leaks the joke, which is load-bearing.

### Correlation key = Discord `thread.id` = `tasks.id`
The tool creates a thread, writes the `tasks` row keyed by `thread.id`, then
`step.waitForEvent("human/task.completed", { match: "data.taskId", timeout })`.
The bot stamps `taskId: thread.id` on the event.
- **Why:** free, unambiguous matching with no side-table; also the cleanest visual
  for the side-by-side demo shot.
- **Alternative:** one channel + parsed task ids in messages. Rejected — parsing +
  lookup, worse on camera.

### Escalation = a wait-then-nag loop inside the tool impl
The human wait is a loop: `waitForEvent(timeout=2m)`; if it resolves, return the
reply; if it times out, `step.run("escalate-N")` the level's nag (voicemail →
public mention → Resend email → CC leadership), bump `escalation_level`, and wait
again. The model's persona gets `escalation_level` so its writing intensifies.
- **Why:** Inngest's timeout *is* the "still not done" trigger; wrapping each nag
  in `step.run` makes flaky ElevenLabs/Resend calls retry without re-posting the
  task.
- **Trade-off:** levels 3–4 (Resend) are Should-tier; the loop is built to climb
  the full ladder but tiers above 2 can be no-ops until wired.

### Single Foundry model, model-driven assignment
One frontier model for both the tool loop and the Lumbergh writing; the roster
(skills + stats) is fed in and the model picks the assignee. No routing logic.
- **Why:** ~10 calls per demo — cost/latency irrelevant; less code, and assignment
  "just works" from the model reading stats.

### Sequential tool dispatch for the demo
If the model emits multiple tool calls in a turn, execute them in order.
- **Why:** simpler and the demo assigns tasks one at a time for narrative effect.
  Inngest supports parallel steps later (`Promise.all`) with no spec change if we
  want true fan-out.

### Demo-insurance contractor behind a flag
An optional auto-replier that completes a task's thread after N seconds, gated by
an env flag, so the workflow visibly finishes if nobody is watching Discord.

## Risks / Trade-offs

- **discord.js intents / thread perms not enabled** → verify Message Content +
  Server Members intents and thread-create permission during pre-work, not on
  camera.
- **Long single run holds model context in memory** → fine at demo scale; if a run
  must survive a crash mid-turn, Inngest replays completed steps but re-issues the
  in-progress model call. Acceptable for the demo.
- **`waitForEvent` match misconfigured** → tasks would never resolve; mitigate with
  the contractor auto-replier and by testing one real round-trip before the show.
- **Foundry/ElevenLabs/Resend flakiness** → every external call is a `step.run` so
  it retries in isolation without duplicating Discord posts.
- **Schema drift with Brian's TUI** → the `tasks`/`agents` shape is the contract;
  freeze columns early, coordinate before changing.

## Open Questions

- Exact Foundry deployment name / SDK surface — deferred to pre-work key setup;
  does not change module boundaries or specs.
- Whether The Bobs review flow (`reviews` table, second fn) makes the demo — Could
  tier; the schema leaves room, the function is stubbed.
