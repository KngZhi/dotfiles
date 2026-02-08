#!/bin/bash

# MCP 进程定时清理脚本
# 每小时运行一次，清理重复的 MCP 进程

# 设置日志文件
LOG_FILE="/Users/amd/.claude/mcp_cleanup.log"

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

# 记录开始时间
echo "$(date): 开始 MCP 进程清理" >> "$LOG_FILE"

# 检查是否有重复进程
mcp_count=$(ps aux | grep -E "(mcp|serena)" | grep -v grep | wc -l | tr -d ' ')

if [ "$mcp_count" -gt 10 ]; then
    echo "$(date): 发现 $mcp_count 个 MCP 进程，超过阈值，开始清理" >> "$LOG_FILE"
    
    # 运行清理脚本
    /Users/amd/.claude/mcp_manager.sh cleanup >> "$LOG_FILE" 2>&1
    
    # 记录清理后的状态
    new_count=$(ps aux | grep -E "(mcp|serena)" | grep -v grep | wc -l | tr -d ' ')
    echo "$(date): 清理完成，剩余 $new_count 个进程" >> "$LOG_FILE"
else
    echo "$(date): MCP 进程数量正常 ($mcp_count 个)，无需清理" >> "$LOG_FILE"
fi

# 清理旧日志（保留最近7天）
find /Users/amd/.claude -name "mcp_cleanup.log" -mtime +7 -delete 2>/dev/null || true

echo "$(date): MCP 进程检查完成" >> "$LOG_FILE"