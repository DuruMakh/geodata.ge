# Regional Economies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a bilingual Regional economies index and eleven selectable region pages with total regional GDP, 20 economic activities, nominal GEL and share-of-region views for 2010–2024.

**Architecture:** Extend the existing reviewed-data pipeline with one regional observation model keyed by region, series, measure and year. Reuse the Municipality geometry/navigation pattern for the All Regions index and the national Sectors workspace for each region page, while keeping regional calculations, state and public query contracts separate. Canonical CSVs remain authoritative, Prisma/Supabase is an exact transactional mirror, and all pages use build-time data.

**Tech Stack:** Next.js 16 App Router, strict TypeScript, React, Tailwind CSS v4, Lucide React, SheetJS/AdmZip source parsing, Decimal.js, Prisma 7/Postgres, Vitest, Playwright, ExcelJS and the existing static MCP/publication pipeline.

**Spec:** `docs/superpowers/specs/2026-09-13-regional-economies-design.md`

## Global Constraints

- Deliver one All Regions page and eleven static region pages in Georgian and English; detailed charts show one region at a time.
- Coverage is annual 2010–2024 for exactly 11 canonical regions and 20 NACE Rev. 2 activities.
- The only page measures are nominal GEL and share of the selected region's market-price GDP.
- Reuse literal `₾`, Lucide `ChartPie`, `SegmentedTabs` and `ControlTooltip`; no disabled third segment or growth icon.
- Default state is nominal GEL, line view, full loaded range and Total regional GDP only.
- Sector values are GVA at basic prices; total regional GDP is at market prices. Net product taxes remain reconciliation evidence, not a selectable sector.
- Sector shares always use the complete same-region, same-year market-price GDP denominator and are independent of selection.
- No national-share view, regional real growth, per-capita calculation, population integration, 2025 estimate, USD mode, multi-region overlay, homepage change, public API or runtime source fetch.
- Reuse `data/taxonomy/municipal-regions.json`, `data/taxonomy/economic-sectors.json` and the existing verified municipality geometry; do not create duplicate identities or ship schematic preview geometry.
- Preserve exact source decimals and immutable source bytes. Round only for display and Excel formatting.
- Reviewed CSVs are canonical; database import is transactional and parity checked. Never edit production tables directly.
- Preserve unrelated user changes. Do not refactor Budget, Municipality, GDP, national Sectors or Inflation beyond narrow backwards-compatible shared extensions.
- Use targeted tests during implementation. Run `npm run check`, `npm run build` and the full browser suite once at completion, following `CLAUDE.md`.
- Publishing is not authorized by this plan. It requires the repository's branch → PR → required CI → review → merge → deployment → live-verification workflow.

---

## File map and ownership

### New regional data unit

- `docs/Raw Data/Economy/regional-economies/source-manifest.json` — immutable source identities, URLs, hashes, sizes, roles and observed workbook structure.
- `docs/Raw Data/Economy/regional-economies/sources/regional-GDP-by-activities-ENG.xlsx` — missing official activity workbook, copied byte-for-byte from the validated research package.
- `data/imports/regional-economies-annual.csv` — canonical public observations only.
- `data/staging/regional-economies-reconciliation.csv` — annual region/accounting controls and known national-publication differences.
- `data/reports/regional-economies-validation.json` — hashes, mappings, counts, gaps, reconciliations and deterministic output evidence.
- `apps/web/lib/data/regionalEconomies/types.ts` — region observation and validation types.
- `apps/web/lib/data/regionalEconomies/calculations.ts` — exact share calculation only.
- `apps/web/lib/data/regionalEconomies/validation.ts` — canonical row validation independent of XLSX parsing.
- `apps/web/lib/data/regionalEconomies/prepareRegionalEconomies.ts` — source verification, exact XLSX extraction, reconciliation and artifact generation.
- `apps/web/lib/data/regionalEconomies/importRegionalEconomies.ts` — canonical CSV loader, DB/CSV parity and served-number projection.
- `apps/web/scripts/prepare-regional-economies.ts` — `--write`/`--check` command wrapper.
- `apps/web/scripts/prepare-regional-economies-public.ts` — generated central CSV preparation/check wrapper.

### New regional explorer unit

- `apps/web/lib/explorer/regionalEconomies.ts` — state parsing, range resolution, ranking and chart/table model.
- `apps/web/lib/explorer/regionalEconomyHighlights.ts` — selected-end-year hero and three side indicators.
- `apps/web/lib/explorer/regionalEconomyMap.ts` — latest-year region index/list model and geometry grouping.
- `apps/web/lib/explorer/regionalEconomiesWorkbook.ts` — existing three-sheet export model adapter.
- `apps/web/components/regional-economies/regional-economies-index.tsx` — All Regions composition and linked search/list state.
- `apps/web/components/regional-economies/regional-economy-map.tsx` — 11-region interactive SVG over verified geometry.
- `apps/web/components/regional-economies/region-picker.tsx` — searchable 11-option route picker.
- `apps/web/components/regional-economies/regional-economy-explorer.tsx` — selected-region workspace composition.
- `apps/web/components/regional-economies/regional-economy-series-panel.tsx` — regional total/sector selector and Excel action.
- `apps/web/components/regional-economies/region-highlights.tsx` — approved hero-plus-three layout.
- `apps/web/components/regional-economies/use-regional-economy-state.ts` — URL hash and browser-history state.
- `apps/web/lib/pages/regional-economies.tsx` — localized index server composition and metadata.
- `apps/web/lib/pages/regional-economy.tsx` — localized region-page server composition, static params and metadata.
- Four thin App Router wrappers under the Georgian and English Economy route trees.

### New query/publication unit

- `apps/web/lib/factQuery/regionalEconomySeries.ts` — query measure mapping and bilingual definitions.
- `apps/web/lib/factQuery/queryRegionalEconomies.ts` — bounded regional query implementation.
- `apps/web/lib/mcp/schemas.regional-economies.ts` — strict input schema for the dedicated tool.
- `apps/web/scripts/prepare-regional-economies-public.ts` — central CSV generation/check command.

### New documentation/localization

- `docs/data-methodology/regional-economies.md` — canonical preparation, accounting and serving contract.
- `apps/web/lib/methodology/content/regional-economies.ts` and `content/en/regional-economies.ts` — public methodology articles.
- `apps/web/lib/i18n/messages/ka/regional-economies.json` and `en/regional-economies.json` — page, control, map, workbook and service copy.

---

### Task 1: Preserve the missing regional-activity source and prove the workbook contract

**Files:**
- Create: `docs/Raw Data/Economy/regional-economies/source-manifest.json`
- Create: `docs/Raw Data/Economy/regional-economies/sources/regional-GDP-by-activities-ENG.xlsx`
- Create: `apps/web/tests/data/regionalEconomies/sourceEvidence.test.ts`
- Create: `apps/web/lib/data/regionalEconomies/sourceEvidence.ts`
- Read only: `docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/regional-GDP-ENG.xlsx`
- Read only: `docs/Raw Data/Economy/gdp-overview/sources/geostat_nominal_current.xlsx`

**Interfaces:**
- Consumes: the validated research ZIP's `sources/regional-GDP-by-activities-ENG.xlsx`, SHA-256 `88e337bd82a5232ea5260f011b11cb2d82c2cec5115fddbe92d14d1ff3945337`, 99,089 bytes.
- Produces: `loadRegionalSourceEvidence(repositoryRoot): Promise<RegionalSourceEvidence>` and a reviewed manifest used by Task 3.

