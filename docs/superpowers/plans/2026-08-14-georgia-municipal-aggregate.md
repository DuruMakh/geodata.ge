# Georgia Municipal Aggregate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-position `საქართველო` choice whose explorer statistics aggregate all 69 reviewed municipal-budget series, while the existing 64 municipality pages and 11 regional roll-ups remain unchanged.

**Architecture:** Generate two dedicated `country.georgia` CSV datasets from the preserved 69-entity raw package, mirror them through dedicated Prisma tables, and expose them beside—not inside—the 64-entity municipal dataset. Reuse the existing municipal explorer for the new static country route, but give country KPIs and navigation their own typed branch so no fake rank, region, or municipality record is introduced.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Vitest 4, Playwright 1.60, Prisma 7/Postgres, reviewed CSV serving files.

## Global Constraints

- `country.georgia` aggregates exactly 69 official municipal-budget series for every year from 2015 through 2025.
- Codes `05`, `42`, `43`, `46`, and `64` appear only inside the country aggregate; they receive no route, list row, map target, member row, picker municipality option, or standalone CSV value.
- The public registry remains exactly 64 municipalities and 11 regions; municipality ranks stay out of 64 and region ranks stay out of 11.
- The Georgia row is first in the `რეგიონები` tab and the country picker option precedes all region and municipality options.
- Only the applicable total is selected by default; series selection remains unlimited and search does not alter bulk scope.
- Nullable aggregate components become null when any constituent is missing; no incomplete component sum may look complete.
- Reviewed CSVs remain canonical; database mode must match them field-for-field before serving.
- Georgian CSV downloads retain the UTF-8 BOM contract.
- Do not change municipality geometry, population/per-capita behavior, indicator datasets, or national-government budget data.
- Run commands from `apps/web` with `npm.cmd` on Windows.

## File Structure

- `apps/web/lib/data/municipal/aggregateMunicipalFacts.ts`: shared pure aggregation for region roll-ups and country generation.
- `apps/web/lib/data/municipal/generateMunicipalFacts.ts`: generate the unchanged 64-entity files and two new country files.
- `apps/web/lib/data/municipal/importMunicipalFacts.ts`: parse municipality-keyed and country-scope-keyed CSVs.
- `apps/web/lib/data/servedData.ts`: load country facts in CSV/database modes and enforce parity.
- `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, Prisma schema/migration, and import script: dedicated mirror tables without a synthetic municipality.
- `apps/web/lib/explorer/municipalData.ts`: country list/KPI/denominator helpers.
- Municipality index, picker, explorer, and route files: country-first discovery and the static country page.
- Unit/browser tests and canonical project/data/design documents: lock and explain the behavior.

---

### Task 1: Share one safe aggregation implementation

**Files:**
- Create: `apps/web/lib/data/municipal/aggregateMunicipalFacts.ts`
- Modify: `apps/web/lib/explorer/municipalData.ts:37-149`
- Modify: `apps/web/tests/explorer/municipalData.test.ts:226-546`

**Interfaces:**
- Consumes: `MunicipalFunctionFact[]` and `MunicipalTotalFact[]`.
- Produces: `aggregateFactsForEntity(entityId, functionFacts, totalFacts)`, `MIXED_SOURCE_ID`, and `MIXED_PUBLIC_TOTAL_MEASURE`, re-exported from `municipalData.ts`.

- [ ] **Step 1: Point aggregation tests at the new data module**

```ts
import {
  aggregateFactsForEntity,
  MIXED_PUBLIC_TOTAL_MEASURE,
  MIXED_SOURCE_ID,
} from "../../lib/data/municipal/aggregateMunicipalFacts";
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads --maxWorkers=1 tests/explorer/municipalData.test.ts
```

Expected: FAIL because `aggregateMunicipalFacts.ts` does not exist.

- [ ] **Step 3: Move the existing implementation without changing behavior**

Keep this signature and null rule:

```ts
export function aggregateFactsForEntity(
  entityId: string,
  functionFacts: MunicipalFunctionFact[],
  totalFacts: MunicipalTotalFact[],
): { functionFacts: MunicipalFunctionFact[]; totalFacts: MunicipalTotalFact[] };

function sumNullable(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}
```

Move the current fold exactly, including mixed markers and warning reset. Import and re-export the symbols from `municipalData.ts` so region routes remain compatible.

- [ ] **Step 4: Re-run the focused test**

Expected: PASS for sums, missing components, mixed source/measure metadata, warning reset, and region roll-ups.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/lib/data/municipal/aggregateMunicipalFacts.ts apps/web/lib/explorer/municipalData.ts apps/web/tests/explorer/municipalData.test.ts
git commit -m "refactor: share municipal fact aggregation"
```

