---
name: create-github-pr
description: Create or update GitHub pull requests, explaining the behavior change, its impact, and supporting evidence.
---

# Create GitHub PR

Write for a maintainer who has not followed the implementation or conversation.
Help them decide whether the change should land: what problem or need it addresses,
what changes for the user, and which tradeoffs and evidence matter.

## Resolve the change

Inspect the final diff against the intended base, applicable repository guidance
and PR template, related Issues, and available verification. Explain only what
this PR delivers; distinguish changes already in its base or left to other PRs.

Update the existing PR for follow-up work on the same feature. Follow repository
size and stack rules; use `gh stack` when splitting dependent work is necessary.
A description rewrite authorizes the PR edit, not additional code changes. A
request to submit a PR authorizes pushing the intended branch and creating or
updating its PR. Reuse that authorization without asking again.

## Explain the change

For a behavior fix, describe the situation that triggers the old behavior, why
its result is a problem, and how the same situation is handled after the change.
For a feature, explain the need and what the user can now do. For documentation or
behavior-preserving refactoring, explain the actual benefit without inventing a
user-facing failure or behavior change.

Use the reader's business language. Include technical details when they clarify
a meaningful distinction, rather than making an implementation mechanism carry
the explanation. When a rule involves a tradeoff, explain the choice and what
the result no longer guarantees. Do not invent a business rationale absent from
the task or evidence.

If the change is hard to understand in one sentence, use the same small example
before and after. Label illustrative examples separately from executed results.
A simple change may need only a sentence; choose prose, bullets, or a table to
fit the explanation and the repository template, in the user's language.

Then support the explanation with representative verification and material
limits. The behavior change determines the narrative order; evidence determines
which claims are justified. Keep verification proportional to the change and
link detailed commands, logs, and provenance. Rewrite around the final result
when scope changes instead of appending the history of the work.

Before publishing, check whether a reader can explain why the change is needed,
what differs before and after, and any important tradeoff without opening the
code or reading the chat. Resolve missing explanations in the description.

## Support the claims

Report only checks and outputs actually executed and inspected. Identify the
tested revision or dirty worktree accurately; do not present historical results,
illustrative numbers, or test counts as proof of current business correctness.
Keep secrets and private operational data out of public evidence.

For functional claims requiring runtime, data, or UI acceptance, read
[verification evidence](references/verification-evidence.md). A description-only
rewrite summarizes available evidence and states material gaps; it does not
silently become an implementation or production-acceptance task.

## Publish and verify

Resolve repository, base, branch, and existing PR with `gh`. Preserve an existing
PR's draft state; create new PRs as drafts unless requested otherwise. Use a
structured API or `gh pr create` / `gh pr edit --body-file` with a safely written
body file. Do not interpolate Markdown into shell commands.

Link related Issues. Use `Closes #N` only when this PR actually resolves it.
Keep PRs out of the shared Project as standalone items. Do not merge or close
unrelated PRs.

After publishing, read back the URL, title, body, base/head, commit, and draft
state with `gh pr view`. Retry a failed publication step against the same PR.
Report the PR URL and state accurately, distinguishing pushed from merged work.
