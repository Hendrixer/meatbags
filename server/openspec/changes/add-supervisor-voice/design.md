## Context

See `proposal.md` — Why. The Azure AI Foundry SDK and its `FOUNDRY_*` keys are
already present; `src/foundry/` was deleted in the teardown. This is the only
model call left on this server — the agent loop belongs to the TUI.

## Goals / Non-Goals

**Goals:**

- A readable ask and a real assignee from one round-trip.
- Never fail a tool call because the model was unavailable or strange.

**Non-Goals:**

- Conversation state, tool schemas, or anything resembling an agent loop.
- Routing rules, skill matching, or load balancing beyond the model's own choice.

## Decisions

### One call returns both the assignee and the ask

The call has to see the tool arguments to write the ask and the roster to pick a
human. Asking for `{ assigneeId, ask }` from a single completion halves dispatch
latency versus two calls and keeps "the model picked its own meatbag" true.

- *Alternative — deterministic assignment, model writes only the ask.* One fewer
  thing to go wrong, but the call is happening anyway, so the marginal cost of
  including the pick is zero. It remains the fallback path.

### The chosen assignee is validated against the roster, not trusted

A model asked for an id will occasionally invent one, return a name, or wrap it
in prose. The returned id is matched against roster members; anything unmatched
falls back to a deterministic member rather than erroring.

### Failure is always a fallback, never an exception

Missing configuration, a network error, a timeout, and an unusable response all
take the same path: a deterministic ask derived from the tool name and arguments,
and a deterministic assignee. Dispatch must not be able to fail here.

### The ask carries the payload, not just the instruction

`tui/CONTRACT.md` applies the reply to disk verbatim, so the ask is not merely
flavour — it is the whole brief. It has to include the interface the result must
satisfy and, for an edit, the file's current contents, and it has to say plainly
that the answer is the entire file. Tone is free; those elements are not.

This makes asks long. Discord's message limit is a real constraint once
`existing_code` is a full source file, so the code block may need to ride as an
attachment rather than inline.

## Risks / Trade-offs

- **Latency sits between submit and `assigned`.** → It runs inside the workflow,
  so the TUI just sees `queued` for an extra poll or two.
- **The model writes something less funny than a hand-written line.** → Accepted;
  the fallback text is the floor, not the ceiling.
- **A prompt that leaks the mechanics into the ask.** → The ask is read by humans
  in Discord who already know they are the ones doing the work, so there is
  nothing to protect here. The mundane tool surface lives in the TUI.
- **A funny ask that nobody can answer correctly.** → The reply is applied to
  disk unreviewed, so an ask that reads well but omits the current code or the
  required interface produces a broken file. The required elements are specified;
  the voice wraps them.
- **An ask longer than Discord allows.** → Post the code as an attachment when it
  would overflow.

## Open Questions

- Whether the same call should also write the escalation nags, or whether those
  stay canned. Canned lines are demo-safe; this can change without touching the
  interface.
