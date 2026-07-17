import { existsSync, mkdirSync } from 'fs';
import { basename, extname, join } from 'path';
import * as XLSX from './xlsx.js';
import { PATHS } from './config.js';
import {
  resolveContainerConfig,
  type ContainerConfig,
  type RateFetch,
} from './business-rules.js';
import {
  queryProductsByNumber,
  type K2046Dependencies,
  type K2046Product,
  type ProductQueryResult,
} from './k2046.js';

export const REQUIRED_SHEETS = ['data', 'config'] as const;
export const REQUIRED_DATA_COLUMNS = [
  '货号', '品名', '条形码', '单价', '装箱数', '件数', '总数量', '总立方', '供应商',
] as const;
export const REQUIRED_CONFIG_PARAMS = ['海运费', '货柜号'] as const;
export const OPTIONAL_CONFIG_PARAMS = [
  '内陆费', '内陆费承担方', '卸柜费', 'USD-CLP', 'USD-CNY', 'CNY-CLP',
  '清关杂费', 'IVA',
] as const;

export type PricingUnit = '双' | '打';

export interface ContainerDataRow {
  货号: string;
  品名: string;
  条形码: string;
  单价: number;
  装箱数: number;
  件数: number;
  总数量: number;
  总立方: number | null;
  立方?: number;
  供应商: string;
  计价单位?: PricingUnit;
}

export interface CostCalculationResult {
  货号: string;
  条形码: string;
  产品名1: string;
  产品名2: string;
  供应商: string;
  成本价: number;
  boxPrice?: number;
  bigBagPrice?: number;
  bagPrice?: number;
  unitPrice?: number;
  装箱数: number;
  packingBigBag?: number;
  packingBag?: number;
  件数: number;
  散件数?: number;
  仓库: string;
  category1?: string;
  category2?: string;
}

export interface CalculationDependencies {
  rateFetch?: RateFetch;
  productQuery?: (productNumbers: string[]) => Promise<ProductQueryResult>;
  k2046?: K2046Dependencies;
  outputDirectory?: string;
}

export function validateSheetNames(workbook: XLSX.WorkBook): void {
  const missing = REQUIRED_SHEETS.filter(sheet => !workbook.SheetNames.includes(sheet));
  const unexpected = workbook.SheetNames.filter(
    sheet => !REQUIRED_SHEETS.includes(sheet as typeof REQUIRED_SHEETS[number]),
  );
  if (missing.length || unexpected.length) {
    throw new Error(
      `Excel sheet 不符合模板。缺少：[${missing.join(', ')}]；多余：[${unexpected.join(', ')}]`,
    );
  }
}

export function validateDataColumns(worksheet: XLSX.WorkSheet): void {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
  const headers = (rows[0] ?? []).map(value => String(value ?? '').trim());
  const missing = REQUIRED_DATA_COLUMNS.filter(column => !headers.includes(column));
  if (missing.length) throw new Error(`data sheet 缺少列：${missing.join(', ')}`);
}

export function loadExcelFile(filePath: string): XLSX.WorkBook {
  if (!existsSync(filePath)) throw new Error(`Excel 文件不存在：${filePath}`);
  const workbook = XLSX.readFile(filePath, { cellFormula: false, cellDates: true });
  validateSheetNames(workbook);
  return workbook;
}

export function readRawConfig(workbook: XLSX.WorkBook): Record<string, unknown> {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.config, { header: 1 }) as unknown[][];
  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    if (row.length >= 2 && String(row[0] ?? '').trim() && row[1] !== '') {
      raw[String(row[0]).trim()] = row[1];
    }
  }
  return raw;
}

export async function loadConfigSheet(
  workbook: XLSX.WorkBook,
  rateFetch?: RateFetch,
): Promise<ContainerConfig> {
  return resolveContainerConfig(readRawConfig(workbook), rateFetch);
}

