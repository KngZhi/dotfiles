#!/bin/bash
# Foreground entrypoint for one Cyrus instance; launchd runs this and restarts it.
set -euo pipefail
umask 077
name=${1:?usage: run.sh codex|claude}
root="$HOME/.local/share/linear-local-agents"
# The runtime's bin dir carries agent-browser (Playwright CLI); with the flag set, Cyrus tells
# both runners they can drive a local Chromium for UI verification and bug reproduction.
export PATH="$root/runtime/node_modules/.bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export CYRUS_HOME="$root/$name" CYRUS_SENTRY_DISABLED=true CYRUS_BROWSER_USE_ENABLED=true
# Codex gets the same unsandboxed footing as the Claude runner (see patches/codex-sandbox-mode.sh).
export CYRUS_CODEX_SANDBOX_MODE=danger-full-access
# 78 = EX_CONFIG: not authenticated yet; launchd's KeepAlive stops retrying a
# successful-looking exit only for crashes, so fail loudly instead of looping.
[[ -f "$CYRUS_HOME/.env" && -f "$CYRUS_HOME/config.json" ]] || { echo "$name: missing .env or config.json (see README.md)" >&2; exit 78; }
exec node --dns-result-order=ipv4first "$root/runtime/node_modules/cyrus-ai/dist/src/app.js" \
  --cyrus-home "$CYRUS_HOME" --env-file "$CYRUS_HOME/.env" start
