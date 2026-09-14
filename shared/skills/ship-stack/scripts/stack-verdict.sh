#!/usr/bin/env bash
# Verdict bookkeeping for a stack of pull requests, bound to the patch-id of each PR's diff.
#
#   stack-verdict.sh record <pr> <PASS|PASS+NOTES|FAIL> "<who and evidence>"
#   stack-verdict.sh status <pr>...          # recorded verdict vs the PR's current patch
#   stack-verdict.sh landable <pr>...        # bottom-up list; prints the contiguous verified run and the ceiling
#
# Requires gh (authenticated) and an up-to-date `git fetch origin`. Verdict files live in
# ${STACK_VERDICT_DIR:-$HOME/.local/state/stack-verdicts}/<owner>-<repo>/<pr>.json
set -euo pipefail

repo_slug() { gh repo view --json nameWithOwner -q .nameWithOwner | tr '/' '-'; }
verdict_dir() { local d="${STACK_VERDICT_DIR:-$HOME/.local/state/stack-verdicts}/$(repo_slug)"; mkdir -p "$d"; echo "$d"; }

pr_refs() {  # prints: base_sha head_sha base_ref head_ref
  gh pr view "$1" --json baseRefName,headRefName,headRefOid,baseRefOid -q '"\(.baseRefOid) \(.headRefOid) \(.baseRefName) \(.headRefName)"'
}

patch_id() {  # base head -> stable patch id of base...head
  local base=$1 head=$2
  git rev-parse --verify --quiet "$head^{commit}" >/dev/null || git fetch -q origin "$head" 2>/dev/null || true
  git rev-parse --verify --quiet "$base^{commit}" >/dev/null || git fetch -q origin "$base" 2>/dev/null || true
  local mb; mb=$(git merge-base "$base" "$head")
  git diff --no-color "$mb" "$head" | git patch-id --stable | awk '{print $1}' | sha256sum | cut -c1-16
}

cmd_record() {
  local pr=${1:?pr} verdict=${2:?verdict} note=${3:?"who and evidence"}
  case "$verdict" in PASS|PASS+NOTES|FAIL) ;; *) echo "verdict must be PASS, PASS+NOTES or FAIL" >&2; exit 2;; esac
  read -r base head base_ref head_ref < <(pr_refs "$pr")
  local pid; pid=$(patch_id "$base" "$head")
  local file; file="$(verdict_dir)/$pr.json"
  python3 - "$file" "$pr" "$verdict" "$note" "$base" "$head" "$base_ref" "$head_ref" "$pid" <<'EOF'
import json, sys, datetime
file, pr, verdict, note, base, head, base_ref, head_ref, pid = sys.argv[1:]
json.dump({"pr": int(pr), "verdict": verdict, "note": note, "base_ref": base_ref, "head_ref": head_ref,
           "base_sha": base, "head_sha": head, "patch_id": pid,
           "recorded_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}, open(file, "w"), indent=2)
EOF
  echo "recorded #$pr $verdict patch=$pid head=${head:0:9} -> $file"
}

verdict_state() {  # pr -> "<state> <detail>" ; state in verified|changed|failed|unverified
  local pr=$1 file; file="$(verdict_dir)/$pr.json"
  read -r base head base_ref head_ref < <(pr_refs "$pr")
  local pid; pid=$(patch_id "$base" "$head")
  if [ ! -f "$file" ]; then echo "unverified head=${head:0:9} patch=$pid"; return; fi
  local rec_verdict rec_pid
  rec_verdict=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['verdict'])" "$file")
  rec_pid=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['patch_id'])" "$file")
  if [ "$rec_pid" != "$pid" ]; then echo "changed verdict=$rec_verdict recorded=$rec_pid current=$pid head=${head:0:9}"; return; fi
  case "$rec_verdict" in FAIL) echo "failed head=${head:0:9} patch=$pid";; *) echo "verified $rec_verdict head=${head:0:9} patch=$pid";; esac
}

cmd_status() {
  for pr in "$@"; do printf '#%s %s\n' "$pr" "$(verdict_state "$pr")"; done
}

cmd_landable() {
  local run=() ceiling="" reason=""
  for pr in "$@"; do
    local state; state=$(verdict_state "$pr")
    case "$state" in
      verified*) run+=("$pr");;
      *) ceiling=$pr; reason=$state; break;;
    esac
  done
  if [ ${#run[@]} -gt 0 ]; then echo "landable (bottom-up): ${run[*]}"; else echo "landable: none"; fi
  if [ -n "$ceiling" ]; then echo "ceiling: #$ceiling ($reason)"; else echo "ceiling: none, every listed PR is verified at its current patch"; fi
}

case "${1:-}" in
  record) shift; cmd_record "$@";;
  status) shift; cmd_status "$@";;
  landable) shift; cmd_landable "$@";;
  *) sed -n 2,9p "$0"; exit 2;;
esac
