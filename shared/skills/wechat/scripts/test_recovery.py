import io
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.padding import PKCS7
from recover_images import decode, bounded, MAGIC


class RecoveryTests(unittest.TestCase):
    def test_located_manifest_runs_recovery_without_database_backend(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            account = base / 'Documents/xwechat_files/test-account'
            media = account / 'msg/attach/test-chat/2026-09/Img'
            media.mkdir(parents=True)
            kvcomm = base / 'Documents/kvcomm'
            kvcomm.mkdir()
            (kvcomm / 'key_83_fixture.statistic').touch()
            key = hashlib.md5(b'83test-account').hexdigest()[:16].encode()
            buf = io.BytesIO()
            Image.new('RGB', (8, 8), 'red').save(buf, 'PNG')
            original = buf.getvalue()
            pad = PKCS7(128).padder()
            data = pad.update(original[:17]) + pad.finalize()
            enc = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
            selected = media / 'selected.dat'
            selected.write_bytes(MAGIC + (17).to_bytes(4, 'little') + (0).to_bytes(4, 'little')
                                 + b'\0' + enc.update(data) + enc.finalize() + original[17:])
            for index in range(2):
                enc = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
                block = b'\xff\xd8\xff' + bytes([index]) * 13
                (media / f'template-{index}.dat').write_bytes(MAGIC + bytes(9) + enc.update(block) + enc.finalize())
            manifest = base / 'located.json'
            manifest.write_text(json.dumps({'account': str(account), 'manifest': [{'id': 'fixture', 'dat': str(selected)}]}))
            output = base / 'output'
            launcher = Path(__file__).with_name('wechat.py')
            command = [sys.executable, str(launcher), 'images', 'recover', '--manifest', str(manifest), '--out', str(output)]
            env = {**os.environ, 'WECHAT_BACKEND_DIR': str(base / 'missing-backend')}
            result = subprocess.run(command, env=env, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            with Image.open(output / 'fixture-plane-00.png') as recovered:
                self.assertEqual(recovered.tobytes(), Image.open(io.BytesIO(original)).tobytes())
            self.assertEqual((output / 'recovered.json').stat().st_mode & 0o777, 0o600)
            self.assertNotEqual(subprocess.run(command, env=env, capture_output=True).returncode, 0)

    def test_aligned_and_unaligned_segments(self):
        buf = io.BytesIO()
        Image.new('RGB', (8, 8), 'red').save(buf, 'PNG')
        original = buf.getvalue()
        key, xor = b'0123456789abcdef', 83
        for length in [16, 17]:
            pad = PKCS7(128).padder()
            block = pad.update(original[:length]) + pad.finalize()
            enc = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
            payload = (MAGIC + length.to_bytes(4, 'little') + (12).to_bytes(4, 'little')
                       + b'\0' + enc.update(block) + enc.finalize() + original[length:-12]
                       + bytes(v ^ xor for v in original[-12:]))
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'image.dat'
                path.write_bytes(payload)
                self.assertEqual(decode(path, key, xor), original)
                with self.assertRaises(ValueError):
                    decode(path, key, xor ^ 1)
                path.write_bytes(payload[:20])
                with self.assertRaises(ValueError):
                    decode(path, key, xor)

    def test_scope_rejects_sibling_account(self):
        with self.assertRaises(ValueError):
            bounded('/tmp/another-account/msg/attach/image.dat', Path('/tmp/account'))


if __name__ == '__main__':
    unittest.main()
