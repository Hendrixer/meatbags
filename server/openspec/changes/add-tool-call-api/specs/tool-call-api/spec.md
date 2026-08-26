## Purpose

The HTTP contract the TUI builds against: one route to submit a task for a human
to perform, one route to poll until that human has answered.

## ADDED Requirements

### Requirement: Submitting a task

The system SHALL accept a task describing work for a human, mint an identifier
for it, record it, and start the work that gets it done. It SHALL return that
identifier immediately rather than waiting for the work to finish. The caller
SHALL NOT supply the identifier.

#### Scenario: A task is accepted
- **WHEN** the caller submits a tool name and the details of the work
- **THEN** the system responds with a newly minted identifier
- **AND** the task is retrievable by that identifier with status `pending`

#### Scenario: Each submission gets its own identifier
- **WHEN** the caller submits two identical bodies
- **THEN** two distinct tasks exist with distinct identifiers

#### Scenario: Submission does not block on external systems
- **WHEN** a task is submitted
- **THEN** the response is returned without waiting on assignment, on the ask
  being written, or on Discord

#### Scenario: A malformed submission is rejected
- **WHEN** the caller submits a request with no tool name
- **THEN** the system rejects it as a bad request
- **AND** no task is recorded

### Requirement: The submitted work is preserved as sent

The details the caller submits — which file is involved, what the change should
accomplish, the interface it must satisfy, and the current contents of the file
where one exists — SHALL be recorded as submitted, independently of any
human-readable ask derived from them. An absent current-file value SHALL be
preserved as meaning the file does not yet exist.

#### Scenario: Details survive derivation of the ask
- **WHEN** a task is submitted and an ask is derived from it
- **THEN** the originally submitted details remain retrievable unchanged

#### Scenario: A new-file request is distinguishable from an edit
- **WHEN** a task is submitted with no current file contents
- **THEN** it is recorded as a request for a file that does not yet exist

### Requirement: Polling for the result

The system SHALL expose the current state of a task by its identifier, reporting
the identifier, its status, the current escalation level, who it is assigned to,
and the human's reply. The reply SHALL be non-null exactly when the status is
`completed`. Values not yet known SHALL be reported as null rather than as
errors.

#### Scenario: Polling a task that has not been assigned yet
- **WHEN** the caller polls a task with status `pending`
- **THEN** the status is reported as `pending`
- **AND** the assignee and reply are null

#### Scenario: Polling a task waiting on a human
- **WHEN** the caller polls a task that has been dispatched but not answered
- **THEN** the status is reported as `assigned`
- **AND** the assignee and the current escalation level are present
- **AND** the reply is null

#### Scenario: Polling a completed task
- **WHEN** the caller polls a task whose human has replied
- **THEN** the status is reported as `completed`
- **AND** the reply is present and identical to what the human wrote

#### Scenario: Polling an unknown identifier
- **WHEN** the caller polls an identifier that was never issued
- **THEN** the system reports it as not found

### Requirement: Escalation is observable to the caller

The reported escalation level SHALL reflect the task's current level while it is
still waiting, so a caller polling repeatedly can display the ladder climbing.

#### Scenario: Escalation level rises across polls
- **WHEN** a task goes unanswered long enough to escalate
- **THEN** a subsequent poll reports a higher escalation level than an earlier one
