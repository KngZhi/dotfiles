# Workspace and channel routing

## KngZhi destinations

| Work | Workspace / team | Channel |
|---|---|---|
| Engineering for KngZhi repositories | Claw3PO (`claw3po`) / JUN, key `SK`, issues `SK-<n>` | GraphQL API |
| Chile business: suppliers, purchasing, orders, containers | SAOKO / SAOKO | Existing SAOKO connector, `linear` CLI, or GraphQL API |

Engineering belongs in the repository's Linear project when the team has one.
Read `docs/agents/issue-tracker.md` when present. Established projects include
`chile-mono`, `order-printer`, `WhatsApp 独立服务（脱离 Hermes）`, and
`本机服务自动部署（精简版）`; verify the current project before writing.
GitHub holds code, pull requests, and CI. If the user explicitly requests a
legacy GitHub dispatch copy, keep Linear authoritative and link the copy both ways.

The former SAOKO Enginer team (`ENG`) was retired on 2026-10-05; migrated open
issues became SK-1..47. Treat `ENG-<n>` in old commits, documents, and generic
API examples as history, not the destination for new engineering work.

## Credentials and identity

The installed Linear MCP connector and `~/.local/bin/linear` reach SAOKO only.
They cannot verify or save Claw3PO issues. Use `https://api.linear.app/graphql`
for Claw3PO and for fields/settings unavailable in the selected connector.

- Claw3PO key: `op://DEV/Linear API/credential`.
- SAOKO key: `op://DEV/Linear Cli SAOKO/credential`.
- Pass credentials only through environment variables. Keep a Claw3PO key in a
  workspace-specific variable; the shared `LINEAR_API_KEY` is normally SAOKO.
  Prefer provided environment credentials and use the corresponding 1Password
  reference as the local fallback. Never print or save a secret in evidence.

Query viewer and organization through the chosen channel, then resolve the
target team's ID/key. Fetch an existing issue's team and project before changing
it. If identity or target disagrees with the requested workspace, stop that
operation and select the correct channel. Generic Hermes Linear API material
is a syntax reference; this shared skill owns local routing.

## JUN states and labels

Verify live options before writing. The established states are `Backlog`, `Todo`,
`In Progress`, `In Review`, `Done`, `Blocked`, `Canceled`, and `Duplicate`.

| Meaning | Native fields |
|---|---|
| Not yet planned / awaiting triage | `Backlog` |
| Planned, ready for an agent | `Todo` with agent delegation/assignment |
| Planned, ready for a human | `Todo` assigned to that human |
| Planned, waiting on an open dependency | `Blocked` with native `blockedBy` |
| Needs information | Comment naming the missing fact; retain the applicable state |
| Will not proceed / duplicate | `Canceled` / `Duplicate` |

JUN uses this state/owner mapping for the upstream `ready-for-agent`,
`ready-for-human`, `needs-triage`, `needs-info`, and `wontfix` roles, rather than
those labels. Category labels are `Bug`, `Feature`, `Improvement`, and `RFC`
(design discussion). `Triage` and `等回复` are not JUN states. SAOKO workflows use
their own live states and their business SOP.

## GitHub references and cancellation

Use `GH-123` or a full repository URL in Linear text. A bare `#123` can be linked
to the wrong repository by the workspace's GitHub integration.

Cancelling a Linear issue with linked GitHub PRs can close those PRs. Read the
linked PRs and move them to another issue or unlink them before cancellation.
Then verify the issue and the affected PR state. This behavior was observed when
cancelling ENG-149/ENG-151 closed GH-479/480/481 on 2026-10-05.
