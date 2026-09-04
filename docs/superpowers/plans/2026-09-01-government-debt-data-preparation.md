# Government Debt Data Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully source-backed, deterministic research package for annual Government Debt stock, actual service, weighted-average interest rates, and the 2026-2030 existing-portfolio payment schedule without changing Fiscal.ge application behavior.

**Architecture:** Preserve ten immutable Ministry of Finance source files, extract only approved tables from exact PDF pages/XLSX cells, and normalize them through a focused TypeScript data-preparation module. The module generates four UTF-8-BOM CSVs plus a validation JSON in `--write` mode and proves byte-for-byte freshness in `--check` mode; an artifact-tool support builder separately creates the review XLSX, which integration tests compare semantically with the CSVs.

**Tech Stack:** Node.js/TypeScript, `pdf-parse` 2.4.x, SheetJS `xlsx` 0.20.3, `csv-parse`, Vitest, `@oai/artifact-tool` for workbook authoring, existing Fiscal.ge data utilities.

**Spec:** `docs/superpowers/specs/2026-09-01-government-debt-data-preparation-design.md`

## Global Constraints

- This is a research/data-package task only. Do not change routes, UI, navigation, charts, public downloads, Prisma, Supabase, or database contents.
- Do not add files under `data/imports`; read `data/imports/national-gdp-annual-1996-2025.csv` only for GDP-share validation.
- Do not modify the existing `spending.debt_service` data or add deficit functionality.
- Government Debt means `total = domestic + external`; do not substitute Public/State Debt, NBG debt, on-lending service, PPP liabilities, or GFSM central-government-liabilities totals.
- Stock coverage is 2013-2025 and actual service coverage is 2013-2025, each with total/domestic/external rows.
- The 33-row interest-rate grid contains total values for 2015-2025, domestic values for 2018-2024, external values for 2021-2024, and exactly 11 documented blanks elsewhere.
- The forecast is the 2026-2030 schedule for the portfolio outstanding on 2025-12-31; the domestic component covers Treasury securities and the external component covers External Government Debt.
- Never estimate, interpolate, digitize chart positions, or replace a missing value with zero.
- Human-facing CSVs must use UTF-8 with BOM. Generated CSV/JSON artifacts must be deterministic.
- Add no package dependency. Reuse the locked repository dependencies.
- Keep the two methodology notes concise: the 2019 budgetary-organization addition and the December 2022 general-government-SOE addition.

## File Responsibility Map

Create:

- `apps/web/lib/data/governmentDebt/types.ts` - approved row types, source IDs, scope/status unions, and validation-report types.
- `apps/web/lib/data/governmentDebt/sourceManifest.ts` - exact manifest-schema, approved-role, URL/date, hash, byte-size, and immutable-source validation.
- `apps/web/lib/data/governmentDebt/pdfText.ts` - read exact preserved PDF pages with `PDFParse`, verify page markers, and destroy parser resources.
- `apps/web/lib/data/governmentDebt/parseDebtSources.ts` - pure, source-specific parsing and derivation for stock, service, rates, forecast, and control cells.
- `apps/web/lib/data/governmentDebt/prepareGovernmentDebtPackage.ts` - manifest/hash validation, GDP checks, row validation, serialization, `--write/--check`, and validation-report construction.
- `apps/web/scripts/prepare-government-debt.ts` - small CLI wrapper.
- `apps/web/tests/data/governmentDebt/parseDebtSources.test.ts` - focused parser and derivation tests.
- `apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts` - heavy end-to-end package, encoding, workbook-parity, and stale-artifact tests.
- `docs/Raw Data/Debt/government-debt-annual/README.md` - concise human handoff.
- `docs/Raw Data/Debt/government-debt-annual/source-manifest.csv` - pinned source inventory.
- `docs/Raw Data/Debt/government-debt-annual/methodology-notes.csv` - two approved methodology notes.
- `docs/Raw Data/Debt/government-debt-annual/official/*` - ten immutable source captures.
- `docs/Raw Data/Debt/government-debt-annual/government-debt-stock-annual-2013-2025.csv` - generated stock output.
- `docs/Raw Data/Debt/government-debt-annual/government-debt-interest-rates-annual-2015-2025.csv` - generated rate grid.
- `docs/Raw Data/Debt/government-debt-annual/government-debt-service-actual-annual-2013-2025.csv` - generated actual service output.
- `docs/Raw Data/Debt/government-debt-annual/government-debt-service-forecast-2026-2030.csv` - generated forecast output.
- `docs/Raw Data/Debt/government-debt-annual/validation-report.json` - generated machine validation.
- `docs/Raw Data/Debt/government-debt-annual/government-debt-review.xlsx` - artifact-tool-authored review workbook.
- `docs/data-methodology/government-debt-annual.md` - durable methodology and rerun instructions.

