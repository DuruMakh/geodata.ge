# GDP Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work inline by default; do not dispatch agents without applicable authorization.

**Goal:** Deliver the first Economy hub and a bilingual GDP overview using existing explorer components, reviewed source data and localized Excel downloads.

**Architecture:** A deterministic offline preparation step produces 251 annual observations for six source series. A dedicated CSV/database serving adapter feeds one GDP model and state reducer, which drive the existing chart, table, range controls and workbook writer. Economy navigation and methodology are extensions of the existing shell, hub and archive system, not parallel implementations.

**Tech Stack:** Existing Next.js 16, React, strict TypeScript, Tailwind v4, Vitest, Playwright, SheetJS source reader, Decimal.js, Prisma 7 and existing ExcelJS writer. No additional UI/chart dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-gdp-overview-design.md` (read in full). Approved for inline implementation by the user on 2026-09-11. Implementation is saved locally on `codex/gdp-overview`; publication is outside this authorization. See the execution record below for verification and the remaining database gate.

## Global constraints

- Four tabs, in this order: Real GDP, Nominal GDP, GDP growth, GDP per capita.
- Center these tabs below the page title and summary, above the chart workspace.
- Put the GEL/USD switch in the chart toolbar, using the current share-toggle styling and placement.
- No separate Nominal/Real dropdown and no right-side Display panel.
- National GDP per capita is nominal only. No cumulative growth, real GDP per capita, regional population or regional per-capita work.
- Georgian URLs are unprefixed; English uses `/en`. Preserve Budget URLs and behavior.
- Current production components and DESIGN.md govern appearance, not preview HTML.
- No sector/regional serving, API/MCP intents, runtime fetches, automatic source refresh, new dependencies or production deployment in this implementation plan.
- Reviewed CSVs remain canonical; database is a transactional, parity-checked mirror. Never edit it directly.
- All paths below are repository-relative. Run app commands from `apps/web`, Git commands from the repository root. Use PowerShell-safe separate commands, not shell command chains.
- Inspect current worktree and dependencies before executing. This checkout currently has no `apps/web/node_modules`; do not borrow a different checkout's production state or assume its installed dependencies match this lockfile.

## Findings that determine implementation

1. `national-gdp-annual-1996-2025.csv` preserves a **one-decimal million GEL** denominator for existing budgets. Our overview extraction has greater source precision. Do not overwrite that file or reuse rounded values as if they were the full-precision overview observations. Reconcile rounded overview amounts to the denominator, and preserve both purposes explicitly.
2. `WorkbookPoint.amountGel`, `WorkbookBasis`, and the writer's unconditional change column need bounded extensions: do not put dollars into `amountGel`, mark preliminary as planned, or expose a cumulative change column.
3. `BudgetHub` already accepts `HubCardModel[]`; its card styling can be reused. Its root test ID can become an optional prop with the current default preserved. No second card renderer is needed.
4. `EditorialLineChart` already supports negative values, unit formatting and fractional percentages through `share`. Convert percent to fraction once in the GDP display adapter; the flag does not mean that GDP growth is a share of GDP.
5. The data source metadata does not explain the reconstruction of the earliest World Bank years. Disclose that limit; independently validate the archived response before serving it. A source verification failure is a data blocker, not permission to invent a replacement.

## Task 1: Durable GDP source archive and deterministic canonical observations

**Create:**
- `docs/Raw Data/Economy/gdp-overview/sources/` (selected original files only)
- `docs/Raw Data/Economy/gdp-overview/source-manifest.json`
- `apps/web/lib/data/gdpOverview/types.ts`
- `apps/web/lib/data/gdpOverview/prepareGdpOverview.ts`
- `apps/web/scripts/prepare-gdp-overview.ts`
- `apps/web/tests/data/gdpOverview/prepareGdpOverview.test.ts`
- `data/imports/gdp-overview-annual.csv`
- `data/reports/gdp-overview-validation.json`
- `docs/data-methodology/gdp-overview.md`

**Modify:** `apps/web/package.json`, `data/sources/source-documents.csv` (append records; reuse identical existing source IDs where verified).

**Input:**
`C:/Users/Mylaptop/.codex/visualizations/2026/09/09/01a08781-3744-72d2-a57e-552083073a21/gdp-final/`.
Copy the WB real/growth JSON and indicator metadata, the two nominal Geostat XLSX files, and their original capture metadata. Preserve source bytes and hashes. Do not copy builders, research workbook, regional/sector files or preview files into the serving archive.

**Interfaces (shared by later tasks):**

```ts
export type GdpSeriesId =
  | 'real_usd_2015' | 'real_growth_percent'
  | 'nominal_gel' | 'nominal_usd'
  | 'per_capita_gel' | 'per_capita_usd';
