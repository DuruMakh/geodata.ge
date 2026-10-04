# Demography: reviewed data foundation

Date: 2026-10-01

Status: Draft. Scope decisions were approved in conversation on 2026-10-01 (§2). The source audit (§3, §4) was run the same day. Its evidence is in `docs/Raw Data/Demography/geostat-demography/2026-10/source-review.md`, with every archived file in `source-manifest.csv`. Six decisions taken after the audit are recorded in §2; no question remains open. This document covers the data stage only.

## 1. Outcome and scope

Prepare a reviewed, reproducible annual dataset of Georgia's population and its components, from Geostat, ready for later pages. Four families:

| Family | Content | Coverage |
| --- | --- | --- |
| A. Population | Population on 1 January: Georgia, 11 regions, 64 municipalities | Georgia from 2004; regions and municipalities from 2015; through 2026 |
| B. Structure | Population by sex and 5-year age group, with 0–14, 15–64 and 65+ derived from it | Georgia from 2004; through 2026 |
| C. Vital events | Live births, deaths and natural increase (Georgia, regions, municipalities); crude birth rate, crude death rate, total fertility rate, infant mortality rate and life expectancy at birth by sex (Georgia) | Georgia from 2014; regions and municipalities from 2015; through 2025 |
| D. Migration | Immigrants, emigrants and net migration (Georgia), by citizenship | Georgia from 2012 through 2025 |

The municipality and region sets are the existing 64 municipalities and 11 regions. The five aggregate-only codes (`05`, `42`, `43`, `46`, `64`) stay out, as in the municipal population package.

Not in this stage: pages, routes, charts, Excel, MCP, publications or any sidebar change; the 2024 census detail (households, education, nationality, language, religion, internal migration, displaced persons); age structure by region or municipality (only the census tables carry it); migration by age (table 32 is a validation input only); projections; marriages and divorces; citizenship changes; causes of death; mid-year population, the natural increase rate and the net migration rate as served series; budget-linked indicators (spending per resident, per pensioner or per child); half-year and other sub-annual releases; extraction from PDF.

## 2. Decisions

User-approved on 2026-10-01:

1. Include families A–D. The census snapshot, projections and budget-linked indicators wait for their own approval.
2. The 2025 census break is shown as Geostat published it, marked as a break. No rescaling, no splicing, no second estimate line, and no growth or rate computed across the break.
3. Depth: Georgia from 2004; regions and municipalities from 2015.
4. Collection is by direct inspection of Geostat's published tables, from an environment that can reach them.

Taken in this draft, for review:

- Geostat is the only source, for served values and for checks. The audit compared Geostat once with Eurostat, the World Bank and the UN World Population Prospects; that is a dated note in the source review and nothing depends on it.
- Annual data only. Sub-annual data is excluded by `AGENTS.md`, so half-year preliminary releases are not collected.
- Machine-readable tables only. Geostat PDF reports are archived as cross-reads and are not extracted for served values.
- Definitions follow Geostat's metadata (§4) and are recorded in the methodology.
- A column `estimate_basis` carries each value's lineage, and a break register carries the breaks (§6). `status` stays publisher-faithful.

Decided after the audit, on 2026-10-01:

1. **Start at the registered years.** Vital events from 2014 and migration from 2012, not the earlier retro-projected values. The 2014 and 2012 method changes become series start dates.
2. **Rates.** Carry crude birth rate, crude death rate, total fertility rate, infant mortality rate and life expectancy. Natural increase rate, net migration rate, mid-year population and Geostat's published ratios stay validation inputs.
3. **Precision of the shipped `data/imports/municipal-population-2025.csv`**, which holds one-decimal values while Geostat stores persons (§3): left unchanged until the denominator policy is chosen, then changed in one recorded step.
4. **Single years of age** (table 02-1, 2015–2026, exact persons) stay in the evidence package as the original file. They enter the dataset only when a page needs school-age or pension-age groups.
5. **Population and age structure before 2015** are carried from 2004 and flagged `estimate_basis = retro_projection` for 1 January 2004–2014. Geostat's metadata describes the 2018 re-estimate of 1994–2014 as covering the main demographic indicators, so these figures are retro-projected too, although the tables carry no footnote. They are the official series and the denominator any per-resident figure for 2004–2013 would need.
6. **Outside cross-checks dropped.** The Eurostat, World Bank and UN files were removed from the package and from the validation, because they mostly re-publish Geostat and add nothing the internal checks do not. Geostat's Terms of Use were reviewed on 2026-09-11, so no other licence question arises.

