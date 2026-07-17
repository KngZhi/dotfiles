/**
 * Container Cost - 上传到 K2046
 *
 * 流程：
 * 1. 验证数据完备性（分类必须填写）
 * 2. 上传 Excel 到 /be/api/resource/temp
 * 3. 调用 /be/api/product/excel 解析导入
 */
import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';
import * as XLSX from './xlsx.js';
import { getApiConfig } from './config.js';

const API = getApiConfig();

export interface DataValidationError {
  row: number;
  productNumber: string;
  message: string;
}

export interface DataValidationResult {
  valid: boolean;
  errors: DataValidationError[];
}

/**
 * 验证数据完备性（上传前检查）
 */
export function validateDataCompleteness(filePath: string): DataValidationResult {
  const errors: DataValidationError[] = [];

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    if (data.length <= 1) {
      return { valid: false, errors: [{ row: 0, productNumber: '', message: '数据为空' }] };
    }

    const headers = (data[0] as string[]).map(h => String(h ?? '').trim());
    const productNumberCol = headers.indexOf('货号');
    const category1Col = headers.indexOf('分类1');
    const category2Col = headers.indexOf('分类2');

    if (category1Col === -1 || category2Col === -1) {
      return { valid: false, errors: [{ row: 0, productNumber: '', message: '缺少分类1或分类2列' }] };
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as unknown[];
      if (!row || row.length === 0) continue;
      if (row[0] === 'DATA_END') break;

      const productNumber = String(row[productNumberCol] ?? '').trim();
      const category1 = String(row[category1Col] ?? '').trim();
      const category2 = String(row[category2Col] ?? '').trim();

      if (!category1 || !category2) {
        errors.push({
          row: i + 1,
          productNumber,
          message: !category1 && !category2 ? '缺少分类1和分类2' : !category1 ? '缺少分类1' : '缺少分类2',
        });
      }
    }
  } catch (e) {
    return { valid: false, errors: [{ row: 0, productNumber: '', message: `读取文件失败: ${e}` }] };
  }

  return { valid: errors.length === 0, errors };
}

export interface UploadResult {
  success: boolean;
  fileName?: string;
  error?: string;
}

export interface ParsedProduct {
  productNumber: string;
  barCode1: string;
  title1: string;
  title2?: string;
  costPrice: string;
  oldCostPrice?: string;
  boxPrice?: string;
  bigBagPrice?: string;
  bagPrice?: string;
  unitPrice?: string;
  packingBox?: string;
  packingBigBag?: string;
  packingBag?: string;
  boxNumber?: string;
  warehouse?: string;
  supplier?: string;
  category1?: string;
  category2?: string;
  newProduct: boolean;
  error: string;
}

export interface ParseResult {
  success: boolean;
  data?: {
    total: number;
    updated: number;
    created: number;
    errors: string[];
  };
  products?: ParsedProduct[];
  error?: string;
}

/**
 * 上传文件到 K2046 临时存储
 */
export async function uploadFile(filePath: string): Promise<UploadResult> {
  if (!existsSync(filePath)) {
    return { success: false, error: `文件不存在: ${filePath}` };
  }

  if (!API.baseUrl || !API.authToken) {
    return { success: false, error: 'API 配置缺失' };
  }

  try {
    const fileBuffer = readFileSync(filePath);
    const fileName = basename(filePath);

    // 创建 FormData
    const formData = new FormData();
    const blob = new Blob([fileBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    formData.append('file', blob, fileName);

    const response = await fetch(`${API.baseUrl}/be/api/resource/temp`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': API.authToken,
        'Cookie': API.cookie,
      },
      body: formData,
    });

    if (!response.ok) {
      return { success: false, error: `上传失败: ${response.status} ${response.statusText}` };
    }

    const data = await response.json() as { data?: { fileName?: string } };
    const uploadedFileName = data.data?.fileName;

    if (!uploadedFileName) {
      return { success: false, error: '上传响应中缺少文件名' };
    }

    return { success: true, fileName: uploadedFileName };
  } catch (error) {
    return { success: false, error: `上传异常: ${error}` };
  }
}

/**
 * 成本计算 Excel 的导入格式映射
 *
 * 成本计算输出的列顺序：
 * 货号, 条形码, 产品名1, 供应商, 成本价, 箱价格, 大包价格, 包价格, 单价, 装箱数, 大包装数, 包装数, 件数, 仓库
 *
 * K2046 支持的所有字段：
 * productNumber, barCode1, title1, supplier, costPrice, boxPrice, bigBagPrice,
 * bagPrice, unitPrice, packingBox, packingBigBag, packingBag, boxNumber, warehouse,
 * category1, category2
 *
 * 使用空字符串跳过 Excel 中不存在的列
 */
