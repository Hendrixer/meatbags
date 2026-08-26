## Purpose

Turns a raw tool call into something a human in Discord will actually read: a
snarky supervisor telling a specific person to go ahead and do a specific thing.

## ADDED Requirements

### Requirement: The ask is written for a person

Given a tool name and its arguments, the system SHALL produce a plain-English
request addressed to a human, in the voice of an overbearing supervisor. The ask
SHALL refer to the actual arguments of the tool call, and SHALL NOT present raw
serialized arguments as the request.

#### Scenario: A tool call becomes an ask
- **WHEN** a tool call to modify a named file with a described change is submitted
- **THEN** the generated ask names that file and describes that change in prose
- **AND** it does not consist of serialized arguments

#### Scenario: An unfamiliar tool still produces a readable ask
- **WHEN** a tool call arrives whose name the system has never seen before
- **THEN** an ask is still produced that a human could act on

### Requirement: The supervisor picks the human

The system SHALL choose the assignee for a task from the current roster,
considering the roster members' recorded names, skills, and stats. No routing
rules SHALL be imposed outside that choice.

#### Scenario: An assignee is chosen from the roster
- **WHEN** an ask is generated for a task and the roster has members
- **THEN** exactly one roster member is chosen as the assignee

#### Scenario: The chosen assignee is always a real roster member
- **WHEN** the choice names somebody who is not in the roster
- **THEN** a roster member is used instead

### Requirement: Generation never blocks a task

If the supervisor voice is unavailable or fails, the system SHALL fall back to a
deterministic ask and a deterministic assignee so the task is still dispatched.
A failure here SHALL NOT fail the tool call.

#### Scenario: Falling back when unavailable
- **WHEN** the supervisor voice is not configured
- **THEN** the task is still dispatched with a plain description and an assignee
  chosen deterministically

#### Scenario: Falling back on error
- **WHEN** generating the ask fails
- **THEN** the task is still dispatched rather than failing

### Requirement: The ask demands an answer the caller can use

The human's reply is returned to the caller as the result and applied without
review. The ask SHALL therefore state what form the answer must take — the
complete contents of the file, not a summary, a diff, or an acknowledgement.
Where the caller supplied the interface the result must satisfy, or the current
contents of the file, the ask SHALL include them so the human can produce that
answer.

#### Scenario: An edit request carries the current code
- **WHEN** an ask is generated for a task whose file already has contents
- **THEN** the ask includes those contents
- **AND** it asks for the entire updated file rather than a description of the change

#### Scenario: A new-file request states the interface
- **WHEN** an ask is generated for a task with no current file contents
- **THEN** the ask says the file does not exist yet
- **AND** it states the interface the new file must satisfy

#### Scenario: The ask never invites an acknowledgement
- **WHEN** any ask is generated
- **THEN** it does not invite a reply that merely confirms the work is done