## 3. What the audit found

- **Source set.** Geostat lists 82 numbered tables in seven categories. The package holds 21 of them (table 01 is the existing 2026-08-03 capture, re-downloaded with identical bytes), the census population table and four metadata PDFs: 26 manifest rows, all verified by SHA-256. Table 01 being unchanged means 2015–2024 are not re-estimated.
- **The population series is exact bookkeeping.** At stored precision, the change in the 1 January population equals births minus deaths plus net migration with residual 0 persons in 31 of 32 transitions (1994→1995 to 2025→2026). The exception is 2024→2025: **+225,922**, the census recalculation (3,704,506 pre-census against 3,930,428). The census count is 3,929,581 at 14 November 2024.
- **Four breaks.** The census recalculation at 2025-01-01; vital events switching from retro-projection to registered data in 2014 (births 49,657 → 60,635, total fertility rate 1.86 → 2.31); migration switching to border-police data in 2012; life tables switching to actuarial in 2002. Starting vital events at 2014 and migration at 2012 (decision 1) keeps the last three out of the served data, so the census is the only break inside it. Counts of registered births and deaths and border-police migration do not break at the census. The population stock, age structure, mid-year population and every rate with a population denominator do, which includes the crude rates.
- **Revision precedent.** After the 2014 census, retro-projected results for 1994–2014 appeared in 2018, three to four years later. Expect 2015–2024 to be re-estimated at an unknown date, so today's numbers are one version of the series.
- **Stored precision.** Cells such as Tbilisi 2025 store `1335.671` thousand while the workbook displays `1,335.7`. At stored precision the 64 municipalities sum to Georgia exactly. The −0.3 to +0.5 thousand "published rounding" in `docs/data-methodology/municipal-population-regional-gdp.md` comes from one-decimal values, not from Geostat's publication. The reader must use stored values.
- **Two population bases on the site.** The 2025 GDP per capita implies 3,704.5k people, the pre-census 1 January 2025 estimate. The municipal budget-per-resident map uses the census-based 2025 values. Choosing a denominator policy belongs to the later budget-linked stage.
- **Identity work needed.** Four spelling variants between tables, starred city rows that are separate for 2014–2016 in event tables, one stray zero (table 29, `C. Gori*`, 2020), and migration citizenship rows that change by year: only the countries large enough in that year are listed, so `Other` is not comparable across years and a missing country is inside `Other`, not zero.

## 4. Audit answers

| Question | Answer |
| --- | --- |
| Re-estimated since 2026-08-03? | No. Table 01 is byte-identical. |
| Units, coverage, geography | Source review §1 and the manifest. Regional and municipal detail exists for population, births, deaths and natural increase; age structure is national only. |
| Births and deaths by registration or occurrence? | Registered in the reference year, including events of Georgian citizens registered abroad. |
| Migration method and start | 183 days within twelve months, Ministry of Internal Affairs records; current method from 2012; by citizenship from 2012. |
| 2025–2026 census-based, earlier years not? | Yes. The census count is published and anchors the check. |
| Population behind per-capita GDP | Mid-year population on the pre-census basis for 2024 and 2025. Whether Geostat rebases it is not stated. |
| Release calendar | Vital events late March, population and migration April; see source review §8. |

## 5. Archive and source reader

The package is `docs/Raw Data/Demography/geostat-demography/2026-10/`: `source-manifest.csv`, `source-review.md` and `official/` (tables, `metadata/`, `census-2024/`). Table 01 is referenced from the municipal package, not duplicated. Follow the latest-vintage retention rule; earlier files remain recoverable from git history. Register source IDs in `data/sources/source-documents.csv` when the canonical files exist. No automated production fetching.

