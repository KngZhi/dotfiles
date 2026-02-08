#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')

# Git branch
BRANCH=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    [ -n "$BRANCH" ] && BRANCH=" [$BRANCH]"
fi

# Token usage
TOKENS=""
total_in=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
total_out=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')
if [ "$total_in" != "0" ] || [ "$total_out" != "0" ]; then
    total=$(( total_in + total_out ))
    if [ "$total" -ge 1000000 ]; then
        display=$(awk "BEGIN{printf \"%.1fM\", $total/1000000}")
    elif [ "$total" -ge 1000 ]; then
        display=$(awk "BEGIN{printf \"%.1fk\", $total/1000}")
    else
        display="$total"
    fi
    TOKENS=" | ${display} tokens"
fi

# Context remaining percentage
CONTEXT=""
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')
if [ -n "$remaining" ]; then
    remaining_int=$(printf "%.0f" "$remaining")
    CONTEXT=" | ${remaining_int}% left"
fi

# Cost
COST=""
cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
if [ -n "$cost_usd" ] && [ "$cost_usd" != "0" ]; then
    COST=" | \$$(printf "%.2f" "$cost_usd")"
fi

echo "[$MODEL] ${DIR##*/}$BRANCH$TOKENS$CONTEXT$COST"
