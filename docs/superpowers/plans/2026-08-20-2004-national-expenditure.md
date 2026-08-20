# 2004 National Expenditure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reviewed 2004 actual expenditure to the existing functional and ministries groupings and make the expenditure explorer cover 2004–2025 without publishing the central-only GEL 1.5 billion series.

**Architecture:** Archive and hash the complete Ministry of Finance sources, then add one deterministic 2004 functional extractor and one ministry-total extractor. Feed their reviewed outputs through the existing CSV composition, validation, Prisma parity, explorer, GDP-share, CSV-export, and methodology paths; no new UI or taxonomy is needed.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Playwright, `pdf-parse`, CSV, Prisma 7, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-20-2004-national-expenditure-design.md`

## Global Constraints

- Serve only the complete 2004 state-budget actual of GEL 1,930,210,300.
- Do not publish or label the GEL 1.5 billion central-only total as a separate series.
- Preserve every reviewed official institution row and send uncertainty explicitly to `other_unclassified` or `admin_spending.other_costs`.
- Keep `basis = actual`; actual remains preferred over planned.
- Reuse the existing 13 `spending.*` fields and 14 `admin_spending.*` categories.
- Do not add a route, drilldown page, 2004 revenue, or 2004 major-program series.
- Keep 2005–2025 data byte-for-byte equivalent after regeneration.
- Keep Georgian CSV exports compatible with Microsoft Excel, including UTF-8 BOM where the existing contract requires it.

---

## File map

**New source and review files**

- `docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-report.pdf` — official narrative and scope confirmation.
- `docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-annex.pdf` — canonical functional and organizational tables.
- `apps/web/lib/data/realExpenditurePdf/year2004StateBudget.ts` — full-state functional parser and mapping input.
- `data/mappings/review/spending-field-mapping-review-2004-old-classification.csv` — reviewed functional crosswalk.
- `data/mappings/review/admin-spending-institution-review-2004.csv` — reviewed mapping of all 47 institution totals.
- `data/imports/expenditure-facts-2004-final.csv` and `data/reports/expenditure-2004-final-report.json` — generated functional handoff and reconciliation evidence.

**Existing files that change together**

- `apps/web/scripts/generate-final-old-classification-expenditure.ts` — accept 2004 and invoke the full-state parser.
- `apps/web/lib/data/adminSpending/extractOlderMinistryYears.ts` and `extractWorkbooks.ts` — add the 2004 ministry-total extractor.
- `apps/web/scripts/generate-admin-spending-data.ts`, `compose-budget-facts.ts`, `validate-data-files.ts`, and `apps/web/lib/data/servedData.ts` — generate and serve truthful `*-2004-2025.csv` filenames.
- `apps/web/lib/data/coverage.ts` — make 2004 a detailed expenditure and admin year while leaving revenue at 2005.
- Source manifests, methodology content, decision register, tests, and Prisma comments — reflect the new coverage and provenance.

### Task 1: Archive and register the complete official sources

**Files:**
- Create: `docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-report.pdf`
- Create: `docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-annex.pdf`
- Modify: `data/sources/source-documents.csv`
- Modify: `data/methodology/source-archives/expenditure.csv`
- Test: `apps/web/tests/data/sourceCoverage.test.ts`
- Test: `apps/web/tests/methodology/sourceInventory.test.ts`

**Interfaces:**
- Produces source IDs `source.mof_2004_expenditure_full_state_functional_actual` and `source.mof_2004_programmatic_fact_actual` for both downstream pipelines.
- Produces immutable source files pinned to SHA-256 `C999654E...49889` and `9E368DDD...D52E`.

- [ ] **Step 1: Write failing source-registration tests**

Add assertions that both source IDs resolve, both archived PDFs exist, their hashes and byte sizes match the spec, and both public methodology download entries resolve.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm.cmd test -- tests/data/sourceCoverage.test.ts tests/methodology/sourceInventory.test.ts`

Expected: failure because the complete 2004 source files and source IDs are not registered.

- [ ] **Step 3: Copy and register the official files**

Copy, without deleting the research copies:

```text
tmp/source-hunt-2004/mof-2004-execution-annex.pdf
  -> docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-annex.pdf
tmp/source-hunt-2004/mof-2004-12-month-execution-overview.pdf
  -> docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-report.pdf
```

Register the exact source IDs, official MoF acquisition URL, repository paths, byte sizes, retrieval date, media type, and full hashes. Keep the existing central-only PDF registered as supporting evidence, not as the source of served facts.

