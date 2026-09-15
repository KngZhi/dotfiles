import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import * as XLSX from './xlsx.js';
import {
  calculateContainerFile,
  calculateCosts,
  generateOutput,
  loadDataSheet,
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

test('export preserves zero and missing data and adds bounded red warning rules', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cost-warnings-'));
  try {
    const output = generateOutput([{
      货号: 'TEST', 条形码: '001234', 产品名1: 'TEST 袜子', 产品名2: 'Calcetín',
      供应商: 'Supplier', 成本价: 123, boxPrice: 0, bigBagPrice: 20,
      bagPrice: 0, 装箱数: 100, 件数: 1, 仓库: 'lazon', category1: '袜子',
    }], 'test.xlsx', directory);
    const sheet = XLSX.readFile(output).Sheets['成本计算结果'];
    assert.equal(sheet.B2.v, '001234');
    assert.equal(sheet.F2.v, 123);
    assert.equal(sheet.G2.v, 0);
    assert.equal(sheet.H2.v, 20);
    assert.equal(sheet.J2.v, '');
    assert.equal(sheet.R2.v, '');
    execFileSync('python3', ['-c', `
import sys, zipfile, xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
 s=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
 styles=E.fromstring(z.read('xl/styles.xml'))
n={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
rules=s.findall('x:conditionalFormatting',n)
assert [r.get('sqref') for r in rules]==['F2:J2','Q2:R2']
assert 'VALUE(F2)=0' in rules[0].find('x:cfRule/x:formula',n).text
assert rules[1].find('x:cfRule/x:formula',n).text=='LEN(TRIM(Q2&""))=0'
for r in rules:
 dxf=styles.find('x:dxfs',n)[int(r.find('x:cfRule',n).get('dxfId'))]
 assert dxf.find('x:fill/x:patternFill/x:fgColor',n).get('rgb')=='FFFFC7CE'
`, output]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('reads plain or dozen-labelled prices and excludes the displayed total', () => {
  for (const priceHeader of ['单价', '单价（元/打）']) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['货号', '品名', '条形码', priceHeader, '装箱数', '件数', '总数量', '总立方', '供应商', '计价单位'],
      ['SOCK1', '袜子', '6903010120680', 7.44, 100, 14, 1400, 1.5, '新疆', '打'],
      ['DATA_END'],
      ['合计', null, null, null, null, 14, 1400],
    ]), 'data');
    const rows = loadDataSheet(workbook);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].单价, 7.44);
    assert.equal(rows[0].总数量, 1400);
    assert.deepEqual(normalizePricingUnits(rows), rows);
    if (priceHeader === '单价（元/打）') {
      workbook.Sheets.data.J2.v = '双';
      assert.throws(() => loadDataSheet(workbook), /计价单位.*冲突/);
    }
  }
});

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

test('estimates IVA on goods plus sea freight together and preserves an explicit IVA', async () => {
  const rows = [{ ...sockRow, 单价: 7, 装箱数: 100, 件数: 10, 总数量: 1000, 计价单位: '打' as const }];
  const params = {
    海运费: 2000, 内陆费: 0, 卸柜费: 0, 清关杂费: 0,
    'USD-CLP': 900, 'USD-CNY': 7, 'CNY-CLP': 135, IVA: 0, 货柜号: 'TEST',
  };
  const query = async () => ({ products: new Map(), checkedProductNumbers: new Set(['SOCK1']), errors: [] });
  const [estimated] = await calculateCosts(rows, params, query);
  // USD 1000 goods + USD 2000 freight gives CLP 153900 estimated IVA.
  assert.equal(estimated.成本价, 2899);
  const [actual] = await calculateCosts(rows, { ...params, IVA: 100000 }, query);
  assert.equal(actual.成本价, 2845);
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
      ['USD-CNY', 7],
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
    assert.equal(DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP, 1_500_000);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});


