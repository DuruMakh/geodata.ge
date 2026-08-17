# Municipal Budget per Capita Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolor the 2025 municipality map by budget per resident while keeping total budget primary in municipality and region lists and adding per-resident support values plus a median KPI.

**Architecture:** Promote the already-reviewed 2025 Geostat municipality population slice into a 64-row canonical served CSV and mirror it transactionally in Prisma/Supabase. Join population to 2025 public municipal totals in pure server-side explorer functions, then pass explicit total-budget and per-resident values to the existing static SVG map and list UI. Preserve all historical municipality explorers and all total-budget ranking behavior.

**Tech Stack:** Next.js 16 App Router, strict TypeScript, React 19, Prisma 7/PostgreSQL, Zod, Decimal.js, Vitest, Playwright, static CSV serving with parity-checked database mode.

## Global Constraints

- Only `year = 2025` and `reference_date = 2025-01-01` population rows enter the application serving contract.
- The denominator is `population_persons`; no estimates, interpolation, gap filling, or other years.
- Municipality budget per resident is `2025 public_total_gel / 2025 population_persons`.
- Region budget per resident is the already-displayed 2025 region total divided by the sum of member municipality populations; Adjara therefore uses its consolidated total.
- The Georgia aggregate row receives no per-resident value.
- Map colors, legend, primary tooltip value, and accessible map descriptions use budget per resident.
- Municipality and region rank, order, row bar, and primary amount remain based on total budget.
- Budget per resident is rounded only for display; calculations and map buckets use full precision.
- No historical per-capita chart, table mode, CSV measure, toggle, detail-page statistic, or year selector.
- Keep the six-step terracotta ramp, existing map geometry, occupied-area behavior, keyboard interaction, and routes.
- Do not introduce a new dependency or shadcn component.
- Canonical human-reviewed data remains under `data/imports`; CSV and database serving must match row for row.
- If any public Georgian CSV output changes, it must retain UTF-8 BOM byte-level regression coverage; this internal code-and-number import does not add a new public download.

---

## File Structure

### New files

- `data/imports/municipal-population-2025.csv` — deterministic 64-row canonical served population slice.
- `apps/web/lib/data/municipal/importMunicipalPopulation.ts` — strict CSV loader and row validation.
- `apps/web/lib/data/municipal/prepareMunicipalPopulation2025.ts` — derive/check the served slice from the preserved normalized Geostat package.
- `apps/web/scripts/prepare-municipal-population-2025.ts` — `--write` / `--check` command wrapper.
- `apps/web/tests/data/municipal/importMunicipalPopulation.test.ts` — loader, generation, exact-set, and provenance tests.
- `apps/web/prisma/migrations/20260818000000_municipal_population_2025/migration.sql` — mirror table, relations, indexes, and RLS.

### Existing files changed

