# National Economic Sectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the bilingual national Economic sectors explorer for 2010–2025, with one existing-design workspace switching between nominal GEL, GDP share and annual real growth.

**Architecture:** Review and normalize Geostat observations offline, mirror reviewed CSVs transactionally, and serve them at build time. A sector-specific model connects those facts to the existing chart, table, range, selector and workbook components. The existing snapshot/MCP and static publication pipeline exposes the same observations with their sources and accounting definitions.

**Tech Stack:** Existing Next.js 16 / React / strict TypeScript, editorial components, Tailwind v4, SheetJS, Decimal.js, CSV tooling, Prisma/Postgres, Vitest and Playwright. No new UI, chart or data-processing library.

---

## Authority and execution boundaries

Specification: [National economic sectors](../specs/2026-09-11-economic-sectors-design.md). The user requested this plan on 2026-09-11 and subsequently authorized implementation in the same session. Unchecked tasks are not completion evidence. Publishing is not authorized.

Read `AGENTS.md`, `Project_Definition.md` section 2, `DESIGN.md`, `CLAUDE.md`, `docs/data-methodology/gdp-overview.md`, and `docs/data-methodology/database-import.md` before execution. Read `docs/deployment.md` before any authorized release. Consult Context7 for current external library/CLI APIs before adding code that depends on them; project-specific examples below are contracts to implement, not a replacement for API verification.

Use the existing dedicated checkout. Check Git state before creating the implementation branch; use a `codex/` branch and preserve both planning documents and unrelated changes. Do not reset or recreate the checkout. At preparation time the sector spec is an untracked document; application implementation has not started.

The preview is discarded as a visual reference. Its dark selector, invented lines, selected-five default, cards, font choices and custom spacing must not enter production. Compare against the current Budget explorer and Economy overview.

All paths below are repository-relative; commands run from `apps/web` unless explicitly stated otherwise. `Create` paths are proposed new files, not claims that they already exist. Use `apply_patch` for authored files; canonical output files are produced by the preparation commands.

## Delivery order and file boundaries

Tasks 1–4 establish sources, reviewed facts and the database mirror. Tasks 5–8 assemble and expose the page with existing components. Tasks 9–10 complete AI/data discovery. Tasks 11–12 prove the result and document it. Task 13 is release work only when publishing is authorized.

The feature remains one deliverable. Data review can proceed before UI integration, and methodology/localization can proceed once the source contract is fixed. Do not run simultaneous edits to shared registries, message loaders, `package.json`, the import script or snapshot types.

| Responsibility | New files or existing owners |
|---|---|
| Archived source evidence | `docs/Raw Data/Economy/economic-sectors/source-manifest.json`, `source-review.md`, `sources/` |
| Activity identities and reviewed names | `data/taxonomy/economic-sectors.json`; English labels in `data/localization/en/labels.json` |
| Extraction, formulas, validation, loading | `apps/web/lib/data/economicSectors/{types,calculations,prepareEconomicSectors,validation,importEconomicSectors}.ts` |
| Reviewed observations and reports | `data/imports/economic-sectors-annual.csv`, `data/staging/economic-sectors-reconciliation.csv`, `data/reports/economic-sectors-validation.json` |
| Database mirror | Existing `prisma/schema.prisma`, `lib/db/mirrorRows.ts`, `lib/db/servedDataDb.ts`, `scripts/import-budget-facts.ts` |
| Pure explorer state/model | `apps/web/lib/explorer/economicSectors.ts`, `economicSectorsWorkbook.ts` |
| Feature composition | `apps/web/components/economic-sectors/economic-sectors-explorer.tsx`, `sector-series-panel.tsx`, `use-economic-sectors-state.ts` |
| Localized server page | `apps/web/lib/pages/economic-sectors.tsx`; thin KA/EN route files |
| Bilingual messages | `apps/web/lib/i18n/messages/ka/sectors.json`, `en/sectors.json`; existing inventory and catalogue files |
| Methodology/archive | Existing methodology registries plus `content/economic-sectors.ts`, `content/en/economic-sectors.ts`, `data/methodology/source-archives/economic-sectors.csv` |
| Query/publication | `apps/web/lib/factQuery/queryEconomicSectors.ts`, `economicSectorsSeries.ts`; existing snapshot, discovery, MCP and publication owners |

Reused components: `PageHeader`, explorer shell/footer, `SegmentedTabs`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesSelector`, `SeriesSelectorRow`, `HorizontalScrollHint`, `Callout`, `SourceNote`, `SwatchBar`, `ExcelDownloadButton`, and the existing XLSX writer. Do not create sector versions of these shared renderers.

## Task 1: Resolve and document the real-growth source

**Create:** `docs/Raw Data/Economy/economic-sectors/source-manifest.json`, `docs/Raw Data/Economy/economic-sectors/source-review.md`, and missing official originals inside `docs/Raw Data/Economy/economic-sectors/sources/`.

**Read/reuse:** `docs/Raw Data/Economy/gdp-overview/source-manifest.json`, `sources/geostat_nominal_current.xlsx` under that directory, and `apps/web/lib/data/gdpOverview/prepareGdpOverview.ts`.

- [x] Inspect the archived nominal workbook and confirm the 20 A–T rows, annual headers, basic-price total, product taxes/subsidies and market-price GDP. Record exact sheet/cell mappings, original values, source precision and preliminary markers in `source-review.md`.
- [x] Open Geostat's official GDP page and inspect the actual downloaded activity-level constant-price/growth workbooks. Preserve the selected originals unchanged. Do not assume a file called “Real GDP Growth” includes sector rows.
- [x] Produce an activity × year coverage matrix for nominal and real growth, separately including the national reference. Record the real source's classification, price/volume basis, annual-versus-quarterly layout, release/capture dates, unit, revision status and source locators.
- [x] Resolve 2010 growth availability explicitly: look for a published rate or comparable 2009/2010 volume inputs, and record exact gaps when neither exists. Inspection found neither compatible source for2010. The public date-range decision remains pending; never use nominal change or average/sum sector rates as a fallback.
- [x] Check the real and nominal release vintages. Retain the existing nominal snapshot unless a source mismatch requires a deliberate reviewed replacement; do not overwrite shared GDP originals or change existing GDP overview/Budget data silently. Document any national Geostat growth difference from the overview's World Bank series.
- [x] Record source URL, unchanged filename, byte size, SHA-256, release/capture dates and extraction mapping in the manifest. Reference the existing nominal original by its repository path rather than copying identical bytes into another archive folder.
- [x] Record source-specific reconciliation and growth-check tolerances from published precision before running those comparisons. A tolerance is not an import-parity tolerance: database parity remains exact.

**Completion evidence:** a reviewed mapping for all 20 activities plus GDP and a measured annual growth-coverage matrix. If growth observations required by the spec cannot be obtained, record exact missing cells and the alternatives investigated; continue independent nominal preparation, but do not mark the three-measure feature complete or invent missing data. This evidence-producing task resolves the presently unknown workbook layout before extraction code is written.

**Checkpoint commit:** source originals, manifest and review only; message `data: archive national sector source evidence`.

## Task 2: Define identities, decimal calculations and observation validation

**Create:**

- `data/taxonomy/economic-sectors.json`
- `apps/web/lib/data/economicSectors/types.ts`
- `apps/web/lib/data/economicSectors/calculations.ts`
- `apps/web/lib/data/economicSectors/validation.ts`
- `apps/web/tests/data/economicSectors/calculations.test.ts`
- `apps/web/tests/data/economicSectors/validation.test.ts`

- [x] Define the 20 official activities in A–T order, with stable `sector.a` … `sector.t` identities and `economy.gdp_total` as the separate reference. Include official names, Georgian display labels, classification code and fixed sort order. Check translated labels against official terminology; do not map activities to budget categories.
- [x] Establish this canonical observation contract in `types.ts`. Task3 will persist all three measures in the reviewed output so every surface consumes one reviewed calculation, rather than independently recomputing shares:

```ts
export type SectorMeasure = "nominal" | "share_of_gdp" | "real_growth";
export type SectorStatus = "published" | "preliminary";
export type SectorObservation = {
  seriesId: string; // validator restricts this to the reviewed registry
  year: number;
  measure: SectorMeasure;
  value: string; // canonical decimal; percentages use 7.5 for 7.5%
  unit: "gel" | "percent";
  valuation: "basic_prices" | "market_prices";
  priceBasis: "current_prices" | "volume_change";
  calculation: "published" | "ratio_to_gdp" | "year_over_year" | "index_to_growth";
  status: SectorStatus;
  sourceId: string;
  sourceLocator: string; // all contributing cells for a calculated observation
  lastReviewedAt: string;
};
export type ServedSectorObservation = Omit<SectorObservation, "value"> & {
  value: number;
};
```

For GDP-share observations, `valuation` describes the numerator; the `ratio_to_gdp` definition fixes the denominator as same-year market-price GDP. Source locators retain both contributing cells. Calculate ratios from same-workbook inputs. Calculated growth retains both year locators from the compatible volume series. If Task 1 establishes inputs spanning multiple originals, extend provenance to retain all inputs before normalization; never discard a supporting source to fit this singular-source contract.

- [x] Write calculation tests before the functions, including the following exact examples:

```ts
import { expect, test } from "vitest";
import { sharePercent, annualGrowthPercent } from "../../../lib/data/economicSectors/calculations";

