## Purpose

The surface where tasks appear to real humans and their answers come back —
translating between the durable workflow and Discord in both directions.

## ADDED Requirements

### Requirement: Thread-per-task assignment

WHEN a task is assigned to a human, the system SHALL create a dedicated Discord
thread for that task and post the ask into it.

#### Scenario: Task posted to a fresh thread

- **WHEN** a task is assigned
- **THEN** a new thread is created, the ask (plus any nag audio) is posted in it,
  and the thread's id is used as the task's id

### Requirement: Reply-to-completion bridge

WHEN a human posts a message in a task thread, the system SHALL emit a
`human/task.completed` event keyed by that thread id and carrying the reply text.

#### Scenario: Human replies in a task thread

- **WHEN** a human posts in an active task thread
- **THEN** a `human/task.completed` event is emitted with the thread id as the task
  id and the message as the reply

#### Scenario: Message outside a task thread is ignored

- **WHEN** a message is posted somewhere that is not an active task thread
- **THEN** no completion event is emitted

### Requirement: Roster capture

WHEN a person speaks in the general channel, the system SHALL upsert them into the
roster so Discord remains the source of truth for who is present.

#### Scenario: New person speaks

- **WHEN** a person with no roster entry posts in the general channel
- **THEN** a roster entry is created for them

#### Scenario: Known person speaks

- **WHEN** a person who already has a roster entry posts again
- **THEN** their existing entry is retained (not duplicated)