Modify:

- `apps/web/package.json` - add prepare/check commands and wire the check into `data:validate`.
- `apps/web/vitest.config.ts` - serialize the multi-PDF integration suite with the existing heavy-test group.
- `docs/superpowers/specs/2026-09-01-government-debt-data-preparation-design.md` - retain the evidence-backed rate coverage and domestic-service source correction made during plan preparation.

Temporary and untracked:

- `tmp/spreadsheets/government-debt-package/build-review-workbook.mjs` - one artifact-tool builder.
- `tmp/spreadsheets/government-debt-package/node_modules` - junction to the loader-provided runtime.
- `tmp/spreadsheets/government-debt-package/rendered/*.png` - workbook visual-QA images.

---

### Task 1: Preserve and pin official source captures

**Files:**

- Create: `docs/Raw Data/Debt/government-debt-annual/source-manifest.csv`
- Create: `docs/Raw Data/Debt/government-debt-annual/methodology-notes.csv`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/public-debt-bulletin-n7.pdf`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/public-debt-bulletin-n13.pdf`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/public-debt-bulletin-n19.pdf`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/public-debt-bulletin-n25.pdf`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/monthly-debt-report-2026-07.pdf`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/debt-management-strategy-2019-2021.pdf`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/debt-management-strategy-2022-2025.pdf`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/debt-management-strategy-2023-2026.pdf`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/debt-management-strategy-2025-2029.pdf`
- Create: `docs/Raw Data/Debt/government-debt-annual/official/central-government-debt-liabilities-control.xlsx`
- Create: `apps/web/lib/data/governmentDebt/types.ts`
- Create: `apps/web/lib/data/governmentDebt/sourceManifest.ts`
- Test: `apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts`

**Interfaces:**

- Consumes: approved source boundaries and schemas from the spec.
- Produces: `GOVERNMENT_DEBT_SOURCE_IDS`, `DebtScope`, `SourceManifestRow`, `MethodologyNoteRow`, `validateGovernmentDebtSourceManifest()`, and ten immutable source files for every later task.

- [ ] **Step 1: Write the failing source-contract test**

Create the integration test with the exact source ID set and immutable-file expectations:

```ts
const expectedSourceIds = new Set([
  "mof_public_debt_bulletin_n7",
  "mof_public_debt_bulletin_n13",
  "mof_public_debt_bulletin_n19",
  "mof_public_debt_bulletin_n25",
  "mof_monthly_debt_report_2026_07",
  "mof_debt_strategy_2019_2021",
  "mof_debt_strategy_2022_2025",
  "mof_debt_strategy_2023_2026",
  "mof_debt_strategy_2025_2029",
  "mof_central_government_liabilities_control",
]);

