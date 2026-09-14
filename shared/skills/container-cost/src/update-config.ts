import * as XLSX from './xlsx.js';
import {
  DEFAULT_CNY_CLP,
  DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP,
  DEFAULT_SELF_PAID_INLAND_FEE_CNY,
  DEFAULT_UNLOADING_FEE_CLP,
  fetchUsdClp,
  fetchBocUsdCny,
  normalizeInlandPayer,
} from './business-rules.js';
import { readRawConfig } from './calculate.js';

interface CliOptions {
  file: string;
  values: Record<string, unknown>;
}

function parseArgs(args: string[]): CliOptions {
  const file = args.find(arg => !arg.startsWith('--'));
  if (!file) throw new Error('缺少 Excel 文件路径');
  const values: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    '--inland-payer': '内陆费承担方',
    '--inland-fee': '内陆费',
    '--unloading-fee': '卸柜费',
    '--clearance-misc-fee': '清关杂费',
    '--cny-clp': 'CNY-CLP',
    '--usd-clp': 'USD-CLP',
    '--usd-cny': 'USD-CNY',
    '--iva': 'IVA',
  };
  for (let index = 0; index < args.length; index += 1) {
    const key = mapping[args[index]];
    if (!key) continue;
    const value = args[index + 1];
    if (value === undefined) throw new Error(`${args[index]} 缺少值`);
    values[key] = key === '内陆费承担方' ? value : Number(value);
    index += 1;
  }
  return { file, values };
}

export async function prepareConfigValues(
  current: Record<string, unknown>,
  explicit: Record<string, unknown> = {},
  rateFetch: () => Promise<number> = fetchUsdClp,
  usdCnyFetch: () => Promise<number> = fetchBocUsdCny,
): Promise<Record<string, unknown>> {
  const result = { ...current, ...explicit };
  result['卸柜费'] ??= DEFAULT_UNLOADING_FEE_CLP;
  if (result['清关杂费'] === undefined || result['清关杂费'] === null
    || String(result['清关杂费']).trim() === '') {
    result['清关杂费'] = DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP;
  }
  result['CNY-CLP'] ??= DEFAULT_CNY_CLP;
  result.IVA ??= 0;

  if (result['内陆费'] === undefined || result['内陆费'] === '') {
    const payer = normalizeInlandPayer(result['内陆费承担方']);
    if (payer === 'factory') result['内陆费'] = 0;
    if (payer === 'self') result['内陆费'] = DEFAULT_SELF_PAID_INLAND_FEE_CNY;
  }

  if (result['USD-CLP'] === undefined || result['USD-CLP'] === '') {
    result['USD-CLP'] = await rateFetch();
  }
  if (result['USD-CNY'] === undefined || result['USD-CNY'] === null || result['USD-CNY'] === '') {
    result['USD-CNY'] = await usdCnyFetch();
  }
  return result;
}

export function writeConfigSheet(
  workbook: XLSX.WorkBook,
  values: Record<string, unknown>,
): void {
  const sheet = workbook.Sheets.config;
  if (!sheet) throw new Error('找不到 config sheet');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  const indexByKey = new Map<string, number>();
  rows.forEach((row, index) => indexByKey.set(String(row[0] ?? '').trim(), index));
  for (const [key, value] of Object.entries(values)) {
    const index = indexByKey.get(key);
    if (index === undefined) {
      rows.push([key, value]);
    } else {
      rows[index][1] = value;
    }
  }
  workbook.Sheets.config = XLSX.utils.aoa_to_sheet(rows);
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const workbook = XLSX.readFile(options.file, { cellFormula: false, cellDates: true });
    if (!workbook.Sheets.config) throw new Error('找不到 config sheet');
    const current = readRawConfig(workbook);
    const prepared = await prepareConfigValues(current, options.values);
    writeConfigSheet(workbook, prepared);
    XLSX.writeFile(workbook, options.file);
    console.log(`✅ config 已补全：${options.file}`);
    if (prepared['内陆费'] === undefined || prepared['内陆费'] === '') {
      console.warn('⚠️  内陆费仍缺失：请填写金额，或使用 --inland-payer factory|self');
    }
    for (const required of ['海运费', '货柜号']) {
      if (prepared[required] === undefined || prepared[required] === '') {
        console.warn(`⚠️  必填真实数据仍缺失：${required}`);
      }
    }
  } catch (error) {
    console.error(`❌ config 补全失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
