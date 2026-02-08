#!/usr/bin/env bash

set -u

input="$(cat)"

jq_bin="$(command -v jq 2>/dev/null || true)"
if [[ -z "$jq_bin" ]]; then
  # Claude Code may run commands with a minimal PATH. Try common locations.
  if [[ -x "/opt/homebrew/bin/jq" ]]; then
    jq_bin="/opt/homebrew/bin/jq"
  elif [[ -x "/usr/local/bin/jq" ]]; then
    jq_bin="/usr/local/bin/jq"
  elif [[ -x "/usr/bin/jq" ]]; then
    jq_bin="/usr/bin/jq"
  fi
fi

if [[ -z "$jq_bin" ]]; then
  echo "[?] jq missing"
  exit 0
fi

model="$(echo "$input" | "$jq_bin" -r '.model.display_name // .model.id // "?"')"
cost="$(echo "$input" | "$jq_bin" -r '.cost.total_cost_usd // 0')"
cost_fmt="$(printf "%.4f" "$cost")"

# Claude Code's statusLine JSON may include `context_window` (varies by version/build).
# If it's missing, fall back to the transcript's latest assistant usage as a rough
# approximation (latest request total input tokens ~= current context size).
ctx_tokens=""
out_tokens=""

# Prefer context_window fields if Claude Code ever provides them in the future.
ctx_from_status="$(echo "$input" | "$jq_bin" -r '.context_window.total_input_tokens? // empty' 2>/dev/null || true)"
out_from_status="$(echo "$input" | "$jq_bin" -r '.context_window.total_output_tokens? // empty' 2>/dev/null || true)"
ctx_size_from_status="$(echo "$input" | "$jq_bin" -r '.context_window.context_window_size? // empty' 2>/dev/null || true)"

if [[ -n "$ctx_from_status" && -n "$out_from_status" ]]; then
  ctx_tokens="$ctx_from_status"
  out_tokens="$out_from_status"
else
  transcript_path="$(echo "$input" | "$jq_bin" -r '.transcript_path // empty')"
  if [[ -n "$transcript_path" && -f "$transcript_path" ]]; then
    # Fast path: parse only the last few lines to find the most recent assistant usage.
    usage_tsv="$(
      tail -n 200 "$transcript_path" 2>/dev/null | "$jq_bin" -rs '
        map(select(.type == "assistant" and (.message.usage? != null)))
        | (last // empty)
        | [
            ((.message.usage.input_tokens // 0)
              + (.message.usage.cache_read_input_tokens // 0)
              + (.message.usage.cache_creation_input_tokens // 0)),
            (.message.usage.output_tokens // 0)
          ]
        | @tsv
      ' 2>/dev/null || true
    )"

    if [[ -n "$usage_tsv" ]]; then
      ctx_tokens="${usage_tsv%%$'\t'*}"
      out_tokens="${usage_tsv#*$'\t'}"
    fi
  fi
fi

if [[ -n "${ctx_tokens}" && -n "${out_tokens}" ]]; then
  if [[ -n "$ctx_size_from_status" ]]; then
    total="$((ctx_tokens + out_tokens))"
    pct="$((total * 100 / ctx_size_from_status))"
    echo "[$model] ${total}/${ctx_size_from_status} (${pct}%) | \$$cost_fmt"
  else
    echo "[$model] ctx ${ctx_tokens} | out ${out_tokens} | \$$cost_fmt"
  fi
else
  echo "[$model] \$$cost_fmt"
fi

exit 0
