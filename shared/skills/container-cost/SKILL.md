---
name: container-cost
description: 货柜材料整理与成本计算自动化。用于从微信文件或 00_待整理货柜 接收装箱单、发票、提单和货代资料，按柜号归档，使用 Chrome 查询官方 ETA/ETD 和运输节点，补齐 Excel 参数，并用技能内 TypeScript 引擎执行验证、成本计算、分类及 K2046 导入。
---

# 集装箱成本计算自动化

先整理货柜材料并补全可验证的数据，再计算成本、分类并上传到 K2046。

处理材料接收或船期补全时，完整读取 [references/intake.md](references/intake.md)。

## 工作流程

```
0. intake     从微信文件或 00_待整理货柜 识别并归档同一货柜的材料
      ↓       → 提取柜号、货代号、提单号、船名航次、港口、费用和货品行
0.1 tracking  使用 Chrome 在承运人官网按柜号查询 ETA/ETD/当前节点
      ↓       → 更新 00_材料索引与待补.md，列出仍需用户补充的字段
0.2 prepare:config   按技能内 TypeScript 引擎准备 data/config 两个 sheet
      ↓       → 应用业务默认值；海运费、货柜号仍只填真实数据
1. validate   验证原始容器数据（条形码格式、货号存在性）
      ↓       → 更新 containers.org（供应商名、XLSX路径）
2. process    生成成本计算 Excel
      ↓       → 更新 containers.org（XLSX 指向成本文件）
3. classify   查看缺失分类，根据图片分类产品
      ↓       可 AI 辅助或人工填写
4. 散件合并   检测并合并散件行（见下方规则）
      ↓
5. 人工修改   调整价格等
      ↓
6. upload     k2046 purchase import-container（产品导入+入库单）
      ↓       → 更新 containers.org（✅入库清单、PO_IDS）
6. 图片整理   整理产品图片到柜号文件夹
              → 更新 containers.org（✅产品图片）
```

## 自动接收快捷规则

- 用户说“整理微信文件”“整理这个货柜”“看看待整理货柜”时，直接执行 intake，不要求用户先手工改名或分类。
- 默认只复制材料，不移动或删除微信原文件。
- 用柜号作为跨文件关联主键；柜号缺失时依次使用提单号、货代参考号、船名航次和商品明细建立候选分组。
- 每次 intake 都自动查询船期；无需用户再次提出“查 ETA”。
- 优先使用承运人官网。MSC 货柜使用 `https://www.msc.com/en/track-a-shipment`。
- 在索引中记录官网显示的 ETA、ETD、当前状态、最新地点、船名航次、目的港、码头、查询时间和来源 URL。
- 官网查不到时保留 `未查到` 及原因，不使用搜索摘要或旧文件日期伪装成当前 ETA。
- 重复运行必须幂等：复用现有货柜目录和索引，更新字段而不是生成重复副本。

## ⚠️ 核心规则：每步完成后必须更新 containers.org

- **不要等用户提醒！** 每个操作完成就同步更新 `~/repo/org/containers.org`
- 更新内容：SUPPLIER、XLSX、PO_IDS 属性 + checklist 勾选
- 搜索柜号定位条目

## 命令

```bash
cd ~/repo/dotfiles/shared/skills/container-cost

# 1. 检查新容器
npm run check

# 只读验证正式 K2046 api-client 的基础产品查询
npm run api-client:smoke -- S212

# 2. 验证数据
npm run validate <容器.xlsx>

# 3. 补全安全默认值与实时汇率（当前厂家承担内陆费的柜子）
# 未到港时清关杂费自动暂估 CLP 1,350,000
npm run prepare:config <容器.xlsx> -- --inland-payer factory

# 到港取得清关杂费实际金额后覆盖暂估值
npm run prepare:config <容器.xlsx> -- --clearance-misc-fee <实际CLP金额>

# 4. 生成成本（支持完整路径或容器ID）
npm run process <容器.xlsx>
npm run process <容器.xlsx> -- --force  # 忽略验证错误

# 只运行技能内成本引擎
npm run calculate <容器.xlsx>

# 5. 分类产品（查看缺失分类、根据图片分类）
npm run classify <成本Excel>
npm run classify <成本Excel> -- --image-folder "12.23照片整理MSMU4314897"
npm run classify <成本Excel> -- --output template.json   # 生成模板
npm run classify <成本Excel> -- --apply template.json    # 应用分类+大包装数
npm run classify <成本Excel> -- --apply-packing          # 单独填充大包装数

# 6. 上传到 K2046（使用 k2046 CLI）
k2046 purchase import-container <成本Excel> --container-no <柜号> --shipment-date <到柜日期>
k2046 purchase import-container <成本Excel> --parse-only   # 仅预览不导入
k2046 purchase import-container <成本Excel> --dry-run      # 导入但不提交
```

