# National Budget Share of GDP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the national expenditure and revenue explorers' share-of-budget measure with a same-year share of official nominal GDP, backed by a source-preserved and parity-checked 1996–2025 Geostat dataset, without creating a GDP explorer or changing municipal and single-year composition behavior.

**Architecture:** Preserve and deterministically extract two official Geostat workbooks into one reviewed national-GDP CSV. Add the 30 canonical annual facts to the existing CSV/Prisma serving mirror, pass the compact series only to the national multi-year explorer, and calculate `budget_amount_gel / gdp_current_prices_gel` in the shared model. Keep `sh=1` as the URL-state key, keep analysis composition code separate, and keep municipalities on their existing public-total denominator.

**Tech Stack:** Next.js 16.2.11, React 19.2.8, strict TypeScript, Vitest 4.1.5, Playwright 1.60, Prisma 7.9.1 with PostgreSQL/Supabase, `xlsx` 0.18.5, `zod` 4.4.3, `decimal.js` 10.6.0.

## Global Constraints

- Public scope is only `წილი მშპ-ში` on `/explorer/expenditure` and `/explorer/revenue`.
- Do not add a GDP explorer route, GDP navigation item, live `/methodology/gdp` route, sitemap entry, or clickable GDP future marker.
- Canonical GDP measure is annual Georgia GDP at market prices, current prices, in GEL.
- Canonical GDP coverage is exactly 1996–2025: SNA 1993 for 1996–2009 and SNA 2008 for 2010–2025.
- Preserve the 2010–2018 source overlap in staging, but never select SNA 1993 after 2009.
- Preserve 2025 as `preliminary`; do not estimate, interpolate, backcast, or zero-fill GDP.
- Round source workbook values to their published one-decimal million-GEL precision before converting to GEL.
- Reviewed CSV remains the human-reviewed source of truth; Supabase is a transactional, field-for-field mirror.
- Municipal shares and single-year analysis composition shares must remain behaviorally unchanged.
- Preserve existing `sh=1` shared links.
- Public Georgian CSVs begin with a UTF-8 BOM.
- Do not add dependencies or a generic economic-indicator framework.
- Run commands from `apps/web`; on Windows use `npm.cmd`.
- Do not use `prisma migrate dev`; author the SQL with `prisma migrate diff`, add RLS explicitly, and use `prisma migrate deploy` for an actual database.

---

## File structure

### New source and data files

- `docs/Raw Data/GDP/national-nominal-gdp/official/GDP-at-current-prices.xlsx` — immutable SNA 1993 capture.
- `docs/Raw Data/GDP/national-nominal-gdp/official/03_GDP-at-Current-Prices.xlsx` — immutable SNA 2008 capture.
- `docs/Raw Data/GDP/national-nominal-gdp/source-manifest.csv` — reviewed URLs, hashes, sizes, coverage, and source roles.
- `docs/Raw Data/GDP/national-nominal-gdp/README.md` — package scope, source handoff, coverage, and regeneration notes.
- `docs/Raw Data/GDP/national-nominal-gdp/validation-report.json` — deterministic source and canonical validation evidence.
- `data/staging/national-gdp-source-facts-1996-2025.csv` — both source histories, including the overlap.
- `data/imports/national-gdp-annual-1996-2025.csv` — one canonical fact per year.
- `apps/web/lib/data/nationalGdp/types.ts` — ingestion contracts.
- `apps/web/lib/data/nationalGdp/importNationalGdp.ts` — strict canonical CSV loader.
- `apps/web/lib/data/nationalGdp/prepareNationalGdp.ts` — workbook extraction, handoff, and deterministic output checks.
- `apps/web/scripts/prepare-national-gdp.ts` — `--write` / `--check` command wrapper.
- `apps/web/tests/data/nationalGdp/prepareNationalGdp.test.ts` — source and generator regression suite.
- `apps/web/tests/data/nationalGdp/importNationalGdp.test.ts` — canonical loader failures and success cases.
- `apps/web/prisma/migrations/20260813210000_national_gdp/migration.sql` — model, enums, index, relations, and RLS.
- `docs/data-methodology/national-nominal-gdp.md` — denominator methodology.

### Existing data and database files

- `data/sources/source-documents.csv` — add the two Geostat source identities.
- `apps/web/package.json` — add GDP prepare/check commands and include the check in `data:validate`.
- `apps/web/prisma/schema.prisma` — add GDP enums/model and relations.
- `apps/web/lib/servedRows.ts` — add the compact browser-safe GDP shape.
- `apps/web/lib/data/servedData.ts` — load, narrow, cache, and parity-check GDP facts with explorer data.
- `apps/web/lib/data/servedDataParity.ts` — add the GDP natural key.
- `apps/web/lib/db/mirrorRows.ts` — read GDP mirror rows into the canonical ingestion shape.
- `apps/web/lib/db/servedDataDb.ts` — include GDP in DB explorer loads.
- `apps/web/scripts/import-budget-facts.ts` — validate, import, read back, count, and field-compare GDP rows in the existing transaction.
- `apps/web/scripts/validate-data-files.ts` — run the GDP integrity check and require GDP coverage for every served national budget year.
- `apps/web/lib/data/parityReport.ts` — no new total section; include `NationalGdpFact` in the existing count report while field parity proves value/status/source equality.
- `apps/web/tests/data/servedData.test.ts`, `servedDataParity.test.ts`, `parityReport.test.ts` — GDP load/narrowing/parity coverage.
- `docs/data-methodology/database-import.md` — document the new mirror table.

### Existing explorer and UI files