---

### Task 2: Generate and load the reviewed Georgia CSVs

**Files:**
- Modify: `apps/web/lib/data/municipal/types.ts`
- Modify: `apps/web/lib/data/municipal/generateMunicipalFacts.ts`
- Modify: `apps/web/lib/data/municipal/importMunicipalFacts.ts`
- Modify: `apps/web/scripts/generate-municipal-facts.ts`
- Modify: `apps/web/tests/data/municipal/generateMunicipalFacts.test.ts`
- Modify: `apps/web/tests/data/municipal/importMunicipalFacts.test.ts`
- Create: `data/imports/municipal-georgia-function-facts-2015-2025.csv`
- Create: `data/imports/municipal-georgia-total-facts-2015-2025.csv`

**Interfaces:**
- Consumes: Task 1 aggregator and all 7,590 raw function rows / 759 raw total rows.
- Produces: `MUNICIPAL_COUNTRY_ID`, country CSV loaders, and deterministic 110-row / 11-row outputs.

- [ ] **Step 1: Write failing loader and generation assertions**

Use these constants and independently compare the generated 2025 total with all raw rows:

```ts
const COUNTRY_FUNCTION_FACTS = "../../data/imports/municipal-georgia-function-facts-2015-2025.csv";
const COUNTRY_TOTAL_FACTS = "../../data/imports/municipal-georgia-total-facts-2015-2025.csv";
const COUNTRY_ID = "country.georgia";

const expected2025 = rawTotals
  .filter((row) => Number(row.year) === 2025)
  .reduce((sum, row) => sum + Number(row.public_total_gel), 0);
expect(countryTotals.find((row) => row.year === 2025)?.publicTotalGel).toBeCloseTo(expected2025, 2);
expect(new Set(rawTotals.map((row) => row.municipality_code)).size).toBe(69);
```

Assert country files have 110/11 rows all keyed to `country.georgia`; public files remain 7,040/704 with none of the five excluded codes. Add loader fixtures with `scope_id=country.georgia` and reject any other scope.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads --maxWorkers=1 tests/data/municipal/generateMunicipalFacts.test.ts tests/data/municipal/importMunicipalFacts.test.ts
```

Expected: FAIL because country loaders/files and the constant do not exist.

- [ ] **Step 3: Add stable ID and country loaders**

```ts
export const MUNICIPAL_COUNTRY_ID = "country.georgia" as const;
```

Add strict `scope_id: z.literal(MUNICIPAL_COUNTRY_ID)` schemas. Return existing fact shapes with `municipalityCode: row.scope_id`; do not weaken municipality CSV schemas.

- [ ] **Step 4: Generate public and country outputs in one pass**

Build typed facts for all 69 codes, filter public facts by the existing five-code set, and aggregate all facts:

```ts
const country = aggregateFactsForEntity(MUNICIPAL_COUNTRY_ID, allFunctionFacts, allTotalFacts);
return {
  functionRows: publicFunctionFacts.length,
  totalRows: publicTotalFacts.length,
  countryFunctionRows: country.functionFacts.length,
  countryTotalRows: country.totalFacts.length,
};
```

Serialize country identity as `scope_id`.

- [ ] **Step 5: Regenerate and verify deterministic outputs**

```powershell
npm.cmd run data:generate-municipal-facts
```

Expected counts: public `7040 / 704`; country `110 / 11`. Run it twice and verify the second run produces no file diff.

- [ ] **Step 6: Re-run the focused tests**

Expected: PASS, including raw 69-code coverage and representative independent sums.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/lib/data/municipal apps/web/scripts/generate-municipal-facts.ts apps/web/tests/data/municipal data/imports/municipal-*-facts-2015-2025.csv
git commit -m "feat: generate Georgia municipal aggregates"
```

---

### Task 3: Mirror and validate country facts

