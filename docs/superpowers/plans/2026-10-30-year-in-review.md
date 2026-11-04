# Year in Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-year Analysis page at `/explorer/analysis` with Duru's "Year in review" (`წლის მიმოხილვა`) page: a year ruler and six sections that read one year from every angle.

**Architecture:** The server loads the existing served datasets and builds one compact, language-resolved `YearReviewData` object (`lib/yearReview/`). The client page holds three pieces of state (year, grouping, long-view side and measure, plus a picked category) and derives every section's view from that object with pure functions. Charts are server-renderable React (SVG/HTML). The four column charts reuse `StackedColumnChart` through two new optional props.

**Tech Stack:** Next.js 16 (static prerender), strict TypeScript, Tailwind v4, the editorial component layer, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-year-in-review-design.md` (approved 2026-10-30). Design source: `/mnt/project-files/year-in-review/design/AN-App.dc.html` (strings in its `T` object, lines 927–1051; layout in its markup) and screenshots in `/mnt/project-files/year-in-review/design-shots/` (`an-app.png` desktop, `an-phone.png` 375px, `an-pin.png` picked category, `an-adm.png` institutions).

## Global Constraints

- Work in `apps/web`. Feedback loop: `npx vitest run <file>` and `npm run typecheck`. Do not run `npm run check`, `npm run build` or the browser suite until Task 10 (CLAUDE.md test loop). Never push; commits stay local until Duru approves the screenshots.
- Address stays `/explorer/analysis` and `/en/explorer/analysis`. Name: `წლის მიმოხილვა` / `Year in review`. Line under H1: `ერთი წელი ყველა კუთხიდან` / `One year from every angle`, one line at 375px in both languages.
- Every number comes from served data. No hardcoded years, totals or population. Ranges and the default year come from the data.
- Actual wins over planned (`chooseActivePublicFacts`). Planned values are always marked `გეგმა` / `plan`.
- Every chart has a `<ChartShareButton>` (DESIGN.md §7.17), and every chart file contains `<ChartShareButton`.
- No footer line on the page. No Excel download on the page.
- No new dependencies, no shadcn, Lucide for UI icons. Colours come from `lib/explorer/colors.ts` (`colorForItem`, `SERIES_COLORS`, `INK`, `ACCENT`, `POSITIVE`, `NEGATIVE`). Chart text uses `style={{ fontFamily: "var(--font-numeric)" }}` as other charts do.
- All copy goes in `lib/i18n/messages/{ka,en}/yearReview.json` as `yearReview.<boardKey>`, keeping the board's key names and wording (minus the strings listed as dropped in Task 1). `npm run i18n:check` must pass.
- Breakpoints: phone below 768px, as the rest of the explorer.

## Review Focus

1. **Chosen year missing from a dataset** (2026 plan year for debt, refunds, municipalities; 2004 for tax breaks): a year tag with the year actually used, never a blank or a 0. Test: `nearestYear` cases in Task 3, plus a 2026 render assertion in Task 6.
2. **First year (2004)**: "what changed" shows the `s2None` text, KPI change lines read `firstYear`, the "then" grid is the same year. Test: Task 3 `changeView(…, 2004)` returns `{ none: true }`.
3. **Negative revenue lines** (`revenue.other_taxes` 2019–2020): the 100-cell grid and the long-view share area count them as 0, and the grid still sums to 100. Test: Task 3 `hundredCells` with a negative value.
4. **Institutions grouping in a year where an institution has no value** (categories appear or vanish between years): ranking, change bars and long view do not crash, and the change bar shows the `newCat` note. Test: Task 3 `changeView` with a null previous value.
5. **English page**: no Georgian text in English sections, including generated sentences, ordinals and the per-resident notes. Test: Task 10 browser test with `expectEnglish`.

---

### Task 1: Rename the page and add its message files

**Files:**
- Create: `lib/i18n/messages/ka/yearReview.json`, `lib/i18n/messages/en/yearReview.json`
- Modify: `lib/i18n/messages/{ka,en}/common.json` (`common.analysis`), `lib/explorer/sections.ts:18` (label), `lib/i18n/messages/{ka,en}/hub.json` (`hub.analysisDescription`), `lib/i18n/messages/{ka,en}/landing.json` (`landing.ch1.hint`), and the hub-card fallback string in `lib/explorer/hubCards.ts:212`
- Modify: `lib/i18n/types.ts` (`MESSAGE_SCOPES` gains `yearReview`) and `lib/i18n/messages.server.ts` (ka and en importers), as `taxBreaksRefunds` is registered
- Test: existing `tests/explorer/hubCards.test.ts` and `tests/i18n/*` expectations that name `ანალიზი` / `Analysis`

**Interfaces:**
- Produces: the namespace `yearReview` with keys `yearReview.<key>` for every key of the board's `T.ka` / `T.en`. Nested board objects become dotted keys (`yearReview.cnt.fn`, `yearReview.iceCols.vat`, `yearReview.led.spend.name` / `.scope`, `yearReview.rtN.tot`). Board placeholders `{y}`, `{v}`, `{p}`, `{n}`, `{a}`, `{b}`, `{name}`, `{gap}`, `{r}`, `{k}` are kept as they are.

Values:
- `common.analysis`: `წლის მიმოხილვა` / `Year in review`. `sections.ts` label: `წლის მიმოხილვა`.
- `hub.analysisDescription`: `ერთი წელი ყველა კუთხიდან: შემოსავალი, შეღავათები, ხარჯი, ვალი და მუნიციპალიტეტები.` / `One year from every angle: receipts, tax breaks, spending, debt and municipalities.`
- `landing.ch1.hint`: `წლის მიმოხილვა` / `Year in review`.
- `yearReview.line`: `ერთი წელი ყველა კუთხიდან` / `One year from every angle`.
- New keys: `yearReview.metaTitle` (`{y} — წლის მიმოხილვა` / `{y} — Year in review`), `yearReview.metaDescription` (one sentence naming the six topics), `yearReview.ordinal` (ka `მე-{n}`; en uses `yearReview.ordinal.one|two|few|other` → `{n}st|{n}nd|{n}rd|{n}th`), `yearReview.share.*` titles for each chart's share card (use the chart's own heading).
- Dropped board keys (the shell provides them): `skip`, `brandSub`, `nav`, `search`, `searchAll`, `allData`, `hubs`, `collapse`, `expand`, `menu`, `close`, `method`, `ai`, `langLabel`, `pages`, `topicsLit`, `expandHub`, `collapseHub`, `crumbs`, `home`, `data`, `budget`, `metaTop`, `chaps`.
- `nPop` is rewritten for Geostat population: ka `ერთ მცხოვრებზე: საქსტატის მოსახლეობა 1 იანვრის მდგომარეობით ({y} — {v}).`, en `Per resident: Geostat population on 1 January ({y}: {v}).` `nSrc` takes `{date}` instead of the fixed date.

- [ ] **Step 1:** Update the existing tests that assert the old name to the new one (`hubCards.test.ts` and any `tests/i18n` file that `grep -rn "ანალიზი\|\"Analysis\"" tests` finds outside the analysis-specific tests deleted in Task 6). Run them and see them fail.
- [ ] **Step 2:** Make the message and label changes above. Create the two `yearReview.json` files from the board's `T` object.
- [ ] **Step 3:** Run `npx vitest run tests/explorer/hubCards.test.ts` and `npm run i18n:check`. Expected: both pass.
- [ ] **Step 4:** Commit: `feat(year-review): rename Analysis to Year in review and add its messages`.

### Task 2: Year-review data builder (server)

**Files:**
- Create: `lib/yearReview/types.ts`, `lib/yearReview/buildYearReviewData.ts`
- Test: `tests/yearReview/buildYearReviewData.test.ts`

**Interfaces:**
- Consumes: `loadServedExplorerData`, `loadServedExpenditureTypesData`, `loadServedTaxBreaksRefundsData`, `loadServedGeneralGovernmentBalanceData`, `loadServedGovernmentDebtData`, `loadServedMunicipalData`, `loadServedDemographyData`; `buildMunicipalListRows`, `MUNICIPAL_PER_RESIDENT_YEAR`; `chooseActivePublicFacts`; `isDerivedTotalItemId`; `REVENUE_BANDS` (tax ids = the `vat`, `income`, `profit`, `excise`, `otherTaxes` bands) from `lib/landing/chapters/budgetSeries.ts`; `publicLabel`; `colorForItem`, `SERIES_COLORS`.
- Produces (`lib/yearReview/types.ts`, no imports so it is client-safe):

```ts
export type Values = (number | null)[]; // aligned to the owning block's `years`
export type Category = { id: string; label: string; color: string; values: Values };
export type YearReviewData = {
  budget: {
    years: number[];            // first..last active expenditure year (2004..2026)
    planned: boolean[];         // expenditure active facts of that year are planned
    defaultYear: number;        // last year whose expenditure is not planned
    fields: Category[];         // GEL; sorted by defaultYear value desc, spending.other_unclassified last
    institutions: Category[];   // admin_category level only, same sort
    receipts: (Category & { tax: boolean })[]; // revenue items, GEL, same years (null where absent)
    gdp: Values;                // GEL, current prices
    population: Values;         // persons on 1 January, demography.population_total, country.georgia
  };
  spendingTypes: { years: number[]; total: Values; types: Category[] }; // nominal GEL; types exclude spending_type.total and .expense
  taxBreaks: { years: number[]; vat: Values; income: Values; all: Values }; // GEL (served value is mln: ×1e6)
  refunds: { years: number[]; values: Values };                            // GEL
  balance: { years: number[]; pctGdp: Values; gel: Values; projection: boolean[] };
  debt: {
    stock: { years: number[]; external: Values; domestic: Values; total: Values }; // GEL, actual only
    rates: { years: number[]; total: Values; external: Values; domestic: Values }; // percent
    service: { years: number[]; principal: Values; interest: Values; projection: boolean[] }; // GEL
  };
  municipal: {
    year: number;               // MUNICIPAL_PER_RESIDENT_YEAR
    regions: { id: string; label: string }[];
    places: { code: string; label: string; regionId: string; totalGel: number; perResidentGel: number }[];
  };
  updatedAt: string;            // citedReviewedAt over budget + admin facts, as today's page
};
```

- [ ] **Step 1: Write the failing tests** (against real CSV-mode served data):
  - `budget.years[0] === 2004`, `budget.defaultYear === 2025`, `budget.planned.at(-1) === true`.
  - The 2025 sum of `fields` equals the Expenditure page's 2025 total (sum of active detail facts, the same way `buildSpendingSeries` sums them); the same for `institutions` against active `admin_category` facts.
  - `receipts` tax items are exactly the ids in the five tax bands, and every receipts id is in some `REVENUE_BANDS` band.
  - `taxBreaks.all` at 2024 ≈ 6403.18e6 (±1e4), `refunds.values` at 2025 ≈ 2721.1e6.
  - `balance.projection` is true exactly for `status === "projection"` years. `debt.service.projection` is true exactly for `projection_existing_portfolio`.
  - `municipal.places.length === 64`. Every `perResidentGel` equals `buildMunicipalListRows(...).municipalities` for the same code (so the page agrees with the Municipalities page).
  - `budget.population` at 2025 equals the demography `country.georgia` 2025 value.
- [ ] **Step 2:** Run `npx vitest run tests/yearReview/buildYearReviewData.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `loadYearReviewData(presentation: Presentation): Promise<YearReviewData>` (does the loads) and `buildYearReviewData(input: YearReviewInput, presentation: Presentation): YearReviewData` (pure; `YearReviewInput` is the loaders' outputs by name). Labels come from `publicLabel` (budget ids), admin category labels, the expenditure-types registry, and municipal names, in `presentation.locale`. Colours: `colorForItem(id, index)` for fields, institutions and receipts (the same calls the explorer makes), `SERIES_COLORS[id]` for spending types.
- [ ] **Step 4:** Run the test. Expected: PASS. Run `npm run typecheck`.
- [ ] **Step 5:** Commit: `feat(year-review): build the year-review data from served datasets`.

### Task 3: Year views (pure functions)

**Files:**
- Create: `lib/yearReview/yearView.ts`
- Test: `tests/yearReview/yearView.test.ts`

**Interfaces:**
- Consumes: `YearReviewData`, `Category`, `Values` (Task 2); `squarify` from `lib/explorer/treemapLayout.ts`.
- Produces:

```ts
export type Picked<T> = { year: number; value: T; fallback: boolean }; // fallback: year !== chosen year
export function nearestYear(years: number[], values: Values, chosen: number): number | null;
// at or before `chosen` with a non-null value, else the nearest after; null when the series has none
export function hundredCells(values: number[]): number[]; // whole cells per item, sum 100; values <= 0 get 0; largest remainder; ties to the earlier item
export type GlanceKpi = { id: "spend" | "tax" | "balance" | "debt" | "breaks" | "perResident"; year: number; fallback: boolean;
  value: number; planned: boolean; previous: { year: number; value: number } | null; spark: Values; sparkIndex: number };
export function glanceKpis(data: YearReviewData, year: number): GlanceKpi[];
export type BalanceRecord = { kind: "surplus" } | { kind: "smallestSince" | "largestSince"; since: number } | { kind: "smallestEver" | "largestEver" };
export function balanceRecord(data: YearReviewData, year: number): BalanceRecord; // compares with earlier actual years only
export type WhereView = { items: { id: string; label: string; color: string; value: number; share: number; change: number | null; cells: number; spark: Values }[];
  cells: string[]; thenYear: number; thenCells: string[]; total: number; planned: boolean };            // cells: 100 ids in rank order
export function whereView(data: YearReviewData, grouping: "fields" | "institutions", year: number): WhereView;
export type ChangeView = { none: true } | { none: false; previousYear: number; basis: "actual" | "planVsActual"; total: number; totalPct: number;
  rows: { id: string; label: string; color: string; delta: number | null; pct: number | null }[]; topUp: string | null; topDown: string | null; upShare: number | null };
export function changeView(data: YearReviewData, grouping: "fields" | "institutions", year: number): ChangeView; // rows sorted by delta desc, nulls last
export type BuysView = Picked<{ total: number; tiles: { id: string; label: string; color: string; value: number; share: number; change: number | null; rect: [number, number, number, number] }[] }>;
export function buysView(data: YearReviewData, year: number): BuysView; // squarify over 1000×430, tiles under 3% share are listed, not labelled
export function givesUpView(data: YearReviewData, year: number): Picked<{ vat: [number, number]; income: [number, number]; all: [number, number]; per100: { vat: number; income: number; all: number } }>; // [collected, given up]; collected = receipts vat / income+profit / all tax
export function refundsView(data: YearReviewData, year: number): Picked<{ value: number; shareOfTax: number; record: boolean }>;
export function debtView(data: YearReviewData, year: number): Picked<{ total: number; external: number; domestic: number; toGdp: number | null; perResident: number | null; rate: number | null }>;
export function perResidentRows(data: YearReviewData, year: number): { id: "spend" | "tax" | "debt" | "svc" | "soc" | "mun"; value: number; year: number; fallback: boolean }[];
export function regionsView(data: YearReviewData): { median: number; regions: { id: string; label: string; average: number; places: YearReviewData["municipal"]["places"] }[] }; // average = Σ total ÷ Σ (total ÷ perResident); sorted desc
export type LongView = { years: number[]; planned: boolean[]; bands: { id: string; label: string; color: string; values: number[] }[]; top: number[];
  gain: { id: string; from: number; to: number } | null; loss: { id: string; from: number; to: number } | null };
export function longView(data: YearReviewData, side: "expenditure" | "revenue", measure: "share" | "gel"): LongView; // negatives count as 0; gain/loss over first..last actual year
```

- [ ] **Step 1: Write the failing tests**, with small synthetic `YearReviewData` built by a `fixture()` helper in the test file:
  - `nearestYear`: exact year; a missing year falls back to the earlier one; before the first value it takes the next one; all-null gives null.
  - `hundredCells([60, 30, 10])` → `[60, 30, 10]`; `hundredCells([1, 1, 1])` sums to 100 as `[34, 33, 33]`; `hundredCells([50, -5, 50])` → `[50, 0, 50]`.
  - `changeView(fixture, "fields", firstYear)` → `{ none: true }`; a plan year gives `basis: "planVsActual"`; a category null in the previous year has `delta: null` and sorts last.
  - `balanceRecord`: a year deeper than every earlier year → `largestEver`; a projection year deeper than the chosen actual year does not count.
  - `regionsView` average equals Σtotal / Σpopulation, and the median of 4 places is the mean of the middle two.
  - `glanceKpis(fixture, 2026)` for a dataset ending in 2025 gives `fallback: true, year: 2025`.
  - `longView(..., "share")`: every column sums to 1 (±1e-9) with a negative item present.
- [ ] **Step 2:** Run `npx vitest run tests/yearReview/yearView.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the functions in `lib/yearReview/yearView.ts`. Share is of the positive drawn sum for grids, treemaps and long view, and of the true total in the ranking text (DESIGN §9.7 completeness rule).
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(year-review): pure per-year views`.

### Task 4: Findings

**Files:**
- Create: `lib/yearReview/findings.ts`
- Test: `tests/yearReview/findings.test.ts`

**Interfaces:**
- Consumes: Task 2 types, Task 3 views, `message`, `formatInUnit`, `formatShare`, `UNIT_BN`, `UNIT_MLN`.
- Produces:

```ts
export type FindingVisual =
  | { kind: "spark"; values: Values; index: number; color: string }
  | { kind: "bars"; rows: { label: string; value: number; color: string; hatched?: boolean }[] }
  | { kind: "split"; parts: { share: number; color: string }[] };
export type Finding = { id: "taxes" | "breaks" | "debtRank" | "types" | "service" | "municipal"; topic: string; href: string;
  yearTag: number | null; heading: string; detail: string; visual: FindingVisual };
export function buildFindings(data: YearReviewData, year: number, messages: Messages, locale: Locale): Finding[];
```

`href` per finding: Revenue, Tax breaks and refunds, Expenditure, Spending by type, Debt, Municipalities (through `pageHref`). The rules are spec §7. Ordinal: ka `yearReview.ordinal` (`მე-4`); en `{n}st|nd|rd|th` with 11–13 → `th`. Exceptions: f1 `f1top` when debt service is the largest field; `f1close` when the gap is under 1% of the year's total, else `f1far`. In the institutions grouping, finding 3 still reads fields.

- [ ] **Step 1: Write the failing tests** with the Task 3 fixture: each `taxes` branch (`f6one`, `f6many`, `f6none`); `debtRank` gives `f1top` when debt service is largest and `მე-4` / `4th` when fourth; `types` `f3onlyDown`; `municipal` with places `[50, 30, 10, 10]` → `k = 2` ("50% … just 2"), since 50 alone does not pass half; `breaks` falls back to the latest tax-breaks year with `yearTag` set; the English findings contain no Georgian characters (`/\p{Script=Georgian}/u`).
- [ ] **Step 2:** Run `npx vitest run tests/yearReview/findings.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `buildFindings`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(year-review): computed findings`.

### Task 5: `StackedColumnChart` highlight and projection

**Files:**
- Modify: `components/main-explorer/stacked-column-chart.tsx`
- Test: `tests/explorer/stackedColumnChart.test.tsx`

**Interfaces:**
- Produces two optional props on `StackedColumnChartProps`:
  - `highlightPeriod?: number`: that period's axis label is always shown, in ink at weight 600, with a 2px ink rule 16px wide under it (`data-highlight`). Other labels that would collide with it are dropped.
  - `projectionFrom?: number`: columns at and after this period are filled with a diagonal hatch of their segment colour (`<pattern>` per colour, 45°, 3px stripe on paper, `data-projection` on the rect), and the readout header appends the `projectionLabel` string.
  - `projectionLabel?: string`, required when `projectionFrom` is set.
- [ ] **Step 1:** Add tests: without the new props the rendered markup equals today's (snapshot or the existing assertions unchanged); with `highlightPeriod: 2025` one `[data-highlight]` exists under the 2025 label; with `projectionFrom: 2026` every rect of 2026+ has `data-projection` and none before.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/stackedColumnChart.test.tsx`. Expected: new tests FAIL, old ones PASS.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Expected: all PASS.
- [ ] **Step 5:** Commit: `feat(charts): stacked column highlight and projection hatch`.

### Task 6: Page shell, year ruler and section 01; old page removed

**Files:**
- Create: `components/year-review/year-review-page.tsx` (client root), `components/year-review/year-ruler.tsx`, `components/year-review/section.tsx` (numbered section shell: rule, accent number, H2, right-hand mono line, optional control slot), `components/year-review/glance.tsx` (KPIs + findings cards), `components/year-review/year-tag.tsx`
- Modify: `lib/pages/analysis.tsx` (load `loadYearReviewData`, metadata from `yearReview.metaTitle` / `metaDescription` with `defaultYear`, render `ExplorerPage` + `PageHeader` + `ExplorerHeading` + `YearReviewPage`)
- Delete: `components/analysis/` (all seven files), `lib/explorer/singleYear.ts` and its types in `lib/explorer/types.ts` used nowhere else, `lib/i18n/messages/{ka,en}/analysis.json` and the `analysis` scope in `MESSAGE_SCOPES` / `messages.server.ts` once nothing reads them, and the tests only they had (`tests/explorer/singleYear.test.ts`, `budgetField.test.ts`, `analysisYearRow.test.ts`, `tests/i18n/analysisPresentation.test.ts`; trim the analysis parts of `seriesNames`, `sharedRows`, `editorial`, `integration`, `clientData` and `presentation` tests)
- Test: `tests/yearReview/yearReviewPage.test.tsx` (static markup only: the repo has no DOM testing library; interactions are in Task 10)

**Interfaces:**
- Consumes: Tasks 2–4. `parseExplorerHash(hash, "analysis")` and `serializeAnalysisHash` from `lib/explorer/urlState.ts`, unchanged: `ay` → year, `ag` (`fields` | `ministries` → `institutions`) → grouping, `as` → long-view side. `useReplaceHash`, `useAppReady`, `I18nProvider`, `Sparkline` (`area`, `endDot`, `hollowEnd` for a plan year), `ChartShareButton`.
- Produces: `YearReviewPage({ data, presentation })`. State `{ year, grouping, side, measure, hover: string | null, pin: string | null }` is passed to the section components (Tasks 7–9) as `{ data, year, grouping, side, measure, focus: string | null, onFocus(id | null), onPin(id) }`, where `focus = hover ?? pin`. Sections 02–06 render as placeholders here; Tasks 7–9 replace them.

Layout per board: ruler (radio group with roving tabindex; ←/→/Home/End; pointer press-and-drag picks the year under the pointer; planned years tagged `plan`; below 768px label every 4th year plus the chosen one), the pin chip (`unpin` aria-label) beside it, a polite live line `said`. KPIs: 6 columns from 1100px, 3 from 768px, 2 below; value serif 34 (`headline-value` token), unit mono; detail mono 12 muted; sparkline 120×30 with area and end dot. Findings: 3 columns from 1100px, 2 from 768px, 1 below; each card an `<a>` (tile background, 1px hairline border, topic overline in accent, serif heading, mono detail, the visual).

- [ ] **Step 1: Write the failing test.** Render static markup with `renderGeorgianMarkup` from `tests/helpers/render-localized` (as `tests/explorer/stackedColumnChart.test.tsx` does) and real `YearReviewData` from `loadYearReviewData`: the page markup has the H1 `წლის მიმოხილვა`; `YearRuler` has one `role="radio"` per budget year with 2025 `aria-checked="true"`; `Glance` for 2025 has six KPIs and six finding links; `Glance` for 2026 marks the tax-breaks KPI with a `2024` year tag. Hash restoring and pointer or keyboard picking are covered by the browser spec in Task 10.
- [ ] **Step 2:** Run `npx vitest run tests/yearReview/yearReviewPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement the shell, ruler, glance, and the page wiring. Delete the old page's files and tests.
- [ ] **Step 4:** Run the test, `npm run typecheck` and `npm run lint`. Expected: PASS, no unused exports left by the deletion.
- [ ] **Step 5:** Commit: `feat(year-review): page shell, year ruler and the year at a glance`.

### Task 7: Sections 02 (tax breaks) and 04 (deficit and debt)

**Files:**
- Create: `components/year-review/gives-up.tsx` (section 02), `components/year-review/debt-deficit.tsx` (section 04), `components/year-review/rate-lines.tsx` (the small interest-rate line chart)
- Test: `tests/yearReview/sections0204.test.tsx`

**Interfaces:**
- Consumes: `givesUpView`, `refundsView`, `debtView` (Task 3); `StackedColumnChart` with `highlightPeriod` / `projectionFrom` (Task 5); `ChartShareButton`.

Charts and their share buttons (each `ChartShareButton` with `title` = the chart heading, `caption` = unit · years, `source` = the source page's source wording, `period` = the years shown):
1. Collected vs given up (HTML columns per board: ink above the waterline, accent hatched below, `{n} ₾ ყოველ 100 ₾-ზე` under each). `role="img"` with `iceAria`.
2. Refunds: `StackedColumnChart`, one segment, `highlightPeriod` = the year used, `periodsPerYear={1}`.
3. Deficit: `StackedColumnChart` with two segments (surplus `POSITIVE`, values ≥ 0; deficit `NEGATIVE`, values < 0) from `balance.pctGdp`, `projectionFrom` = first projection year, `highlightPeriod`, readout in `%`.
4. Debt by year: two segments (external `#3a342b`, domestic `#9a7650`), `highlightPeriod`.
5. Interest rates: `rate-lines.tsx`, SVG three lines (total accent with end dot, external ink, domestic `#9a7650`), labels at the right end per board; `role="img"`.
6. Repayments: two segments (principal `#3a342b`, interest `ACCENT`), `projectionFrom` = first projection year, peak value labelled in the section's right-hand line (`wallM`).

The debt panel (big number, split bar, three figures) is HTML beside chart 4 from 1100px; stacked below it on narrower screens.

- [ ] **Step 1: Write the failing tests** (static markup with props): for 2025 the refunds big number reads the formatted 2.72 bn (locale format), the section has exactly 6 `chart-share` buttons, the deficit chart has `data-projection` rects for 2026–2031 only; for 2026 the refunds and debt panels carry a `2025` year tag.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement both sections and wire them into `YearReviewPage`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(year-review): tax breaks, deficit and debt sections`.

### Task 8: Section 03 (where the money goes) and picking a category

**Files:**
- Create: `components/year-review/where-money-goes.tsx`, `components/year-review/waffle.tsx`, `components/year-review/change-bars.tsx`, `components/year-review/buys-treemap.tsx`
- Test: `tests/yearReview/section03.test.tsx`

**Interfaces:**
- Consumes: `whereView`, `changeView`, `buysView`; `Sparkline`; the shared `focus` / `onFocus` / `onPin` (Task 6).

Per board (`an-app.png` section 03, `an-adm.png`, `an-pin.png`): grouping switch (two `aria-pressed` buttons, `groupLabel`); 10×10 waffle (cells 4px radius off, `gap` 5px, colour per cell; hover/focus sets `focus`, click pins); the ranking list (rank, swatch, `n ₾` (or `<1 ₾`), name, `amount · share · change`, sparkline); the 2004 small grid with `then` numbers for the focused (else the first) category; the change facts row and diverging bars; the treemap with white labels on tiles ≥3% (labels: name, `value · share`, `tmChg`), small tiles listed under it. When `focus` is set, everything else in this section is drawn at 25% opacity and the focused row gets a 2px left rule in its colour. Share buttons: waffle+ranking (one picture of the grid and list), change bars, treemap.

- [ ] **Step 1: Write the failing tests** (static markup of `WhereMoneyGoes` with props): 100 waffle cells; the ranking count equals the grouping's non-null categories for the year; with `grouping="institutions"` the count line reads `{n} უწყება`; with `focus="spending.debt_service"` its ranking row has `data-focus` and the other rows are dimmed; 3 share buttons in the section. Hover and click picking are in the Task 10 browser spec.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement and wire.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(year-review): where the money goes, with category picking`.

### Task 9: Sections 05 (country and regions), 06 (long view), notes

**Files:**
- Create: `components/year-review/per-resident.tsx`, `components/year-review/regions-dots.tsx`, `components/year-review/long-view.tsx`, `components/year-review/notes.tsx`
- Test: `tests/yearReview/sections0506.test.tsx`

**Interfaces:**
- Consumes: `perResidentRows`, `regionsView`, `longView`; `focus` / `onFocus` / `onPin`.

Per board: the ledger (six rows: name bold, scope muted, ink bar scaled to the largest, serif value with `₾`; year tag where a row falls back); the dot plot (axis on top, one row per region with name and average, municipality dots in `POSITIVE`, region average tick in ink, dashed median line, a hover label naming the municipality; an sr-only `<ol>` of `mpSr` lines); the long view (SVG stacked area 2004–last, plan year hatched, chosen-year line with its label on top, labels at the right edge spaced by at least 14px, hover crosshair + readout of the hovered band, legend under it; switches `exp`/`rev` and `share`/`abs`; the two `s3Up`/`s3Down` facts). Notes: the board's list with `{date}` = `updatedAt`, population year/value from `data.budget.population`, then the link row (`lExp`, `lTypes`, `lRev`, `lTB`, `lMun`, `lDef`, `lDebt`, Methodology) through `pageHref`. Share buttons: ledger, dot plot, long view.

- [ ] **Step 1: Write the failing tests** (static markup with props): 6 ledger rows; 11 region rows and 64 dots; the median label equals the median of the 64 per-resident values; the long view with `measure="share"` draws one path per category and its top axis label is `100%`; with `side="revenue"` the legend lists receipts; no text `© 2026` anywhere; 3 share buttons.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement and wire.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(year-review): per resident, regions, long view and notes`.

### Task 10: Documentation, browser tests and the done-check

**Files:**
- Modify: `DESIGN.md` (§9 rewritten as "Year in review" from the spec's sections 4–5; §6.7/§6.8 page name; §19 chapter 01 destination name; canonical terms list), `Project_Definition.md` section 2 (single-year analysis view → year in review), `tests/explorer/chartShareCoverage.test.ts` (add the `components/year-review/` chart files to the named-files check)
- Replace: `tests/browser/bilingual-analysis.spec.ts` with `tests/browser/year-review.spec.ts`; update the analysis tests in `tests/browser/main-explorer.spec.ts` (sidebar link label, section order test) and any other spec `grep -rln "analysis" tests/browser` shows asserting old markup or the old name (`seo`, `landing`, `explorer-groups`, `mobile-*`, `route-code-splitting`)

`year-review.spec.ts` covers: both languages render with the H1 and the one-line header (its height equals one line at 375px); the ruler changes the KPIs (2020 shows the `balMax`-type phrase for the deepest deficit); grouping and long-view switches; picking and clearing a category; `#ay=2024&ag=ministries&as=revenue` restored after reload and kept across the language switch; `expectEnglish` on `/en/explorer/analysis`; no horizontal scroll at 375px; the axe scan; one share button downloads a PNG (follow `chart-share.spec.ts`).

- [ ] **Step 1:** Write `year-review.spec.ts` and the test updates.
- [ ] **Step 2:** Update DESIGN.md and Project_Definition.md.
- [ ] **Step 3:** Build and serve once, then run the new spec: `cd apps/web && NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, start the server in its own process group (CLAUDE.md), `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/year-review.spec.ts tests/browser/main-explorer.spec.ts`. Expected: PASS.
- [ ] **Step 4:** Take screenshots for Duru (desktop 1440 and phone 375, Georgian; English desktop; a picked category; 2026) into `/mnt/project-files/year-in-review/preview/`. Commit: `test(year-review): browser coverage and docs`.
- [ ] **Step 5 (only after Duru approves the screenshots):** `npm run check`, the full browser suite against the built server, then push the branch for the Vercel preview.
