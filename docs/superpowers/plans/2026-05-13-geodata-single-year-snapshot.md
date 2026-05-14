# GeoData.ge Single-Year Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a v1 single-year budget snapshot for the existing real expenditure dataset, with headline cards, treemap, Every 100 GEL, spending petals, Budget Field, and full ranking.

**Architecture:** Keep the current multi-year explorer as the default first screen. Add a `single_year` view mode owned by `MainExplorer`, derive all snapshot values in a pure `lib/explorer/singleYear.ts` model, and render the snapshot through focused components under `components/single-year/`. Reuse the existing CSV facts, glossary, source metadata, formatting helpers, dark visual system, and Recharts patterns.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind 4, Recharts 3, Vitest, Playwright.

---

## Review of the Previous Plan

The previous plan had the right product intent, but it needed cleanup before an AI agent should execute it.

Main issues to fix:

- It was too long and embedded large component implementations, which made it harder to review and easier for an agent to copy brittle code blindly.
- It committed the intentionally failing test state. That is useful for local TDD, but bad for a task-by-task agent handoff because it leaves broken commits in history.
- Recharts instructions were underspecified around the existing project pattern. The current app already uses `ResponsiveContainer`, `Cell`, and fixed initial dimensions in `ChartFrame`; Plan 4 should follow those patterns.
- Browser success criteria used a raw `svg` count, which is fragile. The stronger check is by stable headings/test IDs plus no console errors.
- The petals model said "top 7 plus Other", but the component could slice away the aggregated `Other` item.
- The plan did not make current data assumptions explicit enough: current real app data is expenditure-only, `2023-2025`, with `39` validated fact rows.
- It did not call out the known Windows `spawn EPERM` and report-writer permission behavior strongly enough for future verification.

This rewrite keeps the same feature scope but makes the implementation smaller, more testable, and easier to execute.

## Scope

Included:

- Add a `ViewMode` switch with `multi_year` and `single_year`.
- Keep default first view unchanged: expenditure, multi-year, nominal GEL, line chart.
- Add a single-year selector using currently loaded fact years.
- Build the single-year snapshot from `data/imports/budget-facts-2023-2025.csv`.
- Render expenditure snapshots for top-level public spending fields only.
- Keep revenue ingestion out of scope. In `single_year` revenue mode, show a Georgian empty state when no revenue facts exist.
- Preserve current source label behavior and planned-value badge behavior for future planned facts.
- Add unit tests for snapshot calculations and integration tests against the real current CSV.
- Add browser coverage for the single-year route through the UI.

Excluded:

- Revenue ingestion.
- Data outside the 2023-2025 v1 window.
- Stacked mode.
- Share of GDP.
- Public provenance panels.
- Clickable drilldown/detail pages.
- Supabase reads or database inserts.
- Refactoring the real expenditure extraction pipeline.

## Source Documents

Read before executing:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- `docs/superpowers/plans/2026-05-11-geodata-main-explorer-ui.md`
- `docs/superpowers/plans/2026-05-12-geodata-real-expenditure-data.md`

## Current Baseline

Current verified assumptions:

- `apps/web/app/page.tsx` loads `../../data/imports/budget-facts-2023-2025.csv`.
- Real expenditure facts currently cover `2023`, `2024`, and `2025`.
- `npm run data:validate` should report `Validated fact rows: 39`.
- Revenue facts are not currently loaded in the real app data file.
- `MainExplorer` owns side, chart mode, measure, range, bar year, selection state, CSV export, and source label.
- `ChartFrame` is the local Recharts pattern to follow for responsive chart sizing, `Cell`, tooltip styling, and planned markers.
- Playwright starts the app on `http://localhost:3100` through `apps/web/playwright.config.ts`.

Known Windows tooling behavior:

- If `npm run test`, `npm run data:validate`, or `npm run test:browser` fails with `spawn EPERM`, index lock, or report-write permission errors, rerun the same command with Codex escalation. Treat that as a Windows sandbox/tooling problem unless the rerun exposes a product failure.

## File Structure

Create:

```text
apps/web/lib/explorer/singleYear.ts
apps/web/tests/explorer/singleYear.test.ts
apps/web/components/single-year/single-year-snapshot.tsx
apps/web/components/single-year/snapshot-headline-cards.tsx
apps/web/components/single-year/snapshot-treemap.tsx
apps/web/components/single-year/every-100-gel.tsx
apps/web/components/single-year/spending-petals.tsx
apps/web/components/single-year/budget-field.tsx
apps/web/components/single-year/single-year-ranking.tsx
```

Modify:

```text
apps/web/lib/explorer/types.ts
apps/web/components/main-explorer/explorer-controls.tsx
apps/web/components/main-explorer/main-explorer.tsx
apps/web/tests/explorer/integration.test.ts
apps/web/tests/browser/main-explorer.spec.ts
```

Do not modify:

```text
data/imports/budget-facts-2023-2025.csv
data/mappings/review/spending-field-mapping-review-2023-2025.csv
apps/web/lib/data/realExpenditure/*
```

## Shared Model Contract

Add these exported types to `apps/web/lib/explorer/types.ts`:

```ts
export const VIEW_MODES = ["multi_year", "single_year"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export type SnapshotItem = {
  itemId: string;
  kaLabel: string;
  enLabel: string;
  color: string;
  amountGel: number;
  shareOfTotal: number;
  previousAmountGel: number | null;
  changeFromPreviousYear: number | null;
  amountChangeFromPreviousYear: number | null;
  basis: "actual" | "planned";
  source: SourceMetadata;
};

export type Every100Item = {
  itemId: string;
  kaLabel: string;
  enLabel: string;
  color: string;
  gelFrom100: number;
  exactShare: number;
};

export type SnapshotHeadline = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type SingleYearSnapshotModel = {
  side: ExplorerSide;
  year: number;
  previousYear: number | null;
  totalGel: number;
  basis: "actual" | "planned";
  hasPlannedValues: boolean;
  source: SourceMetadata | null;
  headlineCards: SnapshotHeadline[];
  items: SnapshotItem[];
  every100: Every100Item[];
  petals: SnapshotItem[];
  rankingRows: SnapshotItem[];
  hasGrowthData: boolean;
  emptyReason: string | null;
};
```

Model rules:

- `items` and `rankingRows` are top-level rows sorted by `amountGel` descending.
- `totalGel` is the sum of active public facts for `side + year`.
- `previousYear` is the closest earlier year with facts for the same side.
- `changeFromPreviousYear` is `null` when previous item amount is missing or zero.
- `amountChangeFromPreviousYear` is `null` when previous item amount is missing.
- `every100` must sum to exactly `100` across `gelFrom100`.
- `petals` must be top 7 items plus an aggregated `snapshot.other` item when there are more than 8 items. If there are 8 or fewer items, include all items.
- `emptyReason` is non-null when the selected side/year has no rows.

## Task 1: Add Snapshot Model Tests

**Files:**

- Modify: `apps/web/lib/explorer/types.ts`
- Create: `apps/web/tests/explorer/singleYear.test.ts`

- [ ] **Step 1: Add the shared model types**

Add the types from `Shared Model Contract` to `apps/web/lib/explorer/types.ts`.

- [ ] **Step 2: Add focused unit tests**

Create `apps/web/tests/explorer/singleYear.test.ts` with tests for:

```ts
import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";

const glossary = new Map<string, GlossaryEntry>([
  ["spending.health", { id: "spending.health", kaLabel: "ჯანმრთელობა", enLabel: "Health", description: "", notes: "" }],
  ["spending.education", { id: "spending.education", kaLabel: "განათლება", enLabel: "Education", description: "", notes: "" }],
  ["spending.defence", { id: "spending.defence", kaLabel: "თავდაცვა", enLabel: "Defence", description: "", notes: "" }],
  ["spending.infrastructure", { id: "spending.infrastructure", kaLabel: "ინფრასტრუქტურა", enLabel: "Infrastructure", description: "", notes: "" }],
]);

const facts: BudgetFactImportRow[] = [
  { year: 2024, side: "expenditure", itemId: "spending.health", amountGel: 100, basis: "actual", sourceId: "source.2024", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.health", mappingConfidence: "high", mappingNotes: "" },
  { year: 2024, side: "expenditure", itemId: "spending.education", amountGel: 300, basis: "actual", sourceId: "source.2024", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.education", mappingConfidence: "high", mappingNotes: "" },
  { year: 2024, side: "expenditure", itemId: "spending.defence", amountGel: 100, basis: "actual", sourceId: "source.2024", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.defence", mappingConfidence: "high", mappingNotes: "" },
  { year: 2025, side: "expenditure", itemId: "spending.health", amountGel: 150, basis: "actual", sourceId: "source.2025", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.health", mappingConfidence: "high", mappingNotes: "" },
  { year: 2025, side: "expenditure", itemId: "spending.education", amountGel: 250, basis: "actual", sourceId: "source.2025", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.education", mappingConfidence: "high", mappingNotes: "" },
  { year: 2025, side: "expenditure", itemId: "spending.defence", amountGel: 100, basis: "actual", sourceId: "source.2025", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.defence", mappingConfidence: "high", mappingNotes: "" },
];

const sources: SourceDocumentRow[] = [
  { sourceId: "source.2024", sourceName: "Reviewed 2024 execution", sourceUrlOrFile: "docs/source-2024", lastReviewedAt: "2026-05-12" },
  { sourceId: "source.2025", sourceName: "Reviewed 2025 execution", sourceUrlOrFile: "docs/source-2025", lastReviewedAt: "2026-05-12" },
];

describe("single-year snapshot model", () => {
  it("builds total, shares, growth, and four headline cards", () => {
    const model = buildSingleYearSnapshotModel({ facts, glossary, sourceDocuments: sources, side: "expenditure", year: 2025 });

    expect(model.totalGel).toBe(500);
    expect(model.previousYear).toBe(2024);
    expect(model.items.map((item) => item.itemId)).toEqual(["spending.education", "spending.health", "spending.defence"]);
    expect(model.items[0]?.shareOfTotal).toBe(0.5);
    expect(model.items.find((item) => item.itemId === "spending.health")?.changeFromPreviousYear).toBe(0.5);
    expect(model.headlineCards.map((card) => card.id)).toEqual(["total", "largest", "fastest_growth", "largest_increase"]);
    expect(model.emptyReason).toBeNull();
  });

  it("rounds Every 100 GEL to exactly 100", () => {
    const model = buildSingleYearSnapshotModel({ facts, glossary, sourceDocuments: sources, side: "expenditure", year: 2025 });

    expect(model.every100.reduce((sum, item) => sum + item.gelFrom100, 0)).toBe(100);
  });

  it("marks growth unavailable when there is no previous available year", () => {
    const model = buildSingleYearSnapshotModel({ facts, glossary, sourceDocuments: sources, side: "expenditure", year: 2024 });

    expect(model.previousYear).toBeNull();
    expect(model.hasGrowthData).toBe(false);
    expect(model.items.every((item) => item.changeFromPreviousYear === null)).toBe(true);
  });

  it("returns a Georgian empty state when selected side has no data", () => {
    const model = buildSingleYearSnapshotModel({ facts, glossary, sourceDocuments: sources, side: "revenue", year: 2025 });

    expect(model.items).toEqual([]);
    expect(model.emptyReason).toBe("ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული.");
  });
});
```

- [ ] **Step 3: Verify the new test fails for the right reason**

Run:

```powershell
cd apps/web
npm run test -- tests/explorer/singleYear.test.ts
```

Expected:

```text
Cannot find module '../../lib/explorer/singleYear'
```

Do not commit the failing test state.

## Task 2: Implement `buildSingleYearSnapshotModel`

**Files:**

- Create: `apps/web/lib/explorer/singleYear.ts`
- Test: `apps/web/tests/explorer/singleYear.test.ts`

- [ ] **Step 1: Implement the model**

Create `apps/web/lib/explorer/singleYear.ts`.

Required exports:

```ts
export type SingleYearSnapshotInput = {
  facts: BudgetFactImportRow[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
  side: ExplorerSide;
  year: number;
};

export function buildSingleYearSnapshotModel(input: SingleYearSnapshotInput): SingleYearSnapshotModel;
```

