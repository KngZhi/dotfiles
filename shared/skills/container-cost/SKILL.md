---
name: container-cost
description: 整理货柜材料、查询船期，或准备、计算、分类和导入 K2046 货柜成本文件。
---

# 货柜材料与成本

按用户请求的阶段推进，完成该阶段所需的整理与验证。已明确授权的后续步骤
可以继续；仅整理材料或计算成本，不等于授权创建和提交采购单。

## 按任务读取

- 接收微信或待整理材料、查询船期：读 [references/intake.md](references/intake.md)。
- 准备工作簿参数、验证或计算成本：读 [references/costing.md](references/costing.md)。
- 产品分类、供应商名称或大包装数：读 [references/classification.md](references/classification.md)。
- 导入 K2046：读 [references/import.md](references/import.md)。
- 安装依赖、连接 API 或处理环境问题：读 [references/setup.md](references/setup.md)。

命令从本技能目录执行。工作簿流程实际使用 `src/calculate.ts` 和
`src/business-rules.ts`；这里尚未接入独立的 chile-landed-cost-calculator。
以当前执行路径为准，不把计划中的共享接入描述为已完成。

## 共同约束

保留原始材料，按柜号关联文件。区分真实金额、业务默认值、暂估和缺失字段，
预计日期不得冒充实际到柜日期。涉及单位转换、费用分摊或合并行时，使用
现有引擎并验证数量与货值，不另写一份计算公式。

完成有持久结果的步骤后，在 `~/repo/org/containers.org` 按柜号更新对应的
`SUPPLIER`、`XLSX`、`PO_IDS` 和 checklist。只记录实际完成的状态；
计算完成不能标记入库完成。

报告产物路径、完成阶段、关键数据来源及真正缺失的字段。单个字段暂缺时
仍可完成独立的归档与核对工作，缺少计算必填项时保留待补清单。