**Files:**
- Modify: `apps/web/lib/data/servedData.ts`
- Modify: `apps/web/lib/data/servedDataParity.ts`
- Modify: `apps/web/lib/db/mirrorRows.ts`
- Modify: `apps/web/lib/db/servedDataDb.ts`
- Modify: `apps/web/scripts/import-budget-facts.ts`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/20260814000000_municipal_country_aggregate/migration.sql`
- Modify: `apps/web/tests/data/municipal/servedMunicipalData.test.ts`
- Modify: `apps/web/tests/data/servedDataParity.test.ts`

**Interfaces:**
- Consumes: Task 2 country loaders/CSVs.
- Produces: `MunicipalData.countryFunctionFacts`, `MunicipalData.countryTotalFacts`, dedicated Prisma models, mirror readers, transactional import, and parity.

- [ ] **Step 1: Write failing served-data and parity tests**

```ts
expect(data.municipalities).toHaveLength(64);
expect(data.functionFacts).toHaveLength(7040);
expect(data.totalFacts).toHaveLength(704);
expect(data.countryFunctionFacts).toHaveLength(110);
expect(data.countryTotalFacts).toHaveLength(11);
expect(new Set(data.countryTotalFacts.map((row) => row.municipalityCode))).toEqual(
  new Set(["country.georgia"]),
);
```

Add parity-key tests for year/scope/category and year/scope.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads --maxWorkers=1 tests/data/municipal/servedMunicipalData.test.ts tests/data/servedDataParity.test.ts
```

Expected: FAIL because country fields and keys do not exist.

- [ ] **Step 3: Extend CSV serving and validation**

Add both paths to `SERVED_DATA_FILES`, load both arrays, and validate exact counts, `country.georgia`, 2015–2025, ten known categories, unique natural keys, and source IDs.

```ts
if (countryFunctionFacts.length !== 110) throw new Error("Georgia municipal function facts must have 110 rows");
if (countryTotalFacts.length !== 11) throw new Error("Georgia municipal total facts must have 11 rows");
```

- [ ] **Step 4: Add Prisma models and migration**

Create `MunicipalCountryFunctionFact` and `MunicipalCountryTotalFact` with `scopeId`, not a municipality relation. Match Decimal(18,2), basis, warning, and nullable component fields to current models; add unique keys `[year, scopeId, categoryId]` and `[year, scopeId]`, indexes, category foreign key, and deny-all RLS:

```sql
ALTER TABLE "MunicipalCountryFunctionFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MunicipalCountryTotalFact" ENABLE ROW LEVEL SECURITY;
```

```powershell
npm.cmd run prisma:generate
```

- [ ] **Step 5: Extend mirror readers and transactional import**

Map Prisma `scopeId` back to `municipalityCode`. Extend pre-import precision/reference/uniqueness checks, transaction deletion and creation, in-transaction readback, parity assertions, and report counts. Insert deterministic IDs:

```ts
id: municipalCountryFunctionFactParityKey(fact),
scopeId: fact.municipalityCode,
```

Both country tables must be wiped/reloaded inside the existing transaction so a mismatch rolls everything back.

- [ ] **Step 6: Run validation and type checks**

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads --maxWorkers=1 tests/data/municipal/servedMunicipalData.test.ts tests/data/servedDataParity.test.ts
npm.cmd run data:validate
npm.cmd run typecheck
```

Expected: PASS with public counts unchanged and country counts 110/11.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/lib/data apps/web/lib/db apps/web/scripts apps/web/prisma apps/web/tests/data
git commit -m "feat: mirror Georgia municipal aggregates"
```

---

### Task 4: Add country models and the 69-series denominator

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts`
- Modify: `apps/web/tests/explorer/municipalData.test.ts`
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/[code]/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`

**Interfaces:**
- Consumes: country facts from Task 3.
- Produces: `buildCountryListRow`, `buildCountryTotalByYear`, `buildCountryKpis`, and national-share calculations based on 69 series.

- [ ] **Step 1: Write failing pure-model tests**

Use fixtures where public totals differ from country totals and assert:

```ts
expect(buildCountryListRow(countryTotals, 2025)).toMatchObject({
  id: "country.georgia",
  kind: "country",
  nameKa: "საქართველო",
  subtitleKa: "69 მუნიციპალური ბიუჯეტი",
  rank: null,
});
expect(buildCountryTotalByYear(countryTotals)).toEqual({ 2024: 900, 2025: 1000 });
```

Extend `buildIndexKpis` tests to prove total, growth, concentration denominator, and largest-function share use country facts, while the named largest municipality still comes from the 64 public entities. Assert `buildCountryKpis(model, 69)` returns fourth KPI value `69` and detail `64 საჯარო გვერდი · 5 მხოლოდ საქართველოს ჯამში`.

