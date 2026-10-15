# Foreign debt and Reserves pages

Date: 2026-10-15
Status: Draft for Duru's review. Duru's decisions so far (thread "check our debt part / reserves", 2026-10-15):

- Placement: **Debt + reserves**, meaning two new pages in the External flows hub (decision card, 13:04 Tbilisi).
- The foreign-debt list shows **who owes only**, with no currency or maturity split (13:07 Tbilisi).
- **Yes, latest 2026**: both pages end with the latest published 2026 amount, marked as not a full year (decision card, 13:29 Tbilisi).

Research note with all checked numbers: `/mnt/project-files/reserves-sources/2026-10-15-debt-and-reserves.md`.

## 1. Intended result

Readers should be able to see what Georgia as a whole owes the rest of the world, who owes it, and how big the National Bank's safety buffer of foreign money is.

The pages answer four questions:

- How much does the country owe abroad, and how has that changed since 2006? (27.0 billion USD at the end of 2025, 71% of GDP; 28.2 billion at the end of June 2026.)
- Who owes it: the government, the banks, companies, loans between related companies, or the National Bank?
- How large are the National Bank's reserves, and how have they changed since 1995? (6.16 billion USD at the end of 2025; 8.17 billion at the end of September 2026.)
- What are the reserves made of: foreign currency, gold or SDRs?

What is new: the site's existing Debt page (Budget hub) covers only the **government's** debt, from the Ministry of Finance, in GEL, 2013–2025. The country's foreign debt also includes banks, companies, intercompany loans and the National Bank, and none of that is on the site today. Reserves are not on the site at all.

## 2. Pages and navigation

- **Foreign debt**: `/explorer/external/foreign-debt`, in English `/en/explorer/external/foreign-debt`. Georgian name `საგარეო ვალი`; heading `რამდენი ვალი აქვს საქართველოს საზღვარგარეთ`.
- **Reserves**: `/explorer/external/reserves`, in English `/en/explorer/external/reserves`. Georgian name `საერთაშორისო რეზერვები`; heading `რამდენი სარეზერვო ვალუტა აქვს ეროვნულ ბანკს`.
- The External flows hub gets card 04 Foreign debt and card 05 Reserves after Current account. Each card shows a small chart of its total and its coverage from the served facts, for example `2006–2026 (ივნისი)`.
- The sidebar lists both pages under External flows, after Current account.
- Both pages reuse the existing breadcrumbs, heading, language links, metadata, Dataset JSON-LD and sitemap patterns.

Georgian labels are working names; they go through the Georgian proofread with the other new labels.

## 3. Shared page rules

Both pages reuse the Money and banks workspace (DESIGN.md §34): the latest-value line, line chart, table, year range strip, right-hand series list and three-sheet Excel download.

- **Under the heading:** only the latest-value line, which names the latest amount and its date, for example `საერთაშორისო რეზერვები, 2026 წლის სექტემბრის ბოლო: 8.17 მლრდ $`. Nothing else goes under the heading.
- **No tabs.** The measure switch is the icon-only switch from Money and banks (§7.2a): `$` for amounts and Lucide `ChartPie` for % of GDP, with their names as tooltip and accessible name. The unit caption (`მლრდ $` or `%`) sits beside it.
- **Amounts** are in billion USD on the chart, with the site's usual formatting; Excel keeps million USD. **% of GDP** divides each amount by the site's own nominal GDP in USD for the same year (the GDP series Current account already uses). Preliminary GDP years are named in the source line, as on Current account.
- **Latest 2026 amount.** Each page ends with one 2026 value: the latest published amount (Reserves at the end of September, Foreign debt at the end of June). It is not a sum of months. These are amounts held or owed on a date, so adding months together would count the same money several times. The 2026 value:
  - is drawn as a hollow point, reusing the chart's existing hollow-point option (`hollowPreliminary`), as on Money from abroad;
  - shows its month in the hover, the table column header and Excel (for example `2026 (სექტ.)` / `2026 (Sep)`);
  - has no % of GDP value, because there is no 2026 GDP yet, so the % of GDP view ends at 2025 (and starts in 1996, the first GDP year, so reserves for 1995 show as a gap there);
  - comes from the same files, so it changes only when the data is refreshed, like every other page.
  These two pages are the one exception to "yearly data only". Every other year is the amount on 31 December.
