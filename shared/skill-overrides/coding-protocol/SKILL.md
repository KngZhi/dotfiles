---
name: coding-protocol
description: Apply evidence and verification discipline to repository implementation, debugging, and code review.
---

# Coding Protocol

Use this guidance for the repository portion of the request. A focused skill owns
its workflow; this reference adds no separate phases, output template, or approval
layer. Explanations, status, and prose-only work generally need none of it.

Inspect relevant instructions, the target, and its consumers before making claims.
Preserve user work. Resolve routine choices from repository evidence and existing
authorization; ask only when a material unknown changes the intended result or
requires authority the user has not provided.

Complete the requested behavior, including necessary call-site, migration, and
verification work. Keep unrelated improvements out of scope. A small first slice
is not completion when the requested outcome is broader.

When a change introduces a replacement for an existing API, client, data source,
or code path, migrate every caller and delete the old path in the same change.
Do not add a compatibility shim, an adapter that reshapes the new result into the
old one, or a parallel old-and-new path; those preserve the old contract's dead
checks and defeat the migration. If the old contract must be kept for a stated
reason, name the reason and the consumer that needs it.

Verify in proportion to risk and run required repository checks. Start with the
changed behavior; broaden when failures or unresolved concerns warrant it.
A passing check proves only the path it exercises. Do not weaken meaningful
assertions or contracts to get a green result.

Read [references/verification.md](references/verification.md) when designing an
evidentiary check, interpreting indirect evidence, or considering a suppression.

Use uncertainty to direct the next investigation. When an approach stalls, revise
it; stop only at completion or a concrete blocker after safe alternatives are
exhausted. Report findings or changes, verification, and material limitations.
