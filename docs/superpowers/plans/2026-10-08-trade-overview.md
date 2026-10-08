# Trade Hub and Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bilingual Trade hub and national goods Overview, using the existing explorer with four comparable checkboxes, matching tables and Excel, four end-year figures and signed balance bars.

**Architecture:** Promote only the frozen national goods totals and their reviewed turnover/balance derivations. Validate them against the original workbook, serve the small canonical package through the existing CSV/private database paths, and compose the existing editorial components. Source preparation remains separate from serving so deployed pages do not import raw workbook readers or the wider trade research package.

**Tech Stack:** Existing Next.js 16.3.8, React 19.3, strict TypeScript, Tailwind v4, Prisma 7.10/Postgres, decimal.js, csv-parse, fflate/SheetJS for preparation, ExcelJS, Vitest and Playwright. No new product dependency.

**Spec:** `docs/superpowers/specs/2026-10-07-trade-overview-design.md`, approved 2026-10-08.

**Status:** Approved on 2026-10-08 when the user said "yes continue". Execution is inline in this chat, followed by one independent whole-branch review. Work is isolated at `C:/Users/Mylaptop/.codex/worktrees/trade-overview/Geodata.ge`, preserving the original checkout and its local edits.

## Global Constraints

- Reuse the production editorial appearance and existing explorer components.
- Default to line mode, the full loaded annual coverage and only Total trade selected. Total trade remains first, selectable and removable.
- Any combination of the four checkboxes is valid because all indicators have the same USD unit.
- Search does not change the bulk-action scope or denominator.
- Preserve the selected years, indicators and chart/table mode in URL state and across language changes.
- The context chart remains visible in main-table mode and with no main series selected.
- Preserve the source's unspecified publication status; do not label every complete annual period as final.
- Do not relabel the full package as accepted, modify its held comparisons or treat its failing acceptance command as a success.
- The page does not add trade MCP tools, central CSV/JSON publications, a public API or additional trade sections.
- Keep pages prerendered; read only canonical data at build time. No publisher fetch or raw workbook reading at request time.
- Preserve the existing user changes in `AGENTS.md` and unrelated untracked files. Stage only task-owned paths. Publishing and live migration/import require separate authorization.

## Review Focus

1. Removing an entire year from all four indicators must fail coverage validation, even though the remaining identities still reconcile: Task 1.
2. A correct number assigned to the wrong flow, year, source cell or derived-input order must fail source validation: Task 1.
3. A mismatched private database copy must fail the build/import instead of silently falling back to CSV: Task 2.
4. An empty checkbox selection must survive URL/language changes while the summaries and balance context remain visible: Tasks 3 and 4.
5. A trade export must not inherit GEL headings, budget/GDP columns, sign judgments or a fabricated final-publication label: Tasks 3 and 4.

---

## Execution entry

- [ ] Review the approved spec and this plan. Use the selected execution skill and the worktree skill at execution time to inspect the checkout/attached worktrees; preserve the existing design commit and user changes.
- [ ] Read the bundled Next.js app-router/static-rendering guides under `apps/web/node_modules/next/dist/docs/` before product code. Confirm the existing Node 24 runtime and installed dependencies; install only if the checkout actually needs them.

## Task 1: Accepted national-goods serving package

**Files:** Create `apps/web/lib/data/tradeOverview/types.ts`, `validation.ts`, `prepareTradeOverview.ts`, `apps/web/scripts/prepare-trade-overview.ts`, `data/imports/trade-overview-annual.csv`, `data/reports/trade-overview-validation.json`, and `apps/web/tests/data/tradeOverview/validation.test.ts` / `prepareTradeOverview.test.ts`. Modify `apps/web/package.json` and `docs/data-methodology/trade-annual.md`.

**Interfaces:** `TradeOverviewIndicator = "trade.turnover" | "trade.exports" | "trade.imports" | "trade.balance"`. `TradeOverviewFact` contains `year`, `indicatorId`, exact-decimal-string `valueUsd`, `unit: "usd"`, `basis: "actual"`, `valueStatus: "numeric"`, `publicationStatus: "unspecified"`, `role: "total" | "derived"`, `sourceId`, JSON-string `sourceRefs`, nullable native `sourceValue` / `sourceUnit` / `sourceLabel` / `sourceNumberFormat`, and `lastReviewedAt`. Primary records retain the research role `total`; derived records retain `derived`. Export `tradeOverviewFactKey(fact): string`, `validateTradeOverviewFacts(facts: readonly TradeOverviewFact[], expectedYears: readonly number[]): void`, and `prepareTradeOverviewData(repositoryRoot: string, mode: "write" | "check"): Promise<void>`.

