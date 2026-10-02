import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { utils, writeFile } from './xlsx.js';
import { checkImport } from './import-checked.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('all five prices must be positive and categories present', () => {
  const dir = mkdtempSync(join(tmpdir(), 'price-gate-'));
  const file = join(dir, 'cost.xlsx');
  const header = ['货号', '条形码', '产品名1', '产品名2', '供应商', '成本价', '箱价格', '大包价格', '包价格', '单价', '装箱数', '大包装数', '包装数', '件数', '散件数', '仓库', '分类1', '分类2'];
  const valid = ['S1', '', 'S1', '', '新疆', 100, 200, 250, 300, 400, 80, 5, 1, 1, 0, 'lazon', 'cace', 'PF'];
  function check(row: unknown[]) {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.aoa_to_sheet([header, row]), '成本计算结果');
    writeFile(book, file); return checkImport(file);
  }
  try {
    assert.deepEqual(check(valid), []);
    for (let i = 5; i <= 9; i++) for (const bad of [0, '0.000', '', ' ', -1, 'bad']) {
      const row = [...valid]; row[i] = bad;
      assert.ok(check(row).some(e => e.includes(header[i])));
    }
    const row = [...valid]; row[17] = '';
    assert.ok(check(row).some(e => e.includes('分类2')));
  } finally { rmSync(dir, { recursive: true }); }
});

test('exact name2/SKU equality alerts with cells and stops before the importer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'name2-gate-'));
  const file = join(dir, 'cost.xlsx');
  const marker = join(dir, 'importer-called');
  const script = fileURLToPath(new URL('./import-checked.ts', import.meta.url));
  const header = ['货号', '条形码', '产品名1', '产品名2', '供应商', '成本价', '箱价格', '大包价格', '包价格', '单价', '装箱数', '大包装数', '包装数', '件数', '散件数', '仓库', '分类1', '分类2'];
  const row = ['IM103', '', '男士隐形袜', 'Calcetín Invisible Hombre', '新疆', 100, 200, 250, 300, 400, 80, 5, 1, 1, 0, 'lazon', 'cace', 'IM'];
  function save(name: string) {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.aoa_to_sheet([header, [...row.slice(0, 3), name, ...row.slice(4)]]), '成本计算结果');
    writeFile(book, file);
  }
  // Fake executable proves whether the real CLI reached import; it never contacts K2046.
  writeFileSync(join(dir, 'k2046'), `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, 'called');\n`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${dir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` };
  const run = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', script, file, ...args], { env, encoding: 'utf8' });
  try {
    save('Calcetín Invisible Hombre');
    assert.deepEqual(checkImport(file), []);
    assert.equal(run('--check-only').status, 0);
    assert.equal(existsSync(marker), false);
    for (const different of ['im103', 'IM103 ']) {
      save(different);
      assert.deepEqual(checkImport(file), []); // No broader trim/case-fold rule.
    }
    save('IM103');
    assert.deepEqual(checkImport(file), ['[PRODUCT_NAME_2_EQUALS_SKU] 第2行 IM103：产品名2（D2）与货号（A2）完全相同；阻断导入，按来源补真实产品名2']);
    const blocked = run('--container-no', 'MSDU6280629');
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /PRODUCT_NAME_2_EQUALS_SKU.*IM103.*D2.*A2/);
    assert.equal(existsSync(marker), false);
    save('Calcetín Invisible Hombre');
    assert.equal(run('--container-no', 'MSDU6280629').status, 0);
    assert.equal(existsSync(marker), true); // Corrected input reaches only the fake importer.
  } finally { rmSync(dir, { recursive: true }); }
});
