# Municipal Population and Regional GDP Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a source-preserved research package containing Geostat municipal population for 2015-2025 and total regional GDP at current prices for the maximum official period available within 2005-2025.

**Architecture:** Preserve the two official XLSX files unchanged, then use one testable TypeScript package builder to map their geographic labels, normalize only the approved measures, generate human-review CSV/XLSX artifacts, and emit a fail-closed validation report. Keep the package under `docs/Raw Data/Municipalities/`; do not connect it to `data/imports`, Prisma, application loaders, routes, or UI.

**Tech Stack:** PowerShell source capture, Geostat XLSX files, TypeScript strict mode, `xlsx` 0.18.5, `csv-parse` 6.2.1, Node cryptography/filesystem APIs, Vitest 4.1.5, Markdown methodology.

## Global Constraints

- Municipality population coverage is exactly 2015-2025 for the 64 rows in `data/imports/municipalities.csv`.
- Excluded municipality codes are exactly `05`, `42`, `43`, `46`, and `64`.
- Regional output contains total GDP at current prices only; no activity breakdown, municipality GDP, GVA proxy, or per-capita calculation.
- Regional years are every official workbook year within 2005-2025; never assume the workbook starts in 2005 or ends in 2025.
- Missing, blank, suppressed, unavailable, or non-numeric source cells are documented and never estimated or converted to zero.
- Original workbooks are immutable after capture; every preserved file has its exact retrieved URL, retrieval date, byte size, and SHA-256 hash.
- Human-facing CSVs use UTF-8 with BOM; application-internal encoding conventions remain unchanged.
- No changes to `Project_Definition.md`, `DESIGN.md`, `AGENTS.md`, `data/imports`, Prisma, database state, routes, or UI.
- Canonical design: `docs/superpowers/specs/2026-08-03-municipal-population-regional-gdp-collection-design.md`.

## File Structure

