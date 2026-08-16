# Adjara Consolidated Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Adjara and Georgia totals include Adjara republican payments once, net of transfers to Adjara municipalities, for 2015–2025.

**Architecture:** Preserve the reviewed republican-payment and Treasury-transfer operands in one 11-row CSV. Load and validate that panel, apply it to the six-municipality Adjara roll-up, and apply the same annual net amount to the generated 69-series Georgia total. Keep municipality rows and functional categories unchanged.

**Tech Stack:** TypeScript, Zod, CSV, Prisma 7, Vitest, Next.js 16, Playwright.

---

### Task 1: Reviewed adjustment panel and arithmetic

**Files:**
- Create: `data/imports/municipal-adjara-budget-adjustments-2015-2025.csv`
- Create: `apps/web/lib/data/municipal/importAdjaraBudgetAdjustments.ts`
- Modify: `apps/web/lib/data/municipal/types.ts`
- Test: `apps/web/tests/data/municipal/importAdjaraBudgetAdjustments.test.ts`

- [ ] **Step 1: Write the failing loader tests**

Test that the loader accepts `region.adjara`, exact 2015 values, and 11 dense years; rejects a wrong scope, missing year, duplicate year, and a net value that is not `republicPaymentsGel - municipalTransfersGel`.

```ts
expect(rows[0]).toMatchObject({
  year: 2015,
  republicPaymentsGel: 170031400,
  municipalTransfersGel: 27186011.29,
  netRepublicPaymentsGel: 142845388.71,
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- tests/data/municipal/importAdjaraBudgetAdjustments.test.ts`
Expected: FAIL because the loader and type do not exist.

- [ ] **Step 3: Add the minimum type, schema, loader, and reviewed CSV**

```ts
export type AdjaraBudgetAdjustment = {
  year: number;
  scopeId: "region.adjara";
  republicPaymentsGel: number;
  municipalTransfersGel: number;
  netRepublicPaymentsGel: number;
  basis: "actual";
  republicSourceId: string;
  transferSourceId: string;
};
```

Validate exact 2015–2025 coverage and arithmetic at cent precision.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- tests/data/municipal/importAdjaraBudgetAdjustments.test.ts`
Expected: PASS.

### Task 2: Apply the adjustment to Adjara and Georgia

**Files:**
- Modify: `apps/web/lib/data/municipal/aggregateMunicipalFacts.ts`
- Modify: `apps/web/lib/data/municipal/generateMunicipalFacts.ts`
- Modify: `apps/web/scripts/generate-municipal-facts.ts`
- Modify: `data/imports/municipal-georgia-total-facts-2015-2025.csv`
- Test: `apps/web/tests/data/municipal/generateMunicipalFacts.test.ts`
- Test: `apps/web/tests/explorer/municipalData.test.ts`

- [ ] **Step 1: Write failing aggregation tests**

```ts
const adjusted = applyAdjaraBudgetAdjustment(baseTotals, adjustments);
expect(adjusted.find((row) => row.year === 2015)?.publicTotalGel)
  .toBeCloseTo(358856838.08, 2);
expect(adjusted.find((row) => row.year === 2025)?.publicTotalGel)
  .toBeCloseTo(1212519508.44, 2);
```

Also assert that generated 2015 Georgia equals `2186717489.17`, every Georgia year adds exactly one net adjustment, and country function rows are byte-for-byte unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- tests/data/municipal/generateMunicipalFacts.test.ts tests/explorer/municipalData.test.ts`
Expected: FAIL on the old totals.

- [ ] **Step 3: Implement the narrow total adjustment and regenerate**

```ts
publicTotalGel: total.publicTotalGel + adjustment.netRepublicPaymentsGel,
publicTotalMeasure: "adjara_consolidated_total",
totalPaymentsGel:
  total.totalPaymentsGel === null
    ? null
    : total.totalPaymentsGel + adjustment.netRepublicPaymentsGel,
expensesGel: null,
nonfinancialAssetGrowthGel: null,
financialAssetGrowthGel: null,
liabilityDecreaseGel: null,
reconciliationDifferenceGel: null,
```

