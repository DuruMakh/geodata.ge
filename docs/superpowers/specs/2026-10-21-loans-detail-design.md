# Loans in detail: Who borrows and Loans by region

Date: 2026-10-21
Status: waiting for Duru's review of this written design. Approved so far: Duru picked "Loans in detail" from the National Bank gaps list (thread "Loans in detail", 2026-10-21 15:12 Tbilisi), chose "Two pages" (15:13) and approved the page layout (15:15). This document extends the Money and banks hub (`docs/superpowers/specs/2026-10-11-money-banks-design.md`, `Project_Definition.md` §2J, `DESIGN.md` §34).

## 1. Intended result

Today the Loans and deposits page shows how much banks lend and in which currency. It does not show who borrows or what the money is for. Two new pages close that gap, using only yearly National Bank of Georgia (NBG) figures:

- **Who borrows.** How much businesses and households owe the banks. Businesses are split into 11 industries, and household loans by purpose (consumer, home, business, car, pawn, other). End-2025: 69.0 billion GEL in all. Households owe 37.4 billion and businesses 31.7 billion. Construction is the largest industry at 7.1 billion, then trade at 6.6 billion.
- **Loans by region.** How much banks have lent in each region, on the region map, with a page for Georgia and for each region. End-2025: 71.8 billion GEL, of which Tbilisi 52.4 billion (73%).

The pages state no causes and show no forecasts. No exchange-rate series is served.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Who borrows | `/explorer/money/borrowers` | `/en/explorer/money/borrowers` | ვინ იღებს სესხს |
| Loans by region | `/explorer/money/regions` | `/en/explorer/money/regions` | სესხები რეგიონებში |
| Area pages | `/explorer/money/regions/[id]` | `/en/explorer/money/regions/[id]` | სესხები — {area} |

- `[id]` covers Georgia and the 11 regions, using the Business area slugs (`georgia`, `tbilisi`, `adjara`, …). That is 12 pages per language. An unknown id returns 404.
- In the sidebar and on the hub, the two new sections sit right after Loans and deposits. The order becomes Money supply, Loans and deposits, Who borrows, Loans by region, Interest rates, Bank health. The hub goes from four cards to six.
  - The Who borrows card has an ink sparkline of all loans (`borrowers.total`), its latest figure and its years.
  - The Loans by region card shows only its map years, as the Business Regions card does.
- The Loans by region item stays active in the sidebar on the area pages.
- Breadcrumbs, language links, metadata, Dataset JSON-LD and the sitemap follow the existing pattern.

## 3. Shared rules

The rules of `DESIGN.md` §34 and §35 apply unchanged:

- Under the heading there is only one short latest-value line, and it fits on one line at 375px.
- The only line under the chart is the source note.
- There is no tab row.
- Missing years show as gaps in the chart, dashes in the table and blank cells in Excel, never zeros.
- Every subcategory is visible from the start under small headings, with no collapsible parents.
- Series names carry no prefixes such as "Loans:".
- Selection is unlimited. Only the applicable total is selected on arrival, and it stays first and removable.
- Chart or table, years and selection live in the URL hash and survive reloads and language switches.
- Every list mixes only one unit, so any ticked rows share one axis.
- Only yearly values are shown. Every amount is the December (end-of-year) outstanding amount. The last year is 2025; 2026 is added once December 2026 is published.

## 4. Who borrows page

Line under the heading: "2025: all loans 69.0 billion GEL".