it("pins every approved official source with matching hash and size", async () => {
  const { validateGovernmentDebtSourceManifest } = await import(
    "../../../lib/data/governmentDebt/sourceManifest"
  );
  const rows = readPackageCsvRows("source-manifest.csv");
  expect(new Set(rows.map((row) => row.source_id))).toEqual(expectedSourceIds);
  await expect(validateGovernmentDebtSourceManifest(rows)).resolves.toBe(true);
});
```

- [ ] **Step 2: Run the test and verify the missing module/package failure**

Run: `npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts`

Expected: FAIL because the package and `prepareGovernmentDebtPackage` module do not exist.

- [ ] **Step 3: Preserve the four bulletins, monthly report, and control workbook**

Copy the already verified local captures into `official/`, then retrieve the same official URLs to a temporary comparison location and require matching SHA-256 before accepting them:

```text
N7  https://mof.ge/files/download/PublicSectorDebtN7ENGMay2017.pdf/d8812ef3-d563-4447-b35e-8a0a0b812056
N13 https://mof.ge/files/download/N13ENG.pdf/78e85ff9-d592-4359-936a-b4874d3ebd1a
N19 https://mof.ge/files/download/N19ENG.pdf/87b685f6-5e38-41ec-b777-b9e499ab6eca
N25 https://mof.ge/files/download/N25ENGUpdate.pdf/a8e288fa-cb9e-4028-9ae1-32f2dde1ace2
July 2026 monthly report https://mof.ge/files/download/Monthly%20Debt%20Report%20%20July.pdf/91fdb650-1e68-46a5-899f-a752f9811742
Control Excel https://www.mof.ge/files/download/centraluri%20xelisuflebis%20valebi%20da%20valdebulebebi.xls%20%20eng%20IIQ.xlsx/dc8cf5f0-82df-4b13-812e-25b53821df8b
```

Do not overwrite a preserved file unless the downloaded bytes have the same hash.

- [ ] **Step 4: Download the four exact rate-table strategy sources**

Use these official Ministry URLs:

```text
2019-2021 https://mof.ge/files/download/DMSENG19213May2019Web.pdf/924681c3-c2cd-4455-8043-531d6ded8b5e
2022-2025 https://mof.ge/files/download/General%20Government%20Debt%20Management%20Strategy%20for%2020222025.pdf/7ebce43c-ea3f-42d8-bd79-4538e5290afe
2023-2026 https://mof.ge/files/download/Government%20Debt%20Management%20Strategy%2020232026.pdf/b27d2e53-de14-417e-aa90-6c99794ad573
2025-2029 https://mof.ge/files/download/DMS%2020252029%20ENG.pdf/43e57bc8-01e2-4b71-bf3f-57f3516115f1
```

Record the final redirected URL, 2026-09-01 retrieval date, byte length, and uppercase SHA-256 for each file.

- [ ] **Step 5: Create the exact manifest and methodology-note inputs**

Write `source-manifest.csv` with the spec's 16 headers and pipe-separated roles. Write exactly two `methodology-notes.csv` rows:

```csv
methodology_note_id,effective_date,affected_dataset,affected_scope,note_ka,note_en,source_id
government-domestic-2019-budget-organizations,2019-01-01,stock|actual_service,domestic,"2019 წლიდან მთავრობის საშინაო ვალი დამატებით მოიცავს საბიუჯეტო ორგანიზაციების სესხის სახით არსებულ ვალს.","From 2019, domestic Government Debt additionally includes loan debt owed by budgetary organizations.",mof_public_debt_bulletin_n25
government-domestic-2022-general-government-soes,2022-12-31,stock|actual_service,domestic,"2022 წლის დეკემბრიდან გათვალისწინებულია სამთავრობო სექტორის სახელმწიფო საწარმოების სესხის სახით არსებული ვალიც.","From December 2022, domestic Government Debt also includes loan debt of state-owned enterprises classified in general government.",mof_public_debt_bulletin_n25
```

- [ ] **Step 6: Add the minimal shared types and manifest validator**

Define exact unions and source fields:

```ts
export type DebtScope = "total" | "domestic" | "external";
export type AvailabilityStatus =
  | "available"
  | "not_published_in_reviewed_source"
  | "not_found_in_reviewed_sources";