Implementation requirements:

- Use `chooseActivePublicFacts(input.facts)` before filtering.
- Filter by `input.side` and `input.year`.
- Use the closest previous year with facts for the same side.
- Use the existing `formatGel`, `formatPercent`, and `formatSignedPercent` helpers for headline display strings.
- Use the same palette values as `apps/web/lib/explorer/explorerData.ts` unless that palette is exported later.
- Build source metadata with the same behavior as `explorerData.ts`: one source keeps its source name, multiple sources use `Multiple reviewed official sources`, source files are joined with `; `, and `lastReviewedAt` is the latest source date.
- Use Georgian empty states:
  - Revenue: `ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული.`
  - Expenditure: `ამ წლისთვის ხარჯების მონაცემები ჯერ არ არის ჩატვირთული.`
- `headlineCards` must contain exactly four cards:
  - `total`
  - `largest`
  - `fastest_growth`
  - `largest_increase`
- `every100` must allocate rounding remainders by largest fractional remainder so the displayed whole-GEL values sum to exactly `100`.
- `petals` must include all items when there are 8 or fewer items. When there are more than 8, use top 7 plus `snapshot.other`.

- [ ] **Step 2: Run model tests**

Run:

```powershell
cd apps/web
npm run test -- tests/explorer/singleYear.test.ts
```

Expected:

```text
4 passed
```

- [ ] **Step 3: Commit passing model work**

Run:

```powershell
git add apps/web/lib/explorer/types.ts apps/web/lib/explorer/singleYear.ts apps/web/tests/explorer/singleYear.test.ts
git commit -m "feat: add single year snapshot model"
```

Expected:

```text
[branch ...] feat: add single year snapshot model
```

## Task 3: Add Real-Data Integration Coverage

**Files:**

- Modify: `apps/web/tests/explorer/integration.test.ts`

- [ ] **Step 1: Add real CSV snapshot integration tests**

Append tests that load `../../data/imports/budget-facts-2023-2025.csv` and assert:

```ts
it("builds a non-empty single-year expenditure snapshot from real facts", async () => {
  const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
  const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
  const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
  const model = buildSingleYearSnapshotModel({
    facts,
    glossary,
    sourceDocuments,
    side: "expenditure",
    year: 2025,
  });

  expect(model.emptyReason).toBeNull();
  expect(model.totalGel).toBeGreaterThan(0);
  expect(model.items.length).toBeGreaterThan(5);
  expect(model.every100.reduce((sum, item) => sum + item.gelFrom100, 0)).toBe(100);
  expect(model.rankingRows[0]?.amountGel).toBeGreaterThanOrEqual(model.rankingRows[1]?.amountGel ?? 0);
});

it("returns a revenue empty state for current real facts", async () => {
  const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
  const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
  const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
  const model = buildSingleYearSnapshotModel({
    facts,
    glossary,
    sourceDocuments,
    side: "revenue",
    year: 2025,
  });

  expect(model.items).toEqual([]);
  expect(model.emptyReason).toBe("ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული.");
});
```

Import `buildSingleYearSnapshotModel` at the top of the file.

- [ ] **Step 2: Run explorer tests**

Run:

```powershell
cd apps/web
npm run test -- tests/explorer
```

Expected:

```text
Test Files ... passed
```

- [ ] **Step 3: Commit integration coverage**

Run:

```powershell
git add apps/web/tests/explorer/integration.test.ts
git commit -m "test: cover real single year snapshot data"
```

Expected:

```text
[branch ...] test: cover real single year snapshot data
```

## Task 4: Add View Mode and Single-Year Controls

**Files:**

- Modify: `apps/web/components/main-explorer/explorer-controls.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`

- [ ] **Step 1: Extend `ExplorerControls` props**

Add `ViewMode` to the imports and add these props:

```ts
viewMode: ViewMode;
singleYear: number;
onViewModeChange: (mode: ViewMode) => void;
onSingleYearChange: (year: number) => void;
```

- [ ] **Step 2: Add view-mode buttons**