- [ ] **Step 1: Write failing immutable-source tests**

Test these exact facts:

```ts
expect(manifest.sources.map(source => source.role)).toEqual([
  "regional_totals",
  "regional_activities",
  "national_validation",
]);
expect(await sha256(activityPath)).toBe(
  "88e337bd82a5232ea5260f011b11cb2d82c2cec5115fddbe92d14d1ff3945337",
);
expect(statSync(activityPath).size).toBe(99_089);
expect(await sha256(existingTotalPath)).toBe(
  "dd2042dff5e2c44b98b4bb140163b5736cf5a71f4683b9e6a359373907d59c35",
);
expect(await sha256(existingNationalPath)).toBe(
  "21a576c9c20434a87bcb32047cd143eef2b8d3f3ff360442b420c76b0da27d34",
);
```

Assert the activity workbook has exactly the 11 expected sheet names, their reviewed source-label mappings and no extras. On every sheet assert `A2="NACE  rev. 2"`, annual headers `2010..2024` in `C2:Q2`, exact A–T codes in `A3:A22`, matching official names in `B3:B22`, accounting rows 23–26, the 23 December 2025 update note and the metadata URL.

- [ ] **Step 2: Run the focused test and observe the missing archive/loader failure**

Run from `apps/web`:

```powershell
npx vitest run tests/data/regionalEconomies/sourceEvidence.test.ts
```

Expected: failure because the regional source unit and activity workbook are absent.

- [ ] **Step 3: Copy only the verified activity workbook and add the manifest**

Extract `sources/regional-GDP-by-activities-ENG.xlsx` from the validated package at:

```text
C:/Users/Mylaptop/.codex/visualizations/2026/09/09/01a08781-3744-72d2-a57e-552083073a21/gdp-final/Georgia-GDP-complete-data-package.zip
```

Copy its bytes unchanged to the path above. The manifest must reference the already-committed regional-total and national-validation originals rather than duplicate them. Record the activity URL exactly as `https://geostat.ge/media/79753/regional-GDP-by-activities-ENG.xlsx` and the observed retrieval date `2026-09-10`, hashes, sizes, source roles, workbook/sheet expectations and metadata URL. Do not fetch a new upstream file during preparation.

- [ ] **Step 4: Implement the source-evidence loader**

Define the stable source mapping:

```ts
export const REGIONAL_SOURCE_SHEETS = [
  ["Tbilisi", "region.tbilisi"],
  ["Adjara A.R.", "region.adjara"],
  ["Guria", "region.guria"],
  ["Imereti", "region.imereti"],
  ["Kakheti", "region.kakheti"],
  ["Mtskheta-Mtianeti", "region.mtskheta_mtianeti"],
  ["Racha", "region.racha_lechkhumi_kvemo_svaneti"],
  ["Samegrelo", "region.samegrelo_zemo_svaneti"],
  ["Samtskhe", "region.samtskhe_javakheti"],
  ["Kvemo Kartli", "region.kvemo_kartli"],
  ["Shida Kartli", "region.shida_kartli"],
] as const;
```

Read exact numeric XML text before Decimal conversion, following the source-exact national Sectors approach. Return reviewed workbook metadata and cell accessors; do not emit canonical rows yet.

- [ ] **Step 5: Re-run focused tests**

Run:

```powershell
npx vitest run tests/data/regionalEconomies/sourceEvidence.test.ts
```

Expected: all workbook, hash, sheet, activity, year and accounting-row checks pass.

- [ ] **Step 6: Commit the source checkpoint**

```powershell
git add -- "docs/Raw Data/Economy/regional-economies" apps/web/lib/data/regionalEconomies/sourceEvidence.ts apps/web/tests/data/regionalEconomies/sourceEvidence.test.ts
git commit -m "data: preserve regional economy source"
```

---

### Task 2: Define exact regional observations, calculations and validation

**Files:**
- Create: `apps/web/lib/data/regionalEconomies/types.ts`
- Create: `apps/web/lib/data/regionalEconomies/calculations.ts`
- Create: `apps/web/lib/data/regionalEconomies/validation.ts`
- Create: `apps/web/tests/data/regionalEconomies/calculations.test.ts`
- Create: `apps/web/tests/data/regionalEconomies/validation.test.ts`

**Interfaces:**
- Consumes: existing region IDs and `SectorDefinition` identities.
- Produces: `RegionalEconomyObservation`, `ServedRegionalEconomyObservation`, `shareOfRegionGdpPercent`, `validateRegionalEconomyObservations`.

- [ ] **Step 1: Write failing calculation tests**

```ts
expect(shareOfRegionGdpPercent("715.676721667705", "7203.151022643833"))
  .toBe("9.93560622868940159713");
expect(() => shareOfRegionGdpPercent("1", "0")).toThrow(/positive regional GDP/);
```

Add coverage for exact 100% total, negative numerator preservation, nonfinite text rejection and rounding once to 20 decimal places with a 50-significant-digit Decimal context.

- [ ] **Step 2: Run the calculation test and verify the missing-function failure**

```powershell
npx vitest run tests/data/regionalEconomies/calculations.test.ts
```

- [ ] **Step 3: Implement the minimal calculation and types**

Use these public types:

```ts
export type RegionalEconomyMeasure = "nominal" | "share_of_region_gdp";
export type RegionalEconomyStatus = "published";
export const REGIONAL_GDP_TOTAL = "economy.regional_gdp_total" as const;

export type RegionalEconomyObservation = {
  regionId: string;
  seriesId: string;
  year: number;
  measure: RegionalEconomyMeasure;
  value: string;
  unit: "gel" | "percent";
  valuation: "basic_prices" | "market_prices";
  priceBasis: "current_prices";
  calculation: "published" | "ratio_to_region_gdp";
  status: RegionalEconomyStatus;
  sourceId: string;
  sourceLocator: string;
  lastReviewedAt: string;
};

export type ServedRegionalEconomyObservation =
  Omit<RegionalEconomyObservation, "value"> & { value: number };
```

- [ ] **Step 4: Write failing canonical validation tests**

Build a complete small fixture and mutate one rule at a time. Require canonical region IDs, Total plus `sector.a..sector.t`, exact 2010–2024 annual keys, the two measure/unit/valuation/calculation combinations, positive total denominators, stable source IDs, ISO review dates, decimal capacity and duplicate rejection. Assert the complete production shape is exactly 6,930 rows:

```ts
expect(report.counts).toEqual({
  regions: 11,
  years: 15,
  selectableSeries: 21,
  nominal: 3465,
  shareOfRegionGdp: 3465,
  total: 6930,
});
```

- [ ] **Step 5: Implement `validateRegionalEconomyObservations`**

The validator accepts rows plus the existing region and sector registries. It validates flat canonical fields only. It must not parse XLSX, fetch sources or accept tax rows as public series. Return counts and unique-key evidence; throw with the exact region/series/measure/year key on invalid data.

- [ ] **Step 6: Run the two focused suites and commit**

```powershell
npx vitest run tests/data/regionalEconomies/calculations.test.ts tests/data/regionalEconomies/validation.test.ts
git add apps/web/lib/data/regionalEconomies apps/web/tests/data/regionalEconomies/calculations.test.ts apps/web/tests/data/regionalEconomies/validation.test.ts
git commit -m "data: define regional economy observations"
```

---

### Task 3: Generate canonical regional facts and reconciliation evidence