export type SourceManifestRow = {
  source_id: string;
  dataset_title: string;
  publisher: "Ministry of Finance of Georgia";
  roles: string;
  document_date: string;
  source_page_url: string;
  retrieved_file_url: string;
  retrieved_at: string;
  local_file: string;
  sha256: string;
  bytes: string;
  source_period_min: string;
  source_period_max: string;
  used_period_min: string;
  used_period_max: string;
  notes: string;
};
```

Implement this validator in `sourceManifest.ts`. Validate exact headers, ID set, publisher, approved roles, ISO dates, HTTPS URLs, local paths under `official/`, hashes, sizes, and period bounds. Reject duplicates and unexpected sources.

- [ ] **Step 7: Run the source-contract test**

Run: `npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts`

Expected: PASS for source identity/hash tests; later package tests may still fail because generated artifacts do not exist.

- [ ] **Step 8: Commit source captures and contracts**

```powershell
git add -- "docs/Raw Data/Debt/government-debt-annual" "apps/web/lib/data/governmentDebt/types.ts" "apps/web/lib/data/governmentDebt/sourceManifest.ts" "apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts"
git commit -m "data: preserve government debt source archive"
```

---

### Task 2: Implement exact PDF/XLSX source parsers

**Files:**

- Create: `apps/web/lib/data/governmentDebt/pdfText.ts`
- Create: `apps/web/lib/data/governmentDebt/parseDebtSources.ts`
- Create: `apps/web/tests/data/governmentDebt/parseDebtSources.test.ts`
- Modify: `apps/web/lib/data/governmentDebt/types.ts`

**Interfaces:**

- Consumes: immutable source paths and `DebtScope` from Task 1.
- Produces: `readPdfPages()`, `parseGovernmentDebtStock()`, `parseActualDebtService()`, `parseInterestRateGrid()`, `parseDebtServiceForecast()`, and `readControlWorkbookValues()`.

Use these signatures consistently:

```ts
readPdfPages(filePath: string, pageNumbers: number[]): Promise<Map<number, string>>;
parseGovernmentDebtStock(sources: StockSourcePages): GovernmentDebtStockRow[];
parseActualDebtService(sources: ActualServiceSourcePages): GovernmentDebtActualServiceRow[];
parseInterestRateGrid(sources: InterestRateSourcePages): GovernmentDebtInterestRateRow[];
parseDebtServiceForecast(sources: ForecastSourcePages): GovernmentDebtForecastRow[];
readControlWorkbookValues(filePath: string): ControlYearComparison[];
```

- [ ] **Step 1: Write failing tests for page extraction and number normalization**

Test page markers and both number styles:

```ts
it("reads only approved pages and rejects a wrong page marker", async () => {
  const pages = await readPdfPages(n25Path, [7, 17, 20, 22, 24, 26, 27]);
  expect(pages.get(26)).toContain("17. Public Debt Stock");
  expect(pages.get(27)).toContain("Net Flows & Net Transfers on Public Debt");
  expect(() => requirePageMarker(pages, 26, "wrong marker")).toThrow();
});

