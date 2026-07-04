#!/usr/bin/env bash
# One-time (re-runnable) setup of skill-management automation on macOS:
#   1. Wire dotfiles git hooks  → redeploy locally after every `git pull`.
#   2. Install a weekly LaunchAgent → `build.sh --update` pulls packs + redeploys.
# Idempotent. To undo: launchctl bootout gui/$(id -u) "$PLIST" && rm "$PLIST"
#                      && git -C <dotfiles> config --unset core.hooksPath
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.dotfiles.skills-update"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/dotfiles-skills-update.log"
BASH_BIN="$(command -v bash)"
PATH_ENV="$(dirname "$(command -v git)"):/usr/bin:/bin:/usr/sbin:/sbin"

# 1. git hooks
git -C "$DOTFILES_DIR" config core.hooksPath shared/git-hooks
echo "git hooks wired → shared/git-hooks (post-merge redeploys after pull)"

# 2. weekly LaunchAgent (Mondays 10:00; launchd runs it on next wake if asleep)
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$BASH_BIN</string>
    <string>$DOTFILES_DIR/shared/build.sh</string>
    <string>--update</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$PATH_ENV</string><key>HOME</key><string>$HOME</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "LaunchAgent installed → $LABEL (weekly Mon 10:00), log: $LOG"
