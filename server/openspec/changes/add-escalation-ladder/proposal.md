## Why

A human who is ignoring a task needs to be made progressively less comfortable
about it. Escalation is not an error path here — it is the point of the product,
and the thing an audience watches happen. A task that simply waits quietly is not
worth demonstrating.

## What Changes

- Each stretch of silence raises the task's escalation level, performs that
  level's nag, and resumes waiting on the same human.
- Four levels ordered by invasiveness: the task's own thread, public exposure in
  the shared channel, a direct written warning, then the same with leadership
  copied in.
- Levels whose nag channel is not yet wired still raise and record the level and
  resume waiting, rather than stalling at the last actionable level or failing
  the run.
- The ladder caps at its top level and keeps waiting indefinitely — it never
  abandons a task.
- The current level is persisted, so anyone polling the task can watch it climb.

## Capabilities

### New Capabilities

- `escalation`: The pressure applied to a human who has not answered — how
  silence raises a level, what each level does, and where the ladder stops.

### Modified Capabilities

None — no specs exist yet.

## Impact

- **Modified**: the wait in `add-tool-call-workflow`, which this wraps.
- **Depends on**: `add-tool-call-workflow` (the wait) and `add-discord-bridge`
  (in-thread nag, public mention).
- **Deferred, not cut**: ElevenLabs voicemail at level 1 and Resend email at
  levels 3–4 remain part of the intended ladder. `src/services/` keeps both
  wrappers. Until they are specced, those rungs are the no-op case above — the
  ladder keeps its shape and the services drop in later without restructuring.
