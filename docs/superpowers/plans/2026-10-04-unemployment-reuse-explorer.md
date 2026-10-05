# Unemployment Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate one bilingual unemployment explorer using existing charts, tables, year controls, series selection and Excel downloads, backed by the collected official annual data.

**Architecture:** Promote the three reviewed primary research CSVs into the existing canonical CSV/database serving system. A dataset-specific model and state hook feed the current economic-sectors workspace components; the existing stacked-column chart supplies national population context. Extend the existing source/methodology and localization systems without adding new chart libraries or request-time data access.

**Tech Stack:** Next.js 16.3.8, React 19.3, strict TypeScript, Tailwind v4, existing editorial SVG components, Prisma 7, Decimal.js, ExcelJS, Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-unemployment-reuse-explorer-design.md`.

**Execution status:** Tasks 1–8 implemented and locally verified on 2026-10-05. Independent whole-branch reviews completed; both Important findings were fixed and verified with failing-then-passing regressions. The follow-up Minor filename finding was also reproduced and corrected in both languages. GitHub delivery, synchronization and the CI-gated production release were authorized on 2026-10-05.

## Global Constraints

- One unemployment explorer at `/explorer/unemployment`, with its English mirror at `/en/explorer/unemployment`.
- Use the production editorial appearance and existing chart components.
- Show one indicator at a time so counts and percentages never share an axis.
- Show counts in thousand persons and rates to one decimal.
- Default to the national unemployment rate, the full available comparable annual range and only the Georgia total selected.
- Bulk actions apply to every series in the active breakdown, independently of the search.
- Do not join pre-2010 data to the comparable main series, split old age bands, distribute combined regional figures or replace unavailable values with zero.
- No education counts or No education rates are published in the collected primary dataset; do not calculate or fabricate them.
- Keep the application statically rendered.
- Publishing, pushing, opening a PR, merging and deployment require separate authorization.

## Review Focus

- Education has a national reference with longer history: its view must still begin with the education source's own 2020 coverage. Test in Task 4.
- Historic age bands and combined regions look similar to current groups: identities, labels and missing-year gaps must preserve the difference. Test in Tasks 1 and 4.
- Exact decimal values and one-decimal display values serve different purposes: mirror checks must preserve the former while public output consistently displays the latter's precision. Test in Tasks 1, 3 and 5.
- Long-term rate and share are both percentages: their labels, source denominators and exported values must remain distinct. Test in Tasks 1, 4 and 5.
- An empty selection or a search filter must not change bulk scope, source selection or a shared URL's meaning. Test in Tasks 4, 5 and 6.

## File and Interface Map

New dataset modules live in `apps/web/lib/data/unemployment/`: `types.ts` defines the row/registry contracts; `prepareUnemployment.ts` promotes and checks reviewed inputs; `validation.ts` owns complete coverage and statistical/source validation; `importUnemployment.ts` owns CSV loading, mode selection and exact parity.

New explorer modules are `apps/web/lib/explorer/unemployment.ts`, `unemploymentState.ts` and `unemploymentWorkbook.ts`. New view modules live in `apps/web/components/unemployment/`: `unemployment-explorer.tsx`, `unemployment-series-panel.tsx` and `use-unemployment-state.ts`. Reuse existing shared components through their current inputs rather than making them into a new generalized framework.

`apps/web/lib/pages/unemployment.tsx` renders the two thin route wrappers. Methodology uses the existing `[dataset]` route, extended catalogue, source inventory and archives. Database integration extends the existing schema, mirror mapper and `scripts/import-budget-facts.ts` transaction.

All application commands below run from `apps/web` unless explicitly stated otherwise. Git commits include only the completed task's paths, preserving unrelated changes.

## Execution Preparation

- [x] Use the existing linked worktree; do not create a duplicate checkout. Install its locked dependencies with `npm ci` if absent or stale. Read the installed Next.js 16 guides before writing page code, and fetch current Prisma/ExcelJS documentation through Context7 for the APIs being used.
- [x] Run the existing narrow baseline: `npx vitest run tests/explorer/economicSectors.test.ts tests/explorer/economicSectorsWorkbook.test.ts tests/data/servedDataParity.test.ts`. Report any pre-existing failure before implementation; use focused checks during the tasks and reserve the full completion gate for Task 8.

## Task 1: Reviewed Canonical Data and Validation

**Create:** `apps/web/lib/data/unemployment/{types,prepareUnemployment,validation,importUnemployment}.ts`; `apps/web/scripts/prepare-unemployment.ts`; `data/imports/unemployment-annual.csv`; `data/imports/unemployment-education-annual.csv`; `data/imports/unemployment-long-term-annual.csv`; `data/taxonomy/unemployment-groups.json`; `apps/web/tests/data/unemployment/{preparation,validation,importUnemployment}.test.ts`.

**Modify:** `apps/web/package.json`; `docs/data-methodology/unemployment-annual.md`.

**Interfaces:** `UnemploymentIndicator` is the eleven source indicator IDs; `UnemploymentBreakdown` is `national | sex | settlement | age | region | education | long_term`; `UnemploymentSex` is `total | women | men`. `UnemploymentObservation` retains the source columns with camel-case keys, string `value` and `publishedValue`, normalized `sex`, and `lastReviewedAt`. Core sex rows infer sex from their explicit women/men group; other core rows use total. `ServedUnemploymentObservation` converts only `value` and `publishedValue` to numbers. `ClientUnemploymentObservation` projects `dimension`, `groupId`, `sex`, `indicatorId`, `year`, numeric `value`/`publishedValue` and `sourceId`. These types live in `types.ts`. `UnemploymentGroupDefinition` contains `id`, `labelKa`, `labelEn` and `sortOrder`. `prepareUnemploymentData(repositoryRoot: string, mode: "write" | "check"): Promise<void>`; `loadUnemploymentFacts(): Promise<UnemploymentObservation[]>`; `validateUnemploymentFacts(facts: readonly UnemploymentObservation[]): void`; `assertCompleteUnemploymentCoverage(facts: readonly UnemploymentObservation[]): void`; `assertUnemploymentParity(csv: UnemploymentObservation[], mirror: UnemploymentObservation[]): void`.

- [x] Write failing data tests asserting 2,872 core + 216 education + 54 long-term rows; exact numeric/source-field equality with all three reviewed research primary files; unique `(dimension, groupId, sex, indicatorId, year)` identities; the 2025 national published rate `13.9` and unemployed count `224.0`; absence of education counts/No education rates; rejection of a missing whole group-year, a duplicate, an altered capture and exchanged long-term rate/share values.
- [x] Run `npx vitest run tests/data/unemployment` and observe the missing dataset/implementation failures before writing production code.
- [x] Implement promotion and complete validation. Preserve original value strings and published precision; register explicit bilingual group labels. Use the preserved coverage inventories and primary indicator sets, not a count inferred from whatever rows survive. Check source capture SHA-256/size, registered source-cell provenance and the existing statistical identities. Add `data:prepare-unemployment` (`--write`) and `data:check-unemployment` (`--check`); include the latter in `data:validate`.
- [x] Run the research package's `python -B prepare.py --check` from its directory, then `npx vitest run tests/data/unemployment` and `npm run data:check-unemployment`. Expected: 3,142 primary observations, no failed source/coverage/reconciliation checks, and byte-stable canonical outputs.
- [x] Commit the canonical-data deliverable with its checks and methodology changes.

## Task 2: Source Registration and Bilingual Methodology

**Create:** `data/methodology/source-archives/unemployment.csv`; `apps/web/lib/methodology/content/unemployment.ts`; `apps/web/lib/methodology/content/en/unemployment.ts`; `apps/web/tests/methodology/unemployment.test.ts`.

**Modify:** `data/sources/source-documents.csv`; `data/localization/en/{documents,sources,labels}.json`; `apps/web/lib/methodology/{types,catalog,sourceInventory}.ts`; `apps/web/lib/i18n/messages/{ka,en}/methodology.json`; the established archive tests' inventories where they enumerate live datasets.

**Interfaces:** Add `unemployment` to `LIVE_METHODOLOGY_IDS`; export `UNEMPLOYMENT_METHODOLOGY_CONTENT: MethodologyContent` in both languages. Existing `loadReviewedSourceManifest(root, "unemployment")` and methodology `[dataset]` routing become the public source/methodology entry points. Archive entries cite only the relevant primary coverage, with notes explaining older/quarterly material retained inside originals.

- [x] Write failing tests requiring all nine captured originals from the research manifest, matching fingerprints and exact retrieval dates; public paths under `/downloads/methodology/unemployment/`; primary coverage 2010–2025; supplemental coverage 2020–2025; denominator definitions, historical classification limits and the survey-estimate explanation in both languages.
- [x] Run `npx vitest run tests/methodology/unemployment.test.ts` and observe failure before extending the catalogue.
- [x] Register the existing seven workbooks, source-page capture and metadata without modifying their bytes. Add source-document and reviewed English catalogue entries using the existing attribution/archive conventions. Extend the methodology catalogue and inventory; add concise explanation-first content, original-source links and the existing archive download. Ensure metadata/source-page captures do not extend public data coverage into pre-2010 or quarterly observations.
- [x] Run `npm run data:prepare-methodology-archives`, `npm run data:check-methodology-archives`, `npx vitest run tests/methodology/unemployment.test.ts tests/methodology/sourceManifest.test.ts tests/methodology/sourceInventory.test.ts` and `npm run i18n:check`. Expected: nine validated unemployment originals, supported live methodology routes and no missing reviewed English source labels.
- [x] Commit the registered-source/methodology deliverable. The explorer sidebar marker stays inactive until Task 7 activates the whole feature.

## Task 3: Private Database Mirror and Transactional Import

**Modify:** `apps/web/prisma/schema.prisma`; `apps/web/lib/db/{mirrorRows,servedDataDb}.ts`; `apps/web/scripts/import-budget-facts.ts`; `apps/web/lib/data/unemployment/importUnemployment.ts`; `docs/data-methodology/database-import.md`.

**Create:** versioned Prisma migration for `UnemploymentFact`, following the repository's migration naming/creation workflow; `apps/web/tests/data/unemployment/{mirrorRows,mirrorIntegration,servingBoundary}.test.ts`.

**Interfaces:** `UnemploymentFact` mirrors `UnemploymentObservation` with compound primary key `(dimension, groupId, sex, indicatorId, year)`, source/import-run relations and `value`/`publishedValue` at Decimal(40,20). The inspected source values have at most 16 decimal places. `loadUnemploymentFactsFromMirror(client): Promise<UnemploymentObservation[]>`; `loadUnemploymentFactsFromDb(): Promise<UnemploymentObservation[]>`; `loadServedUnemploymentRows(): Promise<{ facts: UnemploymentObservation[] }>`; `loadServedUnemploymentData(): Promise<{ facts: ServedUnemploymentObservation[] }>` where the served type converts numeric fields only after exact parity. `resetUnemploymentCacheForTests(): void`.

- [x] Write failing tests exercising the real mirror-row mapper with representative records, exact decimal normalization, every provenance field, compound-key uniqueness, missing/changed-row rejection, db-mode mismatch failure and absence of a silent CSV fallback. Require the migration's row-level security and revocation from `anon`/`authenticated`. Verify import ordering and use of the serving mapper inside the existing transaction.
- [x] Run `npx vitest run tests/data/unemployment` and observe the expected missing-mirror failures.
- [x] Add the model/migration and relation fields. Extend the existing import transaction: validate source IDs and all canonical observations before opening it; delete unemployment children before source parents; create rows with the active import-run ID; reload through the same mirror mapper; compare all fields and exact decimals before commit; add row counts/parity evidence to the import report. Add CSV/db serving selection and cache reset following economic sectors. Preserve existing datasets and transaction behavior.
- [x] Generate the Prisma client and validate the schema using the installed Prisma CLI; run `npx vitest run tests/data/unemployment tests/data/servedDataParity.test.ts tests/data/servedDataParityCoverage.test.ts`. Expected: source precision is unchanged; malformed/mismatched mirrors fail; import integration retains its transactional boundary. No live database is migrated or imported in this implementation task.
- [x] Commit the mirror/import deliverable. Record live migration/import as a separately authorized delivery operation, not a locally verified result.

## Task 4: Explorer Model, Coverage and Shareable State

**Create:** `apps/web/lib/explorer/unemployment.ts`; `apps/web/lib/explorer/unemploymentState.ts`; `apps/web/tests/explorer/{unemployment,unemploymentState}.test.ts`.

**Interfaces:** `ClientUnemploymentObservation` retains `dimension`, `groupId`, `sex`, `indicatorId`, `year`, numeric `value`/`publishedValue` and `sourceId`. `UnemploymentState` has `indicator`, `breakdown`, `educationSex`, `mode: "line" | "table"`, the existing all/manual range shape and `selectedIds`. `DEFAULT_UNEMPLOYMENT_STATE` selects `unemployment_rate`, national, total, line, all years and `["georgia"]`. `buildUnemploymentModel(facts, registry, state)` returns `range`, `availableYears`, `years`, `definitions`, `referenceId`, `rows`, `series`, `endValues`, `headline`, `activeFacts`, `sourceIds`, `hasData`. `buildUnemploymentComposition(facts, years)` returns existing stacked-chart `periods`, three `segments` and `overlay: null`. `parseUnemploymentHash(hash, facts, registry): UnemploymentState`; `serializeUnemploymentHash(state): string`; `changeUnemploymentBreakdown(state, breakdown, facts): UnemploymentState`; `changeUnemploymentIndicator(state, indicator, facts): UnemploymentState`; `changeUnemploymentEducationSex(state, sex, facts): UnemploymentState`.

- [x] Write failing tests for the default national series/range, indicator-specific units, empty selection and range, exact long-term denominator distinctions, and all URL fields including an explicitly empty `sel`. Assert education years are 2020–2025 even though its applicable national reference has earlier history; women/men references match education sex; historical 15–24 ends in 2019 while 15–19 begins in 2020; earlier combined regions remain separate. Test breakdown changes reset selection to the applicable reference and incompatible indicators fall back to the destination's unemployment-rate measure.
- [x] Run `npx vitest run tests/explorer/unemployment.test.ts tests/explorer/unemploymentState.test.ts` and observe expected failures.
- [x] Implement the model using existing period-range, URL-state, formatting and color helpers. Use active-breakdown source years first, then clip reference observations to that inventory; education does not inherit a 2010 start from its reference. Do not backfill gaps. Chart rates are percentage points; table rates are fractions, following the shared components' existing contract. Counts remain thousand persons. Rank current end-year values with the reference first and unavailable values last; keep color assignments stable. Build the national stack from exact employed/unemployed/outside-labour-force values, independently of checked main series.
- [x] Run the two new test files plus `tests/explorer/chartScale.test.ts` and `tests/explorer/chartNavigation.test.ts`. Expected: all state/coverage cases pass and national stack components reconcile to survey population within the source package's tolerance.
- [x] Commit the model/state deliverable.

## Task 5: Existing Excel Writer with Unemployment Content

**Create:** `apps/web/lib/explorer/unemploymentWorkbook.ts`; `apps/web/tests/explorer/unemploymentWorkbook.test.ts`.

**Interfaces:** `buildUnemploymentWorkbookExportModel(facts: ClientUnemploymentObservation[], registry: UnemploymentGroupDefinition[], state: UnemploymentState, presentation: Presentation, sources: (WorkbookPublicSource & { sourceId: string })[], siteOrigin: string): WorkbookExportModel`. Consume Task 4's `activeFacts`, row order and years. Build the existing configurable `WorkbookExportModel` directly, as economic sectors does; preserve the shared writer unless a concrete test demonstrates a missing required input.

- [x] Write failing tests for both languages, selected years/groups only, counts in thousand persons, percentage fractions with one-decimal percentage formats, missing cells, actual basis, the two distinct long-term percentage measures, and the source workbooks actually used by selected observations. Assert headers contain Number (thousand persons)/Rate (%) equivalents and never a GEL amount column; no source-cell/internal columns are exported. An education-only selection excludes unrelated core/long-term originals; a removed reference does not remain in the export.
- [x] Run `npx vitest run tests/explorer/unemploymentWorkbook.test.ts` and observe expected failures.
- [x] Implement Summary/Data/Sources output through the current Excel download/writer path. Use configurable analysis headers and `numericFormats`; count display is one decimal and percentage display is `0.0%`. Derive sources and compressed source-year ranges from selected active facts; use validated public-archive URLs. Preserve correct basis and survey-estimate context without exposing internal metadata.
- [x] Run `npx vitest run tests/explorer/unemploymentWorkbook.test.ts tests/explorer/workbookWriter.test.ts tests/explorer/economicSectorsWorkbook.test.ts`. Expected: parse generated workbooks with ExcelJS and prove displayed units, values, source hyperlinks and existing workbook behavior remain correct.
- [x] Commit the workbook deliverable.

## Task 6: Reused Explorer Components and Browser Behavior

**Create:** `apps/web/components/unemployment/{unemployment-explorer,unemployment-series-panel,use-unemployment-state}.tsx` (use `.ts` for the state hook); `apps/web/lib/i18n/messages/{ka,en}/unemployment.json`; `apps/web/tests/explorer/unemploymentPresentation.test.tsx`; `apps/web/tests/browser/unemployment.spec.ts`.

**Modify:** `apps/web/lib/i18n/{types,messages.server}.ts` to register the message scope.

**Interfaces:** `UnemploymentExplorer` receives `facts`, `registry`, validated `sources`, `lastReviewedAt` and `siteOrigin`. `UnemploymentSeriesPanel` receives the active definitions, reference ID, selection, final-year values, indicator, query and callbacks. `useUnemploymentState(facts, registry)` returns `{ state, update }` following the existing economic-sectors history restoration and app-ready pattern.

- [x] Write failing presentation/browser cases for default Georgia-only selection; existing Chart/Table and year controls; all seven breakdowns; education sex and compatible indicators; all three long-term measures; count/rate unit labels; stable history/back/forward and language-preserved state; cleared-selection callouts; unlimited selection; Clear/Select all and denominator unchanged by search; chart/table/workbook agreement. Require exactly the existing line and stacked-column chart types, with no new chart dependency.
- [x] Run `npx vitest run tests/explorer/unemploymentPresentation.test.tsx` and the narrow browser spec once a route is available in Task 7; observe missing UI/route failures before completing their implementation.
- [x] Reuse `ExplorerHeading`, `ExplorerWorkspace`, `SeriesAside`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesSelector`, `SeriesSelectorRow`, `SegmentedTabs`, `ExcelDownloadButton`, `Callout` and `SourceNote`. Add the compact indicator/breakdown controls in existing editorial style. Keep grouping controls above search and preserve selector bulk/count rules. Connect Task 4 state/model and Task 5 export. Add the labelled national composition chart below the workspace using `StackedColumnChart`, with matching selected years and independent main-selection behavior.
- [x] Run the presentation tests and `npm run typecheck`; after Task 7 adds routes, run `npx playwright test tests/browser/unemployment.spec.ts`. Test both locales at 390, 768 and 1440 pixels, keyboard operation, long labels, missing-year gaps and downloads.
- [x] Commit the reused-component deliverable after its unit checks pass; complete its route-dependent browser evidence in Task 7.

