## 1. Routes

- [ ] 1.1 Implement `POST /api/tasks` — validate the id and tool name, store the arguments object as sent, derive the description, insert the task, send `tool/call.requested`, and respond echoing the id; verify the task exists as `queued` immediately afterwards.
- [ ] 1.2 Verify submission performs no external I/O — the response returns well under a second with Discord and Foundry unreachable.
- [ ] 1.3 Reject a body missing its id or tool name with 400; verify no row is written in either case.
- [ ] 1.4 Return 409 for a resubmitted id; verify the existing task is byte-for-byte untouched, including when it is already `assigned` or `completed`.
- [ ] 1.5 Preserve the arguments as sent, with an explicitly empty current-contents value recorded as "file does not exist yet"; verify a submitted object reads back unchanged, including a multi-kilobyte file body.
- [ ] 1.6 Implement `GET /api/tasks/:id` returning status, escalation level, assignee, and reply; verify a queued task omits assignee and reply, and an assigned task reports both assignee and level.
- [ ] 1.7 Verify the reply is present exactly when status is `completed` and returns the human's text byte-identical, and that an unknown id returns 404.
- [ ] 1.8 Include the Discord thread URL once a thread exists, derived from the guild and thread ids; verify it is absent while queued and present once assigned.

## 2. Process wiring

- [ ] 2.1 Mount both routes alongside the Inngest serve handler and start the Discord bot in the same process; verify `npm run dev` logs both the server and the bot ready, and `GET /api/inngest` reports dev mode with both functions registered.

## 3. End-to-end against the real TUI

- [ ] 3.1 Happy path: run Brian's TUI with `MEATBAG_SERVER` pointed here, prompt it so the model calls `write_code` → a Discord thread appears with the ask → the dev UI shows the run parked on `waitForEvent` → a human replies with file contents → the TUI writes them to disk. Verify the task row moves `queued` → `assigned` → `completed`.
- [ ] 3.2 Escalation path: ignore a task; verify the TUI's TPS panel shows the escalation level climbing and the assignee, and a public `@mention` appears at level 2.
- [ ] 3.3 Verify a reply wrapped in markdown fences arrives such that the TUI's fence-stripping yields the intended file contents.
- [ ] 3.4 Leaderboard: run the roster query in the VS Code PostgreSQL extension; verify completed counts and response times reflect the run and that response time excludes queued time.
