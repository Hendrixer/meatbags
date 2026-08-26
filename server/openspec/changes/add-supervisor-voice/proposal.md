## Why

A task arrives as a name and a bag of arguments. Posting that into Discord gets
it ignored — nobody reads serialized JSON, and the whole conceit of the product
is that an insufferable supervisor is assigning work to people. Something has to
turn the raw task into a request a human will act on, and pick which human is
stuck with it.

It also has to be answerable. The TUI writes whatever comes back straight into
the file, so an ask that reads well but invites "yeah done" produces a source
file containing the words "yeah done".

## What Changes

- A single model call takes the tool call and the current roster and returns both
  the assignee and the ask, rather than making two round-trips.
- The ask is written in the voice of an overbearing supervisor, refers to the
  call's actual arguments, and never presents raw serialized arguments.
- Assignment has no routing rules beyond that choice — the model sees names,
  skills, and stats, and picks.
- The ask states what the answer must look like. Per `tui/CONTRACT.md` the reply
  is written to disk as the new file contents, so the ask must carry the
  interface to satisfy and the file's current code, and must demand the whole
  file back rather than a description or a "done".
- A deterministic fallback covers a missing configuration, a failed call, or a
  chosen assignee who is not in the roster, so generation can never fail a tool
  call.

## Capabilities

### New Capabilities

- `supervisor-voice`: Turning a raw tool call into a human-readable ask addressed
  to a chosen member of the roster, with a fallback that never blocks dispatch.

### Modified Capabilities

None — no specs exist yet.

## Impact

- **New**: `src/supervisor/`.
- **Dependencies**: uses the Azure AI Foundry SDK already in `package.json` and
  the `FOUNDRY_*` keys already in `.env.example`. No new dependencies.
- **Depends on**: `add-persistence-layer` for the roster.
- **Consumed by**: `add-tool-call-workflow`, in its dispatch step.
