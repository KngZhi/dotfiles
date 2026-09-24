---
name: create-github-issue
description: Create GitHub issues and set KngZhi Project fields when the user asks to file an issue, Epic, Work item, or Spike.
---

# Create GitHub Issue

Use GitHub CLI to create one well-scoped Issue, add it to the shared Project,
set its planning fields, and read it back before reporting success. Use the
[browser fallback](references/fallbacks.md#browser-fallback) only when `gh` is
genuinely unavailable after the authorized authentication path is exhausted.

## Contract

- Default owner: `KngZhi`
- Shared Project: user Project `1`
- Shared Issue Form: `KngZhi/.github/.github/ISSUE_TEMPLATE/work-item.yml`
- Project fields:
  - `Status`: `Todo`, `In Progress`, `In Review`, `Blocked`, `Done`
  - `Horizon`: `Now`, `Next`, `Later`
  - `Work Type`: `Epic`, `Work`, `Spike`

The Issue Form is the canonical content schema, not the required submission
mechanism. A CLI-created body must contain `Type`, `Outcome`, `Context`, `Scope`,
`Acceptance criteria`, and `References`.

## 1. Resolve and preflight

Use the repository named by the user; otherwise derive it from the current
workspace's `origin` remote. Ask one concise question only when the target
cannot be resolved safely.

Before any write:

1. Run `gh auth status -h github.com`.
2. Confirm Project access with `gh project view 1 --owner KngZhi --format json`.
3. Search open Issues in the target repository for the same outcome. Reuse an
   obvious duplicate unless the user explicitly wants a separate Issue.

If authentication is missing or invalid, run `gh auth login -h github.com -w -s project`
only when the user has authorized authentication; otherwise ask for that one-time
authorization. A stored credential that needs refreshing is not a reason to
switch to the browser.

## 2. Shape the Issue

Choose one Project `Work Type` and record it under the body's `Type` heading:

- `Epic`: a multi-Issue outcome or roadmap container. Explain the larger outcome
  through a representative scenario.
- `Work`: a concrete feature, fix, chore, or deliverable; the default for
  actionable work when no other type is implied.
- `Spike`: a time-boxed investigation. Show the concrete uncertainty and the
  evidence or decision it should produce; do not invent a settled fix.

Write an outcome-focused title. For a behavior change, open the Context with a
concrete object the reader recognizes (a particular SKU, Pool, order, document,
or user action). Walk that same object, with the same inputs, through the current
problem, the intended change, and the expected result, then state the broader
business benefit. Use names, quantities, dates, units, or visible outputs that
make the difference clear, and describe the change in plain language at the
level needed to connect problem to result. The reader should understand this
before meeting formulas or implementation terms. Keep the schema headings:

```markdown
## Context
<example: a named object and the relevant situation or input>

Before: <what happens to this object now and the practical problem it causes>

## Outcome
Change: <what we will change to address this problem, in plain language>

After: <what happens to the same object with the same inputs after the change>

Benefit: <how this improves the wider workflow or business decision>

## Scope
<boundaries of this work; exclusions only when needed to prevent scope drift>

## Acceptance criteria
- [ ] <the opening example's input or action produces the expected result>

## References
<brief Agent investigation pointers, or None>

## Type
<Epic | Work | Spike>
```

Throughout the body:

- Prefer an observed example from the user's report or inspected evidence. When
  none exists, label the example illustrative and its result expected. Give exact
  outputs only when evidence or clear assumptions support them; leave genuinely
  unknown results open. Never present historical results as current, invent
  successful output, or mark acceptance complete.
- State the causal benefit that follows from the example, not vague claims such
  as "improves accuracy" or unsupported savings or performance numbers. A
  sub-Issue explains its contribution to the parent without claiming it delivers
  the whole parent's result.
- Keep the body short: each section adds information rather than restating the
  example.
- Acceptance criteria make the opening example checkable with the same inputs
  and comparison, then cover any other material outcome or boundary. State the
  observable result in ordinary language before any metric. "Add an E2E test"
  or "CI passes" alone does not describe the required behavior.
- Preserve material uncertainty instead of inventing requirements. Ask before
  creation only when it changes the repository, outcome, or scope. Show a draft
  first only when the user requests review.

Read [references/issue-body.md](references/issue-body.md) for a worked
before/after example, or when the Issue needs investigation context under
References, a tool or evidence requirement, or a link to the repository's
verification skill.

## 3. Create and add with `gh`

Pass the body through `--body-file` or stdin using the host's safe file
mechanism; do not interpolate Issue content into executable shell syntax.

1. Create the Issue with `gh issue create --repo <owner/repo> --title <title>
   --body-file <path>` and capture the returned Issue URL.
2. Add that exact URL with `gh project item-add 1 --owner KngZhi --url
   <issue-url> --format json`.

`gh issue create --project <title>` is acceptable only when the exact Project
title is known; Project number `1` plus `item-add` is the unambiguous default.

If creation succeeds and a later step fails, keep the Issue URL and retry only
the incomplete Project operation. Never create a second Issue to recover from a
downstream failure.

## 4. Set Project fields

Set `Status` to `Todo` and `Work Type` to the chosen value. Leave `Horizon`
unset so the Issue appears in `Inbox`, unless the user explicitly requested
`Now`, `Next`, or `Later`.

Use name-based editing when `gh project item-edit --help` exposes `--field` and
`--value`; otherwise follow
[ID-based field editing](references/fallbacks.md#id-based-field-editing).
`Work Type` is a Project field: do not substitute GitHub Issue Types or
`gh issue create --type` for it.

## 5. Verify completion

Read the Issue back with `gh issue view` and list Project items with
`gh project item-list 1 --owner KngZhi --limit 1000 --format json`. Match the
exact Issue URL and verify:

1. The repository, title, body, and open state are correct.
2. The Project contains the Issue as an Issue item.
3. `Status` is `Todo` and `Work Type` is correct.
4. `Horizon` is unset or matches the user's explicit choice.

Report the Issue URL and verified field values. Creation alone is partial
completion; name any failed or unverified downstream step.

## PR boundary

Keep pull requests out of the Project as standalone items. Link implementation
PRs through GitHub's linked-development relationship or a closing keyword such
as `Closes #123`.