it("parses Ministry thousands and decimals without changing precision", () => {
  expect(parseEnglishAmount("24,231.3")).toBe(24231.3);
  expect(parseLegacyAmount("7 095,2")).toBe(7095.2);
  expect(parsePercent("9.20%")).toBe(9.2);
});
```

- [ ] **Step 2: Run parser tests and verify missing exports**

Run: `npm test -- tests/data/governmentDebt/parseDebtSources.test.ts`

Expected: FAIL because `pdfText.ts` and `parseDebtSources.ts` do not exist.

- [ ] **Step 3: Implement safe exact-page PDF reading**

Use the documented `pdf-parse` lifecycle:

```ts
export async function readPdfPages(
  filePath: string,
  pageNumbers: number[],
): Promise<Map<number, string>> {
  const parser = new PDFParse({ data: await fs.readFile(filePath) });
  try {
    const result = await parser.getText({ partial: pageNumbers });
    return new Map(result.pages.map((page) => [page.num, page.text]));
  } finally {
    await parser.destroy();
  }
}
```

Reject missing pages and marker mismatches before parsing numbers.

- [ ] **Step 4: Implement stock parsing**

Parse N13 page 31 for 2013-2014 and N25 page 26 for 2015-2025. Read only `External Government Debt` and `Domestic Government Debt`; derive total as their exact decimal sum. Pin representative expectations:

```ts
expect(stockValue(rows, 2013, "total")).toBe(8433.0);
expect(stockValue(rows, 2019, "total")).toBe(19915.7);
expect(stockValue(rows, 2022, "total")).toBe(28587.3);
expect(stockValue(rows, 2025, "total")).toBe(35934.4);
```

Store the published rounded total row only in validation controls.

- [ ] **Step 5: Implement actual-service parsing**

For domestic service, parse N25 page 20. Read the 13-value `PRINCIPAL *` and `INTEREST` history, then add the seven-value `Loans of Budgetary Organizations` principal/interest subsection to 2019-2025.

For external service, parse the `o/w Government External Debt` rows from N7 page 32, N13 page 32, N19 page 35, and N25 page 27. Each year is a five-field group; take `Principal Paid` and `Interest Paid`.

Derive total from domestic plus external and pin:

```ts
expect(actualValue(rows, 2013, "external")).toMatchObject({
  principal_paid_million_gel: 430.4,
  interest_paid_million_gel: 134.3,
});
expect(actualValue(rows, 2022, "external")).toMatchObject({
  principal_paid_million_gel: 971.2,
  interest_paid_million_gel: 236.4,
});
expect(actualValue(rows, 2025, "external")).toMatchObject({
  principal_paid_million_gel: 1359.1,
  interest_paid_million_gel: 718.7,
});
expect(actualValue(rows, 2020, "domestic")).toMatchObject({
  principal_paid_million_gel: 1570.23,
  interest_paid_million_gel: 428.2,
});
expect(actualValue(rows, 2025, "domestic")).toMatchObject({
  principal_paid_million_gel: 1377.4,
  interest_paid_million_gel: 914.3,
});
```

The transformation for 2019-2025 domestic rows must name both the public domestic history and the budgetary-organization addition.

- [ ] **Step 6: Implement the 33-row interest-rate grid**

Parse the July 2026 monthly report page 3 total series exactly as published:

```ts
const totalRates = [3.1, 3.3, 3.2, 3.3, 3.2, 2.8, 2.5, 3.9, 5.0, 4.9, 4.7];
```

Parse the exact reviewed strategy pages: 2019-2021 page 14, 2022-2025 page 23, 2023-2026 page 24, and 2025-2029 page 28. Use them for:

```ts
const domesticRates = new Map([
  [2018, 8.3], [2019, 8.21], [2020, 8.59], [2021, 8.83],
  [2022, 9.2], [2023, 9.06], [2024, 8.84],
]);
const externalRates = new Map([
  [2021, 0.95], [2022, 2.23], [2023, 3.4], [2024, 3.12],
]);
```

Emit blank values and `not_found_in_reviewed_sources` for domestic 2015-2017/2025 and external 2015-2020/2025. Assert 33 rows, 22 available values, and 11 blanks. Explicitly test that the 2018-2020 `External Debt (excludes the Eurobond)` rows are rejected as full external rates.

- [ ] **Step 7: Implement forecast parsing and control workbook reading**

Parse:

- N25 page 17 Government External Debt principal/interest for 2026-2030;
- N25 page 24 Treasury-security issued amounts grouped by redemption year for domestic principal;
- N25 page 22 published total Treasury-security service for domestic total service;
- N25 page 7 `GEL 0.3710` for `1 GEL = 0.3710 USD`, deriving `1 USD = 1 / 0.3710 GEL`;
- `Sheet2!AX6/AX9/AX15` and `Sheet2!BJ6/BJ9/BJ15` from the control workbook.

Assert the external and domestic controls from the spec, round derived domestic interest to one decimal, and retain the unrounded exchange-rate reciprocal for calculation.

- [ ] **Step 8: Run all parser tests**

Run: `npm test -- tests/data/governmentDebt/parseDebtSources.test.ts`

Expected: PASS with stock, actual-service, rate-grid, forecast, page-marker, excluded-scope, and control-cell tests.

- [ ] **Step 9: Commit source parsers**

```powershell
git add -- "apps/web/lib/data/governmentDebt" "apps/web/tests/data/governmentDebt/parseDebtSources.test.ts"
git commit -m "data: parse government debt source tables"
```

---

### Task 3: Build deterministic normalized artifacts and validation

**Files:**

- Create: `apps/web/lib/data/governmentDebt/prepareGovernmentDebtPackage.ts`
- Create: `apps/web/scripts/prepare-government-debt.ts`
- Modify: `apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts`
- Create: four normalized CSVs and `validation-report.json` under `docs/Raw Data/Debt/government-debt-annual/`

**Interfaces:**

- Consumes: Task 2 parser outputs, Task 1 manifest/notes, and the existing national GDP CSV.
- Produces: `buildGovernmentDebtPackage({ write: boolean }): Promise<GovernmentDebtPackageBuild>` and deterministic committed artifacts.

The orchestrator helpers have these signatures:

```ts
readAndValidateManifest(filePath: string): Promise<SourceManifestRow[]>;
verifySourceHashes(rows: SourceManifestRow[], officialDir: string): Promise<void>;
loadApprovedPages(paths: GovernmentDebtPackagePaths): Promise<ApprovedSourcePages>;
validatePackage(input: GovernmentDebtValidationInput): Promise<GovernmentDebtValidationReport>;
writeOrCheckArtifacts(
  options: { write: boolean },
  artifacts: GovernmentDebtTextArtifacts,
): Promise<void>;
```

- [ ] **Step 1: Write failing end-to-end row and validation tests**

Add assertions for exact output sizes and invariants:

```ts
const result = await buildGovernmentDebtPackage({ write: false });
expect(result.stockRows).toHaveLength(39);
expect(result.actualServiceRows).toHaveLength(39);
expect(result.interestRateRows).toHaveLength(33);
expect(result.forecastRows).toHaveLength(15);
expect(result.validation.status).toBe("complete_with_documented_rate_gaps");
expect(result.validation.estimates_created).toBe(0);
expect(result.validation.interestRates.availableCount).toBe(22);
expect(result.validation.interestRates.gaps).toHaveLength(11);
```

Also assert unique `(year, scope)` keys, nonnegative available values, exact total-component equalities, methodology-note IDs on the affected rows, and the 2019/2022 control values.

- [ ] **Step 2: Run the package test and verify missing builder failure**

Run: `npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts`

Expected: FAIL because `buildGovernmentDebtPackage` and generated outputs do not exist.

- [ ] **Step 3: Implement package paths, source verification, and exact row builders**

Follow the existing Geostat-package pattern:

```ts
export async function buildGovernmentDebtPackage(
  options: { write: boolean },
): Promise<GovernmentDebtPackageBuild> {
  const manifestRows = await readAndValidateManifest(paths.manifest);
  await verifySourceHashes(manifestRows, paths.officialDir);
  const pages = await loadApprovedPages(paths);
  const stockRows = parseGovernmentDebtStock(pages);
  const actualServiceRows = parseActualDebtService(pages);
  const interestRateRows = parseInterestRateGrid(pages);
  const forecastRows = parseDebtServiceForecast(pages);
  const controlComparisons = readControlWorkbookValues(paths.controlWorkbook);
  const validation = await validatePackage({
    manifestRows,
    stockRows,
    actualServiceRows,
    interestRateRows,
    forecastRows,
    controlComparisons,
  });
  return writeOrCheckArtifacts(options, {
    stockRows,
    actualServiceRows,
    interestRateRows,
    forecastRows,
    validation,
  });
}
```

Do not cache or fetch network resources; every build reads preserved local captures.

- [ ] **Step 4: Implement fixed-schema BOM CSV and stable JSON serialization**

Use `csvEscape`, explicit header arrays, `\uFEFF`, `\n`, and final newlines. Serialize validation JSON with `JSON.stringify(report, null, 2) + "\n"`. Sort every output by year/payment year, then `total`, `domestic`, `external`.

In `--check`, use `assertGeneratedArtifactMatches` for all five generated text artifacts. In `--write`, write only those five files; do not rewrite manifest, notes, sources, README, or XLSX.

- [ ] **Step 5: Implement GDP-share and official-ratio validation**

Read existing GDP rows for 2013-2025 and calculate:

```ts
const calculatedShare = (debtMillionGel / gdpMillionGel) * 100;
```

Store full-precision calculated shares in validation. Compare them with published Government-Debt-to-GDP controls when available: differences up to 0.1 percentage point are rounding matches; larger differences are reported as `possible_gdp_vintage_difference` and never mutate debt or GDP.

- [ ] **Step 6: Implement the CLI and generate artifacts**

The wrapper accepts exactly one argument, `--write` or `--check`, prints four row counts and validation status, and exits nonzero on failure.

Run: `npx tsx scripts/prepare-government-debt.ts --write`

Expected:

```text
Prepared the government debt research package.
Stock rows: 39
Actual service rows: 39
Interest-rate rows: 33
Forecast rows: 15
Validation: complete_with_documented_rate_gaps
```

- [ ] **Step 7: Test deterministic check mode and tamper rejection**

Add the same non-writing and mocked stale-read pattern used by the Geostat package. Confirm every generated artifact is unchanged after `buildGovernmentDebtPackage({ write: false })` and that a mocked altered `validation-report.json` read produces:

```text
Generated government debt artifact is stale: docs\Raw Data\Debt\government-debt-annual\validation-report.json
```

- [ ] **Step 8: Run focused package tests**

Run: `npm test -- tests/data/governmentDebt/parseDebtSources.test.ts tests/data/governmentDebt/governmentDebtPackage.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit normalized package generation**

