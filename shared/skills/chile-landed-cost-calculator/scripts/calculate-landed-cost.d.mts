export interface RawCostConfig {
  seaFreightUsd?: unknown;
  inlandFreightCny?: unknown;
  inlandPayer?: unknown;
  unloadingFeeClp?: unknown;
  clearanceMiscFeeClp?: unknown;
  usdClp?: unknown;
  cnyClp?: unknown;
  usdCny?: unknown;
  ivaClp?: unknown;
}

export type CostProvenanceKind =
  | 'explicit'
  | 'default'
  | 'derived'
  | 'fetched'
  | 'estimated'
  | 'unspecified';

export interface CostValueProvenance {
  kind: CostProvenanceKind;
  detail?: string;
}

export type CostConfigProvenance = Record<
  | 'seaFreightUsd'
  | 'inlandFreightCny'
  | 'unloadingFeeClp'
  | 'clearanceMiscFeeClp'
  | 'usdClp'
  | 'cnyClp'
  | 'usdCny'
  | 'ivaClp',
  CostValueProvenance
>;

export interface ResolvedCostConfig {
  seaFreightUsd: number;
  inlandFreightCny: number;
  unloadingFeeClp: number;
  clearanceMiscFeeClp: number;
  usdClp: number;
  cnyClp: number;
  usdCny: number;
  ivaClp: number;
  provenance?: CostConfigProvenance;
}

export interface LandedCostRowInput {
  id: string;
  unitPriceCny: number;
  totalQuantity: number;
  totalVolumeM3: number;
}

export interface LandedCostRowResult extends LandedCostRowInput {
  rowGoodsValueClp: number;
  volumeShare: number;
  goodsValueShare: number;
  goodsCostPerUnitClp: number;
  seaFreightPerUnitClp: number;
  inlandFreightPerUnitClp: number;
  unloadingFeePerUnitClp: number;
  clearanceMiscFeePerUnitClp: number;
  ivaPerUnitClp: number;
  unroundedLandedCostClp: number;
  landedCostClp: number;
}

export interface LandedCostResult {
  config: ResolvedCostConfig;
  totals: {
    totalVolumeM3: number;
    totalGoodsValueCny: number;
    totalGoodsValueClp: number;
    ivaTotalClp: number;
    ivaWasEstimated: boolean;
  };
  rows: LandedCostRowResult[];
}

export const DEFAULT_UNLOADING_FEE_CLP: number;
export const DEFAULT_CLEARANCE_MISC_FEE_CLP: number;
export const DEFAULT_SELF_PAID_INLAND_FEE_CNY: number;
export const DEFAULT_CNY_CLP: number;
export const USD_RATES_URL: string;

export function fetchUsdClp(fetchImpl?: typeof fetch): Promise<number>;
export function normalizeInlandPayer(value: unknown): 'factory' | 'self' | undefined;
export function resolveCostConfig(
  raw: RawCostConfig,
  rateFetch?: () => Promise<number>,
): Promise<ResolvedCostConfig>;
export function calculateLandedCosts(input: {
  rows: LandedCostRowInput[];
  config: ResolvedCostConfig;
}): LandedCostResult;
