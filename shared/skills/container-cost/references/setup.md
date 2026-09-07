# 运行环境

从本技能目录运行 `npm ci` 安装锁定依赖。私有
`@kngzhi/k2046-api-client` 需要具备 read:packages 权限的
NODE_AUTH_TOKEN，使用共享凭据约定提供，不写入 .npmrc 或仓库。

API 配置优先级：环境变量，其次 `~/.config/container-cost/.env`，
最后是旧环境的只读兼容回退 `~/repo/chile-mono/.env`。
配置字段是 API_BASE_URL、X_AUTH_TOKEN、COOKIE。只检查必要字段是否存在，
不要打印凭据内容。

运行状态位于 `~/.local/state/container-cost/state.json`。
正式客户端目前用于基础 products.findBySku 查询；批量完整产品资料、
分类和供应商仍由 `src/k2046.ts` 提供。

有连接问题且只读查询在范围内时，可运行：
```bash
npm run api-client:smoke -- S212
```

`src/upload.ts` 已废弃，导入走 K2046 CLI，见 [import.md](import.md)。
修改引擎时运行 package.json 中的测试和 typecheck；正常材料整理不需要
每次重跑整套软件测试。
