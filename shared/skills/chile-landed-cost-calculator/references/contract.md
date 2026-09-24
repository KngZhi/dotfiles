# Calculator Input and Result Contract

Resolve config with `resolveCostConfig(rawConfig, optionalUsdClpFetch, optionalUsdCnyFetch)`, then call
`calculateLandedCosts({ rows, config })` from `scripts/calculate-landed-cost.mjs`.

## Product-Row Parameters

Every row must already use the intended sales unit and adjusted container volume:

| Parameter | Required | Unit | Meaning |
|---|---|---|---|
| `id` | yes | text | SKU or stable row identifier |
| `unitPriceCny` | yes | CNY/sales unit | Normalized supplier unit price; must be >0 |
| `totalQuantity` | yes | sales units | Total normalized quantity; must be >0 |
| `totalVolumeM3` | yes | m³/row | Adjusted total row CBM; must be ≥0 |

Callers must normalize pairs/dozens and repair or allocate missing CBM before this seam. `container-cost` remains responsible for those steps.

## Cost Parameters and Defaults

| Parameter | Required from caller? | Default/derivation |
|---|---|---|
| `seaFreightUsd` | yes | No default; use the real freight or label the scenario provisional |
| `inlandFreightCny` | conditional | Explicit value wins |
| `inlandPayer` | conditional | `factory` → 0; `self` → CNY 5,500 |
| `unloadingFeeClp` | no | CLP 125,000 |
| `clearanceMiscFeeClp` | no | Pre-arrival estimate CLP 1,500,000 |
| `usdClp` | no | Fetch live from `open.er-api.com` when absent; failure is fatal |
| `cnyClp` | no | `(usdClp + 12) / usdCny`; 12 CLP fee per USD |
| `usdCny` | no | Bank of China USD spot selling quote divided by 100; failure is fatal |
| `ivaClp` | no | 0 means estimate using the shared IVA formula |
| `ivaGoodsValueUsd` | no | estimated taxable goods value per container, default 18000 USD; freight added separately |

At least one of `inlandFreightCny` or `inlandPayer` is required. Explicit zero values override defaults.
USD-CNY comes from https://www.boc.cn/sourcedb/whpj/ (`现汇卖出价`, CNY per 100 USD).
An explicit settlement or historical rate takes precedence. Do not infer this rate from CLP cross rates.
Keep the fetched quote and Beijing publication time in the caller's source record.

## Calculation

For row `i`:

```text
row goods value CLP = unitPriceCny × totalQuantity × cnyClp
goods cost/unit = unitPriceCny × cnyClp
volume share = row CBM / total CBM
goods-value share = row goods value / total goods value
```

Fees allocated by volume:

```text
sea/unit = seaFreightUsd × usdClp × volume share / quantity
inland/unit = inlandFreightCny × cnyClp × volume share / quantity
unloading/unit = unloadingFeeClp × volume share / quantity
clearance/unit = clearanceMiscFeeClp × volume share / quantity
```

Positive actual IVA takes precedence. Otherwise use the operating estimate confirmed
on 2026-09-23 ([decision](https://github.com/KngZhi/chile-ops/blob/main/decisions/2026-09-23-container-iva-estimated-taxable-value.md)).
This is a planning estimate, not a statement of statutory taxation. The per-container
goods basis defaults to USD 18000 and may be overridden (for example USD 20000).
The actual purchase value and the CNY conversion fee do not change the estimated IVA total.

```text
estimated IVA total
= (ivaGoodsValueUsd + seaFreightUsd) × usdClp × 19%

IVA/unit = estimated IVA total × goods-value share / quantity
```

Final result:

```text
unrounded landed cost/unit
= goods + sea + inland + unloading + clearance + IVA

landed cost/unit = Math.round(unrounded landed cost/unit)
```


The result includes resolved config and per-parameter provenance (`explicit`,
`default`, `derived`, `fetched`, or `estimated`), totals and `ivaWasEstimated`,
row allocation shares, each cost component, and unrounded/rounded unit costs.

Use actual freight or explicitly label the scenario provisional. Missing sea
freight and zero supplier price are rejected. Normalize units and provide all
rows sharing the cost pool. Zero-total-CBM input receives no volume-based charges;
check whether that is legitimate before relying on the result. Components must
sum to the unrounded landed cost and container allocation shares must reconcile.

The 12 CLP per USD fee applies to the derived CNY-to-CLP rate for CNY goods and inland freight. Keep `usdClp` unchanged for USD sea freight and IVA estimates. An explicit actual `cnyClp` overrides derivation; a known legacy default of 135 should be replaced when preparing a workbook.