function asText(value: unknown): string {
  let text = String(value ?? '').trim();
  if (text.endsWith('.0')) text = text.slice(0, -2);
  if (text.startsWith("'")) text = text.slice(1);
  return text;
}

function asNumber(value: unknown, column: string, row: number, nullable = false): number | null {
  if (nullable && (value === undefined || value === null || value === '')) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`data sheet 第 ${row} 行「${column}」必须是数字，收到：${String(value)}`);
  }
  return parsed;
}

function asPricingUnit(value: unknown, row: number): PricingUnit | undefined {
  const unit = asText(value);
  if (!unit) return undefined;
  if (unit === '双' || unit === '打') return unit;
  throw new Error(`data sheet 第 ${row} 行「计价单位」只支持 双 或 打，收到：${unit}`);
}

export function loadDataSheet(workbook: XLSX.WorkBook): ContainerDataRow[] {
  const sheet = workbook.Sheets.data;
  validateDataColumns(sheet);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  const headers = (rows[0] ?? []).map(value => String(value ?? '').trim());
  const result: ContainerDataRow[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (row[0] === 'DATA_END') break;
    if (row.every(value => value === undefined || value === null || value === '')) continue;
    const values: Record<string, unknown> = {};
    headers.forEach((header, column) => {
      values[header] = row[column];
    });
    const excelRow = index + 1;
    const productNumber = asText(values.货号);
    if (!productNumber) throw new Error(`data sheet 第 ${excelRow} 行缺少货号`);

    result.push({
      货号: productNumber,
      品名: asText(values.品名),
      条形码: asText(values.条形码),
      单价: asNumber(values.单价, '单价', excelRow) as number,
      装箱数: asNumber(values.装箱数, '装箱数', excelRow) as number,
      件数: asNumber(values.件数, '件数', excelRow) as number,
      总数量: asNumber(values.总数量, '总数量', excelRow) as number,
      总立方: asNumber(values.总立方, '总立方', excelRow, true),
      供应商: asText(values.供应商),
      计价单位: asPricingUnit(values.计价单位, excelRow),
    });
  }
  if (!result.length) throw new Error('data sheet 没有可计算的数据行');
  return result;
}

function requireDozenDivisible(value: number, column: '装箱数' | '总数量', sku: string): void {
  if (!Number.isInteger(value) || value % 12 !== 0) {
    throw new Error(
      `货号 ${sku} 按“双”输入时，「${column}」必须是能被 12 整除的整数，收到：${value}`,
    );
  }
}

/**
 * 袜子的成本与 K2046 销售单位统一为「打」（1 打 = 12 双）。
 *
 * 原始材料按「双」输入时，在任何成本聚合之前转换单价、装箱数和总数量，并将
 * 计价单位改为「打」。因此再次调用本函数不会重复换算。旧模板没有计价单位时
 * 保持原值，避免猜测非袜子商品的单位。
 */
export function normalizePricingUnits(dataRows: ContainerDataRow[]): ContainerDataRow[] {
  return dataRows.map(row => {
    if (row.计价单位 !== '双') return { ...row };
    requireDozenDivisible(row.装箱数, '装箱数', row.货号);
    requireDozenDivisible(row.总数量, '总数量', row.货号);
    return {
      ...row,
      单价: Number((row.单价 * 12).toFixed(10)),
      装箱数: row.装箱数 / 12,
      总数量: row.总数量 / 12,
      计价单位: '打',
    };
  });
}

