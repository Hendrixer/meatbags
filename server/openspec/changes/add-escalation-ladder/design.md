## Context

See `proposal.md` — Why. This wraps the wait defined in `add-tool-call-workflow`.
ElevenLabs and Resend wrappers exist in `src/services/` but their requirements
are not specced yet, so two of the four rungs have no channel today.

## Goals / Non-Goals

**Goals:**

- Silence has visible, escalating consequences.
- The ladder keeps its intended four-level shape while two rungs are unwired.

**Non-Goals:**

- Giving up on a task.
- Per-person or per-tool escalation policies. One ladder for everything.

## Decisions

### Timeout is a normal outcome of the wait, not an error

Each level waits for a completion signal with a timeout. A timeout raises the
level, performs that level's nag, and waits again on the same task. Nothing about
this path is exceptional, so nothing about it should fail a run.

### An unavailable rung is a no-op that still escalates

With voicemail and email deferred, levels 1 and 3–4 lose their channels. Rather
than re-tiering the ladder into something that has to be undone when those
services land, a missing channel simply performs no nag — the level still rises,
is still recorded, and the wait resumes. The shape survives; the services drop in
later without restructuring.

- *Alternative — collapse to a two-level Discord-only ladder now.* Rejected: it
  is work that gets reverted, and it loses the level numbers the poll route
  already reports.

### The ladder caps but never abandons

At the top level the system keeps waiting indefinitely rather than escalating
further. There is nowhere left to go, and abandoning a task would mean the TUI
never gets a result at all.

### The level is persisted, not just held in the run

The poll route reports it, so it has to be readable from outside the workflow.
It is also the most visible sign of progress while nothing else is happening.

## Risks / Trade-offs

- **A short interval makes the ladder look frantic; a long one makes the demo
  stall.** → It is a single constant, tuned during the end-to-end run.
- **Public shaming lands badly with a real person.** → Everyone in the demo
  server has opted into the joke.
- **Escalation steps replaying on retry could double-nag.** → Each level's nag is
  its own step keyed by task and level, so a replay is idempotent.

## Open Questions

- The wait interval per level. The deleted implementation used two minutes;
  shorter reads better in a three-minute demo. Changes no specified behavior.