- **Initial state:** amounts, chart, all years, only the total selected. The total stays first, selectable and removable. The lists are short (four or six rows), so there is no search box. Clear, Select all and the count follow the existing contract.
- The measure, years, selection and chart/table mode are stored in the URL and survive reloads and a language change.
- **Missing values** are gaps, dashes and blank Excel cells, never zeros. Gold before 2024 is a real zero (the National Bank held none), so it is shown as 0.
- **Under the chart:** only the source line (`წყარო: საქართველოს ეროვნული ბანკი · …`) with the methodology link.

## 4. Foreign debt page

Source: National Bank of Georgia, "Gross External Debt (BPM-6)" (`edbpm6eng.xlsx`, sheet `ED-GEO-Tb1`, million USD).

| Series | Georgian working label | End of 2025 |
| --- | --- | ---: |
| **Total foreign debt** (selected) | `მთლიანი საგარეო ვალი` | 27.0 bn |
| Government | `მთავრობა` | 9.2 bn |
| Banks | `ბანკები` | 9.5 bn |
| Companies | `კომპანიები` | 5.2 bn |
| Loans between related companies | `სესხები დაკავშირებულ კომპანიებს შორის` | 2.5 bn |
| National Bank | `ეროვნული ბანკი` | 0.8 bn |

- The five groups are listed under the total (nested, as on Loans and deposits) and add up to it every year.
- "Companies" is NBG's "Other sectors": non-financial companies plus non-bank financial companies. "Loans between related companies" is NBG's "Direct investment: intercompany lending", for example a foreign parent lending to its Georgian branch.
- Years: 31 December 2006 to 31 December 2025, plus 30 June 2026. NBG's older-method file (1999–2005) is not used, because it would put a method break into the line.

## 5. Reserves page

Source: National Bank of Georgia, "Official Reserve Assets" (`templatesection-ieng.xlsx`, sheet `GIR (eng)`, thousand USD).

