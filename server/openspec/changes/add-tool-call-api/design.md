## Context

See `proposal.md` — Why. Express and the Inngest serve handler are already
mounted in `index.ts`; the old prompt-based route was removed in the teardown.
The bot starts in the same process when its token is configured.

## Goals / Non-Goals

**Goals:**

- A submit that returns in milliseconds no matter how slow Discord, the model, or
  the human are.
- A poll that is a single indexed read.

**Non-Goals:**

- Auth, CORS, rate limiting. Localhost, one consumer, one afternoon.
- Streaming or push. Polling is the contract; Inngest Realtime stays cut.
- Any endpoint the TUI does not need — no run grouping, no conversation state.

## Decisions

### Submit performs no external I/O

It validates, inserts the task, sends the trigger event, and returns. Assignment,
ask generation, and thread creation all happen inside the workflow. This is what
keeps submission fast and keeps that work inside the retry boundary.

### The caller supplies the id, and a duplicate is a conflict

The id is the caller's own tool call id, so uniqueness is theirs to guarantee. A
repeat is far more likely to be a retry or a bug than an intentional overwrite,
so it is rejected and the existing task is left alone.

### Unknown fields come back absent, not as errors

A queued task has no assignee, thread, or reply yet. Polling it is the normal
case for the first seconds of every task, so absent fields are ordinary — only an
unrecognised id is an error.

### The thread link is derived, not stored

A Discord thread URL is the guild id and the thread id, both of which are already
available. Deriving it avoids a column that could disagree with `thread_id`.

## Risks / Trade-offs

- **A polling client hammering the route.** → It is a single indexed read on
  localhost. Not worth defending against.
- **Poll returns `completed` before the reply is committed.** → Status and reply
  are written in the same update, so they cannot disagree.
- **The route contract drifting from what Brian built against.** → It is the seam;
  it needs his sign-off and it is the reason this change carries the end-to-end
  verification.

## Open Questions

- Whether to support polling several call ids in one request. A model emitting
  parallel tool calls would make the TUI poll once per call per tick; a batch
  form is a small addition if that turns out to matter.