**Files:**
- Create: `apps/web/lib/data/regionalEconomies/prepareRegionalEconomies.ts`
- Create: `apps/web/scripts/prepare-regional-economies.ts`
- Create: `apps/web/tests/data/regionalEconomies/prepareRegionalEconomies.test.ts`
- Create: `data/imports/regional-economies-annual.csv`
- Create: `data/staging/regional-economies-reconciliation.csv`
- Create: `data/reports/regional-economies-validation.json`
- Modify: `apps/web/package.json`
- Modify: `apps/web/scripts/validate-data-files.ts`

**Interfaces:**
- Consumes: `loadRegionalSourceEvidence`, `shareOfRegionGdpPercent`, both canonical taxonomies.
- Produces: `prepareRegionalEconomies(repositoryRoot): Promise<RegionalEconomyPreparation>` and `writeRegionalEconomyArtifacts(repositoryRoot)`.

- [ ] **Step 1: Write failing preparation tests**

Test all of these source-derived outcomes:

```ts
expect(result.observations).toHaveLength(6_930);
expect(result.report.sourceCounts).toEqual({
  regionalTotals: 165,
  regionalSectorAmounts: 3_300,
  reconciliationRows: 495,
});
expect(result.report.missingValues).toBe(0);
expect(result.report.duplicateKeys).toBe(0);
expect(result.report.allRegionAccountsReconcile).toBe(true);
expect(result.report.allRegionTotalsReconcileToNational).toBe(true);
expect(result.report.nationalSectorPublicationDifferences).toHaveLength(7);
```

Spot-check exact source-derived cells for Tbilisi, Imereti, Adjara and Racha; include a true zero activity value and a small nonzero household value. Assert Imereti 2024 total GDP is `7203151022.643833` GEL and its agriculture amount/share retains exact source precision. Independently compare every emitted source amount to the underlying XLSX XML text.

- [ ] **Step 2: Run the focused test and confirm preparation is absent**

```powershell
npx vitest run tests/data/regionalEconomies/prepareRegionalEconomies.test.ts
```

- [ ] **Step 3: Implement deterministic source extraction**

For every region sheet and 2010–2024 column:

1. Read A–T amount text from rows 3–22.
2. Read basic-price GDP, taxes, subsidies and market-price GDP from rows 23–26.
3. Verify the same region/year market-price GDP equals the total workbook's value at source precision.
4. Emit nominal Total from the regional-total workbook and nominal sectors from the activity workbook, scaling million GEL by exactly 1,000,000.
5. Emit Total share `100` and each sector share using the canonical regional total.
6. Emit reconciliation/report records, not public tax series.

Use `source.geostat_regional_gdp`, `source.geostat_regional_gdp_by_activity` and a documented derived `source.fiscal_regional_economy_share` that cites both upstream originals. Share locators list numerator then denominator.

- [ ] **Step 4: Fail closed on accounting and publication differences**

Predeclare a `0.01 GEL` regional-accounting tolerance after full-GEL scaling. Record signed differences without modifying values. Require the seven reviewed national-publication allocation differences exactly by year/sector/value; any additional or changed difference fails preparation rather than widening the accepted set.

- [ ] **Step 5: Implement byte-stable artifacts and command wrappers**

Canonical CSV header:

```text
region_id,series_id,year,measure,value,unit,valuation,price_basis,calculation,status,source_id,source_locator,last_reviewed_at
```

Sort by region taxonomy order, Total then sector order, measure, year. Write both CSVs with UTF-8 BOM and normal quoting. `--check` regenerates in memory and compares bytes without writing. Add:

```json
"data:prepare-regional-economies": "tsx scripts/prepare-regional-economies.ts --write",
"data:check-regional-economies": "tsx scripts/prepare-regional-economies.ts --check"
```

Append the check once to `data:validate` after national economic sectors and before inflation. Register the three generated files in `validate-data-files.ts` with their exact schemas.

- [ ] **Step 6: Generate, check and prove a fixed point**

```powershell
npm run data:prepare-regional-economies
npm run data:check-regional-economies
npm run data:prepare-regional-economies
git diff --exit-code -- data/imports/regional-economies-annual.csv data/staging/regional-economies-reconciliation.csv data/reports/regional-economies-validation.json
npx vitest run tests/data/regionalEconomies
```

Expected: 6,930 canonical rows, all checks pass and the second write changes nothing.

- [ ] **Step 7: Write the canonical data methodology and commit**

Create `docs/data-methodology/regional-economies.md` with source hashes, coverage, geography mapping, formulas, GVA/GDP distinction, known differences, exact counts, regeneration commands, application boundary and no-estimation statement. Then:

```powershell
git add apps/web/lib/data/regionalEconomies apps/web/scripts/prepare-regional-economies.ts apps/web/tests/data/regionalEconomies apps/web/package.json apps/web/scripts/validate-data-files.ts data/imports/regional-economies-annual.csv data/staging/regional-economies-reconciliation.csv data/reports/regional-economies-validation.json docs/data-methodology/regional-economies.md
git commit -m "data: prepare regional economy facts"
```

---

### Task 4: Add CSV serving and the transactional database mirror

**Files:**
- Create: `apps/web/lib/data/regionalEconomies/importRegionalEconomies.ts`
- Create: `apps/web/tests/data/regionalEconomies/importRegionalEconomies.test.ts`
- Create: `apps/web/tests/data/regionalEconomies/servingBoundary.test.ts`
- Create: `apps/web/tests/data/regionalEconomies/mirrorIntegration.test.ts`
- Create: `apps/web/tests/data/regionalEconomies/mirrorRows.test.ts`
- Create: `apps/web/prisma/migrations/20260913000000_regional_economies/migration.sql`
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `apps/web/lib/data/servedData.ts`
- Modify: `apps/web/lib/db/mirrorRows.ts`
- Modify: `apps/web/lib/db/servedDataDb.ts`
- Modify: `apps/web/scripts/import-budget-facts.ts`
- Modify: `apps/web/tests/data/importBudgetFacts.test.ts`
- Modify: `apps/web/tests/data/importReport.test.ts`

**Interfaces:**
- Consumes: `RegionalEconomyObservation[]` from the canonical CSV.
- Produces: `loadRegionalEconomyFacts`, `assertRegionalEconomyParity`, `loadServedRegionalEconomyData`, `loadRegionalEconomyFactsFromMirror`, `loadRegionalEconomyFactsFromDb`.

- [ ] **Step 1: Write failing CSV-loader/parity tests**

```ts
const facts = await loadRegionalEconomyFacts();
expect(facts).toHaveLength(6_930);
expect(() => assertRegionalEconomyParity(facts, facts.slice(1))).toThrow(/Regional economies parity/);
```

Mutate each field, exact decimal text, row order and one key. Verify parity normalizes ordering but rejects every semantic difference.

- [ ] **Step 2: Implement the canonical loader and serving boundary**

Add `regionalEconomyFacts: "../../data/imports/regional-economies-annual.csv"` to `SERVED_DATA_FILES`. Parse the exact header into typed rows, run canonical validation, and reject empty input. Follow the national Sectors CSV/DB switch:

```ts
export async function loadServedRegionalEconomyData(): Promise<{
  facts: ServedRegionalEconomyObservation[];
}>;
```

CSV remains loaded even in DB mode and is compared with mirror rows before number projection. Invalid `GEODATA_DATA_SOURCE` fails. The serving module must not import `prepareRegionalEconomies` or raw XLSX code.

