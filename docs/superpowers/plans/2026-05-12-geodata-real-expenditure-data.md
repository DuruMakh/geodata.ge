# Real Expenditure Data Extraction and Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract 2023, 2024, and 2025 actual expenditure data from the uploaded `tavi 6` Excel sheets, generate a reviewable public-spending mapping file, and produce validated app-ready expenditure facts.

**Architecture:** Keep real-data preparation as a deterministic local data pipeline under `apps/web/lib/data/realExpenditure/*` plus scripts under `apps/web/scripts/*`. The pipeline reads raw Excel workbooks, extracts official coded rows, maps only leaf coded rows to public spending fields, generates a human review CSV, aggregates reviewed leaf rows by `year + public_spending_field_id`, then writes final `data/imports/budget-facts-2023-2025.csv` after validation. The app continues to read CSV facts; Plan 3 changes the data source, not the public UI model.

**Tech Stack:** Next.js app workspace, TypeScript, Vitest, `csv-parse`, `xlsx`, existing CSV/taxonomy/source/mapping validation helpers.

---

## Scope

Plan 3 covers expenditure only.

Included:

- Read these raw workbooks:
  - `docs/Raw Data/2023 12 tve saitistvis.xls`
  - `docs/Raw Data/2024 12 თვე საიტისთვის.xlsx`
  - `docs/Raw Data/2025.xlsx`
- Extract only `tavi 6` / `VI თავი` expenditure sheets.
- Use actual execution values only.
- Treat source amounts as thousand GEL and write app facts in GEL.
- Reconcile public expenditure to `00 00 / სულ ჯამი`.
- Generate reviewable candidate mappings before final public facts.
- Use leaf coded rows as the mapping/fact source to avoid parent-child double counting.
- Aggregate reviewed leaf rows before app import so the final CSV has one row per `year + public_spending_field_id`.

Excluded:

- Revenue extraction.
- Data outside the 2023-2025 v1 window.
- Economic-classification public visuals from blank-code rows such as `შრომის ანაზღაურება`.
- Database insert into Supabase.
- UI changes beyond switching the app from sample facts to the generated 2023-2025 facts.

## Source Facts Observed Before Planning

- 2025 workbook sheet: `tavi 6`.
- 2024 workbook sheet: `VI თავი`.
- 2023 workbook is legacy `.xls`; the local Python runtime can inspect it through pandas, and the implementation uses `xlsx` so the project pipeline can read `.xls` and `.xlsx` from TypeScript.
- `tavi 6` columns are structurally consistent enough for header detection:
  - code
  - label
  - approved plan
  - revised plan
  - actual
  - execution percent
- Source values are in thousand GEL. App facts must multiply by `1000`.

## Data Model Rules

- `00 00 / სულ ჯამი` is the official public expenditure reconciliation anchor.
- Rows with non-empty official codes are official hierarchy rows.
- Blank-code rows are economic-classification children of the nearest coded row. They are extracted for audit context but are not mapped to public spending fields in Plan 3.
- Public facts are generated from leaf coded rows only. A leaf coded row is a coded row with no deeper coded descendants.
- Final app facts are aggregated by `year + public_spending_field_id`. Do not write multiple final CSV rows with the same `year`, `side`, and `item_id`; the existing app model treats that key as unique.
- `expenditure.total` remains derived by the app from public fact rows. Do not write a `00 00` fact into `budget-facts-2023-2025.csv`.
- Unmapped leaf coded rows become `spending.other_unclassified`; they must remain visible in totals.
- The review file must preserve ancestor labels for audit: institution, program, and subprogram/activity context.
- Candidate mappings are suggestions only. Unreviewed `medium`, `low`, and `unclassified` rows above the configured review threshold must block final fact generation.

## File Structure

Create:

- `apps/web/lib/data/realExpenditure/types.ts`
  - Shared types for extracted official rows, candidate mappings, reviewed mappings, generated facts, and validation reports.
- `apps/web/lib/data/realExpenditure/hierarchy.ts`
  - Code normalization, code depth, parent-code lookup, and leaf-row detection.
- `apps/web/lib/data/realExpenditure/parseTavi6Rows.ts`
  - Converts worksheet matrices into normalized official rows.
- `apps/web/lib/data/realExpenditure/extractWorkbooks.ts`
  - Reads the three uploaded Excel workbooks and extracts normalized rows.
- `apps/web/lib/data/realExpenditure/candidateMapping.ts`
  - Deterministic draft mapping rules and mapping confidence assignment.
- `apps/web/lib/data/realExpenditure/reviewMappings.ts`
  - Loads review CSV rows and resolves final reviewed mappings.
- `apps/web/lib/data/realExpenditure/generateFacts.ts`
  - Aggregates reviewed leaf rows into one public expenditure fact per year and public spending field.
- `apps/web/lib/data/realExpenditure/validateRealExpenditure.ts`
  - Reconciliation, double-counting, taxonomy/source, and unclassified-share validation.
- `apps/web/scripts/extract-real-expenditure.ts`
  - Writes staging official rows and candidate mapping review file.
- `apps/web/scripts/generate-real-expenditure-facts.ts`
  - Reads reviewed mappings and writes final facts plus validation report.
- `apps/web/tests/data/realExpenditure/hierarchy.test.ts`
- `apps/web/tests/data/realExpenditure/parseTavi6Rows.test.ts`
- `apps/web/tests/data/realExpenditure/candidateMapping.test.ts`
- `apps/web/tests/data/realExpenditure/generateFacts.test.ts`
- `apps/web/tests/data/realExpenditure/validateRealExpenditure.test.ts`
- `data/staging/expenditure-official-rows-2023-2025.csv`
- `data/mappings/review/spending-field-mapping-review-2023-2025.csv`
- `data/imports/budget-facts-2023-2025.csv`
- `data/reports/real-expenditure-2023-2025-report.json`

Modify:

- `apps/web/package.json`
  - Add `xlsx` dependency.
  - Add data scripts.
- `data/sources/source-documents.csv`
  - Add 2023, 2024, and 2025 `tavi 6` source rows.
- `apps/web/scripts/validate-data-files.ts`
  - Validate generated real expenditure facts instead of only sample facts.
- `apps/web/scripts/import-budget-facts.ts`
  - Point to generated real expenditure facts.
- `apps/web/app/page.tsx`
  - Read generated real expenditure facts.

Do not modify:

- Public UI components, except if the data switch exposes a real-data formatting bug.
- Taxonomy IDs unless validation proves a required public spending field is missing.

---

### Task 1: Add Data Source Rows and Package Scripts

**Files:**

- Modify: `apps/web/package.json`
- Modify: `data/sources/source-documents.csv`

- [ ] **Step 1: Install the Excel reader dependency**

Before choosing exact `xlsx` read APIs, use Context7 for current SheetJS/`xlsx` documentation:

```text
resolve-library-id: xlsx SheetJS
query-docs: How do I read .xls and .xlsx workbooks from Node.js and convert a worksheet to a two-dimensional array?
```

Use the fetched docs to confirm whether `XLSX.readFile` and `XLSX.utils.sheet_to_json(..., { header: 1 })` remain the right APIs. If docs show a safer current API, update the implementation snippets in this plan before coding.

Run:

```powershell
cd apps/web
npm install xlsx
```

Expected:

```text
added ... packages
found 0 vulnerabilities
```

If npm reports vulnerabilities, keep the install if they are transitive non-critical advisories and note them in the final handoff. If install fails from network access, rerun with escalation according to Codex sandbox policy.

- [ ] **Step 2: Add data scripts**

Modify `apps/web/package.json` scripts to include:

```json
"data:extract-expenditure": "tsx scripts/extract-real-expenditure.ts",
"data:generate-expenditure-facts": "tsx scripts/generate-real-expenditure-facts.ts"
```

Expected scripts block after edit:

```json
{
  "predev": "prisma generate --schema prisma/schema.prisma",
  "dev": "next dev",
  "prebuild": "prisma generate --schema prisma/schema.prisma",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:browser": "playwright test",
  "test:watch": "vitest",
  "data:validate": "tsx scripts/validate-data-files.ts",
  "data:extract-expenditure": "tsx scripts/extract-real-expenditure.ts",
  "data:generate-expenditure-facts": "tsx scripts/generate-real-expenditure-facts.ts",
  "data:import": "tsx scripts/import-budget-facts.ts",
  "prisma:generate": "prisma generate --schema prisma/schema.prisma",
  "prisma:migrate": "prisma migrate dev"
}
```

