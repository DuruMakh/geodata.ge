# GeoData.ge 2004-2025 Data Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the generated raw budget sources into app-visible facts so GeoData.ge officially supports expenditure from 2004-2025, revenue from 2005-2025, and expenditure grouping by both functional/public fields and ministries.

**Architecture:** Keep the existing data-first pipeline shape: source inventory -> parser/generator tests -> generated staging/import/report files -> composed app CSV -> validation -> browser proof. Add one small shared coverage module so the year ranges are not duplicated across revenue, expenditure, ministry, compose, validate, and UI code. Keep functional/public expenditure and ministry expenditure as separate fact sets behind the existing grouping switch.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright, `xlsx`, `pdf-parse`, CSV files under `data/`, raw sources under `docs/Raw Data/`.

---

## Approved Scope Decisions

- Official app coverage becomes 2004-2025.
- Revenue intentionally starts at 2005 because the repo does not have 2004 revenue data.
- Expenditure has two app groupings:
  - `Fields`: functional/public spending fields, using the existing public taxonomy and Treasury functional expenditure PDFs plus required supplements.
  - `Ministries`: administrative ministry/program representation, using `docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025`.
- The public taxonomy stays the same across 2004-2025.
- Any mapping, ministry rename, reused program code, or reconciliation problem in older years must be reported explicitly. Do not silently smooth it over.
- The UI must support the 2004-2025 range. Revenue mode must clamp to 2005-2025.

## Success Criteria

- `data/imports/expenditure-facts-2004-2025.csv` exists and covers every year 2004-2025.
- `data/imports/admin-spending-facts-2004-2025.csv` exists and covers every year 2004-2025.
- `data/imports/revenue-facts-2005-2025.csv` exists and covers every year 2005-2025, with no 2004 revenue row.
- `data/imports/budget-facts-2004-2025.csv` composes expenditure 2004-2025 plus revenue 2005-2025.
- Validation fails if required expenditure years, admin years, or revenue years are missing.
- The app opens with a 2004-2025-capable expenditure range and switches to revenue without showing unavailable 2004 revenue.
- Expenditure grouping switch still separates `Fields` from `Ministries`.
- Browser verification proves:
  - Expenditure Fields can show 2004 and 2025.
  - Expenditure Ministries can show 2004 and 2025.
  - Revenue can show 2005 and 2025 and does not expose 2004.

## File Structure

- Modify `Project_Definition.md`: update official scope from 2017-2025 to 2004-2025 and record revenue exception for 2004.
- Modify `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`: update data scope, default behavior, and success criteria to 2004-2025 with revenue from 2005.
- Modify `AGENTS.md`: keep it short, but update current project state, non-negotiables, data rules, and default year range.
- Create `apps/web/lib/data/coverage.ts`: shared year constants.
- Create `apps/web/tests/data/sourceCoverage.test.ts`: source inventory guard.
- Modify `apps/web/lib/data/realRevenue/extractWorkbooks.ts`: include revenue PDF sources for 2005-2025.
- Modify `apps/web/scripts/generate-real-revenue-facts.ts`: write `2005-2025` artifacts and validate expected years.
- Modify `apps/web/lib/data/realRevenue/validateRealRevenue.ts` and tests: use 2005-2025 report labels and coverage checks.
- Modify `apps/web/scripts/extract-expenditure-pdf-pilot.ts` and `apps/web/scripts/generate-final-2025-expenditure-data.ts`: support 2004-2025 source metadata and the Excel-only workbook folder.
- Modify `apps/web/lib/data/realExpenditurePdf/phase1Pilot.ts`, `publicMapping.ts`, and `final2025Data.ts` only if parser output or naming assumptions block older years.
- Modify `apps/web/lib/data/adminSpending/extractWorkbooks.ts`: read `excel-fact-files-2004-2025`.
- Modify `apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts` and tests: compute ministry/program eligibility over 2004-2025.
- Modify `apps/web/scripts/generate-admin-spending-data.ts`: write `2004-2025` staging/import/report/review artifacts.
- Modify `apps/web/scripts/compose-budget-facts.ts`: compose `expenditure-facts-2004-2025.csv` and `revenue-facts-2005-2025.csv`.
- Modify `apps/web/scripts/validate-data-files.ts`: validate active `2004-2025` and `2005-2025` files.
- Modify `data/sources/source-documents.csv`: register all new source IDs used by generated facts.
- Modify explorer tests and browser tests under `apps/web/tests/explorer/` and `apps/web/tests/browser/`: assert side-specific coverage and grouping behavior.

---

### Task 1: Update Canonical Scope Documents