- `apps/web/lib/data/municipal/types.ts` — `MunicipalPopulationFact` domain row.
- `apps/web/package.json` — population prepare/check commands and `data:validate` integration.
- `apps/web/scripts/validate-data-files.ts` — require the exact 64-row 2025 population panel and registered source.
- `data/sources/source-documents.csv` — register the Geostat municipality-population source used by served rows.
- `apps/web/prisma/schema.prisma` — `MunicipalPopulationFact` mirror model and relations.
- `apps/web/scripts/import-budget-facts.ts` — transactional delete/create/readback/parity/count handling.
- `apps/web/lib/db/mirrorRows.ts` — database rows to `MunicipalPopulationFact`.
- `apps/web/lib/data/servedDataParity.ts` — natural parity key.
- `apps/web/lib/data/servedData.ts` — CSV load, municipal data shape, and CSV/database parity.
- `apps/web/lib/db/servedDataDb.ts` — database load.
- `apps/web/tests/data/municipal/mirrorRows.test.ts` — mirror mapping.
- `apps/web/tests/data/municipal/servedMunicipalData.test.ts` — 64 served rows and 2025-only contract.
- `apps/web/tests/data/servedDataParity.test.ts` — population parity key and mismatch behavior.
- `apps/web/lib/explorer/municipalData.ts` — per-resident joins, regional rollups, and median KPI.
- `apps/web/tests/explorer/municipalData.test.ts` — calculation and total-first ranking tests.
- `apps/web/lib/explorer/municipalityMapData.ts` — explicit per-resident map values and buckets plus total tooltip context.
- `apps/web/tests/explorer/municipalityMapData.test.ts` — per-resident bucket and error-contract tests.
- `apps/web/lib/explorer/format.ts` — whole-GEL per-resident formatter.
- `apps/web/tests/explorer/format.test.ts` — formatter regression.
- `apps/web/app/explorer/municipalities/page.tsx` — pass population, map labels, list values, KPI input, and source attribution.
- `apps/web/components/municipalities/municipality-map.tsx` — tooltip, legend, and accessible name.
- `apps/web/components/municipalities/municipalities-index.tsx` — total-first list with supporting per-resident text.
- `apps/web/tests/browser/municipalities.spec.ts` — visible and accessible index behavior.
- `Project_Definition.md`, `DESIGN.md`, `docs/data-methodology/municipal-population-regional-gdp.md`, `docs/data-methodology/database-import.md` — durable scope, visual, provenance, and mirror documentation.

---

### Task 1: Produce and validate the canonical 2025 population slice