```powershell
git add -- "apps/web/lib/data/governmentDebt" "apps/web/scripts/prepare-government-debt.ts" "apps/web/tests/data/governmentDebt" "docs/Raw Data/Debt/government-debt-annual"
git commit -m "data: prepare annual government debt datasets"
```

---

### Task 4: Create and verify the review workbook

**Files:**

- Create temporarily: `tmp/spreadsheets/government-debt-package/build-review-workbook.mjs`
- Create: `docs/Raw Data/Debt/government-debt-annual/government-debt-review.xlsx`
- Modify: `apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts`

**Interfaces:**

- Consumes: the four generated CSVs, source manifest, methodology notes, validation JSON, and existing GDP CSV.
- Produces: a seven-sheet review workbook with exact CSV semantic parity and formula-driven review-only GDP shares.

- [ ] **Step 1: Write the failing workbook-parity test**

Assert exact sheet order:

```ts
expect(workbook.SheetNames).toEqual([
  "Read me",
  "Stock",
  "Interest rates",
  "Actual service",
  "Forecast service",
  "2019-2022 controls",
  "Sources",
]);
```

For each data sheet, compare every header, row, value type, blank value, and ISO date with the matching CSV. Assert the control sheet contains all six exact control workbook cells and six canonical Government Debt values. Assert `Stock` has a formula-backed review-only GDP-share column and does not duplicate GDP into the normalized CSV.