export type GdpObservation = {
  seriesId: GdpSeriesId;
  year: number;
  value: string; // canonical decimal; never UI-formatted
  unit: 'usd_2015' | 'percent' | 'gel' | 'usd' | 'gel_per_person' | 'usd_per_person';
  status: 'published' | 'preliminary';
  accountingStandard: 'sna_1993' | 'sna_2008' | null;
  sourceId: string;
  sourceLocator: string; // sheet!cell or GEO/indicator/year
  lastReviewedAt: string;
};
export type GdpPreparation = {
  facts: GdpObservation[];
  validation: { status: 'PASS'; counts: Record<GdpSeriesId, number>; sourceHashes: Record<string,string> };
};
export function prepareGdpOverview(sourceRoot: string): Promise<GdpPreparation>;
```

- [x] Verify archive presence and manifests before writing anything. Read raw World Bank country/indicator values and metadata; assert GEO/Georgia and the precise two indicator codes. Inspect both XLSX headers and annual columns by labels. If a promised source/coverage cannot be reproduced, stop data acceptance and report the exact discrepancy.
- [ ] Add source-based tests for exact coverage and sentinel values; import the proposed function before it exists and run the test to establish the failing test cycle:

```ts
const { facts, validation } = await prepareGdpOverview(sourceRoot);
expect(validation.counts).toEqual({ real_usd_2015:66, real_growth_percent:65,
  nominal_gel:30, nominal_usd:30, per_capita_gel:30, per_capita_usd:30 });
expect(facts).toHaveLength(251);
expect(facts.find(f => f.seriesId === 'real_usd_2015' && f.year === 1960)?.value)
  .toBe('5243159135.67355');
expect(facts.some(f => f.seriesId === 'real_growth_percent' && f.year === 1960)).toBe(false);
expect(facts.find(f => f.seriesId === 'per_capita_gel' && f.year === 2025)?.status)
  .toBe('preliminary');
```

- [x] Implement extraction with the existing `xlsx` reader and Decimal.js. Store source-scale GEL/USD totals multiplied by 1,000,000; per-person values are already currency units. Select SNA1993 only through 2009 and SNA2008 thereafter. Leave unavailable observations absent; no zero fill. Canonical CSV uses the snake_case equivalents of the interface fields and UTF-8 BOM, sorted by series ID then year.
- [ ] Add negative tests using disposable source copies: wrong GEO code, wrong indicator, changed hash, duplicate year, removed year, nonnumeric XLSX cell and 2025 preliminary mismatch must fail with specific errors. Do not mutate the archived originals in tests.
- [x] Add numeric reconciliation: published WB growth versus consecutive levels (tolerance `1e-7` percentage points); source nominal GEL/USD versus annual FX (`1e-6` million currency units); rounded overview million GEL versus the existing budget denominator at its documented precision. Record the largest discrepancies. Never round overview values to make a failed precision check disappear.
- [x] Implement `--write` and `--check` with the repository generated-artifact comparison helpers. Add scripts `data:prepare-gdp-overview` and `data:check-gdp-overview`; include the check in `data:validate`. Document release dates, capture dates, units, SNA boundary and historical limitation in methodology.
- [ ] Run `npx vitest run tests/data/gdpOverview/prepareGdpOverview.test.ts`, then prepare and check. Hash the existing nominal denominator before/after and require equality. Commit only this task's source, data, documentation, code and tests when execution is authorized.

## Task 2: CSV validation, serving adapter and database mirror

**Create:** `apps/web/lib/data/gdpOverview/importGdpOverview.ts`, `apps/web/tests/data/gdpOverview/importGdpOverview.test.ts`, `apps/web/tests/data/gdpOverview/servedGdpOverview.test.ts`, `apps/web/prisma/migrations/20260910000000_gdp_overview/migration.sql` (choose a new timestamp if execution finds a collision).

**Modify:** `apps/web/lib/servedRows.ts`, `apps/web/lib/data/servedData.ts`, `apps/web/lib/data/servedDataParity.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `apps/web/lib/data/importReport.ts`, `apps/web/prisma/schema.prisma`, existing import/parity tests, `docs/data-methodology/database-import.md`.

