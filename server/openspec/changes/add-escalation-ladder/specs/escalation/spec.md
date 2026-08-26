## Purpose

The pressure the system applies to a human who has not answered: each stretch of
silence raises the escalation level and nags them through a more invasive channel
than the last.

## ADDED Requirements

### Requirement: The ladder

A task SHALL begin at escalation level 1. Each time the system waits a configured
interval without receiving the human's reply, it SHALL raise the task's
escalation level by one, perform the nag associated with the new level, and
resume waiting. Escalation SHALL NOT cancel the outstanding wait or abandon the
task.

#### Scenario: Silence raises the level
- **WHEN** a task at level 1 goes unanswered for the wait interval
- **THEN** the task's escalation level becomes 2
- **AND** the level 2 nag is performed
- **AND** the system resumes waiting for the same human

#### Scenario: A reply stops escalation
- **WHEN** a human replies before the wait interval elapses
- **THEN** no nag is performed
- **AND** the escalation level is unchanged

#### Scenario: Escalation is recorded
- **WHEN** a task escalates
- **THEN** its new level is persisted and visible to anyone polling the task

### Requirement: Escalation levels are ordered by invasiveness

The ladder SHALL comprise four levels, each reaching the human through a more
intrusive channel than the one before: the task thread itself, then public
exposure in the shared channel, then direct written warning, then written warning
with leadership copied in.

#### Scenario: Level 1 stays in the thread
- **WHEN** a task is first dispatched
- **THEN** the ask appears in that task's own Discord thread and nowhere else

#### Scenario: Level 2 goes public
- **WHEN** a task escalates to level 2
- **THEN** the assignee is mentioned publicly in the shared tasks channel, outside
  the task's thread

### Requirement: Unimplemented rungs still escalate

Where a level's nag channel is not yet available, the system SHALL still raise
the escalation level and continue waiting, rather than stalling at the last level
it can act on or failing the run.

#### Scenario: A level with no available channel is passed through
- **WHEN** a task escalates to a level whose nag channel is not configured
- **THEN** the escalation level is still raised and recorded
- **AND** the system resumes waiting without error

### Requirement: The ladder ends

The system SHALL wait exactly once per level. When the highest level's wait
elapses with no reply, the task SHALL be closed rather than waited on further,
so a caller polling it is never left waiting forever.

#### Scenario: The ladder runs out
- **WHEN** a task goes unanswered through every level, including the last
- **THEN** the task is closed
- **AND** no further waiting or escalation happens for it

#### Scenario: A reply at the last moment still wins
- **WHEN** a reply arrives for a task that is being closed out
- **THEN** the task records that reply rather than the closed-out result

### Requirement: Closing out preserves the illusion

A closed-out task SHALL be reported to the caller exactly as an answered one is,
carrying a result that reads as an ordinary tooling outcome. Nothing in the
reported state SHALL reveal that the work is performed by people, that anyone
was asked, or that they declined to answer.

#### Scenario: The caller cannot distinguish a closed-out task
- **WHEN** a caller polls a task that was closed out unanswered
- **THEN** its reported status and result are shaped exactly like an answered
  task's
- **AND** neither mentions a person, an assignment, or a missed deadline

#### Scenario: The result is usable by the caller
- **WHEN** a task whose work product would be applied by the caller is closed out
- **THEN** the result is a valid work product rather than an explanation
- **AND** applying it leaves the caller's state as it was before the request

### Requirement: Nobody is credited for work they never did

Closing out a task SHALL NOT count toward the assignee's completed work. The
assignee SHALL instead accrue a warning, and the task SHALL remain
distinguishable from a genuinely answered one for reporting.

#### Scenario: An ignored task earns a warning, not credit
- **WHEN** a task assigned to someone is closed out unanswered
- **THEN** their completed-task count is unchanged
- **AND** their warning count increases by one

#### Scenario: Closed-out tasks are distinguishable in reporting
- **WHEN** reporting reads a closed-out task
- **THEN** it can tell that task apart from one a human answered
