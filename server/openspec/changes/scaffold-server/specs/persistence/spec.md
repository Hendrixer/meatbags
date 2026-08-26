## Purpose

The shared record of who the humans are and what they have been tasked with — the
live-queryable contract seam between the plumbing half and the TUI half.

## ADDED Requirements

### Requirement: Agent roster storage

The system SHALL store each human with their Discord id, name, skills, and
performance stats (tasks completed, average response time, warnings, voicemails
received, flair).

#### Scenario: Roster read for assignment

- **WHEN** the roster is read to offer to the model or the TUI
- **THEN** each agent is returned with their skills and current stats

### Requirement: Task lifecycle storage

The system SHALL store each task keyed by its Discord thread id, recording tool
name, description, assignee, status, escalation level, timestamps, the reply, and
any audio url, and SHALL update the record as the task progresses.

#### Scenario: Task created

- **WHEN** a task is assigned
- **THEN** a task row exists keyed by the thread id with status reflecting that it
  is assigned and awaiting a human

#### Scenario: Task completed

- **WHEN** a human completes a task
- **THEN** the task row is updated with completed status, completion time, and the
  reply

### Requirement: Live queryability

Task and roster state SHALL be readable by external clients (the polling TUI and
the VS Code Postgres extension) at any time, including mid-flight.

#### Scenario: Query during a run

- **WHEN** an external client queries while tasks are in flight
- **THEN** it sees current statuses and escalation levels without waiting for the
  run to finish

### Requirement: Seed data

The system SHALL provide a seed script that pre-registers known humans with skill
tags.

#### Scenario: Seeding the roster

- **WHEN** the seed script is run against an empty database
- **THEN** the pre-registered humans exist in the roster with their skill tags