- [ ] **Step 2: Run model tests and verify RED**

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads --maxWorkers=1 tests/explorer/municipalData.test.ts
```

Expected: FAIL because country helpers and the country row kind do not exist.

- [ ] **Step 3: Implement explicit country model helpers**

Widen the list type without inventing a rank:

```ts
export type MunicipalListRow = {
  id: string;
  kind: "municipality" | "region" | "country";
  nameKa: string;
  subtitleKa: string;
  regionId: string | null;
  valueGel: number;
  rank: number | null;
};
```

`buildCountryTotalByYear` reads exactly one row per year and throws on duplicate years. Change `MunicipalIndexKpiInput` to accept public entity facts and country aggregate facts separately. Implement country KPIs with the same first three calculations as `buildEntityKpis` and the specified count KPI fourth.

- [ ] **Step 4: Route every national denominator through country totals**

In the index, pass country function/total facts into `buildIndexKpis`. In municipality and region pages replace the 64-row reduction with:

```ts
const nationalTotalByYear = buildCountryTotalByYear(countryTotalFacts);
```

Keep ranks based on public `totalFacts`, 64 municipalities, and 11 regions.

- [ ] **Step 5: Run model tests and typecheck**

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads --maxWorkers=1 tests/explorer/municipalData.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/lib/explorer/municipalData.ts apps/web/tests/explorer/municipalData.test.ts apps/web/app/explorer/municipalities
git commit -m "feat: use Georgia municipal totals as denominator"
```

---

### Task 5: Put Georgia first in the region list and picker

**Files:**
- Modify: `apps/web/components/municipalities/municipalities-index.tsx`
- Modify: `apps/web/components/municipalities/entity-picker.tsx`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/[code]/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`
- Modify: `apps/web/tests/browser/municipalities.spec.ts`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`
- Modify: `apps/web/tests/browser/municipal-region.spec.ts`

**Interfaces:**
- Consumes: Task 4 country row/helper.
- Produces: a pinned country row and `EntityPickerCountry` with first-option keyboard/search order.

- [ ] **Step 1: Write failing browser discovery tests**

On the index, switch to `რეგიონები` and assert 12 rows, first name `საქართველო`, subtitle `69 მუნიციპალური ბიუჯეტი`, no numeric region rank, and click target `/explorer/municipalities/georgia`. On municipality and region pages, open the picker and assert `picker-country` is the first `role=option`, is searchable by `საქართველო`, and precedes region options.

- [ ] **Step 2: Run targeted browser tests and verify RED**

```powershell
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts
```

Expected: FAIL because country discovery is absent.

- [ ] **Step 3: Pin and route the country row**

Add `country: MunicipalListRow` to the index props and use:

```ts
const source = level === "region" ? [props.country, ...props.regions] : props.municipalities;
```

Route `kind === "country"` to `/explorer/municipalities/georgia`, render an em dash when `rank === null`, and preserve all stored region ranks.

- [ ] **Step 4: Add a standalone picker option**

```ts
export type EntityPickerCountry = {
  id: typeof MUNICIPAL_COUNTRY_ID;
  nameKa: "საქართველო";
  valueGel: number;
  budgetCount: 69;
};
```

Add `country` and `onSelectCountry` props plus a `country` `PickerOption` case. Flatten it before regions/members, filter it by its own name, render `data-testid="picker-country"`, and include its amount/count. Update picker search/dialog labels to mention Georgia.

- [ ] **Step 5: Pass the country option from existing entity routes**

Build the option from the latest country total, pass it through `MunicipalExplorer`, and navigate to the explicit country route. Do not place any of the five codes in picker groups.

- [ ] **Step 6: Re-run targeted browser tests and typecheck**

Run Step 2 plus `npm.cmd run typecheck`. Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/components/municipalities apps/web/app/explorer/municipalities apps/web/tests/browser
git commit -m "feat: add Georgia to municipal navigation"
```

---

### Task 6: Add the country explorer route

**Files:**
- Create: `apps/web/app/explorer/municipalities/georgia/page.tsx`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Create: `apps/web/tests/browser/municipal-georgia.spec.ts`

**Interfaces:**
- Consumes: country facts/helpers and existing municipal explorer components.
- Produces: `/explorer/municipalities/georgia`, country KPIs, optional previous/next navigation, and aggregate-only CSV.

- [ ] **Step 1: Write the failing country-page browser test**

Cover status 200, exact heading, 69-unit metadata/explanation, total-only default, 11 series, chart/table/share/range/selector/comparison controls, four country KPIs, no member rows, no previous/next links, and CSV content with `country.georgia` but none of the five codes as standalone entity fields.

```ts
await expect(page.getByRole("heading", { level: 1 })).toHaveText(
  "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები▾",
);
await expect(page.getByTestId("series-status")).toContainText(/სერიები\s*1 \/ 11/);
```

- [ ] **Step 2: Run the country test and verify RED**

```powershell
npm.cmd run test:browser -- tests/browser/municipal-georgia.spec.ts
```

Expected: FAIL with 404.

- [ ] **Step 3: Type ranked and country metrics separately**

Replace rank props with:

```ts
type MunicipalMetricContext =
  | { kind: "ranked"; nationalTotalByYear: Record<number, number>; rankByYear: Record<number, number>; rankOutOf: number }
  | { kind: "country"; budgetCount: 69 };
