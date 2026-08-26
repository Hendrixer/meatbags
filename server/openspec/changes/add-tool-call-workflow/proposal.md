## Why

A human takes minutes to answer, or hours, or never. Something has to hold the
tool call open across that gap without a process sitting on it, survive restarts,
and resume exactly where it left off when the reply lands. That is the durable
unit of work behind every tool call, and it is the piece the demo shows on
screen: a run parked, waiting, per human currently ignoring us.

## What Changes

- One durable workflow run per submitted tool call, started when the call is
  accepted, independent of every other outstanding run.
- A dispatch step that picks a human, writes the ask, opens their thread, and
  records the assignee and thread against the task.
- A wait that suspends on the completion signal for that specific task and
  consumes no compute in the meantime.
- Whatever the human replies becomes the tool call's result verbatim — no
  validation, no parsing, no attempt to apply it to anything.
- An off-by-default auto-reply so a demonstration completes without a live human.

## Capabilities

### New Capabilities

- `human-tool-call`: The durable workflow backing one tool call — assign,
  dispatch, wait, complete.

### Modified Capabilities

None — no specs exist yet.

## Impact

- **New**: the workflow function in `src/inngest/`, registered alongside the
  existing `bobs` stub.
- **Depends on**: `add-persistence-layer` (task lifecycle),
  `add-supervisor-voice` (ask and assignee), `add-discord-bridge` (thread
  creation, and the inbound signal that resumes the wait).
- **Extended by**: `add-escalation-ladder`, which wraps the wait.
- **Constraint**: Inngest is mandatory for the durable wait.
