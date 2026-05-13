# GeoData.ge Single-Year Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the GeoData.ge v1 single-year budget snapshot view for real expenditure data: headline cards, treemap, Every 100 GEL, spending petals, Budget Field, and full ranking.

**Architecture:** Reuse the existing validated budget facts, glossary, source metadata, and dark analytical UI shell. Add a focused single-year data model in `lib/explorer/singleYear.ts`, then render it through small client components under `components/single-year/*`. The existing `MainExplorer` becomes the state owner for side, view mode, and selected year; no data ingestion changes are included.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind 4, Recharts 3, Vitest, Playwright.

---

## Scope

Included:

- Add a `ViewMode` switch: `multi_year` and `single_year`.
- Keep the default first view as multi-year expenditure.
- Add a single-year selector using the existing real data years.
- Render single-year expenditure snapshot from `data/imports/budget-facts-2023-2025.csv`.
- Keep the single-year view top-level only: public spending fields, no programs, subprograms, or clickable drilldown.
- Render, in order:
  1. Year headline cards.
  2. Treemap.
  3. Every 100 GEL.
  4. Spending petals.
  5. Budget Field.
  6. Full ranking.
- Support the existing side switch. If revenue has no facts, show a clean Georgian empty state in single-year mode.
- Preserve the minimal public source label and planned badge behavior if planned facts exist later.
- Add unit tests for all snapshot calculations.
- Add browser coverage for switching to single-year mode and seeing the six sections.

Excluded:

- Revenue ingestion.
- 2026 planned budget ingestion.
- Stacked mode.
- Share of GDP.
- Public provenance panels.
- Drilldown/detail pages.
- Supabase reads or database insert.

## Source Documents

Read before executing:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- `docs/superpowers/plans/2026-05-11-geodata-main-explorer-ui.md`
- `docs/superpowers/plans/2026-05-12-geodata-real-expenditure-data.md`

## Current Baseline

The current app already has:

- `MainExplorer` as the client state owner.
- `ExplorerControls`, `ChartFrame`, `ExplorerTable`, `SeriesSelector`, and `PeriodSummaryPanel`.
- Real expenditure facts for 2023-2025.
- `buildExplorerModel` for multi-year line, bar, table, CSV, and period summary.
- Recharts installed.
- Browser tests at `apps/web/tests/browser/main-explorer.spec.ts`.

Plan 4 should not change the real expenditure pipeline except to rely on its generated facts.

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
apps/web/tests/browser/main-explorer.spec.ts
```

Responsibilities:

- `singleYear.ts`: pure data model for the snapshot.
- `single-year-snapshot.tsx`: section composition and no-data state.
- `snapshot-headline-cards.tsx`: four-card headline block.
- `snapshot-treemap.tsx`: Recharts treemap for top-level composition.
- `every-100-gel.tsx`: rounded whole-GEL distribution that sums to 100.
- `spending-petals.tsx`: expressive SVG composition visual, top 7 plus Other.
- `budget-field.tsx`: Recharts scatter plot for share vs growth.
- `single-year-ranking.tsx`: sortable top-level ranking.
- `explorer-controls.tsx`: add view-mode and single-year controls.
- `main-explorer.tsx`: switch between multi-year explorer and single-year snapshot.

---

### Task 1: Add View Mode Types and Single-Year Model Tests

**Files:**

- Modify: `apps/web/lib/explorer/types.ts`
- Create: `apps/web/tests/explorer/singleYear.test.ts`

- [ ] **Step 1: Extend shared explorer types**

Modify `apps/web/lib/explorer/types.ts` by adding:

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

- [ ] **Step 2: Write failing single-year tests**

Create `apps/web/tests/explorer/singleYear.test.ts`:

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
  it("builds total, shares, previous-year growth, and headline cards", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      sourceDocuments: sources,
      side: "expenditure",
      year: 2025,
    });

    expect(model.totalGel).toBe(500);
    expect(model.previousYear).toBe(2024);
    expect(model.hasGrowthData).toBe(true);
    expect(model.items.map((item) => item.itemId)).toEqual([
      "spending.education",
      "spending.health",
      "spending.defence",
    ]);
    expect(model.items[0]?.shareOfTotal).toBe(0.5);
    expect(model.items.find((item) => item.itemId === "spending.health")?.changeFromPreviousYear).toBe(0.5);
    expect(model.headlineCards).toHaveLength(4);
    expect(model.emptyReason).toBeNull();
  });

  it("rounds Every 100 GEL rows so the total is exactly 100", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      sourceDocuments: sources,
      side: "expenditure",
      year: 2025,
    });

    expect(model.every100.reduce((sum, item) => sum + item.gelFrom100, 0)).toBe(100);
    expect(model.every100[0]).toEqual(
      expect.objectContaining({
        itemId: "spending.education",
        gelFrom100: 50,
      }),
    );
  });

  it("returns growth unavailable when there is no previous available year", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      sourceDocuments: sources,
      side: "expenditure",
      year: 2024,
    });

    expect(model.previousYear).toBeNull();
    expect(model.hasGrowthData).toBe(false);
    expect(model.items.every((item) => item.changeFromPreviousYear === null)).toBe(true);
  });

  it("returns a Georgian empty state when the selected side has no rows", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      sourceDocuments: sources,
      side: "revenue",
      year: 2025,
    });

    expect(model.items).toEqual([]);
    expect(model.emptyReason).toBe("ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული.");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```powershell
