# GeoData.ge Real Revenue Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add source-backed 2023-2025 revenue facts to the existing explorer so Revenue mode shows real validated data instead of an empty state.

**Architecture:** Keep the existing app data path centered on `data/imports/budget-facts-2023-2025.csv`. Add a focused real-revenue pipeline under `apps/web/lib/data/realRevenue/*`, generate a separate `revenue-facts-2023-2025.csv`, and compose expenditure plus revenue into the public app CSV. Do not invent tax-category detail that is not present in the current source workbooks.

**Tech Stack:** Next.js App Router, TypeScript, npm, Vitest, Playwright, SheetJS `xlsx`, Zod, existing CSV/foundation validation utilities.

---

## Execution Readiness Review

Current readiness: **ready for implementation with the constraints in this rewritten plan**.

The original Plan 5 intent is correct: use the current official workbooks to stop Revenue mode from being empty, while honestly warning that the committed source files only expose aggregate tax revenue. The execution risk is in the details, not the product direction.

Gaps fixed in this rewrite:

- The plan now treats `revenue.taxes_total` as a temporary source-backed implementation category, not as completion of the v1 tax-breakdown requirement.
- Expected generated row counts are no longer hard-coded as global truths. Revenue should generate exactly `9` rows, but combined fact rows must be checked as `current expenditure row count + 9`.
- Extraction success is no longer based only on one brittle total row count. The generated staging CSV must prove that all three years exist and that the required aggregate revenue labels were extracted for each year.
- Single-year revenue behavior is now explicit: it may render through the existing generic single-year model, but Plan 5 must not redesign or special-case the single-year visual components.
- The final verification no longer tells the agent to run `git add .`; every commit must stage only intentional Plan 5 files.
- The plan now calls out implementation blockers that require stopping: missing source labels, missing source rows, reconciliation failure, or tax-category breakdown rows unexpectedly appearing in the workbooks.

Unnecessary complexity kept out of scope:

- No database import or Supabase read path.
- No public provenance panel.
- No new revenue semantic model for financing categories.
- No revenue data outside the 2023-2025 v1 window.
- No component redesign.

Execution assumptions:

- Work from `apps/web` for npm commands.
- Check `git status --short` before starting and avoid touching unrelated dirty files.
- Use existing real expenditure patterns instead of inventing a second data architecture.
- If current workbook inspection shows direct VAT/income/profit/excise/import/property tax rows, stop and rewrite this plan before implementation because the temporary aggregate strategy would no longer be the right first pass.

## Scope

Included:

- Parse source-backed revenue rows from the currently committed official workbooks:
  - `docs/Raw Data/2023 12 tve saitistvis.xls`
  - `docs/Raw Data/2024 12 თვე საიტისთვის.xlsx`
  - `docs/Raw Data/2025.xlsx`
- Generate validated actual revenue facts for 2023, 2024, and 2025.
- Activate the existing Revenue multi-year explorer with real rows, chart/table data, selector rows, and CSV export.
- Preserve the existing expenditure facts and single-year expenditure snapshot.
- Add an explicit temporary aggregate category for source-level total taxes because the current workbooks expose total taxes but not VAT/income/profit/excise/import/property tax breakdowns.
- Add a report warning that the tax breakdown source is missing from the committed workbooks.
- Activate aggregate-only revenue in the existing single-year model if it works without component changes.

Excluded:

- Do not synthesize VAT, income tax, profit tax, excise tax, import tax, property tax, or other tax rows from aggregate taxes.
- Do not add revenue data outside the 2023-2025 v1 window.
- Do not add Supabase inserts or database reads.
- Do not add public provenance panels.
- Do not redesign the explorer UI.
- Do not modify `apps/web/components/single-year/*`. If revenue single-year needs component-specific semantic work, leave that for a later plan instead of expanding Plan 5.

## Source Reality and Product Boundary

Current workbook inspection showed:

- `2025.xlsx`, sheet `tavi I`, includes `შემოსავლები`, `გადასახადები`, `გრანტები`, and `სხვა შემოსავლები`.
- `2024 12 თვე საიტისთვის.xlsx`, sheet `I თავი`, includes the same aggregate revenue rows.
- `2023 12 tve saitistvis.xls`, sheet `ბალანსი`, includes the same aggregate revenue rows.
- The committed workbooks do not expose the v1 target tax breakdown categories as separate rows.

Plan 5 therefore uses this temporary source-backed category:

```text
revenue.taxes_total
```

This category is acceptable only as an intermediate implementation category. It must be labeled as an aggregate tax row in the glossary notes, and the validation report must warn that direct tax-category rows are unavailable from the current workbook set. Future tax-category ingestion should replace public reliance on this aggregate without deleting historical source-backed facts.

Before implementing Task 1, the agent must verify the committed workbook sheet names from `apps/web`:

```powershell
node -e "const XLSX=require('xlsx'); const files=['../../docs/Raw Data/2023 12 tve saitistvis.xls','../../docs/Raw Data/2024 12 თვე საიტისთვის.xlsx','../../docs/Raw Data/2025.xlsx']; for (const f of files){ const wb=XLSX.readFile(f); console.log(f); console.log(wb.SheetNames.join(' | ')); }"
```

Expected sheets:

```text
2023 workbook includes: ბალანსი
2024 workbook includes: I თავი
2025 workbook includes: tavi I
```

If these sheets are missing, stop and inspect the actual workbook names/sheets before editing code. Do not guess sheet names.

## Source Documents

Read before executing:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- `docs/superpowers/plans/2026-05-10-geodata-budget-v1-foundation.md`
- `docs/superpowers/plans/2026-05-11-geodata-main-explorer-ui.md`
- `docs/superpowers/plans/2026-05-12-geodata-real-expenditure-data.md`
- `docs/superpowers/plans/2026-05-13-geodata-single-year-snapshot.md`

## File Structure

Create:

```text
apps/web/lib/data/factCsv.ts
apps/web/lib/data/realRevenue/types.ts
apps/web/lib/data/realRevenue/parseTavi1Rows.ts
apps/web/lib/data/realRevenue/extractWorkbooks.ts
apps/web/lib/data/realRevenue/generateFacts.ts
apps/web/lib/data/realRevenue/validateRealRevenue.ts
apps/web/scripts/extract-real-revenue.ts
apps/web/scripts/generate-real-revenue-facts.ts
apps/web/scripts/compose-budget-facts.ts
apps/web/tests/data/realRevenue/parseTavi1Rows.test.ts
apps/web/tests/data/realRevenue/generateFacts.test.ts
apps/web/tests/data/realRevenue/validateRealRevenue.test.ts
```