Add a `ხედი` control with two buttons:

- `მრავალწლიანი` -> `multi_year`
- `ერთი წელი` -> `single_year`

Acceptance criteria:

- The active view button uses the same active visual treatment as the existing side buttons.
- Switching views does not reset selected side.
- Switching to `single_year` does not mutate multi-year range state.

- [ ] **Step 3: Make controls mode-aware**

When `viewMode === "multi_year"`:

- Show chart mode buttons.
- Show measure selector.
- Show range or bar-year controls exactly as the app does today.
- Show CSV export in `MainExplorer`.

When `viewMode === "single_year"`:

- Hide chart mode buttons.
- Hide measure selector.
- Hide start/end range controls.
- Show one year selector labeled `წელი`.
- Hide CSV export for now. CSV export stays a multi-year/table feature until a later snapshot-export plan.

- [ ] **Step 4: Add state in `MainExplorer`**

Add:

```ts
const [viewMode, setViewMode] = useState<ViewMode>("multi_year");
const [singleYear, setSingleYear] = useState(initialEndYear);
```

Pass `viewMode`, `singleYear`, `setViewMode`, and `setSingleYear` into `ExplorerControls`.

- [ ] **Step 5: Run build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 6: Commit controls**

Run:

```powershell
git add apps/web/components/main-explorer/explorer-controls.tsx apps/web/components/main-explorer/main-explorer.tsx
git commit -m "feat: add single year view controls"
```

Expected:

```text
[branch ...] feat: add single year view controls
```

## Task 5: Add Snapshot Shell and Headline Cards

**Files:**

- Create: `apps/web/components/single-year/single-year-snapshot.tsx`
- Create: `apps/web/components/single-year/snapshot-headline-cards.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`

- [ ] **Step 1: Create `SnapshotHeadlineCards`**

Create a presentational component that accepts:

```ts
type SnapshotHeadlineCardsProps = {
  cards: SnapshotHeadline[];
};
```

Acceptance criteria:

- Render exactly one card per `cards` item.
- Use compact panel styling consistent with `PeriodSummaryPanel`.
- Use `card.id` as key, not display text.
- No hard-coded numbers inside the component.

- [ ] **Step 2: Create `SingleYearSnapshot` shell**

Create a client-compatible component with:

```ts
type SingleYearSnapshotProps = {
  model: SingleYearSnapshotModel;
};
```

Acceptance criteria:

- If `model.emptyReason` exists, render only a bordered amber empty state.
- Otherwise render header plus the headline cards.
- Header copy:
  - Title: `${model.year} წლის ბიუჯეტის სურათი`
  - Eyebrow: `Single-year snapshot`
  - Expenditure subtitle: `სად მიდის საჯარო ფული`
  - Revenue subtitle: `საიდან მოდის საჯარო ფული`
- If `model.hasPlannedValues`, show a small `გეგმური ბიუჯეტი` badge near the title.
- Add `data-testid="single-year-snapshot"` to the root non-empty section.

- [ ] **Step 3: Wire model and shell into `MainExplorer`**

Add:

```ts
const singleYearModel = buildSingleYearSnapshotModel({
  facts,
  glossary,
  sourceDocuments,
  side,
  year: singleYear,
});
```

Render rules:

- If `viewMode === "single_year"`, render `<SingleYearSnapshot model={singleYearModel} />`.
- If `viewMode === "multi_year"`, keep the existing chart/table/unavailable behavior.
- Hide `SeriesSelector` in single-year mode.
- Hide `PeriodSummaryPanel` in single-year mode.
- Use a one-column main content layout in single-year mode so the removed sidebar does not leave awkward empty space.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
cd apps/web
npm run test -- tests/explorer/singleYear.test.ts tests/explorer/integration.test.ts
npm run build
```

Expected:

```text
Tests passed
Compiled successfully
```

- [ ] **Step 5: Commit shell**

Run:

```powershell
git add apps/web/components/main-explorer/main-explorer.tsx apps/web/components/single-year apps/web/lib/explorer/singleYear.ts
git commit -m "feat: render single year snapshot shell"
```

Expected:

```text
[branch ...] feat: render single year snapshot shell
```

## Task 6: Add Treemap and Every 100 GEL

**Files:**

- Create: `apps/web/components/single-year/snapshot-treemap.tsx`
- Create: `apps/web/components/single-year/every-100-gel.tsx`
- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`

