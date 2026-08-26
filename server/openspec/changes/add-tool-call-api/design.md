## Context

See `proposal.md` — Why. The contract is fixed by `tui/CONTRACT.md` and by the
client already shipped in `tui/src/tools/write-code.ts`; this design describes
implementing it, not choosing it. Express and the Inngest serve handler are
already mounted in `index.ts`; the old prompt-based route was removed in the
teardown.

## Goals / Non-Goals

**Goals:**

- A submit that returns in milliseconds no matter how slow Discord, the model, or
  the human are.
- A poll that is a single indexed read, cheap enough to serve every two seconds
  forever.

**Non-Goals:**

- Auth, CORS, rate limiting. Localhost, one consumer, one afternoon.
- Streaming or push. The TUI polls; Inngest Realtime stays cut.
- Validating or interpreting the reply. That is the TUI's business, and it has
  decided not to either.

## Decisions

### Submit performs no external I/O

It validates, mints an id, inserts the task, sends the trigger event, and
returns. Assignment, writing the ask, and thread creation all happen inside the
workflow. This is what keeps submission fast and keeps that work inside the
retry boundary.

### The server mints the id

`tui/CONTRACT.md` asks for this explicitly — "generate your own taskId, don't
await Discord thread creation to respond" — and the shipped client sends no id.
A random opaque identifier from the standard library avoids a dependency and
avoids any collision question.

- *Alternative — the caller's own tool call id as the key.* Would let the TUI
  correlate without storing anything, but the client that exists does not send
  one, and his doc is the agreed seam.

### The flat body is mapped into the stored arguments

The TUI posts `tool_name`, `file`, `description`, `contract`, and
`existing_code` at the top level. Everything but the tool name is stored as the
task's arguments, so the record keeps exactly what was asked while the schema
stays generic enough for a second tool later.

`existing_code` can be a whole source file, so the arguments column carries real
payloads rather than a couple of short strings. jsonb handles it; it is worth
knowing when reading rows on a projector.

### Absent values are null, not errors

A pending task has no assignee and no reply. Polling it is the normal case for
the first seconds of every task — the TUI starts polling immediately — so nulls
are ordinary and only an unrecognised identifier is an error. `reply` is non-null
exactly when status is `completed`, which the TUI relies on as its stop
condition.

### The response may carry more than the contract requires

The contract says extra fields are welcome and ignored, so the Discord thread URL
rides along for the demo without risking the TUI.

## Risks / Trade-offs

- **A polling client hammering the route** — every two seconds, forever, per
  outstanding task. → A single indexed read on localhost. Not worth defending
  against.
- **Poll returns `completed` before the reply is committed.** → Status and reply
  are written in the same update, so they cannot disagree.
- **The TUI hangs forever if a task is never answered.** → By design on his side;
  Esc is the only timeout. The escalation ladder never abandons a task either, so
  the two halves agree.
- **A reply that is not file contents gets written to disk as if it were.** →
  Also by design — see `add-supervisor-voice` for making the ask answerable.

## Open Questions

- Whether to support polling several identifiers in one request. The shipped
  client polls one task at a time and only ever has one outstanding, so this is
  moot until a second tool exists.
