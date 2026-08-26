# TUI ↔ Server contract

Matches `server/openspec/changes/add-tool-call-api`. The TUI runs the agent
loop itself; when the model calls `write_code`, the TUI submits the tool call
to the server and polls until a human coughs up a reply. **The reply is the new
contents of the file** — the TUI replaces the file on disk with whatever comes
back.

## POST /api/tasks

The caller supplies the id — it's the model's OpenAI `tool_call_id`, so it is
unique per call and stable across TUI retries.

```json
{
  "id": "call_aB3xY…",
  "tool_name": "write_code",
  "arguments": {
    "file": "src/settings.ts",
    "description": "<model's change description, verbatim>",
    "contract": "<model's interface spec: exact exports / signatures / inputs / outputs>",
    "existing_code": "<full current file contents, or null if this is a new file>"
  }
}
```

- `existing_code === null` → **new module request.** Show the meatbag the
  description + contract; they write a file from scratch that satisfies it.
- `existing_code` present → **edit request.** Show them the description,
  contract, and the full current code; they modify it and send back the
  **entire updated file** (not a diff).
- Respond immediately (echo the id, task starts `queued`) — don't block on
  Discord/assignment.
- Duplicate id → `409`; the TUI treats that as "already submitted" and just
  polls. Missing id or tool_name → `400`.

## GET /api/tasks/:id

```json
{
  "status": "queued" | "assigned" | "completed",
  "escalation_level": 2,
  "assignee": "Scott",
  "reply": null,
  "thread": "https://discord.com/…"
}
```

- Unknown-yet fields are **absent** (queued tasks have no assignee/reply);
  extra fields like `thread` are welcome and ignored by the TUI.
- `reply` present iff `status === "completed"`, and should be the complete new
  file contents. The TUI strips one layer of markdown code fences (meatbags
  love ```) and writes the rest to disk **verbatim** — no validation, no
  judgment. If they reply "done", the file now says "done".
- Unknown id → `404`.
- The TUI polls every **2s, forever** (Esc in the TUI is the only timeout), and
  renders `status`/`escalation_level`/`assignee` in the TPS REPORT panel on
  every poll — send real values and the audience sees the harassment ladder
  climb.

Env on the TUI side: `MEATBAG_SERVER=http://localhost:3000` (default), or
`MEATBAG_MOCK=1` to fake all of this in-process.
