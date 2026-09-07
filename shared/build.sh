#!/usr/bin/env bash
# Deploy portable skills and shared instructions. Existing packs update only with --update.
# DOTFILES_DEPLOY_HOME redirects runtime outputs for isolated validation.
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_HOME="${DOTFILES_DEPLOY_HOME:-$HOME}"
CLAUDE_SKILLS="$DEPLOY_HOME/.claude/skills"
CODEX_SKILLS="$DEPLOY_HOME/.codex/skills"
PACKS_DIR="$DOTFILES_DIR/shared/skill-packs"
PACKS_DEPLOY="$PACKS_DIR/.deploy"
OVERRIDES="$DOTFILES_DIR/shared/skill-overrides"
PACK_EXCLUDE="deprecated in-progress misc out-of-scope personal .out-of-scope"
PACK_SKILL_EXCLUDE="keel research resolving-merge-conflicts domain-modeling"

PULL=0
while [ $# -gt 0 ]; do
    case "$1" in
        --update) PULL=1 ;;
        --add)
            shift
            [ -n "${1:-}" ] || { echo "--add needs a repo URL" >&2; exit 2; }
            grep -qxF "$1" "$PACKS_DIR/sources.txt" 2>/dev/null ||
                printf '%s\n' "$1" >> "$PACKS_DIR/sources.txt"
            ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
    shift
done

# Only links owned by this checkout may be replaced. Real directories and
# custom links belong to the user, including broken links outside this checkout.
owned_link() {
    [ -L "$1" ] || return 1
    case "$(readlink "$1")" in
        "$DOTFILES_DIR/"*) return 0 ;;
        ../../shared/skills/*)
            [ "$(cd "$(dirname "$1")" && pwd -P)" = "$DOTFILES_DIR/claude/skills" ] ;;
        *) return 1 ;;
    esac
}

link_skill() {
    local source="$1" destination="$2" link_target="$1"
    if [ -e "$destination" ] || [ -L "$destination" ]; then
        owned_link "$destination" || {
            echo "Refusing to replace unmanaged skill: $destination" >&2; return 1;
        }
    fi
    # Preserve the tracked relative Claude links when deploying from the base checkout.
    if [ "$(cd "$(dirname "$destination")" && pwd -P)" = "$DOTFILES_DIR/claude/skills" ]; then
        case "$source" in
            "$DOTFILES_DIR/shared/skills/"*) link_target="../../shared/skills/${source##*/}" ;;
        esac
    fi
    ln -sfn "$link_target" "$destination"
}

# Build a complete skill view before publishing runtime links. Removed upstream
# resources disappear on rebuild, while original pack checkouts remain untouched.
mkdir -p "$PACKS_DIR"
STAGING="$(mktemp -d "$PACKS_DIR/.build.XXXXXX")"
PUBLISHED=0
cleanup() {
    if [ "$PUBLISHED" = 0 ] && [ -d "$STAGING/previous" ]; then
        [ ! -e "$PACKS_DEPLOY" ] || mv "$PACKS_DEPLOY" "$STAGING/failed"
        mv "$STAGING/previous" "$PACKS_DEPLOY"
    fi
    rm -rf "$STAGING"
}
trap cleanup EXIT
mkdir "$STAGING/packs" "$STAGING/local"

add_local_skill() {
    local sdir="$1" name="${1##*/}"
    [ -f "$sdir/SKILL.md" ] || return 0
    [ ! -e "$STAGING/local/$name" ] || {
        echo "Duplicate local skill: $name" >&2; return 1;
    }
    ln -s "$sdir" "$STAGING/local/$name"
}

for local_root in "$DOTFILES_DIR/shared/skills" "$DOTFILES_DIR/shared/.agents/skills" "$DOTFILES_DIR/shared/.claude/skills"; do
    [ -d "$local_root" ] || continue
    for sdir in "$local_root"/*; do add_local_skill "$sdir"; done
done
for sdir in "$DOTFILES_DIR/codex/skills"/*; do
    name="${sdir##*/}"
    [ -f "$sdir/SKILL.md" ] || continue
    [ ! -e "$STAGING/local/$name" ] || {
        echo "Shared/Codex skill collision: $name" >&2; exit 1;
    }
done

deploy_pack_skill() {
    local sdir="$1" name="${1##*/}"
    case " $PACK_SKILL_EXCLUDE " in *" $name "*) return 0 ;; esac
    [ ! -e "$STAGING/local/$name" ] && [ ! -e "$STAGING/packs/$name" ] &&
        [ ! -f "$DOTFILES_DIR/codex/skills/$name/SKILL.md" ] || {
        echo "Duplicate skill name: $name" >&2; return 1;
    }
    if [ -d "$OVERRIDES/$name" ]; then
        mkdir "$STAGING/packs/$name"
        cp -R "$sdir/." "$STAGING/packs/$name/"
        cp -R "$OVERRIDES/$name/." "$STAGING/packs/$name/"
    else
        ln -s "$sdir" "$STAGING/packs/$name"
    fi
}

