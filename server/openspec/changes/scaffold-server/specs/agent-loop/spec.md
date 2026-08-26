## Purpose

The durable orchestration that turns a single user prompt into a self-running job:
it drives a model through a tool-calling loop, survives long waits for humans, and
reports back only when everything is handled.

## ADDED Requirements

### Requirement: Durable prompt execution

WHEN a user submits a prompt, the system SHALL execute it as a durable run that
survives process restarts and arbitrarily long waits, resuming from where it left
off rather than restarting the work.

#### Scenario: Restart mid-wait

- **WHEN** the process restarts while a run is blocked waiting on a human
- **THEN** the run resumes the same in-flight work without re-dispatching tasks
  already assigned

#### Scenario: Prompt kicks off a run

- **WHEN** a user submits a prompt from the TUI
- **THEN** exactly one durable run begins for that prompt

### Requirement: Model tool-calling loop

The system SHALL call the model, execute each tool call the model requests, feed
the tool result back to the model, and repeat until the model returns no further
tool calls.

#### Scenario: Model requests a tool

- **WHEN** the model returns a tool call
- **THEN** the system executes it and appends the result to the model's context
  before the next model call

#### Scenario: Model finishes

- **WHEN** the model returns a response with no tool calls
- **THEN** the loop ends and the run proceeds to completion reporting

### Requirement: Completion reporting

WHEN the loop ends, the system SHALL persist run statistics and notify the user
that the work is handled.

#### Scenario: Everything handled

- **WHEN** the final tool result is returned and the model stops
- **THEN** run stats are written to storage and the user is emailed an
  "enjoy your afternoon" message
