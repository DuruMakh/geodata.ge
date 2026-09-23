# Explorer and Pipeline Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The code the six September explorers duplicated from the budget explorer exists once, with every page, URL, workbook and generated artifact identical afterwards — except the one approved filename change.

**Architecture:** Seven independent consolidations, each its own branch and PR, in the order below. Every one starts by pinning the current output in a test, then moves the implementation under it. Nothing is redesigned: the shared piece takes the existing string, class list or algorithm verbatim, and the callers lose their copies.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Tailwind v4, Vitest 4, Playwright, ExcelJS.

**Spec:** `docs/superpowers/specs/2026-09-17-explorer-consolidation-design.md` — which is also the explicit approval to refactor modules earlier feature specs told implementers to leave alone (`2026-09-11-economic-sectors-design.md:136`, `:165`).

## Global Constraints

- **Preconditions.** Do not start until plans 1, 2 and 3 have merged: `2026-09-17-figure-accuracy-fixes.md` (the workbook `showChangeColumn` input and the `calculated` basis), `2026-09-17-stacked-chart-and-sector-colours.md` (the chart pieces) and `2026-09-17-explorer-interaction-consistency.md` (the hash write rules). Check with `git log --oneline origin/main | head -20` before Task 1.
- **One PR per task.** Each task is its own branch off the latest `main` (`codex/consolidate-<section>`), its own review and its own merge. Never commit to `main`.
- **Behaviour-preserving** means all three of: the unit, route and browser tests pass unchanged; the workbook models for fixed inputs are identical; and `npm run data:validate` leaves `git status` clean.
- **The only approved changed expectation** in the whole series is the Georgian GDP workbook filename losing `-ka` (Task 3). If any other test needs editing, stop and report it — that is a behaviour change, not a refactor.
- **Not in scope:** municipal page shells (except the KPI blocks in Task 5), hash key renames, new workbook sheets or columns, any data or artifact value, and per-request MCP server construction.
- **DESIGN.md is unchanged by this plan.** Spec 3's §6.3 table stays authoritative for hash keys.
- **Test loop:** the targeted tests named in each task while editing; `npm run check`, `npm run build` and the browser suite once per PR, before opening it.

---

### Task 1: The explorer shell exists once

**Branch:** `codex/consolidate-shell`

**Files:**
- Create: `apps/web/components/explorer-shell/explorer-page.tsx`, `…/explorer-heading.tsx`, `…/explorer-workspace.tsx`, `…/series-aside.tsx`, `…/measure-pill.tsx`, `…/use-app-ready.ts`
- Modify: `components/main-explorer/main-explorer.tsx:301`, `…/explorer-view.tsx:120,137-149`, `…/series-panel.tsx:139`, `components/debt/debt-explorer.tsx:136,148,194-206`, `components/debt/debt-series-panel.tsx:87`, `components/deficit/deficit-explorer.tsx:132,144,176-187,251`, `components/gdp/gdp-overview.tsx:96,117`, `components/inflation/inflation-overview.tsx:100`, `…/inflation-categories.tsx:132,144`, `…/inflation-series-panel.tsx:35`, `…/inflation-category-panel.tsx:67`, `components/economic-sectors/economic-sectors-explorer.tsx:92`, `…/sector-series-panel.tsx:45`, `components/shell/legacy-hash-redirect.tsx:17`, `lib/pages/inflation.tsx:44`, `lib/pages/economy.tsx`
- Create: `apps/web/tests/explorer/shellClasses.test.tsx`

**Interfaces:**
```tsx
export function ExplorerPage({ paddingBottom = "default", children }: { paddingBottom?: "default" | "tight"; children: ReactNode }): JSX.Element;
export function ExplorerHeading({ children }: { children: ReactNode }): JSX.Element;
export function ExplorerWorkspace({ children }: { children: ReactNode }): JSX.Element;
export function SeriesAside({ label, children }: { label: string; children: ReactNode }): JSX.Element;
export function MeasurePill({ label, pressed, onChange, testId }: { label: string; pressed: boolean; onChange: (next: boolean) => void; testId: string }): JSX.Element;
export function useAppReady(options?: { clearOnUnmount?: boolean }): void;
```
- `ExplorerPage` renders `<main>` with `min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]`, plus ` min-[768px]:pb-16` when `paddingBottom` is `"default"` — debt and deficit carry that extra class today and GDP, sectors and inflation do not, so the prop keeps both lists byte-identical.
- `useAppReady({ clearOnUnmount: false })` is the set-only variant `legacy-hash-redirect.tsx:17` needs.

- [ ] **Step 1: Pin the current class lists**

Create `apps/web/tests/explorer/shellClasses.test.tsx`. For each adopting page, render it and capture the class attribute of the wrapper, the H1, the workspace, the aside and the measure pill:

```tsx
import { describe, expect, it } from "vitest";
import { renderGeorgianMarkup } from "../helpers/render";

const PAGES = [
  { name: "budget", render: async () => (await import("../../lib/pages/explorer")).renderExplorerPage("ka") },
  { name: "debt", render: async () => (await import("../../lib/pages/debt")).renderDebtPage("ka") },
  { name: "deficit", render: async () => (await import("../../lib/pages/deficit")).renderDeficitPage("ka") },
  { name: "gdp", render: async () => (await import("../../lib/pages/gdp")).renderGdpPage("ka") },
  { name: "sectors", render: async () => (await import("../../lib/pages/economic-sectors")).renderEconomicSectorsPage("ka") },
  { name: "inflation-overview", render: async () => (await import("../../lib/pages/inflation")).renderInflationOverviewPage("ka") },
  { name: "inflation-categories", render: async () => (await import("../../lib/pages/inflation")).renderInflationCategoriesPage("ka") },
] as const;

const classesOf = (markup: string, pattern: RegExp): string[] =>
  [...markup.matchAll(pattern)].map((match) => match[1]!);

describe.each(PAGES)("$name shell", ({ render }) => {
  it("keeps its wrapper, heading, workspace and aside class lists", async () => {
    const markup = renderGeorgianMarkup(await render());

    expect(classesOf(markup, /<main[^>]*class="([^"]*)"/g)).toMatchSnapshot("main");
    expect(classesOf(markup, /<h1[^>]*class="([^"]*)"/g)).toMatchSnapshot("h1");
    expect(classesOf(markup, /data-testid="explorer-workspace"[^>]*class="([^"]*)"/g)).toMatchSnapshot("workspace");
    expect(classesOf(markup, /<aside[^>]*class="([^"]*)"/g)).toMatchSnapshot("aside");
  });
});
```

Use the page render helpers the existing route tests use; where a page exports a different name, take it from `tests/explorer/*Route.test.tsx`. Pages without a workspace or aside snapshot an empty array, which is itself the pin.

Run: `npx vitest run tests/explorer/shellClasses.test.tsx`
Expected: PASS, writing the snapshot file. Commit the snapshot now — it is the contract the refactor must not break.

```bash
git add tests/explorer/shellClasses.test.tsx tests/explorer/__snapshots__
git commit -m "test(explorer): pin the shell class lists before consolidating them"
```

- [ ] **Step 2: Write the shared components**

Create the six files under `apps/web/components/explorer-shell/`, each taking its class string verbatim from the file listed in the Files block. For example:

```tsx
// apps/web/components/explorer-shell/explorer-heading.tsx
import type { ReactNode } from "react";

/** The explorer H1 (DESIGN.md §6.2). Eight pages carried this string. */
export function ExplorerHeading({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
      {children}
    </h1>
  );
}
```

```tsx
// apps/web/components/explorer-shell/use-app-ready.ts
"use client";
import { useEffect } from "react";

/**
 * Sets `document.body.dataset.appReady`, which 23 browser test files wait on.
 * Nine components ran this identical effect; legacy-hash-redirect deliberately
 * sets it without clearing, which is what `clearOnUnmount: false` preserves.
 */
export function useAppReady({ clearOnUnmount = true }: { clearOnUnmount?: boolean } = {}): void {
  useEffect(() => {
    document.body.dataset.appReady = "true";
    if (!clearOnUnmount) return;
    return () => {
      delete document.body.dataset.appReady;
    };
  }, [clearOnUnmount]);
}
```

`SeriesAside` takes the class string from `series-panel.tsx:139` and its `aria-label` from the caller. `MeasurePill` takes the button from `explorer-view.tsx:137-149`, including both branches of the pressed/unpressed class expression. `ExplorerWorkspace` takes the grid from `explorer-view.tsx:120` with its `data-testid="explorer-workspace"`.

- [ ] **Step 3: Adopt them, one page at a time**

Replace each duplicate with the shared component, running the snapshot test after every page:

Run: `npx vitest run tests/explorer/shellClasses.test.tsx`
Expected: PASS with no snapshot update. If a snapshot differs, the shared component's class string is wrong — fix the component, never the snapshot.

Where a page's `useEffect` set `appReady` alongside other work (for example `gdp-overview.tsx:46-57`, which also parses the hash), keep that effect and delete only the two `appReady` lines, calling `useAppReady()` beside it.

- [ ] **Step 4: Verify the timing and the suite**

Run: `npm run check`
Expected: exit 0.

Run, on a production build (`npm run build && npm run start -- --port 3100`):

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all tests pass, with no change in how long `expectAppReady` waits.

- [ ] **Step 5: Commit and open the PR**

```bash
git add components/explorer-shell components/main-explorer components/debt components/deficit components/gdp components/inflation components/economic-sectors components/shell/legacy-hash-redirect.tsx lib/pages/inflation.tsx lib/pages/economy.tsx
git commit -m "refactor(explorer): one shell for the page, heading, workspace, aside and pill"
```