**Files:**
- Create: `apps/web/lib/data/municipal/importMunicipalPopulation.ts`
- Create: `apps/web/lib/data/municipal/prepareMunicipalPopulation2025.ts`
- Create: `apps/web/scripts/prepare-municipal-population-2025.ts`
- Create: `apps/web/tests/data/municipal/importMunicipalPopulation.test.ts`
- Create: `data/imports/municipal-population-2025.csv`
- Modify: `apps/web/lib/data/municipal/types.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `data/sources/source-documents.csv`

**Interfaces:**
- Consumes: preserved normalized source `docs/Raw Data/Municipalities/geostat-population-regional-gdp/municipal-population-annual-2015-2025.csv` and canonical registry `data/imports/municipalities.csv`.
- Produces: `MunicipalPopulationFact`, `loadMunicipalPopulationFacts(relativePath)`, `buildMunicipalPopulation2025Output()`, and the 64-row served CSV.

- [ ] **Step 1: Define the served population row type and write failing loader tests**

Add to `apps/web/lib/data/municipal/types.ts`:

```ts
export type MunicipalPopulationFact = {
  year: 2025;
  municipalityCode: string;
  populationThousand: number;
  populationPersons: number;
  referenceDate: "2025-01-01";
  sourceId: "source.geostat_municipal_population";
  sourceSheet: string;
  sourceCell: string;
  sourceUnit: "(thousands)";
  transformation: string;
  lastReviewedAt: string;
};
```

Create tests that assert:

```ts
const rows = await loadMunicipalPopulationFacts("../../data/imports/municipal-population-2025.csv");
expect(rows).toHaveLength(64);
expect(new Set(rows.map((row) => row.year))).toEqual(new Set([2025]));
expect(new Set(rows.map((row) => row.municipalityCode))).toEqual(canonicalCodes);
expect(rows.find((row) => row.municipalityCode === "15")).toMatchObject({
  populationThousand: 57.2,
  populationPersons: 57_200,
  referenceDate: "2025-01-01",
});
```

Add mutation cases for duplicate code, year `2024`, non-positive persons, mismatched `population_thousand * 1000`, excluded/unknown code, invalid ISO dates, wrong source ID, and missing transformation.

- [ ] **Step 2: Run the focused test and confirm the missing-loader failure**

Run from `apps/web`:

```powershell
npm.cmd exec vitest run tests/data/municipal/importMunicipalPopulation.test.ts -- --configLoader native --pool=threads --maxWorkers=1
```

Expected: FAIL because `loadMunicipalPopulationFacts` and the served CSV do not exist.

- [ ] **Step 3: Implement the strict loader**

In `importMunicipalPopulation.ts`, use `readCsvRecords`, Zod, and Decimal.js. Parse this exact schema:

```text
year,municipality_code,population_thousand,population_persons,reference_date,source_id,source_sheet,source_cell,source_unit,transformation,last_reviewed_at
```

After schema parsing, enforce:

```ts
if (!new Decimal(row.population_thousand).times(1_000).equals(row.population_persons)) {
  throw new Error(`Population conversion mismatch for ${row.municipality_code}`);
}
if (!Number.isSafeInteger(row.population_persons) || row.population_persons <= 0) {
  throw new Error(`Population persons must be a positive safe integer for ${row.municipality_code}`);
}
```

Reject duplicate `2025:code` keys inside the loader.

- [ ] **Step 4: Write failing deterministic-generation and provenance tests**

Test `buildMunicipalPopulation2025Output()` against the preserved normalized package:

```ts
expect(result.rows).toHaveLength(64);
expect(result.rows.every((row) => row.year === 2025)).toBe(true);
expect(result.rows.map((row) => row.municipalityCode).sort()).toEqual([...canonicalCodes].sort());
expect(result.rows.every((row) => row.sourceId === "source.geostat_municipal_population")).toBe(true);
expect(result.rows.every((row) => row.referenceDate === "2025-01-01")).toBe(true);
expect(result.rows.every((row) => row.transformation.length > 0)).toBe(true);
```

Run the builder twice and assert byte-identical output. Mutate the source fixture to remove one 2025 row and assert an exact-set error naming the missing code.

- [ ] **Step 5: Implement the deterministic 2025 composer and command wrapper**

`buildMunicipalPopulation2025Output()` must:

1. load the preserved normalized CSV;
2. retain only year 2025;
3. validate exact equality with the 64 canonical municipality codes;
4. preserve `population_thousand`, `population_persons`, reference date, source sheet/cell/unit, transformation, and review date;
5. map the source to registered ID `source.geostat_municipal_population`;
6. sort by canonical numeric `sortId` then code;
7. serialize the exact internal schema with a trailing newline.

The wrapper supports only `--write` and `--check`; `--check` compares expected bytes with `data/imports/municipal-population-2025.csv` and fails with an instruction to rerun the write command.

- [ ] **Step 6: Register commands, source, and repository-wide data validation**

Add scripts:

```json
"data:prepare-municipal-population": "tsx scripts/prepare-municipal-population-2025.ts --write",
"data:check-municipal-population": "tsx scripts/prepare-municipal-population-2025.ts --check"
```

Append `npm run data:check-municipal-population` to `data:validate`.

Add one `source-documents.csv` row:

```csv
source.geostat_municipal_population,Geostat population as of 1 January by self-governed units,docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx,2026-08-03
```

Extend `validate-data-files.ts` to load the population CSV, require exactly 64 rows, exact 2025 keys, positive denominators, canonical code equality, and a registered source ID.

- [ ] **Step 7: Generate the canonical file and run focused checks**

```powershell
npm.cmd run data:prepare-municipal-population
npm.cmd exec vitest run tests/data/municipal/importMunicipalPopulation.test.ts -- --configLoader native --pool=threads --maxWorkers=1
npm.cmd run data:check-municipal-population
npm.cmd run data:validate
```

Expected: all PASS; `git diff --check` reports no errors; a second prepare run produces no diff.

- [ ] **Step 8: Commit the canonical population slice**

```powershell
git add data/imports/municipal-population-2025.csv data/sources/source-documents.csv apps/web/package.json apps/web/scripts/validate-data-files.ts apps/web/scripts/prepare-municipal-population-2025.ts apps/web/lib/data/municipal/types.ts apps/web/lib/data/municipal/importMunicipalPopulation.ts apps/web/lib/data/municipal/prepareMunicipalPopulation2025.ts apps/web/tests/data/municipal/importMunicipalPopulation.test.ts
git commit -m "feat(data): serve 2025 municipal population"
```

---

### Task 2: Add Prisma mirror, transactional import, and row-level serving parity

**Files:**
- Create: `apps/web/prisma/migrations/20260818000000_municipal_population_2025/migration.sql`
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `apps/web/scripts/import-budget-facts.ts`
- Modify: `apps/web/lib/db/mirrorRows.ts`
- Modify: `apps/web/lib/data/servedDataParity.ts`
- Modify: `apps/web/lib/data/servedData.ts`
- Modify: `apps/web/lib/db/servedDataDb.ts`
- Modify: `apps/web/tests/data/municipal/mirrorRows.test.ts`
- Modify: `apps/web/tests/data/municipal/servedMunicipalData.test.ts`
- Modify: `apps/web/tests/data/servedDataParity.test.ts`

**Interfaces:**
- Consumes: `MunicipalPopulationFact` and `loadMunicipalPopulationFacts()` from Task 1.
- Produces: `municipalPopulationFactParityKey(row)`, `loadMunicipalPopulationFactsFromMirror(db)`, and `MunicipalData.populationFacts` with identical CSV/database rows.

- [ ] **Step 1: Write failing parity and municipal-serving tests**

Add the natural key contract:

```ts
expect(municipalPopulationFactParityKey({ year: 2025, municipalityCode: "04" }))
  .toBe("2025:04");
