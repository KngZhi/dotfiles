#!/usr/bin/env python3
"""Thin evidence/resource adapter; database and message engines stay upstream."""
import argparse
import hashlib
import importlib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone as dt_timezone
from pathlib import Path
from zoneinfo import ZoneInfo


def backend(root):
    root = Path(root).expanduser().resolve()
    if not (root / 'scripts/common/export_chat.py').is_file():
        raise ValueError('Backend is missing export_chat.py')
    sys.path[:0] = [str(root), str(root / 'scripts/common')]
    modules = [importlib.import_module(n) for n in ('db', 'contacts', 'message', 'appmsg', 'export_chat')]
    if any(not Path(m.__file__).resolve().is_relative_to(root) for m in modules):
        raise ValueError('Conflicting backend modules already imported; use a fresh process')
    return modules


def unique_chat(db, contacts, chat):
    matches = contacts.find_contact(chat, db.get_name2id())
    if len(matches) != 1:
        raise ValueError('Chat must match exactly one contact; candidates=' + json.dumps(
            [{'wxid': w, 'display': d} for _, w, d in matches], ensure_ascii=False))
    table, wxid, display = matches[0]
    if not re.fullmatch(r'Msg_[a-f0-9]{32}', table):
        raise ValueError('Unsupported message table identity')
    return table, wxid, display


def metadata(appmsg, text, local_type):
    app = appmsg.parse_app_message(text, local_type)
    allowed = ('app_type', 'kind', 'label', 'title', 'description', 'source',
               'artist', 'file_name', 'file_ext', 'file_size', 'file_md5', 'quoted_sender', 'quoted_type')
    safe = {k: app[k] for k in allowed if app.get(k) not in (None, '')}
    quoted = app.get('quoted_content', '')
    if quoted:
        if '<' not in quoted:
            safe['quoted_content'] = quoted
        elif int(app.get('quoted_type') or 0) == 49:
            nested = appmsg.parse_app_message(quoted, 49)
            safe['quoted_attachment'] = {k: nested[k] for k in ('kind', 'title', 'file_name', 'file_ext')
                                         if nested.get(k)}
    return safe


def read_evidence(backend_dir, chat, start, end, timezone, limit=200, keywords=()):
    if limit < 1:
        raise ValueError('limit must be positive')
    db, contacts, message, appmsg, exporter = backend(backend_dir)
    if not message.has_zstd_decoder():
        raise ValueError('Zstd unavailable; cannot claim a complete scoped text query')
    table, wxid, display = unique_chat(db, contacts, chat)
    zone = ZoneInfo(timezone)
    since = datetime.strptime(start, '%Y-%m-%d').replace(tzinfo=zone)
    until = datetime.strptime(end, '%Y-%m-%d').replace(tzinfo=zone) + timedelta(days=1)
    if until <= since:
        raise ValueError('end must not precede start')
    paths = db.get_message_dbs()
    rows = exporter.fetch(table, paths, since, until)
    rows.sort(key=lambda r: (int(r['create_time']), r['_db'], int(r['local_id'])))
    messages, seen = [], set()
    for row in rows:
        identity = (row['_db'], row['local_id'])
        if identity in seen:
            continue
        seen.add(identity)
        text = message.decode_message_hex(row.get('msg_hex'))
        kind = message.normalize_type(row.get('local_type'))
        app = metadata(appmsg, text, row['local_type']) if kind == '49' else None
        content = text if kind == '1' and not text.lstrip().startswith('<') else ''
        if kind in ('10000', '10002'):
            content = message.parse_system_message(text)['text']
        searchable = content + json.dumps(app or {}, ensure_ascii=False)
        if keywords and not any(k.casefold() in searchable.casefold() for k in keywords):
            continue
        sender = row.get('sender_wxid') or ''
        messages.append({'source_db': Path(row['_db']).name, 'source_table': table,
                         'local_id': str(row['local_id']), 'server_id': str(row['server_id']),
                         'epoch': int(row['create_time']),
                         'time': datetime.fromtimestamp(int(row['create_time']), zone).isoformat(),
                         'sender_wxid': sender, 'sender_name': contacts.resolve_contact_name(sender) if sender else '',
                         'is_me': row.get('is_me') == '1', 'type': kind, 'content': content,
                         **({'app': app} if app is not None else {})})
    message_dir = Path(db.find_data_dir()) / 'message'
    candidates = {p.name for p in message_dir.glob('message_*.db')
                  if re.fullmatch(r'message_\d+\.db', p.name)}
    quarantined = sorted(p.name for p in message_dir.glob('message_*.db.factory') if p.is_dir())
    readable = {Path(p).name for p in paths}
    return {'chat': {'wxid': wxid, 'display': display}, 'timezone': timezone,
            'account': str(Path(db.find_data_dir()).parent),
            'queried_at': datetime.now(dt_timezone.utc).isoformat(),
            'range': {'start': since.isoformat(), 'until_exclusive': until.isoformat()},
            'coverage': {'readable_shards': sorted(readable), 'unread_shards': sorted(candidates - readable),
                         'quarantined_shards': quarantined,
                         'scanned': len(seen), 'matched': len(messages), 'limit': limit,
                         'truncated': len(messages) > limit,
                         'complete': not (candidates - readable) and not quarantined and len(messages) <= limit},
            'messages': messages[:limit]}


