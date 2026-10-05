---
name: create-linear-issue
description: Create or revise Linear engineering issues with a short human summary followed by Agent instructions, in the repository's Linear project. Also use when splitting a plan into several issues or a milestone, or when a plan changes and existing issues must be cut, reordered or cleaned up.
---

# Create or Revise a Linear Issue

Write an Issue a person can understand before reaching implementation details.
Use two clearly separated parts: a short human summary first, then the Agent's
execution context. Create and maintain the Issue in Linear; link GitHub code,
pull requests and CI as supporting material.

## 1. Resolve the Linear destination and current facts

Use the named repository or the current workspace's `origin`. Follow the
repository and shared agent instructions, including `docs/agents/issue-tracker.md`
when present, to select the Linear project. For KngZhi engineering work, use
workspace **Claw3PO**, team **JUN** (key `SK`), and the project for that repository
(see the shared instructions for the project list). Workspace SAOKO, team
**SAOKO**, holds business work and is a different destination. The old team
Enginer (`ENG`) is retired; `ENG-<n>` identifiers are history.

The Linear MCP connector and `~/.local/bin/linear` reach SAOKO only. Reach
Claw3PO through its GraphQL API with the key `op://DEV/Linear API/credential`
(environment variable only). Before cancelling an Issue, move or unlink its
linked GitHub PRs: cancelling closes them.

Use the Linear connector to verify the workspace, team and project before
writing. Resolve current workflow states, labels and assignment options from
Linear and the shared instructions.

- **Existing Issue:** read its full current description, metadata and relevant
  links. Update that Issue in place. Verify live PR status before describing its
  progress; a previous report may be stale.
- **New Issue:** search the repository's Linear project for the same outcome
  and reuse an obvious duplicate unless a separate Issue was requested.
- **Links:** use Linear issue identifiers for related work. For GitHub references,
  use `GH-123` or a full URL; bare `#123` can link to another repository.

Ask only when an unresolved fact changes the target or scope. Prepare a draft
for approval only when the user requests that step.

## 2. Write for two audiences

Write the title in the user's language, naming the problem or intended result.
Keep module names, function names and unexplained technical terms in the Agent
part. Explain any necessary technical term in ordinary language on first use.

### Human summary

Make the first part readable on its own in about 30 seconds: usually three or
four short paragraphs. It answers what is wrong, what will change, why that
helps, and how a person can tell it is complete.

For a behavior change, use a recognizable object or action and follow the same
inputs through before and after. Prefer observed evidence; label illustrative
examples and expected outcomes. For a refactor, explain the maintenance problem
and the behavior that must stay the same. Claim only benefits supported by the
change; a child Issue explains its own contribution to the larger outcome.

### Agent context

Put code entrypoints, scope, established constraints, technical acceptance
criteria and verification pointers here. Separate verified facts from hypotheses
and suggestions. Include the minimum needed to execute safely; link long
contracts, review reports and logs instead of copying them into the Issue.

Use this default structure, translating labels when appropriate:

```markdown
## 给人看

**问题**：<具体对象或操作，现在遇到的问题>

**改动与价值**：<准备改变什么，预期结果及实际好处>

**完成标准**：<可观察、可核对的结果>

**依赖与并行**：<要等哪些 Issue、为什么；它挡着哪些 Issue；现在能否开始；可以和哪些 Issue 同时做，哪些不宜同时做及原因。工程类 Issue 必填，单独一件事时写"无依赖，可随时开始">

**进展**：<已核实的当前状态和交付链接；无必要时省略>

---

## 给 Agent 看

**范围与约束**

- <实施范围、必要入口和已确认的业务或技术边界>
- <仓库、会改动的主要文件、预计新增源码行数与 PR 边界；上线有风险时写上线约束>

**验证与资料**

- <如何核对上述结果；相关合同、项目验证技能和证据链接>
```

Keep the parts complementary: technical details belong in the second part;
the first part must not depend on reading it. Keep status, priority, labels,
assignee/delegate, parent and blocking relationships in Linear's native fields.

Acceptance criteria describe observable behavior before test names or metrics.
For completed work, record what was actually checked and the revision/date it
applies to. Mark criteria complete only when evidence supports them.