**Files:**
- Modify: `Project_Definition.md`
- Modify: `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the source-of-truth wording**

Replace current references to annual data `2017-2025` with `2004-2025`, and add this explicit exception wherever revenue coverage is described:

```text
Revenue coverage starts in 2005 because the project does not currently have a reviewed 2004 revenue source. Expenditure coverage starts in 2004.
```

Keep exclusions unchanged: no broad catalog, no admin UI, no public API, no user uploads, no quarterly/monthly data, and no clickable drilldown pages.

- [ ] **Step 2: Update the default UI wording**

In `AGENTS.md`, change:

```text
- 2017-2025.
```

to:

```text
- 2004-2025 for expenditure; 2005-2025 for revenue.
```

In the design spec, update the default first view time range from `2017-2025` to `2004-2025`.

- [ ] **Step 3: Verify the docs no longer contradict the approved scope**

Run:

```powershell
rg -n "2017-2025|2017 through 2025|2017 through 2025|2004-2025|2005-2025" AGENTS.md Project_Definition.md docs\superpowers\specs\2026-05-10-geodata-budget-v1-design.md
```

Expected:

```text
No remaining 2017-2025 wording where it describes current official coverage.
Any remaining 2017 reference is historical context or a changed sentence explaining older previous scope.
2004-2025 and 2005-2025 appear in the updated scope sections.
```

- [ ] **Step 4: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add AGENTS.md Project_Definition.md docs\superpowers\specs\2026-05-10-geodata-budget-v1-design.md
& 'C:\Program Files\Git\cmd\git.exe' commit -m "docs: update budget explorer scope to 2004-2025"
```

Expected: commit succeeds. If unrelated user changes are present in these files, stop and inspect the diff before staging.

---

### Task 2: Add Shared Coverage Constants and Source Inventory Tests

**Files:**
- Create: `apps/web/lib/data/coverage.ts`
- Create: `apps/web/tests/data/sourceCoverage.test.ts`

- [ ] **Step 1: Create coverage constants**

Create `apps/web/lib/data/coverage.ts`:

```ts
export function inclusiveYears(startYear: number, endYear: number): number[] {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
}

export const APP_START_YEAR = 2004;
export const APP_END_YEAR = 2025;
export const REVENUE_START_YEAR = 2005;

export const EXPENDITURE_YEARS = inclusiveYears(APP_START_YEAR, APP_END_YEAR);
export const ADMIN_SPENDING_YEARS = inclusiveYears(APP_START_YEAR, APP_END_YEAR);
export const REVENUE_YEARS = inclusiveYears(REVENUE_START_YEAR, APP_END_YEAR);
```

- [ ] **Step 2: Write source inventory tests**

Create `apps/web/tests/data/sourceCoverage.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_SPENDING_YEARS, EXPENDITURE_YEARS, REVENUE_YEARS } from "../../lib/data/coverage";

const repoRoot = path.resolve(process.cwd(), "../..");

function repoFile(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

describe("2004-2025 source coverage", () => {
  it("has Treasury functional expenditure PDFs for every expenditure year", () => {
    const missing = EXPENDITURE_YEARS.filter(
      (year) =>
        !fs.existsSync(
          repoFile(`docs/Raw Data/Expenditure/treasury.ge/${year}-12-month-state-budget-functional-expenditure.pdf`),
        ),
    );

    expect(missing).toEqual([]);
  });

  it("has Excel ministry/programmatic workbooks for every admin spending year", () => {
    const missing = ADMIN_SPENDING_YEARS.filter(
      (year) => !fs.existsSync(repoFile(`docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/${year}-fact.xlsx`)),
    );

    expect(missing).toEqual([]);
  });

  it("has revenue PDFs for 2005-2025 and intentionally excludes 2004 revenue", () => {
    const missing = REVENUE_YEARS.filter(
      (year) => !fs.existsSync(repoFile(`docs/Raw Data/Revenue/${year}-jan-dec-consolidated-revenue.pdf`)),
    );

    expect(fs.existsSync(repoFile("docs/Raw Data/Revenue/2004-jan-dec-consolidated-revenue.pdf"))).toBe(false);
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the source inventory tests**

Run:

```powershell
cd apps\web
npm.cmd run test -- tests/data/sourceCoverage.test.ts
```

Expected:

```text
3 tests pass.
```

- [ ] **Step 4: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add apps/web/lib/data/coverage.ts apps/web/tests/data/sourceCoverage.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "test: lock budget source coverage"
```

---

### Task 3: Extend Revenue Pipeline to 2005-2025

**Files:**
- Modify: `apps/web/lib/data/realRevenue/extractWorkbooks.ts`
- Modify: `apps/web/lib/data/realRevenue/validateRealRevenue.ts`
- Modify: `apps/web/scripts/generate-real-revenue-facts.ts`
- Modify: `apps/web/tests/data/realRevenue/validateRealRevenue.test.ts`
- Modify: `apps/web/tests/data/realRevenue/generateFacts.test.ts`
- Generated: `data/imports/revenue-facts-2005-2025.csv`
- Generated: `data/reports/real-revenue-2005-2025-report.json`
- Generated: `data/reports/revenue-pdf-vs-workbook-2005-2025-report.json`

- [ ] **Step 1: Write the failing coverage test**

In `apps/web/tests/data/realRevenue/validateRealRevenue.test.ts`, add:

```ts
import { REVENUE_YEARS } from "../../../lib/data/coverage";

it("reports revenue coverage for 2005-2025 without 2004", () => {
  const rows = REVENUE_YEARS.map((year) => ({
    year,
    sourceId: `source.mof_${year}_revenue_form1_pdf`,
    sourceFile: `docs/Raw Data/Revenue/${year}-jan-dec-consolidated-revenue.pdf`,
    code: "1",
    labelKa: "revenue total",
    amountGel: 1_000_000,
  }));

  const facts = REVENUE_YEARS.map((year) => ({
    year,
    side: "revenue" as const,
    item_id: "revenue.other_revenue",
    amount_gel: "1000000",
    basis: "actual" as const,
    source_id: `source.mof_${year}_revenue_form1_pdf`,
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: "test row",
  }));

  const report = validateRealRevenueFacts(rows, facts, REVENUE_YEARS);

  expect(report.importLabel).toBe("real-revenue-2005-2025");
  expect(report.years).toEqual(REVENUE_YEARS);
  expect(report.years).not.toContain(2004);
});
```

Adjust the row object fields to match the current `OfficialRevenueRow` type. Keep the assertions exactly: import label, expected years, and no 2004.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
cd apps\web
npm.cmd run test -- tests/data/realRevenue/validateRealRevenue.test.ts
```

Expected: fails because the report label or hard-coded expected years still reference `2017-2025`.

- [ ] **Step 3: Extend source metadata**

In `apps/web/lib/data/realRevenue/extractWorkbooks.ts`, replace the hard-coded `realRevenuePdfSources` list with a source builder:

```ts
import { REVENUE_YEARS } from "../coverage";

