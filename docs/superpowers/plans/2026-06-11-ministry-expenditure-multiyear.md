# Ministry Expenditure Multi-Year Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-year expenditure grouping switch that lets users compare public spending fields or ministry/program administrative spending, with programs visible only when they reach 100,000,000 GEL in any year from 2017-2025.

**Architecture:** Keep public spending fields and administrative spending as separate fact sources. Extend the explorer model with an explicit expenditure grouping input, normalize admin facts into the existing chart/table shape at the model boundary, and render hierarchy only in the selector. Keep single-year code untouched.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright, csv-parse, zod, existing local CSV data pipeline.

---

## Current Starting Point

The worktree already contains uncommitted admin-spending files. Treat them as the starting point and do not revert them:

- `apps/web/lib/data/adminSpending/categories.ts`
- `apps/web/lib/data/adminSpending/extractWorkbooks.ts`
- `apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts`
- `apps/web/lib/data/adminSpending/types.ts`
- `apps/web/scripts/generate-admin-spending-data.ts`
- `apps/web/tests/data/adminSpending.test.ts`
- `data/imports/admin-spending-facts-2017-2025.csv`
- `data/mappings/review/admin-spending-major-program-review-2017-2025.csv`
- `data/staging/admin-spending-official-rows-2017-2025.csv`
- `data/taxonomy/admin-spending-categories.json`

The approved design spec is:

- `docs/superpowers/specs/2026-06-11-ministry-expenditure-multiyear-design.md`

## File Structure

- Modify `apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts`: change the major-program threshold to 100M and keep report metadata accurate.
- Modify `apps/web/tests/data/adminSpending.test.ts`: update threshold tests so 99M is excluded and 101M includes the whole eligible series.
- Create `apps/web/lib/data/adminSpending/importAdminSpendingFacts.ts`: parse generated admin spending CSV for app use.
- Modify `apps/web/app/page.tsx`: load admin facts and admin category taxonomy.
- Modify `apps/web/components/main-explorer/main-explorer.tsx`: own expenditure grouping state, pass admin data to the explorer model, and render the grouping switch only for expenditure multi-year.
- Create `apps/web/components/main-explorer/expenditure-grouping-control.tsx`: small segmented control for `Fields | Ministries`.
- Modify `apps/web/lib/explorer/types.ts`: add expenditure grouping and hierarchy metadata fields.
- Modify `apps/web/lib/explorer/explorerData.ts`: model either public facts or admin facts without mixing them.
- Modify `apps/web/components/main-explorer/series-selector.tsx`: render nested admin program rows under parent ministry rows.
- Modify `apps/web/lib/explorer/csvExport.ts`: export active grouping metadata.
- Modify `apps/web/tests/explorer/explorerData.test.ts`: cover admin grouping model behavior.
- Modify `apps/web/tests/explorer/integration.test.ts`: cover real admin CSV integration.
- Modify `apps/web/tests/explorer/csvExport.test.ts`: cover admin metadata columns.
- Modify `apps/web/tests/browser/main-explorer.spec.ts`: cover the grouping switch and nested selector behavior.

---

### Task 1: Raise Admin Program Threshold To 100M

**Files:**
- Modify: `apps/web/tests/data/adminSpending.test.ts`
- Modify: `apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts`
- Generated: `data/imports/admin-spending-facts-2017-2025.csv`
- Generated: `data/mappings/review/admin-spending-major-program-review-2017-2025.csv`
- Generated: `data/reports/admin-spending-2017-2025-report.json`

- [ ] **Step 1: Write the failing threshold test**

In `apps/web/tests/data/adminSpending.test.ts`, replace the current first test named `keeps every year of a major program series once any year reaches 50M GEL` with:

```ts
  it("keeps every year of a major program series once any year reaches 100M GEL", () => {
    const rows = [
      officialRow(2024, "32 02", "General education", 99_000, {
        depth: 2,
        isLeafCode: false,
        programCode: "32 02",
        programLabelKa: "General education",
        subprogramCode: null,
        subprogramLabelKa: null,
      }),
      officialRow(2025, "32 02", "General education", 101_000, {
        depth: 2,
        isLeafCode: false,
        programCode: "32 02",
        programLabelKa: "General education",
        subprogramCode: null,
        subprogramLabelKa: null,
      }),
    ];

    const facts = generateAdminSpendingFacts(rows);
    const programFacts = facts.filter((fact) => fact.level === "major_program");

    expect(programFacts).toHaveLength(2);
    expect(programFacts.map((fact) => fact.year)).toEqual([2024, 2025]);
    expect(programFacts[0]).toMatchObject({
      parentItemId: "admin_spending.education_science_youth",
      amountGel: 99_000_000,
    });
    expect(programFacts[0].itemId).toMatch(/^admin_program\.32_02\./);
  });

  it("excludes program series that never reach 100M GEL", () => {
    const rows = [
      officialRow(2024, "32 02", "General education", 99_000, {
        depth: 2,
        isLeafCode: false,
        programCode: "32 02",
        programLabelKa: "General education",
        subprogramCode: null,
        subprogramLabelKa: null,
      }),
      officialRow(2025, "32 02", "General education", 99_999, {
        depth: 2,
        isLeafCode: false,
        programCode: "32 02",
        programLabelKa: "General education",
        subprogramCode: null,
        subprogramLabelKa: null,
      }),
    ];

    const programFacts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "major_program");

    expect(programFacts).toEqual([]);
  });
```