- [ ] Write failing source/coverage tests, including these acceptance assertions:

```ts
expect(facts).toHaveLength(124);
expect(years).toEqual(Array.from({ length: 31 }, (_, i) => 1995 + i));
expect(value(2025, "trade.exports")).toBe("7287805027.5742908");
expect(value(2025, "trade.imports")).toBe("18648513307.186789");
expect(value(2025, "trade.turnover")).toBe("25936318334.7610798");
expect(value(2025, "trade.balance")).toBe("-11360708279.6124982");
```

`value` is a test-local Decimal-normalized lookup. Mutation cases remove one whole year, duplicate a record, exchange export/import references, change an input year, reverse derived reference order, insert re-exports/services/2026, change a value/unit/status, corrupt the original workbook or remove a required field. Each must fail for its actual cause.

- [ ] Run `npx vitest run --configLoader native tests/data/tradeOverview/validation.test.ts tests/data/tradeOverview/prepareTradeOverview.test.ts` in `apps/web`; establish the intended failures before implementation.
- [ ] Implement the fixed subset preparation. Verify `official/FTrade_1995-2026.xlsx` against `full-source-manifest.json` using `readVerifiedPackageFile`. Follow `prepareUnemployment.ts` to read raw XLSX XML decimal tokens with the existing libraries. Match every primary native value to its exact cell, declared million-USD unit, reviewed year/flow layout and USD conversion; use Decimal precision 50. Preserve the source-block coverage inventory, requiring every approved export/import pair. Match the two national goods derivations and their ordered source references exactly; exclude national re-exports from the same input file.
- [ ] Write deterministic BOM CSV plus the scoped report containing the approved years, 62 native/62 derived observations, source/canonical fingerprints and `status: "passed"` for Overview. Use the recorded scope-review date `2026-10-08` for `lastReviewedAt`, rather than the clock at each check. Record the wider package's `requires_source_resolution` status and two services holds without modifying any research artifact. `--check` reproduces bytes without writes; corrupted or stale output fails. Serving validation later reads only this small coverage/report package, never the raw sources.
- [ ] Add `data:prepare-trade-overview` (`--write`) and `data:check-trade-overview` (`--check`), with the check in `data:validate`. Generate the approved artifacts, rerun the focused tests and `npm run data:check-trade-overview`; require passing output. Document scoped acceptance, actual-record basis versus unspecified finality, FOB/CIF and nominal USD in the methodology.
- [ ] Commit only Task 1 paths with message `data: prepare accepted national goods trade overview`.

## Task 2: CSV/database serving and exact parity

