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

### Requirement: The ladder has a ceiling but no give-up

Once a task reaches the highest escalation level, the system SHALL continue
waiting indefinitely rather than escalating further or abandoning the task.

#### Scenario: Waiting continues past the top of the ladder
- **WHEN** a task at the highest level goes unanswered for another wait interval
- **THEN** the escalation level does not rise past the maximum
- **AND** the system is still waiting for the human