- [ ] **Step 2: Run the focused test and verify failure**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads tests/data/adminSpending.test.ts
```

Expected: FAIL because `MAJOR_PROGRAM_THRESHOLD_GEL` is still `50_000_000`.

- [ ] **Step 3: Update the threshold constant**

In `apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts`, replace:

```ts
export const MAJOR_PROGRAM_THRESHOLD_GEL = 50_000_000;
```

with:

```ts
export const MAJOR_PROGRAM_THRESHOLD_GEL = 100_000_000;
```

- [ ] **Step 4: Run the focused test and verify pass**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads tests/data/adminSpending.test.ts
```

Expected: PASS.

- [ ] **Step 5: Regenerate admin spending outputs**

Run from `apps/web`:

```powershell
npm.cmd run data:generate-admin-spending
```

Expected output includes successful report lines and no reconciliation error. Confirm `data/reports/admin-spending-2017-2025-report.json` has:

```json
"majorProgramThresholdGel": 100000000
```

- [ ] **Step 6: Commit the threshold change**

Stage only files from this task:

```powershell
git add -- apps/web/tests/data/adminSpending.test.ts apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts data/imports/admin-spending-facts-2017-2025.csv data/mappings/review/admin-spending-major-program-review-2017-2025.csv data/reports/admin-spending-2017-2025-report.json
git commit -m "data: raise admin program threshold"
```

---

### Task 2: Add Admin Spending Loader

**Files:**
- Create: `apps/web/lib/data/adminSpending/importAdminSpendingFacts.ts`
- Modify: `apps/web/tests/data/adminSpending.test.ts`

- [ ] **Step 1: Write loader tests**

Append these tests to `apps/web/tests/data/adminSpending.test.ts`:

```ts
import { loadAdminSpendingFacts } from "../../lib/data/adminSpending/importAdminSpendingFacts";

  it("loads generated admin spending facts with parent links for major programs", async () => {
    const facts = await loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2017-2025.csv");
    const categories = facts.filter((fact) => fact.level === "admin_category");
    const programs = facts.filter((fact) => fact.level === "major_program");

    expect(categories.length).toBeGreaterThan(0);
    expect(programs.length).toBeGreaterThan(0);
    expect(programs.every((fact) => fact.parentItemId?.startsWith("admin_spending."))).toBe(true);
    expect(Math.max(...programs.map((fact) => fact.amountGel))).toBeGreaterThanOrEqual(100_000_000);
  });
```

Move the new import to the top-level import block so the file compiles.

- [ ] **Step 2: Run the loader test and verify failure**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads tests/data/adminSpending.test.ts
```

Expected: FAIL because `importAdminSpendingFacts.ts` does not exist.

- [ ] **Step 3: Create the loader**

Create `apps/web/lib/data/adminSpending/importAdminSpendingFacts.ts`:

```ts
import { z } from "zod";
import { readCsvRecords } from "../csv";
import type { AdminSpendingFact, AdminSpendingFactLevel } from "./types";

const adminSpendingFactRowSchema = z.object({
  year: z.coerce.number().int(),
  item_id: z.string().min(1),
  parent_item_id: z.string(),
  level: z.enum(["admin_category", "major_program"]),
  amount_gel: z.coerce.number().nonnegative(),
  basis: z.literal("actual"),
  source_id: z.string().min(1),
  official_code: z.string(),
  official_label_ka: z.string(),
  official_institution_code: z.string(),
  official_institution_label_ka: z.string(),
  mapping_confidence: z.enum(["high", "medium", "low"]),
  mapping_notes: z.string(),
});