- `apps/web/lib/explorer/types.ts` — change main measure identity to `share_of_gdp`, add GDP metadata, and add the year-indexed relevant-share data used by the KPI sparkline.
- `apps/web/lib/explorer/explorerData.ts` — accept GDP facts and compute same-year ratios for points, rows, summaries, totals, and missing denominators.
- `apps/web/lib/explorer/sparkline.ts` — trace the row's already-calculated GDP-share series.
- `apps/web/lib/explorer/csvExport.ts` — append reproducible GDP denominator/status/source/share columns.
- `apps/web/components/main-explorer/main-explorer.tsx` — accept GDP facts, pass them to the model/export, and switch to `share_of_gdp`.
- `apps/web/components/main-explorer/explorer-view.tsx` — display `% მშპ-ში` and `data-measure="share_of_gdp"`.
- `apps/web/components/main-explorer/explorer-table.tsx` — label the last column `წილი მშპ-ში {year}`.
- `apps/web/components/main-explorer/indicators.tsx` — label and render `ყველაზე დიდი წილი მშპ-ში` with GDP-share sparkline.
- `apps/web/app/explorer/expenditure/page.tsx`, `apps/web/app/explorer/revenue/page.tsx` — pass the GDP facts; analysis route remains unchanged.
- `apps/web/tests/explorer/explorerData.test.ts`, `integration.test.ts`, `sparkline.test.ts`, `csvExport.test.ts`, `urlState.test.ts` — calculation and regression tests.
- `apps/web/tests/browser/main-explorer.spec.ts`, `methodology.spec.ts`, `municipalities.spec.ts` — public behavior and no-route/no-regression proof.

### Existing canonical documentation

- `Project_Definition.md` — approve the bounded GDP-share measure and preserve the no-GDP-explorer boundary.
- `DESIGN.md` — replace national share-of-total copy/behavior while preserving analysis and municipality composition shares.
- `docs/data-methodology/revenue-methodology.md` and the matching expenditure methodology owner — add denominator source/status/handoff disclosure.
- `apps/web/lib/methodology/content/expenditure.ts` and `revenue.ts` — add concise public denominator disclosure without creating a GDP methodology category.
- `apps/web/tests/methodology/catalog.test.ts` — verify the public articles mention the denominator and the GDP future marker remains non-clickable.

---

### Task 1: Preserve and deterministically prepare official national GDP

**Files:**
- Create: `docs/Raw Data/GDP/national-nominal-gdp/official/GDP-at-current-prices.xlsx`
- Create: `docs/Raw Data/GDP/national-nominal-gdp/official/03_GDP-at-Current-Prices.xlsx`
- Create: `docs/Raw Data/GDP/national-nominal-gdp/source-manifest.csv`
- Create: `docs/Raw Data/GDP/national-nominal-gdp/README.md`
- Create: `docs/Raw Data/GDP/national-nominal-gdp/validation-report.json`
- Create: `data/staging/national-gdp-source-facts-1996-2025.csv`
- Create: `data/imports/national-gdp-annual-1996-2025.csv`
- Create: `apps/web/lib/data/nationalGdp/types.ts`
- Create: `apps/web/lib/data/nationalGdp/prepareNationalGdp.ts`
- Create: `apps/web/scripts/prepare-national-gdp.ts`
- Create: `apps/web/tests/data/nationalGdp/prepareNationalGdp.test.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: two immutable workbooks and `source-manifest.csv`.
- Produces: `prepareNationalGdp({ write: boolean }): Promise<NationalGdpPreparationResult>`.
- Produces: `NationalGdpSourceFact`, `NationalGdpFact`, and `NationalGdpValidationReport` types.
- Produces: deterministic staging/canonical CSV and validation JSON used by all later tasks.

- [ ] **Step 1: Capture and verify the exact official workbooks**

Download with the official URLs, then verify the observed bytes before adding them:

```powershell
curl.exe -L "https://www.geostat.ge/media/27798/GDP-at-current-prices.xlsx" -o "../../docs/Raw Data/GDP/national-nominal-gdp/official/GDP-at-current-prices.xlsx"
curl.exe -L "https://www.geostat.ge/media/81052/03_GDP-at-Current-Prices.xlsx" -o "../../docs/Raw Data/GDP/national-nominal-gdp/official/03_GDP-at-Current-Prices.xlsx"
Get-FileHash "../../docs/Raw Data/GDP/national-nominal-gdp/official/GDP-at-current-prices.xlsx" -Algorithm SHA256
Get-FileHash "../../docs/Raw Data/GDP/national-nominal-gdp/official/03_GDP-at-Current-Prices.xlsx" -Algorithm SHA256
```

Expected reviewed captures on 2026-08-13:

```text
GDP-at-current-prices.xlsx
bytes: 94214
sha256: 1F9BEFDCA89F3A635F66ABB14892386A9947BF7294045E4442832AA53E63DC8E

03_GDP-at-Current-Prices.xlsx
bytes: 50098
sha256: 21A576C9C20434A87BCB32047CD143EEF2B8D3F3FF360442B420C76B0DA27D34
```

If Geostat returns different bytes, stop and review the new workbook coverage, labels, notes, and values; do not update hashes mechanically.

- [ ] **Step 2: Write the failing source-package tests**

Create `prepareNationalGdp.test.ts` with exact source and handoff assertions:

```ts
it("preserves the reviewed Geostat captures", async () => {
  const result = await prepareNationalGdp({ write: false });
  expect(result.validation.sourceHashesMatch).toBe(true);
  expect(result.validation.sourceBytes).toEqual({ sna1993: 94_214, sna2008: 50_098 });
});

it("keeps the overlap in staging and selects one canonical row per year", async () => {
  const result = await prepareNationalGdp({ write: false });
  expect(result.sourceFacts.filter((row) => row.year === 2010)).toHaveLength(2);
  expect(result.canonicalFacts).toHaveLength(30);
  expect(result.canonicalFacts.map((row) => row.year)).toEqual(
    Array.from({ length: 30 }, (_, index) => 1996 + index),
  );
  expect(result.canonicalFacts.filter((row) => row.year <= 2009).every((row) => row.accountingStandard === "sna_1993")).toBe(true);
  expect(result.canonicalFacts.filter((row) => row.year >= 2010).every((row) => row.accountingStandard === "sna_2008")).toBe(true);
});

