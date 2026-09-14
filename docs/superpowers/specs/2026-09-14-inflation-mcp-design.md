# Inflation in the MCP service and JSON publications

Status: approved design, 2026-09-14. Next step: implementation plan.

## 1. Outcome and scope

Serve the inflation dataset already on the site through the read-only MCP endpoint and the central bulk publications, so an AI client can answer inflation questions with the same evidence, caveats and refusal behaviour as the budget, debt, deficit, GDP and sector datasets.

In scope, as one delivery:

- a new `query_inflation` tool for monthly national CPI, the NBG target, COICOP group price changes, annual basket weights, and Fiscal.ge-derived contributions with their residual;
- inflation in `describe_coverage` and `get_sources`;
- `compare` between two months and `rank` of COICOP groups in a month;
- registered caveats, server instructions and grounding documentation;
- JSON and CSV publications, llms.txt and the `/connect` page;
- the reference fixture extended to cover all of the above.

Out of scope: city indices, product-level indices, HICP and every other price index; the price calculator; monthly or quarterly data for any other dataset; Dataset JSON-LD on the inflation pages; any change to the inflation pages, their data or their pipeline.

### 1.1 User-approved decisions (2026-09-14)

1. Serve everything the site shows, including the derived contributions, rather than only published figures.
2. Support values, the target, two-month comparison and group ranking, delivered together.
3. Add an optional `period` field to the existing response shapes rather than separate inflation tools or months encoded into `year`.
4. Publish a small envelope JSON for national CPI plus a CSV and metadata JSON for categories, rather than one ~68 MB envelope file or a new compact JSON format.

## 2. Scope amendment

`Project_Definition.md` §2C lists "MCP intents and JSON publications for inflation" as still excluded. Move exactly that item to the approved list, naming this spec. Every other §2C exclusion stays.

## 3. Data model

### 3.1 Dataset and entity

`datasetId: "inflation"`, `budgetScope: "consumer_prices"`, one entity `country.georgia` (`entityType: "country"`).

### 3.2 Series

Series IDs are the IDs already in the reviewed CSVs; none is renamed.

| Series | Level | Parent |
| --- | --- | --- |
| `cpi.headline`, `cpi.core`, `cpi.core_ex_tobacco` | `national` | none |
| `cpi.cat.01` … `cpi.cat.12` (12 COICOP divisions) | `division` | none |
| `cpi.cat.01_1` … (43 subgroups) | `subgroup` | its division |
| `cpi.target` (NBG inflation target) | `reference` | none |
| `cpi.contribution_residual` | `residual` | none |

Labels are the reviewed Georgian and English labels the site already uses.

### 3.3 Measures, units and grain

| Measure | Series | Unit | Grain and coverage |
| --- | --- | --- | --- |
| `yoy_pct` | national, groups | `percent` | monthly |
| `mom_pct` | national, groups | `percent` | monthly |
| `avg12_pct` | `cpi.headline` | `percent` | monthly |
| `index_2010` | `cpi.headline` | `index_2010_100` (new) | monthly |
| `target_pct` | `cpi.target` | `percent` | monthly, from 2015-01 |
| `basket_weight_pct` | groups | `percent` | annual, from 2012 |
| `contribution_pp` | groups, residual | `percentage_points` (new) | monthly, from 2013-01 |

`Measure` gains the seven measure names; `Unit` gains `index_2010_100` and `percentage_points`. Coverage per series and measure is derived from the loaded facts, never written down: today, for example, headline y/y starts 2004-01, core starts 2010-01, category m/m starts 2004-01 and category y/y 2005-01.

A measure a series does not publish (an index for core, a weight for a national series, a contribution for the target) is rejected with `unsupported_measure` and the series' valid measures, as `query_debt` does. It is never answered empty.

### 3.4 Periods

Monthly observations carry `period: "YYYY-MM"` and keep `year` as the calendar year of that month. Their `observationId` uses the period in the year position: `inflation:country.georgia:cpi.headline:2026-08:yoy_pct`. Annual observations — basket weights and every other dataset — have no `period` and are unchanged. `SCHEMA_VERSION` moves from `1.1.0` to `1.2.0`; the change is additive.

### 3.5 Basis

Every inflation value has `basis: "published"`. Contributions and the residual are Fiscal.ge's calculation over published inputs; that is stated by their `valueDefinition`, `valueDefinitionId` and the severe `inflation_contribution_derived` caveat, not by a new basis value.

### 3.6 Contributions and residual

`contribution_i(m) = weight_pct_i(year of m) / 100 × yoy_pct_i(m)`, computed at query time by the site's own `buildContributionIndex` (`lib/data/inflation/contributions.ts`), so MCP and the site cannot disagree. Contributions exist from `CONTRIBUTION_FIRST_YEAR` (2013).

