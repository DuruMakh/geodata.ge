# Housing and construction statistics (National Statistics Office of Georgia)

Research package for the Fiscal.ge "Housing and construction" hub. Approved design: `docs/superpowers/specs/2026-10-16-housing-design.md`. Everything here is reproducible from the files in `official/`, which are never edited. Requires Python 3 with `xlrd` 2.0.x (reads the `.xls` files); the `.xlsx` files use the worksheet reader shared with the unemployment package, and `node verify_independent.mjs` needs the `xlsx` (SheetJS) package of `apps/web`.

## Sources

All files were downloaded fresh on 2026-10-16 (UTC, 16:49–16:50) with `curl -sSL --fail`, one retry on failure (the only reset, on `Construction.xlsx`, succeeded on the retry), from the links of three Geostat category pages, which are kept as HTML captures (16:50):

- Permissions and completed objects, `https://www.geostat.ge/en/modules/categories/621` (resolves to `.../621/information-about-permissions-granted-for-construction-and-completed-objects`): the two regional workbooks and the two zips.
- Residential property price index, `https://www.geostat.ge/en/modules/categories/698` (resolves to `.../698/residential-property-price-index`): the three RPPI workbooks and the Tbilisi district prices.
- Construction cost index, `https://www.geostat.ge/en/modules/categories/655` (resolves to `.../655/construction-cost-index`): the three CCI workbooks.

