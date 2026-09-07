---
name: writing-for-agents
description: Write or revise skills, agent instructions, and the reference documents they point to.
---

# Writing for Agents

Include information that changes decisions: project conventions, non-obvious
constraints, useful commands, and the evidence needed to finish the task.
Capable models generally need little instruction on routine reasoning or care.

State the purpose and applicability early. A context pointer should say when its
target matters, not enumerate every related keyword. For skill packaging and
invocation metadata, read [SKILL-MECHANICS.md](SKILL-MECHANICS.md).

Keep essential common guidance in the entrypoint. Move substantial branch-specific
procedures, schemas, and examples to references with conditional links.
A short single-purpose document needs no extra routing layer.

Describe outcomes and decision boundaries. Prescribe an exact sequence only when
ordering protects a real invariant. Reuse existing authorization and let routine
reversible work proceed; ask only for a missing material decision or authority.

Choose completion conditions that match the user's whole request. Avoid arbitrary
session limits, mandatory pauses after a first implementation, and fixed counts
of hypotheses, tests, or agents.

Use the project's existing vocabulary and a single source for each rule.
Prefer inspected configuration over copying changeable facts into prose. Preserve
business and security constraints even when removing generic advice.

Review the result against realistic tasks: would it activate at the right time,
load only relevant detail, and help complete the work? Check links and metadata.
Change instructions for demonstrated problems; avoid accumulating universal rules
for every isolated example.
