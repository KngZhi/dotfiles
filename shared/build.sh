#!/usr/bin/env bash
# Builds Claude instructions from shared common + Claude-specific parts,
# and deploys skills to Claude Code, Codex, and (via external_dirs) Hermes.
#
# Usage:
#   build.sh            Local deploy: rebuild instructions, relink skills,
#                       clone any NEW packs. No network pull of existing packs.
#   build.sh --update   Also `git pull` every existing pack, then deploy.
#   build.sh --add URL  Append URL to skill-packs/sources.txt (if new), deploy.
#
# Rules:
#   - shared/skills/         → skills I hand-author, shared to all three tools
#   - claude/skills/         → Claude-only hand-authored skills (tracked ones)
#   - codex/skills/          → Codex-only hand-authored skills
#   - shared/skill-packs/    → third-party packs; a repo URL per line in sources.txt
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_SKILLS="$DOTFILES_DIR/claude/skills"   # == ~/.claude/skills (symlinked)
CODEX_SKILLS="$HOME/.codex/skills"            # plain machine-local dir
PACKS_DIR="$DOTFILES_DIR/shared/skill-packs"
PACKS_DEPLOY="$PACKS_DIR/.deploy"             # flat view of curated pack skills, for Hermes
PACK_EXCLUDE="deprecated in-progress out-of-scope personal .out-of-scope"

PULL=0
while [ $# -gt 0 ]; do
    case "$1" in
        --update) PULL=1 ;;
        --add) shift; [ -n "${1:-}" ] || { echo "--add needs a repo URL" >&2; exit 2; }
               grep -qxF "$1" "$PACKS_DIR/sources.txt" 2>/dev/null || echo "$1" >> "$PACKS_DIR/sources.txt"
               echo "  added source: $1" ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
    shift
done

mkdir -p "$CLAUDE_SKILLS" "$CODEX_SKILLS"

# Note: automation (git hooks + weekly LaunchAgent) is opt-in — run
# shared/install-automation.sh once to enable it. build.sh itself only
# deploys; it never installs background jobs or rewrites git config.

# ── Claude instructions ───────────────────────────────────────────────────
cat "$DOTFILES_DIR/shared/common.md" "$DOTFILES_DIR/claude/claude-only.md" \
    > "$HOME/.claude/CLAUDE.md"

# Codex global instructions live in ~/.codex/AGENTS.md and are intentionally
# managed separately rather than generated from shared/common.md.

# ── Shared skills → Claude (relative link) + Codex (absolute) ─────────────
if [ -d "$DOTFILES_DIR/shared/skills" ]; then
    for skill_dir in "$DOTFILES_DIR/shared/skills"/*/; do
        skill_name="$(basename "$skill_dir")"
        ln -sfn "../../shared/skills/$skill_name" "$CLAUDE_SKILLS/$skill_name"
        ln -sfn "$skill_dir" "$CODEX_SKILLS/$skill_name"
    done
fi

# ── Codex-only skills ─────────────────────────────────────────────────────
if [ -d "$DOTFILES_DIR/codex/skills" ]; then
    for skill_dir in "$DOTFILES_DIR/codex/skills"/*/; do
        ln -sfn "$skill_dir" "$CODEX_SKILLS/$(basename "$skill_dir")"
    done
fi

# ── Third-party skill packs ───────────────────────────────────────────────
deploy_pack_skill() {  # $1 = absolute skill dir
    local sdir="$1" name; name="$(basename "$sdir")"
    ln -sfn "$sdir" "$CLAUDE_SKILLS/$name"
    ln -sfn "$sdir" "$CODEX_SKILLS/$name"
    ln -sfn "$sdir" "$PACKS_DEPLOY/$name"
    echo "  pack-skill: $name  → claude + codex + hermes"
}

PACK_NAMES=""
if [ -f "$PACKS_DIR/sources.txt" ]; then
    rm -rf "$PACKS_DEPLOY"; mkdir -p "$PACKS_DEPLOY"
    while IFS= read -r url; do
        url="${url%%#*}"; url="$(echo "$url" | tr -d '[:space:]')"
        [ -z "$url" ] && continue
        base="${url##*/}"; base="${base%.git}"
        owner="${url%/*}"; owner="${owner##*/}"
        pack="$PACKS_DIR/$owner-$base"
        if [ -d "$pack/.git" ]; then
            [ "$PULL" = 1 ] && { git -C "$pack" pull --ff-only -q 2>/dev/null \
                || echo "  warn: pull failed for $owner/$base"; }
        else
            echo "  cloning $owner/$base ..."
            git clone --depth 1 -q "$url" "$pack"
        fi
        PACK_NAMES="$PACK_NAMES $owner/$base"

        if [ -f "$pack/.claude-plugin/plugin.json" ]; then
            python3 -c "import json,sys;print('\n'.join(json.load(open(sys.argv[1]))['skills']))" \
                "$pack/.claude-plugin/plugin.json" | while IFS= read -r rel; do
                    sdir="$pack/${rel#./}"
                    [ -f "$sdir/SKILL.md" ] && deploy_pack_skill "$sdir"
                done
        else
            find "$pack" -name SKILL.md -not -path '*/.git/*' | while IFS= read -r smd; do
                sdir="$(dirname "$smd")"; skip=""
                for ex in $PACK_EXCLUDE; do case "$sdir" in */"$ex"/*) skip=1;; esac; done
                [ -z "$skip" ] && deploy_pack_skill "$sdir"
            done
        fi
    done < "$PACKS_DIR/sources.txt"
fi

# ── Report ────────────────────────────────────────────────────────────────
echo "Built ($([ "$PULL" = 1 ] && echo 'update: pulled packs' || echo 'local deploy')):"
echo "  ~/.claude/CLAUDE.md        ($(wc -l < "$HOME/.claude/CLAUDE.md") lines)"
for skill_dir in "$DOTFILES_DIR/shared/skills"/*/; do
    [ -d "$skill_dir" ] && echo "  skill: $(basename "$skill_dir")  → claude + codex + hermes"
done
if [ -d "$DOTFILES_DIR/codex/skills" ]; then
    for skill_dir in "$DOTFILES_DIR/codex/skills"/*/; do
        [ -d "$skill_dir" ] && echo "  skill: $(basename "$skill_dir")  → codex"
    done
fi
[ -n "$PACK_NAMES" ] && echo "  packs:$PACK_NAMES  ($(find "$PACKS_DEPLOY" -maxdepth 1 -type l | wc -l | tr -d ' ') skills)"
for want in "$DOTFILES_DIR/shared/skills" "$PACKS_DEPLOY"; do
    grep -q "$want" "$HOME/.hermes/config.yaml" 2>/dev/null \
        || echo "  hermes: WARNING — $want not in ~/.hermes/config.yaml skills.external_dirs"
done
