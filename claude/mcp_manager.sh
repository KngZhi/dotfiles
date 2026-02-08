#!/bin/bash

# MCP 服务器管理脚本
# 用于清理重复的 MCP 进程和监控 MCP 服务器状态

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 检查 MCP 进程状态
check_mcp_status() {
    log_info "检查当前 MCP 进程状态..."
    
    local mcp_count=$(ps aux | grep -E "(mcp|serena)" | grep -v grep | wc -l | tr -d ' ')
    
    if [ "$mcp_count" -eq 0 ]; then
        log_success "没有发现 MCP 进程"
        return 0
    fi
    
    log_info "发现 $mcp_count 个 MCP 相关进程:"
    ps aux | grep -E "(mcp|serena)" | grep -v grep | awk '{print $2, $11, $12}' | sort
    
    # 检查重复进程
    local duplicates=$(ps aux | grep -E "(mcp|serena)" | grep -v grep | awk '{print $11}' | sort | uniq -c | awk '$1 > 1 {print}')
    
    if [ -n "$duplicates" ]; then
        log_warn "发现重复进程:"
        echo "$duplicates"
        return 1
    else
        log_success "未发现重复进程"
        return 0
    fi
}

# 清理重复的 MCP 进程
cleanup_duplicates() {
    log_info "开始清理重复的 MCP 进程..."
    
    # 停止特定类型的重复服务器
    local services=("whatsapp-mcp" "playwright-mcp-server" "zen-mcp-server" "serena" "excel-mcp-server" "claude-chatgpt-mcp")
    
    for service in "${services[@]}"; do
        local count=$(ps aux | grep "$service" | grep -v grep | wc -l | tr -d ' ')
        if [ "$count" -gt 0 ]; then
            log_info "停止 $count 个 $service 进程"
            pkill -f "$service" 2>/dev/null || true
        fi
    done
    
    # 清理多余的 context7、git、filesystem 服务器（保留一个）
    cleanup_service_type "context7-mcp"
    cleanup_service_type "mcp-server-git" 
    cleanup_service_type "mcp-server-filesystem"
    cleanup_service_type "mcp-server-sequential-thinking"
    
    log_success "重复进程清理完成"
}

# 清理特定服务类型的多余进程
cleanup_service_type() {
    local service_name="$1"
    local pids=$(ps aux | grep "$service_name" | grep -v grep | awk '{print $2}')
    local pid_array=($pids)
    local count=${#pid_array[@]}
    
    if [ "$count" -gt 1 ]; then
        log_info "发现 $count 个 $service_name 进程，保留第一个，清理其余 $((count-1)) 个"
        # 保留第一个，杀死其余的
        for ((i=1; i<count; i++)); do
            kill "${pid_array[$i]}" 2>/dev/null || true
        done
        log_success "已清理 $service_name 的多余进程"
    fi
}

# 完全清理所有 MCP 进程
cleanup_all() {
    log_warn "警告: 这将停止所有 MCP 进程"
    read -p "确认要继续吗? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "停止所有 MCP 进程..."
        pkill -f "mcp" 2>/dev/null || true
        pkill -f "serena" 2>/dev/null || true
        log_success "所有 MCP 进程已停止"
    else
        log_info "操作已取消"
    fi
}

# 监控模式
monitor() {
    log_info "启动 MCP 进程监控模式 (每30秒检查一次，Ctrl+C 退出)..."
    
    while true; do
        echo "$(date): 检查中..."
        if ! check_mcp_status; then
            log_warn "发现问题，自动清理中..."
            cleanup_duplicates
        fi
        echo "---"
        sleep 30
    done
}

# 显示帮助信息
show_help() {
    echo "MCP 服务器管理脚本"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  status      - 检查 MCP 进程状态"
    echo "  cleanup     - 清理重复的 MCP 进程"
    echo "  cleanup-all - 停止所有 MCP 进程"
    echo "  monitor     - 监控模式（自动清理重复进程）"
    echo "  help        - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 status           # 查看当前状态"
    echo "  $0 cleanup          # 清理重复进程"
    echo "  $0 monitor          # 启动监控"
}

# 主函数
main() {
    case "${1:-status}" in
        "status")
            check_mcp_status
            ;;
        "cleanup")
            cleanup_duplicates
            ;;
        "cleanup-all")
            cleanup_all
            ;;
        "monitor")
            monitor
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"