```

Extend the CSV municipal serving test:

```ts
expect(data.populationFacts).toHaveLength(64);
expect(new Set(data.populationFacts.map((row) => row.year))).toEqual(new Set([2025]));
expect(new Set(data.populationFacts.map((row) => row.municipalityCode))).toEqual(
  new Set(data.municipalities.map((row) => row.code)),
);
```

Add mirror-row tests that reject wrong year/source/reference date and map Prisma `Decimal`/`Date` fields back to the exact domain shape.

- [ ] **Step 2: Run focused tests and confirm missing mirror/parity failures**

```powershell
npm.cmd exec vitest run tests/data/servedDataParity.test.ts tests/data/municipal/mirrorRows.test.ts tests/data/municipal/servedMunicipalData.test.ts -- --configLoader native --pool=threads --maxWorkers=1
```

Expected: FAIL on missing population key/loader/field.

- [ ] **Step 3: Add the Prisma model and SQL migration**

Add relations to `Municipality`, `SourceDocument`, and `ImportRun`, then add:

```prisma
model MunicipalPopulationFact {
  id                   String         @id
  year                 Int
  municipalityCode     String
  municipality         Municipality   @relation(fields: [municipalityCode], references: [code])
  populationThousand   Decimal        @db.Decimal(10, 1)
  populationPersons    Int
  referenceDate        DateTime       @db.Date
  sourceDocumentId     String
  sourceDocument       SourceDocument @relation(fields: [sourceDocumentId], references: [id])
  sourceSheet          String
  sourceCell           String
  sourceUnit           String
  transformation       String
  lastReviewedAt       DateTime       @db.Date
  importRunId          String?
  importRun            ImportRun?     @relation(fields: [importRunId], references: [id])

  @@unique([year, municipalityCode])
  @@index([municipalityCode])
}
```

The SQL migration must create equivalent foreign keys/indexes, enable RLS, and add the same authenticated-read policy pattern used by the municipal migrations.

- [ ] **Step 4: Extend the transactional import and exact readback parity**

In `import-budget-facts.ts`:

1. load the 64 population rows through `SERVED_DATA_FILES.municipalPopulationFacts`;
2. include `municipalPopulationFact.deleteMany()` in the existing dependency-safe delete phase;
3. create rows with deterministic ID `municipalPopulationFactParityKey(row)`;
4. store `importRunId`;
5. read them back through `loadMunicipalPopulationFactsFromMirror(tx)` before commit;
6. call `assertSameServedRows("municipal population facts", csv, mirror, municipalPopulationFactParityKey)`;
7. add `MunicipalPopulationFact` to the human-readable parity counts.

No direct database update or standalone import transaction is permitted.

- [ ] **Step 5: Wire CSV and database municipal loaders**

Add to `SERVED_DATA_FILES`:

```ts
municipalPopulationFacts: "../../data/imports/municipal-population-2025.csv",
```

Add `populationFacts: MunicipalPopulationFact[]` to `MunicipalData`. Load it in both `loadMunicipalDataFromCsv()` and `loadMunicipalDataFromDb()`. Add row-level parity inside `assertMunicipalParity()` using `municipalPopulationFactParityKey`.

`loadMunicipalPopulationFactsFromMirror()` must order by `year`, then `municipalityCode`, and return ISO date-only strings via `toISOString().slice(0, 10)`.

- [ ] **Step 6: Generate Prisma client and run focused parity tests**

```powershell
npm.cmd run prisma:generate
npm.cmd exec vitest run tests/data/servedDataParity.test.ts tests/data/municipal/mirrorRows.test.ts tests/data/municipal/servedMunicipalData.test.ts -- --configLoader native --pool=threads --maxWorkers=1
npm.cmd run typecheck
```

Expected: all PASS.

- [ ] **Step 7: Commit the mirror and serving contract**

```powershell
git add apps/web/prisma/schema.prisma apps/web/prisma/migrations/20260818000000_municipal_population_2025/migration.sql apps/web/scripts/import-budget-facts.ts apps/web/lib/db/mirrorRows.ts apps/web/lib/data/servedDataParity.ts apps/web/lib/data/servedData.ts apps/web/lib/db/servedDataDb.ts apps/web/tests/data/servedDataParity.test.ts apps/web/tests/data/municipal/mirrorRows.test.ts apps/web/tests/data/municipal/servedMunicipalData.test.ts
git commit -m "feat(data): mirror municipal population"
```

---

### Task 3: Calculate per-resident municipality/region rows, map values, and median

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts`
- Modify: `apps/web/tests/explorer/municipalData.test.ts`
- Modify: `apps/web/lib/explorer/municipalityMapData.ts`
- Modify: `apps/web/tests/explorer/municipalityMapData.test.ts`
- Modify: `apps/web/lib/explorer/format.ts`
- Modify: `apps/web/tests/explorer/format.test.ts`