- [ ] **Step 4: Regenerate and check methodology archives**

Run: `npm.cmd run data:prepare-methodology-archives`

Run: `npm.cmd run data:check-methodology-archives`

Expected: both commands pass and the 2004 expenditure archive contains the new files.

- [ ] **Step 5: Commit the source package**

```bash
git add "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports" data/sources/source-documents.csv data/methodology/source-archives/expenditure.csv apps/web/tests/data/sourceCoverage.test.ts apps/web/tests/methodology/sourceInventory.test.ts
git commit -m "data: archive complete 2004 expenditure sources"
```

### Task 2: Generate the reviewed 2004 functional facts

**Files:**
- Create: `apps/web/lib/data/realExpenditurePdf/year2004StateBudget.ts`
- Modify: `apps/web/scripts/generate-final-old-classification-expenditure.ts`
- Modify: `apps/web/package.json`
- Create: `apps/web/tests/data/realExpenditurePdf/year2004StateBudget.test.ts`
- Generate: `data/mappings/review/spending-field-mapping-review-2004-old-classification.csv`
- Generate: `data/imports/expenditure-facts-2004-final.csv`
- Generate: `data/reports/expenditure-2004-final-report.json`

**Interfaces:**
- Consumes page 232 of the complete execution annex plus the existing central functional detail only for exact carve-outs.
- Produces 13 `BudgetFactCsvRow` actual facts whose `source_id` is `source.mof_2004_expenditure_full_state_functional_actual`.

- [ ] **Step 1: Write the failing parser and reconciliation tests**

Pin these source facts:

```ts
expect(result.grandTotalGel).toBe(1_930_210_300);
expect(result.groupTotalsGel.get(5)).toBe(147_362_300);
expect(result.groupTotalsGel.get(6)).toBe(364_257_700);
expect(result.groupTotalsGel.get(12)).toBe(67_416_800);
expect(result.facts).toHaveLength(13);
expect(result.facts.reduce((sum, row) => sum + Number(row.amount_gel), 0)).toBe(1_930_210_300);
```

Also assert that all amounts are non-negative, every `spending.*` ID appears exactly once, and the central-only grand total is never emitted.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- tests/data/realExpenditurePdf/year2004StateBudget.test.ts`

Expected: failure because the 2004 full-state parser does not exist.

- [ ] **Step 3: Implement the smallest deterministic parser**

Use `readPdfTextPages()` and a hard SHA-256 gate. Parse the 14 plan/`xarji` pairs from annex page 232, select only `xarji`, convert thousand GEL to whole GEL, and reject missing/duplicate groups.

Reuse the existing old-classification mapping rules. For groups 8 and 14, take only the exact sport, debt, and intergovernmental-transfer carve-outs from the archived detailed central table; calculate the parent remainder by subtraction. Use the complete annex values for every parent total, especially health, social protection, and transport. Never prorate the GEL 417 million scope difference.

- [ ] **Step 4: Extend the generator and add the command**

Add 2004 to `sourcesByYear`, route it to `year2004StateBudget.ts`, and add:

```json
"data:generate-final-2004-expenditure": "tsx scripts/generate-final-old-classification-expenditure.ts --year 2004"
```

- [ ] **Step 5: Generate and inspect the reviewed outputs**

Run: `npm.cmd run data:generate-final-2004-expenditure`

Expected:

- 13 fact rows;
- actual total GEL 1,930,210,300;
- health/social/transport pins match the official table;
- the review CSV identifies the full-state parent rows and every supporting carve-out;
- the report records both source files and the central/full-state scope distinction.

- [ ] **Step 6: Run the focused tests**

Run: `npm.cmd test -- tests/data/realExpenditurePdf/year2004StateBudget.test.ts tests/data/pipelineIntegration.test.ts`

Expected: the new focused tests pass; the integration test may still fail on coverage until Task 4 changes the composed files.

- [ ] **Step 7: Commit the functional pipeline**

```bash
git add apps/web/lib/data/realExpenditurePdf/year2004StateBudget.ts apps/web/scripts/generate-final-old-classification-expenditure.ts apps/web/package.json apps/web/tests/data/realExpenditurePdf/year2004StateBudget.test.ts data/mappings/review/spending-field-mapping-review-2004-old-classification.csv data/imports/expenditure-facts-2004-final.csv data/reports/expenditure-2004-final-report.json
git commit -m "data: add complete 2004 functional expenditure"
```

### Task 3: Generate the reviewed 2004 ministry facts

**Files:**
- Modify: `apps/web/lib/data/adminSpending/extractOlderMinistryYears.ts`
- Modify: `apps/web/lib/data/adminSpending/extractWorkbooks.ts`
- Modify: `apps/web/lib/data/adminSpending/categories.ts` only if a reviewed 2004 label is not covered by an existing rule
- Create: `data/mappings/review/admin-spending-institution-review-2004.csv`
- Modify: `apps/web/tests/data/adminSpending/olderMinistryYears.test.ts`
- Modify: `apps/web/tests/data/adminSpending.test.ts`

**Interfaces:**
- Produces `extractAdminSpending2004Rows(): OfficialExpenditureRow[]`.
- Preserves 47 official institution totals as 2004 leaf rows plus one printed grand-total row.
- Produces only `admin_category` facts for 2004; no `major_program` facts.

- [ ] **Step 1: Write failing 2004 organization tests**

Pin the source structure and rounding:

```ts
expect(institutionRows).toHaveLength(47);
expect(defenceRow?.actualThousandGel).toBe(172_009.0);
expect(totalRow?.actualThousandGel).toBe(1_930_210.3);
expect(institutionRows.reduce((sum, row) => sum + row.actualThousandGel, 0)).toBeCloseTo(1_930_210.4, 1);
expect(programFacts).toHaveLength(0);
```

Assert every institution code appears once in the review CSV and every row maps to an existing `admin_spending.*` category.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm.cmd test -- tests/data/adminSpending/olderMinistryYears.test.ts tests/data/adminSpending.test.ts`

