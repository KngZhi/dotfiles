---
name: create-github-issue
description: Create GitHub issues and set KngZhi Project fields when the user asks to file an issue, Epic, Work item, or Spike.
---

# Create GitHub Issue

Use GitHub CLI as the primary execution path. Create one well-scoped Issue,
add it to the shared Project, set its planning fields, and read it back before
reporting success. Use the browser only as a fallback.

## Contract

- Default owner: `KngZhi`
- Shared Project: user Project `1`
- Shared Issue Form: `KngZhi/.github/.github/ISSUE_TEMPLATE/work-item.yml`
- Project fields:
  - `Status`: `Todo`, `In Progress`, `In Review`, `Blocked`, `Done`
  - `Horizon`: `Now`, `Next`, `Later`
  - `Work Type`: `Epic`, `Work`, `Spike`

Treat the shared Issue Form as the canonical content schema, not as the
required submission mechanism. A CLI-created body must contain `Type`,
`Outcome`, `Context`, `Scope`, `Acceptance criteria`, and `References`.

## Workflow

### 1. Resolve and preflight

Use the repository named by the user. Otherwise derive it from the current
workspace's `origin` remote. Ask one concise question only when the target
cannot be resolved safely.

Before any write:

1. Run `gh auth status -h github.com`.
2. Confirm Project access with
   `gh project view 1 --owner KngZhi --format json`.
3. Search open Issues in the target repository for the same outcome.

If authentication is missing or invalid, start `gh auth login -h github.com -w
-s project` only when the user has authorized authentication; otherwise ask
for that one-time authorization. Do not switch to the browser merely because
the stored CLI credential needs refreshing.

Reuse an obvious duplicate unless the user explicitly wants a separate Issue.

### 2. Shape the Issue

Choose one Project `Work Type` and record it under the Issue body's `Type`
heading:

- `Epic`: a multi-Issue outcome or roadmap container.
- `Work`: a concrete feature, fix, chore, or deliverable. Use this default for
  actionable work when no other type is implied.
- `Spike`: a time-boxed investigation producing evidence or a decision.

Write an outcome-focused title. For a behavior change, open with a concrete
before/after example: the situation, what happens now, why that is a problem,
and what should happen after the change. The reader should understand the
difference before encountering formulas, metrics, or implementation terms.

Keep the example in the adjacent Context and Outcome sections, using the same
inputs and user action on both sides. Include dates, quantities, units, or a
visible output when they make the difference clear. State what the reader would
actually see or experience; a table of unexplained numbers does not do that by
itself. Retain the schema headings:

```markdown
## Context
<concrete example: situation or input → current behavior → practical problem>

## Outcome
<the same example after the change: what happens instead and how that helps>

## Scope
<what changes; exclusions only when needed to prevent scope drift>

## Acceptance criteria
- [ ] <the opening example's input or action produces the expected result>

## References
<brief Agent investigation pointers, or None>

## Type
<Epic | Work | Spike>
```

For example, "make inventory coverage ETA-aware" needs a concrete explanation:
"Illustrative scenario: at the September review, next January will be short by
100 units. An existing shipment of 2,000 units arrives the following September;
a new order could arrive in January. Now: the planner counts the late shipment
and recommends no replenishment, leaving January short. Expected after the fix:
it recommends timely replenishment for January and retains the September
commitment." This explains the intended difference without prescribing a
formula or claiming measured results.

For an Epic, use a representative scenario to explain the larger outcome. For a
Spike, show the concrete uncertainty and the evidence or decision it should
produce; do not invent a settled fix. Keep the body short, with each section
adding information rather than restating the example.

Put optional Agent investigation context under References: reproduction inputs,
evidence, relevant entrypoints, and necessary business constraints. Keep this
part concise too. Distinguish observed behavior from causal hypotheses and
implementation suggestions. Ask the implementing Agent to verify hypotheses;
allow a better explanation or solution when supported by evidence. Do not turn
prior exploration into a mandatory formula, field design, file list, or test
implementation. Acceptance criteria constrain outcomes; established business
rules constrain boundaries. Preserve explicitly authorized technical constraints
and identify them as such.

