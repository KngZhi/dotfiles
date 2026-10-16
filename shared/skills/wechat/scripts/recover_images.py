#!/usr/bin/env python3
"""Junwei, migrated from wechat-local-image-recovery (2026-09-08).

Read-only V2 image recovery. No network, key persistence or WeChat control."""
import argparse
import hashlib
import io
import json
import os
import re
import subprocess
from pathlib import Path
from PIL import Image
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.padding import PKCS7

MAGIC = bytes.fromhex('070856320807')


def image_magic(data):
    return data.startswith((b'\xff\xd8\xff', b'\x89PNG', b'GIF', b'RIFF', b'wxgf'))


def aes(key, data):
    decoder = Cipher(algorithms.AES(key), modes.ECB()).decryptor()
    return decoder.update(data) + decoder.finalize()


def bounded(path, account):
    path = Path(path).expanduser().resolve()
    if not any(path.is_relative_to(account / part) for part in ['msg/attach', 'cache']):
        raise ValueError('Source outside selected account media directories')
    return path


def derive(account, files):
    templates = []
    for path in files:
        with path.open('rb') as stream:
            head = stream.read(31)
        if head[:6] == MAGIC and len(head) == 31 and head[15:] not in templates:
            templates.append(head[15:])
        if len(templates) == 3:
            break
    if len(templates) < 3:
        raise ValueError('Need three distinct V2 ciphertext templates')
    documents = account.parent.parent
    codes = set()
    for directory in documents.rglob('kvcomm'):
        if directory.is_dir():
            for path in directory.iterdir():
                match = re.fullmatch(r'key_(\d+)_.+\.statistic', path.name)
                if match:
                    codes.add(match[1])
    normalized = re.sub(r'_[0-9a-fA-F]{4}$', '', account.name)
    for name in dict.fromkeys([normalized, account.name]):
        for code in sorted(codes):
            key = hashlib.md5((code + name).encode()).hexdigest()[:16].encode()
            if all(image_magic(aes(key, block)) for block in templates):
                return key, int(code) & 255
    raise ValueError('No cached key candidate passed three-template validation')


