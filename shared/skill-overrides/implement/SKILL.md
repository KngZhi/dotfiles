---
name: implement
description: Implement the requested outcome from a specification, tickets, or an agreed plan.
disable-model-invocation: true
---

Implement the complete requested scope, following its dependencies and existing
repository conventions. Inspect the relevant intent and code, then make the change.

Use TDD when requested or useful, at appropriate existing test boundaries. Run
affected checks after meaningful changes and required repository gates before
completion. Repeat checks when new edits or failures justify them.

Review the final diff for correctness and scope. Resolve remaining in-scope failures
instead of stopping at the first implementation. Commit or publish when included
in the user's workflow; otherwise leave the verified changes for review.
