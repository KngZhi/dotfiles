import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import test from 'node:test';
import * as XLSX from './xlsx.js';
import { validateContainer } from './validate.js';

test('an existing K2046 product without a primary barcode is an explicit warning', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'container-cost-'));
  const file = join(directory, 'unbarcoded.xlsx');
  try {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['货号', '条形码', '分类1', '分类2', '供应商'],
      ['SM201', '', '组合', '袜子组合', '新疆'],
      ['DATA_END'],
    ]), 'data');
    XLSX.writeFile(workbook, file);
    const result = await validateContainer(file, {
      productQuery: async () => ({
        products: new Map([
          ['SM201', {
            productNumber: 'SM201',
            barCode1: '',
            category: { id: 2, name: '袜子组合', parentId: 1 },
          }],
        ]),
        checkedProductNumbers: new Set(['SM201']),
        errors: [],
      }),
      supplierQuery: async () => [{ id: '1', name: '新疆', type: 'Supplier' }],
    });
    assert.equal(result.passed, true);
    assert.equal(result.summary.total_rows, 1);
    assert.equal(result.summary.missing_barcode, 1);
    assert.match(result.warnings[0].message, /不要把组合内多个组件条码/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('an empty barcode is not silently skipped when no K2046 exception is proven', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'container-cost-'));
  const file = join(directory, 'missing.xlsx');
  try {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['货号', '条形码', '供应商'],
      ['UNKNOWN', '', '新疆'],
    ]), 'data');
    XLSX.writeFile(workbook, file);
    const result = await validateContainer(file, {
      productQuery: async () => ({
        products: new Map(),
        checkedProductNumbers: new Set(['UNKNOWN']),
        errors: [],
      }),
      supplierQuery: async () => [],
    });
    assert.equal(result.passed, false);
    assert.equal(result.summary.total_rows, 1);
    assert.equal(result.summary.format_errors, 1);
    assert.equal(result.summary.not_found, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