Modify:

```text
apps/web/package.json
apps/web/scripts/generate-real-expenditure-facts.ts
apps/web/scripts/validate-data-files.ts
apps/web/tests/data/foundationValidation.test.ts
apps/web/tests/explorer/integration.test.ts
apps/web/tests/browser/main-explorer.spec.ts
data/taxonomy/revenue-categories.json
data/glossary/category-glossary.csv
data/imports/budget-facts-2023-2025.csv
```

Generated by scripts:

```text
data/staging/revenue-official-rows-2023-2025.csv
data/imports/expenditure-facts-2023-2025.csv
data/imports/revenue-facts-2023-2025.csv
data/reports/real-revenue-2023-2025-report.json
data/reports/budget-facts-2023-2025-compose-report.json
data/reports/real-expenditure-2023-2025-report.json
data/reports/real-budget-2023-2025-import-report.json
```

Do not modify:

```text
apps/web/components/single-year/*
apps/web/components/main-explorer/chart-frame.tsx
apps/web/lib/data/realExpenditure/parseTavi6Rows.ts
apps/web/lib/data/realExpenditure/hierarchy.ts
data/mappings/review/spending-field-mapping-review-2023-2025.csv
```

Do not use `git add .` in this plan. Stage only the exact files listed in the relevant task.

## Data Contract

Revenue facts generated by Plan 5 use the existing `BudgetFactImportRow` CSV shape:

```csv
year,side,item_id,amount_gel,basis,source_id,official_institution,official_program,official_subprogram,public_spending_field_id,mapping_confidence,mapping_notes
2025,revenue,revenue.grants,279567800,actual,source.mof_2025_tavi1_actual,,,,,,Source row: გრანტები
```

Rules:

- Source workbook values are in thousand GEL. Generated `amount_gel` values must multiply source values by `1000` and round to the nearest GEL.
- `side` must be `revenue`.
- `basis` must be `actual`.
- `public_spending_field_id` must be empty for revenue rows.
- `mapping_confidence` must be empty for revenue rows.
- `official_institution`, `official_program`, and `official_subprogram` must be empty for revenue rows.
- Generated revenue rows must be sorted by `year`, then taxonomy `sortOrder`.
- Generated revenue rows for Plan 5 are:
  - `revenue.taxes_total`
  - `revenue.grants`
  - `revenue.other_revenue`
- The generated revenue total for each year must equal the source row `შემოსავლები`.
- The validation report must include a warning named exactly `tax_breakdown_missing_from_current_workbooks`.

## Task 1: Add Temporary Revenue Aggregate Taxonomy

**Files:**

- Modify: `data/taxonomy/revenue-categories.json`
- Modify: `data/glossary/category-glossary.csv`
- Modify: `apps/web/tests/data/foundationValidation.test.ts`

- [ ] **Step 1: Add a failing taxonomy/glossary coverage test**

Add `loadGlossary` to the imports in `apps/web/tests/data/foundationValidation.test.ts`:

```ts
import { loadGlossary } from "../../lib/data/glossary";
```

Then add this test case:

```ts
it("has a source-backed aggregate taxes category for current revenue workbooks", async () => {
  const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
  const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");

  expect(taxonomy.some((item) => item.id === "revenue.taxes_total")).toBe(true);
  expect(glossary.get("revenue.taxes_total")).toEqual(
    expect.objectContaining({
      enLabel: "Taxes total",
      notes: expect.stringContaining("Temporary source aggregate"),
    }),
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm run test -- tests/data/foundationValidation.test.ts
```

Expected:

```text
FAIL tests/data/foundationValidation.test.ts
```

The failure must mention missing `revenue.taxes_total`.

- [ ] **Step 3: Add the taxonomy row**

Insert this object in `data/taxonomy/revenue-categories.json` before `revenue.vat`:

```json
{
  "id": "revenue.taxes_total",
  "side": "revenue",
  "level": "revenue_category",
  "kaLabel": "გადასახადები სულ",
  "enLabel": "Taxes total",
  "sortOrder": 5
}
```

- [ ] **Step 4: Add the glossary row**

Insert this row in `data/glossary/category-glossary.csv` before `revenue.vat`:

```csv
revenue.taxes_total,გადასახადები სულ,Taxes total,Aggregate tax revenue row from current official workbook sources,Temporary source aggregate; replace public reliance with direct tax categories when source breakdown is added
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```powershell
npm run test -- tests/data/foundationValidation.test.ts
```

Expected:

```text
PASS tests/data/foundationValidation.test.ts
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add data/taxonomy/revenue-categories.json data/glossary/category-glossary.csv apps/web/tests/data/foundationValidation.test.ts
git commit -m "feat: add source-backed aggregate tax category"
```

## Task 2: Add Revenue Row Types and Parser Tests

**Files:**

- Create: `apps/web/lib/data/realRevenue/types.ts`
- Create: `apps/web/tests/data/realRevenue/parseTavi1Rows.test.ts`

- [ ] **Step 1: Add shared revenue types**

Create `apps/web/lib/data/realRevenue/types.ts`:

```ts
export type RealRevenueSource = {
  year: number;
  sourceId: string;
  workbookPath: string;
  preferredSheetNames: string[];
};

export type OfficialRevenueRow = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  rowNumber: number;
  labelKa: string;
  approvedPlanThousandGel: number | null;
  revisedPlanThousandGel: number | null;
  actualThousandGel: number;
  executionPercent: number | null;
  section: "revenues" | "expenditures" | "non_financial_assets" | "financial_assets" | "liabilities" | "other";
};

export type RealRevenueValidationReport = {
  importLabel: string;
  years: number[];
  sourceRows: number;
  generatedFactRows: number;
  officialRevenueTotalGelByYear: Record<number, number>;
  generatedRevenueTotalGelByYear: Record<number, number>;
  reconciliationStatusByYear: Record<number, "passed" | "failed">;
  warnings: string[];
};
```

- [ ] **Step 2: Add parser tests**

Create `apps/web/tests/data/realRevenue/parseTavi1Rows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseTavi1Rows } from "../../../lib/data/realRevenue/parseTavi1Rows";