```

Replace required `prev`/`next` with:

```ts
navigation?: { prev: { label: string; href: string }; next: { label: string; href: string } };
```

Render navigation only when present and choose KPIs from the discriminant:

```ts
const kpis = props.metrics.kind === "country"
  ? buildCountryKpis(model, props.metrics.budgetCount)
  : buildEntityKpis({ model, ...props.metrics });
```

- [ ] **Step 4: Implement the explicit static page**

Load the dedicated country facts and derive years/review date. Render:

```tsx
<MunicipalExplorer
  title="როგორ ხარჯავენ ბიუჯეტს"
  triggerLabel="საქართველოს მუნიციპალიტეტები"
  entityId={MUNICIPAL_COUNTRY_ID}
  metaLine={`69 მუნიციპალური საბიუჯეტო ერთეული · ${firstYear}–${latestYear}`}
  functions={functions}
  functionFacts={countryFunctionFacts}
  totalFacts={countryTotalFacts}
  metrics={{ kind: "country", budgetCount: 69 }}
  csvBasename="municipalities-georgia"
/>
```

Pass country-first picker data but no navigation or children. Add canonical/OpenGraph metadata. The source note must say in Georgian that 69 official units are aggregated, five occupied-territory-associated bodies appear only here, and their spending is not presented as territorial.

- [ ] **Step 5: Re-run country and regression browser tests**

```powershell
npm.cmd run test:browser -- tests/browser/municipal-georgia.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts tests/browser/municipalities.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/app/explorer/municipalities/georgia apps/web/components/municipalities/municipal-explorer.tsx apps/web/tests/browser/municipal-georgia.spec.ts
git commit -m "feat: add Georgia municipal explorer"
```

---

### Task 7: Update canonical documentation and verify everything

**Files:**
- Modify: `Project_Definition.md`
- Modify: `DESIGN.md`
- Modify: `docs/data-methodology/municipal-functional-annual-2015-2025.md`
- Modify only if routes are enumerated: `apps/web/app/sitemap.ts`

**Interfaces:**
- Consumes: completed Tasks 1–6.
- Produces: durable scope/design/methodology ownership and final verification evidence.

- [ ] **Step 1: Document actual generated behavior**

Record 64 public municipality pages, 11 regional roll-ups, one `/explorer/municipalities/georgia` aggregate from 69 series, country counts 110/11, the five aggregate-only codes, country national-share denominators, the non-reconciliation of 11 region rows to the country row, and transactional CSV/database parity. Add the route to the sitemap only if that file explicitly enumerates municipal routes.

- [ ] **Step 2: Run focused unit and data checks**

```powershell
npm.cmd exec vitest run -- --configLoader native --pool=threads --maxWorkers=1 tests/data/municipal tests/explorer/municipalData.test.ts
npm.cmd run data:validate
```

Expected: PASS with public counts `64 / 7040 / 704` and country counts `110 / 11`.

- [ ] **Step 3: Run the definition of done**

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
```

Expected: all exit 0; static build includes the new country route and existing 64 municipality/11 region pages.

- [ ] **Step 4: Inspect desktop and mobile behavior**

Verify Georgia is first in `რეგიონები`; the page has no horizontal overflow at 375×844 and 768×900; chart, table, share, range, selector, and CSV work; representative municipality/region pages retain 64/11 ranks and member counts.

- [ ] **Step 5: Run repository hygiene checks**

```powershell
git diff --check
git status --short
git log --oneline --decorate -8
```

Expected: no whitespace errors and only intentional task files before the final commit.

- [ ] **Step 6: Commit documentation and final test adjustments**

```powershell
git add Project_Definition.md DESIGN.md docs/data-methodology/municipal-functional-annual-2015-2025.md apps/web/app/sitemap.ts
git commit -m "docs: document Georgia municipal aggregate"
```

- [ ] **Step 7: Re-run verification after the final commit**

Run `npm.cmd run check`, `npm.cmd run build`, `npm.cmd run test:browser`, and `git status --short` again. Record exact results, generated route evidence, branch, and final SHA. Do not claim GitHub delivery or production behavior without separate publishing authorization and verified CI/deployment/live-route evidence.
