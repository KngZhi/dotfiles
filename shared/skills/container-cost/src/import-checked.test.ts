import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { utils, writeFile } from './xlsx.js';
import { checkImport } from './import-checked.js';
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
