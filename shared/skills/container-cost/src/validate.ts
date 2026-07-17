import { existsSync } from 'fs';
import { basename } from 'path';
import * as XLSX from './xlsx.js';
import {
  queryProductsByNumber,
  querySuppliers,
  type K2046Product,
  type ProductQueryResult,
  type SupplierInfo,
} from './k2046.js';

export type ValidationIssueType =
  | 'barcode_format'
  | 'missing_barcode'
  | 'product_not_found'
  | 'missing_category'
  | 'invalid_supplier'
  | 'file'
  | 'format';

export interface ValidationError {
  type: ValidationIssueType;
  row?: number;
  barcode?: string;
  productNumber?: string;
  supplier?: string;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  validSuppliers?: string[];
  summary: {
    total_rows: number;
    format_errors: number;
    not_found: number;
    missing_barcode: number;
    missing_category: number;
    invalid_supplier: number;
    warnings: number;
  };
}

export interface ValidationDependencies {
  productQuery?: (productNumbers: string[]) => Promise<ProductQueryResult>;
  supplierQuery?: () => Promise<SupplierInfo[]>;
}

interface ParsedRow {
  row: number;
  productNumber: string;
  barcode: string;
  category1?: string;
  category2?: string;
  supplier?: string;
}

function emptySummary(): ValidationResult['summary'] {
  return {
    total_rows: 0,
    format_errors: 0,
    not_found: 0,
    missing_barcode: 0,
    missing_category: 0,
    invalid_supplier: 0,
    warnings: 0,
  };
}

export function validateEan13(barcode: string): { valid: boolean; error?: string } {
  if (!barcode) return { valid: false, error: '条形码为空' };
  const cleaned = barcode.trim();
  if (cleaned.length !== 13) {
    return { valid: false, error: `长度应为13位，实际${cleaned.length}位` };
  }
  if (!/^\d+$/.test(cleaned)) return { valid: false, error: '包含非数字字符' };
  const digits = cleaned.split('').map(Number);
  const checksum = digits.slice(0, 12)
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);
  const expected = (10 - checksum % 10) % 10;
  return digits[12] === expected
    ? { valid: true }
    : { valid: false, error: `校验位错误，应为${expected}` };
}

function cleanText(value: unknown): string {
  let text = String(value ?? '').trim();
  if (text.endsWith('.0')) text = text.slice(0, -2);
  if (text.startsWith("'")) text = text.slice(1);
  return text;
}

function fileFailure(type: 'file' | 'format', message: string): ValidationResult {
  return {
    passed: false,
    errors: [{ type, message }],
    warnings: [],
    summary: emptySummary(),
  };
}

function parseRows(workbook: XLSX.WorkBook): ParsedRow[] {
  let sheet = workbook.Sheets.data || workbook.Sheets['成本计算结果'];
  if (!sheet && workbook.SheetNames.length) sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('找不到有效的数据 sheet');
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  if (raw.length <= 1) throw new Error('数据为空');
  const headers = raw[0].map(value => String(value ?? '').trim());
  const indexes = {
    barcode: headers.indexOf('条形码'),
    productNumber: headers.indexOf('货号'),
    category1: headers.indexOf('分类1'),
    category2: headers.indexOf('分类2'),
    supplier: headers.indexOf('供应商'),
  };
  if (indexes.barcode < 0) throw new Error("缺少 '条形码' 列");
  if (indexes.productNumber < 0) throw new Error("缺少 '货号' 列");

  const rows: ParsedRow[] = [];
  for (let index = 1; index < raw.length; index += 1) {
    const row = raw[index] ?? [];
    if (row[0] === 'DATA_END') break;
    if (row.every(value => value === undefined || value === null || value === '')) continue;
    const productNumber = cleanText(row[indexes.productNumber]);
    const barcode = cleanText(row[indexes.barcode]);
    if (!productNumber && !barcode) continue;
    rows.push({
      row: index + 1,
      productNumber,
      barcode,
      category1: indexes.category1 >= 0 ? cleanText(row[indexes.category1]) : undefined,
      category2: indexes.category2 >= 0 ? cleanText(row[indexes.category2]) : undefined,
      supplier: indexes.supplier >= 0 ? cleanText(row[indexes.supplier]) : undefined,
    });
  }
  return rows;
}

function noPrimaryBarcodeWarning(row: ParsedRow, info: K2046Product): ValidationError {
  return {
    type: 'missing_barcode',
    row: row.row,
    barcode: '',
    productNumber: row.productNumber,
    message:
      `K2046 已有产品 ${info.productNumber} 没有主条形码；保留空白并人工确认，`
      + '不要把组合内多个组件条码拼接或任选一个当作该货号的 EAN-13',
  };
}

