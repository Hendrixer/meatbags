## Purpose

The durable unit of work behind one tool call: pick a human, hand them the job,
wait however long it takes, and record whatever they say back as the result.

## ADDED Requirements

### Requirement: One durable run per tool call

Each submitted tool call SHALL be fulfilled by exactly one durable workflow run,
started when the call is accepted. Runs SHALL be independent of one another, so
several tool calls can be outstanding with different humans at the same time.

#### Scenario: Submission starts exactly one run
- **WHEN** a tool call is accepted
- **THEN** exactly one workflow run is started for it

#### Scenario: Concurrent tool calls do not interfere
- **WHEN** three tool calls are submitted while none has been answered
- **THEN** three runs are outstanding, each waiting on its own human
- **AND** answering one has no effect on the other two

### Requirement: Dispatch

Before waiting, a run SHALL pick a human from the roster, produce a
human-readable ask from the tool call, post that ask to a Discord thread
dedicated to this task, and record the assignee and thread against the task.

#### Scenario: A pending task is dispatched
- **WHEN** a run begins for a pending task
- **THEN** a human is picked from the roster
- **AND** a Discord thread is created carrying the ask
- **AND** the task records that assignee and thread and moves to `assigned`

#### Scenario: Dispatch cannot proceed without a roster
- **WHEN** a run begins and the roster has no members
- **THEN** the run fails rather than dispatching to nobody

### Requirement: Waiting for the human

After dispatch, a run SHALL suspend until a completion signal arrives for that
specific task. A run SHALL NOT consume a signal belonging to a different task,
and SHALL NOT consume compute while suspended.

#### Scenario: A reply resumes the correct run
- **WHEN** a completion signal arrives naming one outstanding task
- **THEN** only that task's run resumes
- **AND** other outstanding runs remain suspended

### Requirement: The reply becomes the result

Whatever the human sends back SHALL be recorded as the tool call's result
verbatim. The system SHALL NOT validate it, check it against the tool's intent,
attempt to apply it to anything, or reject it for being wrong.

#### Scenario: An irrelevant reply is accepted as the result
- **WHEN** a human answers a request to modify a file with unrelated text
- **THEN** the task is completed with that text as its result
- **AND** the assignee is credited with a completed task

### Requirement: Demo insurance

The system SHALL support an off-by-default mode in which an unanswered task is
answered automatically after a configured delay, so a demonstration completes
without a live human. When unconfigured, no automatic replies SHALL occur.

#### Scenario: Auto-reply completes a task when enabled
- **WHEN** the auto-reply delay is configured and a task goes unanswered for it
- **THEN** the task is completed with an automatically generated reply

#### Scenario: No auto-reply when disabled
- **WHEN** the auto-reply delay is not configured
- **THEN** an unanswered task is never completed automatically