def decode(path, key, xor):
    data = path.read_bytes()
    if len(data) < 31 or data[:6] != MAGIC:
        raise ValueError('Unsupported or truncated V2 file')
    length = int.from_bytes(data[6:10], 'little')
    tail = int.from_bytes(data[10:14], 'little')
    end = 15 + (length // 16 + 1) * 16
    if end > len(data) or tail > len(data) - end:
        raise ValueError('Invalid segment lengths')
    unpad = PKCS7(128).unpadder()
    first = unpad.update(aes(key, data[15:end])) + unpad.finalize()
    if len(first) != length:
        raise ValueError('AES length mismatch')
    cut = len(data) - tail
    plain = first + data[end:cut] + bytes(value ^ xor for value in data[cut:])
    if not image_magic(plain):
        raise ValueError('Invalid decoded image header')
    if plain.startswith(b'\xff\xd8\xff') and not plain.endswith(b'\xff\xd9'):
        raise ValueError('Invalid JPEG trailer')
    if plain.startswith(b'\x89PNG') and b'IEND' not in plain[-12:]:
        raise ValueError('Invalid PNG trailer')
    return plain


def pixels(data):
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def fingerprint(image):
    gray = image.convert('L').resize((33, 32))
    small = [gray.getpixel((x, y)) for y in range(32) for x in range(33)]
    return [small[y * 33 + x + 1] > small[y * 33 + x]
            for y in range(32) for x in range(32)]


def planes(data):
    if not data.startswith(b'wxgf'):
        return [(0, pixels(data))]
    starts = [m.start() for m in re.finditer(b'\x00\x00\x00\x01\x40\x01', data)]
    if not starts or len(starts) > 8:
        raise ValueError('Unsupported WXGF stream layout')
    found = []
    for index, start in enumerate(starts):
        process = subprocess.run(
            ['ffmpeg', '-v', 'error', '-threads', '1', '-f', 'hevc', '-i', 'pipe:0',
             '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'],
            input=data[start:], capture_output=True, timeout=20)
        if process.returncode == 0 and process.stdout:
            found.append((index, pixels(process.stdout)))
    if not found:
        raise ValueError('No decodable WXGF plane')
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['match', 'recover'])
    parser.add_argument('--account', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--scope', type=Path)
    parser.add_argument('--queries', type=Path)
    parser.add_argument('--manifest', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    entries = None
    if args.mode == 'recover':
        if not args.manifest:
            parser.error('recover requires --manifest')
        document = json.loads(args.manifest.read_text())
        if isinstance(document, dict):
            inferred = Path(document['account']).expanduser().resolve()
            if args.account and args.account.expanduser().resolve() != inferred:
                raise ValueError('Explicit account conflicts with located image account')
            args.account = inferred
            entries = document['manifest']
        else:
            entries = document
    if not args.account:
        parser.error('--account is required unless the manifest contains the located account')
    account = args.account.expanduser().resolve()
    if account.parent.name != 'xwechat_files' or not account.is_dir():
        raise ValueError('Select an existing xwechat_files account directory')
    output = args.out.expanduser().resolve()
    if output.exists() or output.is_relative_to(account):
        raise ValueError('Output must be new and outside the account directory')
    if args.mode == 'match':
        if not args.scope or not args.queries:
            parser.error('match requires --scope and --queries')
        scope = bounded(args.scope, account)
        files = sorted(bounded(p, account) for p in scope.rglob('*.dat'))
        queries = sorted(p for p in args.queries.iterdir()
                         if p.suffix.lower() in ['.png', '.jpg', '.jpeg'])
        if not queries:
            raise ValueError('No PNG/JPG queries')
        features = [fingerprint(pixels(p.read_bytes())) for p in queries]
        templates = files
    else:
        ids = [entry['id'] for entry in entries]
        if not ids or len(set(ids)) != len(ids) or any(
                not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}', i) for i in ids):
            raise ValueError('Manifest IDs must be unique safe filenames')
        files = [bounded(entry['dat'], account) for entry in entries]
        templates = files + [bounded(p, account) for parent in {f.parent for f in files}
                             for p in sorted(parent.glob('*.dat'))[:64]]
    key, xor = derive(account, templates)
    output.mkdir(parents=True)
    if args.mode == 'match':
        best = [[] for _ in queries]
        skipped = 0
        for path in files:
            try:
                data = decode(path, key, xor)
                if data.startswith(b'wxgf'):
                    skipped += 1
                    continue
                image = pixels(data)
                feature = fingerprint(image)
            except (ValueError, OSError):
                skipped += 1
                continue
            for index, target in enumerate(features):
                score = sum(a != b for a, b in zip(feature, target))
                best[index].append(dict(score=score, dat=str(path), size=image.size))
                best[index] = sorted(best[index], key=lambda item: item['score'])[:6]
        result = [dict(query=str(q), candidates=b) for q, b in zip(queries, best)]
        (output / 'candidates.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(dict(queries=len(queries), files=len(files), skipped=skipped)))
    else:
        result = []
        for entry, path in zip(entries, files):
            data = decode(path, key, xor)
            for index, image in planes(data):
                target = output / f"{entry['id']}-plane-{index:02}.png"
                image.save(target)
                result.append(dict(id=entry['id'], source_dat=str(path),
                                   source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                                   plane=index, size=image.size, path=str(target),
                                   conversion='WXGF to PNG' if data.startswith(b'wxgf') else 'PNG export'))
        (output / 'recovered.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(dict(sources=len(files), planes=len(result))))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, subprocess.TimeoutExpired) as error:
        raise SystemExit(f'Recovery stopped: {error}') from None
