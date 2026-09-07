---
name: claude-simplify
description: Simplify recently changed code while preserving behavior when the user asks for cleanup or Claude-style simplification.
---

# Claude Simplify

Simplify the code touched by the request. Derive the target from the current task
and relevant diff; preserve unrelated changes. For review-only requests, report
opportunities without editing.

Keep public interfaces, outputs, state transitions, and error behavior stable.
Look for unnecessary nesting, duplicate logic, unclear names, redundant
abstractions, and comments that only repeat code. Favor readable code over a
shorter but denser expression. Preserve useful separation of responsibilities.

Make the smallest coherent cleanup, then verify it with the narrowest relevant
existing checks and inspect the final diff. Report meaningful improvements and
verification; cosmetic edits do not need individual narration.

For provenance, see [references/origin.md](references/origin.md).
