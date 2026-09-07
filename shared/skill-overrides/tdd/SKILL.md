---
name: tdd
description: Build or fix behavior test-first when the user requests TDD, red-green-refactor, or a test-first workflow.
---

# Test-Driven Development

Work in small cycles: a test that fails for the intended reason, enough
implementation to pass, then refactor when it improves clarity.

Use existing public interfaces and repository test conventions. Choose the
appropriate test boundary from the requested behavior; routine test placement
does not need separate approval. Resolve a new or ambiguous product contract
before encoding it in assertions.

Assert observable behavior using expectations independent of the implementation.
Exercise the actual failure pattern rather than a nearby helper that cannot
catch it. Avoid tests whose expected values reproduce the code under test.

Keep each cycle focused. Run the affected tests after edits and the checks
required by the repository. Broaden only when the changed behavior or failures
justify it.

For difficult test design, consult [tests.md](tests.md) for examples or
[mocking.md](mocking.md) for dependency boundaries. The task is complete when
the requested behavior works and relevant verification passes.