export const realRevenuePdfSources: RealRevenuePdfSource[] = REVENUE_YEARS.map((year) => ({
  year,
  sourceId: `source.mof_${year}_revenue_form1_pdf`,
  pdfPath: `../../docs/Raw Data/Revenue/${year}-jan-dec-consolidated-revenue.pdf`,
}));
```

Keep the existing workbook sources for the diagnostic PDF-vs-workbook comparison. Do not use workbook rows as the public revenue source.

- [ ] **Step 4: Update generation outputs**

In `apps/web/scripts/generate-real-revenue-facts.ts`:

```ts
import { REVENUE_YEARS } from "../lib/data/coverage";
```

Change:

```ts
const report = validateRealRevenueFacts(officialRows, facts, [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
```

to:

```ts
const report = validateRealRevenueFacts(officialRows, facts, REVENUE_YEARS);
```

Change output file names to:

```ts
await writeFile(path.join(importsDir, "revenue-facts-2005-2025.csv"), budgetFactsToCsv(facts), "utf8");
await writeFile(path.join(reportsDir, "real-revenue-2005-2025-report.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(
  path.join(reportsDir, "revenue-pdf-vs-workbook-2005-2025-report.json"),
  JSON.stringify(comparisonReport, null, 2),
  "utf8",
);
```

Change log messages to the same file names.

- [ ] **Step 5: Update report label**

In `apps/web/lib/data/realRevenue/validateRealRevenue.ts`, change:

```ts
importLabel: "real-revenue-2017-2025",
```

to:

```ts
importLabel: "real-revenue-2005-2025",
```

- [ ] **Step 6: Run tests**

Run:

```powershell
cd apps\web
npm.cmd run test -- tests/data/realRevenue
```

Expected: all real revenue tests pass. If old PDFs parse with a different code shape, add the narrowest parser fixture to `parseTreasuryPdfRows.test.ts` before changing parser code.

- [ ] **Step 7: Generate revenue facts**

Run:

```powershell
cd apps\web
npm.cmd run data:generate-revenue-facts
```

Expected:

```text
Generated revenue fact rows: greater than 0
Report written: data/reports/real-revenue-2005-2025-report.json
```

Inspect:

```powershell
Import-Csv ..\..\data\imports\revenue-facts-2005-2025.csv | Group-Object year | Select-Object Name, Count
Get-Content ..\..\data\reports\real-revenue-2005-2025-report.json
```

Expected: years are 2005-2025 only, every year has rows, and no reconciliation status is `failed`.

- [ ] **Step 8: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add apps/web/lib/data/realRevenue apps/web/scripts/generate-real-revenue-facts.ts apps/web/tests/data/realRevenue data/imports/revenue-facts-2005-2025.csv data/reports/real-revenue-2005-2025-report.json data/reports/revenue-pdf-vs-workbook-2005-2025-report.json
& 'C:\Program Files\Git\cmd\git.exe' commit -m "feat: extend revenue facts to 2005-2025"
```

---

### Task 4: Extend Functional/Public Expenditure to 2004-2025

**Files:**
- Modify: `apps/web/scripts/extract-expenditure-pdf-pilot.ts`
- Modify: `apps/web/scripts/generate-final-2025-expenditure-data.ts`
- Modify: `apps/web/lib/data/realExpenditurePdf/phase1Pilot.ts`
- Modify: `apps/web/lib/data/realExpenditurePdf/publicMapping.ts`
- Modify: `apps/web/lib/data/realExpenditurePdf/final2025Data.ts`
- Modify: `apps/web/tests/data/realExpenditurePdf/phase1Pilot.test.ts`
- Modify: `apps/web/tests/data/realExpenditurePdf/final2025Data.test.ts`
- Generated: `data/imports/expenditure-facts-2004-final.csv` through `data/imports/expenditure-facts-2025-final.csv`
- Generated: `data/imports/expenditure-facts-2004-2025.csv`
- Generated: `data/reports/expenditure-final-2004-report.json` through `data/reports/expenditure-final-2025-report.json`

- [ ] **Step 1: Write the failing source-year test**

Add this test to `apps/web/tests/data/realExpenditurePdf/final2025Data.test.ts` or a new focused test file if the existing file is too crowded:

```ts
import { EXPENDITURE_YEARS } from "../../../lib/data/coverage";
import { finalExpenditureOutputFiles } from "../../../lib/data/realExpenditurePdf/final2025Data";

it("names final expenditure outputs for every 2004-2025 year", () => {
  expect(EXPENDITURE_YEARS).toEqual([2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  expect(finalExpenditureOutputFiles(2004).factsCsv).toBe("data/imports/expenditure-facts-2004-final.csv");
  expect(finalExpenditureOutputFiles(2025).factsCsv).toBe("data/imports/expenditure-facts-2025-final.csv");
});
```

- [ ] **Step 2: Run the focused expenditure PDF tests**

Run:

```powershell
cd apps\web
npm.cmd run test -- tests/data/realExpenditurePdf
```

Expected: existing tests may pass, but source support for 2004-2016 is not implemented in scripts yet.

- [ ] **Step 3: Replace old workbook paths with Excel-only paths**

In `apps/web/scripts/generate-final-2025-expenditure-data.ts`, use the Excel-only source path for every year:

```ts
const excelFactWorkbookPath = (year: number) =>
  `docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/${year}-fact.xlsx`;
```

For each `sourcesByYear` entry, set:

```ts
workbookPath: excelFactWorkbookPath(year),
workbookSourceId: `source.mof_${year}_programmatic_fact_actual`,
finalSourceId: `source.mof_${year}_expenditure_functional_plus_programmatic_supplement_actual`,
```

For 2005, preserve provenance in source docs by registering:

```text
source.mof_2005_programmatic_fact_actual
```

with source file:

```text
docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2005-fact.xlsx
```

and notes that the verified 2005 fact came from the 2006 December package.

- [ ] **Step 4: Add source entries for 2004-2016**

Extend `sourcesByYear` in both `extract-expenditure-pdf-pilot.ts` and `generate-final-2025-expenditure-data.ts` for 2004-2016. Use this pattern:

```ts
2004: {
  year: 2004,
  sourceId: "source.mof_2004_expenditure_pdf_form_e11_actual",
  sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2004-12-month-state-budget-functional-expenditure.pdf",
  sourceSha256: "the 64-character uppercase SHA256 returned by Get-FileHash for the 2004 PDF",
  formId: "E11",
  tableTitle: "2004 state budget expenditure execution by functional classification",
  actualAmountIndex: 1,
  workbookPath: excelFactWorkbookPath(2004),
  workbookSourceId: "source.mof_2004_programmatic_fact_actual",
  finalSourceId: "source.mof_2004_expenditure_functional_plus_programmatic_supplement_actual",
},
```

Compute each `sourceSha256` with:

```powershell
Get-FileHash "docs\Raw Data\Expenditure\treasury.ge\YYYY-12-month-state-budget-functional-expenditure.pdf" -Algorithm SHA256
```

Expected: the hash in the script matches the local file. Do not bypass hash checks.

- [ ] **Step 5: Handle older PDF parser differences with tests first**

For the first older year that fails, capture the parser failure in `apps/web/tests/data/realExpenditurePdf/phase1Pilot.test.ts` using a minimal text fixture copied from that PDF page. The test should assert:

```ts
expect(report.validation.status).toBe("passed");
expect(report.rowCounts.grandTotalRows).toBe(1);
expect(report.rowCounts.includeInPublicMappingRows).toBeGreaterThan(0);
```

Then change `phase1Pilot.ts` only enough to pass that fixture. Repeat for each distinct older-source format, not for every year.

- [ ] **Step 6: Generate final expenditure facts year by year**

Run each year separately so failures are attributable:

```powershell
cd apps\web
npm.cmd run data:generate-final-2017-expenditure
npm.cmd run data:generate-final-2018-expenditure
npm.cmd run data:generate-final-2019-expenditure
npm.cmd run data:generate-final-2020-expenditure
npm.cmd run data:generate-final-2021-expenditure
npm.cmd run data:generate-final-2022-expenditure
npm.cmd run data:generate-final-2023-expenditure
npm.cmd run data:generate-final-2024-expenditure
npm.cmd run data:generate-final-2025-expenditure
```

Add package scripts for 2004-2016, then run:

```powershell
npm.cmd run data:generate-final-2004-expenditure
npm.cmd run data:generate-final-2005-expenditure
npm.cmd run data:generate-final-2006-expenditure
npm.cmd run data:generate-final-2007-expenditure
npm.cmd run data:generate-final-2008-expenditure
npm.cmd run data:generate-final-2009-expenditure
npm.cmd run data:generate-final-2010-expenditure
npm.cmd run data:generate-final-2011-expenditure
npm.cmd run data:generate-final-2012-expenditure
npm.cmd run data:generate-final-2013-expenditure
npm.cmd run data:generate-final-2014-expenditure
npm.cmd run data:generate-final-2015-expenditure
npm.cmd run data:generate-final-2016-expenditure
```

Expected for each year:

```text
Final YYYY expenditure rows: greater than 0
Final total GEL and workbook total GEL differ by no more than 1000 GEL.
```

If a year fails reconciliation or mapping is questionable, stop and report the exact year, source file, difference, and suspect labels to the user.

- [ ] **Step 7: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add apps/web/scripts/extract-expenditure-pdf-pilot.ts apps/web/scripts/generate-final-2025-expenditure-data.ts apps/web/lib/data/realExpenditurePdf apps/web/tests/data/realExpenditurePdf apps/web/package.json data/imports/expenditure-facts-*-final.csv data/staging/expenditure-*-financial-assets-liabilities-supplement.csv data/reports/expenditure-final-*-report.json
& 'C:\Program Files\Git\cmd\git.exe' commit -m "feat: extend functional expenditure facts to 2004-2025"
```

---

### Task 5: Extend Ministry/Admin Spending to 2004-2025

**Files:**
- Modify: `apps/web/lib/data/adminSpending/extractWorkbooks.ts`
- Modify: `apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts`
- Modify: `apps/web/scripts/generate-admin-spending-data.ts`
- Modify: `apps/web/tests/data/adminSpending.test.ts`
- Generated: `data/staging/admin-spending-official-rows-2004-2025.csv`
- Generated: `data/imports/admin-spending-facts-2004-2025.csv`
- Generated: `data/reports/admin-spending-2004-2025-report.json`
- Generated: `data/mappings/review/admin-spending-major-program-review-2004-2025.csv`

- [ ] **Step 1: Update tests for 2004-2025 source years**

In `apps/web/tests/data/adminSpending.test.ts`, add:

```ts
import { ADMIN_SPENDING_YEARS } from "../../lib/data/coverage";

it("extracts admin spending rows from the 2004-2025 Excel fact folder", () => {
  const rows = extractAdminSpendingOfficialRows();
  const years = Array.from(new Set(rows.map((row) => row.year))).sort((a, b) => a - b);

  expect(years).toEqual(ADMIN_SPENDING_YEARS);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
cd apps\web
npm.cmd run test -- tests/data/adminSpending.test.ts
```

Expected: fails because extractor still reads `docs/Raw Data/Expenditure/mof.ge` and filters 2017-2025.

- [ ] **Step 3: Change admin workbook directory**

In `apps/web/lib/data/adminSpending/extractWorkbooks.ts`, change:

```ts
const WORKBOOK_DIR = "../../docs/Raw Data/Expenditure/mof.ge";
```

to:

```ts
const WORKBOOK_DIR = "../../docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025";
```

Use `ADMIN_SPENDING_YEARS` to filter:

```ts
const adminYears = new Set(ADMIN_SPENDING_YEARS);
```

and:

```ts
return Boolean(source.year && adminYears.has(source.year) && /\.xlsx$/i.test(source.fileName));
```

- [ ] **Step 4: Replace source ID mapping**

In `extractWorkbooks.ts`, replace the fixed `SOURCE_ID_BY_YEAR` record with:

```ts
const SOURCE_ID_BY_YEAR: Record<number, string> = Object.fromEntries(
  ADMIN_SPENDING_YEARS.map((year) => [year, `source.mof_${year}_programmatic_fact_actual`]),
) as Record<number, string>;
```

- [ ] **Step 5: Preserve semantic-era review**

In `apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts`, keep the existing `PROGRAM_SEMANTIC_ERAS` behavior. Extend or add tests only when actual older-year data proves a code has changed meaning.

Add a failing test for each reused code discovered during generation. The test must use the actual official code and labels from the generated staging rows. The assertion shape is:

```ts
it("does not merge a reused official program code across different semantic eras", () => {
  const facts = generateAdminSpendingFacts(reusedOfficialCodeFixtureRows);
  const matchingItems = Array.from(new Set(facts.filter((fact) => fact.officialCode === reusedOfficialCode).map((fact) => fact.itemId)));

  expect(matchingItems.length).toBe(2);
});
```

The fixture must be defined in the same test file with rows copied from the actual staging output. Do not add speculative eras.

- [ ] **Step 6: Update generated artifact names**

In `apps/web/scripts/generate-admin-spending-data.ts`, change output files to:

```ts
admin-spending-official-rows-2004-2025.csv
admin-spending-facts-2004-2025.csv
admin-spending-major-program-review-2004-2025.csv
admin-spending-2004-2025-report.json
```

- [ ] **Step 7: Generate ministry/admin facts**

Run:

```powershell
cd apps\web
npm.cmd run data:generate-admin-spending
```

Expected:

```text
Official rows: greater than 0
Fact rows: greater than 0
Report written: data/reports/admin-spending-2004-2025-report.json
```

Inspect:

```powershell
Import-Csv ..\..\data\imports\admin-spending-facts-2004-2025.csv | Group-Object year | Select-Object Name, Count
Get-Content ..\..\data\reports\admin-spending-2004-2025-report.json
```

Expected: years are 2004-2025 and no reconciliation status is `failed`.

- [ ] **Step 8: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add apps/web/lib/data/adminSpending apps/web/scripts/generate-admin-spending-data.ts apps/web/tests/data/adminSpending.test.ts data/staging/admin-spending-official-rows-2004-2025.csv data/imports/admin-spending-facts-2004-2025.csv data/reports/admin-spending-2004-2025-report.json data/mappings/review/admin-spending-major-program-review-2004-2025.csv
& 'C:\Program Files\Git\cmd\git.exe' commit -m "feat: extend ministry spending facts to 2004-2025"
```

---

### Task 6: Compose and Validate Active App Data

**Files:**
- Modify: `apps/web/scripts/compose-budget-facts.ts`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/tests/explorer/integration.test.ts`
- Generated: `data/imports/expenditure-facts-2004-2025.csv`
- Generated: `data/imports/budget-facts-2004-2025.csv`
- Generated: `data/reports/budget-facts-2004-2025-compose-report.json`
- Generated: `data/reports/real-budget-2004-2025-import-report.json`

- [ ] **Step 1: Write a compose test for mixed side coverage**

In `apps/web/tests/explorer/integration.test.ts`, add a focused assertion around the active import file name or loader behavior:

```ts
it("composes expenditure from 2004 and revenue from 2005 without requiring 2004 revenue", async () => {
  const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2004-2025.csv");
  const expenditureYears = Array.from(new Set(facts.filter((fact) => fact.side === "expenditure").map((fact) => fact.year))).sort((a, b) => a - b);
  const revenueYears = Array.from(new Set(facts.filter((fact) => fact.side === "revenue").map((fact) => fact.year))).sort((a, b) => a - b);

  expect(expenditureYears[0]).toBe(2004);
  expect(expenditureYears.at(-1)).toBe(2025);
  expect(revenueYears[0]).toBe(2005);
  expect(revenueYears.at(-1)).toBe(2025);
  expect(revenueYears).not.toContain(2004);
});
```

- [ ] **Step 2: Update compose script**

In `apps/web/scripts/compose-budget-facts.ts`:

```ts
import { EXPENDITURE_YEARS } from "../lib/data/coverage";
```

Change the year arrays:

```ts
const expenditureYears = EXPENDITURE_YEARS;
const revenueFactsPath = "../../data/imports/revenue-facts-2005-2025.csv";
```

Load final expenditure rows with:

```ts
Promise.all(
  expenditureYears.map((year) =>
    loadBudgetFactRows(`../../data/imports/expenditure-facts-${year}-final.csv`),
  ),
)
```

Write:

```ts
expenditure-facts-2004-2025.csv
budget-facts-2004-2025.csv
budget-facts-2004-2025-compose-report.json
```

Set report labels:

```ts
importLabel: "budget-facts-2004-2025",
revenueYears: REVENUE_YEARS,
```

- [ ] **Step 3: Update validation script**

In `apps/web/scripts/validate-data-files.ts`, load:

```ts
const expenditureRows = await loadBudgetFactRows("../../data/imports/expenditure-facts-2004-2025.csv");
const revenueRows = await loadBudgetFactRows("../../data/imports/revenue-facts-2005-2025.csv");
const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2004-2025.csv");
const adminSpendingFacts = await loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2004-2025.csv");
const report = buildImportReport("real-budget-2004-2025", facts);
```

Write:

```ts
../../data/reports/real-budget-2004-2025-import-report.json
```

Add explicit year assertions before writing the report:

```ts
function assertYears(label: string, actual: number[], expected: number[]) {
  const actualText = actual.join(",");
  const expectedText = expected.join(",");
  if (actualText !== expectedText) {
    throw new Error(`${label} years mismatch. Expected ${expectedText}, got ${actualText}`);
  }
}
```

Use it for expenditure, revenue, and admin facts.

- [ ] **Step 4: Compose and validate**

Run:

```powershell
cd apps\web
npm.cmd run data:compose-budget-facts
npm.cmd run data:validate
```

Expected:

```text
Composed budget fact rows: greater than 0
Validated fact rows: greater than 0
Validated admin spending fact rows: greater than 0
Report written: ...real-budget-2004-2025-import-report.json
```

- [ ] **Step 5: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add apps/web/scripts/compose-budget-facts.ts apps/web/scripts/validate-data-files.ts apps/web/tests/explorer/integration.test.ts data/imports/expenditure-facts-2004-2025.csv data/imports/budget-facts-2004-2025.csv data/reports/budget-facts-2004-2025-compose-report.json data/reports/real-budget-2004-2025-import-report.json
& 'C:\Program Files\Git\cmd\git.exe' commit -m "feat: compose active 2004-2025 budget facts"
```

---

### Task 7: Update App Loaders and UI Year Behavior

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/lib/explorer/explorerData.ts`
- Modify: `apps/web/tests/explorer/explorerData.test.ts`
- Modify: `apps/web/tests/explorer/singleYear.test.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Update data file paths**

In `apps/web/app/page.tsx`, change active imports to:

```ts
const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2004-2025.csv");
const adminFacts = await loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2004-2025.csv");
```

- [ ] **Step 2: Keep side-specific year coverage**

In `apps/web/components/main-explorer/main-explorer.tsx`, keep the existing `yearsBySide` approach. Confirm it derives years from facts for the active side:

```ts
const yearsBySide = useMemo(
  () => ({
    expenditure: yearsForSide(facts, "expenditure"),
    revenue: yearsForSide(facts, "revenue"),
  }),
  [facts],
);
```

The expected behavior is:

```text
yearsBySide.expenditure starts at 2004.
yearsBySide.revenue starts at 2005.
Switching side clamps selected start/end/single year into the target side coverage.
```

- [ ] **Step 3: Add explorer model tests**

In `apps/web/tests/explorer/explorerData.test.ts`, add:

```ts
it("supports 2004 expenditure without requiring 2004 revenue", () => {
  const expenditureModel = buildExplorerModel({
    facts: [
      expenditureFact(2004, "spending.health", 100),
      expenditureFact(2025, "spending.health", 200),
      revenueFact(2005, "revenue.vat", 50),
      revenueFact(2025, "revenue.vat", 90),
    ],
    glossary,
    sourceDocuments,
    side: "expenditure",
    selectedItemIds: ["expenditure.total"],
    startYear: 2004,
    endYear: 2025,
    measure: "nominal",
  });

  const revenueModel = buildExplorerModel({
    facts: [
      expenditureFact(2004, "spending.health", 100),
      expenditureFact(2025, "spending.health", 200),
      revenueFact(2005, "revenue.vat", 50),
      revenueFact(2025, "revenue.vat", 90),
    ],
    glossary,
    sourceDocuments,
    side: "revenue",
    selectedItemIds: ["revenue.total"],
    startYear: 2004,
    endYear: 2025,
    measure: "nominal",
  });

  expect(expenditureModel.years[0]).toBe(2004);
  expect(revenueModel.years[0]).toBe(2005);
});
```

Use the existing local fixture helpers in the file if they already exist; otherwise add tiny `expenditureFact` and `revenueFact` helpers beside the other fixtures.

- [ ] **Step 4: Update browser smoke test**

In `apps/web/tests/browser/main-explorer.spec.ts`, assert:

```ts
await expect(page.getByText("2004")).toBeVisible();
await page.getByRole("button", { name: /Revenue|შემოსავლები/ }).click();
await expect(page.getByText("2005")).toBeVisible();
await expect(page.getByText("2004")).not.toBeVisible();
await page.getByRole("button", { name: /Expenditure|ხარჯები/ }).click();
await page.getByRole("button", { name: /Ministries|სამინისტროები/ }).click();
await expect(page.getByText("2004")).toBeVisible();
```

Use the exact Georgian labels present in the current component if English labels are not visible.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
cd apps\web
npm.cmd run test -- tests/explorer/explorerData.test.ts tests/explorer/singleYear.test.ts
```

Expected: tests pass.

- [ ] **Step 6: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add apps/web/app/page.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/lib/explorer/explorerData.ts apps/web/tests/explorer/explorerData.test.ts apps/web/tests/explorer/singleYear.test.ts apps/web/tests/browser/main-explorer.spec.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "feat: support 2004-2025 explorer coverage"
```

---

### Task 8: Register Source Documents

**Files:**
- Modify: `data/sources/source-documents.csv`
- Modify: `apps/web/tests/data/sourceCoverage.test.ts`

- [ ] **Step 1: Add source registration assertions**

Extend `sourceCoverage.test.ts`:

```ts
import { loadSourceDocuments } from "../../lib/data/sources";

it("registers source documents for every generated source id", async () => {
  const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
  const ids = new Set(sources.map((source) => source.sourceId));

  for (const year of EXPENDITURE_YEARS) {
    expect(ids.has(`source.mof_${year}_expenditure_functional_plus_programmatic_supplement_actual`)).toBe(true);
    expect(ids.has(`source.mof_${year}_programmatic_fact_actual`)).toBe(true);
  }

  for (const year of REVENUE_YEARS) {
    expect(ids.has(`source.mof_${year}_revenue_form1_pdf`)).toBe(true);
  }
});
```

- [ ] **Step 2: Run the failing source registration test**

Run:

```powershell
cd apps\web
npm.cmd run test -- tests/data/sourceCoverage.test.ts
```

Expected: fails until `source-documents.csv` has all source IDs.

- [ ] **Step 3: Register source documents**

Add rows to `data/sources/source-documents.csv` using this exact shape:

```csv
source_id,source_name,source_url_or_file,last_reviewed_at
source.mof_2004_expenditure_functional_plus_programmatic_supplement_actual,Reviewed official 2004 state budget execution functional PDF plus programmatic workbook supplement,docs/Raw Data/Expenditure/treasury.ge/2004-12-month-state-budget-functional-expenditure.pdf; docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2004-fact.xlsx,2026-06-27
source.mof_2004_programmatic_fact_actual,Reviewed official 2004 state budget programmatic execution workbook,docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2004-fact.xlsx,2026-06-27
source.mof_2005_revenue_form1_pdf,Reviewed official 2005 consolidated revenue PDF,docs/Raw Data/Revenue/2005-jan-dec-consolidated-revenue.pdf,2026-06-27
```

Repeat the same pattern for:

```text
Expenditure final sources: 2004-2025
Programmatic workbook sources: 2004-2025
Revenue PDF sources: 2005-2025
```

For `source.mof_2005_programmatic_fact_actual`, set the source name to:

```text
Reviewed official 2005 factual programmatic execution workbook extracted from the 2006 December package
```

- [ ] **Step 4: Run validation**

Run:

```powershell
cd apps\web
npm.cmd run test -- tests/data/sourceCoverage.test.ts
npm.cmd run data:validate
```

Expected: source tests and data validation pass with no unknown source IDs.

- [ ] **Step 5: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add data/sources/source-documents.csv apps/web/tests/data/sourceCoverage.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m "data: register 2004-2025 source documents"
```

---

### Task 9: Full Verification and Browser Proof

**Files:**
- No planned source edits unless a verification failure exposes a bug.

- [ ] **Step 1: Run data generation in canonical order**

Run:

```powershell
cd apps\web
npm.cmd run data:generate-revenue-facts
npm.cmd run data:generate-admin-spending
npm.cmd run data:compose-budget-facts
npm.cmd run data:validate
```

Run all final expenditure year scripts if any final CSV is stale.

Expected:

```text
Revenue report covers 2005-2025.
Admin report covers 2004-2025.
Budget report covers expenditure 2004-2025 and revenue 2005-2025.
Validation writes real-budget-2004-2025-import-report.json.
```

- [ ] **Step 2: Run focused and full tests**

Run:

```powershell
cd apps\web
npm.cmd run test
```

Expected: all Vitest tests pass. If `spawn EPERM` occurs, rerun outside the sandbox before treating it as a product bug.

- [ ] **Step 3: Run build**

Run:

```powershell
cd apps\web
npm.cmd run build
```

Expected: Next.js build succeeds.

- [ ] **Step 4: Start local app**

Run:

```powershell
cd apps\web
npm.cmd run dev
```

Expected:

```text
Local app available at http://localhost:3000/
```

- [ ] **Step 5: Run browser verification**

Run:

```powershell
cd apps\web
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts
```

Expected:

```text
Browser test passes.
```

Manual browser checks:

```text
1. Expenditure -> Fields: 2004 and 2025 are available.
2. Expenditure -> Ministries: 2004 and 2025 are available.
3. Revenue: 2005 and 2025 are available; 2004 is not offered.
4. CSV export works for Fields, Ministries, and Revenue.
```

- [ ] **Step 6: Final data audit**

Run:

```powershell
Import-Csv ..\..\data\imports\expenditure-facts-2004-2025.csv | Group-Object year | Select-Object Name, Count
Import-Csv ..\..\data\imports\admin-spending-facts-2004-2025.csv | Group-Object year | Select-Object Name, Count
Import-Csv ..\..\data\imports\revenue-facts-2005-2025.csv | Group-Object year | Select-Object Name, Count
```

Expected:

```text
Expenditure years: 2004-2025.
Admin spending years: 2004-2025.
Revenue years: 2005-2025.
No 2004 revenue row.
```

- [ ] **Step 7: Commit verification-only fixes if needed**

If verification required code fixes:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' status --short
& 'C:\Program Files\Git\cmd\git.exe' add apps/web data Project_Definition.md AGENTS.md docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md
& 'C:\Program Files\Git\cmd\git.exe' commit -m "fix: verify 2004-2025 budget rollout"
```

If no fixes were needed, do not make an empty commit.

---

## Stop-and-Report Conditions

Stop implementation and report to the user before continuing if any of these occurs:

- A required 2004-2025 expenditure source is missing.
- A required 2005-2025 revenue source is missing.
- A source hash differs from the current local file.
- A year fails reconciliation by more than 1000 GEL after parser fixes.
- Older ministry/program codes merge unrelated histories and the correct semantic era is not obvious from source labels.
- Public taxonomy mapping would assign a large amount to `spending.other_unclassified` without a clear review note.
- The app can only support 2004-2025 by mixing public fields and ministry rows in one selector.

## Self-Review

- Spec coverage: the plan covers official scope docs, source inventory, revenue, functional expenditure, ministry expenditure, composed app data, validation, UI behavior, source registration, and browser verification.
- Placeholder scan: no implementation step depends on a later undefined task. The only repeated pattern is explicit and bounded by year ranges.
- Type consistency: the plan uses one coverage module for `EXPENDITURE_YEARS`, `ADMIN_SPENDING_YEARS`, and `REVENUE_YEARS`; generated file names consistently use `2004-2025` for expenditure/admin/budget and `2005-2025` for revenue.
