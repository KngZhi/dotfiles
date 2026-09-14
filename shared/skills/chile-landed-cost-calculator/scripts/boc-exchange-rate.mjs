export const BOC_RATES_URL = 'https://www.boc.cn/sourcedb/whpj/';
export const BOC_USD_QUOTE_COLUMN = '现汇卖出价';

export function parseBocUsdQuote(html, column = BOC_USD_QUOTE_COLUMN) {
  const tableRows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
    [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, cell]) =>
      cell.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/g, ' ').trim()));
  const headers = tableRows.find(row => row[0] === '货币名称' && row.includes(column));
  const usdRows = tableRows.filter(row => row[0] === '美元');
  if (!headers || usdRows.length !== 1) throw new Error('中行页面缺少唯一美元报价或指定报价列');
  const row = usdRows[0];
  const raw = row[headers.indexOf(column)];
  if (!/^\d+(\.\d+)?$/.test(raw ?? '') || Number(raw) <= 0) {
    throw new Error(`中行美元${column}不是有效正数`);
  }
  const date = row[headers.indexOf('发布日期')] ?? '';
  const time = row[headers.indexOf('发布时间')] ?? '';
  if (!/^\d{4}\/\d{2}\/\d{2}( \d{2}:\d{2}:\d{2})?$/.test(date)
      || !/^\d{2}:\d{2}:\d{2}$/.test(time)) throw new Error('中行美元报价缺少发布时间');
  return {
    usdCny: Number(`${raw}e-2`),
    quotePer100Usd: Number(raw),
    column,
    publishedAt: date.includes(' ') ? date : `${date} ${time}`,
    timezone: 'Asia/Shanghai',
    source: BOC_RATES_URL,
  };
}

export async function fetchBocUsdCny(fetchImpl = fetch) {
  const response = await fetchImpl(BOC_RATES_URL, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`无法获取中行 USD-CNY：HTTP ${response.status}`);
  return parseBocUsdQuote(await response.text()).usdCny;
}
