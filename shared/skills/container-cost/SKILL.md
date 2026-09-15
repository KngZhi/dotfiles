---
name: container-cost
description: 对已整理并核对完成的标准货柜表配置费用、计算成本、补分类并按授权导入 K2046；原始材料整理使用 container-intake。
---

# 货柜成本计算

接收 `container-intake` 用 `sheets.py export` 从 Google 表格导出的标准 `data/config` xlsx，配置费用并运行现有成本引擎。
先读工作簿及材料索引，确认必填项和计价单位；发现归属、整柜明细、采购价或费用范围
未核清时，交回 [container-intake](../container-intake/SKILL.md) 完成缺失部分。
不能因为已有 Excel 就视为可以计算；整理材料或计算成本也不等于授权创建和提交采购单。

## 按任务读取

- 标准输入的费用参数、验证或成本计算：读 [references/costing.md](references/costing.md)。
- 产品分类、供应商名称或大包装数：读 [references/classification.md](references/classification.md)。
- 导入 K2046：读 [references/import.md](references/import.md)。
- 安装依赖、连接 API 或处理环境问题：读 [references/setup.md](references/setup.md)。

命令从本技能目录执行。工作簿流程实际使用 `src/calculate.ts` 和
`src/business-rules.ts`；这里尚未接入独立的 chile-landed-cost-calculator。
以当前执行路径为准，不把计划中的共享接入描述为已完成。
人民币兑美元报价复用相邻 `chile-landed-cost-calculator/scripts/boc-exchange-rate.mjs`；
这只共享中行汇率读取，不改变上述成本引擎边界。

## 导入前必须完成

成本结果写入该柜原有 Google 表格的「成本计算结果」工作表，与 data/config 同文件，不能另建一份作为最终交付。
先交付结果表，补齐所有价格并审查分类，再导出最新成本工作表运行价格预检。
成本价、箱价格、大包价格、包价格、单价中任一值为0、空白、非数字或负数，均阻断正式导入；分类1/分类2空白同样阻断。
一般导入授权、已存在商品或“小问题”不能解除价格阻断，不猜售价、不复制其他档售价凑数。
所有正式导入必须使用 `npm run import:checked -- <成本.xlsx> <导入参数>`，禁止直接调用CLI绕过检查；详见 references/import.md。

## 共同约束

正式输入放 `~/Library/CloudStorage/OneDrive-Personal/source_files/containers`，
成本结果放其 `generated/`。未完成的整理稿留在 `00_待整理货柜`，不放入正式输入目录。
区分真实金额、业务默认值、暂估和缺失字段，预计日期不得冒充实际到柜日期。
费用分摊和散件合并使用现有引擎，验证数量与货值，不另写一份成本公式。

完成有持久结果的步骤后，在 `~/repo/org/containers.org` 按柜号更新对应的
`SUPPLIER`、`XLSX`、`PO_IDS` 和 checklist。只记录实际完成的状态；
计算完成不能标记入库完成。

报告产物路径、完成阶段、关键数据来源及真正缺失的字段。用户已授权的后续步骤
可继续；缺少计算必填项时不要输出看似完整的成本结果。
