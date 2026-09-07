# Verification Evidence

Choose an observation point that exercises the changed behavior: output, state,
protocol effects, or a declared representation contract. Scope claims to what the
check actually observes.

For a new or changed check, establish that it can detect the intended failure.
An observed pre-fix failure, known violating input, or safe temporary mutation may
provide that evidence. Restore any temporary control without disturbing user work.
If sensitivity cannot be demonstrated, state that limitation.

Expected behavior comes from the request or an authoritative contract. A
characterization test should identify which existing behavior is intentionally
being preserved.

Treat suppressed failures as unresolved evidence unless the suppression has a
specific justified boundary. Record its reason and material coverage limitation,
follow repository policy, and avoid disguising a regression through skipped checks
or weakened assertions.