it("pins published market-price values and 2025 status", async () => {
  const result = await prepareNationalGdp({ write: false });
  const byYear = new Map(result.canonicalFacts.map((row) => [row.year, row]));
  expect(byYear.get(1996)?.gdpCurrentPricesGel).toBe(3_868_500_000);
  expect(byYear.get(2005)?.gdpCurrentPricesGel).toBe(11_620_900_000);
  expect(byYear.get(2009)?.gdpCurrentPricesGel).toBe(17_986_000_000);
  expect(byYear.get(2010)?.gdpCurrentPricesGel).toBe(22_148_700_000);
  expect(byYear.get(2024)?.gdpCurrentPricesGel).toBe(93_022_300_000);
  expect(byYear.get(2025)).toMatchObject({
    gdpCurrentPricesGel: 104_598_100_000,
    status: "preliminary",
  });
});
```

- [ ] **Step 3: Run the focused test and confirm the missing-module failure**

Run:

```powershell
npm.cmd test -- tests/data/nationalGdp/prepareNationalGdp.test.ts
```

Expected: FAIL because `prepareNationalGdp` and its contracts do not exist.

- [ ] **Step 4: Implement the explicit source contracts and extractor**

Define the core contracts in `types.ts`:

```ts
export type GdpAccountingStandard = "sna_1993" | "sna_2008";
export type GdpStatus = "final_as_published" | "preliminary";

export type NationalGdpSourceFact = {
  year: number;
  gdpCurrentPricesMillionGel: number;
  accountingStandard: GdpAccountingStandard;
  status: GdpStatus;
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  sourceUnit: "mil. GEL";
};

export type NationalGdpFact = NationalGdpSourceFact & {
  gdpCurrentPricesGel: number;
  transformation: string;
  lastReviewedAt: string;
};
```

Implement `prepareNationalGdp` with these exact rules:

```ts
const canonical = sourceFacts
  .filter((row) => row.year <= 2009 ? row.accountingStandard === "sna_1993" : row.accountingStandard === "sna_2008")
  .map((row) => {
    const publishedMillionGel = Math.round(row.gdpCurrentPricesMillionGel * 10) / 10;
    return {
      ...row,
      gdpCurrentPricesMillionGel: publishedMillionGel,
      gdpCurrentPricesGel: publishedMillionGel * 1_000_000,
      transformation: `Published one-decimal million GEL multiplied by 1,000,000; no estimate.`,
      lastReviewedAt: "2026-08-13",
    };
  });
```

Locate the row by the exact label `(=) GDP at market prices`; accept annual headers only (`1996`, `2025*`), record the worksheet cell with `XLSX.utils.encode_cell`, and reject duplicate/missing years, non-positive values, unexpected units/titles, unexpected source hashes, and any canonical standard outside the handoff rule.

- [ ] **Step 5: Implement deterministic write/check behavior**

The wrapper accepts only `--write` or `--check`:

```ts
const mode = process.argv[2];
if (mode !== "--write" && mode !== "--check") {
  throw new Error("Usage: tsx scripts/prepare-national-gdp.ts --write|--check");
}
await prepareNationalGdp({ write: mode === "--write" });
```

`--write` writes staging, canonical, and validation files. `--check` regenerates in memory and byte-compares them to disk. Both CSVs begin with `\uFEFF`; JSON ends with one newline.

Add scripts:

```json
"data:prepare-national-gdp": "tsx scripts/prepare-national-gdp.ts --write",
"data:check-national-gdp": "tsx scripts/prepare-national-gdp.ts --check"
```

- [ ] **Step 6: Generate twice and prove a fixed point**

Run:

```powershell
npm.cmd run data:prepare-national-gdp
npm.cmd run data:prepare-national-gdp
git diff --exit-code -- "../../data/staging/national-gdp-source-facts-1996-2025.csv" "../../data/imports/national-gdp-annual-1996-2025.csv" "../../docs/Raw Data/GDP/national-nominal-gdp/validation-report.json"
npm.cmd run data:check-national-gdp
npm.cmd test -- tests/data/nationalGdp/prepareNationalGdp.test.ts
```

Expected: second generation makes no changes; focused tests PASS.

- [ ] **Step 7: Commit the source-preserved data foundation**

```powershell
git add -- "../../docs/Raw Data/GDP/national-nominal-gdp" "../../data/staging/national-gdp-source-facts-1996-2025.csv" "../../data/imports/national-gdp-annual-1996-2025.csv" lib/data/nationalGdp scripts/prepare-national-gdp.ts tests/data/nationalGdp/prepareNationalGdp.test.ts package.json
git commit -m "data: add official national nominal GDP series"
```

---

### Task 2: Add strict GDP loading and repository-wide data validation

**Files:**
- Create: `apps/web/lib/data/nationalGdp/importNationalGdp.ts`
- Create: `apps/web/tests/data/nationalGdp/importNationalGdp.test.ts`
- Modify: `data/sources/source-documents.csv`
- Modify: `apps/web/lib/data/servedData.ts`
- Modify: `apps/web/lib/servedRows.ts`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/tests/data/servedData.test.ts`
- Modify: `apps/web/tests/data/pipelineIntegration.test.ts`

**Interfaces:**
- Consumes: `data/imports/national-gdp-annual-1996-2025.csv`.
- Produces: `loadNationalGdpFacts(path: string): Promise<NationalGdpFact[]>`.
- Produces: `ServedNationalGdpFact` with only `year`, `gdpCurrentPricesGel`, `accountingStandard`, `status`, and `sourceId`.
- Extends: `LoadedExplorerData` and `ExplorerData` with `gdpFacts`.

- [ ] **Step 1: Write failing loader and served-shape tests**

