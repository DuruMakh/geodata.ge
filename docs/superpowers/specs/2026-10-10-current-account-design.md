# Current account page

Date: 2026-10-10
Status: Draft for Duru's review. Duru approved the page outline on 2026-10-10 ("Okay let's do it") and chose **No split** for services on the decision card. This is the third page in the External flows hub. It builds on the frozen research package (`docs/superpowers/specs/2026-10-09-remittances-investment-data-design.md`) and follows the approved Money from abroad page (`2026-10-10-money-from-abroad-design.md`) and the Foreign investment page drafted in parallel (`2026-10-10-foreign-investment-design.md`).

## 1. Intended result

Readers should be able to see Georgia's yearly balance with the rest of the world and what it is made of: trade in goods, trade in services, income earned or paid across borders, and transfers such as money sent home.

The page answers three questions:

- Does Georgia earn more from the rest of the world than it pays out, and how has that changed since 2000? (In 2025 it paid out USD 1,123.2 million more than it earned, 2.9% of GDP.)
- Which of the four parts pushes the balance down or up?
- How much comes in and goes out through each part?

What is new compared with the other pages: the balance itself, services (USD 8,572.9 million in and 3,863.6 million out in 2025) and primary income (mostly profits and interest paid to foreign investors and lenders). Goods overlap with the Trade hub but use a different method (section 4). Secondary income contains the personal transfers already shown on Money from abroad.

## 2. Page and navigation

- Page: `/explorer/external/current-account`, and in English `/en/explorer/external/current-account`. Its name is **Current account** (`მიმდინარე ანგარიში`), the name the hub card already uses.
- The hub's card 03 becomes clickable and shows a small chart of the yearly balance, 2000–2025.
- The sidebar lists the page under External flows, after Foreign investment.
- The page reuses the existing breadcrumbs, headings, language links, metadata, Dataset JSON-LD and sitemap patterns.

## 3. Page layout

Under the heading there is one short line: "Georgia's annual balance with the rest of the world, in nominal US dollars." Nothing else goes under the heading. There is no headline-number block, no ranking and no notes under the chart.

Three centred text tabs come next, styled like Received | Sent on Money from abroad:

**Balance | Money in | Money out**

| Tab | Chart | Series |
| --- | --- | --- |
| Balance | Columns per year: the four parts' net values stack above or below zero; a dark line with an end dot shows the current-account balance | Current-account balance, Goods, Services, Primary income, Secondary income (all shown) |
| Money in | Lines | Current account total (credit), then the four parts' credits |
| Money out | Lines | Current account total (debit), then the four parts' debits |

- **Balance tab.** The stacked columns reuse `StackedColumnChart` (already used on Trade, Unemployment, Inflation and Demography). All four parts are always drawn, because the point is that they add up to the balance. The right-hand panel lists the five series with their end-year values and colours as a key, without checkboxes, followed by the Download button.
- **Money in and Money out tabs.** These reuse the line chart and the series selector. Only the total is selected at first; it stays first, selectable and removable. Search, Clear, Select all and the count follow the existing contract.
- **Unit switch.** A **% of GDP** pill, as on the Debt and Deficit pages, switches every tab between nominal USD (existing million/billion scale) and percent of GDP. The share uses the nominal GDP in USD already served on Fiscal.ge. Years where that GDP is preliminary (2025) are named in the source line, as on the Debt page.
- **Chart | Table**, the year range slider and the Excel download work as on Money from abroad. In table mode, the Balance tab lists the balance first and then the four parts.
- **Initial state:** Balance tab, chart, USD, all years (2000–2025).
- The tab, unit, range, selection and chart/table mode are stored in the URL and survive a language change. Switching tabs keeps the range and unit; the Money in and Money out tabs share one selection.
- Each of the five series has one fixed colour on every tab. Labels and table names identify every series without colour.
- One short source line goes under the chart: "Source: National Bank of Georgia · nominal USD · years · date · Methodology and sources".

## 4. Data rules readers see

1. **Negative values are real.** Goods and the balance are below zero in every year from 2000 to 2025, and primary income in 18 of the 26 years. Services and secondary income are above zero in every year. Negative values are drawn below zero and never turned into zero.
2. **Goods differ from the Trade hub.** In 2025 the Trade hub shows goods exports of USD 7,287.8 million and imports of 18,648.5 million (deficit 11,360.7 million); the National Bank's goods line shows 9,631.6 million and 16,445.8 million (deficit 6,814.3 million). NBG's methodology note gives the reasons: trade statistics record goods crossing the border, while the balance of payments records a change of owner, so some goods appear only in the balance of payments; and trade statistics value imports including freight and insurance (CIF), while the balance of payments values both sides at the border of the exporting country (FOB) and counts freight and insurance under services. The methodology page explains this. The chart does not.
3. **Personal transfers are inside secondary income.** The methodology page notes that secondary income includes the personal transfers shown on Money from abroad (USD 3,409.9 million of 3,717.0 million received in 2025), so readers do not add them twice.
4. **Revisions.** NBG revises the balance of payments every 30 September. The page shows the 2026-09-30 vintage.

