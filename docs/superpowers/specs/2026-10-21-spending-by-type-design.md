# Spending by type page (Budget hub)

Date: 2026-10-21
Status: Design approved by Duru on 2026-10-21 (decision card "Build the Spending by type page as described?", answer "Yes, build it", 16:21 Tbilisi). Duru picked this topic, item 1 of the "Data beyond NBG and Geostat" research, on 2026-10-21. This document covers the data foundation and the one new page.

## 1. Intended result

Fiscal.ge readers should be able to see, year by year, what kinds of things Georgia's government spends its money on: public wages, goods and services, interest on debt, subsidies, social benefits and investment in roads, buildings and other assets. The site shows spending by purpose (health, education…) and by ministry today, never by type.

The page answers questions such as:

- How big is the public wage bill? 3.6 billion GEL in 2025 (222 million in 2002).
- How much goes on interest? 1.6 billion GEL in 2025, up from 0.6 billion in 2019.
- How much is social benefits (pensions, allowances)? 9.1 billion GEL in 2025, the largest type.
- How much is invested? 4.9 billion GEL in 2025, down from 6.0 billion in 2024.
- How does total spending compare with the economy? 29.7 billion GEL in 2025, about 28% of GDP.

The page looks and works like the live GDP by expenditure page: same chart, table, year range, icon measure switches, right-hand series list and Excel download. No new chart type, library or visual direction is added.

## 2. Source choice (explained to Duru 2026-10-21)

The Ministry of Finance publishes general-government operations in two annual files that disagree from 2013 on:

| File | 2025 revenue | 2025 total spending | Who it counts |
| --- | --- | --- | --- |
| `general20022025.xlsx` (GFSM 2001 layout, 2002–2025) | 28,468.5 m GEL | 29,743.8 m GEL | State budget, Adjara and Abkhazia, municipalities |
| `ENGGAGFSM2014.xlsx` (GFSM 2014, 1995–2025) | 32,026.8 m GEL | 33,121.7 m GEL | The same plus, from 2013, public legal entities with their own income (universities, agencies) |

**We use `general20022025.xlsx`.** Evidence:

- Its tax revenue equals the site's live Revenue page in every year 2008–2025; 2004–2007 differ only by the old social tax, which GFS books as social contributions (the amounts match to 0.1 m GEL). Readers therefore see one government perimeter across the Budget pages.
- Its 2025 lines equal Appendix 1.3 "General Government" of the Ministry's 2027 budget tables (`2027 BD Tables sen 081BDDLEPLen.xlsx`); the GFSM 2014 file is close to Appendix 1.7 "General Government Plus LEPL and Other Public NPI" instead.
- The gap sits almost entirely in "other revenue", wages and goods and services; taxes are nearly equal in both files. That is the signature of bodies financed from their own income.

The Ministry's net lending/borrowing line in this file (−1,275.3 m GEL in 2025) is **not shown**. The Deficit page keeps the IMF figure (−1,526 m GEL) so the site never shows two deficits for one year. The methodology page names both files and says why this one is used.

## 3. Page and navigation

| Page | Georgian path | English path | Name (Georgian / English, proposal) |
| --- | --- | --- | --- |
| Spending by type | `/explorer/expenditure-types` | `/en/explorer/expenditure-types` | ხარჯების სახეები / Spending by type |
| Methodology | `/methodology/expenditure-types` | `/en/methodology/expenditure-types` | ხარჯები ეკონომიკური კლასიფიკაციით / Spending by type |

