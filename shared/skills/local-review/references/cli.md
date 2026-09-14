# Local CLI execution

Use the host's process tools to set an explicit working directory, collect exit
codes, retain stdout/stderr, and wait for children. Check installed `claude --help`
and `codex exec --help` before relying on flags. Keep the configured model and effort
unless the user overrides them. Use fresh sessions; never resume an unrelated
session with `--last` or `--continue`.

Write each prompt as UTF-8 text using a file-writing tool or a quoted heredoc.
Pass it through stdin; do not interpolate its contents into shell command text.
In the examples, `review_worktree`, `review_artifacts`, and `review_prompt` are
coordinator-resolved absolute paths, not literal placeholders to send to a child.
The parent owns output redirection, so children need not write report files.

## Claude Code

For Simplify, use the existing checkout and normal scoped edit permissions:

```bash
cd "$review_worktree"
claude -p --permission-mode acceptEdits --permission-prompts none \
  --output-format json < "$review_prompt" \
  > "$review_artifacts/simplify.json" 2> "$review_artifacts/simplify.stderr"
```

For either read-only review, expose only file inspection tools and disable MCP
tools. Set the role's output filenames separately when two Claude processes run:

```bash
cd "$review_worktree"
claude -p --permission-mode plan --permission-prompts none \
  --tools 'Read,Glob,Grep' --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --output-format json < "$review_prompt" \
  > "$review_artifacts/linus.json" 2> "$review_artifacts/linus.stderr"
```

The coordinator supplies the diff and skill path; the child can read them without
shell or Skill tools. Inspect the JSON result, error indication, and permission
denials as well as the process exit code. A read-only control here is a CLI tool
restriction, not proof that arbitrary configured hooks cannot have side effects.
Do not add permission bypass flags to make an unsuccessful run appear complete.
If nested CLI execution is refused, report the exact runtime limitation rather
than silently removing the runtime's nesting guard.

## Codex

For a read-only pass:

```bash
codex exec -C "$review_worktree" -s read-only \
  -o "$review_artifacts/code-review.md" - < "$review_prompt" \
  > "$review_artifacts/code-review.stdout" 2> "$review_artifacts/code-review.stderr"
```

For a user-assigned Codex Simplify pass, use `-s workspace-write` with distinct
output filenames. Read-only requests keep `-s read-only`. Neither mode authorizes
external mutations: explicitly prohibit commit/push, remote comments, MCP writes,
and further delegation in every child prompt. A filesystem sandbox alone does
not restrict every possible remote tool. Do not bypass sandbox/approval controls.

## Feedback and lifecycle

Await independent reviewers concurrently through the host's process tools, keeping
each process/session ID and exit code. Starting processes in the background and
returning without collecting them does not complete this skill. Retain partial
reports on failure and report which pass is missing. No Trigger or detached daemon
is involved: the coordinating session must remain available to collect results.
