#!/usr/bin/env python3
"""Type4Me -> Linear todo-capture watcher.

Personal automation: a Type4Me dictation mode named "Agent" is used to speak
a todo out loud. Type4Me pastes a short fixed placeholder into the frontmost
app and writes the real, untouched instruction to its history.db
(`raw_text` column). This script is launched by a launchd agent watching that
database file; on each trigger it looks for newly-completed "Agent" mode rows
it hasn't seen yet, and for each one runs it through a two-step pipeline --
a single DeepSeek V4.1 Flash (deepseek/deepseek-v4.1-flash, OpenRouter) classify call, then one Linear
GraphQL call -- to capture the spoken todo as a Linear issue (or a comment on
an existing one), then posts a macOS notification with the result (or the
error).

This agent exists ONLY to capture todos: every utterance spoken in Agent
mode is treated as a todo to log in Linear, without the user ever needing
to say "Linear" or "建 issue".

Paths:
  Source:  ~/repo/dotfiles/shared/type4me-agent/watcher.py
  State:   ~/.local/state/type4me-agent/state.json       (last processed rowid)
  Cache:   ~/.local/state/type4me-agent/linear_ids.json   (team id, viewer id)
  Lock:    ~/.local/state/type4me-agent/watcher.lock
  Log:     ~/Library/Logs/type4me-agent.log
  DB:      ~/Library/Application Support/Type4Me/history.db (read-only)

Usage:
  watcher.py                  Normal poll: process new "Agent" mode rows
                               since the last run (called by launchd).
  watcher.py --text "..."     Bypass the DB entirely; dispatch this
                               instruction directly (for manual testing).
  watcher.py --stdin          Bypass the DB; read the instruction as UTF-8
                               from stdin instead of argv, run it through the
                               same empty-check/dispatch/logging path as
                               --text (tagged source=phone in the log), print
                               a single result line to stdout instead of a
                               macOS notification, and skip the notification
                               entirely. This is what an iPhone Shortcut
                               invokes over SSH via an authorized_keys forced
                               command (`command="... watcher.py --stdin"`),
                               piping the dictated text on stdin; because the
                               command is forced, SSH_ORIGINAL_COMMAND (what
                               the phone side tried to run) is never read --
                               argv is fixed by the forced command, not the
                               client.
  watcher.py --dry-run        Combine with any mode above: do not call
                               DeepSeek/Linear, and do not advance the state
                               checkpoint; just log/notify (or print, for
                               --stdin) what would run.

Notes on design decisions (see progress notes for the full source-reading
trail this was based on):
  - `recognition_history.id` is a TEXT (UUID) primary key, not an integer, so
    "new since last run" is tracked via SQLite's implicit `rowid`, which is
    monotonically increasing and is written exactly once per completed
    recognition event (confirmed by reading Type4Me's RecognitionSession.swift
    call sites for HistoryStore.insert()).
  - On any batch, the state checkpoint advances to the highest rowid *seen*
    (matching mode or not, dispatch success or not). This trades "a failed
    dispatch is not silently retried" for "a successful dispatch is never
    replayed" -- replay would mean a duplicate Linear issue, which is worse
    than a failure the user can rerun by hand with --text.
  - Dispatch pipeline (replaces a `claude -p` + Linear MCP subprocess, which
    took 11-20s and ~$0.09/call): one DeepSeek V4.1 Flash chat/completions
    call (OpenRouter, reasoning disabled) classifies action/date/title in
    ~0.8-1.4s (p50/p90, jev-bench/bench.py DeepSeek arm: 96.2% action /
    100% date accuracy on the same benchmark that scored Jev), then plain
    Python decides noop/todo/comment, computes the due date, and validates
    the model's title, then one Linear GraphQL call creates the issue or
    comment. No subprocess, no MCP round trip.
  - launchd starts this file directly (`ProgramArguments = /usr/bin/python3
    watcher.py`, see the .plist) -- there is no login shell in that path, so
    `~/.zshenv`'s `source agent-secrets.env` never runs for a real
    WatchPaths-triggered run, unlike a manual `--text` run from an
    interactive shell. `load_secrets_env()` below covers that gap by reading
    the same rendered env file directly for any of our two keys that are
    still missing from `os.environ`, without touching the plist.
"""
from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import traceback
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import quote

