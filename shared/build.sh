#!/usr/bin/env bash
# Builds tool-specific instruction files from shared common + tool-specific parts,
# and deploys skills to Claude Code, Codex, and (via external_dirs) Hermes.
#
# The only rule: shared skills live in shared/skills/, tool-specific skills live
# in claude/skills/ or codex/skills/. Run this script after adding/editing any.
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Instructions ──────────────────────────────────────────────────────────
# Claude Code: common + claude-only → ~/.claude/CLAUDE.md
cat "$DOTFILES_DIR/shared/common.md" "$DOTFILES_DIR/claude/claude-only.md" \
    > "$HOME/.claude/CLAUDE.md"

# Codex: common only → ~/.codex/instructions.md
cp "$DOTFILES_DIR/shared/common.md" "$HOME/.codex/instructions.md"

# ── Shared skills ─────────────────────────────────────────────────────────
# Claude reads ~/.claude/skills → dotfiles/claude/skills, so the link lives
# inside the repo: make it RELATIVE so the repo survives clones/moves.
# Codex's ~/.codex/skills is a plain machine-local dir: absolute links are fine.
# Hermes picks up shared/skills directly via skills.external_dirs — no links.
if [ -d "$DOTFILES_DIR/shared/skills" ]; then
    for skill_dir in "$DOTFILES_DIR/shared/skills"/*/; do
        skill_name="$(basename "$skill_dir")"
        ln -sfn "../../shared/skills/$skill_name" "$DOTFILES_DIR/claude/skills/$skill_name"
        ln -sfn "$skill_dir" "$HOME/.codex/skills/$skill_name"
    done
fi

# ── Codex-only skills ─────────────────────────────────────────────────────
if [ -d "$DOTFILES_DIR/codex/skills" ]; then
    for skill_dir in "$DOTFILES_DIR/codex/skills"/*/; do
        skill_name="$(basename "$skill_dir")"
        ln -sfn "$skill_dir" "$HOME/.codex/skills/$skill_name"
    done
fi

# ── Report ────────────────────────────────────────────────────────────────
echo "Built:"
echo "  ~/.claude/CLAUDE.md        ($(wc -l < "$HOME/.claude/CLAUDE.md") lines)"
echo "  ~/.codex/instructions.md   ($(wc -l < "$HOME/.codex/instructions.md") lines)"
for skill_dir in "$DOTFILES_DIR/shared/skills"/*/; do
    [ -d "$skill_dir" ] && echo "  skill: $(basename "$skill_dir")  → claude + codex + hermes"
done
if [ -d "$DOTFILES_DIR/codex/skills" ]; then
    for skill_dir in "$DOTFILES_DIR/codex/skills"/*/; do
        [ -d "$skill_dir" ] && echo "  skill: $(basename "$skill_dir")  → codex"
    done
fi
if grep -q "$DOTFILES_DIR/shared/skills" "$HOME/.hermes/config.yaml" 2>/dev/null; then
    echo "  hermes: external_dirs OK"
else
    echo "  hermes: WARNING — shared/skills not in ~/.hermes/config.yaml skills.external_dirs"
fi