**Interfaces:**

```ts
export type ServedGdpObservation = Omit<GdpObservation, 'value'> & { value: number };
export function loadGdpOverviewFacts(relativePath: string): Promise<GdpObservation[]>;
export function loadServedGdpOverviewData(): Promise<{facts: ServedGdpObservation[]}>;
export function loadGdpOverviewFactsFromDb(): Promise<ServedGdpObservation[]>;
export function gdpOverviewFactParityKey(fact: ServedGdpObservation): string;
```

- [ ] Write validator/serving tests first: reject duplicate `(seriesId,year)`, invalid unit for a series, nonfinite decimal, missing expected source year, invalid status; mock db mode with one value or provenance field altered and require rejection. Example: changing a 2025 value by `1` must cause `assertSameServedRows` to throw.
- [x] Add `gdpOverviewFacts: '../../data/imports/gdp-overview-annual.csv'` to `SERVED_DATA_FILES`. Mirror the existing general-government-balance loader pattern, including rejection of unknown `GEODATA_DATA_SOURCE`, build-time dynamic db import, and field parity against reviewed CSV.
- [x] Add `GdpOverviewFact` keyed by `(seriesId, year)` with `value Decimal @db.Decimal(40,20)`, unit/status/accounting/sourceLocator/lastReviewedAt, SourceDocument and ImportRun references. Verify all canonical decimal values fit losslessly before generating the migration; no schema for sectors or population. Store exact decimals in the mirror, narrowing to finite JS numbers only for presentation. Keep `NationalGdpFact` and its rows unchanged.
- [x] Extend the existing single import transaction: delete GDP overview children before source/import parents; insert after sources; read back and include full field parity in the report before commit. A changed value, year, status or locator rolls back the transaction. Extend row-count/report coverage without reducing any existing parity checks.
- [ ] Run the new loader/serving tests plus `tests/data/servedDataParity.test.ts`, `servedDataParityCoverage.test.ts`, and `importReport.test.ts`. Generate Prisma client from the checkout's lockfile-installed dependencies. Test migration and repeated import only on a confirmed disposable test database; do not use production credentials for testing. Verify 251 persisted rows, idempotence and rollback. If no test database is available, retain that explicit unverified gate for delivery rather than claim db proof.
- [ ] Commit the verified mirror/adapter changes. Do not run live import or deployment merely to complete local implementation.

## Task 3: GDP selection, range and URL state

**Create:** `apps/web/lib/explorer/gdpOverview.ts`, `apps/web/lib/explorer/gdpUrlState.ts`, `apps/web/components/gdp/use-gdp-state.ts`, `apps/web/tests/explorer/gdpOverview.test.ts`, `apps/web/tests/explorer/gdpUrlState.test.ts`.

**Interfaces:**

```ts
type GdpIndicator = 'real' | 'nominal' | 'growth' | 'per_capita';
type GdpState = {
  indicator: GdpIndicator; currency:'gel'|'usd'; mode:'line'|'table';
  range: { kind:'all' } | { kind:'manual'; start:number; end:number };
};
const DEFAULT_GDP_STATE: GdpState = {
  indicator:'real', currency:'gel', mode:'line', range:{kind:'all'}
};
function changeGdpIndicator(state:GdpState, next:GdpIndicator,
  facts:ServedGdpObservation[]):GdpState;
function resolveGdpRange(state:GdpState, facts:ServedGdpObservation[]):
  {min:number;max:number;start:number;end:number};
function buildGdpOverviewModel(facts:ServedGdpObservation[], state:GdpState,
  presentation:Presentation):GdpOverviewModel;
function parseGdpHash(hash:string):GdpState;
function serializeGdpHash(state:GdpState):string;
```