- The page heading is "ხარჯები ეკონომიკური კლასიფიკაციით" / "Government spending by type" (the Ministry's own Georgian name for this split is "ეკონომიკური კლასიფიკაცია").
- The path is flat, like every other Budget section, so the Spending row in the sidebar is never highlighted for the new page.
- The Budget sidebar lists it right after Spending: Spending, Spending by type, Revenue, Municipalities, Analysis, Debt, Deficit.
- The Budget hub gets a card for it with the standard card anatomy: a sparkline of total spending 2002–2025 and a footer with the latest year and amount.
- Breadcrumbs, language links, metadata, Dataset JSON-LD and the sitemap follow the GDP by expenditure page.

## 4. The page

Under the heading there is one short line (`LatestValueLine`), which follows the measure:

- ₾: "ხარჯები 2025: 29.7 მლრდ ₾" / "Spending 2025: 29.7 bn ₾"
- Share of GDP: "ხარჯები 2025: 28.4%" / "Spending 2025: 28.4%", marked preliminary because Geostat's 2025 GDP is preliminary.

Nothing else sits under the heading. Under the chart there is one short source line.

**Measures.** Two icon-only switches on the chart toolbar (Duru's rule: share of GDP of the same series is an icon toggle, not a tab):

- **₾** — amounts, 2002–2025, from the Ministry file.
- **Share of GDP** — each amount divided by the same year's GDP from the site's existing national GDP file (`national-gdp-annual-1996-2025.csv`, the one the Budget pages' % of GDP already use), 2002–2025. Our calculation.

There is no real-growth switch: the Ministry publishes no price-adjusted figures.

**Series list.** Every row is visible from the start, under small headings, nothing collapsible, no name prefixes, fixed order (not ranked):

- **Total spending** (pinned at the top) — GFS 2M, expense plus net investment
- **Running costs** (heading): Total running costs (2); Wages and salaries (21); Goods and services (22); Interest (24); Subsidies (25); Grants (26); Social benefits (27); Other costs (28)
- **Investment** (heading): Buildings, roads and other assets (31, net purchases)

Code 23 (consumption of fixed capital) is zero in every year and is not listed; the preparation checks that it stays zero.

On arrival the chart shows **Total spending, Social benefits, Investment, Wages and salaries, Subsidies, Goods and services and Interest** (₾, all years): the total plus the six named main types. "Other costs" and "Grants" are listed but not ticked: "Other costs" is a mixed bag and grants are tiny. This departs from the site's "only the total on arrival" rule because the total alone says nothing about the split; Duru's approval of this design approves that default for this page, and `Project_Definition.md` records it. The rest of the selection behaviour is the GDP by expenditure behaviour: unlimited selection, total first and removable, Chart | Table, year range, Excel, all kept in the URL.

**Zeros.** The Ministry prints real zeros (grants 2002–2004, other costs 2002–2003); they are shown as 0, not gaps.

**Formatting.** Amounts in billion ₾ with one decimal in the chart, list and lines; table and Excel as on GDP by expenditure. Shares with one decimal.

## 5. Data foundation

- **Source:** Ministry of Finance, GFS data › General Government Operations, `general20022025.xlsx` (sheet `Sheet4`, "TABLE 2A: Statement of Government Operations", million GEL), downloaded 2026-10-21 from `https://mof.ge/files/download/general20022025.xlsx/2135a1f1-5823-4aa6-a3d0-3ae7e8c610dd`. Archived with checksum under `docs/Raw Data/Budget/expenditure-types/` and published through the existing source archive (`data/methodology/source-archives/expenditure-types.csv`).
- **Years:** 2002–2025, annual only.
- **Canonical file:** `data/imports/expenditure-types-annual.csv`, same columns as `gdp-expenditure-annual.csv`, UTF-8 with BOM, values in full GEL as exact decimals; measures `nominal` and `share_of_gdp`.
- **IDs:** `spending_type.{id}`: `total` (2M), `expense` (2), `compensation` (21), `goods_services` (22), `interest` (24), `subsidies` (25), `grants` (26), `social_benefits` (27), `other` (28), `investment` (31). Labels live in `data/taxonomy/expenditure-types.json`.
- **Calculations:** million GEL × 1,000,000 with decimal arithmetic; share = amount ÷ same-year GDP × 100; a share is preliminary when that year's GDP is.
- **Checks** (the preparation fails if any is off):
  - the original's checksum and size; sheet name, row labels and GFS codes and the year header 2002–2025 match the reviewed mapping;
  - each year: 21 + 22 + 23 + 24 + 25 + 26 + 27 + 28 = 2, and 2 + 31 = 2M, each within 0.05 m GEL (all hold exactly in the current file);
  - code 23 is zero in every year;
  - every year has a GDP value; no missing, extra or duplicate cell.
- **Database:** a `ExpenditureTypeFact` table in one versioned migration, RLS on and public grants revoked, filled by the transactional `data:import` with field-by-field parity, as every hub does. CSV and database modes serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 6. Excel and methodology

- Excel reuses the GDP by expenditure workbook (Summary, Data, Sources) in the reader's language: the selected rows, years and measure, preliminary marks and the validated Ministry link; no internal ids.
- `/methodology/expenditure-types` explains in plain words: what each type means; that total spending = running costs + net investment; who is counted (state budget, Adjara and Abkhazia, municipalities, with transfers between them counted once); why the total differs from the Spending page (that page counts every state-budget payment, including debt repayment and lending, and not the municipalities); why the Ministry's newer GFSM 2014 file is not used (wider set of bodies from 2013); that the Ministry's own deficit line is left out in favour of the IMF figure on the Deficit page; that shares of GDP are our calculation and 2025 GDP is preliminary; and that the Ministry may revise past years.

## 7. Out of scope

Revenue by type (the Revenue page already covers it); the Ministry's balance, financing and balance-sheet lines; the GFSM 2014 file and spending by purpose (COFOG) from either file; central-government-only figures; monthly or quarterly figures; per-person or USD amounts; MCP tools and the central JSON/CSV publications (recent hubs stay outside them too). Each would need its own approval.

## 8. Verification

1. The canonical file reproduces every served value from the original cells; all checks in section 5 pass; CSV and database modes agree.
2. Unit tests cover preparation (a changed cell, a missing row, a broken sum and a wrong checksum fail), the default selection, the total's share headline and the two-measure toolbar.
3. Chart, table and Excel agree for the same settings; source links work.
4. Browser tests cover the page in both languages at desktop and 375px phone width (the heading line on one line), the hub card, the sidebar entry and the methodology page.
5. `npm run check`, `npm run build` and `npm run test:browser` pass before the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved item), `DESIGN.md` (sidebar order, hub card, the page), and add `docs/data-methodology/expenditure-types.md`.

## 9. Reuse

- **As is:** the explorer shell (`ExplorerHeading`, `ExplorerWorkspace`, `LatestValueLine`, the sector series panel with its heading rows, `ModeTabs`, `SegmentedTabs`, `RangeStrip`, `ChartSelectionAids`), `EditorialLineChart`, `ExplorerTable`, `ExcelDownloadButton` and the workbook writer, the sectors calculation helpers and observation types, the national GDP loader, Budget hub cards and sections, navigation tree, sitemap and SEO helpers, the methodology catalogue and source-archive pipeline, the served-data CSV/DB parity framework, `readVerifiedPackageFile`.
- **Small additions:** the sectors explorer config (already shared by Sectors and GDP by expenditure) gets optional inputs whose defaults leave both pages and their tests unchanged: which measures the toolbar offers (default all three) and which row is the pinned total (default GDP). A new entry in each registry the recent pages joined (Budget sections and hub cards, navigation, messages, methodology catalogue, source inventory, sitemap, dataset vocabulary, mirror rows, import script, validate-all, Prisma schema, MCP exclusion list).
- **New:** the taxonomy file, the preparation script and its validation (the Ministry file has a different layout from Geostat's tables, so no existing preparation can read it), the page route files, the messages and the methodology content.