**Interfaces:**
- Consumes: `MunicipalPopulationFact[]`, `MunicipalTotalFact[]`, registry, region labels, and optional Adjara adjustments.
- Produces: `MunicipalListRow.budgetPerResidentGel`, `buildMedianMunicipalBudgetPerResident(rows)`, explicit map shape/marker values, and `formatPerResidentGel(value)`.

- [ ] **Step 1: Add failing municipal and region calculation tests**

Extend fixtures with 2025 population:

```ts
const POPULATION: MunicipalPopulationFact[] = [
  population("04", 1_000_000),
  population("06", 250_000),
  population("07", 50_000),
];
```

Assert municipality math while preserving total ordering:

```ts
const result = buildMunicipalListRows({ ...listInput, populationFacts: POPULATION });
expect(result.municipalities.map((row) => row.id)).toEqual(["04", "06", "07"]);
expect(result.municipalities[0]).toMatchObject({
  valueGel: 2_000_000_000,
  budgetPerResidentGel: 2_000,
  rank: 1,
});
```

Use a fixture where per-resident order is the reverse of total-budget order and assert rank/order still follow `valueGel`.

Assert region math, including Adjara:

```ts
expect(adjara.valueGel).toBe(1_000_000_000);
expect(adjara.budgetPerResidentGel).toBeCloseTo(1_000_000_000 / 300_000, 10);
```

Assert missing/duplicate/zero/negative/non-finite denominators and missing 2025 totals throw code-specific errors. Assert `buildCountryListRow()` returns `budgetPerResidentGel: null`.

- [ ] **Step 2: Add failing median and formatter tests**

Test full-precision median behavior:

```ts
expect(buildMedianMunicipalBudgetPerResident([
  row(100), row(200), row(300), row(900),
])).toBe(250);
```

Test the display formatter:

```ts
expect(formatPerResidentGel(1334.6)).toBe("1,335 ₾");
expect(formatPerResidentGel(null)).toBe("—");
```

