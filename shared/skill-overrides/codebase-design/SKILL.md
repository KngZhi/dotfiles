---
name: codebase-design
description: Design module interfaces and responsibilities when the user asks about boundaries, coupling, or testability.
---

# Codebase Design

Favor modules that expose a small understandable interface while owning substantial
coherent behavior. Judge the benefit to callers and maintainers, not a ratio of
implementation lines to interface lines.

An interface includes the facts callers must know: inputs, outputs, invariants,
ordering, errors, and relevant performance constraints. A seam is a place where
behavior can vary without editing its caller. An adapter satisfies such an interface.

Use the project's own terms for APIs, services, components, and boundaries.
This vocabulary helps reasoning; it does not replace established domain language.

Ask what a proposed boundary hides, who owns the behavior, and what becomes easier
to change. If deleting a wrapper removes no useful responsibility, it may be
unnecessary. A second implementation is evidence of variation, not a prerequisite
for every useful boundary.

Design tests around observable behavior. Internal seams can be useful when they
exercise a real invariant without coupling tests to incidental implementation.

For a cluster with difficult dependencies, read [DEEPENING.md](DEEPENING.md).
For a consequential interface choice with multiple plausible shapes, read
[DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md). Ordinary local choices can be resolved
directly from the current design and requested outcome.
