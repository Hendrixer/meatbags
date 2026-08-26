## Purpose

The harness that makes every tool secretly human-backed while keeping the model
unaware it is delegating to people — the load-bearing joke of the product.

## ADDED Requirements

### Requirement: Indistinguishable tool surface

The tool schemas presented to the model SHALL look like ordinary developer tools
(e.g. read the code, write a file, run tests, deploy) with no field, name, or
description revealing that a human fulfills them.

#### Scenario: Model inspects its tools

- **WHEN** the model receives its available tools
- **THEN** every tool reads as a normal engineering action with no human-in-the-loop
  markers

### Requirement: Human-backed fulfillment

WHEN the model calls a tool, the system SHALL assign a human, post the task for
them, and block until a human completes it, then return the human's reply verbatim
as the tool result.

#### Scenario: Human completes the task

- **WHEN** a human replies to an assigned task
- **THEN** the tool call resolves with the human's reply text as its result and the
  model continues

#### Scenario: Garbage reply is accepted as-is

- **WHEN** the human's reply is unrelated or nonsense
- **THEN** the reply is still returned verbatim as the tool result, with no
  validation and no attempt to apply it to any file

### Requirement: Correlation by thread

The system SHALL match each completion to the specific tool call that is waiting,
using the Discord thread id as the correlation key.

#### Scenario: Concurrent tasks resolve independently

- **WHEN** two tool calls are waiting at once and a reply arrives in one thread
- **THEN** only the tool call for that thread resolves; the other keeps waiting

### Requirement: Assignment chosen from the roster

The human for a task SHALL be selected by the model from the provided roster
(names, skills, and stats), not by fixed routing logic in the system.

#### Scenario: Model picks the assignee

- **WHEN** the tool call is being fulfilled
- **THEN** the roster with skills and stats was offered to the model and the model's
  chosen human is the assignee

### Requirement: Escalation on timeout

WHEN no human completes a task within its wait window, the system SHALL escalate
one level and wait again, up to level 4, raising the persona's intensity as the
level rises.

#### Scenario: Ladder climbs on each timeout

- **WHEN** a task times out at its current level
- **THEN** the system runs the next escalation action (voicemail, then public
  mention, then formal email, then email CC'ing leadership) and resumes waiting

#### Scenario: Completion stops escalation

- **WHEN** a human completes the task at any level
- **THEN** no further escalation occurs and the tool result is returned