Define `GdpOverviewModel` in the same module with `indicator`, `label`, `unit:ValueUnit`, `fullUnitLabel`, `years`, `availableYears`, `points:{year,value:number|null,status}[]`, `chartSeries:ChartSeries[]`, `tableRow:ExplorerTableRow`-compatible single row, `preliminaryYears:number[]`, `sourceIds:string[]`, and `headline:{year:number,value:number,status}|null`. Display percentages are fractions, while source `real_growth_percent` remains percentage points; other values are full currency units.

- [ ] Write explicit range tests before implementation:

```ts
expect(changeGdpIndicator(DEFAULT_GDP_STATE,'nominal',facts).range).toEqual({kind:'all'});
expect(changeGdpIndicator({...DEFAULT_GDP_STATE,
  range:{kind:'manual',start:1980,end:2000}},'nominal',facts).range)
  .toEqual({kind:'manual',start:1996,end:2000});
expect(changeGdpIndicator({...DEFAULT_GDP_STATE,
  range:{kind:'manual',start:1960,end:1970}},'nominal',facts).range).toEqual({kind:'all'});
```

- [x] Implement series selection through a fixed mapping: real→`real_usd_2015`; growth→`real_growth_percent`; nominal/per_capita choose the corresponding currency. Derive coverage from facts. Manual ranges clamp/intersect; disjoint ranges reset to All; All stays All. Retain currency/mode across tab switches. A range matching the full domain is normalized to All; quick 5y/10y controls become manual ranges.
- [x] Implement deterministic hash `#indicator=real&view=line&currency=gel&range=all` or explicit `start`/`end` for manual ranges. Unknown enum values fall back individually; malformed ranges reset to All; reversed valid years are ordered then intersected with available coverage. Normalize once on hydration, use `replaceState`, and prevent initial effects from overwriting an incoming hash. Language switching retains the hash through the existing mechanism.
- [ ] Test model source/currency selection, 1960 growth absence, 2025 preliminary, negative growth, one-year chart values, selection ending before latest year, exact percent-to-fraction conversion and hash round trips. A malformed link must never render `NaN` or a different unit than its values.
- [ ] Run the two new unit files; commit the pure model/state implementation.

## Task 4: Extend existing table and workbook status/units safely

**Create:** `apps/web/lib/explorer/gdpWorkbook.ts`, `apps/web/tests/explorer/gdpWorkbook.test.ts`.
**Modify:** `apps/web/lib/explorer/workbookModel.ts`, `workbookWriter.client.ts`, `apps/web/components/main-explorer/explorer-table.tsx`, `apps/web/lib/i18n/messages/{ka,en}/workbook.json`; relevant current workbook/table tests.

**Interface:** `buildGdpWorkbookExportModel(facts:ServedGdpObservation[], state:GdpState, presentation:Presentation, sources:WorkbookPublicSource[], siteOrigin:string):WorkbookExportModel`.

- [ ] Add failing export tests first: nominal USD headers must say USD, real USD must say constant 2015 prices, per-person values must not be divided by a million, and the percentage cell for 7.5% stores `0.075`. A selected 2015–2020 range exports six years and no 2025 status. Assert no change column in GDP workbooks and unchanged default columns for a budget fixture.
- [x] Extend `WorkbookBasis` with `published` and `preliminary` and localized status mappings. Preserve every existing branch's labels. Add optional `showChangeColumn` to the readable model with default true in the writer; GDP explicitly sets false. Update column widths, style ranges and formulas to use actual output columns rather than leaving an empty final column.
- [x] GDP builds the existing final `WorkbookExportModel` directly, with typed analysis rows and correct units, instead of routing USD through `WorkbookPoint.amountGel`. Reuse the writer and source URL validation. Extend the model with optional readable decimal/number-format settings only where the writer currently hardcodes a budget format; defaults retain budget behavior. Growth cells use percentage formatting and currency/per-person cells use numeric formatting.
- [x] Add optional `preliminaryYears`/`preliminaryLabel` props to ExplorerTable; default empty. Mark applicable year headers/cells with a visible note, without calling them planned or forecast. Reuse the existing footnote appearance. Apply the same visible year marker and status to the workbook's readable/Data sheets. Neither published nor preliminary is an actual/planned selection priority rule.
- [ ] Test the saved XLSX with the existing writer test harness: six tab/currency combinations × two languages; selected range; three sheets; correct typed values and statuses; archive hyperlinks; absent cumulative-change column. Run new GDP tests and existing workbook/table tests, especially Debt/Deficit. Commit only the bounded shared extensions and GDP adapter.

