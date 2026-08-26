## 1. Dependencies & schema

- [x] 1.1 Add `drizzle-orm` and `drizzle-kit` to `package.json`, keeping `pg` as the driver; verify `npm install` succeeds and `import('drizzle-orm/node-postgres')` resolves.
- [x] 1.2 Add `drizzle.config.ts` pointed at `HORIZON_URL` with the SSL settings Azure requires; verify `npx drizzle-kit push` connects to Horizon without a TLS error.
- [x] 1.3 Write `src/db/schema.ts` defining `agents`, `tasks`, and `reviews` — `tasks.id` as the caller's tool call id, `thread_id` unique and nullable, `args` as jsonb, `status` as a constrained text column, and `created_at`/`assigned_at` as separate columns; verify `tsc --noEmit` passes and the inferred row types expose every column.
- [x] 1.4 Push the schema, dropping the old `tasks` if present; verify all three tables appear in the VS Code PostgreSQL extension with the expected columns and that `thread_id` carries a unique constraint.

## 2. Data access

- [x] 2.1 Replace `src/db/client.ts` with a Drizzle instance over a lazily-built `pg` Pool; verify importing the module with `HORIZON_URL` unset does not throw, and that a `SELECT 1` round-trips when it is set.
- [ ] 2.2 Implement `createTask` (submit-time insert: id, tool name, args, description, status `queued`) and `getTask` (left-joined to `agents` so an unassigned task still returns); verify a script inserts a task and reads every field back unchanged with a null assignee.
- [ ] 2.3 Implement `dispatchTask(id, { agentId, threadId })` setting `assigned_at` and status `assigned`, and `findTaskByThread(threadId)`; verify dispatching a queued task then looking it up by thread id returns the same row, and that an unknown thread id returns nothing.
- [ ] 2.4 Implement `completeTask(id, reply)` storing the reply verbatim with `completed_at` and status `completed`, and crediting the assignee's completed-task count; verify a reply containing newlines, quotes, and emoji round-trips byte-identical and the agent's count increments by exactly one.
- [ ] 2.5 Implement `bumpEscalation(id)` returning the new level, plus `upsertAgent` and `readRoster`; verify bumping twice yields 2 then 3, and that upserting an existing agent leaves their accumulated stats untouched.
- [ ] 2.6 Write `src/db/seed.ts` pre-registering the roster with skill tags and restore the `db:seed` script; verify running it twice populates the roster once and leaves stats unchanged on the second run.
- [ ] 2.7 Implement the response-time recompute over completed tasks, measuring from `assigned_at`; verify a task dispatched and completed a known interval apart yields that interval, unaffected by how long it sat queued.
