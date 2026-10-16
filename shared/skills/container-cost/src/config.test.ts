import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveOneDriveDir } from './config.js';

function cloudStorage(...roots: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'cloud-'));
  for (const root of roots) mkdirSync(join(dir, root, 'source_files/containers'), { recursive: true });
  return dir;
}

test('resolves the OneDrive root that actually exists', () => {
  const dir = cloudStorage('OneDrive-个人');
  assert.equal(
    resolveOneDriveDir('source_files/containers', dir),
    join(dir, 'OneDrive-个人', 'source_files/containers'),
  );
});

test('throws instead of creating a missing OneDrive directory', () => {
  const dir = cloudStorage();
  assert.throws(() => resolveOneDriveDir('source_files/containers', dir), /找不到/);
  assert.deepEqual(readdirSync(dir), []);
});