HOME = Path.home()
DB_PATH = HOME / "Library/Application Support/Type4Me/history.db"
STATE_DIR = HOME / ".local/state/type4me-agent"
STATE_FILE = STATE_DIR / "state.json"
LINEAR_CACHE_FILE = STATE_DIR / "linear_ids.json"
LOCK_FILE = STATE_DIR / "watcher.lock"
LOG_FILE = HOME / "Library/Logs/type4me-agent.log"
SECRETS_ENV_FILE = HOME / ".config/agent-secrets/agent-secrets.env"
REQUIRED_ENV_KEYS = ("OPENROUTER_API_KEY", "LINEAR_API_KEY")

# Must match the ProcessingMode.name of the mode added to Type4Me's modes.json.
AGENT_MODE_NAME = "Agent"
# Terminal status RecognitionSession.swift writes for a normal, successful
# recording-mode completion (see progress notes).
SUCCESS_STATUS = "completed"
DB_QUERY_RETRIES = 3
DB_QUERY_RETRY_DELAY_SECONDS = 0.5

DEEPSEEK_URL = "https://openrouter.ai/api/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek/deepseek-v4.1-flash"
DEEPSEEK_TIMEOUT_SECONDS = 5
LINEAR_URL = "https://api.linear.app/graphql"
LINEAR_TIMEOUT_SECONDS = 10
LINEAR_TEAM_NAME = "SAOKO"

ISSUE_ID_RE = re.compile(r"[A-Z]+-\d+")
FILLER_PREFIXES = ("帮我记一下", "记一下", "提醒我", "记得", "帮我")
TRAILING_FILLER_CHARS = "？。"

WEEKDAY_BUCKETS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
VALID_ACTIONS = ("todo", "noop", "comment")
VALID_DATE_BUCKETS = ("none", "today", "tonight", "tomorrow", "day_after", "explicit") + WEEKDAY_BUCKETS

# System prompt copied verbatim from the DeepSeek arm of jev-bench/bench.py
# (DEEPSEEK_SYSTEM = HAIKU_SYSTEM there) -- that arm scored 96.2% action /
# 100% date accuracy on jev-bench/dataset.jsonl. Do not reword without
# re-running that benchmark.
DEEPSEEK_SYSTEM = (
    "你是一个语音待办捕捉助手的分类器。输入是用户对着语音助手说的一句中文（可能夹杂英文）。"
    "只输出一个 JSON 对象，不要有多余文字，格式为："
    '{"action": "todo|noop|comment", "date": "none|today|tonight|tomorrow|day_after|mon|tue|wed|thu|fri|sat|sun|explicit", "title": "<给这条待办起的简短标题，noop时留空字符串>"}\n'
    "action 含义：todo=用户想新建一条待办；noop=没有要新建任何东西（自言自语/犹豫/取消）；"
    "comment=用户明确要求在一个已存在的 issue/工单编号（如 SAO-124）上加备注或评论。\n"
    "date 含义：none=没提到时间；today=今天(未指明早晚)；tonight=今天晚上；tomorrow=明天；day_after=后天；"
    "mon..sun=说的是下周几；explicit=说了具体日期如“10月3号”。"
)


def log(message: str) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().astimezone().isoformat(timespec="seconds")
    with open(LOG_FILE, "a") as f:
        f.write(f"[{ts}] {message}\n")


def load_secrets_env() -> None:
    """Fills in OPENROUTER_API_KEY / LINEAR_API_KEY from the rendered
    agent-secrets.env file for any that are missing from os.environ.

    A manual run from an interactive login shell, or the zsh -lc launchd
    smoke test, already has these via ~/.zshenv. The real launchd trigger
    for this watcher does not go through a shell at all (see module
    docstring), so this is the only path that reaches os.environ there.
    Never overrides a key already present in the environment. Never logs or
    prints a value.
    """
    missing = {k for k in REQUIRED_ENV_KEYS if not os.environ.get(k)}
    if not missing or not SECRETS_ENV_FILE.exists():
        return
    try:
        for line in SECRETS_ENV_FILE.read_text().splitlines():
            line = line.strip()
            if not line or not line.startswith("export "):
                continue
            line = line[len("export "):]
            key, sep, value = line.partition("=")
            if not sep or key not in missing:
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            os.environ[key] = value
    except Exception as e:
        log(f"load_secrets_env: failed to read {SECRETS_ENV_FILE}: {e}")


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            log(f"state file unreadable, treating as absent: {STATE_FILE}")
            return {}
    return {}


