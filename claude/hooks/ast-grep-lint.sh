#!/bin/bash
# ast-grep lint hook for Claude Code
# Runs ast-grep scan on edited files

# Get the file paths from environment variable
FILE_PATHS="$CLAUDE_FILE_PATHS"

if [ -z "$FILE_PATHS" ]; then
    exit 0
fi

# Global rules directory
GLOBAL_RULES="$HOME/.claude/ast-grep-rules"

# Check if project has its own sgconfig.yml (prefer project rules)
if [ -f "sgconfig.yml" ] || [ -f "sgconfig.yaml" ]; then
    # Use project's own ast-grep config
    sg scan $FILE_PATHS 2>&1
else
    # Use global rules
    sg scan --config "$GLOBAL_RULES/sgconfig.yml" $FILE_PATHS 2>&1
fi

# Exit code: 0 = pass, non-zero = issues found
# We always exit 0 to not block Claude, just report issues
exit 0
