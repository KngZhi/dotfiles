import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBocUsdQuote, fetchBocUsdCny, BOC_RATES_URL } from './boc-exchange-rate.mjs';

const html = `<table><tr><th>货币名称</th><th>现汇买入价</th><th>现汇卖出价</th><th>中行折算价</th><th>发布日期</th><th>发布时间</th></tr>
<tr><td>美元</td><td>669.74</td><td>672.55</td><td>676.98</td><td>2026/09/15 00:18:23</td><td>00:18:23</td></tr></table>`;

test('selects the named selling column and converts per-100-USD quotes', () => {
  const quote = parseBocUsdQuote(html);
  assert.equal(quote.usdCny, 6.7255);
  assert.equal(quote.column, '现汇卖出价');
  assert.equal(quote.publishedAt, '2026/09/15 00:18:23');
  assert.equal(quote.timezone, 'Asia/Shanghai');
});

test('rejects missing, zero and duplicate USD quotes', () => {
  for (const broken of [html.replace('美元', '欧元'), html.replace('672.55', ''), html.replace('672.55', '0'), html + html]) {
    assert.throws(() => parseBocUsdQuote(broken), /中行/);
  }
});

test('fetches only the specified source and exposes network failures', async () => {
  assert.equal(await fetchBocUsdCny(async url => {
    assert.equal(url, BOC_RATES_URL);
    return { ok: true, text: async () => html };
  }), 6.7255);
  await assert.rejects(() => fetchBocUsdCny(async () => ({ ok: false, status: 503 })), /HTTP 503/);
  await assert.rejects(() => fetchBocUsdCny(async () => { throw new Error('offline'); }), /offline/);
});