cd apps/web
npm run test -- tests/explorer/singleYear.test.ts
```

Expected:

```text
Cannot find module '../../lib/explorer/singleYear'
```

- [ ] **Step 4: Commit the failing test and type expansion**

Run:

```powershell
git add apps/web/lib/explorer/types.ts apps/web/tests/explorer/singleYear.test.ts
git commit -m "test: define single year snapshot model"
```

Expected:

```text
[branch ...] test: define single year snapshot model
```

---

### Task 2: Implement Single-Year Snapshot Data Model

**Files:**

- Create: `apps/web/lib/explorer/singleYear.ts`
- Test: `apps/web/tests/explorer/singleYear.test.ts`

- [ ] **Step 1: Add the pure snapshot model**

Create `apps/web/lib/explorer/singleYear.ts`:

```ts
import type { GlossaryEntry } from "../data/glossary";
import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import type { SourceDocumentRow } from "../data/sources";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { formatGel, formatPercent, formatSignedPercent } from "./format";
import type {
  Every100Item,
  ExplorerSide,
  SingleYearSnapshotModel,
  SnapshotItem,
  SourceMetadata,
} from "./types";

const palette = [
  "#22d3ee",
  "#a3e635",
  "#f97316",
  "#f472b6",
  "#c084fc",
  "#facc15",
  "#38bdf8",
  "#fb7185",
  "#14b8a6",
  "#e879f9",
  "#84cc16",
  "#f43f5e",
];

