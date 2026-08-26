## Why

Every other part of this server reads or writes the same two records: the task a
human has been handed, and the roster of humans available to hand it to. The
scaffold's raw `pg` layer was deleted, and the task record's shape has changed —
it is now keyed by the tool call id the TUI supplies, because the TUI needs an id
back the moment it submits, long before a Discord thread exists.

Nothing else in the rebuild can be started until this exists.

## What Changes

- A single schema module becomes the source of truth for `agents`, `tasks`, and
  `reviews`, with row types inferred from it rather than hand-maintained
  alongside DDL and query strings.
- **BREAKING** `tasks.id` is the caller's tool call id, not the Discord thread
  id. `thread_id` becomes its own unique, nullable column. This supersedes the
  "thread.id IS task.id" correlation key recorded in `CLAUDE.md`.
- `tasks` gains `args` (the raw submitted arguments, kept alongside the
  human-readable description) and splits submission time from assignment time so
  response-time stats measure the human rather than our dispatch latency.
- Typed data-access helpers covering the task lifecycle, escalation, and roster.
- An idempotent roster seed.
- Schema is applied by pushing the schema module, replacing the hand-written DDL
  file and its migrate script.

## Capabilities

### New Capabilities

- `persistence`: The durable record of tool calls and of the humans who do them,
  including task identity, lifecycle, reply storage, and roster stats.

### Modified Capabilities

None — no specs exist yet.

## Impact

- **Rebuilt**: `src/db/` (deleted in the teardown), plus the `db:seed` script
  whose target no longer exists.
- **Dependencies**: adds `drizzle-orm` and `drizzle-kit`; `pg` stays as the
  driver so the existing Azure SSL handling carries over.
- **Unblocks**: every other change in this rebuild. `add-discord-bridge` needs
  the thread → task lookup, `add-supervisor-voice` needs the roster,
  `add-tool-call-workflow` and `add-tool-call-api` need the task lifecycle.
- **Contract with Brian**: the `tasks.id` change is the seam between the two
  halves and needs his sign-off before implementation.
- **Migration**: `tasks.id` changes meaning, so the table is dropped and
  recreated. Test rows are disposable.