A deterministic `scripts/prepare-demography.ts` with `--write` and `--check`, wired into `data:validate`, follows the other prepare scripts. The reader reads **stored** cell values, never displayed ones. Stored cells carry float noise (`3930.4279999999999`), so it converts thousands to integer persons by rounding, after asserting that each value is within 10⁻⁶ persons of a whole number (the audit's largest distance was 2×10⁻⁹). It finds sheets, headers and year blocks by validated content and rejects a changed layout rather than guessing.

## 6. Canonical files and missing values

Reviewed files under `data/imports/`, one per family (`demography-population-annual.csv`, `demography-structure-annual.csv`, `demography-vital-annual.csv`, `demography-migration-annual.csv`), plus `demography-series-breaks.csv`. Conventions follow `regional-economies-annual.csv`: stable lowercase ASCII `series_id` such as `demography.population_total`, geography IDs from the existing taxonomy, published precision, explicit `unit`, `status`, `source_id`, a sheet-and-cell `source_locator` and `last_reviewed_at`. Exact columns are fixed after the open decisions.

`estimate_basis` takes `retro_projection` (1 January 2004–2014), `pre_census` (2015–2024) or `census_based` (2025 onward) for population stock and structure; `registered` for vital events; `border_police` for migration. The step from `retro_projection` to `pre_census` is a change of lineage, not a break: the totals are continuous through 2014/2015.

An unpublished, suppressed or non-numeric cell stays blank and is counted in the validation report. It is never zero and never interpolated.

The break register holds `break_id`, the series or families it applies to, `reference_date`, `reason` and `source_note`. Its one entry for the served data is the 2025-01-01 census recalculation, applying to population stock, structure and every rate with a population denominator (including the crude rates) but not to event counts, and quoting Geostat's footnote. The 2014 and 2012 method changes are documented in the methodology as series start dates.

## 7. Validation and review stops

Tolerances come from the audit's observed precision and are not widened to pass. Preparation fails unless all of these hold:

1. Every archived file matches its manifest bytes and SHA-256; source IDs are registered; headers parse; coverage is derived from the file.
2. Municipality codes equal the existing 64, region IDs equal the existing 11, excluded codes are absent, keys are unique. Name differences are bridged only by reviewed aliases; row position is never a join key.
3. Parts add to wholes, **exactly in integer persons**: municipalities to regions to Georgia, with the starred city components added for the years they are published; sexes to total; ages to total; births minus deaths to natural increase; immigrants minus emigrants to net migration; the migration totals in tables 32 and 33 to each other.
4. Balancing check, run on the archived tables over their full range (1994–2025) including years that are not served: the change between consecutive 1 January values equals births minus deaths plus net migration exactly, in integer persons, in every transition except those the break register explains. The census step must equal the recalculation currently published (+225,922); any other residual stops preparation.
5. Census anchor: Geostat's census count is compared with the 1 January 2025 value and the difference reported (+847 persons in the audit). Municipal 1 January 2025 values must be within ±1% of their census counts (observed largest 0.82%).
6. Published rates are recomputed from counts: within 0.05 for rates published to one decimal, within 0.005 for total fertility rate. Life expectancy in the abridged table 27 is compared with table 28 within 0.25 years (observed 0.157, a method difference), reported and not corrected.
7. Every previously captured historical value is compared on refresh. A changed value, identity decision or definition is a stop-and-review event with a readable diff; the pipeline never silently overwrites history.

Stops for user review: re-estimation of earlier years, a changed layout, a changed definition, a table available only as PDF, an unexplained residual, a new break candidate, a new missing-value pattern, a display-rounded value read in place of a stored one. Tests corrupt one representative case per stop condition and show that preparation fails.

The validation report records source hashes, coverage by family, the blank-cell inventory, the balancing residual by year, the census anchor, recomputed-rate deviations and any reviewed revision.

Review checkpoints: first the audit and break register (this stage); then the canonical-data diff and validation report. Only after the data stage passes do we design pages and integrate the files into the serving mirror, downloads and MCP.

## 8. Acceptance for this data stage

Archived originals, canonical files, break register and validation report are reproducible from the reviewed sources. Published cells match the source exactly at stored precision, blank cells stay blank, the census break is registered, the 2014 and 2012 start dates are documented, the balancing residual is reported for every year, and every stop condition is exercised by a test. Existing datasets and their public figures stay unchanged. No page, route or deployment is part of this stage.

When accepted: amend `Project_Definition.md` with a bounded demography extension (the `დემოგრაფია` sidebar marker stays non-clickable until a page spec is approved), write `docs/data-methodology/demography.md` alongside the data, and add a `demography` entry to `lib/methodology/sourceInventory.ts` when the methodology page ships.

## 10. Addendum of 2026-10-03: density and citizenship groups

Approved by the user in conversation on 2026-10-03, after the data stage passed and before any page design. It amends §1 and §6; everything else in this document stands.

**Decisions**

1. **Citizenship groups.** Name only the countries Geostat lists in every year 2012–2025: Georgia, Russia, Turkey, Azerbaijan and Ukraine. Every other listed citizenship, Stateless, Not stated and Geostat's own `Other` included, goes to one computed group, so it means the same in every year. Armenia, India, the United States, China and Iran are missing from at least one year and stay inside it. Geostat's own `Other` row stays as published and is still not a comparable series. This amends §3 and §6, which treated `Other` as not comparable and offered no comparable remainder.
2. **Density, regions only.** A fifth family, `demography.population_density` from Geostat's table 03, for Georgia from 2014 and the 11 regions from 2015. The municipalities are out: no official municipal area was found, and the source that would hold one fails certificate verification from the audit environment. A municipal density waits for an approved source.
3. **Regional age structure and urban/rural split.** Approved on 2026-10-03, with the download of the 2024 census table "Population by regions, self-governed units, 5-year age groups, urban-rural settlements and sex" (111,570 bytes). A sixth family, a single snapshot of 14 November 2024, not a series: age by sex and settlement for Georgia and the 11 regions (what a regional population pyramid needs), and the urban/rural split for all 76 units. Municipal age rows are read and validated but not served.
4. **Fertility by age of mother.** The seven age-specific fertility rates of table 16 (already archived, and the source of the total fertility rate), for Georgia from 2014, in their own file. They are the components of the total fertility rate, so the census break applies to them: 2025 rates use the census-based population of women. Approved on 2026-10-03.

**Findings that shaped the decisions**

- Geostat's density is the 1 January population divided by one fixed area as of March 2014. All 156 values for 2014–2026 reproduce from the served population and the reviewed areas within the displayed rounding. The table prints no area; the areas are derived from its own 2022 column, which is stored unrounded, and the 11 regions add up to Georgia's 57,178.6706 km² (occupied territories excluded).
- Tbilisi is 504.24 km² in Geostat's convention, not the 726 km² often cited elsewhere. A page must say which area it uses.
- Before 2014 the table rests on other areas (its notes: Tbilisi's borders changed in 2006, the occupied territories were removed in 2008), so nothing earlier is served.
- The census recalculation of 1 January 2025 applies to density: the 2025 values use the census-based population and are about 6% higher. The break register gains `demography.population_density`.
- A press quote of 64.8 persons per km² for 1 January 2025 was the pre-census value; the archived table holds the census-based 68.7.

**Validation added.** Every density is recomputed from the served population and the reviewed area within 0.05; the region areas add up to Georgia's; the density table's row labels and its March-2014 note are guarded; a value for Abkhazia stops preparation; the citizenship groups add to Geostat's total and to both sexes; a named country that a year no longer lists stops preparation. Each has a test that corrupts one case.

**Census findings.** In this table `-` is "magnitude nil", a true zero, unlike the other tables where it marks an unpublished value; with it read as zero every identity holds exactly in all 75 units. The national figures equal Geostat's published census findings. Geostat's file name passes Windows' path limit in a long worktree path, so it is archived under a short name.

**Delivery.** Table 03 (`official/03-density-by-regions.xlsx`, 13,917 bytes) and the census age table (`official/census-2024/1.1-population-by-region-unit-age-settlement-sex.xlsx`) are archived, hashed and registered as the twelfth and thirteenth canonical inputs. No page, route, download, MCP data or serving-mirror import is added.