describe("parseTavi1Rows", () => {
  it("parses the 2025 no-marker-column revenue rows", () => {
    const rows = parseTavi1Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi1_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi I",
      matrix: [
        ["დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
        ["შემოსავლები", 23816199, 23816199, 23991752.2, 1.007],
        ["გადასახადები", 21940000, 21940000, 21957477.8, 1.001],
        ["გრანტები", 186199, 186199, 279567.8, 1.501],
        ["სხვა შემოსავლები", 1690000, 1690000, 1754706.6, 1.038],
        ["ხარჯები", 22802016.4, 23031489.5, 22854435.8, 0.992],
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({ rowNumber: 2, labelKa: "შემოსავლები", actualThousandGel: 23991752.2, section: "revenues" }),
      expect.objectContaining({ rowNumber: 3, labelKa: "გადასახადები", actualThousandGel: 21957477.8, section: "revenues" }),
      expect.objectContaining({ rowNumber: 4, labelKa: "გრანტები", actualThousandGel: 279567.8, section: "revenues" }),
      expect.objectContaining({ rowNumber: 5, labelKa: "სხვა შემოსავლები", actualThousandGel: 1754706.6, section: "revenues" }),
      expect.objectContaining({ rowNumber: 6, labelKa: "ხარჯები", section: "expenditures" }),
    ]);
  });

  it("parses the 2023 marker-column revenue rows", () => {
    const rows = parseTavi1Rows({
      year: 2023,
      sourceId: "source.mof_2023_tavi1_actual",
      workbookPath: "docs/Raw Data/2023 12 tve saitistvis.xls",
      sheetName: "ბალანსი",
      matrix: [
        ["a", "დასახელება", "2023 წლის დამტკიცებული გეგმა", "2023 წლის დაზუსტებული გეგმა", "2023 წლის ფაქტი", "შესრულება %-ში"],
        ["a", "შემოსავლები", 18239900, 18239900, 18716484.43581, 1.0261286759143415],
        ["a", "გადასახადები", 16710350, 16710350, 16994174.887059998, 1.0169849756025455],
      ],
    });

    expect(rows.map((row) => row.labelKa)).toEqual(["შემოსავლები", "გადასახადები"]);
    expect(rows[1]?.actualThousandGel).toBe(16994174.887059998);
  });
});
```

- [ ] **Step 3: Run the parser tests and verify they fail**

Run:

```powershell
npm run test -- tests/data/realRevenue/parseTavi1Rows.test.ts
```

Expected:

```text
FAIL tests/data/realRevenue/parseTavi1Rows.test.ts
```

The failure must mention missing `parseTavi1Rows`.

Do not commit this failing state. Continue to Task 3 and commit after the parser implementation passes the focused tests.

## Task 3: Implement the Revenue Parser

**Files:**

- Create: `apps/web/lib/data/realRevenue/parseTavi1Rows.ts`

- [ ] **Step 1: Implement `parseTavi1Rows`**

Create `apps/web/lib/data/realRevenue/parseTavi1Rows.ts`:

```ts
import type { OfficialRevenueRow } from "./types";

export type MatrixCell = string | number | boolean | null;

type ParseTavi1Input = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
};

function text(value: MatrixCell): string {
  return String(value ?? "").trim();
}

function numberOrNull(value: MatrixCell): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findHeaderIndexes(row: MatrixCell[]): {
  labelIndex: number;
  approvedIndex: number;
  revisedIndex: number;
  actualIndex: number;
  executionIndex: number;
} | null {
  const cells = row.map(text);
  const labelIndex = cells.findIndex((cell) => cell.includes("დასახელება"));
  const actualIndex = cells.findIndex((cell) => cell.includes("ფაქტი"));
  const approvedIndex = cells.findIndex((cell) => cell.includes("დამტკიცებული"));
  const revisedIndex = cells.findIndex((cell) => cell.includes("დაზუსტებული"));
  const executionIndex = cells.findIndex((cell) => cell.includes("შესრულება"));

  if (labelIndex === -1 || actualIndex === -1 || approvedIndex === -1 || revisedIndex === -1) return null;

  return { labelIndex, approvedIndex, revisedIndex, actualIndex, executionIndex };
}

function sectionFor(labelKa: string, current: OfficialRevenueRow["section"]): OfficialRevenueRow["section"] {
  if (labelKa === "შემოსავლები") return "revenues";
  if (labelKa === "ხარჯები") return "expenditures";
  if (labelKa === "არაფინანსური აქტივების ცვლილება") return "non_financial_assets";
  if (labelKa === "ფინანსური აქტივების ცვლილება" || labelKa === "ფინასური აქტივების ცვლილება") return "financial_assets";
  if (labelKa === "ვალდებულებების ცვლილება") return "liabilities";
  return current;
}

export function parseTavi1Rows(input: ParseTavi1Input): OfficialRevenueRow[] {
  const headerRowIndex = input.matrix.findIndex((row) => findHeaderIndexes(row) !== null);
  if (headerRowIndex === -1) throw new Error(`Could not find tavi I header row in ${input.sheetName}`);

  const indexes = findHeaderIndexes(input.matrix[headerRowIndex] ?? []);
  if (!indexes) throw new Error(`Could not parse tavi I header row in ${input.sheetName}`);

  const rows: OfficialRevenueRow[] = [];
  let currentSection: OfficialRevenueRow["section"] = "other";

  for (let index = headerRowIndex + 1; index < input.matrix.length; index += 1) {
    const row = input.matrix[index] ?? [];
    const labelKa = text(row[indexes.labelIndex]);
    const actualThousandGel = numberOrNull(row[indexes.actualIndex]);

    if (!labelKa || actualThousandGel === null) continue;

    currentSection = sectionFor(labelKa, currentSection);

    rows.push({
      year: input.year,
      sourceId: input.sourceId,
      workbookPath: input.workbookPath,
      sheetName: input.sheetName,
      rowNumber: index + 1,
      labelKa,
      approvedPlanThousandGel: numberOrNull(row[indexes.approvedIndex]),
      revisedPlanThousandGel: numberOrNull(row[indexes.revisedIndex]),
      actualThousandGel,
      executionPercent: indexes.executionIndex === -1 ? null : numberOrNull(row[indexes.executionIndex]),
      section: currentSection,
    });
  }

  return rows;
}
```

- [ ] **Step 2: Run parser tests and verify they pass**

Run:

```powershell
npm run test -- tests/data/realRevenue/parseTavi1Rows.test.ts
```

Expected:

```text
PASS tests/data/realRevenue/parseTavi1Rows.test.ts
```

- [ ] **Step 3: Commit**

Run:

```powershell
git add apps/web/lib/data/realRevenue/parseTavi1Rows.ts apps/web/tests/data/realRevenue/parseTavi1Rows.test.ts
git commit -m "feat: parse real revenue workbook rows"
```

## Task 4: Extract Revenue Rows from Current Workbooks

**Files:**

- Create: `apps/web/lib/data/realRevenue/extractWorkbooks.ts`
- Create: `apps/web/scripts/extract-real-revenue.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Create workbook extraction logic**

