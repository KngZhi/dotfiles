# ExecPlans
When writing complex features or significant refactors, use an ExecPlan (as described in PLANS.md) from design to implementation.

# atomic commits
Keep commits atomic: commit only the files you touched and list each path explicitly. For tracked files run `git commit -m "<scoped message>" -- path/to/file1 path/to/file2`. For brand-new files, use the one-liner `git restore --staged :/ && git add "path/to/file1" "path/to/file2" && git commit -m "<scoped message>" -- path/to/file1 path/to/file2`

# ast-grep linting
After writing or modifying Python/TypeScript code, run ast-grep to check for code issues:
```bash
sg scan --config ~/.claude/ast-grep-rules/sgconfig.yml <files_you_modified>
```
Fix any errors before committing. Rules include:
- No bare `except:` without specifying exception type
- Prefer logging over print()
- No console.log() in production code

