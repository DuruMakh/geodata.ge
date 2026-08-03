# Exclude Occupied-Territory Municipal Bodies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove municipality codes `05`, `42`, `43`, `46`, and `64` from every public/served municipal registry and fact dataset while preserving the official MoF raw-source archive unchanged.

**Architecture:** Keep the reviewed 69-municipality research package under `docs/Raw Data/` as immutable provenance. Apply one explicit exclusion set at the raw-to-served generation boundary, remove the five entities and the now-empty Abkhazia region from served taxonomy files, and let the existing database wipe-and-reload import mirror the reduced CSV dataset.

**Tech Stack:** TypeScript, Vitest, CSV/JSON served data, Prisma mirror import, Markdown product/data specifications.

## Global Constraints

- Excluded municipality codes are exactly `05`, `42`, `43`, `46`, and `64`.
- Public coverage is 64 municipalities, 11 data-bearing regions, 7,040 function facts, and 704 total facts for 2015-2025.
- Do not delete or rewrite files under `docs/Raw Data/Municipalities/`; they remain the official source archive.
- Database rows must be removed through the existing transactional `npm run data:import` wipe-and-reload path, never by direct database editing.
- No municipalities UI or route is introduced by this change.

---

### Task 1: Lock the reduced public coverage contract

**Files:**
- Modify: `apps/web/tests/data/municipal/municipalitiesFile.test.ts`
- Modify: `apps/web/tests/data/municipal/generateMunicipalFacts.test.ts`
- Modify: `apps/web/tests/data/municipal/servedMunicipalData.test.ts`
- Modify: `apps/web/tests/data/municipal/taxonomyFiles.test.ts`

**Interfaces:**
- Consumes: the existing CSV/JSON municipal loaders.
- Produces: regression coverage proving the five codes cannot reappear in the served registry or facts.

- [x] **Step 1: Write failing registry and fact assertions**

```ts
const EXCLUDED_CODES = ["05", "42", "43", "46", "64"];

expect(municipalities).toHaveLength(64);
expect(municipalities.filter((row) => EXCLUDED_CODES.includes(row.code))).toEqual([]);
expect(facts).toHaveLength(7040);
expect(totals).toHaveLength(704);
expect([...facts, ...totals].filter((row) => EXCLUDED_CODES.includes(row.municipalityCode))).toEqual([]);
```

- [x] **Step 2: Update the served taxonomy expectation**

```ts
expect(regions).toHaveLength(11);
expect(regions.map((region) => region.id)).not.toContain("region.abkhazia");
```

- [x] **Step 3: Run the four municipal test files and verify RED**

Run: `npm test -- tests/data/municipal/municipalitiesFile.test.ts tests/data/municipal/generateMunicipalFacts.test.ts tests/data/municipal/servedMunicipalData.test.ts tests/data/municipal/taxonomyFiles.test.ts`

Expected: FAIL because the current files still contain 69 municipalities, 12 regions, 7,590 function facts, 759 total facts, and the five excluded codes.

### Task 2: Exclude the five codes at the generation boundary

**Files:**
- Modify: `apps/web/lib/data/municipal/generateMunicipalFacts.ts`
- Modify: `data/imports/municipalities.csv`
- Modify: `data/taxonomy/municipal-regions.json`
- Regenerate: `data/imports/municipal-function-facts-2015-2025.csv`
- Regenerate: `data/imports/municipal-total-facts-2015-2025.csv`

**Interfaces:**
- Consumes: immutable 69-municipality raw CSVs.
- Produces: the reduced 64-municipality served files used identically by CSV and DB serving modes.

- [x] **Step 1: Add the explicit public exclusion set before mapping/sorting**

```ts
const EXCLUDED_MUNICIPALITY_CODES = new Set(["05", "42", "43", "46", "64"]);

const functionRows = rawFunctions
  .filter((record) => !EXCLUDED_MUNICIPALITY_CODES.has(record.municipality_code))
  // existing map, sort, and output mapping
```

Apply the same filter to `rawTotals`.

- [x] **Step 2: Remove the five rows from the served registry and the empty Abkhazia region from the served taxonomy**

Delete only registry codes `05`, `42`, `43`, `46`, `64` and the `region.abkhazia` JSON entry. Preserve all remaining official codes and sort IDs unchanged.

- [x] **Step 3: Regenerate served facts**

Run: `npm run data:generate-municipal-facts`

Expected: `Wrote municipal function facts: 7040` and `Wrote municipal total facts: 704`.

- [x] **Step 4: Run the four municipal test files and verify GREEN**

Run the Task 1 command again.

Expected: PASS.

### Task 3: Align specifications and durable project context

**Files:**
- Modify: `Project_Definition.md`
- Modify: `DESIGN.md`
- Modify: `AGENTS.md`
- Modify: `apps/web/lib/data/coverage.ts`
- Modify: `docs/data-methodology/municipal-functional-annual-2015-2025.md`
- Modify: `docs/superpowers/specs/2026-08-02-municipal-data-serving-layer-design.md`

**Interfaces:**
- Consumes: the approved exclusion decision and verified output counts.
- Produces: one consistent public contract for subsequent municipalities-page planning.

- [x] **Step 1: Replace served coverage counts**

Document 64 municipalities, 11 data-bearing regions, 7,040 function facts, and 704 total facts wherever the current served layer is described.

- [x] **Step 2: Replace the occupied-territory interpretation**

Record that the raw package retains all 69 official rows, but codes `05`, `42`, `43`, `46`, and `64` are intentionally excluded from GeoData.ge's public municipal dataset because they represent municipal bodies serving displaced communities rather than territorially attributable spending inside the occupied municipalities.

- [x] **Step 3: Preserve historical-source statements precisely**

Keep statements about the original raw workbooks, 69-workbook archive, validation report, and 69-municipality population column when they describe the source package rather than the served output.

### Task 4: Verify the complete serving contract

**Files:**
- Verify only; no new production files.

**Interfaces:**
- Consumes: all reduced served files and documentation.
- Produces: evidence that generators, loaders, validation, and build remain coherent.

- [x] **Step 1: Re-run generation and prove a clean fixed point**

Run `npm run data:generate-municipal-facts`, then confirm `git diff` shows no second-run changes.

- [x] **Step 2: Run focused municipal tests**

Run: `npm test -- tests/data/municipal`

Expected: PASS.

- [x] **Step 3: Run the repository check gate**

Run: `npm run check`

Expected: lint, typecheck, unit tests, and data validation all PASS.

- [x] **Step 4: Run the CSV-mode production build**

Run: `npm run build`

Expected: PASS using the default reviewed CSV serving path.

- [x] **Step 5: Inspect the final diff**

Confirm no files under `docs/Raw Data/Municipalities/` changed, all five codes are absent from `data/imports/`, and unrelated user files remain untouched.
