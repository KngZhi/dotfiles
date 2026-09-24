import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeK2046Transport } from '@kngzhi/k2046-api-client/testing';
import type { K2046TransportRequest } from '@kngzhi/k2046-api-client';
import { queryProductsByNumber, querySuppliers } from './k2046.js';

const config = { baseUrl: 'https://k2046.example', authToken: 'test', cookie: '' };

function respond(body: unknown) {
  return { status: 200, body: { data: body, error: { code: 0, message: null } } };
}

function fakeK2046(productBatchSizes: number[]) {
  const handler = (request: K2046TransportRequest) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/product/categories')) {
      return respond({
        total: 2,
        productCategories: [
          { id: 1, name: '袜子', parentId: 0 },
          { id: 2, name: '女袜', parentId: 1 },
        ],
      });
    }
    if (url.pathname.endsWith('/products/existing')) {
      const productNumbers = url.searchParams.getAll('searchWords[]');
      productBatchSizes.push(productNumbers.length);
      return respond({
        products: Object.fromEntries(productNumbers.map(productNumber => [
          productNumber,
          {
            productNumber,
            barCode1: '6903010120680',
            title1: `${productNumber} 女士船袜`,
            supplier: { name: '源头厂' },
            boxPrice: '12000', unitPrice: 100,
            packingBox: 40, packingBigBag: 12, packingBag: 1,
            category: { id: 2, name: '女袜', parentId: 1 },
            image: null, images: [],
          },
        ])),
      });
    }
    throw new Error(`unexpected K2046 request ${request.method} ${url.pathname}`);
  };
  return new FakeK2046Transport([handler, handler, handler, handler]);
}

test('product lookup goes through the official client in batches of at most 10 SKUs', async () => {
  const productBatchSizes: number[] = [];
  const transport = fakeK2046(productBatchSizes);
  const productNumbers = Array.from({ length: 23 }, (_, index) => `SKU${index + 1}`);

  const result = await queryProductsByNumber(productNumbers, { config, transport });

  assert.deepEqual(productBatchSizes, [10, 10, 3]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.products.size, 23);
  assert.equal(result.checkedProductNumbers.size, 23);
  assert.equal(transport.pending, 0);
  const product = result.products.get('SKU7');
  assert.ok(product);
  assert.equal(product.barCode1, '6903010120680');
  assert.equal(product.supplier?.name, '源头厂');
  assert.equal(product.boxPrice, 12000);
  assert.equal(product.packingBigBag, 12);
  assert.equal(product.categoryName, '女袜');
  assert.equal(product.categoryParentName, '袜子');
});

test('product lookup reports missing API configuration instead of calling K2046', async () => {
  const transport = new FakeK2046Transport([]);
  const result = await queryProductsByNumber(['S212'], {
    config: { baseUrl: '', authToken: '', cookie: '' },
    transport,
  });
  assert.deepEqual(result.errors, ['K2046 API 配置缺失，未执行产品查询']);
  assert.equal(result.products.size, 0);
  assert.equal(result.checkedProductNumbers.size, 0);
  assert.deepEqual(transport.requests, []);
});

test('product lookup failure is reported and leaves every SKU unchecked', async () => {
  const transport = new FakeK2046Transport([
    respond({ total: 0, productCategories: [] }),
    { status: 500, body: { data: null, error: { code: 500, message: 'boom' } } },
  ]);
  const result = await queryProductsByNumber(['S212'], { config, transport });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /^K2046 产品查询失败：/);
  assert.equal(result.products.size, 0);
  assert.equal(result.checkedProductNumbers.size, 0);
});

test('supplier lookup keeps only Supplier-type entries from the official client', async () => {
  const transport = new FakeK2046Transport([respond({
    total: 3,
    suppliers: [
      { id: '1', name: '源头厂', type: 'Supplier' },
      { id: '2', name: '货代', type: 'Forwarder' },
      { id: '3', name: '二厂', type: 'Supplier' },
    ],
  })]);
  const suppliers = await querySuppliers({ config, transport });
  assert.deepEqual(suppliers, [
    { id: '1', name: '源头厂', type: 'Supplier' },
    { id: '3', name: '二厂', type: 'Supplier' },
  ]);
});
