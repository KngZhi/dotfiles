import {
  createK2046Client,
  type K2046Client,
  type K2046Product,
  type K2046Transport,
} from '@kngzhi/k2046-api-client';
import { getApiConfig, type ApiConfig } from './config.js';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface OfficialK2046ClientDependencies {
  config?: ApiConfig;
  timeoutMs?: number;
  transport?: K2046Transport;
}

/**
 * Creates the official client from the same configuration used by the
 * container-cost adapter. Transport injection is intended for consumer tests.
 */
export function createOfficialK2046Client(
  dependencies: OfficialK2046ClientDependencies = {},
): K2046Client {
  const config = dependencies.config ?? getApiConfig();
  return createK2046Client({
    baseUrl: config.baseUrl,
    authToken: config.authToken,
    cookie: config.cookie,
    timeoutMs: dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(dependencies.transport ? { transport: dependencies.transport } : {}),
  });
}

/** Read-only single-SKU lookup used by the connectivity smoke command. */
export async function findProductBySkuWithOfficialClient(
  sku: string,
  dependencies: OfficialK2046ClientDependencies = {},
): Promise<K2046Product | null> {
  return createOfficialK2046Client(dependencies).products.findBySku(sku);
}
