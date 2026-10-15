# Business hub

Date: 2026-10-14
Status: Approved by Duru on 2026-10-15. Duru picked business statistics as the next data on 2026-10-14 ("Pick the next data to add to fiscal.ge" card, option Business), chose four pages ("Four pages" card) and approved the page layout with one separate Regions page ("Approve this layout for the Business hub?" card). This document covers both the data foundation and the pages.

**Amended during implementation (2026-10-15).** Where the body below differs, this note and the built pages win:

- The 11 survey regions do not add up to Georgia: they fall short in every year from 2006, and each difference is recorded exactly and never filled (the check in section 9 is corrected below). The region source line states the head-office rule and that shortfall as two separate facts, with no cause given for the shortfall.
- Firms opened and closed also list Geostat's "Activity not known" row, last under Active, New and Closed firms, so the sections add up to the total; its published rates are not shown.
- Charts, tables and series lists show amounts in million GEL to one decimal on every business page (Sales, Investment and profit and all area pages, Georgia included), as Geostat prints them, so no small amount reads as "<0.1". The latest-value lines and hub cards keep billion GEL from 1 billion GEL (million GEL below), and the Regions index map and list billion GEL; the billion-GEL examples below describe those.
- A nested series is named `Parent — Child` outside the list (chart, tooltip, table). Each industry keeps its sector colour under every parent, and each parent's children take their own stroke: the first parent's solid, the second's dashed, the third's dotted.
- Georgian terms follow Geostat's Georgian metadata, for example «ინვესტიციები ფიქსირებულ აქტივებში» and «აქტიური საწარმოები».

## 1. Intended result

Fiscal.ge readers should be able to see, year by year, how large Georgia's business sector is, where it sits and how it is doing. They should be able to see how much firms sell, how many people they employ, how much they invest, how much profit and loss they make, and how many firms open and close. Each of these is split by industry and firm size, and by region.

The pages answer five questions:

- How much do Georgian firms sell? 3.1 billion GEL in 1999, 253.7 billion GEL in 2025, of which large firms 173.0 billion.
- How many people do they employ? 379,400 in 1999, 899,000 in 2025.
- How much do they invest? 2.1 billion GEL in 2006, 8.0 billion GEL in 2025.
- Do they make money? In 2025 firms with a profit made 27.9 billion GEL and firms with a loss lost 7.2 billion GEL.
- How many firms open and close? In 2024 there were 249,236 active firms. 56,259 opened (22.6% of active firms) and 29,634 closed (11.9%).

The pages keep the production editorial look and reuse the Wages, Living standards and Money and banks workspace, series list, map, icon measure switch, table and Excel download. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/business` | `/en/explorer/business` | ბიზნესი |
| Sales | `/explorer/business/sales` | `/en/explorer/business/sales` | ბრუნვა |
| Jobs | `/explorer/business/jobs` | `/en/explorer/business/jobs` | დასაქმებულები |
| Investment and profit | `/explorer/business/investment-profit` | `/en/explorer/business/investment-profit` | ინვესტიციები და მოგება |
| Firms opened and closed | `/explorer/business/firms` | `/en/explorer/business/firms` | გახსნილი და დახურული საწარმოები |
| Regions | `/explorer/business/regions` | `/en/explorer/business/regions` | რეგიონები |
| Area page (Georgia and 11 regions) | `/explorer/business/regions/[id]` | `/en/explorer/business/regions/[id]` | ბიზნესი — {area} |
| Methodology | `/methodology/business` | `/en/methodology/business` | ბიზნესი |

- The hub has five clickable cards, in the order of the table, reusing the budget hub cards. Sales, Jobs, Investment and profit, and Firms each show a sparkline of their default series (all firms' sales, all firms' jobs, investment, new firms), the latest figure and coverage from served facts. Regions shows only its coverage, as the Wages Regions card does.
- The sidebar places **Business** directly after Economy, and its five pages show beneath it when the section is active.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD and the sitemap follow the existing pattern.
- The Georgian names are proposals. "ბრუნვა" is Geostat's own word for turnover. Final wording follows the bilingual catalogue conventions.

## 3. Shared page rules

These rules apply to every Business page, as on Money and banks:

- Under the heading there is one short line from `LatestValueLine`. The wording for each page is in its own section below. Nothing else sits under the heading, and the only text under the chart is one short source line.
- **No page has a tab row.** Different units switch with the icon-only measure switch of DESIGN.md §7.2a (`SegmentedTabs` with icon options and `ControlTooltip`), at the right of the chart controls row after the unit caption.
- Only the default series named for each page is selected on arrival. It stays first, selectable and removable, and selection is unlimited.
- Breakdowns sit under headings ("Firm size", "Industry") or nest under the total they break down, as caret-expanded subcategories. Series names carry no prefixes.
- Chart | Table, the year range and Excel work as on Money and banks. Measure, range, selection (including an empty one) and chart/table mode live in the URL hash through `use-hash-explorer-state` and survive a language change.
- Every series has a fixed, distinguishable colour. The reference series is drawn in ink, and industries reuse the economic-sector colours of the same NACE section.
- A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…` cells are unavailable values.
- **Yearly values only.** The last year shown is 2025 (2024 for firms opened and closed). Geostat's 2026 quarterly rows at the bottom of each sheet are not served.
- Amounts are stored in million GEL as Geostat prints them, and shown in billion GEL to one decimal (`მლრდ ₾`). People are shown in thousands to one decimal. Firm counts are whole numbers, and rates are percent to one decimal.
- The source line reads like the others, for example: "Source: Geostat, business statistics · billion GEL · 1999–2025 · Methodology and sources".

