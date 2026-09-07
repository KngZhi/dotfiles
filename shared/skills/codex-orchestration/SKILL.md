---
name: codex-orchestration
description: Delegate a bounded coding task to Codex when the user requests Codex delegation or an external implementation agent.
---

# Codex Delegation

Use the current agent for planning, coordination, and review. Delegate only work
that benefits from a separate implementation context and is within the request.

Use the host's available Codex integration or CLI. If `/codex:rescue` exists,
it is one supported route; its absence is not a blocker to doing the authorized
work directly. A Codex session should not launch another Codex merely because
this skill was loaded.

Give the implementer the intended outcome, repository/worktree, exact scope,
relevant context, and a checkable completion condition. Keep unrelated tasks
separate. Use the configured model and effort unless the user specifies them.

Inspect the resulting diff and relevant verification before reporting completion.
Resolve remaining in-scope work yourself or send a focused follow-up, whichever
best preserves context. Finish when the requested outcome is verified, not merely
when the delegated process returns.