test("GDP share is percent, using the full GDP denominator", () => {
  expect(sharePercent("15", "120")).toBe("12.5");
  expect(sharePercent("120", "120")).toBe("100");
  expect(sharePercent("0", "120")).toBe("0");
  expect(sharePercent("15", null)).toBeNull();
  expect(sharePercent("15", "0")).toBeNull();
});
test("annual real growth retains contraction and missing history", () => {
  expect(annualGrowthPercent("90", "100")).toBe("-10");
  expect(annualGrowthPercent("100", "100")).toBe("0");
  expect(annualGrowthPercent("90", null)).toBeNull();
  expect(annualGrowthPercent("90", "0")).toBeNull();
});
```

Run `npx vitest run tests/data/economicSectors/calculations.test.ts`; first confirm failure from the absent functions, then implement:

```ts
import Decimal from "decimal.js";
const D = Decimal.clone({ precision: 50 });
const canonical = (value: Decimal) => value.toDecimalPlaces(20).toFixed();
export function sharePercent(value: string | null, gdp: string | null): string | null {
  if (value === null || gdp === null || new D(gdp).lte(0)) return null;
  return canonical(new D(value).div(gdp).mul(100));
}
export function annualGrowthPercent(current: string | null, previous: string | null): string | null {
  if (current === null || previous === null || new D(previous).lte(0)) return null;
  return canonical(new D(current).div(previous).minus(1).mul(100));
}
```

Inputs are validated finite decimals before these helpers. The explicit 20-place rule applies to calculated values; preserve published source precision and prove it fits the mirror before import. A null calculation creates a recorded gap, not a zero-valued canonical row.

Source-discovery correction: the chosen growth original publishes previous-year=100 indices. `indexToGrowthPercent` subtracts100 exactly and observations record `index_to_growth`. Keep the canonical observation flat. Checks requiring original input values (index conversion, compatible adjacent volume inputs and their status) belong to Task3 preparation, not to duplicated nested fields in canonical/served observations.

- [x] Implement `validateSectorObservations(facts, registry)` in `validation.ts`. Test rejection of duplicate series/measure/year, unknown ID, a quarter used as a year, out-of-scope year, non-finite/empty value, missing provenance/date, wrong measure/unit, wrong valuation for the GDP reference, incorrect calculation/price basis, or unsupported status. Missing cells are separately reported; observed zero and negative growth remain valid.
- [x] Validate same-year nominal/share pairs and status propagation from numerator and denominator. Require one separately sourced GDP growth observation where available; never create it by aggregation. Source-input checks that make a derived rate preliminary when either volume input is preliminary are assigned to Task3 preparation, as clarified above.
- [x] Run `npx vitest run tests/data/economicSectors/calculations.test.ts tests/data/economicSectors/validation.test.ts`. Expected: every positive/negative fixture passes its stated acceptance/rejection.

**Checkpoint commit:** registry, types, calculations and tests; message `feat: define reviewed economic sector observations`.

## Task 3: Prepare canonical CSVs and reproducible validation reports

**Create:** `apps/web/lib/data/economicSectors/prepareEconomicSectors.ts`, `apps/web/scripts/prepare-economic-sectors.ts`, `apps/web/tests/data/economicSectors/prepareEconomicSectors.test.ts`, the three generated CSV/report files listed in the file map, and `docs/data-methodology/economic-sectors.md`.

**Modify:** `apps/web/package.json`.

- [ ] Add a preparation test that extracts the real archived originals and checks the reviewed mappings from Task 1. Use small generated workbook fixtures for duplicate annual headers, shifted/missing activity rows, quarterly-only headers, incorrect totals, source-hash mismatch and missing 2010 growth support. The nominal workbook must yield 320 activity amounts plus 16 GDP reference amounts.
- [ ] Implement `prepareEconomicSectors(repositoryRoot)` to verify source hashes before parsing, select annual headers, extract all registry rows, normalize source units with decimals, and generate GDP shares using Task 2. Growth extraction follows the exact mapping established in Task 1. Never fetch upstream sources inside this function.
- [ ] Produce a staging row per year with summed sector GVA, published basic-price total, product taxes, subsidies, market-price GDP, both reconciliation differences and the predeclared precision tolerance. Test every year, not just 2025. Require nominal GDP parity with the existing full-precision overview; preserve the separate Budget denominator unchanged.
- [ ] Produce a validation report with source hashes, counts by measure/status, activity/year coverage, missing cells, growth-check evidence, source vintage and reconciliation results. If complete, expected available observations are 336 per measure / 1,008 total; calculate the actual growth count and never manufacture rows to reach that target.
- [ ] Serialize the reviewed observation fields in stable series/measure/year order, with BOM and normal CSV escaping. Serialize status and source locators without stripping asterisks/notes before their meaning is captured. `--write` produces the reviewed outputs; `--check` reproduces them in memory and compares exact bytes without writing.
- [ ] Add these script entries; append only the new check to the existing validation chain:

```json
"data:prepare-economic-sectors": "tsx scripts/prepare-economic-sectors.ts --write",
"data:check-economic-sectors": "tsx scripts/prepare-economic-sectors.ts --check"
```

- [ ] Run `npx vitest run tests/data/economicSectors/prepareEconomicSectors.test.ts`, then `npm run data:prepare-economic-sectors`, then `npm run data:check-economic-sectors`. Expected: byte-identical regeneration and successful annual reconciliations. Review the generated diff, including the smallest sector and preliminary-year flags.
- [ ] Document formulas, basis/valuation, source releases, units, 2010 growth support, rounding, missing cells and reproduction commands in the methodology document.

**Checkpoint commit:** reviewed data, preparation/check code and evidence; message `data: prepare and reconcile national economic sectors`.

## Task 4: Add validated CSV loading and transactional database parity

**Create:** `apps/web/lib/data/economicSectors/importEconomicSectors.ts`, `apps/web/tests/data/economicSectors/importEconomicSectors.test.ts`, `apps/web/tests/data/economicSectors/servingBoundary.test.ts`, `apps/web/prisma/migrations/20260912000000_economic_sectors/migration.sql` (check timestamp uniqueness before creation).

**Modify:** `apps/web/prisma/schema.prisma`, `apps/web/lib/data/servedData.ts`, `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `data/sources/source-documents.csv`, `docs/data-methodology/database-import.md`.

