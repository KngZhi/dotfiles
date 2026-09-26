#!/usr/bin/env bash
# Cyrus 0.2.72 names the work branch after Linear's gitBranchName, which keeps the issue
# title's CJK and full-width punctuation ("…-byproduct（域收尾）"). Git accepts it, but GitHub
# flags every such PR with "The head ref may contain hidden characters". This extends Cyrus's
# sanitizer to turn any non-printable-ASCII character into a dash as well. Idempotent;
# re-applied by deploy.sh after every npm ci.
set -euo pipefail
file="${1:?path to node_modules}/cyrus-edge-worker/dist/GitService.js"
before='.replace(/[`~^:?*[\]\\@{}\s]/g, "-") // replace invalid chars with dash'
after='.replace(/[`~^:?*[\]\\@{}\s]/g, "-") // replace invalid chars with dash
            .replace(/[^\x21-\x7e]/g, "-") // non-ASCII (CJK, full-width punctuation): GitHub flags them as hidden characters'
if grep -qF 'replace(/[^\x21-\x7e]/g, "-")' "$file"; then echo "branch name patch: already applied"; exit 0; fi
grep -qF "$before" "$file" || { echo "branch name patch: anchor not found in $file (Cyrus changed?)" >&2; exit 1; }
python3 - "$file" "$before" "$after" <<'EOF'
import sys
path, before, after = sys.argv[1:4]
src = open(path).read()
assert src.count(before) == 1
open(path, "w").write(src.replace(before, after))
EOF
echo "branch name patch: applied"
