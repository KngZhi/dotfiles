---
name: setup-matt-pocock-skills
description: Configure shared issue-tracker, triage-label, and domain-document conventions for a repository.
disable-model-invocation: true
---

# Configure Repository Workflows

Inspect existing agent instructions, tracker configuration, repository remotes,
and document conventions. Reuse them and preserve surrounding user content.

Resolve the tracker from the request or repository. Ask only when there is a
real choice. Use the matching seed:
- [issue-tracker-github.md](issue-tracker-github.md)
- [issue-tracker-gitlab.md](issue-tracker-gitlab.md)
- [issue-tracker-local.md](issue-tracker-local.md)

Record the chosen workflow in `docs/agents/issue-tracker.md`. Keep existing
organization-wide conventions, including shared Project fields, authoritative.
Leave optional PR triage disabled unless requested.

If triage is used, record existing label mappings in `docs/agents/triage-labels.md`,
using [triage-labels.md](triage-labels.md) as a seed. Create or change remote labels
only when that external setup is included in the request.

Use [domain.md](domain.md) for relevant document pointers. Preserve an existing
layout; a single glossary and decision-record directory is sufficient unless the
repository actually has multiple bounded contexts.

Add concise conditional pointers to the existing shared agent-instruction source.
If neither AGENTS.md nor CLAUDE.md exists, AGENTS.md is a suitable default; ensure
the intended hosts can read the chosen source. Do not replace existing files or
duplicate a shared instruction through both entrypoints.

Verify the written links and explain the conventions established. Routine local
configuration covered by the request needs no additional draft-approval stage.