```ts
it("loads exactly one canonical GDP fact for every 1996–2025 year", async () => {
  const rows = await loadNationalGdpFacts("../../data/imports/national-gdp-annual-1996-2025.csv");
  expect(rows).toHaveLength(30);
  expect(rows[0]?.year).toBe(1996);
  expect(rows.at(-1)?.year).toBe(2025);
});

it("rejects a duplicate year and a non-positive denominator", async () => {
  await expect(loadNationalGdpFacts(fixture("duplicate-year.csv"))).rejects.toThrow(/Duplicate GDP year/);
  await expect(loadNationalGdpFacts(fixture("zero-gdp.csv"))).rejects.toThrow(/must be positive/);
});
```

Extend the served-shape assertion:

```ts
expect(Object.keys(explorer.gdpFacts[0]).sort()).toEqual([
  "accountingStandard", "gdpCurrentPricesGel", "sourceId", "status", "year",
]);
```

- [ ] **Step 2: Run the focused tests and confirm failure**

```powershell
npm.cmd test -- tests/data/nationalGdp/importNationalGdp.test.ts tests/data/servedData.test.ts
```

Expected: FAIL because the canonical loader and `gdpFacts` served property are absent.

- [ ] **Step 3: Implement the Zod loader and source identities**

The loader parses every canonical column, uses `Decimal` for the GEL string, rejects unsafe/non-integer GEL values, verifies unique years and handoff rules, and returns year-ascending rows.

Add these source records to `source-documents.csv`:

```csv
source.geostat_gdp_sna1993_current_prices,Geostat GDP at current prices (SNA 1993),https://www.geostat.ge/media/27798/GDP-at-current-prices.xlsx,2026-08-13
source.geostat_gdp_sna2008_current_prices,Geostat GDP at current prices (SNA 2008),https://www.geostat.ge/media/81052/03_GDP-at-Current-Prices.xlsx,2026-08-13
```

- [ ] **Step 4: Wire GDP into explorer-only served data**

Add the file and types:

```ts
export const SERVED_DATA_FILES = {
  // existing entries
  nationalGdpFacts: "../../data/imports/national-gdp-annual-1996-2025.csv",
} as const;

export type LoadedExplorerData = LoadedLandingData & {
  adminFacts: AdminSpendingFact[];
  adminCategories: AdminSpendingCategory[];
  gdpFacts: NationalGdpFact[];
};

export type ExplorerData = LandingData & {
  adminFacts: ServedAdminFact[];
  adminCategories: AdminSpendingCategory[];
  gdpFacts: ServedNationalGdpFact[];
};
```

Load it in `loadExplorerDataFromCsv`, narrow it in `loadServedExplorerData`, and keep it out of `LandingData`, `MunicipalData`, and the analysis computation.

- [ ] **Step 5: Add the data-validation boundary**

Load the already fixed-point-checked GDP facts inside `validate-data-files.ts` and assert:

```ts
assertYears("National nominal GDP", gdpFacts.map((row) => row.year), Array.from({ length: 30 }, (_, index) => 1996 + index));
assertSubset(
  "National budget years missing GDP",
  [...new Set(budgetFacts.map((row) => row.year))],
  new Set(gdpFacts.map((row) => row.year)),
);
```

Add `npm run data:check-national-gdp` to `data:validate` before the general file validator, so stale generated artifacts fail CI without rewriting files.

- [ ] **Step 6: Run focused and full data validation**

```powershell
npm.cmd test -- tests/data/nationalGdp/importNationalGdp.test.ts tests/data/servedData.test.ts tests/data/pipelineIntegration.test.ts
npm.cmd run data:validate
```

Expected: all PASS; output confirms 1996–2025 GDP and no missing denominator for 2005–2025 budget facts.

- [ ] **Step 7: Commit the strict loading boundary**

```powershell
git add -- "../../data/sources/source-documents.csv" lib/data/nationalGdp/importNationalGdp.ts lib/data/servedData.ts lib/servedRows.ts scripts/validate-data-files.ts tests/data/nationalGdp/importNationalGdp.test.ts tests/data/servedData.test.ts tests/data/pipelineIntegration.test.ts package.json
git commit -m "feat: serve validated nominal GDP facts"
```

---

### Task 3: Mirror GDP through Prisma with exact transactional parity

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/20260813210000_national_gdp/migration.sql`
- Modify: `apps/web/lib/data/servedDataParity.ts`
- Modify: `apps/web/lib/db/mirrorRows.ts`
- Modify: `apps/web/lib/db/servedDataDb.ts`
- Modify: `apps/web/lib/data/servedData.ts`
- Modify: `apps/web/scripts/import-budget-facts.ts`
- Modify: `apps/web/lib/data/parityReport.ts`
- Modify: `apps/web/tests/data/servedDataParity.test.ts`
- Modify: `apps/web/tests/data/parityReport.test.ts`
- Modify: `docs/data-methodology/database-import.md`

**Interfaces:**
- Consumes: `NationalGdpFact[]` from Task 2.
- Produces: Prisma `NationalGdpFact` rows keyed by `year`.
- Produces: `nationalGdpFactParityKey(row): string` and `loadNationalGdpFactsFromMirror(db): Promise<NationalGdpFact[]>`.
- Extends: DB explorer loads and build-time CSV/DB parity with GDP.

- [ ] **Step 1: Write failing parity-key and report-count tests**

```ts
it("keys one national GDP fact per year", () => {
  expect(nationalGdpFactParityKey({ year: 2025 })).toBe("2025");
});

it("includes NationalGdpFact row counts in parity output", () => {
  const report = buildParityReport(inputWithCount({ table: "NationalGdpFact", csvRows: 30, dbRows: 29 }));
  expect(report.status).toBe("failed");
  expect(formatParityReport(report)).toContain("NationalGdpFact: csv=30 db=29");
});
```

- [ ] **Step 2: Run focused parity tests and confirm failure**

```powershell
npm.cmd test -- tests/data/servedDataParity.test.ts tests/data/parityReport.test.ts
```

Expected: FAIL because the GDP key/model/import path does not exist.

- [ ] **Step 3: Add the Prisma enums, relations, and model**

```prisma
enum GdpAccountingStandard {
  sna_1993
  sna_2008
}

