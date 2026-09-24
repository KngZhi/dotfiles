#!/usr/bin/env python3
"""Read and change Type4Me user vocabulary (snippet mappings and hotwords).

Storage rules follow Type4Me v2.8.0: the user files are the effective
vocabulary; built-in files are reference only and never written.
"""
import argparse
import json
import os
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

DEFAULT_DATA_DIR = Path.home() / "Library/Application Support/Type4Me"
APP = Path("/Applications/Type4Me.app")
RELOAD_URL = "type4me://reload-vocabulary"


class VocabError(Exception):
    pass


def trigger_key(text):
    return re.sub(r"\s+", "", text).casefold()


def hotword_key(text):
    return " ".join(text.split()).casefold()


def load_array(path, kind):
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise VocabError(f"{path.name}: invalid JSON ({e})")
    if not isinstance(data, list):
        raise VocabError(f"{path.name}: expected a JSON array")
    for i, item in enumerate(data):
        if kind == "snippets":
            ok = (isinstance(item, dict) and isinstance(item.get("trigger"), str)
                  and isinstance(item.get("replacement"), str))
        else:
            ok = isinstance(item, str)
        if not ok:
            raise VocabError(f"{path.name}[{i}]: unexpected entry {item!r}")
    return data


def app_info():
    try:
        with open(APP / "Contents/Info.plist", "rb") as f:
            info = plistlib.load(f)
    except OSError:
        return None, False
    schemes = [s for t in info.get("CFBundleURLTypes", []) for s in t.get("CFBundleURLSchemes", [])]
    return info.get("CFBundleShortVersionString"), "type4me" in schemes


def backup(path, stamp):
    if not path.exists():
        return None
    dest = path.with_name(f"{path.name}.bak-{stamp}")
    n = 1
    while dest.exists():
        dest = path.with_name(f"{path.name}.bak-{stamp}-{n}")
        n += 1
    shutil.copy2(path, dest)
    return dest


def write_atomic(path, text):
    mode = path.stat().st_mode & 0o777 if path.exists() else 0o600
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def dump(data):
    # Matches the app's existing files: 2-space indent, UTF-8, no trailing newline.
    return json.dumps(data, ensure_ascii=False, indent=2)


def hotwords_txt(hotwords):
    seen, out = set(), []
    for w in hotwords:
        if hotword_key(w) not in seen:
            seen.add(hotword_key(w))
            out.append(w)
    return "\n".join(out)


def parse_snippet(spec):
    if "=>" not in spec:
        raise VocabError(f"snippet {spec!r}: use 'misheard=>Correct'")
    trigger, replacement = (s.strip() for s in spec.split("=>", 1))
    if not trigger or not replacement:
        raise VocabError(f"snippet {spec!r}: trigger and replacement are required")
    if trigger == replacement:
        raise VocabError(f"snippet {spec!r}: trigger equals replacement")
    return trigger, replacement


class Store:
    def __init__(self, data_dir):
        self.dir = data_dir
        if not data_dir.is_dir():
            raise VocabError(f"{data_dir} does not exist; start Type4Me once first")
        self.snippets_path = data_dir / "snippets.json"
        self.hotwords_path = data_dir / "hotwords.json"
        self.txt_path = data_dir / "hotwords.txt"
        self.snippets = load_array(self.snippets_path, "snippets")
        self.hotwords = load_array(self.hotwords_path, "hotwords")
        self.builtin_snippets = load_array(data_dir / "builtin-snippets.json", "snippets")
        self.builtin_hotwords = load_array(data_dir / "builtin-hotwords.json", "hotwords")

    def builtin_note(self, key, snippet=True):
        pool = ([trigger_key(s["trigger"]) for s in self.builtin_snippets] if snippet
                else [hotword_key(w) for w in self.builtin_hotwords])
        return " (also built-in; user entry still needed)" if key in pool else ""

    def save(self, snippets_changed, hotwords_changed):
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        targets = []
        if snippets_changed:
            targets.append((self.snippets_path, dump(self.snippets)))
        if hotwords_changed:
            targets.append((self.hotwords_path, dump(self.hotwords)))
            targets.append((self.txt_path, hotwords_txt(self.hotwords)))
        for path, text in targets:
            b = backup(path, stamp)
            if b:
                print(f"backup: {b.name}")
            write_atomic(path, text)


def cmd_show(store, args):
    version, _ = app_info()
    print(f"app version: {version or 'not found'}; data dir: {store.dir}")
    print(f"user snippets: {len(store.snippets)}; user hotwords: {len(store.hotwords)}; "
          f"built-in files: {len(store.builtin_snippets)} snippets, {len(store.builtin_hotwords)} hotwords")
    needle = trigger_key(args.grep) if args.grep else None
    for s in store.snippets:
        if needle is None or needle in trigger_key(s["trigger"]) or needle in trigger_key(s["replacement"]):
            print(f"snippet: {s['trigger']} => {s['replacement']}")
    for w in store.hotwords:
        if needle is None or needle in trigger_key(w):
            print(f"hotword: {w}")
    expected = hotwords_txt(store.hotwords)
    actual = store.txt_path.read_text(encoding="utf-8") if store.txt_path.exists() else None
    print("hotwords.txt: " + ("in sync" if actual == expected else "OUT OF SYNC with hotwords.json"))
    return 0


