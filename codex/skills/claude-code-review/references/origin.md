# Origin and adaptation notes

Adapted for Codex from Anthropic's Apache-licensed official Claude Code `code-review` command, with behavior compared against the active local command.

- Apache-licensed upstream: <https://github.com/anthropics/claude-plugins-official/tree/main/plugins/code-review>
- Apache-licensed local source inspected: `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/code-review/commands/code-review.md`
- Apache-licensed source SHA-256: `7d5a0bc9a41babad32a387152f9680316997bc4ad376928827d670b1760cc890`
- Active local variant inspected: `~/.claude/plugins/cache/claude-code-plugins/code-review/1.0.0/commands/code-review.md`
- Active variant revision: `681a8be245e7759a405e276b16ae69ea6b75076f`
- Active variant SHA-256: `2b0837c5ec0b2e75f8ba4565bdafd76fa916b0dc146608c5733af7ba5802012c`
- Official-plugin license: Apache License 2.0

The Codex adaptation uses a non-conflicting name because a separate `code-review` skill is already installed. It replaces Claude-specific model names and tool allowlists with portable review roles, adds scoped `AGENTS.md` support, preserves read-only-by-default behavior, and retains the original high-signal and independent-validation design.
