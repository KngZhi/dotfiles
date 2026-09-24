import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CLEARANCE_MISC_FEE_CLP,
  DEFAULT_UNLOADING_FEE_CLP,
  USD_RATES_URL,
  calculateLandedCosts,
  resolveCostConfig,
} from './calculate-landed-cost.mjs';

test('resolves shared defaults while keeping sea freight explicit', async () => {
  const config = await resolveCostConfig(
    { seaFreightUsd: 1000, inlandPayer: 'factory' },
    async () => 945,
    async () => 7,
  );

  assert.deepEqual(config, {
    seaFreightUsd: 1000,
    inlandFreightCny: 0,
    unloadingFeeClp: DEFAULT_UNLOADING_FEE_CLP,
    clearanceMiscFeeClp: DEFAULT_CLEARANCE_MISC_FEE_CLP,
    usdClp: 945,
    cnyClp: 957 / 7,
    usdCny: 7,
    ivaClp: 0,
    ivaGoodsValueUsd: 18000,
    provenance: {
      seaFreightUsd: { kind: 'explicit' },
      inlandFreightCny: { kind: 'derived', detail: 'inlandPayer=factory' },
      unloadingFeeClp: { kind: 'default', detail: '125000' },
      clearanceMiscFeeClp: { kind: 'default', detail: '1500000' },
      usdClp: { kind: 'fetched', detail: USD_RATES_URL },
      cnyClp: { kind: 'derived', detail: '(usdClp + 12) / usdCny' },
      usdCny: { kind: 'fetched', detail: 'https://www.boc.cn/sourcedb/whpj/ 现汇卖出价/100' },
      ivaClp: { kind: 'estimated', detail: 'zero triggers estimate' },
      ivaGoodsValueUsd: { kind: 'default', detail: '18000' },
    },
  });
});

test('calculates auditable row costs with volume and goods-value allocations', () => {
  const result = calculateLandedCosts({
    rows: [
      { id: 'A', unitPriceCny: 1, totalQuantity: 1000, totalVolumeM3: 34 },
      { id: 'B', unitPriceCny: 2, totalQuantity: 500, totalVolumeM3: 34 },
    ],
    config: {
      seaFreightUsd: 1000,
      inlandFreightCny: 100,
      unloadingFeeClp: 2000,
      clearanceMiscFeeClp: 500,
      usdClp: 900,
      cnyClp: 135,
      usdCny: 7,
      ivaClp: 100,
    },
  });

  assert.equal(result.totals.totalVolumeM3, 68);
  assert.equal(result.totals.totalGoodsValueClp, 270000);
  assert.equal(result.totals.ivaWasEstimated, false);
  assert.equal(result.rows[0].volumeShare, 0.5);
  assert.equal(result.rows[0].goodsValueShare, 0.5);
  assert.equal(result.rows[0].goodsCostPerUnitClp, 135);
  assert.equal(result.rows[0].seaFreightPerUnitClp, 450);
  assert.equal(result.rows[0].inlandFreightPerUnitClp, 6.75);
  assert.equal(result.rows[0].unloadingFeePerUnitClp, 1);
  assert.equal(result.rows[0].clearanceMiscFeePerUnitClp, 0.25);
  assert.equal(result.rows[0].ivaPerUnitClp, 0.05);
  assert.equal(result.rows[0].unroundedLandedCostClp, 593.05);
  assert.equal(result.rows[0].landedCostClp, 593);
  assert.equal(result.rows[1].landedCostClp, 1186);
});

test('reuses the container IVA estimate and default cost scenario', async () => {
  const config = await resolveCostConfig(
    { seaFreightUsd: 1000, inlandPayer: 'factory' },
    async () => 900,
    async () => 900 / 135,
  );
  const result = calculateLandedCosts({
    rows: [
      { id: 'SKU1', unitPriceCny: 1, totalQuantity: 1000, totalVolumeM3: 68 },
    ],
    config,
  });

  assert.equal(result.totals.ivaWasEstimated, true);
  assert.equal(result.totals.ivaTotalClp, 3249000);
  assert.equal(result.rows[0].unroundedLandedCostClp, 5910.8);
  assert.equal(result.rows[0].landedCostClp, 5911);
});

test('rejects missing inputs instead of producing plausible zero costs', async () => {
  await assert.rejects(
    () => resolveCostConfig({ inlandPayer: 'factory' }, async () => 900),
    /seaFreightUsd/,
  );
  assert.throws(
    () => calculateLandedCosts({
      rows: [{ id: 'BAD', unitPriceCny: 1, totalQuantity: 0, totalVolumeM3: 1 }],
      config: {
        seaFreightUsd: 1,
        inlandFreightCny: 0,
        unloadingFeeClp: 0,
        clearanceMiscFeeClp: 0,
        usdClp: 900,
        cnyClp: 135,
        usdCny: 7,
        ivaClp: 0,
      },
    }),
    /totalQuantity/,
  );
  assert.throws(
    () => calculateLandedCosts({
      rows: [{ id: 'FREE', unitPriceCny: 0, totalQuantity: 100, totalVolumeM3: 68 }],
      config: {
        seaFreightUsd: 100,
        inlandFreightCny: 0,
        unloadingFeeClp: 0,
        clearanceMiscFeeClp: 0,
        usdClp: 1000,
        cnyClp: 135,
        usdCny: 7,
        ivaClp: 0,
      },
    }),
    /unitPriceCny/,
  );
});

test('derives CNY-CLP with the fee while preserving explicit actual rates', async () => {
  const raw = { seaFreightUsd: 1000, inlandFreightCny: 0, usdClp: 930, usdCny: 6.7 };
  const derived = await resolveCostConfig(raw);
  assert.equal(derived.cnyClp, 942 / 6.7);
  assert.equal(derived.usdClp, 930);
  const actual = await resolveCostConfig({ ...raw, cnyClp: 135 });
  assert.equal(actual.cnyClp, 135);
  assert.deepEqual(actual.provenance.cnyClp, { kind: 'explicit' });
});


test('taxable basis is configurable and independent of purchase value and the CNY FX fee', async () => {
  for (const unitPriceCny of [1, 100]) {
    const rows = [{ id: 'X', unitPriceCny, totalQuantity: 1, totalVolumeM3: 68 }];
    const raw = { seaFreightUsd: 3000, inlandFreightCny: 0, usdClp: 950, usdCny: 7 };
    const base = calculateLandedCosts({ rows, config: await resolveCostConfig(raw) });
    const changed = calculateLandedCosts({ rows, config: await resolveCostConfig({ ...raw, ivaGoodsValueUsd: 20000 }) });
    const actual = calculateLandedCosts({ rows, config: await resolveCostConfig({ ...raw, ivaGoodsValueUsd: 20000, ivaClp: 123 }) });
    assert.equal(base.totals.ivaTotalClp, 3790500);
    assert.equal(changed.totals.ivaTotalClp, 4151500);
    assert.equal(actual.totals.ivaTotalClp, 123);
    assert.equal(actual.totals.ivaWasEstimated, false);
  }
});