Not on this page: the services split by type (Duru chose No split; it can be a later, separate step), the capital and financial accounts, net lending, errors and omissions, quarters, 2026 values, partner countries, growth rates, inflation adjustment, MCP tools and bulk publications.

## 5. Data scope and serving

The page promotes one subset of the frozen research package (`docs/Raw Data/External/2026-10-10/bop-annual.csv`): the `current_account`, `goods`, `services`, `primary_income` and `secondary_income` rows, credit, debit and net, for 2000–2025. That is 5 × 3 × 26 = 390 values, all numeric in the research file.

- A new `npm run data:prepare-current-account` follows `prepare-money-transfers`. It checks each input's SHA-256 against `artifact-manifest.csv`, requires current, passing independent verification and zero failed checks, then writes `data/imports/current-account-annual.csv` (UTF-8 with BOM) and `data/reports/current-account-validation.json`. `--check` reproduces both byte for byte and runs in `data:validate`.
- Five stable IDs: `ca.balance`, `ca.goods`, `ca.services`, `ca.primary_income`, `ca.secondary_income`, with reviewed Georgian and English labels.
- Validation rejects: a missing or extra year, item or flow; a value that differs from the research row; net that is not credit minus debit; and a year whose four parts do not add up to the current account (credit, debit and net), within the tolerance recorded in `prepared-reconciliation.csv`.
- % of GDP is computed when the page is built, from the served `nominal_usd` GDP series. For the balance it must agree with the research package's `shares-of-gdp-annual.csv`; a test checks this.
- Values keep their exact decimals, vintage and source cells. The private Supabase mirror gets a `CurrentAccountFact` table, with RLS on and public grants revoked, compared field by field inside the existing import transaction, like the money-transfer tables. Publishing, the live migration and the live import remain separate authorized operations.

## 6. Sources and Excel

No new source files. NBG's BPM6 balance-of-payments workbook and its external-sector methodology note are already in the External flows source archive (added for Money from abroad); their archive notes are extended to say the Current account page uses them too.

The page reuses the three-sheet Excel writer (Summary, Data, Sources). The workbook is in the selected language and contains the active tab's series for the selected years in the selected unit, with explicit units and validated source links. It has no internal identifiers or cell-reference columns.

The methodology page `/methodology/external-flows` gains a short Current account section: what the four parts are, the goods comparison with the Trade hub (rule 2), personal transfers inside secondary income (rule 3) and the yearly revision. It must not pull large data files into the methodology bundle (the fix in PR #170 keeps downloads out of the Vercel function bundle).

## 7. Verification

1. The serving package matches the research package exactly. CSV and database modes agree, and a failed import rolls back.
2. The default view is Balance, USD, all years. Each year's stacked parts add up to the balance line. Switching to % of GDP rescales every tab; 2025 is named as preliminary GDP.
3. Money in and Money out start with only the total; adding and removing parts, search, bulk actions, an empty selection and invalid saved settings follow the existing contract.
4. Chart, table and Excel agree for the same tab, unit, years and series. The 2025 balance reads USD 1,123.2 million deficit and −2.9% of GDP.
5. Check Georgian and English at 390, 768 and 1440 pixels. Keyboard use and language switching keep the settings.
6. Screenshots go to Duru first. After Duru approves them, run `npm run check`, `npm run build` and `npm run test:browser` once.

During implementation, also update `Project_Definition.md` section 2, `DESIGN.md` (the new page) and `docs/data-methodology/external-flows-annual.md` (the serving rules).

## 8. Reuse

- **Used as is:**
  - `ExplorerWorkspace`, `StackedColumnChart`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector`, `TextTab`, `MeasurePill`, `SegmentedTabs`, `SourceNote`
  - the three-sheet Excel writer
  - the source archive and methodology components
  - `readVerifiedPackageFile`, `assertGeneratedArtifactMatches`, the served-rows parity check
  - the served nominal GDP series
- **Small additions:**
  - the hub card builder takes the current-account data for card 03
  - the import script and mirror read and compare the new table
  - the External flows methodology content and source-archive notes
- **New:**
  - the current-account serving package and its validation
  - the Prisma model and migration
  - the page component, its state and model (mirroring the Money from abroad files)
  - the route, sidebar entry and messages

## 9. Coordination

The Foreign investment thread changes the same hub cards, sidebar, External flows messages, methodology content and mirror files. This branch starts from `main` after that work merges where possible; otherwise it merges `main` in and resolves those shared files.

## 10. Decision for Duru

Approve this page design. After approval, the implementation plan follows. Approving the design does not authorize pushing, a pull request, deployment or live database changes. Screenshots come first.
