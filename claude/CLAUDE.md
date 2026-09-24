@~/repo/dotfiles/shared/agent-instructions.md

# Claude 专属规则

<!-- 在这里添加只适用于 Claude 的要求；共同规则维护在上方引用的文件中。 -->

## 1Password service account

Claude Code shells (`CLAUDECODE=1`) carry `OP_SERVICE_ACCOUNT_TOKEN`, a read-only
1Password service account for the `DEV` vault, loaded from the login keychain
(`op-service-account`) by `~/.zshenv`. Read `op://DEV/...` items with `op read` or
`op item get` directly, with no Touch ID prompt. The `Personal` vault is outside its
scope; ask the user to move a needed item into `DEV`. Pass values to commands
through environment variables or pipes, never into output or files.

## Trigger.dev runs

Check agent-runtime-trigger run status with the `trigger-tracker` agent rather than
`mcp__trigger__*`: the user-level `--dev-only` Trigger MCP server can cancel
in-flight runs on the same branch.
