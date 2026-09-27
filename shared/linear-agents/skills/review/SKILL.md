---
name: review
description: Read-only review panel for a pull request delivered against a Linear issue. Use when asked to 审查 / review a PR. Fans out one subagent per lens below (correctness, ticket compliance, simplicity, evidence verification), then judges the merged findings into one verdict comment. Never edits code, commits, or approves/merges.
---

# Review（审查面板）

只读。目的：用几个互不重叠的角度并行审一个 PR，合并成**一条**结论，交给人或交给修复者。
角度的定义就是下面「Lenses」里的小节：**要加一个角度，加一个小节即可**；要去掉，删掉小节。

## 准备

1. 读 issue 正文（目标、验收标准）和线程里施工方的交付报告（它声称跑过什么、贴了什么输出）。
2. `gh pr view <url> --json title,body,baseRefName,headRefName` 拿到分支；`gh pr diff <url>` 拿 diff。
3. 在当前 worktree 只读签出 PR 头（`git fetch origin <head> && git checkout --detach FETCH_HEAD`），审完切回，`git status` 前后都要干净。
4. 读仓库 AGENTS.md / CLAUDE.md：它们定义了这个仓库的检查命令和证据格式。

## 分发

用 Agent 工具**同时**启动子代理，每个 lens 一个，`subagent_type` 用 `general-purpose`，把该小节全文、issue 正文、PR 链接和 worktree 路径交给它。子代理只读，可以跑仓库声明的检查命令。
每个子代理只回一份 JSON：

```json
{ "lens": "<名字>", "findings": [
  { "severity": "blocking|non-blocking", "location": "file:line", "claim": "一句话", "evidence": "命令/输出/引用", "fix": "具体改法" }
], "checked": ["做了哪些验证"] }
```

## Lenses

### critical-issues（正确性）
只找会让改动出错或不安全的缺陷：错误行为、边界条件、回归风险；破坏调用方、契约或向后兼容；失败处理、重试、取消、并发、权限；引入的安全或数据丢失风险；重要行为缺测试。不报风格偏好，不报猜测性重构。

### ticket-compliance（是否做了要求的事）
只看实现是否交付了 issue 声明的意图：每一条验收标准是否可观察地满足；有没有漏做或只做一半；有没有与 issue 无关的范围蔓延；承诺的行为需要的测试和文档是否齐。不要因为偏好另一种做法而重设计正确的实现。

### simplicity（Linus 视角）
只看实现的形状和可维护性：仓库架构、文件位置和依赖方向；错误的数据结构或可消除的特例；重复逻辑该复用已有实现；不必要的抽象、依赖、配置或提前设计；任何保持行为不变的简化。主动找"删掉一整层"的机会。只报高置信度的结构问题并给出具体简化；正确性和需求覆盖归其它 lens。

### evidence-verification（校验施工方的证据）
把施工方交付报告里声称的每一条验证**独立重跑一遍**：仓库声明的检查命令、它贴的 curl/CLI 命令、它给的期望输出。逐条记录：命令、它声称的结果、你得到的结果、是否一致。任何"声称通过但重跑不过""贴的输出与真实输出不符""说跑了但没有证据"的，都是 blocking。没有声称的验证但验收标准要求的，也要跑。

## 合并与结论（主会话当 judge）

1. 汇总所有 findings，去重（同一问题不同 lens 只留证据最强的一条），去掉没有证据的。
2. 只有满足"有 file:line 或命令输出作证据"的才能是 blocking。
3. 在 issue 上发**一条顶层评论**，格式：
   - 有 blocking：第一行 `@codex1 需修改：N 项阻塞`，然后阻塞项清单（每条：位置、问题、证据、改法），再列非阻塞项。
   - 无 blocking：第一行 `审查通过`（不要 @ 任何人），然后非阻塞项（可为空）和各 lens 的 `checked` 摘要。
4. 结论评论末尾附一行各 lens 用时/结果的小表，便于校准角度。

## 规则

- 不改代码、不提交、不 approve、不 merge；只读签出必须还原。
- 所有 lens 共用本会话的 worktree；不要另外 clone 仓库或新建 worktree（每份 chile-mono 检出约 1 GB，机器资源有限）。
- 引用 GitHub 写完整 URL 或 `GH-N`，不写裸 `#N`。
- 子代理没回来或报错，就在结论里写明该 lens 缺席，不要补写它的结论；缺席的 panel 不能给出"审查通过"。
