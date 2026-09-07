---
name: reuse
description: Compare existing capabilities, dependencies, and custom code when choosing how to implement a reusable technical mechanism.
---

# Reuse

Choose the option that leaves the project owning the least unnecessary complexity.
Apply this comparison to a real implementation choice, not every mention of
caching, validation, scheduling, or another common mechanism.

Inspect the standard library, current dependencies, and existing internal
implementations first. If they meet the need, explain that briefly and proceed.
When the choice is consequential or the current stack lacks the capability,
verify credible maintained alternatives using current primary sources.

Compare semantic fit, integration and operating cost, correctness, maintenance,
and the cost of replacement. Business policy stays with the application; a
library can own the reusable mechanics. A small standards-heavy implementation
can still hide substantial calendar, protocol, security, or concurrency risk.

Read [references/decision-rubric.md](references/decision-rubric.md) for close
choices, durable workflows, or dependencies that materially change architecture.

Choose adopt, build, or a combination. A short explanation with inspected paths
or sources is usually enough. Use a fuller comparison only when the tradeoff
needs it; do not manufacture alternatives or a planning section for a settled
choice.

Keep package details local where that protects a meaningful boundary. An adapter
and extra contract tests are useful when they reduce coupling or verify a real
integration risk, not as mandatory wrappers around every dependency.

Proceed within existing authorization. Introducing paid infrastructure, a new
service, or a new security boundary requires agreement when it expands the
requested operating scope.
