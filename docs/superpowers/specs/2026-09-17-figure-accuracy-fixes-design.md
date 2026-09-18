# Figure accuracy on pages and in Excel files: specification

Date: 2026-09-17
Status: Approved for inline implementation on 2026-09-18. Scope, packaging and the debt-headline decision were approved in conversation on 2026-09-17, after a reviewed audit of the work merged 2026-09-02..09-14.
Baseline: `main` at `c7451ceaf`. Line numbers refer to that commit. Paths are under `apps/web/` unless they start with `data/`, `docs/` or name a root document.
Series: audit remediation, spec 1 of 8. No dependency on the other seven; spec 8 later generalises the workbook model this spec touches.

## 1. Outcome and scope

Every figure a reader sees on a page or in a downloaded workbook means what its label says. No data file, pipeline, MCP response or publication changes.

| § | Surface | Today | After |
|---|---|---|---|
| 2.1 | Debt headline, every family | Latest non-null total, so service leads with the 2030 projection | Latest actual year |
| 2.2 | Debt headline, rates | Relative % change of a rate ("−4.1%" for 4.9% → 4.7%) | Change in percentage points ("−0.2 pp") |
| 3 | Debt and deficit workbooks, percent measures | Relative "Change" column ("51.6%" for +1.6 pp) | No change column |
| 4 | Deficit series panel | Always % of GDP | Follows the active measure |
| 5 | Debt stock source note | No preliminary-GDP notice | Names the preliminary GDP years in range |
| 6 | Inflation categories workbook | Latest weight on every dated row; every row "published"; note without formula | Weight of the row's year; derived rows "calculated"; note states the formula |
| 7 | Economy hub GDP card | "2025: 27.1 bn USD" (constant 2015 USD, unlabelled) | Constant-price label |
| 8 | Readable workbook sheet | Forecast cells look like actual values | Forecast cells carry the forecast marker |

### 1.1 User-approved decisions (2026-09-17)

- The debt headline leads with the latest **actual** year for every family. The 2026–2030 existing-portfolio projection stays on the chart (dashed), in the table and in the workbook. This supersedes the 2030 headline asserted by `tests/browser/debt.spec.ts:175-188` and amends DESIGN.md §8.5.

### 1.2 Decisions taken in this spec

- Rate changes are shown in percentage points, the rule the query service already applies (`lib/factQuery/compare.ts:73-78`).
- Workbooks drop the relative change column for percentage measures rather than converting it to points, matching the four other new builders (`showChangeColumn: false`) and every on-screen table.
- Contribution and residual rows get a new status, "calculated"; published price-change rows keep "published".
- The deck delta keeps the site-wide colouring (rise = `POSITIVE`, fall = `NEGATIVE`, DESIGN.md:323).

## 2. Debt headline — `components/debt/debt-explorer.tsx`

### 2.1 Latest actual year

Evidence: `totalFacts` (`:100-104`) keeps every non-null fact of the family total and `latestTotalFact = totalFacts.at(-1)` (`:105`). For the service family that is the 2030 `projection_existing_portfolio` row, shown with the forecast chip (`:155-157`) and a coloured change against 2029.

Change:

- Move the deck computation into a pure `buildDebtDeck(facts, family)` in `lib/explorer/debtExplorer.ts` that returns `{ year, value, change }`.
- It keeps only `status === "actual"` facts of the family total. `change` exists only when the fact for `year − 1` is also actual, non-null and (for relative changes) non-zero.
- Remove the forecast chip branch, which becomes unreachable.

Expected on the baseline data:
- stock: 2025, +8.3%, unchanged
- service: 2025, 4.37 bn GEL, −9.2% vs 2024
- rate: 2025, 4.7%

### 2.2 Rate change in percentage points

Evidence: `deckYoy = (latest − previous) / previous` for every family (`:114-120`), rendered by `formatShare(deckYoy, true)`.

Change:

- For `family === "rate"`, `change` is `latest − previous` in points.
- Add `formatPoints(value, signed)` to `lib/explorer/format.ts`, using the same minus sign, rounding and one decimal as `formatShare`.
- The deck renders `{formatPoints(change, true)} {debt.pp}`.
- Add `debt.pp` to `lib/i18n/messages/{ka,en}/debt.json` with the values of `inflation.pp` ("პპ", "pp").
- Stock and service keep the relative change.

### 2.3 Tests

