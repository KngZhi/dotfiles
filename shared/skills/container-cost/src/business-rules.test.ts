import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP,
  DEFAULT_SELF_PAID_INLAND_FEE_CNY,
  DEFAULT_UNLOADING_FEE_CLP,
  fetchUsdClp,
  resolveContainerConfig,
} from './business-rules.js';

const required = {
  海运费: 6400,
  货柜号: 'TEMU8362779',
};

test('uses business defaults and independently fetches BOC USD-CNY', async () => {
  const config = await resolveContainerConfig(
    { ...required, 内陆费承担方: '厂家' },
    async () => 945,
    async () => 6.7255,
  );
  assert.equal(config.内陆费, 0);
  assert.equal(config.清关杂费, DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP);
  assert.equal(config.卸柜费, DEFAULT_UNLOADING_FEE_CLP);
  assert.equal(config['CNY-CLP'], 957 / 6.7255);
  assert.equal(config['USD-CLP'], 945);
  assert.equal(config['USD-CNY'], 6.7255);
  assert.equal(config.IVA, 0);
});

test('defaults self-paid inland freight to CNY 5500', async () => {
  const config = await resolveContainerConfig(
    { ...required, 内陆费承担方: '我方' },
    async () => 945,
    async () => 7,
  );
  assert.equal(config.内陆费, DEFAULT_SELF_PAID_INLAND_FEE_CNY);
});

test('explicit config values override every default and skip live rate lookup', async () => {
  let called = false;
  const config = await resolveContainerConfig({
    ...required,
    内陆费: 1234,
    内陆费承担方: '厂家',
    卸柜费: 222222,
    'CNY-CLP': 140,
    'USD-CLP': 1000,
    'USD-CNY': 7.1,
    IVA: 987,
    清关杂费: 888888,
  }, async () => {
    called = true;
    return 1;
  });
  assert.equal(called, false);
  assert.equal(config.内陆费, 1234);
  assert.equal(config.卸柜费, 222222);
  assert.equal(config['CNY-CLP'], 140);
  assert.equal(config['USD-CLP'], 1000);
  assert.equal(config['USD-CNY'], 7.1);
  assert.equal(config.IVA, 987);
  assert.equal(config.清关杂费, 888888);
});

test('USD-CLP live lookup failure is fatal and has no hardcoded fallback', async () => {
  await assert.rejects(
    () => fetchUsdClp((async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch),
    /无法获取实时 USD-CLP.*offline/,
  );
  await assert.rejects(
    () => resolveContainerConfig(
      { ...required, 内陆费: 0 },
      async () => {
        throw new Error('rate unavailable');
      },
    ),
    /rate unavailable/,
  );
});

test('explicit zero clearance misc fee overrides the pre-arrival default', async () => {
  const config = await resolveContainerConfig(
    { ...required, 内陆费: 0, 清关杂费: 0 },
    async () => 900,
    async () => 7,
  );
  assert.equal(config.清关杂费, 0);
});

test('BOC failure does not fall back to cross rates', async () => {
  await assert.rejects(() => resolveContainerConfig(
    { ...required, 内陆费: 0, 'USD-CLP': 945 },
    async () => 945,
    async () => { throw new Error('BOC unavailable'); },
  ), /BOC unavailable/);
});

test('still requires real sea freight and container number', async () => {
  await assert.rejects(
    () => resolveContainerConfig({ 内陆费: 0, 货柜号: 'X' }, async () => 900),
    /海运费/,
  );
  await assert.rejects(
    () => resolveContainerConfig({ 内陆费: 0, 海运费: 1 }, async () => 900),
    /货柜号/,
  );
});

test('includes the 12 CLP per USD fee in the user exchange example', async () => {
  const config = await resolveContainerConfig({
    ...required, 内陆费: 0, 'USD-CLP': 930, 'USD-CNY': 6.7,
  });
  assert.equal(config['CNY-CLP'], 942 / 6.7);
  assert.equal(config['USD-CLP'], 930);
});


test('taxable goods USD defaults to 18000 and accepts explicit overrides without live FX', async () => {
  const raw = { ...required, 内陆费: 0, 'USD-CLP': 950, 'USD-CNY': 7 };
  assert.equal((await resolveContainerConfig(raw)).ivaGoodsValueUsd, 18000);
  assert.equal((await resolveContainerConfig({ ...raw, IVA计税货值USD: 20000 })).ivaGoodsValueUsd, 20000);
  await assert.rejects(() => resolveContainerConfig({ ...raw, IVA计税货值USD: -1 }), /IVA计税货值USD/);
});