export async function loadAdminSpendingFacts(relativePath: string): Promise<AdminSpendingFact[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = adminSpendingFactRowSchema.parse(record);

    return {
      year: row.year,
      itemId: row.item_id,
      parentItemId: row.parent_item_id.trim() || null,
      level: row.level as AdminSpendingFactLevel,
      amountGel: row.amount_gel,
      basis: row.basis,
      sourceId: row.source_id,
      officialCode: row.official_code.trim() || null,
      officialLabelKa: row.official_label_ka.trim() || null,
      officialInstitutionCode: row.official_institution_code.trim() || null,
      officialInstitutionLabelKa: row.official_institution_label_ka.trim() || null,
      mappingConfidence: row.mapping_confidence,
      mappingNotes: row.mapping_notes,
    };
  });
}
```

- [ ] **Step 4: Run the loader test and verify pass**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads tests/data/adminSpending.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the loader**

```powershell
git add -- apps/web/lib/data/adminSpending/importAdminSpendingFacts.ts apps/web/tests/data/adminSpending.test.ts
git commit -m "data: load admin spending facts"
```

---

### Task 3: Extend Explorer Model For Ministry Grouping

**Files:**
- Modify: `apps/web/lib/explorer/types.ts`
- Modify: `apps/web/lib/explorer/explorerData.ts`
- Modify: `apps/web/tests/explorer/explorerData.test.ts`

- [ ] **Step 1: Add model tests for admin grouping**

In `apps/web/tests/explorer/explorerData.test.ts`, add imports:

```ts
import type { AdminSpendingCategory, AdminSpendingFact } from "../../lib/data/adminSpending/types";
```

Add test data near the existing `facts` fixture:

```ts
const adminCategories = new Map<string, AdminSpendingCategory>([
  ["admin_spending.education_science_youth", { id: "admin_spending.education_science_youth", kaLabel: "Education ministry", enLabel: "Education ministry", sortOrder: 10 }],
  ["admin_spending.health_social_affairs", { id: "admin_spending.health_social_affairs", kaLabel: "Health ministry", enLabel: "Health ministry", sortOrder: 20 }],
]);

const adminFacts: AdminSpendingFact[] = [
  { year: 2024, itemId: "admin_spending.education_science_youth", parentItemId: null, level: "admin_category", amountGel: 300, basis: "actual", sourceId: "source.one", officialCode: null, officialLabelKa: null, officialInstitutionCode: null, officialInstitutionLabelKa: null, mappingConfidence: "high", mappingNotes: "" },
  { year: 2025, itemId: "admin_spending.education_science_youth", parentItemId: null, level: "admin_category", amountGel: 500, basis: "actual", sourceId: "source.two", officialCode: null, officialLabelKa: null, officialInstitutionCode: null, officialInstitutionLabelKa: null, mappingConfidence: "high", mappingNotes: "" },
  { year: 2024, itemId: "admin_program.32_02.aaaa1111", parentItemId: "admin_spending.education_science_youth", level: "major_program", amountGel: 200, basis: "actual", sourceId: "source.one", officialCode: "32 02", officialLabelKa: "General education", officialInstitutionCode: "32 00", officialInstitutionLabelKa: "Education ministry", mappingConfidence: "medium", mappingNotes: "" },
  { year: 2025, itemId: "admin_program.32_02.aaaa1111", parentItemId: "admin_spending.education_science_youth", level: "major_program", amountGel: 400, basis: "actual", sourceId: "source.two", officialCode: "32 02", officialLabelKa: "General education", officialInstitutionCode: "32 00", officialInstitutionLabelKa: "Education ministry", mappingConfidence: "medium", mappingNotes: "" },
  { year: 2025, itemId: "admin_spending.health_social_affairs", parentItemId: null, level: "admin_category", amountGel: 700, basis: "actual", sourceId: "source.two", officialCode: null, officialLabelKa: null, officialInstitutionCode: null, officialInstitutionLabelKa: null, mappingConfidence: "high", mappingNotes: "" },
];
```

Add tests:

```ts
  it("returns a ministry default selection for admin expenditure grouping", () => {
    expect(getDefaultSelection("expenditure", facts, "ministries", adminFacts)).toEqual(["admin_spending.total"]);
  });

  it("builds nested ministry and major-program rows without mixing public spending fields", () => {
    const model = buildExplorerModel({
      facts,
      adminFacts,
      adminCategories,
      glossary,
      sourceDocuments,
      side: "expenditure",
      expenditureGrouping: "ministries",
      selectedItemIds: ["admin_spending.total", "admin_program.32_02.aaaa1111"],
      startYear: 2024,
      endYear: 2025,
      measure: "share_of_total",
    });

    expect(model.items.map((item) => item.id)).toEqual([
      "admin_spending.total",
      "admin_spending.health_social_affairs",
      "admin_spending.education_science_youth",
      "admin_program.32_02.aaaa1111",
    ]);
    expect(model.items.find((item) => item.id === "admin_program.32_02.aaaa1111")).toEqual(
      expect.objectContaining({
        parentItemId: "admin_spending.education_science_youth",
        level: "major_program",
        kaLabel: "General education",
        detailLabel: "32 02",
      }),
    );
    expect(model.items.some((item) => item.id === "spending.health")).toBe(false);
    expect(model.totalRow?.valuesByYear[2025]).toBe(1200);
    expect(model.points.find((point) => point.itemId === "admin_program.32_02.aaaa1111" && point.year === 2025)?.value).toBeCloseTo(400 / 1200, 6);
  });