## 散件合并规则

process 生成成本文件后，检查是否存在散件行并自动合并。

### 识别规则

同一货号出现多行时：
- **整件行**：件数 > 1，装箱数 = 标准装箱数（如 80、30）
- **散件行**：件数 = 1，装箱数 ≠ 该货号的标准装箱数

例：HF106 有两行：23件×80（整件）+ 1件×97（散件，97≠80）

### 处理流程

1. 按货号分组，找出标准装箱数（件数>1 的行的装箱数）
2. 件数=1 且装箱数≠标准装箱数 → 标记为散件
3. 删除散件行，将散件数量填入整件行的「散件数」列
4. 同一货号多个散件行则累加（如 HM101: 50+112=162）
5. 没有散件的货号，散件数填 0

### 注意

- 值可能是字符串类型，比较前必须 `Number()` 转换
- 如果用户已新建「散件数」列，直接填入；否则新增该列
- 合并后打开文件让用户确认

## 验证规则

### validate 阶段

| 检查项 | 类型 | 说明 |
|--------|------|------|
| EAN-13 格式 | 错误 | 13位数字 + 校验位 |
| 货号存在性 | 错误 | 批量查询 K2046 existing API |
| 空条形码 | 错误或警告 | 仅当 K2046 既有产品也没有主条码时作为明确警告；不要用组件条码代替组合货号条码 |
| 分类缺失 | 警告 | 提示需人工补充，不阻止 |
| 供应商不匹配 | 警告 | 需 AI 判断纠正 |

### upload 阶段（k2046 CLI 处理）

| 检查项 | 类型 | 说明 |
|--------|------|------|
| 分类1 + 分类2 | 错误 | 必须填写完整 |

## 示例输出

### validate

```
📋 容器验证报告：MSMU4314897

✅ 验证通过
   58 个条形码全部正确

⚠️  缺少分类（需人工补充）：
   第 5 行: RF215 (6903041052158)
   第 6 行: RF216 (6903041052165)
   ... 还有 46 个缺少分类

📊 汇总：58 行，0 个格式错误，0 个系统未找到，48 个缺少分类
```

### process

```
🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢
集装箱成本计算 - MSMU4314897
🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢🚢

✓ 找到容器文件
   批量查询 58 个货号...
   ✓ 找到 10/58 个产品

✓ 生成文件：成本计算_(2026-02-08)MSMU4314897_2026_02_01_22_28.xlsx
```

### upload（k2046 CLI）

```
k2046 purchase import-container 成本计算_xxx.xlsx --container-no MSMU4314897

📤 Uploading file...
✓ Uploaded: abc123.xlsx
📥 Parsing 58 rows (3 pages)...
📦 Importing 58 products (createOrder=true, multiOrder=true)...
✓ Created purchase orders: 418, 419
✅ Committed purchase orders: 418, 419
```

## 项目结构

```
~/repo/dotfiles/shared/skills/container-cost/
├── agents/openai.yaml     # Codex UI 元数据
├── references/intake.md   # 微信材料归档、船期查询和参数补全
├── .npmrc                 # @kngzhi scope 路由；令牌只从 NODE_AUTH_TOKEN 读取
├── package.json
├── SKILL.md
└── src/
    ├── config.ts          # 配置（路径、API）
    ├── business-rules.ts  # 成本默认值和实时汇率规则
    ├── k2046.ts           # 批量/完整产品、分类、供应商 HTTP 适配边界
    ├── k2046-api-client.ts # 正式客户端桥接（基础产品查询）
    ├── k2046-api-client-smoke.ts # 正式客户端只读冒烟测试
    ├── calculate.ts       # 技能内唯一成本计算引擎
    ├── update-config.ts   # TypeScript config 补全工具
    ├── check.ts           # 检测新容器
    ├── validate.ts        # 数据验证
    ├── process.ts         # 成本计算流程
    ├── classify.ts        # 产品分类（图片识别）
    └── upload.ts          # [已废弃] 上传改用 k2046 CLI: k2046 purchase import-container
```

