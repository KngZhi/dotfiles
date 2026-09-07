# Origin and adaptation notes

Adapted for Codex from Anthropic's Claude Code `code-simplifier` agent, version 1.0.0.

- Upstream: <https://github.com/anthropics/claude-plugins-official/tree/main/plugins/code-simplifier>
- Local source inspected: `~/.claude/plugins/cache/claude-plugins-official/code-simplifier/1.0.0/agents/code-simplifier.md`
- Installed source revision: `f1be96f0fb58d5aaf2840ca7d7036d5c0923742c`
- Local source SHA-256: `2a51e8d210580d9f66ac2ed1226c41f9374565fc275da30d7bb95f65c2cc87bb`
- Upstream license: Apache License 2.0

The Codex adaptation changes the skill name and metadata, replaces Claude-only agent metadata, reads both Codex and Claude repository instruction files by scope, and expresses verification and dirty-worktree behavior explicitly. The core behavior-preserving simplification policy remains intact.
