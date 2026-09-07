---
name: diagnosing-bugs
description: Investigate a reported bug or performance regression using reproduction, code, logs, and targeted experiments.
---

# Diagnosing Bugs

Establish the user's actual symptom and inspect the evidence most likely to
explain it: a failing command, relevant code, logs, recent changes, or a captured
request. Reading code and forming hypotheses can help build the reproduction.

Prefer a small, repeatable feedback loop when feasible. For intermittent or
production-only failures, use the available traces and static evidence, state
what remains unverified, and continue safe investigation. Lack of a local
reproduction is not by itself a reason to stop.

Rank plausible causes when several remain. Test predictions that distinguish
them; one strong hypothesis does not need invented alternatives. For performance,
measure the affected path and compare like-for-like inputs before attributing a
change.

Use targeted instrumentation or a reduced fixture when it adds evidence.
Protect secrets in commands and captured artifacts. Obtain any missing authority
before touching production or adding instrumentation there.

If manual interaction is the only useful reproduction path, the optional
[scripts/hitl-loop.template.sh](scripts/hitl-loop.template.sh) can structure it.

A diagnosis request ends with the supported cause, evidence, and remaining
uncertainty. When a fix is requested, implement it, exercise the original symptom,
and add a regression test when a suitable seam can catch the actual bug. Remove
temporary instrumentation and report the result. Ask the user only for evidence
or access that cannot be obtained through the available safe paths.
