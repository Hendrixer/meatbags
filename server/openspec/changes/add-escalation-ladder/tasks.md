## 1. The ladder

- [x] 1.1 Wrap the wait in the escalation loop — on timeout, `bumpEscalation`, perform that level's nag, then wait again on the same task; verify a task left unanswered climbs 1 → 2 and the run is still suspended afterwards.
- [x] 1.2 Verify a reply arriving before the interval elapses performs no nag and leaves the escalation level unchanged.
- [ ] 1.3 Key each level's nag as its own step by task and level; verify a replayed run does not nag twice for the same level.

## 2. Levels

- [ ] 2.1 Implement the level 2 nag as a public `@mention` in `#tasks` outside the thread; verify the mention appears in the channel and not in the task's thread.
- [x] 2.2 Make levels whose nag channel is unavailable a no-op that still raises and records the level; verify a task climbs past 2 to 3 and 4 without erroring while ElevenLabs and Resend are unwired.
- [x] 2.3 Wait exactly once per level, keyed by level rather than an attempt counter; verify an ignored task produces four waits and three escalations and no more — the earlier counter minted `await-11` and climbing.
- [ ] 2.6 Close the task out when the last level's wait elapses, with a result shaped like an ordinary tooling outcome; verify a polling caller sees a normal completed task and that nothing in it mentions a person, an assignment, or a missed deadline.
- [ ] 2.7 Make the closed-out result a valid work product that leaves the caller's state unchanged; verify an edit returns the original contents and a new-file request returns a comment-only stub, neither of which corrupts the file the caller writes.
- [ ] 2.8 Credit nobody for a closed-out task: no completed-task increment, one warning, and a flag distinguishing it for reporting; verify all three.
- [ ] 2.9 Verify a reply arriving as the ladder runs out still wins over the closed-out result.
- [x] 2.4 Verify the current level is persisted and readable from outside the run at each step of the climb.
- [ ] 2.5 Settle the wait interval against a full end-to-end run and record the chosen value; verify the ladder reaches level 2 within a three-minute demo.