| Series | Georgian working label | End of 2025 |
| --- | --- | ---: |
| **Total reserves** (selected) | `საერთაშორისო რეზერვები` | 6.16 bn |
| Foreign currency | `უცხოური ვალუტა` | 4.68 bn |
| Gold | `ოქრო` | 1.00 bn |
| SDRs (the IMF's reserve currency) | `სესხის სპეციალური უფლებები (SDR)` | 0.48 bn |

- The three parts are listed under the total. NBG's IMF reserve position and "other reserve assets" are left out of the list because they are tiny (under 0.03 billion USD in every year). So the three parts add up to the total within 0.03 billion. The methodology page says so, and validation checks that bound.
- Years: 31 December 1995 to 31 December 2025, plus 30 September 2026.

## 6. Data foundation

### Research package

A new package `docs/Raw Data/External/nbg-external-position/` follows the Money and banks package: original workbooks under `official/` (never edited), a source manifest (URL, retrieval time, SHA-256, size), the NBG API listing for category 24, a `prepare.py` that transcribes every used cell with its sheet and cell reference, an independent verification script, a validation report and a coverage file.

### Canonical file and checks

- `npm run data:prepare-external-position` writes `data/imports/external-position-annual.csv` (UTF-8 with BOM) and `data/reports/external-position-validation.json`. `--check` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the year, the stable indicator ID, the exact workbook value, the value rounded for display, the unit (`usd_million`), the **period end date** (`2025-12-31`, or `2026-06-30` / `2026-09-30` for the latest point), the value status (`official`), the source ID, sheet and cell, and the review date.
- Stable lowercase IDs: `ext_debt.total`, `ext_debt.government`, `ext_debt.banks`, `ext_debt.companies`, `ext_debt.intercompany`, `ext_debt.central_bank`, `reserves.total`, `reserves.fx`, `reserves.gold`, `reserves.sdr`.
- That is about 6 × 21 + 4 × 32 = 254 values.
- Validation rejects a changed value, a missing, extra or duplicate observation, a year outside each table's coverage, and more than one non-December point. It also checks:
  - every year, the five debt groups add up to the total (within rounding);
  - every year, total reserves minus the three parts is between 0 and 0.03 billion USD in absolute size;
  - the 2026 point is the latest period in the archived file, and every other year is dated 31 December;
  - anchor values: foreign debt 27,046.9 million USD at the end of 2025; reserves 6,159.3 million USD at the end of 2025; reserves 196.2 million USD at the end of 1995.
- No interpolation and no sums of months. % of GDP is calculated on the page from the served GDP, not stored.

### Serving

- Pages stay prerendered. A CSV loader and a numeric client projection follow Money and banks.
- The private Supabase mirror gets an `ExternalPositionFact` table in one versioned migration, with RLS on and public grants revoked. It is compared field by field inside the transactional `data:import`, like `MoneyBanksFact`. CSV and database modes must serve identical values. The live migration and import happen only when Duru merges, through the existing release pipeline.

## 7. Sources, Excel and methodology

- The two NBG workbooks and the category-24 listing go into the External flows source archive (`data/methodology/source-archives/external-flows.csv`). The methodology bundle must not pull in large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language, with the selected series and years in the active measure, explicit units, the 2026 column labelled with its month, blank missing cells and validated source links. It has no internal ID or cell-reference columns.
- `/methodology/external-flows` gains two short sections:
  - **Foreign debt:** what gross external debt is, what each group means, and why the government line differs from the Debt page. The Debt page uses Ministry of Finance data in GEL; here it is National Bank data in USD with slightly different rules (24.2 billion GEL vs 9.2 billion USD at the end of 2025).
  - **Reserves:** what reserves are, what SDRs are, gold from 2024, the two tiny parts left out of the list, and what the 2026 point means.
  - Both sections say that the 2026 value is the latest amount on a date, not a full year.

## 8. Out of scope

Debt by currency or maturity (Duru chose "who owes only"), the debt repayment schedule, the international investment position, the detailed monthly IMF reserves form, months of imports or other derived ratios, quarterly or monthly lines beyond the one latest 2026 point, exchange rates (Duru's rule), changes to the existing Debt page, MCP tools and the central JSON/CSV publications. Each would need its own approval.

## 9. Verification

1. The serving CSV matches the archived workbooks cell by cell; the independent verification passes; CSV and database modes agree, and a failed import rolls back.
2. Default view on both pages: amounts, all years, total only. The 2026 point is hollow and dated; the latest-value line shows it.
3. % of GDP: 2025 foreign debt reads about 71% and reserves about 16%; 2025 is named as preliminary GDP; 2026 has no value and the range clamps to 2025.
4. Chart, table and Excel agree for the same measure, years and series. The debt groups add up to the total.
5. Hub cards 04 and 05 show sparklines and coverage, and the sidebar lists both pages.
6. Georgian and English at 390, 768 and 1440 pixels; keyboard use and language switching keep the settings.
7. Screenshots (or a clickable preview, if Duru asks) go to Duru first. After Duru approves, `npm run check`, `npm run build` and `npm run test:browser` run once.

During implementation, also update `Project_Definition.md` §2 (External flows scope), `DESIGN.md` §30 (two new pages, the 2026 point as the single exception to annual-only) and `docs/data-methodology/external-flows-annual.md` (serving rules).

## 10. Reuse

- **Used as is:** `ExplorerWorkspace`, `ExplorerHeading`, `LatestValueLine`, `EditorialLineChart` (with its `hollowPreliminary` option), `ExplorerTable`, `RangeStrip`, `FlatSeriesPanel`, `SegmentedTabs`, `ControlTooltip`, `SourceNote`, `ExcelDownloadButton`, the three-sheet workbook writer, the topic-series model (`topicSeries.ts`), `useHashState`, `readVerifiedPackageFile`, `assertGeneratedArtifactMatches`, the served-rows parity check, the served nominal GDP in USD, and the source archive and methodology components.
- **Small additions:**
  - The hub card builder (`externalHubCards.ts`) gets cards 04 and 05.
  - The import script and mirror read and compare the new table.
  - External flows messages, methodology content and source-archive rows.
- **New:**
  - The research package, prepare script and validation.
  - The Prisma model and migration.
  - The two routes (Georgian and English), sidebar rows and messages.
  - A thin page component and model (`components/external/external-position.tsx`, `lib/explorer/externalPosition.ts`), laid out exactly like the Money and banks explorer and built on the same shared pieces, as each hub's page (Poverty, Wages, Energy and food, Money and banks) has its own. Considered: extending `MoneyBanksExplorer` itself. It's tied to the Money and banks messages, lari amounts, GEL-based GDP and its methodology link, and it has no dated latest point. Adding all of that would put new switches into four live pages for no gain to them.
  - A separate data package, not more rows in `money-banks-annual.csv`, because these pages belong to another hub and need a period-end date column that the Money and banks table doesn't have.

## 11. Coordination

The Business hub (thread "What data to add next") is being built at the same time. Both touch shared files: the sidebar config, the methodology hub, the Prisma schema and migrations, the import script, `data:validate` and the browser-test page counts. Design and building go ahead now on branch `claude/project-thread-w3823d`. Whichever merges second brings `main` in and resolves those files, then re-runs the full checks once.

## 12. Decision for Duru

Approve this page design. After approval, the build plan follows. Approving the design does not authorize pushing, a pull request, deployment or live database changes. Screenshots come first.
