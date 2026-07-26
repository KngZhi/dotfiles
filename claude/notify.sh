#!/usr/bin/env bash
# Claude Code 任务完成通知脚本（Stop hook）

set -u

BARK_DEVICE_KEY="${BARK_DEVICE_KEY:-}"
[ -n "$BARK_DEVICE_KEY" ] || exit 0

urlencode_py() {
  python3 - <<'PY' "$1" 2>/dev/null
import sys
import urllib.parse

print(urllib.parse.quote(sys.argv[1], safe=""))
PY
}

urlencode_fallback() {
  # Best-effort fallback (covers the common failure case: spaces / parentheses in git branch).
  # Non-ASCII characters may still be rejected by some clients/servers.
  local s="$1"
  s="${s// /%20}"
  s="${s//(/%28}"
  s="${s//)/%29}"
  printf '%s' "$s"
}

urlencode() {
  if command -v python3 >/dev/null 2>&1; then
    urlencode_py "$1" && return 0
  fi
  urlencode_fallback "$1"
}

# 获取项目名（当前目录名）
project="$(basename "${PWD:-unknown}")"

# 获取 git 分支（如果有）
branch=""
if git rev-parse --git-dir >/dev/null 2>&1; then
  current_branch="$(git branch --show-current 2>/dev/null || true)"
  if [[ -n "$current_branch" ]]; then
    branch=" (${current_branch})"
  fi
fi

# 当前时间
time_now="$(date "+%H:%M")"

title="$(urlencode "${project}${branch}")"
body="$(urlencode "任务完成 ${time_now}")"

log_file="${HOME}/.claude/debug/notify.log"
mkdir -p "$(dirname "$log_file")" 2>/dev/null || true

curl --silent --show-error --fail \
  --connect-timeout 2 --max-time 5 \
  -X POST "https://api.day.app/${BARK_DEVICE_KEY}/${title}/${body}" \
  -H "Content-Type: application/json" \
  -d '{
    "sound": "glass",
    "icon": "https://www.anthropic.com/favicon.ico",
    "group": "claude-code",
    "level": "timeSensitive"
  }' \
  >/dev/null 2>>"$log_file"

# Stop hooks should never fail the session.
exit 0