- [ ] **Step 3: Add the Prisma model and fail-closed migration tests**

Add relations to `SourceDocument` and `ImportRun`, then:

```prisma
model RegionalEconomyFact {
  regionId        String
  seriesId        String
  measure         String
  year            Int
  value           Decimal        @db.Decimal(40, 20)
  unit            String
  valuation       String
  priceBasis      String
  calculation     String
  status          String
  sourceLocator   String
  sourceDocumentId String
  sourceDocument  SourceDocument @relation(fields: [sourceDocumentId], references: [id])
  lastReviewedAt  DateTime        @db.Date
  importRunId     String?
  importRun       ImportRun?      @relation(fields: [importRunId], references: [id])

  @@id([regionId, seriesId, measure, year])
}
```

Migration SQL creates the composite primary key and foreign keys, enables RLS and revokes all table access from `anon` and `authenticated`.

- [ ] **Step 4: Add mirror reading and transactional import**

Load mirror rows ordered by region, series, measure and year. In `import-budget-facts.ts`, load/validate regional facts before opening the transaction; assert all source IDs exist. Inside the existing transaction delete old regional rows before source documents, insert all rows with the current import run, read them back and call `assertRegionalEconomyParity`. Add `{ table: "RegionalEconomyFact", csvRows, dbRows }` to the report.

- [ ] **Step 5: Prove rollback and exact parity on a disposable database**

Following `docs/data-methodology/database-import.md`, point `DATABASE_URL` at a task-local disposable database, then run:

```powershell
npx prisma generate
npx prisma migrate deploy
npm run data:import
npm run data:import
npx vitest run tests/data/regionalEconomies/importRegionalEconomies.test.ts tests/data/regionalEconomies/servingBoundary.test.ts tests/data/regionalEconomies/mirrorIntegration.test.ts tests/data/regionalEconomies/mirrorRows.test.ts tests/data/importBudgetFacts.test.ts tests/data/importReport.test.ts
```

Capture table counts/digests. Inject one regional mirror mismatch in the test transaction and prove the complete import rolls back, including unchanged existing table counts. Never point this test at production.

- [ ] **Step 6: Update database documentation and commit**

Add the regional table, row count, parity and rollback contract to `docs/data-methodology/database-import.md`. Then:

```powershell
git add apps/web/prisma apps/web/lib/data/servedData.ts apps/web/lib/data/regionalEconomies/importRegionalEconomies.ts apps/web/lib/db apps/web/scripts/import-budget-facts.ts apps/web/tests/data docs/data-methodology/database-import.md
git commit -m "feat: mirror regional economy facts"
```

---

### Task 5: Build the pure region workspace model, state and Excel adapter

**Files:**
- Create: `apps/web/lib/explorer/regionalEconomies.ts`
- Create: `apps/web/lib/explorer/regionalEconomyHighlights.ts`
- Create: `apps/web/lib/explorer/regionalEconomiesWorkbook.ts`
- Create: `apps/web/tests/explorer/regionalEconomies.test.ts`
- Create: `apps/web/tests/explorer/regionalEconomyHighlights.test.ts`
- Create: `apps/web/tests/explorer/regionalEconomiesWorkbook.test.ts`

**Interfaces:**
- Consumes: one region's served facts, `ECONOMIC_SECTORS`, `sectorColor`, shared range/table/workbook types.
- Produces: `RegionalEconomyState`, `DEFAULT_REGIONAL_ECONOMY_STATE`, `parseRegionalEconomyHash`, `serializeRegionalEconomyHash`, `buildRegionalEconomyModel`, `buildRegionalEconomyHighlights`, `buildRegionalEconomyWorkbookExportModel`.

- [ ] **Step 1: Write failing state/model tests**

Use the approved state shape:

```ts
export type RegionalEconomyState = {
  measure: "nominal" | "share_of_region_gdp";
  mode: "line" | "table";
  range: { kind: "all" } | { kind: "manual"; start: number; end: number };
  selectedIds: string[];
};

expect(DEFAULT_REGIONAL_ECONOMY_STATE).toEqual({
  measure: "nominal",
  mode: "line",
  range: { kind: "all" },
  selectedIds: [REGIONAL_GDP_TOTAL],
});
```

Test absent versus explicit empty selection, invalid/duplicate IDs, reversed/clamped ranges, state round-trip, measure switching, percentage conversion once, missing versus zero, Total first, stable sector colour and active end-year ranking.

- [ ] **Step 2: Implement state and chart/table model**

`buildRegionalEconomyModel(facts, sectors, state)` returns resolved range, years, ranked definitions, selected chart series, table rows, Total headline, active source IDs and end-year values. It never derives growth or selects facts from another region.

- [ ] **Step 3: Write and implement highlight tests**

For one region/end year, calculate from all 20 nominal sectors regardless of selected rows or active measure:

```ts
expect(summary.largest.seriesId).toBe("sector.a");
expect(summary.total.seriesId).toBe(REGIONAL_GDP_TOTAL);
expect(summary.topThreeSharePct).toBeCloseTo(
  topThree.reduce((sum, row) => sum + row.sharePct, 0),
  12,
);
expect(summary.publishedSectorCount).toBe(20);
```

Test stable ties and a true-zero sector. Do not calculate fastest growth or full-range change.

- [ ] **Step 4: Write failing workbook-model tests**

Nominal mode exports full GEL values. Share mode exports percentage fractions plus each sector's full nominal GEL numerator; Total is 100%. Verify selected region, active years/series, localized titles, correct sheet columns, numeric zeros, blanks and only relevant regional source documents.

- [ ] **Step 5: Implement the workbook adapter with existing writer types**

Return the existing `WorkbookExportModel`; do not create another writer. Use filename:

```ts
`fiscal-regional-economy-${regionSlug}-${state.measure}-${start}-${end}${locale === "en" ? "-en" : ""}.xlsx`
```

- [ ] **Step 6: Run focused model/export tests and commit**

```powershell
npx vitest run tests/explorer/regionalEconomies.test.ts tests/explorer/regionalEconomyHighlights.test.ts tests/explorer/regionalEconomiesWorkbook.test.ts
git add apps/web/lib/explorer/regionalEconom* apps/web/tests/explorer/regionalEconom*
git commit -m "feat: model regional economy explorer"
```

---

### Task 6: Build the All Regions map and ranked index

**Files:**
- Create: `apps/web/lib/explorer/regionalEconomyMap.ts`
- Create: `apps/web/components/regional-economies/regional-economy-map.tsx`
- Create: `apps/web/components/regional-economies/regional-economies-index.tsx`
- Create: `apps/web/tests/explorer/regionalEconomyMap.test.ts`
- Create: `apps/web/tests/explorer/regionalEconomiesIndex.test.tsx`
- Modify only if required: `apps/web/lib/explorer/municipalityMapData.ts`
- Reuse unchanged: `data/geometry/municipality-map-paths.json`
- Reuse unchanged: `apps/web/assets/municipality-map-definitions.svg`

**Interfaces:**
- Consumes: latest-year Total facts, municipality-to-region mapping, canonical region registry and verified geometry artifact.
- Produces: `buildRegionalEconomyMapModel`, `RegionalEconomyMap`, `RegionalEconomiesIndex`.

- [ ] **Step 1: Write failing map-model tests**

Require exactly 11 region groups. Every one of the 64 public municipalities maps to one canonical region, while the geometry's city markers and 60 paths resolve without an unknown code. The model uses the maximum loaded Total year, ranks all regions by the same values and assigns deterministic quantile buckets.

