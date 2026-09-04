# General Government Deficit Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the reviewed IMF April 2026 WEO source and generate a deterministic, validated 1995-2031 Georgia general-government balance dataset containing only percentage of GDP and nominal GEL.

**Architecture:** A focused `generalGovernmentBalance` data module reads the immutable IMF workbook, validates the dataset metadata and three necessary source series, and emits a source-preserving staging CSV, a two-statistic canonical CSV, and a validation report. A strict canonical loader and the existing `data:validate` command enforce coverage, sign, units, status, provenance, and source registration without adding a page, database model, or served-data path.

**Tech Stack:** TypeScript, Node.js, SheetJS `xlsx`, `csv-parse`, Zod, Decimal.js, Vitest, deterministic CSV/JSON artifacts.

**Spec:** `docs/superpowers/specs/2026-09-04-general-government-deficit-data-design.md`

## Global Constraints

- Public data scope is exactly two statistics: general-government balance as percent of GDP and nominal GEL.
- Canonical source is IMF April 2026 WEO dataset `IMF.RES:WEO(9.0.0)`.
- Selected source series are `GEO.GGXCNL_NGDP.A` and `GEO.GGXCNL.A`; `GEO.NGDP_FY.A` is validation-only.
- Preserve signed values: negative is deficit, positive is surplus, zero is balanced.
- Coverage is every year 1995-2031: 1995-2025 actual and 2026-2031 projection.
- Nominal source values are billions of GEL and convert to GEL by multiplying by `1_000_000_000`.
- Percentage reconciliation tolerance is `0.02` percentage points using IMF fiscal-year GDP.
- Preserve the source workbook at exactly `5,585,205` bytes and SHA-256 `B29239CB48F8B895D1E526070C4FDE01147BC8F6BD3B86F636363BB6BD87FE7A`.
- No UI, route, navigation, database schema, Prisma migration, public API, quarterly data, or additional fiscal statistic is part of this plan.
- All generated files must reach a deterministic byte-for-byte fixed point.

---

## File structure

| File | Responsibility |
| --- | --- |
| `docs/Raw Data/Deficit/imf-weo-general-government-balance/official/WEOApr2026all.xlsx` | Immutable reviewed IMF source workbook. |
| `docs/Raw Data/Deficit/imf-weo-general-government-balance/source-manifest.csv` | Machine-readable source URL, dataset version, file hash, size, series, coverage, and review date. |
| `docs/Raw Data/Deficit/imf-weo-general-government-balance/README.md` | Human-readable source-package scope and reproduction instructions. |
| `data/staging/general-government-balance-source-facts-1995-2031.csv` | Long-form exact extracts for the two balance series and validation-only fiscal-year GDP. |
| `data/imports/general-government-balance-annual-1995-2031.csv` | One canonical row per year with the two approved statistics and provenance. |
| `data/reports/general-government-balance-annual-1995-2031-validation.json` | Hash, coverage, status, sign, and percentage-reconciliation evidence. |
| `apps/web/lib/data/generalGovernmentBalance/types.ts` | Source, canonical, status, and validation contracts. |
| `apps/web/lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.ts` | Workbook validation, extraction, normalization, validation, and deterministic artifact generation. |
| `apps/web/lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts` | Strict canonical CSV loader used by repository validation. |
| `apps/web/scripts/prepare-general-government-balance.ts` | `--write` and `--check` command wrapper. |
| `apps/web/tests/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.test.ts` | Source, extraction, status, coverage, value-pin, and reconciliation tests. |
| `apps/web/tests/data/generalGovernmentBalance/importGeneralGovernmentBalance.test.ts` | Canonical loader success and rejection tests. |
| `apps/web/tests/fixtures/general-government-balance/duplicate-year.csv` | Duplicate-year failure fixture. |
| `apps/web/tests/fixtures/general-government-balance/sign-mismatch.csv` | Percentage/nominal sign failure fixture. |
| `apps/web/scripts/validate-data-files.ts` | Loads the new canonical file and checks source registration. |
| `apps/web/package.json` | Preparation/check commands and `data:validate` integration. |
| `data/sources/source-documents.csv` | Registers the IMF source ID used by canonical rows. |
| `docs/data-methodology/general-government-balance.md` | Publicly auditable definition, source, coverage, statuses, units, revisions, and limitations. |
| `Project_Definition.md` | Records the approved data-only package without implying that a deficit page exists. |

