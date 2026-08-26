## Why

Discord is where the work actually happens. The outbound half — opening a thread
per task and nagging into it — survived the teardown but is decoupled from
storage. The inbound half does not work at all: it is currently stubbed, because
it used to emit a completion carrying the thread id as the task id, which was
correct when those were the same value and is wrong now.

Until the inbound leg works, every workflow run waits forever and every poll
reports the same status.

## What Changes

- A dispatched task gets its own thread in the tasks channel, mentioning the
  assignee and carrying the ask.
- A reply in a task thread resolves the thread to its task and emits the
  completion signal carrying that task's id and the reply text.
- Replies that must not complete anything are suppressed: the bot's own messages,
  messages outside task threads, and threads whose task is already completed.
- Anyone who speaks in the general channel is upserted into the roster.
- Nagging helpers for a follow-up in the thread and a public mention outside it.

## Capabilities

### New Capabilities

- `discord-bridge`: The two-way link to Discord — pushing a task out to a human
  in a thread of its own, and turning their reply into the signal that completes
  the task.

### Modified Capabilities

None — no specs exist yet.

## Impact

- **Modified**: `src/discord/client.ts` (both message-handler branches are
  currently `TODO` stubs), `src/discord/tasks.ts`, `src/discord/routing.ts`
  (already renamed to classify a *thread reply* rather than a task completion).
- **Depends on**: `add-persistence-layer` for the thread → task lookup and the
  roster upsert.
- **Consumed by**: `add-tool-call-workflow` (dispatch) and
  `add-escalation-ladder` (nagging).
- **Risk**: this is the highest-consequence piece in the rebuild. A broken
  inbound leg is silent — runs simply never resume.
