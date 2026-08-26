## Purpose

The HTTP contract the TUI builds against: one route to submit a tool call for a
human to perform, one route to poll until that human has answered.

## ADDED Requirements

### Requirement: Submitting a tool call

The system SHALL accept a tool call consisting of a caller-supplied id, a tool
name, and an arguments object, record it, and start the work that gets it done by
a human. It SHALL acknowledge acceptance immediately, echoing the id, rather than
waiting for the work to finish.

#### Scenario: A tool call is accepted
- **WHEN** the caller submits an id, a tool name, and arguments
- **THEN** the system acknowledges acceptance and echoes the id
- **AND** the task is retrievable by that id with status `queued`

#### Scenario: Submission does not block on external systems
- **WHEN** a tool call is submitted
- **THEN** the response is returned without waiting on assignment, on the ask
  being written, or on Discord

#### Scenario: A resubmitted id is reported as a conflict
- **WHEN** the caller submits an id that already exists
- **THEN** the system reports a conflict
- **AND** the existing task is left untouched, so the caller can simply poll it

#### Scenario: A submission missing its id or tool name is rejected
- **WHEN** the caller submits a request with no id, or with no tool name
- **THEN** the system rejects it as a bad request
- **AND** no task is recorded

### Requirement: The submitted arguments are preserved as sent

The arguments SHALL be recorded as submitted, independently of any
human-readable ask derived from them. For a code change these describe which file
is involved, what the change should accomplish, the interface the result must
satisfy, and the file's current contents. An explicitly empty current-contents
value SHALL be preserved as meaning the file does not yet exist.

#### Scenario: Arguments survive derivation of the ask
- **WHEN** a tool call is recorded and an ask is derived from it
- **THEN** the originally submitted arguments remain retrievable unchanged

#### Scenario: A new-file request is distinguishable from an edit
- **WHEN** a tool call is submitted whose current-contents value is explicitly empty
- **THEN** it is recorded as a request for a file that does not yet exist

### Requirement: Polling for the result

The system SHALL expose the current state of a task by its id, reporting its
status, the current escalation level, who it is assigned to, and the human's
reply. The reply SHALL be present exactly when the status is `completed`. Values
that are not yet known SHALL be omitted rather than reported as errors, and the
response MAY carry additional fields.

#### Scenario: Polling a task that has not been assigned yet
- **WHEN** the caller polls a task with status `queued`
- **THEN** the status is reported as `queued`
- **AND** the assignee and reply are omitted

#### Scenario: Polling a task waiting on a human
- **WHEN** the caller polls a task that has been dispatched but not answered
- **THEN** the status is reported as `assigned`
- **AND** the assignee and the current escalation level are present
- **AND** the reply is omitted

#### Scenario: Polling a completed task
- **WHEN** the caller polls a task whose human has replied
- **THEN** the status is reported as `completed`
- **AND** the reply is present and identical to what the human wrote

#### Scenario: A link to the conversation is offered once it exists
- **WHEN** the caller polls a task that has been dispatched to a Discord thread
- **THEN** the response carries a link to that thread

#### Scenario: Polling an unknown id
- **WHEN** the caller polls an id that was never submitted
- **THEN** the system reports it as not found

### Requirement: Escalation is observable to the caller

The reported escalation level SHALL reflect the task's current level while it is
still waiting, so a caller polling repeatedly can display the ladder climbing.

#### Scenario: Escalation level rises across polls
- **WHEN** a task goes unanswered long enough to escalate
- **THEN** a subsequent poll reports a higher escalation level than an earlier one
