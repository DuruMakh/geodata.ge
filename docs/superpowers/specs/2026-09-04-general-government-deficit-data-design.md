# General government deficit data design

**Status:** Approved 2026-09-04

## 1. Purpose

Fiscal.ge will add one internationally comparable fiscal indicator: Georgia's general
government net lending or borrowing. A negative balance is a deficit and a positive balance
is a surplus.

This specification is data-only. It defines the source, observations, units, status,
provenance, and validation required before any page or visualization is designed.

## 2. Approved scope

The future deficit section will have exactly two public statistics:

1. general government net lending or borrowing as a percentage of GDP;
2. the same balance in nominal GEL.

No state-budget balance, primary balance, interest burden, revenue/expenditure breakdown,
cyclically adjusted balance, fiscal impulse, financing breakdown, or deficit-to-debt bridge
is included.

The canonical facts retain their source sign:

- negative = deficit / net borrowing;
- positive = surplus / net lending;
- zero = balanced.

The stored value is never converted to an absolute deficit magnitude. A future presentation
layer may use the appropriate Georgian deficit or surplus label while preserving the signed
value in charts, tables, downloads, and source data.

## 3. Canonical source

The sole canonical source is the International Monetary Fund's April 2026 World Economic
Outlook (WEO) entire-dataset workbook.

- Dataset: `IMF.RES:WEO(9.0.0)`
- Publication timestamp: `2026-04-14T13:00:00Z`
- Workbook update timestamp: `2026-04-15T13:00:00Z`
- Official workbook: `WEOApr2026all.xlsx`
- Official URL:
  `https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx`
- Reviewed bytes: `5,585,205`
- SHA-256: `B29239CB48F8B895D1E526070C4FDE01147BC8F6BD3B86F636363BB6BD87FE7A`
- Source sheet: `Countries`
- Country identifier: `GEO`
- Frequency: annual
- Reporting year: January through December
- General-government composition: central government and local government
- Fiscal methodology: GFSM 2001
- Valuation: cash
- Historical data source recorded by WEO: Ministry of Finance or Treasury
- Projection basis recorded by WEO: latest discussions with the authorities

The source workbook must be preserved unchanged under:

`docs/Raw Data/Deficit/imf-weo-general-government-balance/official/WEOApr2026all.xlsx`

The application must not depend on the IMF API or live workbook URL at build time. Collection
is an explicit reviewed source update, while production reads committed normalized data.

## 4. Selected IMF series

### 4.1 Percentage of GDP

- Series code: `GEO.GGXCNL_NGDP.A`
- Indicator ID: `GGXCNL_NGDP`
- Source label: `Net lending (+) / net borrowing (-), General government, Percent of GDP`
- Unit: percent
- Scale: units

This is the primary public indicator.

### 4.2 Nominal GEL

- Series code: `GEO.GGXCNL.A`
- Indicator ID: `GGXCNL`
- Source label: `Net lending (+) / net borrowing (-), General government, Domestic currency`
- Unit: Georgian lari
- Source scale: billions

The source amount is converted mechanically to GEL:

```text
balance_gel = WEO domestic-currency value * 1,000,000,000
```

The nominal balance is taken directly from WEO rather than reconstructed from Fiscal.ge's
Geostat GDP series. This preserves one internally consistent IMF vintage and avoids small
differences caused by GDP revisions or rounded ratios.

### 4.3 Validation-only GDP

- Series code: `GEO.NGDP_FY.A`
- Indicator ID: `NGDP_FY`
- Source label: `Gross domestic product (GDP), Current prices, Fiscal year, Domestic currency`
- Unit: Georgian lari
- Source scale: billions

This series is used only to validate the two selected balance series. It is not a third public
statistic and is not included in the canonical public deficit facts.

## 5. Coverage and observation status

The reviewed workbook contains one complete Georgia observation for both selected balance
series in every year from 1995 through 2031: 37 years with no gaps.

WEO metadata identifies 2025 as the latest actual annual observation. The canonical status
rule is therefore:

```text
1995-2025 -> actual
2026-2031 -> projection
```

Here `actual` means that the observation is on or before WEO's latest-actual cutoff and is
not a projection. It does not claim that every early historical value is an unadjusted
Georgian official observation: WEO can revise, splice, or estimate historical series when it
constructs a comparable country series. The methodology and source-vintage note must disclose
that boundary.

The future product must distinguish projections from actual history. A projection must never
be silently presented as an observed result.

Representative reviewed source values are:

| Year | Balance, % GDP | Balance, billion GEL | Status |
| ---: | ---: | ---: | --- |
| 1995 | -4.888 | -0.123 | actual |
| 2004 | 3.592 | 0.363 | actual |
| 2020 | -9.158 | -4.559 | actual |
| 2025 | -1.455 | -1.526 | actual |
| 2026 | -2.327 | -2.672 | projection |
| 2031 | -2.212 | -3.865 | projection |

The 2004 positive value is a general-government surplus in the WEO series. It must not be
replaced by the state-budget deficit-financing figure found in Georgia's older execution
reports; those are different perimeters and concepts.

## 6. Normalized data and provenance

The reviewed package contains:

- the immutable IMF workbook;
- a source manifest with URL, retrieval date, bytes, hash, dataset version, sheet, country,
  selected series, and coverage;
- a source-preserving staging extract for `GGXCNL_NGDP`, `GGXCNL`, and validation-only
  `NGDP_FY`;
- one canonical annual deficit CSV;
- one machine-readable validation report;
- a concise methodology document.

The proposed canonical path is:

`data/imports/general-government-balance-annual-1995-2031.csv`

Each canonical row records:

```text
year
general_government_balance_pct_gdp
general_government_balance_gel
status = actual | projection
source_id
source_dataset
source_vintage
source_sheet
source_country_id
source_percent_series_code
source_nominal_series_code
source_unit
transformation
last_reviewed_at
```

The public statistics remain only percentage of GDP and nominal GEL. The remaining columns
are provenance required to make those two figures auditable.

## 7. Validation requirements

Preparation and validation must fail on:

- a workbook hash or byte size different from the reviewed source;
- a dataset other than `IMF.RES:WEO(9.0.0)`;
- a country other than `GEO`;
- missing, duplicated, non-finite, or non-numeric observations;
- any coverage other than all years 1995-2031 for both selected balance series;
- a percentage series other than `GGXCNL_NGDP`;
- a nominal series other than `GGXCNL`;
- a validation denominator other than `NGDP_FY`;
- percentage, nominal, and validation-GDP rows with different reporting periods;
- a general-government composition that does not include central and local government;
- a methodology other than GFSM 2001 or a valuation other than cash without explicit review;
- a nominal conversion other than billions of GEL multiplied by one billion;
- different signs between the percentage and nominal values for the same year;
- the latest-actual cutoff differing from 2025 without an explicitly reviewed vintage update;
- an actual row after the source's latest-actual year or a projection row on or before it;
- normalized facts failing exact reconciliation to the selected workbook cells and unit
  conversion.

For every year, the following independent check must hold within `0.02` percentage points:

```text
100 * GGXCNL / NGDP_FY ~= GGXCNL_NGDP
```

The reviewed April 2026 workbook passes for all 37 years. The largest observed difference is
approximately `0.0148` percentage points in 1995, consistent with the source's published
precision.

## 8. Vintage and update policy

WEO is normally released in April and October, and historical observations and projections
can change between releases. Every imported value therefore belongs to a named source
vintage.

A future WEO update must:

1. preserve the new official workbook separately;
2. record its URL, bytes, SHA-256, publication date, dataset version, and latest-actual year;
3. regenerate staging, canonical facts, and validation evidence;
4. produce a year-by-year change report against the currently published vintage;
5. require human review before replacing the canonical series;
6. retain enough prior-vintage metadata to explain historical revisions.

The project does not mix values from different WEO vintages in one canonical series.

## 9. Explicit exclusions

This data package does not introduce:

- a state-budget or consolidated-budget deficit series;
- Ministry of Finance values as fallback rows inside the IMF series;
- estimates for missing IMF observations;
- a primary balance or structural balance;
- revenue, expenditure, interest, financing, or debt statistics;
- quarterly or monthly observations;
- cross-country data;
- a page, chart, component, route, navigation entry, or visual specification;
- database schema or production import changes before a separate implementation plan is
  approved.

## 10. Acceptance criteria

- The official April 2026 WEO workbook is preserved byte-for-byte with the reviewed hash.
- The staging extract preserves exactly the three reviewed Georgia series used for source
  facts and validation.
- The canonical dataset contains exactly 37 unique annual rows, 1995-2031 inclusive.
- Every canonical percentage and GEL value exactly matches the relevant WEO source value
  after the documented unit conversion.
- All 37 percentage-versus-nominal reconciliation checks pass within `0.02` percentage
  points using `NGDP_FY`.
- All 1995-2025 rows are marked actual and all 2026-2031 rows are marked projection.
- Signed surplus and deficit values are preserved without absolute-value conversion.
- No statistic beyond the two approved public measures is added.
- Regeneration is deterministic and leaves reviewed artifacts byte-identical.
- The repository's existing full data-validation suite remains green.
