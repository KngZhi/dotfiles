import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DEFAULT_UNLOADING_FEE_CLP = 125_000;
export const DEFAULT_CLEARANCE_MISC_FEE_CLP = 1_350_000;
export const DEFAULT_SELF_PAID_INLAND_FEE_CNY = 5_500;
export const DEFAULT_CNY_CLP = 135;
export const USD_RATES_URL = 'https://open.er-api.com/v6/latest/USD';

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function numberValue(value, key, { required = false, positive = false } = {}) {
  if (!hasValue(value)) {
    if (required) throw new Error(`missing required parameter: ${key}`);
    return undefined;
  }
  const parsed = Number(value);
  const invalid = !Number.isFinite(parsed) || parsed < 0 || (positive && parsed === 0);
  if (invalid) throw new Error(`${key} must be ${positive ? 'positive' : 'non-negative'}`);
  return parsed;
}

export function normalizeInlandPayer(value) {
  if (!hasValue(value)) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['厂家', '供应商', 'factory', 'supplier'].includes(normalized)) return 'factory';
  if (['我方', '自付', '买方', 'self', 'buyer', 'us'].includes(normalized)) return 'self';
  throw new Error(`unrecognized inlandPayer: ${String(value)}`);
}

export async function fetchUsdClp(fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(USD_RATES_URL);
  } catch (error) {
    throw new Error(`unable to fetch USD-CLP: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new Error(`unable to fetch USD-CLP: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.result && payload.result !== 'success') {
    throw new Error(`unable to fetch USD-CLP: result ${payload.result}`);
  }
  return numberValue(payload.rates?.CLP, 'USD-CLP', { required: true, positive: true });
}

export async function resolveCostConfig(raw, rateFetch = fetchUsdClp) {
  const seaFreightUsd = numberValue(raw.seaFreightUsd, 'seaFreightUsd', { required: true });
  const hasExplicitInland = hasValue(raw.inlandFreightCny);
  const explicitInland = numberValue(raw.inlandFreightCny, 'inlandFreightCny');
  const payer = explicitInland === undefined ? normalizeInlandPayer(raw.inlandPayer) : undefined;
  if (explicitInland === undefined && payer === undefined) {
    throw new Error('provide inlandFreightCny or inlandPayer');
  }
  const inlandFreightCny = explicitInland
    ?? (payer === 'factory' ? 0 : DEFAULT_SELF_PAID_INLAND_FEE_CNY);
  const hasExplicitUnloading = hasValue(raw.unloadingFeeClp);
  const unloadingFeeClp = numberValue(raw.unloadingFeeClp, 'unloadingFeeClp')
    ?? DEFAULT_UNLOADING_FEE_CLP;
  const hasExplicitClearance = hasValue(raw.clearanceMiscFeeClp);
  const clearanceMiscFeeClp = numberValue(raw.clearanceMiscFeeClp, 'clearanceMiscFeeClp')
    ?? DEFAULT_CLEARANCE_MISC_FEE_CLP;
  const hasExplicitCnyClp = hasValue(raw.cnyClp);
  const cnyClp = numberValue(raw.cnyClp, 'cnyClp', { positive: true }) ?? DEFAULT_CNY_CLP;
  const hasExplicitUsdClp = hasValue(raw.usdClp);
  const usdClp = numberValue(raw.usdClp, 'usdClp', { positive: true }) ?? await rateFetch();
  const hasExplicitUsdCny = hasValue(raw.usdCny);
  const usdCny = numberValue(raw.usdCny, 'usdCny', { positive: true }) ?? (usdClp / cnyClp);
  const ivaClp = numberValue(raw.ivaClp, 'ivaClp') ?? 0;

  return {
    seaFreightUsd,
    inlandFreightCny,
    unloadingFeeClp,
    clearanceMiscFeeClp,
    usdClp,
    cnyClp,
    usdCny,
    ivaClp,
    provenance: {
      seaFreightUsd: { kind: 'explicit' },
      inlandFreightCny: hasExplicitInland
        ? { kind: 'explicit' }
        : { kind: 'derived', detail: `inlandPayer=${payer}` },
      unloadingFeeClp: hasExplicitUnloading
        ? { kind: 'explicit' }
        : { kind: 'default', detail: String(DEFAULT_UNLOADING_FEE_CLP) },
      clearanceMiscFeeClp: hasExplicitClearance
        ? { kind: 'explicit' }
        : { kind: 'default', detail: String(DEFAULT_CLEARANCE_MISC_FEE_CLP) },
      usdClp: hasExplicitUsdClp
        ? { kind: 'explicit' }
        : { kind: 'fetched', detail: USD_RATES_URL },
      cnyClp: hasExplicitCnyClp
        ? { kind: 'explicit' }
        : { kind: 'default', detail: String(DEFAULT_CNY_CLP) },
      usdCny: hasExplicitUsdCny
        ? { kind: 'explicit' }
        : { kind: 'derived', detail: 'usdClp/cnyClp' },
      ivaClp: ivaClp === 0
        ? { kind: 'estimated', detail: 'zero triggers estimate' }
        : { kind: 'explicit' },
    },
  };
}

