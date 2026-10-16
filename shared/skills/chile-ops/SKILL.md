---
name: chile-ops
description: Chile / SAOKO 业务工作的唯一全局入口：货柜、整理材料、成本计算、K2046、订货补货、采购、库存、价签、Linear 订单。只在做这类工作时用它按需加载 ~/repo/chile-ops 里的具体业务技能。
---

# Chile 业务入口

业务技能（container-intake、container-cost、chile-landed-cost-calculator 等）只放在
`~/repo/chile-ops/skills/`，不单独注册为全局技能。本技能只负责按需读取它们。

1. `git -C ~/repo/chile-ops pull --ff-only`。工作树有他人未提交改动时不要强制更新，直接用现有版本。
2. 读 `~/repo/chile-ops/AGENTS.md` 和 `docs/workflow-index.md`，按任务找到对应技能。
3. 读该技能的 `~/repo/chile-ops/skills/<名称>/SKILL.md`，按其中规则和引用文件工作。
   涉及 Linear 时先按全局 `linear-usage` 的要求读取，再读业务 SOP。
4. 技能里的命令从该技能目录执行，例如 `cd ~/repo/chile-ops/skills/container-cost`。

会话从 `~/repo/chile-ops` 目录打开时，仓库内技能会自动加载，不必经过本技能。
本机没有 `~/repo/chile-ops`（云端会话）时使用 `chile-ops-loader` 挂载仓库。
