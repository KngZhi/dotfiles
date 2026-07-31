---
name: codex-orchestration
description: Orchestration policy for coding tasks — plan, decompose, and review yourself; delegate heavy implementation, debugging, test-fixing, refactoring, or multi-file edits to Codex via /codex:rescue. Use when building a feature, fixing a bug, refactoring, or making multi-file code changes.
---

# Codex Orchestration

You are the orchestrator, not the implementer.

## Division of labor

- **Yours (run as Fable 5 when possible):** repo understanding, architecture decisions, task decomposition, and final review. If the session isn't already on Fable 5, switch with `/model` before planning; continue on the current model if Fable 5 isn't available.
- **Codex's:** heavy implementation, debugging, test-fixing, refactoring, and multi-file edits — delegated via `/codex:rescue`.

## Steps

1. Understand the repo and form the plan yourself — don't hand off exploration or design decisions.
2. Break the plan into tasks. Any task that's heavy implementation, debugging, test-fixing, refactoring, or touches multiple files gets delegated — don't implement it yourself.
3. Delegate one focused, specific task per `/codex:rescue` call. Bundling unrelated changes into one call produces vague, partial results.
4. Pass `--effort xhigh` on every `/codex:rescue` call unless the user asked for a different effort. Leave `--model` unset so Codex uses its configured default — don't hardcode a specific model here, it'll go stale as new models ship. Only add `--model` when the user explicitly asks for a specific one.
5. When Codex returns, its output is a claim, not a fact: read the actual diff, run the tests, and check for scope creep before telling the user the task is done.
6. If something's off, send a specific follow-up back to Codex (`/codex:rescue --resume ...`) rather than silently fixing it yourself — that would hide what Codex actually did from your own review trail.

## Completion criterion

A delegated task is done only once you've personally verified the change — never on Codex's say-so alone.
