#!/usr/bin/env bash
# Cyrus 0.2.72 starts every Codex thread in Codex's "workspace-write" seatbelt and offers no
# config key to change it; Chrome cannot launch in there whatever the writable roots. This
# makes the mode overridable with CYRUS_CODEX_SANDBOX_MODE (run.sh sets danger-full-access:
# the agents run on our own machine against our own repositories, like the Claude runner
# already does). Idempotent; re-applied by deploy.sh after every npm ci.
set -euo pipefail
file="${1:?path to node_modules}/cyrus-codex-runner/dist/config/CodexConfigBuilder.js"
before='mode: this.config.sandbox || "workspace-write",'
after='mode: this.config.sandbox || process.env.CYRUS_CODEX_SANDBOX_MODE || "workspace-write",'
if grep -qF "$after" "$file"; then echo "codex sandbox patch: already applied"; exit 0; fi
grep -qF "$before" "$file" || { echo "codex sandbox patch: anchor not found in $file (Cyrus changed?)" >&2; exit 1; }
python3 - "$file" "$before" "$after" <<'EOF'
import sys
path, before, after = sys.argv[1:4]
src = open(path).read()
assert src.count(before) == 1
open(path, "w").write(src.replace(before, after))
EOF
echo "codex sandbox patch: applied"