```ts
expect(model.year).toBe(2024);
expect(model.regions).toHaveLength(11);
expect(model.regions[0]).toMatchObject({
  regionId: "region.tbilisi",
  totalGdpGel: 49_374_720_708.90671,
  rank: 1,
});
```

- [ ] **Step 2: Implement the pure map/index model**

Export the already-validated geometry artifact only if the new pure builder needs it; do not change Municipality map values or validation. Group geometry codes by each municipality's `regionId`. Build latest-year values, rank, min/max and one bucket per region. All pieces of one region carry the same bucket/value.

- [ ] **Step 3: Write failing component tests for map/list coordination**

Render the index in both locales. Verify 11 navigable region groups and 11 list rows; search matches Georgian and English; pointer/focus on a list row activates the matching map group; map activation targets `/explorer/economy/regions/imereti`; values/ranks/year agree; occupied-area overlays remain noninteractive and labelled as unavailable rather than assigned invented GDP.

- [ ] **Step 4: Implement the regional map**

Render one focusable `<g>` per region containing its municipality `<use>` paths and city markers. Reuse the existing map SVG definitions, viewBox, occupied overlays, tooltip positioning, focus/keyboard conventions and warm six-step ramp. The tooltip contains region label, latest-year GDP and year. Do not create 65 tab stops.

- [ ] **Step 5: Implement the All Regions composition**

Follow the Municipality index's two-column desktop layout and mobile stacking. Include data-derived heading context, map, legend, three approved summaries, search and ranked list. The index has no year selector or multi-region chart.

- [ ] **Step 6: Run focused tests and inspect two renders**

```powershell
npx vitest run tests/explorer/regionalEconomyMap.test.ts tests/explorer/regionalEconomiesIndex.test.tsx tests/explorer/municipalityMapData.test.ts
```

Render/check Georgian 390px and English 1440px once the page route exists in Task 8; record that as pending here rather than starting a temporary route.

- [ ] **Step 7: Commit the index unit**

```powershell
git add apps/web/lib/explorer/regionalEconomyMap.ts apps/web/components/regional-economies/regional-economy-map.tsx apps/web/components/regional-economies/regional-economies-index.tsx apps/web/tests/explorer/regionalEconomyMap.test.ts apps/web/tests/explorer/regionalEconomiesIndex.test.tsx apps/web/lib/explorer/municipalityMapData.ts
git commit -m "feat: add regional economy map index"
```

---

### Task 7: Build the selected-region workspace and navigation

**Files:**
- Create: `apps/web/components/regional-economies/use-regional-economy-state.ts`
- Create: `apps/web/components/regional-economies/region-picker.tsx`
- Create: `apps/web/components/regional-economies/regional-economy-series-panel.tsx`
- Create: `apps/web/components/regional-economies/region-highlights.tsx`
- Create: `apps/web/components/regional-economies/regional-economy-explorer.tsx`
- Create: `apps/web/tests/explorer/regionalEconomyPresentation.test.tsx`
- Create: `apps/web/tests/explorer/regionalEconomyPicker.test.tsx`
- Create: `apps/web/tests/explorer/regionalEconomyPage.test.tsx`
- Reuse unchanged unless an opt-in prop is required: shared chart, table, range, segmented tabs, tooltip, selector, Excel button and Sparkline components.

**Interfaces:**
- Consumes: Task 5 models and workbook adapter; 11 region identities/routes; public source projections.
- Produces: `RegionalEconomyExplorer` with one region's facts and `RegionPicker` with 11 routes.

- [ ] **Step 1: Write failing presentation tests**

Assert the page renders exactly two measure buttons with accessible names `Nominal value in GEL` and `Share of regional GDP`; the visible icons are literal `₾` and Lucide `ChartPie`. There is no growth button, national-share copy, USD, population or 2025. Default selection is Total only and count `1 / 21`.

- [ ] **Step 2: Implement hash state and the 11-option picker**

The state hook follows `use-economic-sectors-state.ts`. The picker follows the existing ARIA combobox/listbox keyboard model but contains only the 11 region options and a route back to All Regions. Search both languages; Escape returns focus; Arrow keys wrap; Enter navigates; Tab is not trapped. Do not force the municipal country/member types into this component.

- [ ] **Step 3: Implement the series panel**

Compose existing `SeriesSelector`/`SeriesSelectorRow`. Total stays first; sector order is end-year descending for the active measure; colours reuse `sectorColor`. Search never scopes count/bulk/export. Long bilingual labels wrap only through the existing opt-in table/selector treatment.

- [ ] **Step 4: Implement the workspace**