## Task 7: Activate the Page, Navigation and Discovery Together

**Create:** `apps/web/lib/pages/unemployment.tsx`; `apps/web/app/(ka)/explorer/unemployment/page.tsx`; `apps/web/app/(en)/en/explorer/unemployment/page.tsx`; `apps/web/tests/explorer/unemploymentPage.test.tsx`.

**Modify:** `apps/web/components/shell/data-sidebar.tsx`; `apps/web/lib/seo/sitemap.ts`; `apps/web/lib/i18n/inventory.server.ts`; `data/localization/en/page-revisions.json`; the existing common/navigation messages and localization route inventories; `Project_Definition.md`; the affected scope/navigation/coverage sections of `DESIGN.md`; `docs/data-methodology/unemployment-annual.md` and the research README's integration status.

**Interfaces:** `unemploymentPageMetadata(locale: Locale): Promise<Metadata>`; `renderUnemploymentPage(locale: Locale)` loads the validated serving rows, reviewed registry, scoped presentation and public-source manifest, and passes only the numeric client projection to Task 6. The two route files call these functions with `ka`/`en`. Existing methodology `[dataset]` routing already handles the Task 2 entry. Use the established localization inventory and page-revision files; do not create a parallel inventory.

- [x] Write failing page/navigation/SEO tests for both explorer URLs, both methodology URLs, correct Georgian/English title/canonical/alternate links, source-derived dates and coverage, the sidebar's active unemployment link and inactive demography marker. Assert Budget is not incorrectly active on the unemployment route. Dataset metadata must omit non-existent bulk-download URLs and must not add unemployment to MCP/publication inventories.
- [x] Run `npx vitest run tests/explorer/unemploymentPage.test.tsx tests/seo/routes.test.ts tests/i18n/routes.test.ts` and observe the missing-route/navigation failures.
- [x] Implement the thin static page wrappers using the economic-sectors renderer pattern. Activate the existing sidebar position, with correct route-active state and collapsed/mobile behavior. Add sitemap/page-revision/localization entries, existing breadcrumb metadata and a page-local Dataset JSON-LD object describing these annual survey observations without a distribution URL or catalog-publication claim. Do not extend `datasetVocabulary.ts`, whose identifiers belong to the separately approved query/publication system. Update the authoritative scope/design/methodology descriptions to reflect this approved bounded feature, including its first-version exclusions. Preserve other route families and homepage design.
- [x] Run the Task 6 browser spec, relevant methodology/navigation/SEO tests and `npm run i18n:check`. Expected: both languages, source downloads, shareable state and Excel work through the real page, and unsupported dataset publication links are absent.
- [x] Commit the activation deliverable.