def save_state(state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_name(STATE_FILE.name + ".tmp")
    tmp.write_text(json.dumps(state))
    tmp.replace(STATE_FILE)


def acquire_lock():
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    lock_fp = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock_fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_fp.close()
        return None
    return lock_fp


def release_lock(lock_fp) -> None:
    try:
        fcntl.flock(lock_fp, fcntl.LOCK_UN)
    finally:
        lock_fp.close()


def db_connect_ro() -> sqlite3.Connection:
    uri = f"file:{quote(str(DB_PATH))}?mode=ro"
    return sqlite3.connect(uri, uri=True, timeout=5)


def fetch_new_rows(last_rowid: int):
    """Returns (rows, max_rowid_present) with simple retry on transient locks."""
    last_error = None
    for attempt in range(1, DB_QUERY_RETRIES + 1):
        try:
            conn = db_connect_ro()
            try:
                rows = conn.execute(
                    "SELECT rowid, id, raw_text, processing_mode, status, created_at "
                    "FROM recognition_history WHERE rowid > ? ORDER BY rowid ASC",
                    (last_rowid,),
                ).fetchall()
                return rows
            finally:
                conn.close()
        except sqlite3.OperationalError as e:
            last_error = e
            log(f"db read attempt {attempt}/{DB_QUERY_RETRIES} failed: {e}")
            time.sleep(DB_QUERY_RETRY_DELAY_SECONDS)
    raise last_error


def get_max_rowid() -> int:
    conn = db_connect_ro()
    try:
        row = conn.execute("SELECT COALESCE(MAX(rowid), 0) FROM recognition_history").fetchone()
        return row[0]
    finally:
        conn.close()


def _applescript_quote(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def not_actionable_reason(raw_text: str, status: str | None = None) -> str | None:
    """Returns a 未执行 reason if this row/instruction should not be dispatched."""
    if status is not None and status != SUCCESS_STATUS:
        return f"录音状态 {status}，未执行"
    if not (raw_text or "").strip():
        return "没听到指令，未执行"
    return None


def notify(title: str, message: str) -> None:
    message = (message or "").strip() or "(no output)"
    if len(message) > 500:
        message = message[:497] + "..."
    script = f'display notification "{_applescript_quote(message)}" with title "{_applescript_quote(title)}"'
    try:
        subprocess.run(["/usr/bin/osascript", "-e", script], check=False, timeout=10)
    except Exception as e:
        log(f"notify failed: {e}")


# --- DeepSeek classify ---------------------------------------------------

def _http_post_json(url: str, headers: dict, body: dict, timeout: float) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def call_deepseek(text: str) -> dict | None:
    """One non-streaming POST to OpenRouter chat/completions for DeepSeek
    V4.1 Flash (reasoning disabled). Returns
    {"action":..., "date":..., "title":...} or None on any failure (missing
    key, timeout, HTTP error, invalid JSON, unknown action/date label) --
    callers must treat None as "DeepSeek unavailable" and fall back to
    creating a todo with the raw-transcript title and no due date."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        log("deepseek: OPENROUTER_API_KEY not set")
        return None
    body = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": DEEPSEEK_SYSTEM},
            {"role": "user", "content": text},
        ],
        "temperature": 0,
        "max_tokens": 200,
        "response_format": {"type": "json_object"},
        "reasoning": {"enabled": False},
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        data = _http_post_json(DEEPSEEK_URL, headers, body, DEEPSEEK_TIMEOUT_SECONDS)
        content = data["choices"][0]["message"]["content"]
    except Exception as e:
        log(f"deepseek call failed: {e}")
        return None
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        start, end = content.find("{"), content.rfind("}")
        if start == -1 or end == -1:
            log("deepseek: response not valid JSON")
            return None
        try:
            parsed = json.loads(content[start:end + 1])
        except json.JSONDecodeError:
            log("deepseek: response not valid JSON")
            return None
    action = parsed.get("action")
    date_bucket = parsed.get("date")
    if action not in VALID_ACTIONS or date_bucket not in VALID_DATE_BUCKETS:
        log(f"deepseek: unknown label action={action!r} date={date_bucket!r}")
        return None
    return {"action": action, "date": date_bucket, "title": parsed.get("title")}


def decide_action(deepseek_result: dict | None, text: str) -> tuple[str, str | None]:
    """Returns (action, issue_identifier_or_None). action in {todo,noop,comment}."""
    if deepseek_result is None:
        return "todo", None
    action = deepseek_result.get("action")
    if action == "noop":
        return "noop", None
    if action == "comment":
        m = ISSUE_ID_RE.search(text)
        if m:
            return "comment", m.group(0)
        return "todo", None
    return "todo", None


def resolve_title(deepseek_result: dict | None, raw_text: str) -> str:
    """The model's title if valid (non-empty, <=80 chars), else the
    raw-transcript title builder."""
    title = (deepseek_result or {}).get("title")
    if isinstance(title, str):
        title = title.strip()
        if title and len(title) <= 80:
            return title
    return build_title(raw_text)


def extract_comment_body(text: str) -> str:
    """Text after the first ： or : (whichever occurs first); full text if neither is present."""
    positions = [p for p in (text.find("："), text.find(":")) if p != -1]
    if not positions:
        return text.strip()
    return text[min(positions) + 1:].strip()


# --- Date resolution -----------------------------------------------------

def _parse_explicit_date(text: str, today: date) -> date | None:
    m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", text)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    m = re.search(r"(\d{1,2})\s*月\s*(\d{1,2})\s*[号日]", text)
    if not m:
        m = re.search(r"(?<!\d)(\d{1,2})/(\d{1,2})(?!\d)", text)
    if m:
        mo, d = int(m.group(1)), int(m.group(2))
        try:
            dt = date(today.year, mo, d)
        except ValueError:
            return None
        if dt < today:
            try:
                dt = date(today.year + 1, mo, d)
            except ValueError:
                return None
        return dt
    return None


def compute_due_date(date_bucket: str | None, raw_text: str) -> str | None:
    """ISO due date from a DeepSeek date bucket + local today, or None for no due date."""
    today = datetime.now().astimezone().date()
    if not date_bucket or date_bucket == "none":
        return None
    if date_bucket in ("today", "tonight"):
        return today.isoformat()
    if date_bucket == "tomorrow":
        return (today + timedelta(days=1)).isoformat()
    if date_bucket == "day_after":
        return (today + timedelta(days=2)).isoformat()
    if date_bucket in WEEKDAY_BUCKETS:
        target = WEEKDAY_BUCKETS.index(date_bucket)  # mon=0 .. sun=6, matches date.weekday()
        delta = (target - today.weekday()) % 7  # next occurrence on or after today
        return (today + timedelta(days=delta)).isoformat()
    if date_bucket == "explicit":
        dt = _parse_explicit_date(raw_text, today)
        return dt.isoformat() if dt else None
    return None


# --- Title/description ----------------------------------------------------

def build_title(raw_text: str) -> str:
    t = raw_text.strip()
    for p in sorted(FILLER_PREFIXES, key=len, reverse=True):
        if t.startswith(p):
            t = t[len(p):].strip()
            break
    t = t.rstrip(TRAILING_FILLER_CHARS).strip()
    t = t[:80]
    return t or raw_text.strip()[:80]


def build_description(raw_text: str) -> str:
    return f"语音原文：\n{raw_text}"


# --- Linear GraphQL --------------------------------------------------------

def linear_graphql(query: str, variables: dict, timeout: float = LINEAR_TIMEOUT_SECONDS) -> dict:
    api_key = os.environ.get("LINEAR_API_KEY")
    if not api_key:
        raise RuntimeError("LINEAR_API_KEY not set")
    headers = {"Authorization": api_key, "Content-Type": "application/json"}
    data = _http_post_json(LINEAR_URL, headers, {"query": query, "variables": variables}, timeout)
    if data.get("errors"):
        raise RuntimeError(f"Linear GraphQL error: {data['errors']}")
    return data.get("data") or {}


def load_linear_cache() -> dict:
    if LINEAR_CACHE_FILE.exists():
        try:
            return json.loads(LINEAR_CACHE_FILE.read_text())
        except Exception:
            return {}
    return {}


def save_linear_cache(cache: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = LINEAR_CACHE_FILE.with_name(LINEAR_CACHE_FILE.name + ".tmp")
    tmp.write_text(json.dumps(cache))
    tmp.replace(LINEAR_CACHE_FILE)


def resolve_linear_ids() -> dict:
    """Team SAOKO id + viewer id, resolved once and cached in the state dir."""
    cache = load_linear_cache()
    if cache.get("team_id") and cache.get("viewer_id"):
        return cache
    query = (
        "query Resolve($teamName: String!) {"
        " viewer { id }"
        " teams(filter: { name: { eq: $teamName } }) { nodes { id name key } }"
        " }"
    )
    data = linear_graphql(query, {"teamName": LINEAR_TEAM_NAME})
    viewer_id = (data.get("viewer") or {}).get("id")
    teams = (data.get("teams") or {}).get("nodes") or []
    if not teams or not viewer_id:
        raise RuntimeError(f"could not resolve team {LINEAR_TEAM_NAME!r} / viewer via Linear API")
    cache = {
        "team_id": teams[0]["id"],
        "viewer_id": viewer_id,
        "resolved_at": datetime.now().astimezone().isoformat(),
    }
    save_linear_cache(cache)
    return cache


def resolve_issue_uuid(identifier: str) -> str:
    """identifier is pre-validated against ISSUE_ID_RE ([A-Z]+-\\d+), safe to inline."""
    query = 'query { issue(id: "%s") { id } }' % identifier
    data = linear_graphql(query, {})
    issue = data.get("issue")
    if not issue:
        raise RuntimeError(f"issue not found: {identifier}")
    return issue["id"]


def linear_create_issue(team_id: str, assignee_id: str, title: str, description: str, due_date: str | None) -> tuple[str, str]:
    input_obj = {"teamId": team_id, "title": title, "description": description, "assigneeId": assignee_id}
    if due_date:
        input_obj["dueDate"] = due_date
    query = (
        "mutation IssueCreate($input: IssueCreateInput!) {"
        " issueCreate(input: $input) { success issue { identifier url } }"
        " }"
    )
    data = linear_graphql(query, {"input": input_obj})
    result = data.get("issueCreate") or {}
    if not result.get("success"):
        raise RuntimeError(f"issueCreate did not report success: {result}")
    issue = result.get("issue") or {}
    return issue.get("identifier"), issue.get("url")


def linear_create_comment(issue_uuid: str, body: str) -> tuple[str, str, str]:
    query = (
        "mutation CommentCreate($input: CommentCreateInput!) {"
        " commentCreate(input: $input) { success comment { issue { identifier title url } } }"
        " }"
    )
    data = linear_graphql(query, {"input": {"issueId": issue_uuid, "body": body}})
    result = data.get("commentCreate") or {}
    if not result.get("success"):
        raise RuntimeError(f"commentCreate did not report success: {result}")
    issue = (result.get("comment") or {}).get("issue") or {}
    return issue.get("identifier"), issue.get("title") or "", issue.get("url")


# --- Dispatch ---------------------------------------------------------

def dispatch(instruction: str, dry_run: bool = False):
    """Runs the DeepSeek-classify -> Linear pipeline for one instruction.
    Returns (ok, output_or_error)."""
    if dry_run:
        preview = instruction if len(instruction) <= 200 else instruction[:197] + "..."
        return True, f"[dry-run] would dispatch: {preview}"

    t_total0 = time.perf_counter()
    timings = {}

    t0 = time.perf_counter()
    deepseek_result = call_deepseek(instruction)
    timings["deepseek_ms"] = round((time.perf_counter() - t0) * 1000)
    if deepseek_result is None:
        log("DeepSeek 不可用，按 todo 处理（date=none）")

    action, issue_identifier = decide_action(deepseek_result, instruction)

    try:
        if action == "noop":
            timings["total_ms"] = round((time.perf_counter() - t_total0) * 1000)
            log(f"decision=noop deepseek_ms={timings['deepseek_ms']} total_ms={timings['total_ms']}")
            return False, "NOOP: DeepSeek 判断为无需操作"

        t1 = time.perf_counter()
        ids = resolve_linear_ids()

        if action == "comment":
            issue_uuid = resolve_issue_uuid(issue_identifier)
            body = extract_comment_body(instruction)
            identifier, comment_title, url = linear_create_comment(issue_uuid, body)
            timings["linear_ms"] = round((time.perf_counter() - t1) * 1000)
            timings["total_ms"] = round((time.perf_counter() - t_total0) * 1000)
            log(
                f"decision=comment issue={issue_identifier} "
                f"deepseek_ms={timings['deepseek_ms']} linear_ms={timings['linear_ms']} total_ms={timings['total_ms']}"
            )
            return True, f"{identifier} {comment_title} {url}"

        # action == "todo"
        due_date = compute_due_date(deepseek_result.get("date") if deepseek_result else None, instruction)
        title = resolve_title(deepseek_result, instruction)
        description = build_description(instruction)
        identifier, url = linear_create_issue(ids["team_id"], ids["viewer_id"], title, description, due_date)
        timings["linear_ms"] = round((time.perf_counter() - t1) * 1000)
        timings["total_ms"] = round((time.perf_counter() - t_total0) * 1000)
        log(
            f"decision=todo due_date={due_date} issue={identifier} "
            f"deepseek_ms={timings['deepseek_ms']} linear_ms={timings['linear_ms']} total_ms={timings['total_ms']}"
        )
        return True, f"{identifier} {title} {url}"
    except Exception as e:
        timings["total_ms"] = round((time.perf_counter() - t_total0) * 1000)
        log(f"dispatch failed: {e} deepseek_ms={timings.get('deepseek_ms')} total_ms={timings['total_ms']}")
        return False, f"dispatch failed: {e}"


def stdin_result_line(ok: bool, output: str, dry_run: bool) -> tuple[str, int]:
    """Formats the single result line printed to stdout in --stdin mode, and
    the process exit code to use for it: 0 on success or NOOP (nothing to do
    is not a failure), 1 on an actual dispatch failure."""
    if dry_run:
        return output, 0
    if ok:
        return f"✅ {output}", 0
    if output.startswith("NOOP:"):
        return f"未执行：{output[len('NOOP:'):].strip()}", 0
    return f"❌ {output}", 1


def handle_result(label: str, ok: bool, output: str, dry_run: bool, instruction: str = "") -> None:
    if dry_run:
        notify("Type4Me Agent (dry-run)", output)
        branch = "dry_run"
    elif ok:
        notify("Type4Me Agent — ✅ 已完成", output)
        branch = "ok"
    elif output.startswith("NOOP:"):
        reason = output[len("NOOP:"):].strip()
        preview = instruction if len(instruction) <= 60 else instruction[:57] + "..."
        notify("Type4Me Agent — 未执行", f"{reason}：「{preview}」")
        branch = "noop"
    else:
        notify("Type4Me Agent — ❌ 失败", output)
        branch = "error"
    log(f"{label} branch={branch} ok={ok} output={output!r}")


def poll(dry_run: bool) -> int:
    if not DB_PATH.exists():
        log(f"history.db not found at {DB_PATH}; nothing to do")
        return 0

    state = load_state()
    last_rowid = state.get("last_rowid")

    if last_rowid is None:
        max_rowid = get_max_rowid()
        if dry_run:
            log(f"[dry-run] first run would initialize state to rowid={max_rowid} (no dispatch)")
            return 0
        save_state({"last_rowid": max_rowid, "initialized_at": datetime.now().astimezone().isoformat()})
        log(f"first run: initialized state to rowid={max_rowid} (no replay of existing history)")
        return 0

    rows = fetch_new_rows(last_rowid)
    if not rows:
        log(f"poll: no new rows since rowid={last_rowid}")
        return 0

    highest_seen = last_rowid
    matched = 0
    for rowid, rec_id, raw_text, processing_mode, status, created_at in rows:
        highest_seen = max(highest_seen, rowid)
        if processing_mode != AGENT_MODE_NAME:
            continue
        reason = not_actionable_reason(raw_text, status)
        if reason:
            log(f"skip rowid={rowid} id={rec_id}: {reason}")
            notify("Type4Me Agent — 未执行", reason)
            continue
        instruction = raw_text.strip()

        matched += 1
        log(f"dispatch rowid={rowid} id={rec_id} created_at={created_at} instruction={instruction!r}")
        t0 = time.time()
        ok, output = dispatch(instruction, dry_run=dry_run)
        dt = time.time() - t0
        handle_result(f"rowid={rowid} id={rec_id} duration={dt:.1f}s", ok, output, dry_run, instruction)

    log(f"poll: scanned {len(rows)} row(s) up to rowid={highest_seen}, dispatched {matched}")

    if not dry_run:
        save_state({"last_rowid": highest_seen, "updated_at": datetime.now().astimezone().isoformat()})
    else:
        log("[dry-run] not advancing state checkpoint")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Type4Me -> Linear todo-capture watcher")
    parser.add_argument("--text", help="Bypass the DB; dispatch this instruction directly (for testing)")
    parser.add_argument(
        "--stdin",
        action="store_true",
        help=(
            "Bypass the DB; read the instruction as UTF-8 from stdin (phone/SSH mode). "
            "Same dispatch path as --text, but prints one result line to stdout instead of "
            "a macOS notification, and skips the notification entirely."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not call DeepSeek/Linear and do not advance state; just log/notify (or print) what would run",
    )
    # Note: argv is fixed by the sshd authorized_keys forced command
    # (`command="... watcher.py --stdin"`), so SSH_ORIGINAL_COMMAND -- what
    # the phone-side client tried to run -- is never consulted here.
    args = parser.parse_args()

    load_secrets_env()
    missing = [k for k in REQUIRED_ENV_KEYS if not os.environ.get(k)]
    if missing and not args.dry_run:
        msg = f"missing env: {', '.join(missing)}"
        log(f"FATAL: {msg}")
        if args.stdin:
            print(f"❌ 缺少环境变量：{', '.join(missing)}")
        else:
            notify("Type4Me Agent — ❌ 失败", f"缺少环境变量：{', '.join(missing)}")
        return 1

    lock_fp = acquire_lock()
    if lock_fp is None:
        log("another run is already in progress; skipping")
        if args.stdin:
            print("未执行：另一个任务正在运行，请稍后重试")
        return 0

    try:
        if args.stdin:
            try:
                sys.stdout.reconfigure(encoding="utf-8")
            except Exception as e:
                log(f"--stdin: could not reconfigure stdout encoding: {e}")
            raw = sys.stdin.buffer.read()
            try:
                instruction = raw.decode("utf-8").strip()
            except UnicodeDecodeError as e:
                log(f"--stdin: stdin is not valid UTF-8: {e}")
                print("❌ 输入不是合法 UTF-8")
                return 1
            reason = not_actionable_reason(instruction)
            if reason:
                log(f"--stdin dispatch skipped source=phone: {reason}")
                print(f"未执行：{reason}")
                return 0
            log(f"--stdin dispatch: instruction={instruction!r} dry_run={args.dry_run} source=phone")
            t0 = time.time()
            ok, output = dispatch(instruction, dry_run=args.dry_run)
            dt = time.time() - t0
            log(f"--stdin duration={dt:.1f}s source=phone ok={ok} output={output!r}")
            line, exit_code = stdin_result_line(ok, output, args.dry_run)
            print(line)
            return exit_code
        if args.text is not None:
            instruction = args.text
            reason = not_actionable_reason(instruction)
            if reason:
                log(f"--text dispatch skipped: {reason}")
                notify("Type4Me Agent — 未执行", reason)
                return 0
            log(f"--text dispatch: instruction={instruction!r} dry_run={args.dry_run}")
            t0 = time.time()
            ok, output = dispatch(instruction, dry_run=args.dry_run)
            dt = time.time() - t0
            handle_result(f"--text duration={dt:.1f}s", ok, output, args.dry_run, instruction)
            return 0 if (ok or args.dry_run) else 1
        return poll(dry_run=args.dry_run)
    except Exception:
        tb = traceback.format_exc()
        log(f"FATAL: {tb}")
        if args.stdin:
            print("❌ watcher crashed, see log")
        else:
            notify("Type4Me Agent — error", "watcher crashed, see ~/Library/Logs/type4me-agent.log")
        return 1
    finally:
        release_lock(lock_fp)


if __name__ == "__main__":
    sys.exit(main())