def locate_images(backend_dir, chat, server_id):
    db, contacts, message, _, _ = backend(backend_dir)
    table, wxid, display = unique_chat(db, contacts, chat)
    sid = int(server_id)
    if sid <= 0:
        raise ValueError('server-id must be a positive integer')
    origins = []
    for path in db.get_message_dbs():
        if table not in db.query_raw(path, "SELECT name FROM sqlite_master WHERE type='table';"):
            continue
        for row in db.query(path, f'SELECT local_id,server_id,create_time,local_type FROM "{table}" WHERE server_id={sid};'):
            if message.normalize_type(row['local_type']) != '3':
                raise ValueError('Selected message is not an image')
            origins.append({'source_db': Path(path).name, **row})
    if not origins:
        raise ValueError('Image message was not found in the selected chat/readable shards')
    storage = Path(db.find_data_dir())
    account = storage.parent
    resource_db = storage / 'message/message_resource.db'
    if not resource_db.is_file():
        raise ValueError('message_resource.db is unavailable; resource lookup is unsupported')
    safe_wxid = wxid.replace("'", "''")
    infos = db.query(str(resource_db), 'SELECT message_id,message_local_id,message_create_time,hex(packed_info) AS packed '
                     f'FROM MessageResourceInfo WHERE message_svr_id={sid} AND chat_id IN '
                     f"(SELECT rowid FROM ChatName2Id WHERE user_name='{safe_wxid}');")
    resources, entries, used = [], [], set()
    folder = account / 'msg/attach' / hashlib.md5(wxid.encode()).hexdigest()
    for info in infos:
        if not any(str(o['local_id']) == str(info['message_local_id']) and
                   str(o['create_time']) == str(info['message_create_time']) for o in origins):
            raise ValueError('Resource identity conflicts with the selected message')
        details = db.query(str(resource_db), 'SELECT resource_id,type,size,status FROM MessageResourceDetail '
                           f"WHERE message_id={int(info['message_id'])};")
        resources.append({'message_id': info['message_id'], 'details': details})
        stems = set(x.decode() for x in re.findall(rb'(?<![a-f0-9])[a-f0-9]{32}(?![a-f0-9])', bytes.fromhex(info['packed'])))
        if len(stems) != 1:
            raise ValueError('Unsupported/ambiguous packed resource hash; no file guessed')
        for path in sorted(folder.glob('*/Img/' + next(iter(stems)) + '*.dat')):
            if not path.resolve().is_relative_to(account / 'msg/attach'):
                raise ValueError('Media path escaped selected account')
            if path not in used:
                used.add(path)
                entries.append({'id': f'image-{sid}-{len(entries)+1}', 'dat': str(path),
                                'bytes': path.stat().st_size, 'variant': 'thumbnail' if path.stem.endswith('_t') else 'candidate'})
    return {'chat': {'wxid': wxid, 'display': display}, 'server_id': str(sid), 'sources': origins,
            'account': str(account), 'resources': resources, 'manifest': entries,
            'note': 'Only located local files; absent files/status zero do not prove never downloaded.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', nargs='?', default='evidence', choices=('evidence', 'read', 'image-locate'))
    parser.add_argument('--backend-dir', default=os.environ.get('WECHAT_BACKEND_DIR'))
    parser.add_argument('--chat', required=True)
    parser.add_argument('--start')
    parser.add_argument('--end')
    parser.add_argument('--timezone', default='UTC')
    parser.add_argument('--limit', type=int, default=200)
    parser.add_argument('--keyword', action='append', default=[])
    parser.add_argument('--server-id')
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    os.umask(0o077)
    if not args.backend_dir:
        parser.error('--backend-dir or WECHAT_BACKEND_DIR is required')
    if args.mode in ('evidence', 'read'):
        if not args.start or not args.end:
            parser.error('evidence requires --start and --end')
        result = read_evidence(args.backend_dir, args.chat, args.start, args.end, args.timezone, args.limit, args.keyword)
    else:
        if not args.server_id:
            parser.error('image-locate requires --server-id')
        result = locate_images(args.backend_dir, args.chat, args.server_id)
    output = Path(args.out).expanduser()
    with output.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
    print(json.dumps({'out': str(output), 'mode': args.mode}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as exc:
        raise SystemExit(str(exc)) from None
