/**
 * Container Cost - 检查新容器
 *
 * 对比容器文件与已生成的成本计算文件，找出未处理的容器
 */
import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { PATHS, loadState, saveState } from './config.js';

interface ContainerFile {
  path: string;
  name: string;
  containerId: string;
  arrivalDate: string;
  size: number;
}

/**
 * 解析容器文件名
 * 格式: (YYYY-MM-DD)CONTAINER_ID.xlsx
 */
function parseContainerFile(filePath: string): ContainerFile | null {
  const name = basename(filePath);
  const match = name.match(/^\((\d{4}-\d{2}-\d{2})\)(.+)\.xlsx$/);

  if (!match) return null;

  const stats = statSync(filePath);
  return {
    path: filePath,
    name,
    arrivalDate: match[1],
    containerId: match[2],
    size: stats.size,
  };
}

/**
 * 获取所有容器文件
 */
function getContainerFiles(): ContainerFile[] {
  try {
    const files = readdirSync(PATHS.containers);
    return files
      .filter(f => f.endsWith('.xlsx') && f.startsWith('('))
      .map(f => parseContainerFile(join(PATHS.containers, f)))
      .filter((f): f is ContainerFile => f !== null)
      .sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate)); // 按日期倒序
  } catch {
    console.error(`❌ 无法读取容器目录: ${PATHS.containers}`);
    return [];
  }
}

/**
 * 获取已处理的容器 ID
 */
function getProcessedContainers(): Set<string> {
  try {
    const files = readdirSync(PATHS.generated);
    const processed = new Set<string>();

    for (const file of files) {
      // 格式: 成本计算_(YYYY-MM-DD)CONTAINER_ID_YYYY_MM_DD_HH_MM.xlsx
      const match = file.match(/^成本计算_\([^)]+\)([A-Z0-9]+)_/);
      if (match) {
        processed.add(match[1]);
      }
    }

    return processed;
  } catch {
    return new Set();
  }
}

/**
 * 检查未处理的容器
 */
export function checkNewContainers(): ContainerFile[] {
  const allContainers = getContainerFiles();
  const processed = getProcessedContainers();

  return allContainers.filter(c => !processed.has(c.containerId));
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 打印检查结果
 */
export function printCheckResult(unprocessed: ContainerFile[]): void {
  if (unprocessed.length === 0) {
    console.log('✅ 没有新容器需要处理');
    return;
  }

  console.log(`📦 发现 ${unprocessed.length} 个未处理容器：\n`);

  unprocessed.forEach((c, i) => {
    console.log(`${i + 1}. ${c.containerId} (到港: ${c.arrivalDate}, 大小: ${formatSize(c.size)})`);
  });

  const suggested = unprocessed[0];
  console.log(`\n💡 建议处理：${suggested.containerId}`);
  console.log(`\n执行命令：npm run process ${suggested.containerId}`);
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const unprocessed = checkNewContainers();

  // 更新状态
  const state = loadState();
  state.lastCheck = Date.now();
  state.lastCheckDate = new Date().toISOString();
  state.pending = unprocessed.map(c => c.containerId);
  saveState(state);

  // 打印结果
  printCheckResult(unprocessed);
}
