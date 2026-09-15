#!/usr/bin/env python3
"""Session-scoped workbook hooks shared by Claude Code and Codex."""
import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import sys
import time


def state_path():
    return Path(os.environ.get('CONTAINER_INTAKE_STATE', Path.home() / '.local/state/container-intake/hooks.json'))


@contextmanager
def registry():
    path = state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+', encoding='utf-8') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        handle.seek(0)
        raw = handle.read()
        data = json.loads(raw) if raw else {}
        now = time.time()
        data = {k: v for k, v in data.items() if now - v['updated'] < 7 * 86400}
        yield data
        handle.seek(0)
        handle.truncate()
        json.dump(data, handle, ensure_ascii=False)
        handle.flush()


def register(session, paths):
    if not session or '${' in session:
        raise ValueError('需要真实 session ID；Codex 使用 CODEX_THREAD_ID，Claude 使用技能展开的 CLAUDE_SESSION_ID')
    with registry() as data:
        if session not in data and len(data) >= 128:
            raise ValueError('登记会话已达128个，请先 unregister 已完成会话')
        entry = data.setdefault(session, {'updated': time.time(), 'files': {}})
        for raw in paths:
            path = Path(raw).expanduser().resolve()
            if path.suffix.lower() != '.xlsx':
                raise ValueError('只登记 .xlsx 工作簿')
            if str(path) not in entry['files'] and len(entry['files']) >= 32:
                raise ValueError('每会话最多32份工作簿')
            entry['files'][str(path)] = None  # first hook also verifies an existing workbook
        entry['updated'] = time.time()
    print('已登记；工具执行后自动验证：' + ', '.join(paths))


def run_hook(event):
    if event.get('hook_event_name') not in ('PostToolUse', 'Stop'):
        return {}
    # Dormant bridge must not create state or load spreadsheet dependencies.
    if not state_path().exists():
        return {}
    messages = []
    with registry() as data:
        entry = data.get(event.get('session_id'))
        if not entry:
            return {}
        from validate_workbook import validate
        from annotate_workbook import annotate
        for name, previous in list(entry['files'].items()):
            path = Path(name)
            if not path.exists():
                if event['hook_event_name'] == 'Stop':
                    messages.append(f'{name}: 尚未生成或已删除，未验证')
                continue
            try:
                fingerprint = hashlib.sha256(path.read_bytes()).hexdigest()
                report = path.with_suffix('.validation.json')
                review_path = path.with_suffix('.review.json')
                review_bytes = review_path.read_bytes() if review_path.exists() else b''
                review_hash = hashlib.sha256(review_bytes).hexdigest()
                if previous == {'workbook': fingerprint, 'review': review_hash} and report.exists():
                    continue
                result = validate(path)
                if review_bytes:
                    import openpyxl
                    wb = openpyxl.load_workbook(path, data_only=True)
                    for item in json.loads(review_bytes)['issues']:
                        if wb[item['sheet']][item['cell']].value != item['expected_value']:
                            raise ValueError('来源审查定位已变化，请更新 review.json：' + item['cell'])
                        result['issues'].append(dict(level='error' if item.get('blocking') else 'review',
                            sheet=item['sheet'], cell=item['cell'], message=('阻断导入：' if item.get('blocking') else '') + item['message']))
                    wb.close()
                    if any(i['level'] == 'error' for i in result['issues']):
                        result['status'] = 'ERROR'
                if hashlib.sha256(path.read_bytes()).hexdigest() != fingerprint:
                    raise ValueError('验证期间文件发生变化，下次 hook 重试')
                marked = annotate(path, result['issues'], fingerprint)
                fingerprint = hashlib.sha256(path.read_bytes()).hexdigest()
                result['sha256'] = fingerprint
                result['annotated_cells'] = marked
                result['hook'] = {'session_id': event['session_id'], 'event': event['hook_event_name']}
                temp = report.with_suffix('.json.tmp')
                temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                temp.replace(report)
                entry['files'][name] = {'workbook': fingerprint, 'review': review_hash}
                details = '; '.join(f"{i['sheet']}!{i['cell']} {i['message']}" for i in result['issues'][:5])
                messages.append(f"{name}: {result['status']}，{len(result['issues'])}项；已标红并批注{marked}个单元格；报告 {report}。{details}")
            except Exception as exc:
                messages.append(f'{name}: 自动验证失败：{exc}；不能宣称已验证，下次工具完成后重试')
        entry['updated'] = time.time()
    if not messages:
        return {}
    text = 'container-intake 自动验证\n' + '\n'.join(messages) + '\n表内通过不代表来源正确。修复确定错误；待补或需判断项对照来源后如实报告。'
    if event['hook_event_name'] == 'PostToolUse':
        return {'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': text}}
    return {'systemMessage': text}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['register', 'unregister', 'hook'])
    parser.add_argument('workbooks', nargs='*')
    parser.add_argument('--session', default=os.environ.get('CODEX_THREAD_ID'))
    args = parser.parse_args()
    try:
        if args.action == 'hook':
            print(json.dumps(run_hook(json.load(sys.stdin)), ensure_ascii=False))
        elif args.action == 'register':
            if not args.workbooks:
                parser.error('register 至少需要一份工作簿')
            register(args.session, args.workbooks)
        else:
            if not args.session:
                parser.error('unregister 需要 session ID')
            if state_path().exists():
                with registry() as data:
                    data.pop(args.session, None)
    except Exception as exc:
        print(f'container-intake hook: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