The residual for a month is `published headline yoy_pct − Σ contributions of the requested groups` in that month. `query_inflation` appends it automatically to every `contribution_pp` response, as one extra series after the requested groups; a client never names it, and naming it returns `unknown_series`. It is not a candidate in `rank` and not a target in `compare`, because its value depends on the rest of the selection. A `contribution_pp` request that names both divisions and subgroups is rejected with `invalid_parameters`, because the two levels overlap and their sum double-counts.

### 3.7 Missing values

Missing cells return `availability: "missing"` with a bilingual reason, never zero:

- category series that end, start late or have interior gaps (currently 04.2 and 08.1 end 2011-12, 08.2 starts 2011-01, 09.2 starts 2015-01, 09.6 starts 2020-01, 12.5 and 12.6 have interior gaps);
- core series before their first month;
- groups with no weight in a year, and therefore no contribution;
- the target before the first reviewed target month (currently 2015-01, read from `nbg-inflation-target.csv`), with the reason that an earlier target is unverified in the reviewed sources — never that none existed (`inflation-cpi-national.md`, NBG target).

## 4. Tools

### 4.1 `query_inflation` (new)

Input: `{ seriesIds, measure, fromPeriod, toPeriod, expectedDataVersion? }`, periods `YYYY-MM`, range inclusive.

- Monthly measures return one cell per series per month in the range.
- `basket_weight_pct` returns one cell per series per calendar year the range touches.
- The request is sized before calculation against the existing 500-cell limit as series × months (or × years for weights); oversized requests return `result_too_large` naming the inflation CSVs.
- Errors, all from the published enum: `unknown_series` with `validChoices`; `unsupported_measure` with the series' valid measures; `year_out_of_range` naming the available period range; `invalid_parameters` for a malformed or reversed range or a mixed-level contribution request; `data_version_changed`.

The description is built from the snapshot like every other tool: period ranges are read from the facts, not written in.

### 4.2 `describe_coverage`

`inflation` joins the dataset list and the search universe. Its dataset entry keeps `years` and adds `periods: [first, last]`; each series entry adds `periods` and `periodsByMeasure`. Catalogue search matches the Georgian and English group labels. The output schema gains these optional fields.

### 4.3 `get_sources`

`datasetId` accepts `inflation`. The inflation sources are already in the snapshot.

### 4.4 `compare`

Target `{ dataset: "inflation", seriesIds }`. Monthly measures take `fromPeriod`/`toPeriod`; `basket_weight_pct` takes `fromYear`/`toYear`. The input schema requires the pair that matches the target and measure; calls valid today remain valid. Endpoints are fetched through `queryInflation` and paired on `period` (or `year` for weights), so `compare` owns no inflation arithmetic.

- `index_2010`: absolute and percentage change.
- All percent and percentage-point measures: percentage-point change only.
- Comparability runs through the existing engine: caveat `comparisonEffect` and `valueDefinitionId`.
- `comparisonId` uses the periods: `inflation:country.georgia:cpi.headline:2025-08-2026-08:yoy_pct`. Comparison endpoints carry `period`.

### 4.5 `rank`

`datasetId: "inflation"`, `dimension: "series"`, `level: "division" | "subgroup"` (required), optional `parentSeriesId` for subgroups.

- Measures: `yoy_pct`, `mom_pct`, `contribution_pp`.
- Metrics: `value` with `period`; `percentage_point_change` with `fromPeriod`/`toPeriod`. Other metrics are rejected with the existing ranking errors.
- National series, the target and the residual are never candidates. Groups without a value are reported under `exclusions` with a reason.
- Ranking entries carry `period`.

### 4.6 Server surface

Twelve tools. The per-call cell count in `lib/mcp/tools.ts` counts months for `query_inflation`. The output schema accepts the new units and the optional `period`.

## 5. Caveats, instructions and grounding

### 5.1 Registered caveats (`caveats/rules.inflation.ts`)

| Code | Severity | Comparison effect | Trigger |
| --- | --- | --- | --- |
| `inflation_contribution_derived` | severe | `none` | Any returned `contribution_pp` cell. |
| `inflation_contribution_residual` | note | `none` | The residual series is returned. |
| `inflation_contribution_weights_differ` | note | `limits` | A `contribution_pp` comparison whose endpoints fall in different calendar years. |
| `inflation_target_unverified_before_2015` | note | `none` | A `cpi.target` cell before the first reviewed target month is returned missing. |

English messages, added to `data/localization/en/service-messages.json` with Georgian counterparts written in the implementation plan, and quoted verbatim in `ai-grounding-and-caveats.md`:

- `inflation_contribution_derived`: "Contributions are Fiscal.ge's approximation from Geostat's published price changes and basket weights, not a figure Geostat publishes."
- `inflation_contribution_residual`: "The residual is the published headline minus the requested groups' contributions: everything not requested plus approximation error, not a category of goods."
- `inflation_contribution_weights_differ`: "The consumer basket is re-weighted every January, so contributions in different years rest on different weights."
- `inflation_target_unverified_before_2015`: "No earlier numeric inflation target is verified in the reviewed sources; this does not mean none existed."