- [ ] Implement `loadEconomicSectorFacts()` returning validated decimal-string observations; `assertEconomicSectorParity(csv, db)` using `assertSameServedRows` keyed by `seriesId:measure:year`; and `loadServedEconomicSectorsData()` accepting only CSV/unset or DB mode and converting values to numbers only after parity.
- [ ] Test parity with reordered rows, and rejection of a changed decimal, status, unit, locator, missing row or duplicate key. Test that the serving loader depends on the pure validator, never the workbook preparation module.
- [ ] Add `EconomicSectorFact` with compound key `[seriesId, measure, year]`, `Decimal(40,20)` value, all Task 2 metadata, source-document relation and import-run relation. Mirror the existing `GdpOverviewFact` pattern and validate published values fit exactly before saving. Add inverse relations to `SourceDocument` and `ImportRun`.
- [ ] Author a migration for the new table and its constraints only. Verify current Prisma diff syntax before use; do not copy the runbook's potentially version-specific flags unverified. Do not run `prisma migrate dev` or reset any database. Include:

```sql
ALTER TABLE "EconomicSectorFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "EconomicSectorFact" FROM anon, authenticated;
```

- [ ] Register new source identities without duplicating existing nominal documents. Add the canonical path to `SERVED_DATA_FILES`. Load/validate before the transaction; delete sector children before source parents, insert after parents, read back through `loadEconomicSectorFactsFromMirror(tx)`, and assert exact parity before commit. Include the new table's row counts and parity result in `ImportRun` reporting.
- [ ] Add `loadEconomicSectorFactsFromDb()` using the same mirror mapper. Require source IDs, registry identities and natural keys to validate before any database mutation.
- [ ] Run `npm run prisma:generate`, `npx vitest run tests/data/economicSectors/importEconomicSectors.test.ts tests/data/economicSectors/servingBoundary.test.ts`, and `npm run typecheck`. Actual disposable-database proof is Task 11; unit parity alone is not that proof.

**Checkpoint commit:** mirror integration and tests; message `feat: mirror economic sector facts with exact parity`.

## Task 5: Implement pure explorer state and presentation adapters

**Create:** `apps/web/lib/explorer/economicSectors.ts`, `apps/web/tests/explorer/economicSectors.test.ts`.

**Read:** `apps/web/lib/explorer/gdpOverview.ts`, `format.ts`, `colors.ts`, `types.ts`, and the shared chart/table prop contracts.

- [ ] Define `SectorState` and defaults; establish hash keys `measure`, `view`, `range`, `start`, `end`, `sel`. `sel=` is an explicit empty selection; an absent `sel` defaults to GDP. Use these pure function boundaries:

```ts
export type SectorState = {
  measure: "nominal" | "share_of_gdp" | "real_growth";
  mode: "line" | "table";
  range: { kind: "all" } | { kind: "manual"; start: number; end: number };
  selectedIds: string[];
};
export const DEFAULT_SECTOR_STATE: SectorState = {
  measure: "nominal", mode: "line", range: { kind: "all" },
  selectedIds: ["economy.gdp_total"],
};
```

Implement `parseSectorHash(hash, validIds)`, `serializeSectorHash(state)`, `changeSectorMeasure(state, measure, facts)`, and `buildEconomicSectorsModel(facts, registry, state)`. The model returns resolved range, available/visible years, selected chart/table rows, reference headline, per-row end-year values, observation statuses and source IDs. Keep browser effects out of this file.

- [ ] First test the following state contracts, then implement the functions with existing GDP range/hash patterns:

```ts
expect(parseSectorHash("", ids).selectedIds).toEqual(["economy.gdp_total"]);
expect(parseSectorHash("#sel=", ids).selectedIds).toEqual([]);
expect(parseSectorHash("#sel=sector.a,sector.a,unknown", ids).selectedIds).toEqual(["sector.a"]);
expect(parseSectorHash(serializeSectorHash(state), ids)).toEqual(state);
```

Here `ids` is the registry's ID list and `state` is a complete valid `SectorState` fixture. Additional fixtures cover reversed/invalid ranges, unknown modes/measures, no-overlap fallback and all/manual range transitions. Range coverage is independent of selected rows.

- [ ] Model a small numerical fixture: GDP 120, A 15, B 45, total GVA 60 and net product taxes 60. Assert A's share is 12.5%, B's 37.5%, and GDP's 100%, with unchanged values when B/GDP are deselected. Use calculated share observations from Task 2, not another UI formula.
- [ ] Verify that a canonical 7.5 growth/share observation becomes chart value 7.5 and table value 0.075. Nominal values remain full GEL before formatting. A single-year 2020 selection retains the published 2020 annual contraction. Missing end-year row values stay missing even when older years exist.
- [ ] Assign deterministic, distinct colors for all activities using the existing color utilities and contrast rules; pin reviewed mappings to IDs. Keep GDP ink. Test color stability under filtering, language, measure and selection changes, and ensure the 20 activities do not repeat the 14-color palette blindly.
- [ ] Use the existing unit/threshold formatters, calculated from the full nominal scope rather than the current selection. Test the smallest nonzero household observation is not displayed as numeric zero. The headline is the national reference's latest available point inside the active range, independently of sector selection.
- [ ] Run `npx vitest run tests/explorer/economicSectors.test.ts`. Expected: state round-trips, percentage units and selection-independent accounting all pass.

**Checkpoint commit:** model/state and tests; message `feat: model national sector explorer measures and state`.

## Task 6: Add bilingual messages and reuse the selector/chart workspace

**Create:** `apps/web/components/economic-sectors/economic-sectors-explorer.tsx`, `sector-series-panel.tsx`, `use-economic-sectors-state.ts` in that directory; `apps/web/lib/i18n/messages/ka/sectors.json`, `en/sectors.json`; `apps/web/tests/explorer/economicSectorsPresentation.test.tsx`.

