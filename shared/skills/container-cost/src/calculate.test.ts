import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import test from 'node:test';
import * as XLSX from './xlsx.js';
import {
  calculateContainerFile,
  normalizePricingUnits,
  OPTIONAL_CONFIG_PARAMS,
  REQUIRED_CONFIG_PARAMS,
  type ContainerDataRow,
} from './calculate.js';
import { DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP } from './business-rules.js';

const sockRow: ContainerDataRow = {
  货号: 'SOCK1',
  品名: '袜子',
  条形码: '6903010120680',
  单价: 0.62,
  装箱数: 1200,
  件数: 700,
  总数量: 840000,
  总立方: 68,
  供应商: '新疆',
  计价单位: '双',
};

test('converts supplier pair pricing to the dozen unit used by costs and K2046', () => {
  const [normalized] = normalizePricingUnits([sockRow]);
  assert.equal(normalized.计价单位, '打');
  assert.equal(normalized.单价, 7.44);
  assert.equal(normalized.装箱数, 100);
  assert.equal(normalized.总数量, 70000);
  assert.equal(normalized.件数, 700);
});

test('preserves total goods value when converting pairs to dozens', () => {
  const [normalized] = normalizePricingUnits([sockRow]);
  assert.equal(
    normalized.单价 * normalized.总数量,
    sockRow.单价 * sockRow.总数量,
  );
  assert.equal(normalized.单价 * normalized.总数量, 520800);
});

test('does not convert an already normalized dozen row twice', () => {
  const [normalized] = normalizePricingUnits([sockRow]);
  const [normalizedAgain] = normalizePricingUnits([normalized]);
  assert.deepEqual(normalizedAgain, normalized);
});

test('rejects pair quantities or packing counts that cannot form whole dozens', () => {
  assert.throws(
    () => normalizePricingUnits([{ ...sockRow, 装箱数: 1199 }]),
    /装箱数.*被 12 整除/,
  );
  assert.throws(
    () => normalizePricingUnits([{ ...sockRow, 总数量: 839999 }]),
    /总数量.*被 12 整除/,
  );
});

test('only sea freight and container number are required config parameters', () => {
  assert.deepEqual(REQUIRED_CONFIG_PARAMS, ['海运费', '货柜号']);
  assert.equal(OPTIONAL_CONFIG_PARAMS.includes('清关杂费'), true);
});

test('runs a completely local calculation and writes to the configured output directory', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'container-calculate-'));
  const input = join(directory, '(2026-07-17)TEST1234567.xlsx');
  const outputDirectory = join(directory, 'generated');
  try {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['货号', '品名', '条形码', '单价', '装箱数', '件数', '总数量', '总立方', '供应商'],
      ['SKU1', '测试商品', '6903010120680', 1, 100, 10, 1000, 68, '测试供应商'],
      ['DATA_END'],
    ]), 'data');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['海运费', 1000],
      ['内陆费', 0],
      ['货柜号', 'TEST1234567'],
      ['USD-CLP', 900],
    ]), 'config');
    XLSX.writeFile(workbook, input);

    const output = await calculateContainerFile(input, {
      outputDirectory,
      productQuery: async () => ({
        products: new Map(),
        checkedProductNumbers: new Set(['SKU1']),
        errors: [],
      }),
    });
    assert.equal(existsSync(output), true);
    assert.equal(output.startsWith(outputDirectory), true);
    const resultWorkbook = XLSX.readFile(output);
    const resultRows = XLSX.utils.sheet_to_json(
      resultWorkbook.Sheets['成本计算结果'],
      { header: 1 },
    ) as unknown[][];
    assert.equal(resultRows.length, 2);
    assert.equal(resultRows[1][0], 'SKU1');
    assert.equal(typeof resultRows[1][5], 'number');
    assert.equal(DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP, 1_350_000);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
