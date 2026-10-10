# Poverty and inequality hub

Date: 2026-10-10
Status: Draft for Duru's review. Duru picked Poverty as the next hub, chose **Poverty + inequality** as its scope, and approved the page layout on 2026-10-10 (decision cards in the "Next hub ideas" thread). This document covers both the data foundation and the pages, because the data is small: four Geostat workbooks and 491 served values.

## 1. Intended result

Fiscal.ge readers should be able to see how many people in Georgia live in poverty, which groups are poorer, and how unequal incomes and spending are, every year since 2004.

The pages answer four questions:

- What share of people live below Geostat's poverty line, and how has it changed? (34.3% in 2004, 21.6% in 2015, 7.1% in 2025.)
- Are villages, children, older people, women or men poorer than the national average?
- How does Georgia look against relative and international poverty lines?
- Has inequality grown or shrunk? (The Gini index by total income was 0.43 in 2006 and 0.34 in 2025.)

The pages keep the production editorial look and reuse the Wages pages' workspace, series list, table and Excel download. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/poverty` | `/en/explorer/poverty` | სიღარიბე და უთანასწორობა |
| Poverty | `/explorer/poverty/rates` | `/en/explorer/poverty/rates` | სიღარიბე |
| Inequality | `/explorer/poverty/inequality` | `/en/explorer/poverty/inequality` | უთანასწორობა |
| Methodology | `/methodology/poverty` | `/en/methodology/poverty` | სიღარიბე და უთანასწორობა |

- The hub has two clickable cards with coverage years and a small national chart built from served values: the Georgia poverty rate on the Poverty card and the Gini index by total income on the Inequality card. They reuse the Wages hub cards.
- The sidebar places **Poverty and inequality** directly after Wages. Its two pages show beneath it when the section is active, as Wages' pages do.
- The pages reuse the existing breadcrumbs, headings, language links, metadata, Dataset JSON-LD and sitemap patterns.
- The Georgian names above are proposals. Final wording follows the bilingual catalogue conventions.

## 3. Poverty page

Under the heading there is one short line from `LatestValueLine`: the latest Georgia poverty-line rate, for example "2025: 7.1% of people below the poverty line". Nothing else sits under the heading. There is no headline-number block or ranking, and the only text under the chart is one short source line.

Three centred text tabs follow, styled like the Wages and Money from abroad tabs:

**Poverty line | Relative poverty | International lines**

| Tab | Series in the list (selected first in bold) | Years |
| --- | --- | --- |
| Poverty line | **Georgia**, with Towns, Villages, Children (0–17), Working age (18–64), 65 and older, Women and Men nested under it | 2004–2025 |
| Relative poverty | **Below 60% of median consumption: Georgia**, with Towns and Villages nested under it; then Below 40% of median consumption: Georgia, with Towns and Villages nested under it | 2004–2025 |
| International lines | **$3.00 a day**, $4.20 a day and $8.30 a day (2021 PPP) | 2004–2024 |

- Every value is a percent of the population, shown to one decimal, so any combination of ticks shares one axis.
- Nested rows work as on the Wages overview. The count and Select all cover the top-level rows, nested ticks are counted separately, and search never scopes the bulk action or the count.
- Each tab has its own list. Switching tabs selects that tab's first series alone and keeps the year range, clamped to the new tab's years.
- The initial state is the Poverty line tab, chart mode, all loaded years, with only Georgia selected. Georgia stays first, selectable and removable.
- Chart | Table, the year range and Excel work as on Wages. The tab, range, selection and chart/table mode are stored in the URL and survive a language change.
- Every series has a fixed, distinguishable colour. Labels and table names identify every series without colour.
- A missing value (the international lines in 2025) is a gap in the chart, a dash in the table and a blank Excel cell, never zero.
- The source line reads like the others, for example: "Source: Geostat, Household Incomes and Expenditures Survey · % of population · 2004–2025 · Methodology and sources". On the International lines tab it names the World Bank as Geostat's source.

## 4. Inequality page

