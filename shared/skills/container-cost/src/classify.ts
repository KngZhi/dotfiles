/**
 * Container Cost - 产品分类
 *
 * 功能：
 * 1. 读取成本 Excel，找出缺少分类的产品
 * 2. 在图片目录中查找对应图片
 * 3. 输出待分类列表（供人工或 AI 分类）
 * 4. 根据映射文件更新 Excel
 */
import * as XLSX from './xlsx.js';
import { existsSync, readdirSync, writeFileSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { PATHS } from './config.js';

// 图片目录（容器图片整理）
const IMAGE_BASE = join(
  process.env.HOME || '',
  'Library/CloudStorage/OneDrive-Personal/source_files/产品图片'
);

interface MissingProduct {
  row: number;
  productNumber: string;
  productName: string;
  supplier: string;
  imagePath?: string;
}

interface CategoryMapping {
  [productNumber: string]: [string, string]; // [分类1, 分类2]
}

// 女士内裤分类（大包装数=12）
const WOMEN_UNDERWEAR_CATEGORIES = [
  'clasico',
  'tanga',
  'brasilera',
  'mami',
  'boxer',  // 女士平角
];

/**
 * 根据分类自动计算大包装数
 * 规则：女士内裤=12，其他=1
 */
function getDefaultBigBagPacking(cat1: string, cat2: string): number {
  if (cat1 === 'calzon' && WOMEN_UNDERWEAR_CATEGORIES.includes(cat2)) {
    return 12;
  }
  // 其他所有（童装、男士、袜子等）= 1
  return 1;
}

/**
 * 查找产品图片
 */
function findProductImage(productNumber: string, containerFolder?: string): string | undefined {
  const searchDirs: string[] = [];

  // 如果指定了容器文件夹
  if (containerFolder) {
    const containerPath = join(IMAGE_BASE, containerFolder);
    if (existsSync(containerPath)) {
      // 搜索子文件夹
      try {
        const subDirs = readdirSync(containerPath, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => join(containerPath, d.name));
        searchDirs.push(...subDirs);
      } catch {
        // ignore
      }
    }
  }

  // 搜索图片
  for (const dir of searchDirs) {
    try {
      const files = readdirSync(dir);
      // 尝试多种匹配方式
      const patterns = [
        `${productNumber}.jpg`,
        `${productNumber}.png`,
        `${productNumber}.jpeg`,
      ];

      for (const pattern of patterns) {
        if (files.includes(pattern)) {
          return join(dir, pattern);
        }
      }

      // 模糊匹配（包含货号）
      const match = files.find(f =>
        f.toLowerCase().includes(productNumber.toLowerCase()) &&
        /\.(jpg|jpeg|png)$/i.test(f)
      );
      if (match) {
        return join(dir, match);
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}

/**
 * 读取成本 Excel，找出缺少分类的产品
 */
export function findMissingCategories(excelPath: string, imageFolder?: string): MissingProduct[] {
  if (!existsSync(excelPath)) {
    console.error(`文件不存在: ${excelPath}`);
    return [];
  }

  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const headers = (data[0] as string[]).map(h => String(h ?? '').trim());
  const pnCol = headers.indexOf('货号');
  const nameCol = headers.indexOf('产品名1');
  const supplierCol = headers.indexOf('供应商');
  const cat1Col = headers.indexOf('分类1');
  const cat2Col = headers.indexOf('分类2');

  if (cat1Col === -1 || cat2Col === -1) {
    console.error('Excel 缺少分类列');
    return [];
  }

  const missing: MissingProduct[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as (string | number | undefined)[];
    if (!row || !row[pnCol] || row[pnCol] === 'DATA_END') continue;

    const cat1 = String(row[cat1Col] ?? '').trim();
    const cat2 = String(row[cat2Col] ?? '').trim();

    if (!cat1 || !cat2) {
      const pn = String(row[pnCol]).trim();
      missing.push({
        row: i + 1,
        productNumber: pn,
        productName: String(row[nameCol] ?? '').trim(),
        supplier: String(row[supplierCol] ?? '').trim(),
        imagePath: findProductImage(pn, imageFolder),
      });
    }
  }

  return missing;
}

/**
 * 应用分类映射到 Excel（同时自动填充大包装数）
 */
export function applyCategories(excelPath: string, mapping: CategoryMapping): { categories: number; packing: number } {
  const wb = XLSX.readFile(excelPath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const headers = (data[0] as string[]).map(h => String(h ?? '').trim());
  const pnCol = headers.indexOf('货号');
  const cat1Col = headers.indexOf('分类1');
  const cat2Col = headers.indexOf('分类2');
  const bigBagCol = headers.indexOf('大包装数');

  let categoriesUpdated = 0;
  let packingUpdated = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as (string | number | undefined)[];
    if (!row || !row[pnCol] || row[pnCol] === 'DATA_END') continue;

    const pn = String(row[pnCol]).trim();
    const cat = mapping[pn];

    if (cat) {
      const oldCat1 = String(row[cat1Col] ?? '').trim();
      const oldCat2 = String(row[cat2Col] ?? '').trim();

      // 更新分类
      if (!oldCat1 || !oldCat2) {
        row[cat1Col] = cat[0];
        row[cat2Col] = cat[1];
        categoriesUpdated++;
      }

      // 自动填充大包装数（如果为空且有规则）
      if (bigBagCol !== -1) {
        const currentBigBag = row[bigBagCol];
        if (currentBigBag === undefined || currentBigBag === null || currentBigBag === '') {
          const defaultBigBag = getDefaultBigBagPacking(cat[0], cat[1]);
          if (defaultBigBag !== undefined) {
            row[bigBagCol] = defaultBigBag;
            packingUpdated++;
          }
        }
      }
    }
  }

  if (categoriesUpdated > 0 || packingUpdated > 0) {
    const newSheet = XLSX.utils.aoa_to_sheet(data);
    wb.Sheets[sheetName] = newSheet;
    XLSX.writeFile(wb, excelPath);
  }

  return { categories: categoriesUpdated, packing: packingUpdated };
}

/**
 * 单独应用大包装数规则（用于已有分类的文件）
 * 规则：女士内裤=12，其他=1
 */
export function applyPackingRules(excelPath: string): { updated: number; details: { pn: string; cat: string; packing: number }[] } {
  const wb = XLSX.readFile(excelPath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const headers = (data[0] as string[]).map(h => String(h ?? '').trim());
  const pnCol = headers.indexOf('货号');
  const cat1Col = headers.indexOf('分类1');
  const cat2Col = headers.indexOf('分类2');
  const bigBagCol = headers.indexOf('大包装数');

  if (bigBagCol === -1) {
    console.error('Excel 缺少大包装数列');
    return { updated: 0, details: [] };
  }

  let updated = 0;
  const details: { pn: string; cat: string; packing: number }[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as (string | number | undefined)[];
    if (!row || !row[pnCol] || row[pnCol] === 'DATA_END') continue;

    const pn = String(row[pnCol]).trim();
    const cat1 = String(row[cat1Col] ?? '').trim();
    const cat2 = String(row[cat2Col] ?? '').trim();
    const currentBigBag = row[bigBagCol];

    // 如果大包装数为空且有分类
    if ((currentBigBag === undefined || currentBigBag === null || currentBigBag === '') && cat1 && cat2) {
      const packing = getDefaultBigBagPacking(cat1, cat2);
      row[bigBagCol] = packing;
      details.push({ pn, cat: `${cat1}/${cat2}`, packing });
      updated++;
    }
  }

  if (updated > 0) {
    const newSheet = XLSX.utils.aoa_to_sheet(data);
    wb.Sheets[sheetName] = newSheet;
    XLSX.writeFile(wb, excelPath);
  }

  return { updated, details };
}

/**
 * 生成分类模板文件
 */
export function generateTemplate(missing: MissingProduct[], outputPath: string): void {
  const template: CategoryMapping = {};

  for (const p of missing) {
    template[p.productNumber] = ['', '']; // 待填写
  }

  writeFileSync(outputPath, JSON.stringify(template, null, 2), 'utf-8');
}

/**
 * 从 JSON 文件加载分类映射
 */
export function loadMappingFromFile(filePath: string): CategoryMapping {
  if (!existsSync(filePath)) {
    throw new Error(`映射文件不存在: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as CategoryMapping;
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
产品分类工具

用法：
  npm run classify <成本Excel> [选项]

选项：
  --image-folder <名称>   图片文件夹名（如 "12.23照片整理MSMU4314897"）
  --output <路径>         输出分类模板 JSON
  --apply <映射JSON>      应用分类映射到 Excel（同时自动填充大包装数）
  --apply-packing         单独应用大包装数规则
  -h, --help              显示帮助

大包装数规则：
  calzon (除 nina/nino) → 12
  其他分类 → 需手动填写

示例：
  # 查看缺少分类的产品
  npm run classify 成本计算_xxx.xlsx --image-folder "12.23照片整理MSMU4314897"

  # 生成分类模板
  npm run classify 成本计算_xxx.xlsx --output template.json

  # 应用分类（填写 template.json 后，同时填充大包装数）
  npm run classify 成本计算_xxx.xlsx --apply template.json

  # 单独填充大包装数（已有分类的文件）
  npm run classify 成本计算_xxx.xlsx --apply-packing
`);
    process.exit(0);
  }

  let excelPath: string | null = null;
  let imageFolder: string | undefined;
  let outputPath: string | undefined;
  let applyPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--image-folder' && args[i + 1]) {
      imageFolder = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      outputPath = args[++i];
    } else if (arg === '--apply' && args[i + 1]) {
      applyPath = args[++i];
    } else if (!arg.startsWith('-')) {
      excelPath = arg;
    }
  }

  if (!excelPath) {
    console.error('错误：缺少 Excel 路径');
    process.exit(1);
  }

  // 如果是相对路径，在 generated 目录中查找
  if (!existsSync(excelPath)) {
    const inGenerated = join(PATHS.generated, excelPath);
    if (existsSync(inGenerated)) {
      excelPath = inGenerated;
    }
  }

  // 应用分类模式
  if (applyPath) {
    console.log(`📥 应用分类映射: ${applyPath}`);
    try {
      const mapping = loadMappingFromFile(applyPath);
      const count = Object.keys(mapping).filter(k => mapping[k][0] && mapping[k][1]).length;
      console.log(`   映射条目: ${count} 个`);

      const result = applyCategories(excelPath, mapping);
      console.log(`✅ 更新完成:`);
      console.log(`   分类: ${result.categories} 个`);
      console.log(`   大包装数: ${result.packing} 个 (自动填充)`);
    } catch (e) {
      console.error(`❌ 应用失败: ${e}`);
      process.exit(1);
    }
    process.exit(0);
  }

  // 单独应用大包装数规则
  if (args.includes('--apply-packing')) {
    console.log(`📦 应用大包装数规则...`);
    console.log(`   女士内裤 → 12，其他 → 1\n`);
    const result = applyPackingRules(excelPath);

    if (result.updated === 0) {
      console.log(`✅ 无需更新（大包装数已填写完整）`);
    } else {
      // 按包装数分组显示
      const by12 = result.details.filter(d => d.packing === 12);
      const by1 = result.details.filter(d => d.packing === 1);

      console.log(`✅ 更新完成: ${result.updated} 个`);
      if (by12.length > 0) {
        console.log(`\n   大包装数=12 (${by12.length} 个):`);
        by12.slice(0, 5).forEach(d => console.log(`     ${d.pn} (${d.cat})`));
        if (by12.length > 5) console.log(`     ... 还有 ${by12.length - 5} 个`);
      }
      if (by1.length > 0) {
        console.log(`\n   大包装数=1 (${by1.length} 个):`);
        by1.slice(0, 5).forEach(d => console.log(`     ${d.pn} (${d.cat})`));
        if (by1.length > 5) console.log(`     ... 还有 ${by1.length - 5} 个`);
      }
    }
    process.exit(0);
  }

  // 查找缺少分类的产品
  console.log(`\n📋 分析文件: ${basename(excelPath)}`);
  if (imageFolder) {
    console.log(`   图片目录: ${imageFolder}`);
  }

  const missing = findMissingCategories(excelPath, imageFolder);

  if (missing.length === 0) {
    console.log('\n✅ 所有产品都已有分类');
    process.exit(0);
  }

  console.log(`\n⚠️  缺少分类的产品 (${missing.length} 个):\n`);

  // 按供应商分组
  const bySupplier = new Map<string, MissingProduct[]>();
  for (const p of missing) {
    const supplier = p.supplier || '未知';
    if (!bySupplier.has(supplier)) {
      bySupplier.set(supplier, []);
    }
    bySupplier.get(supplier)!.push(p);
  }

  for (const [supplier, products] of bySupplier) {
    console.log(`【${supplier}】(${products.length} 个)`);
    for (const p of products) {
      const hasImage = p.imagePath ? '📷' : '  ';
      console.log(`  ${hasImage} ${p.row}: ${p.productNumber} - ${p.productName}`);
    }
    console.log();
  }

  // 输出模板
  if (outputPath) {
    generateTemplate(missing, outputPath);
    console.log(`📝 模板已生成: ${outputPath}`);
    console.log('   请填写分类后使用 --apply 应用');
  } else {
    console.log('💡 提示: 使用 --output template.json 生成分类模板');
  }
}
