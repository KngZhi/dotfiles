# Dependency Substitution

Prefer real, cheap collaborators when they make a test realistic and deterministic.
Substitute external APIs, time, randomness, filesystems, or expensive dependencies
when isolation helps exercise the intended behavior safely.

Internal fakes can be useful at a stable interface. Avoid assertions that freeze
incidental private call structure rather than protect a contract.

Use existing injection seams. Add an adapter only when it isolates a meaningful
dependency or makes the actual behavior testable. Generic fetch clients and SDKs
can both be appropriate; choose from the integration's real semantics.

A fake should preserve the behavior the test relies on. Complement it with focused
integration evidence when differences from the real system could hide the bug.
