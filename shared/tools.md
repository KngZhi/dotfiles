# Available local tools

- `trello` — [mheap/trello-cli](https://github.com/mheap/trello-cli)，已安装并配置认证，可操作 Trello 看板、列表和卡片。
- `reminders` — [keith/reminders-cli](https://github.com/keith/reminders-cli)，已安装，可读写 macOS 提醒事项；使用 `reminders-cli` skill。
- `in2csv` — 已安装，可直接读取本地 `.xls` / `.xlsx` 的工作表数据并输出 CSV。
- Python `openpyxl` — 已安装，可读取 `.xlsx` 的单元格、公式和合并区域；不负责重算公式。

读取已保存的本地 Excel 数据时，优先直接读文件；已连接的 Excel 会话使用对应 skill 的文档工具。Computer Use 用于必要的界面操作，不用于逐格抄取已有文件的数据。
