# TUI ↔ Server contract (hand to Scott)

The TUI runs the agent loop itself. When the model calls `write_code`, the TUI
hands the task to your half over HTTP and polls until a human coughs up a reply.
**The reply is the new contents of the file** — the TUI replaces the file on
disk with whatever comes back.

## POST /api/tasks

Request body:

```json
{
  "tool_name": "write_code",
  "file": "src/settings.ts",
  "description": "<model's change description, verbatim>",
  "contract": "<model's interface spec: exact exports / signatures / inputs / outputs>",
  "existing_code": "<full current file contents, or null if this is a new file>"
}
```

- `existing_code === null` → **new module request.** Show the meatbag the
  description + contract; they write a file from scratch that satisfies it.
- `existing_code` present → **edit request.** Show them the description,
  contract, and the full current code; they modify it and send back the
  **entire updated file** (not a diff).

Response `201` (or `200`):

```json
{ "taskId": "<opaque string>" }
```

Recommendation: generate your own taskId (don't await Discord thread creation to
respond — store `thread_id` as a column instead). But if you keep `id = thread.id`,
the TUI doesn't care; taskId is opaque to it.

## GET /api/tasks/:taskId

Response `200`:

```json
{
  "taskId": "8842",
  "status": "pending" | "assigned" | "completed",
  "escalation_level": 1,
  "assignee": "Scott",
  "reply": null
}
```

- `reply` must be non-null iff `status === "completed"`, and should be the
  complete new file contents. The TUI strips one layer of markdown code fences
  (meatbags love ```) and writes the rest to disk **verbatim** — no validation,
  no judgment. If they reply "done", the file now says "done".
- Extra fields are welcome and ignored.
- The TUI polls every **2s, forever** (Esc in the TUI is the only timeout).
- `status`/`escalation_level`/`assignee` are rendered live in the TPS REPORT
  panel on every poll — send real values and the audience sees the harassment
  ladder climb.

Env on the TUI side: `MEATBAG_SERVER=http://localhost:3000` (default), or
`MEATBAG_MOCK=1` to fake all of this in-process.
