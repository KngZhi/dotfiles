/**
 * Container Cost - 配置
 */
import { homedir } from 'os';
import { join, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

// 路径配置
const containersDir = process.env.CONTAINER_COST_CONTAINERS_DIR
  || join(homedir(), 'Library/CloudStorage/OneDrive-Personal/source_files/containers');

export const PATHS = {
  // 容器文件目录 (OneDrive)
  containers: containersDir,
  // 生成文件目录（技能自身管理，不依赖业务代码仓库）
  generated: process.env.CONTAINER_COST_GENERATED_DIR || join(containersDir, 'generated'),
  // 状态文件
  state: join(homedir(), '.local/state/container-cost/state.json'),
};

function parseEnvFile(envPath: string): Record<string, string> {
  const env: Record<string, string> = {};

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        let value = valueParts.join('=').trim();
        // 去掉引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key.trim()] = value;
      }
    }
  }
  return env;
}

/**
 * API 配置优先级：
 * 1. 当前进程环境变量
 * 2. ~/.config/container-cost/.env
 * 3. ~/repo/chile-mono/.env（只读兼容回退，可移除）
 */
export function loadApiEnvironment(): Record<string, string> {
  const legacy = parseEnvFile(join(homedir(), 'repo/chile-mono/.env'));
  const local = parseEnvFile(join(homedir(), '.config/container-cost/.env'));
  return { ...legacy, ...local, ...process.env as Record<string, string> };
}

export interface ApiConfig {
  baseUrl: string;
  authToken: string;
  cookie: string;
}

export function getApiConfig(): ApiConfig {
  const env = loadApiEnvironment();
  return {
    baseUrl: process.env.API_BASE_URL
      || process.env.K2046_API_BASE_URL
      || env.API_BASE_URL
      || env.K2046_API_BASE_URL
      || '',
    authToken: process.env.X_AUTH_TOKEN
      || process.env.K2046_X_AUTH_TOKEN
      || env.X_AUTH_TOKEN
      || env.K2046_X_AUTH_TOKEN
      || '',
    cookie: process.env.COOKIE
      || process.env.K2046_COOKIE
      || env.COOKIE
      || env.K2046_COOKIE
      || '',
  };
}

// 状态文件接口
export interface ContainerState {
  lastProcessed: string | null;
  lastProcessedDate: string | null;
  lastCheck: number;
  lastCheckDate: string | null;
  pending: string[];
  lastReport: {
    container_id: string;
    date: string;
    container_file: string;
    output_file: string | null;
    validation?: {
      passed: boolean;
      summary: Record<string, number>;
    };
    issues: string[];
    warnings: string[];
  } | null;
}

export function loadState(): ContainerState {
  if (existsSync(PATHS.state)) {
    return JSON.parse(readFileSync(PATHS.state, 'utf-8'));
  }
  return {
    lastProcessed: null,
    lastProcessedDate: null,
    lastCheck: 0,
    lastCheckDate: null,
    pending: [],
    lastReport: null,
  };
}

export function saveState(state: ContainerState): void {
  mkdirSync(dirname(PATHS.state), { recursive: true });
  writeFileSync(PATHS.state, JSON.stringify(state, null, 2));
}