运行状态保存在 `~/.local/state/container-cost/state.json`，不要提交到
dotfiles。依赖在技能目录执行 `npm install` 或 `npm ci` 后本地生成。
`@kngzhi/k2046-api-client` 来自私有 GitHub Packages；安装前必须让
`NODE_AUTH_TOKEN` 指向具备 `read:packages` 权限的 GitHub token。不要把
token 写进 `.npmrc` 或其它仓库文件。

## 配置

### 路径

| 路径 | 用途 |
|------|------|
| `~/Library/CloudStorage/OneDrive-Personal/source_files/containers` | 容器 Excel |
| `~/Library/CloudStorage/OneDrive-Personal/source_files/containers/generated` | 生成的成本文件 |
| `~/.config/container-cost/.env` | 首选 API 配置 |
| `~/repo/chile-mono/.env` | 仅作为旧环境的只读兼容回退 |

环境变量优先于两个 `.env` 文件。正式 `@kngzhi/k2046-api-client@1.0.0`
已通过 `k2046-api-client.ts` 接入，当前用于只读 `products.findBySku`
基础查询和冒烟测试。计算与校验所需的批量完整产品资料、分类和供应商 API
尚未由正式客户端公开，因此继续由 `k2046.ts` 提供；不要为了接入正式客户端
削减这些既有能力。

### API 配置 (`~/.config/container-cost/.env`)

```env
API_BASE_URL=https://xxx.k2046.cn
X_AUTH_TOKEN=xxx
COOKIE=xxx
```

## Excel 要求

### 容器文件（输入）

- **data sheet**：货号、品名、条形码、单价、装箱数、件数、总数量、总立方、供应商
- **计价单位（data 可选列）**：只接受 `双` 或 `打`。新袜子模板必须填写；
  供应商原始数据按双时写 `双`，引擎在成本聚合前自动换算为 `打`。
- **袜子单位**：成本文件和 K2046 统一使用 `打`（1打=12双）。`计价单位=双`
  时，引擎将单价乘12、装箱数除12、总数量除12，再把单位标记为 `打`；
  装箱数或总数量不能被12整除时立即报错。`计价单位=打` 时不换算，避免重复。
- **旧模板兼容**：计价单位空白时保持原值，不自动猜测单位；新袜子数据不得留空。
- **config sheet 必填真实数据**：海运费、货柜号
- **内陆费**：显式值优先；厂家承担写 `0`。也可用可选字段
  `内陆费承担方=厂家|我方`，缺少显式金额时分别得到 `0` 或默认 `5500 CNY`。
- **卸柜费**：缺省 `125000 CLP`，显式值覆盖。
- **清关杂费**：未到港、尚无实际金额时缺省暂估 `1350000 CLP`；
  到港取得实际金额后必须用实际值覆盖。显式 `0` 或其它金额始终优先。
- **CNY-CLP**：缺省 `135`，显式值覆盖。
- **USD-CLP**：缺省时从 `https://open.er-api.com/v6/latest/USD` 实时获取；
  获取失败立即停止，不使用硬编码回退。
- **USD-CNY**：缺省时按 `USD-CLP / CNY-CLP` 推导，显式值覆盖。
- **IVA**：缺省或为 `0` 时沿用现有估算公式。
- 数据末尾添加 `DATA_END` 行

以上字段、默认值和计算公式以技能内 `src/calculate.ts` 与
`src/business-rules.ts` 为唯一事实来源。正式流程只运行 TypeScript，不调用
Python helper，也不依赖 chile-mono 的成本脚本。

ETA/ETD 不是成本脚本的 config 参数，但必须写入材料索引，并用于后续确认
`k2046 purchase import-container --shipment-date`。预计日期不得冒充实际到柜日期。

### 成本文件（输出 → 人工修改 → 上传）

- 货号、条形码、产品名、供应商、成本价、各级价格、装箱数、件数、仓库
- **分类1、分类2**：必须在上传前填写完整

## 分类流程 (classify)