**Files:** Create `apps/web/lib/data/tradeOverview/importTradeOverview.ts` and `apps/web/tests/data/tradeOverview/serving.test.ts` / `mirror.test.ts`. Modify `apps/web/lib/data/servedData.ts`, `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `apps/web/prisma/schema.prisma`, and `data/sources/source-documents.csv`. Generate a named `trade_overview` Prisma migration under `apps/web/prisma/migrations/` using the repository's migration tooling; the tool supplies its timestamp.

**Interfaces:** Task 1 supplies exact facts and validation. Export `loadTradeOverviewFacts(): Promise<TradeOverviewFact[]>`, `assertTradeOverviewParity(csv: readonly TradeOverviewFact[], mirror: readonly TradeOverviewFact[]): void`, and `loadServedTradeOverviewData(): Promise<{ facts: TradeOverviewFact[] }>`. Define `ClientTradeOverviewFact` in `types.ts` as `Pick<TradeOverviewFact, "year" | "indicatorId" | "sourceId" | "publicationStatus" | "role" | "lastReviewedAt"> & { valueUsd: number }`; export `toClientTradeOverviewFact(fact: TradeOverviewFact): ClientTradeOverviewFact`. Add `tradeOverviewMirrorCreateRows(facts: readonly TradeOverviewFact[], importRunId: string): Prisma.TradeOverviewFactCreateManyInput[]` and `loadTradeOverviewFactsFromMirror(db: Pick<Prisma.TransactionClient, "tradeOverviewFact">): Promise<TradeOverviewFact[]>` alongside existing mirror adapters.

- [ ] Write failing tests for CSV mode, memoized loads, complete-row parity, changed decimals/status/source references, missing mirror years and rejection without CSV fallback. Check native source tokens and nullable derived metadata survive create/read mapping. Run `npx vitest run --configLoader native tests/data/tradeOverview/serving.test.ts tests/data/tradeOverview/mirror.test.ts` and establish failures.
- [ ] Implement the canonical loader and build-time cache, following `importUnemployment.ts`; normalize numeric USD strings with Decimal before comparison while retaining native source tokens. Introduce numeric conversion only in the client projection. Keep preparation imports out of the serving dependency graph.
- [ ] Add `TradeOverviewFact` with key `(indicatorId, year)`, `valueUsd Decimal @db.Decimal(40,20)`, preserved native text/provenance/status, and the existing SourceDocument/ImportRun relations. The collected USD values have at most eight significant fractional digits. Validate capacity before insertion, use decimal strings rather than Number for database writes and compare all canonical fields after reading.
- [ ] Register `source.geostat_trade_ftrade-1995-2026`. Extend the existing import transaction, source checks, replacement, row-count report and parity failure path for this dataset. Match the current migration pattern: enable RLS and revoke access from `anon` and `authenticated`; add no public policies or Data API grants.
- [ ] Generate SQL against a verified disposable development database with `npx prisma migrate dev --create-only --name trade_overview`, then review its scope. Both `DIRECT_URL` and `DATABASE_URL` must be explicitly set to the disposable target because `prisma.config.ts` prefers `DIRECT_URL`; never inherit the normal live credentials for this command. Use a non-connecting Prisma migration diff if a disposable target is unavailable, preserving the repository's versioned migration convention. Do not apply to a live database.
- [ ] Run the focused tests, `npx prisma validate`, `npm run prisma:generate` and `npm run typecheck`. If a disposable Postgres target is available, verify migration, role grants, exact round-trip and a deliberately failing transaction there. Otherwise record that real-database rehearsal remains unverified; mapping tests do not count as that proof.
- [ ] Commit only Task 2 paths with message `feat: add parity-checked trade overview serving`.

## Task 3: Explorer state, calculations and native Excel model

**Files:** Create `apps/web/lib/explorer/tradeOverview.ts`, `tradeOverviewState.ts`, `tradeOverviewWorkbook.ts`, `tradeHubCards.ts`, and `apps/web/tests/explorer/tradeOverview.test.ts`, `tradeOverviewState.test.ts`, `tradeOverviewWorkbook.test.ts`, `tradeHubCards.test.ts`.

**Interfaces:** Consume `ClientTradeOverviewFact` from Task 2. Define `TradeOverviewState = { mode: "line" | "table"; range: PeriodRange; selectedIds: TradeOverviewIndicator[] }` and `DEFAULT_TRADE_OVERVIEW_STATE` with all years/turnover only. Export `parseTradeOverviewHash(hash: string, facts: readonly ClientTradeOverviewFact[]): TradeOverviewState`, `serializeTradeOverviewHash(state: TradeOverviewState): string`, and `buildTradeOverviewModel(facts: readonly ClientTradeOverviewFact[], state: TradeOverviewState, presentation: Presentation): TradeOverviewModel`. The model has `years: number[]`, `range: ResolvedPeriodRange`, `unit: ValueUnit`, `selectedIds: TradeOverviewIndicator[]`, `valuesByIndicator: Record<TradeOverviewIndicator, Record<number, number | null>>`, `endValues: Record<TradeOverviewIndicator, number | null>`, and `balanceValues: Array<number | null>`; the latter two remain independent of selection. Export `buildTradeOverviewWorkbookExportModel(input: { facts: readonly ClientTradeOverviewFact[]; state: TradeOverviewState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel` and `buildTradeHubCards(facts: readonly ClientTradeOverviewFact[], presentation: Presentation): HubCardModel[]`.

- [ ] Write failing tests for turnover-only defaults, every checkbox combination, total removal, search-independent bulk scope, signed balance, absent end-year dashes, and context values with empty selection. Pin URL behavior: absent `sel` defaults to turnover; explicit empty `sel` stays empty; duplicates/unknown IDs are removed; the existing `refitRange` rules handle invalid ranges. Run `npx vitest run --configLoader native tests/explorer/tradeOverview.test.ts tests/explorer/tradeOverviewState.test.ts` and establish failures.
- [ ] Implement the small models using `periodRange.ts`, existing URL helpers and number formatting. Declare the four IDs in the spec order; use stable existing editorial colours and ink for turnover. Pick the USD million/billion scale from all four indicators over the active years, so changing checkboxes cannot alter the scale or summary figures. No additional ratios, growth or currency conversion.
- [ ] Add failing workbook/hub tests. In both languages, assert selected indicators/years only, explicit USD amount headings, no GEL/GDP/budget-specific headings, no visible change column, neutral signed-number formats, source publication status and validated source links. The hub has exactly one active Overview card whose sparkline is turnover and coverage comes from facts. Run the two named tests to establish failures.
- [ ] Reuse `buildWorkbookExportModel` and the current writer. In the trade adapter, replace the returned `analysis.headers` with trade labels, append publication status to its rows, and use `readable.subtitle` to explain the two formulas. Set `showChangeColumn: false` and a neutral `readable.numberFormat`; provide matching `analysis.numericFormats`. Preserve the shared model's defaults for all other datasets. Use the original source workbook link and current three-sheet naming.
- [ ] Rerun all four Task 3 tests; require agreement between model values, workbook numbers and the canonical numeric projection. Commit only Task 3 paths with message `feat: model trade overview selection and Excel export`.

## Task 4: Bilingual pages, context charts, navigation and methodology

**Files:** Create `apps/web/components/trade/trade-overview.tsx`, `apps/web/lib/pages/trade.tsx`, and four route wrappers under `apps/web/app/(ka)/explorer/trade/{page.tsx,overview/page.tsx}` and `apps/web/app/(en)/en/explorer/trade/{page.tsx,overview/page.tsx}`. Create `apps/web/lib/i18n/messages/{ka,en}/trade.json`, `apps/web/lib/methodology/content/trade.ts`, `apps/web/lib/methodology/content/en/trade.ts`, `data/methodology/source-archives/trade.csv`, `apps/web/tests/explorer/tradeOverviewRender.test.tsx`, `apps/web/tests/i18n/tradePresentation.test.ts`, and `apps/web/tests/browser/trade-overview.spec.ts`.

Modify `apps/web/components/shell/data-sidebar.tsx` / `explorer-footer.tsx`, `apps/web/lib/i18n/types.ts` / `messages.server.ts` / `inventory.server.ts`, `apps/web/lib/seo/sitemap.ts`, `apps/web/lib/methodology/types.ts` / `catalog.ts` / `sourceInventory.ts`, `data/localization/en/labels.json` / `sources.json` / `documents.json` / `page-revisions.json`, and `data/methodology/decision-register.csv` where the existing completeness checks require Trade entries. Generate source-archive outputs with the existing preparation script.

**Interfaces:** Task 3 supplies the models, state and workbook. Export `tradeHubMetadata(locale): Promise<Metadata>`, `tradeOverviewMetadata(locale): Promise<Metadata>`, `renderTradeHub(locale): Promise<ReactNode>` and `renderTradeOverviewPage(locale): Promise<ReactNode>`. `TradeOverview` receives numeric facts, validated workbook sources, review date and site origin, matching current page/client separation. Both methodology files export `TRADE_METHODOLOGY_CONTENT: MethodologyContent`.

- [ ] Write failing render/localization tests for the four checkbox labels/order, initial single checked total, end-year summaries and independent signed context chart. Add route/browser scenarios for both languages and the three viewport widths; establish the intended failing tests before writing the page.
- [ ] Compose `ExplorerWorkspace`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector`, `ExcelDownloadButton` and the existing editorial summary treatment. Use the table's existing `showChangeColumn={false}`, localized row labels and no share column. Build balance bars through `StackedColumnChart` with one signed segment, `overlay={null}`, common years, explicit USD units and a neutral sign explanation. Do not create new chart primitives or alter shared defaults.
- [ ] Reuse `BudgetHub` for the single Overview entry. Put Trade immediately after Unemployment in the sidebar, give it its own active context and show its Overview child only while active. Add both route families, source footer, breadcrumbs, canonical/language alternates, data-derived metadata and sitemap entries. Add no invented public dataset distribution address.
- [ ] Register the Trade message scope and public-page translations/review dates. Use `საგარეო სავაჭრო ბრუნვა`, `ექსპორტი`, `იმპორტი`, `სავაჭრო სალდო` for the four Georgian indicators, with the spec's English labels. Explain nominal USD, balance sign and FOB/CIF in concise source/methodology copy.
- [ ] Add the archive allowlist for exactly `FTrade_1995-2026.xlsx`, `external_trade_methodology.html` and `metadata-en.html` from the frozen `official/` directory, with captured hashes/dates and translated document entries. Keep wider research sources outside the public archive. Register methodology decisions for national-only scope, the two formulas, valuation and unspecified publication status. The existing dynamic methodology routes supply both new pages.
- [ ] Run the new render/localization/model tests and `npm run i18n:check`. Generate and check methodology archives. Build a production artifact and serve it on an available project-local port; use the same `NEXT_PUBLIC_SITE_URL` at build and browser-test time and set `PLAYWRIGHT_BASE_URL` to that server.
- [ ] Verify browsers: default and all-four comparison; turnover removal; search/bulk behavior; explicit empty selection through reload and language change; changed end year; balance visible in table/empty modes; no overflow outside the existing chart/table frames; native keyboard controls; a downloaded three-sheet XLSX with matching values/units/status/source links; hub/sidebar/methodology routes. Inspect rendered views at 390/768/1440 pixels in Georgian and English. Commit only Task 4 paths with message `feat: add bilingual trade hub and overview pages`.

## Task 5: Authority updates, review and completion evidence

**Files:** Modify `Project_Definition.md`, `DESIGN.md`, `docs/data-methodology/trade-annual.md`, the design status and this plan's execution checkboxes/evidence. Update narrowly affected existing tests only where their approved page/translation/archive inventories now include Trade.

- [ ] Record the approved hub, four-indicator Overview, source subset, languages, table/Excel and independent balance context in their canonical owners. Keep the research foundation's wider services/product limitations. Check the final diff: no unrelated refactoring, new chart library, extra Trade section, MCP publication, live database write or changes to the user's `AGENTS.md` edit.
- [ ] Obtain an independent review against the spec and fix concrete findings using narrow tests. Recheck source/report fingerprints and preserve the original wider research acceptance holds. Check the served import graph and build output to ensure only the small Overview dataset enters its page bundle.
- [ ] Run `npm run check` once on the final inputs. Run `npm run build` once with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, stopping any server that uses that `.next` directory first. The last Task 4 build may serve as this build if its product inputs remain unchanged. Serve the resulting artifact and run the full `npm run test:browser` against it, keeping site origin and base URL consistent. Do not repeat a passing gate without changed inputs or a new failure.
- [ ] If review changes inputs, rerun only the affected narrow checks before the final gates. Do not claim database import/migration rehearsal without a disposable Postgres run, or claim production delivery from a local build.
- [ ] Commit the final task-owned documentation and fixes. Report the checkout, branch, commit, completed local checks and any unverified database boundary; link the reviewable Overview result. Request delivery approval only after implementation is concrete and locally verified, if publishing is desired.

## Plan self-review

All spec sections have owners: data/acceptance in Task 1; static serving/private parity in Task 2; state/units/Excel/hub models in Task 3; UI, sources, languages and navigation in Task 4; authority updates and the completion gates in Task 5. All five Review Focus cases have named tests. Native exact strings end at the client projection, and source preparation is outside the serving dependency graph. Migration timestamps are generated by the tool; no live target is assumed. Implementation awaits plan review and an execution-method choice.

Documentation checked while planning: [Prisma v7 schema reference](https://www.prisma.io/docs/orm/v7/reference/prisma-schema-reference), [Prisma v7 shadow database](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database), and [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security). Repository Prisma/import conventions take precedence over generic Supabase CLI migration examples.