**Modify:** `apps/web/lib/i18n/types.ts`, `messages.server.ts`, `inventory.server.ts`, `data/localization/en/labels.json`. Narrow shared status extensions, if needed: `apps/web/components/main-explorer/editorial-line-chart.tsx` and `explorer-table.tsx` with their affected tests.

- [ ] Add the `sectors` message scope and the 21 English labels to the existing inventories. Cover H1, reference caption, active units, current-price/GVA context, annual real-growth meaning, GDP-share accounting note, preliminary status, sources, row-value year and workbook copy. Reuse existing common/controls/format messages instead of duplicating them.
- [ ] Implement the state hook with validated hash restore, navigation-event subscription and cleanup, shareable updates, and protection against initial hydration overwriting a valid hash. Back/forward and language switching restore compatible state. Keep selector search local to the panel so typing does not rebuild chart data.
- [ ] Compose the same paper workspace and container breakpoints as `components/main-explorer/explorer-view.tsx`. Use existing shell/header/footer ownership; do not create another sidebar. Keep Line/Table left and this existing-control composition right:

```tsx
<SegmentedTabs
  ariaLabel={t("measure")}
  value={state.measure}
  onChange={onMeasureChange}
  options={[
    { value: "nominal", label: "₾", ariaLabel: t("nominal") },
    { value: "share_of_gdp", label: t("shareOfGdp") },
    { value: "real_growth", label: t("realGrowth") },
  ]}
/>
```

`t` resolves the new message scope and `onMeasureChange` calls Task 5's state transition. No top-level indicator tabs or currency mode are added. Pass the model's selected series, appropriate percent flag/label and existing units into `EditorialLineChart`; use `ExplorerTable` with `showChangeColumn={false}` and no trailing share column.

- [ ] Implement the panel with `SeriesSelector` and `SeriesSelectorRow`: GDP pinned first; A–T stable order; search over KA/EN/code; clear/select-all over all 21 rows; count unaffected by search; values for the active end year. Attach the dataset-owned Excel action below it. Keep selected rows paper/tint, never ink-backed.
- [ ] Preserve full labels for accessible names and exact table/tooltip information. Add optional per-observation preliminary flags to the shared chart/table only if their current year-wide props cannot express mixed status. The optional additions must leave existing callers' behavior unchanged; do not pretend preliminary is planned or forecast.
- [ ] Add component checks for total-only default, all 20 activities, no top tabs, empty-selection/no-data callouts, selector order and end-year missing value. Verify negative domains, isolated points and gaps through the existing renderer rather than writing custom SVG.
- [ ] Run `npx vitest run tests/explorer/economicSectorsPresentation.test.tsx tests/explorer/economicSectors.test.ts`, followed by `npm run i18n:check` once the relevant page/source inventory entries are in place. Expected: correct localized controls, stable selections and no missing translation entries.

**Checkpoint commit:** component composition and bilingual messages; message `feat: assemble economic sectors with existing explorer components`.

## Task 7: Implement the three-sheet sector Excel export

**Create:** `apps/web/lib/explorer/economicSectorsWorkbook.ts`, `apps/web/tests/explorer/economicSectorsWorkbook.test.ts`.

**Read/reuse:** `apps/web/lib/explorer/gdpWorkbook.ts`, `workbookModel.ts`, `workbookWriter.client.ts`, `components/explorer/excel-download-button.tsx`.

- [ ] Define `buildEconomicSectorsWorkbookExportModel(facts, registry, state, presentation, sources, siteOrigin)` returning the existing `WorkbookExportModel`. Use Task 5's selected years/rows and active measure. Search is not an input.
- [ ] Test nominal full-GEL data cells, GDP-share fraction formatting plus retained nominal amount, growth fraction formatting without a GEL amount column, selected-only rows, explicit empty selection, gaps/zero, preliminary flags, both languages and source narrowing.
- [ ] Build readable sector-by-year rows and typed analysis rows. Percentages use `value / 100` once; nominal readable cells use the established display divisor while analysis cells retain full GEL. Use the existing sheet names, writer, status labels and filename conventions.
- [ ] Resolve archive links only from reviewed source records. A calculated rate's source entry covers its contributing prior year even when that year is outside the visible export range. A reused nominal original remains one file entry, not duplicate numerator/denominator links.
- [ ] Run `npx vitest run tests/explorer/economicSectorsWorkbook.test.ts tests/explorer/gdpWorkbook.test.ts`. Expected: all measure/locale models have correct units and sources; existing GDP workbooks retain their contract. Task 11 also downloads and opens the actual XLSX outputs.

**Checkpoint commit:** workbook adapter and tests; message `feat: export reviewed economic sector workbooks`.

## Task 8: Register methodology, routes, navigation and SEO together

**Create:** `apps/web/lib/pages/economic-sectors.tsx`, `apps/web/app/(ka)/explorer/economy/sectors/page.tsx`, `apps/web/app/(en)/en/explorer/economy/sectors/page.tsx`, `apps/web/lib/methodology/content/economic-sectors.ts`, `apps/web/lib/methodology/content/en/economic-sectors.ts`, `data/methodology/source-archives/economic-sectors.csv`, `apps/web/tests/explorer/economicSectorsRoute.test.tsx`.

**Modify:** `apps/web/lib/methodology/types.ts`, `catalog.ts`, `sourceInventory.ts`, `content/en/revisions.ts`; `apps/web/lib/explorer/economyHubCards.ts`; `apps/web/lib/pages/economy.tsx`; `apps/web/components/shell/data-sidebar.tsx`, `explorer-footer.tsx`; `apps/web/lib/seo/sitemap.ts`, `datasetVocabulary.ts`; `apps/web/lib/i18n/inventory.server.ts`; `data/localization/en/page-revisions.json`, `sources.json`, `documents.json`; applicable `common.json`, `methodology.json`, `gdp.json` messages in both languages.

- [ ] Register the `economic-sectors` methodology ID and both content objects, using existing dynamic methodology routes. Write concise coverage, GVA/GDP distinction, growth method, preliminary status and known limitations, with unchanged original downloads. No new methodology layout or promotional section in the explorer.
- [ ] Add source-archive records with valid hashes, sizes, source identities and reviewed bilingual descriptions/attribution. Preserve the nominal source's identity when reusing it across archive families; validate deduplication in source resolution. Do not claim an original may be redistributed without checking its applicable source/attribution terms.
- [ ] Implement `economicSectorsPageMetadata(locale)` and `renderEconomicSectorsPage(locale)` using `lib/pages/gdp.tsx` as the server pattern: load served facts, registry, localized presentation and public source projection at build time, then pass only required client props to the feature component.
- [ ] Use thin route wrappers calling those functions. Register canonical/hreflang, the Economy breadcrumb, Dataset metadata with the three explicit measures, and central CSV download URL. Derive coverage/review dates from the sector facts, not a hardcoded page label.
- [ ] Activate the sector hub card and sidebar link; keep regional economics deferred. Derive the new card's coverage/summary from served sector facts. Keep the existing shell, home page content and GDP overview untouched.
- [ ] Add a sectors-specific source-note choice to the existing `ExplorerFooter`: the current Economy-wide branch credits World Bank and Geostat, while this page's data is Geostat. Preserve the Economy hub/GDP overview source notes and footer layout; verify sectors do not inherit unrelated Budget or World Bank attribution.
- [ ] Update page/source/label translation inventories and review dates together. Add route tests for both languages, correct metadata and no duplicate breadcrumb structured data. Add archive tests proving every displayed original can be resolved.
- [ ] Run `npx vitest run tests/explorer/economicSectorsRoute.test.tsx tests/methodology/sourceManifest.test.ts tests/methodology/sourceInventory.test.ts tests/methodology/catalog.test.ts tests/i18n/inventory.test.ts tests/seo/sitemapFreshness.test.ts`, then `npm run data:prepare-methodology-archives` and `npm run i18n:check`. Expected: the new routes and archive are discoverable together with no orphan links or translation gaps.

