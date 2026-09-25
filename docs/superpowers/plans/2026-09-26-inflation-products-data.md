# Inflation Product Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reviewed, reproducible monthly product-index data for every item in Geostat's latest basket, with public history from 2015 and no false joins across name or basket changes.

**Architecture:** Reuse inflation's verified source-package reader, XLSX parser, reviewed CSV, and validation patterns. Archive all four Geostat editions; parse and reconcile every source row; derive the latest-basket cohort; resolve continuity through exact bilingual matches plus explicit reviewed decisions. Only then generate canonical CSVs and a validation report. This plan ends at the data foundation, before serving or the product page.

**Tech Stack:** TypeScript, SheetJS `xlsx` already in `apps/web`, `decimal.js`, `csv-parse`, Zod, Vitest, existing static data pipeline.

**Spec:** `docs/superpowers/specs/2026-09-26-inflation-products-data-design.md`

## Global Constraints

- Public history starts at `2015-01`; read older source cells only when checking an annual comparison.
- Include every product in the latest basket, including later additions. Exclude retired products from canonical files; retain and inventory their original source rows.
- Preserve Geostat's published `previous month = 100` and `same month of the previous year = 100` indices. A displayed price-change percentage is `index − 100`; no GEL price, product weight, city value, or contribution is derived.
- An item number identifies a row only within one year. Cross-year continuity requires the same COICOP group and both normalized language labels, or an explicit reviewed decision. Never fuzzy-match automatically.
- Preserve `...` and ellipsis cells as unavailable, not zero. Unknown text or new missing patterns stop preparation.
- A changed source layout, language mismatch, source-hash mismatch against its manifest, product identity, historical value, or latest-basket membership stops the refresh for review.
- This plan adds no product explorer route, serving mirror, MCP data, or production deployment.
- Work in `apps/web` for commands. This checkout currently has no `node_modules`; run `npm ci` once before tests. Use targeted tests while working, then `npm run check` and `npm run build` once at the end per `CLAUDE.md`.

## Review Focus

1. A row number reused for a different product after a basket change must not carry the old product ID; Task 3 tests a moved row.
2. One unchanged language label with a changed label in the other must still require a decision; Task 3 tests this.
3. A product added after 2015 enters the latest cohort with its earlier months unavailable; Task 4 tests this.
4. The first eleven annual cells shown as ellipses for a new item stay unavailable while December can be published; Task 2 and Task 4 test this.
5. A future workbook that rewrites an old index or removes a current product cannot silently replace the canonical files; Task 5 tests both.

## File Map

| Responsibility | Files |
| --- | --- |
| Immutable Geostat source package | `docs/Raw Data/Inflation/geostat-products/2026-08/{en,ka}/products-{mom,yoy}.xlsx`, `source-manifest.csv`, `README.md` |
| Package and workbook readers | `apps/web/lib/data/inflation/productSourceFiles.ts`, `readGeostatProducts.ts`, `productTypes.ts` |
| Product identity audit and decisions | `apps/web/lib/data/inflation/productIdentity.ts`, `data/mappings/inflation-products/catalogue.csv`, `decisions.csv`, `data/reports/inflation-products-identity-review.csv` |
| Canonical preparation and validation | `apps/web/lib/data/inflation/prepareProducts.ts`, `validateProducts.ts`, `apps/web/scripts/prepare-inflation-products.ts`, `data/imports/cpi-products.csv`, `data/imports/cpi-products-monthly.csv`, `data/reports/inflation-products-validation.json` |
| Source registration and methods | `data/sources/source-documents.csv`, `data/methodology/source-archives/inflation.csv`, `docs/data-methodology/inflation-products.md`, `Project_Definition.md`, `apps/web/package.json` |

---

### Task 1: Archive and verify the four source files

**Files:** Create the source package and `apps/web/lib/data/inflation/productSourceFiles.ts`; test in `apps/web/tests/data/inflation/productSourceFiles.test.ts`.

