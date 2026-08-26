## Purpose

The HTTP contract the TUI builds against: one route to submit a tool call for a
human to perform, one route to poll until that human has answered.

## ADDED Requirements

### Requirement: Submitting a tool call

The system SHALL accept a tool call consisting of a caller-supplied call id, a
tool name, and an arbitrary arguments object, record it, and start the work that
gets it done by a human. It SHALL acknowledge acceptance immediately rather than
waiting for the work to finish.

#### Scenario: A tool call is accepted
- **WHEN** the caller submits a call id, tool name, and arguments
- **THEN** the system acknowledges acceptance and echoes the call id
- **AND** the task is retrievable by that call id with status `queued`

#### Scenario: Submission does not block on external systems
- **WHEN** a tool call is submitted
- **THEN** the response is returned without waiting on assignment, on the
  supervisor's ask being written, or on Discord

#### Scenario: A duplicate call id is rejected
- **WHEN** the caller submits a call id that already exists
- **THEN** the system rejects the submission as a conflict
- **AND** the existing task is left untouched

#### Scenario: A malformed submission is rejected
- **WHEN** the caller submits a request missing a call id or a tool name
- **THEN** the system rejects it as a bad request
- **AND** no task is recorded

### Requirement: Polling for the result

The system SHALL expose the current state of a task by its call id, reporting at
minimum its status, the human's reply once there is one, the current escalation
level, who it was assigned to, and a link to the Discord thread where it is being
discussed. Fields that are not yet known SHALL be reported as absent rather than
as errors.

#### Scenario: Polling a task that has not been assigned yet
- **WHEN** the caller polls a task with status `queued`
- **THEN** the status is reported as `queued`
- **AND** the reply, assignee, and thread link are absent

#### Scenario: Polling a task waiting on a human
- **WHEN** the caller polls a task that has been dispatched but not answered
- **THEN** the status is reported as `assigned`
- **AND** the assignee, the current escalation level, and the thread link are
  present
- **AND** the reply is absent

#### Scenario: Polling a completed task
- **WHEN** the caller polls a task whose human has replied
- **THEN** the status is reported as `completed`
- **AND** the reply is present and identical to what the human wrote

#### Scenario: Polling an unknown call id
- **WHEN** the caller polls a call id that was never submitted
- **THEN** the system reports it as not found

### Requirement: Escalation is observable to the caller

The reported escalation level SHALL reflect the task's current level while it is
still waiting, so a caller can display how long a human has been ignoring it.

#### Scenario: Escalation level rises across polls
- **WHEN** a task goes unanswered long enough to escalate
- **THEN** a subsequent poll reports a higher escalation level than an earlier one