Open a draft PR naming the eight heading copies, six aside copies, six workspace copies, twelve wrapper copies, three pill copies and nine `appReady` effects it removes.

---

### Task 2: One workbook model builder

**Branch:** `codex/consolidate-workbook-model`

**Files:**
- Modify: `apps/web/lib/explorer/workbookModel.ts` (the input type, the subtitle, the analysis schema, the source strategy, the filename)
- Modify: `apps/web/lib/explorer/gdpWorkbook.ts:38-89`, `…/inflationWorkbook.ts:17-117`, `…/inflationCategoryWorkbook.ts:31-175`, `…/economicSectorsWorkbook.ts:22-150`
- Modify: `apps/web/tests/browser/bilingual-workbooks.spec.ts:36-45`
- Test: `apps/web/tests/explorer/{gdp,inflation,inflationCategory,economicSectors}Workbook.test.ts`

**Interfaces:**
```ts
export type WorkbookBasis =
  | "actual" | "planned" | "forecast" | "not_available" | "published" | "preliminary" | "calculated";

export type WorkbookColumns =
  | { kind: "years"; years: number[] }
  | { kind: "months"; periods: string[]; headerLabels: string[]; sourceYears: number[] };

export type WorkbookAnalysisSchema = {
  headers: string[];
  numericFormats?: Record<number, string>;
  row: (input: { seriesId: string; label: string; parentLabel: string | null; column: string | number; point: WorkbookPoint }) => Array<string | number | null>;
};

export type WorkbookSourceStrategy =
  | { kind: "byYear" }                 // today's default: filter by the model's years
  | { kind: "bySourceYears" }          // months: filter by the caller's sourceYears
  | { kind: "byLanguage"; locale: Locale }; // prefer the locale's edition of a source

export type WorkbookExportInput = {
  locale: Locale;
  filenameBase: string;
  title: string;
  groupLabel: string;
  columns: WorkbookColumns;
  measure: WorkbookMeasure;
  totalId: string | null;
  series: WorkbookSeries[];
  includeTotalsInAnalysis?: boolean;
  showChangeColumn?: boolean;
  numberFormat?: string;
  analysis?: WorkbookAnalysisSchema;   // omitted keeps today's five/six-column schema
  sources: WorkbookPublicSource[];
  sourceStrategy?: WorkbookSourceStrategy; // default { kind: "byYear" }
  siteOrigin: string;
};
```
- `buildWorkbookExportModel(input): WorkbookExportModel` keeps its name and return type. Three fields are renamed because they now hold months as well as years: `WorkbookSeries.pointsByYear` becomes `pointsByColumn: Record<string | number, WorkbookPoint | null | undefined>`, and `WorkbookReadableRow.valuesByYear`/`basisByYear` become `valuesByColumn`/`basisByColumn`, keyed the same way. Update the budget, debt and deficit callers and `lib/explorer/workbookWriter.client.ts` mechanically — the writer reads these three fields and must not change what it emits.
- Filename rule: `fiscal-${filenameBase}${range}${locale === "en" ? "-en" : ""}.xlsx` — unchanged for every workbook except GDP, which today appends `-ka` or `-en` (`gdpWorkbook.ts:53`).

- [ ] **Step 1: Pin the four models**

In each of `tests/explorer/{gdp,inflation,inflationCategory,economicSectors}Workbook.test.ts`, add a snapshot of the whole model for one fixed input:

```ts
  it("builds a stable model for a fixed input", () => {
    expect(buildGdpWorkbookExportModel(fixtureFacts, fixtureState, fixturePresentation, fixtureSources, "https://fiscal.ge")).toMatchSnapshot();
  });
```

using each file's existing fixtures. Run them, commit the snapshots, and treat them as the contract:

```bash
npx vitest run tests/explorer/gdpWorkbook.test.ts tests/explorer/inflationWorkbook.test.ts tests/explorer/inflationCategoryWorkbook.test.ts tests/explorer/economicSectorsWorkbook.test.ts
git add tests/explorer/__snapshots__ tests/explorer/*Workbook.test.ts
git commit -m "test(workbook): pin the four hand-built models before generalising"
```

- [ ] **Step 2: Add the subtitle vocabulary**

In `workbookModel.ts`, replace `subtitle()`'s nested ternary with a table so `published`, `preliminary` and `calculated` no longer fall through to "Actual":