Compose `SegmentedTabs`, `ControlTooltip`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SourceNote`, the regional panel and `ExcelDownloadButton`. Share values reach chart/table boundaries exactly once. Empty selection shows the existing callout and disables export. Preserve chart/table/range state across measure changes.

- [ ] **Step 5: Implement approved highlights**

Use the existing 1.35fr/1fr hero-plus-side layout. Hero is largest sector amount/share. Side rows are total regional GDP, top-three combined share and sector count. Values use the active final year and all sectors, independent of chart selection. Add truthful sparklines only where the same metric/series can be followed historically; never draw a nominal line under a label that implies real growth.

- [ ] **Step 6: Verify component behaviour**

```powershell
npx vitest run tests/explorer/regionalEconomyPresentation.test.tsx tests/explorer/regionalEconomyPicker.test.tsx tests/explorer/regionalEconomyPage.test.tsx tests/explorer/economicSectorsPresentation.test.tsx tests/explorer/economicSectorsWorkbook.test.ts
npm run typecheck
```

Expected: new tests pass and the national Sectors component remains unchanged.

- [ ] **Step 7: Commit the selected-region UI unit**

```powershell
git add apps/web/components/regional-economies apps/web/tests/explorer/regionalEconomy*.test.tsx
git commit -m "feat: add regional economy workspace"
```

---

### Task 8: Add bilingual routes, Economy navigation and metadata

**Files:**
- Create: `apps/web/lib/pages/regional-economies.tsx`
- Create: `apps/web/lib/pages/regional-economy.tsx`
- Create: `apps/web/app/(ka)/explorer/economy/regions/page.tsx`
- Create: `apps/web/app/(ka)/explorer/economy/regions/[id]/page.tsx`
- Create: `apps/web/app/(en)/en/explorer/economy/regions/page.tsx`
- Create: `apps/web/app/(en)/en/explorer/economy/regions/[id]/page.tsx`
- Create: `apps/web/lib/i18n/messages/ka/regional-economies.json`
- Create: `apps/web/lib/i18n/messages/en/regional-economies.json`
- Modify: `apps/web/lib/i18n/messages.server.ts`
- Modify: `apps/web/lib/i18n/types.ts`
- Modify: `apps/web/lib/i18n/inventory.server.ts`
- Modify: `apps/web/lib/explorer/economyHubCards.ts`
- Modify: `apps/web/lib/pages/economy.tsx`
- Modify: `apps/web/components/shell/data-sidebar.tsx`
- Modify: `apps/web/lib/seo/sitemap.ts`
- Modify: `apps/web/lib/seo/datasetVocabulary.ts`
- Create: `apps/web/tests/explorer/regionalEconomiesRoute.test.ts`
- Create: `apps/web/tests/seo/regionalEconomiesMetadata.test.tsx`
- Modify: `apps/web/tests/explorer/economyHub.test.tsx`
- Modify: `apps/web/tests/i18n/routes.test.ts`
- Modify: `apps/web/tests/seo/sitemapFreshness.test.ts`
- Modify: `apps/web/tests/seo/sitemapPresentation.test.ts`

**Interfaces:**
- Consumes: served regional facts, index/detail components and established i18n/SEO helpers.
- Produces: `renderRegionalEconomiesPage`, `regionalEconomiesPageMetadata`, `renderRegionalEconomyPage`, `regionalEconomyPageMetadata`, 11 static params.

- [ ] **Step 1: Write failing route and hub tests**

Require the Economy hub's Regional economies card to link only when regional facts load. Its footer is `2010–2024`; it remains separate from national Sectors. Require 11 valid route IDs and reject unknown IDs with `notFound()`. Test KA/EN canonical and reciprocal hreflang metadata.

- [ ] **Step 2: Add the regional message scope and exact bilingual inventory**

Add `regionalEconomies` to `MESSAGE_SCOPES` and both server loaders. Create matching key sets for headings, source/accounting notes, map/list labels, picker, two measures, highlights, table/workbook and status. Add the index and representative/detail route family to translation inventory; include all region and sector IDs through existing label catalogues rather than duplicating names in message JSON.

- [ ] **Step 3: Implement server page composition**

Index loads served facts, region/municipality registries, localized presentation and builds the latest-year map/list model. Detail validates `id`, constructs `region.${id}`, filters exactly that region's facts and loads source projections. Both use static generation and contain no client-time database or source fetch.

- [ ] **Step 4: Add thin route wrappers**

The dynamic wrappers expose `generateStaticParams`, `generateMetadata` and call the shared page renderer. Generated IDs are the 11 canonical IDs with `region.` removed. English and Georgian wrappers differ only by locale/import depth.

- [ ] **Step 5: Activate Economy navigation**

Pass regional facts into `buildEconomyHubCards`; set the card href to `/explorer/economy/regions` only when facts exist and derive its footer/latest headline from facts. Add the Regional economies child link under Economy. Do not alter Budget/Inflation active logic or add a second sidebar.

- [ ] **Step 6: Register metadata and sitemap**

Add `regional-economies` to dataset vocabulary with measures `amount_gel` and `share_of_region_gdp_pct`. Index and detail Dataset JSON-LD name the exact spatial coverage and current-price meaning. Add 24 localized explorer URLs (two indexes plus 22 detail pages), derived from the region registry. Do not advertise 2025 or source files that do not exist.

- [ ] **Step 7: Run focused route/localization/SEO tests and commit**

```powershell
npx vitest run tests/explorer/economyHub.test.tsx tests/explorer/regionalEconomiesRoute.test.ts tests/seo/regionalEconomiesMetadata.test.tsx tests/i18n/routes.test.ts tests/seo/sitemapFreshness.test.ts tests/seo/sitemapPresentation.test.ts
npm run i18n:check
npm run typecheck
git add apps/web/app apps/web/lib/pages/regional-econom* apps/web/lib/i18n apps/web/lib/explorer/economyHubCards.ts apps/web/components/shell/data-sidebar.tsx apps/web/lib/seo apps/web/tests/explorer apps/web/tests/i18n apps/web/tests/seo
git commit -m "feat: route regional economy pages"
```

---

### Task 9: Publish methodology and original sources

**Files:**
- Create: `apps/web/lib/methodology/content/regional-economies.ts`
- Create: `apps/web/lib/methodology/content/en/regional-economies.ts`
- Modify: `apps/web/lib/methodology/types.ts`
- Modify: `apps/web/lib/methodology/catalog.ts`
- Modify: `apps/web/lib/methodology/prepareArchives.ts`
- Modify: `apps/web/lib/methodology/sourceManifest.ts`
- Modify: `apps/web/lib/methodology/workbookSources.ts`
- Modify: `apps/web/lib/i18n/messages/ka/methodology.json`
- Modify: `apps/web/lib/i18n/messages/en/methodology.json`
- Modify: `apps/web/tests/i18n/methodologyCoverage.test.ts`
- Modify: `apps/web/tests/methodology/prepareArchives.test.ts`
- Modify: `apps/web/tests/methodology/sourceManifest.test.ts`
- Modify: `apps/web/tests/browser/methodology.spec.ts`
- Modify: `apps/web/tests/browser/bilingual-methodology.spec.ts`

**Interfaces:**
- Consumes: regional source manifest, data methodology and generated archive tooling.
- Produces: live `regional-economies` methodology in both languages and individually downloadable reviewed originals.

- [ ] **Step 1: Write failing methodology/archive tests**

Add `regional-economies` to `LIVE_METHODOLOGY_IDS`, increasing the live set from 7 to 8. Require both articles to contain scope, 11 regions, 2010–2024, GVA/basic-price meaning, GDP/market-price denominator, tax/subsidy explanation, no 2025/real growth/per-capita, the seven publication differences, validation and original source groups.

Require the activity workbook and reused regional-total workbook to resolve to public archive downloads with matching SHA-256 and byte size. The national workbook is validation evidence and should appear only if methodology copy directly cites it; do not duplicate its bytes.

- [ ] **Step 2: Implement bilingual methodology content**

Use the existing section/decision/appendix model. Keep the visible article concise; source-cell mechanics and full reconciliation rows stay in `docs/data-methodology/regional-economies.md` and the validation report.

- [ ] **Step 3: Register source archives**

Teach the existing manifest/archive projector to read the regional manifest's cross-dataset original paths safely. Preserve original filenames and media type. Generated public archives remain gitignored and are prepared in prebuild, never fetched.

- [ ] **Step 4: Prepare and verify archives**

```powershell
npm run data:prepare-methodology-archives
npm run data:check-methodology-archives
npx vitest run tests/i18n/methodologyCoverage.test.ts tests/methodology/prepareArchives.test.ts tests/methodology/sourceManifest.test.ts
```

- [ ] **Step 5: Commit methodology/source integration**

```powershell
git add apps/web/lib/methodology apps/web/lib/i18n/messages/*/methodology.json apps/web/tests/i18n/methodologyCoverage.test.ts apps/web/tests/methodology apps/web/tests/browser/methodology.spec.ts apps/web/tests/browser/bilingual-methodology.spec.ts
git commit -m "docs: publish regional economy methodology"
```

---

### Task 10: Add read-only regional queries and central data publications

**Files:**
- Create: `apps/web/lib/factQuery/regionalEconomySeries.ts`
- Create: `apps/web/lib/factQuery/queryRegionalEconomies.ts`
- Create: `apps/web/lib/mcp/schemas.regional-economies.ts`
- Create: `apps/web/tests/factQuery/queryRegionalEconomies.test.ts`
- Create: `apps/web/tests/data/regionalEconomies/publication.test.ts`
- Modify: `apps/web/lib/factQuery/types.ts`
- Modify: `apps/web/lib/factQuery/buildSnapshot.ts`
- Modify: `apps/web/lib/factQuery/describeCoverage.ts`
- Modify: `apps/web/lib/factQuery/getSources.ts`
- Modify: `apps/web/lib/factQuery/publications.ts`
- Modify: `apps/web/lib/factQuery/localization.ts`
- Modify: `apps/web/lib/mcp/tools.ts`
- Modify: `apps/web/lib/mcp/outputSchema.ts`
- Modify: `apps/web/lib/mcp/instructions.ts`
- Create: `apps/web/scripts/prepare-regional-economies-public.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/pages/connect.tsx`
- Modify: `apps/web/lib/i18n/messages/ka/connect.json`
- Modify: `apps/web/lib/i18n/messages/en/connect.json`
- Modify: `apps/web/tests/factQuery/describeCoverage.test.ts`
- Modify: `apps/web/tests/factQuery/publications.test.ts`
- Modify: `apps/web/tests/factQuery/bilingualPublications.test.ts`
- Modify: `apps/web/tests/factQuery/reference.test.ts`
- Modify: `apps/web/tests/seo/agentFiles.test.ts`
- Modify: `apps/web/tests/seo/connect.test.tsx`
- Modify: authored `apps/web/public/llms.txt` through its existing source/generation path.

**Interfaces:**
- Consumes: canonical regional facts and existing snapshot/source/localization infrastructure.
- Produces: dataset ID `regional-economies`, snapshot branch `regionalEconomies`, MCP tool `query_regional_economies`, `/downloads/data/regional-economies.json` and `.csv`.

- [ ] **Step 1: Write failing query tests**

Define query measures:

```ts
export const REGIONAL_ECONOMY_QUERY_MEASURES = {
  amount_gel: "nominal",
  share_of_region_gdp_pct: "share_of_region_gdp",
} as const;
```

Test one/many region IDs, one/many series IDs, explicit years/ranges, missing/out-of-range years, unknown IDs, expected data version, percent scale, true zero, source metadata and response-size limits. Verify the query never returns a national-share or growth measure.

- [ ] **Step 2: Extend the snapshot schema and builder**

Add `"regional-economies"` to `DatasetId`, `"share_of_region_gdp_pct"` to `Measure`, and:

```ts
regionalEconomies: {
  facts: RegionalEconomyObservation[];
  regions: MunicipalRegion[];
  registry: SectorDefinition[];
  definitions: typeof REGIONAL_ECONOMY_DEFINITIONS;
};
```

Change `SCHEMA_VERSION` from `1.1.0` to `1.2.0`. Sort facts by region, series, measure and year. Hash definitions and localization into `dataVersion`; release commit/generated time remain excluded as today.

- [ ] **Step 3: Implement coverage and the dedicated query**

`describe_coverage` reports 2010–2024, 11 region entities, Total plus 20 series, two measures and bilingual accounting notes. `query_regional_economies` accepts optional bounded `regionIds`, `seriesIds`, `years`, `fromYear`, `toYear`, one measure and `expectedDataVersion`. It uses snapshot data only and returns explicit missing cells rather than zero.

- [ ] **Step 4: Register the twelfth MCP tool**

Add the strict Zod schema and tool descriptor. The description states current prices, GVA versus GDP, percentage-point scale, source coverage, no 2025, no real growth/per-capita and no multi-region chart implication. Expected tool count becomes 12; derive this from the tool registry wherever possible.

- [ ] **Step 5: Generate central CSV/JSON from the snapshot**

Public CSV header:

```text
region_id,region_name_ka,region_name_en,series_id,series_name_ka,series_name_en,year,measure,value,unit,valuation,price_basis,status,source_id
```

JSON must include all 6,930 available cells and definitions; it must not create unavailable growth/per-capita cells. Add prepare/check scripts to prebuild/postbuild in the same order as snapshot generation:

```json
"data:prepare-regional-economies-public": "tsx scripts/prepare-regional-economies-public.ts",
"data:check-regional-economies-public": "tsx scripts/prepare-regional-economies-public.ts --check"
```

- [ ] **Step 6: Update discovery surfaces and reference safety**

Add data-derived regional coverage, file links, methodology and tool guidance to Connect and `llms.txt`. Update explicit catalogue/source/tool/route inventory assertions only by the verified additions. Run the unchanged 20-intent fixture; regional additions must not change prior expected answers.

- [ ] **Step 7: Run focused publication/query checks and commit**

```powershell
npx vitest run tests/factQuery/queryRegionalEconomies.test.ts tests/factQuery/describeCoverage.test.ts tests/factQuery/publications.test.ts tests/factQuery/bilingualPublications.test.ts tests/data/regionalEconomies/publication.test.ts tests/seo/agentFiles.test.ts tests/seo/connect.test.tsx
npx vitest run tests/factQuery/reference.test.ts
npm run data:prepare-fact-query-snapshot
npm run data:prepare-regional-economies-public
npm run data:prepare-fact-query-publications
npm run data:check-regional-economies-public
npm run data:check-fact-query-publications
git add apps/web/lib/factQuery apps/web/lib/mcp apps/web/scripts/prepare-regional-economies-public.ts apps/web/package.json apps/web/lib/pages/connect.tsx apps/web/lib/i18n/messages/*/connect.json apps/web/public/llms.txt apps/web/tests
git commit -m "feat: publish regional economy data"
```

---

### Task 11: Complete browser coverage and product documentation

**Files:**
- Create: `apps/web/tests/browser/regional-economies.spec.ts`
- Modify: `apps/web/tests/browser/bilingual-complete.spec.ts`
- Modify: `apps/web/tests/browser/bilingual-controls.spec.ts`
- Modify: `apps/web/tests/browser/bilingual-navigation.spec.ts`
- Modify: `apps/web/tests/browser/bilingual-workbooks.spec.ts`
- Modify: `apps/web/tests/browser/seo.spec.ts`
- Modify: `Project_Definition.md`
- Modify: `DESIGN.md`
- Modify: `docs/superpowers/plans/2026-09-13-regional-economies.md` only to append actual execution evidence.

**Interfaces:**
- Consumes: complete local feature from Tasks 1–10.
- Produces: end-to-end acceptance evidence and durable scope/design documentation.

- [ ] **Step 1: Write route and interaction browser tests**

Cover:

- KA/EN All Regions index at 390, 768, 900, 1100 and 1440px.
- Exactly 11 map targets and list rows; search, hover/focus coordination and correct destination.
- Latest year/value agreement across map, tooltip and ranking.
- Direct navigation to every one of the 11 localized region pages.
- Default Total-only nominal chart and exactly two measure buttons.
- GEL/share switching, line/table, range, unlimited selection, clear/select-all, empty/no-match states, hash reload, language switch and back/forward.
- Imereti and Racha representative values, one true-zero activity, Total share 100%, and share denominator independence from selection.
- Region picker mouse, touch and keyboard behaviour.
- Excel downloads in both languages and measures, inspected for sheets, types, values, statuses and source hyperlinks.
- Accounting note, no 2025, no national-share/growth/per-capita copy.
- No document overflow, clipped labels, hidden values, console errors or hydration errors.

- [ ] **Step 2: Update only intentional inventory assertions**

Add 24 explorer pages and two methodology pages to bilingual/SEO inventories. Coming-soon Economy cards decrease by one; live methodology IDs increase by one; MCP tools increase by one; central publications increase by two. Where tests calculate from registries, change no numeric literal. Where a test intentionally pins inventory, use the verified before/after count and include a comment naming the regional addition.

- [ ] **Step 3: Update durable scope and visual authority**

In `Project_Definition.md` section 2, replace the deferred Regional economies wording with the exact approved feature and retain population/real-growth exclusions. In `DESIGN.md`, add one bounded Regional economies extension that records Municipality-mirror index, one-region pages, the two-button Lucide switch, map/list coordination and approved highlights. Do not add execution logs to either file.

- [ ] **Step 4: Run targeted browser tests against one production build**

```powershell
npm run build
npm run start -- --port 3100
```

In another terminal:

```powershell
$env:CI="1"
$env:NEXT_PUBLIC_SITE_URL="https://fiscal.ge"
$env:PLAYWRIGHT_BASE_URL="http://localhost:3100"
npx playwright test tests/browser/regional-economies.spec.ts tests/browser/bilingual-navigation.spec.ts tests/browser/bilingual-workbooks.spec.ts
```

Inspect desktop/mobile screenshots for the approved structure and real verified map. Stop only the server started for this task after confirming its PID/port.

- [ ] **Step 5: Run the final repository gates once**

From `apps/web`, after all implementation inputs have stopped changing:

```powershell
npm run check
npm run build
$env:CI="1"
$env:NEXT_PUBLIC_SITE_URL="https://fiscal.ge"
$env:PLAYWRIGHT_BASE_URL="http://localhost:3100"
npx playwright test
```

Expected: lint, strict types, all unit/data/localization checks, static build, publication checks and the complete browser suite pass. If one unchanged network-source download flakes, rerun that exact case without edits and report both results; do not rerun the full gate whose inputs did not change.

- [ ] **Step 6: Review the final diff against the spec**

Confirm no schematic preview asset, copied standalone CSS, USD, population, real-growth, national-share, 2025 estimate, multi-region overlay, homepage edit, new dependency or runtime source fetch entered production. Confirm existing national Sectors, Municipality map, Budget, GDP and Inflation focused tests still pass.

- [ ] **Step 7: Commit verification documentation**

Append actual commands/counts/results and any explicit unverified boundary to this plan. Then:

```powershell
git add Project_Definition.md DESIGN.md docs/superpowers/plans/2026-09-13-regional-economies.md apps/web/tests/browser
git commit -m "test: verify regional economies explorer"
```

---

### Task 12: Independent review and authorized release boundary

**Files:**
- Modify only confirmed defects attributable to this feature.
- Do not modify plan/spec checkboxes merely to imply delivery.

**Interfaces:**
- Consumes: completed Tasks 1–11 and clean verification evidence.
- Produces: reviewed branch ready for a separately authorized GitHub/production release.

- [ ] **Step 1: Perform scoped specification review**

Review source/data correctness separately from UI/export and query/publication behaviour. Classify findings as Critical, Important or Minor. Verify each claimed issue against code/data before editing.

- [ ] **Step 2: Resolve confirmed findings with failing-first targeted tests**

For each confirmed finding, add the narrowest reproducer, run it failing, make the smallest correction and rerun only affected checks. Do not refactor unrelated shared code.

- [ ] **Step 3: Reconfirm branch and artifact state**

```powershell
git status --short --branch
git diff --check origin/main...HEAD
git log --oneline --decorate origin/main..HEAD
```

Report exact branch, commits, verification results and the fact that production remains unchanged.

- [ ] **Step 4: Stop unless publication is explicitly authorized**

When the user authorizes publication, follow `docs/deployment.md` and the mandatory sequence:

```text
codex/regional-economies
→ push
→ draft PR
→ required CI green
→ independent review and resolved conversations
→ ready/merge
→ Actions-owned database import and Vercel deployment
→ verify deployed commit, KA/EN index and region pages, methodology, downloads, MCP and publication hashes
→ synchronize intended checkout and remove the feature branch safely
```

Do not treat a commit, pushed branch, merged PR, accepted deploy hook or green workflow alone as live-production proof.

---

## Plan self-review checklist

- Spec sections 1–4: Tasks 1–3 establish source, identities, accounting and exact coverage.
- Spec section 5: Tasks 2 and 5 define the two measures, state and numerical boundaries.
- Spec section 6: Task 6 implements the All Regions map/list index.
- Spec sections 7–8: Tasks 5 and 7 implement the selected-region workspace and component reuse.
- Spec section 9: Tasks 3–4 implement canonical data, validation and database parity.
- Spec section 10: Tasks 5, 9 and 10 implement Excel, methodology, MCP and central publications.
- Spec section 11: Tasks 11–12 provide full acceptance, review and release boundaries.
- No task authorizes excluded national-share, real-growth, per-capita, 2025, USD, multi-region or homepage work.
- Every produced interface is defined before a later task consumes it.
- Final execution records must contain observed results, not assumed counts or checked boxes used as evidence.

## Execution evidence — 2026-09-13

- Preserved the two public regional workbooks byte-for-byte: regional totals `dd2042dff5e2c44b98b4bb140163b5736cf5a71f4683b9e6a359373907d59c35` (13,871 bytes) and activities `88e337bd82a5232ea5260f011b11cb2d82c2cec5115fddbe92d14d1ff3945337` (99,089 bytes).
- Generated and fixed-point checked 6,930 canonical observations: 11 regions × 21 series × 15 years × 2 measures. All 165 regional totals, 3,300 activity amounts and 495 reconciliation records passed the 0.01 GEL controls; the seven documented national/regional publication differences remain explicit.
- Added database mirror schema/import/parity code. No disposable database verification was possible because this checkout has no `.env` or `.env.local`; no production database was contacted.
- Added Georgian and English index/detail routes, the two-measure explorer, Excel export, methodology/original archives, Dataset JSON-LD, central JSON/CSV files and `query_regional_economies`. After synchronization with the inflation MCP release, the combined MCP schema version is 1.3.0 and the registered read-only tool count is 13.
- Focused unit/integration verification passed: Task 10 suite 137/137; unchanged reference-intent suite 35/35; methodology suite 71/71. The final `npm run check` passed 242 test files and 2,086 tests, plus lint, typecheck, localization and every data/archive fixed-point check.
- Production build passed and prerendered 233 static pages, including both regional indexes, 22 localized detail pages and eight localized methodology pages. Postbuild verified 16 publications, 6,930 regional CSV rows and matching manifest hashes.
- Real-browser verification found and fixed two feature defects: a client import reached `node:fs`, and the English table/workbook path omitted the Total regional GDP label. The final complete production-build browser suite passed 548/548. Regional screenshots were inspected at 1440px and 390px; the mobile document width equalled the viewport width (390px), with no error overlay.
- Work remains on the feature branch only. No push, pull request, merge, database import, deployment or production verification was authorized or performed.

## Release integration evidence — 2026-09-19

- Synchronized the feature branch with `origin/main` at `c7451ceaf`, preserving both the regional-economies work and the already-merged inflation categories/MCP release. The combined contract uses schema 1.3.0, 13 read-only MCP tools, 19 publication artifacts, 130 resolved sources and 113 bilingual page identities.
- The full parallel unit run passed 261 files and 2,248 tests; the known heavy 2004 PDF setup exceeded its 60-second parallel hook limit, then passed 7/7 alone with one worker and a 120-second limit. Lint, strict types, every data/archive fixed-point check and localization passed.
- The production build passed and prerendered 235 static pages. Postbuild verified all 19 publication hashes, including 6,930 regional-economy rows and the synchronized inflation publications.
- The complete Playwright run passed 564/570 while six unrelated long-running cases hit their 30-second limits under four-worker contention; those exact six cases then passed 6/6 alone with one worker and a 120-second limit. The regional acceptance matrix covers five responsive widths, all 22 localized detail routes, map/list coordination, keyboard navigation, state persistence, exact/zero values and bilingual nominal/share workbooks.
- Publishing was explicitly authorized. PR #121 was created from `codex/regional-economies`; the production database import, DB-mode build, Vercel deployment and live checks remain release-pipeline evidence rather than local evidence.
