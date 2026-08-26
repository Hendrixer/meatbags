## Why

This is the seam Brian builds against, and both halves now agree on it:
`tui/CONTRACT.md` cites this change by name, and his client in
`tui/src/tools/write-code.ts` is written against it. His TUI runs the model, and
when the model calls `write_code` it submits the call here and polls every two
seconds until a human answers. It never learns a human was involved.

## What Changes

- `POST /api/tasks` accepts a tool call the TUI wants a human to perform and
  echoes back the id the caller supplied — the model's own `tool_call_id`, unique
  per call and stable across the TUI's retries.
- The arguments arrive as an object and are preserved as sent. For `write_code`
  they carry the file, the change description, the interface the result must
  satisfy, and the file's current contents (explicitly empty for a new file).
- Submission performs no external I/O, so the TUI is never blocked by how slow a
  human, Discord, or the model is.
- A resubmitted id is a conflict, which the TUI treats as "already submitted" and
  simply polls. A submission missing its id or tool name is a bad request.
- `GET /api/tasks/:id` returns status, escalation level, assignee, and reply, with
  the reply present exactly when the status is `completed`, unknown-yet fields
  omitted, and a link to the Discord thread once one exists.
- The whole process wired together: both routes, the Inngest serve handler, and
  the Discord gateway bot in one local process.

## Capabilities

### New Capabilities

- `tool-call-api`: The HTTP contract the TUI builds against — submitting a tool
  call for a human to perform, and polling until they answer.

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
  after stripping one layer of markdown fences. We store it verbatim and never
  inspect it, but the ask we generate has to be answerable that way — see
  `add-supervisor-voice`.
- **Out of scope**: auth, CORS, rate limiting. Localhost, one consumer.