enum GdpStatus {
  final_as_published
  preliminary
}

model NationalGdpFact {
  year                Int                   @id
  gdpCurrentPricesGel Decimal               @db.Decimal(18, 2)
  accountingStandard GdpAccountingStandard
  status              GdpStatus
  sourceDocumentId    String
  sourceDocument      SourceDocument        @relation(fields: [sourceDocumentId], references: [id])
  sourceSheet         String
  sourceCell          String
  sourceUnit          String
  transformation      String
  lastReviewedAt      DateTime              @db.Date
  importRunId         String?
  importRun           ImportRun?            @relation(fields: [importRunId], references: [id])
}
```

Add `gdpFacts NationalGdpFact[]` to `SourceDocument` and `ImportRun`.

- [ ] **Step 4: Author and inspect the migration without `migrate dev`**

Use the repository runbook's read-only pattern:

```powershell
npx.cmd prisma migrate diff --from-config-datasource --to-schema-datamodel prisma/schema.prisma --script
```

Save only the new enums, new table, keys, and indexes into `20260813210000_national_gdp/migration.sql`, then append:

```sql
ALTER TABLE "NationalGdpFact" ENABLE ROW LEVEL SECURITY;
```

Reject the generated SQL if it alters any pre-existing table or enum: the two foreign keys originate on the new table and should not require an existing-table alteration. Do not apply it locally unless the configured database is explicitly intended for this branch.

- [ ] **Step 5: Implement mirror read mapping and build-time parity**

```ts
export function nationalGdpFactParityKey(row: { year: number }): string {
  return String(row.year);
}

export async function loadNationalGdpFactsFromMirror(db: MirrorClient): Promise<NationalGdpFact[]> {
  const rows = await db.nationalGdpFact.findMany({ orderBy: { year: "asc" } });
  return rows.map((row) => ({
    year: row.year,
    gdpCurrentPricesGel: Number(row.gdpCurrentPricesGel),
    accountingStandard: row.accountingStandard,
    status: row.status,
    sourceId: row.sourceDocumentId,
    sourceSheet: row.sourceSheet,
    sourceCell: row.sourceCell,
    sourceUnit: row.sourceUnit as "mil. GEL",
    transformation: row.transformation,
    lastReviewedAt: row.lastReviewedAt.toISOString().slice(0, 10),
    gdpCurrentPricesMillionGel: Number(row.gdpCurrentPricesGel) / 1_000_000,
  }));
}
```

Include GDP in `loadExplorerDataFromDb` and call `assertSameServedRows("national GDP facts", csv.gdpFacts, db.gdpFacts, nationalGdpFactParityKey)` in DB mode.

- [ ] **Step 6: Extend the existing atomic import**

Load and validate GDP before opening the transaction. Inside the transaction:

```ts
await tx.nationalGdpFact.deleteMany();
// then delete SourceDocument as before

await tx.nationalGdpFact.createMany({
  data: gdpFacts.map((fact) => ({
    year: fact.year,
    gdpCurrentPricesGel: String(fact.gdpCurrentPricesGel),
    accountingStandard: fact.accountingStandard,
    status: fact.status,
    sourceDocumentId: fact.sourceId,
    sourceSheet: fact.sourceSheet,
    sourceCell: fact.sourceCell,
    sourceUnit: fact.sourceUnit,
    transformation: fact.transformation,
    lastReviewedAt: new Date(`${fact.lastReviewedAt}T00:00:00.000Z`),
    importRunId: run.id,
  })),
});
```

Read the rows back inside the same transaction, field-compare with `assertSameServedRows`, and add `{ table: "NationalGdpFact", csvRows: 30, dbRows: mirrorGdpFacts.length }` to the count report. Any mismatch must throw before commit.

- [ ] **Step 7: Generate the Prisma client and run non-destructive verification**

```powershell
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd test -- tests/data/servedDataParity.test.ts tests/data/parityReport.test.ts tests/data/servedData.test.ts
```

If a configured disposable/local database is available, additionally run:

```powershell
npm.cmd run prisma:deploy
npm.cmd run data:import
$env:GEODATA_DATA_SOURCE="db"; npm.cmd run build
```

Expected import evidence: `NationalGdpFact: csv=30 db=30`, `Parity status: PASSED`. If credentials are unavailable, report DB deploy/import/build as unverified rather than weakening the CSV and type checks.

- [ ] **Step 8: Commit the database mirror**

```powershell
git add -- prisma lib/data/servedDataParity.ts lib/db/mirrorRows.ts lib/db/servedDataDb.ts lib/data/servedData.ts scripts/import-budget-facts.ts lib/data/parityReport.ts tests/data/servedDataParity.test.ts tests/data/parityReport.test.ts docs/data-methodology/database-import.md
git commit -m "feat: mirror nominal GDP through Prisma"
```

---

### Task 4: Calculate GDP shares in the shared national explorer model

**Files:**
- Modify: `apps/web/lib/explorer/types.ts`
- Modify: `apps/web/lib/explorer/explorerData.ts`
- Modify: `apps/web/lib/explorer/sparkline.ts`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/app/explorer/expenditure/page.tsx`
- Modify: `apps/web/app/explorer/revenue/page.tsx`
- Modify: `apps/web/tests/explorer/explorerData.test.ts`
- Modify: `apps/web/tests/explorer/integration.test.ts`
- Modify: `apps/web/tests/explorer/sparkline.test.ts`

**Interfaces:**
- Consumes: `ServedNationalGdpFact[]` from Task 2.
- Changes: `MeasureMode` from `"share_of_total"` to `"share_of_gdp"` for the main explorer.
- Extends: `ExplorerModelInput` with `gdpFacts`.
- Extends: `ExplorerTableRow` with optional `shareByYear?: Record<number, number | null>`; main national rows always populate GDP share, while municipal rows need no internal or behavioral change.
- Produces: `GdpMetadata` and `ExplorerModel.gdpByYear: Record<number, GdpMetadata>` for reproducible export.
- Produces: points/rows/summaries whose relevant national share is same-year GDP share.