def cmd_add(store, args):
    requested = [parse_snippet(s) for s in args.snippet]
    seen = {}
    for trigger, replacement in requested:
        prev = seen.setdefault(trigger_key(trigger), replacement)
        if prev != replacement:
            raise VocabError(f"request maps {trigger!r} to both {prev!r} and {replacement!r}")

    index = {trigger_key(s["trigger"]): i for i, s in enumerate(store.snippets)}
    snippets_changed = hotwords_changed = False
    conflicts = []
    for trigger, replacement in requested:
        key = trigger_key(trigger)
        note = store.builtin_note(key)
        if key not in index:
            store.snippets.append({"trigger": trigger, "replacement": replacement})
            index[key] = len(store.snippets) - 1
            snippets_changed = True
            print(f"add snippet: {trigger} => {replacement}{note}")
            continue
        existing = store.snippets[index[key]]
        if existing["replacement"] == replacement:
            print(f"skip snippet (exists): {existing['trigger']} => {replacement}")
        elif args.replace:
            print(f"update snippet: {existing['trigger']} => {existing['replacement']} -> {replacement}")
            existing["replacement"] = replacement
            snippets_changed = True
        else:
            conflicts.append(f"{existing['trigger']} => {existing['replacement']} (requested {replacement})")

    hot_keys = {hotword_key(w) for w in store.hotwords}
    for word in (w.strip() for w in args.hotword):
        key = hotword_key(word)
        if not key:
            continue
        if key in hot_keys:
            print(f"skip hotword (exists): {word}")
        else:
            store.hotwords.append(word)
            hot_keys.add(key)
            hotwords_changed = True
            print(f"add hotword: {word}{store.builtin_note(key, snippet=False)}")

    if conflicts:
        for c in conflicts:
            print(f"conflict: {c}")
        print("nothing written; rerun with --replace if the requested correction supersedes the "
              "existing mapping, or drop the conflicting variant")
        return 1
    return finish(store, args, snippets_changed, hotwords_changed,
                  [trigger_key(t) for t, _ in requested], [hotword_key(w) for w in args.hotword])


def cmd_remove(store, args):
    snippets_changed = hotwords_changed = False
    for trigger in args.trigger:
        key = trigger_key(trigger)
        kept = [s for s in store.snippets if trigger_key(s["trigger"]) != key]
        if len(kept) == len(store.snippets):
            print(f"not found snippet: {trigger}")
        else:
            for s in store.snippets:
                if trigger_key(s["trigger"]) == key:
                    print(f"remove snippet: {s['trigger']} => {s['replacement']}")
            store.snippets = kept
            snippets_changed = True
    for word in args.hotword:
        key = hotword_key(word)
        kept = [w for w in store.hotwords if hotword_key(w) != key]
        if len(kept) == len(store.hotwords):
            print(f"not found hotword: {word}")
        else:
            print(f"remove hotword: {word}")
            store.hotwords = kept
            hotwords_changed = True
    return finish(store, args, snippets_changed, hotwords_changed,
                  [trigger_key(t) for t in args.trigger], [hotword_key(w) for w in args.hotword])


def finish(store, args, snippets_changed, hotwords_changed, trigger_keys, hot_keys):
    if not (snippets_changed or hotwords_changed):
        print("no changes")
        return 0
    if args.dry_run:
        print("dry run: nothing written")
        return 0
    store.save(snippets_changed, hotwords_changed)

    # Read back from disk rather than trusting in-memory state.
    fresh = Store(store.dir)
    for s in fresh.snippets:
        if trigger_key(s["trigger"]) in trigger_keys:
            print(f"verified snippet: {s['trigger']} => {s['replacement']}")
    for w in fresh.hotwords:
        if hotword_key(w) in hot_keys:
            print(f"verified hotword: {w}")
    txt = fresh.txt_path.read_text(encoding="utf-8") if fresh.txt_path.exists() else None
    if hotwords_changed and txt != hotwords_txt(fresh.hotwords):
        raise VocabError("hotwords.txt does not match hotwords.json after writing")

    if args.no_reload:
        print("reload: skipped (--no-reload)")
        return 0
    _, has_scheme = app_info()
    if has_scheme:
        r = subprocess.run(["open", RELOAD_URL], capture_output=True, text=True)
        if r.returncode == 0:
            print("reload: URL dispatched; this does not prove the app reloaded")
        else:
            print(f"reload: dispatch failed ({r.stderr.strip() or r.returncode}); "
                  "snippets apply on next recording, hotwords after refresh or app restart")
    else:
        print("reload: URL scheme unsupported; snippets apply on next recording. For local "
              "hotwords, open Type4Me settings > vocabulary and press refresh, or restart the app")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    sub = parser.add_subparsers(dest="command", required=True)

    show = sub.add_parser("show", help="list user vocabulary")
    show.add_argument("--grep", help="filter by text, ignoring case and whitespace")

    for name, help_text in [("add", "add or update entries"), ("remove", "remove entries")]:
        p = sub.add_parser(name, help=help_text)
        if name == "add":
            p.add_argument("--snippet", action="append", default=[], metavar="'MISHEARD=>Correct'")
            p.add_argument("--replace", action="store_true",
                           help="overwrite an existing trigger that maps to a different replacement")
        else:
            p.add_argument("--trigger", action="append", default=[])
        p.add_argument("--hotword", action="append", default=[])
        p.add_argument("--dry-run", action="store_true")
        p.add_argument("--no-reload", action="store_true")

    args = parser.parse_args(argv)
    try:
        store = Store(args.data_dir.expanduser())
        return {"show": cmd_show, "add": cmd_add, "remove": cmd_remove}[args.command](store, args)
    except VocabError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