- [ ] **Step 3: Register source documents**

Update `data/sources/source-documents.csv` so it contains:

```csv
source_id,source_name,source_url_or_file,last_reviewed_at
source.mof_2023_tavi6_actual,Reviewed official 2023 state budget execution tavi 6,docs/Raw Data/2023 12 tve saitistvis.xls,2026-05-12
source.mof_2024_tavi6_actual,Reviewed official 2024 state budget execution tavi 6,docs/Raw Data/2024 12 თვე საიტისთვის.xlsx,2026-05-12
source.mof_2025_tavi6_actual,Reviewed official 2025 state budget execution tavi 6,docs/Raw Data/2025.xlsx,2026-05-12
source.mof_2025_execution,Reviewed official 2025 budget execution documents,docs/Budget Data 2025,2026-05-10
```

Keep existing source rows if other sample tests still use them.

- [ ] **Step 4: Run package metadata check**

Run:

```powershell
cd apps/web
npm run lint
```

Expected:

```text
No ESLint warnings or errors
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/package.json apps/web/package-lock.json data/sources/source-documents.csv
git commit -m "chore: add real expenditure source setup"
```

Expected:

```text
[branch ...] chore: add real expenditure source setup
```

---

### Task 2: Implement Official Hierarchy Helpers

**Files:**

- Create: `apps/web/lib/data/realExpenditure/types.ts`
- Create: `apps/web/lib/data/realExpenditure/hierarchy.ts`
- Test: `apps/web/tests/data/realExpenditure/hierarchy.test.ts`

- [ ] **Step 1: Write the failing hierarchy tests**

Create `apps/web/tests/data/realExpenditure/hierarchy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ancestorCodesFor,
  codeDepth,
  findLeafCodes,
  normalizeOfficialCode,
  parentCodeFor,
} from "../../../lib/data/realExpenditure/hierarchy";

describe("real expenditure hierarchy helpers", () => {
  it("normalizes official codes with stable spacing", () => {
    expect(normalizeOfficialCode("01  01 03")).toBe("01 01 03");
    expect(normalizeOfficialCode(" 00 00 ")).toBe("00 00");
    expect(normalizeOfficialCode(null)).toBe(null);
    expect(normalizeOfficialCode("")).toBe(null);
  });

  it("computes code depth and parent code", () => {
    expect(codeDepth("00 00")).toBe(0);
    expect(codeDepth("01 00")).toBe(1);
    expect(codeDepth("01 01")).toBe(2);
    expect(codeDepth("01 01 03")).toBe(3);
    expect(codeDepth("01 01 03 02")).toBe(4);
    expect(parentCodeFor("01 01 03 02")).toBe("01 01 03");
    expect(parentCodeFor("01 01 03")).toBe("01 01");
    expect(parentCodeFor("01 01")).toBe("01 00");
    expect(parentCodeFor("01 00")).toBe("00 00");
    expect(parentCodeFor("00 00")).toBe(null);
    expect(ancestorCodesFor("01 01 03 02")).toEqual(["01 00", "01 01", "01 01 03"]);
  });

  it("finds only leaf coded rows", () => {
    expect(findLeafCodes(["00 00", "01 00", "01 01", "01 01 01", "01 02", "02 00"])).toEqual([
      "01 01 01",
      "01 02",
      "02 00",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/hierarchy.test.ts
```

Expected:

```text
FAIL  tests/data/realExpenditure/hierarchy.test.ts
Cannot find module '../../../lib/data/realExpenditure/hierarchy'
```

- [ ] **Step 3: Add shared types**

Create `apps/web/lib/data/realExpenditure/types.ts`:

```ts
export type RealExpenditureSource = {
  year: number;
  sourceId: string;
  workbookPath: string;
  preferredSheetNames: string[];
};

export type OfficialExpenditureRow = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  rowNumber: number;
  code: string | null;
  parentCode: string | null;
  depth: number | null;
  institutionCode: string | null;
  institutionLabelKa: string | null;
  programCode: string | null;
  programLabelKa: string | null;
  subprogramCode: string | null;
  subprogramLabelKa: string | null;
  isTotal: boolean;
  isCodedRow: boolean;
  isLeafCode: boolean;
  labelKa: string;
  approvedPlanThousandGel: number | null;
  revisedPlanThousandGel: number | null;
  actualThousandGel: number;
  executionPercent: number | null;
};

export type MappingConfidence = "high" | "medium" | "low" | "unclassified";

export type CandidateSpendingMapping = {
  year: number;
  code: string;
  parentCode: string | null;
  depth: number;
  institutionCode: string | null;
  institutionLabelKa: string | null;
  programCode: string | null;
  programLabelKa: string | null;
  subprogramCode: string | null;
  subprogramLabelKa: string | null;
  labelKa: string;
  actualGel: number;
  suggestedPublicSpendingFieldId: string;
  mappingConfidence: MappingConfidence;
  mappingReason: string;
  reviewedPublicSpendingFieldId: string;
  reviewNotes: string;
};

export type RealExpenditureValidationReport = {
  importLabel: string;
  years: number[];
  sourceRows: number;
  leafRows: number;
  generatedFactRows: number;
  officialTotalGelByYear: Record<number, number>;
  generatedTotalGelByYear: Record<number, number>;
  unclassifiedAmountGelByYear: Record<number, number>;
  unclassifiedShareByYear: Record<number, number>;
  reconciliationStatusByYear: Record<number, "passed" | "failed">;
  warnings: string[];
};
```

- [ ] **Step 4: Add hierarchy helpers**

Create `apps/web/lib/data/realExpenditure/hierarchy.ts`:

```ts
export function normalizeOfficialCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized.length === 0 ? null : normalized;
}

export function codeDepth(code: string): number {
  const normalized = normalizeOfficialCode(code);
  if (!normalized || normalized === "00 00") return 0;
  const parts = normalized.split(" ");
  if (parts.length === 2 && parts[1] === "00") return 1;
  return parts.length;
}

export function parentCodeFor(code: string): string | null {
  const normalized = normalizeOfficialCode(code);
  if (!normalized || normalized === "00 00") return null;
  const parts = normalized.split(" ");

  if (parts.length === 2) return "00 00";
  if (parts.length === 3) return `${parts[0]} ${parts[1]}`;
  return parts.slice(0, -1).join(" ");
}

export function ancestorCodesFor(code: string): string[] {
  const ancestors: string[] = [];
  let current = parentCodeFor(code);

  while (current && current !== "00 00") {
    ancestors.unshift(current);
    current = parentCodeFor(current);
  }

  return ancestors;
}

export function findLeafCodes(codes: string[]): string[] {
  const normalizedCodes = Array.from(
    new Set(codes.map(normalizeOfficialCode).filter((code): code is string => Boolean(code))),
  );
  const ancestorCodes = new Set(normalizedCodes.flatMap(ancestorCodesFor));

  return normalizedCodes
    .filter((code) => code !== "00 00")
    .filter((code) => !ancestorCodes.has(code))
    .sort((a, b) => a.localeCompare(b));
}
```

- [ ] **Step 5: Run the hierarchy test**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/hierarchy.test.ts
```

Expected:

```text
PASS  tests/data/realExpenditure/hierarchy.test.ts
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add apps/web/lib/data/realExpenditure/types.ts apps/web/lib/data/realExpenditure/hierarchy.ts apps/web/tests/data/realExpenditure/hierarchy.test.ts
git commit -m "feat: add expenditure hierarchy helpers"
```

Expected:

```text
[branch ...] feat: add expenditure hierarchy helpers
```

---

### Task 3: Parse `tavi 6` Worksheet Matrices

**Files:**

- Create: `apps/web/lib/data/realExpenditure/parseTavi6Rows.ts`
- Test: `apps/web/tests/data/realExpenditure/parseTavi6Rows.test.ts`

- [ ] **Step 1: Write the failing parser tests**

Create `apps/web/tests/data/realExpenditure/parseTavi6Rows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseTavi6Rows } from "../../../lib/data/realExpenditure/parseTavi6Rows";