**Interfaces:** `PRODUCT_FILE_ROLES = ["mom", "yoy"]`; `latestProductVintage(rawRoot?: string): Promise<string>`; `readVerifiedProductFiles(vintageDir: string): Promise<VerifiedProductFile[]>`, where a verified file includes role, language, source ID, retrieval metadata and `content: Buffer`.

- [ ] **Step 1: Install the locked dependencies if absent.** Run `npm ci` in `apps/web`; verify `node_modules/.package-lock.json` is current against `package-lock.json`.
- [ ] **Step 2: Write failing package tests.** Assert exactly one English and one Georgian file for each role, the current archive's four byte counts and SHA-256 values from spec §2, and rejection of a changed file, duplicated role, path escape or linked folder.
- [ ] **Step 3: Run `npx vitest run tests/data/inflation/productSourceFiles.test.ts`.** Expected: fails because the package reader and archive do not exist.
- [ ] **Step 4: Add untouched XLSX files, manifest and README; implement the two package-reader functions.** Read from the Geostat URLs in spec §2, verify hashes before accepting bytes, and reuse `readVerifiedPackageFile` for containment and symlink checks. Task 2 will compare the archive folder name with the parsed latest month.
- [ ] **Step 5: Run the targeted test.** Expected: all package checks pass. Commit only this source package, reader and test.

### Task 2: Parse and reconcile every source row

**Files:** Create `apps/web/lib/data/inflation/productTypes.ts`, `readGeostatProducts.ts`; test in `apps/web/tests/data/inflation/readGeostatProducts.test.ts`.

**Interfaces:** `ProductMeasure = "mom_index_100" | "yoy_index_100"`; `ProductSourceCell = { period: string; index100: string | null; marker: string | null; locator: string }`; `ProductSourceRow = { year: number; ordinal: number; coicopCode: string; label: string; cells: ProductSourceCell[] }`; `PairedProductRow = { year: number; ordinal: number; coicopCode: string; labelEn: string; labelKa: string; momCells: ProductSourceCell[]; yoyCells: ProductSourceCell[] }`. `readGeostatProducts(content: Buffer, role: "mom" | "yoy", language: "en" | "ka"): ProductSourceRow[]`; `pairProductEditions(files: VerifiedProductFile[]): PairedProductRow[]` pairs the four editions within each year.

- [ ] **Step 1: Write failing parser tests.** Assert 295 rows in both 2015 and 2016, 305 in 2026, 2026 ending at `2026-08`, source-exact August gasoline indices (`103.258` monthly and `123.1325` annual), and 770 annual unavailable cells across the complete source. Include malformed month header, duplicate ordinal, nonpositive index, unknown text, a formula cell with a cached value, and reordered Georgian-row cases; the current four source files contain no formula cells.
- [ ] **Step 2: Run `npx vitest run tests/data/inflation/readGeostatProducts.test.ts`.** Expected: parser interfaces are missing.
- [ ] **Step 3: Implement the reader and pairing.** Find title, item header and Roman month headers by content, then verify 2011–latest year sheets and the vintage folder's last month. Within a year, check numeric parity between languages for each measure and item-list parity between measures before pairing rows by ordinal. Preserve source precision as strings and both `...`/ellipsis markers with cell locators.
- [ ] **Step 4: Run the targeted test.** Expected: all source, parity and tamper cases pass. Commit parser, types and tests.

### Task 3: Audit product continuity before writing canonical data

**Files:** Create `apps/web/lib/data/inflation/productIdentity.ts`, `apps/web/tests/data/inflation/productIdentity.test.ts`, candidate catalogue and `data/reports/inflation-products-identity-review.csv`.

