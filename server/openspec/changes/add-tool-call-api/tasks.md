## 1. Routes

- [ ] 1.1 Implement `POST /api/tasks` — validate the tool name, mint an opaque id, map the flat body into the task's stored arguments, derive the description, insert the task, send `tool/call.requested`, and respond with `{ taskId }`; verify the task exists as `pending` immediately afterwards.
- [ ] 1.2 Verify two identical submissions produce two distinct tasks with distinct ids.
- [ ] 1.3 Verify submission performs no external I/O — the response returns well under a second with Discord and Foundry unreachable.
- [ ] 1.4 Reject a body with no tool name as a bad request; verify no row is written.
- [ ] 1.5 Preserve `file`, `description`, `contract`, and `existing_code` as submitted, with a null `existing_code` recorded as "file does not exist yet"; verify a submitted body reads back unchanged, including a multi-kilobyte `existing_code`.
- [ ] 1.6 Implement `GET /api/tasks/:taskId` returning `taskId`, `status`, `escalation_level`, `assignee`, and `reply`; verify a pending task reports null assignee and null reply, and an assigned task reports both assignee and level.
- [ ] 1.7 Verify `reply` is non-null exactly when `status` is `completed`, returns the human's text byte-identical, and that an unknown id returns 404.

## 2. Process wiring

- [ ] 2.1 Mount both routes alongside the Inngest serve handler and start the Discord bot in the same process; verify `npm run dev` logs both the server and the bot ready, and `GET /api/inngest` reports dev mode with both functions registered.

## 3. End-to-end against the real TUI

- [ ] 3.1 Happy path: run Brian's TUI with `MEATBAG_SERVER` pointed here, prompt it so the model calls `write_code` → a Discord thread appears with the ask → the dev UI shows the run parked on `waitForEvent` → a human replies with file contents → the TUI writes them to disk. Verify the task row moves `pending` → `assigned` → `completed`.
- [ ] 3.2 Escalation path: ignore a task; verify the TUI's TPS panel shows the escalation level climbing and the assignee, and a public `@mention` appears at level 2.
- [ ] 3.3 Verify a reply wrapped in markdown fences arrives at the TUI such that its fence-stripping yields the intended file contents.
- [ ] 3.4 Leaderboard: run the roster query in the VS Code PostgreSQL extension; verify completed counts and response times reflect the run and that response time excludes pending time.