- [ ] **Step 1: Create `SnapshotTreemap`**

Use Recharts `ResponsiveContainer` and `Treemap`.

Acceptance criteria:

- Props: `{ items: SnapshotItem[] }`.
- Section heading: `ბიუჯეტის რუკა`.
- Add `data-testid="snapshot-treemap"`.
- Size rectangles by `amountGel`.
- Show labels only when the rectangle is wide and tall enough.
- Tooltip shows item label, formatted GEL amount, and formatted share.
- Do not add click handlers or links.
- Follow `ChartFrame` sizing style: fixed chart height, `ResponsiveContainer`, dark tooltip styling.

- [ ] **Step 2: Create `Every100Gel`**

Acceptance criteria:

- Props: `{ items: Every100Item[]; side: ExplorerSide }`.
- Section heading: `ყოველი 100 GEL`.
- Add `data-testid="every-100-gel"`.
- Render a stable 10x10 grid of exactly 100 cells.
- Each cell color comes from its item.
- Legend rows show item label and whole-GEL amount.
- The component must not calculate rounding; it trusts `model.every100`.

- [ ] **Step 3: Render sections in order**

In `SingleYearSnapshot`, render after headline cards:

```tsx
<SnapshotTreemap items={model.items} />
<Every100Gel items={model.every100} side={model.side} />
```

- [ ] **Step 4: Run build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Commit composition visuals**

Run:

```powershell
git add apps/web/components/single-year
git commit -m "feat: add snapshot composition visuals"
```

Expected:

```text
[branch ...] feat: add snapshot composition visuals
```

## Task 7: Add Spending Petals and Budget Field

**Files:**

- Create: `apps/web/components/single-year/spending-petals.tsx`
- Create: `apps/web/components/single-year/budget-field.tsx`
- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`

- [ ] **Step 1: Create `SpendingPetals`**

Acceptance criteria:

- Props: `{ items: SnapshotItem[] }`.
- Section heading: `ხარჯების ფურცლები`.
- Add `data-testid="spending-petals"`.
- Render all `items` received from `model.petals`. Do not slice again inside the component.
- The last item may be `snapshot.other`; render it like every other item.
- Petal size is proportional to `shareOfTotal`.
- Include SVG `<title>` for hover detail.
- No click handlers or links.

- [ ] **Step 2: Create `BudgetField`**

Use Recharts `ScatterChart`, `Scatter`, `XAxis`, `YAxis`, `ZAxis`, `Tooltip`, `Cell`, and `ResponsiveContainer`.

Acceptance criteria:

- Props: `{ items: SnapshotItem[]; hasGrowthData: boolean }`.
- Section heading: `Budget Field`.
- Add `data-testid="budget-field"`.
- If `hasGrowthData` is false, render a clear amber state: `ზრდის საჩვენებლად წინა ხელმისაწვდომი წელი საჭიროა.`
- x-axis is `shareOfTotal`.
- y-axis is `changeFromPreviousYear`.
- bubble size is `amountGel`.
- per-point color uses Recharts `Cell`, following the local `ChartFrame` bar color pattern.
- Tooltip shows item label, formatted GEL, share, and growth.
- Wrap the chart in an overflow container from the parent so mobile can scroll horizontally.

- [ ] **Step 3: Render sections in order**

In `SingleYearSnapshot`, render after Every 100 GEL:

```tsx
<SpendingPetals items={model.petals} />
<div className="overflow-x-auto">
  <BudgetField items={model.items} hasGrowthData={model.hasGrowthData} />
</div>
```

- [ ] **Step 4: Run build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Commit advanced visuals**

Run:

```powershell
git add apps/web/components/single-year
git commit -m "feat: add snapshot field visuals"
```

Expected:

```text
[branch ...] feat: add snapshot field visuals
```

## Task 8: Add Full Ranking

**Files:**

- Create: `apps/web/components/single-year/single-year-ranking.tsx`
- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`

