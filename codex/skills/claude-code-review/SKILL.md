---
name: claude-code-review
description: Recreate Claude Code's high-signal pull-request review workflow with eligibility checks, scoped instruction compliance, independent diff bug reviews, validation, and optional GitHub comments. Use when the user explicitly asks for Claude Code Review, the Claude /code-review behavior, $claude-code-review, or this specific high-signal PR workflow.
---

# Claude Code Review

Review a GitHub pull request and report only validated, high-confidence issues introduced by its diff. Read-only terminal output is the default; post to GitHub only when the user supplies `--comment` or explicitly asks to publish the review.

## 1. Resolve and qualify the pull request

1. Resolve the PR from the user's URL or number, or from the current branch with `gh pr view`.
2. Read its state, draft status, author, title, description, head SHA, changed files, diff, and existing comments or reviews.
3. Stop without reviewing when the PR is closed, draft, clearly trivial or automated, or already has a review produced by this workflow. Do not treat unrelated comments as a prior review. Claude-generated PRs are still eligible.
4. If the PR cannot be resolved, ask for its URL or number rather than guessing.

Use the GitHub connector when available; otherwise use authenticated `gh` commands. Every call must serve a required review step.

## 2. Gather scoped guidance and intent

1. Find the root instruction files and the instruction files in parent directories of modified files. Consider scoped `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and explicit coding-standard files.
2. Apply a rule to a changed file only when that rule's directory scope covers the file.
3. Capture the PR title and description as the statement of intent. Give them, the diff target, and the applicable instruction paths to every reviewer.
4. Summarize the change briefly before evaluating findings.

## 3. Run independent review lanes

Launch up to four independent reviewers in parallel. If concurrency is limited, run the remaining lanes sequentially rather than dropping them.

1. Instruction compliance reviewer A: audit only clear violations of scoped repository instructions.
2. Instruction compliance reviewer B: independently repeat the same audit to reduce misses.
3. Diff bug reviewer: inspect the diff itself for definite, significant correctness failures.
4. Introduced-code reviewer: look for unambiguous logic, security, state, or integration failures caused by the changed lines.

Each reviewer returns a list of candidate issues with the affected file and lines, evidence, and why it is a bug or an exact instruction violation.

## High-signal threshold

Keep only issues where the evidence shows the introduced code will fail or clearly violate an applicable, quotable rule. Examples include an unambiguous wrong result, broken control flow, unsafe state transition, unresolved runtime reference, or exact scoped-instruction breach.

Do not report:

- pre-existing problems;
- style or general code-quality preferences;
- speculative failures that depend on unknown inputs or state;
- missing tests or documentation unless scoped instructions explicitly require them;
- matters already silenced by an applicable ignore directive;
- routine formatter, linter, or CI output masquerading as review insight;
- any issue that cannot be tied to changed code.

When uncertain, omit the finding. False positives are more harmful than a short review.

## 4. Validate every candidate

For every candidate, run an independent validation pass with the PR title, description, relevant diff context, candidate explanation, and scoped instruction text when applicable.

The validator must confirm:

1. the issue is introduced by this PR;
2. the cited lines actually cause the stated failure;
3. any instruction rule is exact, applicable to this file, and truly violated;
4. the issue is significant enough for a senior reviewer to raise;
5. the proposed fix addresses the cause without requiring unstated follow-up work.

Discard every candidate that fails any check. Deduplicate issues by root cause.

## 5. Report or publish

Before publishing, repeat the eligibility check so a newly closed, draft, or already-reviewed PR is not commented on.

- Without `--comment`, list each validated issue with a concise explanation and code location. If none remain, say: `No issues found. Checked for bugs and repository-instruction compliance.` Then stop.
- With `--comment` and no issues, post one concise `## Code review` summary with the no-issues sentence.
- With `--comment` and issues, prepare the full comment set before posting. Publish one inline comment per unique issue when the available GitHub tooling supports it; otherwise post one concise review summary containing all findings.
- Use a committable suggestion only when the small suggestion completely fixes the issue. For larger or multi-location fixes, describe the correction without a suggestion block.
- Never post duplicate comments.

For GitHub code links, use the repository name, full head SHA, file path, and an `#Lx-Ly` range with nearby context. Do not leave shell substitutions in a URL.

## Boundaries

- This workflow reviews; it does not edit the code unless the user separately asks for fixes.
- Do not run linters or test suites merely to manufacture findings. Use direct evidence from the diff and necessary surrounding context.
- Do not publish comments without explicit authorization.

## Provenance

This is a Codex adaptation of Anthropic's Claude Code `code-review` workflow. See [references/origin.md](references/origin.md) for source and adaptation notes.