Create `apps/web/lib/data/realRevenue/extractWorkbooks.ts`:

```ts
import path from "node:path";
import * as XLSX from "xlsx";
import { parseTavi1Rows, type MatrixCell } from "./parseTavi1Rows";
import type { OfficialRevenueRow, RealRevenueSource } from "./types";

export const realRevenueSources: RealRevenueSource[] = [
  {
    year: 2023,
    sourceId: "source.mof_2023_tavi1_actual",
    workbookPath: "../../docs/Raw Data/2023 12 tve saitistvis.xls",
    preferredSheetNames: ["ბალანსი"],
  },
  {
    year: 2024,
    sourceId: "source.mof_2024_tavi1_actual",
    workbookPath: "../../docs/Raw Data/2024 12 თვე საიტისთვის.xlsx",
    preferredSheetNames: ["I თავი"],
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi1_actual",
    workbookPath: "../../docs/Raw Data/2025.xlsx",
    preferredSheetNames: ["tavi I", "I თავი"],
  },
];

function normalizeSheetName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickSheetName(workbook: XLSX.WorkBook, preferredNames: string[]): string {
  const availableByNormalized = new Map(workbook.SheetNames.map((name) => [normalizeSheetName(name), name]));

  for (const preferred of preferredNames) {
    const matched = availableByNormalized.get(normalizeSheetName(preferred));
    if (matched) return matched;
  }

  throw new Error(`Could not find revenue sheet. Available sheets: ${workbook.SheetNames.join(", ")}`);
}

export function extractOfficialRevenueRows(): OfficialRevenueRow[] {
  return realRevenueSources.flatMap((source) => {
    const workbookFile = path.resolve(process.cwd(), source.workbookPath);
    const workbook = XLSX.readFile(workbookFile, { cellDates: false });
    const sheetName = pickSheetName(workbook, source.preferredSheetNames);
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) throw new Error(`Missing sheet after selection: ${sheetName}`);

    const matrix = XLSX.utils.sheet_to_json<MatrixCell[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: true,
    });

    return parseTavi1Rows({
      year: source.year,
      sourceId: source.sourceId,
      workbookPath: source.workbookPath.replace("../../", ""),
      sheetName,
      matrix,
    });
  });
}
```

- [ ] **Step 2: Create the extraction script**

Create `apps/web/scripts/extract-real-revenue.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractOfficialRevenueRows } from "../lib/data/realRevenue/extractWorkbooks";

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(rows: ReturnType<typeof extractOfficialRevenueRows>): string {
  const headers = [
    "year",
    "source_id",
    "workbook_path",
    "sheet_name",
    "row_number",
    "label_ka",
    "section",
    "approved_plan_thousand_gel",
    "revised_plan_thousand_gel",
    "actual_thousand_gel",
    "execution_percent",
  ] as const;

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.year,
        row.sourceId,
        row.workbookPath,
        row.sheetName,
        row.rowNumber,
        row.labelKa,
        row.section,
        row.approvedPlanThousandGel,
        row.revisedPlanThousandGel,
        row.actualThousandGel,
        row.executionPercent,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");
}

async function main() {
  const rows = extractOfficialRevenueRows();
  const stagingDir = path.resolve(process.cwd(), "../../data/staging");

  await mkdir(stagingDir, { recursive: true });
  await writeFile(path.join(stagingDir, "revenue-official-rows-2023-2025.csv"), rowsToCsv(rows), "utf8");

  console.log(`Extracted official revenue rows: ${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Add npm script**

In `apps/web/package.json`, add:

```json
"data:extract-revenue": "tsx scripts/extract-real-revenue.ts"
```

- [ ] **Step 4: Run extraction**

Run:

```powershell
npm run data:extract-revenue
```

Expected:

```text
Extracted official revenue rows: <positive row count>
```

Do not accept this step based on the row count alone. Inspect `data/staging/revenue-official-rows-2023-2025.csv` before continuing.

Required staging checks:

```text
Rows exist for years: 2023, 2024, 2025
Each year has one revenues-section row for total revenue
Each year has one revenues-section row for total taxes
Each year has one revenues-section row for grants
Each year has one revenues-section row for other revenue
No generated revenue fact category is based on a non-revenue section row
```

If the workbook parser extracts direct VAT, income tax, profit tax, excise tax, import tax, property tax, or other tax rows, stop and rewrite Plan 5 around direct tax-category ingestion instead of continuing with `revenue.taxes_total`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/lib/data/realRevenue/extractWorkbooks.ts apps/web/scripts/extract-real-revenue.ts apps/web/package.json data/staging/revenue-official-rows-2023-2025.csv
git commit -m "feat: extract real revenue workbook rows"
```

## Task 5: Generate Revenue Facts

**Files:**

- Create: `apps/web/lib/data/realRevenue/generateFacts.ts`
- Create: `apps/web/tests/data/realRevenue/generateFacts.test.ts`

- [ ] **Step 1: Add generation tests**

Create `apps/web/tests/data/realRevenue/generateFacts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateRevenueFacts } from "../../../lib/data/realRevenue/generateFacts";
import type { OfficialRevenueRow } from "../../../lib/data/realRevenue/types";