Run: `npm.cmd run data:generate-municipal-facts`
Expected: 7,040 public function rows, 704 public total rows, 110 unchanged country function rows, and 11 adjusted country total rows.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm.cmd test -- tests/data/municipal/generateMunicipalFacts.test.ts tests/explorer/municipalData.test.ts`
Expected: PASS.

### Task 3: CSV/database parity and source validation

**Files:**
- Modify: `apps/web/lib/data/servedData.ts`
- Modify: `apps/web/lib/db/mirrorRows.ts`
- Modify: `apps/web/lib/db/servedDataDb.ts`
- Modify: `apps/web/lib/data/servedDataParity.ts`
- Modify: `apps/web/scripts/import-budget-facts.ts`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/20260816000000_adjara_budget_adjustment/migration.sql`
- Modify: `data/sources/source-documents.csv`
- Test: `apps/web/tests/data/municipal/servedMunicipalData.test.ts`
- Test: `apps/web/tests/data/servedDataParity.test.ts`

- [ ] **Step 1: Write failing serving/parity tests**

Assert 11 adjustment rows load in CSV mode, the natural key is `year:region.adjara`, source IDs resolve, and field-by-field parity detects a changed transfer or net value.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- tests/data/municipal/servedMunicipalData.test.ts tests/data/servedDataParity.test.ts`
Expected: FAIL because adjustments are not served or mirrored.

- [ ] **Step 3: Add the dedicated Prisma mirror and transactional import**

```prisma
model MunicipalAdjaraBudgetAdjustment {
  id                       String  @id
  year                     Int     @unique
  scopeId                  String
  republicPaymentsGel      Decimal @db.Decimal(18, 2)
  municipalTransfersGel    Decimal @db.Decimal(18, 2)
  netRepublicPaymentsGel   Decimal @db.Decimal(18, 2)
  basis                    Basis
  republicSourceId         String
  transferSourceId         String
}
```

Load, insert, read back, and parity-check the 11 rows in the same transaction as the other municipal files.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm.cmd test -- tests/data/municipal/servedMunicipalData.test.ts tests/data/servedDataParity.test.ts`
Expected: PASS.

### Task 4: Use consolidated totals in the UI

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts`
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/georgia/page.tsx`
- Test: `apps/web/tests/explorer/municipalData.test.ts`
- Test: `apps/web/tests/browser/municipalities.spec.ts`
- Test: `apps/web/tests/browser/municipal-region.spec.ts`
- Test: `apps/web/tests/browser/municipal-georgia.spec.ts`

- [ ] **Step 1: Write failing model and browser assertions**

Assert the 2025 Adjara list value and region total are `1212519508.44`, the 2025 Georgia value is the adjusted country value, Adjara copy says transfers are removed, and no separate republic link exists.

- [ ] **Step 2: Run focused model tests and verify RED**

Run: `npm.cmd test -- tests/explorer/municipalData.test.ts`
Expected: FAIL because list and region models still use six-municipality totals.

- [ ] **Step 3: Thread adjustments through the existing model**

Pass the adjustment panel to list construction and the region route. Apply it only when `regionId === "region.adjara"`; all other region rows remain unchanged. Update concise Georgian source notes on the index, Adjara, and Georgia pages.

- [ ] **Step 4: Run focused model tests and verify GREEN**

Run: `npm.cmd test -- tests/explorer/municipalData.test.ts`
Expected: PASS.

### Task 5: Provenance, methodology, and full verification

**Files:**
- Add raw originals under: `docs/Raw Data/Municipalities/adjara-republic-budget-2015-2025/`
- Modify: `docs/data-methodology/municipal-functional-annual-2015-2025.md`
- Modify: `apps/web/lib/methodology/content/municipalities.ts`
- Modify: `Project_Definition.md`
- Modify: `DESIGN.md`
- Modify: methodology archive manifest generated by the existing script

- [ ] **Step 1: Preserve sources and document the exact formula**

Retain the original 2016–2025 workbook, the official 2015 Matsne PDF, and a manifest with URLs, SHA-256 hashes, byte sizes, units, rows used, and review date. Document that functions remain municipality-only while the total denominator is consolidated.

- [ ] **Step 2: Run deterministic data generation**

Run `npm.cmd run data:generate-municipal-facts` twice and verify the second run produces no diff.

- [ ] **Step 3: Run the repository definition of done**

Run from `apps/web`:

```text
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
```

Expected: all pass.

- [ ] **Step 4: Run final repository checks**

Run: `git diff --check` and `git status --short`.
Expected: no whitespace errors; only the intentional Adjara feature files are changed.
