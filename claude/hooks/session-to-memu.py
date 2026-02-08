#!/usr/bin/env python3
"""
Claude Code SessionEnd Hook - 自动将有价值的 session 导入 MemU

筛选条件:
- 消息数 >= 10
- 包含实质内容（非纯工具调用）

使用方式:
stdin 接收 JSON: {"session_id": "...", "transcript_path": "...", ...}
"""

import json
import os
import sys
import subprocess
from pathlib import Path

# 配置
MIN_MESSAGES = 10  # 最少消息数
MEMU_DIR = Path.home() / "repo" / "memU"
IMPORT_SCRIPT = MEMU_DIR / "scripts" / "import_single_session.py"
LOG_FILE = Path.home() / ".claude" / "hooks" / "memu.log"


def log(msg: str):
    """写日志"""
    with open(LOG_FILE, "a") as f:
        f.write(f"{msg}\n")


def count_messages(transcript_path: str) -> int:
    """统计 session 中的消息数量"""
    count = 0
    try:
        with open(transcript_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get("type") in ("user", "assistant"):
                        count += 1
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        log(f"Error counting messages: {e}")
    return count


def should_process(transcript_path: str) -> tuple[bool, str]:
    """判断是否值得处理这个 session"""
    if not os.path.exists(transcript_path):
        return False, "transcript not found"

    msg_count = count_messages(transcript_path)
    if msg_count < MIN_MESSAGES:
        return False, f"too few messages ({msg_count} < {MIN_MESSAGES})"

    return True, f"qualifies ({msg_count} messages)"


def main():
    # 读取 stdin 输入
    try:
        input_data = json.load(sys.stdin)
    except Exception as e:
        log(f"Failed to parse input: {e}")
        sys.exit(0)

    session_id = input_data.get("session_id", "unknown")
    transcript_path = input_data.get("transcript_path", "")
    reason = input_data.get("reason", "unknown")

    log(f"--- SessionEnd: {session_id} (reason: {reason}) ---")

    # 判断是否处理
    should, msg = should_process(transcript_path)
    log(f"Decision: {msg}")

    if not should:
        sys.exit(0)

    # 异步触发导入（不阻塞 Claude Code 退出）
    log(f"Triggering MemU import: {transcript_path}")

    try:
        # 使用 nohup 在后台运行，不阻塞
        cmd = f"""
        cd {MEMU_DIR} && \
        source .venv/bin/activate && \
        set -a && source .env && set +a && \
        python3 scripts/import_single_session.py "{transcript_path}" >> ~/.claude/hooks/memu.log 2>&1 &
        """
        subprocess.Popen(["bash", "-c", cmd],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True)
        log("Import triggered in background")
    except Exception as e:
        log(f"Failed to trigger import: {e}")

    sys.exit(0)


if __name__ == "__main__":
    main()