## Task 8: Completion Gate and Independent Review

- [x] Check the final diff against the approved spec and every Review Focus item; remove unrelated changes and any generated scratch files created by this task. Mark completed plan steps only when their evidence exists.
- [x] Run `npm run check` once after implementation inputs settle, then build with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`. Use PowerShell environment syntax on Windows. Expected: lint, types, unit/data/localization checks and the static production build pass.
- [x] Serve that built artifact on an available local port and run `npm run test:browser` against it with `CI=1`, `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` and `PLAYWRIGHT_BASE_URL` set consistently. Stop the server before any rebuild. Inspect desktop/mobile screenshots for both languages; verify console, sources and a representative workbook. Do not repeat a passing gate unless its inputs change.
- [x] Obtain one independent final code review of the whole change, focused on statistical denominators/classification, complete serving parity, export/source correctness, state/selection behavior and strict component reuse. Resolve actionable findings and rerun only checks affected by those fixes.
- [x] Update this plan/spec with actual local implementation/verification status and report the preview, checks and remaining delivery boundary. Keep live database migration/import, GitHub publication, merge and production deployment pending separate authorization. Do not claim a public URL is live from local evidence.

## Completion evidence — 2026-10-05

- `npm run check` passed: 346 test files and 2,968 tests passed, with one existing skipped file/seven skipped tests. All data validation passed, including 3,142 unemployment observations; localization passed for 315 labels and 123 public page identities. The query reference fixture passed without expectation changes.
- The final production build passed with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`; all four unemployment explorer/methodology URLs are in the prerender manifest. The existing 23 query publications and snapshot data version remain unchanged.
- The full 647-case browser run passed 646 cases and hit a 90-second timeout in the bilingual all-URL request test while the completion suite ran concurrently. After the review fixes, the affected browser specs ran sequentially against the rebuilt artifact: 21/21 passed, including that all-URL test in 18.2 seconds and six new count-scale checks. No behavior failure remains; unchanged passing browser checks were not repeated.
- Both languages were visually inspected at 390, 768 and 1440px. Count-axis labels fit, historical labels and gaps are readable, browser page errors are empty, a representative education workbook agrees with the screen, and all nine downloaded originals match their captured hashes.
- One independent read-only review checked `75a5cd51..c121e52d`, source cells, fingerprints and coverage. It found clipped count-scale labels and rounding before database parity; both Important findings were reproduced by failing tests and fixed in `f07da652`. The whole unit suite and affected browser specs passed afterward. No Critical or deferred Minor finding remains.

