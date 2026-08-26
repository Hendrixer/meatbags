## Context

See `proposal.md` — Why. `src/db/` was deleted in the teardown; `src/config.ts`
already exposes `HORIZON_URL`. Azure HorizonDB (Postgres) is mandatory and gets
demoed live in the VS Code PostgreSQL extension, so the columns are read off a
projector. The whole build is a ~4-hour budget.

## Goals / Non-Goals

**Goals:**

- One source of truth for the schema, with row types inferred from it.
- A task record the TUI can address the instant it submits.
- Response-time stats that measure the human, not us.
- Columns legible at a glance during the leaderboard query.

**Non-Goals:**

- Migration history. This repo does not outlive a Saturday.
- Any query the two routes and the workflow do not need.

## Decisions

### The id is minted here, not supplied by the caller

`CLAUDE.md` previously decided the Discord `thread.id` **is** the `task.id`. That
held when the workflow started from an Inngest event. It cannot hold now: the TUI
needs an id back synchronously from its submit call, and the thread does not
exist until the run has picked an assignee and called Discord seconds later.

Chosen: the submit route mints an opaque id, returns it, and uses it as
`tasks.id`. `thread_id` is a separate unique column; the Discord bot resolves
thread → task through it. `tui/CONTRACT.md` asks for exactly this — the TUI sends
no id and treats what comes back as opaque.

- *Alternative — the TUI passes its model's `tool_call_id`.* Would keep his side
  free of any id mapping, but he has already shipped a client that sends no id,
  and his doc is the agreed contract.
- *Alternative — create the thread inside the submit handler* to preserve
  `id == thread.id`. Rejected: it puts a model call and two Discord round-trips on
  the critical path of every submit, outside the workflow's retry boundary.

Cost: one indexed lookup per Discord message. The bot already queries on every
message to upsert speakers.

### The row fills in progressively, and `created_at` is not `assigned_at`

```
submit               dispatch step           escalate loop      human replies
──────               ─────────────           ─────────────      ─────────────
id (minted)          agent_id                escalation_level   reply
tool_name            thread_id                                  completed_at
args                 assigned_at                                status=completed
description          status=assigned
status=pending
created_at
```

The deleted DDL had `assigned_at DEFAULT now()` at insert. With the row now
written at submit time, that would fold our own dispatch latency — a model call
plus two Discord calls — into each human's average response time. Since the
leaderboard's entire punchline is who is slow, the two moments are separate
columns and response time is measured from `assigned_at`.

### Status as a constrained text column, not a database enum

Three values — `pending`, `assigned`, `completed`, named to match
`tui/CONTRACT.md` — and adding a fourth mid-build should not require altering a
type. The type union lives in TypeScript; the column stays text.

### `args` is stored even though `description` duplicates it

`description` is the prose that goes to Discord; `args` is what came off the
wire. Keeping both costs nothing, makes the row self-explanatory on the
projector, and means a re-worded ask never loses the original request.

### Push the schema rather than generate migrations

`drizzle-kit push` diffs the schema module against Horizon and applies it. `pg`
stays as the driver so the existing SSL handling for Azure carries over unchanged
and the pool stays lazily constructed — importing the module must not throw when
`HORIZON_URL` is absent.

## Risks / Trade-offs

- **`tasks.id` changes meaning and it is the seam with Brian's half.** →
  Reconciled against `tui/CONTRACT.md`; the change is recorded in the proposal as
  BREAKING.
- **Push will want to drop and recreate `tasks`.** → Test rows are disposable.
  Let it.
- **A wrong thread lookup would complete the wrong task.** → `thread_id` carries a
  unique constraint, and is nullable so a pending task matches nothing.
- **Stat updates race if a human answers two tasks at once.** → Counter updates
  are single statements; exact ordering does not matter for a leaderboard.

## Migration Plan

1. Add the dependencies and the push config pointed at `HORIZON_URL` with Azure's
   SSL settings.
2. Write the schema module.
3. Push, dropping the old `tasks` if present.
4. Seed the roster; confirm re-running changes nothing.

Rollback is recreating the previous three tables from the schema module's
history; there is no data worth preserving.

## Open Questions

- Whether to persist the generated ask separately from `description`, so the
  Postgres leaderboard shot shows the supervisor's escalating lines. Nothing
  depends on it and it can be added later without touching anything else.
