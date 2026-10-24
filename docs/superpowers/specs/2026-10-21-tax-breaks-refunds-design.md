# Tax breaks and refunds page (Budget hub)

Date: 2026-10-21
Status: Draft for Duru's review. Duru picked items 2 (tax expenditures) and 3 (tax refunds) from the "Data beyond NBG and Geostat" list on 2026-10-21. In the "Tax breaks and refunds" thread Duru chose (16:19 Tbilisi) to show both on one page, chose the name "საგადასახადო შეღავათები და დაბრუნება" (16:21), and approved the design summarised here (16:23). The "Tax breaks" thread stopped and handed its findings over (`/mnt/project-files/tax-expenditures-sources/handover-notes.md`).

## 1. Intended result

Readers should be able to see, year by year, two kinds of tax money the budget does not keep:

- **Tax breaks**: tax the state chooses not to collect because of exemptions, zero rates and special regimes. The Ministry of Finance calls these "საგადასახადო დანახარჯები" (tax expenditures). They came to 6.4 billion GEL in 2024 (6.9% of GDP), almost all of it VAT (6.0 billion), against 2.6 billion in 2018.
- **Tax refunds**: tax that businesses overpaid, mostly VAT, which the Treasury pays back. Refunds went from 124 million GEL in 2008 to 2.7 billion in 2025. The big rise came in 2018–2021.

The page answers questions such as: how much VAT is waived on education, health or medicines; how big tax breaks are compared with GDP; and how fast refunds have grown.

The page uses the site's existing explorer: line chart and table, year range, icon measure switch, a series list on the right with headings, and an Excel download. It adds no new chart type, library or visual direction.

## 2. Page and navigation

| Page | Georgian path | English path | Name (Georgian / English) |
| --- | --- | --- | --- |
| Tax breaks and refunds | `/explorer/tax-breaks-refunds` | `/en/explorer/tax-breaks-refunds` | საგადასახადო შეღავათები და დაბრუნება / Tax breaks and refunds |
| Methodology | `/methodology/tax-breaks-refunds` | `/en/methodology/tax-breaks-refunds` | same names |

- The page heading is the full name above. The sidebar row uses the shorter "შეღავათები და დაბრუნება" / "Tax breaks and refunds".
- In the Budget section the new row comes right after Revenue: Expenditure, Revenue, Tax breaks and refunds, Municipalities, Analysis, Debt, Deficit. The order lives in `lib/explorer/sections.ts`, which both the sidebar and the hub cards read.
- The Budget hub gets a card after Revenue with the same layout as the others: a sparkline of refunds 2008–2025 and the footer "2025 · დაბრუნება 2.7 მლრდ ₾" (English "2025 · Refunds 2.7 bn ₾").
- Breadcrumbs (Home › Budget › page), language links, metadata, Dataset JSON-LD and the sitemap follow the other Budget pages.

## 3. The page

**Heading line.** Under the heading there is one short line (`LatestValueLine`) and nothing else: "დაბრუნება 2025: 2.7 მლრდ ₾ · შეღავათები 2024: 6.4 მლრდ ₾" (English "Refunds 2025: 2.7 bn ₾ · Tax breaks 2024: 6.4 bn ₾"). In the % of GDP view the same line shows shares. It must fit on one line at 375px phone width in both languages. If it does not fit, the line shows refunds only, and the screenshots for Duru point this out.

**Measures.** Two icon-only switches on the chart toolbar:

- **₾**: amounts as published, in million GEL.
- **% of GDP**: each amount divided by the same year's GDP from the site's own national GDP file (`national-gdp-annual-1996-2025.csv`, the denominator Revenue, Debt and Money already use), calculated in the browser with the existing `shareOfGdp` helper. The Ministry printed 7.0% for 2024 because it divided by GDP before Geostat's revision. The site's figure is 6.9%, and the methodology page explains the gap. Years with preliminary GDP (2025) are marked as such, as on Money.

**Series list.** Every row is visible from the start, grouped under small headings. Nothing collapses and names carry no prefixes. The order is fixed, not ranked:

- **საგადასახადო შეღავათები / Tax breaks**: Total tax breaks
- **დღგ / VAT**: Total VAT breaks; Education services; Health services and medical goods; Child care; Gambling and lotteries; Cars; Farm products; Medicines; Other VAT breaks
- **საშემოსავლო და მოგების გადასახადი / Income and profit tax**: Total income and profit tax breaks; Personal income tax; Profit tax; Old profit-tax rules; Other income and profit tax breaks
- **დაბრუნება / Refunds**: Tax refunds

**On arrival** the chart shows Total tax breaks and Tax refunds, in ₾, over all years. This departs from the site's "only the total on arrival" rule, because the page has two different totals. Duru approved this on 2026-10-21, and `Project_Definition.md` records it. Everything else works as on other pages: selection is unlimited, both totals can be removed, and Chart | Table, the year range and Excel are all kept in the URL.

**Years.** The chart's range is the union of the selected series' years: 2008–2025 when refunds are ticked, and 2018–2024 for tax breaks alone. A year without a value is a gap in the chart, a dash in the table and an empty cell in Excel, never a zero. Tax-break lines therefore start in 2018 and end in 2024.

**Formatting.** Amounts are shown in million ₾ in the chart, table and series list, because the rows range from 33 million (child care) to 6 billion. The heading line and hub card use billion ₾ with one decimal. Shares are shown with one decimal (two where a row is under 0.1%, using the existing share formatter's rule).

**Under the chart** there is one short source line: "წყარო: ფინანსთა სამინისტრო, საგადასახადო დანახარჯების ანგარიში 2024; სახაზინო სამსახური" plus the years, with links in Excel and on the methodology page.

## 4. Data foundation

**Sources**

1. **Tax breaks:** Ministry of Finance, Tax Expenditure Report, 2024 edition (covers 2018–2024), Georgian workbook `TER graphs GEO 2024.xlsx`:
   - sheet "Figure 1": total, VAT and income tax breaks in million GEL;
   - Table 4.a (VAT by type): exempt services (education, health, child care, gambling, cars), zero-rated goods (farm products, medicines), and "other sectors" as the residual, so the rows add up to the VAT total;
   - Table 3.a (income and profit tax): personal income sub-total (memorandum items excluded, as the Ministry excludes them), distributed profit tax (II.A), old profit-tax regime (II.B), and other (III: small-business status and full deduction of assets).

   Use the Georgian workbook, not the English one: the English "Figure 1" income row is out of date and does not add up to the total (2023: 406.1 against 432.1). Only the latest edition is used, because each edition revises earlier years. Sheet names, row labels and cell positions are recorded in the preparation's reviewed mapping.
2. **Refunds:** State Treasury, chart data `https://www.treasury.ge/Content/charts/newChart.xml`, series "საგადასახადო ზედმეტობების დაბრუნება" (million GEL), 2007–2025. The year-to-date point ("09.2026") is not read, because the site shows whole years only. The 2007 value (1 million GEL) looks like an incomplete first year. It stays in the archived original but is not read into the canonical file, so it does not appear on the page, in Excel or on the hub card. The methodology page says why.

The originals are archived with checksums under `docs/Raw Data/Revenue/tax-breaks-refunds/`: the Georgian and English workbooks, both PDF reports and the Treasury XML as downloaded on 2026-10-21. They are published through the existing source archive (`data/methodology/source-archives/tax-breaks-refunds.csv`). The Treasury rewrites its XML every month, so a future refresh must archive a new copy.

**Canonical file:** `data/imports/tax-breaks-refunds-annual.csv`, with the same columns as `money-banks-annual.csv` (`year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell,last_reviewed_at`), UTF-8 with BOM, unit `gel_million`, values at the source's full precision. `value_status` is `official` and `basis` is `actual` on every row.

**IDs:** `tax_breaks.total`; `tax_breaks.vat.{total,education,health,child_care,gambling,vehicles,agriculture,medicines,other}`; `tax_breaks.income.{total,personal,profit,old_profit,other}`; `tax_refunds.total`. Labels and headings live in the message catalogue, as on Money.

**Checks** (the preparation fails if any is off):

- every original's checksum and size; sheet names, row labels and year headers match the reviewed mapping;
- each year from 2018 to 2024: VAT + income and profit = total (Figure 1); the VAT rows (A + B + C) = the VAT total; personal + profit + old profit + other = the income and profit total; the Figure 1 totals equal the Table 3 and Table 4 grand totals; each within 0.01 million GEL;
- the Treasury XML has 2007–2025 plus exactly one year-to-date column, every value is a number, and 2008–2025 are read;
- no missing, extra or duplicate cell.

**Known quirk:** in the source, "Full deduction of assets" for 2024 repeats the 2018 figure exactly (9.41 million). It sits inside "Other income and profit tax breaks". It is served as published, and the methodology page mentions it.

**Database:** a `TaxBreaksRefundsFact` table in one versioned migration, with RLS on and public grants revoked. It is filled by the transactional `data:import` with field-by-field parity, as every hub does, and CSV and database modes serve identical values. The live migration and import happen only when Duru merges, through the existing release pipeline.

## 5. Excel and methodology

- Excel reuses the topic workbook (Summary, Data, Sources) in the reader's language: the selected rows, years and measure, the preliminary-GDP note in the % of GDP view, and the validated source links. It contains no internal ids or cell references.
- `/methodology/tax-breaks-refunds` and `docs/data-methodology/tax-breaks-refunds.md` explain in plain words:
  - what a tax break is ("tax expenditure" in the Ministry's report), including exempt versus zero-rated VAT;
  - that each sector's VAT break is estimated by the Ministry one at a time, "other things equal", with "other" as the remainder;
  - that only the latest report edition is used, because each edition revises earlier years;
  - the GDP share (site GDP, 6.9% against the Ministry's 7.0% for 2024);
  - what a refund is, why 2007 is not shown, and the 2024 full-deduction quirk;
  - that tax breaks and refunds are different things and should not be added together.

## 6. Out of scope

Earlier report editions; tax breaks by legal provision, taxpayer size or industry (Tables 1–2 and Figures 3–11); 2026 year-to-date refunds; refunds by tax type (not published); any sum of breaks and refunds; changes to the Revenue page; MCP tools and the central JSON/CSV publications (recent hubs stay outside them too). Each would need its own approval.

## 7. Verification

1. The canonical file reproduces every served value from the original cells, all checks in section 4 pass, and CSV and database modes agree.
2. Unit tests cover the preparation (including a changed cell, a missing row and a wrong checksum), the default selection, the 2007 exclusion, gaps outside 2018–2024 and the % of GDP calculation.
3. Chart, table and Excel agree for the same settings, and source links work.
4. Browser tests cover the page in both languages at desktop and 375px phone width (heading line on one line), the hub card, the sidebar entry and the methodology page.
5. `npm run check`, `npm run build` and `npm run test:browser` pass before the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved item and the two-total default), `DESIGN.md` (sidebar order, hub card, the page), and add the methodology doc.

## 8. Reuse

- **Used as is:** the explorer shell (`ExplorerHeading`, `ExplorerWorkspace`, `LatestValueLine`, `FlatSeriesPanel` with heading rows, `ModeTabs`, `SegmentedTabs`, `RangeStrip`, `ChartSelectionAids`), `EditorialLineChart`, `ExplorerTable`, `ExcelDownloadButton` and the workbook writer, `useHashState`, the topic-series model (`lib/explorer/topicSeries.ts`: `buildTopicModel`, hash parse and serialise, coverage, colours), `shareOfGdp` from the debt explorer, national GDP facts, the hub card layout, the navigation tree, sitemap and SEO helpers, the methodology catalogue and source-archive pipeline, the served-data CSV/DB parity framework, and `readVerifiedPackageFile`.
- **Closest existing page:** Money supply (`components/money-banks/money-banks-explorer.tsx` with `lib/explorer/moneyBanks.ts`), which has the same ₾ / % of GDP switch over million-GEL series, built on the topic-series model. It cannot simply be extended, because its sections, views and foreign-currency pairs are specific to Money. The new page follows its structure with a small model of its own (series list, two views, default selection). The Sectors explorer was considered and rejected: it is built around a GDP total row, one source per measure and a real-growth view, none of which this page has.
- **Small additions:** a new entry in each registry the recent hubs joined: budget sections and hub cards, messages, methodology catalogue, source inventory, sitemap, dataset vocabulary, mirror rows, import script, validate-all, Prisma schema, and the MCP exclusion list.
- **New:** the preparation script and its validation (the Ministry workbook and the Treasury XML have no existing reader), the page model and component, the route files, the messages and the methodology content.