## 4. Sales page

Line under the heading: "2025: firms' sales 253.7 billion GEL".

One list, in billion GEL, 1999–2025:

- **All firms** (selected).
- Firm size: Large, Medium, Small.
- Industry: Agriculture, forestry and fishing; Industry (mining, manufacturing, energy and water); Construction; Trade and vehicle repair; Transport and storage; Accommodation and food; Information and communication; Real estate; Professional, scientific and technical; Administrative and support services; Education; Health and social work; Arts, entertainment and recreation; Other services.

These are Geostat's 14 published groups. "Industry" is Geostat's combined B–E group, so its ID is `b_e` and it is never split. Arts, entertainment and recreation includes betting firms, whose turnover counts every bet placed. The methodology page says so, because it makes that line look very large.

## 5. Jobs page

Line under the heading: "2025: 899.0 thousand people employed in firms".

The list is the same as on Sales (All firms selected, Firm size, Industry), in thousand people, 1999–2025. The figure is Geostat's "number of persons employed" in surveyed firms; the methodology page quotes Geostat's definition. It is not the same as the Unemployment page's survey of households, and the methodology page explains the difference.

## 6. Investment and profit page

Line under the heading: "2025: investment 8.0 billion GEL".

One list, in billion GEL, 2006–2025:

- **Investment** in fixed assets (selected), with its firm sizes and industries nested under it.
- Profit, with its firm sizes and industries nested under it.
- Loss, with its firm sizes and industries nested under it.

Profit is the total profit of the firms that made a profit, and Loss is the total loss of the firms that made a loss. Geostat publishes them as two separate tables. Both are shown as positive amounts, as Geostat prints them, and no net figure is calculated. Nested rows use the same 3 sizes and 14 industries as Sales.

## 7. Firms opened and closed page

Line under the heading: "2024: 56,259 firms opened, 29,634 closed".

One list, 2014–2024, with an icon measure switch on the chart toolbar:

- **Number** (Lucide `Building2`): Active firms; **New firms** (selected); **Closed firms** (selected). Each has its NACE sections A–S nested under it, as Geostat publishes them in its business demography (here mining, manufacturing, energy and water are separate sections, and financial activities are included).
- **Rate** (Lucide `Percent`): New firms and Closed firms as a percent of active firms, with the same nested sections. These are Geostat's published birth and death rates, not calculated by fiscal.ge. Active firms has no rate, so it is unavailable in this measure.

Switching measure keeps any selected New or Closed row and drops Active firms. Switching back keeps the rows. New firms and Closed firms are both selected by default (named here as the approved default, AGENTS.md "only the applicable total" exception), because opening and closing is the point of the page.

Source: Geostat business demography, "Main results" workbook (one sheet per year, 2014–2024, by section and by region). A "new firm" is Geostat's enterprise birth, a new combination of production factors. A "closed firm" is an enterprise death, meaning it stopped and did not restart within two years, which is why the last year is 2024. The methodology page explains both in plain words.

## 8. Regions page and area pages

**Regions index** (`/explorer/business/regions`), following the Living standards Income index:

- Under the heading is the one latest-value line ("2025: firms' sales in Tbilisi 200.8 billion GEL"). Under it is the shared `RegionIndex` map and ranked list of the 11 regions, coloured by the latest year's value, with the occupied-territory overlays.
- An icon switch above the map, aligned right within the map column as on Living standards, chooses the map value: `₾` sales (initial) or Lucide `Users` jobs.
- Georgia is the list's first, unranked row. Georgia and every region, on the map or in the list, are links to their own area page, carrying the chosen measure in the hash.
- There is no chart workspace on the index. The one source line is the `RegionIndex` footer, naming the source, unit and map year with the geoBoundaries credit.

**Area pages** (`/explorer/business/regions/[id]`, 12 pages: `georgia` and the 11 regions), following the Living standards area pages:

- The heading is `ბიზნესი — [გურია ▾]` / `Business — [Guria ▾]`, with the `RegionPicker` (Georgia first, and an all-regions entry that returns to the index) and previous/next links on the right, in the order Georgia then the regions.
- One latest-value line: the area's sales, for example "2025: firms' sales 1.1 billion GEL · Guria". No map follows.
- The chart workspace has an icon measure switch with three options:
  - `₾` money (initial): **Sales** (selected), Investment, Profit, Loss, in billion GEL.
  - `Users` jobs: **Jobs**, in thousand people.
  - `Building2` firms: Active firms, **New firms**, **Closed firms**, as counts.
- Each measure selects its bold series when first chosen. Switching keeps the years, clamped to the measure's coverage.
- Years: money and jobs run 2006–2025 for regions and 1999–2025 for Georgia. Firms run 2014–2024.
- Georgia's page uses the same national totals as the four topic pages.
- The source line adds the head-office caveat in a few words ("firms counted where their main office is"), as Wages does.

**Why regions start in 2006.** Geostat's note says that before 2006 some firms registered in one region but working in several were counted only in the Georgia total. Region values before 2006 therefore don't add up to Georgia and are not served. From 2006 firms are counted where their main office is, which is one reason Tbilisi's share is so high. The methodology page says so. Abkhazeti AR and "unknown" rows in the firms tables are kept in the data, because they are part of Georgia's total, but they are not drawn on the map.

## 9. Data foundation

### Sources

The files come from Geostat's Business Statistics pages, downloaded directly from the cloud workspace on 2026-10-14. Category pages need `curl -L` because they redirect. Copies are in `/mnt/project-files/business-sources/`.

| Geostat file | Sheets used | Used for | Years |
| --- | --- | --- | --- |
| `0502EN0101_Turnover.xlsx` | by activity, by size, by region | Sales | 1999–2025 (regions 2006–2025) |
| `0502EN0103_Number-of-persons-employed.xlsx` | by activity, by size, by region | Jobs | 1999–2025 (regions 2006–2025) |
| `0502EN0111_Investments-in-fixed-assets.xlsx` | by activity, by size, by region | Investment | 2006–2025 |
| `0502EN0114_Profit-and-loss.xlsx` | by activity, by size, by region (each sheet holds a PROFIT table, then a LOSS table) | Profit, Loss | 2006–2025 |
| `Main-results.xlsx` (business demography) | by regions; by kind of activity, one sheet per year | Active, new and closed firms, new and closed rates | 2014–2024 |
| `Remark_eng.pdf` | — | Coverage notes | — |

The ownership and legal-form sheets, and the other eleven survey tables (production value, employees, earnings, value added, costs, purchases, fixed assets, gender, productivity), are archived for provenance but not served. Pay is on the Wages pages and value added is on the Economy pages.

Rough size: Sales and Jobs about 490 values each; Investment, Profit and Loss about 360 each; regions about 1,100; firms about 800. That's about 4,000 served values in all. The plan fixes the exact count.

### Research package

`docs/Raw Data/Business/geostat-business-annual/` follows the Money and banks package. Original files go under `official/` with a source manifest (URL, retrieval time, SHA-256, size). A `prepare.py` transcribes every used cell with its sheet and cell reference, and an independent verification script, a validation report and a coverage file sit alongside. The originals are never edited.

### Canonical file and checks