function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows must be a non-empty array');
  return rows.map((row, index) => ({
    id: String(row.id ?? index),
    unitPriceCny: numberValue(row.unitPriceCny, `rows[${index}].unitPriceCny`, {
      required: true,
      positive: true,
    }),
    totalQuantity: numberValue(row.totalQuantity, `rows[${index}].totalQuantity`, {
      required: true,
      positive: true,
    }),
    totalVolumeM3: numberValue(row.totalVolumeM3, `rows[${index}].totalVolumeM3`, {
      required: true,
    }),
  }));
}

export function calculateLandedCosts(input) {
  const rows = validateRows(input.rows);
  const config = input.config;
  if (!config) throw new Error('missing required parameter: config');
  for (const key of [
    'seaFreightUsd',
    'inlandFreightCny',
    'unloadingFeeClp',
    'clearanceMiscFeeClp',
    'ivaClp',
  ]) numberValue(config[key], key, { required: true });
  for (const key of ['usdClp', 'cnyClp', 'usdCny']) {
    numberValue(config[key], key, { required: true, positive: true });
  }

  const totalVolumeM3 = rows.reduce((sum, row) => sum + row.totalVolumeM3, 0);
  const totalGoodsValueCny = rows.reduce(
    (sum, row) => sum + row.unitPriceCny * row.totalQuantity,
    0,
  );
  const totalGoodsValueClp = totalGoodsValueCny * config.cnyClp;
  const ivaWasEstimated = config.ivaClp === 0;
  const ivaTotalClp = ivaWasEstimated
    ? (totalGoodsValueCny / config.usdCny) * config.usdClp * 0.3 * 0.19
      + config.seaFreightUsd * config.usdClp * 0.19
    : config.ivaClp;

  const calculatedRows = rows.map(row => {
    const volumeShare = totalVolumeM3 > 0 ? row.totalVolumeM3 / totalVolumeM3 : 0;
    const rowGoodsValueClp = row.unitPriceCny * row.totalQuantity * config.cnyClp;
    const goodsValueShare = totalGoodsValueClp > 0 ? rowGoodsValueClp / totalGoodsValueClp : 0;
    const perUnitByVolume = total => total * volumeShare / row.totalQuantity;
    const goodsCostPerUnitClp = row.unitPriceCny * config.cnyClp;
    const seaFreightPerUnitClp = perUnitByVolume(config.seaFreightUsd * config.usdClp);
    const inlandFreightPerUnitClp = perUnitByVolume(config.inlandFreightCny * config.cnyClp);
    const unloadingFeePerUnitClp = perUnitByVolume(config.unloadingFeeClp);
    const clearanceMiscFeePerUnitClp = perUnitByVolume(config.clearanceMiscFeeClp);
    const ivaPerUnitClp = ivaTotalClp * goodsValueShare / row.totalQuantity;
    const unroundedLandedCostClp = goodsCostPerUnitClp
      + seaFreightPerUnitClp
      + inlandFreightPerUnitClp
      + unloadingFeePerUnitClp
      + clearanceMiscFeePerUnitClp
      + ivaPerUnitClp;

    return {
      ...row,
      rowGoodsValueClp,
      volumeShare,
      goodsValueShare,
      goodsCostPerUnitClp,
      seaFreightPerUnitClp,
      inlandFreightPerUnitClp,
      unloadingFeePerUnitClp,
      clearanceMiscFeePerUnitClp,
      ivaPerUnitClp,
      unroundedLandedCostClp,
      landedCostClp: Math.round(unroundedLandedCostClp),
    };
  });

  return {
    config,
    totals: {
      totalVolumeM3,
      totalGoodsValueCny,
      totalGoodsValueClp,
      ivaTotalClp,
      ivaWasEstimated,
    },
    rows: calculatedRows,
  };
}

async function runCli() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('usage: node calculate-landed-cost.mjs <input.json>');
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const config = await resolveCostConfig(input.config ?? {});
  process.stdout.write(`${JSON.stringify(calculateLandedCosts({ rows: input.rows, config }), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
