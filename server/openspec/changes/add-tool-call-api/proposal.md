## Why

This is the seam Brian builds against. His TUI runs the model and the
conversation; when the model calls a tool, the TUI hands it here and waits for a
result, never learning that a human in Discord produced it. Two routes are the
entire public surface of this server.

## What Changes

- A submit route accepting a caller-supplied call id, a tool name, and arbitrary
  arguments, which records the task and starts the work that gets it done.
- Submission acknowledges immediately and performs no external I/O — no model
  call, no Discord — so the TUI is never blocked by how slow a human is.
- A poll route reporting status, the reply once there is one, the current
  escalation level, the assignee, and a link to the Discord thread; unknown
  fields come back absent rather than as errors.
- Rejection of malformed submissions and of duplicate call ids.
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
- **Depends on**: `add-persistence-layer` (both routes are reads and writes of
  the task record) and `add-tool-call-workflow` (submission starts a run).
- **Contract with Brian**: the two route shapes and the caller-supplied call id
  need his sign-off. This change carries the end-to-end verification for the
  whole rebuild, since it is the only entry point.
- **Out of scope**: auth, CORS, and rate limiting. Localhost, one consumer.