---

### Task 1: Preserve the IMF workbook and generate reviewed data artifacts

**Files:**
- Create: `docs/Raw Data/Deficit/imf-weo-general-government-balance/official/WEOApr2026all.xlsx`
- Create: `docs/Raw Data/Deficit/imf-weo-general-government-balance/source-manifest.csv`
- Create: `data/staging/general-government-balance-source-facts-1995-2031.csv`
- Create: `data/imports/general-government-balance-annual-1995-2031.csv`
- Create: `data/reports/general-government-balance-annual-1995-2031-validation.json`
- Create: `apps/web/lib/data/generalGovernmentBalance/types.ts`
- Create: `apps/web/lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.ts`
- Create: `apps/web/scripts/prepare-general-government-balance.ts`
- Create: `apps/web/tests/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.test.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: the reviewed IMF workbook and `source-manifest.csv`.
- Produces: `prepareGeneralGovernmentBalance({ write: boolean, checkArtifacts?: boolean }): Promise<GeneralGovernmentBalancePreparationResult>`.
- Produces: `validateGeneralGovernmentBalanceSeries(sourceFacts, canonicalFacts): GeneralGovernmentBalanceValidationSummary`.
- Produces: deterministic staging, canonical, and validation-report artifacts.

- [ ] **Step 1: Copy and identify the reviewed IMF source**

Create the destination directory, copy the already-reviewed download, and verify it before writing the manifest:

```powershell
$source = 'C:\Users\Mylaptop\Downloads\WEOApr2026all.xlsx'
$destinationDirectory = 'docs\Raw Data\Deficit\imf-weo-general-government-balance\official'
$destination = Join-Path $destinationDirectory 'WEOApr2026all.xlsx'
New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
Copy-Item -LiteralPath $source -Destination $destination
Get-Item -LiteralPath $destination | Select-Object Length
Get-FileHash -Algorithm SHA256 -LiteralPath $destination
```

Expected: length `5585205`; hash `B29239CB48F8B895D1E526070C4FDE01147BC8F6BD3B86F636363BB6BD87FE7A`.

Create `source-manifest.csv` with one row and these exact fields:

```csv
source_id,publisher,dataset,dataset_version,publication_date,source_page_url,retrieved_file_url,retrieved_at,local_file,sha256,bytes,country_id,source_sheet,percent_series_code,nominal_series_code,validation_gdp_series_code,year_min,year_max,latest_actual_year,methodology,valuation,general_government_composition
source.imf_weo_april_2026_general_government_balance,International Monetary Fund,World Economic Outlook,IMF.RES:WEO(9.0.0),2026-04-14,https://data.imf.org/Datasets/WEO,https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx,2026-09-04,official/WEOApr2026all.xlsx,B29239CB48F8B895D1E526070C4FDE01147BC8F6BD3B86F636363BB6BD87FE7A,5585205,GEO,Countries,GEO.GGXCNL_NGDP.A,GEO.GGXCNL.A,GEO.NGDP_FY.A,1995,2031,2025,GFSM 2001,Cash,Central Government; Local Government
```

- [ ] **Step 2: Write the failing preparation tests**

Create `prepareGeneralGovernmentBalance.test.ts` with a single `beforeAll` source load so the 5.6 MB workbook is not parsed repeatedly:

```ts
import { beforeAll, describe, expect, it } from "vitest";

import {
  prepareGeneralGovernmentBalance,
  validateGeneralGovernmentBalanceSeries,
} from "../../../lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance";
import type { GeneralGovernmentBalancePreparationResult } from "../../../lib/data/generalGovernmentBalance/types";

