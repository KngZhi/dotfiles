import type { K2046Client, K2046Transport } from '@kngzhi/k2046-api-client';
import { getApiConfig, type ApiConfig } from './config.js';
import { createOfficialK2046Client } from './k2046-api-client.js';

// K2046 读取全部经由官方客户端 @kngzhi/k2046-api-client；本文件只把客户端结果
// 整理成计算和校验所依赖的形状（分类名补全、按货号索引、查询错误列表）。

export interface K2046Product {
  productNumber: string;
  barCode1?: string;
  title1?: string;
  title2?: string;
  supplier?: { name?: string };
  boxPrice?: number;
  bigBagPrice?: number;
  bagPrice?: number;
  unitPrice?: number;
  packingBox?: number;
  packingBigBag?: number;
  packingBag?: number;
  category?: {
    id: number;
    name: string;
    parentId: number;
  } | null;
  categoryName?: string;
  categoryParentName?: string;
}

export interface ProductQueryResult {
  products: Map<string, K2046Product>;
  checkedProductNumbers: Set<string>;
  errors: string[];
}

export interface K2046Dependencies {
  config?: ApiConfig;
  /** 测试注入用；见 @kngzhi/k2046-api-client/testing 的 FakeK2046Transport。 */
  transport?: K2046Transport;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasApiConfig(config: ApiConfig): boolean {
  return Boolean(config.baseUrl && config.authToken);
}

function createClient(config: ApiConfig, dependencies: K2046Dependencies): K2046Client {
  return createOfficialK2046Client({
    config,
    ...(dependencies.transport ? { transport: dependencies.transport } : {}),
  });
}

async function fetchCategoryMap(client: K2046Client): Promise<Map<number, string>> {
  const categoryMap = new Map<number, string>();
  try {
    const { items } = await client.productCategories.listAll();
    for (const category of items) categoryMap.set(category.id, category.name);
  } catch {
    // 分类名称是补充信息；产品成本计算仍可继续。
  }
  return categoryMap;
}

export async function queryProductsByNumber(
  productNumbers: string[],
  dependencies: K2046Dependencies = {},
): Promise<ProductQueryResult> {
  const config = dependencies.config ?? getApiConfig();
  const unique = [...new Set(productNumbers.map(value => value.trim()).filter(Boolean))];
  const result: ProductQueryResult = {
    products: new Map(),
    checkedProductNumbers: new Set(),
    errors: [],
  };

  if (unique.length === 0) return result;
  if (!hasApiConfig(config)) {
    result.errors.push('K2046 API 配置缺失，未执行产品查询');
    return result;
  }

  const client = createClient(config, dependencies);
  const categories = await fetchCategoryMap(client);
  try {
    // 客户端按 10 个货号一批查询（K2046 静默丢弃超出的货号），不存在的货号不在结果里。
    const found = await client.products.findBySkus(unique);
    for (const productNumber of unique) result.checkedProductNumbers.add(productNumber);
    for (const raw of Object.values(found)) {
      const product: K2046Product = {
        productNumber: raw.productNumber,
        ...(raw.barCode1 === undefined ? {} : { barCode1: raw.barCode1 }),
        ...(raw.title1 === undefined ? {} : { title1: raw.title1 }),
        ...(raw.title2 === undefined ? {} : { title2: raw.title2 }),
        ...(raw.supplier === undefined ? {} : { supplier: { ...raw.supplier } }),
        ...(raw.boxPrice === undefined ? {} : { boxPrice: raw.boxPrice }),
        ...(raw.bigBagPrice === undefined ? {} : { bigBagPrice: raw.bigBagPrice }),
        ...(raw.bagPrice === undefined ? {} : { bagPrice: raw.bagPrice }),
        ...(raw.unitPrice === undefined ? {} : { unitPrice: raw.unitPrice }),
        ...(raw.packingBox === undefined ? {} : { packingBox: raw.packingBox }),
        ...(raw.packingBigBag === undefined ? {} : { packingBigBag: raw.packingBigBag }),
        ...(raw.packingBag === undefined ? {} : { packingBag: raw.packingBag }),
        ...(raw.category === undefined ? {} : { category: raw.category ? { ...raw.category } : null }),
      };
      if (product.category) {
        product.categoryName = product.category.name;
        product.categoryParentName = categories.get(product.category.parentId);
      }
      result.products.set(product.productNumber, product);
    }
  } catch (error) {
    result.errors.push(`K2046 产品查询失败：${errorMessage(error)}`);
  }
  return result;
}

export interface SupplierInfo {
  id: string;
  name: string;
  type: string;
}

export async function querySuppliers(
  dependencies: K2046Dependencies = {},
): Promise<SupplierInfo[]> {
  const config = dependencies.config ?? getApiConfig();
  if (!hasApiConfig(config)) return [];

  try {
    const { items } = await createClient(config, dependencies).suppliers.listAll();
    return items
      .filter(supplier => supplier.type === 'Supplier')
      .map(supplier => ({ id: supplier.id, name: supplier.name, type: supplier.type }));
  } catch {
    return [];
  }
}
