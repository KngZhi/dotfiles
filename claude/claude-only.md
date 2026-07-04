
---

# Claude Code 专用指令

## 并行评估（每次 prompt 必须首先执行）

**BLOCKING REQUIREMENT**: 收到任何实现/修改/调查任务后，在做任何事之前，必须先输出以下评估：

```
## Team 评估
- 涉及独立文件/模块数: N
- 有顺序依赖: Yes/No
- 判定: [使用 team / 不使用 team]
- 原因: [一句话]
```

**决策树：**
```
收到 prompt
  ├─ 涉及 ≥2 个独立文件/模块的改动？
  │    ├─ Yes → 这些改动之间有顺序依赖吗？
  │    │         ├─ Yes → 不用 team，串行执行
  │    │         └─ No  → ★ 自动 spawn team
  │    └─ No  → 不用 team
  ├─ 需要同时研究多个方向？（调查 bug、对比方案）
  │    └─ Yes → ★ 自动 spawn team（每个方向一个 teammate）
  └─ 其他 → 不用 team
```

**spawn team 规则：**
1. **按文件所有权分区** — 每个 teammate 负责不同文件，零冲突
2. **给每个 teammate 完整上下文** — 包括：目标、负责的文件列表、验收标准
3. **3-5 个 teammates** — 超过 5 个收益递减
4. 用 `TeamCreate` 创建 team，然后用 `Agent` tool（带 `team_name` 和 `name`）spawn teammates

**常见拆分模式：**

| 任务类型 | 拆分方式 |
|---------|---------|
| 新功能（多文件） | 实现 + 测试 + 类型/接口 各一个 |
| Bug 修复（跨模块） | 每个模块一个 |
| 重构 | 按目录/模块分 |
| 调查研究 | 每个假说/方向一个 |
| Code review | 安全 / 性能 / 逻辑 各一个 |

**不使用 team：** 单文件编辑、简单问答、git 操作、所有步骤有顺序依赖

## Tool 与 Subagent 并行（始终适用）

- 多个独立 tool call 始终在同一消息中并行发起
- 独立的研究/探索任务使用 Agent tool 的 `run_in_background: true` 并行执行
- 搜索代码时，同时启动 2-3 个 explore agent 从不同角度搜索

## Planning with IMPLEMENTATION_PLAN.md

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

### Checkpoints (Mid-Task Snapshots)

For tasks spanning 3+ stages or involving significant research, write a `## Checkpoint` block at the bottom of `IMPLEMENTATION_PLAN.md` whenever:
- A stage is completed
- A key decision is made (e.g. chose library X over Y)
- About to attempt something risky or complex
- Session feels long (context may compress soon)

Format — keep it terse, append-only:
```markdown
## Checkpoint [HH:MM]
**At**: Stage N — [what just happened]
**Decided**: [key decisions and why, if any]
**Tried & Failed**: [dead ends worth remembering, if any]
**Next**: [concrete next action, not vague]
```

- Each checkpoint appends; don't overwrite previous ones
- When task completes and `IMPLEMENTATION_PLAN.md` is removed, checkpoints go with it (they're transient)
- If session resumes and `IMPLEMENTATION_PLAN.md` exists, read checkpoints first to restore context