### 分类方式

1. **AI 辅助分类**：让 Claude 读取产品图片，识别产品类型并填写分类
2. **手动分类**：生成模板 JSON，手动填写后应用

### 图片目录结构

```
~/Library/CloudStorage/OneDrive-Personal/source_files/产品图片/
└── 12.23照片整理MSMU4314897/    # 按容器组织
    ├── 唐潮内裤/
    │   ├── A8874#.jpg
    │   └── ...
    ├── 恒伟/
    │   ├── 40S-1007.jpg
    │   └── ...
    └── ...
```

### 常用分类

| 分类1 | 分类2 | 说明 |
|-------|-------|------|
| calzon | clasico | 女士经典三角 |
| calzon | tanga | 丁字裤 |
| calzon | brasilera | 巴西裤 |
| calzon | mami | 妈咪裤/大码 |
| calzon | boxer | 女士平角 |
| calzon | nina-calzon | 女童三角 |
| boxer-largo | boxer-largo | 男士长款平角 |
| cace | bebe | 婴儿袜 |
| cace | hombre | 男袜 |
| cace | mujer | 女袜 |

### AI 辅助分类

让 Claude 读取产品图片，自动识别分类并填充：

```
用户：帮我分类这个容器的产品
Claude：
1. 读取成本 Excel，找出缺失分类的产品
2. 按供应商分组，查找对应图片
3. 读取图片，识别产品类型（丁字裤、妈咪裤、童装等）
4. 填写分类 + 自动计算大包装数（女士内裤=12，其他=1）
5. 更新 Excel
```

图片目录：`~/Library/CloudStorage/OneDrive-Personal/source_files/产品图片/<容器文件夹>/`

## 大包装数规则

应用分类时会自动填充大包装数：

| 分类 | 大包装数 | 说明 |
|------|----------|------|
| 女士内裤 (clasico, tanga, brasilera, mami, boxer) | 12 | 自动 |
| 其他所有 (童装, 男士, 袜子等) | 1 | 自动 |

```bash
# 单独应用大包装数规则（已有分类的文件）
npm run classify 成本计算_xxx.xlsx -- --apply-packing

# 输出示例：
# 📦 应用大包装数规则...
#    女士内裤 → 12，其他 → 1
# ✅ 更新完成: 36 个
#    大包装数=12 (32 个): A8874#, A7040#, ...
#    大包装数=1 (4 个): DF6599#, DF6597#, ...
```

## 供应商纠正（AI 判断）

验证时如果发现供应商不在 K2046 中，需要 AI 判断并纠正。

### 验证输出示例

```
⚠️  供应商不在 K2046 中（需 AI 判断）：
   - "唐潮" (第 15 行)
   - "恒伟" (第 35 行)

   K2046 现有供应商：
   唐潮服饰, 恒伟服饰, 边洁茹, 亿达服饰, 迦纳, ...
```

### AI 判断规则

当 Claude 看到供应商警告时，自动判断：

1. **简写/别名** → 纠正为 K2046 中的完整名称
   - `唐潮` → `唐潮服饰`
   - `恒伟` → `恒伟服饰`
   - `边姐` → `边洁茹`

2. **错别字** → 纠正
   - `边洁如` → `边洁茹`

3. **完全不匹配** → 提示用户
   - 可能是新供应商，需要先在 K2046 创建
   - 或者询问用户确认

### 纠正流程

```
1. 运行 npm run validate → 输出供应商警告
2. Claude 看到警告后自动判断
3. Claude 直接修改 Excel 中的供应商列
4. 再次验证确认
```

## 常见问题

| 问题 | 解决 |
|------|------|
| 条形码格式错误 | 检查 Excel 格式，确保 13 位数字 |
| 货号不存在 | 新款产品，正常现象 |
| 分类缺失警告 | 使用 classify 命令或 AI 辅助分类 |
| 供应商不匹配 | AI 自动判断纠正（简写→完整名、错别字修正） |
| 找不到产品图片 | 检查图片目录结构，确保按货号命名 |
| 上传被阻止 | 填写完整分类1和分类2 |
| API 失败 | 检查 .env 配置 |
| 官方 ETA 查不到 | 在索引记录柜号、查询时间、承运人和失败原因，提示用户补提单号或确认承运人 |