- [ ] **Step 1: Replace the old share test with failing GDP-ratio tests**

```ts
const gdpFacts: ServedNationalGdpFact[] = [
  { year: 2024, gdpCurrentPricesGel: 1_000, accountingStandard: "sna_2008", status: "final_as_published", sourceId: "source.gdp" },
  { year: 2025, gdpCurrentPricesGel: 2_000, accountingStandard: "sna_2008", status: "preliminary", sourceId: "source.gdp" },
];

it("divides category and total values by same-year GDP", () => {
  const model = buildExplorerModel({
    facts,
    gdpFacts,
    glossary,
    sourceDocuments,
    side: "expenditure",
    selectedItemIds: ["expenditure.total", "spending.health"],
    startYear: 2024,
    endYear: 2025,
    measure: "share_of_gdp",
  });
  expect(model.points.find((point) => point.itemId === "spending.health" && point.year === 2025)?.value).toBeCloseTo(0.25);
  expect(model.totalRow?.shareEndYear).toBeCloseTo(0.75);
  expect(model.totalRow?.shareEndYear).not.toBe(1);
});

it("does not change ratios when selection or grouping changes", () => {
  const one = build({ selectedItemIds: ["spending.health"], gdpFacts, measure: "share_of_gdp" });
  const many = build({ selectedItemIds: ["spending.health", "spending.education"], gdpFacts, measure: "share_of_gdp" });
  expect(one.points.find((point) => point.itemId === "spending.health")?.value)
    .toBe(many.points.find((point) => point.itemId === "spending.health")?.value);
});

it("returns null when the same-year GDP denominator is missing", () => {
  const model = build({ gdpFacts: gdpFacts.filter((row) => row.year !== 2025), measure: "share_of_gdp" });
  expect(model.points.find((point) => point.year === 2025)?.value).toBeNull();
  expect(model.tableRows[0]?.shareByYear?.[2025]).toBeNull();
});
```

Add a negative-revenue case and assert its GDP share remains negative.

- [ ] **Step 2: Run focused model tests and confirm failure**

```powershell
npm.cmd test -- tests/explorer/explorerData.test.ts tests/explorer/integration.test.ts tests/explorer/sparkline.test.ts
```

Expected: FAIL because `share_of_gdp`, `gdpFacts`, and `shareByYear` do not exist.

- [ ] **Step 3: Implement the denominator map and measure function**

```ts
export const MEASURE_MODES = ["nominal", "share_of_gdp"] as const;

export type GdpMetadata = {
  gdpCurrentPricesGel: number;
  accountingStandard: GdpAccountingStandard;
  status: GdpStatus;
  source: SourceMetadata;
};

const gdpByYear = new Map(input.gdpFacts.map((fact) => [fact.year, fact]));

function shareOfGdp(amountGel: number, year: number): number | null {
  const denominator = gdpByYear.get(year)?.gdpCurrentPricesGel;
  return denominator === undefined || denominator <= 0 ? null : amountGel / denominator;
}

function valueForMeasure(amountGel: number, year: number, measure: MeasureMode): number | null {
  return measure === "share_of_gdp" ? shareOfGdp(amountGel, year) : amountGel;
}
```

For every point and table row, calculate the same ratio regardless of selected series. Populate `shareByYear` and set `shareEndYear = shareByYear[endYear] ?? null`. Resolve each GDP fact's `sourceId` through `sourceDocuments` and return the resulting `Record<number, GdpMetadata>` as `ExplorerModel.gdpByYear`. Keep nominal `change`, GEL movers, comparison rows, total-growth KPI, and `percentChange` based on `amountGel`, exactly as today.

- [ ] **Step 4: Change share-change ranking and KPI sparkline to use calculated shares**

Replace total-row division with the stored share series:

```ts
function shareChangeFor(row: ExplorerTableRow, startYear: number, endYear: number): number {
  return (row.shareByYear[endYear] ?? 0) - (row.shareByYear[startYear] ?? 0);
}

export function buildKpiShareSeries(row: ExplorerTableRow | null, years: number[]): (number | null)[] {
  return row === null ? years.map(() => null) : years.map((year) => row.shareByYear?.[year] ?? null);
}
```

Rank `biggestShareChange` by absolute GDP-share movement. Do not alter the nominal largest/slowest growth rankings.

- [ ] **Step 5: Pass GDP only to national explorer models**

Add `gdpFacts` to `MainExplorerProps`, both national route props, the `buildExplorerModel` call, and its memo dependencies. Use:

```ts
measure: share ? "share_of_gdp" : "nominal"
```

Do not pass GDP into `buildSingleYearSnapshotModel`; its types and `shareOfTotal` logic remain unchanged.

- [ ] **Step 6: Run calculation and type regression tests**

```powershell
npm.cmd test -- tests/explorer/explorerData.test.ts tests/explorer/integration.test.ts tests/explorer/sparkline.test.ts tests/explorer/singleYear.test.ts tests/explorer/municipalData.test.ts
npm.cmd run typecheck
```

Expected: all PASS; single-year and municipal results match their prior assertions.

- [ ] **Step 7: Commit the model behavior**

```powershell
git add -- lib/explorer/types.ts lib/explorer/explorerData.ts lib/explorer/sparkline.ts components/main-explorer/main-explorer.tsx app/explorer/expenditure/page.tsx app/explorer/revenue/page.tsx tests/explorer/explorerData.test.ts tests/explorer/integration.test.ts tests/explorer/sparkline.test.ts
git commit -m "feat: calculate national budget share of GDP"
```

---

### Task 5: Make GDP share explicit in UI and reproducible in CSV

