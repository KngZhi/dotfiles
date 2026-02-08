# ExecPlans
This file defines the ExecPlan format and requirements for complex work.

## Requirements
- ExecPlans must be fully self-contained and define any terms they rely on.
- ExecPlans are living documents: update `Progress`, `Surprises & Discoveries`, `Decision Log`,
  and `Outcomes & Retrospective` as work proceeds.
- Emphasize observable outcomes, not just code changes.
- The plan content must be a single fenced ```md block (no nested fences). If a file contains only
  a single ExecPlan, omit the fences entirely.
- Only the `Progress` section may use checklists.

## Template
```md
# <Short, action-oriented description>

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

## Progress
- [ ] (YYYY-MM-DD HH:MMZ) First step...

## Surprises & Discoveries

## Decision Log

## Outcomes & Retrospective

## Context and Orientation

## Plan of Work

## Concrete Steps

## Validation and Acceptance

## Idempotence and Recovery

## Artifacts and Notes

## Interfaces and Dependencies
```
