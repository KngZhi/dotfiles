The orignal prompt is from: https://www.dzombak.com/blog/2025/08/getting-good-results-from-claude-code/

# Development Guidelines

## Philosophy

### Core Beliefs

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious

### Simplicity Means

- Single responsibility per function/class
- Avoid premature abstractions
- No clever tricks - choose the boring solution
- If you need to explain it, it's too complex

## Process

### 1. Implementation Flow

1. **Understand** - Study existing patterns in codebase
2. **Test** - Write test first (red)
3. **Implement** - Minimal code to pass (green)
4. **Refactor** - Clean up with tests passing
5. **Commit** - With clear message linking to plan

### 2. Session Startup

- Start new sessions by running `git log --oneline -10` to quickly load context about recent work
- This lets you continue where the last session left off without the user re-explaining

### 3. When Stuck (After 3 Attempts)

**CRITICAL**: Maximum 3 attempts per issue, then STOP.

1. **Document what failed**:
   - What you tried
   - Specific error messages
   - Why you think it failed

2. **Research alternatives**:
   - Find 2-3 similar implementations
   - Note different approaches used

3. **Question fundamentals**:
   - Is this the right abstraction level?
   - Can this be split into smaller problems?
   - Is there a simpler approach entirely?

4. **Try different angle**:
   - Different library/framework feature?
   - Different architectural pattern?
   - Remove abstraction instead of adding?

### 4. Debugging with `git bisect`

When tracking down when a bug was introduced, use `git bisect` to binary-search through commit history:
- Write a test condition that reproduces the bug
- Let `git bisect run` automate the search
- This efficiently answers "which commit first caused this bug"

## Technical Standards

### Architecture Principles

- **Composition over inheritance** - Use dependency injection
- **Interfaces over singletons** - Enable testing and flexibility
- **Explicit over implicit** - Clear data flow and dependencies
- **Test-driven when possible** - Never disable tests, fix them

### Code Quality

- **Every commit must**:
  - Compile successfully
  - Pass all existing tests
  - Include tests for new functionality
  - Follow project formatting/linting

- **Before committing**:
  - Run formatters/linters
  - Self-review changes
  - Ensure commit message explains "why"

- **Atomic commits**: Commit only the files you touched, list each path explicitly.
  ```bash
  # For tracked files
  git commit -m "<scoped message>" -- path/to/file1 path/to/file2

  # For brand-new files
  git restore --staged :/ && git add "path/to/file1" "path/to/file2" && git commit -m "<scoped message>" -- path/to/file1 path/to/file2
  ```

### ast-grep Linting

After writing or modifying Python/TypeScript code, run ast-grep to check for code issues:
```bash
sg scan --config ~/.claude/ast-grep-rules/sgconfig.yml <files_you_modified>
```
Fix any errors before committing. Rules include:
- No bare `except:` without specifying exception type
- Prefer logging over print()
- No console.log() in production code

### Error Handling

- Fail fast with descriptive messages
- Include context for debugging
- Handle errors at appropriate level
- Never silently swallow exceptions

## Decision Framework

When multiple valid approaches exist, choose based on:

1. **Testability** - Can I easily test this?
2. **Readability** - Will someone understand this in 6 months?
3. **Consistency** - Does this match project patterns?
4. **Simplicity** - Is this the simplest solution that works?
5. **Reversibility** - How hard to change later?

## Project Integration

### Learning the Codebase

- Find 3 similar features/components
- Identify common patterns and conventions
- Use same libraries/utilities when possible
- Follow existing test patterns

### Tooling

- Use project's existing build system
- Use project's test framework
- Use project's formatter/linter settings
- Don't introduce new tools without strong justification

## Quality Gates

### Definition of Done

- [ ] Tests written and passing
- [ ] Code follows project conventions
- [ ] No linter/formatter warnings
- [ ] Commit messages are clear
- [ ] Implementation matches plan
- [ ] No TODOs without issue numbers

### Test Guidelines

- Test behavior, not implementation
- One assertion per test when possible
- Clear test names describing scenario
- Use existing test utilities/helpers
- Tests should be deterministic

## k2046 — 库存管理 CLI