if [ -f "$PACKS_DIR/sources.txt" ]; then
    while IFS= read -r url; do
        url="${url%%#*}"
        url="$(printf '%s' "$url" | tr -d '[:space:]')"
        [ -n "$url" ] || continue
        base="${url##*/}"; base="${base%.git}"
        owner="${url%/*}"; owner="${owner##*/}"
        pack="$PACKS_DIR/$owner-$base"
        if [ -d "$pack/.git" ]; then
            if [ "$PULL" = 1 ]; then
                if [ -n "$(git -C "$pack" status --porcelain)" ]; then
                    echo "Preserving modified pack: $pack" >&2
                else
                    git -C "$pack" pull --ff-only
                fi
            fi
        else
            git clone --depth 1 "$url" "$pack"
        fi

        manifest="$pack/.claude-plugin/plugin.json"
        [ -f "$manifest" ] || manifest="$pack/.codex-plugin/plugin.json"
        if [ -f "$manifest" ]; then
            python3 - "$manifest" "$pack" <<'PY' > "$STAGING/skills.txt"
import json, pathlib, sys
pack = pathlib.Path(sys.argv[2]).resolve()
skills = json.loads(pathlib.Path(sys.argv[1]).read_text()).get("skills") or ["skills"]
for entry in [skills] if isinstance(skills, str) else skills:
    base = (pack / entry).resolve()
    if pack not in base.parents and base != pack:
        raise SystemExit(f"Skill path escapes pack: {entry}")
    paths = [base / "SKILL.md"] if (base / "SKILL.md").is_file() else sorted(base.rglob("SKILL.md"))
    for path in paths:
        print(path.parent)
PY
        else
            find "$pack" -name .git -prune -o -name SKILL.md -exec dirname {} \; > "$STAGING/skills.txt"
        fi
        while IFS= read -r sdir; do
            skip=""
            for ex in $PACK_EXCLUDE; do case "$sdir" in */"$ex"/*) skip=1 ;; esac; done
            [ -n "$skip" ] || deploy_pack_skill "$sdir"
        done < "$STAGING/skills.txt"
    done < "$PACKS_DIR/sources.txt"
fi

# A removed/renamed upstream skill must not silently strand a maintained override.
for override in "$OVERRIDES"/*; do
    [ -d "$override" ] || continue
    [ -f "$STAGING/packs/${override##*/}/SKILL.md" ] || {
        echo "Override has no selected upstream skill: $override" >&2; exit 1;
    }
done

mkdir -p "$CLAUDE_SKILLS" "$CODEX_SKILLS"
# Preflight all destinations before replacing the generated pack view.
for dest in "$DEPLOY_HOME/.claude/CLAUDE.md" "$DEPLOY_HOME/.codex/AGENTS.md"; do
    if [ -e "$dest" ] || [ -L "$dest" ]; then
        owned_link "$dest" || { echo "Refusing to replace unmanaged instructions: $dest" >&2; exit 1; }
    fi
done
for entry in "$STAGING/local"/* "$STAGING/packs"/* "$DOTFILES_DIR/codex/skills"/*; do
    [ -f "$entry/SKILL.md" ] || continue
    for dest in "$CLAUDE_SKILLS/${entry##*/}" "$CODEX_SKILLS/${entry##*/}"; do
        case "$entry:$dest" in "$DOTFILES_DIR/codex/skills/"*:"$CLAUDE_SKILLS/"*) continue ;; esac
        if [ -e "$dest" ] || [ -L "$dest" ]; then
            owned_link "$dest" || { echo "Refusing to replace unmanaged skill: $dest" >&2; exit 1; }
        fi
    done
done

# .deploy is generated output. Keep the previous view until link publication succeeds.
[ ! -L "$PACKS_DEPLOY" ] || { echo "Expected a generated directory: $PACKS_DEPLOY" >&2; exit 1; }
if [ -e "$PACKS_DEPLOY" ]; then mv "$PACKS_DEPLOY" "$STAGING/previous"; fi
mv "$STAGING/packs" "$PACKS_DEPLOY"
for entry in "$STAGING/local"/* "$PACKS_DEPLOY"/*; do
    [ -f "$entry/SKILL.md" ] || continue
    source="$entry"
    case "$entry" in "$STAGING/local/"*) source="$(readlink "$entry")" ;; esac
    link_skill "$source" "$CLAUDE_SKILLS/${entry##*/}"
    link_skill "$source" "$CODEX_SKILLS/${entry##*/}"
done
for sdir in "$DOTFILES_DIR/codex/skills"/*; do
    [ -f "$sdir/SKILL.md" ] || continue
    link_skill "$sdir" "$CODEX_SKILLS/${sdir##*/}"
done

# Retire only our links whose names are no longer in the selected catalog.
for target in "$CLAUDE_SKILLS" "$CODEX_SKILLS"; do
    for link in "$target"/*; do
        owned_link "$link" || continue
        name="${link##*/}"
        [ -f "$STAGING/local/$name/SKILL.md" ] && continue
        [ -f "$PACKS_DEPLOY/$name/SKILL.md" ] && continue
        [ "$target" = "$CODEX_SKILLS" ] && [ -f "$DOTFILES_DIR/codex/skills/$name/SKILL.md" ] && continue
        rm "$link"
        echo "Retired managed link: $link"
    done
done
link_skill "$DOTFILES_DIR/shared/agent-instructions.md" "$DEPLOY_HOME/.claude/CLAUDE.md"
link_skill "$DOTFILES_DIR/shared/agent-instructions.md" "$DEPLOY_HOME/.codex/AGENTS.md"
PUBLISHED=1
echo "Deployed skills and instructions from $DOTFILES_DIR"
# Hermes reads these directories directly; configuration remains user-owned.
for want in "$DOTFILES_DIR/shared/skills" "$PACKS_DEPLOY"; do
    grep -qF "$want" "$DEPLOY_HOME/.hermes/config.yaml" 2>/dev/null ||
        echo "Hermes: $want is not listed in skills.external_dirs"
done
