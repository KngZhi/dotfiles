---
name: reuse
description: Force an evidence-backed Build vs. Adopt decision before finalizing any implementation or architecture plan (规划、技术选型) involving a reusable technical mechanism. Use whenever deciding whether to adopt a mature repo, package, library, platform, or internal capability (采用成熟方案), build it locally (自己实现), or combine both. Trigger for state machines, workflows, orchestration, queues, schedulers, retries, cancellation, crash recovery, caching, concurrency, date/time parsing, validation, authorization, persistence, observability, or any plan that may hand-roll an established pattern. 中文触发包括状态机、工作流、任务编排、队列、调度、重试、取消、进程重启恢复、持久化、日期解析，以及“用成熟 package/repo 还是自建”。
---

# Reuse

Make reuse a deliberate architecture decision, not a reflex. Compare mature
solutions with local implementation before committing the plan.

## Workflow

### 1. Identify the decision surfaces

Separate reusable technical mechanisms from business policy.

- Treat state progression, retry, scheduling, parsing, validation, caching,
  concurrency, transport, and persistence as possible reuse surfaces.
- Keep domain vocabulary, invariants, payload semantics, authorization policy,
  and external-system postconditions owned by the application.
- Evaluate each architecture-bearing surface separately. Do not let one package
  choice silently decide unrelated parts of the design.

A choice is architecture-bearing when it affects persistence, process
lifecycle, concurrency, failure recovery, security, cross-module interfaces,
operations, or future migration.

### 2. Inspect the local baseline

Before searching externally, inspect:

1. Platform or standard-library capabilities.
2. Dependencies already used by the project.
3. Internal packages, services, and adjacent implementations.
4. Repository constraints: runtime, module system, deployment model, supported
   environments, licensing, bundle limits, and operational ownership.

Prefer extending a sound existing convention over introducing a competing
abstraction.

### 3. Research credible mature options

For an architecture-bearing decision, verify current candidates during
planning. Use primary evidence where available: official documentation,
package registries, release history, repository activity, security advisories,
license text, and compatibility documentation.

- Shortlist only candidates that plausibly fit the actual semantics.
- Include a mature library, repository, platform, or internal capability when
  one exists.
- Include local implementation as a real alternative.
- Consider a hybrid: mature mechanism behind an application-owned interface.
- Do not use popularity, download counts, or a long feature list as the sole
  justification.
- If adopting code from a repository rather than a maintained package, account
  for vendoring, updates, provenance, and fork ownership.

### 4. Compare total owned complexity

Compare semantic fit, correctness coverage, integration code, testing,
operational footprint, maintenance health, security, lock-in, migration cost,
and team comprehension. Count the adapter, infrastructure, and failure modes
introduced by a dependency; count the edge cases and long-term maintenance
introduced by custom code.

Read [references/decision-rubric.md](references/decision-rubric.md) when the
choice is architecture-bearing, the options are close, or a state machine or
durable workflow is involved.

### 5. Choose one of three outcomes

- **Adopt** when the semantics align and the mature solution removes materially
  more complexity and risk than it introduces.
- **Build** when the behavior is small, closed, stable, exhaustively testable,
  and a dependency would add disproportionate conceptual or operational cost.
- **Hybrid** when a mature engine solves the generic mechanism but the
  application must retain its own domain model, invariants, and integration
  contract.

Low-impact, in-process utilities can receive a concise decision. Dependencies
that add services, workers, persistent infrastructure, paid systems, security
boundaries, or a new runtime require a full comparison and explicit user
approval before that operational expansion.

For standards-heavy, edge-case-rich utilities—especially date/time handling,
timezones, security and cryptography, protocols, serialization, and structured
validation—default to a platform capability or maintained library when one fits.
Keep application-specific input formats and policy in a small wrapper. Do not
classify such work as safe to build merely because the first implementation is
short.

### 6. Put the dependency behind a deep seam

When adopting:

- Expose an application-owned interface in domain language.
- Isolate package types, configuration, and lifecycle in one adapter or module.
- Test business behavior through the application interface.
- Add focused contract tests around the dependency boundary.
- Preserve an exit path; do not leak vendor concepts through unrelated modules.

The package owns the reusable mechanism. The application owns business truth.

## Required planning output

Before finalizing the plan, include a `Build vs. Adopt` section for every
material decision surface:

```markdown
### Build vs. Adopt: <mechanism>
- Need: <semantics and constraints>
- Local baseline: <standard library, existing dependencies, internal options>
- Candidates: <mature options and local implementation>
- Comparison: <fit, complexity removed/added, operations, maintenance, exit cost>
- Decision: Adopt | Build | Hybrid — <why>
- Boundary: <where the seam belongs and what remains application-owned>
- Revisit if: <conditions that would change the decision>
- Evidence: <current primary sources or inspected repository paths>
```

For a low-impact utility, compress this to two or three sentences. Never omit
the decision silently merely because custom code appears short.

## Guardrails

- Do not search for a package to replace business-specific rules.
- Do not install first and justify later.
- Do not reject a dependency only because it is larger than a local prototype;
  compare the edge cases it already handles.
- Do not adopt a framework when most of the implementation would bypass it.
- Do not mistake a green happy path for evidence that custom lifecycle logic is
  simple.
- Do not hand-roll calendar validation, timezone behavior, cryptography,
  protocols, or other standards-heavy mechanics when a suitable maintained
  implementation is available.
- Do not claim a candidate is mature from stale knowledge; verify facts that
  can change.