describe("parseTavi6Rows", () => {
  it("parses coded rows and multiplies no values during raw extraction", () => {
    const matrix = [
      [null, null, null, null, null, null],
      [null, "კოდი", "დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
      [null, "00 00", "სულ ჯამი", 100, 100, 110, 1.1],
      [null, "01 00", "საქართველოს პარლამენტი", 10, 11, 12, 1.09],
      [null, null, "ხარჯები", 8, 9, 10, 1.11],
      [null, "01 01", "საკანონმდებლო საქმიანობა", 4, 5, 6, 1.2],
    ];

    const rows = parseTavi6Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi6_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi 6",
      matrix,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 3,
          code: "00 00",
          labelKa: "სულ ჯამი",
          actualThousandGel: 110,
          isTotal: true,
          isLeafCode: false,
        }),
        expect.objectContaining({
          rowNumber: 5,
          code: null,
          labelKa: "ხარჯები",
          isCodedRow: false,
        }),
        expect.objectContaining({
          rowNumber: 6,
          code: "01 01",
          parentCode: "01 00",
          isLeafCode: true,
        }),
      ]),
    );
  });

  it("handles the 2023 workbook leading marker column", () => {
    const matrix = [
      [null, "კოდი", "დასახელება", "2023 წლის დამტკიცებული გეგმა", "2023 წლის დაზუსტებული გეგმა", "2023 წლის ფაქტი", "შესრულება %"],
      ["A", "00 00", "სულ ჯამი", 100, 100, 100, 1],
      ["A", "01 00", "ინსტიტუცია", 25, 25, 25, 1],
    ];

    const rows = parseTavi6Rows({
      year: 2023,
      sourceId: "source.mof_2023_tavi6_actual",
      workbookPath: "docs/Raw Data/2023 12 tve saitistvis.xls",
      sheetName: "VI თავი",
      matrix,
    });

    expect(rows.map((row) => row.code)).toEqual(["00 00", "01 00"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/parseTavi6Rows.test.ts
```

Expected:

```text
FAIL  tests/data/realExpenditure/parseTavi6Rows.test.ts
Cannot find module '../../../lib/data/realExpenditure/parseTavi6Rows'
```

- [ ] **Step 3: Implement the parser**

Create `apps/web/lib/data/realExpenditure/parseTavi6Rows.ts`:

```ts
import type { OfficialExpenditureRow } from "./types";
import { codeDepth, findLeafCodes, normalizeOfficialCode, parentCodeFor } from "./hierarchy";

type MatrixCell = string | number | boolean | null | undefined;

export type ParseTavi6Input = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
};

function cellText(value: MatrixCell): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numericCell(value: MatrixCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findHeaderIndexes(matrix: MatrixCell[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 20); rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const codeIndex = row.findIndex((cell) => cellText(cell) === "კოდი");
    const labelIndex = row.findIndex((cell) => cellText(cell) === "დასახელება");
    const actualIndex = row.findIndex((cell) => cellText(cell).includes("ფაქტი"));

    if (codeIndex >= 0 && labelIndex >= 0 && actualIndex >= 0) {
      return {
        headerRowIndex: rowIndex,
        codeIndex,
        labelIndex,
        approvedPlanIndex: actualIndex - 2,
        revisedPlanIndex: actualIndex - 1,
        actualIndex,
        executionPercentIndex: actualIndex + 1,
      };
    }
  }

  throw new Error("Could not find tavi 6 header row with კოდი, დასახელება, and ფაქტი columns");
}

export function parseTavi6Rows(input: ParseTavi6Input): OfficialExpenditureRow[] {
  const indexes = findHeaderIndexes(input.matrix);
  const preliminary = input.matrix
    .slice(indexes.headerRowIndex + 1)
    .map((row, offset): Omit<OfficialExpenditureRow, "isLeafCode"> | null => {
      const code = normalizeOfficialCode(row[indexes.codeIndex]);
      const labelKa = cellText(row[indexes.labelIndex]);
      const actualThousandGel = numericCell(row[indexes.actualIndex]);

      if (!labelKa || actualThousandGel === null) return null;

      const depth = code ? codeDepth(code) : null;

      return {
        year: input.year,
        sourceId: input.sourceId,
        workbookPath: input.workbookPath,
        sheetName: input.sheetName,
        rowNumber: indexes.headerRowIndex + offset + 2,
        code,
        parentCode: code ? parentCodeFor(code) : null,
        depth,
        institutionCode: null,
        institutionLabelKa: null,
        programCode: null,
        programLabelKa: null,
        subprogramCode: null,
        subprogramLabelKa: null,
        isTotal: code === "00 00",
        isCodedRow: Boolean(code),
        labelKa,
        approvedPlanThousandGel: numericCell(row[indexes.approvedPlanIndex]),
        revisedPlanThousandGel: numericCell(row[indexes.revisedPlanIndex]),
        actualThousandGel,
        executionPercent: numericCell(row[indexes.executionPercentIndex]),
      };
    })
    .filter((row): row is Omit<OfficialExpenditureRow, "isLeafCode"> => Boolean(row));

  const leafCodes = new Set(findLeafCodes(preliminary.map((row) => row.code).filter((code): code is string => Boolean(code))));
  const rowsByCode = new Map(preliminary.filter((row) => row.code).map((row) => [row.code as string, row]));

  function contextFor(code: string | null) {
    if (!code) {
      return {
        institutionCode: null,
        institutionLabelKa: null,
        programCode: null,
        programLabelKa: null,
        subprogramCode: null,
        subprogramLabelKa: null,
      };
    }

    const parts = code.split(" ");
    const institutionCode = parts.length >= 2 ? `${parts[0]} 00` : null;
    const programCode = parts.length >= 2 && parts[1] !== "00" ? `${parts[0]} ${parts[1]}` : null;
    const subprogramCode = parts.length >= 3 ? `${parts[0]} ${parts[1]} ${parts[2]}` : null;

    return {
      institutionCode,
      institutionLabelKa: institutionCode ? rowsByCode.get(institutionCode)?.labelKa ?? null : null,
      programCode,
      programLabelKa: programCode ? rowsByCode.get(programCode)?.labelKa ?? null : null,
      subprogramCode,
      subprogramLabelKa: subprogramCode ? rowsByCode.get(subprogramCode)?.labelKa ?? null : null,
    };
  }

  return preliminary.map((row) => ({
    ...row,
    ...contextFor(row.code),
    isLeafCode: row.code ? leafCodes.has(row.code) : false,
  }));
}
```

- [ ] **Step 4: Run parser tests**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/parseTavi6Rows.test.ts
```

Expected:

```text
PASS  tests/data/realExpenditure/parseTavi6Rows.test.ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/lib/data/realExpenditure/parseTavi6Rows.ts apps/web/tests/data/realExpenditure/parseTavi6Rows.test.ts
git commit -m "feat: parse tavi 6 expenditure rows"
```

Expected:

```text
[branch ...] feat: parse tavi 6 expenditure rows
```

---

### Task 4: Extract Raw Workbook Rows to Staging CSV

**Files:**

- Create: `apps/web/lib/data/realExpenditure/extractWorkbooks.ts`
- Create: `apps/web/scripts/extract-real-expenditure.ts`
- Create: `data/staging/expenditure-official-rows-2023-2025.csv`

- [ ] **Step 1: Implement workbook extraction**

Create `apps/web/lib/data/realExpenditure/extractWorkbooks.ts`:

```ts
import path from "node:path";
import * as XLSX from "xlsx";
import { parseTavi6Rows } from "./parseTavi6Rows";
import type { OfficialExpenditureRow, RealExpenditureSource } from "./types";

export const realExpenditureSources: RealExpenditureSource[] = [
  {
    year: 2023,
    sourceId: "source.mof_2023_tavi6_actual",
    workbookPath: "../../docs/Raw Data/2023 12 tve saitistvis.xls",
    preferredSheetNames: ["VI თავი", "tavi 6"],
  },
  {
    year: 2024,
    sourceId: "source.mof_2024_tavi6_actual",
    workbookPath: "../../docs/Raw Data/2024 12 თვე საიტისთვის.xlsx",
    preferredSheetNames: ["VI თავი", "tavi 6"],
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi6_actual",
    workbookPath: "../../docs/Raw Data/2025.xlsx",
    preferredSheetNames: ["tavi 6", "VI თავი"],
  },
];

function normalizeSheetName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickSheetName(workbook: XLSX.WorkBook, preferredNames: string[]): string {
  const available = workbook.SheetNames;
  const availableByNormalized = new Map(available.map((name) => [normalizeSheetName(name), name]));

  for (const preferred of preferredNames) {
    const matched = availableByNormalized.get(normalizeSheetName(preferred));
    if (matched) return matched;
  }

  const candidate = available.find((name) => {
    const normalized = normalizeSheetName(name);
    return normalized.includes("tavi 6") || normalized.includes("vi თავი");
  });

  if (candidate) return candidate;

  throw new Error(`Could not find tavi 6 sheet. Available sheets: ${available.join(", ")}`);
}

export function extractOfficialExpenditureRows(): OfficialExpenditureRow[] {
  return realExpenditureSources.flatMap((source) => {
    const workbookFile = path.resolve(process.cwd(), source.workbookPath);
    const workbook = XLSX.readFile(workbookFile, { cellDates: false });
    const sheetName = pickSheetName(workbook, source.preferredSheetNames);
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) throw new Error(`Missing sheet after selection: ${sheetName}`);

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: true,
    });

    return parseTavi6Rows({
      year: source.year,
      sourceId: source.sourceId,
      workbookPath: source.workbookPath.replace("../../", ""),
      sheetName,
      matrix,
    });
  });
}
```

- [ ] **Step 2: Implement the extraction script**

Create `apps/web/scripts/extract-real-expenditure.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractOfficialExpenditureRows } from "../lib/data/realExpenditure/extractWorkbooks";

function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(headers: string[], rows: Array<Record<string, string | number | boolean | null>>): string {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? null)).join(",")),
  ].join("\n");
}

async function main() {
  const officialRows = extractOfficialExpenditureRows();
  const stagingDir = path.resolve(process.cwd(), "../../data/staging");

  await mkdir(stagingDir, { recursive: true });

  await writeFile(
    path.join(stagingDir, "expenditure-official-rows-2023-2025.csv"),
    rowsToCsv(
      [
        "year",
        "source_id",
        "workbook_path",
        "sheet_name",
        "row_number",
        "code",
        "parent_code",
        "depth",
        "institution_code",
        "institution_label_ka",
        "program_code",
        "program_label_ka",
        "subprogram_code",
        "subprogram_label_ka",
        "is_total",
        "is_coded_row",
        "is_leaf_code",
        "label_ka",
        "approved_plan_thousand_gel",
        "revised_plan_thousand_gel",
        "actual_thousand_gel",
        "execution_percent",
      ],
      officialRows.map((row) => ({
        year: row.year,
        source_id: row.sourceId,
        workbook_path: row.workbookPath,
        sheet_name: row.sheetName,
        row_number: row.rowNumber,
        code: row.code,
        parent_code: row.parentCode,
        depth: row.depth,
        institution_code: row.institutionCode,
        institution_label_ka: row.institutionLabelKa,
        program_code: row.programCode,
        program_label_ka: row.programLabelKa,
        subprogram_code: row.subprogramCode,
        subprogram_label_ka: row.subprogramLabelKa,
        is_total: row.isTotal,
        is_coded_row: row.isCodedRow,
        is_leaf_code: row.isLeafCode,
        label_ka: row.labelKa,
        approved_plan_thousand_gel: row.approvedPlanThousandGel,
        revised_plan_thousand_gel: row.revisedPlanThousandGel,
        actual_thousand_gel: row.actualThousandGel,
        execution_percent: row.executionPercent,
      })),
    ),
    "utf8",
  );

  console.log(`Extracted official rows: ${officialRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Commit extraction shell**

Run:

```powershell
git add apps/web/lib/data/realExpenditure/extractWorkbooks.ts apps/web/scripts/extract-real-expenditure.ts
git commit -m "feat: add real expenditure extraction script"
```

Expected:

```text
[branch ...] feat: add real expenditure extraction script
```

---

### Task 5: Generate Candidate Spending Mappings

**Files:**

- Create: `apps/web/lib/data/realExpenditure/candidateMapping.ts`
- Test: `apps/web/tests/data/realExpenditure/candidateMapping.test.ts`

- [ ] **Step 1: Write failing candidate mapping tests**

Create `apps/web/tests/data/realExpenditure/candidateMapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateCandidateMappings } from "../../../lib/data/realExpenditure/candidateMapping";
import type { OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

function row(labelKa: string, code: string, actualThousandGel = 10): OfficialExpenditureRow {
  return {
    year: 2025,
    sourceId: "source.mof_2025_tavi6_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi 6",
    rowNumber: 1,
    code,
    parentCode: "00 00",
    depth: 1,
    institutionCode: code,
    institutionLabelKa: labelKa,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: false,
    isCodedRow: true,
    isLeafCode: true,
    labelKa,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel,
    executionPercent: null,
  };
}

describe("generateCandidateMappings", () => {
  it("maps obvious institutions to high confidence fields", () => {
    const mappings = generateCandidateMappings([
      row("საქართველოს თავდაცვის სამინისტრო", "29 00"),
      row("საქართველოს განათლების, მეცნიერებისა და ახალგაზრდობის სამინისტრო", "32 00"),
    ]);

    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "29 00",
          suggestedPublicSpendingFieldId: "spending.defence",
          mappingConfidence: "high",
        }),
        expect.objectContaining({
          code: "32 00",
          suggestedPublicSpendingFieldId: "spending.education",
          mappingConfidence: "high",
        }),
      ]),
    );
  });

  it("keeps mixed health and social ministry rows reviewable", () => {
    const mappings = generateCandidateMappings([
      row("ჯანმრთელობის დაცვის პროგრამა", "27 03", 100),
      row("მოსახლეობის სოციალური დაცვა", "27 02", 200),
      row("ოკუპირებული ტერიტორიებიდან დევნილთა, შრომის, ჯანმრთელობისა და სოციალური დაცვის სამინისტრო", "27 00", 300),
    ]);

    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "27 03",
          suggestedPublicSpendingFieldId: "spending.health",
        }),
        expect.objectContaining({
          code: "27 02",
          suggestedPublicSpendingFieldId: "spending.social_protection",
        }),
        expect.objectContaining({
          code: "27 00",
          suggestedPublicSpendingFieldId: "spending.other_unclassified",
          mappingConfidence: "medium",
        }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/candidateMapping.test.ts
```

Expected:

```text
FAIL  tests/data/realExpenditure/candidateMapping.test.ts
Cannot find module '../../../lib/data/realExpenditure/candidateMapping'
```

- [ ] **Step 3: Implement deterministic candidate mappings**

Create `apps/web/lib/data/realExpenditure/candidateMapping.ts`:

```ts
import type { CandidateSpendingMapping, MappingConfidence, OfficialExpenditureRow } from "./types";

type RuleResult = {
  fieldId: string;
  confidence: MappingConfidence;
  reason: string;
};

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function suggestForLabel(labelKa: string): RuleResult {
  const text = labelKa.toLowerCase();

  if (includesAny(text, ["თავდაცვის სამინისტრო", "თავდაცვა"])) {
    return { fieldId: "spending.defence", confidence: "high", reason: "defence keyword" };
  }

  if (includesAny(text, ["განათლების", "სკოლ", "უნივერსიტეტ", "მეცნიერებ"])) {
    return { fieldId: "spending.education", confidence: "high", reason: "education keyword" };
  }

  if (includesAny(text, ["ჯანმრთელ", "ჯანდაცვ", "სამედიცინო", "დაავადებ"])) {
    return { fieldId: "spending.health", confidence: "medium", reason: "health keyword" };
  }

  if (includesAny(text, ["სოციალურ", "პენსი", "დევნილ", "დახმარებ", "ვეტერან"])) {
    return { fieldId: "spending.social_protection", confidence: "medium", reason: "social protection keyword" };
  }

  if (includesAny(text, ["შინაგან საქმეთა", "პოლიცი", "იუსტიციის", "სასამართლ", "პროკურატურ", "უსაფრთხოებ"])) {
    return { fieldId: "spending.public_order_safety", confidence: "high", reason: "public order or justice keyword" };
  }

  if (includesAny(text, ["ინფრასტრუქტურ", "რეგიონული განვითარ", "გზ", "წყალ", "მუნიციპალ"])) {
    return {
      fieldId: "spending.infrastructure_regional_development",
      confidence: "medium",
      reason: "infrastructure or regional development keyword",
    };
  }

  if (includesAny(text, ["ეკონომიკ", "ბიზნეს", "მეწარმ", "ინოვაცი", "ტურიზმ"])) {
    return { fieldId: "spending.economic_affairs", confidence: "medium", reason: "economic affairs keyword" };
  }

  if (includesAny(text, ["გარემოს", "სოფლის მეურნ", "აგრო", "დაცული ტერიტორი"])) {
    return {
      fieldId: "spending.agriculture_environment",
      confidence: "medium",
      reason: "agriculture or environment keyword",
    };
  }

  if (includesAny(text, ["კულტურ", "მუზეუმ", "ხელოვნებ", "მემკვიდრეობ"])) {
    return { fieldId: "spending.culture", confidence: "medium", reason: "culture keyword" };
  }

  if (includesAny(text, ["სპორტ"])) {
    return { fieldId: "spending.sport", confidence: "medium", reason: "sport keyword" };
  }

  if (includesAny(text, ["ვალდებულებების კლება", "პროცენტი", "ვალის"])) {
    return { fieldId: "spending.debt_service", confidence: "medium", reason: "debt service keyword" };
  }

  if (includesAny(text, ["პარლამენტ", "პრეზიდენტ", "მთავრობის ადმინისტრაცია", "აუდიტის სამსახური", "სახელმწიფო რწმუნებულ"])) {
    return {
      fieldId: "spending.general_public_services",
      confidence: "medium",
      reason: "general public services institution keyword",
    };
  }

  return {
    fieldId: "spending.other_unclassified",
    confidence: "unclassified",
    reason: "no deterministic rule matched",
  };
}

export function generateCandidateMappings(rows: OfficialExpenditureRow[]): CandidateSpendingMapping[] {
  return rows
    .filter((row) => row.isCodedRow && row.isLeafCode && row.code && !row.isTotal)
    .map((row) => {
      const suggestion = suggestForLabel(row.labelKa);

      return {
        year: row.year,
        code: row.code as string,
        parentCode: row.parentCode,
        depth: row.depth ?? 0,
        institutionCode: row.institutionCode,
        institutionLabelKa: row.institutionLabelKa,
        programCode: row.programCode,
        programLabelKa: row.programLabelKa,
        subprogramCode: row.subprogramCode,
        subprogramLabelKa: row.subprogramLabelKa,
        labelKa: row.labelKa,
        actualGel: Math.round(row.actualThousandGel * 1000),
        suggestedPublicSpendingFieldId: suggestion.fieldId,
        mappingConfidence: suggestion.confidence,
        mappingReason: suggestion.reason,
        reviewedPublicSpendingFieldId: "",
        reviewNotes: "",
      };
    })
    .sort((a, b) => {
      const confidenceOrder: Record<MappingConfidence, number> = {
        unclassified: 0,
        low: 1,
        medium: 2,
        high: 3,
      };
      const confidenceDifference = confidenceOrder[a.mappingConfidence] - confidenceOrder[b.mappingConfidence];
      if (confidenceDifference !== 0) return confidenceDifference;
      return b.actualGel - a.actualGel;
    });
}
```

- [ ] **Step 4: Run candidate mapping tests**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/candidateMapping.test.ts
```

Expected:

```text
PASS  tests/data/realExpenditure/candidateMapping.test.ts
```

- [ ] **Step 5: Extend extraction script to write review mappings**

Modify `apps/web/scripts/extract-real-expenditure.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateCandidateMappings } from "../lib/data/realExpenditure/candidateMapping";
import { extractOfficialExpenditureRows } from "../lib/data/realExpenditure/extractWorkbooks";

function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(headers: string[], rows: Array<Record<string, string | number | boolean | null>>): string {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? null)).join(",")),
  ].join("\n");
}