- New or extended `tests/explorer/debtExplorer.test.ts` for `buildDebtDeck`:
  - stock
  - service with projection rows present
  - rate in points
  - previous year missing
  - previous year not actual
- Update `tests/browser/debt.spec.ts` "keeps the deck on latest coverage and identifies projected service totals". The service deck expects `2025: ვალის გადახდა` and `წინა წელთან`, and no `პროგნოზი` chip. Rename the test to match.
- Add a browser case: `/explorer/debt#f=rate&m=line&r=2015-2025&sel=debt.rate.total` shows `4.7%` and `−0.2 პპ`.

## 3. Percentage change column in debt and deficit workbooks

Evidence: `buildWorkbookExportModel` (`lib/explorer/workbookModel.ts:131`) always computes `change` (`:147`). The writer defaults `showChangeColumn = true` (`lib/explorer/workbookWriter.client.ts:70`). `lib/explorer/debtWorkbook.ts:137` and `lib/explorer/deficitWorkbook.ts:25` never switch it off, so:
- a rate export for 2015–2025 shows "51.6%" for a +1.6 pp move
- a deficit % of GDP export for 2004–2007 shows "(77.5%)" for a −2.8 pp move

Change: add optional `showChangeColumn?: boolean` to `WorkbookExportInput`, copied onto `readable.showChangeColumn`.
- Debt passes `false` when `percentage` is true (`debtWorkbook.ts:135`).
- Deficit passes `false` when `input.percentage` is true.
- GEL exports keep the column.

Tests: `tests/explorer/debtWorkbook.test.ts` and `tests/explorer/deficitWorkbook.test.ts` assert `readable.showChangeColumn === false` for rate, stock % of GDP and deficit % of GDP, and that it is not `false` for GEL.

## 4. Deficit series panel value — `components/deficit/deficit-explorer.tsx:270`

Evidence: `value={latestActual ? formatShare(latestActual.generalGovernmentBalancePctGdp / 100) : "—"}` ignores `percentage` (`:43`). The headline above it switches correctly (`:73-76`).

Change: compute the latest-actual display value once, from `percentage`, and use it in both the headline and the panel row.

Test: extend `tests/browser/deficit.spec.ts` "switches between GDP percentage, nominal GEL and the forecast-labelled table" to assert that the series row shows the GEL amount after `measure-share-toggle`.

## 5. Preliminary GDP notice on the debt stock page

Evidence: the stock source note appends only `main.gdpSource` (`debt-explorer.tsx:270`), but 2025 debt/GDP divides by preliminary GDP. The budget page appends `main.preliminaryGdp` with the preliminary years in range (`components/main-explorer/explorer-view.tsx:111`, `:192`).

Change: when `family === "stock"`, find the preliminary years among the model's years in the active range. Use the national GDP facts the page already passes to `buildDebtExplorerModel` (`lib/explorer/debtExplorer.ts:158`, `:170`). When any exist, append `main.preliminaryGdp` with those years, using the budget page's wording and condition.

Test: `tests/explorer/debtRoute.test.tsx` checks the stock render in both locales:
- it contains the preliminary notice with `2025`
- a range ending in 2024 does not contain it

## 6. Inflation categories workbook — `lib/explorer/inflationCategoryWorkbook.ts`

### 6.1 Weight of the row's year

Evidence: every analysis row writes `latestWeight(index, entry.id)` (`:94`), the latest year's weight (`lib/explorer/inflationCategories.ts:302-307`). The contribution itself uses the weight of the month's own calendar year (`lib/data/inflation/contributions.ts:34`; categories spec §4.6, `2026-09-12-inflation-categories-design.md:134-137`).
- 2013 food rows show 33.580439% (the 2026 weight), but their contributions used 30.694816%.
- Alcohol and tobacco show 6.577308%, but their contributions used 5.358032% (`data/imports/cpi-basket-weights.csv`).

Change:
- The weight cell becomes `index.weights.get(entry.id)?.get(periodYear(period)) ?? null`, on every tab.
- A year with no weight writes an empty cell.
- `latestWeight` keeps serving selector rows and the hero sentence.

### 6.2 Status of derived rows

Evidence: every analysis row writes `t("published")` (`:105`), including computed contributions and the residual. The spec says contributions are "never presented as a Geostat figure" (`:137`).

Change: on the contribution tab, category rows and the residual row write `t("calculated")`. The year-on-year and month-on-month tabs keep `t("published")`. Add `inflation.calculated`: ka `გამოთვლილი`, en `Calculated`.