There is one list, in billion GEL (the money pages' unit; Excel keeps million GEL):

| Heading | Rows (selected first in bold) | Years |
| --- | --- | --- |
| (none) | **All loans** (ink) | 2003–2025 |
| Who borrows / ვინ იღებს სესხს | Businesses (2003–2025), Households (2015–2025), People (2003–2025), Individual entrepreneurs (2015–2025) | as listed |
| Businesses by industry / ბიზნესი დარგების მიხედვით | Agriculture, forestry and fishing; Industry; Construction; Trade; Hotels and restaurants; Transport and communications; Financial services; Real estate and research; Education; Health and social services; Other services | 2003–2025 |
| What households borrow for / რისთვის იღებენ სესხს შინამეურნეობები | Consumer loans; Home loans (purchase and repair); Business loans, small and medium; Business loans, large; Car loans; Pawn loans; Other (overdrafts, cards, instalments) | 2015–2025 |

- **Households, People and Individual entrepreneurs.** NBG publishes a Households total, and its split into people and individual entrepreneurs, only from December 2015. Before that it gives People only, and People plus Businesses equals All loans. So Households and Individual entrepreneurs start in 2015, while People and Businesses run from 2003. Nothing is filled in for earlier years. Each industry keeps the economic-sector colour of §4.2, as Business does.
- **The household-purpose rows** come from a different NBG table (loans by purpose). That table also counts loans to non-residents, so its seven rows add up to 38.2 billion GEL for 2025, not exactly the 37.4 billion Households figure. The methodology page says so. The list heading makes clear these rows are a split by purpose, not parts of the Households row. Each purpose row is NBG's lari amount plus its foreign-currency amount, added up by fiscal.ge and marked as calculated.
- The list has 23 rows, so it shows the shared search box (above the threshold). Search never scopes the count or the bulk action.

**Why this total differs from Loans and deposits.** All loans here is NBG table L3.10.1 (loans to the economy by type of activity). It counts the principal only: 69.0 billion GEL at end-2025. Loans and deposits uses table L3.5, which also counts accrued interest: 72.5 billion. Loans by region uses a third table, which also covers loans to non-residents and to other banks' accounts: 71.8 billion. Each page uses its own table's total, so that the parts on that page add up to the total shown there. The methodology page explains the three totals side by side, the way the Debt pages explain government vs national debt.

## 5. Loans by region page (index)

Line under the heading: "2025: Tbilisi 52.4 billion GEL".

This page reuses the Business Regions index (`DESIGN.md` §35):

- the shared `RegionIndex` map and ranked list of the 11 regions, coloured by the latest year that all regions have (2025), with all loans in billion GEL to one decimal;
- the occupied-territory overlays;
- Georgia as the first, unranked row of the list.

Every map shape and list row opens that area's page. There is no measure switch and no chart workspace. The one source line is the `RegionIndex` footer: "Source: National Bank of Georgia · loans are counted where the lending bank branch is, not where the borrower lives · billion GEL, end of year · 2015–2025 · Methodology". It also carries the geoBoundaries credit.

Abkhazeti AR has a row in the NBG file but no values. It is not drawn or listed, as on the other region maps.

## 6. Area pages

These follow the Business area pages:

- the heading `სესხები — [იმერეთი ▾]` / `Loans — [Imereti ▾]`, with the `RegionPicker` (Georgia first, plus an all-regions entry that returns to the index) and previous/next links;
- one latest-value line, for example "2025: all loans 4.0 billion GEL · Imereti";
- no map;
- the chart workspace, with Chart | Table and the unit caption.

The list has three rows, in million GEL (as on Business area pages, so a small region still reads as a number, for example Racha-Lechkhumi at 60.5 million): **All loans** (ink, selected), In lari and In foreign currency. Years run 2015–2025.

- A region's All loans is NBG's lari amount plus its foreign-currency amount, added up by fiscal.ge and marked as calculated.
- Georgia's In lari and In foreign currency are NBG's Total rows, and its All loans is their sum.

## 7. Breaks in the NBG series

The NBG files note four changes. Following the Bank health precedent, the data records each one in `data/imports/money-banks-series-breaks.csv`. The methodology page explains them in plain words. None is drawn as a gap, and no change is computed across them.

| Break id | Year | Series | What NBG changed |
| --- | --- | --- | --- |
| `loans_activity_2014` | 2014 | the 11 industries | Banks updated their clients' activity data from June 2014, which moved loans between industries |
| `loans_overdue_2015` | 2015 | everything on Who borrows | Overdue loans are included from 1 December 2015; Households and individual entrepreneurs are shown separately from then |
| `loans_sector_2022` | 2022 | Businesses, Households, People, Individual entrepreneurs, the industries | A unified register of legal entities changed how borrowers are sorted into sectors from September 2022 |
| `loans_microbanks_2025` | 2025 | all new series | Microbanks are included from January 2025 |

## 8. Data foundation

### Sources

All files come from NBG's statistics page, category 17 (loans), listed by `GET https://nbg.gov.ge/gw/api/ct/statistics/categories/17/data` with `Accept-Language: en`. All three downloaded directly from the cloud workspace on 2026-10-21.

| NBG code | File | Used for | Served values |
| --- | --- | --- | --- |
| L3.10.1 | `loans-structure-l3-10-1eng.xlsx`, sheet `Total` | All loans, Businesses, 11 industries, People (Dec 2003–2025); Households, Individual entrepreneurs (Dec 2015–2025) | 13 × 23 + 2 × 11 + 23 = 344 |
| LPR | `loans-by-lopeng.xlsx`, sheet `HH` | Seven household purposes, lari block + foreign-currency block (Dec 2015–2025) | 7 × 11 = 77 (calculated) |
| LREG | `loans-by-regions-lregeng.xlsx`, sheets `NC` and `FC` | Georgia and 11 regions: in lari, in foreign currency, all (Dec 2015–2025) | 12 × 3 × 11 = 396 (the 132 "all" values calculated) |

That is about 817 new served values, which join the existing 730. The research package also keeps the API listing and the three files' Notes sheets. The "of which" consumer and real-estate columns of L3.10.1 and the `LE`, `GEL` and `FRC` sheets are not served.

### Research package and canonical file

These **extend** the existing Money and banks package rather than adding a new one:

- `docs/Raw Data/Money/nbg-money-banks-annual/` gets the three originals under `official/`, manifest rows (URL, retrieval time, SHA-256, size), new cell-map entries in `prepare.py`, matching checks in `verify_independent.mjs` and `test_validation.py`, and coverage rows.
- `npm run data:prepare-money` writes the new rows into the same `data/imports/money-banks-annual.csv`. `--check` reproduces it byte for byte.
- New stable ids:
  - `borrowers.total`, `borrowers.businesses`, `borrowers.households`, `borrowers.people` and `borrowers.individual_entrepreneurs`;
  - `borrowers.industry.{agriculture, industry, construction, trade, hotels_restaurants, transport_communications, financial, real_estate, education, health_social, other_services}`;
  - `households.purpose.{consumer, home, sme, large_business, car, pawn, other}`;
  - `loans_region.{georgia | region_<id>}.{total, gel, fx}`, with the region ids of `BUSINESS_REGIONS`.
- Units: `gel_million`. Basis: `actual`. Value status: `official`, or `calculated` for the purpose totals and the regions' all-loans sums.

### Validation (added to the existing checks)

Validation rejects a changed value, a missing, extra or duplicate observation, or a year outside each series' coverage. It also checks every year that:

- Businesses + People = All loans up to 2014, and Businesses + Households = All loans from 2015;
- People + Individual entrepreneurs = Households from 2015;
- the 11 industries add up to Businesses;
- for each region and for Georgia, in lari + in foreign currency = all;
- the 11 regions add up to Georgia's total, in lari and in foreign currency;
- every amount is ≥ 0.

All of these hold within rounding (0.5 million GEL).

It also checks these anchors: All loans end-2025 69,035.7 million GEL; Households 37,355.4 million; Georgia's regional total 71,780.2 million (41,698.7 in lari + 30,081.5 in foreign currency); Tbilisi 52,420.1 million.

### Serving

- The `MoneyBanksFact` table and its loader are generic (year, indicator, value), so **no schema migration** is needed. The new rows go through the same parity-checked `data:import` and the db-mode build parity check.
- The new sources join `MONEY_BANKS_PUBLIC_SOURCES`, so they stay outside `/mcp` and the JSON publications, like the rest of Money and banks.
- All pages stay prerendered.

## 9. Excel and methodology

- Excel reuses the three-sheet Money and banks writer (Summary, Data, Sources), giving the selected rows and years in million GEL. Calculated values are marked, and the source links are validated.
  - On Who borrows, the Data sheet names each break year in the row's basis note.
  - On area pages, the area is in the file name, for example `fiscal-money-loans-region-imereti-2015-2025-en.xlsx`.
- `/methodology/money` gets a "Loans in detail" section. In plain words it explains:
  - what each NBG table counts (principal vs principal plus interest; residents vs non-residents);
  - why the three totals differ;
  - that regions follow the lending branch's location;
  - what each purpose means, in NBG's definitions;
  - the four breaks;
  - which values fiscal.ge adds up.
- `docs/data-methodology/money-banks-annual.md` gets the same detail for maintainers.

## 10. Out of scope

- Interest rates by loan type (`lmreng.xlsx`): NBG gives only monthly rates on new loans, so a yearly figure would be our own average.
- Loans by currency within each industry or purpose, and the foreign-currency share icon on Who borrows (Duru kept the layout without it).
- Per-person loans on the region pages.
- Loans to legal entities by purpose (sheet `LE`).
- New lending during the year (flow tables).
- Microfinance organisations, monthly values, and 2026 before December is published.
- MCP tools and the JSON publications.

## 11. Verification

1. The canonical file reproduces every new value from its source cell, the independent verification passes, and CSV and database modes agree.
2. Defaults, headings, gaps (Households and Individual entrepreneurs before 2015, every purpose before 2015), URL state, and the 2025 values in sections 4–6 behave as described.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 375, 768 and 1440 pixels. Every latest-value line fits on one line at 375px. Keyboard use and language switching keep the settings.
5. A live preview goes to Duru first. After Duru approves it, `npm run check`, `npm run build` and the browser suite run once, and then the branch is pushed and the PR opened.

The same change updates:

- `Project_Definition.md` §2J (two more Money and banks pages);
- `DESIGN.md` §34 (the six-card hub and the two pages) and the route list;
- the methodology documents in §9;
- the browser tests' page counts and sitemap expectations.

## 12. Reuse

- **Used as is:**
  - for the Who borrows page: the Money and banks workspace (`ExplorerWorkspace`, `LatestValueLine`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`), the flat series panel with optional row `heading`, the sector colours, and the three-sheet Excel writer;
  - for the region pages: `RegionIndex` with `buildLatestValueRegionMapModel` and `latestCompleteRegionYear`, `areaRoutes`, `RegionPicker`, and the Business area-page shell;
  - for checks: the series-break record format and the parity checks.
- **Small additions:**
  - `MONEY_BANKS_INDICATORS`, `MONEY_BANKS_SECTIONS` (two sections), the hub-card headline map, `prepare.py` and `prepareMoneyBanks.ts` (the new cells), `validation.ts` (the checks in §8), and the messages;
  - the sidebar, sitemap and methodology content;
  - `MONEY_BANKS_PUBLIC_SOURCES` (three sources).
- **New** (each follows its Business counterpart file by file):
  - `lib/explorer/moneyBanksRegionMap.ts` (as `businessRegionMap.ts`) and `lib/explorer/moneyBanksAreas.ts` (as `businessAreas.ts`);
  - the page modules `lib/pages/moneyBanksRegions.tsx` and `moneyBanksArea.tsx` (as `business-regions.tsx` and the business area page);
  - `components/money-banks/money-banks-area-explorer.tsx` (as `business-area-explorer.tsx`);
  - the six route files (ka and en for the borrowers page, the index and the area pages).

  The Who borrows page reuses `money-banks-explorer.tsx` with one more section entry. The Business components are tied to Business indicators and units, so they are copied in shape, not shared, as Business did with the Living standards area pages.

## 13. Coordination

The branch `claude/project-thread-zip3g1` starts from `main` at `a456de1f`. It is rebased on the latest `main` before the PR. Other open hub threads may also touch the sidebar, sitemap and browser page counts; whichever merges second redoes those edits.

## 14. Decision for Duru

Approve this written design. The build plan comes next. Approving it does not authorize pushing, a pull request or a release; a live preview comes first.
