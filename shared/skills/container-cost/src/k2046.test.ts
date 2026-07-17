import assert from 'node:assert/strict';
import test from 'node:test';
import { queryProductsByNumber } from './k2046.js';

test('K2046 existing-product lookup batches at no more than 10 SKUs', async () => {
  const productBatchSizes: number[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/categories')) {
      return Response.json({ data: { productCategories: [] } });
    }
    const productNumbers = url.searchParams.getAll('searchWords[]');
    productBatchSizes.push(productNumbers.length);
    return Response.json({
      data: {
        products: Object.fromEntries(
          productNumbers.map(productNumber => [
            productNumber,
            { productNumber, barCode1: '6903010120680' },
          ]),
        ),
      },
    });
  }) as typeof fetch;
  const productNumbers = Array.from({ length: 23 }, (_, index) => `SKU${index + 1}`);
  const result = await queryProductsByNumber(productNumbers, {
    config: { baseUrl: 'https://k2046.example', authToken: 'test', cookie: '' },
    fetchImpl,
  });
  assert.deepEqual(productBatchSizes, [10, 10, 3]);
  assert.equal(result.products.size, 23);
  assert.equal(result.checkedProductNumbers.size, 23);
});