## Task 5: Production GDP overview using shared components

**Create:** `apps/web/components/gdp/gdp-overview.tsx`, `apps/web/lib/pages/gdp.tsx`, `apps/web/app/(ka)/explorer/economy/gdp/page.tsx`, `apps/web/app/(en)/en/explorer/economy/gdp/page.tsx`, `apps/web/lib/i18n/messages/{ka,en}/gdp.json`, `apps/web/tests/explorer/gdpRoute.test.tsx`, `apps/web/tests/browser/gdp-overview.spec.ts`.
**Modify:** `apps/web/lib/i18n/types.ts` (register `gdp` message scope).

- [ ] Add route/component tests: SSR title/source/default data, four labels in approved order, one chart/table, no right Display panel, no series selector, hidden currency on real/growth and correct status on nominal/per-capita. Use the project test provider rather than hardcoded English fallback labels.
- [x] Implement server page following `lib/pages/deficit.tsx`: load served GDP once, obtain localized presentation, provide accurate metadata/breadcrumbs and I18nProvider, pass facts/source links to the client component. Both route files are thin locale adapters. Reuse explorer layout and footer; no preview sidebar or CSS import.
- [x] Compose the client component from shared primitives:

```tsx
<div className="flex justify-center overflow-x-auto">
  {/* Four existing TextTab controls in the approved order; scroll the focused control into view. */}
</div>
<section className="border-t border-[var(--ink)] pt-4">
  {/* Existing Chart/Table control left; currency pills right only for nominal/per_capita. */}
  <EditorialLineChart years={model.years} series={model.chartSeries}
    share={state.indicator === 'growth'} unit={model.unit} shareLabel={model.fullUnitLabel}/>
  <RangeStrip years={model.availableYears} range={resolvedRange} onChange={onRangeChange}/>
</section>
```

The comments above describe composition, not missing deliverables: populate them with mapped localized TextTab buttons and the current share-pill classes from the Deficit chart toolbar. The table branch mounts ExplorerTable with the single model row, `showChangeColumn={false}`, and preliminary props. Keep existing text tabs' button/pressed semantics unless implementing a complete ARIA tab pattern; never mix roles with incomplete keyboard behavior.

- [x] Add compact selected-year summary, full unit label, one download action below RangeStrip, source/methodology note, and polite announcement when a tab changes the range. Preserve actual site fonts and spacing. No bespoke SVG, bar mode, KPI blocks, source switch, fabricated forecasts or duplicate right column.
- [ ] Browser tests cover all four tabs, GEL→USD→growth→per-capita currency persistence, All expansion, manual overlap/disjoint transitions, range keyboard controls, one-year observation, chart/table agreement, hash reload, English/Georgian switch and download. Verify chart tooltip identifies the active indicator/unit. Use labels/test IDs, not fragile screenshot coordinates.
- [ ] Run focused GDP route/model/workbook tests and the new browser spec on the local app. Save screenshots at 390, 768 and 1440 pixels in both languages, beside a current Deficit/Budget reference. Confirm tab centering within the workspace and no page-level horizontal overflow; charts/tables can retain their intentional internal scroll. Commit the page after visual correction.

## Task 6: Economy hub and sidebar entry

**Create:** `apps/web/lib/explorer/economyHubCards.ts`, `apps/web/lib/pages/economy.tsx`, `apps/web/app/(ka)/explorer/economy/page.tsx`, `apps/web/app/(en)/en/explorer/economy/page.tsx`, `apps/web/components/shell/economy-section-nav.tsx`, `apps/web/tests/explorer/economyHub.test.tsx`.
**Modify:** `apps/web/components/shell/data-sidebar.tsx`, `apps/web/components/hub/budget-hub.tsx`, common/hub messages in both languages; `apps/web/lib/explorer/hubCards.ts` only if a type must be reused without duplication.

**Interface:** `buildEconomyHubCards(facts:ServedGdpObservation[], presentation:Presentation):HubCardModel[]`.

