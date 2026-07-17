import { getApiConfig, type ApiConfig } from './config.js';

const PRODUCT_BATCH_SIZE = 10;

// TODO(api-client): This file is the single temporary HTTP adapter boundary.
// Replace its exported functions with the official K2046 api-client after that
// package is fixed; calculation and validation depend only on these interfaces.

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
  fetchImpl?: typeof fetch;
}

function requestHeaders(config: ApiConfig): Record<string, string> {
  return {
    'X-Auth-Token': config.authToken,
    ...(config.cookie ? { Cookie: config.cookie } : {}),
  };
}

async function fetchCategoryMap(
  config: ApiConfig,
  fetchImpl: typeof fetch,
): Promise<Map<number, string>> {
  const categoryMap = new Map<number, string>();
  const url = new URL('/be/api/product/categories', config.baseUrl);
  url.searchParams.set('limit', '999');
  try {
    const response = await fetchImpl(url, { headers: requestHeaders(config) });
    if (!response.ok) return categoryMap;
    const payload = await response.json() as {
      data?: { productCategories?: Array<{ id: number; name: string }> };
    };
    for (const category of payload.data?.productCategories ?? []) {
      categoryMap.set(category.id, category.name);
    }
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
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const unique = [...new Set(productNumbers.map(value => value.trim()).filter(Boolean))];
  const result: ProductQueryResult = {
    products: new Map(),
    checkedProductNumbers: new Set(),
    errors: [],
  };

  if (unique.length === 0) return result;
  if (!config.baseUrl || !config.authToken) {
    result.errors.push('K2046 API 配置缺失，未执行产品查询');
    return result;
  }

  const categories = await fetchCategoryMap(config, fetchImpl);
  for (let offset = 0; offset < unique.length; offset += PRODUCT_BATCH_SIZE) {
    const batch = unique.slice(offset, offset + PRODUCT_BATCH_SIZE);
    const url = new URL('/be/api/product/products/existing', config.baseUrl);
    for (const productNumber of batch) {
      url.searchParams.append('searchWords[]', productNumber);
    }

    try {
      const response = await fetchImpl(url, { headers: requestHeaders(config) });
      if (!response.ok) {
        result.errors.push(`K2046 产品查询批次 ${offset / PRODUCT_BATCH_SIZE + 1} 返回 HTTP ${response.status}`);
        continue;
      }
      const payload = await response.json() as {
        data?: { products?: Record<string, K2046Product> };
      };
      const products = payload.data?.products ?? {};
      for (const productNumber of batch) result.checkedProductNumbers.add(productNumber);
      for (const [key, rawProduct] of Object.entries(products)) {
        const productNumber = rawProduct.productNumber || key;
        const product = { ...rawProduct, productNumber };
        if (product.category) {
          product.categoryName = product.category.name;
          product.categoryParentName = categories.get(product.category.parentId);
        }
        result.products.set(productNumber, product);
      }
    } catch (error) {
      result.errors.push(
        `K2046 产品查询批次 ${offset / PRODUCT_BATCH_SIZE + 1} 失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  if (!config.baseUrl || !config.authToken) return [];

  const url = new URL('/be/api/supplier/suppliers', config.baseUrl);
  url.searchParams.set('limit', '100');
  try {
    const response = await fetchImpl(url, { headers: requestHeaders(config) });
    if (!response.ok) return [];
    const payload = await response.json() as { data?: { suppliers?: SupplierInfo[] } };
    return (payload.data?.suppliers ?? []).filter(supplier => supplier.type === 'Supplier');
  } catch {
    return [];
  }
}
