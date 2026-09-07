# Reuse Decision Rubric

Use this rubric for architecture-bearing mechanisms or close decisions. It is
guidance, not a scoring algorithm.

## Comparison matrix

| Criterion | Questions |
| --- | --- |
| Semantic fit | Does the option model the required behavior directly, or require wrappers, exceptions, and bypasses? |
| Correctness surface | Which invalid states, races, timeouts, retries, parsing cases, or recovery paths are already handled? |
| Integration cost | How much adapter code, data conversion, configuration, and migration is required? |
| Testability | Can business behavior be tested without depending on package internals or live infrastructure? |
| Runtime and operations | Does it add a service, worker, storage system, deployment unit, monitoring burden, or failure domain? |
| Maintenance | Is ownership active, release history credible, compatibility documented, and the license acceptable? |
| Security and supply chain | What code and transitive dependencies enter the trust boundary? Are advisories and updates manageable? |
| Comprehension | Is the resulting model easier for maintainers to understand than a small explicit implementation? |
| Lock-in and exit | Can package types and concepts remain behind a seam? What data or workflow migration would removal require? |
| Total owned complexity | After adapters, operations, tests, and edge cases, which option leaves the team owning less risky complexity? |

Record qualitative evidence. Do not manufacture numeric precision when the
inputs are uncertain.

## Decision signals

### Signals for adopting

- The problem has a broad, well-understood specification or many edge cases.
- A candidate closely matches the required semantics.
- Correctness, interoperability, or security benefits from broad use and review.
- The project already depends on the candidate or an equivalent abstraction.
- The dependency remains in-process and can be isolated cheaply.
- Reimplementing it would recreate a protocol, parser, scheduler, concurrency
  primitive, or lifecycle engine.

### Signals for building

- The behavior is small, closed, synchronous, and stable.
- Its complete transition or input space can be enumerated and tested.
- Mature options impose a larger mental or operational model than the problem.
- Available candidates fundamentally mismatch the domain or runtime.
- The code is business policy rather than a reusable technical mechanism.
- A local implementation has a clear deletion or replacement path.

Small line count alone is not evidence for building.

### Signals for a hybrid

- A mature engine handles lifecycle or mechanics well, but domain rules are
  specific.
- Package types would otherwise spread through the codebase.
- Several integrations need one stable application contract.
- The team needs the option to migrate engines without rewriting business logic.

The usual shape is:

```text
business use case -> application-owned interface -> package adapter -> engine
```

## State machine and workflow guide

Evaluate three levels rather than asking only “XState or custom?” Names below
are candidate families to verify at decision time, not predetermined answers.

### Small local transition model

Consider a reducer or explicit transition table when the graph is closed and
small, execution is in-process, transitions are synchronous, and there is no
hierarchy, parallelism, cancellation, persistence, or crash recovery. Require
exhaustive invalid-transition tests.

### In-process state-machine library

Research libraries such as XState when guards, actions, invoked work, nested or
parallel states, cancellation, inspection, visualization, or several consumers
make lifecycle behavior difficult to reason about manually.

The library can enforce transition mechanics. It cannot determine whether a
business payload is correct or whether an external system actually committed
the intended change.

### Durable workflow engine

Research durable workflow systems such as Temporal when work must survive
process restarts, wait for external or human events, run across services, or
resume timers and retries over long periods. Include worker deployment,
persistence, versioning, observability, idempotency, and operational ownership
in the comparison.

Do not introduce a durable engine merely to organize a short synchronous
function.

## Commodity utility guide

For dates, validation, parsing, IDs, retry, concurrency limits, caches, and CLI
parsing:

1. Inspect the platform and current dependencies.
2. Verify one or two credible maintained options if the current stack lacks a
   suitable capability.
3. Default to reuse for standards-heavy or edge-case-rich behavior such as
   calendar validation, timezones, cryptography, protocols, serialization, and
   structured schemas when a suitable implementation exists.
4. Still isolate domain-specific formats, validation policy, and error messages
   behind application-owned functions.

Example: choosing a date library does not eliminate the need to define accepted
formats, timezone semantics, invalid-input behavior, and serialization rules.
It does eliminate the need to recreate calendar validation and leap-year logic.

## Evidence quality

Prefer:

- Official documentation and compatibility tables.
- Registry metadata and release history.
- Source repository releases, issues, and maintenance activity.
- Published security advisories and license text.
- Existing usage and tests in the local codebase.

Treat comparison articles, popularity rankings, generated package lists, and
memory as discovery aids only. Verify decision-critical claims at primary
sources.

## Revisit triggers

State what would overturn the decision, for example:

- The transition graph gains concurrency, nesting, or cancellation.
- Work must resume after a process restart.
- A second integration needs the same mechanism.
- Custom edge-case tests grow faster than business behavior.
- The dependency becomes unmaintained, incompatible, insecure, or operationally
  expensive.
- Package concepts begin leaking beyond the adapter boundary.