`Construction.xlsx` and `Infrastructure-.xlsx` are in the project's `source-urls.txt` but are not linked from these three pages; their source page is recorded as `https://www.geostat.ge/en/`. Every file link is `https://geostat.ge/media/<id>/<name>`, which redirects to `https://www.geostat.ge/media/<id>/<name>`. Each fresh download is byte-identical to the copy held in the project's `housing-sources` folder. Exact URLs, retrieval times (the start of each download), SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`. The two zips were unzipped into `official/Permissions_ENG/` and `official/Completed_ENG/`; their members carry the zip's URL and time in the manifest.

| Source ID | Local file | Use |
| --- | --- | --- |
| `geostat_housing_permits_regions` | `official/0503EN020101_Permissions.xls` | Served: permits by region, number and m², 2006–2025 |
| `geostat_housing_completed_regions` | `official/0503EN020103_Completed-objects.xls` | Served: completed objects by region, number and m², 2006–2025 |
| `geostat_housing_permits_types` | `official/Permissions_ENG/0503EN020102c_Permissions by type_ 2006-2025 ENG.xls` | Served: permits by building type, Georgia and each region's residential buildings |
| `geostat_housing_completed_types` | `official/Completed_ENG/0503EN020104b_Completed by type_ 2006-2025 ENG.xls` | Served: the same for completed objects |
| `geostat_housing_price_index` | `official/RPPI-compared-to-2020-average.xlsx` | Served: residential property price index, 2020 average = 100, fourth quarters 2020–2025 |
| `geostat_housing_tbilisi_prices` | `official/Residential-property-prices-in-Tbilisi-by-district.xlsx` | Served: Tbilisi offer prices per m² by district, fourth quarters 2021–2025 |
| `geostat_housing_permits_zip`, `geostat_housing_completed_zip` | `official/Permissions_ENG.zip`, `official/Completed_ENG.zip` | Archived only: the zips the by-type files come from |
| `geostat_housing_permits_municipalities`, `geostat_housing_permits_quarterly`, `geostat_housing_completed_quarterly` | `…/0503EN020102a…`, `…/0503EN020102b…`, `…/0503EN020104a…` | Archived only: municipalities, and the 2019–2026 quarterly by-type files |
| `geostat_housing_price_index_quarterly`, `geostat_housing_price_index_annual` | `official/RPPI-compared-to-previous-quarter.xlsx`, `…-the-same-quarter-of-previous-year.xlsx` | Archived only |
| `geostat_housing_cci_monthly`, `geostat_housing_cci_2022`, `geostat_housing_cci_annual` | `official/CCI-previous-month=100.xlsx`, `CCI-2022-February=100.xlsx`, `CCI-same-month-of-the-previous-year=100.xlsx` | Archived only: construction cost index |
| `geostat_housing_construction`, `geostat_housing_infrastructure` | `official/Construction.xlsx`, `official/Infrastructure-.xlsx` | Archived only: regional construction workbook and dwelling infrastructure |
| `geostat_housing_permits_page`, `geostat_housing_prices_page`, `geostat_housing_cost_page` | `official/geostat-category-621-2026-10-16.html`, `…-698-…`, `…-655-…` | The page captures the file links come from |

## Outputs

- `housing-annual.csv`: the 3,222 served observations, one row per indicator and year, with columns `year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell`. `value` is the stored cell's shortest round-trip number text with a trailing `.0` removed, so xlrd and SheetJS agree (a price stored as `2490.1999999999998` in the XML reads `2490.2`). `published_value` is the value as the cell displays it: the stored double to 15 significant digits, then rounded half-up to the cell format's decimals: one for the index, none for district prices, and whole numbers for counts and square metres. `basis` is always `actual` and `value_status` always `official`: nothing is calculated or imputed.
- `coverage.csv`: first and last year, count and any unavailable years inside that range for each of the 181 indicators.
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).
- `source-manifest.csv` and `source-manifest.json`.

Units: `count`, `square_metres`, `index_2020`, `gel_per_square_metre`.

| Measure | Unit | Groups | Years | Rows |
| --- | --- | --- | --- | --- |
| `housing.permits_count.*`, `housing.permits_area.*` | `count`, `square_metres` | `total`, 11 `region_<id>`, `type_<t>` (17 types), 11 `region_<id>_residential` | 2006–2025 (types and residential: see Gaps) | 781 each |
| `housing.completed_count.*`, `housing.completed_area.*` | `count`, `square_metres` | `total`, 11 regions, `type_<t>` (16 types, no `holiday_camps`), 11 `region_<id>_residential` | 2006–2025 (see Gaps) | 771 each |
| `housing.price_index.{total,flats,houses}` | `index_2020` | Total, Flats, Detached houses | 2020–2025 | 18 |
| `housing.price_flat.district_<d>`, `housing.price_house.district_<d>` | `gel_per_square_metre` | 10 districts | 2021–2025 | 50 each |

Region IDs, in the site's order: `region_tbilisi`, `region_adjara`, `region_guria`, `region_imereti`, `region_kakheti`, `region_mtskheta_mtianeti`, `region_racha_lechkhumi_kvemo_svaneti`, `region_samegrelo_zemo_svaneti`, `region_samtskhe_javakheti`, `region_kvemo_kartli`, `region_shida_kartli`. Districts: `gldani`, `didube`, `vake`, `isani`, `krtsanisi`, `mtatsminda`, `nadzaladevi`, `saburtalo`, `samgori`, `chughureti`. Type IDs: `residential`, `trade`, `administrative`, `hotels`, `cafes`, `industrial`, `farm`, `fuel`, `parking`, `education`, `preschool`, `health`, `sports`, `culture`, `pharmacy`, `holiday_camps`, `other`.

### Gaps (listed in `coverage.csv`)

- Pre-school buildings: no column in the 2008 permits sheet, and none in the completed sheets of 2006, 2009, 2011, 2012 and 2021. Georgia's total there equals the sum of the other types.
- `type_holiday_camps`: a permits column in 2022 and 2023 only; the completed sheets have none.
- Completed residential buildings of a region are `…` (no data), number and area, for Samegrelo-Zemo Svaneti and Kakheti in 2006 and Racha-Lechkhumi and Kvemo Svaneti in 2010 and 2011, although the region's total is printed. No value is served for them.

## Cell map

`prepare.py` finds every column by its printed heading and every row by its printed label, never by fixed position.

**Regional workbooks** (`0503EN020101` sheet `permissions`, `0503EN020103` sheet `completed objects`). A year heading row (column A reads `Region`) holds each year once, over the first column of a pair; the row below labels the pair `number` and `space, m2`. Rows are found by the label in column A: `Georgia- total` → `total`, `Tbilisi` (printed `Tbilisi  `), `Adjara AR`, `Guria`, `Imereti`, `Kakheti`, `Mtskheta-Mtianeti`, `Racha-Lechkhumi and Kvemo Svaneti`, `Samegrelo-Zemo Svaneti`, `Samtskhe-Javakheti`, `Kvemo Kartli`, `Shida Kartli` → the site's region IDs. The last column pair, headed `2026` over `January-June`, is checked to be exactly that and is never served.

**By-type workbooks** (`0503EN020102c`, `0503EN020104b`): one sheet per year (`2006` … `2025`; the completed 2012 sheet is named `2012 ` with a trailing space and is matched without it). In each sheet:

- The heading row is the one printing the residential column; the `Total` column is found in the rows above. Every heading must match a type, or the run stops. A heading is compared in lower case, on the text before its first line break, with spaces, hyphens and one trailing "s" removed: `Residential buildings` (printed with trailing spaces) → `residential`, `Trade buildings` → `trade`, `Administrative buildings` / `Administrati-ve buildings` → `administrative`, `Hotels`, `Cafes and restaurents` / `restourants` → `cafes`, `Industrial buildings and warehouses`, `Farm buildings`, `Refuelling stations` → `fuel`, `Car parkings` → `parking`, `Educational institutions` → `education`, `Pre-school establish-ments` / `Pre-schools establish-ments` → `preschool`, `Health establishments`, `Sports buildings and grounds`, `Cultural establish-ments` → `culture`, `Chemist,s shop(s)` → `pharmacy`, `Children's holiday camp` → `holiday_camps`, `Other`. Column order moves from year to year (the pre-school column is the third type column in the 2006 permits sheet and the tenth in 2025), so no position is used; the type columns found are compared with the types expected for the year.
- Each region is a number row followed by an area row, labelled in column A on the number row only (`Georgia- total` → the Georgia type values; `Tbilisi city`, `Racha-lechkhumi and Kvemo Svaneti` and the other names → regions, whose `residential` column is served as `region_<id>_residential`). From 2018 column B also prints `number` / `area m2`, which is checked where it is not a data column; the 2006–2017 sheets have a `number/area m2` and a 1..17 numbering row above the data instead. The completed 2010 sheet prints the labels `Mtskheta-Mtianeti` and `Samtskhe-Javakheti` on rows of their own, with the number and area rows below; a label row with no values is read that way, and the totals check below would fail if any pair were misread.
- `…` means no data and is never read as zero.

