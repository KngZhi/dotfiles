---
name: git-commit
description: Create a Git commit from the requested changes, using the repository's commit conventions and precise staging.
license: MIT
allowed-tools: Bash
---

# Git Commit

Inspect status, the staged diff, and relevant unstaged changes. Determine which
files belong to the requested commit; preserve other work and existing staging.
An existing staged diff is evidence of intent, not permission to include unrelated
changes or secrets.

Stage exact paths or selected hunks. Verify the final staged diff before committing.
If the repository has no different convention, use Conventional Commits:

```text
<type>[optional scope]: <imperative summary>

<reason or material detail, when useful>
```

Common types are `feat`, `fix`, `docs`, `refactor`, `test`, `chore`,
`build`, and `ci`. Use `!` or a `BREAKING CHANGE:` footer for an intentional
breaking contract. Keep the subject concise and let the diff determine scope.

Use a safely quoted message or a message file. Run normal hooks. If a hook fails,
fix the in-scope failure, inspect staging again, and retry without bypassing it.
Do not amend or rewrite history unless requested.

Report the resulting commit and any remaining changes. A commit request alone
does not authorize a push.