function row(labelKa: string, actualThousandGel: number): OfficialRevenueRow {
  return {
    year: 2025,
    sourceId: "source.mof_2025_tavi1_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi I",
    rowNumber: 2,
    labelKa,
    approvedPlanThousandGel: actualThousandGel,
    revisedPlanThousandGel: actualThousandGel,
    actualThousandGel,
    executionPercent: 1,
    section: "revenues",
  };
}

describe("generateRevenueFacts", () => {
  it("generates source-backed aggregate revenue facts", () => {
    const facts = generateRevenueFacts([
      row("შემოსავლები", 1000),
      row("გადასახადები", 800),
      row("გრანტები", 50),
      row("სხვა შემოსავლები", 150),
    ]);

    expect(facts).toEqual([
      expect.objectContaining({ item_id: "revenue.taxes_total", amount_gel: "800000", mapping_confidence: "" }),
      expect.objectContaining({ item_id: "revenue.grants", amount_gel: "50000", mapping_confidence: "" }),
      expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "150000", mapping_confidence: "" }),
    ]);
  });

  it("throws when a required revenue source row is missing", () => {
    expect(() => generateRevenueFacts([row("შემოსავლები", 1000), row("გადასახადები", 800)])).toThrow(
      "Missing required revenue row for 2025: გრანტები",
    );
  });
});
```

- [ ] **Step 2: Run generation tests and verify they fail**

Run:

```powershell
npm run test -- tests/data/realRevenue/generateFacts.test.ts
```

Expected:

```text
FAIL tests/data/realRevenue/generateFacts.test.ts
```

The failure must mention missing `generateRevenueFacts`.

- [ ] **Step 3: Implement generation logic**

Create `apps/web/lib/data/realRevenue/generateFacts.ts`:

```ts
import type { OfficialRevenueRow } from "./types";

export type RealRevenueFactCsvRow = {
  year: number;
  side: "revenue";
  item_id: string;
  amount_gel: string;
  basis: "actual";
  source_id: string;
  official_institution: "";
  official_program: "";
  official_subprogram: "";
  public_spending_field_id: "";
  mapping_confidence: "";
  mapping_notes: string;
};

const rowMappings = [
  { labelKa: "გადასახადები", itemId: "revenue.taxes_total", sortOrder: 5 },
  { labelKa: "გრანტები", itemId: "revenue.grants", sortOrder: 80 },
  { labelKa: "სხვა შემოსავლები", itemId: "revenue.other_revenue", sortOrder: 90 },
] as const;

function gelFromThousandGel(value: number): string {
  return String(Math.round(value * 1000));
}

export function generateRevenueFacts(officialRows: OfficialRevenueRow[]): RealRevenueFactCsvRow[] {
  const revenueRows = officialRows.filter((row) => row.section === "revenues");
  const years = Array.from(new Set(revenueRows.map((row) => row.year))).sort((a, b) => a - b);
  const generated: RealRevenueFactCsvRow[] = [];

  for (const year of years) {
    const yearRows = revenueRows.filter((row) => row.year === year);

    for (const mapping of rowMappings) {
      const row = yearRows.find((candidate) => candidate.labelKa === mapping.labelKa);
      if (!row) throw new Error(`Missing required revenue row for ${year}: ${mapping.labelKa}`);

      generated.push({
        year,
        side: "revenue",
        item_id: mapping.itemId,
        amount_gel: gelFromThousandGel(row.actualThousandGel),
        basis: "actual",
        source_id: row.sourceId,
        official_institution: "",
        official_program: "",
        official_subprogram: "",
        public_spending_field_id: "",
        mapping_confidence: "",
        mapping_notes: `Source row: ${row.labelKa}`,
      });
    }
  }

  return generated.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    const left = rowMappings.find((mapping) => mapping.itemId === a.item_id)?.sortOrder ?? 999;
    const right = rowMappings.find((mapping) => mapping.itemId === b.item_id)?.sortOrder ?? 999;
    return left - right;
  });
}
```

- [ ] **Step 4: Run generation tests and verify they pass**

Run:

```powershell
npm run test -- tests/data/realRevenue/generateFacts.test.ts
```

Expected:

```text
PASS tests/data/realRevenue/generateFacts.test.ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/lib/data/realRevenue/generateFacts.ts apps/web/tests/data/realRevenue/generateFacts.test.ts
git commit -m "feat: generate real revenue facts"
```

## Task 6: Validate Revenue Reconciliation

**Files:**

- Create: `apps/web/lib/data/realRevenue/validateRealRevenue.ts`
- Create: `apps/web/tests/data/realRevenue/validateRealRevenue.test.ts`

- [ ] **Step 1: Add validation tests**

Create `apps/web/tests/data/realRevenue/validateRealRevenue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { RealRevenueFactCsvRow } from "../../../lib/data/realRevenue/generateFacts";
import type { OfficialRevenueRow } from "../../../lib/data/realRevenue/types";
import { validateRealRevenueFacts } from "../../../lib/data/realRevenue/validateRealRevenue";

const officialRows: OfficialRevenueRow[] = [
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi1_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi I",
    rowNumber: 2,
    labelKa: "შემოსავლები",
    approvedPlanThousandGel: 1000,
    revisedPlanThousandGel: 1000,
    actualThousandGel: 1000,
    executionPercent: 1,
    section: "revenues",
  },
];

function fact(itemId: string, amountGel: string): RealRevenueFactCsvRow {
  return {
    year: 2025,
    side: "revenue",
    item_id: itemId,
    amount_gel: amountGel,
    basis: "actual",
    source_id: "source.mof_2025_tavi1_actual",
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: "Source row",
  };
}