const IMPORT_FORMAT = [
  'productNumber',  // A: 货号
  'barCode1',       // B: 条形码
  'title1',         // C: 产品名1
  'title2',         // D: 产品名2 (西语)
  'supplier',       // E: 供应商
  'costPrice',      // F: 成本价
  'boxPrice',       // G: 箱价格
  'bigBagPrice',    // H: 大包价格
  'bagPrice',       // I: 包价格
  'unitPrice',      // J: 单价
  'packingBox',     // K: 装箱数
  'packingBigBag',  // L: 大包装数
  'packingBag',     // M: 包装数
  'boxNumber',      // N: 件数
  'warehouse',      // O: 仓库
  'category1',      // P: 分类1
  'category2',      // Q: 分类2
].join(',');

interface ParseResponse {
  totalPage: number;
  totalRow: number;
  page: number;
  newProduct: number;
  list: ParsedProduct[];
}

/**
 * 调用 K2046 Excel 解析（单页）
 */
async function parseExcelPage(fileName: string, page: number, options: {
  startRow?: number;
  supplierId?: string;
} = {}): Promise<{ success: boolean; data?: ParseResponse; error?: string }> {
  const response = await fetch(`${API.baseUrl}/be/api/product/excel/parse`, {
    method: 'POST',
    headers: {
      'X-Auth-Token': API.authToken,
      'Cookie': API.cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      importFormat: IMPORT_FORMAT,
      page,
      row: options.startRow ?? 1,
      supplierId: options.supplierId ?? '',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: `解析失败: ${response.status} - ${text}` };
  }

  const json = await response.json() as { error?: { message?: string }; data?: ParseResponse };

  if (json.error?.message) {
    return { success: false, error: json.error.message };
  }

  return { success: true, data: json.data };
}

/**
 * 调用 K2046 Excel 解析导入（获取所有页）
 */
export async function parseExcel(fileName: string, options: {
  startRow?: number;
  supplierId?: string;
} = {}): Promise<ParseResult> {
  if (!API.baseUrl || !API.authToken) {
    return { success: false, error: 'API 配置缺失' };
  }

  try {
    // 获取第一页，得到总页数
    const firstPage = await parseExcelPage(fileName, 1, options);
    if (!firstPage.success || !firstPage.data) {
      return { success: false, error: firstPage.error };
    }

    const { totalPage, totalRow, newProduct } = firstPage.data;
    const allProducts: ParsedProduct[] = [...firstPage.data.list];

    console.log(`   总行数: ${totalRow}, 总页数: ${totalPage}, 新品: ${newProduct}`);

    // 获取剩余页
    for (let page = 2; page <= totalPage; page++) {
      process.stdout.write(`   获取第 ${page}/${totalPage} 页...\r`);
      const pageResult = await parseExcelPage(fileName, page, options);
      if (pageResult.success && pageResult.data?.list) {
        allProducts.push(...pageResult.data.list);
      }
    }
    if (totalPage > 1) console.log('');

    // 统计
    const newProducts = allProducts.filter(p => p.newProduct);
    const existingProducts = allProducts.filter(p => !p.newProduct);
    const withErrors = allProducts.filter(p => p.error);

    return {
      success: true,
      data: {
        total: totalRow,
        updated: existingProducts.length,
        created: newProducts.length,
        errors: withErrors.map(p => `${p.productNumber}: ${p.error}`),
      },
      products: allProducts,
    };
  } catch (error) {
    return { success: false, error: `解析异常: ${error}` };
  }
}

/**
 * 完整上传流程：验证 + 上传文件 + 解析导入
 */
export async function uploadAndImport(filePath: string, options: {
  startRow?: number;
  supplierId?: string;
  dryRun?: boolean;
  skipValidation?: boolean;
} = {}): Promise<{
  success: boolean;
  upload?: UploadResult;
  parse?: ParseResult;
  validation?: DataValidationResult;
  error?: string;
}> {
  console.log(`\n📤 上传文件: ${basename(filePath)}`);

  // Step 0: 验证数据完备性
  if (!options.skipValidation) {
    console.log('\n🔍 验证数据完备性...');
    const validation = validateDataCompleteness(filePath);
    if (!validation.valid) {
      console.log(`❌ 数据不完整，无法上传`);
      validation.errors.slice(0, 10).forEach(e => {
        console.log(`   第 ${e.row} 行: ${e.productNumber} - ${e.message}`);
      });
      if (validation.errors.length > 10) {
        console.log(`   ... 还有 ${validation.errors.length - 10} 个问题`);
      }
      return { success: false, validation, error: '数据不完整' };
    }
    console.log(`✓ 数据完整性验证通过`);
  }

  // Step 1: 上传文件
  const uploadResult = await uploadFile(filePath);
  if (!uploadResult.success) {
    console.log(`❌ 上传失败: ${uploadResult.error}`);
    return { success: false, upload: uploadResult, error: uploadResult.error };
  }

  console.log(`✓ 上传成功: ${uploadResult.fileName}`);

  if (options.dryRun) {
    console.log('🔍 Dry run 模式，跳过导入');
    return { success: true, upload: uploadResult };
  }

  // Step 2: 解析导入
  console.log('\n📥 解析导入...');
  const parseResult = await parseExcel(uploadResult.fileName!, {
    startRow: options.startRow,
    supplierId: options.supplierId,
  });

  if (!parseResult.success) {
    console.log(`❌ 解析失败: ${parseResult.error}`);
    return { success: false, upload: uploadResult, parse: parseResult, error: parseResult.error };
  }

  console.log(`✓ 解析完成:`);
  console.log(`   总数: ${parseResult.data!.total}`);
  console.log(`   更新: ${parseResult.data!.updated}`);
  console.log(`   新建: ${parseResult.data!.created}`);

  if (parseResult.data!.errors.length > 0) {
    console.log(`   错误: ${parseResult.data!.errors.length} 条`);
    parseResult.data!.errors.slice(0, 5).forEach(e => console.log(`     - ${e}`));
  }

  // Step 3: 导入产品 + 创建入库单
  console.log('\n📦 导入产品并创建入库单...');
  const imports = parseResult.products!.map(p => ({
    image: null,
    productNumber: p.productNumber,
    barCode1: p.barCode1,
    title1: p.title1 || '',
    title2: p.title2 || '',
    boxPrice: String(p.boxPrice ?? ''),
    bigBagPrice: String(p.bigBagPrice ?? ''),
    bagPrice: String(p.bagPrice ?? ''),
    unitPrice: String(p.unitPrice ?? ''),
    costPrice: String(p.costPrice ?? ''),
    packingBox: String(p.packingBox ?? ''),
    packingBigBag: String(p.packingBigBag ?? ''),
    packingBag: String(p.packingBag ?? ''),
    boxNumber: String(p.boxNumber ?? ''),
    warehouse: p.warehouse || 'lazon',
    supplier: p.supplier || '',
    category1: p.category1 || '',
    category2: p.category2 || '',
    imageId: 0,
    images: [],
    imageIds: [],
    error: '',
    newProduct: p.newProduct ?? true,
  }));

  const importParseResp = await fetch(`${API.baseUrl}/be/api/product/excel/import-parse`, {
    method: 'POST',
    headers: {
      'X-Auth-Token': API.authToken,
      'Cookie': API.cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      updateExisting: true,
      createOrder: true,
      multiOrder: true,
      purchaseOrderIds: [],
      imports,
    }),
  });

  if (!importParseResp.ok) {
    const text = await importParseResp.text();
    console.log(`❌ 导入失败: ${importParseResp.status} - ${text}`);
    return { success: false, upload: uploadResult, parse: parseResult, error: `导入失败: ${text}` };
  }

  const importParseJson = await importParseResp.json() as any;
  if (importParseJson.error?.message) {
    console.log(`❌ 导入失败: ${importParseJson.error.message}`);
    return { success: false, upload: uploadResult, parse: parseResult, error: importParseJson.error.message };
  }

  const purchaseOrderIds: number[] = importParseJson.data?.purchaseOrderIds ?? [];
  console.log(`✓ 产品导入成功，创建入库单: ${purchaseOrderIds.join(', ')}`);

  // Step 4: 确认提交入库单
  if (purchaseOrderIds.length > 0) {
    console.log('\n✅ 确认提交入库单...');
    const commitResp = await fetch(`${API.baseUrl}/be/api/product/excel/import-commit`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': API.authToken,
        'Cookie': API.cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        purchaseOrderIds,
        updateCostPrice: true,
      }),
    });

    if (!commitResp.ok) {
      const text = await commitResp.text();
      console.log(`❌ 提交失败: ${commitResp.status} - ${text}`);
      return { success: false, upload: uploadResult, parse: parseResult, error: `提交失败: ${text}` };
    }

    const commitJson = await commitResp.json() as any;
    if (commitJson.error?.message) {
      console.log(`❌ 提交失败: ${commitJson.error.message}`);
      return { success: false, upload: uploadResult, parse: parseResult, error: commitJson.error.message };
    }

    console.log(`✓ 入库单已提交确认: ${purchaseOrderIds.join(', ')}`);
  }

  console.log(`\n🎉 完成！产品导入 + 入库单创建成功`);
  return { success: true, upload: uploadResult, parse: parseResult };
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
上传成本计算结果到 K2046

用法：
  npm run upload <excel_path> [选项]

选项：
  --dry-run           仅上传，不执行导入
  --skip-validation   跳过分类完备性检查
  --start-row <n>     起始行号（默认 1）
  -h, --help          显示帮助
`);
    process.exit(0);
  }

  let filePath: string | null = null;
  let dryRun = false;
  let skipValidation = false;
  let startRow = 1;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--skip-validation') {
      skipValidation = true;
    } else if (arg === '--start-row' && args[i + 1]) {
      startRow = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      filePath = arg;
    }
  }

  if (!filePath) {
    console.error('错误：缺少文件路径');
    process.exit(1);
  }

  uploadAndImport(filePath, { dryRun, skipValidation, startRow }).then(result => {
    process.exit(result.success ? 0 : 1);
  });
}