async function main() {
  const officialRows = extractOfficialExpenditureRows();
  const candidateMappings = generateCandidateMappings(officialRows);
  const stagingDir = path.resolve(process.cwd(), "../../data/staging");
  const reviewDir = path.resolve(process.cwd(), "../../data/mappings/review");

  await mkdir(stagingDir, { recursive: true });
  await mkdir(reviewDir, { recursive: true });

  await writeFile(
    path.join(stagingDir, "expenditure-official-rows-2023-2025.csv"),
    rowsToCsv(
      [
        "year",
        "source_id",
        "workbook_path",
        "sheet_name",
        "row_number",
        "code",
        "parent_code",
        "depth",
        "is_total",
        "is_coded_row",
        "is_leaf_code",
        "label_ka",
        "approved_plan_thousand_gel",
        "revised_plan_thousand_gel",
        "actual_thousand_gel",
        "execution_percent",
      ],
      officialRows.map((row) => ({
        year: row.year,
        source_id: row.sourceId,
        workbook_path: row.workbookPath,
        sheet_name: row.sheetName,
        row_number: row.rowNumber,
        code: row.code,
        parent_code: row.parentCode,
        depth: row.depth,
        is_total: row.isTotal,
        is_coded_row: row.isCodedRow,
        is_leaf_code: row.isLeafCode,
        label_ka: row.labelKa,
        approved_plan_thousand_gel: row.approvedPlanThousandGel,
        revised_plan_thousand_gel: row.revisedPlanThousandGel,
        actual_thousand_gel: row.actualThousandGel,
        execution_percent: row.executionPercent,
      })),
    ),
    "utf8",
  );

  await writeFile(
    path.join(reviewDir, "spending-field-mapping-review-2023-2025.csv"),
    rowsToCsv(
      [
        "year",
        "code",
        "parent_code",
        "depth",
        "institution_code",
        "institution_label_ka",
        "program_code",
        "program_label_ka",
        "subprogram_code",
        "subprogram_label_ka",
        "label_ka",
        "actual_gel",
        "suggested_public_spending_field_id",
        "mapping_confidence",
        "mapping_reason",
        "reviewed_public_spending_field_id",
        "review_notes",
      ],
      candidateMappings.map((mapping) => ({
        year: mapping.year,
        code: mapping.code,
        parent_code: mapping.parentCode,
        depth: mapping.depth,
        institution_code: mapping.institutionCode,
        institution_label_ka: mapping.institutionLabelKa,
        program_code: mapping.programCode,
        program_label_ka: mapping.programLabelKa,
        subprogram_code: mapping.subprogramCode,
        subprogram_label_ka: mapping.subprogramLabelKa,
        label_ka: mapping.labelKa,
        actual_gel: mapping.actualGel,
        suggested_public_spending_field_id: mapping.suggestedPublicSpendingFieldId,
        mapping_confidence: mapping.mappingConfidence,
        mapping_reason: mapping.mappingReason,
        reviewed_public_spending_field_id: mapping.reviewedPublicSpendingFieldId,
        review_notes: mapping.reviewNotes,
      })),
    ),
    "utf8",
  );

  console.log(`Extracted official rows: ${officialRows.length}`);
  console.log(`Candidate mapping rows: ${candidateMappings.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 6: Run extraction script**

Run:

```powershell
cd apps/web
npm run data:extract-expenditure
```

Expected:

```text
Extracted official rows: <number greater than 6000>
Candidate mapping rows: <number greater than 500>
```

Confirm files exist:

```powershell
Test-Path ..\..\data\staging\expenditure-official-rows-2023-2025.csv
Test-Path ..\..\data\mappings\review\spending-field-mapping-review-2023-2025.csv
```

Expected:

```text
True
True
```

- [ ] **Step 7: Commit**

Run:

```powershell
git add apps/web/lib/data/realExpenditure/candidateMapping.ts apps/web/tests/data/realExpenditure/candidateMapping.test.ts apps/web/scripts/extract-real-expenditure.ts data/staging/expenditure-official-rows-2023-2025.csv data/mappings/review/spending-field-mapping-review-2023-2025.csv
git commit -m "feat: generate expenditure mapping review file"
```

Expected:

```text
[branch ...] feat: generate expenditure mapping review file
```

---

### Task 6: Resolve Reviewed Mappings and Generate Public Facts

**Files:**

- Create: `apps/web/lib/data/realExpenditure/reviewMappings.ts`
- Create: `apps/web/lib/data/realExpenditure/generateFacts.ts`
- Test: `apps/web/tests/data/realExpenditure/generateFacts.test.ts`
- Create: `data/imports/budget-facts-2023-2025.csv`

- [ ] **Step 1: Write failing generation tests**

Create `apps/web/tests/data/realExpenditure/generateFacts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateBudgetFactsFromReviewedMappings } from "../../../lib/data/realExpenditure/generateFacts";
import type { CandidateSpendingMapping, OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

function officialRow(code: string, amount: number): OfficialExpenditureRow {
  return {
    year: 2025,
    sourceId: "source.mof_2025_tavi6_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi 6",
    rowNumber: 5,
    code,
    parentCode: "00 00",
    depth: 1,
    institutionCode: code,
    institutionLabelKa: `Institution ${code}`,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: false,
    isCodedRow: true,
    isLeafCode: true,
    labelKa: `Institution ${code}`,
    approvedPlanThousandGel: amount,
    revisedPlanThousandGel: amount,
    actualThousandGel: amount,
    executionPercent: 1,
  };
}

function mapping(code: string, fieldId: string, confidence: CandidateSpendingMapping["mappingConfidence"], reviewed = ""): CandidateSpendingMapping {
  return {
    year: 2025,
    code,
    parentCode: "00 00",
    depth: 1,
    institutionCode: code,
    institutionLabelKa: `Institution ${code}`,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    labelKa: `Institution ${code}`,
    actualGel: 100000,
    suggestedPublicSpendingFieldId: fieldId,
    mappingConfidence: confidence,
    mappingReason: "general public services institution keyword",
    reviewedPublicSpendingFieldId: reviewed,
    reviewNotes: "reviewed",
  };
}

describe("generateBudgetFactsFromReviewedMappings", () => {
  it("aggregates reviewed leaf rows by year and public spending field", () => {
    const facts = generateBudgetFactsFromReviewedMappings(
      [officialRow("01 00", 100), officialRow("02 00", 25)],
      [
        mapping("01 00", "spending.general_public_services", "medium", "spending.general_public_services"),
        mapping("02 00", "spending.general_public_services", "high"),
      ],
    );

    expect(facts).toEqual([
      {
        year: 2025,
        side: "expenditure",
        item_id: "spending.general_public_services",
        amount_gel: "125000",
        basis: "actual",
        source_id: "source.mof_2025_tavi6_actual",
        official_institution: "Multiple official rows",
        official_program: "",
        official_subprogram: "",
        public_spending_field_id: "spending.general_public_services",
        mapping_confidence: "medium",
        mapping_notes: "Aggregated 2 reviewed leaf rows; codes: 01 00, 02 00",
      },
    ]);
  });

  it("blocks unreviewed non-high-confidence rows above threshold", () => {
    expect(() =>
      generateBudgetFactsFromReviewedMappings(
        [officialRow("01 00", 100)],
        [mapping("01 00", "spending.general_public_services", "medium")],
      ),
    ).toThrow("requires reviewed_public_spending_field_id");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/generateFacts.test.ts
```

Expected:

```text
FAIL  tests/data/realExpenditure/generateFacts.test.ts
Cannot find module '../../../lib/data/realExpenditure/generateFacts'
```

- [ ] **Step 3: Implement mapping review resolver**

Create `apps/web/lib/data/realExpenditure/reviewMappings.ts`:

```ts
import { z } from "zod";
import { readCsvRecords } from "../csv";
import type { CandidateSpendingMapping, MappingConfidence } from "./types";

const reviewRowSchema = z.object({
  year: z.coerce.number().int(),
  code: z.string().min(1),
  parent_code: z.string(),
  depth: z.coerce.number().int(),
  institution_code: z.string(),
  institution_label_ka: z.string(),
  program_code: z.string(),
  program_label_ka: z.string(),
  subprogram_code: z.string(),
  subprogram_label_ka: z.string(),
  label_ka: z.string().min(1),
  actual_gel: z.coerce.number(),
  suggested_public_spending_field_id: z.string().min(1),
  mapping_confidence: z.enum(["high", "medium", "low", "unclassified"]),
  mapping_reason: z.string(),
  reviewed_public_spending_field_id: z.string(),
  review_notes: z.string(),
});

export async function loadCandidateMappingReviewRows(relativePath: string): Promise<CandidateSpendingMapping[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = reviewRowSchema.parse(record);

    return {
      year: row.year,
      code: row.code,
      parentCode: row.parent_code.trim() || null,
      depth: row.depth,
      institutionCode: row.institution_code.trim() || null,
      institutionLabelKa: row.institution_label_ka.trim() || null,
      programCode: row.program_code.trim() || null,
      programLabelKa: row.program_label_ka.trim() || null,
      subprogramCode: row.subprogram_code.trim() || null,
      subprogramLabelKa: row.subprogram_label_ka.trim() || null,
      labelKa: row.label_ka,
      actualGel: row.actual_gel,
      suggestedPublicSpendingFieldId: row.suggested_public_spending_field_id,
      mappingConfidence: row.mapping_confidence as MappingConfidence,
      mappingReason: row.mapping_reason,
      reviewedPublicSpendingFieldId: row.reviewed_public_spending_field_id.trim(),
      reviewNotes: row.review_notes,
    };
  });
}
```

- [ ] **Step 4: Implement fact generation**

Create `apps/web/lib/data/realExpenditure/generateFacts.ts`:

```ts
import type { CandidateSpendingMapping, MappingConfidence, OfficialExpenditureRow } from "./types";

export type RealExpenditureFactCsvRow = {
  year: number;
  side: "expenditure";
  item_id: string;
  amount_gel: string;
  basis: "actual";
  source_id: string;
  official_institution: string;
  official_program: string;
  official_subprogram: string;
  public_spending_field_id: string;
  mapping_confidence: MappingConfidence;
  mapping_notes: string;
};

function mappingKey(year: number, code: string): string {
  return `${year}:${code}`;
}

const REVIEW_REQUIRED_THRESHOLD_GEL = 10000000;

function resolvedFieldId(mapping: CandidateSpendingMapping): string {
  if (
    mapping.mappingConfidence !== "high" &&
    mapping.actualGel >= REVIEW_REQUIRED_THRESHOLD_GEL &&
    !mapping.reviewedPublicSpendingFieldId
  ) {
    throw new Error(`${mapping.year} ${mapping.code} requires reviewed_public_spending_field_id`);
  }

  if (mapping.mappingConfidence === "unclassified" && !mapping.reviewedPublicSpendingFieldId) {
    return "spending.other_unclassified";
  }

  return mapping.reviewedPublicSpendingFieldId || mapping.suggestedPublicSpendingFieldId;
}

function worstConfidence(current: MappingConfidence, next: MappingConfidence): MappingConfidence {
  const order: Record<MappingConfidence, number> = {
    unclassified: 0,
    low: 1,
    medium: 2,
    high: 3,
  };

  return order[next] < order[current] ? next : current;
}

export function generateBudgetFactsFromReviewedMappings(
  officialRows: OfficialExpenditureRow[],
  mappings: CandidateSpendingMapping[],
): RealExpenditureFactCsvRow[] {
  const mappingsByKey = new Map(mappings.map((mapping) => [mappingKey(mapping.year, mapping.code), mapping]));
  const aggregated = new Map<string, {
    year: number;
    publicSpendingFieldId: string;
    amountGel: number;
    sourceIds: Set<string>;
    codes: string[];
    mappingConfidence: MappingConfidence;
  }>();

  for (const row of officialRows
    .filter((row) => row.isCodedRow && row.isLeafCode && row.code && !row.isTotal)
  ) {
    const mapping = mappingsByKey.get(mappingKey(row.year, row.code as string));

    if (!mapping) {
      throw new Error(`Missing reviewed mapping for ${row.year} ${row.code}`);
    }

    const publicSpendingFieldId = resolvedFieldId(mapping);
    const key = `${row.year}:${publicSpendingFieldId}`;
    const existing = aggregated.get(key);

    if (!existing) {
      aggregated.set(key, {
        year: row.year,
        publicSpendingFieldId,
        amountGel: Math.round(row.actualThousandGel * 1000),
        sourceIds: new Set([row.sourceId]),
        codes: [row.code as string],
        mappingConfidence: mapping.mappingConfidence,
      });
      continue;
    }

    existing.amountGel += Math.round(row.actualThousandGel * 1000);
    existing.sourceIds.add(row.sourceId);
    existing.codes.push(row.code as string);
    existing.mappingConfidence = worstConfidence(existing.mappingConfidence, mapping.mappingConfidence);
  }

  return Array.from(aggregated.values())
    .sort((a, b) => (a.year === b.year ? a.publicSpendingFieldId.localeCompare(b.publicSpendingFieldId) : a.year - b.year))
    .map((row) => ({
      year: row.year,
      side: "expenditure",
      item_id: row.publicSpendingFieldId,
      amount_gel: String(row.amountGel),
      basis: "actual",
      source_id: Array.from(row.sourceIds).sort()[0] ?? "",
      official_institution: "Multiple official rows",
      official_program: "",
      official_subprogram: "",
      public_spending_field_id: row.publicSpendingFieldId,
      mapping_confidence: row.mappingConfidence,
      mapping_notes: `Aggregated ${row.codes.length} reviewed leaf rows; codes: ${row.codes.sort().join(", ")}`,
    }));
}
```

- [ ] **Step 5: Run generation tests**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/generateFacts.test.ts
```

Expected:

```text
PASS  tests/data/realExpenditure/generateFacts.test.ts
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add apps/web/lib/data/realExpenditure/reviewMappings.ts apps/web/lib/data/realExpenditure/generateFacts.ts apps/web/tests/data/realExpenditure/generateFacts.test.ts
git commit -m "feat: generate reviewed expenditure facts"
```

Expected:

```text
[branch ...] feat: generate reviewed expenditure facts
```

---

### Task 7: Validate Real Expenditure Reconciliation

**Files:**

- Create: `apps/web/lib/data/realExpenditure/validateRealExpenditure.ts`
- Create: `apps/web/scripts/generate-real-expenditure-facts.ts`
- Test: `apps/web/tests/data/realExpenditure/validateRealExpenditure.test.ts`
- Create: `data/reports/real-expenditure-2023-2025-report.json`

- [ ] **Step 1: Write failing validation tests**

Create `apps/web/tests/data/realExpenditure/validateRealExpenditure.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateRealExpenditureFacts } from "../../../lib/data/realExpenditure/validateRealExpenditure";
import type { RealExpenditureFactCsvRow } from "../../../lib/data/realExpenditure/generateFacts";
import type { OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

const officialRows: OfficialExpenditureRow[] = [
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi6_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi 6",
    rowNumber: 4,
    code: "00 00",
    parentCode: null,
    depth: 0,
    institutionCode: null,
    institutionLabelKa: null,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: true,
    isCodedRow: true,
    isLeafCode: false,
    labelKa: "სულ ჯამი",
    approvedPlanThousandGel: 100,
    revisedPlanThousandGel: 100,
    actualThousandGel: 100,
    executionPercent: 1,
  },
];

describe("validateRealExpenditureFacts", () => {
  it("passes when generated facts reconcile to official total", () => {
    const facts: RealExpenditureFactCsvRow[] = [
      {
        year: 2025,
        side: "expenditure",
        item_id: "spending.general_public_services",
        amount_gel: "100000",
        basis: "actual",
        source_id: "source.mof_2025_tavi6_actual",
        official_institution: "საქართველოს პარლამენტი",
        official_program: "",
        official_subprogram: "",
        public_spending_field_id: "spending.general_public_services",
        mapping_confidence: "medium",
        mapping_notes: "reviewed",
      },
    ];

    expect(validateRealExpenditureFacts(officialRows, facts)).toEqual(
      expect.objectContaining({
        reconciliationStatusByYear: { 2025: "passed" },
        generatedTotalGelByYear: { 2025: 100000 },
      }),
    );
  });

  it("fails when generated facts do not reconcile to official total", () => {
    const facts: RealExpenditureFactCsvRow[] = [
      {
        year: 2025,
        side: "expenditure",
        item_id: "spending.general_public_services",
        amount_gel: "90000",
        basis: "actual",
        source_id: "source.mof_2025_tavi6_actual",
        official_institution: "საქართველოს პარლამენტი",
        official_program: "",
        official_subprogram: "",
        public_spending_field_id: "spending.general_public_services",
        mapping_confidence: "medium",
        mapping_notes: "reviewed",
      },
    ];

    const report = validateRealExpenditureFacts(officialRows, facts);

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings[0]).toContain("2025 reconciliation mismatch");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/validateRealExpenditure.test.ts
```

Expected:

```text
FAIL  tests/data/realExpenditure/validateRealExpenditure.test.ts
Cannot find module '../../../lib/data/realExpenditure/validateRealExpenditure'
```

- [ ] **Step 3: Implement validation**

Create `apps/web/lib/data/realExpenditure/validateRealExpenditure.ts`:

```ts
import type { RealExpenditureFactCsvRow } from "./generateFacts";
import type { OfficialExpenditureRow, RealExpenditureValidationReport } from "./types";

const RECONCILIATION_TOLERANCE_GEL = 1;

function addToYear(map: Record<number, number>, year: number, amount: number) {
  map[year] = (map[year] ?? 0) + amount;
}

export function validateRealExpenditureFacts(
  officialRows: OfficialExpenditureRow[],
  facts: RealExpenditureFactCsvRow[],
): RealExpenditureValidationReport {
  const years = Array.from(new Set(officialRows.map((row) => row.year))).sort((a, b) => a - b);
  const officialTotalGelByYear: Record<number, number> = {};
  const generatedTotalGelByYear: Record<number, number> = {};
  const unclassifiedAmountGelByYear: Record<number, number> = {};
  const unclassifiedShareByYear: Record<number, number> = {};
  const reconciliationStatusByYear: Record<number, "passed" | "failed"> = {};
  const warnings: string[] = [];

  for (const row of officialRows.filter((candidate) => candidate.isTotal)) {
    officialTotalGelByYear[row.year] = Math.round(row.actualThousandGel * 1000);
  }

  for (const fact of facts) {
    const amount = Number(fact.amount_gel);
    addToYear(generatedTotalGelByYear, fact.year, amount);

    if (fact.public_spending_field_id === "spending.other_unclassified") {
      addToYear(unclassifiedAmountGelByYear, fact.year, amount);
    }
  }

  for (const year of years) {
    const officialTotal = officialTotalGelByYear[year] ?? 0;
    const generatedTotal = generatedTotalGelByYear[year] ?? 0;
    const difference = Math.abs(officialTotal - generatedTotal);
    const unclassifiedAmount = unclassifiedAmountGelByYear[year] ?? 0;

    unclassifiedShareByYear[year] = officialTotal === 0 ? 0 : unclassifiedAmount / officialTotal;
    reconciliationStatusByYear[year] = difference <= RECONCILIATION_TOLERANCE_GEL ? "passed" : "failed";

    if (difference > RECONCILIATION_TOLERANCE_GEL) {
      warnings.push(`${year} reconciliation mismatch: official ${officialTotal}, generated ${generatedTotal}, difference ${difference}`);
    }

    if (unclassifiedAmount > 0) {
      warnings.push(`${year} unclassified expenditure: ${unclassifiedAmount} GEL (${unclassifiedShareByYear[year]})`);
    }
  }

  return {
    importLabel: "real-expenditure-2023-2025",
    years,
    sourceRows: officialRows.length,
    leafRows: officialRows.filter((row) => row.isLeafCode).length,
    generatedFactRows: facts.length,
    officialTotalGelByYear,
    generatedTotalGelByYear,
    unclassifiedAmountGelByYear,
    unclassifiedShareByYear,
    reconciliationStatusByYear,
    warnings,
  };
}
```

- [ ] **Step 4: Run validation tests**

Run:

```powershell
cd apps/web
npm run test -- tests/data/realExpenditure/validateRealExpenditure.test.ts
```

Expected:

```text
PASS  tests/data/realExpenditure/validateRealExpenditure.test.ts
```

- [ ] **Step 5: Implement generation script**

Create `apps/web/scripts/generate-real-expenditure-facts.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractOfficialExpenditureRows } from "../lib/data/realExpenditure/extractWorkbooks";
import { generateBudgetFactsFromReviewedMappings } from "../lib/data/realExpenditure/generateFacts";
import { loadCandidateMappingReviewRows } from "../lib/data/realExpenditure/reviewMappings";
import { validateRealExpenditureFacts } from "../lib/data/realExpenditure/validateRealExpenditure";

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function factsToCsv(rows: ReturnType<typeof generateBudgetFactsFromReviewedMappings>): string {
  const headers = [
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

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

async function main() {
  const officialRows = extractOfficialExpenditureRows();
  const mappings = await loadCandidateMappingReviewRows("../../data/mappings/review/spending-field-mapping-review-2023-2025.csv");
  const facts = generateBudgetFactsFromReviewedMappings(officialRows, mappings);
  const report = validateRealExpenditureFacts(officialRows, facts);
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(importsDir, "budget-facts-2023-2025.csv"), factsToCsv(facts), "utf8");
  await writeFile(path.join(reportsDir, "real-expenditure-2023-2025-report.json"), JSON.stringify(report, null, 2), "utf8");

  if (Object.values(report.reconciliationStatusByYear).some((status) => status === "failed")) {
    throw new Error("Real expenditure reconciliation failed. See data/reports/real-expenditure-2023-2025-report.json");
  }

  console.log(`Generated fact rows: ${facts.length}`);
  console.log("Report written: data/reports/real-expenditure-2023-2025-report.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 6: Generate final facts**

Run:

```powershell
cd apps/web
npm run data:generate-expenditure-facts
```

Expected:

```text
Generated fact rows: <number greater than 20>
Report written: data/reports/real-expenditure-2023-2025-report.json
```

If this fails because the review file still contains unreviewed large `medium` or `low` rows, open `data/mappings/review/spending-field-mapping-review-2023-2025.csv`, review the highest GEL rows, fill `reviewed_public_spending_field_id`, rerun the command, and keep the warnings visible in the report. Unreviewed `unclassified` rows remain in `spending.other_unclassified`.

- [ ] **Step 7: Commit**

Run:

```powershell
git add apps/web/lib/data/realExpenditure/validateRealExpenditure.ts apps/web/scripts/generate-real-expenditure-facts.ts apps/web/tests/data/realExpenditure/validateRealExpenditure.test.ts data/imports/budget-facts-2023-2025.csv data/reports/real-expenditure-2023-2025-report.json
git commit -m "feat: validate real expenditure facts"
```

Expected:

```text
[branch ...] feat: validate real expenditure facts
```

---

### Task 8: Switch App and Validation Scripts to Real Expenditure Facts

**Files:**

- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/scripts/import-budget-facts.ts`

- [ ] **Step 1: Update app data input**

Modify `apps/web/app/page.tsx`:

```ts
import { MainExplorer } from "../components/main-explorer/main-explorer";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { loadSourceDocuments } from "../lib/data/sources";

export default async function Home() {
  const [facts, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv"),
    loadGlossary("../../data/glossary/category-glossary.csv"),
    loadSourceDocuments("../../data/sources/source-documents.csv"),
  ]);
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      facts={facts}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
```

- [ ] **Step 2: Update validation script**

Modify the fact path in `apps/web/scripts/validate-data-files.ts`:

```ts
const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
const report = buildImportReport("real-expenditure-2023-2025", facts);
```

Modify the report path in the same file:

```ts
const reportPath = path.resolve(
  process.cwd(),
  "../../data/reports/real-expenditure-2023-2025-import-report.json",
);
```

- [ ] **Step 3: Update import script**

Modify `apps/web/scripts/import-budget-facts.ts`:

```ts
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";

async function main() {
  const rows = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
  const report = buildImportReport("real-expenditure-2023-2025", rows);

  console.log(JSON.stringify(report, null, 2));
  console.log("Database insert is intentionally deferred until Supabase DATABASE_URL is configured.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 4: Run data validation**

Run:

```powershell
cd apps/web
npm run data:validate
```

Expected:

```text
Validated taxonomy rows: <number>
Validated glossary rows: <number>
Validated source rows: <number>
Validated mapping rows: <number>
Validated fact rows: <number greater than 20>
Report written: <absolute path ending in real-expenditure-2023-2025-import-report.json>
```

- [ ] **Step 5: Run tests**

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

- [ ] **Step 6: Run production build**

Run:

```powershell
cd apps/web
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 7: Commit**

Run:

```powershell
git add apps/web/app/page.tsx apps/web/scripts/validate-data-files.ts apps/web/scripts/import-budget-facts.ts data/reports/real-expenditure-2023-2025-import-report.json
git commit -m "feat: use real expenditure facts in explorer"
```

Expected:

```text
[branch ...] feat: use real expenditure facts in explorer
```

---

### Task 9: Browser Verification

**Files:**

- No expected file changes unless verification exposes a real-data display issue.

- [ ] **Step 1: Start the dev server**

Run:

```powershell
cd apps/web
npm run dev
```

Expected:

```text
Local: http://localhost:3000
```

- [ ] **Step 2: Open browser and verify real data**

Open `http://localhost:3000` in the Codex Browser and verify:

- Years shown are `2023`, `2024`, `2025`.
- Expenditure is the default side.
- Revenue either has no rows or shows an empty state without crashing.
- Total expenditure is derived from real public facts.
- Table mode shows 2023, 2024, and 2025 exact values.
- CSV export includes source metadata for the 2023, 2024, and 2025 source rows.
- The public source label shows the latest review date from `source-documents.csv`.
- No mojibake appears in Georgian labels from taxonomy/glossary or imported official labels in CSV output.

- [ ] **Step 3: Stop dev server**

Stop the server from the terminal with `Ctrl+C`.

Expected:

```text
Terminate batch job (Y/N)?
```

Answer `Y` if prompted.

- [ ] **Step 4: Commit verification fixes only if files changed**

If verification required fixes:

```powershell
git add apps/web data
git commit -m "fix: polish real expenditure data verification"
```

If no files changed, do not create an empty commit.

---

## Self-Review

### Spec Coverage

Covered:

- Real expenditure extraction from uploaded 2023, 2024, and 2025 Excel files.
- `tavi 6` / `VI თავი` sheet targeting.
- `სულ ჯამი` as the reconciliation anchor.
- Thousand-GEL to GEL conversion.
- Leaf coded rows as the public-fact source.
- Draft automatic mapping with human review columns.
- Explicit unclassified handling.
- Reconciliation report.
- App switch from sample facts to generated real expenditure facts.

Deferred by design:

- Revenue data extraction.
- Data outside the 2023-2025 v1 window.
- Supabase insert.
- Single-year snapshot UI.
- Economic-classification analytics from blank-code rows.

### Placeholder Scan

This plan has no open placeholder markers or unnamed implementation steps. Review work is explicit in the generated CSV review columns.

### Type Consistency

Shared names are consistent across tasks:

- `OfficialExpenditureRow`
- `CandidateSpendingMapping`
- `RealExpenditureValidationReport`
- `extractOfficialExpenditureRows`
- `generateCandidateMappings`
- `loadCandidateMappingReviewRows`
- `generateBudgetFactsFromReviewedMappings`
- `validateRealExpenditureFacts`

### Risk Notes

- Candidate mapping rules are intentionally conservative. A high unclassified share after the first extraction is expected and should trigger review, not hidden auto-classification.
- The public UI currently has expenditure/revenue switching. Since Plan 3 only produces expenditure, revenue mode may need an empty-state polish if Plan 2 assumed sample revenue rows always exist.
- The generated facts aggregate by public spending field through the existing explorer model. Official row labels remain in import metadata, not as public category labels.
