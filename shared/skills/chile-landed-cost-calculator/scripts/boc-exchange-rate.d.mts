export const BOC_RATES_URL: string;
export const BOC_USD_QUOTE_COLUMN: string;
export function parseBocUsdQuote(html: string, column?: string): {
  usdCny: number; quotePer100Usd: number; column: string;
  publishedAt: string; timezone: string; source: string;
};
export function fetchBocUsdCny(fetchImpl?: typeof fetch): Promise<number>;