Use `Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })` and preserve the standard missing marker.

- [ ] **Step 3: Run focused tests and confirm the missing-field/function failures**

```powershell
npm.cmd exec vitest run tests/explorer/municipalData.test.ts tests/explorer/format.test.ts -- --configLoader native --pool=threads --maxWorkers=1
```

Expected: FAIL on `populationFacts`, `budgetPerResidentGel`, median, and formatter.

- [ ] **Step 4: Implement strict population joins and total-first list rows**

Extend `MunicipalListInput` with optional `populationFacts?: MunicipalPopulationFact[]` so detail-page `buildPickerGroups()` calls remain unchanged. When population facts are supplied, require an exact 2025 one-to-one join and return:

```ts
export type MunicipalListRow = {
  // existing fields unchanged
  budgetPerResidentGel: number | null;
};
```

Municipality rows calculate `valueGel / populationPersons`. Region aggregation tracks both `valueGel` and `populationPersons`; apply the Adjara budget adjustment to `valueGel` before division. Continue sorting and ranking only by `valueGel`.

`buildCountryListRow()` explicitly sets `budgetPerResidentGel: null`.

- [ ] **Step 5: Replace the concentration KPI with the median KPI**

Add `populationFacts` to `MunicipalIndexKpiInput`. Build 64 municipality rows for `latestYear`, calculate the median from their full-precision per-resident values, and replace KPI index 2 with:

```ts
{
  label: "მედიანური ბიუჯეტი ერთ მოსახლეზე",
  value: formatPerResidentGel(median),
  detail: `${latestYear} · 64 მუნიციპალიტეტი`,
}
```

Keep the other three country-total/function KPIs unchanged.

- [ ] **Step 6: Add failing per-resident map-model tests**

Update the map test input to include population. Assert:

```ts
expect(model.shapes.every((shape) =>
  shape.budgetPerResidentGel > 0 && shape.totalBudgetGel > 0 && shape.bucket >= 0 && shape.bucket <= 5,
)).toBe(true);
expect(model.legendMinPerResidentGel).toBe(Math.min(...model.shapes.map((shape) => shape.budgetPerResidentGel)));
```

Add a synthetic set where total-budget and per-resident rankings disagree; assert the darkest/lightest buckets follow per-resident values. Replace old non-finite-total cases with separate non-finite total and non-finite per-resident cases.

- [ ] **Step 7: Implement explicit map value names and per-resident bucketing**

Change map contracts to:

```ts
type MunicipalityMapValue = {
  code: string;
  nameKa: string;
  totalBudgetGel: number;
  budgetPerResidentGel: number;
};
```

Shapes add `d` and `bucket`; markers add `x` and `y`. Rename legend fields to `legendMinPerResidentGel` / `legendMaxPerResidentGel`. Validate both values are finite and positive. Quantile breaks use `budgetPerResidentGel`; retain the existing polygon-only bucket population and marker-only treatment.

- [ ] **Step 8: Run focused model tests**

```powershell
npm.cmd exec vitest run tests/explorer/municipalData.test.ts tests/explorer/municipalityMapData.test.ts tests/explorer/format.test.ts -- --configLoader native --pool=threads --maxWorkers=1
npm.cmd run typecheck
```

Expected: all PASS, including existing total-budget ranking tests and picker-group tests.

- [ ] **Step 9: Commit the pure calculation layer**

```powershell
git add apps/web/lib/explorer/municipalData.ts apps/web/lib/explorer/municipalityMapData.ts apps/web/lib/explorer/format.ts apps/web/tests/explorer/municipalData.test.ts apps/web/tests/explorer/municipalityMapData.test.ts apps/web/tests/explorer/format.test.ts
git commit -m "feat: calculate municipal budget per resident"
```

---

### Task 4: Render the 2025 map, total-first supporting list values, and source context