export type SingleYearSnapshotInput = {
  facts: BudgetFactImportRow[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
  side: ExplorerSide;
  year: number;
};

function emptyReasonFor(side: ExplorerSide): string {
  return side === "revenue"
    ? "ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული."
    : "ამ წლისთვის ხარჯების მონაცემები ჯერ არ არის ჩატვირთული.";
}

function sourceMetadataFor(sourceIds: string[], sourceDocuments: SourceDocumentRow[]): SourceMetadata {
  const byId = new Map(sourceDocuments.map((source) => [source.sourceId, source]));
  const rows = sourceIds
    .map((sourceId) => byId.get(sourceId))
    .filter((source): source is SourceDocumentRow => Boolean(source));
  const uniqueNames = Array.from(new Set(rows.map((source) => source.sourceName)));
  const uniqueFiles = Array.from(new Set(rows.map((source) => source.sourceUrlOrFile)));

  return {
    sourceName: sourceIds.length === 1 ? uniqueNames[0] ?? "" : "Multiple reviewed official sources",
    sourceUrlOrFile: uniqueFiles.join("; "),
    lastReviewedAt: rows.map((source) => source.lastReviewedAt).sort().at(-1) ?? "",
  };
}

function labelsFor(itemId: string, glossary: Map<string, GlossaryEntry>) {
  const entry = glossary.get(itemId);
  return {
    kaLabel: entry?.kaLabel ?? itemId,
    enLabel: entry?.enLabel ?? itemId,
  };
}

function previousYearFor(facts: BudgetFactImportRow[], side: ExplorerSide, year: number): number | null {
  return Array.from(new Set(facts.filter((fact) => fact.side === side && fact.year < year).map((fact) => fact.year)))
    .sort((a, b) => b - a)[0] ?? null;
}

function buildEvery100(items: SnapshotItem[]): Every100Item[] {
  const base = items.map((item) => {
    const exact = item.shareOfTotal * 100;
    return {
      item,
      whole: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let remaining = 100 - base.reduce((sum, row) => sum + row.whole, 0);
  const byRemainder = [...base].sort((a, b) => b.remainder - a.remainder);

  for (const row of byRemainder) {
    if (remaining <= 0) break;
    row.whole += 1;
    remaining -= 1;
  }

  return base
    .filter((row) => row.whole > 0)
    .map((row) => ({
      itemId: row.item.itemId,
      kaLabel: row.item.kaLabel,
      enLabel: row.item.enLabel,
      color: row.item.color,
      gelFrom100: row.whole,
      exactShare: row.item.shareOfTotal,
    }));
}

function buildPetals(items: SnapshotItem[]): SnapshotItem[] {
  if (items.length <= 8) return items;

  const visible = items.slice(0, 7);
  const rest = items.slice(7);
  const otherAmountGel = rest.reduce((sum, item) => sum + item.amountGel, 0);
  const otherPreviousAmountGel = rest.reduce((sum, item) => sum + (item.previousAmountGel ?? 0), 0);
  const fallbackSource = visible[0]?.source ?? rest[0]?.source;

  if (!fallbackSource) return visible;

  return [
    ...visible,
    {
      itemId: "snapshot.other",
      kaLabel: "სხვა",
      enLabel: "Other",
      color: "#71717a",
      amountGel: otherAmountGel,
      shareOfTotal: rest.reduce((sum, item) => sum + item.shareOfTotal, 0),
      previousAmountGel: otherPreviousAmountGel === 0 ? null : otherPreviousAmountGel,
      changeFromPreviousYear:
        otherPreviousAmountGel === 0 ? null : (otherAmountGel - otherPreviousAmountGel) / otherPreviousAmountGel,
      amountChangeFromPreviousYear:
        otherPreviousAmountGel === 0 ? null : otherAmountGel - otherPreviousAmountGel,
      basis: rest.some((item) => item.basis === "planned") ? "planned" : "actual",
      source: fallbackSource,
    },
  ];
}

export function buildSingleYearSnapshotModel(input: SingleYearSnapshotInput): SingleYearSnapshotModel {
  const activeFacts = chooseActivePublicFacts(input.facts);
  const sideFacts = activeFacts.filter((fact) => fact.side === input.side);
  const yearFacts = sideFacts.filter((fact) => fact.year === input.year);
  const previousYear = previousYearFor(activeFacts, input.side, input.year);
  const previousFacts = previousYear === null ? [] : sideFacts.filter((fact) => fact.year === previousYear);
  const previousByItem = new Map(previousFacts.map((fact) => [fact.itemId, fact]));
  const totalGel = yearFacts.reduce((sum, fact) => sum + fact.amountGel, 0);
  const totalPreviousGel = previousFacts.reduce((sum, fact) => sum + fact.amountGel, 0);

  if (yearFacts.length === 0 || totalGel === 0) {
    return {
      side: input.side,
      year: input.year,
      previousYear,
      totalGel: 0,
      basis: "actual",
      hasPlannedValues: false,
      source: null,
      headlineCards: [],
      items: [],
      every100: [],
      petals: [],
      rankingRows: [],
      hasGrowthData: false,
      emptyReason: emptyReasonFor(input.side),
    };
  }

  const items = yearFacts
    .map((fact, index): SnapshotItem => {
      const previousAmountGel = previousByItem.get(fact.itemId)?.amountGel ?? null;
      const changeFromPreviousYear =
        previousAmountGel === null || previousAmountGel === 0
          ? null
          : (fact.amountGel - previousAmountGel) / previousAmountGel;

      return {
        itemId: fact.itemId,
        ...labelsFor(fact.itemId, input.glossary),
        color: palette[index % palette.length] ?? "#22d3ee",
        amountGel: fact.amountGel,
        shareOfTotal: fact.amountGel / totalGel,
        previousAmountGel,
        changeFromPreviousYear,
        amountChangeFromPreviousYear: previousAmountGel === null ? null : fact.amountGel - previousAmountGel,
        basis: fact.basis,
        source: sourceMetadataFor([fact.sourceId], input.sourceDocuments),
      };
    })
    .sort((a, b) => b.amountGel - a.amountGel);

  const largest = items[0] ?? null;
  const growthItems = items.filter((item) => item.changeFromPreviousYear !== null);
  const fastestGrowth = [...growthItems].sort((a, b) => (b.changeFromPreviousYear ?? -Infinity) - (a.changeFromPreviousYear ?? -Infinity))[0] ?? null;
  const largestIncrease = [...items].sort((a, b) => (b.amountChangeFromPreviousYear ?? -Infinity) - (a.amountChangeFromPreviousYear ?? -Infinity))[0] ?? null;
  const totalChange = previousYear === null || totalPreviousGel === 0 ? null : (totalGel - totalPreviousGel) / totalPreviousGel;
  const source = sourceMetadataFor(yearFacts.map((fact) => fact.sourceId), input.sourceDocuments);
  const sideNoun = input.side === "revenue" ? "შემოსავალი" : "ხარჯი";

  return {
    side: input.side,
    year: input.year,
    previousYear,
    totalGel,
    basis: yearFacts.some((fact) => fact.basis === "planned") ? "planned" : "actual",
    hasPlannedValues: yearFacts.some((fact) => fact.basis === "planned"),
    source,
    headlineCards: [
      { label: `${sideNoun} სულ`, value: formatGel(totalGel), detail: totalChange === null ? "წინა წელი არ არის ხელმისაწვდომი" : `${formatSignedPercent(totalChange)} წინა ხელმისაწვდომ წელთან` },
      { label: "ყველაზე დიდი მუხლი", value: largest?.kaLabel ?? "n/a", detail: largest ? formatPercent(largest.shareOfTotal) : "n/a" },
      { label: "ყველაზე სწრაფი ზრდა", value: fastestGrowth?.kaLabel ?? "n/a", detail: fastestGrowth ? formatSignedPercent(fastestGrowth.changeFromPreviousYear) : "ზრდა მიუწვდომელია" },
      { label: "ყველაზე დიდი GEL მატება", value: largestIncrease?.kaLabel ?? "n/a", detail: largestIncrease?.amountChangeFromPreviousYear === null || largestIncrease === null ? "ზრდა მიუწვდომელია" : formatGel(largestIncrease.amountChangeFromPreviousYear) },
    ],
    items,
    every100: buildEvery100(items),
    petals: buildPetals(items),
    rankingRows: items,
    hasGrowthData: previousYear !== null && growthItems.length > 0,
    emptyReason: null,
  };
}
```

- [ ] **Step 2: Run single-year tests**

Run:

```powershell
cd apps/web
npm run test -- tests/explorer/singleYear.test.ts
```

Expected:

```text
4 passed
```

- [ ] **Step 3: Commit the data model**

Run:

```powershell
git add apps/web/lib/explorer/singleYear.ts apps/web/tests/explorer/singleYear.test.ts
git commit -m "feat: build single year snapshot model"
```

Expected:

```text
[branch ...] feat: build single year snapshot model
```

---

### Task 3: Add Single-Year Controls to the Explorer Shell

**Files:**

- Modify: `apps/web/components/main-explorer/explorer-controls.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`

- [ ] **Step 1: Update control props**

Modify the props in `apps/web/components/main-explorer/explorer-controls.tsx` to include:

```ts
import type { ChartMode, ExplorerSide, MeasureMode, ViewMode } from "../../lib/explorer/types";

type ExplorerControlsProps = {
  side: ExplorerSide;
  viewMode: ViewMode;
  chartMode: ChartMode;
  measure: MeasureMode;
  years: number[];
  startYear: number;
  endYear: number;
  barYear: number;
  singleYear: number;
  onSideChange: (side: ExplorerSide) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onChartModeChange: (mode: ChartMode) => void;
  onMeasureChange: (measure: MeasureMode) => void;
  onStartYearChange: (year: number) => void;
  onEndYearChange: (year: number) => void;
  onBarYearChange: (year: number) => void;
  onSingleYearChange: (year: number) => void;
};
```

- [ ] **Step 2: Add Georgian view-mode control**

Inside `ExplorerControls`, render this segmented control after the side switch:

```tsx
<div className="flex flex-col gap-2">
  <span className="font-mono text-xs uppercase text-zinc-500">ხედი</span>
  <div className="flex flex-wrap gap-2">
    {[
      ["multi_year", "მრავალწლიანი"],
      ["single_year", "ერთი წელი"],
    ].map(([nextMode, label]) => (
      <button
        key={nextMode}
        type="button"
        onClick={() => onViewModeChange(nextMode as ViewMode)}
        className={`h-9 border px-3 text-sm ${
          viewMode === nextMode
            ? "border-cyan-300 bg-cyan-300 text-black"
            : "border-zinc-700 bg-black text-zinc-300 hover:border-cyan-300"
        }`}
      >
        {label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Render only relevant year controls**

Keep the existing chart-mode and measure controls visible only for `viewMode === "multi_year"`. Add this single-year select for `viewMode === "single_year"`:

```tsx
{viewMode === "single_year" ? (
  <label className="flex flex-col gap-2 text-sm text-zinc-300">
    <span className="font-mono text-xs uppercase text-zinc-500">წელი</span>
    <select
      value={singleYear}
      onChange={(event) => onSingleYearChange(Number(event.target.value))}
      className="h-10 border border-zinc-700 bg-black px-3 text-zinc-100"
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  </label>
) : null}
```

- [ ] **Step 4: Add state in `MainExplorer`**

Modify `apps/web/components/main-explorer/main-explorer.tsx` imports:

```ts
import { MAX_CHART_SERIES, type ChartMode, type ExplorerSide, type MeasureMode, type ViewMode } from "../../lib/explorer/types";
```

Add state beside existing chart mode state:

```ts
const [viewMode, setViewMode] = useState<ViewMode>("multi_year");
const [singleYear, setSingleYear] = useState(initialEndYear);
```

Pass the new props to `ExplorerControls`:

```tsx
<ExplorerControls
  side={side}
  viewMode={viewMode}
  chartMode={chartMode}
  measure={measure}
  years={allYears}
  startYear={startYear}
  endYear={endYear}
  barYear={barYear}
  singleYear={singleYear}
  onSideChange={setSide}
  onViewModeChange={setViewMode}
  onChartModeChange={handleChartModeChange}
  onMeasureChange={setMeasure}
  onStartYearChange={handleStartYearChange}
  onEndYearChange={handleEndYearChange}
  onBarYearChange={setBarYear}
  onSingleYearChange={setSingleYear}
/>
```

- [ ] **Step 5: Run type and build checks**

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
git add apps/web/components/main-explorer/explorer-controls.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/lib/explorer/types.ts
git commit -m "feat: add single year explorer controls"
```

Expected:

```text
[branch ...] feat: add single year explorer controls
```

---

### Task 4: Render Headline Cards and Full Snapshot Shell

**Files:**

- Create: `apps/web/components/single-year/single-year-snapshot.tsx`
- Create: `apps/web/components/single-year/snapshot-headline-cards.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`

- [ ] **Step 1: Create headline cards component**

Create `apps/web/components/single-year/snapshot-headline-cards.tsx`:

```tsx
import type { SnapshotHeadline } from "../../lib/explorer/types";

type SnapshotHeadlineCardsProps = {
  cards: SnapshotHeadline[];
};

export function SnapshotHeadlineCards({ cards }: SnapshotHeadlineCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="border border-cyan-400/20 bg-black/40 p-4">
          <p className="font-mono text-xs uppercase text-zinc-500">{card.label}</p>
          <p className="mt-2 text-lg font-semibold text-white">{card.value}</p>
          <p className="mt-1 text-sm text-zinc-400">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create snapshot shell**

Create `apps/web/components/single-year/single-year-snapshot.tsx`:

```tsx
import type { SingleYearSnapshotModel } from "../../lib/explorer/types";
import { SnapshotHeadlineCards } from "./snapshot-headline-cards";

type SingleYearSnapshotProps = {
  model: SingleYearSnapshotModel;
};

export function SingleYearSnapshot({ model }: SingleYearSnapshotProps) {
  if (model.emptyReason) {
    return (
      <section className="border border-amber-300/30 bg-amber-300/10 p-6 text-sm text-amber-100">
        {model.emptyReason}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="border border-cyan-400/20 bg-black/50 p-4">
        <p className="font-mono text-xs uppercase text-cyan-200">Single-year snapshot</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold text-white">{model.year} წლის ბიუჯეტის სურათი</h2>
          {model.hasPlannedValues ? (
            <span className="border border-amber-300/40 px-2 py-1 text-xs text-amber-100">გეგმური ბიუჯეტი</span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          {model.side === "revenue" ? "საიდან მოდის საჯარო ფული" : "სად მიდის საჯარო ფული"}
        </p>
      </header>

      <SnapshotHeadlineCards cards={model.headlineCards} />
    </section>
  );
}
```

- [ ] **Step 3: Wire snapshot shell into `MainExplorer`**

Modify `apps/web/components/main-explorer/main-explorer.tsx` imports:

```ts
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";
import { SingleYearSnapshot } from "../single-year/single-year-snapshot";
```

Add the model:

```ts
const singleYearModel = buildSingleYearSnapshotModel({
  facts,
  glossary,
  sourceDocuments,
  side,
  year: singleYear,
});
```

Replace the chart/table block with:

```tsx
{viewMode === "single_year" ? (
  <SingleYearSnapshot model={singleYearModel} />
) : model.unavailableReason ? (
  <div className="border border-amber-300/30 bg-amber-300/10 p-6 text-sm text-amber-100">{model.unavailableReason}</div>
) : chartMode === "table" ? (
  <ExplorerTable rows={model.tableRows} years={model.years} />
) : (
  <ChartFrame mode={chartMode} measure={measure} years={model.years} points={model.points} selectedItems={model.selectedItems} />
)}
```

Hide `SeriesSelector` in single-year mode:

```tsx
{viewMode === "multi_year" ? (
  <div className="order-2 lg:order-none">
    <SeriesSelector
      items={model.items}
      selectedIds={selectedIds}
      rows={selectorRows}
      years={model.years}
      chartMode={chartMode}
      limitMessage={limitMessage}
      onToggle={handleToggle}
    />
  </div>
) : null}
```

Hide the period summary in single-year mode:

```tsx
{viewMode === "multi_year" ? (
  <section className="mt-8 pb-12">
    <PeriodSummaryPanel
      years={model.years}
      summary={model.summary}
      rows={model.comparisonRows}
      topGrowth={model.topGrowth}
      bottomGrowth={model.bottomGrowth}
    />
  </section>
) : null}
```

- [ ] **Step 4: Run tests and build**

Run:

```powershell
cd apps/web
npm run test -- tests/explorer/singleYear.test.ts
npm run build
```

Expected:

```text
4 passed
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

---

### Task 5: Add Treemap and Every 100 GEL

**Files:**

- Create: `apps/web/components/single-year/snapshot-treemap.tsx`
- Create: `apps/web/components/single-year/every-100-gel.tsx`
- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`

- [ ] **Step 1: Create treemap component**

Create `apps/web/components/single-year/snapshot-treemap.tsx`:

```tsx
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { formatGel, formatPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type SnapshotTreemapProps = {
  items: SnapshotItem[];
};

type TreemapNode = SnapshotItem & {
  name: string;
  size: number;
};

export function SnapshotTreemap({ items }: SnapshotTreemapProps) {
  const data: TreemapNode[] = items.map((item) => ({
    ...item,
    name: item.kaLabel,
    size: item.amountGel,
  }));

  return (
    <section className="border border-cyan-400/20 bg-black/40 p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white">ბიუჯეტის რუკა</h3>
        <p className="text-sm text-zinc-500">ზომა აჩვენებს წლის მთლიან ხარჯში წილს.</p>
      </div>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            nameKey="name"
            stroke="#05070b"
            fill="#22d3ee"
            content={<TreemapCell />}
          >
            <Tooltip
              contentStyle={{ background: "#05070b", border: "1px solid rgba(34, 211, 238, 0.35)" }}
              formatter={(_, __, payload) => {
                const item = payload?.payload as TreemapNode | undefined;
                return item ? [`${formatGel(item.amountGel)} / ${formatPercent(item.shareOfTotal)}`, item.kaLabel] : ["", ""];
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function TreemapCell(props: unknown) {
  const cell = props as TreemapNode & { x: number; y: number; width: number; height: number };
  const showLabel = cell.width > 110 && cell.height > 42;

  return (
    <g>
      <rect x={cell.x} y={cell.y} width={cell.width} height={cell.height} fill={cell.color} fillOpacity={0.84} stroke="#05070b" />
      {showLabel ? (
        <text x={cell.x + 8} y={cell.y + 22} fill="#020617" fontSize={12} fontWeight={700}>
          {cell.kaLabel}
        </text>
      ) : null}
    </g>
  );
}
```

- [ ] **Step 2: Create Every 100 GEL component**

Create `apps/web/components/single-year/every-100-gel.tsx`:

```tsx
import type { Every100Item } from "../../lib/explorer/types";

type Every100GelProps = {
  items: Every100Item[];
  side: "expenditure" | "revenue";
};

export function Every100Gel({ items, side }: Every100GelProps) {
  const cells = items.flatMap((item) =>
    Array.from({ length: item.gelFrom100 }, (_, index) => ({
      key: `${item.itemId}-${index}`,
      color: item.color,
      label: item.kaLabel,
    })),
  );

  return (
    <section className="border border-lime-300/20 bg-black/40 p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white">ყოველი 100 GEL</h3>
        <p className="text-sm text-zinc-500">
          {side === "revenue" ? "ყოველი 100 GEL შემოსავლიდან" : "ყოველი 100 GEL ხარჯიდან"}
        </p>
      </div>
      <div className="grid grid-cols-10 gap-1 sm:max-w-[360px]">
        {cells.map((cell) => (
          <span
            key={cell.key}
            title={cell.label}
            className="aspect-square border border-black/50"
            style={{ backgroundColor: cell.color }}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.itemId} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-zinc-300">
              <span className="h-3 w-3" style={{ backgroundColor: item.color }} />
              {item.kaLabel}
            </span>
            <span className="font-mono text-zinc-100">{item.gelFrom100} GEL</span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Render treemap and Every 100 GEL**

Modify `apps/web/components/single-year/single-year-snapshot.tsx` imports:

```ts
import { Every100Gel } from "./every-100-gel";
import { SnapshotTreemap } from "./snapshot-treemap";
```

Render after headline cards:

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

- [ ] **Step 5: Commit treemap and Every 100 GEL**

Run:

```powershell
git add apps/web/components/single-year
git commit -m "feat: add snapshot treemap and every 100 gel"
```

Expected:

```text
[branch ...] feat: add snapshot treemap and every 100 gel
```

---

### Task 6: Add Spending Petals and Budget Field

**Files:**

- Create: `apps/web/components/single-year/spending-petals.tsx`
- Create: `apps/web/components/single-year/budget-field.tsx`
- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`

- [ ] **Step 1: Create spending petals component**

Create `apps/web/components/single-year/spending-petals.tsx`:

```tsx
import { formatGel, formatPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type SpendingPetalsProps = {
  items: SnapshotItem[];
};

export function SpendingPetals({ items }: SpendingPetalsProps) {
  const topItems = items.slice(0, 7);
  const center = 150;

  return (
    <section className="border border-fuchsia-300/20 bg-black/40 p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white">ხარჯების ფურცლები</h3>
        <p className="text-sm text-zinc-500">უფრო დიდი ფურცელი ნიშნავს უფრო დიდ წილს.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <svg viewBox="0 0 300 300" className="h-[300px] w-full max-w-[320px]">
          <circle cx={center} cy={center} r="18" fill="#05070b" stroke="#22d3ee" />
          {topItems.map((item, index) => {
            const angle = (Math.PI * 2 * index) / Math.max(topItems.length, 1);
            const rx = 32 + item.shareOfTotal * 90;
            const ry = 18 + item.shareOfTotal * 52;
            const x = center + Math.cos(angle) * 72;
            const y = center + Math.sin(angle) * 72;

            return (
              <ellipse
                key={item.itemId}
                cx={x}
                cy={y}
                rx={rx}
                ry={ry}
                fill={item.color}
                fillOpacity="0.75"
                stroke="#05070b"
                transform={`rotate(${(angle * 180) / Math.PI} ${x} ${y})`}
              >
                <title>{`${item.kaLabel}: ${formatGel(item.amountGel)} / ${formatPercent(item.shareOfTotal)}`}</title>
              </ellipse>
            );
          })}
        </svg>
        <div className="grid content-start gap-2">
          {topItems.map((item) => (
            <div key={item.itemId} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-zinc-300">
                <span className="h-3 w-3" style={{ backgroundColor: item.color }} />
                {item.kaLabel}
              </span>
              <span className="font-mono text-zinc-100">{formatPercent(item.shareOfTotal)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create Budget Field component**

Create `apps/web/components/single-year/budget-field.tsx`:

```tsx
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type BudgetFieldProps = {
  items: SnapshotItem[];
  hasGrowthData: boolean;
};

export function BudgetField({ items, hasGrowthData }: BudgetFieldProps) {
  if (!hasGrowthData) {
    return (
      <section className="border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
        ზრდის საჩვენებლად წინა ხელმისაწვდომი წელი საჭიროა.
      </section>
    );
  }

  const data = items
    .filter((item) => item.changeFromPreviousYear !== null)
    .map((item) => ({
      ...item,
      x: item.shareOfTotal,
      y: item.changeFromPreviousYear,
      z: item.amountGel,
    }));

  return (
    <section className="border border-cyan-400/20 bg-black/40 p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white">Budget Field</h3>
        <p className="text-sm text-zinc-500">ჰორიზონტალი არის წილი, ვერტიკალი - ზრდა წინა ხელმისაწვდომ წელთან.</p>
      </div>
      <div className="h-[360px] min-w-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" name="წილი" tickFormatter={(value) => formatPercent(Number(value))} stroke="#a1a1aa" />
            <YAxis dataKey="y" type="number" name="ზრდა" tickFormatter={(value) => formatSignedPercent(Number(value))} stroke="#a1a1aa" />
            <ZAxis dataKey="z" type="number" range={[80, 900]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{ background: "#05070b", border: "1px solid rgba(34, 211, 238, 0.35)" }}
              formatter={(_, name, payload) => {
                const item = payload?.payload as SnapshotItem | undefined;
                if (!item) return ["", name];
                return [
                  `${formatGel(item.amountGel)} / ${formatPercent(item.shareOfTotal)} / ${formatSignedPercent(item.changeFromPreviousYear)}`,
                  item.kaLabel,
                ];
              }}
            />
            <Scatter data={data} fill="#22d3ee" name="Budget Field">
              {data.map((item, index) => (
                <Cell key={`budget-field-${item.itemId}-${index}`} fill={item.color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Render petals and Budget Field**

Modify `apps/web/components/single-year/single-year-snapshot.tsx` imports:

```ts
import { BudgetField } from "./budget-field";
import { SpendingPetals } from "./spending-petals";
```

Render after Every 100 GEL:

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

- [ ] **Step 5: Commit visuals**

Run:

```powershell
git add apps/web/components/single-year
git commit -m "feat: add snapshot petals and budget field"
```

Expected:

```text
[branch ...] feat: add snapshot petals and budget field
```

---

### Task 7: Add Sortable Full Ranking

**Files:**

- Create: `apps/web/components/single-year/single-year-ranking.tsx`
- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`

- [ ] **Step 1: Create sortable ranking component**

Create `apps/web/components/single-year/single-year-ranking.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type SortKey = "amount" | "share" | "change";

type SingleYearRankingProps = {
  rows: SnapshotItem[];
};

export function SingleYearRanking({ rows }: SingleYearRankingProps) {
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortKey === "share") return b.shareOfTotal - a.shareOfTotal;
      if (sortKey === "change") return (b.changeFromPreviousYear ?? -Infinity) - (a.changeFromPreviousYear ?? -Infinity);
      return b.amountGel - a.amountGel;
    });
  }, [rows, sortKey]);

  return (
    <section className="border border-cyan-400/20 bg-black/40 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">სრული რეიტინგი</h3>
          <p className="text-sm text-zinc-500">ზუსტი წლიური მნიშვნელობები ზედა დონის მუხლებით.</p>
        </div>
        <div className="flex gap-2">
          {[
            ["amount", "თანხა"],
            ["share", "წილი"],
            ["change", "ცვლილება"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key as SortKey)}
              className={`h-9 border px-3 text-sm ${
                sortKey === key
                  ? "border-cyan-300 bg-cyan-300 text-black"
                  : "border-zinc-700 bg-black text-zinc-300 hover:border-cyan-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">მუხლი</th>
              <th className="px-3 py-3">GEL</th>
              <th className="px-3 py-3">წილი</th>
              <th className="px-3 py-3">ცვლილება</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr key={row.itemId} className="border-b border-zinc-900">
                <td className="px-3 py-3 font-mono text-zinc-500">{index + 1}</td>
                <td className="px-3 py-3 font-medium text-zinc-100">{row.kaLabel}</td>
                <td className="px-3 py-3 text-zinc-300">{formatGel(row.amountGel)}</td>
                <td className="px-3 py-3 text-zinc-300">{formatPercent(row.shareOfTotal)}</td>
                <td className="px-3 py-3 text-zinc-300">{formatSignedPercent(row.changeFromPreviousYear)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render ranking last**

Modify `apps/web/components/single-year/single-year-snapshot.tsx` imports:

```ts
import { SingleYearRanking } from "./single-year-ranking";
```

Render after Budget Field:

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

---

### Task 8: Add Browser Coverage and Final Verification

**Files:**

- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add browser test for single-year mode**

Append a new test in `apps/web/tests/browser/main-explorer.spec.ts`:

```ts
test("single-year snapshot renders the expected sections", async ({ page }) => {
  const consoleProblems: string[] = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("http://localhost:3100");

  await page.getByRole("button", { name: "ერთი წელი" }).click();

  await expect(page.getByRole("heading", { name: /წლის ბიუჯეტის სურათი/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ბიუჯეტის რუკა" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ყოველი 100 GEL" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ხარჯების ფურცლები" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Budget Field" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "სრული რეიტინგი" })).toBeVisible();
  await expect(page.locator("svg")).toHaveCount(3);
  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 2: Run unit tests**

Run:

```powershell
cd apps/web
npm run test
```

Expected:

```text
Test Files  ... passed
Tests       ... passed
```

- [ ] **Step 3: Run data validation**

Run:

```powershell
cd apps/web
npm run data:validate
```

Expected:

```text
Validated taxonomy rows: 25
Validated glossary rows: 25
Validated source rows: 5
Validated mapping rows: 3
Validated fact rows: 39
Report written:
```

- [ ] **Step 4: Run production build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Run browser tests**

Run:

```powershell
cd apps/web
npm run test:browser
```

Expected:

```text
passed
```

If browser tests require the dev server manually, run:

```powershell
cd apps/web
npm run dev -- --port 3100
```

Then rerun:

```powershell
npm run test:browser
```

- [ ] **Step 6: Manual browser check**

Open `http://localhost:3100` in the Codex Browser and verify:

- Default view remains multi-year expenditure.
- Clicking `ერთი წელი` shows the single-year snapshot.
- Year selector changes the snapshot year.
- Revenue side shows a clean empty state because revenue facts are not loaded yet.
- No drilldown links appear in treemap, petals, Budget Field, or ranking.
- Every 100 GEL cells sum visually to 100.
- Budget Field shows a growth-unavailable state for the earliest year.
- Mobile viewport stacks sections vertically and keeps Budget Field horizontally scrollable.
- Georgian text is readable and not overlapping.

- [ ] **Step 7: Commit verification coverage**

Run:

```powershell
git add apps/web/tests/browser/main-explorer.spec.ts
git commit -m "test: cover single year snapshot browser flow"
```

Expected:

```text
[branch ...] test: cover single year snapshot browser flow
```

---

## Final Verification

Before calling Plan 4 implemented, run:

```powershell
cd apps/web
npm run test
npm run data:validate
npm run build
npm run test:browser
```

Expected:

```text
Tests passed
Data validation passed
Compiled successfully
Browser tests passed
```

If `npm run test` or `npm run data:validate` fails with Windows sandbox `EPERM`, rerun the same command with Codex escalation because Vitest and the report writer may need to spawn or rewrite generated report files on this machine.

---

## Self-Review

### Spec Coverage

Covered:

- Single-year mode as a zoomed-out snapshot.
- Top-level public spending fields only.
- No drilldown.
- Four headline cards.
- Treemap with share-of-total sizing.
- Every 100 GEL as rounded whole-GEL explainer.
- Spending petals as expressive composition visual.
- Budget Field with share, growth, and amount dimensions.
- Growth unavailable state for first available year.
- Full ranking with amount, share, and previous-year change sorting.
- Planned badge if planned values appear later.
- Mobile stacked sections and horizontally scrollable Budget Field.

Deferred by explicit user direction:

- Revenue ingestion.
- 2026 planned budget.
- Revenue single-year data display beyond an empty state.

### Placeholder Scan

No open placeholders are intended in the plan. All named files, commands, tests, and component responsibilities are explicit.

### Type Consistency

Shared names are consistent across tasks:

- `ViewMode`
- `SnapshotItem`
- `Every100Item`
- `SnapshotHeadline`
- `SingleYearSnapshotModel`
- `buildSingleYearSnapshotModel`
- `SingleYearSnapshot`
- `SnapshotHeadlineCards`
- `SnapshotTreemap`
- `Every100Gel`
- `SpendingPetals`
- `BudgetField`
- `SingleYearRanking`