- [ ] **Step 2: Run the workbook test and verify the missing-workbook failure**

Run: `npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts`

Expected: FAIL because `government-debt-review.xlsx` does not exist.

- [ ] **Step 3: Initialize the artifact-tool builder environment**

Load the workspace dependencies, create the temporary builder directory, and create a Windows junction from its `node_modules` to the loader-provided Node module directory. Immediately before authoring, run:

```powershell
node container_tools/mark_artifact_operation_started.mjs --operation-kind create --expected-output-count 1 --output-format xlsx
```

Do not add `@oai/artifact-tool` to `apps/web/package.json`.

- [ ] **Step 4: Build the seven-sheet workbook**

Use `SpreadsheetFile`, `Workbook`, and block writes. Apply the existing Fiscal.ge warm editorial workbook treatment: restrained navy/terracotta headers, readable neutral body font, right-aligned numbers, explicit `#,##0.0`/`0.00%`/`yyyy-mm-dd` formats, filters, frozen header rows, wrapped source notes, and no decorative chart.

After the 13 normalized CSV columns, add two review-only columns: column `N`, `GDP denominator (million GEL)`, populated from the existing GDP CSV; and column `O`, `Debt/GDP (%)`, populated with formulas. For example:

```js
stockSheet.getRange("O2").formulas = [["=IFERROR(C2/N2,\"\")"]];
```

The semantic-parity test compares columns `A:M` with the stock CSV, checks column `N` against the existing GDP CSV for every row, and checks every column `O` formula/result. Keep the approved seven-sheet contract; do not add a helper sheet.

- [ ] **Step 5: Inspect, scan, and render every sheet**

Use `workbook.inspect` on key ranges, scan for `#REF!|#DIV/0!|#VALUE!|#NAME?|#N/A`, render all seven sheets to PNG, and inspect every image. Correct clipped Georgian text, unreadable source URLs, excessive widths/heights, broken formulas, and formatting inconsistencies before export.

- [ ] **Step 6: Export once and run semantic parity tests**

Export to the approved package path, then run:

`npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts`

Expected: PASS for sheet order, row counts, field/type parity, formulas, controls, and sources.

- [ ] **Step 7: Commit only the final workbook and test**

```powershell
git add -- "docs/Raw Data/Debt/government-debt-annual/government-debt-review.xlsx" "apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts"
git commit -m "data: add government debt review workbook"
```

Do not stage the builder, runtime junction, or PNG previews.

---

### Task 5: Document the package and integrate deterministic checks

**Files:**

- Create: `docs/Raw Data/Debt/government-debt-annual/README.md`
- Create: `docs/data-methodology/government-debt-annual.md`
- Modify: `apps/web/package.json`
- Modify: `apps/web/vitest.config.ts`
- Modify: `apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts`

**Interfaces:**

- Consumes: the complete validated package and its actual observed counts/gaps.
- Produces: durable rerun commands and a repository-wide stale-data gate.

