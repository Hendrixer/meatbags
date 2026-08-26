## Context

See `proposal.md` — Why. `src/discord/{client,routing,tasks}.ts` survived the
teardown. `routing.ts` already classifies a thread message as a *thread reply*
carrying a thread id, and both branches of the handler in `client.ts` are `TODO`
stubs awaiting the persistence layer.

## Goals / Non-Goals

**Goals:**

- A reply in a task thread reliably resumes exactly the run that is waiting on it.
- Nothing else ever emits a completion.

**Non-Goals:**

- Reading, parsing, or judging what the human wrote.
- Slash commands, buttons, or any richer interaction. A message is the interface.

## Decisions

### Classification stays pure; resolution happens in the handler

`classifyMessage` takes a plain message shape and returns a routing decision with
no I/O, so the rules are testable without a gateway connection. It can only know
the thread id. Turning that into a task id is a database read and belongs in the
handler.

### The thread → task lookup is the correlation mechanism

`thread_id` is unique and null until dispatch, so a pending task matches nothing
and a thread matches at most one task. A message in a thread with no matching
task emits nothing rather than guessing.

### Completion is suppressed in three cases, not one

The bot's own messages (it posts the ask and every nag into the same thread),
messages outside task threads, and threads whose task is already completed. The
third matters because a conversation usually continues after the reply that
completed the task, and a second signal would resume nothing while looking like
it should.

## Risks / Trade-offs

- **A broken inbound leg fails silently** — runs simply never resume and every
  poll reports the same status forever. → Verify this before anything downstream;
  the demo-insurance auto-reply is the on-camera fallback.
- **Message Content and Server Members are privileged intents.** → They must be
  enabled on the application or the handler receives empty content.
- **A human edits their reply after the fact.** → Ignored. First reply wins.

## Open Questions

- Whether the general-channel upsert should record skills, or only names. Names
  are enough for assignment to function; skills currently come from the seed.
