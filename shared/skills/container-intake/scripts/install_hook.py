#!/usr/bin/env python3
"""Merge the dormant Codex bridge; preserve all existing hooks."""
import argparse
import json
from pathlib import Path
import shlex
import sys


def install(home):
    path = home / '.codex/hooks.json'
    data = json.loads(path.read_text()) if path.exists() else {}
    command = shlex.join([sys.executable, str(home / '.codex/skills/container-intake/scripts/auto_verify.py'), 'hook'])
    for event in ('PostToolUse', 'Stop'):
        groups = data.setdefault('hooks', {}).setdefault(event, [])
        # Match our exact owned command suffix; never replace other handlers.
        owned = str(home / '.codex/skills/container-intake/scripts/auto_verify.py')
        for group in groups:
            group['hooks'] = [h for h in group.get('hooks', []) if owned not in h.get('command', '')]
        groups[:] = [g for g in groups if g.get('hooks')]
        groups.append({'hooks': [{'type': 'command', 'command': command, 'timeout': 60}]})
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if not path.exists() or path.read_text() != content:
        if path.exists():
            path.with_suffix('.json.before-container-intake').write_bytes(path.read_bytes())
        temp = path.with_suffix('.json.tmp')
        temp.write_text(content)
        temp.replace(path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', type=Path, default=Path.home())
    install(parser.parse_args().home)