export async function validateContainer(
  excelPath: string,
  dependencies: ValidationDependencies = {},
): Promise<ValidationResult> {
  if (!existsSync(excelPath)) return fileFailure('file', `文件不存在: ${excelPath}`);
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(excelPath);
  } catch (error) {
    return fileFailure('file', `读取 Excel 失败: ${String(error)}`);
  }

  let rows: ParsedRow[];
  try {
    rows = parseRows(workbook);
  } catch (error) {
    return fileFailure('format', error instanceof Error ? error.message : String(error));
  }

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const productQuery = dependencies.productQuery ?? queryProductsByNumber;
  const supplierQuery = dependencies.supplierQuery ?? querySuppliers;
  const productNumbers = [...new Set(rows.map(row => row.productNumber).filter(Boolean))];
  const productResult = await productQuery(productNumbers);
  for (const queryError of productResult.errors) {
    warnings.push({ type: 'format', message: queryError });
  }

  for (const row of rows) {
    const info = productResult.products.get(row.productNumber);
    const checked = productResult.checkedProductNumbers.has(row.productNumber);

    if (!row.productNumber) {
      errors.push({
        type: 'product_not_found',
        row: row.row,
        barcode: row.barcode,
        message: '货号为空，无法查询 K2046',
      });
    } else if (checked && !info) {
      errors.push({
        type: 'product_not_found',
        row: row.row,
        barcode: row.barcode,
        productNumber: row.productNumber,
        message: `货号 ${row.productNumber} 不存在于 K2046`,
      });
    }

    if (!row.barcode) {
      if (info && !cleanText(info.barCode1)) {
        warnings.push(noPrimaryBarcodeWarning(row, info));
      } else {
        errors.push({
          type: 'barcode_format',
          row: row.row,
          barcode: '',
          productNumber: row.productNumber,
          message: info?.barCode1
            ? `条形码为空；K2046 主条形码为 ${cleanText(info.barCode1)}`
            : '条形码为空，且无法确认这是 K2046 中无主条形码的既有产品',
        });
      }
    } else {
      const barcodeResult = validateEan13(row.barcode);
      if (!barcodeResult.valid) {
        errors.push({
          type: 'barcode_format',
          row: row.row,
          barcode: row.barcode,
          productNumber: row.productNumber,
          message: barcodeResult.error || '条形码无效',
        });
      }
    }

    const hasExcelCategory = Boolean(row.category1 && row.category2);
    if (!hasExcelCategory && (!info || !info.category?.id || !info.category?.name)) {
      warnings.push({
        type: 'missing_category',
        row: row.row,
        barcode: row.barcode,
        productNumber: row.productNumber,
        message: info ? `产品 ${row.productNumber} 系统中缺少分类` : '产品缺少分类',
      });
    }
  }

  const suppliers = await supplierQuery();
  const validSupplierNames = suppliers.map(supplier => supplier.name);
  if (validSupplierNames.length) {
    const valid = new Set(validSupplierNames);
    for (const supplier of [...new Set(rows.map(row => row.supplier).filter(Boolean))]) {
      if (!valid.has(supplier!)) {
        warnings.push({
          type: 'invalid_supplier',
          row: rows.find(row => row.supplier === supplier)?.row,
          supplier,
          message: `供应商 "${supplier}" 不在 K2046 中`,
        });
      }
    }
  }

  const summary = {
    total_rows: rows.length,
    format_errors: errors.filter(error => error.type === 'barcode_format').length,
    not_found: errors.filter(error => error.type === 'product_not_found').length,
    missing_barcode: warnings.filter(warning => warning.type === 'missing_barcode').length,
    missing_category: warnings.filter(warning => warning.type === 'missing_category').length,
    invalid_supplier: warnings.filter(warning => warning.type === 'invalid_supplier').length,
    warnings: warnings.length,
  };
  return {
    passed: errors.length === 0,
    errors,
    warnings,
    validSuppliers: validSupplierNames,
    summary,
  };
}

export function formatReport(result: ValidationResult, containerId: string): string {
  const lines = [
    `📋 容器验证报告：${containerId}`,
    '',
    result.passed ? '✅ 验证通过' : '❌ 验证失败',
  ];
  for (const issue of result.errors) {
    lines.push(`   第 ${issue.row ?? '-'} 行: ${issue.productNumber ?? issue.barcode ?? ''} - ${issue.message}`);
  }
  if (result.warnings.length) {
    lines.push('', '⚠️  警告：');
    for (const warning of result.warnings.slice(0, 20)) {
      lines.push(`   第 ${warning.row ?? '-'} 行: ${warning.productNumber ?? warning.supplier ?? ''} - ${warning.message}`);
    }
    if (result.warnings.length > 20) lines.push(`   ... 还有 ${result.warnings.length - 20} 个警告`);
  }
  lines.push(
    '',
    `📊 汇总：${result.summary.total_rows} 行，`
      + `${result.summary.format_errors} 个条码错误，`
      + `${result.summary.not_found} 个系统未找到，`
      + `${result.summary.missing_barcode} 个系统无主条码例外，`
      + `${result.summary.missing_category} 个缺少分类，`
      + `${result.summary.invalid_supplier} 个供应商不匹配`,
  );
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const excelPath = process.argv[2];
  if (!excelPath) {
    console.error('用法: npm run validate <excel_path>');
    process.exitCode = 1;
  } else {
    validateContainer(excelPath).then(result => {
      console.log(formatReport(result, basename(excelPath, '.xlsx').split(')').pop() || ''));
      process.exitCode = result.passed ? 0 : 1;
    });
  }
}
