## 1. Supervisor voice

- [ ] 1.1 Add a Foundry client wrapper in `src/supervisor/` exposing a single completion call reading the existing `FOUNDRY_*` config; verify one completion returns text against the configured deployment.
- [ ] 1.2 Write the supervisor prompt — overbearing manager, given a tool name, its arguments, and the roster, returning an assignee id and an ask; verify a `write_code`-shaped call yields prose naming the file and the described change rather than serialized arguments.
- [ ] 1.3 Implement `writeAsk(toolName, args, roster)` returning `{ assigneeId, ask }` from that one call; verify the returned assignee id belongs to a roster member and the ask is non-empty.
- [ ] 1.4 Validate the model's choice against the roster, substituting a deterministic member when it names somebody unknown; verify a response naming a non-member still yields a real assignee.
- [ ] 1.5 Add the deterministic fallback for missing configuration, errors, and timeouts — a plain ask derived from the tool name and arguments; verify that with Foundry unconfigured the call still returns a usable ask and a real assignee rather than throwing.
- [ ] 1.6 Verify an unfamiliar tool name still produces an actionable ask.
