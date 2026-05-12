# GeoData.ge Main Explorer UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scaffolded home page with the GeoData.ge v1 Main Explorer: a Georgian-first expenditure/revenue dashboard with line, bar, table, CSV export, selection controls, planned-value markers, and selected-period summaries backed by the foundation data layer.

**Architecture:** Keep `app/page.tsx` as a Server Component that loads validated sample facts and glossary data, then pass serializable data into a focused client explorer. Put business logic in `apps/web/lib/explorer/*`; React components only render state and call pure helpers. Use Recharts only inside client chart components.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind 4, Recharts, Vitest, existing foundation CSV/taxonomy/glossary utilities.

---

## Scope

Included:

- Public Main Explorer first screen.
- Georgian-first public control labels and UI states.
- Expenditure and revenue side switcher.
- Separate remembered selections for expenditure and revenue.
- Derived total expenditure and total revenue series for the default first view.
- Line, bar, and table modes.
- Nominal GEL, percent change, and share-of-total measures.
- Explicit unavailable state for Share of GDP until trusted GDP data is added.
- Chart-series limit of 8 selected items for line/bar charts only; table mode has no series limit.
- CSV export for the active filtered data, including source metadata columns.
- Planned-value badge and planned chart marker for active planned values.
- Minimal source label.
- Below-scroll selected-period summary cards, top/bottom movers, and start-vs-end comparison.
- Mobile-stacked layout.

Excluded:

- Single-year snapshot sections: headline cards, treemap, Every 100 GEL, spending petals, Budget Field, full ranking.
- Stacked mode implementation. The UI may show it as a disabled future mode, but it must not pretend to work.
- Share of GDP calculations.
- Production Supabase reads.
- Public provenance panels.
- Clickable drilldown/detail pages.
- Full 2016-2026 production data ingestion.

## Source Documents

Read before executing:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- `docs/superpowers/plans/2026-05-10-geodata-budget-v1-foundation.md`

## Current Baseline

The foundation has already created:

- `apps/web` Next.js app.
- Data files under `data/*`.
- `loadBudgetFactRows`, `chooseActivePublicFacts`, `loadGlossary`, `loadTaxonomyFiles`, and source/mapping validation helpers.
- Vitest test setup.

The current `apps/web/app/page.tsx` is the default Next.js starter page. Plan 2 replaces it.

## Library Decision

Use Recharts for Plan 2 charts.

Reasoning:

- The current app is React/Next.js and the required v1 charts are standard line/bar/table-adjacent dashboard charts.
- Context7 docs for Recharts identify it as a composable React/D3 charting library with `ResponsiveContainer`, `LineChart`, `BarChart`, `Tooltip`, `Legend`, and stacked chart support through component props.
- Context7 docs for Next.js App Router confirm interactive components that use hooks or browser libraries should be marked with `"use client"` and can be imported by Server Components.

Do not introduce a heavier charting layer in this plan.

## File Structure

Create or modify these paths:

```text
apps/web/
|-- app/
|   |-- layout.tsx
|   |-- page.tsx
|   `-- globals.css
|-- components/
|   `-- main-explorer/
|       |-- chart-frame.tsx
|       |-- explorer-controls.tsx
|       |-- explorer-table.tsx
|       |-- main-explorer.tsx
|       |-- period-summary.tsx
|       `-- series-selector.tsx
|-- lib/
|   `-- explorer/
|       |-- csvExport.ts
|       |-- explorerData.ts
|       |-- format.ts
|       `-- types.ts
`-- tests/
    `-- explorer/
        |-- csvExport.test.ts
        |-- explorerData.test.ts
        `-- format.test.ts
```

Responsibilities:

- `lib/explorer/types.ts`: UI-facing explorer types and constants.
- `lib/explorer/format.ts`: GEL, percent, compact number, and safe change formatting.
- `lib/explorer/explorerData.ts`: active fact filtering, measure calculation, chart/table rows, selector items, summary cards, and movement lists.
- `lib/explorer/csvExport.ts`: CSV serialization from the same table rows used by the visible UI.
- `components/main-explorer/*`: client-rendered controls, charts, selector, table, and summaries.
- `app/page.tsx`: server-side data loading from foundation files.

---

### Task 1: Add Recharts and Explorer Formatting Utilities

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Create: `apps/web/lib/explorer/types.ts`
- Create: `apps/web/lib/explorer/format.ts`
- Create: `apps/web/tests/explorer/format.test.ts`

- [ ] **Step 1: Install Recharts**

Run:

```powershell
cd apps/web
npm install recharts
```

Expected:

```text
added
found 0 vulnerabilities
```

- [ ] **Step 2: Create explorer type definitions**

Create `apps/web/lib/explorer/types.ts`:

```typescript
export const EXPLORER_SIDES = ["expenditure", "revenue"] as const;
export const CHART_MODES = ["line", "bar", "table"] as const;
export const MEASURE_MODES = ["nominal", "percent_change", "share_of_total", "share_of_gdp"] as const;

export type ExplorerSide = (typeof EXPLORER_SIDES)[number];
export type ChartMode = (typeof CHART_MODES)[number];
export type MeasureMode = (typeof MEASURE_MODES)[number];

export const MAX_CHART_SERIES = 8;

export type SourceMetadata = {
  sourceName: string;
  sourceUrlOrFile: string;
  lastReviewedAt: string;
};

export type ExplorerItem = {
  id: string;
  side: ExplorerSide;
  kaLabel: string;
  enLabel: string;
  color: string;
  sortOrder: number;
};

export type ExplorerPoint = {
  year: number;
  itemId: string;
  kaLabel: string;
  enLabel: string;
  amountGel: number;
  basis: "actual" | "planned";
  value: number | null;
  shareOfTotal: number | null;
  percentChange: number | null;
};

export type ExplorerTableRow = {
  itemId: string;
  kaLabel: string;
  enLabel: string;
  basisByYear: Record<number, "actual" | "planned">;
  sourceByYear: Record<number, SourceMetadata>;
  valuesByYear: Record<number, number | null>;
  change: number | null;
  shareEndYear: number | null;
};

export type PeriodSummary = {
  totalChange: number | null;
  largestGelIncrease: ExplorerTableRow | null;
  fastestGrowth: ExplorerTableRow | null;
  lowestGrowth: ExplorerTableRow | null;
  biggestShareChange: ExplorerTableRow | null;
};
```

- [ ] **Step 3: Write failing formatting tests**

