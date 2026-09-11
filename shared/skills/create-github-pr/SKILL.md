---
name: create-github-pr
description: Create or update GitHub pull requests with concise descriptions of delivered functionality, impact, and observed verification results.
---

# Create GitHub PR

Write for a reviewer who has not read the conversation. Explain what the PR
delivers, why it matters, and what actual evidence supports its claims. Use `gh`
for publication and read back the result before reporting success.

## Resolve the change

Read repository instructions and any PR template, inspect the diff against the
intended base, related Issues, existing PR, and available verification evidence.
Use the final implementation as authority for the title and description.

Update the existing PR for follow-up work on the same feature, including file
moves, entrypoint changes, and description corrections. Do not create another PR
merely because a new conversation turn requested the adjustment. Follow the
repository's size and stack rules when splitting is actually needed; use
`gh-stack` for dependent layers. Do not merge or close unrelated PRs.

A request to rewrite a description authorizes that edit, not additional code
changes. A request to submit a PR authorizes pushing the intended branch and
creating or updating its PR. Do not ask again for already authorized publication.

## Write the description

Lead with the delivered capability and its effect. Name the user or Agent action
that is now possible; explain a concrete before/after when useful. Use plain
language and semantic commands. Explain unfamiliar operations such as `doctor`
or `run` instead of assuming the command names explain their purpose.

Keep the body short. Use a paragraph or a few parallel bullets for functionality
and impact, followed by representative verification. Respect the repository's
template; otherwise use this shape in the user's language:

- **What changed:** what the feature does or what behavior was fixed.
- **Impact:** how this helps the user or subsequent work.
- **Verification:** actual action/command, observed result, and its meaning.
- **Limits:** material unverified behavior or risks, only when applicable.

These are content prompts, not mandatory headings for every small PR. Omit
implementation inventories, chronological progress, abandoned approaches,
repeated conclusions, long setup instructions, and full test logs. Include a
file path or technical detail only when it helps assess the change or a risk.
When scope changes, rewrite the description around the final result rather than
appending a history of corrections.

## Show evidence that answers the claim

Use the project's verification skill and existing operations when available.
For a new command or independently claimed capability, describe what it does and
include an actual result that demonstrates it. One short end-to-end example can
cover several capabilities; do not leave operations listed without evidence.
For documentation-only changes, a review or relevant validation is sufficient.

Prefer a short semantic command and a small output excerpt, followed by what the
result establishes. Define variables such as `$snapshot`; if paths are shortened
or output is excerpted, say so. Link longer evidence instead of pasting it. Do not
invent a shorter command that does not exist, or modify code merely to shorten
the PR's example without authorization.

For example, an inventory PR can show a real `inspect` invocation and the returned
SKU/month stock and order values. An input-check result establishes loadability
and reports data date; a successful run produces a snapshot that can be inspected.
State those observations explicitly. A receipt path alone does not demonstrate
that a business expectation was met.

Only call output observed when it was actually executed and inspected. Identify
the tested commit; label older or dirty-run evidence accurately. Separate
expected examples from actual results. Never invent numeric results or reuse
stale evidence as proof of the latest change.

Tie observations to the claimed behavior: successful execution does not by itself
prove a bug fixed, and zero differences do not prove the business result correct.
A real E2E assertion can be valid runtime evidence; video is useful when it helps
review the behavior, not an obligatory extra for every PR.

Summarize relevant automated checks briefly as supporting evidence. “CI is green”
or a test count alone cannot replace the action and observed behavior for a
functional claim. State material limits concisely, such as an untested UI or
outdated input data. Keep operational data and secrets out of public evidence.

## Publish and verify

Resolve the repository, branch, base, and existing PR with `gh`. Preserve the
existing PR's draft state; create new PRs as drafts unless requested otherwise.
Use a structured API or a safely written body file with `gh pr create` /
`gh pr edit --body-file`. Avoid interpolating Markdown into shell commands.

Link related Issues. Use `Closes #N` only when this PR actually resolves that
Issue; tooling that helps investigate a bug should reference it without closing
it. Keep PRs out of the shared Project as standalone items.

After publication, use `gh pr view` to verify the URL, title, body, base/head,
commit, and draft state. If a later step fails, retry that step against the same
PR rather than creating a duplicate. Report the PR URL and publication state;
distinguish local changes, pushed commits, pending CI, and merged code accurately.
