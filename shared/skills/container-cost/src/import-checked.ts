/** Mandatory price/category gate for the exact workbook passed to the importer. */
import { readFile, utils } from './xlsx.js';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function checkImport(file: string): string[] {
  const book = readFile(file);
  if (book.SheetNames.length !== 1) return ['只允许导入单独导出的成本工作表，不能导入含data/config的整个工作簿'];
  const sheet = book.Sheets['成本计算结果'];
  if (!sheet) return ['缺少「成本计算结果」工作表'];
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const headers = rows[0]?.map(String) ?? [];
  const contract = ['货号', '条形码', '产品名1', '产品名2', '供应商', '成本价', '箱价格', '大包价格', '包价格', '单价', '装箱数', '大包装数', '包装数', '件数', '散件数', '仓库', '分类1', '分类2'];
  if (headers.join('|') !== contract.join('|')) return ['成本表须为标准18列，禁止按错误映射导入'];
  const prices = ['成本价', '箱价格', '大包价格', '包价格', '单价'];
  const required = ['货号', ...prices, '分类1', '分类2'];
  const errors = required.filter(h => headers.filter(v => v === h).length !== 1)
    .map(h => `表头缺失或重复：${h}`);
  if (errors.length) return errors;
  let count = 0;
  rows.slice(1).forEach((row, i) => {
    if (row.every(v => v === '' || v == null)) return;
    count++;
    const sku = row[headers.indexOf('货号')];
    if (!sku) errors.push(`第${i + 2}行：缺货号`);
    for (const name of prices) {
      const value = row[headers.indexOf(name)];
      if ((typeof value !== 'number' && typeof value !== 'string') ||
          String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) <= 0) {
        errors.push(`第${i + 2}行 ${sku} ${name}：必须为大于0的数值`);
      }
    }
    for (const name of ['分类1', '分类2']) {
      if (!String(row[headers.indexOf(name)] ?? '').trim()) errors.push(`第${i + 2}行 ${sku} ${name}：缺失`);
    }
  });
  if (!count) errors.push('没有商品明细');
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, ...args] = process.argv.slice(2);
  if (!file) throw new Error('用法：npm run import:checked -- <成本.xlsx> [--check-only | K2046导入参数]');
  const errors = checkImport(file);
  if (errors.length) {
    console.error(`阻断导入：${errors.length}项\n${errors.join('\n')}`);
    process.exitCode = 1;
  } else if (args.includes('--check-only')) {
    console.log('PASS：全部成本、售价大于0，分类齐全');
  } else {
    const mapping = 'productNumber,barCode1,title1,title2,supplier,costPrice,boxPrice,bigBagPrice,bagPrice,unitPrice,packingBox,packingBigBag,packingBag,boxNumber,unitNumber,warehouse,category1,category2';
    const result = spawnSync('k2046', ['purchase', 'import-container', file, ...args, '--import-format', mapping], { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
}
