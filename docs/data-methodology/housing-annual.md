# Annual housing and construction data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Housing/geostat-housing-annual/`, collected on 2026-10-16 from the National Statistics Office of Georgia (Geostat). The research captures are immutable. The 3,222 served values (181 indicators), all official, appear on the Housing pages under the approved design `docs/superpowers/specs/2026-10-16-housing-design.md`; see [Serving on the Housing pages](#serving-on-the-housing-pages). Nothing is published through MCP or included in central machine-readable publications.

Geostat is the sole publisher. The package preserves 21 originals under `official/`: the six served workbooks (permits and completed objects by region, the by-type workbooks for permits and completed objects, the residential property price index compared with the 2020 average, and residential property prices in Tbilisi by district), the two English zip files the by-type workbooks come from and their five members, the other two price-index workbooks, the three construction cost index workbooks, two regional workbooks (`Construction.xlsx`, `Infrastructure-.xlsx`) and captures of Geostat's category pages 621, 698 and 655. Exact URLs, retrieval times, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the package README holds the full cell map. Six workbooks supply values; the other fifteen files are archived for provenance only and no value is read from them.

Geostat's metadata for permits and completed objects (`0509_300426_EN.PDF`, and `0509_300426_GE.PDF` in Georgian, certified 30 April 2026) is linked from the methodology page and from the cells of the regional workbooks, but is not one of the 21 archived originals. The definitions the methodology page quotes from it are Geostat's own words in each page language.

## Indicators and definitions

| Indicator IDs | Meaning | Source | Coverage |
| --- | --- | --- | --- |
| `housing.permits_count.*`, `housing.permits_area.*` | Construction permits granted: number, and total area in m² | `0503EN020101`, `0503EN020102c` | 2006–2025 |
| `housing.completed_count.*`, `housing.completed_area.*` | Completed objects (put into operation): number, and total area in m² | `0503EN020103`, `0503EN020104b` | 2006–2025 |
| `housing.price_index.*` | Residential property price index, 2020 average = 100, fourth quarter of each year | `RPPI-compared-to-2020-average.xlsx` | 2020–2025 |
| `housing.price_flat.*`, `housing.price_house.*` | Median asking price per m² of newly built flats or detached houses in a Tbilisi district, GEL, fourth quarter of each year | `Residential-property-prices-in-Tbilisi-by-district.xlsx` | 2021–2025 |

Groups are `total`, the 17 building types (`type_residential` to `type_other`; completed objects have no `holiday_camps` column), the 11 regions (`region_tbilisi`, …), each region's residential buildings (`region_<id>_residential`), the index rows `total`, `flats` and `houses`, and the ten districts (`district_gldani` … `district_chughureti`).

All rows use `basis=actual` and `value_status=official`. Nothing is calculated, interpolated or imputed.

## Identifiers

Indicator IDs are stable lowercase ASCII names `housing.{measure}.{group}`; the 181 served IDs are listed in `coverage.csv`. Source IDs are `geostat_housing_*` (the registry adds the `source.` prefix). Georgian and English labels are display data, never identifiers. `data/imports/housing-annual.csv` has one row per indicator and year, with the columns `year`, `indicator_id`, `value`, `published_value`, `unit`, `basis`, `value_status`, `source_id`, `source_sheet`, `source_cell` and `last_reviewed_at`. `value` keeps the stored cell token and `published_value` rounds half-up to the cell's number format: one decimal for the index, none for counts, areas and district prices.

## What the pages cover

Annual figures on four pages and a page for Georgia and each of the 11 regions (12 area pages), plus `/methodology/housing`, each mirrored under `/en`: Building permits and Completed buildings (number and floor area, all buildings and 17 or 16 building types, 2006–2025), Home prices (the index for all homes, flats and detached houses, 2020–2025, and the ten Tbilisi districts for new flats and houses, 2021–2025) and Regions (the 11 regions on a map and a page each for Georgia and the regions, all buildings and residential buildings). Municipality workbooks, quarterly values, 2026 and the construction cost index are not served.

## Declared data and permits of special significance

Geostat titles the permits and completed-objects tables "(the declared data)", in Georgian «დეკლარირებული მონაცემები». Its metadata says the data are based on the information provided by the architecture and supervision services that issue permits (section 13.1). Each yearly by-type permits sheet from 2012 carries a note on permits for buildings of special significance: the Ministry of Economy and Sustainable Development issued 58, 54, 63 and 60 in 2012–2015, and the LEPL Technical and Construction Supervision Agency (TCSA) 75, 87, 87, 94, 74, 91, 73, 50, 61 and 69 in 2016–2025. The English note does not say whether the tables include them; the Georgian edition introduces the number with «გარდა ამისა» ("in addition"). The pages publish the number as Geostat's note and add no figure.

## Permits, completed buildings and floor area

Metadata section 3.4: a construction permit is "An individual administrative-legal act issued by the authorized unit in accordance with the procedure and form set by the law", containing the date and schedule of construction works, the purpose of the building, stages of construction (except individual houses) and the construction terms; completion is "Final approval in a form of administrative-legal act issued by the authorized unit that the constructed object is fit for purpose and in line with the terms and conditions of respective construction permit." Section 3.1: permits include new construction and reconstruction; completed objects include only objects put into operation. The survey covers all municipal authorities that issue permits (3.3), the whole territory except the occupied regions (3.7), from 2006 (3.8). Floor area is Geostat's "total area" in m²; the metadata gives no further definition. Residential buildings are Geostat's residential column; its notes for 2022–2025 say they "include multufunctional residential complexes and individual residential buildings."

