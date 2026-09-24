---
name: local-review
description: Run Simplify, Code Review, and Linus Review over the current worktree through local Claude Code and Codex when the user invokes local review.
disable-model-invocation: true
---

# Local Review

Coordinate three local passes over the user's current work. Use the existing
worktree, including in-scope uncommitted changes. No PR or Trigger task is needed.
This workflow explicitly authorizes local CLI delegation; children perform their
assigned pass directly without invoking this workflow or delegating again.

## Roles

| Pass | Default runtime | Skill | Access |
| --- | --- | --- | --- |
| Simplify | Claude Code | `claude-simplify` | Scoped edits |
| Code Review | Codex | `code-review` | Read-only |
| Linus Review | Claude Code | `linus-review` | Read-only |

Honor the user's runtime assignment and configured model/effort. Do not silently
replace Claude Code with a same-runtime subagent, or vice versa. The ordinary
`code-review` skill supports local diffs; a PR-only review workflow is not required.
Resolve each role's installed SKILL.md and give the child its absolute path;
`claude-simplify` is deployed only under `~/.codex/skills`, whichever runtime runs it.
If a required runtime or skill is missing, report the missing pass rather than
claiming the whole workflow completed.

## Establish the shared target

Resolve the physical worktree path and relevant repository instructions. Preserve
the user's current checkout: do not clone, switch branches, create a worktree, or
pass either CLI's `--worktree` option. This also applies to Simplify and later fixes.

Derive the comparison and allowed files from the active task. For branch work,
record the merge-base with the intended base branch and include subsequent staged,
unstaged, and relevant untracked changes. For a request limited to local edits,
use that scope instead. Do not assume `HEAD` alone describes a dirty worktree or
guess `master`/`main` when the intended base is unclear. Ask only if the ambiguity
materially changes what gets reviewed.

Create a unique artifact directory outside the target repository. Retain the
resolved path, base/head SHAs, scoped diff, untracked file inventory, and content
hashes of reviewed files. Include applicable intent/specification and verification
already performed. Keep unrelated user changes outside Simplify's edit scope.
Do not copy credentials or unrelated private data into prompts or artifacts.

Read [references/cli.md](references/cli.md) when launching the local processes.
Give each child a self-contained prompt with its role, skill path, worktree,
comparison, allowed files, task intent, and required result. Make clear that the
child reports to the coordinator, not GitHub or the user in another channel.

## Execute without overlapping writers

1. Run Simplify alone. The coordinator pauses edits while it runs. For an
   explicitly read-only request, Simplify reports suggestions without editing.
   A normal full invocation authorizes behavior-preserving cleanup of the scoped
   changes. It does not authorize commits, pushes, or external publication.
2. Inspect Simplify's result and actual diff. Resolve scope or behavior concerns
   before continuing, preserving unrelated edits. Run the relevant existing checks;
   a child's claimed test result is not a substitute for retained command evidence.
3. Capture the resulting diff and content hashes again. Launch Code Review and
   Linus Review concurrently against this same state, with separate output/log
   files. The coordinator and Simplify must not edit during these reviews. Ask the
   reviewers to inspect code only; the coordinator owns tests that write artifacts.
4. Wait for both processes to terminate and inspect their exit status and output.
   Compare head, index/worktree diffs, file inventory, and content hashes with the
   captured state. If the user or another process changed the target, treat affected
   results as stale and re-establish the scope before relying on them. Never undo
   external changes to restore a snapshot.

Each reviewer returns the scope it actually inspected, validated findings with
file/line, trigger, consequence, and suggested correction, plus coverage gaps.
Separate defects from design suggestions. Each reviewer also names the one fact
the change is safe because of, graded by the evidence levels in the coding-protocol
verification reference, which also defines what is reported as unproven. Zero
findings is valid; missing output, permission failures, and incomplete coverage
are not a clean review.

## Return to the coordinator

Read both reports, verify candidates against the code and task contract, and
deduplicate by root cause. Keep the raw reports and explain material disagreements.
Runtime completion alone is not a correctness verdict.

If the reviewed diff replaces how existing output is produced, the coordinator
runs the old-versus-new output comparison from the coding-protocol verification
reference after any fixes, or states why it could not run. A clean review without
either is not complete.

In a full invocation, repair verified in-scope defects and run the appropriate
checks. For a review-only request, return findings without fixes. Do not expand
scope merely to satisfy a stylistic suggestion. After fixes, recheck affected
findings and use a focused reviewer follow-up when needed; do not blindly restart
all three passes. Changes after review must be distinguished from the reviewed
snapshot. If repairs do not converge or require a business decision, report what
remains instead of repeating the same loop.

Keep the user informed during long runs. On a failed or interrupted child, confirm
its process has stopped and inspect any edits before retrying; do not create an
overlapping writer or quietly omit the pass. Stop only processes owned by this run.

Finish with runtime/pass completion, meaningful cleanup or fixes, remaining
findings, actual verification, and artifact links. State that work remains local
unless the user separately authorized publication. Invocation examples
(`/local-review` in Claude Code, `$local-review` in Codex):

- No arguments — full workflow on the active task's changes.
- `review only` — all three passes are advisory.
- `use Codex for Simplify and Claude Code for both reviews`.