describe("prepareGeneralGovernmentBalance", () => {
  let result: GeneralGovernmentBalancePreparationResult;

  beforeAll(async () => {
    result = await prepareGeneralGovernmentBalance({ write: false, checkArtifacts: false });
  }, 30_000);

  it("preserves the reviewed IMF workbook", () => {
    expect(result.validation.sourceBytes).toBe(5_585_205);
    expect(result.validation.sourceSha256).toBe(
      "B29239CB48F8B895D1E526070C4FDE01147BC8F6BD3B86F636363BB6BD87FE7A",
    );
    expect(result.validation.dataset).toBe("IMF.RES:WEO(9.0.0)");
  });

  it("extracts the exact three Georgia series", () => {
    expect(new Set(result.sourceFacts.map((row) => row.indicatorId))).toEqual(
      new Set(["GGXCNL_NGDP", "GGXCNL", "NGDP_FY"]),
    );
    expect(result.sourceFacts).toHaveLength(111);
  });

  it("creates one canonical row for every 1995-2031 year", () => {
    expect(result.canonicalFacts).toHaveLength(37);
    expect(result.canonicalFacts.map((row) => row.year)).toEqual(
      Array.from({ length: 37 }, (_, index) => 1995 + index),
    );
  });

  it("pins representative actual, surplus, crisis, and projection values", () => {
    const byYear = new Map(result.canonicalFacts.map((row) => [row.year, row]));
    expect(byYear.get(1995)).toMatchObject({
      generalGovernmentBalancePctGdp: -4.888,
      generalGovernmentBalanceGel: -123_000_000,
      status: "actual",
    });
    expect(byYear.get(2004)).toMatchObject({
      generalGovernmentBalancePctGdp: 3.592,
      generalGovernmentBalanceGel: 363_000_000,
      status: "actual",
    });
    expect(byYear.get(2020)).toMatchObject({
      generalGovernmentBalancePctGdp: -9.158,
      generalGovernmentBalanceGel: -4_559_000_000,
      status: "actual",
    });
    expect(byYear.get(2025)).toMatchObject({
      generalGovernmentBalancePctGdp: -1.455,
      generalGovernmentBalanceGel: -1_526_000_000,
      status: "actual",
    });
    expect(byYear.get(2026)).toMatchObject({
      generalGovernmentBalancePctGdp: -2.327,
      generalGovernmentBalanceGel: -2_672_000_000,
      status: "projection",
    });
  });

  it("reconciles nominal balance to percent of fiscal-year GDP", () => {
    expect(result.validation.reconciliationTolerancePercentagePoints).toBe(0.02);
    expect(result.validation.maximumReconciliationDifferencePercentagePoints).toBeCloseTo(
      0.0147828843,
      9,
    );
    expect(result.validation.reconciliationFailureYears).toEqual([]);
  });

  it("rejects a coverage gap and a status-boundary change", () => {
    expect(() =>
      validateGeneralGovernmentBalanceSeries(result.sourceFacts, result.canonicalFacts.slice(1)),
    ).toThrow("Canonical general-government balance coverage must be 1995-2031");
    expect(() =>
      validateGeneralGovernmentBalanceSeries(
        result.sourceFacts,
        result.canonicalFacts.map((row) =>
          row.year === 2026 ? { ...row, status: "actual" as const } : row,
        ),
      ),
    ).toThrow("General-government balance status is invalid for 2026");
  });
});
```

- [ ] **Step 3: Run the focused test and confirm the expected failure**

Run from `apps/web`:

```powershell
npm.cmd test -- tests/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.test.ts
```

Expected: FAIL because the `generalGovernmentBalance` preparation module and types do not exist.

- [ ] **Step 4: Define the data contracts**

Create `types.ts` with these exact public interfaces:

```ts
export type GeneralGovernmentBalanceStatus = "actual" | "projection";
export type GeneralGovernmentBalanceIndicatorId = "GGXCNL_NGDP" | "GGXCNL" | "NGDP_FY";

