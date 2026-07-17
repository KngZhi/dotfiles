import { K2046Error } from '@kngzhi/k2046-api-client';
import { findProductBySkuWithOfficialClient } from './k2046-api-client.js';

function printUsage(): void {
  console.error('用法: npm run api-client:smoke -- <货号>');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sku = args[0]?.trim();
  if (!sku || args.length !== 1) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  try {
    const product = await findProductBySkuWithOfficialClient(sku);
    if (!product) {
      console.log(JSON.stringify({
        found: false,
        productNumber: sku.toUpperCase(),
      }, null, 2));
      return;
    }

    console.log(JSON.stringify({
      found: true,
      id: product.id ?? null,
      productNumber: product.productNumber,
      title1: product.title1 ?? null,
      title2: product.title2 ?? null,
    }, null, 2));
  } catch (error) {
    if (error instanceof K2046Error) {
      console.error(JSON.stringify({
        error: {
          kind: error.kind,
          operation: error.operation,
          status: error.status ?? null,
          message: error.message,
        },
      }, null, 2));
    } else {
      console.error(JSON.stringify({
        error: {
          kind: 'unknown',
          message: 'K2046 查询失败',
        },
      }, null, 2));
    }
    process.exitCode = 1;
  }
}

await main();