- One line under the heading: the latest Gini index by total income, for example "2025: Gini index 0.34 (by total income)".
- No tabs. One line chart of the Gini index for 2006–2025, with six series in Geostat's order. **By total income** is selected first, because it is Geostat's headline figure. The others are By cash income and transfers, By cash and non-cash inflows, By consumption expenditure, By cash expenditure and By total expenditure. Final labels follow the workbook footnotes (section 6).
- Values show to two decimals on a 0–1 scale, with 0 meaning everyone has the same and 1 meaning one person has everything. That explanation goes in the methodology, not under the heading.
- Table, year range, Excel, URL state and the source line work exactly as on the Poverty page.

## 5. Data rules readers see

These are stated where they matter, mostly on the methodology page:

1. **These are survey estimates.** All values come from Geostat's household survey of about 13,000 interviewed households a year. In 2025, Geostat gives a 95% confidence interval of 6.3–7.9% for the 7.1% poverty rate. The methodology page says so; the chart draws plain lines.
2. **One comparable series.** The survey changed in 2017, from the Integrated Household Survey to the Household Incomes and Expenditures Survey, with a new sampling frame based on the 2014 census. Geostat's metadata says the data are comparable over time, so no break marker is drawn. The methodology page records the change.
3. **2015 is the base year of the poverty line**, as Geostat's footnote says. The methodology describes the absolute poverty line only in Geostat's published words. Any further definition (for example its link to the subsistence minimum) needs a citable Geostat source before it is added.
4. **Relative poverty** means living on less than 60% (or 40%) of the median consumption: half the population consumes more than the median and half less.
5. **International lines** are the World Bank's $3.00, $4.20 and $8.30 a day at 2021 purchasing-power parity, as republished by Geostat. Geostat's file ends in 2024. The lari value of each line, also in that file, stays in the research package and is not served.
6. **Gini from 2006.** Geostat's metadata says Gini coefficients exist from 1997, but the published workbook starts in 2006. The pages show 2006–2025 and the methodology notes the difference. No earlier year is added from another source.
7. **No causes stated.** The pages and methodology describe the figures without explaining why poverty fell.

## 6. Data foundation

### Sources

Retrieved from Geostat's "Poverty and Gini Coefficients" page (`https://www.geostat.ge/en/modules/categories/192/living-conditions`) on 2026-10-10:

| File | Contents | Served values |
| --- | --- | --- |
| `302_Absolute-Poverty.xlsx` | Share under the absolute poverty line: Georgia, urban, rural, ages 0–17, 18–64 and 65+, female and male, 2004–2025 | 8 × 22 = 176 |
| `301_Relative-Poverty.xlsx` | Share under 60% and under 40% of median consumption: Georgia, urban and rural, 2004–2025 | 6 × 22 = 132 |
| `304_Poverty_Int_ENG_2021PPP.xlsx` | Share under $3.00, $4.20 and $8.30 a day (2021 PPP), 2004–2024; lari value of each line | 3 × 21 = 63 (the 63 lari values are not served) |
| `303_Gini-Coefficients.xlsx` | Gini by six income and expenditure measures, 2006–2025, with six definition footnotes | 6 × 20 = 120 |

The research package also keeps the page capture, Geostat's metadata for these indicators (`0702_250526_EN.PDF`) and the household survey metadata (`0701_250526_EN.PDF`).

### Research package

`docs/Raw Data/Poverty/geostat-poverty-annual/` follows the Wages package: original files under `official/`, a source manifest (URL, retrieval date, SHA-256 and size), a `prepare.py` that transcribes every cell with its sheet and cell reference, an independent verification script, a validation report and a coverage file. The originals are never edited.

### Canonical file and checks

- `npm run data:prepare-poverty` writes `data/imports/poverty-annual.csv` (UTF-8 with BOM) and `data/reports/poverty-validation.json` from the package. `--check` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the exact workbook value, the value as Geostat displays it (one decimal for percents, two for Gini), unit (`percent` or `index`), `basis=actual`, `value_status=survey_estimate`, source ID, sheet and cell.
- Stable lowercase IDs: indicators `poverty.absolute`, `poverty.relative_60`, `poverty.relative_40`, `poverty.international_300`, `poverty.international_420`, `poverty.international_830`, and `gini.total_income`, `gini.cash_inflows`, `gini.total_inflows`, `gini.consumption_expenditure`, `gini.cash_expenditure`, `gini.total_expenditure`; groups `georgia`, `settlement.urban`, `settlement.rural`, `age.0_17`, `age.18_64`, `age.65_plus`, `sex.female`, `sex.male`.
- Validation rejects a changed value, a missing, extra or duplicate observation, a year outside each workbook's coverage, and a lost footnote. It also checks:
  - percents lie within 0–100 and Gini values within 0–1;
  - the Georgia rate lies between the urban and rural rates, between the female and male rates, and within the range of the three age groups, for every year and poverty measure where those groups exist;
  - under 40% is never above under 60% for the same group and year, and $3.00 ≤ $4.20 ≤ $8.30 every year;
  - the Georgia poverty-line rates for 2016–2025 round to the ten values on Geostat's page (22.0, 21.9, 20.1, 19.5, 21.3, 17.5, 15.6, 11.8, 9.4, 7.1), and the 2025 Gini by total income rounds to 0.34.
