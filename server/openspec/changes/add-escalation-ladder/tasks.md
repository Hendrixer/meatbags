## 1. The ladder

- [ ] 1.1 Wrap the wait in the escalation loop — on timeout, `bumpEscalation`, perform that level's nag, then wait again on the same task; verify a task left unanswered climbs 1 → 2 and the run is still suspended afterwards.
- [ ] 1.2 Verify a reply arriving before the interval elapses performs no nag and leaves the escalation level unchanged.
- [ ] 1.3 Key each level's nag as its own step by task and level; verify a replayed run does not nag twice for the same level.

## 2. Levels

- [ ] 2.1 Implement the level 2 nag as a public `@mention` in `#tasks` outside the thread; verify the mention appears in the channel and not in the task's thread.
- [ ] 2.2 Make levels whose nag channel is unavailable a no-op that still raises and records the level; verify a task climbs past 2 to 3 and 4 without erroring while ElevenLabs and Resend are unwired.
- [ ] 2.3 Cap the ladder at level 4 and keep waiting; verify a task at level 4 does not rise further across two more intervals and the run remains suspended.
- [ ] 2.4 Verify the current level is persisted and readable from outside the run at each step of the climb.
- [ ] 2.5 Settle the wait interval against a full end-to-end run and record the chosen value; verify the ladder reaches level 2 within a three-minute demo.
