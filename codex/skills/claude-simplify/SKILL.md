---
name: claude-simplify
description: Simplify and refine recently changed code for clarity, consistency, and maintainability while preserving behavior. Use when the user asks for Claude Code's Simplify or code-simplifier, asks to simplify, refine, or clean up recent code, or requests a focused behavior-preserving cleanup after implementation. Do not use for repo-wide deletion or entropy audits; use reclaim-code-entropy for those.
---

# Claude Simplify

Simplify the code touched by the current task without changing what it does. Prefer readable, explicit code over clever or merely shorter code.

## Scope

1. Derive the target from the current request, the files changed in this session, and the relevant Git diff.
2. Default to recently modified code only. Expand beyond it only when the user explicitly asks or a tiny adjacent change is required to preserve behavior.
3. Preserve unrelated user changes in a dirty worktree.
4. If the request is review-only, report simplification opportunities without editing. Otherwise, make the cleanup directly.

## Workflow

1. Read the applicable repository instructions before editing. Follow scoped `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and other coding-standard files; repository rules override generic preferences below.
2. Identify the observable behavior that must stay stable: public interfaces, outputs, state transitions, error behavior, and relevant tests.
3. Look for focused improvements:
   - reduce unnecessary nesting and branching;
   - remove redundant code or abstractions;
   - improve unclear names;
   - consolidate logic that belongs together;
   - remove comments that only restate obvious code;
   - replace nested ternaries and dense one-liners with clear control flow;
   - keep useful abstractions that separate responsibilities.
4. Apply the smallest coherent edit. Do not add speculative helpers, compatibility layers, or unrelated cleanup.
5. Verify behavior with the narrowest relevant existing tests, type checks, formatters, or runtime checks. Inspect the final diff for accidental scope expansion.
6. Report the meaningful simplifications and the verification performed. Do not narrate cosmetic edits one by one.

## Guardrails

- Preserve exact functionality unless the user separately authorizes behavior changes.
- Optimize for comprehension and maintainability, not line count.
- Do not combine unrelated responsibilities into one function or component.
- Do not remove an abstraction merely because inlining is possible.
- Do not make code harder to debug, extend, or test.
- Do not invent generic language or framework rules when the repository already defines its own.

## Provenance

This is a Codex adaptation of Anthropic's Claude Code `code-simplifier` agent. See [references/origin.md](references/origin.md) for source and adaptation notes.
