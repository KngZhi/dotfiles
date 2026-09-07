---
name: chile-landed-cost-calculator
description: Calculate Chile landed unit cost with shared defaults.
version: 0.2.0
author: Junwei Chen, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [chile, landed-cost, container, pricing]
    related_skills: [container-cost]
---

# Chile Landed-Cost Calculator

Provide one reusable landed-cost interface for container imports and new-product pricing. This base skill owns fee defaults, rate derivation, IVA estimation, volume/value allocation, and the final unit-cost formula; callers own their input adapters and downstream pricing policy.

## When to Use

- Calculate a Chile landed unit cost from Chinese supplier prices.
- A container workflow needs the canonical cost engine.
- A new-product workflow needs a provisional or actual landed cost before applying gross margin.
- Audit which inputs were actual, defaulted, derived, or estimated.

Do not use it for product classification, Excel parsing, CBM repair, selling-price margins, or k2046 writes.

## Interface

The deep seam is:

```js
const config = await resolveCostConfig(rawConfig, optionalRateFetch);
const result = calculateLandedCosts({ rows, config });
```

The module is `scripts/calculate-landed-cost.mjs`. It has no third-party dependencies and also works as a JSON CLI.

```bash
node scripts/calculate-landed-cost.mjs templates/input.example.json
```

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
| `clearanceMiscFeeClp` | no | Pre-arrival estimate CLP 1,350,000 |
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

Actual IVA is used when nonzero. Otherwise:

```text
estimated IVA total
= total goods CNY / usdCny × usdClp × 30% × 19%
+ seaFreightUsd × usdClp × 19%

IVA/unit = estimated IVA total × goods-value share / quantity
```

Final result:

```text
unrounded landed cost/unit
= goods + sea + inland + unloading + clearance + IVA

landed cost/unit = Math.round(unrounded landed cost/unit)
```

## Caller Responsibilities

### `container-cost`

- Parse and validate the workbook.
- Normalize socks from `双` to `打` exactly once.
- Repair/scale missing or excessive CBM.
- Resolve the Chinese workbook keys through its adapter.
- Call this calculator for the canonical cost result.
- Generate Excel comments and k2046 import output.

### `k2046-new-product-ideal-price`

- Gather a real container context when available.
- Otherwise provide an explicit scenario and label it `PROVISIONAL_ONLY`.
- Call this calculator first.
- Apply category gross-margin ranges only to the returned landed unit cost.
- Never apply margin directly to the supplier CNY price.

## Procedure

1. Identify the sales unit and normalize quantities before calling the calculator.
2. Record whether each fee and rate is actual, defaulted, or derived.
3. Provide all rows sharing the same cost pools; a single isolated SKU cannot reproduce a mixed-container allocation.
4. Resolve config, then calculate costs through the shared module.
5. Preserve the returned per-unit breakdown and estimate status.
6. Replace pre-arrival defaults with actual amounts when available, then recalculate.

## Output

The result contains:

- resolved config;
- per-parameter provenance (`explicit`, `default`, `derived`, `fetched`, or `estimated`);
- total CBM, goods values, IVA total, and `ivaWasEstimated`;
- each row's volume/value shares;
- goods, sea, inland, unloading, clearance, and IVA cost per unit;
- unrounded and rounded landed unit cost.

## Pitfalls

- Supplier CNY price is not Chile landed cost.
- A default is not an actual amount; label provisional scenarios.
- Missing sea freight must stop the calculation rather than silently become zero.
- Zero supplier price must stop the calculation; otherwise estimated shipping IVA has no valid goods-value allocation base.
- Volume-based charges disappear for zero-total-CBM input; callers must validate whether that scenario is legitimate.
- Different sales units cannot share a price comparison until normalized.
- Do not copy this formula into consumers; import or invoke the shared calculator.

## Verification

Run the dependency-free tests:

```bash
node --test scripts/calculate-landed-cost.test.mjs
```

For an end-to-end example:

```bash
node scripts/calculate-landed-cost.mjs templates/input.example.json
```

Verify each row's components sum to `unroundedLandedCostClp`, whole-container shares reconcile, and `landedCostClp` is the nearest CLP peso.
