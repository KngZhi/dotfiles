#!/usr/bin/env python3
"""Run the installed WeChat backend and the bundled image recovery helpers."""

import json
import os
from pathlib import Path
import subprocess
import sys


SKILL = Path(__file__).resolve().parents[1]


def backend():
    configured = os.environ.get("WECHAT_BACKEND_DIR")
    root = Path(configured).expanduser() if configured else SKILL.parents[1] / "skill-packs/tzwkb-wechat-decrypt"
    root = root.resolve()
    if not (root / "scripts/common/query.py").is_file():
        raise ValueError("WeChat backend missing. Run the dotfiles shared build or set WECHAT_BACKEND_DIR to its checkout.")
    return root


def interpreter(root):
    configured = os.environ.get("WECHAT_PYTHON")
    if configured:
        return configured
    candidate = root / (".venv/Scripts/python.exe" if os.name == "nt" else ".venv/bin/python")
    return str(candidate) if candidate.is_file() else sys.executable


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print("usage: wechat.py {backend,doctor,query,evidence,export,transcribe,images,backend-script} [arguments]")
        return 0
    action, *args = sys.argv[1:]
    if action == "images":
        python = os.environ.get("WECHAT_IMAGE_PYTHON", sys.executable)
        return subprocess.run([python, str(SKILL / "scripts/recover_images.py"), *args]).returncode
    root = backend()
    python = interpreter(root)
    if action == "backend":
        print(json.dumps({"root": str(root), "python": python}))
        return 0
    targets = {
        "doctor": root / "scripts/common/doctor.py",
        "query": root / "scripts/common/query.py",
        "export": root / "scripts/common/export_chat.py",
        "transcribe": root / "scripts/common/transcribe_db.py",
        "evidence": SKILL / "scripts/evidence.py",
    }
    if action == "backend-script":
        if not args:
            raise ValueError("backend-script requires a relative .py path below scripts/")
        relative, *args = args
        target = (root / relative).resolve()
        if not target.is_relative_to(root / "scripts") or target.suffix != ".py":
            raise ValueError("Backend script must be a .py file below scripts/")
    elif action in targets:
        target = targets[action]
    else:
        raise ValueError(f"Unknown action: {action}")
    if not target.is_file():
        raise ValueError(f"Backend or helper script missing: {target.name}")
    env = {**os.environ, "WECHAT_BACKEND_DIR": str(root)}
    return subprocess.run([python, str(target), *args], env=env).returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        raise SystemExit(str(error)) from None
