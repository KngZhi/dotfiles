#!/usr/bin/env bash
# Link this checkout into $HOME and deploy skills. Idempotent; safe to re-run after `git pull`.
#
# link:  the path in $HOME becomes a symlink into this checkout. A pre-existing real file
#        is moved aside to <path>.pre-dotfiles instead of being deleted.
# seed:  the file is copied once if absent, never overwritten. Used for files the tool
#        itself rewrites (Claude settings.json) or that hold machine-local secrets
#        (Codex config.toml); on a new machine copy the real one from the old machine.
#
# DOTFILES_DEPLOY_HOME redirects everything to another directory for a dry run.
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"
H="${DOTFILES_DEPLOY_HOME:-$HOME}"

link() {
    local src="$DOTFILES_DIR/$1" dst="$2"
    [ -e "$src" ] || { echo "missing source: $src" >&2; return 1; }
    mkdir -p "$(dirname "$dst")"
    if [ -L "$dst" ]; then
        [ "$(readlink "$dst")" = "$src" ] && return 0
        rm "$dst"
    elif [ -e "$dst" ]; then
        mv "$dst" "$dst.pre-dotfiles"
        echo "moved aside: $dst -> $dst.pre-dotfiles"
    fi
    ln -s "$src" "$dst"
    echo "linked: $dst"
}

seed() {
    local src="$DOTFILES_DIR/$1" dst="$2"
    [ -e "$dst" ] || [ -L "$dst" ] && return 0
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "seeded: $dst (copy, edit freely)"
}

# shell
link zsh/.zshenv   "$H/.zshenv"
link zsh/.zprofile "$H/.zprofile"
link zsh/.zshrc    "$H/.zshrc"

# git
link git/gitconfig        "$H/.gitconfig"
link git/gitignore_global "$H/.gitignore_global"
link git/templates        "$H/.git-templates"

# agent secrets: template holds op:// references only; the rendered .env stays local
link bin/refresh-agent-secrets          "$H/.local/bin/refresh-agent-secrets"
link agent-secrets/agent-secrets.env.tpl "$H/.config/agent-secrets/agent-secrets.env.tpl"

# editors
link nvim  "$H/.config/nvim"
link emacs "$H/.emacs.d"

# Claude Code (CLAUDE.md and skills are handled by shared/build.sh)
for f in agents ast-grep-rules hooks commands statusline.sh statusline-robbyrussell.sh notify.sh MCP_管理指南.md; do
    link "claude/$f" "$H/.claude/$f"
done
mkdir -p "$DOTFILES_DIR/claude/skills"   # build output, gitignored
link claude/skills "$H/.claude/skills"
seed claude/settings.json "$H/.claude/settings.json"

# Codex (AGENTS.md and skills are handled by shared/build.sh)
link codex/rules    "$H/.codex/rules"
seed codex/config.toml "$H/.codex/config.toml"

# skills, CLAUDE.md, AGENTS.md
"$DOTFILES_DIR/shared/build.sh"
