---
name: chile-landed-cost-calculator
description: Calculate Chile landed unit costs from normalized JSON rows for actual or explicitly provisional scenarios.
version: 0.2.0
author: Junwei Chen, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [chile, landed-cost, pricing]
---

# Chile Landed-Cost Calculator

Use `scripts/calculate-landed-cost.mjs` for normalized rows and container-level
cost pools. It is a dependency-free JSON CLI and an importable JavaScript module.

```bash
node scripts/calculate-landed-cost.mjs templates/input.example.json
```

Read [references/contract.md](references/contract.md) when preparing inputs or
interpreting fee allocation and provenance.

This module owns the result of calls made to it. The separate container-cost
workbook workflow still runs its own TypeScript engine; do not claim that workflow
uses this module or replace its engine merely by loading this skill.

Callers normalize sales units and handle workbook parsing, CBM repair, product
classification, and downstream pricing. Include all rows sharing a cost pool.
An isolated SKU cannot reproduce mixed-container allocation without its context.

Use actual inputs where available and label provisional scenarios. Preserve the
returned breakdown and parameter provenance. Apply selling-price margins to the
landed result, not directly to the supplier CNY price.

For changes to this calculator, run `node --test scripts/*.test.mjs`.
For a calculation, inspect the result's units, shares, totals, and estimate status;
rerunning the software test suite for every calculation is unnecessary.
