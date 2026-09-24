# Google 表格工作稿

`scripts/sheets.py` 以 Google 表格保存每柜整理稿。命令从本技能目录执行，
`uv run` 按脚本头部声明自动准备 gspread 依赖，不需要全局安装。
所有表格由脚本创建，放在 Drive 文件夹「货柜整理」（环境变量
`CONTAINER_INTAKE_DRIVE_FOLDER` 可改名）；授权范围只覆盖脚本创建的文件，
脚本看不到 Drive 里其他文件，也打不开用户手工新建的表格。

## 一次性授权（用户完成）

1. 打开 <https://console.cloud.google.com/>，新建项目（名字随意，如 `container-intake`）。
2. 「API 和服务 → 库」启用 **Google Sheets API** 和 **Google Drive API**。
3. 「OAuth 同意屏幕」选 External，应用名随意，测试用户加自己的 Gmail；
   填完后把发布状态改为 **In production**，否则测试模式的授权每 7 天过期。
   未验证应用在授权时会显示警告页，点「高级 → 继续」即可。
4. 「凭据 → 创建凭据 → OAuth 客户端 ID → 桌面应用」，下载 JSON，
   保存为 `~/.config/gspread/credentials.json`。
5. 运行 `uv run scripts/sheets.py auth`，浏览器完成授权；令牌存于
   `~/.config/gspread/authorized_user.json`，之后自动刷新。

授权失败或提示范围不足时删除 `authorized_user.json` 重新执行 `auth`。
凭据文件不进仓库、不打印内容。

## 命令

`<ref>` 可以是柜号（按表格名查找）、表格链接或表格 ID。

| 命令 | 作用 |
|---|---|
| `auth` | 完成或刷新授权，确认工作文件夹 |
| `create <柜号> [--from <xlsx>]` | 新建标准表格并验证；`--from` 导入已有 13 列本地表 |
| `upload <xlsx> [--name <标题>]` | 把成本结果等非契约表上传为同一文件夹里的查看用表格，不做验证；默认标题为文件名去掉扩展名，同名已存在则覆盖内容而非重复新建 |
| `url <ref>` | 打印链接 |
| `dump <ref> [--out f.json]` | 读出明细、config、config 说明和所有单元格批注 |
| `write <ref> rows.json` | 用 JSON 明细整体重写 data 表，然后自动验证 |
| `set <ref> 'data!G5=12.5' 'config.海运费=2000'` | 写单个单元格或 config 参数，然后自动验证 |
| `validate <ref> [--report f.json]` | 表内验证并把问题标到单元格；返回码同 validate_workbook |
| `mark <ref> 'data!A53' '说明' [--blocking] [--replace]` | AI 核对后的红标和批注 |
| `unmark <ref> ['data!A53' ...]` | 清除 AI 标注；不给单元格则清全部 |
| `export <ref> <目标.xlsx>` | 导出 xlsx（含公式缓存和格式），并对导出文件做表内验证 |
| `template <目标.xlsx>` | 用同一布局生成 `assets/模板.xlsx` |

`write` 的 JSON 是 `{"rows": [...]}` 或直接数组；每行的键为 13 列表头
（`货号`、`条形码`、`品名`、`图片`、`供应商`、`计价单位`、`采购单价（元）`、
`标准装箱数`、`整件数`、`散件数`、`总体积（m³）`），`总数量` 和 `货款合计（元）`
由公式生成，传入也会被覆盖；`散件数` 缺省为 0。`write` 会清掉 data 表旧值再写，
行位置变化后原有批注可能错位，写完看验证结果并重新 `mark`。
`set` 的值按整数、小数、文本依次解析；以 `=` 开头的值作为公式写入。

## 单元格约定

- `货号`、`条形码` 两列固定为纯文本格式，条码不会变成数字。
- `发柜日期`、`ETA` 单元格格式为 `yyyy-mm-dd`，脚本读回 ISO 日期字符串。
- 合计与分单位合计以 `DATA_END` 定位明细范围；IVA按config的计税货值（默认USD18000）另加海运，
  在 `DATA_END` 前插入行不需要改公式。
- 批注分三层：用户自己写的文字、`[container-intake AI核对]`、`[container-intake 自动核对]`。
  自动验证只改自己那一层；`mark`/`unmark` 只改 AI 层；用户文字始终保留。
  三层都空时单元格恢复黑白。
- 图片不存入表格；`图片` 列填材料目录里的文件名，图片留在材料目录。

IVA迁移仅在显式生成/重建config时执行：已知旧30%公式或明确估算缓存改为新参数公式，实际正金额保留；说明冲突先确认。既有在线表不会后台自动迁移，不批量改写业务表。
