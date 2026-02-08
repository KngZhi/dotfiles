# MCP 服务器管理指南

## 问题总结

之前系统中出现了大量重复的 MCP (Model Context Protocol) 服务器进程，导致：

1. **进程数量异常**：105+ 个 WhatsApp MCP 服务器进程
2. **资源冲突**：多个浏览器自动化工具争夺 Chrome 控制权
3. **性能影响**：大量重复进程消耗系统资源

## 解决方案

### 1. 已完成的清理工作

- ✅ 停止了所有重复的 MCP 服务器进程
- ✅ 清理了 WhatsApp MCP、Playwright、Serena 等冗余服务
- ✅ 建立了进程管理和监控机制

### 2. 创建的管理工具

#### MCP 管理脚本 (`~/.claude/mcp_manager.sh`)

```bash
# 查看当前状态
~/.claude/mcp_manager.sh status

# 清理重复进程
~/.claude/mcp_manager.sh cleanup

# 停止所有 MCP 进程
~/.claude/mcp_manager.sh cleanup-all

# 监控模式（自动清理）
~/.claude/mcp_manager.sh monitor
```

#### 定时清理脚本 (`~/.claude/cleanup_mcp_cron.sh`)

- 当 MCP 进程数量超过 10 个时自动清理
- 日志记录在 `~/.claude/mcp_cleanup.log`

## 使用建议

### 日常监控

1. **定期检查**：
   ```bash
   ~/.claude/mcp_manager.sh status
   ```

2. **手动清理**（发现问题时）：
   ```bash
   ~/.claude/mcp_manager.sh cleanup
   ```

### 预防措施

1. **避免重复启动**：
   - 不要同时运行多个 Claude 应用实例
   - 关闭应用时确保进程完全退出

2. **定期维护**：
   - 每周运行一次状态检查
   - 发现异常立即清理

3. **监控设置**：
   ```bash
   # 可选：设置 crontab 定时任务
   # 每小时检查一次
   0 * * * * /Users/amd/.claude/cleanup_mcp_cron.sh
   ```

## 故障排除

### 常见问题

1. **MCP 进程过多**：
   - 运行清理脚本
   - 检查是否有应用未正确关闭

2. **Chrome 窗口冲突**：
   - 停止浏览器自动化 MCP 服务器
   - 确保只运行必要的服务

3. **系统性能问题**：
   - 检查 MCP 进程数量
   - 必要时执行完全清理

### 紧急处理

如果系统响应缓慢：

```bash
# 立即停止所有 MCP 进程
~/.claude/mcp_manager.sh cleanup-all

# 检查结果
~/.claude/mcp_manager.sh status
```

## 当前状态

- ✅ 所有重复 MCP 进程已清理
- ✅ 系统资源使用正常
- ✅ 管理脚本已就位
- ✅ 监控机制已建立

## 联系支持

如果问题持续出现，请：

1. 检查日志：`~/.claude/mcp_cleanup.log`
2. 运行状态检查：`~/.claude/mcp_manager.sh status`
3. 收集问题信息并寻求技术支持