Acceptance criteria make the opening example checkable, then cover any other
material outcomes or boundaries. Keep its inputs and comparison consistent.
State the observable result in ordinary language before any necessary metric.
“Add an E2E test” or “CI passes” alone does not describe the required behavior.
A real E2E assertion can supply evidence for it; screenshots or videos are not
mandatory for every task.

Inspect the repository's verification skill when available and link it under
References. Reuse its project operations rather than copying its setup, long
commands, or reporting procedure into each Issue. Do not require a new script,
application, or per-Issue verification wrapper by default. Include implementation
details only when they are necessary constraints, not speculative task lists.

Prefer an observed example from the user's report or inspected evidence. When
none is available, label a simplified example as illustrative and its desired
result as expected. Give exact outputs only when supported by evidence or clear
assumptions; leave genuinely unknown results open. Do not present historical
results as current observations, invent successful output, or mark acceptance
complete. When specifying a tool, say what each operation does
and what observable result shows it worked. For example, an input check reports
validation status and data date; a prediction run produces a readable snapshot.
Neither alone establishes that a particular business bug is fixed.

When the Issue needs an explicit evidence requirement, keep it to one criterion:
show a representative action or short command, its actual result, and how that
result meets the acceptance criteria. The eventual completion report should
state what changed, before/after results, evidence, and unverified paths. Keep
full logs in linked evidence; do not expand the Issue into a verification manual.

Preserve material uncertainty instead of inventing requirements. Ask before
creation only when uncertainty changes the repository, outcome, or scope.
Show a draft first only when the user requests review.

### 3. Create and add with `gh`

Provide the body through `--body-file` or stdin using the host's safe file
mechanism. Avoid interpolating Issue content into executable shell syntax.

1. Create the Issue with `gh issue create --repo <owner/repo> --title <title>
   --body-file <path>` and capture the returned Issue URL.
2. Add that exact URL with `gh project item-add 1 --owner KngZhi --url
   <issue-url> --format json`.

`gh issue create --project <title>` is acceptable only when the exact Project
title is known. Project number `1` plus `item-add` is the unambiguous default.

If creation succeeds and a later step fails, retain the Issue URL and retry
only the incomplete Project operation. Never create a second Issue to recover
from a downstream failure.

### 4. Set Project fields

Set `Status` to `Todo` and `Work Type` to the chosen value. Leave `Horizon`
unset so the Issue appears in `Inbox`, unless the user explicitly requested
`Now`, `Next`, or `Later`.

Prefer name-based editing when `gh project item-edit --help` exposes `--field`
and `--value`. Otherwise use the installed CLI's ID-based interface:

1. Read the Project ID with `gh project view`.
2. Read field and option IDs with `gh project field-list`.
3. Read the Project item ID from `item-add` output or `gh project item-list`.
4. Call `gh project item-edit` once per single-select field using `--id`,
   `--project-id`, `--field-id`, and `--single-select-option-id`.

Project `Work Type` is a Project field. Do not substitute GitHub Issue Types or
`gh issue create --type` for it.

### 5. Verify completion

Read the Issue back with `gh issue view` and list Project items with
`gh project item-list 1 --owner KngZhi --limit 1000 --format json`. Match the
exact Issue URL and verify:

1. The repository, title, body, and open state are correct.
2. The Project contains the Issue as an Issue item.
3. `Status` is `Todo` and `Work Type` is correct.
4. `Horizon` is unset or matches the user's explicit choice.

Report the Issue URL and verified field values. Creation alone is partial
completion; name any failed or unverified downstream step.

## Browser fallback

Use the target repository's `Work item` Issue Form only when `gh` is genuinely
unavailable after the authorized authentication path has been exhausted.
Verify the created Issue in Project `1` and set the same fields before
reporting success.

## PR boundary

Keep pull requests out of the Project as standalone items. Link implementation
PRs through GitHub's linked-development relationship or a closing keyword such
as `Closes #123`.
