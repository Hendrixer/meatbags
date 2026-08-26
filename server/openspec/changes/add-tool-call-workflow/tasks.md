## 1. The workflow

- [x] 1.1 Create the `human-tool-call` Inngest function triggered by `tool/call.requested`, reading the task by the event's `taskId`; verify sending the event starts exactly one run in the dev UI and the run logs the tool name read off the row.
- [ ] 1.2 Implement the dispatch step as one durable step — `writeAsk` → `createTaskThread` → `dispatchTask`; verify a run produces a visible Discord thread mentioning the assignee and moves the task to `assigned` with both `thread_id` and `assigned_at` set.
- [ ] 1.3 Verify a retried dispatch does not open a second thread for the same task.
- [x] 1.4 Fail the run rather than dispatching when the roster is empty; verify a run against an empty roster errors in the dev UI and creates no thread.
- [x] 1.5 Implement the wait — `step.waitForEvent("human/task.completed")` matched on this task's id — then `completeTask` with the reply; verify a reply in the thread resumes the run and stores the text verbatim.
- [x] 1.6 Verify isolation: with three tool calls outstanding, a reply to one resumes only that run and leaves the other two suspended.
- [x] 1.7 Register `human-tool-call` in the exported `functions` array alongside the existing `bobs` stub; verify both appear in the dev UI and `tsc --noEmit` passes.

## 2. Demo insurance

- [x] 2.1 Add the flagged auto-reply that answers an unanswered task after `CONTRACTOR_AUTOREPLY_MS`; verify a task self-completes with the flag set.
- [x] 2.2 Verify nothing auto-replies when the flag is unset.
