# K2046 导入

导入会创建采购单，正常导入可能同时提交。先确认导入本身在用户请求范围内，
并核对准确的文件、柜号、仓库、供应商、分类和实际到柜日期。

检查当前 CLI 帮助后选择操作：

```bash
k2046 purchase import-container <成本Excel> --parse-only
k2046 purchase import-container <成本Excel> --container-no <柜号> --shipment-date <实际到柜日期>
```

`--parse-only` 和当前 CLI 的 `--dry-run` 都只上传临时文件并解析行，不创建采购单或调用 import-parse/import-commit；不会模拟按供应商拆单。以当前 CLI 帮助及实现为准。
标准成本表若为18列（含「散件数」），不能直接套用 CLI 默认17列映射，否则仓库和分类会错位；先核对每一列并显式指定映射，再检查解析结果。
ETA 不得作为未经确认的实际到柜日期。

保留导入返回的采购单 ID，核实创建与提交状态。发生部分失败时先检查已有
采购单，恢复未完成步骤，避免重复导入。只有实际完成后才更新 containers.org
的 PO_IDS 和入库 checklist。

如请求还包括图片整理，按柜号整理产品图片并单独核实对应 checklist。
报告已解析、已创建、已提交和仍未完成的阶段。
