## Why

This is the seam Brian builds against, and he has already shipped his side.
`tui/CONTRACT.md` and `tui/src/tools/write-code.ts` define it: his TUI runs the
model, and when the model calls `write_code` it posts the task here and polls
every two seconds until a human answers. It never learns a human was involved.

The contract is his because his client exists. This change implements it.

## What Changes

- `POST /api/tasks` accepts a task the TUI wants a human to perform and returns
  an id it mints itself. The TUI sends no id and treats what comes back as
  opaque.
- The submitted body is flat and `write_code`-shaped — `tool_name`, `file`,
  `description`, `contract`, and `existing_code` (null for a new file) — and is
  preserved as submitted alongside the ask derived from it.
- `GET /api/tasks/:taskId` returns `taskId`, `status`, `escalation_level`,
  `assignee`, and `reply`, with `reply` non-null exactly when `status` is
  `completed`. Extra fields are permitted and ignored by the TUI.
- Submission performs no external I/O, so the TUI is never blocked by how slow a
  human, Discord, or the model is.
- The whole process wired together: both routes, the Inngest serve handler, and
  the Discord gateway bot in one local process.

## Capabilities

### New Capabilities

- `tool-call-api`: The HTTP contract the TUI builds against — submitting a task
  for a human to perform, and polling until they answer.

### Modified Capabilities

None — no specs exist yet.

## Impact

- **New**: `src/api/`; `index.ts` gains the routes.
- **Depends on**: `add-persistence-layer` (both routes read and write the task
  record) and `add-tool-call-workflow` (submission starts a run).
- **Contract**: `tui/CONTRACT.md`. The TUI defaults to
  `MEATBAG_SERVER=http://localhost:3000`, matching this server's port, and has a
  `MEATBAG_MOCK=1` in-process fake for working without us.
- **Reply semantics**: the TUI writes the reply to disk as the new file contents
  after stripping one layer of markdown fences. We still store it verbatim and
  never inspect it, but the ask we generate has to be answerable that way — see
  `add-supervisor-voice`.
- **Out of scope**: auth, CORS, rate limiting. Localhost, one consumer.