export function calculateMissingVolumes(dataRows: ContainerDataRow[]): ContainerDataRow[] {
  const containerTotalVolume = 68;
  const totalKnownVolume = dataRows.reduce((sum, row) => sum + (row.总立方 || 0), 0);

  if (totalKnownVolume > containerTotalVolume) {
    const scalingFactor = containerTotalVolume / totalKnownVolume;
    return dataRows.map(row => {
      const totalVolume = (row.总立方 || 0) * scalingFactor;
      return {
        ...row,
        总立方: totalVolume,
        立方: row.件数 > 0 ? totalVolume / row.件数 : 0,
      };
    });
  }

  const missing = dataRows.filter(row => !row.总立方);
  const pieces = missing.reduce((sum, row) => sum + row.件数, 0);
  if (pieces === 0) return dataRows;
  const remaining = containerTotalVolume - totalKnownVolume;
  if (remaining < 0.01) {
    return dataRows.map(row => !row.总立方 ? { ...row, 总立方: 0, 立方: 0 } : row);
  }
  const volumePerPiece = remaining / pieces;
  return dataRows.map(row => !row.总立方
    ? { ...row, 总立方: volumePerPiece * row.件数, 立方: volumePerPiece }
    : row);
}

function mergeLooseRows(
  results: CostCalculationResult[],
  sourceRows: ContainerDataRow[],
): CostCalculationResult[] {
  const indexesBySku = new Map<string, number[]>();
  sourceRows.forEach((row, index) => {
    indexesBySku.set(row.货号, [...(indexesBySku.get(row.货号) ?? []), index]);
  });
  const keep = Array(results.length).fill(true);

  for (const indexes of indexesBySku.values()) {
    if (indexes.length < 2) continue;
    const frequency = new Map<number, number>();
    for (const index of indexes) {
      const row = sourceRows[index];
      if (row.件数 > 1 && row.装箱数 > 0) {
        frequency.set(row.装箱数, (frequency.get(row.装箱数) ?? 0) + 1);
      }
    }
    if (!frequency.size) continue;
    const standardPacking = [...frequency.entries()]
      .sort((left, right) => right[1] - left[1])[0][0];
    const mainIndex = indexes.find(
      index => sourceRows[index].件数 > 1 && sourceRows[index].装箱数 === standardPacking,
    ) ?? indexes.slice().sort((left, right) => sourceRows[right].件数 - sourceRows[left].件数)[0];
    const looseIndexes = indexes.filter(
      index => sourceRows[index].件数 === 1 && sourceRows[index].装箱数 !== standardPacking,
    );
    if (!looseIndexes.length) continue;
    results[mainIndex].散件数 = looseIndexes.reduce(
      (sum, index) => sum + sourceRows[index].总数量,
      results[mainIndex].散件数 ?? 0,
    );
    for (const index of looseIndexes) keep[index] = false;
  }
  return results.filter((_, index) => keep[index]).map(row => ({ ...row, 散件数: row.散件数 ?? 0 }));
}

export async function calculateCosts(
  dataRows: ContainerDataRow[],
  params: ContainerConfig,
  productQuery: (productNumbers: string[]) => Promise<ProductQueryResult>,
): Promise<CostCalculationResult[]> {
  const normalizedRows = normalizePricingUnits(dataRows);
  const productQueryResult = await productQuery([...new Set(normalizedRows.map(row => row.货号))]);
  for (const warning of productQueryResult.errors) console.warn(`⚠️  ${warning}`);
  const dataWithVolumes = calculateMissingVolumes(normalizedRows);
  const seaTotal = params.海运费 * params['USD-CLP']
    + params.内陆费 * params['CNY-CLP']
    + params.卸柜费;
  const sumVolume = dataWithVolumes.reduce((sum, row) => sum + (row.总立方 || 0), 0);
  const rowAmounts = dataWithVolumes.map(
    row => row.单价 * row.总数量 * params['CNY-CLP'],
  );
  const sumAmount = rowAmounts.reduce((sum, amount) => sum + amount, 0);
  const totalGoodsValueCny = dataWithVolumes.reduce(
    (sum, row) => sum + row.单价 * row.总数量,
    0,
  );

  let iva = params.IVA;
  if (iva === 0) {
    const goodsPart = (totalGoodsValueCny / params['USD-CNY'])
      * params['USD-CLP'] * 0.3 * 0.19;
    const shippingPart = params.海运费 * params['USD-CLP'] * 0.19;
    iva = goodsPart + shippingPart;
  }

  const results = dataWithVolumes.map((row, index) => {
    const product: K2046Product | undefined = productQueryResult.products.get(row.货号);
    const volume = row.总立方 || 0;
    const seaCost = sumVolume > 0 ? seaTotal * volume / sumVolume : 0;
    const miscCost = sumVolume > 0 ? params.清关杂费 * volume / sumVolume : 0;
    const taxCost = sumAmount > 0 ? iva * rowAmounts[index] / sumAmount : 0;
    const overheadPerPiece = row.总数量 > 0
      ? (seaCost + miscCost + taxCost) / row.总数量
      : 0;
    return {
      货号: row.货号,
      条形码: row.条形码,
      产品名1: product?.title1 || `${row.货号}; ${row.品名}`,
      产品名2: product?.title2 || '',
      供应商: row.供应商.trim() || product?.supplier?.name?.trim() || '',
      成本价: Math.round(overheadPerPiece + row.单价 * params['CNY-CLP']),
      boxPrice: product?.boxPrice,
      bigBagPrice: product?.bigBagPrice,
      bagPrice: product?.bagPrice,
      unitPrice: product?.unitPrice,
      装箱数: row.装箱数 || product?.packingBox || 0,
      packingBigBag: product?.packingBigBag,
      packingBag: product?.packingBag,
      件数: row.件数,
      仓库: 'lazon',
      category1: product?.categoryParentName,
      category2: product?.categoryName,
    };
  });
  return mergeLooseRows(results, dataWithVolumes);
}

