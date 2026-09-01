# Government Debt Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one annual Government Debt explorer at `/explorer/debt` using the existing Fiscal.ge explorer components.

**Architecture:** Convert the approved research package into one narrow serving-fact contract mirrored by CSV and Supabase. A debt model adapter maps those facts into the existing chart, table, hierarchical selector and workbook surfaces; only forecast and mutually exclusive family behavior are added.

**Tech Stack:** Next.js 16, strict TypeScript, React, Tailwind v4, Prisma 7/Postgres, Vitest, Playwright, ExcelJS.

**Spec:** `docs/superpowers/specs/2026-09-02-government-debt-explorer-design.md`

## Global Constraints

- Preserve `DESIGN.md` v4.1 and the approved Variant D hierarchy.
- Exactly one chart/table workspace; no deficit functionality.
- Government Debt only; existing `spending.debt_service` remains unchanged.
- Reuse existing explorer components and dependencies; add no chart/UI/workbook library.
- Never estimate missing rates or duplicate GDP.
- CSV and database serving modes must remain row-for-row equivalent.

---

### Task 1: Create the narrow serving dataset and CSV/DB parity

**Files:**
- Create: `data/imports/government-debt-facts-2013-2030.csv`
- Create: `apps/web/lib/data/governmentDebt/importGovernmentDebtFacts.ts`
- Modify: `apps/web/lib/servedRows.ts`
- Modify: `apps/web/lib/data/servedData.ts`
- Modify: `apps/web/lib/data/servedDataParity.ts`
- Modify: `apps/web/lib/db/servedDataDb.ts`
- Modify: `apps/web/lib/data/importBudgetFacts.ts`
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/20260902000000_government_debt_fact/migration.sql`
- Test: `apps/web/tests/data/governmentDebt/servedGovernmentDebt.test.ts`
- Test: `apps/web/tests/data/servedDataParityCoverage.test.ts`

**Interfaces:**

```ts
type DebtFamily = "stock" | "service" | "rate";
type DebtSeriesId =
  | "debt.stock.total" | "debt.stock.domestic" | "debt.stock.external"
  | "debt.service.total" | "debt.service.principal" | "debt.service.interest"
  | "debt.rate.total" | "debt.rate.domestic" | "debt.rate.external";

type ServedGovernmentDebtFact = {
  year: number;
  family: DebtFamily;
  seriesId: DebtSeriesId;
  value: number | null;
  valueKind: "amount_gel" | "percent";
  status: "actual" | "projection_existing_portfolio" | "not_available";
  sourceId: string | null;
  snapshotDate: string | null;
  lastReviewedAt: string;
};

loadServedGovernmentDebtData(): Promise<{ facts: ServedGovernmentDebtFact[] }>;
governmentDebtFactParityKey(row: ServedGovernmentDebtFact): string;
```

- [ ] Write failing loader tests asserting the nine series, exact coverages, rate nulls, service totals, and no GDP column.
- [ ] Generate the serving CSV deterministically from the four approved package CSVs; do not parse PDFs or fetch the network.
- [ ] Add one `GovernmentDebtFact` Prisma model with nullable decimal value and unique `(year, seriesId)` rows; extend the existing transactional import rather than creating a second importer.
- [ ] Add CSV/DB projection and parity checks, then run:

```powershell
npm test -- tests/data/governmentDebt/servedGovernmentDebt.test.ts tests/data/servedDataParityCoverage.test.ts
npm run data:validate
```

- [ ] Commit: `data: serve annual government debt facts`.

---

### Task 2: Build the debt explorer model and exclusive family state

**Files:**
- Create: `apps/web/lib/explorer/debtExplorer.ts`
- Create: `apps/web/lib/explorer/debtUrlState.ts`
- Create: `apps/web/components/debt/use-debt-explorer-state.ts`
- Test: `apps/web/tests/explorer/debtExplorer.test.ts`
- Test: `apps/web/tests/explorer/debtUrlState.test.ts`

**Interfaces:**

```ts
selectDebtSeries(current: DebtSeriesId[], next: DebtSeriesId): DebtSeriesId[];
buildDebtExplorerModel(input: {
  facts: ServedGovernmentDebtFact[];
  gdpFacts: ServedNationalGdpFact[];
  selectedIds: DebtSeriesId[];
  range: { start: number; end: number };
  shareOfGdp: boolean;
}): GovernmentDebtExplorerModel;
```

- [ ] Write failing tests: default `debt.stock.total`; same-family additions survive; a different-family selection clears the old family; mixed-family hashes normalize to the first family; clearing yields no series.
- [ ] Build the nine-row hierarchy with all three parents expanded by default and stable colors/labels from the spec.
- [ ] Calculate stock GDP shares from existing GDP facts; build service total from principal plus interest; preserve rate nulls and the 2026 forecast status.
- [ ] Serialize `m`, `sh`, `r`, and `sel` in the hash using the existing URL-state conventions; family switches reset to full family coverage.
- [ ] Run `npm test -- tests/explorer/debtExplorer.test.ts tests/explorer/debtUrlState.test.ts`.
- [ ] Commit: `feat: model government debt explorer state`.

---

### Task 3: Extend reusable explorer primitives minimally

**Files:**
- Modify: `apps/web/components/main-explorer/editorial-line-chart.tsx`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx`
- Modify: `apps/web/components/main-explorer/range-strip.tsx`
- Test: `apps/web/tests/explorer/editorialLineChart.test.ts`
- Test: `apps/web/tests/explorer/rangeStrip.test.ts`
- Create: `apps/web/tests/explorer/debtTable.test.ts`