describe("validateRealRevenueFacts", () => {
  it("passes when generated facts reconcile to the official revenue total", () => {
    const report = validateRealRevenueFacts(officialRows, [
      fact("revenue.taxes_total", "800000"),
      fact("revenue.grants", "50000"),
      fact("revenue.other_revenue", "150000"),
    ]);

    expect(report.reconciliationStatusByYear).toEqual({ 2025: "passed" });
    expect(report.generatedRevenueTotalGelByYear).toEqual({ 2025: 1000000 });
    expect(report.warnings).toContain("tax_breakdown_missing_from_current_workbooks");
  });

  it("fails when generated facts do not reconcile to the official revenue total", () => {
    const report = validateRealRevenueFacts(officialRows, [fact("revenue.taxes_total", "900000")]);

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings[0]).toContain("2025 revenue reconciliation mismatch");
  });
});
```

- [ ] **Step 2: Run validation tests and verify they fail**

Run:

```powershell
npm run test -- tests/data/realRevenue/validateRealRevenue.test.ts
```

Expected:

```text
FAIL tests/data/realRevenue/validateRealRevenue.test.ts
```

The failure must mention missing `validateRealRevenueFacts`.

- [ ] **Step 3: Implement validation logic**

Create `apps/web/lib/data/realRevenue/validateRealRevenue.ts`:

```ts
import type { RealRevenueFactCsvRow } from "./generateFacts";
import type { OfficialRevenueRow, RealRevenueValidationReport } from "./types";

function officialRevenueTotalGelByYear(rows: OfficialRevenueRow[]): Record<number, number> {
  const totals: Record<number, number> = {};

  for (const row of rows.filter((candidate) => candidate.section === "revenues" && candidate.labelKa === "შემოსავლები")) {
    totals[row.year] = Math.round(row.actualThousandGel * 1000);
  }

  return totals;
}

function generatedTotalGelByYear(rows: RealRevenueFactCsvRow[]): Record<number, number> {
  const totals: Record<number, number> = {};

  for (const row of rows) {
    totals[row.year] = (totals[row.year] ?? 0) + Number(row.amount_gel);
  }

  return totals;
}

export function validateRealRevenueFacts(
  officialRows: OfficialRevenueRow[],
  facts: RealRevenueFactCsvRow[],
): RealRevenueValidationReport {
  const years = Array.from(new Set(officialRows.map((row) => row.year))).sort((a, b) => a - b);
  const officialTotals = officialRevenueTotalGelByYear(officialRows);
  const generatedTotals = generatedTotalGelByYear(facts);
  const reconciliationStatusByYear: Record<number, "passed" | "failed"> = {};
  const warnings = ["tax_breakdown_missing_from_current_workbooks"];

  for (const year of years) {
    const officialTotal = officialTotals[year] ?? 0;
    const generatedTotal = generatedTotals[year] ?? 0;

    if (officialTotal === generatedTotal) {
      reconciliationStatusByYear[year] = "passed";
      continue;
    }

    reconciliationStatusByYear[year] = "failed";
    warnings.unshift(`${year} revenue reconciliation mismatch: official ${officialTotal}, generated ${generatedTotal}`);
  }

  return {
    importLabel: "real-revenue-2023-2025",
    years,
    sourceRows: officialRows.length,
    generatedFactRows: facts.length,
    officialRevenueTotalGelByYear: officialTotals,
    generatedRevenueTotalGelByYear: generatedTotals,
    reconciliationStatusByYear,
    warnings,
  };
}
```

- [ ] **Step 4: Run validation tests and verify they pass**

Run:

```powershell
npm run test -- tests/data/realRevenue/validateRealRevenue.test.ts
```

Expected:

```text
PASS tests/data/realRevenue/validateRealRevenue.test.ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/lib/data/realRevenue/validateRealRevenue.ts apps/web/tests/data/realRevenue/validateRealRevenue.test.ts
git commit -m "feat: validate real revenue facts"
```

## Task 7: Generate Revenue CSV and Compose Public Budget Facts

**Files:**

- Create: `apps/web/lib/data/factCsv.ts`
- Create: `apps/web/scripts/generate-real-revenue-facts.ts`
- Create: `apps/web/scripts/compose-budget-facts.ts`
- Modify: `apps/web/scripts/generate-real-expenditure-facts.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add shared fact CSV writer**

Create `apps/web/lib/data/factCsv.ts`:

```ts
export type BudgetFactCsvRow = {
  year: number;
  side: "revenue" | "expenditure";
  item_id: string;
  amount_gel: string;
  basis: "actual" | "planned";
  source_id: string;
  official_institution: string;
  official_program: string;
  official_subprogram: string;
  public_spending_field_id: string;
  mapping_confidence: string;
  mapping_notes: string;
};

export const budgetFactHeaders = [
  "year",
  "side",
  "item_id",
  "amount_gel",
  "basis",
  "source_id",
  "official_institution",
  "official_program",
  "official_subprogram",
  "public_spending_field_id",
  "mapping_confidence",
  "mapping_notes",
] as const;

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function budgetFactsToCsv(rows: BudgetFactCsvRow[]): string {
  return [
    budgetFactHeaders.join(","),
    ...rows.map((row) => budgetFactHeaders.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}
```

- [ ] **Step 2: Update expenditure generation to write expenditure-specific facts**

In `apps/web/scripts/generate-real-expenditure-facts.ts`:

- Import `budgetFactsToCsv`.
- Remove local `csvEscape` and `factsToCsv`.
- Write `data/imports/expenditure-facts-2023-2025.csv`.
- Keep writing `data/reports/real-expenditure-2023-2025-report.json`.
- Do not write `data/imports/budget-facts-2023-2025.csv` from this script anymore.

The write block should become:

```ts
await writeFile(path.join(importsDir, "expenditure-facts-2023-2025.csv"), budgetFactsToCsv(facts), "utf8");
await writeFile(path.join(reportsDir, "real-expenditure-2023-2025-report.json"), JSON.stringify(report, null, 2), "utf8");
```

- [ ] **Step 3: Create the revenue generation script**

Create `apps/web/scripts/generate-real-revenue-facts.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { budgetFactsToCsv } from "../lib/data/factCsv";
import { extractOfficialRevenueRows } from "../lib/data/realRevenue/extractWorkbooks";
import { generateRevenueFacts } from "../lib/data/realRevenue/generateFacts";
import { validateRealRevenueFacts } from "../lib/data/realRevenue/validateRealRevenue";

async function main() {
  const officialRows = extractOfficialRevenueRows();
  const facts = generateRevenueFacts(officialRows);
  const report = validateRealRevenueFacts(officialRows, facts);
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(importsDir, "revenue-facts-2023-2025.csv"), budgetFactsToCsv(facts), "utf8");
  await writeFile(path.join(reportsDir, "real-revenue-2023-2025-report.json"), JSON.stringify(report, null, 2), "utf8");

  if (Object.values(report.reconciliationStatusByYear).some((status) => status === "failed")) {
    throw new Error("Real revenue reconciliation failed. See data/reports/real-revenue-2023-2025-report.json");
  }

  console.log(`Generated revenue fact rows: ${facts.length}`);
  console.log("Report written: data/reports/real-revenue-2023-2025-report.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 4: Create the compose script**

Create `apps/web/scripts/compose-budget-facts.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { budgetFactsToCsv } from "../lib/data/factCsv";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";