export type GeneralGovernmentBalanceSourceFact = {
  year: number;
  indicatorId: GeneralGovernmentBalanceIndicatorId;
  seriesCode: string;
  value: number;
  unit: "Percent" | "Domestic currency";
  scale: "Units" | "Billions";
  status: GeneralGovernmentBalanceStatus;
  sourceId: string;
  sourceSheet: "Countries";
  sourceCell: string;
};

export type GeneralGovernmentBalanceFact = {
  year: number;
  generalGovernmentBalancePctGdp: number;
  generalGovernmentBalanceGel: number;
  status: GeneralGovernmentBalanceStatus;
  sourceId: string;
  sourceDataset: "IMF.RES:WEO(9.0.0)";
  sourceVintage: "2026-04";
  sourceSheet: "Countries";
  sourceCountryId: "GEO";
  sourcePercentSeriesCode: "GEO.GGXCNL_NGDP.A";
  sourceNominalSeriesCode: "GEO.GGXCNL.A";
  sourceUnit: "billion GEL";
  transformation: string;
  lastReviewedAt: "2026-09-04";
};

export type GeneralGovernmentBalanceValidationSummary = {
  maximumReconciliationDifferencePercentagePoints: number;
  reconciliationFailureYears: number[];
};

export type GeneralGovernmentBalanceValidationReport =
  GeneralGovernmentBalanceValidationSummary & {
    status: "PASS";
    dataset: "IMF.RES:WEO(9.0.0)";
    sourceBytes: 5585205;
    sourceSha256: string;
    sourceFactCount: 111;
    canonicalFactCount: 37;
    canonicalYearMin: 1995;
    canonicalYearMax: 2031;
    latestActualYear: 2025;
    firstProjectionYear: 2026;
    reconciliationTolerancePercentagePoints: 0.02;
  };

export type GeneralGovernmentBalancePreparationResult = {
  sourceFacts: GeneralGovernmentBalanceSourceFact[];
  canonicalFacts: GeneralGovernmentBalanceFact[];
  validation: GeneralGovernmentBalanceValidationReport;
};
```

- [ ] **Step 5: Implement strict workbook extraction and validation**

Create `prepareGeneralGovernmentBalance.ts`. Follow the existing national-GDP generator for path resolution, hashing, CSV serialization, write/check behavior, and `assertGeneratedArtifactMatches`. Read the `Countries` sheet with SheetJS, require exactly one `GEO` row for each target `INDICATOR.ID`, and validate each row's metadata before extracting 1995-2031.

Use these constants and metadata checks:

```ts
const EXPECTED_DATASET = "IMF.RES:WEO(9.0.0)" as const;
const EXPECTED_COUNTRY_ID = "GEO" as const;
const EXPECTED_SHEET = "Countries" as const;
const EXPECTED_LATEST_ACTUAL_YEAR = 2025;
const EXPECTED_YEARS = Array.from({ length: 37 }, (_, index) => 1995 + index);
const RECONCILIATION_TOLERANCE_PP = 0.02;
const SOURCE_ID = "source.imf_weo_april_2026_general_government_balance";
const REVIEWED_AT = "2026-09-04" as const;
const TRANSFORMATION = "IMF billion GEL multiplied by 1,000,000,000; signed value preserved.";