```ts
// One entry per basis, so a published or preliminary workbook is not labelled
// "Actual" — the old ternary had no branch for them and fell through.
const SUBTITLE_KEYS = {
  actual: "workbook.actual",
  planned: "workbook.planned",
  forecast: "workbook.forecast",
  not_available: "workbook.unavailable",
  published: "workbook.published",
  preliminary: "workbook.preliminary",
  calculated: "workbook.calculated",
} as const satisfies Record<WorkbookBasis, string>;

function subtitle(rows: WorkbookReadableRow[], period: string, unitLabel: string, locale: Locale): string {
  const present = new Set(
    rows.flatMap((row) => Object.values(row.basisByColumn)).filter((basis): basis is WorkbookBasis => basis !== null && basis !== "not_available"),
  );
  const basis = present.has("actual") && present.has("forecast")
    ? workbookMessage(locale, "workbook.actualForecast")
    : present.has("actual") && present.has("planned")
      ? workbookMessage(locale, "workbook.actualPlanned")
      : present.size === 1
        ? workbookMessage(locale, SUBTITLE_KEYS[[...present][0]!])
        : present.size === 0
          ? workbookMessage(locale, "workbook.unavailable")
          : workbookMessage(locale, SUBTITLE_KEYS[[...present].sort()[0]!]);
  return `${period} · ${basis} · ${unitLabel}`;
}
```

Keep the existing `actual+forecast` and `actual+planned` pairs first so the budget, debt and deficit subtitles do not move. Add the test the spec requires:

```ts
  it("does not label published or preliminary data as actual", () => {
    const model = buildWorkbookExportModel({ ...fixtureInput, series: [preliminarySeries] });
    expect(model.readable.subtitle).not.toContain(workbookMessage("ka", "workbook.actual"));
    expect(model.readable.subtitle).toContain(workbookMessage("ka", "workbook.preliminary"));
  });
```

- [ ] **Step 3: Generalise columns, analysis, sources and the filename**

Implement the interface above inside `buildWorkbookExportModel`:
- `columns.kind === "months"` fills `readable.headerLabels` and `sourceYears`, and the filename range comes from the first and last `sourceYears`.
- `analysis` defaults to today's headers and row shape; a caller-supplied schema replaces both.
- `sourceStrategy` selects the filter: `byYear` is today's `source.years.filter((year) => years.includes(year))`; `bySourceYears` filters against `columns.sourceYears`; `byLanguage` picks the locale's edition, taking the picker verbatim from `inflationWorkbook.ts:83-87`.
- The filename drops its per-caller suffix logic.

- [ ] **Step 4: Route the four builders through it**

Rewrite each builder to assemble a `WorkbookExportInput` and call `buildWorkbookExportModel`, deleting its local merging (`economicSectorsWorkbook.ts:62-78`), its month rows (`inflationWorkbook.ts:38-57`, `inflationCategoryWorkbook.ts:71-86`) and its source picker (`inflationWorkbook.ts:83-87`, `inflationCategoryWorkbook.ts:123-127`).

Run after each builder: `npx vitest run tests/explorer/<name>Workbook.test.ts`
Expected: PASS against the Step 1 snapshot, except the GDP filename, which is the one approved change. Update that single snapshot value and nothing else.

- [ ] **Step 5: Record the filename change**

In `apps/web/tests/browser/bilingual-workbooks.spec.ts:36-45`, add GDP to the group that expects a plain base name in Georgian and `-en` in English, removing it from any `-ka` expectation.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/bilingual-workbooks.spec.ts`
Expected: PASS.

- [ ] **Step 6: Verify and open the PR**

Run: `npm run check && npm run build`, then the browser suite on the production build.
Expected: all pass; the debt, deficit, budget and municipal workbook tests are untouched.

```bash
git add lib/explorer/workbookModel.ts lib/explorer/gdpWorkbook.ts lib/explorer/inflationWorkbook.ts lib/explorer/inflationCategoryWorkbook.ts lib/explorer/economicSectorsWorkbook.ts tests/explorer tests/browser/bilingual-workbooks.spec.ts
git commit -m "refactor(workbook): one model builder for years, months, bases and sources"
```

The PR description must call out the Georgian GDP filename losing `-ka` as the series' one approved visible change.

---

### Task 3: One period-range module

**Branch:** `codex/consolidate-period-range`

**Files:**
- Create: `apps/web/lib/explorer/periodRange.ts`
- Modify: `apps/web/lib/explorer/inflationCategories.ts:139-316`, `…/inflationOverview.ts:62-149`, `…/gdpOverview.ts:55`, `…/economicSectors.ts:62-63`
- Modify: `apps/web/components/gdp/gdp-overview.tsx:231-243`, `components/economic-sectors/economic-sectors-explorer.tsx:211-223`
- Modify: `apps/web/lib/pages/inflation.tsx:76-87,123-134` (`projectArchiveSources`)

**Interfaces:**
```ts
export type PeriodCoverage<T extends number | string> = { min: T; max: T; values: readonly T[] };
export type PeriodRange<T extends number | string> = { kind: "all" } | { kind: "manual"; start: T; end: T };

