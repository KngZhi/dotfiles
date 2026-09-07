---
name: to-tickets
description: Split an agreed plan into independently verifiable tickets with dependencies, saving or publishing them as requested.
disable-model-invocation: true
---

# To Tickets

Work from the conversation, specification, and relevant repository evidence.
Each ticket owns a coherent outcome, acceptance criteria, and actual blockers.

Prefer small vertical slices that can be verified independently. For a wide
mechanical migration, use expand, migrate, and contract phases when needed to
keep each landing coherent. Respect the repository's PR size and CI requirements.

Choose granularity from risk and reviewability, not a model's fixed context size.
Explain meaningful sequencing choices. Ask about the breakdown when it changes
scope or resolves a material user decision; reuse approval already given.

Use the configured tracker or requested local location. Without a tracker,
local Markdown tickets are enough; installation of another skill is unnecessary.
For GitHub issues in a KngZhi repository, follow create-github-issue's body and
Project conventions.

Publish only within the requested workflow. Create blockers first, then link
dependents using native relationships when available. Verify the created artifacts
and relationships. If a later operation fails, resume from the existing tickets
instead of creating duplicates. Preserve the parent issue unless its update
was included in the task.
