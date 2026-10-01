# Demography: reviewed data foundation

Date: 2026-10-01

Status: Draft. Scope decisions were approved in conversation on 2026-10-01 (§2). The source audit in §4 is pending: Geostat and the cross-check hosts were not reachable from the session that wrote this draft, so no new source has been inspected. This document covers the data stage only.

## 1. Outcome and scope

Prepare a reviewed, reproducible annual dataset of Georgia's population and its components, from Geostat, ready for later pages. Four families:

| Family | Content | Coverage |
| --- | --- | --- |
| A. Population | Population on 1 January: Georgia, 11 regions, 64 municipalities | Georgia from 2004; regions and municipalities from 2015 |
| B. Structure | Population by sex and age group: 0–14, 15–64 and 65+ at minimum, finer groups where published | Georgia from 2004; regions where Geostat publishes them, from 2015 |
| C. Vital events | Live births, deaths, natural increase, total fertility rate, life expectancy at birth by sex, infant mortality | Annual; Georgia from 2004; regions where published, from 2015 |
| D. Migration | Immigrants, emigrants and net migration, by citizenship where published | Annual; Georgia; from the first year of Geostat's current method, floor 2004 |

The municipality and region sets are the existing 64 municipalities and 11 regions. The five aggregate-only codes (`05`, `42`, `43`, `46`, `64`) stay out, as in the municipal population package.

Not in this stage: pages, routes, charts, Excel, MCP, publications or any sidebar change; 2024 census detail (households, education, ethnicity, religion, language); projections; marriages and divorces; internal migration; displaced-person counts; budget-linked indicators (spending per resident, per pensioner or per child, dependency-based budget ratios); half-year or other sub-annual releases; extraction from PDF.

## 2. Decisions

User-approved on 2026-10-01:

1. Include families A–D. The census snapshot, projections and budget-linked indicators wait for their own approval.
2. The 2025 census break is shown as Geostat published it, marked as a break. No rescaling, no splicing, no second estimate line, and no growth or rate computed across the break.
3. Depth: Georgia from 2004; regions and municipalities from 2015.
4. Collection is by direct inspection of Geostat and the cross-check sources, from an environment that can reach them.

Taken in this draft, for review:

- Geostat is the only source of served values. Eurostat, UN World Population Prospects and the World Bank are cross-checks and never mixed into a served series.
- Annual data only. Sub-annual data is excluded by `AGENTS.md`, so half-year preliminary releases are not collected.
- Machine-readable tables only (XLSX, CSV or equivalent). Geostat PDF reports are archived as cross-reads and are not extracted for served values.
- Definitions are fixed at audit and recorded in the methodology: permanent resident population as of 1 January, events by the calendar year Geostat assigns, occupied territories excluded. The audit must confirm each wording from the source.
- `status` follows Geostat (`published`, `preliminary`). The census recalculation is carried by a separate break register, not by `status`.

## 3. Evidence already in the repository

All figures below are computed from files in the repository, not from outside sources.

- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx` (captured 2026-08-03) has one sheet `1`, in thousands, 1994–2026. Its footnote reads: "Based on the results of the 2024 population census, the population size and related data as of January 1, 2025 were recalculated."
- Georgia (row 5): 3,694.6k on 2024-01-01 and 3,930.4k on 2025-01-01, a change of +235.8k (+6.4%) that is a recalculation, not growth. By region the change runs from +15.0% (Imereti) to +0.4% (Guria). Across the 64 municipalities it runs from −42.4% (Khulo) to +61.0% (Ninotsminda), and 22 of 64 fall. No uniform rescaling can bridge it.
- Georgia changes for 2022, 2023 and 2024 are −39.9k, +47.7k and −41.7k. They are the largest moves before the census step and are the first cases for the balancing check in §7.
- The workbook is silent on whether 2015–2024 will be re-estimated. The published history is smooth through the 2014 census, which suggests an earlier re-estimation. The audit must re-capture and compare.
- Two population bases already coexist on the site. Dividing `nominal_gel` by `per_capita_gel` in `data/imports/gdp-overview-annual.csv` implies 3,699.6k (2024) and 3,704.5k (2025, preliminary), a pre-census basis. The municipal budget-per-resident map uses 3,930.6k for 2025. Choosing a denominator policy belongs to the later budget-linked stage; this stage records the basis of every population value so that choice can be made safely.

## 4. Source audit (pending)

For each source record: page URL, download URL, retrieval date, bytes, SHA-256, sheet or table, units, year coverage, footnotes, last-update and release status, and terms of use. Geostat's Terms of Use permitting redistribution with credit were reviewed on 2026-09-11 (`docs/Raw Data/Economy/economic-sectors/source-review.md`); each other host needs its own terms check.

Candidate tables, to be confirmed. The Geostat category numbers come from search results and are unverified.

| Need | Geostat (to inspect) | Cross-check |
| --- | --- | --- |
| A | Population (category 41): re-capture the 1 January workbook | Eurostat `demo_pjan` (Georgia included) |
| B | Demographic pyramid database; age and sex tables | Eurostat `demo_pjan`; UN World Population Prospects |
| C | Births (319), Deaths (320) and the vital-statistics tables for fertility and life expectancy | World Bank indicators; UN World Population Prospects |
| D | Migration (322) | UN; Eurostat migration tables if Georgia is present |

The audit must answer:

1. Has Geostat re-estimated 2015–2024 since the 2026-08-03 capture? Which years, by how much?
2. For each table: units, year coverage, regional and municipal availability, sex and age detail, preliminary flags, and footnotes on definitions or breaks.
3. Are births and deaths counted by registration or occurrence year? Do births, deaths and net migration exist for every year needed by the balancing check?
4. Migration: the method (border-crossing records, residence rule), the year the current method starts, and any method break.
5. Are 2025–2026 age and sex values census-based while 2004–2024 are not? Is the census-day count (14 November 2024) published, to anchor the census check?
6. What population does Geostat use for per-capita GDP (1 January or annual average), and will it be rebased on the census?
7. The release calendar for each family, for a refresh runbook.

## 5. Archive and source reader

Archive untouched originals under `docs/Raw Data/Demography/<source>/<YYYY-MM>/` with a source manifest and README, following the inflation and municipal population packages. The 2026-08-03 population capture stays where it is. Follow the existing latest-vintage retention rule; earlier files remain recoverable from git history. Register source IDs in `data/sources/source-documents.csv`. No automated production fetching.

A deterministic `scripts/prepare-demography.ts` with `--write` and `--check`, wired into `data:validate`, follows the other prepare scripts. The reader finds sheets, headers and year columns by validated content and rejects a changed layout rather than guessing.

## 6. Canonical files and missing values

Reviewed files under `data/imports/`, one per family (`demography-population-annual.csv`, `demography-structure-annual.csv`, `demography-vital-annual.csv`, `demography-migration-annual.csv`), plus `demography-series-breaks.csv`. Conventions follow `regional-economies-annual.csv`: stable lowercase ASCII `series_id` such as `demography.population_total`, geography IDs from the existing taxonomy, published precision, explicit `unit`, `status`, `source_id`, a sheet-and-cell `source_locator` and `last_reviewed_at`. Exact columns are fixed after the audit.

An unpublished, suppressed or non-numeric cell stays blank and is counted in the validation report. It is never zero and never interpolated.

The break register holds `break_id`, the series it applies to, `reference_date`, `reason` and `source_note`. Its first entry is 2025-01-01, the census recalculation, quoting Geostat's footnote. A source method change found in the audit is added the same way.

## 7. Validation and review stops

Preparation fails unless all of these hold:

1. Every archived file matches its manifest bytes and SHA-256; source IDs are registered; headers parse; coverage is derived from the file.
2. Municipality codes equal the existing 64, region IDs equal the existing 11, excluded codes are absent, and keys are unique.
3. Parts add to wholes: municipalities to regions to Georgia; sexes to total; age groups to total; births minus deaths to natural increase. Tolerance for tables published in thousands is the published rounding, observed as −0.3 to +0.5 thousand in the existing reconciliation; integer-person tables are exact. Tolerances are fixed before implementation from observed precision and are not widened to pass.
4. Balancing check: the change between consecutive 1 January values for Georgia against births minus deaths plus net migration for the calendar year. The residual is reported for every year and never corrected. A residual outside tolerance must be explained by a break-register entry (the census step) or stops preparation.
5. Census anchor: Geostat's census count against the 1 January 2025 value; the difference is reported.
6. Cross-source parity at national level against Eurostat, UN and World Bank. Differences are documented, never corrected, and expected to widen from 2025.
7. Every previously captured historical value is compared on refresh. A changed value, identity decision or definition is a stop-and-review event with a readable diff; the pipeline never silently overwrites history.

Stops for user review: re-estimation of earlier years, a changed layout, a changed definition, a table available only as PDF, an unexplained residual, a new break candidate. Tests corrupt one representative case per stop condition and show that preparation fails.

The validation report records source hashes, coverage by family, the blank-cell inventory, the balancing residual by year, the census anchor difference, cross-source differences and any reviewed revision.

Review checkpoints: first the audit findings and break register; then the canonical-data diff and validation report. Only after the data stage passes do we design pages and integrate the files into the serving mirror, downloads and MCP.

## 8. Acceptance for this data stage

Archived originals, canonical files, break register and validation report are reproducible from the reviewed sources. Published cells match the source exactly, blank cells stay blank, the 2025 break is registered, the balancing residual is reported for every year, and every stop condition is exercised by a test. Existing datasets and their public figures stay unchanged. No page, route or deployment is part of this stage.

When accepted: amend `Project_Definition.md` with a bounded demography extension (the `დემოგრაფია` sidebar marker stays non-clickable until a page spec is approved) and write `docs/data-methodology/demography.md` alongside the data.
