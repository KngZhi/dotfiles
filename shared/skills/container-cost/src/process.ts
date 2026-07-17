/**
 * Container Cost - 处理流程
 *
 * 完整流程：
 * 1. 查找容器文件
 * 2. 验证数据（条形码格式、K2046 系统检查）
 * 3. 运行成本计算
 * 4. 生成报告
 *
 * 用法：
 *   npm run process <CONTAINER_ID> [选项]
 *
 * 选项：
 *   --skip-validation   跳过验证步骤
 *   --force             验证失败时仍继续计算
 */
import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { PATHS, loadState, saveState } from './config.js';
import { validateContainer, formatReport, type ValidationResult } from './validate.js';
import { calculateContainerFile } from './calculate.js';

interface ProcessOptions {
  skipValidation?: boolean;
  force?: boolean;
}

interface ProcessResult {
  success: boolean;
  containerId: string;
  containerFile: string | null;
  outputFile: string | null;
  validation: ValidationResult | null;
  issues: string[];
  warnings: string[];
}

/**
 * 查找容器文件
 */
function findContainerFile(containerIdOrPath: string): string | null {
  // 如果是完整路径且存在，直接返回
  if (containerIdOrPath.endsWith('.xlsx') && existsSync(containerIdOrPath)) {
    return containerIdOrPath;
  }

  // 否则在预设目录中搜索
  try {
    const files = readdirSync(PATHS.containers);
    const match = files.find(f => f.includes(containerIdOrPath) && f.endsWith('.xlsx'));
    return match ? join(PATHS.containers, match) : null;
  } catch {
    return null;
  }
}

/**
 * 运行成本计算
 */
async function runCostCalculation(
  containerFile: string,
): Promise<{ success: boolean; output: string; outputFile: string | null }> {
  try {
    const outputFile = await calculateContainerFile(containerFile);
    return {
      success: true,
      output: `技能内 TypeScript 成本引擎已完成：${outputFile}`,
      outputFile,
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
      outputFile: null,
    };
  }
}

/**
 * 处理容器
 */
export async function processContainer(
  containerId: string,
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  const result: ProcessResult = {
    success: false,
    containerId,
    containerFile: null,
    outputFile: null,
    validation: null,
    issues: [],
    warnings: [],
  };

  console.log('\n' + '🚢'.repeat(30));
  console.log(`集装箱成本计算 - ${containerId}`);
  console.log('🚢'.repeat(30) + '\n');

  // 步骤 1: 查找文件
  result.containerFile = findContainerFile(containerId);
  if (!result.containerFile) {
    console.log(`❌ 找不到容器文件：${containerId}`);
    result.issues.push('找不到容器文件');
    return result;
  }
  console.log(`✓ 找到容器文件：${basename(result.containerFile)}`);

  // 步骤 2: 验证数据
  console.log('\n' + '='.repeat(60));
  console.log('🔍 数据验证');
  console.log('='.repeat(60));

  if (options.skipValidation) {
    console.log('⏭️  跳过验证（--skip-validation）');
  } else {
    result.validation = await validateContainer(result.containerFile);
    console.log(formatReport(result.validation, containerId));

    if (!result.validation.passed) {
      // 收集问题
      const formatErrors = result.validation.errors.filter(e => e.type === 'barcode_format');
      const notFound = result.validation.errors.filter(e => e.type === 'product_not_found');

      if (formatErrors.length > 0) {
        result.issues.push(`${formatErrors.length} 个条形码格式错误`);
      }
      if (notFound.length > 0) {
        result.issues.push(`${notFound.length} 个货号不存在于 K2046`);
      }

      if (options.force) {
        console.log('\n⚠️  验证失败，但 --force 选项启用，继续处理...');
      } else {
        console.log('\n❌ 验证失败，停止处理');
        console.log('   提示：使用 --force 选项可以强制继续');
        updateState(result);
        return result;
      }
    } else {
      console.log('\n✅ 验证通过');
    }
  }

  // 步骤 3: 运行成本计算
  console.log('\n' + '='.repeat(60));
  console.log('💰 成本计算');
  console.log('='.repeat(60));

  const calcResult = await runCostCalculation(result.containerFile);
  console.log(calcResult.output);

  if (!calcResult.success) {
    result.issues.push('成本计算失败');
    console.log('❌ 成本计算失败');
    updateState(result);
    return result;
  }

  result.outputFile = calcResult.outputFile;
  if (result.outputFile) {
    console.log(`\n✓ 生成文件：${basename(result.outputFile)}`);
  }

  // 步骤 4: 生成报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 生成报告');
  console.log('='.repeat(60));

  result.success = true;
  updateState(result);

  // 打印摘要
  console.log('\n' + '='.repeat(60));
  console.log('✅ 处理完成');
  console.log('='.repeat(60));
  console.log(`\n📦 容器：${containerId}`);
  if (result.outputFile) {
    console.log(`📁 输出：${basename(result.outputFile)}`);
  }

  if (result.issues.length > 0) {
    console.log(`\n⚠️  警告 (${result.issues.length}):`);
    result.issues.forEach(issue => console.log(`  • ${issue}`));
  }

  return result;
}

/**
 * 更新状态文件
 */
function updateState(result: ProcessResult): void {
  const state = loadState();

  state.lastProcessed = result.containerId;
  state.lastProcessedDate = new Date().toISOString();
  state.lastReport = {
    container_id: result.containerId,
    date: new Date().toISOString(),
    container_file: result.containerFile || '',
    output_file: result.outputFile,
    validation: result.validation ? {
      passed: result.validation.passed,
      summary: result.validation.summary,
    } : undefined,
    issues: result.issues,
    warnings: result.warnings,
  };

  // 从 pending 列表中移除
  if (state.pending.includes(result.containerId)) {
    state.pending = state.pending.filter(id => id !== result.containerId);
  }

  saveState(state);
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
集装箱成本计算完整流程

用法：
  npm run process <CONTAINER_ID> [选项]

选项：
  --skip-validation   跳过验证步骤
  --force             验证失败时仍继续计算
  -h, --help          显示帮助
`);
    process.exit(0);
  }

  // 解析参数
  let containerId: string | null = null;
  const options: ProcessOptions = {};

  for (const arg of args) {
    if (arg === '--skip-validation') {
      options.skipValidation = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (!arg.startsWith('-')) {
      containerId = arg;
    }
  }

  if (!containerId) {
    console.error('错误：缺少容器 ID');
    process.exit(1);
  }

  processContainer(containerId, options).then(result => {
    process.exit(result.success ? 0 : 1);
  });
}