**Checkpoint commit:** page/discovery/archive integration; message `feat: expose bilingual economic sector routes and methodology`.

## Task 9: Add the sector snapshot and bounded read-only query

**Create:** `apps/web/lib/factQuery/queryEconomicSectors.ts`, `economicSectorsSeries.ts`, `apps/web/tests/factQuery/queryEconomicSectors.test.ts`.

**Modify:** `apps/web/lib/factQuery/types.ts`, `schemas.ts`, `buildSnapshot.ts`, `describeCoverage.ts`, `getSources.ts`, `index.ts`; `apps/web/lib/mcp/tools.ts`, `outputSchema.ts`, `instructions.ts`; affected snapshot/schema/MCP tests.

- [ ] Add dataset ID `economic-sectors`, a snapshot member containing canonical decimal observations plus bilingual registry/definitions, and a dedicated `query_economic_sectors` tool. Include labels/definitions and facts in data-version hashing. Do not extend the IDs accepted by the existing six-series `query_gdp` tool.
- [ ] Add the input schema alongside existing shared year/version validators:

```ts
export const queryEconomicSectorsInput = z.strictObject({
  seriesIds: seriesIdList,
  years: uniqueSortedYears,
  measure: z.enum(["amount_gel", "share_of_gdp_pct", "real_growth_pct"]),
  expectedDataVersion,
});
```

These shared validators already exist in `schemas.ts`; validate each requested ID against the sector snapshot registry inside the query. Map `amount_gel` → `nominal`, `share_of_gdp_pct` → `share_of_gdp`, and `real_growth_pct` → `real_growth`. Add the growth measure to response types/schema without allowing it on Budget/Debt operations.

- [ ] Implement `queryEconomicSectors(snapshot, input)` with existing response/meta helpers: explicit available/missing cells, `national_accounts` scope, country entity, sector/category versus GDP/total level, percent units, preliminary basis, bilingual definitions/caveats and exact source/document references. Reject unsupported series, out-of-range years and stale expected versions. Preserve existing request/response limits.
- [ ] Test all three measures for the numerical fixture from Task 5, missing observations, source narrowing, preliminary propagation, 2010 growth, invalid ID/year, version mismatch and request-size limits. Assert GDP-share and real-growth observations have distinct definitions and identities despite sharing the percent unit.
- [ ] Include the national GDP reference definition and the sector GVA/market-GDP distinction in coverage. Display actual activity-specific observed years; do not assert every measure shares nominal coverage. No rank, compare, contribution or cumulative operations are added.
- [ ] Run `npm run data:prepare-fact-query-snapshot`, then `npx vitest run tests/factQuery/queryEconomicSectors.test.ts tests/factQuery/queryGdp.test.ts tests/factQuery/buildSnapshot.test.ts tests/factQuery/describeCoverage.test.ts tests/factQuery/sources.test.ts tests/mcp/tools.test.ts tests/mcp/outputSchema.test.ts tests/factQuery/reference.test.ts`. Expected: additive sector capability with unchanged existing reference answers.

**Checkpoint commit:** query/snapshot integration; message `feat: query national economic sectors through read-only MCP`.

## Task 10: Publish central data files and bilingual AI discovery

**Create:** `apps/web/scripts/prepare-economic-sectors-public.ts`, `apps/web/tests/data/economicSectors/publication.test.ts`.

**Modify:** `apps/web/lib/factQuery/publications.ts`, `apps/web/package.json`, `apps/web/lib/pages/connect.tsx`, KA/EN `connect.json`, `apps/web/public/llms.txt`, and `apps/web/tests/seo/agentFiles.test.ts`. The agent guide is an authored static file; generated dataset files remain owned by preparation scripts.

- [ ] Add `economic-sectors.json` using the dedicated query contract for all activities, years and measures, including explicit missing cells. Add `economic-sectors.csv` using canonical decimal strings and BOM with activity/measure/year/unit/status/source columns. Include both files in the existing manifest with actual hashes and coverage.
- [ ] Keep canonical preparation independent of generated public files. Add public preparation to `predev`/`prebuild` after prerequisite data generation and arrange CSV generation before manifest hashing. Add `--check` after build, when published files exist. Avoid duplicating responsibility between the standalone CSV script and the central publication writer.
- [ ] Register `data:prepare-economic-sectors-public` and `data:check-economic-sectors-public` in `package.json`. Use existing `csvEscape` and `assertGeneratedArtifactMatches`; the check compares content without writing.
- [ ] Test source/canonical/snapshot/JSON/CSV agreement, exact decimal retention in CSV, percent scale, gaps, data-version changes after a definition change, and byte-hash matching. Derive dataset/tool counts from actual catalogues in production; update explicit test expectations only when they are intended catalogue inventory assertions.
- [ ] Update the existing AI guide and KA/EN connection coverage with national activity coverage, the dedicated tool, units, preliminary status and the exclusion of regional activity data. Use data-derived coverage and the existing layout.
- [ ] For the authored `llms.txt`, add the sector page, methodology, tool and central file links; check any written coverage against the generated catalogue in `tests/seo/agentFiles.test.ts` so the static text cannot silently drift.
- [ ] Run `npx vitest run tests/data/economicSectors/publication.test.ts tests/factQuery/publications.test.ts tests/factQuery/bilingualPublications.test.ts`, then the preparation scripts in their configured prebuild order. Expected: central files and discovery agree with the same reviewed sector observations, with existing publications preserved.

**Checkpoint commit:** publications/discovery and tests; message `feat: publish economic sector data and AI discovery`.

## Task 11: Prove database behavior and the real browser/export flow

**Create:** `apps/web/tests/browser/economic-sectors.spec.ts`; retain verification artifacts under ignored `.tmp/economic-sectors-verification/`.

**Read/reuse:** `apps/web/tests/browser/gdp-overview.spec.ts`, existing selector/browser tests, `apps/web/playwright.config.ts`, database runbook and GDP publication-readiness evidence procedure. Resolve tools/runtime availability freshly; historical localhost ports or databases are not assumed to exist.