**Interfaces:** `ProductCatalogueRow = { productId: string; coicopCode: string; labelEn: string; labelKa: string; firstPeriod: string; decisionRef: string }`; `ProductDecisionRow = { year: number; ordinal: number; coicopCode: string; labelEn: string; labelKa: string; productId: string; decision: "link" | "split"; reason: string }`; `buildProductIdentityAudit(rows: PairedProductRow[], catalogue: ProductCatalogueRow[], decisions: ProductDecisionRow[]): ProductIdentityAudit`. The audit returns latest-cohort assignments, changed-name/group candidates, unresolved transitions, dropped-source rows and coverage by product. IDs use immutable `cpi.product.p0001`-style values; never derive them afresh from a mutable name or reuse a retired ID.

- [ ] **Step 1: Write failing identity tests.** Assert all 305 latest items enter the candidate catalogue, 2015–2016 has no transitions, 258 current items trace to 2015 by exact bilingual group/name matching before manual decisions, moved ordinals do not change identity, a one-language rename remains unresolved, and a retired source row is absent from the public candidate catalogue.
- [ ] **Step 2: Run `npx vitest run tests/data/inflation/productIdentity.test.ts`.** Expected: audit interface is missing.
- [ ] **Step 3: Implement exact matching and a deterministic candidate report.** Only collapse case and whitespace for comparison. The report names each boundary, both source labels and group, candidate link, reason and source row. Generate the first catalogue IDs once and keep them fixed in the reviewed catalogue; a rerun cannot silently renumber them.
- [ ] **Step 4: Run the targeted test and inspect the entire candidate report.** Expected: no auto-accepted changed-name/group transition and no unreported current-cohort gap. Commit the audit code, tests and candidate report. **Review checkpoint 1:** show the user the ambiguous matches and proposed same-product/new-product/split decisions before creating canonical facts.

### Task 4: Record reviewed identities and generate the current cohort

**Files:** Review and update `data/mappings/inflation-products/catalogue.csv`; add `decisions.csv`; modify `apps/web/lib/data/inflation/productIdentity.ts`; create `prepareProducts.ts`, `validateProducts.ts`, `apps/web/tests/data/inflation/prepareProducts.test.ts`. The canonical CSVs are generated only after Task 5 adds the remaining guards.

**Interfaces:** `ProductFactRow = { productId: string; measure: ProductMeasure; period: string; index100: string | null; availability: "published" | "not_published"; sourceId: string; sourceLocator: string; lastReviewedAt: string }`; `resolveProductIdentities(audit: ProductIdentityAudit, decisions: ProductDecisionRow[]): ResolvedProducts` rejects an unreviewed latest-cohort transition; `prepareProducts(options?: { rawRoot?: string; previousFacts?: ProductFactRow[] | null }): Promise<{ catalogue: ProductCatalogueRow[]; facts: ProductFactRow[]; validation: ProductValidationReport }>`; `serializeProducts(...)` and `serializeProductFacts(...)` emit stable UTF-8 CSV with BOM.

- [ ] **Step 1: Record every reviewed continuity or split decision from checkpoint 1 with source labels, years and a plain reason.** When evidence is insufficient, record `split` and start the later current product's history there. A changed label must never be linked by a fuzzy score.
- [ ] **Step 2: Write failing tests.** An unresolved transition blocks preparation; an approved alias preserves one ID; an uncertain split starts a later series; later entrants are included; retired products are excluded. Assert a published cell matches its workbook locator and a `...`/ellipsis cell remains a blank `not_published` row, never zero.
- [ ] **Step 3: Run `npx vitest run tests/data/inflation/prepareProducts.test.ts`.** Expected: canonical preparation is missing or the assertions fail.
- [ ] **Step 4: Implement identity resolution, in-memory canonical preparation and serializers.** Catalogue headers are `product_id,coicop_code,label_en,label_ka,first_period,decision_ref`; fact headers are `product_id,measure,period,index_100,availability,source_id,source_locator,last_reviewed_at`. Keep `2015-01` as the public floor, infer the latest roster from the latest sheet, and preserve source precision and locators. Leave an entire absent product-year without fact rows; never bridge its chart history. Do not write committed canonical data until Task 5's arithmetic and revision guards pass.
- [ ] **Step 5: Run the targeted test.** Expected: all cohort, provenance, missingness and CSV round-trip tests pass. Commit decisions, preparation code and tests; leave canonical output for Task 5.

