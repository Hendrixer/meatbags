## Purpose

Durable record of every human-backed tool call and of the humans who do them.
The task record is the seam the TUI polls for results, and the roster is what
assignment and the leaderboard both read.

## ADDED Requirements

### Requirement: Task identity is the caller's tool call id

A task SHALL be identified by the tool call id supplied by the caller, so the
caller can poll immediately without waiting for any downstream system to assign
an id. The Discord thread id SHALL be stored as a separate value, unique across
tasks, and absent until a thread exists.

#### Scenario: Task is addressable before a thread exists
- **WHEN** a tool call is recorded but no Discord thread has been created yet
- **THEN** the task is retrievable by the caller's tool call id
- **AND** its thread id is absent

#### Scenario: Thread id resolves back to the task
- **WHEN** a task has been dispatched to a Discord thread
- **THEN** the task is retrievable by that thread id
- **AND** no other task shares that thread id

### Requirement: Task lifecycle

A task SHALL occupy exactly one of three states: `queued` when recorded but not
yet handed to a human, `assigned` once a human has been picked and notified, and
`completed` once that human has replied. States SHALL only advance forward.

#### Scenario: A newly recorded task is queued
- **WHEN** a tool call is recorded
- **THEN** its status is `queued`
- **AND** it has no assignee, no thread, and no reply

#### Scenario: Dispatch moves the task to assigned
- **WHEN** a human has been picked and the task posted to them
- **THEN** its status is `assigned`
- **AND** its assignee and thread id are recorded

### Requirement: Submitted arguments are preserved

A task SHALL retain the tool name and the exact arguments it was submitted with,
independently of any human-readable description derived from them.

#### Scenario: Arguments survive derivation of the ask
- **WHEN** a tool call is recorded and a human-readable ask is derived from it
- **THEN** the original tool name and arguments remain retrievable unchanged

### Requirement: Response time measures the human

The moment a task was submitted and the moment it was handed to a human SHALL be
recorded separately, so elapsed response time reflects how long the human took
and not how long dispatch took.

#### Scenario: Dispatch latency is excluded from response time
- **WHEN** a task is submitted, dispatched some seconds later, and completed
- **THEN** the recorded response time is measured from dispatch, not submission

### Requirement: The human's reply is stored verbatim

The reply SHALL be persisted exactly as the human wrote it, with no validation,
parsing, truncation, or transformation.

#### Scenario: Nonsense is preserved
- **WHEN** a human replies with text that has nothing to do with the task
- **THEN** the stored reply is byte-identical to what they wrote

### Requirement: Roster records

The system SHALL maintain a record per human keyed by their Discord id, holding
their display name, skill tags, and the running stats the leaderboard reads:
tasks completed, average response time, warnings, voicemails received, and flair.

#### Scenario: Completing a task credits the assignee
- **WHEN** a task assigned to a human is completed
- **THEN** that human's completed-task count increases by one

### Requirement: Roster seeding is idempotent

Seeding the roster with pre-registered humans SHALL be safe to run repeatedly:
re-running it SHALL NOT duplicate rows and SHALL NOT reset accumulated stats.

#### Scenario: Re-seeding preserves stats
- **WHEN** the seed runs against a roster whose members have completed tasks
- **THEN** no duplicate members are created
- **AND** their existing stats are unchanged