Expected: failure because 2004 is not in the admin pipeline.

- [ ] **Step 3: Implement the 2004 ministry-total extractor**

Read pages 2–231 of the annex through `readPdfTextPages()`, transliterate the legacy Georgian font, retain the 47 top-level organizational totals, and synthesize the `00 00` total from the printed grand-total line. Store the PDF page as row provenance.

Build the reviewed 47-row mapping. Use existing category rules when the label is unambiguous; encode any source-backed Finance or Culture/Sport split as explicit synthetic leaf rows whose components add back exactly to the official institution amount. Route every unresolved institution to `admin_spending.other_costs` with medium confidence and a note.

- [ ] **Step 4: Wire 2004 into extraction**

Add `2004: extractAdminSpending2004Rows` to `OLDER_MINISTRY_YEAR_EXTRACTORS` and include 2004 in `ADMIN_SPENDING_YEARS`. Ensure `generateAdminSpendingFacts()` sees institution totals as leaves and emits no 2004 major programs.

- [ ] **Step 5: Run the generator and review reconciliation**

Run: `npm.cmd run data:generate-admin-spending`

Expected report for 2004:

- 47 reviewed institution totals preserved;
- printed source total GEL 1,930,210,300;
- category sum no more than GEL 1,000 from the printed total;
- the expected GEL 100 thousand-unit rounding difference is disclosed, not hidden;
- zero 2004 major-program facts.

- [ ] **Step 6: Run focused tests**

Run: `npm.cmd test -- tests/data/adminSpending/olderMinistryYears.test.ts tests/data/adminSpending.test.ts`

Expected: pass.

- [ ] **Step 7: Commit the ministry pipeline**

```bash
git add apps/web/lib/data/adminSpending apps/web/tests/data/adminSpending data/mappings/review/admin-spending-institution-review-2004.csv data/staging/admin-spending-official-rows-2004-2025.csv data/reports/admin-spending-2004-2025-report.json
git commit -m "data: add 2004 ministry expenditure"
```

### Task 4: Compose, rename, validate, and serve 2004–2025 files

