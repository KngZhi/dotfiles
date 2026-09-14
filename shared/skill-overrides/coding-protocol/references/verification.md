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

Verify on real data before anything constructed. When the repository, its
tracked inputs, or a frozen local copy contain real data that reaches the
changed path, run the change on that data and record the actual entities,
periods and values before and after, including costs the run exposes. A
synthetic scenario from an Issue or a unit test shows the formula behaves as
designed; it does not show the defect occurred or was resolved in practice, so
it may supplement real evidence, labelled as synthetic, but never replace it.
If no real data exercises the path, state that and why before presenting
anything constructed.

When a change replaces how existing output is produced rather than what it
should be (a new API client or SDK, a different data source, a rewritten
mapper, serializer or collector), passing unit tests and fixtures do not verify
it. Run the old code and the new code against the same real source at the same
time, write both outputs to disposable directories, and compare them
byte-for-byte. Any difference must be explained before publishing: rerun the
old code first to rule out source drift, then attribute what remains to the
change and state whether it is intended. Do not push or claim "behavior
unchanged" without this comparison, and say so explicitly when it could not be
run (no credentials, no real input, source not reachable).

Grade every safety or equivalence claim by how far its evidence goes, and say
where it stopped:

1. Asserted: you said so. Worthless alone.
2. Located: a real file and line, or the library's own source.
3. Reasoned: the failure path was walked and shown not to reach.
4. Executed: a script or test ran the real code and would fail loudly if wrong.
5. Observed: reproduced in the running system on real data.

A claim that stops below level 4 is reported as unproven, not as settled. A claim
of "behavior unchanged" or "output identical" is only complete when the comparison
script and its captured output exist as artifacts a reviewer can rerun; a claim
with no such artifact has not been verified.

Treat suppressed failures as unresolved evidence unless the suppression has a
specific justified boundary. Record its reason and material coverage limitation,
follow repository policy, and avoid disguising a regression through skipped checks
or weakened assertions.