async function main() {
  const [expenditureRows, revenueRows] = await Promise.all([
    loadBudgetFactRows("../../data/imports/expenditure-facts-2023-2025.csv"),
    loadBudgetFactRows("../../data/imports/revenue-facts-2023-2025.csv"),
  ]);
  const rows = [...expenditureRows, ...revenueRows]
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.side !== b.side) return a.side.localeCompare(b.side);
      return a.itemId.localeCompare(b.itemId);
    })
    .map((row) => ({
      year: row.year,
      side: row.side,
      item_id: row.itemId,
      amount_gel: String(row.amountGel),
      basis: row.basis,
      source_id: row.sourceId,
      official_institution: row.officialInstitution ?? "",
      official_program: row.officialProgram ?? "",
      official_subprogram: row.officialSubprogram ?? "",
      public_spending_field_id: row.publicSpendingFieldId ?? "",
      mapping_confidence: row.mappingConfidence ?? "",
      mapping_notes: row.mappingNotes,
    }));
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");
  const report = {
    importLabel: "budget-facts-2023-2025",
    expenditureRows: expenditureRows.length,
    revenueRows: revenueRows.length,
    totalRows: rows.length,
  };

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(importsDir, "budget-facts-2023-2025.csv"), budgetFactsToCsv(rows), "utf8");
  await writeFile(path.join(reportsDir, "budget-facts-2023-2025-compose-report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(`Composed budget fact rows: ${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 5: Add npm scripts**

In `apps/web/package.json`, add:

```json
"data:generate-revenue-facts": "tsx scripts/generate-real-revenue-facts.ts",
"data:compose-budget-facts": "tsx scripts/compose-budget-facts.ts"
```

- [ ] **Step 6: Regenerate expenditure, revenue, and composed facts**

Run:

```powershell
npm run data:generate-expenditure-facts
npm run data:generate-revenue-facts
npm run data:compose-budget-facts
```

Expected:

```text
Generated fact rows: <current expenditure row count>
Generated revenue fact rows: 9
Composed budget fact rows: <current expenditure row count + 9>
```

On the current baseline this is expected to be `39 + 9 = 48`, but do not fail the plan solely because the expenditure count changed before implementation. Fail only if revenue is not exactly `9`, composition is not `expenditureRows + revenueRows`, or validation later cannot reconcile the combined file.

- [ ] **Step 7: Commit**

Run:

```powershell
git add apps/web/lib/data/factCsv.ts apps/web/scripts/generate-real-expenditure-facts.ts apps/web/scripts/generate-real-revenue-facts.ts apps/web/scripts/compose-budget-facts.ts apps/web/package.json data/imports/expenditure-facts-2023-2025.csv data/imports/revenue-facts-2023-2025.csv data/imports/budget-facts-2023-2025.csv data/reports/real-expenditure-2023-2025-report.json data/reports/real-revenue-2023-2025-report.json data/reports/budget-facts-2023-2025-compose-report.json
git commit -m "feat: compose real budget facts with revenue"
```

## Task 8: Update Source Metadata and Data Validation

**Files:**

- Modify: `data/sources/source-documents.csv`
- Modify: `apps/web/scripts/validate-data-files.ts`

- [ ] **Step 1: Add source document rows**

Add these rows to `data/sources/source-documents.csv`:

```csv
source.mof_2023_tavi1_actual,Reviewed official 2023 state budget execution tavi 1,docs/Raw Data/2023 12 tve saitistvis.xls,2026-05-13
source.mof_2024_tavi1_actual,Reviewed official 2024 state budget execution tavi 1,docs/Raw Data/2024 12 თვე საიტისთვის.xlsx,2026-05-13
source.mof_2025_tavi1_actual,Reviewed official 2025 state budget execution tavi 1,docs/Raw Data/2025.xlsx,2026-05-13
```

- [ ] **Step 2: Update validation report label**

In `apps/web/scripts/validate-data-files.ts`, change:

```ts
const report = buildImportReport("real-expenditure-2023-2025", facts);
```

to:

```ts
const report = buildImportReport("real-budget-2023-2025", facts);
```

Change the report output filename from:

```ts
"../../data/reports/real-expenditure-2023-2025-import-report.json"
```

to:

```ts
"../../data/reports/real-budget-2023-2025-import-report.json"
```

- [ ] **Step 3: Run data validation**

Run:

```powershell
npm run data:validate
```

Expected:

```text
Validated taxonomy rows: <previous taxonomy count + 1>
Validated glossary rows: <previous glossary count + 1>
Validated source rows: 8
Validated mapping rows: 13
Validated fact rows: <current expenditure row count + 9>
```

On the current baseline this should print `Validated fact rows: 48`. If counts differ, compare the generated reports before accepting the change. The validation must still prove that all revenue fact `source_id` values exist in `data/sources/source-documents.csv` and that `revenue.taxes_total`, `revenue.grants`, and `revenue.other_revenue` exist in both taxonomy and glossary files.

- [ ] **Step 4: Commit**

Run:

```powershell
git add data/sources/source-documents.csv apps/web/scripts/validate-data-files.ts data/reports/real-budget-2023-2025-import-report.json
git commit -m "feat: validate combined real budget facts"
```

## Task 9: Activate Revenue Explorer Tests

**Files:**

- Modify: `apps/web/tests/explorer/integration.test.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add a real revenue multi-year integration test**

In `apps/web/tests/explorer/integration.test.ts`, add this test near the other real CSV integration tests. Do not remove the single-year revenue empty-state test yet; replace it in Step 2.

```ts
it("builds a non-empty revenue model from real facts", async () => {
  const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
  const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
  const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
  const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);

  const selectedItemIds = getDefaultSelection("revenue", facts);
  expect(selectedItemIds).toEqual(["revenue.total"]);

  const model = buildExplorerModel({
    facts,
    glossary,
    sourceDocuments,
    side: "revenue",
    selectedItemIds,
    startYear: years[0],
    endYear: years[years.length - 1],
    measure: "nominal",
  });

  expect(model.unavailableReason).toBeNull();
  expect(model.totalRow?.valuesByYear[2025]).toBeGreaterThan(0);
  expect(model.tableRows.map((row) => row.itemId)).toEqual(
    expect.arrayContaining(["revenue.taxes_total", "revenue.grants", "revenue.other_revenue"]),
  );
});
```

- [ ] **Step 2: Replace the current single-year revenue empty-state test**

Replace the existing test named `returns a revenue empty state for current real facts` with this aggregate-only source-backed single-year test:

```ts
it("keeps single-year revenue source-backed but aggregate-only", async () => {
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

  expect(model.emptyReason).toBeNull();
  expect(model.items.map((item) => item.itemId)).toEqual(
    expect.arrayContaining(["revenue.taxes_total", "revenue.grants", "revenue.other_revenue"]),
  );
});
```

- [ ] **Step 3: Update browser revenue expectation**

In `apps/web/tests/browser/main-explorer.spec.ts`, in the main explorer test after clicking Revenue, replace:

```ts
await expect(page.getByText("არჩეული მონაცემი არ არის.")).toBeVisible();
```

with:

```ts
await expect(page.locator("aside")).toContainText("გადასახადები სულ");
await expect(page.locator(".recharts-wrapper")).toBeVisible();
```

In the single-year browser test after clicking Revenue, replace the empty-state assertion with:

```ts
await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
await expect(page.getByTestId("single-year-ranking")).toContainText("გადასახადები სულ");
```

- [ ] **Step 4: Run explorer and browser tests**

Run:

```powershell
npm run test -- tests/explorer/integration.test.ts
npm run test:browser
```

Expected:

```text
PASS tests/explorer/integration.test.ts
3 passed
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/tests/explorer/integration.test.ts apps/web/tests/browser/main-explorer.spec.ts
git commit -m "test: verify real revenue explorer data"
```

## Task 10: Final Verification

**Files:**

- No new files.

- [ ] **Step 1: Run full unit test suite**

Run:

```powershell
npm run test
```

Expected:

```text
PASS
```

- [ ] **Step 2: Run data validation**

Run:

```powershell
npm run data:validate
```

Expected:

```text
Validated fact rows: <current expenditure row count + 9>
```

- [ ] **Step 3: Run production build**

Run:

```powershell
$env:DATABASE_URL="postgresql://user:password@localhost:5432/geodata"; $env:DIRECT_URL="postgresql://user:password@localhost:5432/geodata"; npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 4: Run browser tests**

Run:

```powershell
npm run test:browser
```

Expected:

```text
3 passed
```

- [ ] **Step 5: Check generated reports**

Open and inspect:

```text
data/reports/real-revenue-2023-2025-report.json
data/reports/budget-facts-2023-2025-compose-report.json
data/reports/real-budget-2023-2025-import-report.json
```

Required values:

```text
real-revenue-2023-2025-report.json -> generatedFactRows: 9
real-revenue-2023-2025-report.json -> warnings includes tax_breakdown_missing_from_current_workbooks
budget-facts-2023-2025-compose-report.json -> revenueRows: 9
budget-facts-2023-2025-compose-report.json -> totalRows equals expenditureRows + revenueRows
real-budget-2023-2025-import-report.json -> totalRevenueGel > 0
```

- [ ] **Step 6: Check git diff**

Run:

```powershell
git diff --check
git status --short
```

Expected:

```text
git diff --check
```

prints no output.

`git status --short` shows only intentional Plan 5 files if the final commit has not been made.

- [ ] **Step 7: Final commit**

If every task commit above was made, there should be no final commit. Run `git status --short` and confirm the tree is clean.

If implementation was done without per-task commits and intentional Plan 5 changes remain, stage only the exact files changed by this plan. Do not run `git add .`.

Use a command shaped like this, with the final exact file list from `git status --short`:

```powershell
git add <exact Plan 5 file 1> <exact Plan 5 file 2> <exact generated data file>
git commit -m "feat: add real revenue data pipeline"
```

Before committing, confirm no unrelated files are staged:

```powershell
git diff --cached --name-only
```

## Known Windows Tooling Behavior

If `npm run test`, `npm run data:validate`, `npm run data:generate-expenditure-facts`, `npm run data:generate-revenue-facts`, `npm run data:compose-budget-facts`, `npm run build`, or `npm run test:browser` fails with `spawn EPERM`, index lock, or report-write permission errors, rerun the same command with Codex escalation. Treat that as a Windows sandbox/tooling problem unless the rerun exposes a product failure.

## Self-Review

### Spec Coverage

This plan covers the v1 Revenue side enough to stop showing a data-empty Revenue explorer for the current real-data window. It does not complete final v1 tax-category requirements because the committed workbook set does not contain direct tax breakdown rows.

Covered:

- Source-backed revenue facts.
- Stable ID taxonomy.
- Georgian-first labels through glossary.
- CSV/source metadata.
- Actual-basis revenue values.
- Public Revenue mode activation.
- Validation reports.

Not covered by design:

- Direct VAT/income/profit/excise/import/property tax category facts.
- Revenue data outside the 2023-2025 v1 window.

### Placeholder Scan

The plan contains no placeholder implementation tasks. The only intentionally future-facing boundary is the tax-breakdown gap, which is represented as a report warning and excluded scope, not an unfinished instruction.

### Type Consistency

The generated revenue fact type uses the same headers as the existing import CSV. `BudgetFactCsvRow` matches `loadBudgetFactRows` field names after CSV serialization. Revenue rows intentionally leave spending-only columns empty.

### Risk Notes

- `revenue.taxes_total` is a deliberate intermediate category. Do not rename it to `revenue.other_taxes`.
- Do not include non-financial asset decrease, financial asset decrease, or liability increase in Plan 5 until the explorer has a separate semantic model for revenue versus financing sources. Adding those rows now would inflate `revenue.total`.
- The final expected row counts are based on current generated expenditure rows (`39`) plus three revenue categories for three years (`9`). If expenditure mappings change before implementation, recompute the expected combined row count from generated files before accepting a mismatch.