**Files:**
- Modify: `apps/web/lib/data/coverage.ts`
- Modify: `apps/web/scripts/compose-budget-facts.ts`
- Modify: `apps/web/scripts/generate-admin-spending-data.ts`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/lib/data/servedData.ts`
- Modify: `apps/web/scripts/import-budget-facts.ts`
- Modify comments only: `apps/web/prisma/schema.prisma`
- Rename: `data/imports/expenditure-facts-2005-2025.csv` → `data/imports/expenditure-facts-2004-2025.csv`
- Rename: `data/imports/budget-facts-2005-2025.csv` → `data/imports/budget-facts-2004-2025.csv`
- Rename: `data/imports/admin-spending-facts-2005-2025.csv` → `data/imports/admin-spending-facts-2004-2025.csv`
- Rename: `data/reports/budget-facts-2005-2025-compose-report.json` → `data/reports/budget-facts-2004-2025-compose-report.json`
- Modify: `apps/web/tests/data/pipelineIntegration.test.ts`
- Modify: `apps/web/tests/data/sourceCoverage.test.ts`
- Modify: `apps/web/tests/data/servedData.test.ts`
- Modify: `apps/web/tests/explorer/integration.test.ts`

**Interfaces:**
- `EXPENDITURE_DETAILED_YEARS` and `ADMIN_SPENDING_YEARS` become inclusive 2004–2025 arrays.
- `REVENUE_YEARS` remains 2005–2025.
- `SERVED_DATA_FILES` points only to truthful 2004–2025 expenditure/admin filenames.

- [ ] **Step 1: Change coverage tests first**

Assert:

```ts
expect(EXPENDITURE_DETAILED_YEARS).toEqual(inclusiveYears(2004, 2025));
expect(ADMIN_SPENDING_YEARS).toEqual(inclusiveYears(2004, 2025));
expect(REVENUE_YEARS[0]).toBe(2005);
expect(totalFor("expenditure", 2004)).toBe(1_930_210_300);
```

Add a cross-pipeline assertion that the 2004 functional/admin totals differ by no more than GEL 2,000, consistent with the existing independent-source rule.

- [ ] **Step 2: Run tests and confirm the expected coverage failure**

Run: `npm.cmd test -- tests/data/sourceCoverage.test.ts tests/data/pipelineIntegration.test.ts tests/explorer/integration.test.ts`

- [ ] **Step 3: Update coverage and output paths**

Change only expenditure/admin coverage to 2004. Rename the three served CSVs and compose report, then update every runtime, importer, validator, test, and Prisma comment reference. Do not rename `revenue-facts-2005-2025.csv`.

- [ ] **Step 4: Regenerate canonical outputs in dependency order**

Run:

```text
npm.cmd run data:generate-final-2004-expenditure
npm.cmd run data:generate-admin-spending
npm.cmd run data:compose-budget-facts
```

Expected: `budget-facts-2004-2025.csv` contains 2004 expenditure but no 2004 revenue.

- [ ] **Step 5: Prove older values did not drift**

Compare all 2005–2025 expenditure and admin rows, excluding filename/header metadata, against the pre-change files. Expected: no changed amount, basis, item ID, source ID, or official label.

- [ ] **Step 6: Validate generated data**

Run: `npm.cmd run data:validate`

Run: `npm.cmd test -- tests/data/sourceCoverage.test.ts tests/data/pipelineIntegration.test.ts tests/data/servedData.test.ts tests/explorer/integration.test.ts`

Expected: pass, with 2004 present in both expenditure groupings and revenue unchanged.

- [ ] **Step 7: Verify database parity**

With the documented test database configuration, run: `npm.cmd run data:import`

Expected: transactional import succeeds and reports exact CSV/database row-count and GEL-total parity for budget and admin facts.

- [ ] **Step 8: Commit the composed serving data**

```bash
git add apps/web/lib/data/coverage.ts apps/web/lib/data/servedData.ts apps/web/scripts apps/web/prisma/schema.prisma apps/web/tests data/imports data/reports
git commit -m "data: serve expenditure from 2004"
```

### Task 5: Replace the obsolete 2004 exclusion documentation

**Files:**
- Modify: `Project_Definition.md`
- Modify: `README.md`
- Modify: `docs/data-methodology/treasury-functional-expenditure-methodology-2004-2025.md`
- Modify: `docs/data-methodology/2005-2006-old-classification-expenditure-methodology.md`
- Modify: `docs/data-methodology/ministries-expenditure-methodology.md`
- Modify: `docs/data-methodology/ministries-drilldown-programs-methodology.md`
- Modify: `docs/data-methodology/database-import.md`
- Modify: `docs/data-methodology/revenue-methodology.md` only for the composed budget filename; revenue coverage remains unchanged
- Modify: `data/methodology/decision-register.csv`
- Modify: `apps/web/lib/methodology/content/expenditure.ts`
- Modify: `apps/web/tests/browser/methodology.spec.ts`

**Interfaces:**
- Public methodology reports expenditure coverage as 2004–2025 and revenue as 2005–2025.
- The old exclusion decision is replaced by an inclusion/source-scope decision with canonical-document coverage.

- [ ] **Step 1: Update methodology tests first**

Replace expectations that 2004 is excluded with assertions that the expenditure methodology shows 2004–2025, names the full state-budget total, and explains why the central-only PDF is not served.

- [ ] **Step 2: Update scope and methodology documents**

Document:

- canonical annex page ranges and hashes;
- full-state functional total and the three special-fund additions;
- the reviewed old-classification mapping and carve-outs;
- the 47-institution ministry extraction and GEL 100 rounding difference;
- actual-only basis;
- the absence of 2004 major programs;
- truthful `*-2004-2025.csv` paths.

Do not alter the revenue limitation for 2004.

- [ ] **Step 3: Replace decision-register entries**

Remove `expenditure.scope.2004_excluded.functional` and `.admin`. Add canonical decisions for full-state 2004 functional inclusion, 2004 administrative inclusion, and central-source non-use. Update the Georgian public decision cards to match.

- [ ] **Step 4: Run methodology checks**

Run: `npm.cmd run data:prepare-methodology-archives`

Run: `npm.cmd run data:check-methodology-archives`

Run: `npm.cmd test -- tests/methodology tests/data/sourceCoverage.test.ts`

Expected: pass with complete decision coverage and no stale public “2004 excluded” claim.

- [ ] **Step 5: Commit documentation and provenance**

```bash
git add Project_Definition.md README.md docs/data-methodology data/methodology apps/web/lib/methodology/content/expenditure.ts apps/web/tests/browser/methodology.spec.ts
git commit -m "docs: document complete 2004 expenditure coverage"
```

### Task 6: Verify the explorer end to end

**Files:**
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify only if a derived-data assumption is exposed: `apps/web/components/main-explorer/*`

**Interfaces:**
- Consumes the renamed served files through `loadServedExplorerData()`.
- Produces browser proof for functional, ministries, GDP-share, table, and CSV behavior.

- [ ] **Step 1: Add browser assertions for 2004**

Test that:

- the expenditure year range begins at 2004;
- the public-functions view shows the 2004 total and selectable categories;
- switching to ministries keeps 2004 available;
- no 2004 major-program child is fabricated;
- `% მშპ-ში` calculates against the existing 2004 GDP denominator;
- downloaded functional and ministries CSVs contain 2004 actual rows and source metadata;
- revenue still starts in 2005;
- no “1.5 billion central budget” public series or toggle exists.

- [ ] **Step 2: Run the complete local verification gates**

From `apps/web` run separately:

```text
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run data:validate
npm.cmd run build
npm.cmd run test:browser
```

Expected: every command passes. If Windows Playwright teardown alone times out after all assertions pass, record it separately and use hosted CI as the required browser gate.

- [ ] **Step 3: Check deterministic regeneration**

Run the functional generator, admin generator, composer, and methodology archive generator again. Then run `git status --short`.

Expected: no generated-file diff after the second run; only intended source/spec/plan changes remain.

- [ ] **Step 4: Commit final test coverage**

```bash
git add apps/web/tests/browser/main-explorer.spec.ts
git commit -m "test: verify 2004 expenditure in explorer"
```

### Task 7: Deliver and verify production

**Files:** none beyond the completed implementation.

**Interfaces:**
- Produces a reviewed GitHub PR and production evidence for the exact merge SHA.

- [ ] **Step 1: Review the final diff and worktree state**

Confirm the implementation is on a `codex/*` branch, contains no research renders or unrelated `tmp/` files, and preserves user-owned work.

- [ ] **Step 2: Push and open a draft PR**

Push the branch, create a draft PR summarizing source scope, mappings, reconciliation, filenames, and verification, then mark it ready only after local gates are green.

- [ ] **Step 3: Complete required review**

Wait for required CI and browser checks, inspect all review conversations, implement valid findings, rerun affected gates, and resolve conversations. Do not bypass a required check.

- [ ] **Step 4: Merge and synchronize**

Merge only with required checks green, delete the remote branch, fetch the merge commit, and confirm local/remote ancestry without resetting or cleaning user work.

- [ ] **Step 5: Verify the live deployment**

Confirm Vercel deployment status is `READY` for the merge SHA. On the live site verify:

- `/explorer/expenditure` returns HTTP 200;
- functional and ministries modes both expose 2004;
- 2004 total is GEL 1.9302103bn;
- GDP-share mode and representative CSV downloads work;
- revenue still begins in 2005;
- no browser console or runtime errors occur.

- [ ] **Step 6: Record final evidence**

Report the branch, commits, PR, required checks, merge SHA, deployment ID/status, live URLs, representative 2004 values, and any explicitly unverified boundary.