Local preview: `http://127.0.0.1:31841/explorer/unemployment` and `/en/explorer/unemployment`. Verification logs, review notes and screenshots are preserved under the ignored `.tmp/unemployment-verification/` and `.tmp/unemployment-preview/` directories. The disposable plan-execution workspace is removed after completion.

At local implementation completion, the Prisma migration had been generated and validated offline; live migration/import, production database permissions, GitHub publication, required CI, merge and production deployment had not been performed or verified. The subsequent delivery request authorizes those release operations through the repository's existing pipeline.

## Implementation decisions

1. Register `source.<original-id>` where the existing source register requires dot-namespaced IDs, retaining original research IDs in observations and archives. If this mapping is wrong, source-relation/parity validation rejects the import.
2. Exclude the nine human-only unemployment source entries from the existing query snapshot. If the exclusion is wrong, unsupported unemployment sources could appear in the query service.
3. Create the planned bilingual message scope with the workbook task, before the page task, because export labels need it first. Incorrect labels fail localization checks.
4. Leave live database/release operations outside the review and this local authorization. Release-specific failures may remain until the separately authorized delivery checks.
5. Use the approved reviewed Geostat package as the statistical authority, verifying source consistency rather than independently re-estimating the statistics. A source-level statistical error would require Geostat or a separate research review.
6. Have the executor run and record full completion/browser gates while the independent reviewer performs separate targeted checks. A missed regression could escape the automated checks; no duplicate full review run was requested.