- `npm run data:prepare-business` writes `data/imports/business-annual.csv` (UTF-8 with BOM) and `data/reports/business-validation.json`. `--check` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the exact workbook value, the unit (`gel_million`, `persons`, `enterprises` or `percent`), `basis=actual`, value status `official`, source ID, sheet and cell. Some Geostat cells hold numbers as text (for example `'5054'` or `'1 499'`), so parsing accepts both and records the value exactly.
- The survey's coverage change in 2006 is recorded in `data/imports/business-series-breaks.csv` in demography's break format (`survey_scope_2006`: from 2006 financial firms, non-commercial legal entities and entities of public law are excluded). The chart draws one line per series, and the methodology page explains the change. No change across the break is computed anywhere.
- Stable lowercase IDs follow the pattern `business.{measure}.{group}`. The measure is `turnover`, `employed`, `investment`, `profit`, `loss`, `active`, `births`, `deaths`, `birth_rate` or `death_rate`. The group is `total`, `size_large`, `size_medium`, `size_small`, `sector_a`, `sector_b_e`, `sector_f` … `sector_s`, or `region_<existing region id>` (`region_tbilisi`, `region_adjara` and so on, reusing the site's region IDs), plus `region_abkhazeti` and `region_unknown` for the firms data.
- Validation rejects a changed value, a missing, extra or duplicate observation, a year outside each table's coverage, and any quarterly row. It also checks the following, within rounding:
  - sizes add up to the total every year;
  - industries add up to the total every year where every industry is published;
  - regions are compared with Georgia every year from 2006, and their shortfall (they do not add up) is recorded exactly;
  - for firms, sections and regions add up to the total;
  - every published rate equals births (or deaths) ÷ active × 100;
  - a few anchor values match Geostat: sales 2025 253,725.5 million GEL, jobs 2025 899,026, investment 2025 8,021.8 million GEL, profit 2025 27,936.1, loss 2025 7,152.9, and for 2024 active firms 249,236, births 56,259 and deaths 29,634.
- Fiscal.ge derives nothing: no net profit, shares, growth rates or interpolation.

### Serving

- All pages stay prerendered. The CSV loader and numeric client projection follow Money and banks.
- The private Supabase mirror gets a `BusinessFact` table in one versioned migration, with RLS on and public grants revoked, compared field by field in the transactional `data:import`. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 10. Sources, Excel and methodology

- The Geostat workbooks and `Remark_eng.pdf` are published through the existing source archive (`data/methodology/source-archives/business.csv`). The methodology bundle must not pull large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language. It holds the active measure's selected series and years, explicit units, blank missing cells and validated source links, with no internal identifier or cell-reference columns.
- `/methodology/business` explains in plain words:
  - which firms the survey covers, and that financial firms, public administration and market stalls are excluded;
  - the 2006 coverage change;
  - what turnover, persons employed, investment in fixed assets, profit and loss mean;
  - the firm-size thresholds (small: up to 50 people and 12 million GEL turnover; large: over 249 people or 60 million GEL);
  - betting turnover inside Arts;
  - the head-office rule for regions and why regions start in 2006;
  - what an enterprise birth and death are, and why firms stop at 2024;
  - how the Jobs figure differs from the labour-force survey;
  - that the pages state no causes.

## 11. Out of scope

Out of scope: production value, employees, earnings, value added, costs, purchases, fixed assets, productivity and gender tables; ownership and legal-form breakdowns; industries within a region (Geostat does not publish them for these measures); sub-sections of industries; quarterly values and 2026; the business register snapshot (registered and active entities on 1 July 2026, not a yearly series); survival of enterprises; net profit or any calculated ratio; forecasts; causes; MCP tools; and the central JSON/CSV publications. Each would need its own approval.

## 12. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, and CSV and database modes agree.
2. Defaults, nesting, measure switching, gaps, the 2006 break and URL state behave as in sections 3–8, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, and keyboard use and language switching keep the settings.
5. Duru sees screenshots and, if wanted, a clickable preview first (branch pushed, no PR). After Duru's OK, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved Business item), `DESIGN.md` (the hub, five pages and area pages), and add a new `docs/data-methodology/business-annual.md`.

## 13. Reuse

- **Used as is:** `ExplorerWorkspace`, `ExplorerHeading`, `LatestValueLine`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `FlatSeriesPanel`, `SeriesSelector` and `SeriesSelectorRow` (with nested rows), `SegmentedTabs` with icon options and `ControlTooltip`, `SourceNote`, `RegionIndex`, `RegionMap`, `RegionPicker`, the previous/next region links, `use-hash-explorer-state`, the economic-sector colours, the three-sheet Excel writer and `ExcelDownloadButton`, the source-archive and methodology components, the generated-artifact and served-rows parity checks, and the series-break record format used by demography and Money and banks.
- **Small additions:** `FlatSeriesPanel` gets an optional per-row `heading` label for the "Firm size" and "Industry" groups. No existing list has group headings, and its default output stays unchanged. Also, the sidebar (`navTree.ts`), footer source note, sitemap, methodology catalogue and source inventory get the new section. The import script and mirror read and compare the new table. Browser-test page counts change.
- **New:** each new file mirrors its Money and banks or Living standards counterpart file by file, because those models are tied to their own indicators. The new parts are:
  - the research package and the `prepare-business` script;
  - the Prisma model and migration;
  - `lib/data/business/*`;
  - `lib/explorer/business.ts`, `businessWorkbook.ts` and `businessHubCards.ts`;
  - `components/business/business-explorer.tsx`;
  - `lib/pages/business.tsx`, the routes and the messages;
  - the methodology content and `docs/data-methodology/business-annual.md`.
- Before writing any new file, the plan checks whether the Living standards area-page code (index plus area pages with a measure in the hash) can be shared by adding an option rather than copied. AGENTS.md "Reuse first" applies.

## 14. Coordination

No other hub thread is building right now. The branch `claude/project-thread-g0x752` starts from the latest `main` (Trade composition, PR #186, merged). Shared files (sidebar, sitemap, methodology catalogue, browser-test page counts) will need a re-merge if another hub merges first.

## 15. Decision for Duru

Approve this design. The implementation plan comes next. Approving the design does not authorize pushing, a pull request, deployment or live database changes. Screenshots or a live preview come first.