- `apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts` — workbook parsing, explicit geography joins, normalization, source reconciliation, artifact serialization, and validation-report construction.
- `apps/web/scripts/prepare-geostat-municipal-indicators.ts` — thin CLI invoking the package builder and printing observed coverage/counts.
- `apps/web/tests/data/municipalIndicators/geostatPackage.test.ts` — artifact schemas, coverage, geography, encoding, source hashes, reconciliation, XLSX parity, and no-estimation contract.
- `apps/web/package.json` — one `data:prepare-municipal-indicators` script.
- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/*.xlsx` — immutable official captures.
- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/geography-map.csv` — reviewed one-to-one source-label crosswalk.
- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/*.csv|*.xlsx|*.json|README.md` — reviewed research outputs and provenance.
- `docs/data-methodology/municipal-population-regional-gdp.md` — canonical collection, definition, transformation, gap, and rerun methodology.

---

### Task 1: Capture and structurally audit the official Geostat workbooks

**Files:**
- Create: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx`
- Create: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/regional-GDP-ENG.xlsx`

**Interfaces:**
- Consumes: the approved Geostat source pages and direct XLSX URLs in the design.
- Produces: two immutable source captures whose sheet names, used ranges, units, year columns, footnotes, hashes, and byte sizes are known before parser code is written.

- [ ] **Step 1: Create the official-source directory**

Run from repository root:

```powershell
New-Item -ItemType Directory -Force 'docs\Raw Data\Municipalities\geostat-population-regional-gdp\official'
```

Expected: the directory exists and no other raw-data directory changes.

- [ ] **Step 2: Download the municipal-population workbook from Geostat**

```powershell
Invoke-WebRequest -Uri 'https://geostat.ge/media/78356/01-population-by-self-governed-unit.xlsx' -OutFile 'docs\Raw Data\Municipalities\geostat-population-regional-gdp\official\01-population-by-self-governed-unit.xlsx'
```

Expected: HTTP success and a non-empty XLSX file beginning with ZIP signature bytes `50 4B 03 04`.

- [ ] **Step 3: Download the regional-GDP workbook from Geostat**

```powershell
Invoke-WebRequest -Uri 'https://geostat.ge/media/79752/regional-GDP-ENG.xlsx' -OutFile 'docs\Raw Data\Municipalities\geostat-population-regional-gdp\official\regional-GDP-ENG.xlsx'
```

Expected: HTTP success and a non-empty XLSX file beginning with ZIP signature bytes `50 4B 03 04`.

- [ ] **Step 4: Record hashes, sizes, workbook sheets, ranges, and representative rows**

```powershell
Get-FileHash -Algorithm SHA256 'docs\Raw Data\Municipalities\geostat-population-regional-gdp\official\*.xlsx'
```

```powershell
Get-Item 'docs\Raw Data\Municipalities\geostat-population-regional-gdp\official\*.xlsx' | Select-Object Name,Length,LastWriteTimeUtc
```

Run from `apps/web`:

```powershell
node -e "const XLSX=require('xlsx');const path=require('path');for(const name of ['01-population-by-self-governed-unit.xlsx','regional-GDP-ENG.xlsx']){const file=path.resolve('../..','docs/Raw Data/Municipalities/geostat-population-regional-gdp/official',name);const wb=XLSX.readFile(file,{cellDates:false});console.log(name,wb.SheetNames);for(const sheet of wb.SheetNames){const ws=wb.Sheets[sheet];console.log(sheet,ws['!ref']);console.log(XLSX.utils.sheet_to_json(ws,{header:1,raw:false,blankrows:false}).slice(0,12));}}"
```

Expected: exact sheet names and workbook structure are visible. Record the population sheet/label column/unit/year columns and the GDP sheet/region column/unit/year columns in the Task 4 README; do not infer them from filenames.

- [ ] **Step 5: Verify source capture only changed the two intended files**

```powershell
git status --short
```

Expected: only the two official XLSX paths are new, in addition to the already committed spec and plan history.

- [ ] **Step 6: Commit the immutable source captures**

```powershell
git add -- 'docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx' 'docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/regional-GDP-ENG.xlsx'
git commit -m "data: preserve Geostat population and regional GDP sources"
```

### Task 2: Lock the research-package contract with failing tests

**Files:**
- Create: `apps/web/tests/data/municipalIndicators/geostatPackage.test.ts`

**Interfaces:**
- Consumes: the two official workbooks, `data/imports/municipalities.csv`, and `data/taxonomy/municipal-regions.json`.
- Produces: a regression contract for `buildGeostatPackage(): Promise<GeostatPackageBuild>` and every required package artifact.

- [ ] **Step 1: Write the failing population and geography contract**

Create the test file with imports and constants:

```ts
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { buildGeostatPackage } from "../../../lib/data/municipalIndicators/prepareGeostatPackage";

const repoRoot = path.resolve(process.cwd(), "../..");
const packageDir = path.join(
  repoRoot,
  "docs/Raw Data/Municipalities/geostat-population-regional-gdp",
);
const POPULATION_YEARS = Array.from({ length: 11 }, (_, index) => 2015 + index);
const EXCLUDED_CODES = new Set(["05", "42", "43", "46", "64"]);

describe("Geostat population and regional GDP research package", () => {
  it("builds a complete 64 x 11 municipal population panel", async () => {
    const result = await buildGeostatPackage({ write: false });
    const keys = result.populationRows.map(
      (row) => `${row.year}:${row.municipality_code}`,
    );

    expect(result.populationRows).toHaveLength(64 * 11);
    expect(new Set(result.populationRows.map((row) => row.year))).toEqual(
      new Set(POPULATION_YEARS),
    );
    expect(new Set(keys).size).toBe(64 * 11);
    expect(
      result.populationRows.filter((row) => EXCLUDED_CODES.has(row.municipality_code)),
    ).toEqual([]);
    expect(
      result.populationRows.every(
        (row) =>
          row.population_thousand === null
            ? row.population_persons === null
            : row.population_thousand >= 0 &&
              row.population_persons === row.population_thousand * 1000,
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Add the maximum-available regional GDP contract**

Add a test that derives the expected bounded period from the preserved workbook and proves every in-window source year is emitted:

```ts
it("emits every available regional GDP year within 2005-2025", async () => {
  const result = await buildGeostatPackage({ write: false });
  const years = [...new Set(result.regionalGdpRows.map((row) => row.year))].sort(
    (left, right) => left - right,
  );

  expect(years).toEqual(result.validation.regionalGdp.observedYears);
  expect(years.length).toBeGreaterThan(0);
  expect(years[0]).toBeGreaterThanOrEqual(2005);
  expect(years.at(-1)).toBeLessThanOrEqual(2025);
  expect(result.regionalGdpRows).toHaveLength(years.length * 11);

  for (const year of years) {
    expect(
      new Set(
        result.regionalGdpRows
          .filter((row) => row.year === year)
          .map((row) => row.region_id),
      ).size,
    ).toBe(11);
  }
});
```

- [ ] **Step 3: Add artifact, provenance, encoding, and XLSX parity tests**

Add tests asserting:

```ts
const excelCsvFiles = [
  "source-manifest.csv",
  "geography-map.csv",
  "municipal-population-annual-2015-2025.csv",
  "regional-gdp-annual-2005-2025-available-years.csv",
];

for (const fileName of excelCsvFiles) {
  const bytes = fs.readFileSync(path.join(packageDir, fileName));
  expect([...bytes.subarray(0, 3)], fileName).toEqual([0xef, 0xbb, 0xbf]);
}

const report = JSON.parse(
  fs.readFileSync(path.join(packageDir, "validation-report.json"), "utf8"),
);
expect(report.status).toMatch(/^complete(_with_official_gaps)?$/);
expect(report.estimates_created).toBe(0);
expect(report.excluded_codes_present).toEqual([]);
expect(report.source_hashes_match).toBe(true);
expect(report.normalized_values_reconcile).toBe(true);
```

Also open `municipal-population-and-regional-gdp.xlsx` with `xlsx`, assert sheet names exactly `Read me`, `Population`, `Regional GDP`, and `Geography map`, and assert sheet data-row counts equal the two CSVs and `geography-map.csv`.

- [ ] **Step 4: Run the focused test and verify RED**

Run from `apps/web`:

```powershell
npm test -- tests/data/municipalIndicators/geostatPackage.test.ts
```

Expected: FAIL because `prepareGeostatPackage` and normalized package artifacts do not exist.

- [ ] **Step 5: Commit the failing contract**

```powershell
git add -- 'apps/web/tests/data/municipalIndicators/geostatPackage.test.ts'
git commit -m "test: define municipal indicator package contract"
```

### Task 3: Implement the minimal workbook normalizer and package builder

**Files:**
- Create: `apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts`
- Create: `apps/web/scripts/prepare-geostat-municipal-indicators.ts`
- Modify: `apps/web/package.json`
- Create: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/geography-map.csv`
- Create: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/source-manifest.csv`
- Generate: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/municipal-population-annual-2015-2025.csv`
- Generate: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/regional-gdp-annual-2005-2025-available-years.csv`
- Generate: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/municipal-population-and-regional-gdp.xlsx`
- Generate: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/validation-report.json`

**Interfaces:**
- Consumes: the two preserved workbooks; the reviewed `source-manifest.csv` and `geography-map.csv`; the canonical municipality and region files.
- Produces: `buildGeostatPackage(options: { write: boolean }): Promise<GeostatPackageBuild>` and deterministic human-review artifacts.

- [ ] **Step 1: Define strict row and report types**

Start the module with these public interfaces:

```ts
export type PopulationRow = {
  year: number;
  municipality_code: string;
  municipality_name_ka: string;
  region_id: string;
  population_thousand: number | null;
  population_persons: number | null;
  reference_date: string;
  source_id: "geostat_population_self_governed_units";
  source_sheet: string;
  source_unit: string;
  transformation: string;
  last_reviewed_at: string;
};

export type RegionalGdpRow = {
  year: number;
  region_id: string;
  region_name_ka: string;
  source_region_label: string;
  gdp_current_prices_million_gel: number | null;
  source_id: "geostat_regional_gdp_current_prices";
  source_sheet: string;
  source_unit: string;
  status: string;
  transformation: string;
  last_reviewed_at: string;
};

export type GeographyMapRow = {
  geography_level: "municipality" | "region";
  source_label: string;
  source_label_normalized: string;
  geodata_id: string;
  display_name_ka: string;
  region_id: string;
  mapping_status: "exact" | "reviewed_alias";
  mapping_note: string;
};

export type Gap = {
  dataset: "population" | "regional_gdp";
  geography_id: string;
  year: number;
  source_cell_state: "blank" | "suppressed" | "unavailable" | "non_numeric";
  source_cell: string;
};

export class OfficialGapError extends Error {
  constructor(
    public readonly context: string,
    public readonly sourceCellState: Gap["source_cell_state"],
  ) {
    super(`Official source gap at ${context}: ${sourceCellState}`);
  }
}

export type GeostatPackageBuild = {
  populationRows: PopulationRow[];
  regionalGdpRows: RegionalGdpRow[];
  geographyRows: GeographyMapRow[];
  validation: ValidationReport;
};

export async function buildGeostatPackage(
  options: { write: boolean } = { write: true },
): Promise<GeostatPackageBuild>;
```

Use the retrieval/review date actually recorded during Task 1 as a single module constant. Do not call the clock during generation, so repeated runs remain byte-identical.

- [ ] **Step 2: Create the fixed source manifest and complete geography crosswalk**

Create `source-manifest.csv` from the exact Task 1 evidence. Give it two rows with the approved columns, exact retrieved URLs, Asia/Tbilisi retrieval date, uppercase SHA-256 hashes, byte sizes, complete source coverage, normalized coverage, and notes. Treat it as reviewed provenance input: subsequent generator runs read and verify it but do not rewrite it.

Populate `geography-map.csv` with all source labels observed in Task 1:

- 64 `municipality` rows mapped to the exact codes in `data/imports/municipalities.csv`;
- 11 `region` rows mapped to the exact IDs in `data/taxonomy/municipal-regions.json`;
- `mapping_status=exact` for identical labels and `mapping_status=reviewed_alias` plus a plain-language `mapping_note` for label variants;
- no fuzzy-score field and no row for codes `05`, `42`, `43`, `46`, or `64`.

Write the CSV with a UTF-8 BOM. Load it with `csv-parse` using `bom: true`, and fail if a duplicate source label or duplicate GeoData ID exists within either geography level.

- [ ] **Step 3: Parse only the approved population cells**

Using the exact sheet, header row, label column, unit, and year columns observed in Task 1:

```ts
const POPULATION_YEARS = Array.from({ length: 11 }, (_, index) => 2015 + index);
const EXCLUDED_CODES = new Set(["05", "42", "43", "46", "64"]);

function requireSourceNumber(value: unknown, context: string): number {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new OfficialGapError(context, "blank");
  }
  const normalized = String(value).replace(/\s/g, "").replace(/,/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Invalid nonnegative source number at ${context}: ${String(value)}`);
  }
  return number;
}
```

Select each requested year explicitly, join every source municipality label through `geography-map.csv`, retain the source-reported thousand-person precision, set `population_persons = population_thousand * 1000`, and emit rows sorted by year then municipality code. Catch `OfficialGapError` only to emit `null` for both population fields and record a typed gap; CSV serialization writes those nulls as empty cells and never substitutes zero.

- [ ] **Step 4: Parse every available in-window total regional GDP column**

Discover year columns from the audited GDP header, filter with `year >= 2005 && year <= 2025`, and prove no filtered source year is skipped. Join the 11 region labels through the crosswalk. Exclude national totals and source-only residual rows from normalized output while retaining them in the reconciliation section of the validation report.

Use an exact, documented scale conversion only when the workbook unit is not already million GEL:

```ts
function toMillionGel(value: number, sourceUnit: string): number {
  if (sourceUnit === "million GEL") return value;
  if (sourceUnit === "thousand GEL") return value / 1000;
  if (sourceUnit === "GEL") return value / 1_000_000;
  throw new Error(`Unsupported regional GDP unit: ${sourceUnit}`);
}
```

- [ ] **Step 5: Build fail-closed validation and deterministic serializers**

Validation must calculate and expose:

```ts
type ValidationReport = {
  status: "complete" | "complete_with_official_gaps" | "failed";
  population: { observedYears: number[]; rowCount: number; gaps: Gap[] };
  regionalGdp: {
    observedYears: number[];
    rowCount: number;
    gaps: Gap[];
    nationalReconciliation: Array<{
      year: number;
      published_total_million_gel: number | null;
      regional_sum_million_gel: number;
      difference_million_gel: number | null;
    }>;
  };
  estimates_created: 0;
  excluded_codes_present: string[];
  source_hashes_match: boolean;
  normalized_values_reconcile: boolean;
};
```

Ensure all four human-facing CSVs use `"\uFEFF" + rows.join("\n") + "\n"`. The package builder writes the two normalized data CSVs and reads the reviewed manifest/crosswalk without rewriting them. Escape generated fields with the existing `csvEscape` helper. Generate the four-sheet review workbook from the exact same in-memory normalized rows and reviewed geography rows. Hash the preserved sources at generation time and compare them to the fixed manifest values.

- [ ] **Step 6: Add the CLI and package script**

Create the thin runner:

```ts
import { buildGeostatPackage } from "../lib/data/municipalIndicators/prepareGeostatPackage";

async function main() {
  const result = await buildGeostatPackage({ write: true });
  console.log(`Population rows: ${result.populationRows.length}`);
  console.log(`Regional GDP rows: ${result.regionalGdpRows.length}`);
  console.log(`Regional GDP years: ${result.validation.regionalGdp.observedYears.join(", ")}`);
  console.log(`Validation: ${result.validation.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add to `apps/web/package.json`:

```json
"data:prepare-municipal-indicators": "tsx scripts/prepare-geostat-municipal-indicators.ts"
```

- [ ] **Step 7: Generate the package twice and prove a fixed point**

Run from `apps/web`:

```powershell
npm run data:prepare-municipal-indicators
```

```powershell
npm run data:prepare-municipal-indicators
```

```powershell
git diff --check
```

Expected: both runs report identical population/GDP counts and years; the second run creates no content drift; `git diff --check` passes.

- [ ] **Step 8: Run the focused test and verify GREEN**

```powershell
npm test -- tests/data/municipalIndicators/geostatPackage.test.ts
```

Expected: PASS for coverage, geography, hashes, encoding, reconciliation, XLSX parity, and zero estimates.

- [ ] **Step 9: Commit the normalizer and generated research artifacts**

```powershell
git add -- 'apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts' 'apps/web/scripts/prepare-geostat-municipal-indicators.ts' 'apps/web/package.json' 'docs/Raw Data/Municipalities/geostat-population-regional-gdp'
git commit -m "data: prepare municipal population and regional GDP package"
```

### Task 4: Document definitions, observed coverage, transformations, and gaps

**Files:**
- Create: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/README.md`
- Create: `docs/data-methodology/municipal-population-regional-gdp.md`

**Interfaces:**
- Consumes: the source audit, manifest, geography crosswalk, normalized outputs, workbook footnotes, and validation report.
- Produces: a reviewer-facing package guide and canonical rerun methodology with exact observed facts rather than planned ranges.

- [ ] **Step 1: Write the package README from observed evidence**

Include these exact sections:

```markdown
# Geostat municipal population and regional GDP research package

## Scope and exclusions
## Files and how to review them
## Official sources and retrieval
## Population definition and coverage
## Regional GDP definition and coverage
## Geography mapping
## Transformations and units
## Validation and reconciliation
## Gaps and source limitations
## No-estimation and no-UI statement
```

Populate each section with the exact workbook titles, sheet names, units, source/full coverage, normalized coverage, preliminary/revised notes, retrieved URLs, retrieval date, hashes, counts, gap rows, and reconciliation differences observed in Tasks 1 and 3. State explicitly that the old MoF portal population column is unused.

- [ ] **Step 2: Write the canonical methodology and rerun procedure**

Document:

- why Geostat is authoritative for both measures;
- the exact as-of date for population and current-price definition for regional GDP;
- how the 64 municipality and 11 region mappings were reviewed;
- every exact transformation, including unit scaling;
- how official gaps differ from zeros;
- how source hashes, value reconciliation, encoding, and XLSX/CSV parity are checked;
- the rerun sequence `npm run data:prepare-municipal-indicators`, focused test, `npm run check`, and `npm run build`;
- that the package is research-only and deliberately absent from `data/imports` and the UI.

- [ ] **Step 3: Cross-check documentation against machine artifacts**

Run from repository root:

```powershell
Select-String -Path 'docs\Raw Data\Municipalities\geostat-population-regional-gdp\README.md','docs\data-methodology\municipal-population-regional-gdp.md' -Pattern 'municipality GDP|proxy|estimate|population as of|current prices|source-manifest|validation-report'
```

Expected: the documents clearly exclude municipal GDP/proxies/estimates and name both definitions and audit artifacts. Manually compare every reported count/year/hash with `source-manifest.csv` and `validation-report.json`.

- [ ] **Step 4: Run the focused test after documentation**

```powershell
npm test -- tests/data/municipalIndicators/geostatPackage.test.ts
```

Expected: PASS; documentation edits do not alter generated package parity.

- [ ] **Step 5: Commit the methodology and handoff**

```powershell
git add -- 'docs/Raw Data/Municipalities/geostat-population-regional-gdp/README.md' 'docs/data-methodology/municipal-population-regional-gdp.md'
git commit -m "docs: document municipal population and regional GDP data"
```

### Task 5: Run complete verification and inspect the final scope

**Files:**
- Verify only; edit only if a verification failure traces to this task's files.

**Interfaces:**
- Consumes: the completed research package, generator, tests, and documentation.
- Produces: final evidence that the package is reproducible, source-backed, complete to the official coverage boundary, and isolated from the application.

- [ ] **Step 1: Rebuild the package and run the focused test**

Run from `apps/web`:

```powershell
npm run data:prepare-municipal-indicators
```

```powershell
npm test -- tests/data/municipalIndicators/geostatPackage.test.ts
```

Expected: deterministic regeneration and focused PASS.

- [ ] **Step 2: Run the repository check gate**

```powershell
npm run check
```

Expected: lint, TypeScript, all unit tests, and existing data validation PASS.

- [ ] **Step 3: Run the CSV-mode production build**

```powershell
npm run build
```

Expected: PASS. No browser test is required because no application or UI behavior changes.

- [ ] **Step 4: Inspect the final diff and scope boundaries**

Run from repository root:

```powershell
git status --short
```

```powershell
git diff --check HEAD~4..HEAD
```

```powershell
git diff --name-only HEAD~4..HEAD
```

Expected: changes are limited to the approved spec/plan, the new research package, the focused generator/test/script, `apps/web/package.json`, and the matching methodology. No `data/imports`, Prisma, database, route, component, `Project_Definition.md`, `DESIGN.md`, or `AGENTS.md` file changes.

- [ ] **Step 5: Verify final coverage directly from artifacts**

Read `validation-report.json` and report:

- exact population row count, municipality count, and 2015-2025 sequence;
- exact regional GDP year range and row count;
- all gaps by dataset/year/geography;
- national/regional reconciliation differences;
- source hashes and normalized reconciliation status;
- `estimates_created = 0` and no excluded codes.

- [ ] **Step 6: Commit any verification-only fixes, or record a clean verification**

If verification required changes limited to this task's files:

```powershell
git add -- 'apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts' 'apps/web/scripts/prepare-geostat-municipal-indicators.ts' 'apps/web/tests/data/municipalIndicators/geostatPackage.test.ts' 'apps/web/package.json' 'docs/Raw Data/Municipalities/geostat-population-regional-gdp' 'docs/data-methodology/municipal-population-regional-gdp.md'
git commit -m "test: finalize municipal indicator package verification"
```

If no changes were needed, do not create an empty commit. Record the command results in the final handoff.