Read [references/issue-body.md](references/issue-body.md) for a worked example
or guidance on maintenance Issues, investigation context and verification.

## 3. Save and read back

Use structured Linear connector arguments, preserving real newlines. For edits,
pass the existing Issue ID and change only the requested fields.
When rewriting for clarity, preserve material requirements and uncertainty,
and keep status, assignee, dependencies and other metadata unless the requested
change calls for updating them.

After writing, fetch the saved Issue and verify:

- The title and human summary explain the work without implementation knowledge.
- Both audience sections survive Linear formatting; links resolve to the
  intended Issues, PRs and evidence.
- The Agent part retains the execution constraints and useful verification
  context, with detailed contracts accessible through links.
- Workspace/team/project and requested fields are correct; unrelated metadata
  remains intact.

Report the Issue link and actual result. If a write succeeded but a later step
failed, retry only the unfinished step using the existing Issue. A create that
returns an error (for example a 502) may still have succeeded: search the project
for the title before retrying, so a retry does not create a duplicate.

## 4. Several Issues for one plan

When a plan becomes several Issues, the project view must show what to do first
without anyone reading the bodies.

- **One Issue per deliverable.** Usually one PR, or one operational step such
  as a drill. Record the PR boundary and line estimate in each Agent part; an
  Issue expected to exceed the budget is split before it is saved.
- **Dependencies in native fields.** Set `blockedBy`/`blocks` for every real
  ordering constraint. Do not describe order only in prose.
- **State tells whether work can start.** `Backlog` means not yet planned; do
  not use it for planned work that is waiting. Planned Issues with no open
  blocker go to `Todo`; planned Issues with an open `blockedBy` go to `Blocked`
  (an unstarted state on team JUN). Linear does not move them
  automatically: when an Issue closes, move each Issue it blocked to `Todo` once
  its last blocker is done, and update the milestone table.
- **Execution order.** Set each Issue's manual `sortOrder` in execution order
  (the connector cannot; use the GraphQL API per the shared instructions), and
  number titles when the order matters (`L1`, `L2`, …).
- **Hidden conflicts.** Dependencies are not the only reason work can't run in
  parallel. Note in the plan when independent Issues edit the same files, or
  when their releases should be separated because each touches production.
- **Milestone.** Give it exit criteria a person can check, a target date, and a
  schedule table a person can act on without opening any Issue:

  ```markdown
  | 顺序 | Issue | 现在 | 要等 | 可同时做 | 注意 |
  |---|---|---|---|---|---|
  | 1 | SK-101 L1 … | Todo | 无 | 102、103 | 改 chile-ops |
  | 4 | SK-86 L6 … | Todo | 无 | 101、102 | 与 103 都改 bridge.js，排在 103 后；单独上线 |
  | 5 | SK-84 L2 … | Blocked | 101 | — | |
  ```

  Follow it with one sentence naming what to start now, what runs in parallel,
  and the release order. Update the table when an Issue closes or the plan
  changes; each Issue's 「依赖与并行」 line must agree with it.

After saving, read back the list and confirm that each Issue sits in the
intended milestone, that `Todo` holds exactly the planned Issues with no open
blocker and `Blocked` exactly those with one, and that no Issue is left under an
obsolete parent.

## 5. When a plan changes

Change Linear in the same turn the decision is made. Do not leave abandoned work
labelled as paused.

- **Cancel what is no longer planned.** Cancel it (a reversible state) rather
  than parking it in `Backlog` under a "[暂缓]" prefix. Re-create work later if
  the plan returns.
- **Move surviving work.** Retitle kept or completed Issues to the new scheme
  and move them into the current milestone. Detach children from canceled
  parents.
- **Remove empty structure.** Delete milestones that no longer hold active
  work, and delete superseded plan or review documents once an authoritative
  document or repository file replaces them.
- **Rewrite the project overview.** Describe only the current direction, scope,
  safety constraints and stop-loss date. Keep the history to a short section
  and the decision log.

Confirm the cleanup with the user when it deletes documents or archives a
repository; canceling Issues and deleting milestones can proceed as part of an
approved plan change.
