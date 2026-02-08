# Project Cleanup Workflow

**Cleanup Scope:** $ARGUMENTS

If no scope is specified, perform safe cleanup (dependencies, formatting, artifacts).
Supported scopes: `code`, `dependencies`, `artifacts`, `all`.
Example: "dependencies code"

## Commands:

1. **Dead Code Analysis** - Identify unused functions, classes, variables, and imports. **List findings for user review before removal.**

2. **Dependency Pruning & Update** - Scan dependency files (e.g., `package.json`, `go.mod`) to find unused packages and suggest updates for outdated ones.

3. **Codebase Formatting & Linting** - Apply standard formatters and linters across the project to enforce consistent coding style.

4. **Artifact & Cache Clearing** - Delete temporary build artifacts, logs, and cache files to reduce project size and avoid conflicts.