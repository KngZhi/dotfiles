# Issue body details

Read the sections that apply to the Issue being written. The body rules in
`SKILL.md` still govern.

## Worked example

An illustrative SKU A100 has 100 units still expected: 60 matched to
replenishment commitments and 40 still unmatched. Its code changes to A100-NEW.

- Before: 60 units appear under A100-NEW and 40 under A100, so viewing the new
  code shows only part of the product's incoming supply.
- Change: identify both portions by the stable product ID and display the
  current product code.
- After: all 100 units appear under A100-NEW; quantities, allocation status,
  and arrival dates stay the same, and original order details remain traceable.
- Benefit: people can assess the product's full supply when checking orders or
  planning replenishment, without manually piecing together old and new codes.

## Investigation context under References

References may carry optional context for the implementing Agent: reproduction
inputs, evidence, relevant entrypoints, and necessary business constraints.
Keep it concise and distinguish observed behavior from causal hypotheses and
implementation suggestions. Ask the implementing Agent to verify hypotheses, and
allow a better explanation or solution when evidence supports it.

Do not turn prior exploration into a mandatory formula, field design, file list,
or test implementation. Acceptance criteria constrain outcomes; established
business rules constrain boundaries. Include implementation details only when
they are necessary constraints, not speculative task lists, and identify
explicitly authorized technical constraints as such.

## Verification and evidence

Inspect the repository's verification skill when available and link it under
References. Reuse its project operations rather than copying its setup, long
commands, or reporting procedure into the Issue. Do not require a new script,
application, or per-Issue verification wrapper by default.

A real E2E assertion can supply evidence for a required behavior; screenshots or
videos are not mandatory for every task.

When specifying a tool, say what each operation does and what observable result
shows it worked. For example, an input check reports validation status and data
date; a prediction run produces a readable snapshot. Neither alone establishes
that a particular business bug is fixed.

When the Issue needs an explicit evidence requirement, keep it to one criterion:
show a representative action or short command, its actual result, and how that
result meets the acceptance criteria. The eventual completion report should
state what changed, before/after results, evidence, and unverified paths. Keep
full logs in linked evidence; do not expand the Issue into a verification manual.