**Files:**
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/components/municipalities/municipality-map.tsx`
- Modify: `apps/web/components/municipalities/municipalities-index.tsx`
- Modify: `apps/web/tests/browser/municipalities.spec.ts`

**Interfaces:**
- Consumes: Task 3 map model, `MunicipalListRow.budgetPerResidentGel`, median KPI, and `formatPerResidentGel()`.
- Produces: user-visible and accessible 2025 budget-per-resident map and supporting municipality/region list text.

- [ ] **Step 1: Write failing browser assertions for the approved hierarchy**

Add stable test IDs to the intended contract and assert:

```ts
await expect(page.getByTestId("municipality-map-heading")).toContainText("ერთ მოსახლეზე");
await expect(page.getByTestId("municipality-map-heading")).toContainText("2025");
await expect(page.getByTestId("municipality-map-legend")).toContainText("₾");
```

For a known municipality, compute the expected value from served CSV fixtures and assert the tooltip contains both the whole-GEL per-resident value and the formatted total budget, with the per-resident element first in DOM order. Assert the map target accessible name contains both amounts and the opening action.

For municipality and region lists:

```ts
await expect(row.getByTestId("municipal-row-primary-amount")).toContainText(/მლნ ₾|მლრდ ₾/);
await expect(row.getByTestId("municipal-row-per-resident")).toContainText("₾ ერთ მოსახლეზე");
```

Assert row order and bar widths remain the same before and after the feature. On the Regions tab, assert every region row has support text, while the first Georgia row has no `municipal-row-per-resident` element.

Update the KPI assertion to require the median label, computed value, and `2025 · 64 მუნიციპალიტეტი` detail.

- [ ] **Step 2: Run the municipality browser file and confirm UI-contract failures**

```powershell
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts
```

Expected: FAIL because the map and lists still display total-only values.

- [ ] **Step 3: Compose 2025 population into the index page**

In `page.tsx`, destructure `populationFacts` from `loadServedMunicipalData()`. Pass them to `buildMunicipalListRows()` and `buildIndexKpis()`. Build the map from the resulting municipality rows.

Pass legend endpoints through `formatPerResidentGel()` rather than `formatAmount()`. Extend the existing source note with concise Geostat population attribution, but do not add a separate population-date label beside the map.

- [ ] **Step 4: Update map heading, tooltip, legend, and accessibility**

`MunicipalityMap` receives the explicit Task 3 fields. Replace `accessibleName(nameKa, valueGel)` with:

```ts
function accessibleName(nameKa: string, budgetPerResidentGel: number, totalBudgetGel: number): string {
  return `${nameKa} · ${formatPerResidentGel(budgetPerResidentGel)} ერთ მოსახლეზე · ${formatAmount(totalBudgetGel)} მთლიანი ბიუჯეტი · მუნიციპალიტეტის გახსნა`;
}
```

The visible tooltip order is name, per-resident value, muted total budget, arrow. Increase tooltip height only as much as needed and retain containment calculations for 340px width.

The map heading uses compact Georgian copy equivalent to `ბიუჯეტი ერთ მოსახლეზე · 2025`. Keep the existing six swatches and no new control/card.

- [ ] **Step 5: Add supporting list text without changing ranking visuals**

Keep `const max = source[0]?.valueGel ?? 1`, sort/order from props, rank, primary amount, and `row.valueGel / max` bar width unchanged.

Add `data-testid="municipal-row-per-resident"` only when `row.budgetPerResidentGel !== null`, styled smaller and muted. Use copy:

```tsx
{formatPerResidentGel(row.budgetPerResidentGel)} ერთ მოსახლეზე
```

Keep municipality region subtitles and region member-count subtitles. Give the existing formatted total `data-testid="municipal-row-primary-amount"`. Ensure the country row renders no empty placeholder for per resident.

- [ ] **Step 6: Run focused unit, browser, and build checks**

```powershell
npm.cmd exec vitest run tests/explorer/municipalData.test.ts tests/explorer/municipalityMapData.test.ts tests/explorer/format.test.ts -- --configLoader native --pool=threads --maxWorkers=1
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts
npm.cmd run build
```

Expected: PASS. Visually inspect desktop and 390×844 screenshots for readable support text, tooltip containment, unchanged total-budget emphasis, map color distribution, and no horizontal overflow.

- [ ] **Step 7: Commit the product UI**

```powershell
git add apps/web/app/explorer/municipalities/page.tsx apps/web/components/municipalities/municipality-map.tsx apps/web/components/municipalities/municipalities-index.tsx apps/web/tests/browser/municipalities.spec.ts
git commit -m "feat: show 2025 municipal budget per resident"
```

---

### Task 5: Update durable documentation and run completion verification

**Files:**
- Modify: `Project_Definition.md`
- Modify: `DESIGN.md`
- Modify: `docs/data-methodology/municipal-population-regional-gdp.md`
- Modify: `docs/data-methodology/database-import.md`
- Test: all changed unit/data/browser suites and repository gates

**Interfaces:**
- Consumes: the completed data, mirror, calculation, and UI contracts from Tasks 1–4.
- Produces: canonical documentation and verified implementation evidence suitable for GitHub delivery.

- [ ] **Step 1: Update scope and visual contracts**

In `Project_Definition.md` section 2:

- add the bounded 2025 municipal budget-per-resident map/list/KPI feature;
- remove the outdated exclusion claiming no reviewed population dataset exists;
- retain the exclusion of historical per-capita series and detail-page per-capita measures.

In `DESIGN.md` section 20:

- change map quantile bucketing from latest total to 2025 budget per resident;
- document per-resident tooltip/legend emphasis;
- state that municipality/region lists remain total-budget ranked with per-resident support;
- state that Georgia has no per-resident value.

- [ ] **Step 2: Update methodology and database mirror documentation**

In `municipal-population-regional-gdp.md`, replace the research-only UI boundary with a precise split: the full 2015–2025 package and regional GDP remain research assets, while only the validated 64-row 2025 population slice is promoted for this bounded calculation. Document formula, reference date, region aggregation, Adjara numerator, median, rounding, Georgia exclusion, source ID, deterministic check, and zero-estimate rule.

In `database-import.md`, add `MunicipalPopulationFact` to mirrored tables, import order, parity checks, counts, and rollback behavior.

- [ ] **Step 3: Run deterministic data checks twice**

```powershell
npm.cmd run data:prepare-municipal-population
git diff --exit-code -- data/imports/municipal-population-2025.csv
npm.cmd run data:prepare-municipal-population
git diff --exit-code -- data/imports/municipal-population-2025.csv
npm.cmd run data:check-municipal-population
npm.cmd run data:validate
```

Expected: no generated diff and all checks PASS.

- [ ] **Step 4: Run the full local definition of done**

From `apps/web`:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
```