`k2046` 是 TextilCalido 库存管理系统的 CLI 工具，可直接在终端操作业务数据。

```bash
k2046 <command> <subcommand> [options]
```

| 命令 | 用途 | 子命令（2026-06 实测全集） |
|------|------|-----------|
| `report` | 销售/采购报表 | `sale-day`, `sale-week`, `sale-month`, `sale-detail`, `purchase-detail` |
| `product` | 产品目录 | `list`, `categories`, `categories-flat`, `tags`, `check <skus>`, `batch-import <file>`, `update <sku>`, `update-image [sku]` |
| `stock` | 库存管理 | `list`; `transfers list/get/update <id>` |
| `purchase` | 采购单 | `list`, `get <id>`, `pays <ids>`, `update <id>`, `import-container <file>`, `commit <ids>`, `cancel <ids>`, `by-product <product-id>` |
| `sale` | 销售单 | `list`, `get <id>`, `temps`, `by-product <product-id>`, `final-pays <ids>`, `print-retail <id>`, `create`, `create-from-text`, `edit-order <id> --plan <json>`（改单首选，自动处理 stocked/picked/shipped 回退恢复）, `save-commit <id>`, `unsave <id>`, `cancel <ids>`, `delete <ids>`, `delete-detail <id>`, `pay <id>`, `unpay <ids>`, `ship/unship <ids>`, `pick/unpick <ids>`, `confirm/unconfirm <ids>` |
| `supplier` | 供应商 | `list` |
| `customer` | 客户 | `list`, `create`, `update <id>` |
| `shipper` | 物流网点 | `list`, `create`, `update <id>` |

用 `k2046 <command> <subcommand> --help` 查看具体参数。注意：本表为实测全集；安装版 CLI 可能落后于 `~/repo/chile-mono/apps/k2046-cli` 源码，子命令缺失时先 `npx tsx src/cli.ts <cmd> --help` 对照源码再判断。

## cass — 跨 Agent 历史搜索

解决问题前，先搜索是否有类似的历史记录。cass 索引了所有 Agent (Claude/Codex/Cursor/Gemini/OpenCode) 的会话历史。

**⚠️ 永远不要裸跑 `cass`** — 会启动交互式 TUI。必须用 `--robot` 或 `--json`。

```bash
# 搜索历史
cass search "authentication error" --robot --limit 5

# 查看具体会话
cass view /path/to/session.jsonl -n 42 --json

# 扩展上下文 (前后 3 条消息)
cass expand /path/to/session.jsonl -n 42 -C 3 --json

# 检查健康状态
cass health
```

**常用参数**:
| 参数 | 作用 |
|------|------|
| `--robot` / `--json` | 机器可读 JSON 输出 (必须!) |
| `--fields minimal` | 精简输出: 只返回 path, line, agent |
| `--limit N` | 限制结果数量 |
| `--agent NAME` | 过滤特定 agent (claude, codex, cursor 等) |
| `--days N` | 限制最近 N 天 |

stdout = 数据，stderr = 诊断信息。Exit 0 = 成功。

## Worklog — 会话总结

每次会话结束时，如果用户要求总结，将会话摘要写入 `~/repo/org/worklog/YYYY-MM-DD.md`。

- 一天一个文件，多次会话追加写入
- 格式：

```markdown
### HH:MM — [project-name] — [one-line summary]

**What was done:**
- [concise bullet points]

**Decisions:**
- [key decisions and why, omit if none]

**Files changed:**
- `path/to/file` — [what changed]

**Open items:**
- [unresolved issues, omit if none]
```

- 如果文件不存在，先写 `# Worklog YYYY-MM-DD` 作为标题
- 保持简洁，5-15 行，聚焦一周后回顾仍有价值的信息

---

## Important Reminders

**NEVER**:
- Use `--no-verify` to bypass commit hooks
- Disable tests instead of fixing them
- Commit code that doesn't compile
- Make assumptions - verify with existing code

**ALWAYS**:
- Commit working code incrementally
- Update plan documentation as you go
- Learn from existing implementations
- Stop after 3 failed attempts and reassess

- The code should always follow fail-fast Philosophy.