```

- [ ] **Step 2: Run the model tests and verify failure**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads tests/explorer/explorerData.test.ts
```

Expected: FAIL because model inputs and item hierarchy fields are not implemented.

- [ ] **Step 3: Add hierarchy and grouping types**

In `apps/web/lib/explorer/types.ts`, add:

```ts
export const EXPENDITURE_GROUPINGS = ["fields", "ministries"] as const;
export type ExpenditureGrouping = (typeof EXPENDITURE_GROUPINGS)[number];
export type ExplorerItemLevel = "total" | "public_field" | "admin_category" | "major_program";
```

Extend `ExplorerItem`:

```ts
export type ExplorerItem = {
  id: string;
  side: ExplorerSide;
  kaLabel: string;
  enLabel: string;
  color: string;
  sortOrder: number;
  parentItemId: string | null;
  level: ExplorerItemLevel;
  detailLabel: string | null;
};
```

- [ ] **Step 4: Extend the explorer model input**

In `apps/web/lib/explorer/explorerData.ts`, import admin types and `ExpenditureGrouping`:

```ts
import type { AdminSpendingCategory, AdminSpendingFact } from "../data/adminSpending/types";
import type { ExpenditureGrouping } from "./types";
```

Extend `ExplorerModelInput`:

```ts
  adminFacts?: AdminSpendingFact[];
  adminCategories?: Map<string, AdminSpendingCategory>;
  expenditureGrouping?: ExpenditureGrouping;
```

Update `totalIdFor`:

```ts
function totalIdFor(side: ExplorerSide, expenditureGrouping: ExpenditureGrouping = "fields"): string {
  if (side === "revenue") return "revenue.total";
  return expenditureGrouping === "ministries" ? "admin_spending.total" : "expenditure.total";
}
```

Update `isDerivedTotalItemId`:

```ts
export function isDerivedTotalItemId(itemId: string): boolean {
  return itemId === "expenditure.total" || itemId === "revenue.total" || itemId === "admin_spending.total";
}
```

- [ ] **Step 5: Add admin labels and source fact normalization**

In `apps/web/lib/explorer/explorerData.ts`, add this internal type near `ExplorerModel`:

```ts
type ModelFact = {
  year: number;
  side: ExplorerSide;
  itemId: string;
  amountGel: number;
  basis: "actual" | "planned";
  sourceId: string;
  parentItemId: string | null;
  level: ExplorerItem["level"];
  kaLabel: string | null;
  enLabel: string | null;
  detailLabel: string | null;
};
```

Add helper:

```ts
function adminLabelFor(fact: AdminSpendingFact, categories: Map<string, AdminSpendingCategory>): Pick<ModelFact, "kaLabel" | "enLabel" | "detailLabel"> {
  if (fact.level === "admin_category") {
    const category = categories.get(fact.itemId);
    return {
      kaLabel: category?.kaLabel ?? fact.itemId,
      enLabel: category?.enLabel ?? fact.itemId,
      detailLabel: null,
    };
  }

  return {
    kaLabel: fact.officialLabelKa ?? fact.itemId,
    enLabel: fact.officialLabelKa ?? fact.itemId,
    detailLabel: fact.officialCode,
  };
}
```

Inside `buildExplorerModel`, derive grouping and active model facts:

```ts
  const expenditureGrouping = input.side === "expenditure" ? input.expenditureGrouping ?? "fields" : "fields";
  const active: ModelFact[] =
    input.side === "expenditure" && expenditureGrouping === "ministries"
      ? (input.adminFacts ?? []).map((fact) => ({
          year: fact.year,
          side: "expenditure",
          itemId: fact.itemId,
          amountGel: fact.amountGel,
          basis: fact.basis,
          sourceId: fact.sourceId,
          parentItemId: fact.parentItemId,
          level: fact.level,
          ...adminLabelFor(fact, input.adminCategories ?? new Map()),
        }))
      : chooseActivePublicFacts(input.facts)
          .filter((fact) => fact.side === input.side)
          .map((fact) => ({
            year: fact.year,
            side: fact.side,
            itemId: fact.itemId,
            amountGel: fact.amountGel,
            basis: fact.basis,
            sourceId: fact.sourceId,
            parentItemId: null,
            level: fact.side === "revenue" ? "public_field" : "public_field",
            kaLabel: null,
            enLabel: null,
            detailLabel: null,
          }));
```

Remove the existing line:

```ts
  const active = chooseActivePublicFacts(input.facts).filter((fact) => fact.side === input.side);
```

- [ ] **Step 6: Build nested item ordering**

In `buildExplorerModel`, replace the `itemIds` and `items` construction with:

```ts
  const totalId = totalIdFor(input.side, expenditureGrouping);
  const allNonTotalIds = Array.from(new Set(active.map((fact) => fact.itemId)));
  const modelFactsById = new Map<string, ModelFact>();

  for (const fact of active) {
    if (!modelFactsById.has(fact.itemId)) modelFactsById.set(fact.itemId, fact);
  }

  const sortedIds =
    expenditureGrouping === "ministries"
      ? allNonTotalIds
          .filter((id) => modelFactsById.get(id)?.level === "admin_category")
          .sort((left, right) => compareBaselineAmountDesc(left, right, baselineAmounts))
          .flatMap((parentId) => [
            parentId,
            ...allNonTotalIds
              .filter((id) => modelFactsById.get(id)?.parentItemId === parentId)
              .sort((left, right) => compareBaselineAmountDesc(left, right, baselineAmounts)),
          ])
      : allNonTotalIds.sort((left, right) => compareBaselineAmountDesc(left, right, baselineAmounts));

  const itemIds = [totalId, ...sortedIds];
  const items = itemIds.map((id, index) => {
    const fact = modelFactsById.get(id);
    const labels =
      fact?.kaLabel && fact.enLabel
        ? { kaLabel: fact.kaLabel, enLabel: fact.enLabel }
        : labelsFor(id, input.side, input.glossary, expenditureGrouping);

    return {
      id,
      side: input.side,
      ...labels,
      color: palette[index % palette.length] ?? "#22d3ee",
      sortOrder: index + 1,
      parentItemId: fact?.parentItemId ?? null,
      level: id === totalId ? "total" : fact?.level ?? "public_field",
      detailLabel: fact?.detailLabel ?? null,
    };
  });
```

Update `labelsFor` signature and total label handling:

```ts
function labelsFor(id: string, side: ExplorerSide, glossary: Map<string, GlossaryEntry>, expenditureGrouping: ExpenditureGrouping = "fields") {
  if (id === totalIdFor(side, expenditureGrouping)) {
    if (side === "revenue") return { kaLabel: "შემოსავლები სულ", enLabel: "Total revenue" };
    return expenditureGrouping === "ministries"
      ? { kaLabel: "ადმინისტრაციული ხარჯები სულ", enLabel: "Total administrative expenditure" }
      : { kaLabel: "ხარჯები სულ", enLabel: "Total expenditure" };
  }
```

- [ ] **Step 7: Update default selection**

Change `getDefaultSelection` signature:

```ts
export function getDefaultSelection(
  side: ExplorerSide,
  facts: BudgetFactImportRow[],
  expenditureGrouping: ExpenditureGrouping = "fields",
  adminFacts: AdminSpendingFact[] = [],
): string[] {
  if (side === "expenditure" && expenditureGrouping === "ministries") {
    return adminFacts.length > 0 ? [totalIdFor(side, expenditureGrouping)] : [];
  }

  return chooseActivePublicFacts(facts).some((fact) => fact.side === side) ? [totalIdFor(side, expenditureGrouping)] : [];
}
```

- [ ] **Step 8: Run model tests**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads tests/explorer/explorerData.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit model changes**

```powershell
git add -- apps/web/lib/explorer/types.ts apps/web/lib/explorer/explorerData.ts apps/web/tests/explorer/explorerData.test.ts
git commit -m "feat: model ministry expenditure grouping"
```

---

### Task 4: Load Admin Data Into The Page And Add Grouping UI

**Files:**
- Create: `apps/web/components/main-explorer/expenditure-grouping-control.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/components/main-explorer/series-selector.tsx`

- [ ] **Step 1: Create grouping control component**

Create `apps/web/components/main-explorer/expenditure-grouping-control.tsx`:

```tsx
import type { ExpenditureGrouping } from "../../lib/explorer/types";
import { SegmentedControl } from "../ui/segmented-control";

type ExpenditureGroupingControlProps = {
  value: ExpenditureGrouping;
  onChange: (value: ExpenditureGrouping) => void;
};

export function ExpenditureGroupingControl({ value, onChange }: ExpenditureGroupingControlProps) {
  return (
    <div data-testid="expenditure-grouping-control" className="flex justify-start">
      <SegmentedControl
        label="Expenditure grouping"
        value={value}
        onChange={onChange}
        options={[
          { value: "fields", label: "Fields", testId: "grouping-fields" },
          { value: "ministries", label: "Ministries", testId: "grouping-ministries" },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Load admin facts and category taxonomy in `page.tsx`**

In `apps/web/app/page.tsx`, add imports:

```ts
import { loadAdminSpendingFacts } from "../lib/data/adminSpending/importAdminSpendingFacts";
import type { AdminSpendingCategory } from "../lib/data/adminSpending/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
```

Add helper above `Home`:

```ts
async function loadAdminSpendingCategories(relativePath: string): Promise<AdminSpendingCategory[]> {
  const filePath = path.resolve(process.cwd(), relativePath);
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as AdminSpendingCategory[];
}
```

Change the `Promise.all` block:

```ts
  const [facts, adminFacts, adminCategories, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactRows("../../data/imports/budget-facts-2017-2025.csv"),
    loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2017-2025.csv"),
    loadAdminSpendingCategories("../../data/taxonomy/admin-spending-categories.json"),
    loadGlossary("../../data/glossary/category-glossary.csv"),
    loadSourceDocuments("../../data/sources/source-documents.csv"),
  ]);
