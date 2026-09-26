---
name: triage
description: Read-only intake triage of a Linear issue. Use when asked to 分诊 / triage an issue, or when an issue has just entered Triage — classify it, size it against the repository, list the author-only decisions, draft acceptance criteria, and recommend the next step. Never edit code, create issues, or commit.
---

# Triage（入口分诊）

只读。目的：让人一眼决定"贴 Development 开工 / 先答几个问题 / 按建议拆分"。

## 步骤

1. **读 issue 全文**，包括评论和链接的 GitHub issue / PR。
2. **看仓库**：找到会动到的模块和文件，读相关测试和 AGENTS.md，估算改动行数。
3. **分类**：Bug / Feature / Improvement / 设计讨论（RFC）。Bug 先确认能否复现（只读，可以跑测试）。
4. **定大小**：只有两种结论——「一个 PR 装得下（≤300 行，不含测试/文档）」或「要拆」。
5. **找缺口**：对照「可派发的标准」六条，列出缺的；把作者才能定的取舍单独列成问题。
6. **写建议**：见下面格式。

## 回复格式（Linear markdown）

```
## 分诊
- 类型：Bug | Feature | Improvement | RFC
- 大小：一个 PR 装得下（约 N 行，涉及 a.ts / b.ts） | 要拆
- 能否复现（Bug）：能 / 不能 / 未试，原因

## 需要作者决定
- 问题 1（为什么 agent 不能替你定）
- （没有就写"无"）

## 建议的验收标准
- 可观察行为 1（命令/URL + 期望输出）
- …

## 建议
贴 `Development` 开工 | 先回答上面的问题 | 按下面拆分

+++拆分建议（要拆时）
① 标题 — 目标一句话 — 验收标准 — 估算行数 — 依赖
② …
+++
```

## 规则

- 不改代码、不建 issue、不提交、不开 PR。人回复"按这个建子 issue"后，再在同一线程里创建子 issue（挂在本 issue 下、同项目、状态 Todo、不贴 Development）。
- 引用 GitHub 写完整 URL 或 `GH-N`，不写裸 `#N`。
- 估算要说明依据（改哪些文件、参照哪个已完成的类似 PR）。
- 不确定就写不确定，不要补成看起来完整的答案。