const TARGETS = {
  GGXCNL_NGDP: {
    seriesCode: "GEO.GGXCNL_NGDP.A",
    unit: "Percent",
    scale: "Units",
  },
  GGXCNL: {
    seriesCode: "GEO.GGXCNL.A",
    unit: "Domestic currency",
    scale: "Billions",
  },
  NGDP_FY: {
    seriesCode: "GEO.NGDP_FY.A",
    unit: "Domestic currency",
    scale: "Billions",
  },
} as const;
```

For `GGXCNL` and `GGXCNL_NGDP`, additionally require:

```ts
expectMetadata(row, "METHODOLOGY.ID", "Government Finance Statistics Manual (GFSM) 2001");
expectMetadata(row, "VALUATION", "Cash");
expectMetadata(row, "FISCAL_SECTOR_GENERAL_GOVERNMENT_COMPOSITION", "Central Government; Local Government");
expectMetadata(row, "PRIMARY_DOMESTIC_CURRENCY", "Georgian lari");
expectMetadata(row, "LATEST_ACTUAL_ANNUAL_DATA", "2025");
```

Convert the three wide source rows to 111 long-form facts. Record the exact source cell using the actual row and year-column positions from the worksheet; do not hardcode source row numbers.

Build each canonical row from the three same-year source facts:

```ts
const status = year <= EXPECTED_LATEST_ACTUAL_YEAR ? "actual" : "projection";
const balanceGel = nominalBillions * 1_000_000_000;
if (!Number.isSafeInteger(balanceGel)) {
  throw new Error(`General-government balance GEL value is not a safe integer for ${year}`);
}