Create `apps/web/tests/explorer/format.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";

describe("explorer formatters", () => {
  it("formats GEL values compactly", () => {
    expect(formatGel(22500000000)).toBe("22.5B GEL");
    expect(formatGel(4500000)).toBe("4.5M GEL");
  });

  it("formats nullable percent values", () => {
    expect(formatPercent(0.183)).toBe("18.3%");
    expect(formatPercent(null)).toBe("n/a");
  });

  it("formats signed percent values", () => {
    expect(formatSignedPercent(0.12)).toBe("+12.0%");
    expect(formatSignedPercent(-0.04)).toBe("-4.0%");
    expect(formatSignedPercent(null)).toBe("n/a");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run:

```powershell
cd apps/web
npm test -- tests/explorer/format.test.ts
```

Expected:

```text
Cannot find module '../../lib/explorer/format'
```

- [ ] **Step 5: Implement formatters**

Create `apps/web/lib/explorer/format.ts`:

```typescript
const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentNumber = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  style: "percent",
});

export function formatGel(value: number | null): string {
  if (value === null) return "n/a";
  return `${compactNumber.format(value)} GEL`;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "n/a";
  return percentNumber.format(value);
}

export function formatSignedPercent(value: number | null): string {
  if (value === null) return "n/a";
  const formatted = percentNumber.format(value);
  return value > 0 ? `+${formatted}` : formatted;
}
```

- [ ] **Step 6: Run formatting tests**

Run:

```powershell
cd apps/web
npm test -- tests/explorer/format.test.ts
```

Expected:

```text
3 passed
```

- [ ] **Step 7: Commit**

Run:

```powershell
git add apps/web/package.json apps/web/package-lock.json apps/web/lib/explorer apps/web/tests/explorer/format.test.ts
git commit -m "feat: add explorer chart dependency and formatters"
```

Expected:

```text
[main
```

---

### Task 2: Build Main Explorer Data Model

**Files:**

- Create: `apps/web/lib/explorer/explorerData.ts`
- Create: `apps/web/tests/explorer/explorerData.test.ts`

- [ ] **Step 1: Write failing data-model tests**

Create `apps/web/tests/explorer/explorerData.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildExplorerModel, getDefaultSelection } from "../../lib/explorer/explorerData";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { SourceDocumentRow } from "../../lib/data/sources";

const glossary = new Map<string, GlossaryEntry>([
  ["spending.health", { id: "spending.health", kaLabel: "ჯანდაცვა", enLabel: "Health", description: "", notes: "" }],
  ["spending.education", { id: "spending.education", kaLabel: "განათლება", enLabel: "Education", description: "", notes: "" }],
  ["revenue.vat", { id: "revenue.vat", kaLabel: "დღგ", enLabel: "VAT", description: "", notes: "" }],
]);