- [ ] Provision or locate a disposable database and verify its identity before setting task-local connection variables. Apply committed migrations, import twice and verify every sector field/decimal and all table reports. Never use production for a rollback test.
- [ ] In that disposable database, inject one rejected sector-row mutation during import using the established rollback-test approach. Assert the importer fails and pre-import digests of every table remain unchanged. Remove the test injection and record the result. Confirm RLS/no public Data API grants on the new table.
- [ ] Build once in database mode and once in CSV mode, compare sector observations and snapshot dataVersion, and retain logs. Stop the disposable database before checking the built MCP endpoint to prove it serves bundled data. Keep all task-local environment changes scoped to their commands/process and out of `.env` and Git.
- [ ] Add browser cases for both languages: total-only default, 21 selectable rows, search/bulk count behavior, all/empty selection, mode/measure persistence, manual/full/single-year ranges, reload/back/forward/language state, missing values and preliminary status. Use `getByRole` and existing test IDs; expose only narrow new IDs needed to identify feature controls.
- [ ] Verify the key switch interaction through the real page:

```ts
await page.goto("/en/explorer/economy/sectors");
await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
await page.getByTestId("series-toggle-all").click();
const sector = page.locator('[data-series-id="sector.a"]');
await sector.getByTestId("series-row-toggle").click();
await page.getByRole("button", { name: "% of GDP", exact: true }).click();
await expect(sector.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");
await page.getByRole("button", { name: "Real growth %", exact: true }).click();
await expect(sector.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");
```

Use the reviewed final message catalogue for exact control names. Assert the accompanying axis/row/table values and source context change to match each measure, not merely the pressed state.

- [ ] Download actual XLSX files for each measure and both languages. Parse with the already-installed workbook library and inspect sheet names, numeric cells/percent formats, selected range/rows, status and original-source hyperlinks. Open representative readable sheets to check layout, long labels and source text.
- [ ] Capture screenshots at 390, 768, 900, 1020 and 1440px, including expanded/collapsed navigation and long sector labels. Compare beside current Budget/GDP pages. Verify paper selector, real fonts, workspace stacking, dot grid, no top indicator tabs, no prototype cards, no page overflow, keyboard range/scroll controls and visible focus. Confirm all 21 selected lines keep the existing bounded tooltip behavior.
- [ ] Inspect the local built page metadata, methodology originals, central file hashes and real MCP tool-list/query outputs. Verify the smallest sector does not round to fake zero and a negative-growth year extends below zero.
- [ ] Run the focused browser file against a single explicitly identified local server with `PLAYWRIGHT_BASE_URL`; expected: all sector cases pass and no unexplained console/runtime errors. Keep a failed assertion as evidence until corrected, rather than hiding it with a timeout increase.

**Checkpoint commit:** browser coverage and any bounded repairs; message `test: verify sector explorer data and browser workflows`.

## Task 12: Final integration review and documented completion

**Modify:** `Project_Definition.md` section 2, bounded `DESIGN.md` sector extension, `docs/data-methodology/economic-sectors.md`, `docs/data-methodology/database-import.md`; append actual execution evidence to this plan only when performed.

- [ ] Record the new national-sector scope and the existing three-way segmented measure control. Preserve regional and other indicator exclusions. Keep recent execution logs out of `AGENTS.md` and durable design documents.
- [ ] Review the diff for duplicated chart/table/slider/selector code, unauthorized homepage/region changes, mixed units, fabricated growth, incomplete source attribution and shared-component regressions. Resolve actual findings with targeted rechecks.
- [ ] Run `npm run check` once when implementation is ready. Expected: lint, types, unit tests, data validation and localization all pass. The new offline canonical check must run on a clean checkout before any build-produced publication exists.
- [ ] Run `npm run build` and confirm the two sector pages and methodology companions are static. Only the existing `/mcp` route remains request-time; published-file checks must pass after build.
- [ ] Serve that built artifact once. In PowerShell, with the chosen server verified, use the repository's supported pattern:

```powershell
$env:CI = '1'
$env:NEXT_PUBLIC_SITE_URL = 'https://fiscal.ge'
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3100'
npm run test:browser
```

The URL above is used only if this task actually started/verified its built server on port 3100; otherwise set the verified task port. Expected: full required browser suite passes. Do not attach verification to another worktree's server. Restore task environment after verification.

- [ ] Run the unchanged `tests/factQuery/reference.test.ts` requirement as part of the final query verification if not already covered by the passing full check. Do not repeat a gate whose inputs have not changed. After a bounded correction, rerun the affected checks and accurately record any interrupted run rather than claiming a single clean full pass.
- [ ] Record source coverage, real-growth derivation choice, data counts, reconciliation/parity results, browser/export evidence and remaining release boundary. Confirm `git diff --check`; commit only intended files. Do not describe a local build as live production.

**Checkpoint commit:** reviewed scope and final evidence; message `docs: finalize national economic sectors implementation evidence`.

## Task 13: Authorized GitHub and production delivery

This task is part of the eventual release checklist, not authorization granted by a request to write a plan. If the user authorizes publishing as part of execution, carry the release through all these steps without repeatedly asking for the same permission.

- [ ] Re-read `docs/deployment.md` and verify checkout, branch, intended commits and remote. Push the `codex/` branch and open a draft PR describing the resulting feature, source evidence and actual verification.
- [ ] Obtain required CI and review, resolve actionable findings/conversations, and merge only after required checks pass. Use the Actions-owned migration/import/deploy workflow; do not push implementation commits directly to `main`.
- [ ] Verify the deployed commit and the production KA/EN page, methodology/source files, Excel behavior, sitemap/metadata, central file hashes and dedicated MCP query. A merge, workflow trigger or accepted deployment hook alone is not proof.
- [ ] Synchronize the intended checkout and clean up the feature branch only after safe Git/worktree checks. Report what is live, the deployed commit and any unverified boundary.

## Plan self-review / requirement coverage

| Spec requirement | Executable tasks |
|---|---|
| National 2010–2025 / 20 sectors / separate GDP reference | 1–5 |
| Real-growth source completeness, 2010 support and correct accounting | 1–3, 9 |
| Decimal precision, status, reconciliation and unchanged Budget denominator | 2–4, 7, 11 |
| Existing design/components, no prototype styling or top tabs | 5–6, 11–12 |
| Unlimited selection, search, range, empty states and URL/language persistence | 5–6, 11 |
| Table, XLSX and observation-level preliminary treatment | 6–7, 11 |
| Georgian/English, methodology, source archive and SEO | 6, 8, 10–11 |
| Static serving, transactional mirror, rollback and CSV/DB parity | 3–4, 11–12 |
| MCP, discovery and central data publications | 9–10, 11–12 |
| Full verification and authorized release | 11–13 |

No production task is checked off by preparing this document. The first execution result should be the source-coverage evidence from Task 1; the final implementation result must include the evidence from Tasks 11–12.

## Execution record — 2026-09-11

Historical checkpoint below; superseded by the 2026-09-12 implementation record at the end.