**`RPPI-compared-to-2020-average.xlsx`** (sheet `RPPI`): a year heading in row 3 over only its first quarter column, quarter labels `I`…`IV` in row 4, rows `Total`, `Flats`, `Detached houses`. The year's column is the one headed `IV`; the 2026 columns (quarters I and II) are not served. 2020 total fourth quarter is 107.2077, shown `107.2`; 2025 is 159.3709, shown `159.4`.

**`Residential-property-prices-in-Tbilisi-by-district.xlsx`** (sheets `Flats` and `Detached houses`): the year heading in row 4 (`District` in column A), quarter labels in row 5 (`I` … `IV`; the houses sheet prints `IV ` with a trailing space), one row per district named in column A. The `IV` columns of 2021–2025 are served; the 2026 columns are not. The cells are formatted `0`, so Excel shows `5874` for Vake flats in the fourth quarter of 2025, which the sheet stores as `5873.77` (`Flats` U8). `value` keeps `5873.77` and `published_value` is `5874`.

## Checks

`python3 prepare.py` rebuilds every generated file and fails unless all of these hold; `python3 prepare.py --check` fails if a committed file differs from a rebuild. `python3 -m unittest test_validation -v` runs the regression tests, including negative controls.

- Every served (indicator, year) is present exactly once, and nothing else (3,222 rows); no year is after 2025 and no price is from another quarter than IV.
- Every value equals its source cell's number text, re-read, and every published value is that value rounded to the cell's number format. A few 2023 and 2024 permit areas are stored with decimals in `General` cells (for example `8737406.53`, Georgia's residential permits area in 2024); they are published in whole square metres (`8737407`) like every other area.
- The 11 regions add up to the Georgia total in every year for numbers, and for areas within 1 m² except that 2024 differs by exactly the recorded amount (`KNOWN_DIFFERENCES`: permits −1 m², completed +1 m²).
- The types add up to the Georgia total (numbers exactly, areas within 1 m²; permits 2024 is 0.19 m² short because the by-type sheet stores 12,040,429.81 where the regional workbook has 12,040,430). The years with a missing type column add up without it.
- Each by-type sheet's `Total` column equals the regional workbook's number and area for Georgia and each region (960 cells, numbers exactly, areas within 1 m²: differences are 0.08–0.31 m² in 2023–2024 and exactly 1 m² for Samtskhe-Javakheti permits 2024 and Shida Kartli completed 2024).
- A region's residential buildings never exceed its total.
- Anchors, as published: permits 2025 11,578 (11,397,190 m²); completed 2025 3,393 (3,509,126 m²); Tbilisi permits area 2025 6,423,329 m²; Guria permits 2025 150; price index total 2020 107.2 and 2025 159.4; Vake flats 2025 stored `5873.77`.

`node verify_independent.mjs` re-reads the six served workbooks with SheetJS (the `xlsx` package of `apps/web`), with label tables written separately from `prepare.py`, and checks every row's stored value, its rounding to the cell's number format, its year (the heading above the column pair or quarter, or the sheet name), its column heading and its row label with the number or area position of the row, plus the full set of keys. Its negative controls (altered value, omitted row, shifted year, neighbouring column, swapped type column, area row read as count and the reverse, wrong region row, wrong year sheet, wrong year column, swapped price sheets, third-quarter column, wrong index row, unrounded and wrongly rounded published values, a no-data cell served) must all be detected.

## Notes

- **Declared data.** Geostat titles the permits and completed-objects tables "(the declared data)": figures are those declared on the permits and completion notices, not independently measured.
- **Special-significance permits.** Each by-type permits sheet carries a note: the Ministry of Economy and Sustainable Development (2012–2015) and then the LEPL Technical and Construction Supervision Agency (TCSA) issued separate permits for buildings of special significance: 58, 54, 63, 60, 75, 87, 87, 94, 74, 91, 73, 50, 61 and 69 in 2012 to 2025. The 2025 note reads: "LEPL Technical and Construction Supervision Agency (TCSA) has issued 69 permits for construction and reconstruction of special significance buildings in 2025." The note does not say whether these are in the totals.
- **Residential buildings** (2022–2025 notes): "Residential buildings include multufunctional residential complexes and individual residential buildings."
- **District prices.** The Tbilisi workbook's note: "The following table represents the median prices of 1m2 for the newly-built flats in Tbilisi, by districts. The mentioned prices are so called “offer prices”. The data is obtained using web scraping and calculating median prices." (the houses sheet says "detached houses"). They are asking prices of new-build homes, not transaction prices, and not comparable with the price index.
- The regional workbooks print `Last update: 30.07.2026` and link metadata `https://www.geostat.ge/media/78698/0509_300426_EN.PDF` and source `Permissions-Granted.pdf` / `Completed-objects.pdf`; the metadata PDF is not archived here.
