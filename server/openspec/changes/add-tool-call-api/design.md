## Context

See `proposal.md` — Why. The contract is fixed by `tui/CONTRACT.md` and by the
client already shipped in `tui/src/tools/write-code.ts`; this design covers
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

It validates, inserts the task, sends the trigger event, and returns. Assignment,
writing the ask, and thread creation all happen inside the workflow. This keeps
submission fast and keeps that work inside the retry boundary.

### The caller supplies the id

It is the model's own `tool_call_id`, so it is unique per call and — the reason
Brian's contract asks for it — stable across the TUI's retries. That stability is
what makes a resubmission safely idempotent from his side: he can retry a failed
POST, get a conflict, and poll the task that already exists.

- *Alternative — the server mints it.* An earlier draft of his contract asked for
  this. It works equally well for us, but it costs him retry-stability, and both
  halves have now converged on the caller-supplied form.

### A duplicate id is a conflict, not an overwrite

The TUI reads a conflict as "already submitted, just poll it," so the correct
behaviour is to reject and leave the existing task completely untouched — a
retried submit must never reset a task that is already dispatched or answered.

### The arguments object is stored as sent

It maps directly onto the task's arguments column, so the record keeps exactly
what was asked while the schema stays generic enough for a second tool later.

The current-file contents can be a whole source file, so that column carries real
payloads rather than a couple of short strings. jsonb handles it; it is worth
knowing when reading rows on a projector.

### Unknown-yet values are omitted, not null

A queued task has no assignee and no reply. Polling it is the normal case for the
first seconds of every task — the TUI starts polling immediately — so omission is
ordinary and only an unrecognised id is an error. The reply is present exactly
when status is `completed`, which the TUI relies on as its stop condition.

### The thread link rides along

The contract welcomes extra fields and ignores what it does not know, so the
Discord thread URL is included once a thread exists. It is derived from the guild
and thread ids rather than stored, so it cannot disagree with the thread column.

## Risks / Trade-offs

- **A polling client hammering the route** — every two seconds, forever, per
  outstanding task. → A single indexed read on localhost. Not worth defending
  against.
- **Poll returns `completed` before the reply is committed.** → Status and reply
  are written in the same update, so they cannot disagree.
- **A retried submit clobbering a live task.** → The conflict path must not write
  anything. This is the one case where getting it wrong silently loses a human's
  work.
- **The TUI hangs forever if a task is never answered.** → By design on his side;
  Esc is the only timeout. The ladder never abandons a task either, so the two
  halves agree.
- **A reply that is not file contents gets written to disk as if it were.** →
  Also by design — see `add-supervisor-voice` for making the ask answerable.

## Open Questions

- Whether to support polling several ids in one request. The shipped client polls
  one task at a time and only ever has one outstanding, so this is moot until a
  second tool exists.