- [x] Test three cards: GDP href `/explorer/economy/gdp`; sector/regional href `null`, `comingSoon:true`, no headline or sparkline. GDP's sparkline/headline come from real GDP to match its default tab; coverage footer distinguishes longer real coverage from shorter nominal coverage rather than implying all measures start in 1960.
- [x] Reuse BudgetHub rendering, adding optional root test ID defaulting to `budget-hub`; Economy passes `economy-hub`. Leave existing budget cards/model unchanged. Add Economy below Budget in sidebar, replacing only the Economic growth teaser. Normalize language prefixes before matching paths.
- [ ] Scope active navigation: Economy/GDP pages select Economy and its GDP child; budget pages still select Budget. Render an Economy child list from the existing SectionNav pattern without injecting GDP into BUDGET_SECTIONS. Future children are nonlinks with ComingSoonBadge.
- [ ] Extend browser navigation checks for desktop, collapsed rail, mobile sheet, language switch and direct links. Ensure Budget links remain accessible from Economy, and vice versa. Existing sidebar mobile close/focus and localStorage behavior remain unchanged. Run new hub tests plus existing bilingual-navigation tests; commit.

## Task 7: Methodology, original files, localization and discovery

**Create:** `apps/web/lib/methodology/content/gdp.ts`, `apps/web/lib/methodology/content/en/gdp.ts`, and GDP source inventory entries using existing archive schema.
**Modify:** `apps/web/lib/methodology/{types,catalog,sourceInventory,sourceManifest,publicSources,workbookSources}.ts` as required by their existing dispatch tables; `apps/web/lib/seo/{metadata,internalLinks,sitemap}.ts`; localized methodology/common/hub/gdp/workbook messages and translation inventory; `Project_Definition.md` section 2, relevant DESIGN.md sections, `docs/data-methodology/gdp-overview.md`. Use the current methodology article route generator if it already covers the new ID; add thin explicit locale routes only if the routing structure requires them.

- [ ] Test GDP methodology is live in both languages, source links resolve to validated archive outputs, and WB `.json` files retain JSON names/MIME meaning. Archive support must accept JSON as an original source without attempting spreadsheet extraction or relabeling its format. Preserve every original source byte.
- [x] Register `gdp` in live methodology IDs and replace the GDP future marker. Document real/nominal distinction, per-person meaning, sources/years, World Bank early-history limit, 2010 nominal method boundary and preliminary 2025 revision note. No population estimates, regional caveats unrelated to this page or generic GDP advice.
- [x] Generate archive links through existing tooling, using sources relevant to the active metric/range. Real/growth exports link the correct WB JSON and metadata; nominal/per-capita choose one or both Geostat files according to selected years. CSV source manifests intended for Excel use BOM. Repeated builds must not fetch upstream sources.
- [x] Register only the two explorer destinations and GDP methodology in localized sitemap/metadata/discovery. Canonicals ignore hashes; hreflang pairs are reciprocal; structured data describes actual coverage/price basis and only existing downloads. Do not advertise the future sector/regional pages or new MCP capabilities.
- [ ] Update scope/design authorities to explicitly permit this Economy/GDP feature, centered tabs and currency toolbar while preserving all unrelated exclusions. Run `npm run i18n:check`, methodology tests and SEO route/sitemap tests. Compare original archive hashes with Task 1 and verify no secrets or conversation-local paths occur in public output. Commit the documentation/discovery integration.

## Task 8: Final regression, review and execution handoff

**Modify:** only defects attributable to this feature; update this plan's checkboxes with actual outcomes. Do not use completion boxes as evidence of deployment.

- [x] Run the deterministic GDP check and compare the original budget denominator hash. Verify 251 overview rows and zero unexpected source/value/status changes. Check that regional/sector research never entered serving facts.
- [ ] Run `npm run check`, `npm run build`, and `npm run test:browser` under CLAUDE.md's documented static-server workflow. Use `PLAYWRIGHT_BASE_URL` to target the correct checkout's server; do not reuse a different worktree's running app. Run the full gates once after targeted checks pass; repeat only affected checks when inputs change.
- [ ] Inspect exported XLSX files and screenshots for both languages, default and switched measures, narrow/mobile layouts, tabs, chart units, statuses and source links. Review original Budget/Deficit views and exports for regression. Confirm page output works without runtime network requests for GDP data.
- [x] Review the final diff against every spec section. Confirm no preview HTML/JS/fonts, unrelated data, population work, duplicated charts, new right panel or live sector/regional routes are in the implementation diff. Review the database migration/import separately from UI changes. Record any unavailable db-mode proof explicitly.
- [ ] Summarize implemented routes, checks performed, remaining limits and local preview URL for the user. This plan ends at verified local implementation. If the user authorizes delivery, follow the repository deployment runbook and `codex/* → commit → push → draft PR → green CI → review → merge → branch cleanup`, then verify the deployed commit and relevant URLs. Do not claim publishing from a local build or merged commit alone.

