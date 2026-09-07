#!/usr/bin/env bash
# Ask the other coding agent (Claude Code or Codex CLI) for a second opinion.
# Read-only / advisory only — the consulted agent cannot edit files.
set -euo pipefail

# Hard stop on recursion: the consulted agent also loads the agent-huddle
# skill and could otherwise try to huddle back (or huddle again) from
# inside this very call, with no cap enforced. This env var is exported
# below, right before spawning the child agent, so only that child's own
# process tree ever sees it — separate top-level huddle.sh calls (the
# legitimate --resume-last follow-up rounds) are unaffected.
if [ "${AGENT_HUDDLE_ACTIVE:-0}" = "1" ]; then
  echo "huddle.sh: refusing to nest — this call is already running inside a huddle consult. Answer directly instead of re-consulting." >&2
  exit 1
fi

usage() {
  cat <<'EOF'
Usage: huddle.sh --ask <claude|codex> [--resume-last] [--cwd DIR] [--] [PROMPT]

  --ask claude|codex   Which agent to consult (the OTHER one, not yourself).
  --resume-last        Continue the previous consult thread in this cwd
                        instead of starting fresh (cheaper follow-up round).
  --cwd DIR            Directory to run the consult in (default: pwd).
  PROMPT               The question/context. Read from stdin if omitted.
EOF
}

# Resolve the script's own absolute directory BEFORE any `cd`, so a
# relative invocation (e.g. `./huddle.sh --cwd /other/repo ...`) can't be
# tricked into resolving its helper script relative to --cwd instead.
script_dir="$(cd "$(dirname "$0")" && pwd)"

ask=""
resume=0
cwd="$(pwd)"
prompt=""

while [ $# -gt 0 ]; do
  case "$1" in
    --ask)
      [ $# -ge 2 ] || { echo "huddle.sh: --ask requires a value" >&2; exit 2; }
      ask="$2"; shift 2 ;;
    --resume-last) resume=1; shift ;;
    --cwd)
      [ $# -ge 2 ] || { echo "huddle.sh: --cwd requires a value" >&2; exit 2; }
      cwd="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --) shift; prompt="$*"; break ;;
    -*) echo "huddle.sh: unknown option '$1'" >&2; usage >&2; exit 2 ;;
    *) prompt="$*"; break ;;
  esac
done

if [ -z "$prompt" ]; then
  prompt="$(cat)"
fi

if [ -z "$prompt" ]; then
  echo "huddle.sh: no prompt given (arg or stdin)" >&2
  usage >&2
  exit 2
fi

preamble="You are being consulted by another coding agent that is stuck on a problem in this repository. Give your honest technical opinion. This is advisory only — you cannot and must not edit any files. Be direct: state your conclusion first, then your reasoning in a few bullet points."

full_prompt="$preamble

---

$prompt"

cd "$cwd"
# Canonical physical path, so symlink aliases of the same repo (or a
# trailing `--cwd .`) share one consult thread instead of splitting state.
cwd="$(pwd -P)"

state_dir="$HOME/.local/state/agent-huddle"
mkdir -p "$state_dir"
state_key="$(printf '%s' "$cwd" | shasum -a 256 | cut -d' ' -f1)"

export AGENT_HUDDLE_ACTIVE=1

case "$ask" in
  claude)
    # `claude -p --resume` needs an explicit session id (no --last in print
    # mode), so persist the session id per-cwd for the follow-up round.
    state_file="$state_dir/claude-session-$state_key"

    if [ "$resume" = 1 ]; then
      if [ ! -f "$state_file" ]; then
        echo "huddle.sh: no previous claude consult session found for $cwd; drop --resume-last" >&2
        exit 1
      fi
      session_id="$(cat "$state_file")"
      claude -p --resume "$session_id" --permission-mode plan --output-format json "$full_prompt" \
        | python3 "$script_dir/extract-claude-result.py" "$state_file"
    else
      claude -p --permission-mode plan --output-format json "$full_prompt" \
        | python3 "$script_dir/extract-claude-result.py" "$state_file"
    fi
    ;;
  codex)
    # `codex exec resume --last` picks the most recently used Codex session
    # in this cwd, which may not be OUR consult thread (e.g. the user has
    # an unrelated interactive Codex session open here). Resume by the
    # exact session id we captured on the fresh call instead.
    state_file="$state_dir/codex-session-$state_key"
    # `codex exec` prints its human-readable transcript (including the
    # `session id: ...` line we need) to STDERR; the clean final reply is
    # the only thing on STDOUT. Split them instead of merging.
    codex_stderr="$(mktemp "${TMPDIR:-/tmp}/agent-huddle-codex-stderr.XXXXXX")"
    trap 'rm -f "$codex_stderr"' EXIT

    if [ "$resume" = 1 ]; then
      if [ ! -f "$state_file" ]; then
        echo "huddle.sh: no previous codex consult session found for $cwd; drop --resume-last" >&2
        exit 1
      fi
      session_id="$(cat "$state_file")"
      reply="$(codex exec resume "$session_id" -c sandbox_mode=read-only "$full_prompt" 2>"$codex_stderr")"
    else
      reply="$(codex exec -s read-only "$full_prompt" 2>"$codex_stderr")"
    fi

    new_session_id="$(grep -m1 '^session id:' "$codex_stderr" | awk '{print $3}')"
    if [ -n "$new_session_id" ]; then
      tmp_file="$state_file.tmp.$$"
      printf '%s' "$new_session_id" > "$tmp_file"
      mv "$tmp_file" "$state_file"
    fi
    printf '%s\n' "$reply"
    ;;
  *)
    echo "huddle.sh: --ask must be 'claude' or 'codex' (got: '$ask')" >&2
    usage >&2
    exit 2
    ;;
esac
