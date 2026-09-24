# Shared agent instructions

## Local tools

- `in2csv` prints a local `.xls` / `.xlsx` sheet as CSV. Python `openpyxl` reads
  cells, formulas, and merged ranges but does not recalculate formulas. Read saved
  workbooks from the file; use Computer Use for necessary UI work, not to copy
  cells out of an existing file.
- `trello` ([mheap/trello-cli](https://github.com/mheap/trello-cli)) is installed
  and authenticated for Trello boards, lists, and cards.

## Pull request size and stacks

This section applies only to work that will land as a pull request. Direct
commits to a repository with no PR workflow (these dotfiles, for example) are
exempt.

Before implementation, estimate the added source lines and record the intended
PR boundary in the working plan. The default budget is about 300 added source
lines per PR, excluding tests, documentation, and lockfiles, unless the target
repository or issue states a different budget.

Begin implementation only when the estimate fits that budget or a linear stack
has been created with `gh stack`. Each PR owns one coherent concern, remains
independently reviewable, and passes its own CI. Put foundational changes at the
bottom and dependent changes above them. Use separate stacks for independent or
parallel work.

When the work requires a stack and `gh stack` is unavailable, report that
constraint before implementation. A size-approval label or removing substantive changes
is not a substitute for splitting; only a human may approve an irreducibly
large PR such as a generated-code or mechanical-rename change.

## Local secrets for agents

Shared local credentials (for example `NODE_AUTH_TOKEN`, the GitHub Packages
read token that `.npmrc` files in this user's repositories expect) live in
1Password and are rendered into `~/.config/agent-secrets/agent-secrets.env`
by `refresh-agent-secrets`; `~/.zshenv` sources that file for every shell, so
they are already in your environment. If one is missing, run
`refresh-agent-secrets` (needs the 1Password app; it may prompt Touch ID) or
ask the user. Never print or copy the rendered file, and add new shared
secrets as `op://` references in `~/.config/agent-secrets/agent-secrets.env.tpl`,
never as literals.