const facts: BudgetFactImportRow[] = [
  { year: 2025, side: "expenditure", itemId: "spending.health", amountGel: 100, basis: "actual", sourceId: "source.one", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.health", mappingConfidence: "high", mappingNotes: "" },
  { year: 2026, side: "expenditure", itemId: "spending.health", amountGel: 150, basis: "planned", sourceId: "source.two", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.health", mappingConfidence: "high", mappingNotes: "" },
  { year: 2025, side: "expenditure", itemId: "spending.education", amountGel: 300, basis: "actual", sourceId: "source.one", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.education", mappingConfidence: "high", mappingNotes: "" },
  { year: 2026, side: "expenditure", itemId: "spending.education", amountGel: 300, basis: "actual", sourceId: "source.two", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.education", mappingConfidence: "high", mappingNotes: "" },
  { year: 2026, side: "revenue", itemId: "revenue.vat", amountGel: 500, basis: "planned", sourceId: "source.two", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: null, mappingConfidence: null, mappingNotes: "" },
];

const sourceDocuments: SourceDocumentRow[] = [
  {
    sourceId: "source.one",
    sourceName: "Reviewed 2025 execution",
    sourceUrlOrFile: "docs/source-2025",
    lastReviewedAt: "2026-05-10",
  },
  {
    sourceId: "source.two",
    sourceName: "Reviewed 2026 planned budget",
    sourceUrlOrFile: "docs/source-2026",
    lastReviewedAt: "2026-05-11",
  },
];

describe("main explorer data model", () => {
  it("returns side-specific default selections", () => {
    expect(getDefaultSelection("expenditure", facts)).toEqual(["expenditure.total"]);
    expect(getDefaultSelection("revenue", facts)).toEqual(["revenue.total"]);
  });

  it("builds derived total points and planned-year metadata", () => {
    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["expenditure.total"],
      startYear: 2025,
      endYear: 2026,
      measure: "nominal",
    });

    expect(model.years).toEqual([2025, 2026]);
    expect(model.points).toEqual([
      expect.objectContaining({ year: 2025, value: 400, basis: "actual" }),
      expect.objectContaining({ year: 2026, value: 450, basis: "planned" }),
    ]);
    expect(model.hasPlannedValues).toBe(true);
    expect(model.tableRows.find((row) => row.itemId === "expenditure.total")?.sourceByYear[2026]).toEqual({
      sourceName: "Multiple reviewed official sources",
      sourceUrlOrFile: "docs/source-2026",
      lastReviewedAt: "2026-05-11",
    });
    expect(model.summary.biggestShareChange?.itemId).toBe("spending.health");
  });

  it("calculates percent change and share of total", () => {
    const percentModel = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["spending.health"],
      startYear: 2025,
      endYear: 2026,
      measure: "percent_change",
    });
    const shareModel = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["spending.health"],
      startYear: 2025,
      endYear: 2026,
      measure: "share_of_total",
    });

    expect(percentModel.points[0]?.value).toBeNull();
    expect(percentModel.points[1]?.value).toBe(0.5);
    expect(shareModel.points[1]?.value).toBeCloseTo(0.3333, 4);
  });

  it("returns an unavailable message for share of GDP", () => {
    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "revenue",
      selectedItemIds: ["revenue.vat"],
      startYear: 2026,
      endYear: 2026,
      measure: "share_of_gdp",
    });

    expect(model.unavailableReason).toBe("მშპ-სთან წილის საჩვენებლად საჭიროა სანდო მშპ მონაცემები.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd apps/web
npm test -- tests/explorer/explorerData.test.ts
```

Expected:

```text
Cannot find module '../../lib/explorer/explorerData'
```

- [ ] **Step 3: Implement explorer data model**

Create `apps/web/lib/explorer/explorerData.ts` with these exports and behavior:

```typescript
import type { GlossaryEntry } from "../data/glossary";
import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import type { SourceDocumentRow } from "../data/sources";
import { chooseActivePublicFacts } from "../data/activeFacts";
import type {
  ExplorerItem,
  ExplorerPoint,
  ExplorerSide,
  ExplorerTableRow,
  MeasureMode,
  PeriodSummary,
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
];

export type ExplorerModelInput = {
  facts: BudgetFactImportRow[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
  side: ExplorerSide;
  selectedItemIds: string[];
  startYear: number;
  endYear: number;
  measure: MeasureMode;
};

export type ExplorerModel = {
  years: number[];
  items: ExplorerItem[];
  selectedItems: ExplorerItem[];
  points: ExplorerPoint[];
  tableRows: ExplorerTableRow[];
  summary: PeriodSummary;
  topGrowth: ExplorerTableRow[];
  bottomGrowth: ExplorerTableRow[];
  hasPlannedValues: boolean;
  unavailableReason: string | null;
};

function labelFor(id: string, glossary: Map<string, GlossaryEntry>): Pick<ExplorerItem, "kaLabel" | "enLabel"> {
  const entry = glossary.get(id);

  return {
    kaLabel: entry?.kaLabel ?? id,
    enLabel: entry?.enLabel ?? id,
  };
}

function sideForItemId(itemId: string): ExplorerSide {
  return itemId.startsWith("revenue.") ? "revenue" : "expenditure";
}

function totalIdFor(side: ExplorerSide): string {
  return side === "revenue" ? "revenue.total" : "expenditure.total";
}

function totalLabelsFor(side: ExplorerSide): Pick<ExplorerItem, "kaLabel" | "enLabel"> {
  return side === "revenue"
    ? { kaLabel: "შემოსავლები სულ", enLabel: "Total revenue" }
    : { kaLabel: "ხარჯები სულ", enLabel: "Total expenditure" };
}

function sourceMetadataFor(sourceIds: string[], sources: Map<string, SourceDocumentRow>): SourceMetadata {
  const sourceRows = sourceIds
    .map((sourceId) => sources.get(sourceId))
    .filter((source): source is SourceDocumentRow => Boolean(source));
  const uniqueNames = Array.from(new Set(sourceRows.map((source) => source.sourceName)));
  const uniqueFiles = Array.from(new Set(sourceRows.map((source) => source.sourceUrlOrFile)));
  const lastReviewedAt = sourceRows.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return {
    sourceName: uniqueNames.length === 1 ? uniqueNames[0] : "Multiple reviewed official sources",
    sourceUrlOrFile: uniqueFiles.length === 1 ? uniqueFiles[0] : uniqueFiles.join("; "),
    lastReviewedAt,
  };
}

function valueForMeasure(
  amountGel: number,
  previousAmountGel: number | null,
  yearTotal: number,
  measure: MeasureMode,
): number | null {
  if (measure === "nominal") return amountGel;
  if (measure === "share_of_total") return yearTotal === 0 ? null : amountGel / yearTotal;
  if (measure === "percent_change") {
    if (previousAmountGel === null || previousAmountGel === 0) return null;
    return (amountGel - previousAmountGel) / previousAmountGel;
  }
  return null;
}

export function getDefaultSelection(side: ExplorerSide, facts: BudgetFactImportRow[]): string[] {
  const hasRows = chooseActivePublicFacts(facts).some((fact) => fact.side === side);
  return hasRows ? [totalIdFor(side)] : [];
}

export function buildExplorerModel(input: ExplorerModelInput): ExplorerModel {
  const active = chooseActivePublicFacts(input.facts).filter((fact) => fact.side === input.side);
  const visibleFacts = active.filter(
    (fact) => fact.year >= input.startYear && fact.year <= input.endYear,
  );
  const years = Array.from(new Set(visibleFacts.map((fact) => fact.year))).sort((a, b) => a - b);
  const totalId = totalIdFor(input.side);
  const itemIds = [totalId, ...Array.from(new Set(active.map((fact) => fact.itemId))).sort()];
  const items = itemIds.map((id, index) => ({
    id,
    side: sideForItemId(id),
    ...(id === totalId ? totalLabelsFor(input.side) : labelFor(id, input.glossary)),
    color: palette[index % palette.length],
    sortOrder: index + 1,
  }));
  const selectedItems = items.filter((item) => input.selectedItemIds.includes(item.id));
  const amountByItemYear = new Map<string, BudgetFactImportRow>();
  const totalByYear = new Map<number, number>();
  const sourcesById = new Map(input.sourceDocuments.map((source) => [source.sourceId, source]));

  for (const fact of visibleFacts) {
    amountByItemYear.set(`${fact.itemId}:${fact.year}`, fact);
    totalByYear.set(fact.year, (totalByYear.get(fact.year) ?? 0) + fact.amountGel);
  }

  const points: ExplorerPoint[] = [];

  for (const item of selectedItems) {
    for (const year of years) {
      const fact = item.id === totalId ? undefined : amountByItemYear.get(`${item.id}:${year}`);
      if (!fact && item.id !== totalId) continue;

      const previousYear = [...years].reverse().find((candidate) => candidate < year);
      const previousFact =
        previousYear === undefined ? undefined : amountByItemYear.get(`${item.id}:${previousYear}`);
      const yearTotal = totalByYear.get(year) ?? 0;
      const totalBasis = visibleFacts.some(
        (candidate) => candidate.year === year && candidate.basis === "planned",
      )
        ? "planned"
        : "actual";
      const amountGel = item.id === totalId ? yearTotal : (fact?.amountGel ?? 0);
      const previousAmountGel =
        item.id === totalId && previousYear !== undefined ? (totalByYear.get(previousYear) ?? null) : (previousFact?.amountGel ?? null);
      const percentChange =
        previousAmountGel !== null && previousAmountGel !== 0
          ? (amountGel - previousAmountGel) / previousAmountGel
          : null;
      const shareOfTotal = yearTotal === 0 ? null : amountGel / yearTotal;

      points.push({
        year,
        itemId: item.id,
        kaLabel: item.kaLabel,
        enLabel: item.enLabel,
        amountGel,
        basis: item.id === totalId ? totalBasis : (fact?.basis ?? "actual"),
        value: valueForMeasure(amountGel, previousAmountGel, yearTotal, input.measure),
        shareOfTotal,
        percentChange,
      });
    }
  }

  const tableRows = items.map((item) => {
    const valuesByYear: Record<number, number | null> = {};
    const basisByYear: Record<number, "actual" | "planned"> = {};
    const sourceByYear: ExplorerTableRow["sourceByYear"] = {};

    for (const year of years) {
      const fact = item.id === totalId ? undefined : amountByItemYear.get(`${item.id}:${year}`);
      valuesByYear[year] = item.id === totalId ? (totalByYear.get(year) ?? null) : (fact?.amountGel ?? null);
      if (item.id === totalId) {
        const yearFacts = visibleFacts.filter((candidate) => candidate.year === year);
        basisByYear[year] = visibleFacts.some(
          (candidate) => candidate.year === year && candidate.basis === "planned",
        )
          ? "planned"
          : "actual";
        sourceByYear[year] = sourceMetadataFor(
          yearFacts.map((candidate) => candidate.sourceId),
          sourcesById,
        );
      } else if (fact) {
        basisByYear[year] = fact.basis;
        sourceByYear[year] = sourceMetadataFor([fact.sourceId], sourcesById);
      }
    }

    const startValue = valuesByYear[years[0] ?? input.startYear] ?? null;
    const endValue = valuesByYear[years[years.length - 1] ?? input.endYear] ?? null;
    const change = startValue !== null && startValue !== 0 && endValue !== null
      ? (endValue - startValue) / startValue
      : null;
    const endTotal = totalByYear.get(years[years.length - 1] ?? input.endYear) ?? 0;

    return {
      itemId: item.id,
      kaLabel: item.kaLabel,
      enLabel: item.enLabel,
      basisByYear,
      sourceByYear,
      valuesByYear,
      change,
      shareEndYear: endValue === null || endTotal === 0 ? null : endValue / endTotal,
    };
  });

  const totalRow = tableRows.find((row) => row.itemId === totalId) ?? null;
  const rowsWithChange = tableRows.filter(
    (row) => row.itemId !== totalId && row.change !== null,
  );
  const topGrowth = [...rowsWithChange].sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 3);
  const bottomGrowth = [...rowsWithChange].sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 3);
  const startYear = years[0] ?? input.startYear;
  const endYear = years[years.length - 1] ?? input.endYear;
  const startTotal = totalByYear.get(startYear) ?? 0;
  const endTotal = totalByYear.get(endYear) ?? 0;
  const largestGelIncrease = tableRows.filter((row) => row.itemId !== totalId).sort((a, b) => {
    const aIncrease = (a.valuesByYear[endYear] ?? 0) - (a.valuesByYear[startYear] ?? 0);
    const bIncrease = (b.valuesByYear[endYear] ?? 0) - (b.valuesByYear[startYear] ?? 0);
    return bIncrease - aIncrease;
  })[0] ?? null;
  const biggestShareChange = tableRows.filter((row) => row.itemId !== totalId).sort((a, b) => {
    const aStartShare = startTotal === 0 ? 0 : (a.valuesByYear[startYear] ?? 0) / startTotal;
    const aEndShare = endTotal === 0 ? 0 : (a.valuesByYear[endYear] ?? 0) / endTotal;
    const bStartShare = startTotal === 0 ? 0 : (b.valuesByYear[startYear] ?? 0) / startTotal;
    const bEndShare = endTotal === 0 ? 0 : (b.valuesByYear[endYear] ?? 0) / endTotal;

    return Math.abs(bEndShare - bStartShare) - Math.abs(aEndShare - aStartShare);
  })[0] ?? null;

  return {
    years,
    items,
    selectedItems,
    points,
    tableRows,
    summary: {
      totalChange: totalRow?.change ?? null,
      largestGelIncrease,
      fastestGrowth: topGrowth[0] ?? null,
      lowestGrowth: bottomGrowth[0] ?? null,
      biggestShareChange,
    },
    topGrowth,
    bottomGrowth,
    hasPlannedValues: points.some((point) => point.basis === "planned"),
    unavailableReason:
      input.measure === "share_of_gdp" ? "მშპ-სთან წილის საჩვენებლად საჭიროა სანდო მშპ მონაცემები." : null,
  };
}
```

- [ ] **Step 4: Run data-model tests**

Run:

```powershell
cd apps/web
npm test -- tests/explorer/explorerData.test.ts
```

Expected:

```text
4 passed
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/lib/explorer/explorerData.ts apps/web/tests/explorer/explorerData.test.ts
git commit -m "test: build main explorer data model"
```

Expected:

```text
[main
```

---

### Task 3: Add CSV Export from Explorer Rows

**Files:**

- Create: `apps/web/lib/explorer/csvExport.ts`
- Create: `apps/web/tests/explorer/csvExport.test.ts`

- [ ] **Step 1: Write failing CSV tests**

Create `apps/web/tests/explorer/csvExport.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildExplorerCsv } from "../../lib/explorer/csvExport";
import type { ExplorerTableRow } from "../../lib/explorer/types";

