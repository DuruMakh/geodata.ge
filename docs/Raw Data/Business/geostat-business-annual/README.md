# Annual business statistics (National Statistics Office of Georgia)

Research package for the Fiscal.ge "Business" hub. Approved design: `docs/superpowers/specs/2026-10-14-business-design.md`. Everything here is reproducible from the files in `official/`, which are never edited.

## Sources

All files were downloaded fresh on 2026-10-15 (UTC, 08:51–08:52) with `curl -L --retry 3` from Geostat's two category pages, which are kept as HTML captures:

- Statistical survey of enterprises, `https://www.geostat.ge/en/modules/categories/326` (resolves to `.../326/statistical-survey-of-enterprises`): the 15 `0502EN01xx` survey workbooks and `Remark_eng.pdf`.
- Business demography indicators, `https://www.geostat.ge/en/modules/categories/69` (resolves to `.../69/business-demography`): `Main-results.xlsx`, `Other-indicators.xlsx`, `Enterprise-births.xlsx` and `Enterprise-deaths.xlsx`.

Every file link is `https://geostat.ge/media/<id>/<name>`, which redirects to `https://www.geostat.ge/media/<id>/<name>`. `Remark_eng.pdf` is linked from the category 326 page as `https://geostat.ge/media/64609/Remark_eng.pdf`. Each fresh download is byte-identical to the copy downloaded on 2026-10-14. Exact URLs, retrieval times, SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`.

| Source ID | Local file | Use |
| --- | --- | --- |
| `geostat_business_turnover` | `official/0502EN0101_Turnover.xlsx` | Served: sales (turnover) by activity, size and region |
| `geostat_business_employed` | `official/0502EN0103_Number-of-persons-employed.xlsx` | Served: persons employed by activity, size and region |
| `geostat_business_investment` | `official/0502EN0111_Investments-in-fixed-assets.xlsx` | Served: investment in fixed assets by activity, size and region |
| `geostat_business_profit_loss` | `official/0502EN0114_Profit-and-loss.xlsx` | Served: profit and loss by activity, size and region |
| `geostat_business_demography` | `official/Main-results.xlsx` | Served: active, new and closed firms and the birth and death rates, 2014–2024 |
| `geostat_business_production_value`, `_employees`, `_earnings`, `_value_added`, `_intermediate_consumption`, `_personnel_costs`, `_purchases`, `_purchases_for_resale`, `_gender`, `_fixed_assets`, `_labour_productivity` | `official/0502EN0102_…` to `0502EN0115_…` | Archived only: the other survey tables (out of scope) |
| `geostat_business_demography_other`, `_births`, `_deaths` | `official/Other-indicators.xlsx`, `Enterprise-births.xlsx`, `Enterprise-deaths.xlsx` | Archived only |
| `geostat_business_remarks` | `official/Remark_eng.pdf` | Survey scope notes (below) |
| `geostat_business_survey_page`, `geostat_business_demography_page` | `official/geostat-category-326-2026-10-15.html`, `geostat-category-69-2026-10-15.html` | The page captures the file links come from |

`By_Regions.xlsx`, `By_kind_of_activity.xlsx` (the business register snapshot) and `Survival-of-enterprises.zip` are out of scope and not archived.

## Outputs

- `business-annual.csv`: the 4,590 served observations, one row per indicator and year, with columns `year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell`. `value` is the exact decimal token stored in the cell (a text cell would be read with its spaces removed; none of the served cells is text). `published_value` is the value as the cell displays it: the stored double to 15 significant digits, then rounded half-up to the decimals of the cell's number format, which must be one for amounts and rates and none for persons and firms. `basis` is always `actual` and `value_status` always `official`: nothing is calculated or imputed.
- `business-series-breaks.csv`: one row, `survey_scope_2006`, applying to every `business.turnover.*` and `business.employed.*` ID from `2006-01-01` (see Notes), in the demography break format.
- `coverage.csv`: first and last year, count and any unavailable years inside that range for each of the 279 indicators.
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).
- `source-manifest.csv` and `source-manifest.json`.

| Measure | Unit | Groups | Years | Rows |
| --- | --- | --- | --- | --- |
| `business.turnover.*` | `gel_million` | total, 3 sizes, 14 sectors; 11 regions | 1999–2025; regions 2006–2025 | 706 |
| `business.employed.*` | `persons` | same | same | 706 |
| `business.investment.*` | `gel_million` | same | 2006–2025 | 580 |
| `business.profit.*` | `gel_million` | same | 2006–2025 | 580 |
| `business.loss.*` | `gel_million` | same | 2006–2025 | 580 |
| `business.active.*`, `business.births.*`, `business.deaths.*` | `enterprises` | total, 18 sections, 11 regions, `region_abkhazeti`, `region_unknown` | 2014–2024 | 352 each |
| `business.birth_rate.*` | `percent` | total, 18 sections | 2014–2024 | 209 |
| `business.death_rate.*` | `percent` | total, 18 sections | 2014–2024; sections not 2016 or 2019 | 173 |

## Cell map

`prepare.py` finds every column by its printed heading and every row by the year in column A, the year heading of a block, or the printed section or region name, never by fixed position.

**Survey workbooks** (Turnover, Number of persons employed, Investments in fixed assets, Profit and loss). Each has a sheet by kind of economic activity, one by enterprise size and one by region, found by the start of the sheet name (`By kind of ec…`, `By enterprise size`, `By region…`). A table starts at its title in column A (`TURNOVER BY`, `EMPLOYED PERSONS BY`, `INVESTMENTS IN FIXED ASSETS BY`, `PROFIT BY`, `LOSS BY`; each Profit and loss sheet holds the PROFIT table, then the LOSS table). Its annual rows run from the first row with a year in column A down to the first blank row; column B, where present, reads `...` or `…`. The 2026 quarter rows lie below that blank row and are never read. The headings between the title and the first year name the columns:

- total: `Total`, `Georgia - total` or `total`, with the unit printed under it (`Mln.GEL`, `Mln. GEL` or `Persons`); the total is served from the activity sheet, and the size and region sheets' totals are checked against it;
- sizes: `Large`, `Medium`, `Small` → `size_large`, `size_medium`, `size_small`;
- sectors: `Agriculture, forestry and fishing` → `sector_a`, `Industry` → `sector_b_e`, `Construction` → `sector_f`, `Wholesale and retail trade; repair of motor vehicles and motorcycles` → `sector_g`, `Transportation and storage` → `sector_h`, `Accommodation and food service activities` → `sector_i`, `Information and communication` → `sector_j`, `Real estate activities` → `sector_l`, `Professional, scientific and technical activities` → `sector_m`, `Administrative and support service activities` → `sector_n`, `Education` → `sector_p`, `Human health and social work activities` → `sector_q`, `Arts, entertainment and recreation` → `sector_r`, `Other service activities` → `sector_s`;
- regions, by exact English text: `Tbilisi`, `Adjara AR`, `Guria`, `Imereti`, `Kakheti`, `Mtskheta-Mtianeti`, `Racha-Lechkhumi and Kvemo Svaneti`, `Samegrelo-Zemo Svaneti`, `Samtskhe-Javakheti`, `Kvemo Kartli`, `Shida Kartli` → `region_` plus the site's region ID (`region_tbilisi`, `region_adjara`, …, `region_racha_lechkhumi_kvemo_svaneti`). Region columns are read from 2006 only.

**Main-results.xlsx** (business demography):

- `By regions`: one block per year, opened by a row holding only the year in column C (the 2019 heading, C80, is stored as text), then `Total` and 13 named rows. `The city of Tbilisi` and `Racha-Lechkhumi and Kvemo Svaneti` map explicitly to `region_tbilisi` and `region_racha_lechkhumi_kvemo_svaneti`, `Abkhazeti AR` to `region_abkhazeti` and `Unknown` to `region_unknown`; the others match the survey names. Columns by heading: `Active enterprises`, `Enterprise births*`, `Enterprise deaths**`, `Enterprise birth rate (%)`, `Enterprise death rate (%)`. The `total` of all five measures comes from the `Total` row; regions serve active, births and deaths only.
- `By kind of ec.activity - YYYY` (one sheet per year 2014–2024; the year is read from the sheet name and checked against the title): the `TOTAL` row, the 18 one-letter sections A–N and P–S (letter cells trimmed, as `" I"` is printed with a space) and the `ACTIVITY UNKNOWN` row, which is read for the sum check only. Division rows (`A01` and so on) are skipped. A section O, T or U row would stop the build. Columns: `Active enterprises`, `Enterprise births*`, `Enterprise deaths**`, `Enterprise births %`, `Enterprise deaths %`. The 2016 and 2019 sheets have no death-rate column, so those section death rates are unavailable (listed in `coverage.csv`) and nothing is calculated in their place.

The `Persons employed in the population of active enterprises` column and the `By legal forms` sheet are not served.

## Checks

`python3 prepare.py` rebuilds every generated file and fails unless all of these hold; `python3 prepare.py --check` fails if a committed file differs from a rebuild. `python3 -m unittest test_validation -v` runs the regression tests, including negative controls.

- Every served (indicator, year) is present exactly once, and nothing else (4,590 rows); no year is after 2025, no source cell lies below its table's first blank row after 2025, and no survey region row is before 2006.
- Every value equals its source cell's token, re-read, and every published value is that value rounded to the cell's number format.
- Sizes, sectors and regions add up to the total within 0.15 million GEL for amounts, 2 persons for persons and exactly for firms, except in the years recorded in `KNOWN_DIFFERENCES` in `prepare.py` (and in `validation-report.json`), each of which must keep exactly its recorded difference of the printed values:
  - sizes and sectors from 2006: ±0.2 in 12 measure-years, the rounding of up to 15 printed values to one decimal (turnover sizes 2011; turnover sectors 2009 and 2025; investment sectors 2009, 2014 and 2017; profit sectors 2017; loss sectors 2012, 2013, 2020, 2021 and 2025);
  - sectors 1999–2005 for sales and jobs: the totals are 1.4–19.1 million GEL and 240–449 persons above the sectors, because until 2005 they include section K (financial and insurance), which has no column (Remark item 1);
  - regions: the 11 regions add up to less than Georgia in every year from 2006 for sales (29.8–170.1 million GEL short), jobs (901–1,413 persons short) and investment (1.1–86.7 million GEL short), and in most years for profit and loss. The workbooks print no other region and no note on the difference.
- For firms, the 13 region rows (including Abkhazeti AR and Unknown) add up exactly to the total, and the 18 sections add up exactly to the total only together with the unserved `ACTIVITY UNKNOWN` row (22,681 of 249,236 active firms and 21,615 of 56,259 births in 2024).
- Every birth (death) rate equals births (deaths) ÷ active × 100 at one decimal.
- The size and region sheets print the same total as the activity sheet (114 table-years), and each activity sheet's `TOTAL` row prints the same firms and rates as the year's `Total` by region (53 cells).
- Anchors, as published: turnover 2025 total 253725.5, large firms 173004.5, Tbilisi 200837.9; persons employed 2025 899026; investment 2025 8021.8; profit 2025 27936.1; loss 2025 7152.9; 2024 active firms 249236, births 56259, deaths 29634, birth rate 22.6.

`node verify_independent.mjs` re-reads the five served workbooks with SheetJS (the `xlsx` package of `apps/web`), with label tables written separately from `prepare.py`, and checks every row's stored value, rounding to the cell's number format, year (column A, block heading or sheet name), heading or row label and table title, plus the full set of keys. Its negative controls (altered value, omitted row, shifted year, neighbouring column, quarter row, swapped sheets, wrong region row, wrong year sheet, loss table read as profit, unrounded published value) must all be detected.

## Notes

**Survey scope** (`Remark_eng.pdf`):

- Exclusions (item 1): sections K (financial and insurance activities, from 2006), O (public administration and defence; compulsory social security), T (households as employers) and U (extraterritorial organisations), and group 47.8 (retail sale via stalls and markets); from 2006, non-commercial legal persons and entities of public law. Respondents are limited liability, joint liability and joint stock companies, limited partnerships, cooperatives and individual enterprises (item 2).
- **The 2006 change** (series break `survey_scope_2006`): until 2005 the totals include financial and insurance firms and non-commercial legal persons and entities of public law; from 2006 they do not. Only sales and jobs run before 2006, so the break applies to every `business.turnover.*` and `business.employed.*` ID. No change may be computed across 2005–2006.
- **Head-office rule** (items 3 and 5): firms are classified by principal activity and actual address. Until 2006 firms registered in one region but working in several were included only in the country total; from 2006 they are given by the location of the main office. That is why survey region values are served only from 2006, and one reason Tbilisi's share is so high.
- **Size thresholds** (item 6, and the note under each size sheet): small, at most 50 persons employed on average and an average annual turnover up to 12 million GEL; medium, 50 to 250 persons or a turnover of 12 to 60 million GEL; large, more than 249 persons or a turnover above 60 million GEL. The sheet note says "and/or" for large and "and" for medium and small. The remarks add that the total and the sum of the parts can differ because of rounding.

**Betting inside Arts.** The note under the Turnover activity sheet (C38): "The turnover of section “Arts, entertainment and recreation” includes turnover volume of enterprises engaged to betting activities where in turnover is comprised sum of each bet." So `business.turnover.sector_r` counts every bet placed, not the operators' margin.

**Births and deaths** (Main-results footnotes, e.g. By regions B170 and B171):

- "A birth amounts to the creation of a combination of production factors with the restriction that no other enterprises are involved in the event. Births do not include entries into the population due to mergers, break-ups, split off or restructuring of a set of enterprises. It does not include entries into a subpopulation resulting only from a change of activity."
- "A death amounts to the dissolution of a combination of production factors with the restriction that no other enterprises are involved in the event. Deaths do not include exits from the population due to mergers, take-overs, break-ups or restructuring of a set of enterprises. It does not include exits from a sub-population resulting only from a change of activity."

The footnotes do not mention the two-year reactivation window the design spec describes; that wording would need another source.

**Firms with unknown activity.** Each activity sheet has an `ACTIVITY UNKNOWN` row that is part of the total but of no section; in 2024 it holds 9% of active firms and 38% of births, far more than in earlier years. Its rates exceed 100% in some years (deaths 628.2% in 2020), so they are not meaningful.