**Files:**
- Modify: `apps/web/components/main-explorer/explorer-view.tsx`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx`
- Modify: `apps/web/components/main-explorer/indicators.tsx`
- Modify: `apps/web/lib/explorer/csvExport.ts`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/tests/explorer/csvExport.test.ts`
- Modify: `apps/web/tests/explorer/indicators.test.ts`
- Modify: `apps/web/tests/explorer/urlState.test.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

**Interfaces:**
- Consumes: `ExplorerModel.gdpByYear` and `ExplorerTableRow.shareByYear` from Task 4.
- Changes: public national measure copy to `% მშპ-ში`, `წილი მშპ-ში {year}`, and `ყველაზე დიდი წილი მშპ-ში`.
- Produces: `buildExplorerCsv(rows, years, gdpByYear)` with seven reproducibility columns.

- [ ] **Step 1: Write failing CSV output assertions**

Use a row with 2025 amount `150` and GDP metadata with `gdpCurrentPricesGel: 1_000`:

```ts
expect(buildExplorerCsv(rows, [2025], gdpByYear)).toContain(
  "gdp_current_prices_gel,gdp_accounting_standard,gdp_status,gdp_source_name,gdp_source_url_or_file,gdp_last_reviewed_at,share_of_gdp",
);
expect(buildExplorerCsv(rows, [2025], gdpByYear)).toContain(
  "1000,sna_2008,preliminary,Geostat GDP,https://example.test/gdp.xlsx,2026-08-13,0.15",
);
```

Add a missing-denominator row and expect the seven GDP cells to remain blank rather than zero.

- [ ] **Step 2: Add failing browser copy and behavior assertions**

Update `main-explorer.spec.ts`:

```ts
await expect(chartPanel.getByTestId("measure-share-toggle")).toHaveText("% მშპ-ში");
await chartPanel.getByTestId("measure-share-toggle").click();
await expect(chartPanel).toHaveAttribute("data-measure", "share_of_gdp");

