# Calculator Input and Result Contract

Resolve config with `resolveCostConfig(rawConfig, optionalRateFetch)`, then call
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
| `cnyClp` | no | 135 |
| `usdCny` | no | `usdClp / cnyClp` |
| `ivaClp` | no | 0 means estimate using the shared IVA formula |

At least one of `inlandFreightCny` or `inlandPayer` is required. Explicit zero values override defaults.

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

Actual IVA is used when nonzero. Otherwise use the user's operating estimate
specified on 2026-09-14, applying 30% to goods and sea freight together:

```text
estimated IVA total
= (total goods CNY / usdCny + seaFreightUsd) × usdClp × 30% × 19%

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
