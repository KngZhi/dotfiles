---
name: code-review
description: Review a PR, branch, commit range, or uncommitted changes against its intended behavior and repository standards.
---

# Code Review

Resolve the requested comparison from the user, PR metadata, or current branch.
Ask only when the base or scope is materially ambiguous.

Choose the diff that includes the requested work:
- Branch or PR: compare its merge-base with the exact head.
- Staged changes: inspect the cached diff.
- Uncommitted work: inspect staged and unstaged diffs plus relevant untracked files.
- A named commit range: use that range's intended semantics.

Record the reviewed head and any uncommitted scope. An empty commit diff does not
prove the working tree has no changes.

Use the request, PR description, linked issue, or supplied spec as intent.
Search nearby artifacts when needed. If no formal spec exists, assess against
the available intent and state the limitation; a tracker setup is not a prerequisite.

Read standards that apply to the changed paths. Review correctness and compliance
with those standards; code smells are suggestions, not defects by themselves.
Independent review passes may help a substantial diff when delegation is available,
but no fixed agent count or duplicate compliance pass is required.

Validate each finding against the code and its consumers. Distinguish a verified
defect, a requirements gap, and a design suggestion. Rank material findings by
consequence, cite the relevant locations, and describe the trigger. Omit speculative
or tooling-only findings. Zero findings is valid.

Review requests stay read-only. Publish comments or edit code only within the
user's requested workflow.
