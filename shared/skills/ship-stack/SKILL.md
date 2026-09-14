---
name: ship-stack
description: Land a stack of pull requests safely. Record an independent PASS/FAIL verdict per PR bound to its patch-id, invalidate verdicts when a rebase or retarget changes the patch, and merge only the contiguous verified run from the bottom.
---

# Ship a stack

Green checks are not a verdict. This skill separates three things that get
conflated on a stack: CI passed, a reviewer who did not write the code verified
the behavior, and the verified patch is still the patch about to merge.

## Verdicts

A verdict is `PASS`, `PASS+NOTES` or `FAIL` for one PR, produced by a session
that did not write the code, exercising the real surface (the repository's own
verification skill, or the change's tests plus a live run when no skill exists).
`scripts/stack-verdict.sh record <pr> <verdict> "<who> <evidence>"` stores the
verdict with the PR's base SHA, head SHA and the `git patch-id` of the
base-to-head diff. The patch-id is the identity: a rebase or retarget that
changes the diff invalidates the verdict, a rebase that leaves the diff
identical does not.

## Steps

1. List the stack bottom-up. `gh pr view <pr> --json baseRefName,headRefName`
   for each layer; the bottom PR targets trunk.
2. Verify each unverified PR independently. Spawn one fresh session per PR
   (`claude -p` or `codex exec`, never the session that wrote it) in a detached
   checkout of the head, told to run the repository's verification procedure
   against the parent and report `PASS`, `PASS+NOTES` or `FAIL` with evidence.
   Record the result with `stack-verdict.sh record`. Post the verdict as a PR
   comment when the user has authorized publication.
3. `scripts/stack-verdict.sh landable <pr>...` (bottom-up) prints the contiguous
   run whose verdicts pass and still match the current patch-id, and names the
   ceiling: the first PR that is unverified, failed, or whose patch changed.
4. Land only that run, one PR at a time from the bottom: `gh pr merge --squash`
   (or `--auto` when the user asked for merge-when-ready). After each merge,
   fetch trunk, re-run `landable`; a host may retarget the next PR automatically
   but the patch-id check decides, not the retarget.
5. Never rebase or force-push a published branch to make the stack land. Absorb
   trunk with a merge commit; the verdict stays valid only if the patch-id is
   unchanged, otherwise re-verify.
6. Stop at the ceiling and report: what landed, what the ceiling is, and what
   verifying it needs.

## Doctor

- `gh auth status` succeeds and the repository resolves from the current directory.
- `git fetch origin` is current; `landable` reads origin refs, not local branches.
- Verdicts live in `${STACK_VERDICT_DIR:-$HOME/.local/state/stack-verdicts}/<owner>-<repo>/`.

## Evidence

Each verdict file records the verdict, who produced it, the evidence summary,
base SHA, head SHA and patch-id. `landable` output plus those files is the
shipping record; quote it in the merge message or the tracking issue.
