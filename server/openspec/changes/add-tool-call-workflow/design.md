## Context

See `proposal.md` — Why. Inngest is a hard constraint for the durable wait; the
client and a `bobs` stub already exist in `src/inngest/`. The dev UI is part of
the demo, so what a run looks like while suspended matters.

## Goals / Non-Goals

**Goals:**

- One run per tool call, so the dev UI shows one parked run per human ignoring us.
- A wait that survives restarts and costs nothing while suspended.

**Non-Goals:**

- Any interpretation of the human's reply.
- Batching several tool calls into one run.

## Decisions

### The trigger event carries only the task id

The submit route writes the row, then sends an event carrying `{ taskId }`. The
run reads the tool name and arguments back off the row. One source of truth for
what was asked, and the event stays small enough to read in the dev UI.

### Dispatch is a single durable step

Writing the ask, opening the thread, and recording assignee plus thread id happen
in one step. Splitting them risks a retry that opens a second thread for the same
task; as one step, a retry replays the whole dispatch or none of it.

### Step ids are derived from the task

A task's id is unique per run, so step ids derived from it stay stable across
replays. This matters once escalation adds a step per level.

### An empty roster fails the run rather than dispatching

There is no sensible default assignee. Failing loudly in the dev UI is better
than a task addressed to nobody, and it surfaces an unseeded database
immediately.

### The reply is stored, not returned

Nothing is waiting on the workflow's return value — the TUI polls the task
record. The run's job ends when it has written the reply.

## Risks / Trade-offs

- **A completion signal for a task nobody is waiting on is dropped.** → Acceptable:
  it can only happen after the task is already completed, which is suppressed
  upstream in the bridge.
- **A run outliving the dev server restart.** → Inngest resumes it; the wait is
  the durable part.
- **Demo insurance firing on camera.** → It is off unless its delay is configured,
  and the proposal treats that as the on-camera default.

## Open Questions

- Whether a run should ever give up. Currently it waits indefinitely at the top
  of the ladder, which is funnier and is less code; a terminal abandoned state
  can be added without changing the wait.