## Plan self-review

Spec coverage: navigation/hub → Task 6; composition/reuse/localization → Tasks 5–7; indicators and source caveats → Task 1; serving → Task 2; defaults/ranges/hash → Task 3; table/Excel → Task 4; methodology/archive/SEO/authority → Task 7; acceptance → Task 8. All selected GDP indicators are included; future sectors/regions and population are excluded.

The source-precision distinction is handled explicitly rather than modifying existing budget ratios. Shared components retain defaults for old callers. Percent source values versus display fractions are defined once. Production data collection is not repeated through live downloads; archived inputs are independently verified and integrated. No deployment or database activation has occurred by writing this plan.


## Execution record - 2026-09-11

The local implementation covers the eight task areas. The original detailed checklist remains above; unchecked compound steps must not be read as completed individual test scenarios or separate commits. The evidence and deviations below describe what was actually delivered.

- [x] Archive five original files, validate their hashes and produce 251 reviewed observations. Reconcile growth and nominal values; preserve the existing budget denominator without edits.
- [x] Add CSV serving, the exact-decimal database model, migration and transactional import/parity integration. Generate the Prisma client and pass serving/parity unit checks.
- [x] Implement the four indicators, currency persistence, range intersections, All behavior, hash state and source-aware model.
- [x] Reuse the existing chart, table, range, tabs, download writer and hub. Add preliminary status and preserve the default behavior for existing budget callers.
- [x] Deliver Georgian and English Economy hubs, GDP pages, methodology, original-source archives, localized downloads and discovery entries.
- [x] Run `npm run check`: 191 unit-test files, 1,787 tests, lint, typecheck, data validation and localization passed. After the final footer changes, lint and 28 affected unit tests passed; the subsequent build passed typechecking.
- [x] Run a production build with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`: 197 static pages and the existing MCP route; public-publication hash checks passed. Restore every existing English source-title entry exactly during final diff review and rebuild with that correction. All 41 affected localization/source-inventory tests passed after the correction.
- [x] Run the full browser suite: 462 passed and four failed. Correct stale page/methodology counts and the Economy metadata title. Rebuild and rerun the affected checks together with GDP checks: all 16 passed. This is a full run followed by successful targeted reruns, not a claim of a single all-green full run.
- [x] Capture GDP and existing Deficit references at 390, 768 and 1440 pixels in both languages. Check page overflow and inspect the rendered GDP layouts.
- [x] Read saved Excel workbooks for all four indicators in both languages, including percentage values, preliminary status, the three sheets and removal of the cumulative-change column. Nominal USD labels and currency selection are also covered by model/browser checks.
- [ ] Apply the migration to a confirmed disposable database and prove repeated import, persisted parity and rollback there. No test database is configured in this checkout. This remains an explicit gate before database activation; no database or production changes were made.

Implementation adaptations:

- Model and state are kept together in `lib/explorer/gdpOverview.ts`; there is no need for a second state module.
- Economy navigation is a bounded extension of the existing sidebar. Future sector/regional destinations remain nonlinks on the hub; they do not receive routes or a second sidebar implementation.
- The workbook adapter builds the existing final export model directly, preserving currency meaning. Existing budget defaults stay unchanged.
- Source tamper tests cover changed bytes and a rehashed wrong-country response; observation validation tests cover coverage, duplicate rows, units and nonfinite values. The broader original list of separate source mutation scenarios was not all written as individual fixtures.
- Work is saved as one cohesive local implementation commit rather than per-task commits. There is no push, PR, merge or deployment in this execution.

Local preview: `http://localhost:3110/en/explorer/economy/gdp` (Georgian: `/explorer/economy/gdp`). The source of truth for data validation is `data/reports/gdp-overview-validation.json`. Browser capture artifacts remain in the ignored `apps/web/test-results` directory.