### Task 5: Guard arithmetic and historical revisions

**Files:** Extend `apps/web/lib/data/inflation/validateProducts.ts`, `prepareProducts.ts`, and `apps/web/tests/data/inflation/prepareProducts.test.ts`.

**Interfaces:** `validateProductIndices(facts: ProductFactRow[]): ProductValidationReport` returns coverage, counts, gaps and arithmetic error; `findProductRevisions(previous: ProductFactRow[], previousCatalogue: ProductCatalogueRow[], currentSource: PairedProductRow[], decisions: ProductDecisionRow[]): string[]` checks old canonical cells against the freshly parsed full source before filtering by the new latest roster.

- [ ] **Step 1: Write failing guard tests.** One changed historical index, changed missing marker, newly missing item and changed latest roster must stop the run with a readable diff. The twelve-month check must pass the source audit within the spec's `0.002` index-point guard for verified identities and report uncomparable cells rather than counting them as passes.
- [ ] **Step 2: Run `npx vitest run tests/data/inflation/prepareProducts.test.ts`.** Expected: the new guards fail or are missing.
- [ ] **Step 3: Implement arithmetic, revision and membership checks.** Reuse the previously committed catalogue and decisions to find even a now-retired item's old source cells before deciding whether its removal was reviewed. Compare index values and availability, not display-rounded percentages.
- [ ] **Step 4: Run the targeted test.** Expected: all check and tamper cases pass. Commit guard code and tests before writing canonical outputs.

### Task 6: Write reviewed artifacts and integrate the data gate

**Files:** Create `apps/web/scripts/prepare-inflation-products.ts`, `data/imports/cpi-products.csv`, `data/imports/cpi-products-monthly.csv`, `data/reports/inflation-products-validation.json`, `docs/data-methodology/inflation-products.md`; modify `apps/web/package.json`, `data/sources/source-documents.csv`, `data/methodology/source-archives/inflation.csv`, `Project_Definition.md`; extend product and methodology source-inventory tests only where the new sources require it.

**Interfaces:** `writeProductArtifacts(mode: "write" | "check"): Promise<ProductValidationReport>` writes or byte-checks the two canonical CSVs and report. `data:validate` invokes `data:check-inflation-products`.

- [ ] **Step 1: Write failing artifact tests.** `--check` fails when a generated CSV or report differs; each of the four registered original-source links resolves to the archived bytes; the CSVs intended for Excel begin with UTF-8 BOM; the existing inflation canonical files remain byte-identical.
- [ ] **Step 2: Run `npx vitest run tests/data/inflation/prepareProducts.test.ts tests/methodology/sourceInventory.test.ts`.** Expected: artifact and source-registration checks fail.
- [ ] **Step 3: Implement the CLI, register sources, and write the methods and scope changes.** Use `source.geostat_product_mom`, `source.geostat_product_mom_ka`, `source.geostat_product_yoy`, and `source.geostat_product_yoy_ka`. Document the current-cohort policy, identity limits, gaps, published index meaning and refresh procedure. Amend `Project_Definition.md` §2C for the approved data foundation while keeping the public product page outside this plan.
- [ ] **Step 4: Run `npm run data:prepare-inflation-products`, then `npm run data:check-inflation-products` and the targeted product and methodology tests.** Expected: the generated CSVs and report match byte-for-byte; the report lists included, excluded, reviewed and uncomparable cases. Commit the outputs and integration.
- [ ] **Step 5: Run the repository done checks once:** `npm run check`, `npm run build`, and `npm run test:browser` against the built site, including the four newly downloadable methodology source files. Expected: zero failures and no change to the existing inflation public facts. **Review checkpoint 2:** show the canonical-data diff and validation report to the user before moving to product-page design or publication.