## Permits and completed buildings are not matched year for year

A permit records the schedule and terms of works and a completion is the final approval of a finished building, so a building completed in one year may have been permitted in an earlier one and a permit may be completed in later years. The pages never match permits with completions, subtract them or compare them year for year.

## Types of building and gaps

Columns are matched by printed heading, never by position, because the column order changes between years. Missing columns are gaps, not zero: pre-school establishments in the 2008 permits sheet and the 2006, 2009, 2011, 2012 and 2021 completed sheets (Georgia's total there equals the sum of the other types); children's holiday camps in the permits sheets of 2022 and 2023 only. Types are served for Georgia only; a region has its total and its residential buildings.

## Regions

The 11 regions add up to Georgia in every year for numbers and, within 1 m², for floor area; the 2024 floor areas differ by exactly the recorded amount (`KNOWN_DIFFERENCES` in `prepare.py`: permits −1 m², completed +1 m²). The residential figures are `…` (no data) for completed residential buildings of Samegrelo-Zemo Svaneti and Kakheti in 2006 and Racha-Lechkhumi and Kvemo Svaneti in 2010 and 2011, although the region totals are printed; no value is served for them.

## The home price index and the fourth quarter

The index has the 2020 average as 100, so the fourth quarter of 2020 reads 107.2 and that of 2025 159.4. Geostat publishes all quarters; the pages serve each year's fourth-quarter cell (the `IV` column) as printed and compute no annual average. A year appears once its fourth quarter is published; 2026 (quarters I and II) is not served.

## Tbilisi prices are asking prices

The district workbook's note reads: "The following table represents the median prices of 1m2 for the newly-built flats in Tbilisi, by districts. The mentioned prices are so called “offer prices”. The data is obtained using web scraping and calculating median prices." (the houses sheet says detached houses). They are asking prices of new-build homes, not transaction prices; they cover no older homes and nothing outside Tbilisi, and are not comparable with the price index. The cells are formatted `0`, so Excel shows `5874` for Vake flats in the fourth quarter of 2025, which the sheet stores as `5873.77` (`Flats` U8); `value` keeps `5873.77` and `published_value` is `5874`.

## Values as Geostat publishes them

The pages show Geostat's published values and calculate nothing: no averages, shares, growth rates, differences or totals, and no filled gaps. Counts are whole numbers; floor area is stored in m² and shown in thousand m² to one decimal in charts, tables and lists (million m² to one decimal, thousand m² below one million, in the latest-value lines); the index has one decimal; prices are whole GEL per m². Missing years are gaps, dashes and blank Excel cells, never zero. The pages describe the figures and state no causes.

## Extraction and validation

`prepare.py` locates every column by its printed heading and every row by its printed label, reads annual rows and fourth-quarter cells only, and keeps each observation's source ID, sheet and cell. `python3 -B prepare.py --check` rebuilds every output and rejects a changed value, a missing, extra or duplicate observation, a year outside an indicator's coverage, any 2026 or non-fourth-quarter value, a published value that is not the stored value rounded to the cell's format, regions or types that do not add up to Georgia (numbers exactly, areas within 1 m², apart from the recorded 2024 differences), by-type totals that differ from the regional workbook (960 cells), a region's residential buildings above its total, and an anchor differing from Geostat: permits 2025 11,578 (11,397,190 m²); completed 3,393 (3,509,126 m²); Tbilisi permits 2025 6,423,329 m²; Guria permits 150; price index 107.2 for 2020 and 159.4 for 2025; Vake flats 2025 `5873.77`. `node verify_independent.mjs` re-reads the six workbooks with SheetJS and checks all 3,222 rows, with negative controls.

## Serving on the Housing pages

`npm run data:prepare-housing` writes `data/imports/housing-annual.csv` (UTF-8 with BOM) and `data/reports/housing-validation.json`; `npm run data:check-housing` (part of `data:validate`) rebuilds both in memory and fails on any difference. The Prisma mirror table `HousingFact` (migration `20261016200000_housing`) is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows.

Routes are `/explorer/housing` with `/permits`, `/completed`, `/prices`, `/regions` and `/regions/[id]` (Georgia and the 11 regions), plus `/methodology/housing`, each mirrored under `/en`. Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years, floor area in m², prices in GEL per m², the index to one decimal, empty cells for missing values and validated links to the archived Geostat workbooks the exported values come from (`data/methodology/source-archives/housing.csv`); only the six served workbooks are listed. Internal identifiers and cell references are not exported. `/methodology/housing` publishes all 21 originals; the HTML captures download as `.txt` files. The 21 `source.geostat_housing_*` rows of `data/sources/source-documents.csv` stay out of the fact-query snapshot.

## Statistical limitations and future use

Later integration must preserve annual frequency, the fourth-quarter reading of prices, the gaps in building types and regional residential figures, and the recorded 2024 differences. Quarterly values, 2026, municipality rows, the construction cost index, prices for older homes or outside Tbilisi, any calculated ratio and any link between permits and completions would each be a separately reviewed addition.

Original sources: Geostat's [permits and completed objects](https://www.geostat.ge/en/modules/categories/621/information-about-permissions-granted-for-construction-and-completed-objects), [residential property price index](https://www.geostat.ge/en/modules/categories/698/residential-property-price-index) and [construction cost index](https://www.geostat.ge/en/modules/categories/655/construction-cost-index) pages, and the [metadata for permits and completed objects](https://www.geostat.ge/media/78698/0509_300426_EN.PDF).