- Continuing in the existing `0bcb` checkout on local branch `codex/economic-sectors`. Planning documents and unrelated files are preserved. No push, PR, merge or deployment performed.
- Installed locked dependencies. The install's Prisma generation initially failed on user-cache filesystem permissions; a scoped elevated `npm run prisma:generate` succeeded without connecting to a database.
- Baseline: `npx vitest run tests/data/gdpOverview tests/explorer/gdpOverview.test.ts tests/explorer/gdpWorkbook.test.ts` passed: five files, eight tests.
- Archived untouched Geostat growth/volume originals and wrote source manifest/review. Nominal2010–2025 and growth2011–2025 are measured across all20 activities plusGDP. Growth source values are previous-year=100 indices and must be converted by subtracting100. Compatible2010 growth is unavailable; public period decision requested from the user.
- Source evidence passed independent specification and quality reviews. `sourceEvidence.test.ts` passes with exact decimal reconciliation and all315 growth checks; focused lint passed. A minor review suggestion to identify failing year/row/difference was implemented and the test passed again.
- The observation foundation passed its initial tests, but specification review identified an unnecessary nested supporting-input field in the canonical contract. It was removed through a failing-test-first correction. The flat-row correction passed independent specification re-review and final code-quality review: 49/49 tests. Original-input checks belong in preparation.
- Initial checkpoint verification: `npm run check` exited0. Lint, typecheck, 1,844 tests across196 files, existing data validation and localization checks passed. The source-evidence test is included in that suite. No production build or browser tests were run because the page has not yet been implemented; these remain required at feature completion.
- Added the in-progress methodology record. Existing tracked application/data files remain unchanged. New files are uncommitted on `codex/economic-sectors`, based on `8902ae38d`. No UI, database migration, canonical sector CSV, export or publication feature is claimed complete. Continue with Task3 after the public period decision; no production publication is authorized.

## Implementation and verification record — 2026-09-12

- User approved nominal/share 2010–2025 and real growth 2011–2025. Tasks 3–10 are implemented locally: canonical preparation, exact transactional mirror, measure/state model, existing-component bilingual page and Excel export, methodology/originals, navigation/metadata, dedicated MCP query and public publications. Earlier unchecked procedural steps are not a claim that each proposed checkpoint commit was made; no commits or publishing were performed.
- Data: 336 nominal + 336 GDP-share + 315 real-growth observations = 987; 63 preliminary 2025 observations. All 16 nominal reconciliations and 315 independent growth checks pass. JSON explicitly retains 21 missing 2010 growth cells. Original hashes and exact public CSV bytes pass validation.
- Disposable local Postgres (`sectors_test`, port 55441): all 13 migrations applied; two full imports retained exact parity. Injected sector mismatch rejected the import and preserved all 21 public tables' counts/digests. RLS enabled and anonymous/authenticated reads revoked. Evidence remains in ignored `.tmp/sectors-postgres/rollback-evidence.json`.
- DB production build passed. CSV production build passed with 201 static entries, both sector routes prerendered and only `/mcp` dynamic. All 14 publications verified. DB/CSV snapshot version identical: `269c0d07321324afa5392ab5728518a50d0dd2403a148acda8cc39822ffb6018`.
- `npm run check`: lint and typecheck passed; 1,910/1,915 unit tests passed initially, with five explicit old inventory/language assertions failing. Corrected only the new dataset/tool/source/route inventory expectations; all 74 tests in those five files passed on targeted rerun. Ran the remaining `data:validate` and `i18n:check` stages successfully. The unchanged 20-intent reference suite passed in the full unit run. A later typecheck passed. This is a full-gate run plus bounded corrections, not an uninterrupted green command.
- Focused sectors browser: hydration, ten KA/EN responsive layouts (390/768/900/1020/1440), state/history/language persistence, search/bulk/empty selection and six actual XLSX downloads passed. Corrected the metadata test to parse script JSON rather than use a text selector, which excludes script contents. All 20 sector cases passed in the subsequent full run.
- Full browser run against this checkout's built artifact at `http://127.0.0.1:3103`: 489/498 passed initially. Seven failures were old route/hub inventories; two original-download requests failed transiently. After bounded test corrections, all 93 affected-file cases were exercised: 92 passed, then the last sitemap display-count assertion was corrected and its targeted case passed. The two original-download cases passed unchanged. No browser failure remains unresolved; the full suite was not needlessly rerun after test-only edits.
- Inspected English desktop and Georgian mobile screenshots: existing editorial fonts, warm paper selector, only navigation dark, joined measure control, responsive stacking and no page overflow. Shared chart/table/workbook changes are optional props retaining existing callers' defaults; regression suites cover existing Budget/GDP behavior. React checklist inspection found no need for unrelated restructuring.
- Confirmed task database identity and port before stopping only its parent process after Windows blocked `pg_ctl`. Port 55441 is closed. With the database stopped, built `/mcp` on task-local port 3104 returned HTTP 200, listed all 11 tools and returned the expected partial sector growth response, including missing 2010. All three original XLSX files plus public sector CSV/JSON returned HTTP 200 and matched local bytes/hashes.
- Source and model reviews, UI/Excel specification reviews, and route/query specification reviews passed after corrections. Publication re-review passed with 20/20 focused tests and both publication checks. The independent model/UI/Excel quality review initially hit a usage limit, then completed on retry with no confirmed critical, important or minor findings. That reviewer inspected code/tests/evidence without rerunning the full gates. No reset credits purchased or consumed.
- Durable national scope and bounded design extension are updated. Regional sectors, population and homepage expansion remain excluded. `git diff --check` passed. Work is uncommitted on `codex/economic-sectors`; Task 13 remains unauthorized. Local implementation is not a production release.

## Approved Lucide refinement — 2026-09-12

- User selected Lucide as the functional icon family and requested durable documentation and reuse for existing icons. Pinned `lucide-react` 1.45.0; added the standard to `DESIGN.md` §7.2a and the durable reference in `AGENTS.md`. Brand assets and data visualizations remain untouched; conventional textual marks remain explicit exceptions.
- Sector measures now use literal GEL, `ChartPie` and `ChartNoAxesCombined` inside the existing segmented control. Added optional icon rendering and a shared hover/focus tooltip with Escape dismissal. Kept accessible names, selected measure context, existing state and numeric behavior. Migrated hand-drawn menu/close and sidebar collapse/expand/compact-home controls.
- Failing-first browser checks proved the missing icon controls and a review-discovered compact-home contrast problem (1:1). Both pass after implementation/correction. Georgian touch interaction passes separately. Inspected mobile tooltip and Georgian desktop screenshots.
- Full `npm run check` passed: lint, types, 1,915 tests in 209 files, data and localization validation. Following the bounded home-color repair, targeted lint/typecheck and production rebuild passed. All published data hashes and snapshot version remain unchanged.
- One browser gate was interrupted because an old preview process still held port 3103. Closed the verified stale process and restarted the current build; this interrupted run is not completion evidence. The fresh full browser run passed 499/500 cases, with one unrelated source-download ECONNRESET. That exact unchanged workbook test passed on targeted rerun (1/1). Additional Georgian touch test passed (1/1). No unresolved browser failures remain; no full gate was repeated after a passing gate with unchanged inputs.
- Independent scoped review closed its only finding after the explicit contrasting home-icon color was added. `git diff --check` passed. Superseded task preview servers on 3104/3106 were closed; current preview remains at `http://127.0.0.1:3103/explorer/economy/sectors`. No commit, push, merge or deployment performed.

## Approved compact presentation and ranking refinement

