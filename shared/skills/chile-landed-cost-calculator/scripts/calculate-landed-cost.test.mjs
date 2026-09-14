import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CLEARANCE_MISC_FEE_CLP,
  DEFAULT_CNY_CLP,
  DEFAULT_UNLOADING_FEE_CLP,
  USD_RATES_URL,
  calculateLandedCosts,
  resolveCostConfig,
} from './calculate-landed-cost.mjs';

test('resolves shared defaults while keeping sea freight explicit', async () => {
  const config = await resolveCostConfig(
    { seaFreightUsd: 1000, inlandPayer: 'factory' },
    async () => 945,
  );

  assert.deepEqual(config, {
    seaFreightUsd: 1000,
    inlandFreightCny: 0,
    unloadingFeeClp: DEFAULT_UNLOADING_FEE_CLP,
    clearanceMiscFeeClp: DEFAULT_CLEARANCE_MISC_FEE_CLP,
    usdClp: 945,
    cnyClp: DEFAULT_CNY_CLP,
    usdCny: 7,
    ivaClp: 0,
    provenance: {
      seaFreightUsd: { kind: 'explicit' },
      inlandFreightCny: { kind: 'derived', detail: 'inlandPayer=factory' },
      unloadingFeeClp: { kind: 'default', detail: '125000' },
      clearanceMiscFeeClp: { kind: 'default', detail: '1500000' },
      usdClp: { kind: 'fetched', detail: USD_RATES_URL },
      cnyClp: { kind: 'default', detail: '135' },
      usdCny: { kind: 'derived', detail: 'usdClp/cnyClp' },
      ivaClp: { kind: 'estimated', detail: 'zero triggers estimate' },
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
  );
  const result = calculateLandedCosts({
    rows: [
      { id: 'SKU1', unitPriceCny: 1, totalQuantity: 1000, totalVolumeM3: 68 },
    ],
    config,
  });

  assert.equal(result.totals.ivaWasEstimated, true);
  assert.equal(result.totals.ivaTotalClp, 58995);
  assert.equal(result.rows[0].unroundedLandedCostClp, 2718.995);
  assert.equal(result.rows[0].landedCostClp, 2719);
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