From repository root:

```powershell
git diff --check
git status --short --branch
```

Expected: all commands PASS; only intentional task files are modified.

- [ ] **Step 5: Review the final diff against the approved specification**

Confirm explicitly:

- map buckets use per resident, not total budget;
- list order, ranks, primary values, and bars still use total budget;
- all 11 regions show correctly aggregated support values;
- Georgia shows none;
- median uses all 64 municipalities;
- no other year or detail page exposes per-capita data;
- no separate population-date label was added beside the map;
- source/methodology attribution remains visible and exact;
- CSV and database paths have row-level parity coverage.

- [ ] **Step 6: Commit documentation and verification-aligned cleanup**

```powershell
git add Project_Definition.md DESIGN.md docs/data-methodology/municipal-population-regional-gdp.md docs/data-methodology/database-import.md
git commit -m "docs: document municipal budget per resident"
```

- [ ] **Step 7: Perform GitHub delivery only when authorized**

Follow the repository workflow without bypassing checks:

```text
codex/municipal-budget-per-capita -> push -> draft PR -> required CI -> review and resolved conversations -> merge -> delete branch -> verify deployment commit and live municipality route
```

Production proof must include the matching merge SHA, Vercel `READY`, `/explorer/municipalities` response, visible 2025 per-resident map/list/KPI behavior, representative tooltip/accessibility behavior, and no selected-window runtime errors.