- Renamed the visible page, Economy card, sidebar and workbook titles to `სექტორები` / `Sectors`. Shortened share/growth explanations, reserved common intrinsic description height and removed the duplicate under-toolbar unit/measure row. Detailed source-accounting definitions remain unchanged.
- Fixed pointer-click tooltip persistence without removing keyboard-visible focus help. Shared descending end-year ranking now feeds selector, chart/table model and workbook; GDP stays first, missing values last. An optional default-off `totalFirst` table prop keeps the reference first on sectors only, retaining existing Budget total placement.
- Failing-first tests reproduced tooltip persistence, classification-order rows and GDP-at-bottom behavior. The final sector browser cases pass, including chart-position stability at 390/768/1440px, touch/keyboard/hover, ranking and exports. Inspected Georgian mobile/desktop screenshots.
- `npm run check` passed (1,917 tests, 209 files, data/localization validation). After the bounded total-position correction, targeted table/workbook/presentation tests (19 + 2), lint/typecheck and production rebuild passed. Full browser run: 501/503 passed; one test still imposed the old minimum title length and one unchanged Budget PDF download hit ECONNRESET. Replaced only the sector title expectation with its approved exact localized name; both targeted cases then passed. No full gate was repeated after unchanged inputs had passed.
- A scoped independent review confirmed the total-position correction. The three findings from the earlier all-worktree review (long mobile table labels, original XML decimal retention and Georgian MCP version-error wording) remain separate and were not fixed by this UI request. No data calculations, canonical data, source hashes or snapshot version changed. No commits or publishing performed.

## Approved four-highlight extension

- Added the four national end-year highlights below the workspace using existing editorial primitives and KPI styling: largest nominal sector/GDP share, maximum real annual growth, minimum real annual growth, and the top-three nominal sectors' combined GDP share. Rankings exclude GDP and ignore chart selection/measure. Missing growth, no-decline/all-decline cases, stable ties and preliminary status are explicit.
- Updated scope, design, approved spec and methodology. No canonical observations, public query measures, source files or dataset version changed.
- Five focused model/presentation tests pass. Review corrected two ambiguous labels: Georgian top-three explicitly names GDP, and both notes identify real annual growth. Full-check verification encountered an initial test-authoring lint error, then a concurrently added label assertion ran with the older cached messages (1,921/1,922 passed); its five-test file passed after the copy correction. Targeted lint/typecheck plus the remaining data/localization validation passed. This is bounded correction evidence, not an uninterrupted green full-check claim.
- Final production build and publication checks passed. Full browser suite passed **507/507**, including national-summary selection independence, unavailable 2010 growth, and Georgian 1/2/4-column layouts at 390/768/1440px. The first summary-persistence assertion mixed CSS-transformed innerText with textContent; it now consistently compares rendered text. Inspected desktop/mobile highlight screenshots. Scoped independent review findings are resolved.
- Current local preview remains port 3103; no commits, merge, push or publication performed. Earlier unrelated review findings remain outside this extension.

## Budget-style highlight correction

- User rejected the equal-column KPI presentation and explicitly requested Budget/other detail-page styling. Compared the actual Budget KPI block and municipality detail implementation. Replaced the sector block with the same 1.35fr/1fr hero-and-three-side-rows composition, 62px/44px hero, 24px side figures, hairline separators and shared Sparkline. No Budget or municipality production component was edited.
- Headline statistics are unchanged. Hero gauge is the largest sector's GDP share; trend marks follow the current winners through available history, holding top-three membership fixed and preserving missing years. Added a regression for those semantics and scoped the existing main-chart path test so decorative sparklines are not mistaken for plotted chart series.
- Updated DESIGN/spec/methodology. Scoped independent review found no actionable issue. `npm run check` passed: 1,923 tests in 210 files, lint/types, data/localization validation. Production build and publication checks passed. Four focused browser cases passed; compared actual Budget and sector screenshots and inspected mobile output. Full browser run passed 506/507; one unchanged municipal-page readiness timeout passed on its isolated rerun without edits. All sector, export, layout and interaction tests passed. `git diff --check` passed.
- Preview remains at port 3103. No commits or publishing; the earlier unrelated review findings remain separate.

## Authorized three-finding correction — 2026-09-13

- User authorized all three previously outstanding review fixes. Failing-first tests reproduced both mobile-language table widths (569px KA / 459px EN), loss of original XML decimal digits, and the misleading Georgian version-mismatch response.
- The shared table has a default-off wrapping option used only by sectors; full names fit a bounded sticky column and numerical cells remain unobscured. Both mobile hit-testing regressions pass against the rebuilt preview, and KA/EN screenshots were inspected.
- Source extraction now uses numeric XML text from the hash-verified single-sheet originals before decimal conversion. An independent test compares all 987 generated values against original XML; nominal controls and all 315 growth comparisons pass. GDP overview and Budget denominator files remain unchanged. Legacy overview numeric projection is checked exactly, with the source representation difference explicitly recorded rather than discarding source digits.
- Regenerated canonical sector CSV, reconciliation and validation report, snapshot and public outputs. Data version is now `0f4da6ab91cf3290fee6a72dbe9c4100fdc4262e238c2b0bff4fec16d01d571d`; original hashes, coverage, preliminary counts and display-level meaning are unchanged. Existing exact-decimal test literals were corrected from rounded parser output to inspected XML values. An initial publication check caught the old generated snapshot; prebuild regenerated it normally.
- Georgian version-mismatch copy now requests refreshed coverage information, matching English. Targeted version/reference tests pass. Scoped independent review found no actionable issue; React checklist confirms the opt-in presentation change adds no hooks or client dependencies.
- Production build and all 14 publication checks passed. Final `npm run check` exited 0: lint/types, 1,925 tests across 210 files, data and localization checks passed. Full browser run: 508/509 passed; the unchanged receipts-original PDF request hit ECONNRESET, then the exact isolated test passed without edits (1/1). All sector tests passed. `git diff --check` passed. No database import, commit, push, merge or deployment performed in this correction.

## Authorized release integration — 2026-09-13

- User authorized PR, push, merge, synchronization and finalization. Committed sectors as `5719707f5`, then integrated `origin/main` at `5c99a25df` (inflation release) without discarding either feature. Separate conflict-resolution agents and an independent integration reviewer checked the shared chart/export, navigation, source/localization inventories, Prisma models and transactional import. No actionable integration finding remains.
- Combined local build passed: 207 static-generation entries; both sector and inflation public artifacts verified. Lint/types passed. Combined unit run passed 1,991/1,992 tests; its sole failure was the old 119-source inventory assertion, corrected to the verified combined 126 sources, and all 21 tests in that file passed. Remaining data/localization gates passed separately. Full browser suite passed 527/527. This is full-run plus bounded correction evidence, not an uninterrupted green check claim.
- Combined data version: `7a9748e2910400a1d15135772ec6f227ecb25d764092605a4332d547258b95fb`. Existing GDP/Budget inputs and inflation data are preserved. Debug/generated outputs remain excluded. Main checkout's unrelated instruction edits and untracked local files must be preserved during synchronization. CI, deployed commit and live evidence remain separate release gates.
