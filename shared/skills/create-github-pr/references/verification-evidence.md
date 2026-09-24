# Verification evidence for functional PRs

Use the project's verification skill and existing operations when verification
is part of the task. The coding-protocol verification reference governs the
verification itself, including real data before synthetic cases and old-versus-new
output comparison. This file covers presenting that evidence to a reviewer.

Evidence should show the claimed behavior, not just that a command ran successfully.
Loadable inputs, zero output differences, and green CI do not by themselves
establish a business result. Use the relevant entities, periods, and before/after
values, including material adverse effects. When the changed path lacks real data
or was not exercised, state the gap and narrow the claim; label synthetic cases.

For a new command or claimed capability, give a representative invocation and
observed result, explaining what the operation and result mean. Use actual
commands, define variables, and label abbreviated output. Do not change code
merely to make a PR command shorter. Link longer logs and input provenance.

Distinguish current evidence from historical, synthetic, or dirty-run evidence.
Record the tested revision and relevant fixed inputs/time for comparisons. An
artifact path alone is not a result: explain the observed behavior it supports.
For UI claims, state whether the actual UI consumed the candidate output; video
is useful when it adds evidence, not mandatory for every PR.

Summarize automated checks as supporting evidence. State important unverified
paths, such as real business dates, units, balances, or deployment. A
documentation-only change needs relevant review or validation, not a full
business replay.