Facts true of every inflation answer (the national index is a weighted mean of city indices; percentages are percentages) are stated once in the instructions, not as caveats, for the reason `nominal_gel` was retired. Category gaps are carried by each cell's `missingReason`.

### 5.2 Server instructions

Add an INFLATION section:

- Inflation is the only monthly dataset. Periods are `YYYY-MM`. Take the latest month from `describe_coverage`; never assume the current month is published.
- Annual (y/y), monthly (m/m) and 12-month average are different measures. Monthly changes do not add up to the annual change, and the 12-month average is not "annual inflation".
- 2.4 means 2.4%. Contributions are percentage points and, with the residual, sum to the published headline y/y.
- The NBG target is a reference. "Above target" compares two published numbers; it is not a verdict on the central bank.
- The national CPI is not a region's inflation, a household's cost of living, or wage growth. This service does not adjust budget figures for inflation; a client that does must present it as its own calculation.
- Do not state causes of price changes or policy success or failure.

Replace "Quarterly or monthly data" in WHAT IS NOT SERVED with monthly or quarterly data for any dataset other than inflation, city and product price indices, HICP and other price indices. Update the opening sentence to include consumer-price inflation.

### 5.3 Reference fixture

Extend `tests/factQuery/fixtures/referenceIntents.ts` from 28 to 34 intents, each with a Georgian and English prompt and values read by hand from the reviewed CSVs:

1. headline y/y for a fixed past month;
2. an index requested for core — rejected with valid measures;
3. the target in 2014 — missing, with `inflation_target_unverified_before_2015`;
4. division contributions and the residual for one month, summing to the published headline y/y;
5. `compare` of headline y/y between two months — percentage-point change;
6. `rank` of divisions by y/y in one month.

Mirror them in `docs/data-methodology/ai-reference-intents.md`.

## 6. Publications

Built in `scripts/prepare-fact-query-publications.ts` from the snapshot and listed in `manifest.json` automatically; `data:check-fact-query-publications` covers them.

- `inflation-national.json` (~5 MB): the standard observation envelope for the three national series in every published measure, the target and the basket weights.
- `inflation-categories.csv` (~3.5 MB, UTF-8 with BOM): one row per group, measure and period for `yoy_pct`, `mom_pct` and `contribution_pp`, plus the residual for the full division set and the full subgroup set. Columns carry series, level, parent, measure, period, value, unit, status, source, and a calculation column marking derived rows.
- `inflation-categories.json` (small): header, group catalogue with bilingual labels, periods by measure, definitions, sources, caveats, and the CSV's URL and SHA-256. No observations.

`inflation-cpi-national.csv` is unchanged.

The snapshot grows by about 30,000 inflation rows, to roughly 8 MB. `loadPackagedSnapshot` still parses it once per instance.

## 7. Documentation and AI surfaces

- `Project_Definition.md` §2C: the amendment in section 2.
- `docs/data-methodology/inflation-cpi-national.md`: rewrite Serving for MCP and the publications; remove "MCP serves no inflation figures".
- `docs/data-methodology/ai-grounding-and-caveats.md`: four new sections and the count.
- `docs/data-methodology/ai-reference-intents.md`: six intents.
- `docs/deployment.md`: the tool list.
- `public/llms.txt`: remove "not in the MCP connection"; add `query_inflation`, the three files, and a Georgian/English example question pair.
- `/connect` and `/en/connect`: an inflation coverage line (latest month, measures) with JSON, CSV and methodology links, following the sector line; coverage read from the catalogue.

## 8. Verification and acceptance

- Unit tests: `query_inflation` including every error path and the cell limit; inflation in `describe_coverage`, `get_sources`, `compare` and `rank`; residual plus the requested contributions equal the published headline y/y within 1e-9 for any selection; MCP contributions equal `buildContributionIndex` cell for cell; `SCHEMA_VERSION` 1.2.0 and the output schema's `period` and units; twelve tools; the publications, the CSV BOM and the hash in the metadata JSON; the registered-caveat guard and `documented.test.ts` pass with the new rules.
- `npx vitest run tests/factQuery/reference.test.ts` passes with 34 intents. A disagreement is a stop condition.
- `npm run check` and `npm run build` pass.
- `/connect` changes, so the browser suite passes against a production build.
- After deployment, verify live: `tools/list` on `https://fiscal.ge/mcp` shows `query_inflation`, one call of each inflation path answers, and the three files are served with manifest hashes. A merge or green deploy workflow is not proof.

## 9. Authority

This spec owns the decisions above. `Project_Definition.md` owns scope once amended; `inflation-cpi-national.md` owns the data and its limitations; `ai-grounding-and-caveats.md` owns caveat wording.
