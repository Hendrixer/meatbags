## 1. Outbound

- [x] 1.1 Point `createTaskThread` at the roster row type from the persistence layer, replacing the local `Assignee` placeholder; verify `tsc --noEmit` passes and the thread's first message mentions the assignee.
- [x] 1.2 Verify `nagInThread` posts a follow-up inside an existing task thread, and `publicMention` posts in the tasks channel outside the thread.

## 2. Inbound

- [x] 2.1 Replace the `TODO` stub in the message handler: resolve `routed.threadId` via `findTaskByThread`, and send `human/task.completed` with that task's id and the reply text; verify replying in a task thread emits the event in the Inngest dev UI carrying the exact message text and the task's id, not the thread id.
- [x] 2.2 Suppress messages authored by the bot itself; verify posting the ask and a nag into a thread emits no event.
- [x] 2.3 Suppress messages outside task threads and threads with no matching task; verify neither emits an event.
- [x] 2.4 Suppress replies in threads whose task is already `completed`; verify a second reply emits nothing.
- [x] 2.5 Replace the `TODO` stub upserting anyone who posts in `#general` into `agents`; verify a new speaker creates exactly one row and a repeat speaker creates none.
