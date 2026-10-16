# 查重、创建和回读

以下是固定 CLI 步骤。替换尖括号参数，JSON 放私有任务文件；不要把客户资料和业务回读提交到技能仓库。

## 1. 完整查重与临时明细检查

```sh
k2046 sale list --customer-id <id> --start-dt '<本日00:00:00>' --end-dt '<本日23:59:59>' --offset 0 -l 100 -o json
k2046 sale list --customer-id <id> --shipping-status NotShipped --offset 0 -l 100 -o json
k2046 sale list --customer-id <id> --shipping-status PartShipped --offset 0 -l 100 -o json
k2046 sale get <候选单id> -o json
k2046 sale temps --offset 0 -l 100 -o json
```

`sale list` 的订单数组是 `data.saleOrders`，没有 `--fetch-all`。日期使用 ERP 业务时区，替换为 `YYYY-MM-DD HH:MM:SS`，不能沿用聊天的中国日期。对本日、未发货、部分发货三个范围分别按 `offset += limit` 读到返回总数已覆盖，或无总数时末页不足 limit，再按订单 ID 合并。这样覆盖本日及未完成范围，无需读取完整成交历史，也不能只看最近十单或只查 `NotShipped`。

核对返回行的实际状态。本机验证曾发现 `PartShipped` 被服务端忽略，返回该客户全部订单；遇到这种情况，对扩大后的返回集完整分页，再本地按实际状态分类，未知状态回读核实。不能把筛选失效解释成没有部分发货单；只有这个降级分支需要覆盖更大的返回范围。

对本日及未完成的候选逐一 `get`，比较客户、货号、数量、包装和时间。相同商品不一定是重复单，已存在同一请求的单则不再创建。分页读取相关临时单并回读可疑明细，保留他人和其他任务的草稿。

创建流程可能复用旧临时明细。存在无法确认归属的旧行、旧客户或旧备注时，先查明并解决当前任务的隔离问题；不要批量删除草稿后重试。尤其不能将不确定的失败当作“未创建”再建一次。

## 2. 纯预览与正式创建

同一基础单位的文本可以先做解析预览：

```sh
k2046 sale create-from-text --preview --packing Unit --text - -o json < items.txt
```

`items.txt` 每行写 `SKU, 数量, 基础单价`，只在已核实单位时使用。预览返回顶层 `items` 和 `errors`，逐行核对并要求 errors 为空。不要写 `2 doz` 或 `2 docena` 让解析器猜单位。混合包装直接核对显式 JSON 的商品、字段、换算及合计。

**只有纯 `--preview` 是这里的无写入预览。`--no-commit` 也会保存真实订单。** `sale create --data` 是正式写入。

正式创建优先用显式 JSON 数组，每行填写精确商品、包装数量、核实的销售仓及约定价格。若安装版本需要用默认价差表达价格，`minus = 基础默认价 - 目标基础单价`，目标价更高时为负值；同时核对 `soPrice`，不盲猜差价。

```sh
k2046 sale create --data - --customer-id <id> --packing <Box或Unit> --currency BaseCurrency -o json < items.json
```

新建时省略 `--order-id`。默认省略 `--memo`，JSON 也不携带来源或技术备注。用户明确要求备注才加 `--memo '<用户要求的内容>'`。混合包装以逐行显式数量为准，基础单价与 packing 的使用保持已核实口径。

## 3. 创建后立即回读

```sh
k2046 sale get <返回的orderId> -o json
k2046 sale list --customer-id <id> --start-dt '<本日00:00:00>' --end-dt '<本日23:59:59>' --offset 0 -l 100 -o json
k2046 sale list --customer-id <id> --shipping-status NotShipped --offset 0 -l 100 -o json
k2046 sale list --customer-id <id> --shipping-status PartShipped --offset 0 -l 100 -o json
```

同样对三个范围完整分页、按 ID 合并列表。逐项核验：

- 单号、ID、客户 ID 正确，正式保存而非 `temp`；列表中能找到同一 ID。
- 仅有本次预期明细，精确货号和商品 ID 一致，没有旧临时行或重复行。
- 各包装字段、换算后的基础数量、销售仓 ID 正确。
- 每行 `soPrice`、`minus`、`totalPrice` 及订单总额与已接受草稿一致。
- 备注为空，或仅含用户明确要求的内容；状态和 `isOverSale` 等标记如实报告。

有些创建会把 `soPrice` 写成零。已批准价格明确时，修正本次新单的对应明细，再 `get` 和上述范围完整分页 `list` 核验，不能把命令成功当成价格正确。以下修价固定使用 `Unit`，`soPrice` 按已核实的 K2046 基础计价单位；整箱报价先折算基础单价：

```sh
k2046 sale edit-order <本次新单id> --plan '{"updatePrices":[{"detailId":<明细id>,"soPrice":"<约定基础单价>","packingType":"Unit","currencyType":"BaseCurrency"}]}' -o json
```

若混入旧明细，先依据创建前后证据识别具体行。修复范围只限本次新单的意外行，并重新核验全部预期行；不得修改原有候选单或清空他人临时单。不确定写入时保留返回内容并查询现有结果，避免重复创建。

## 来源与适用边界

本技能提炼原 `k2046-sale-order-from-whatsapp-chat` 的客户识别、单位价格、查重和回读经验，以及旧临时明细污染经验；执行内容自包含。历史技能保留并存。默认空备注及独立销售入口按当前用户决定执行。付款、发货、调拨和商品状态变更均在本技能范围外。
