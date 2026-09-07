---
name: claude-code-review
description: Run a high-confidence PR review when the user requests Claude Code Review or that specific review workflow.
---

# Claude Code Review

Review the requested PR and report only validated issues introduced by its diff.
Read-only output is the default; publish only when the user asks or supplies
`--comment`.

## Establish the target

Resolve the PR from the request or current branch. Read its exact head, diff,
intent, state, and existing reviews. Review a draft, closed, or previously reviewed
PR when that is what the user requested; its state is context, not an automatic
reason to refuse. An automated queue may skip already-reviewed unchanged heads.

Read applicable instructions for the changed paths and enough surrounding code
to judge correctness. Apply a rule only within its scope.

## Review and validate

Assess instruction compliance and introduced correctness failures. For a substantial
diff, independent passes or available reviewers can reduce shared blind spots;
small diffs do not require a fixed number of agents.

For each candidate, verify the changed lines cause a concrete failure or violate
an exact applicable rule. Include the trigger and consequence. Discard speculation,
pre-existing issues, style preferences, and routine lint output. Deduplicate by
root cause. Use tests only when they resolve a material uncertainty.

## Report or publish

Give each validated issue a concise explanation and precise location. Zero findings
is a valid result; state material coverage limitations.

Before publishing, recheck the PR head and existing comments. Revalidate findings
if the head changed and avoid duplicate comments. Publish inline when supported,
otherwise as one summary. A suggestion block must completely fix its local issue.
Use code links pinned to the reviewed full commit SHA.

Review does not authorize editing the implementation. Publication does not authorize
merging or changing PR state.

For provenance, see [references/origin.md](references/origin.md).
