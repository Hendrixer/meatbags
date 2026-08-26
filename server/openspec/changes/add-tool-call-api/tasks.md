## 1. Routes

- [ ] 1.1 Implement `POST /api/tool-calls` — validate the call id and tool name, derive the description, insert the task, send `tool/call.requested`, respond 202 echoing the call id; verify the task exists as `queued` immediately afterwards.
- [ ] 1.2 Verify submission performs no external I/O — the response returns well under a second with Discord and Foundry unreachable.
- [ ] 1.3 Reject malformed submissions; verify a body missing `tool_name` or a call id returns 400 and writes no row.
- [ ] 1.4 Reject duplicate call ids; verify a repeated id returns 409 and leaves the existing task untouched.
- [ ] 1.5 Implement `GET /api/tool-calls/:id` returning status, reply, escalation level, assignee name, and the derived Discord thread URL; verify a queued task omits assignee, thread, and reply, and an assigned task includes assignee, level, and thread.
- [ ] 1.6 Verify a completed task returns the human's reply byte-identical, and an unknown call id returns 404.

## 2. Process wiring

- [ ] 2.1 Mount both routes alongside the Inngest serve handler and start the Discord bot in the same process; verify `npm run dev` logs both the server and the bot ready, and `GET /api/inngest` reports dev mode with both functions registered.

## 3. End-to-end

- [ ] 3.1 Happy path: submit a `write_code` tool call → a Discord thread appears with the supervisor's ask → the dev UI shows the run parked on `waitForEvent` → a human replies with nonsense → the poll route returns that nonsense as the result. Verify the task row moves `queued` → `assigned` → `completed`.
- [ ] 3.2 Escalation path: submit a tool call and ignore it; verify the poll route reports a rising escalation level, a public `@mention` appears at level 2, and the run is still waiting.
- [ ] 3.3 Concurrency: submit three tool calls at once; verify three threads, three parked runs, and that answering one completes only that task.
- [ ] 3.4 Leaderboard: run the roster query in the VS Code PostgreSQL extension; verify completed counts and response times reflect the run and that response time excludes queued time.