- The `2015*` year label is read as 2015, and its footnote is kept as provenance.
- No estimates, interpolation, rebasing or derived figures (no changes in percentage points, no counts of poor people).

### Serving

- All pages stay prerendered. The CSV loader and a numeric client projection follow Wages.
- The private Supabase mirror gets a `PovertyFact` table in one versioned migration, with RLS on and public grants revoked, compared field by field in the transactional `data:import`, like the Wages table. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 7. Sources, Excel and methodology

- The four workbooks, the page capture and the two metadata PDFs are published through the existing source archive (`data/methodology/source-archives/poverty.csv`). The methodology bundle must not pull large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language: the active tab's selected series and years, explicit units (% of population, or the Gini index), survey-estimate status, blank missing cells and validated source links. It has no internal identifier or cell-reference columns.
- `/methodology/poverty` explains in plain words: what the survey is and covers (private households, excluding the occupied territories), the poverty line, relative poverty, the international lines, the six Gini measures with Geostat's footnote definitions, and rules 1–7 from section 5.

## 8. Out of scope

Household income and spending, poverty by region, subsistence-minimum values, the lari values of the international lines, Gini before 2006, quarterly data, forecasts, causes, MCP tools and the central JSON/CSV publications. Each would need its own approval.

## 9. Verification

1. The canonical file reproduces all 491 served values from the original cells. The research package's independent verification passes, and CSV and database modes agree.
2. The defaults, tabs, nesting, tab switching, missing 2025 international values and URL state behave as in sections 3–4. The 2025 values read 7.1% (poverty line, Georgia) and 0.34 (Gini by total income).
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, with keyboard use and language switching keeping the settings.
5. Screenshots go to Duru first. After Duru approves them, run `npm run check`, `npm run build` and `npm run test:browser` once, then push and open the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved Poverty and inequality item), `DESIGN.md` (the hub and two pages) and a new `docs/data-methodology/poverty-annual.md`.

## 10. Reuse

- **Used as is:**
  - `ExplorerWorkspace`, `ExplorerHeading`, `LatestValueLine`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector` and `SeriesSelectorRow` (with nested rows), `SegmentedTabs`, `SourceNote`
  - the three-sheet Excel writer, `ExcelDownloadButton`
  - the source archive and methodology components
  - the generated-artifact check and the served-rows parity check
- **Small additions:**
  - the sidebar, sitemap, methodology catalogue and source inventory get the new section
  - the import script and mirror read and compare the new table
- **New** (each mirrors its Wages counterpart file by file; Wages has no tab-per-measure list and no Gini, so its component cannot simply be pointed at this data):
  - the research package and `prepare-poverty` script
  - the Prisma model and migration
  - `lib/explorer/poverty.ts` (state and model), `lib/explorer/povertyWorkbook.ts`, `lib/explorer/povertyHubCards.ts`
  - `components/poverty/poverty-explorer.tsx`, `lib/pages/poverty.tsx`, the routes and messages
  - the methodology content and `docs/data-methodology/poverty-annual.md`

## 11. Coordination

The Wages pages (PR #166), whose layout this design reuses, are merged to `main`, and this branch starts from that `main`. The Current account page (PR #172) touches some of the same files: sidebar, sitemap, methodology catalogue, mirror files and browser-test page counts. When it merges, this branch merges `main` in and resolves them.

## 12. Decision for Duru

Approve this design. The implementation plan comes next. Approving the design does not authorize pushing, a pull request, deployment or live database changes; screenshots come first.
