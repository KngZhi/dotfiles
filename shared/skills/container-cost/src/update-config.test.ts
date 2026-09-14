import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP } from './business-rules.js';
import { prepareConfigValues } from './update-config.js';

test('prepare supplies the pre-arrival clearance misc fee default', async () => {
  const prepared = await prepareConfigValues(
    { 内陆费承担方: '厂家' },
    {},
    async () => 945,
    async () => 6.7255,
  );
  assert.equal(prepared['清关杂费'], DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP);
  assert.equal(prepared['USD-CNY'], 6.7255);
  assert.equal(prepared['CNY-CLP'], 957 / 6.7255);
});

test('prepare preserves explicit clearance misc fee including zero', async () => {
  const actual = await prepareConfigValues(
    { 内陆费: 0, 清关杂费: 800_000 },
    {},
    async () => 945,
    async () => 7,
  );
  assert.equal(actual['清关杂费'], 800_000);

  const zero = await prepareConfigValues(
    { 内陆费: 0 },
    { 清关杂费: 0 },
    async () => 945,
    async () => 7,
  );
  assert.equal(zero['清关杂费'], 0);
});

test('prepare derives blank CNY-CLP with fee and preserves actual overrides', async () => {
  const rates = { 'USD-CLP': 930, 'USD-CNY': 6.7 };
  const derived = await prepareConfigValues({ ...rates, 'CNY-CLP': '' });
  assert.equal(derived['CNY-CLP'], 942 / 6.7);
  const actual = await prepareConfigValues({ ...rates, 'CNY-CLP': 135 });
  assert.equal(actual['CNY-CLP'], 135);
});
