export const DEFAULT_UNLOADING_FEE_CLP = 125_000;
export const DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP = 1_350_000;
export const DEFAULT_SELF_PAID_INLAND_FEE_CNY = 5_500;
export const DEFAULT_CNY_CLP = 135;
export const USD_RATES_URL = 'https://open.er-api.com/v6/latest/USD';

export type InlandPayer = 'factory' | 'self';

export interface ContainerConfig {
  海运费: number;
  内陆费: number;
  卸柜费: number;
  'USD-CLP': number;
  'USD-CNY': number;
  'CNY-CLP': number;
  清关杂费: number;
  IVA: number;
  货柜号: string;
  内陆费承担方?: InlandPayer;
}

export interface RateFetch {
  (): Promise<number>;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function requiredNumber(raw: Record<string, unknown>, key: string): number {
  if (!hasValue(raw[key])) {
    throw new Error(`config 缺少必填参数「${key}」`);
  }
  return parseNumber(raw[key], key, true);
}

function optionalNumber(raw: Record<string, unknown>, key: string): number | undefined {
  if (!hasValue(raw[key])) return undefined;
  return parseNumber(raw[key], key, true);
}

function parseNumber(value: unknown, key: string, allowZero: boolean): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    throw new Error(`config 参数「${key}」必须是${allowZero ? '非负' : '正'}数，收到：${String(value)}`);
  }
  return parsed;
}

export function normalizeInlandPayer(value: unknown): InlandPayer | undefined {
  if (!hasValue(value)) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['厂家', '供应商', 'factory', 'supplier'].includes(normalized)) return 'factory';
  if (['我方', '自付', '买方', 'self', 'buyer', 'us'].includes(normalized)) return 'self';
  throw new Error(`无法识别「内陆费承担方」：${String(value)}；请使用 厂家 或 我方`);
}

export async function fetchUsdClp(fetchImpl: typeof fetch = fetch): Promise<number> {
  let response: Response;
  try {
    response = await fetchImpl(USD_RATES_URL);
  } catch (error) {
    throw new Error(`无法获取实时 USD-CLP：${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    throw new Error(`无法获取实时 USD-CLP：汇率服务返回 HTTP ${response.status}`);
  }

  const payload = await response.json() as { result?: string; rates?: { CLP?: unknown } };
  if (payload.result && payload.result !== 'success') {
    throw new Error(`无法获取实时 USD-CLP：汇率服务结果为 ${payload.result}`);
  }
  return parseNumber(payload.rates?.CLP, 'USD-CLP', false);
}

/**
 * 解析 config sheet。
 *
 * 「内陆费」显式值永远优先，保证旧模板兼容。只有缺少显式值时才读取可选的
 * 「内陆费承担方」：厂家=0；我方=5500。两者都缺失时停止，避免猜测承担方。
 */
export async function resolveContainerConfig(
  raw: Record<string, unknown>,
  rateFetch: RateFetch = fetchUsdClp,
): Promise<ContainerConfig> {
  const 海运费 = requiredNumber(raw, '海运费');
  const 清关杂费 = optionalNumber(raw, '清关杂费')
    ?? DEFAULT_PRE_ARRIVAL_CLEARANCE_MISC_FEE_CLP;
  const 货柜号 = String(raw['货柜号'] ?? '').trim();
  if (!货柜号) throw new Error('config 缺少必填参数「货柜号」');

  const explicitInland = optionalNumber(raw, '内陆费');
  const payer = explicitInland === undefined
    ? normalizeInlandPayer(raw['内陆费承担方'])
    : undefined;
  if (explicitInland === undefined && payer === undefined) {
    throw new Error('config 缺少「内陆费」；请填实际金额，或用「内陆费承担方」指定 厂家/我方');
  }
  const 内陆费 = explicitInland ?? (payer === 'factory' ? 0 : DEFAULT_SELF_PAID_INLAND_FEE_CNY);
  const 卸柜费 = optionalNumber(raw, '卸柜费') ?? DEFAULT_UNLOADING_FEE_CLP;
  const cnyClp = optionalNumber(raw, 'CNY-CLP') ?? DEFAULT_CNY_CLP;
  if (cnyClp <= 0) throw new Error('config 参数「CNY-CLP」必须大于 0');

  const explicitUsdClp = optionalNumber(raw, 'USD-CLP');
  const usdClp = explicitUsdClp ?? await rateFetch();
  if (usdClp <= 0) throw new Error('config 参数「USD-CLP」必须大于 0');

  const explicitUsdCny = optionalNumber(raw, 'USD-CNY');
  const usdCny = explicitUsdCny ?? (usdClp / cnyClp);
  if (usdCny <= 0) throw new Error('config 参数「USD-CNY」必须大于 0');

  return {
    海运费,
    内陆费,
    卸柜费,
    'USD-CLP': usdClp,
    'USD-CNY': usdCny,
    'CNY-CLP': cnyClp,
    清关杂费,
    IVA: optionalNumber(raw, 'IVA') ?? 0,
    货柜号,
    ...(payer ? { 内陆费承担方: payer } : {}),
  };
}
