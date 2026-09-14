# Verification evidence for functional PRs

Use the project's verification skill and existing operations when verification
is part of the task. Evidence should show the claimed behavior, not just that a
command ran successfully. Loadable inputs, zero output differences, and green CI
do not by themselves establish a business result.

Prefer real data that reaches the changed path when the repository or a frozen
local copy provides it. Use the relevant entities, periods, and before/after
values, including material adverse effects. Synthetic cases may supplement this
but cannot stand in for real-data acceptance. If that path lacks real data or
has not been exercised, state the gap and reason when known; narrow the claim
rather than presenting constructed examples as proof. The coding-protocol
verification reference governs the verification work itself.

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
