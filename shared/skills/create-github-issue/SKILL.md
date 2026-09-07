---
name: create-github-issue
description: Create structured GitHub issues with `gh`, add them to KngZhi's shared Project, set planning fields, and verify the result. Use when the user asks to create, open, file, or record a GitHub Issue, Epic, Work item, or Spike in any repository. 中文触发包括“开 issue”、“创建 issue”、“记录成 issue”和“建 Epic/Work/Spike”。
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

Write an outcome-focused title and a Markdown body with these headings:

```markdown
## Type
<Epic | Work | Spike>

## Outcome
<observable result>

## Context
<why this matters and current behavior>

## Scope
<in scope and out of scope>

## Acceptance criteria
- [ ] <independently checkable result>

## References
<related issues, PRs, files, conversations, or None>
```

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
