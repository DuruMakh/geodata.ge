# Demography

Owner of: `data/imports/demography-population-annual.csv`, `demography-structure-annual.csv`, `demography-vital-annual.csv`, `demography-migration-annual.csv`, `demography-series-breaks.csv`, `data/reports/demography-validation.json`, `data/mappings/demography/`, `docs/Raw Data/Demography/geostat-demography/`, `apps/web/lib/data/demography/`, and `npm run data:prepare-demography` / `data:check-demography`. Approved data scope: `docs/superpowers/specs/2026-10-01-demography-data-design.md`. Source evidence and the audit: `docs/Raw Data/Demography/geostat-demography/2026-10/source-review.md`.

## Meaning and coverage

Geostat is the only source, and only its annual tables are used. Four families are carried, as reviewed observations with the exact workbook cell each value came from:

| Family | Series | Unit | Coverage |
| --- | --- | --- | --- |
| Population | `demography.population_total`, population on 1 January | persons | Georgia 2004–2026; the 11 regions and 64 municipalities 2015–2026 |
| Structure | `population_by_age_sex` (total, males, females; 19 age groups and the all-ages total) and `population_age_band` (0–14, 15–64, 65+, added from the groups) | persons | Georgia 2004–2026 |
| Vital events | `live_births`, `deaths`, `natural_increase` | persons | Georgia 2014–2025; regions and municipalities 2015–2025 |
| | `crude_birth_rate`, `crude_death_rate` (per 1,000 population), `total_fertility_rate` (children per woman), `infant_mortality_rate` (per 1,000 live births), `life_expectancy_total`, `_male`, `_female` (years) | | Georgia 2014–2025 |
| Migration | `immigrants`, `emigrants` by sex and citizenship, and `net_migration` | persons | Georgia 2012–2025 |

The files hold 923, 1,587, 2,595 and 1,274 rows. Coverage starts are decisions, not properties of the files. The archive holds more than is carried (Georgia from 1994, single years of age, the natural increase and net migration rates, mid-year population, median age, the age-dependency ratios, life tables), and that extra material is used only to validate. Not carried: census detail, population projections, marriages and divorces, per-resident budget indicators, sub-annual releases and anything read from a PDF. The 64 municipalities are those of `data/imports/municipalities.csv`, so the codes `AGENTS.md` excludes from municipal budgets (05, 42, 43, 46, 64) never appear. The six unit rows outside the 64 (`Abkhazia A.R.`, `Ajara Municipality`, `Akhalgori`, `Eredvi`, `Tighva`, `Kurta`) must hold no value in the served years, and a value there stops preparation.

## The census break and the start dates