export function resolveRange<T extends number | string>(range: PeriodRange<T>, coverage: PeriodCoverage<T>): { min: T; max: T; start: T; end: T };
export function rangeFromPatch<T extends number | string>(patch: { start?: T; end?: T }, current: PeriodRange<T>, coverage: PeriodCoverage<T>): PeriodRange<T>;
export function changeTab<T extends number | string>(range: PeriodRange<T>, coverage: PeriodCoverage<T>, options: { collapseToAll: boolean }): PeriodRange<T>;
```
- `collapseToAll: true` for GDP and both inflation pages (a manual range equal to full coverage becomes `{ kind: "all" }`); `false` for sectors, whose behaviour `tests/explorer/economicSectors.test.ts:56-62` pins.
- `projectArchiveSources(manifest, locale, documents)` in `lib/pages/inflation.tsx`'s module or a shared page helper, replacing the two copies at `:76-87` and `:123-134`.

- [ ] **Step 1: Confirm the existing tests cover both behaviours**

Run: `npx vitest run tests/explorer/gdpOverview.test.ts tests/explorer/economicSectors.test.ts tests/explorer/inflationOverview.test.ts tests/explorer/inflationCategories.test.ts`
Expected: PASS. These four files are the contract; this task must not edit one of them.

- [ ] **Step 2: Write the module**

Create `apps/web/lib/explorer/periodRange.ts` implementing the three functions, generic over a comparable period (a year number or a `YYYY-MM` string — both order correctly under `<`). Take the bodies verbatim from `inflationOverview.ts:62-149` and keep the tab rule behind the `collapseToAll` option, with the comment explaining why sectors differ:

```ts
// GDP and inflation collapse a manual range that equals full coverage back to
// "all", so a later data year widens the view. Sectors deliberately keep the
// manual range (tests/explorer/economicSectors.test.ts:56-62 pins it).
```

- [ ] **Step 3: Move the callers onto it**

Replace the bodies in `inflationOverview.ts` and `inflationCategories.ts` with calls, delete `inflationCategories.ts`'s mirrored functions (`:139-316`) and its "mirrors inflationOverview" comment (`:5-6`), and replace the four range-to-state copies in the two components and the two modules.

Run after each file: `npx vitest run tests/explorer`
Expected: PASS, with no test edited.

- [ ] **Step 4: Deduplicate the source projection**

Extract the identical body of `lib/pages/inflation.tsx:76-87` and `:123-134` into `projectArchiveSources(...)` in the same file, and call it twice.

Run: `npx vitest run tests/explorer/inflationRoute.test.tsx` (or the inflation route test this repo has)
Expected: PASS.

- [ ] **Step 5: Verify and open the PR**

Run: `npm run check && npm run build`, then the browser suite on the production build.
Expected: all pass.

```bash
git add lib/explorer/periodRange.ts lib/explorer/inflationOverview.ts lib/explorer/inflationCategories.ts lib/explorer/gdpOverview.ts lib/explorer/economicSectors.ts components/gdp/gdp-overview.tsx components/economic-sectors/economic-sectors-explorer.tsx lib/pages/inflation.tsx
git commit -m "refactor(explorer): one period-range module for years and months"
```

---

### Task 4: Two KPI blocks, not four

**Branch:** `codex/consolidate-kpi-blocks`

**Files:**
- Modify: `apps/web/components/main-explorer/kpi-blocks.tsx:9-64`
- Modify: `apps/web/components/economic-sectors/sector-highlights.tsx:50-81`
- Modify: `apps/web/components/municipalities/municipal-indicators.tsx:84-137`
- Test: the sectors and municipal route tests

**Interfaces:**
```tsx
export function HeroKpi({ label, value, unit, valueColor, children }: { label: string; value: string; unit?: string; valueColor?: string; children: ReactNode }): JSX.Element;
export function SideKpiList({ kpis, wrapDetail }: { kpis: SideKpi[]; wrapDetail?: boolean }): JSX.Element;
```
- `unit` renders with the sector hero's existing unit styling, immediately after the value inside the same `<p>`.
- `wrapDetail` drops `overflow-hidden text-ellipsis whitespace-nowrap` from the detail paragraph, which is what the sectors "unavailable" detail needs.
- The municipal last-card branch becomes `index === kpis.length - 1`, replacing the hard-coded `index === 2` (`municipal-indicators.tsx:119`).

- [ ] **Step 1: Pin the rendered output**

Add class-list and text snapshots for the sectors highlights and the municipal indicators to their route tests, the same way Task 1 pins the shell:

```tsx
  it("keeps its KPI markup", async () => {
    const markup = renderGeorgianMarkup(await renderEconomicSectorsPage("ka"));
    expect([...markup.matchAll(/data-testid="side-kpi"[^>]*class="([^"]*)"/g)].map((m) => m[1])).toMatchSnapshot("sector side kpis");
    expect(markup.slice(markup.indexOf("ძირითადი"), markup.indexOf("ძირითადი") + 2000)).toMatchSnapshot("sector hero");
  });
```

Run, commit the snapshots, then refactor under them.

- [ ] **Step 2: Extend the shared blocks**

Add `unit` to `HeroKpi`, rendering it exactly as `sector-highlights.tsx` does today, and `wrapDetail` to `SideKpiList`. Neither changes any existing caller's output: `unit` is omitted and `wrapDetail` defaults to `false`.

- [ ] **Step 3: Adopt them in both copies**

Replace the inlined markup in `sector-highlights.tsx` and `municipal-indicators.tsx` with the shared components, and fix the municipal last-card condition.

Run: `npx vitest run tests/explorer tests/municipalities`
Expected: PASS with no snapshot update. A four-KPI municipal card list now styles its real last card, which is the bug the hard-coded `2` hid; if a snapshot moves, check whether the page has exactly three cards today — if it does, the output must be identical.

- [ ] **Step 4: Verify and open the PR**

Run: `npm run check && npm run build`, then `npx playwright test tests/browser/municipalities.spec.ts tests/browser/economic-sectors.spec.ts` with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`.
Expected: PASS.

```bash
git add components/main-explorer/kpi-blocks.tsx components/economic-sectors/sector-highlights.tsx components/municipalities/municipal-indicators.tsx tests
git commit -m "refactor(kpi): share the hero and side KPI blocks with the sectors and municipal pages"
```

---

### Task 5: One package reader, one CSV serializer, one freshness check

**Branch:** `codex/consolidate-pipeline-helpers`

**Files:**
- Create: `apps/web/lib/data/sourcePackage.ts`
- Create: `apps/web/tests/data/sourcePackage.test.ts`
- Modify: `apps/web/lib/data/inflation/sourceFiles.ts:38-57`, `…/inflation/basketWeightFiles.ts:39-56`, `…/gdpOverview/prepareGdpOverview.ts:25-32`, `…/economicSectors/prepareEconomicSectors.ts:48-56,203-207`, `…/generalGovernmentBalance/prepareGeneralGovernmentBalance.ts:53-80,117-122`, `…/governmentDebt/sourceManifest.ts:57`, `…/governmentDebt/importGovernmentDebtFacts.ts:226,237-243`, `…/governmentDebt/prepareGovernmentDebtPackage.ts:940`, `…/municipalIndicators/prepareGeostatPackage.ts:556`, `…/nationalGdp/prepareNationalGdp.ts:64-69`

**Interfaces:**
```ts
export type PackageFileEntry = { file: string; sha256: string; bytes: number };

/** Reads and verifies package files: size, sha256, and rejection of `../` paths and symlinks. */
export async function readVerifiedPackageFiles(
  manifestDir: string,
  entries: readonly PackageFileEntry[],
  label: string,
): Promise<Map<string, Buffer>>;

export function serializeBomCsv(
  headers: readonly string[],
  rows: ReadonlyArray<Record<string, string | number>>,
  options?: { lineEnding?: "\n" | "\r\n" },
): string;
```
- `readVerifiedPackageFiles` throws `"<label> source hash mismatch: <file>"`, keeping each caller's current message shape so no test's expectation moves. Its traversal and symlink checks are the ones `lib/methodology/sourceManifest.ts:126-182` already applies; that reader stays where it is, because it cannot read package manifests (`lib/factQuery/buildSnapshot.ts:255-260`).
- `serializeBomCsv` defaults to `"\n"`; callers that emit CRLF pass `"\r\n"`. Check each caller's current output before migrating it.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/data/sourcePackage.test.ts`:

```ts
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readVerifiedPackageFiles, serializeBomCsv } from "../../lib/data/sourcePackage";

const roots: string[] = [];
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }); });

async function fixture(): Promise<{ dir: string; entry: { file: string; sha256: string; bytes: number } }> {
  const dir = await mkdtemp(path.join(tmpdir(), "package-"));
  roots.push(dir);
  const body = "payload";
  await writeFile(path.join(dir, "source.csv"), body, "utf8");
  return { dir, entry: { file: "source.csv", sha256: createHash("sha256").update(body).digest("hex"), bytes: body.length } };
}

describe("readVerifiedPackageFiles", () => {
  it("returns verified bytes", async () => {
    const { dir, entry } = await fixture();
    const files = await readVerifiedPackageFiles(dir, [entry], "test");
    expect(files.get("source.csv")!.toString("utf8")).toBe("payload");
  });

  it("rejects a size mismatch, a hash mismatch, a traversal path and a symlink", async () => {
    const { dir, entry } = await fixture();
    await expect(readVerifiedPackageFiles(dir, [{ ...entry, bytes: 1 }], "test")).rejects.toThrow(/test/);
    await expect(readVerifiedPackageFiles(dir, [{ ...entry, sha256: "0".repeat(64) }], "test")).rejects.toThrow(/test/);
    await expect(readVerifiedPackageFiles(dir, [{ ...entry, file: "../escape.csv" }], "test")).rejects.toThrow(/outside/i);

    await symlink(path.join(dir, "source.csv"), path.join(dir, "link.csv"));
    await expect(readVerifiedPackageFiles(dir, [{ ...entry, file: "link.csv" }], "test")).rejects.toThrow(/symlink/i);
  });
});

describe("serializeBomCsv", () => {
  it("writes a BOM and the caller's line ending", () => {
    const rows = [{ year: 2025, value: "1,5" }];
    expect(serializeBomCsv(["year", "value"], rows)).toBe('﻿year,value\n2025,"1,5"\n');
    expect(serializeBomCsv(["year", "value"], rows, { lineEnding: "\r\n" })).toBe('﻿year,value\r\n2025,"1,5"\r\n');
  });
});
```

If the platform cannot create a symlink without elevation, skip that one assertion with a comment naming the reason rather than dropping the check from the implementation.

Run: `npx vitest run tests/data/sourcePackage.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 2: Implement the module**

Write `lib/data/sourcePackage.ts` with both functions. Take the traversal and symlink rejections from `lib/methodology/sourceManifest.ts:126-182` (`path.resolve` must stay inside `manifestDir`, and `lstat` must not report a symlink), and the serializer from `prepareGeneralGovernmentBalance.ts:117-122`, which is byte-identical to `prepareNationalGdp.ts:64-69`.

- [ ] **Step 3: Migrate the six readers and the five serializers**

One file per commit-sized step, running that file's tests after each:

Run: `npx vitest run tests/data`
Expected: PASS after every migration, with no test edited.

Then replace the two re-implemented freshness checks (`prepareEconomicSectors.ts:203-207`, `importGovernmentDebtFacts.ts:237-243`) with `assertGeneratedArtifactMatches(label, filePath, expectedContent)`, keeping each caller's label so the diagnostic still names the right dataset.

- [ ] **Step 4: Prove no artifact moved**

Run: `npm run data:validate && git status --short`
Expected: exit 0 and empty output — every generated artifact is byte-identical and nothing was regenerated.

- [ ] **Step 5: Verify and open the PR**

Run: `npm run check && npm run build`
Expected: exit 0.

```bash
git add lib/data/sourcePackage.ts tests/data/sourcePackage.test.ts lib/data
git commit -m "refactor(data): one verified package reader, one BOM CSV serializer, one freshness check"
```

The PR must state that the six migrated readers gained the path-traversal and symlink checks they lacked.

---

### Task 6: One hash codec toolkit and one write hook

**Branch:** `codex/consolidate-hash-state`

**Files:**
- Modify: `apps/web/lib/explorer/urlState.ts:39-67` (export the helpers; add the monthly variant)
- Modify: `apps/web/lib/explorer/debtUrlState.ts:23-61`, `…/deficitUrlState.ts`, `…/gdpOverview.ts`, `…/economicSectors.ts`, `…/inflationOverview.ts`, `…/inflationCategories.ts`
- Create: `apps/web/lib/explorer/useHashState.ts`
- Modify: the seven explorer components' hash write effects

**Interfaces:**
```ts
export function parseSharedHashKeys(params: URLSearchParams): SharedHashState;
export function writeSharedHashKeys(params: URLSearchParams, input: { chartMode: ChartMode; share: boolean; rangeStart: number; rangeEnd: number; selectedIds: string[] }): void;
export function parseMonthlyRange(params: URLSearchParams, key?: string): { start: string; end: string } | undefined;
export function writeMonthlyRange(params: URLSearchParams, range: { start: string; end: string }, key?: string): void;

export function useHashState<T>(options: {
  state: T;
  parse: (hash: string) => T;
  serialize: (state: T) => string;
  onParsed: (state: T) => void;
  history: (previous: T, next: T) => "push" | "replace";
}): void;
```
- `useHashState` implements spec 3's rules exactly: it never stamps a pristine URL (the first write after hydration is skipped when the serialized hash equals the initial one), it replaces by default, and it pushes only when `history` says so. Plan 3 already installed those rules per page; this hook is where they now live.
- Hash keys and values do not change. DESIGN.md §6.3 stays authoritative.

- [ ] **Step 1: Confirm the codec tests are the contract**

Run: `npx vitest run tests/explorer/urlState.test.ts tests/explorer/debtUrlState.test.ts tests/explorer/deficitUrlState.test.ts tests/explorer/gdpOverview.test.ts tests/explorer/economicSectors.test.ts tests/explorer/inflationOverview.test.ts tests/explorer/inflationCategories.test.ts`
Expected: PASS. None of these seven files may be edited in this task.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/pristine-urls.spec.ts tests/browser/explorer-history.spec.ts`
Expected: PASS — plan 3's history behaviour is the second contract.

- [ ] **Step 2: Export the shared helpers**

In `urlState.ts`, export `parseSharedHashKeys` and `writeSharedHashKeys` unchanged, and add the two monthly helpers using the `YYYY-MM` format the inflation codecs already parse.

- [ ] **Step 3: Move the codecs onto them**

Replace the copied `selectionIds` and range parsing in `debtUrlState.ts:23-61` and the hand-rolled parsing in the deficit, GDP, sectors and inflation codecs.

Run after each: `npx vitest run tests/explorer/<codec>.test.ts`
Expected: PASS, unedited.

- [ ] **Step 4: Add the hook and adopt it**

Write `useHashState` implementing the three rules, then replace each explorer's write effect with a call. The pages that push for a discrete action pass a `history` function naming exactly the transitions plan 3 approved (for example sectors pushing only on a measure or view change).

Run: `npm run check`
Expected: exit 0.

Run, on a production build, the whole browser suite.
Expected: PASS, with `pristine-urls.spec.ts` and the history tests unchanged.

- [ ] **Step 5: Commit and open the PR**

```bash
git add lib/explorer/urlState.ts lib/explorer/useHashState.ts lib/explorer components
git commit -m "refactor(explorer): one hash codec toolkit and one write hook for seven pages"
```

---

### Task 7: The small cleanups

**Branch:** `codex/consolidate-small-cleanups`

**Files:**
- Modify: `apps/web/components/gdp/gdp-overview.tsx:73,204-225`
- Modify: `apps/web/lib/explorer/economyHubCards.ts:26`
- Test: `apps/web/tests/explorer/economyHub.test.tsx`, the GDP route tests

**Interfaces:**
- The nested `I18nProvider` at `gdp-overview.tsx:204-225` is replaced by a prop on the table component carrying the one label it injected. Name the prop after the label it carries, not after the provider.
- `INK` comes from `lib/explorer/colors.ts`; `unitsFor`/`formatInUnit` come from `lib/explorer/format.ts`.

- [ ] **Step 1: Pin the two outputs**

Run: `npx vitest run tests/explorer/economyHub.test.tsx tests/explorer/gdpRoute.test.tsx`
Expected: PASS. These two files are the contract and must not be edited.

- [ ] **Step 2: Remove the nested provider**

Replace the second `I18nProvider` with a prop. The rendered label, and the markup around it, must be identical — check by rendering the page before and after and diffing the relevant section.

- [ ] **Step 3: Replace the literal ink and the hand-formatted billions**

In `gdp-overview.tsx:73` and `economyHubCards.ts:26`, use `INK` instead of `#1E1B16`. In `economyHubCards.ts:26`, replace the hand-rolled billions formatting with `unitsFor`/`formatInUnit`; the rendered output stays `27.1`.

Run: `npx vitest run tests/explorer/economyHub.test.tsx tests/explorer/gdpRoute.test.tsx`
Expected: PASS, unedited. If the number changes even in the last digit, the format helper is being called with the wrong unit — fix the call.

- [ ] **Step 4: Verify and open the PR**

Run: `npm run check && npm run build`, then `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/gdp.spec.ts tests/browser/economy.spec.ts`.
Expected: PASS.

```bash
git add components/gdp/gdp-overview.tsx lib/explorer/economyHubCards.ts
git commit -m "refactor(gdp): drop the nested provider, the literal ink and the hand-rolled billions"
```

---

### Task 8: Series acceptance

**Files:** none (verification only, after all seven PRs have merged).

- [ ] **Step 1: Confirm the duplicates are gone**

Run:

```bash
grep -rn "mt-\[34px\] mb-3 font-\[family-name:var(--font-display)\]" components lib | wc -l
grep -rn "document.body.dataset.appReady" components lib | wc -l
grep -rn "min-h-screen bg-\[var(--paper)\] px-5 pb-16" components lib | wc -l
```

Expected: one occurrence each — inside `components/explorer-shell/` and `use-app-ready.ts`.

- [ ] **Step 2: Confirm nothing else changed**

Run: `npm run check && npm run build && npm run data:validate && git status --short`
Expected: all pass and empty output.

Run the full browser suite on the production build.
Expected: PASS.

- [ ] **Step 3: Confirm the one approved expectation**

Run: `git log --oneline main..HEAD -- tests | cat` across the seven merged PRs, or review the merged diffs.
Expected: the only changed test expectation in the series is the Georgian GDP workbook filename. Every other test edit is a new test, a snapshot added as a contract, or an import path.

- [ ] **Step 4: Close the series**

Record in the final PR (or in a short comment on the last one) that the §1 table's eight duplication rows are closed, naming the counts removed: eight heading copies, six aside copies, six workspace copies, twelve wrapper copies, three pill copies, nine `appReady` effects, four hand-built workbook models, about eight mirrored range functions, two KPI copies, six manifest readers, five CSV serializers, two freshness checks and seven hash codecs.