### 6.3 Formula in the note

Evidence: `inflation.categoryContributionNote` (`lib/i18n/messages/{ka,en}/inflation.json:126`) names the calculation but not the formula. Spec §9 requires it: "a note naming the measure a Fiscal.ge calculation from published values, with the formula" (`2026-09-12-inflation-categories-design.md:227`).

Change: append the formula in both locales. The owner confirms the Georgian wording in the PR.
- en: "Contribution = basket weight for the month's year ÷ 100 × annual price change (pp)."
- ka proposal: "წვლილი = თვის წლის კალათის წონა ÷ 100 × წლიური ფასის ცვლილება (პპ)."

### 6.4 Tests

Extend `tests/explorer/inflationCategoryWorkbook.test.ts`, whose fixture (`tests/explorer/fixtures/inflationCategories.ts:38-51`) gains a second weight year. It asserts:
- the weight of the row's year on a two-year range
- "Calculated" on contribution and residual rows
- "Published" on rate rows
- the formula in the contribution subtitle

## 7. Economy hub GDP card — `lib/explorer/economyHubCards.ts:26`

Evidence: the footer renders `2025: 27.1 bn USD · real: 1960–2025 · nominal: 1996–2025`. The value is `real_usd_2015`, in constant 2015 USD; nominal 2025 GDP is 38.1 bn USD.

Change: label the amount with the existing `gdp.constant` message, giving `{year}: {value} {gdp.bn} ({gdp.constant}) · …` ("2025: 27.1 bn (Constant 2015 USD) · …"). Keep the value formatting (spec 8 moves it onto the shared formatter).

Test: `tests/explorer/economyHub.test.tsx:20` keeps `toContain("27.1")` and adds the `gdp.constant` text for both locales.

## 8. Forecast marker in the readable sheet — `lib/explorer/workbookWriter.client.ts:84-90`

Evidence: planned cells get a fill and preliminary cells a quoted number-format marker. Forecast cells print as plain values: debt service 2026–2030 and deficit 2026–2031, mapped to `forecast` by `debtWorkbook.ts:88-92` and `deficitWorkbook.ts:52`. Only the subtitle ("Actual and forecast") and the analysis status column say otherwise.

Change: give `forecast` the same treatment as `preliminary`, a quoted `workbook.forecast` marker appended to the number format for both percentage and amount cells.

Tests:
- `tests/explorer/workbookWriter.test.ts` asserts that a forecast cell's `numFmt` contains the marker in both locales.
- `tests/browser/debt.spec.ts:190-225` asserts the 2026 readable cell's number format on the downloaded service workbook.

## 9. Non-goals

- Colour semantics of the deck delta.
- The budget explorer's % of GDP workbook change column (`components/main-explorer/main-explorer.tsx:271`). It is the same pattern but older approved behaviour, so it needs its own decision.
- Deficit and inflation-overview series panels that hide the bulk control (spec 3).
- CSVs, pipelines, MCP and publications.

## 10. Documents to update in the same change

- DESIGN.md §8.5 (`:592-596`): the deck reports the latest actual observation for every family, and the rate change is in percentage points. Readable workbook cells in forecast years carry the forecast marker.
- DESIGN.md §8.6 (`:598-600`): readable forecast cells carry the forecast marker.
- `docs/superpowers/specs/2026-09-02-government-debt-explorer-design.md`: an amendment note pointing here for the headline rule.

## 11. Verification and acceptance

Feedback while editing:

```bash
npx vitest run tests/explorer/debtExplorer.test.ts tests/explorer/debtWorkbook.test.ts tests/explorer/deficitWorkbook.test.ts tests/explorer/inflationCategoryWorkbook.test.ts tests/explorer/economyHub.test.tsx tests/explorer/debtRoute.test.tsx
```

```bash
npx playwright test tests/browser/debt.spec.ts tests/browser/deficit.spec.ts
```

Done-check: `npm run check`, `npm run build` and `npm run test:browser`, on the production-build recipe in CLAUDE.md with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`.

Acceptance: every row of the §1 table is observable in both locales, on `/explorer/debt` (stock, service, rate), `/explorer/deficit`, the categories contribution workbook and `/explorer/economy`.

## 12. Authority and next step

This spec owns the bounded decisions in §1. DESIGN.md stays the owner of the visual rules and is amended in the same change. After user review, the next step is an implementation plan at `docs/superpowers/plans/2026-09-17-figure-accuracy-fixes.md`.