await page.getByTestId("chart-mode-table").click();
await expect(page.getByTestId("explorer-table")).toContainText("წილი მშპ-ში 2025");
await expect(page.getByTestId("period-kpi-cards")).toContainText("ყველაზე დიდი წილი მშპ-ში");
```

Keep the URL assertion `sh=1`; do not rename the hash key.

- [ ] **Step 3: Run focused tests and confirm old-copy failures**

```powershell
npm.cmd test -- tests/explorer/csvExport.test.ts tests/explorer/indicators.test.ts tests/explorer/urlState.test.ts
```

Expected: FAIL because the CSV lacks GDP columns and UI contracts still describe share of total.

- [ ] **Step 4: Implement explicit labels and `data-measure`**

Change only the national shared components:

```tsx
<button data-testid="measure-share-toggle" aria-pressed={share}>% მშპ-ში</button>
```

```tsx
<th>წილი მშპ-ში {endYear}</th>
```

```ts
label: "ყველაზე დიდი წილი მშპ-ში"
```

Keep municipality copy (`% წილი`, `წილი მთლიან ბიუჯეტში`) untouched.

- [ ] **Step 5: Extend CSV with exact denominator metadata**

Consume the `GdpMetadata` type and `model.gdpByYear` produced in Task 4. Append these headers in this order:

```ts
"gdp_current_prices_gel",
"gdp_accounting_standard",
"gdp_status",
"gdp_source_name",
"gdp_source_url_or_file",
"gdp_last_reviewed_at",
"share_of_gdp",
```

For each exported row/year, append the same-year denominator and `amount / GDP`. Pass `model.gdpByYear` from `downloadCsv`. Keep the BOM and existing budget source columns unchanged. Include the GDP fields in nominal and GDP-share UI modes.

- [ ] **Step 6: Run unit and browser tests**

```powershell
npm.cmd test -- tests/explorer/csvExport.test.ts tests/explorer/indicators.test.ts tests/explorer/urlState.test.ts
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts
```

Expected: national expenditure/revenue pass in nominal and GDP-share modes; `sh=1` restores the measure after reload; CSV begins with BOM and contains reproducible denominator data.

- [ ] **Step 7: Commit public behavior and export**

```powershell
git add -- components/main-explorer/explorer-view.tsx components/main-explorer/explorer-table.tsx components/main-explorer/indicators.tsx components/main-explorer/main-explorer.tsx lib/explorer/csvExport.ts tests/explorer/csvExport.test.ts tests/explorer/indicators.test.ts tests/explorer/urlState.test.ts tests/browser/main-explorer.spec.ts
git commit -m "feat: expose GDP share in national explorers"
```

---

### Task 6: Update canonical scope, design, and methodology without adding a GDP page

**Files:**
- Create: `docs/data-methodology/national-nominal-gdp.md`
- Modify: `Project_Definition.md`
- Modify: `DESIGN.md`
- Modify: `docs/data-methodology/revenue-methodology.md`
- Modify: `docs/data-methodology/treasury-functional-expenditure-methodology-2004-2025.md`
- Modify: `apps/web/lib/methodology/content/expenditure.ts`
- Modify: `apps/web/lib/methodology/content/revenue.ts`
- Modify: `apps/web/tests/methodology/catalog.test.ts`
- Modify: `apps/web/tests/browser/methodology.spec.ts`

**Interfaces:**
- Consumes: approved design and implemented data behavior.
- Produces: canonical documentation of sources, handoff, preliminary status, validation, and bounded public scope.
- Preserves: non-clickable GDP future marker and absence of `/methodology/gdp`.

- [ ] **Step 1: Write failing public-methodology assertions**

```ts
it("documents nominal GDP as the national share denominator", () => {
  expect(expenditureMethodology.sections.flatMap(sectionText).join(" ")).toMatch(/მშპ/);
  expect(revenueMethodology.sections.flatMap(sectionText).join(" ")).toMatch(/მშპ/);
});
```

Keep or add browser proof:

```ts
await expect(page.getByText("მშპ", { exact: true })).not.toHaveAttribute("href");
const response = await page.request.get("http://localhost:3100/methodology/gdp");
expect(response.status()).toBe(404);
```

- [ ] **Step 2: Run methodology tests and confirm the missing disclosure**

```powershell
npm.cmd test -- tests/methodology/catalog.test.ts
```

Expected: FAIL because expenditure/revenue public content does not identify GDP as the denominator.

- [ ] **Step 3: Write the denominator methodology**

Document all of these exact facts in `national-nominal-gdp.md`:

- Geostat as sole publisher;
- GDP at market prices, current prices, million GEL source unit;
- source URLs, retrieval date, hashes, and byte sizes;
- SNA 1993 observed 1996–2018, selected 1996–2009;
- SNA 2008 observed/selected 2010–2025;
- overlap preserved in staging and SNA 2008 precedence;
- one-decimal million-GEL published precision converted to GEL;
- 2025 preliminary status and Geostat revision notice;
- no estimates or regional summation;
- exact validation and regeneration commands;
- limitation that the 2010 methodology handoff can affect comparability.

- [ ] **Step 4: Update the canonical scope and visual contracts**

In `Project_Definition.md`, move national share of GDP into included scope and retain separate GDP explorer in excluded scope.

In `DESIGN.md`, replace only main multi-year explorer statements:

```text
% მშპ-ში = selected national budget series divided by same-year nominal GDP.
```

Update table/KPI/URL examples to `share_of_gdp` while explicitly retaining:

```text
Single-year analysis shares remain shares of the selected budget side total.
Municipal shares remain shares of the applicable municipal public total.
```

- [ ] **Step 5: Add concise revenue/expenditure public disclosures**

Add one plain-language paragraph to each methodology article explaining that `% მშპ-ში` compares the budget fact with Geostat's same-year nominal GDP; mention the 2010 source-methodology handoff and 2025 preliminary status. Do not create a GDP catalog entry or route.

- [ ] **Step 6: Run methodology and route tests**

```powershell
npm.cmd test -- tests/methodology/catalog.test.ts
npm.cmd run test:browser -- tests/browser/methodology.spec.ts
```

Expected: articles mention GDP; `/methodology/gdp` remains 404; GDP future marker remains non-clickable.

- [ ] **Step 7: Commit canonical documentation**

```powershell
git add -- ../../Project_Definition.md ../../DESIGN.md ../../docs/data-methodology/national-nominal-gdp.md ../../docs/data-methodology/revenue-methodology.md ../../docs/data-methodology/treasury-functional-expenditure-methodology-2004-2025.md lib/methodology/content/expenditure.ts lib/methodology/content/revenue.ts tests/methodology/catalog.test.ts tests/browser/methodology.spec.ts
git commit -m "docs: define national GDP share methodology"
```

---

### Task 7: Run complete verification and review the bounded diff

**Files:**
- Verify: all changed files from Tasks 1–6.
- Modify only if a verification failure directly traces to this feature.

**Interfaces:**
- Consumes: completed implementation.
- Produces: local source, unit, data, build, browser, and Git evidence suitable for review and later GitHub delivery.

- [ ] **Step 1: Prove generated artifacts are current and deterministic**

```powershell
npm.cmd run data:check-national-gdp
git status --short
```

Expected: GDP check passes and no generator-induced diff appears.

- [ ] **Step 2: Run the full required application check**

```powershell
npm.cmd run check
```

Expected: lint, strict TypeScript, all Vitest tests, general data validation, GDP fixed-point validation, and methodology archive validation PASS.

- [ ] **Step 3: Run the production CSV-mode build**

```powershell
Remove-Item Env:GEODATA_DATA_SOURCE -ErrorAction SilentlyContinue
npm.cmd run build
```

Expected: static production build PASS; `/explorer/expenditure` and `/explorer/revenue` are generated; no GDP explorer or methodology route is generated.

- [ ] **Step 4: Run the complete browser suite**

```powershell
npm.cmd run test:browser
```

Expected: all desktop/mobile explorer, municipality, methodology, landing, and visual-reference tests PASS with no console errors.

- [ ] **Step 5: Inspect the user-visible behavior in both national routes**

Verify at desktop and mobile widths:

```text
/explorer/expenditure
/explorer/revenue
/explorer/expenditure#m=table&sh=1&r=2005-2025&sel=expenditure.total,spending.health
/explorer/revenue#m=table&sh=1&r=2005-2025&sel=revenue.total,revenue.vat
```

Confirm `% მშპ-ში`, non-100% total ratios, `წილი მშპ-ში 2025`, the GDP-share KPI, honest chart gaps if a test fixture lacks GDP, working CSV download, stable `sh=1`, and no layout/console problems.

- [ ] **Step 6: Explicitly inspect unchanged boundaries**

Verify:

```text
/explorer/analysis — composition shares and Every 100 GEL unchanged
/explorer/municipalities — municipal % share copy and calculations unchanged
/methodology/gdp — 404
GDP future marker — plain non-clickable content
```

- [ ] **Step 7: Review the diff for scope and sensitive data**

```powershell
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
git status --short --branch
git log --oneline --decorate origin/main..HEAD
```

Confirm every changed line traces to GDP preservation, serving, ratio behavior, reproducible export, or required documentation; confirm no `.env`, credential, unrelated refactor, GDP page, or municipal behavior change is present.

- [ ] **Step 8: Run the project-required review skill and fix only confirmed findings**

Use `superpowers:requesting-code-review`. Address any actionable finding with its own focused regression test, rerun the affected focused checks, then rerun `npm.cmd run check`, `npm.cmd run build`, and `npm.cmd run test:browser` after the last code change.

- [ ] **Step 9: Commit any verification-only corrections**

If verification required a correction:

```powershell
git add -- <only-the-feature-files-corrected>
git commit -m "fix: complete GDP share verification"
```

If no correction was required, do not create an empty commit.

- [ ] **Step 10: Stop at verified branch state unless GitHub delivery is authorized**

Report exact branch, commits, clean/dirty state, checks run, DB-mode verification status, and any unverified boundary. Publishing follows the repository sequence only when authorized:

```text
codex/* branch -> push -> draft PR -> required CI -> review/resolved conversations -> merge -> delete branch -> deployment -> live verification
```
