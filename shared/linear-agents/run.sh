#!/bin/bash
# Foreground entrypoint for one Cyrus instance; launchd runs this and restarts it.
set -euo pipefail
umask 077
name=${1:?usage: run.sh codex|claude}
root="$HOME/.local/share/linear-local-agents"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export CYRUS_HOME="$root/$name" CYRUS_SENTRY_DISABLED=true
# 78 = EX_CONFIG: not authenticated yet; launchd's KeepAlive stops retrying a
# successful-looking exit only for crashes, so fail loudly instead of looping.
[[ -f "$CYRUS_HOME/.env" && -f "$CYRUS_HOME/config.json" ]] || { echo "$name: missing .env or config.json (see README.md)" >&2; exit 78; }
exec node --dns-result-order=ipv4first "$root/runtime/node_modules/cyrus-ai/dist/src/app.js" \
  --cyrus-home "$CYRUS_HOME" --env-file "$CYRUS_HOME/.env" start
