# Science and culture statistics (National Statistics Office of Georgia)

Research package for the Fiscal.ge "Science and culture" hub. Approved design: `docs/superpowers/specs/2026-10-20-science-culture-design.md` (section 9). Everything here is reproducible from the files in `official/`, which are never edited. Requires Python 3 with `xlrd` 2.0.x (reads the `.xls` files); the `.xlsx` files use a small stdlib reader in `prepare.py` (`zipfile` and `xml.etree`; the shared reader of the unemployment package refuses sheet `1` of a workbook with several sheets, so it is not used here), and `node verify_independent.mjs` needs the `xlsx` (SheetJS) package of `apps/web`. The text cleaner and CSV writer are reused from the unemployment package, as in the housing package.

## Sources

All files were downloaded fresh on 2026-10-20 (UTC, 07:28–07:30, in the cloud workspace) with `curl -sSL --fail` (no retry was needed), from the links of two Geostat category pages, which are kept as HTML captures (07:28):

- Science, `https://www.geostat.ge/en/modules/categories/194` (resolves to `.../194/science`).
- Culture, `https://www.geostat.ge/en/modules/categories/615` (resolves to `.../615/culture`).

Every file link is `https://geostat.ge/media/<id>/<name>`, which redirects to `https://www.geostat.ge/media/<id>/<name>`. Each fresh download is byte-identical to the copy held in the project's `science-culture-sources` folder. The Georgian workbooks (`official/ka/`) come from the Georgian pages `https://www.geostat.ge/ka/modules/categories/194` (`.../194/metsniereba`) and `.../615` (`.../615/kultura`); those two pages are not captured. `official/ka/muzeumebis_ZiriTadi_maCveneblebi_regionebis_mixedviT.XLS` (media 79910, the Georgian museums-by-regions workbook) was not in the project's folder and was fetched in addition. Exact URLs, retrieval times (the start of each download), SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`.

| Source ID | Local file | Use |
| --- | --- | --- |
| `geostat_science_researchers` | `official/Researchers.xlsx` | Served: researchers total, women, men; by degree, age group and field of science (sheets 1–3), 2019–2024 |
| `geostat_science_rd_staff` | `official/R&D-Personal.xlsx` | Served: all R&D personnel (total, women, men), technicians, support staff, not specified, 2019–2024 |
| `geostat_science_institutions` | `official/Institutions.xlsx` | Served: institutions that conducted R&D and R&D spending (million ₾), 2019–2024 |
| `geostat_science_patents` | `official/Invention-Utility-Model.xlsx` | Served: sheets 1 (inventions) and 2 (utility models), filed applications and registered patents, 2016–2025; source Sakpatenti |
| `geostat_culture_museums` | `official/Main-charasteristics-of-Museums.xls` | Served: museums and museum types, 2005–2025; the national visitors (million) are a cross-check |
| `geostat_culture_museums_count_regions` | `official/Number-of-Museums-by-Regions.xls` | Served: museums in each of 11 regions, 2005–2025 |
| `geostat_culture_museums_regions` | `official/Main-charasteristics-of-Museums-by-Regions.xls` | Served: visitors, group tours and exhibitions, Georgia and 11 regions, 2005–2025 |
| `geostat_culture_museum_staff` | `official/Employed-Staff-in-Museums.xls` | Served: museum staff, 2020–2025 |
| `geostat_culture_theatres` | `official/Main-Indicators-Of-Professional-Theatres.xls` | Served: theatres, types and seats, 2006–2025 |
| `geostat_culture_theatre_events` | `official/Events.xls` | Served: audience, performances (2006–2025) and events (2021–2025) |
| `geostat_culture_theatre_staff` | `official/Employed-Staff-in-Theatres.xls` | Served: theatre staff, 2020–2025 |
| `geostat_culture_theatres_regions` | `official/Main-Indicators-Of-Professional-Theatres-by-Regions.xls` | Archived; its Georgia audience row is read for one cross-check |
| `geostat_culture_theatres_count_regions` | `official/Number-of-Theatres-by-Regions.xls` | Archived only |
| `geostat_science_publications`, `geostat_culture_museum_exhibits`, `geostat_culture_libraries`, `geostat_culture_libraries_regions`, `geostat_culture_publishing` | `official/Number-of-publication.xlsx` (one year, Techinform), `The-exhibits-of-Museums.xls` (2011 only), `Public-and-Universal-Libraries.xls` (2001–2008 only), `Number-of-Libraries-by-Regions.xls` (2003–2008 only), `Calculation-of-data-on-publishing-materials.xls` (2005–2020, with gaps) | Archived only: too short or too broken to serve |
| `geostat_ka_*` (13 files) | `official/ka/…` | Archived only: the Georgian versions of the served workbooks and of the by-region theatre workbooks, for labels |
| `geostat_science_page`, `geostat_culture_page` | `official/geostat-category-194-2026-10-20.html`, `…-615-…` | The page captures the file links come from |

## Outputs

- `science-culture-annual.csv`: the 1,733 served observations, one row per indicator and year, with columns `year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell`. `value` is the cell's shortest round-trip number text with a trailing `.0` removed, so xlrd and SheetJS agree (a spending of `140.19999999999999` in the XML reads `140.2`), or `0` for a `-` cell in a table where `-` means none. `published_value` is the value at its published precision: the stored double to 15 significant digits, then rounded half-up. Counts and persons have no decimals. Thousands and million ₾ keep the larger of the decimals the cell's number format shows and the decimals the stored number has: Geostat stores visitors to three decimals in cells formatted with one (`1998.924`, format `0.0`), and a stored `171` in a `0.0` cell is published `171.0`. `basis` is always `actual` and `value_status` always `official`: nothing is calculated or imputed.
- `science-culture-series-breaks.csv`: one row, `theatre_audience_2021`, in the format of the crime package, quoting Geostat's `Events.xls` footnote.
- `coverage.csv`: first and last year, count and any unavailable years inside that range for each of the 123 indicators.
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).
- `source-manifest.csv` and `source-manifest.json`.

Indicator IDs are `science_culture.{measure}.{group}`. Units: `persons`, `persons_thousand`, `count`, `count_thousand` (group tours, seats), `gel_million`.

| Measure | Unit | Groups | Years | Rows |
| --- | --- | --- | --- | --- |
| `researchers` | `persons` | `total`, `women`, `men`, `degree_{doctoral,master,bachelor,short_cycle}`, `age_{under25,25_34,35_44,45_54,55_64,65_plus}`, `field_{natural,engineering,medical,agricultural,social,humanities,not_identified}` | 2019–2024 | 120 |
| `rd_staff` | `persons` | `total`, `women`, `men`, `technicians`, `support`, `not_specified` | 2019–2024 | 36 |
| `institutions`, `rd_spending` | `count`, `gel_million` | `total` | 2019–2024 | 6 each |
| `{invention,utility}_{applications,patents}` | `count` | `local`, `foreign`, `international` | 2016–2025 | 30 each |
| `museums` | `count` | `total`, `type_{memorial,history,art,reserve,literature,other}`, 11 `region_<id>` | 2005–2025 | 378 |
| `museum_visitors`, `museum_tours`, `museum_exhibitions` | `persons_thousand`, `count_thousand`, `count` | `total`, 11 `region_<id>` | 2005–2025 | 252 each |
| `museum_staff`, `theatre_staff` | `persons` | `total`, `women`, `men`, `permanent`, `contract`, `age_under25`, `age_25_54`, `age_55_plus` | 2020–2025 | 48 each |
| `theatres` | `count` | `total`, `type_{drama,puppet,opera_ballet,youth}` | 2006–2025 | 100 |
| `theatre_seats`, `theatre_audience` | `count_thousand`, `persons_thousand` | `total` | 2006–2025 | 20 each |
| `theatre_shows` | `count` | `total`, `away`, `abroad` | 2006–2025 | 60 |
| `theatre_events` | `count` | `total`, `away`, `abroad` | 2021–2025 | 15 |

Region IDs, in the site's order: `region_tbilisi`, `region_adjara`, `region_guria`, `region_imereti`, `region_kakheti`, `region_mtskheta_mtianeti`, `region_racha_lechkhumi_kvemo_svaneti`, `region_samegrelo_zemo_svaneti`, `region_samtskhe_javakheti`, `region_kvemo_kartli`, `region_shida_kartli`.

### Gaps (listed in `coverage.csv`)

- `theatre_events.*` has no row before 2021: the four events rows of `Events.xls` print `-` in 2006–2020, which here means "not collected", not zero. (The audience and performances rows are complete.)
- No other served series has a gap.

## Cell map

`prepare.py` finds every column by its printed year and every row by its printed label, never by fixed position; an unlisted row label, region label or heading stops the run.

- **`Researchers.xlsx`** (sheets `1`, `2`, `3`): a year heading in row 2 over a `Total`, `Women`, `Men` triple of columns (checked per year). Rows by label in column A. Sheet 1: `Researchers, total` → `total`, `women`, `men` (the three columns); `Doctoral or equivalent (ISCED 8)`, `Master's or equivalent (ISCED 7)`, `Bachelor's or equivalent (ISCED 6)`, `Short-cycle tertiary (ISCED 5/4)` → the four `degree_*` (Total column). Sheet 2: `<25`, `25-34`, `35-44`, `45-54`, `55-64`, `65+` → `age_*` (Total column). Sheet 3: the seven fields of science → `field_*` (Total column). The women/men columns of the degree, age and field rows are not served. The `Researchers, total` rows of sheets 2 and 3 are checked to equal sheet 1 (and the `Researchers` row of `R&D-Personal.xlsx` too: 54 cells).
- **`R&D-Personal.xlsx`**: the same triple. `R&D personnel, total` → `total`, `women`, `men`; `Technicians and equivalent staff`, `Other supporting staff`, `Not specified` → `technicians`, `support`, `not_specified` (Total column); `Researchers` is read for the cross-check only.
- **`Institutions.xlsx`**: one column per year; `Institutions, unit` → `institutions.total`; `Total expenditure on R&D (Millions of GEL)` → `rd_spending.total`.
- **`Invention-Utility-Model.xlsx`** (sheet `1` inventions, `2` utility models; sheet 3, patents by region, is archived only): the year is in column A of each row (2016–2025). Row 2 names the procedure (`National Procedure` from column B, `International Procedure` from column F), row 3 the kind (`Number of Filed Applications`, `Number of Registered Patents`) and row 4 `Local` / `Foreign` under the national columns. So B and C are filed applications of local and foreign applicants, D and E registered patents, F the international filed applications and G the international registered patents. The `-` cells are zero (16 cells in all, for example `invention_patents.foreign` 2018 and `researchers.field_not_identified` 2022–2024): the rows add up to the totals only with them read as zero.
- **`Main-charasteristics-of-Museums.xls`**: `Number of Museums, total` → `museums.total`; `Memorial Museum`, `History/Regional Studies Museum`, `Arts Museum`, `Museum Reserve Museum`, `Literature studies Museum`, `Others Museum` → `type_memorial`, `type_history`, `type_art`, `type_reserve`, `type_literature`, `type_other`. The visitors in million persons are read for the cross-check only.
- **`Number-of-Museums-by-Regions.xls`**: the 11 region rows → `museums.region_*` (its Georgia row is not separately served).
- **`Main-charasteristics-of-Museums-by-Regions.xls`**: three blocks, each headed by a row whose second cell names it (`Number of visitors, thsd`, `Number of excursions, thsd`, `Number of exhibitions, unit`), each holding `Georgia, total` and the 11 regions → `museum_visitors`, `museum_tours`, `museum_exhibitions`.
- **`Employed-Staff-in-Museums.xls`, `Employed-Staff-in-Theatres.xls`**: a `Total`, a `Women` and a `Men` block, each with its own year heading. From the Total block: `Employed, total` → `total`, `Permanent, staff members` → `permanent`, `Under a regular contract basis (agreement)` → `contract`, and `under 25 years`, `25-54 years`, `55 years and older` → the three `age_*`; `women` and `men` are the `Employed, total` rows of the Women and Men blocks.
- **`Main-Indicators-Of-Professional-Theatres.xls`**: `Total number of theatres`, `drama, musical comedy and miniatures`, `puppet`, `opera and ballet`, `children and youth` → `theatres.total`, `type_drama`, `type_puppet`, `type_opera_ballet`, `type_youth`; `Number of seats in the hall, thsd (Including rented)` → `theatre_seats.total`.
- **`Events.xls`**: `Number of attendance at events within the country, thsd. persons*` → `theatre_audience.total`; `Number of performances (within the country)`, `of which: Number of offsite performances`, `Number of performances held abroad` → `theatre_shows.total/away/abroad`; `Number of events (within the country)`, `of which: Number of offsite events`, `Number of events held abroad` → `theatre_events.total/away/abroad`, 2021–2025 only. The participants and average-attendance rows are not served.

Region labels are matched by their exact printed text after collapsing spaces (Geostat prints ` Tbilisi`, `Adjar AR` in the museum workbooks and `Adjara AR` elsewhere, `Racha-Lechkhumi and Kvemo svaneti`, `Samegrelo-Zemo Svaneti`, `Georgia, total`).

## Checks

`python3 prepare.py` rebuilds every generated file and fails unless all of these hold; `python3 prepare.py --check` fails if a committed file differs from a rebuild. `python3 -m unittest test_validation -v` runs the regression tests, including negative controls (a changed value, a missing or duplicate row, a changed published value, parts that no longer add up).

- Every served (indicator, year) is present exactly once, and nothing else (1,733 rows); no year after 2025, no events row before 2021.
- Every value equals its source cell's number text, re-read (a `-` cell reads `0` only in the researcher, R&D staff, patent and staff workbooks), and every published value is that value rounded at the decimals above.
- Women plus men equal the total (researchers, R&D staff, museum staff, theatre staff); degrees, age groups and fields each equal all researchers; researchers plus technicians, support and not specified equal all R&D staff; permanent plus contract, and the three age groups, equal all staff; museum types and the 11 regions equal all museums; theatre types equal all theatres; all exactly.
- The 11 regions equal Georgia exactly for exhibitions and within 0.2 thousand for group tours (Geostat rounds the regional tours to one decimal in early years). For visitors they equal Georgia exactly **except in three years**, recorded in `KNOWN_DIFFERENCES` and checked to the amount: parts minus total is −0.013 thousand in 2005, −0.019 in 2013 and −0.030 in 2023 (13, 19 and 30 persons). The national file's Georgia figure agrees with the regional file's Georgia row in those years, so it is the regional rows that fall short.
- The national visitors (million persons) times 1,000 equal the regional file's Georgia row within 0.1 thousand, all 21 years.
- The audience in `Events.xls` equals the Georgia row of the by-region theatre workbook (`Number of attendants, thsd`). In 2006–2009 `Events.xls` prints the audience rounded to one decimal (`343.6`, the by-region workbook `343.644`), so there the check is that it equals the Georgia row rounded half-up to one decimal; from 2010 the two are equal exactly.
- Anchors, as published: researchers 2024 14,046 (women 7,732); R&D staff 2024 16,191; institutions 2024 66; R&D spending 2024 242.9 million ₾; invention applications from Georgian applicants 2025 79, registered 41, international applications 85; museums 2025 261; museum visitors 2025 1,998.924 thousand (Samtskhe-Javakheti 164.893); theatres 2025 53; theatre audience 2025 620.322 thousand.

`node verify_independent.mjs` re-reads the eleven served workbooks with SheetJS (the `xlsx` package of `apps/web`), with label tables written separately from `prepare.py`, and checks every row's stored value, its rounding, its year (the heading above the column, or column A of a patent row), its column heading (Total, Women, Men; the patent procedure, kind and local/foreign), its block heading (museum visitors, tours, exhibitions; the staff Total, Women and Men blocks) and its row label, plus the full set of keys. Its negative controls (altered value, omitted row, shifted year, neighbouring year column, women column read as total, wrong row, wrong sheet, a dash published as a number, a text cell served, an unrounded or wrongly rounded published value, swapped patent sheet and international column, swapped museum type and region rows, a block read from the wrong block, women read from the men block, the audience read from the average row, an events row before 2021, a year after 2025) must all be detected.

## Notes

- **Provider of the research tables.** The researcher, R&D staff and institution workbooks print "2019 – Geostat; From 2020 – Ministry of Education, Science and Youth of Georgia" as their source: Geostat for 2019, the Ministry from 2020.
- **Patents.** The patent workbook's source is the National Intellectual Property Center of Georgia, "Sakpatenti". Sakpatenti's own site (`www.sakpatenti.gov.ge`) was reachable from the cloud but no statistics tables were found on its English pages, so Geostat's copy is the source.
- **Theatre seats** are "Number of seats in the hall, thsd (Including rented)": the count includes rented halls.
- **Audience.** `Events.xls` footnote: "*2006-2020 data includes only performances." The audience (and the average attendance) of 2006–2020 therefore covers performances only; see `science-culture-series-breaks.csv`.
- **Abkhazia AR.** The by-region theatre workbook notes: "Theatres from Abkhazia AR operates in Tbilisi." Its "remaining regions" row (Abkhazia AR, Guria, Kakheti, Kvemo Kartli, Shida Kartli) is not served. The patent workbook's by-region sheet (not served) has an Abkhazia AR row.
- **Dashes.** In the researcher, R&D staff and patent workbooks a `-` is a zero cell (the rows add up only so). In the four events rows of `Events.xls` it is printed for every year before 2021 and means the figure was not collected.
- **Number formats.** The `.xlsx` and `.xls` cells use `General`, `#\ ##0`, `#\ ###`, `0.0` and `#,##0.0`; any other format stops the run.