test('mixed container retains underwear pieces through loading and costing', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['货号', '品名', '条形码', '单价（元）', '装箱数', '件数', '总数量', '总立方', '供应商', '计价单位'],
    ['40S-1381', '女士内裤', '', 2.9, 1200, 2, 2400, 1, '恒伟', '条'],
    ['SOCK1', '袜子', '', 12, 100, 1, 100, 1, '新疆', '打'],
    ['DATA_END'],
  ]), 'data');
  const rows = loadDataSheet(workbook);
  assert.deepEqual(normalizePricingUnits(rows), rows);
  assert.equal(rows[0].单价 * rows[0].总数量, 6960);
  const results = await calculateCosts(rows, {
    海运费: 0, 内陆费: 0, 卸柜费: 0, 清关杂费: 0,
    'USD-CLP': 900, 'USD-CNY': 7, 'CNY-CLP': 100, IVA: 816,
    货柜号: 'TEST',
  }, async () => ({ products: new Map(), checkedProductNumbers: new Set(), errors: [] }));
  assert.equal(results[0].装箱数, 1200);
  assert.equal(results[0].件数, 2);
  assert.equal(results[0].成本价, 290);
  assert.equal(results[1].装箱数, 100);
  assert.equal(results[1].成本价, 1201);
  workbook.Sheets.data.D1.v = '单价（元/打）';
  assert.throws(() => loadDataSheet(workbook), /计价单位.*冲突/);
  workbook.Sheets.data.D1.v = '单价（元/条）';
  assert.throws(() => loadDataSheet(workbook), /计价单位.*冲突/);
  workbook.Sheets.data.J3.v = '条';
  assert.equal(loadDataSheet(workbook)[0].计价单位, '条');
});


test('MF401 keeps four standard cases and all 110 loose dozens through costing', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['货号', '品名', '条形码', '单价（元/打）', '装箱数', '件数', '总数量', '总立方', '供应商', '计价单位', '散件数'],
    ['MF401', '女士中筒袜', '', 10, 80, 4, 430, 0.49392, '新疆', '打', 110],
    ['DATA_END'],
  ]), 'data');
  const rows = loadDataSheet(workbook);
  assert.equal(rows[0].散件数, 110);
  assert.deepEqual(normalizePricingUnits(rows), rows);
  const [result] = await calculateCosts(rows, {
    海运费: 0, 内陆费: 0, 卸柜费: 0, 清关杂费: 0,
    'USD-CLP': 900, 'USD-CNY': 7, 'CNY-CLP': 100, IVA: 430,
    货柜号: 'TEST',
  }, async () => ({ products: new Map(), checkedProductNumbers: new Set(), errors: [] }));
  assert.equal(result.件数, 4);
  assert.equal(result.装箱数, 80);
  assert.equal(result.散件数, 110);
  assert.equal(result.成本价, 1001);
  assert.equal(result.件数 * result.装箱数 + result.散件数!, 430);
  const [pairs] = normalizePricingUnits([{...rows[0], 单价: 10/12, 计价单位: '双', 装箱数: 960, 总数量: 5160, 散件数: 1320}]);
  assert.equal(pairs.散件数, 110);
  assert.equal(pairs.总数量, 430);
});


test('13-column standard template maps prices, packing, quantities and volumes correctly', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['货号','条形码','品名','图片','供应商','计价单位','采购单价（元）','标准装箱数','整件数','散件数','总数量','货款合计（元）','总体积（m³）'],
    ['MF401','6903040084013','女士袜','','新疆','打',10,80,4,110,430,4300,.5],
    ['40S-1381','6982484013810','女士内裤','','恒伟','条',2.9,1200,2,0,2400,6960,.34],
    ['DATA_END'],
  ]), 'data');
  const rows = loadDataSheet(wb);
  assert.equal(rows[0].单价, 10);
  assert.equal(rows[0].散件数, 110);
  assert.equal(rows[0].总数量, 430);
  assert.equal(rows[0].总立方, .5);
  assert.equal(rows[1].供应商, '恒伟');
  assert.equal(rows[1].计价单位, '条');
  assert.equal(rows[1].装箱数, 1200);
  assert.deepEqual(normalizePricingUnits(rows), rows);
});
