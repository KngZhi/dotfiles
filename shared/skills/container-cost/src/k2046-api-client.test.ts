import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeK2046Transport } from '@kngzhi/k2046-api-client/testing';
import { findProductBySkuWithOfficialClient } from './k2046-api-client.js';

test('official client bridge performs a read-only find-by-SKU lookup', async () => {
  const transport = new FakeK2046Transport([{
    status: 200,
    body: {
      data: {
        id: 212,
        productNumber: 'S212',
        title1: 'S212女士船袜',
        title2: 'Mujer Tobillera',
        image: null,
        images: [],
      },
    },
  }]);

  const product = await findProductBySkuWithOfficialClient(' s212 ', {
    config: {
      baseUrl: 'https://k2046.example',
      authToken: 'test-auth-token',
      cookie: 'test-cookie',
    },
    transport,
  });

  assert.deepEqual(product, {
    id: 212,
    productNumber: 'S212',
    title1: 'S212女士船袜',
    title2: 'Mujer Tobillera',
    image: null,
    images: [],
  });
  assert.equal(transport.requests.length, 1);
  assert.equal(transport.requests[0]?.operation, 'products.findBySku');
  assert.equal(transport.requests[0]?.method, 'GET');
  assert.equal(
    transport.requests[0]?.url,
    'https://k2046.example/be/api/product/product?productNumber=S212',
  );
  assert.equal(transport.requests[0]?.body, undefined);
});