```

Pass new props:

```tsx
      adminFacts={adminFacts}
      adminCategories={adminCategories}
```

- [ ] **Step 3: Add grouping state in `main-explorer.tsx`**

Add imports:

```ts
import type { AdminSpendingCategory, AdminSpendingFact } from "../../lib/data/adminSpending/types";
import type { ExpenditureGrouping } from "../../lib/explorer/types";
import { ExpenditureGroupingControl } from "./expenditure-grouping-control";
```

Extend props:

```ts
  adminFacts: AdminSpendingFact[];
  adminCategories: AdminSpendingCategory[];
```

Update component signature:

```ts
export function MainExplorer({ facts, adminFacts, adminCategories, glossaryEntries, sourceDocuments, lastUpdatedAt }: MainExplorerProps) {
```

Add state and maps:

```ts
  const adminCategoryMap = useMemo(() => new Map(adminCategories.map((entry) => [entry.id, entry])), [adminCategories]);
  const [expenditureGrouping, setExpenditureGrouping] = useState<ExpenditureGrouping>("fields");
```

Change selections state:

```ts
  const [selections, setSelections] = useState<Record<ExplorerSide, Record<ExpenditureGrouping, string[]> | string[]>>({
    expenditure: {
      fields: getDefaultSelection("expenditure", facts),
      ministries: getDefaultSelection("expenditure", facts, "ministries", adminFacts),
    },
    revenue: getDefaultSelection("revenue", facts),
  });
```

Add selected IDs helper:

```ts
  const selectedIds =
    side === "expenditure"
      ? (selections.expenditure as Record<ExpenditureGrouping, string[]>)[expenditureGrouping]
      : (selections.revenue as string[]);
```

Pass grouping to model:

```ts
    adminFacts,
    adminCategories: adminCategoryMap,
    expenditureGrouping,
```

Add handler:

```ts
  function handleExpenditureGroupingChange(nextGrouping: ExpenditureGrouping) {
    setExpenditureGrouping(nextGrouping);
    setLimitMessage(null);
  }
```

Change `handleToggle` to update the nested expenditure grouping selection:

```ts
      if (side === "expenditure") {
        const expenditureSelections = current.expenditure as Record<ExpenditureGrouping, string[]>;
        const currentSideSelection = expenditureSelections[expenditureGrouping];
        const alreadySelected = currentSideSelection.includes(itemId);

        if (alreadySelected) {
          return {
            ...current,
            expenditure: {
              ...expenditureSelections,
              [expenditureGrouping]: currentSideSelection.filter((id) => id !== itemId),
            },
          };
        }

        if (chartMode !== "table" && currentSideSelection.length >= MAX_CHART_SERIES) {
          setLimitMessage(`გრაფიკზე მაქსიმუმ ${MAX_CHART_SERIES} სერია შეიძლება. ცხრილის რეჟიმში ლიმიტი არ არის.`);
          return current;
        }

        return {
          ...current,
          expenditure: {
            ...expenditureSelections,
            [expenditureGrouping]: [...currentSideSelection, itemId],
          },
        };
      }
```

Keep the existing revenue branch after this block, using `const currentSideSelection = current.revenue as string[];`.

- [ ] **Step 4: Render grouping control only for expenditure multi-year**

In `main-explorer.tsx`, directly under the `h1`, add:

```tsx
              {viewMode === "multi_year" && side === "expenditure" ? (
                <ExpenditureGroupingControl value={expenditureGrouping} onChange={handleExpenditureGroupingChange} />
              ) : null}
```

- [ ] **Step 5: Render nested selector rows**

In `apps/web/components/main-explorer/series-selector.tsx`, update the row label block:

```tsx
              <span className="min-w-0" style={{ paddingLeft: item.parentItemId ? 16 : 0 }}>
                <span className="block break-words text-[13px] font-bold text-[var(--ink)]">{item.kaLabel}</span>
                {item.detailLabel ? <span className="block text-[11px] font-semibold text-[var(--mute)]">{item.detailLabel}</span> : null}
                <span className="sr-only">{item.id}</span>
              </span>
```

Update the search haystack:

```ts
    const haystack = `${item.kaLabel} ${item.enLabel} ${item.detailLabel ?? ""} ${item.id}`.toLowerCase();
```

Add hierarchy test attributes to the `label` element:

```tsx
              data-level={item.level}
              data-parent-id={item.parentItemId ?? undefined}
```

- [ ] **Step 6: Run TypeScript-oriented tests**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads tests/explorer/explorerData.test.ts tests/explorer/integration.test.ts
```

Expected: PASS after resolving any type errors from the new props.

- [ ] **Step 7: Commit UI grouping wiring**

```powershell
git add -- apps/web/app/page.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/components/main-explorer/series-selector.tsx apps/web/components/main-explorer/expenditure-grouping-control.tsx
git commit -m "feat: add expenditure grouping switch"
```

---

### Task 5: Add Integration And CSV Metadata Coverage

**Files:**
- Modify: `apps/web/lib/explorer/types.ts`
- Modify: `apps/web/lib/explorer/csvExport.ts`
- Modify: `apps/web/tests/explorer/csvExport.test.ts`
- Modify: `apps/web/tests/explorer/integration.test.ts`

- [ ] **Step 1: Extend table row metadata**

In `apps/web/lib/explorer/types.ts`, add to `ExplorerTableRow`:

```ts
  parentItemId: string | null;
  level: ExplorerItemLevel;
  detailLabel: string | null;
```

In `rowFor` in `apps/web/lib/explorer/explorerData.ts`, include:

```ts
      parentItemId: item.parentItemId,
      level: item.level,
      detailLabel: item.detailLabel,
```

- [ ] **Step 2: Update CSV export headers and row values**

In `apps/web/lib/explorer/csvExport.ts`, replace `headers` with:

```ts
const headers = [
  "year",
  "category_id",
  "parent_item_id",
  "level",
  "detail_label",
  "ka_label",
  "en_label",
  "amount_gel",
  "basis",
  "source_name",
  "source_url_or_file",
  "last_reviewed_at",
];
```

Update pushed values:

```ts
          row.parentItemId ?? "",
          row.level,
          row.detailLabel ?? "",
```

Place those values after `row.itemId`.

- [ ] **Step 3: Update CSV export test**

In `apps/web/tests/explorer/csvExport.test.ts`, add these fields to the fixture row:

```ts
        parentItemId: null,
        level: "public_field",
        detailLabel: null,
        color: "#0071e3",
```

Update expected header:

```ts
"year,category_id,parent_item_id,level,detail_label,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at"
```

Update expected data row:

```ts
"2025,spending.health,,public_field,,ჯანმრთელობა,Health,150,planned,Reviewed 2025 planned budget scenario,docs/source-2025-plan,2026-05-11"
```

Add an admin CSV test:

```ts
  it("serializes admin hierarchy metadata", () => {
    const rows: ExplorerTableRow[] = [
      {
        itemId: "admin_program.32_02.aaaa1111",
        parentItemId: "admin_spending.education_science_youth",
        level: "major_program",
        detailLabel: "32 02",
        kaLabel: "General education",
        enLabel: "General education",
        color: "#0071e3",
        basisByYear: { 2025: "actual" },
        sourceByYear: {
          2025: {
            sourceName: "Reviewed 2025 execution",
            sourceUrlOrFile: "docs/source-2025",
            lastReviewedAt: "2026-05-11",
          },
        },
        valuesByYear: { 2025: 400 },
        change: null,
        shareEndYear: 0.25,
      },
    ];

    expect(buildExplorerCsv(rows, [2025])).toContain(
      "2025,admin_program.32_02.aaaa1111,admin_spending.education_science_youth,major_program,32 02,General education,General education,400,actual,Reviewed 2025 execution,docs/source-2025,2026-05-11",
    );
  });
```

- [ ] **Step 4: Add real-data integration test**

In `apps/web/tests/explorer/integration.test.ts`, import:

```ts
import { loadAdminSpendingFacts } from "../../lib/data/adminSpending/importAdminSpendingFacts";
```

Add test:

```ts
  it("builds a real ministry expenditure model with nested programs above 100M", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
    const adminFacts = await loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2017-2025.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const selectedItemIds = getDefaultSelection("expenditure", facts, "ministries", adminFacts);

    const model = buildExplorerModel({
      facts,
      adminFacts,
      adminCategories: new Map(),
      glossary,
      sourceDocuments,
      side: "expenditure",
      expenditureGrouping: "ministries",
      selectedItemIds,
      startYear: 2017,
      endYear: 2025,
      measure: "nominal",
    });

    const programs = model.items.filter((item) => item.level === "major_program");

    expect(selectedItemIds).toEqual(["admin_spending.total"]);
    expect(model.totalRow?.valuesByYear[2025]).toBeGreaterThan(0);
    expect(model.items.some((item) => item.id.startsWith("spending."))).toBe(false);
    expect(programs.length).toBeGreaterThan(0);
    expect(programs.every((item) => item.parentItemId?.startsWith("admin_spending."))).toBe(true);
  });
```

- [ ] **Step 5: Run focused tests**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads tests/explorer/csvExport.test.ts tests/explorer/integration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit CSV and integration coverage**

```powershell
git add -- apps/web/lib/explorer/types.ts apps/web/lib/explorer/explorerData.ts apps/web/lib/explorer/csvExport.ts apps/web/tests/explorer/csvExport.test.ts apps/web/tests/explorer/integration.test.ts
git commit -m "test: cover ministry expenditure exports"
```

---

### Task 6: Browser Verification For Grouping Switch

**Files:**
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add browser test**

Append this test to `apps/web/tests/browser/main-explorer.spec.ts`:

```ts
test("expenditure multi-year can switch to nested ministry program view", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  await expect(page.getByTestId("expenditure-grouping-control")).toBeVisible();
  await expect(page.getByTestId("grouping-fields")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("aside")).toContainText("ხარჯები სულ");

  await page.getByTestId("grouping-ministries").click();
  await expect(page.getByTestId("grouping-ministries")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("aside")).toContainText("ადმინისტრაციული ხარჯები სულ");
  await expect(page.getByTestId("series-selector").locator('[data-level="major_program"]').first()).toBeVisible();
  await expect(page.getByTestId("series-selector").locator('[data-parent-id^="admin_spending."]').first()).toBeVisible();

  await page.getByTestId("side-revenue").click();
  await expect(page.getByTestId("expenditure-grouping-control")).toHaveCount(0);

  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 2: Run browser test**

Start the dev server on port 3100 if it is not already running:

```powershell
npm.cmd run dev -- --port 3100
```

In another terminal from `apps/web`, run:

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit browser coverage**

```powershell
git add -- apps/web/tests/browser/main-explorer.spec.ts apps/web/components/main-explorer/series-selector.tsx
git commit -m "test: verify ministry grouping in browser"
```

---

### Task 7: Full Validation And Cleanup

**Files:**
- Potentially modify only files touched by earlier tasks if verification reveals compile/test issues.

- [ ] **Step 1: Run data validation**

Run from `apps/web`:

```powershell
npm.cmd run data:validate
```

Expected: PASS. If validation does not include admin files, do not broaden validation in this task unless a failing test proves a missing required check.

- [ ] **Step 2: Run focused unit and integration tests**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads tests/data/adminSpending.test.ts tests/explorer/explorerData.test.ts tests/explorer/integration.test.ts tests/explorer/csvExport.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full Vitest suite**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads --maxWorkers=1 --reporter=dot
```

Expected: PASS.

- [ ] **Step 4: Run browser suite**

With the app running on port 3100, run from `apps/web`:

```powershell
npm.cmd run test:browser
```

Expected: PASS.

- [ ] **Step 5: Check git scope**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only files related to admin expenditure data, explorer model/UI, tests, and generated admin spending outputs are changed. Do not stage unrelated user changes.

- [ ] **Step 6: Final commit if needed**

If Step 1-5 required cleanup changes, commit only the files that appear in `git diff --name-only` and are part of this feature. For this plan, the allowed cleanup file set is:

```text
apps/web/app/page.tsx
apps/web/components/main-explorer/expenditure-grouping-control.tsx
apps/web/components/main-explorer/main-explorer.tsx
apps/web/components/main-explorer/series-selector.tsx
apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts
apps/web/lib/data/adminSpending/importAdminSpendingFacts.ts
apps/web/lib/explorer/csvExport.ts
apps/web/lib/explorer/explorerData.ts
apps/web/lib/explorer/types.ts
apps/web/tests/browser/main-explorer.spec.ts
apps/web/tests/data/adminSpending.test.ts
apps/web/tests/explorer/csvExport.test.ts
apps/web/tests/explorer/explorerData.test.ts
apps/web/tests/explorer/integration.test.ts
data/imports/admin-spending-facts-2017-2025.csv
data/mappings/review/admin-spending-major-program-review-2017-2025.csv
data/reports/admin-spending-2017-2025-report.json
```

Commit the exact changed subset from that list:

```powershell
git add -- apps/web/app/page.tsx apps/web/components/main-explorer/expenditure-grouping-control.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/components/main-explorer/series-selector.tsx apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts apps/web/lib/data/adminSpending/importAdminSpendingFacts.ts apps/web/lib/explorer/csvExport.ts apps/web/lib/explorer/explorerData.ts apps/web/lib/explorer/types.ts apps/web/tests/browser/main-explorer.spec.ts apps/web/tests/data/adminSpending.test.ts apps/web/tests/explorer/csvExport.test.ts apps/web/tests/explorer/explorerData.test.ts apps/web/tests/explorer/integration.test.ts data/imports/admin-spending-facts-2017-2025.csv data/mappings/review/admin-spending-major-program-review-2017-2025.csv data/reports/admin-spending-2017-2025-report.json
git commit -m "fix: finalize ministry expenditure view"
```

If no cleanup changes were needed, do not create an empty commit.
