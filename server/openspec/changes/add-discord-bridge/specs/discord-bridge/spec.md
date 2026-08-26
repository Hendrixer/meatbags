## Purpose

The two-way link to Discord: pushing a task out to a human in a thread of its
own, and turning whatever they type back into the signal that completes the task.

## ADDED Requirements

### Requirement: A task gets its own thread

Each dispatched task SHALL be posted into a newly created thread in the shared
tasks channel, mentioning the assigned human and carrying the ask. One thread
SHALL serve exactly one task for that task's whole life.

#### Scenario: Dispatch creates a thread
- **WHEN** a task is dispatched to a human
- **THEN** a new thread is created in the tasks channel
- **AND** its first message mentions that human and states the ask
- **AND** the thread's identifier is recorded against the task

### Requirement: Nagging reaches the human

The system SHALL be able to post a follow-up message into an existing task's
thread, and to mention the assignee publicly in the tasks channel outside the
thread.

#### Scenario: A nag lands in the thread
- **WHEN** the system nags an assignee in their task's thread
- **THEN** a new message appears in that thread

#### Scenario: A public mention lands in the channel
- **WHEN** the system mentions an assignee publicly
- **THEN** the message appears in the shared tasks channel, not inside the thread

### Requirement: A reply in a task thread completes the task

When a human posts a message in a thread belonging to an outstanding task, the
system SHALL emit a completion signal naming that task and carrying the message
text, so the waiting run resumes.

#### Scenario: A reply signals completion
- **WHEN** a human posts a message in a thread belonging to an outstanding task
- **THEN** a completion signal is emitted naming that task
- **AND** it carries the message text exactly as written

#### Scenario: Messages elsewhere signal nothing
- **WHEN** a message is posted outside any task thread
- **THEN** no completion signal is emitted

#### Scenario: Further replies do not re-complete
- **WHEN** a human posts again in a thread whose task is already completed
- **THEN** no further completion signal is emitted for that task

#### Scenario: The system's own messages are ignored
- **WHEN** the system posts its own ask or nag into a task thread
- **THEN** no completion signal is emitted

### Requirement: Speaking in the general channel registers a human

Anyone who posts in the general channel SHALL be registered in the roster if not
already present, so the pool of assignable humans reflects who is actually around.

#### Scenario: A new speaker joins the roster
- **WHEN** somebody not in the roster posts in the general channel
- **THEN** they are added to the roster with their display name

#### Scenario: A known speaker is not duplicated
- **WHEN** somebody already in the roster posts in the general channel
- **THEN** no duplicate roster entry is created
- **AND** their accumulated stats are unchanged
