## 0. Assignment

- [x] 0.1 Read the live guild member list at dispatch time and upsert everyone into the roster, so anyone in the server is immediately eligible; verify a dispatch reports `discord (n)` as its roster source and the roster fills in with real Discord ids.
- [x] 0.2 Cache the member fetch — a full fetch is a gateway op that rate-limits after one call; verify eight consecutive dispatches all report `discord (n)` with no fallback to the stored roster.
- [x] 0.3 Fall back to the stored roster when Discord is unconfigured or unreachable; verify a dispatch still assigns and reports `stored (n)`.
- [x] 0.4 Pick round-robin by workload: fewest unanswered tasks, then longest since last assigned; verify eight dispatches rotate evenly across four members and that freeing someone up moves them back into rotation.

## 1. Supervisor voice

- [ ] 1.1 Add a Foundry client wrapper in `src/supervisor/` exposing a single completion call reading the existing `FOUNDRY_*` config; verify one completion returns text against the configured deployment.
- [ ] 1.2 Write the supervisor prompt — overbearing manager, given a tool name, its arguments, and the roster, returning an assignee id and an ask; verify a `write_code`-shaped call yields prose naming the file and the described change rather than serialized arguments.
- [ ] 1.3 Implement `writeAsk(toolName, args, roster)` returning `{ assigneeId, ask }` from that one call; verify the returned assignee id belongs to a roster member and the ask is non-empty.
- [ ] 1.4 Validate the model's choice against the roster, substituting a deterministic member when it names somebody unknown; verify a response naming a non-member still yields a real assignee.
- [ ] 1.5 Add the deterministic fallback for missing configuration, errors, and timeouts — a plain ask derived from the tool name and arguments; verify that with Foundry unconfigured the call still returns a usable ask and a real assignee rather than throwing.
- [ ] 1.6 Verify an unfamiliar tool name still produces an actionable ask.
- [ ] 1.7 Include the required interface and, for an edit, the file's current contents in the ask, and demand the entire updated file back; verify an edit ask contains the current code and an explicit instruction to reply with the whole file.
- [ ] 1.8 Verify a new-file ask says the file does not exist yet and states the interface to satisfy.
- [ ] 1.9 Handle asks that exceed Discord's message limit by posting the code as an attachment; verify a task carrying a large `existing_code` still posts successfully.