- [ ] **Step 1: Write failing command-wiring and documentation assertions**

Test that `package.json` contains:

```json
"data:prepare-government-debt": "tsx scripts/prepare-government-debt.ts --write",
"data:check-government-debt": "tsx scripts/prepare-government-debt.ts --check"
```

and that `data:validate` invokes `npm run data:check-government-debt`. Assert README/methodology contain the four observed coverages, 11 rate gaps, 2019/2022 notes, existing GDP reuse, forecast boundary, and explicit UI/database exclusions.

- [ ] **Step 2: Run the test and verify missing wiring/docs failure**

Run: `npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts`

Expected: FAIL on missing commands and methodology files.

- [ ] **Step 3: Write the concise README and durable methodology**

The README is the non-technical handoff; the methodology owns exact source pages/tables, source IDs/hashes, parsing rules, control values, gap list, GDP-vintage handling, forecast conversion, validation counts, and rerun commands. Keep legal discussion out. State clearly:

```text
No estimates were created. The package changes no served Fiscal.ge data.
```

- [ ] **Step 4: Add package commands and repository-wide check wiring**

Add the two scripts and append `&& npm run data:check-government-debt` to `data:validate`. Do not add a database import or public-data registry entry.

- [ ] **Step 5: Serialize the heavy integration test**

Add `tests/data/governmentDebt/governmentDebtPackage.test.ts` to `HEAVY_TESTS` in `vitest.config.ts`, preserving the existing heavy/exclusive ordering.

- [ ] **Step 6: Run focused commands and tests**

Run in `apps/web`:

```powershell
npm run data:check-government-debt
npm test -- tests/data/governmentDebt/parseDebtSources.test.ts
npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts
npm run data:validate
```

Expected: all pass; the package reports 39/39/33/15 rows and 11 documented rate gaps.

- [ ] **Step 7: Commit documentation and check integration**

```powershell
git add -- "docs/Raw Data/Debt/government-debt-annual/README.md" "docs/data-methodology/government-debt-annual.md" "apps/web/package.json" "apps/web/vitest.config.ts" "apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts"
git commit -m "data: validate government debt research package"
```

---

### Task 6: Full verification and final review

**Files:**

- Verify: all files changed by Tasks 1-5.
- Do not modify unrelated files.

**Interfaces:**

- Consumes: completed source package, generator, tests, workbook, and docs.
- Produces: evidence that the approved data-only scope is complete and the repository remains healthy.

- [ ] **Step 1: Regenerate and prove freshness**

Run:

```powershell
Set-Location apps/web
npm run data:prepare-government-debt
npm run data:check-government-debt
```

Expected: both succeed with identical row counts and `complete_with_documented_rate_gaps`.

- [ ] **Step 2: Run focused tests alone**

```powershell
npm test -- tests/data/governmentDebt/parseDebtSources.test.ts
npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts
```

Expected: all focused tests pass within the 30-second test budget.

- [ ] **Step 3: Run repository gates**

```powershell
npm run check
npm run build
```

Expected: both exit 0. Browser tests are not required because no UI or route changes.

- [ ] **Step 4: Audit scope and Git state**

Confirm with `git diff --name-only 7d89a16e2..HEAD` and `git status --short --branch` that:

- no `data/imports`, Prisma, route, component, `Project_Definition.md`, or `DESIGN.md` file changed;
- existing GDP and `spending.debt_service` files are byte-identical;
- only intended package/code/docs files are tracked;
- temporary research/build/render files remain untracked or ignored.

- [ ] **Step 5: Perform an independent evidence review**

Re-open representative PDF pages and the control XLSX, then independently compare:

- stock: 2013, 2019, 2022, 2025;
- actual service: 2013, 2019, 2022, 2025;
- rates: total 2015/2025, domestic 2018/2024, external 2021/2024, all 11 blanks;
- forecast: every 2026-2030 principal/interest value and exchange conversion;
- workbook rows and formulas against the CSVs.

Record no success claim until these checks agree.

- [ ] **Step 6: Commit any verification-only corrections, then report exact state**

If verification required a scoped correction, rerun the affected focused test and both repository gates, then commit only that correction. Report branch, commit list, test commands/results, exact data coverage/gaps, and the boundary that no application behavior changed. Do not push, open a PR, merge, or deploy unless separately authorized.