return {
  year,
  generalGovernmentBalancePctGdp: percent,
  generalGovernmentBalanceGel: balanceGel,
  status,
  sourceId: SOURCE_ID,
  sourceDataset: EXPECTED_DATASET,
  sourceVintage: "2026-04",
  sourceSheet: EXPECTED_SHEET,
  sourceCountryId: EXPECTED_COUNTRY_ID,
  sourcePercentSeriesCode: "GEO.GGXCNL_NGDP.A",
  sourceNominalSeriesCode: "GEO.GGXCNL.A",
  sourceUnit: "billion GEL",
  transformation: TRANSFORMATION,
  lastReviewedAt: REVIEWED_AT,
};
```

Reconcile without replacing either IMF value:

```ts
const calculatedPercent = (nominalBillions / fiscalYearGdpBillions) * 100;
const difference = Math.abs(calculatedPercent - percent);
if (difference > RECONCILIATION_TOLERANCE_PP) reconciliationFailureYears.push(year);
```

The canonical CSV must use these headers in this order:

```text
year
general_government_balance_pct_gdp
general_government_balance_gel
status
source_id
source_dataset
source_vintage
source_sheet
source_country_id
source_percent_series_code
source_nominal_series_code
source_unit
transformation
last_reviewed_at
```

Use three decimal places for the percentage source value, an integer for GEL, and UTF-8 with BOM for both CSV artifacts.

- [ ] **Step 6: Add the command wrapper and package scripts**

Create `prepare-general-government-balance.ts`:

```ts
import { prepareGeneralGovernmentBalance } from "../lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-general-government-balance.ts --write|--check");
  }

  const write = args[0] === "--write";
  const result = await prepareGeneralGovernmentBalance({ write, checkArtifacts: true });
  console.log(
    `${write ? "Prepared" : "Validated"} ${result.canonicalFacts.length} general-government balance facts (${result.validation.canonicalYearMin}-${result.validation.canonicalYearMax}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add to `apps/web/package.json`:

```json
"data:prepare-general-government-balance": "tsx scripts/prepare-general-government-balance.ts --write",
"data:check-general-government-balance": "tsx scripts/prepare-general-government-balance.ts --check"
```

Do not add the check to `data:validate` until the generated files exist.

- [ ] **Step 7: Generate, verify the fixed point, and run focused tests**

Run from `apps/web`:

```powershell
npm.cmd run data:prepare-general-government-balance
npm.cmd test -- tests/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.test.ts
$artifacts = @(
  '..\..\data\staging\general-government-balance-source-facts-1995-2031.csv',
  '..\..\data\imports\general-government-balance-annual-1995-2031.csv',
  '..\..\data\reports\general-government-balance-annual-1995-2031-validation.json'
)
$before = $artifacts | ForEach-Object { (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash }
npm.cmd run data:prepare-general-government-balance
$after = $artifacts | ForEach-Object { (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash }
if (Compare-Object $before $after) { throw 'General-government balance artifacts are not deterministic' }
npm.cmd run data:check-general-government-balance
```

Expected: 37 canonical facts, 111 source facts, every focused test passing, the second generation producing no diff, and the check command succeeding without writing.

- [ ] **Step 8: Commit the source package and deterministic generator**

```powershell
git add -- '../../docs/Raw Data/Deficit/imf-weo-general-government-balance' '../../data/staging/general-government-balance-source-facts-1995-2031.csv' '../../data/imports/general-government-balance-annual-1995-2031.csv' '../../data/reports/general-government-balance-annual-1995-2031-validation.json' 'lib/data/generalGovernmentBalance' 'scripts/prepare-general-government-balance.ts' 'tests/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.test.ts' 'package.json'
git commit -m "feat: add reviewed IMF deficit dataset"
```

---

### Task 2: Add strict canonical loading and repository validation

**Files:**
- Create: `apps/web/lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts`
- Create: `apps/web/tests/data/generalGovernmentBalance/importGeneralGovernmentBalance.test.ts`
- Create: `apps/web/tests/fixtures/general-government-balance/duplicate-year.csv`
- Create: `apps/web/tests/fixtures/general-government-balance/sign-mismatch.csv`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/package.json`
- Modify: `data/sources/source-documents.csv`

**Interfaces:**
- Consumes: `data/imports/general-government-balance-annual-1995-2031.csv` and the existing source catalog.
- Produces: `loadGeneralGovernmentBalanceFacts(relativePath: string): Promise<GeneralGovernmentBalanceFact[]>`.
- Produces: `data:validate` failure for stale generated artifacts, malformed canonical rows, or missing source registration.

- [ ] **Step 1: Write failing canonical-loader tests and fixtures**

Create `importGeneralGovernmentBalance.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { loadGeneralGovernmentBalanceFacts } from "../../../lib/data/generalGovernmentBalance/importGeneralGovernmentBalance";

describe("loadGeneralGovernmentBalanceFacts", () => {
  it("loads exactly one fact for every 1995-2031 year", async () => {
    const rows = await loadGeneralGovernmentBalanceFacts(
      "../../data/imports/general-government-balance-annual-1995-2031.csv",
    );
    expect(rows).toHaveLength(37);
    expect(rows[0]?.year).toBe(1995);
    expect(rows.at(-1)?.year).toBe(2031);
    expect(rows.filter((row) => row.status === "actual")).toHaveLength(31);
    expect(rows.filter((row) => row.status === "projection")).toHaveLength(6);
  });

  it("rejects duplicate years", async () => {
    await expect(
      loadGeneralGovernmentBalanceFacts(
        "tests/fixtures/general-government-balance/duplicate-year.csv",
      ),
    ).rejects.toThrow("Duplicate general-government balance year");
  });

  it("rejects percentage and nominal values with different signs", async () => {
    await expect(
      loadGeneralGovernmentBalanceFacts(
        "tests/fixtures/general-government-balance/sign-mismatch.csv",
      ),
    ).rejects.toThrow("sign mismatch");
  });
});
```

Each fixture must use the full canonical header. The duplicate fixture repeats 1995 twice; the sign fixture uses `-4.888` percent with `123000000` GEL. All provenance columns use the exact constants from Task 1 so each test reaches the intended validation branch.

- [ ] **Step 2: Run the focused loader test and confirm the expected failure**

```powershell
npm.cmd test -- tests/data/generalGovernmentBalance/importGeneralGovernmentBalance.test.ts
```

Expected: FAIL because `loadGeneralGovernmentBalanceFacts` does not exist.

- [ ] **Step 3: Implement the strict loader**

Create `importGeneralGovernmentBalance.ts` using `readCsvRecords`, Zod, Decimal.js, and `stableIdSchema`, matching the national-GDP loader style.

The row schema must require the exact source contract:

```ts
const rowSchema = z.object({
  year: z.coerce.number().int().min(1995).max(2031),
  general_government_balance_pct_gdp: z.string().min(1),
  general_government_balance_gel: z.string().min(1),
  status: z.enum(["actual", "projection"]),
  source_id: stableIdSchema,
  source_dataset: z.literal("IMF.RES:WEO(9.0.0)"),
  source_vintage: z.literal("2026-04"),
  source_sheet: z.literal("Countries"),
  source_country_id: z.literal("GEO"),
  source_percent_series_code: z.literal("GEO.GGXCNL_NGDP.A"),
  source_nominal_series_code: z.literal("GEO.GGXCNL.A"),
  source_unit: z.literal("billion GEL"),
  transformation: z.string().min(1),
  last_reviewed_at: z.iso.date(),
});
```

For each parsed row:

```ts
const percent = new Decimal(row.general_government_balance_pct_gdp);
const gel = new Decimal(row.general_government_balance_gel);
if (!percent.isFinite() || !gel.isFinite()) throw new Error(`Non-finite general-government balance for ${row.year}`);
if (!gel.isInteger() || !Number.isSafeInteger(gel.toNumber())) {
  throw new Error(`General-government balance GEL value must be a safe integer for ${row.year}`);
}
if (!percent.isZero() && !gel.isZero() && percent.isNegative() !== gel.isNegative()) {
  throw new Error(`General-government balance sign mismatch for ${row.year}`);
}
const expectedStatus = row.year <= 2025 ? "actual" : "projection";
if (row.status !== expectedStatus) {
  throw new Error(`General-government balance status is invalid for ${row.year}`);
}
```

Reject duplicate years while parsing and require the final sorted year list to equal 1995-2031 exactly.

- [ ] **Step 4: Register the source and connect it to data validation**

Append one row to `data/sources/source-documents.csv`:

```csv
source.imf_weo_april_2026_general_government_balance,IMF WEO April 2026 general government net lending or borrowing for Georgia,docs/Raw Data/Deficit/imf-weo-general-government-balance/official/WEOApr2026all.xlsx,2026-09-04
```

In `scripts/validate-data-files.ts`, load the canonical facts near the existing national-GDP load:

```ts
const generalGovernmentBalanceFacts = await loadGeneralGovernmentBalanceFacts(
  "../../data/imports/general-government-balance-annual-1995-2031.csv",
);
```

After sources are loaded, require every general-government balance source ID to exist:

```ts
const registeredSourceIds = new Set(sources.map((row) => row.sourceId));
for (const sourceId of referencedSourceIds(generalGovernmentBalanceFacts)) {
  if (!registeredSourceIds.has(sourceId)) {
    throw new Error(`General-government balance source is not registered: ${sourceId}`);
  }
}
```

Import `referencedSourceIds` from `../lib/data/sources` and the new loader.

Update `data:validate` in `apps/web/package.json` so the new deterministic check runs immediately after national GDP:

```json
"data:validate": "tsx scripts/validate-data-files.ts && npm run data:check-national-gdp && npm run data:check-general-government-balance && npm run data:check-municipal-indicators && npm run data:check-municipal-population && npm run data:check-methodology-archives && npm run data:check-public-datasets"
```

- [ ] **Step 5: Run loader and integrated validation tests**

```powershell
npm.cmd test -- tests/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.test.ts tests/data/generalGovernmentBalance/importGeneralGovernmentBalance.test.ts
npm.cmd run data:validate
```

Expected: all focused tests pass; the IMF source is registered; generated artifacts are current; all pre-existing data checks remain green.

- [ ] **Step 6: Commit canonical loading and validation**

```powershell
git add -- 'lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts' 'tests/data/generalGovernmentBalance/importGeneralGovernmentBalance.test.ts' 'tests/fixtures/general-government-balance' 'scripts/validate-data-files.ts' 'package.json' '../../data/sources/source-documents.csv'
git commit -m "test: validate IMF deficit facts"
```

---

### Task 3: Document the dataset and verify the complete data-only change

**Files:**
- Create: `docs/Raw Data/Deficit/imf-weo-general-government-balance/README.md`
- Create: `docs/data-methodology/general-government-balance.md`
- Modify: `Project_Definition.md`

**Interfaces:**
- Consumes: the validated source package, generated artifacts, and commands from Tasks 1-2.
- Produces: clear source, definition, status, revision, and reproduction documentation with no implication that a public page already exists.

- [ ] **Step 1: Write the raw-source README**

Document:

- IMF April 2026 WEO as the sole canonical source;
- exact source workbook URL, bytes, SHA-256, dataset version, sheet, country ID, and series codes;
- `GGXCNL_NGDP` and `GGXCNL` as the only public measures;
- `NGDP_FY` as validation-only;
- 1995-2031 coverage and 2025 latest-actual cutoff;
- signed-value semantics;
- the `npm run data:prepare-general-government-balance` and `npm run data:check-general-government-balance` commands;
- the rule that new WEO vintages are archived and reviewed rather than silently replacing the current source.

- [ ] **Step 2: Write the methodology document**

Create `docs/data-methodology/general-government-balance.md` with these sections:

```markdown
# General government balance, 1995-2031

## Public meaning
## Canonical IMF source
## Government perimeter and accounting basis
## Coverage and actual/projection boundary
## Units and signed values
## Extraction and validation
## WEO revisions and limitations
## Reproduction
```

State plainly that WEO's `actual` boundary means non-projection, not that every early value is an untouched Georgian administrative observation. Explain that WEO may revise, splice, or estimate history for comparability. State that 2004's positive general-government balance is not interchangeable with the older state-budget deficit-financing presentation.

- [ ] **Step 3: Update the canonical scope owner**

In `Project_Definition.md` section 2, add one narrow included-data bullet:

```markdown
- Reviewed IMF WEO annual general-government balance data for 1995-2031: signed net lending/borrowing as percent of GDP and nominal GEL, with 1995-2025 marked actual and 2026-2031 marked projection. This data-only package does not itself create a route, page, navigation item, or additional fiscal statistic.
```

- [ ] **Step 4: Run documentation and deterministic-data checks**

From repository root:

```powershell
git diff --check
rg -n "T[B]D|T[O]DO|PLACE[H]OLDER" 'docs/Raw Data/Deficit/imf-weo-general-government-balance' 'docs/data-methodology/general-government-balance.md' 'Project_Definition.md'
```

Expected: `git diff --check` succeeds and the placeholder scan returns no matches.

From `apps/web`:

```powershell
npm.cmd run data:check-general-government-balance
npm.cmd test -- tests/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.test.ts tests/data/generalGovernmentBalance/importGeneralGovernmentBalance.test.ts
npm.cmd run data:validate
```

Expected: every command passes without changing generated artifacts.

- [ ] **Step 5: Run complete project verification**

From `apps/web`:

```powershell
npm.cmd run check
npm.cmd run build
```

Expected: lint, strict TypeScript, the full unit suite, all data validation, and the static production build pass. Database import is outside this data-only plan because no database model is added.

- [ ] **Step 6: Review the final diff for scope**

```powershell
git status --short
git diff --stat HEAD
git diff --name-only HEAD
```

Confirm that changed files are limited to the source package, deficit staging/canonical/report artifacts, focused preparation/loading code and tests, package validation wiring, source catalog, methodology, project scope, and the approved spec. Confirm there are no files under `apps/web/app`, `apps/web/components`, `apps/web/prisma`, or deployment configuration.

- [ ] **Step 7: Commit documentation and final verification state**

```powershell
git add -- '../../docs/Raw Data/Deficit/imf-weo-general-government-balance/README.md' '../../docs/data-methodology/general-government-balance.md' '../../Project_Definition.md'
git commit -m "docs: document IMF deficit methodology"
```

- [ ] **Step 8: Record final evidence**

```powershell
git status --short --branch
git log -4 --oneline --decorate
```

Expected: clean `codex/general-government-deficit-data` worktree containing the specification commit plus three focused implementation commits. Do not push, open a pull request, merge, deploy, or create a deficit page without separate authorization.
