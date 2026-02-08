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

### 1. Planning & Staging

Break complex work into 3-5 stages. Document in `IMPLEMENTATION_PLAN.md`:

```markdown
## Stage N: [Name]
**Goal**: [Specific deliverable]
**Success Criteria**: [Testable outcomes]
**Tests**: [Specific test cases]
**Status**: [Not Started|In Progress|Complete]
```
- Update status as you progress
- Remove file when all stages are done

### 2. Implementation Flow

1. **Understand** - Study existing patterns in codebase
2. **Test** - Write test first (red)
3. **Implement** - Minimal code to pass (green)
4. **Refactor** - Clean up with tests passing
5. **Commit** - With clear message linking to plan

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

---

## 并行策略

**优先并行执行，最大化吞吐量：**

- 优先使用 `background_task` 并行执行多个 explore/librarian agent
- 搜索代码时，同时启动 2-3 个 explore agent 从不同角度搜索
- 独立的任务要并行而非串行执行
- 多个文件读取、多个搜索查询应该在同一个消息中并行发起
- 不要等待一个 agent 完成再启动下一个，除非有数据依赖

**示例：**
```
// 正确：并行启动多个搜索
background_task(agent="explore", prompt="Find auth implementations...")
background_task(agent="explore", prompt="Find error handling patterns...")
background_task(agent="librarian", prompt="Find JWT best practices...")

// 错误：串行等待
result1 = task(...) // 等待完成
result2 = task(...) // 再等待
```

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