Every population and age value carries an `estimate_basis`: `retro_projection` for 1 January 2004–2014 (Geostat's 2018 re-estimate of 1994–2014 after the 2014 census), `pre_census` for 2015–2024, `census_based` from 2025, `registered` for vital events and `border_police` for migration. The step from `retro_projection` to `pre_census` is a change of lineage, not a break: Georgia's totals are continuous (3,716,911 on 1 January 2014, 3,721,916 in 2015).

The one break inside the served data is the **census recalculation of 1 January 2025**, recorded in `demography-series-breaks.csv`. Geostat's footnote on tables 01, 02, 02-1, 06, 07 and 08 says the 2025 population and related data were recalculated from the 2024 census. Georgia moves from 3,694,608 to 3,930,428, which is **225,922 persons above** what the 2024 population, births, deaths and net migration give (the pre-census value is 3,704,506). The break applies to the population stock, the age structure and every rate with a population denominator, including the crude rates, the total fertility rate and life expectancy; it does not apply to event counts, the infant mortality rate (per live births) or border-police migration counts. **No growth, share or rate change may be computed across it, and nothing is rescaled, spliced or estimated.** Geostat's 2024 rates use the pre-census mid-year population and its 2025 rates the census-based one. The census count itself is 3,929,581 at 14 November 2024, 847 persons below the 1 January 2025 value.

Vital events start in 2014 because Geostat moves from retro-projected to registered data there (births 49,657 in 2013, 60,635 in 2014; total fertility rate 1.86 to 2.31). Migration starts in 2012 because it moves to Ministry of Internal Affairs border-police data there (net migration −35,982 in 2011, −21,521 in 2012). The life tables change method in 2002, which is outside the served years. So the 2014, 2012 and 2002 changes appear as start dates and never inside a served series.

## Definitions

From Geostat's metadata, archived under `official/metadata/`. Population is the usual residents on 1 January, occupied territories excluded; between censuses it is the census base plus natural increase and net migration. Births and deaths are counted when registered in the reference year, including events of Georgian citizens registered at Georgian representations abroad. Crude rates divide by the mid-year population. An immigrant is recorded at the border, accumulates at least 183 days of residence in the following twelve months and was not a usual resident before; an emigrant is the mirror case. Net migration is immigrants minus emigrants. Migration is released about four months after the reference year.

## Stored values, not displayed values

A Geostat workbook displays what its number format shows, not what it stores: Tbilisi's 1 January 2025 population is stored as `1335.671` (thousand) and displays as `1,335.7`. Preparation reads **stored** cell values, never displayed text, and converts thousands to whole persons by rounding after asserting each value is within 10⁻⁶ persons of a whole number (the largest observed distance is about 2×10⁻⁹, float noise). Every identity is then compared in whole persons, so the 64 municipalities sum to Georgia exactly.

Rates are the opposite case: Geostat stores some of them unrounded under a one-decimal format (the 2025 crude birth rate is stored `9.621254…` and displays `9.6`; infant mortality for 2014–2018 likewise). A rate is **carried at the decimals the workbook displays** (one decimal; two for the total fertility rate; rounded half up), because the extra digits are not published, and a test compares every carried rate with the text the workbook displays. `data/imports/municipal-population-2025.csv` holds one-decimal values (Tbilisi `1335.7`), up to 50 persons from the stored ones, and the −0.3 to +0.5 thousand "published rounding" in `municipal-population-regional-gdp.md` comes from those one-decimal values, not from Geostat's publication. Both are left unchanged until the denominator policy for per-resident figures is chosen, then changed in one recorded step.

## Identity

A label difference between tables is bridged only by a reviewed alias; fuzzy matching and row position never join anything. The reviewed files under `data/mappings/demography/` hold the four spelling variants (`Dedoplistskaro`, `Tetritskaro`, `Tkibuli` and `Tskaltubo` in the event and census tables against `Dedoplistsqaro`, `Tetritsqaro`, `Tqibuli` and `Tsqaltubo` in the population table), the census table's `Sighnaghi` and five `C. Name` city labels, the six excluded units, and the 22 citizenship labels with stable lower-case ids. The existing `geography-map.csv` and `data/imports/municipalities.csv` remain the authority for the 64 municipalities and 11 regions; identifiers are `country.georgia`, `region.*` and the two-digit municipal code. Tbilisi is one municipality and one region, and Geostat prints only the municipality row, so its region takes that row.

Seven cities (Ozurgeti, Telavi, Mtskheta, Ambrolauri, Zugdidi, Akhaltsikhe, Gori) are printed on their own rows for 1 January 2015–2017 in the population table and for 2014–2016 in the event tables; the municipality row excludes them in those years, so they are added to it, and a value on such a row outside its years stops preparation. One cell Geostat prints as `0` where no value exists (births and deaths have none) is a reviewed stray cell (table 29, `C. Gori*`, 2020, `AB85`); it is ignored at that cell and value only.

Table 33 lists only the countries large enough in each year, so `Other` changes meaning from year to year and is kept as published but is not a comparable series; a country missing from a year is inside `Other` and produces **no row, never a zero** (98 country-year pairs in 2012–2025).

## Validation

`npm run data:prepare-demography` stops, naming the condition, at the first of these, and `data/reports/demography-validation.json` records the results:

- Every archived file matches its manifest bytes and SHA-256; the municipal table 01 is the 2026-08-03 capture byte for byte; every served source is registered; each canonical input's stated served years equal the years its rows cover.
- Municipality, region and Georgia values add up **exactly**; so do age groups and bands to the total, males and females to both sexes, Georgia in the population table to the age table, births minus deaths to natural increase, immigrants minus emigrants to net migration, citizenships to the total, and the migration totals of tables 32 and 33.
- The 1 January population balances with births, deaths and net migration in every transition 1994→1995 to 2025→2026, served or not: the residual is 0 in 31 of 32, and the census step must equal exactly +225,922. Any other residual, or a moved census step, stops.
- Census anchor: all 64 municipalities are within ±1% of their census count (median −0.14%, largest 0.82%).
- Rates recomputed from counts: the crude birth rate, crude death rate, natural increase rate, net migration rate and infant mortality rate within 0.05 (observed up to 0.028, 0.047, 0.045, 0.048 and 0.044), the total fertility rate within 0.005, and the share aged 65+ and three dependency ratios from the served age bands within 0.05 (observed 0.0496). Mid-year population is the 1 January value plus half of that year's natural increase and net migration; Geostat's 2008 value is 10,147.5 persons above that, unexplained and outside the served years, so these checks run over the served years. Life expectancy in the abridged table 27 is within 0.25 years of table 28 (observed 0.158, a method difference, reported and not corrected).
- The comparison with the committed files stops on any changed value, unit, lineage or source of a row already captured.

A blank served cell, text other than Geostat's `-` marker where a number belongs, a value that is not a whole number of persons, an unreviewed label, a changed header or row order, and a value in an excluded unit each stop preparation. The report also counts the blank cells it expects: the occupied-territory rows and the city rows outside their years.

## Revisions and refresh

After the 2014 census Geostat published retro-projected results for 1994–2014 in 2018, three to four years later, and the 2024 census recalculated 2025 only. 2015–2024 may be re-estimated at a date Geostat has not announced, so today's numbers are one version of the series. A changed value is a stop-and-review event with a readable list of the first 20 differences; the pipeline never silently overwrites history.

Geostat releases vital events in late March and population and migration in April. To refresh: archive the new tables in a new `<YYYY-MM>` folder beside `2026-10` with their official URLs, byte sizes and hashes, and write its `source-manifest.csv` (including the served years); run `npm run data:prepare-demography`, which stops on any revision; inspect the diff and the validation report; then run `npm run data:check-demography` and the repository checks.

## Delivery boundary

This stage adds data only. It adds no page, route, workbook, download, MCP tool or sidebar link (the `დემოგრაფია` marker stays non-clickable), and no database import: the serving mirror, the methodology source-archive entry and the denominator policy for per-resident indicators belong to the page stage. The eleven canonical inputs are registered in `data/sources/source-documents.csv` and cited to Geostat's original files; the validation inputs and definition PDFs stay evidence. The reviewed CSVs are UTF-8 with a BOM for direct opening in Excel.