- [ ] **Step 1: Create `SingleYearRanking`**

Acceptance criteria:

- Props: `{ rows: SnapshotItem[] }`.
- Section heading: `სრული რეიტინგი`.
- Add `data-testid="single-year-ranking"`.
- Default sort is `amountGel` descending.
- User can sort by amount, share, or change.
- Table columns: `Rank`, `მუხლი`, `GEL`, `წილი`, `ცვლილება`.
- Use existing formatters.
- Do not render official programs, subprograms, source columns, or drilldown links.

- [ ] **Step 2: Render ranking last**

In `SingleYearSnapshot`, render after Budget Field:

```tsx
<SingleYearRanking rows={model.rankingRows} />
```

- [ ] **Step 3: Run build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 4: Commit ranking**

Run:

```powershell
git add apps/web/components/single-year
git commit -m "feat: add single year ranking"
```

Expected:

```text
[branch ...] feat: add single year ranking
```

## Task 9: Add Browser Coverage

**Files:**

- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add a single-year browser test**

Add one test that:

- Opens `http://localhost:3100`.
- Clicks the `ერთი წელი` button.
- Verifies `data-testid="single-year-snapshot"` is visible.
- Verifies these section test IDs are visible:
  - `snapshot-treemap`
  - `every-100-gel`
  - `spending-petals`
  - `budget-field`
  - `single-year-ranking`
- Changes year to the earliest available year and verifies the Budget Field growth-unavailable state is visible.
- Switches side to revenue and verifies the Georgian revenue empty state.
- Fails on browser console errors or warnings, matching the existing test pattern.

Do not assert raw SVG counts.

- [ ] **Step 2: Run browser tests**

Run:

```powershell
cd apps/web
npm run test:browser
```

Expected:

```text
passed
```

If Playwright or the dev server fails with Windows sandbox `EPERM`, rerun with Codex escalation.

- [ ] **Step 3: Commit browser coverage**

Run:

```powershell
git add apps/web/tests/browser/main-explorer.spec.ts
git commit -m "test: cover single year snapshot browser flow"
```

Expected:

```text
[branch ...] test: cover single year snapshot browser flow
```

## Final Verification

Before marking Plan 4 implemented, run:

```powershell
cd apps/web
npm run test
npm run data:validate
npm run build
npm run test:browser
```

Expected:

```text
All Vitest tests pass
Validated fact rows: 39
Compiled successfully
Playwright tests pass
```

Manual browser check at `http://localhost:3100`:

- Default view remains multi-year expenditure.
- `ერთი წელი` opens the single-year snapshot.
- Single-year sections appear in this order:
  1. headline cards
  2. treemap
  3. Every 100 GEL
  4. spending petals
  5. Budget Field
  6. full ranking
- Year selector changes the snapshot year.
- Revenue side shows a clean empty state.
- No drilldown links appear.
- Every 100 GEL renders exactly 100 cells.
- Earliest year shows Budget Field growth-unavailable state.
- Mobile viewport stacks sections vertically and keeps Budget Field horizontally scrollable.
- Georgian text is readable and does not overlap.

## Self-Review

Spec coverage:

- Covered: single-year mode, headline cards, treemap, Every 100 GEL, petals, Budget Field, full ranking, planned badge support, revenue empty state, mobile stacking, no drilldown.
- Deferred by explicit scope: revenue ingestion, data outside the 2023-2025 v1 window, stacked mode, Share of GDP, source/provenance panels.

Execution clarity:

- Every task has exact files, checks, and commit points.
- Tests are added before implementation, but failing states are not committed.
- Browser tests use stable `data-testid` markers instead of fragile SVG counts.
- The plan follows existing app ownership: `MainExplorer` owns state; `singleYear.ts` owns data derivation; components render only.

Risk controls:

- No data pipeline files are modified.
- Revenue absence is handled as an empty state, not as a fake dataset.
- Known Windows EPERM behavior is documented in verification.
- Recharts usage follows existing local patterns from `ChartFrame`.