describe("explorer CSV export", () => {
  it("serializes visible table rows with basis and source metadata", () => {
    const rows: ExplorerTableRow[] = [
      {
        itemId: "spending.health",
        kaLabel: "ჯანდაცვა",
        enLabel: "Health",
        valuesByYear: { 2025: 100, 2026: 150 },
        basisByYear: { 2025: "actual", 2026: "planned" },
        sourceByYear: {
          2025: {
            sourceName: "Reviewed 2025 execution",
            sourceUrlOrFile: "docs/source-2025",
            lastReviewedAt: "2026-05-10",
          },
          2026: {
            sourceName: "Reviewed 2026 planned budget",
            sourceUrlOrFile: "docs/source-2026",
            lastReviewedAt: "2026-05-11",
          },
        },
        change: 0.5,
        shareEndYear: 0.3,
      },
    ];

    expect(buildExplorerCsv(rows, [2025, 2026])).toContain(
      "year,category_id,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at",
    );
    expect(buildExplorerCsv(rows, [2025, 2026])).toContain(
      '2026,spending.health,"ჯანდაცვა",Health,150,planned,Reviewed 2026 planned budget,docs/source-2026,2026-05-11',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd apps/web
npm test -- tests/explorer/csvExport.test.ts
```

Expected:

```text
Cannot find module '../../lib/explorer/csvExport'
```

- [ ] **Step 3: Implement CSV serialization**

Create `apps/web/lib/explorer/csvExport.ts`:

```typescript
import type { ExplorerTableRow } from "./types";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function buildExplorerCsv(rows: ExplorerTableRow[], years: number[]): string {
  const lines = [
    "year,category_id,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at",
  ];

  for (const row of rows) {
    for (const year of years) {
      const value = row.valuesByYear[year];
      if (value === null || value === undefined) continue;

      const source = row.sourceByYear[year];

      lines.push(
        [
          String(year),
          row.itemId,
          escapeCsv(row.kaLabel),
          escapeCsv(row.enLabel),
          String(value),
          row.basisByYear[year] ?? "actual",
          escapeCsv(source?.sourceName ?? ""),
          escapeCsv(source?.sourceUrlOrFile ?? ""),
          source?.lastReviewedAt ?? "",
        ].join(","),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
```

CSV source metadata rule:

- Non-total rows use the source metadata attached to the active fact for that row/year.
- Derived total rows aggregate source metadata from child facts for the same side/year.
- If all child facts share one source, export that source exactly.
- If child facts use multiple sources, export `Multiple reviewed official sources` in `source_name`, join distinct `source_url_or_file` values with `; `, and use the latest `last_reviewed_at`.

- [ ] **Step 4: Run CSV tests**

Run:

```powershell
cd apps/web
npm test -- tests/explorer/csvExport.test.ts
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/lib/explorer/csvExport.ts apps/web/tests/explorer/csvExport.test.ts
git commit -m "test: add explorer csv export"
```

Expected:

```text
[main
```

---

### Task 4: Replace the Starter Page with Server-Loaded Explorer Data

**Files:**

- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/main-explorer/main-explorer.tsx`

- [ ] **Step 1: Update metadata and document language**

Modify `apps/web/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GeoData.ge Budget Explorer",
  description: "Georgian-first explorer for Georgia national budget data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ka" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create temporary client shell**

Create `apps/web/components/main-explorer/main-explorer.tsx`:

```typescript
"use client";

import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { SourceDocumentRow } from "../../lib/data/sources";

export type MainExplorerProps = {
  facts: BudgetFactImportRow[];
  glossaryEntries: GlossaryEntry[];
  sourceDocuments: SourceDocumentRow[];
  lastUpdatedAt: string;
};

export function MainExplorer({ facts, glossaryEntries, sourceDocuments, lastUpdatedAt }: MainExplorerProps) {
  return (
    <main className="min-h-screen bg-[#05070b] text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2 border-b border-cyan-400/20 pb-5">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300">
            GeoData.ge
          </p>
          <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
            საქართველოს ბიუჯეტის მთავარი მკვლევარი
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები. ბოლო განახლება: {lastUpdatedAt}.
          </p>
        </header>
        <div className="rounded border border-cyan-400/20 bg-cyan-400/5 p-4 font-mono text-sm text-cyan-100">
          ჩაიტვირთა {facts.length} აქტიური სატესტო ჩანაწერი, {glossaryEntries.length} ტერმინი და {sourceDocuments.length} წყაროს ჩანაწერი.
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Replace server page**

Modify `apps/web/app/page.tsx`:

```typescript
import { MainExplorer } from "../components/main-explorer/main-explorer";
import { chooseActivePublicFacts } from "../lib/data/activeFacts";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { loadSourceDocuments } from "../lib/data/sources";

export default async function Home() {
  const [facts, glossary, sources] = await Promise.all([
    loadBudgetFactRows("../../data/imports/sample-budget-facts.csv"),
    loadGlossary("../../data/glossary/category-glossary.csv"),
    loadSourceDocuments("../../data/sources/source-documents.csv"),
  ]);
  const lastUpdatedAt = sources
    .map((source) => source.lastReviewedAt)
    .sort()
    .at(-1) ?? "2026-05-10";

  return (
    <MainExplorer
      facts={chooseActivePublicFacts(facts)}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sources}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
```

- [ ] **Step 4: Verify page compiles**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/app/layout.tsx apps/web/app/page.tsx apps/web/components/main-explorer/main-explorer.tsx
git commit -m "feat: load main explorer shell"
```

Expected:

```text
[main
```

---

### Task 5: Implement Explorer Controls and Series Selector

**Files:**

- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Create: `apps/web/components/main-explorer/explorer-controls.tsx`
- Create: `apps/web/components/main-explorer/series-selector.tsx`

- [ ] **Step 1: Create controls component**

Create `apps/web/components/main-explorer/explorer-controls.tsx`:

```typescript
import type { ChartMode, ExplorerSide, MeasureMode } from "../../lib/explorer/types";

type ExplorerControlsProps = {
  side: ExplorerSide;
  chartMode: ChartMode;
  measure: MeasureMode;
  startYear: number;
  endYear: number;
  barYear: number;
  years: number[];
  onSideChange: (side: ExplorerSide) => void;
  onChartModeChange: (mode: ChartMode) => void;
  onMeasureChange: (measure: MeasureMode) => void;
  onStartYearChange: (year: number) => void;
  onEndYearChange: (year: number) => void;
  onBarYearChange: (year: number) => void;
};

export function ExplorerControls(props: ExplorerControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {[
          ["expenditure", "ხარჯები"],
          ["revenue", "შემოსავლები"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onSideChange(value as ExplorerSide)}
            className={`h-10 rounded border px-4 text-sm font-medium ${
              props.side === value
                ? "border-cyan-300 bg-cyan-300 text-black"
                : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-cyan-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["line", "ხაზი"],
          ["bar", "სვეტები"],
          ["table", "ცხრილი"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onChartModeChange(value as ChartMode)}
            className={`h-9 rounded border px-3 font-mono text-xs uppercase ${
              props.chartMode === value
                ? "border-lime-300 bg-lime-300 text-black"
                : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-lime-300"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          disabled
          className="h-9 rounded border border-zinc-800 bg-zinc-950 px-3 font-mono text-xs uppercase text-zinc-600"
        >
          დაგროვებითი მოგვიანებით
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          საზომი
          <select
            value={props.measure}
            onChange={(event) => props.onMeasureChange(event.target.value as MeasureMode)}
            className="h-10 rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
          >
            <option value="nominal">ნომინალური GEL</option>
            <option value="percent_change">% ცვლილება</option>
            <option value="share_of_total">წილი ჯამში</option>
            <option value="share_of_gdp">წილი მშპ-ში</option>
          </select>
        </label>

        {props.chartMode === "bar" ? (
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            წელი
            <select
              value={props.barYear}
              onChange={(event) => props.onBarYearChange(Number(event.target.value))}
              className="h-10 rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            >
              {props.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              საწყისი წელი
              <select
                value={props.startYear}
                onChange={(event) => props.onStartYearChange(Number(event.target.value))}
                className="h-10 rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              >
                {props.years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              ბოლო წელი
              <select
                value={props.endYear}
                onChange={(event) => props.onEndYearChange(Number(event.target.value))}
                className="h-10 rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              >
                {props.years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create series selector**

Create `apps/web/components/main-explorer/series-selector.tsx`:

```typescript
import type { ChartMode, ExplorerItem } from "../../lib/explorer/types";
import { MAX_CHART_SERIES } from "../../lib/explorer/types";

type SeriesSelectorProps = {
  chartMode: ChartMode;
  items: ExplorerItem[];
  selectedItemIds: string[];
  onSelectionChange: (itemIds: string[]) => void;
};

export function SeriesSelector({ chartMode, items, selectedItemIds, onSelectionChange }: SeriesSelectorProps) {
  const appliesSeriesLimit = chartMode !== "table";

  function toggleItem(itemId: string) {
    if (selectedItemIds.includes(itemId)) {
      onSelectionChange(selectedItemIds.filter((id) => id !== itemId));
      return;
    }

    if (appliesSeriesLimit && selectedItemIds.length >= MAX_CHART_SERIES) return;
    onSelectionChange([...selectedItemIds, itemId]);
  }

  return (
    <aside className="flex flex-col gap-3 border border-cyan-400/20 bg-black/40 p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">სერიები</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {appliesSeriesLimit
            ? `გრაფიკზე მაქსიმუმ ${MAX_CHART_SERIES} სერია გამოჩნდება.`
            : "ცხრილის რეჟიმში სერიების რაოდენობა შეზღუდული არ არის."}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const selected = selectedItemIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleItem(item.id)}
              className={`flex min-h-11 items-center gap-3 rounded border px-3 py-2 text-left ${
                selected
                  ? "border-cyan-300 bg-cyan-300/10"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
              }`}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-zinc-100">{item.kaLabel}</span>
            </button>
          );
        })}
      </div>
      {appliesSeriesLimit && selectedItemIds.length >= MAX_CHART_SERIES ? (
        <p className="text-xs text-amber-300">ლიმიტი მიღწეულია. ახალი სერიის დასამატებლად ერთი სერია მოხსენით.</p>
      ) : null}
    </aside>
  );
}
```

- [ ] **Step 3: Wire controls into main explorer**

Modify `apps/web/components/main-explorer/main-explorer.tsx` to:

- Keep `"use client"`.
- Use `useMemo` and `useState`.
- Convert `glossaryEntries` into `Map<string, GlossaryEntry>`.
- Build `allYears` from `facts`.
- Keep separate selected IDs for expenditure and revenue.
- Call `buildExplorerModel` with `facts`, `glossary`, and `sourceDocuments`.
- Render `ExplorerControls` and `SeriesSelector`.

Use this state skeleton:

```typescript
const [side, setSide] = useState<ExplorerSide>("expenditure");
const [chartMode, setChartMode] = useState<ChartMode>("line");
const [measure, setMeasure] = useState<MeasureMode>("nominal");
const [startYear, setStartYear] = useState(allYears[0] ?? 2016);
const [endYear, setEndYear] = useState(allYears[allYears.length - 1] ?? 2026);
const [barYear, setBarYear] = useState(allYears[allYears.length - 1] ?? 2026);
const [expenditureSelection, setExpenditureSelection] = useState(() =>
  getDefaultSelection("expenditure", facts),
);
const [revenueSelection, setRevenueSelection] = useState(() =>
  getDefaultSelection("revenue", facts),
);
```

Selection rule:

```typescript
const selectedItemIds = side === "expenditure" ? expenditureSelection : revenueSelection;
const setSelectedItemIds = side === "expenditure" ? setExpenditureSelection : setRevenueSelection;
```

Model year rule:

```typescript
const modelStartYear = chartMode === "bar" ? barYear : startYear;
const modelEndYear = chartMode === "bar" ? barYear : endYear;
```

When switching from line/table mode to bar mode, do not destroy `startYear` or `endYear`. The bar-year selector defaults to the current `endYear`, and returning to line/table restores the previous range.

Use this chart-mode setter:

```typescript
function updateChartMode(nextMode: ChartMode) {
  if (nextMode === "bar" && chartMode !== "bar") {
    setBarYear(endYear);
  }

  setChartMode(nextMode);
}
```

- [ ] **Step 4: Verify build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/components/main-explorer
git commit -m "feat: add main explorer controls"
```

Expected:

```text
[main
```

---

### Task 6: Add Line Chart, Bar Chart, and Table Rendering

**Files:**

- Create: `apps/web/components/main-explorer/chart-frame.tsx`
- Create: `apps/web/components/main-explorer/explorer-table.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`

- [ ] **Step 1: Create chart frame with Recharts**

Create `apps/web/components/main-explorer/chart-frame.tsx`:

```typescript
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatGel, formatPercent } from "../../lib/explorer/format";
import type { ChartMode, ExplorerItem, ExplorerPoint, MeasureMode } from "../../lib/explorer/types";

type ChartFrameProps = {
  mode: ChartMode;
  measure: MeasureMode;
  points: ExplorerPoint[];
  selectedItems: ExplorerItem[];
  unavailableReason: string | null;
};

function chartValueLabel(value: number | null, measure: MeasureMode): string {
  if (measure === "nominal") return formatGel(value);
  return formatPercent(value);
}

function chartKey(itemId: string): string {
  return itemId.replaceAll(".", "__");
}

function wideRows(points: ExplorerPoint[]) {
  const rows = new Map<number, Record<string, number | string | null>>();

  for (const point of points) {
    const row = rows.get(point.year) ?? { year: point.year };
    row[chartKey(point.itemId)] = point.value;
    rows.set(point.year, row);
  }

  return Array.from(rows.values()).sort((a, b) => Number(a.year) - Number(b.year));
}

function plannedPointKeys(points: ExplorerPoint[]): Set<string> {
  return new Set(
    points
      .filter((point) => point.basis === "planned")
      .map((point) => `${point.year}:${chartKey(point.itemId)}`),
  );
}

function plannedDot(plannedKeys: Set<string>, itemKey: string) {
  return function Dot(props: { cx?: number; cy?: number; payload?: Record<string, unknown> }) {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return null;

    const isPlanned = plannedKeys.has(`${payload.year}:${itemKey}`);

    return (
      <circle
        cx={cx}
        cy={cy}
        r={isPlanned ? 5 : 3}
        fill={isPlanned ? "#facc15" : "#05070b"}
        stroke={isPlanned ? "#facc15" : "#e4e4e7"}
        strokeWidth={isPlanned ? 2 : 1}
      />
    );
  };
}

export function ChartFrame({ mode, measure, points, selectedItems, unavailableReason }: ChartFrameProps) {
  if (unavailableReason) {
    return (
      <div className="flex h-[420px] items-center justify-center border border-amber-300/30 bg-amber-300/5 p-6 text-center text-sm text-amber-200">
        {unavailableReason}
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center border border-zinc-800 bg-zinc-950 p-6 text-center text-sm text-zinc-400">
        არჩეული ფილტრებისთვის მონაცემი არ არის.
      </div>
    );
  }

  const rows = wideRows(points);
  const plannedKeys = plannedPointKeys(points);

  if (mode === "bar") {
    const latestYear = Math.max(...points.map((point) => point.year));
    const barRows = points
      .filter((point) => point.year === latestYear)
      .map((point) => ({ name: point.kaLabel, value: point.value, itemId: point.itemId, basis: point.basis }));

    return (
      <div className="h-[420px] border border-cyan-400/20 bg-black/40 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barRows}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fontSize: 11 }} />
            <YAxis stroke="#a1a1aa" tickFormatter={(value) => chartValueLabel(Number(value), measure)} width={90} />
            <Tooltip
              contentStyle={{ background: "#05070b", border: "1px solid rgba(34, 211, 238, 0.35)" }}
              formatter={(value) => chartValueLabel(Number(value), measure)}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {barRows.map((row) => (
                <Cell key={row.itemId} fill={row.basis === "planned" ? "#facc15" : "#22d3ee"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-[420px] border border-cyan-400/20 bg-black/40 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="year" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
          <YAxis stroke="#a1a1aa" tickFormatter={(value) => chartValueLabel(Number(value), measure)} width={90} />
          <Tooltip
            contentStyle={{ background: "#05070b", border: "1px solid rgba(34, 211, 238, 0.35)" }}
            formatter={(value) => chartValueLabel(Number(value), measure)}
          />
          {selectedItems.map((item) => (
            <Line
              key={item.id}
              type="monotone"
              dataKey={chartKey(item.id)}
              name={item.kaLabel}
              stroke={item.color}
              strokeWidth={2}
              dot={plannedDot(plannedKeys, chartKey(item.id))}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create table component**

Create `apps/web/components/main-explorer/explorer-table.tsx`:

```typescript
import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";
import type { ExplorerTableRow } from "../../lib/explorer/types";

type ExplorerTableProps = {
  rows: ExplorerTableRow[];
  years: number[];
};

export function ExplorerTable({ rows, years }: ExplorerTableProps) {
  return (
    <div className="overflow-x-auto border border-cyan-400/20 bg-black/40">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-3">საბიუჯეტო მუხლი</th>
            {years.map((year) => (
              <th key={year} className="px-3 py-3">
                {year}
              </th>
            ))}
            <th className="px-3 py-3">ცვლილება</th>
            <th className="px-3 py-3">წილი {years[years.length - 1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId} className="border-b border-zinc-900">
              <td className="px-3 py-3 font-medium text-zinc-100">{row.kaLabel}</td>
              {years.map((year) => (
                <td key={year} className="px-3 py-3 text-zinc-300">
                  {formatGel(row.valuesByYear[year] ?? null)}
                  {row.basisByYear[year] === "planned" ? (
                    <span className="ml-2 rounded border border-amber-300/40 px-1.5 py-0.5 text-[10px] text-amber-200">
                      გეგმა
                    </span>
                  ) : null}
                </td>
              ))}
              <td className="px-3 py-3 text-zinc-300">{formatSignedPercent(row.change)}</td>
              <td className="px-3 py-3 text-zinc-300">{formatPercent(row.shareEndYear)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Wire chart and table into main explorer**

Modify `apps/web/components/main-explorer/main-explorer.tsx`:

- Render `ChartFrame` when `chartMode` is `line` or `bar`.
- Render `ExplorerTable` when `chartMode` is `table`. Filter `model.tableRows` to only include rows whose `itemId` is in `selectedItemIds` before passing to `ExplorerTable`. The spec rule "table mode has no series limit" means no 8-series cap — not "ignore selection." Users still choose which items appear; they just aren't capped at 8.
- Show planned badge near the header when `model.hasPlannedValues` is true and verify `ChartFrame` renders planned line dots / planned bar color for planned active values.
- Pass `chartMode` into `SeriesSelector` so the 8-series limit applies only to line/bar charts, not table mode.
- Bar mode must render the single `წელი` select from `ExplorerControls`, use `barYear` for both model start/end years, and preserve the line/table range state.

- [ ] **Step 4: Verify build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/components/main-explorer
git commit -m "feat: render main explorer charts and table"
```

Expected:

```text
[main
```

---

### Task 7: Add CSV Download, Source Label, and Below-Scroll Summaries

**Files:**

- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Create: `apps/web/components/main-explorer/period-summary.tsx`

- [ ] **Step 1: Create period summary component**

Create `apps/web/components/main-explorer/period-summary.tsx`:

```typescript
import { formatGel, formatSignedPercent } from "../../lib/explorer/format";
import type { ExplorerTableRow, PeriodSummary } from "../../lib/explorer/types";

type PeriodSummaryProps = {
  years: number[];
  summary: PeriodSummary;
  rows: ExplorerTableRow[];
  topGrowth: ExplorerTableRow[];
  bottomGrowth: ExplorerTableRow[];
};

export function PeriodSummaryPanel({ years, summary, rows, topGrowth, bottomGrowth }: PeriodSummaryProps) {
  const startYear = years[0];
  const endYear = years[years.length - 1];

  return (
    <section className="grid gap-4 lg:grid-cols-4">
      <div className="border border-cyan-400/20 bg-black/40 p-4">
        <p className="text-xs uppercase text-zinc-500">ჯამური ცვლილება</p>
        <p className="mt-2 text-lg font-semibold text-white">{formatSignedPercent(summary.totalChange)}</p>
      </div>
      <div className="border border-cyan-400/20 bg-black/40 p-4">
        <p className="text-xs uppercase text-zinc-500">ყველაზე დიდი GEL მატება</p>
        <p className="mt-2 text-lg font-semibold text-white">
          {summary.largestGelIncrease?.kaLabel ?? "მონაცემი არ არის"}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {startYear} to {endYear}:{" "}
          {summary.largestGelIncrease
            ? formatGel(
                (summary.largestGelIncrease.valuesByYear[endYear ?? 0] ?? 0) -
                  (summary.largestGelIncrease.valuesByYear[startYear ?? 0] ?? 0),
              )
            : "მონაცემი არ არის"}
        </p>
      </div>
      <div className="border border-lime-300/20 bg-black/40 p-4">
        <p className="text-xs uppercase text-zinc-500">ყველაზე სწრაფი ზრდა</p>
        <p className="mt-2 text-lg font-semibold text-white">
          {summary.fastestGrowth?.kaLabel ?? "მონაცემი არ არის"}
        </p>
        <p className="mt-1 text-sm text-lime-200">{formatSignedPercent(summary.fastestGrowth?.change ?? null)}</p>
      </div>
      <div className="border border-amber-300/20 bg-black/40 p-4">
        <p className="text-xs uppercase text-zinc-500">ყველაზე დაბალი ზრდა</p>
        <p className="mt-2 text-lg font-semibold text-white">
          {summary.lowestGrowth?.kaLabel ?? "მონაცემი არ არის"}
        </p>
        <p className="mt-1 text-sm text-amber-200">{formatSignedPercent(summary.lowestGrowth?.change ?? null)}</p>
      </div>
      <div className="border border-fuchsia-300/20 bg-black/40 p-4">
        <p className="text-xs uppercase text-zinc-500">წილის ყველაზე დიდი ცვლილება</p>
        <p className="mt-2 text-lg font-semibold text-white">
          {summary.biggestShareChange?.kaLabel ?? "მონაცემი არ არის"}
        </p>
      </div>
      <MovementList title="ზრდის Top 3" rows={topGrowth} />
      <MovementList title="ყველაზე დაბალი ზრდის 3" rows={bottomGrowth} />
      <StartEndComparison rows={rows} startYear={startYear} endYear={endYear} />
    </section>
  );
}

function MovementList({ title, rows }: { title: string; rows: ExplorerTableRow[] }) {
  return (
    <div className="border border-zinc-800 bg-black/40 p-4 lg:col-span-1">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={row.itemId} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-zinc-300">
              {index + 1}. {row.kaLabel}
            </span>
            <span className="font-mono text-zinc-100">{formatSignedPercent(row.change)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StartEndComparison({
  rows,
  startYear,
  endYear,
}: {
  rows: ExplorerTableRow[];
  startYear: number | undefined;
  endYear: number | undefined;
}) {
  if (startYear === undefined || endYear === undefined) return null;

  return (
    <div className="border border-zinc-800 bg-black/40 p-4 lg:col-span-2">
      <h3 className="text-sm font-semibold text-white">პერიოდის დასაწყისი და დასასრული</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-2 pr-4">მუხლი</th>
              <th className="py-2 pr-4">{startYear}</th>
              <th className="py-2 pr-4">{endYear}</th>
              <th className="py-2">ცვლილება</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((row) => (
              <tr key={row.itemId} className="border-t border-zinc-900">
                <td className="py-2 pr-4 text-zinc-200">{row.kaLabel}</td>
                <td className="py-2 pr-4 text-zinc-400">{formatGel(row.valuesByYear[startYear] ?? null)}</td>
                <td className="py-2 pr-4 text-zinc-400">{formatGel(row.valuesByYear[endYear] ?? null)}</td>
                <td className="py-2 text-zinc-300">{formatSignedPercent(row.change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSV download handler**

Modify `apps/web/components/main-explorer/main-explorer.tsx` to import `buildExplorerCsv` and add:

```typescript
function downloadCsv() {
  const csv = buildExplorerCsv(model.tableRows, model.years);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `geodata-budget-${side}-${startYear}-${endYear}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
```

Render a button near the chart controls:

```typescript
<button
  type="button"
  onClick={downloadCsv}
  className="h-10 rounded border border-cyan-300 px-4 font-mono text-xs uppercase text-cyan-100 hover:bg-cyan-300 hover:text-black"
>
  CSV ჩამოტვირთვა
</button>
```

- [ ] **Step 3: Render source label and summaries**

In `main-explorer.tsx`, render:

```typescript
<p className="text-xs text-zinc-500">
  მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები. ბოლო განახლება: {lastUpdatedAt}.
  {model.hasPlannedValues ? " აქტიურ მნიშვნელობებში არის გეგმური ბიუჯეტის მონაცემები." : ""}
</p>
<PeriodSummaryPanel
  years={model.years}
  summary={model.summary}
  rows={model.tableRows}
  topGrowth={model.topGrowth}
  bottomGrowth={model.bottomGrowth}
/>
```

- [ ] **Step 4: Verify build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/components/main-explorer apps/web/lib/explorer/csvExport.ts
git commit -m "feat: add explorer export and summaries"
```

Expected:

```text
[main
```

---

### Task 8: Apply Dark Terminal Visual System and Mobile Layout

**Files:**

- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`

- [ ] **Step 1: Update global CSS**

Modify `apps/web/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #05070b;
  --foreground: #f4f4f5;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

* {
  box-sizing: border-box;
}

body {
  background:
    linear-gradient(180deg, rgba(34, 211, 238, 0.08), transparent 340px),
    var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

button,
select {
  font: inherit;
}
```

- [ ] **Step 2: Confirm layout behavior in `main-explorer.tsx`**

Ensure first viewport uses:

```typescript
<section className="grid min-h-[calc(100vh-2rem)] gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
```

Ensure mobile layout stacks chart first, selector below:

```typescript
<div className="order-1 flex min-w-0 flex-col gap-4 lg:order-none">
```

```typescript
<div className="order-2 lg:order-none">
  <SeriesSelector ... />
</div>
```

- [ ] **Step 3: Run lint, tests, and build**

Run:

```powershell
cd apps/web
npm test
```

Expected:

```text
passed
```

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

Run:

```powershell
cd apps/web
npm run lint
```

Expected:

```text
No problems
```

- [ ] **Step 4: Commit**

Run:

```powershell
git add apps/web/app/globals.css apps/web/components/main-explorer/main-explorer.tsx
git commit -m "style: apply geodata explorer visual system"
```

Expected:

```text
[main
```

---

## Final Verification

- [ ] **Step 1: Run all tests**

Run:

```powershell
cd apps/web
npm test
```

Expected:

```text
passed
```

- [ ] **Step 2: Run foundation validation**

Run:

```powershell
cd apps/web
npm run data:validate
```

Expected:

```text
Validated taxonomy rows:
Validated glossary rows:
Validated mapping rows:
Validated fact rows:
Report written:
```

- [ ] **Step 3: Run production build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 4: Run local browser check**

Run:

```powershell
cd apps/web
npm run dev
```

Expected:

```text
Local: http://localhost:3000
```

Open `http://localhost:3000` in the Codex Browser and verify:

- The starter Next.js page is gone.
- The first view is the budget explorer, not a marketing page.
- Expenditure is the default side.
- ხაზი is the default chart mode.
- ნომინალური GEL is the default measure.
- The chart renders at least one series from seed data.
- Revenue switching preserves expenditure selection when switching back.
- Bar mode shows one `წელი` select and returning to line/table restores the prior year range.
- Table mode shows exact values and planned badges.
- Table mode allows selecting more than 8 rows; line/bar modes block the 9th chart series with a clear Georgian message.
- Planned chart values have a visible distinct marker or planned color.
- Share of GDP shows a clear Georgian unavailable state.
- CSV export downloads visible filtered rows with `source_name`, `source_url_or_file`, and `last_reviewed_at`.
- Below-scroll content includes selected-period cards, top/bottom movers, and start-vs-end comparison.
- Public control labels are Georgian-first.
- Mobile viewport stacks chart before selector.

- [ ] **Step 5: Commit verification notes only if files changed**

If browser verification requires small copy/layout fixes, commit them:

```powershell
git add apps/web
git commit -m "fix: polish main explorer verification issues"
```

If no files changed, do not create an empty commit.

---

## Self-Review

### Spec Coverage

Covered:

- Budget Explorer as first experience.
- Expenditure/revenue switcher.
- Multi-year line mode.
- Bar mode with a true single-year control and preserved multi-year range state.
- Table mode with exact values and no 8-series limit.
- Nominal, percent change, and share-of-total measures.
- Explicit Share of GDP unavailable state.
- Multi-series selection with an 8-series limit only for chart modes.
- Separate remembered expenditure/revenue selections.
- Planned-value badges plus distinct planned markers/colors in charts.
- CSV export from visible filtered data with source metadata columns.
- Minimal source label.
- Below-scroll selected-period cards, top/bottom movers, and start-vs-end comparison.
- Georgian-first public UI copy for controls, states, source label, and export button.
- Dark terminal visual direction with readability guardrails.
- Mobile stacked layout.

Deferred by design:

- Stacked mode because compatibility and double-counting rules deserve their own focused implementation.
- Single-year snapshot because it is Plan 3.
- Share of GDP because trusted GDP data source is unresolved.
- Production DB reads because sample/foundation data remains the Plan 2 source.
- Public provenance panels because v1 only needs minimal public source labeling.

### Placeholder Scan

This plan avoids open implementation placeholders. Deferred work is named as out of scope and mapped to later plans.

### Type Consistency

Shared names are consistent across tasks:

- `ExplorerSide`
- `ChartMode`
- `MeasureMode`
- `ExplorerItem`
- `ExplorerPoint`
- `ExplorerTableRow`
- `SourceMetadata`
- `PeriodSummary`
- `buildExplorerModel`
- `getDefaultSelection`
- `buildExplorerCsv`
- `MainExplorer`