**Interfaces:**

```ts
type ChartSeries = {
  id: string;
  label: string;
  color: string;
  vals: Array<number | null>;
  planned: boolean[];
  forecastFromYear?: number;
};
type RangeMarker = { year: number; label: string };
// New optional props only; existing national and municipal calls remain valid.
```

- [ ] Write failing tests proving solid-through-2025/dashed-from-2026 paths, null rate segments, optional range marker, and `პროგნოზი` table labels.
- [ ] Add only optional props; preserve every existing call and visual default.
- [ ] Run the focused tests plus current explorer integration tests:

```powershell
npm test -- tests/explorer/editorialLineChart.test.ts tests/explorer/rangeStrip.test.ts tests/explorer/debtTable.test.ts tests/explorer/integration.test.ts
```

- [ ] Commit: `feat: support forecast debt series in explorer primitives`.

---

### Task 4: Compose the route from existing components

**Files:**
- Create: `apps/web/app/explorer/debt/page.tsx`
- Create: `apps/web/components/debt/debt-explorer.tsx`
- Create: `apps/web/components/debt/debt-series-panel.tsx`
- Modify: `apps/web/lib/explorer/sections.ts`
- Modify: `apps/web/lib/explorer/hubCards.ts`
- Modify: `apps/web/app/explorer/page.tsx`
- Modify: `apps/web/lib/seo/metadata.ts`
- Modify: `apps/web/lib/seo/internalLinks.ts`
- Test: `apps/web/tests/explorer/debtRoute.test.tsx`
- Test: `apps/web/tests/explorer/hubCards.test.ts`
- Test: `apps/web/tests/seo/routes.test.ts`

**Interfaces:**

```ts
function DebtExplorer(props: {
  facts: ServedGovernmentDebtFact[];
  gdpFacts: ServedNationalGdpFact[];
  workbookSources: WorkbookPublicSource[];
  lastUpdatedAt: string;
}): React.ReactNode;
```

- [ ] Write failing route/component tests for H1, default total-only selection, all nine visible rows, one chart, family clearing, measure visibility, gaps and forecast notice.
- [ ] Compose `PageHeader`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesSelector`, `SeriesSelectorRow`, `ExcelDownloadButton`, `SourceNote` and `SiteFooter`; do not duplicate their markup.
- [ ] Add `ვალი` as section/card 05 using the existing hub card and total-debt sparkline; leave the landing page unchanged.
- [ ] Run route, hub, SEO and full explorer tests.
- [ ] Commit: `feat: add government debt explorer route`.

---

### Task 5: Reuse workbook and methodology surfaces

**Files:**
- Create: `apps/web/lib/explorer/debtWorkbook.ts`
- Modify: `apps/web/lib/methodology/catalog.ts`
- Create: `apps/web/lib/methodology/content/debt.ts`
- Modify: `apps/web/lib/methodology/sourceInventory.ts`
- Modify: `Project_Definition.md`
- Modify: `DESIGN.md`
- Modify: `docs/data-methodology/government-debt-annual.md`
- Test: `apps/web/tests/explorer/debtWorkbook.test.ts`
- Test: `apps/web/tests/methodology/catalog.test.ts`
- Test: `apps/web/tests/methodology/sourceInventory.test.ts`

**Interfaces:**

```ts
buildDebtWorkbookExportModel(input: DebtWorkbookInput): WorkbookExportModel;
```

- [ ] Write failing workbook tests for the active family/selection/range/measure, three existing sheets, rate percentages, forecast status and validated source links.
- [ ] Build only a debt-to-existing-workbook-model adapter; reuse `downloadWorkbook` and all workbook styling/writing code.
- [ ] Add one concise Debt methodology entry: boundary, 2019/2022 changes, rate gaps, forecast snapshot and source archive.
- [ ] Move Debt from excluded to included scope, document the approved hierarchy/forecast extensions, and retain the explicit no-deficit/no-change-to-`spending.debt_service` boundary.
- [ ] Run focused workbook/methodology tests.
- [ ] Commit: `feat: add debt workbook and methodology surfaces`.

---

### Task 6: Browser regression and full verification

**Files:**
- Create: `apps/web/tests/browser/debt.spec.ts`
- Modify only scoped files if verification finds a regression.

- [ ] Add browser coverage for desktop/mobile, default-expanded groups, same-family multi-select, cross-family clearing, line/table, share pill, rate gaps, service forecast and download.
- [ ] Prove no existing explorer regression and no extra chart with:

```powershell
npm run test:browser -- --grep "Government Debt|main explorer|municipal"
npm run check
npm run build
```

- [ ] Run DB-mode parity/build when the configured Supabase environment is available:

```powershell
npm run data:import
$env:GEODATA_DATA_SOURCE='db'; npm run build
```

- [ ] Confirm the current expenditure `ვალის მომსახურება` values and files are unchanged; inspect `git diff --check` and `git status --short --branch`.
- [ ] Request independent code review, fix confirmed findings, rerun affected gates, and commit: `test: verify government debt explorer`.
