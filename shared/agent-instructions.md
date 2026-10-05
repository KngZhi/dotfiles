# Shared agent instructions

## K2046 and Linear standing authorization

The user grants standing authorization to use K2046 and Linear through existing
MCP tools, connectors, CLIs, or APIs. Execute reads and task-scoped writes needed
to fulfill the user's request without asking for permission again. A request to
create, update, import, submit, cancel, or delete authorizes that action.

Ask only for missing business information or an action outside the requested
scope. Treat data validation as a correctness check, not a permission question;
standing authorization does not supply missing data. Respect explicit read-only
or no-write instructions.

Read before writing and verify the result afterward. Stop on an uncertain write
and inspect the existing result before considering another attempt.

## Local tools

- `in2csv` prints a local `.xls` / `.xlsx` sheet as CSV. Python `openpyxl` reads
  cells, formulas, and merged ranges but does not recalculate formulas. Read saved
  workbooks from the file; use Computer Use for necessary UI work, not to copy
  cells out of an existing file.
- `trello` ([mheap/trello-cli](https://github.com/mheap/trello-cli)) is installed
  and authenticated for Trello boards, lists, and cards.

## Issue tracking in Linear

Engineering issues for KngZhi repositories live in Linear, workspace Claw3PO
(`claw3po`), team **JUN** (key `SK`, issues `SK-<n>`), one project per
repository where the team has one (today `chile-mono`, `order-printer`,
`WhatsApp 独立服务（脱离 Hermes）`, `本机服务自动部署（精简版）`); the repository's
`docs/agents/issue-tracker.md` names its project. Workspace SAOKO, team
**SAOKO**, holds business work (suppliers, purchasing) and never gets
engineering issues. The former SAOKO team Enginer (`ENG`) is retired (migrated
2026-10-05; open issues became SK-1..47); `ENG-<n>` in older commits and docs
are history. GitHub keeps code, pull requests and CI.

- Team JUN's workflow states: `Backlog`, `Todo`, `In Progress`, `In Review`,
  `Done`, `Blocked`, `Canceled`, `Duplicate`. It has no `Triage` or `等回复`
  state. Triage roles map to them: `Todo` delegated to an agent (ready for
  agent), `Todo` assigned to a human (ready for human), `Canceled` or
  `Duplicate` (won't fix). `Blocked` holds planned work waiting on an open
  `blockedBy` Issue; `Backlog` is work not yet planned, the nearest state for an
  issue awaiting triage. Needs-info has no state of its own: ask in a comment.
  Category uses the team labels `Bug`,
  `Feature`, `Improvement`, and `RFC` for design discussion (no other labels
  exist on team JUN).
- Never write a bare `#123` in a Linear body: the workspace GitHub integration
  links it to the wrong repository. Write `GH-123` or the full URL.
- Cancelling a Linear issue that has linked GitHub PRs closes those PRs
  (2026-10-05: cancelling ENG-149/ENG-151 closed GH-479/480/481). Move the PRs
  to another issue or unlink them before cancelling.
- Linear MCP tools and `~/.local/bin/linear` are connected to SAOKO only. For
  Claw3PO (and for settings the MCP tools cannot change, such as teams and
  workflow states) use the GraphQL API at `https://api.linear.app/graphql`
  with the Claw3PO key `op://DEV/Linear API/credential`, passed only through an
  environment variable. For SAOKO use `op://DEV/Linear Cli SAOKO/credential`.
- Create and maintain issues through `create-linear-issue`. If the user
  explicitly requests a legacy workflow that requires a GitHub dispatch copy,
  keep Linear authoritative and link that copy both ways.

## Pull request size and stacks

This section applies only to work that will land as a pull request. Direct
commits to a repository with no PR workflow (these dotfiles, for example) are
exempt.

Before implementation, estimate the added source lines and record the intended
PR boundary in the working plan. The default budget is about 300 added source
lines per PR, excluding tests, documentation, and lockfiles, unless the target
repository or issue states a different budget.

Begin implementation only when the estimate fits that budget or a linear stack
has been created with `gh stack`. Each PR owns one coherent concern, remains
independently reviewable, and passes its own CI. Put foundational changes at the
bottom and dependent changes above them. Use separate stacks for independent or
parallel work.

When the work requires a stack and `gh stack` is unavailable, report that
constraint before implementation. A size-approval label or removing substantive changes
is not a substitute for splitting; only a human may approve an irreducibly
large PR such as a generated-code or mechanical-rename change.

## Local secrets for agents

Shared local credentials (for example `NODE_AUTH_TOKEN`, the GitHub Packages
read token that `.npmrc` files in this user's repositories expect) live in
1Password and are rendered into `~/.config/agent-secrets/agent-secrets.env`
by `refresh-agent-secrets`; `~/.zshenv` sources that file for every shell, so
they are already in your environment. If one is missing, run
`refresh-agent-secrets` (needs the 1Password app; it may prompt Touch ID) or
ask the user. Never print or copy the rendered file, and add new shared
secrets as `op://` references in `~/.config/agent-secrets/agent-secrets.env.tpl`,
never as literals.
