# General government balance, 1995–2031

Status: reviewed annual IMF data package, published at `/explorer/deficit`.

## Public meaning

The measure is general-government net lending or borrowing. A negative value is a deficit (net borrowing), a positive value is a surplus (net lending), and zero is balanced. The canonical dataset contains only:

- the balance as a percentage of GDP; and
- the same signed balance as a nominal amount in GEL.

These two forms describe the same fiscal balance. The percentage is the standard cross-country scale measure; the nominal amount shows its monetary size.

## Canonical IMF source

The sole canonical source is the IMF April 2026 World Economic Outlook workbook, dataset `IMF.RES:WEO(9.0.0)`, worksheet `Countries`, country ID `GEO`.

| Use | IMF series | Unit in source |
| --- | --- | --- |
| Public percentage | `GEO.GGXCNL_NGDP.A` | Percent of GDP |
| Public nominal amount | `GEO.GGXCNL.A` | Billions of domestic currency |
| Validation only | `GEO.NGDP_FY.A` | Fiscal-year GDP, billions of domestic currency |

The exact workbook URL, preserved file, byte count, and SHA-256 hash are recorded in `docs/Raw Data/Deficit/imf-weo-general-government-balance/source-manifest.csv`.

## Government perimeter and accounting basis

The selected IMF balance series covers general government, with the workbook composition recorded as `Central Government; Local Government`. Its methodology is GFSM 2001 and its valuation is cash. The primary domestic currency is the Georgian lari.

This perimeter and accounting basis must not be mixed with Fiscal.ge's separate state-budget expenditure or consolidated-budget revenue series. Subtracting those existing series would compare different budget boundaries and would not reproduce this IMF general-government measure.

## Coverage and actual/projection boundary

The dataset has exactly one annual observation for every year from 1995 through 2031. The IMF workbook records 2025 as the latest actual annual data:

- 1995–2025: `actual`;
- 2026–2031: `projection`.

Here, `actual` means the observation is on the non-projection side of this WEO vintage. It does not mean every historical value is an untouched Georgian administrative observation. The IMF may revise, splice, or estimate historical data to maintain a comparable WEO series.

## Units and signed values

The percentage is retained at the IMF's published three-decimal precision. The nominal IMF series is published in billions of GEL and is multiplied by 1,000,000,000 to produce an integer GEL amount. Neither published measure is calculated from Fiscal.ge's existing national GDP dataset, and neither is replaced by the validation calculation.

The sign is preserved in both fields. A row fails validation if its non-zero percentage and nominal amount have different signs.

## Extraction and validation

The deterministic generator verifies the workbook's exact size and hash, dataset version, country, sheet, series codes, frequency, units, latest-actual boundary, general-government composition, methodology, valuation, and currency. It then extracts all three required source series into 111 staging facts and creates 37 canonical rows.

For each year, the validation-only fiscal-year GDP series checks:

```text
calculated percentage = nominal balance / fiscal-year GDP × 100
```

The published percentage must reconcile within 0.02 percentage points. The April 2026 source passes for every year; the largest difference is approximately 0.0148 percentage points. This check confirms internal consistency without changing either IMF value.

The loader additionally requires contiguous unique years, safe integer GEL values, matching signs, actual years before projections, and exactly one WEO edition across the source ID, dataset version, vintage and review date. The April/October edition encoded in the source ID must agree with the source vintage. `npm run data:validate` also requires the IMF source ID to exist in the source catalog.

## WEO revisions and limitations

WEO data are vintage-specific. Future IMF releases may revise historical values, move the latest-actual boundary, and change projections. A new release therefore requires a preserved workbook, reviewed manifest, regenerated artifacts, validation evidence, and an explicit source-vintage update; it must not overwrite this source silently.

The positive 2004 general-government balance in this series is not interchangeable with older Georgian state-budget tables that present a deficit and its financing. They use different accounting presentations and may use different government boundaries.

## Reproduction

From `apps/web`:

```bash
npm run data:prepare-general-government-balance
npm run data:check-general-government-balance
npm run data:validate
```

The preparation command regenerates:

- `data/staging/general-government-balance-source-facts-1995-2031.csv` — all 111 source and validation facts with workbook cells;
- `data/imports/general-government-balance-annual-1995-2031.csv` — the two approved public measures and provenance for 37 years; and
- `data/reports/general-government-balance-annual-1995-2031-validation.json` — source identity, coverage, status boundary, and reconciliation evidence.

The check command recreates the artifacts in memory and requires a byte-for-byte match with the committed files.