export function generateOutput(
  results: CostCalculationResult[],
  inputFileName: string,
  outputDirectory = PATHS.generated,
): string {
  const headers = [
    '货号', '条形码', '产品名1', '产品名2', '供应商', '成本价',
    '箱价格', '大包价格', '包价格', '单价',
    '装箱数', '大包装数', '包装数',
    '件数', '散件数', '仓库', '分类1', '分类2',
  ];
  const keys: Record<string, keyof CostCalculationResult> = {
    货号: '货号', 条形码: '条形码', 产品名1: '产品名1', 产品名2: '产品名2',
    供应商: '供应商', 成本价: '成本价', 箱价格: 'boxPrice',
    大包价格: 'bigBagPrice', 包价格: 'bagPrice', 单价: 'unitPrice',
    装箱数: '装箱数', 大包装数: 'packingBigBag', 包装数: 'packingBag',
    件数: '件数', 散件数: '散件数', 仓库: '仓库',
    分类1: 'category1', 分类2: 'category2',
  };
  const outputRows = [
    headers,
    ...results.map(row => headers.map(header => {
      const value = row[keys[header]];
      return value === undefined || value === null ? '' : value;
    })),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(outputRows), '成本计算结果');
  mkdirSync(outputDirectory, { recursive: true });
  const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '_');
  const baseName = basename(inputFileName, extname(inputFileName));
  const outputPath = join(outputDirectory, `成本计算_${baseName}_${timestamp}.xlsx`);
  XLSX.writeFile(workbook, outputPath);
  return outputPath;
}

export async function calculateContainerFile(
  inputFile: string,
  dependencies: CalculationDependencies = {},
): Promise<string> {
  const workbook = loadExcelFile(inputFile);
  const config = await loadConfigSheet(workbook, dependencies.rateFetch);
  const data = loadDataSheet(workbook);
  const productQuery = dependencies.productQuery
    ?? ((productNumbers: string[]) => queryProductsByNumber(productNumbers, dependencies.k2046));
  const results = await calculateCosts(data, config, productQuery);
  return generateOutput(results, inputFile, dependencies.outputDirectory);
}

async function main(): Promise<void> {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('用法：npm run calculate <容器.xlsx>');
    process.exitCode = 1;
    return;
  }
  try {
    const output = await calculateContainerFile(inputFile);
    console.log(`✅ 成本文件已生成：${output}`);
  } catch (error) {
    console.error(`❌ 成本计算失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
