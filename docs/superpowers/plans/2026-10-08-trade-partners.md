# Trading Partners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a bilingual Trading partners page where readers compare countries and country groups over time, see the end-year ranking and download their selected figures.

**Architecture:** Accept only the frozen annual goods-country and five-group source rows into a small canonical serving package. Reuse Overview's national reference, static CSV/private mirror paths, editorial chart/table/range/selector and workbook writer. One shared selection permits mixed comparisons; browsing tabs change the available choices and ranking, while selected off-tab series remain visible.

**Tech Stack:** Existing Node 24, Next.js 16.3.8, React 19.3.0, strict TypeScript, Tailwind v4, locked Prisma 7.10.0/Postgres, decimal.js, csv-parse, fflate/SheetJS, ExcelJS, Vitest and Playwright. No new product dependency.

**Spec:** [Approved Trading partners design](../specs/2026-10-08-trade-partners-design.md), approved on 2026-10-08 when the user said "approve".

**Status:** Approved for inline implementation on 2026-10-08; publishing is outside this local implementation authorization. Existing isolated checkout: `C:/Users/Mylaptop/.codex/worktrees/c66f/Geodata.ge`, branch `codex/trade-partners`. The design commit is `26c7fbd9`; Implementation progress is recorded in the task checkboxes below.

## Global Constraints

- Georgian route: `/explorer/trade/partners`; English route: `/en/explorer/trade/partners`.
- Trends first. Only one measure is active at a time: Total trade, Exports, Imports or Balance.
- Initial measure: Total trade. Initial display: line chart. Initial years: all accepted years, derived from loaded facts. Initial selection: Georgia total only; it is first, selectable and removable.
- Selection is unlimited. Countries and Country groups organize one shared selection; neither browsing tab nor search limits Clear, Select all, the shared count or Excel export.
- Ranking uses the active end year, measure and browsing tab independently of selected chart lines and selector search. Countries show ten numerical rows initially and can expand to all; groups show all five.
- Group values and shares are not additive. Use published group totals, never present-day membership reconstruction. No pie, stacked group composition, combined group total or Balance percentage.
- Missing observations stay missing; numerical zero stays numerical. Preserve historical identities, exact decimals, original references, nominal USD, FOB/CIF and unspecified publication status.
- Keep frozen research files unchanged. No live database write, request-time data fetch, MCP/bulk extension, country detail route, map, services, domestic exports, re-exports, partial 2026, forecasts, growth, currency conversion or inflation adjustment.
- Reuse the established components and dependencies. Canonical CSVs remain the source of truth; mirror writes happen only inside `npm run data:import` with complete parity before commit.

## Review Focus

1. Selected groups disappear from the active Countries list: keep their lines, visibly removable checkbox rows, shared count, URL state and workbook content (Tasks 3–5).
2. A country has only one numerical flow, a published dash, a blank or a true zero: preserve the difference and never fabricate turnover/balance from a missing counterpart (Tasks 1–4).
3. EU, OECD and a member country are selected together: shares use the matching national total, never their selected sum, and no combined composition is generated (Tasks 3–5).
4. Tiny positive or negative amounts under the readable unit's precision: use existing `unitFor`/`formatInUnit` bounds rather than display a false zero; Excel retains the underlying numeric amount (Tasks 3–4).
5. The active Partners sidebar link is clicked after a mixed/table/empty saved view: preserve that view on desktop and mobile, including after language switching (Task 5).

---

## Execution entry

- [x] Recheck worktree/branch and preserve unrelated changes. Reuse this isolated checkout; do not create another one without a need.
- [x] Confirm Node 24 and lockfile freshness. This checkout currently lacks installed Next.js guides: restore locked dependencies with `npm ci` in `apps/web` only when execution is approved and installation is needed. Read the relevant bundled Next.js app-router, metadata and static-rendering guides before product code.
- [x] Read the spec, `DESIGN.md`, `CLAUDE.md` and `docs/data-methodology/trade-annual.md`. Read current Supabase guidance/changelog for the private mirror; repository Prisma/import rules take precedence over generic direct-SQL workflows.

## Task 1: Verified source package and reviewed partner catalogue

This step produces the reviewed files the page will use, preserving missing and historical figures.

**Files:**
- Create: `apps/web/lib/data/tradePartners/types.ts`, `validation.ts`, `prepareTradePartners.ts`.
- Create: `apps/web/scripts/prepare-trade-partners.ts`.
- Create: `data/taxonomy/trade-partners.json`, `data/imports/trade-partners-annual.csv`, `data/reports/trade-partners-validation.json`.
- Modify: `apps/web/package.json`, `apps/web/lib/i18n/inventory.server.ts`, `data/localization/en/labels.json`.
- Test: `apps/web/tests/data/tradePartners/fixtures.ts`, `prepareTradePartners.test.ts`, `validation.test.ts`.

**Interfaces:**
- `TradePartnerKind = "country" | "group"`; `TradePartnerEntity = { id: string; kind: TradePartnerKind; sourceCode: string | null; labelKa: string }`. Preserve native `partner.1995-2025.*` and `group.*` identities; Georgia total is not duplicated in this catalogue.
- `TradePartnerFact`: `entityId`, `year`, `indicatorId: TradeOverviewIndicator`, `valueUsd: string | null`, `unit: "usd"`, `basis: "actual"`, `valueStatus: "numeric" | "blank" | "not_applicable"`, `publicationStatus: "unspecified"`, `role: "detail" | "subtotal" | "derived"`, `sourceId`, `sourceRefs`, nullable `sourceValue/sourceUnit/sourceLabel/sourceNumberFormat`, `sourceBlock`, `lastReviewedAt`.
- `TradePartnersData = { entities: TradePartnerEntity[]; facts: TradePartnerFact[] }`; `TradePartnersAcceptance = { status: "passed"; scope: "annual_goods_partners"; years: number[]; countryEntities: number; groupEntities: number; primaryObservations: number; derivedObservations: number; primaryValueStatusCounts: { numeric: number; blank: number; not_applicable: number }; sourceSha256: Record<string, string>; inputSha256: Record<string, string>; canonicalSha256: string; catalogueSha256: string; englishLabelsSha256: string; reviewedAt: string; researchPackageStatus: string; outsideScopeHoldCount: number }`. Hash only the sorted English companions for these 217 identities in `englishLabelsSha256`, so unrelated English-label changes do not invalidate this dataset.
- Export `prepareTradePartnersData(repositoryRoot: string, mode: "write" | "check"): Promise<void>`, `validateTradePartnersData(data: TradePartnersData, report: TradePartnersAcceptance): void`, `tradePartnerFactKey(fact: Pick<TradePartnerFact, "entityId" | "indicatorId" | "year">): string`.
- Tests export `createTradePartnersPackageFixture(): Promise<string>` for a temporary copy of the required frozen inputs, plus `tradePartnerEntities(): TradePartnerEntity[]`, `tradePartnerFacts(): TradePartnerFact[]`, `tradePartnerNationalFacts(): TradeOverviewFact[]` for later tasks. Model fixtures use Russia export/import 150/300, EU 400/200, OECD 800/100 and a missing-counterpart historical partner; national export/import are 1000/2000 for 2025.

- [x] Write source preparation/validation regressions before implementation. Pin the captured accepted primary catalogue and output counts:

```ts
expect(report).toMatchObject({
  status: "passed", scope: "annual_goods_partners", countryEntities: 212,
  groupEntities: 5, primaryObservations: 12462, derivedObservations: 10530,
  primaryValueStatusCounts: { numeric: 11782, blank: 25, not_applicable: 655 },
});
expect(facts).toHaveLength(22992);
```

Also reject changed workbook hashes, omitted source identities/years, duplicate keys, wrong roles/units, altered source cell/format/value, stale artefact hashes and an invented numeric zero. Check leading-zero code `031`, Serbia and Montenegro `891`, Netherlands Antilles `530`, blanks/dashes and a true zero; a missing flow produces no numerical derivation. Tests copy only required research inputs and the four originals into their temporary package, never rewrite the real capture.
- [x] Run `npx vitest run tests/data/tradePartners/prepareTradePartners.test.ts tests/data/tradePartners/validation.test.ts`; confirm the new behavior fails before product implementation.
- [x] Implement the four-source subset preparer using `readVerifiedPackageFile`, source layouts/coverage/observation inventory, raw XLSX decimal tokens and Decimal precision 50, following Overview without refactoring its preparer. Bind `geostat_trade_export-country-1995-2026`, `geostat_trade_import-country-1995-2026`, `geostat_trade_export--country-group-1995-2026`, `geostat_trade_import-country-group-1995-2026` to their exact captured annual cells and thousand-USD units. Include country detail roles and only `group.eu/group.cis/group.bsec/group.oecd/group.guam`; source totals and country-section subtotals remain controls. Require both numerical counterparts for derived rows, exports-before-imports references and no derived native value. Reconcile using the package's declared comparisons/tolerances, preserving overlapping groups and the two services holds. Serialize deterministic BOM CSV, the acceptance report and catalogue fingerprint with review date `2026-10-08`.
- [x] Add reviewed Georgian labels in the catalogue and English `{ text, reviewedAt }` companions for all 217 native identities; register those IDs in the existing translation inventory. Preserve the original English source labels in fact metadata. Add `data:prepare-trade-partners` (`--write`) and `data:check-trade-partners` (`--check`) and append the latter to `data:validate`. Run the focused tests, both data commands and `npm run i18n:check`; require reproducible unchanged bytes and the exact counts above.
- [x] Commit task-owned files: `feat: prepare reviewed annual trade partners`.

## Task 2: Static loading and exact private-mirror parity

This step makes the reviewed data available through the existing serving paths and checks that copying it cannot alter a figure.

**Files:**
- Create: `apps/web/lib/data/tradePartners/importTradePartners.ts`.
- Modify: `apps/web/lib/data/servedData.ts`, `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `apps/web/prisma/schema.prisma`, `data/sources/source-documents.csv`, `data/localization/en/sources.json`.
- Create: timestamped `apps/web/prisma/migrations/` entry ending `_trade_partners/migration.sql`; choose its actual timestamp during execution, not in this plan.
- Test: `apps/web/tests/data/tradePartners/serving.test.ts`, `mirror.test.ts`, `mirrorIntegration.test.ts`.

**Interfaces:**
- Export `loadTradePartnersData(): Promise<TradePartnersData>`, `loadServedTradePartnersData(): Promise<TradePartnersData>`, `assertTradePartnersParity(csv: TradePartnersData, mirror: TradePartnersData): void`.
- `ClientTradePartnerFact = Pick<TradePartnerFact, "entityId" | "year" | "indicatorId" | "sourceId" | "basis" | "publicationStatus" | "lastReviewedAt"> & { valueUsd: number | null }`; `ClientTradePartnersData = { entities: TradePartnerEntity[]; facts: ClientTradePartnerFact[]; nationalFacts: ClientTradeOverviewFact[] }`.
- Export `toClientTradePartnersData(data: TradePartnersData, nationalFacts: readonly TradeOverviewFact[]): ClientTradePartnersData` from the importer; use a null-preserving conversion.
- In `mirrorRows.ts`: `tradePartnerEntityMirrorCreateRows(entities, importRunId): Prisma.TradePartnerEntityCreateManyInput[]`, `tradePartnerFactMirrorCreateRows(facts, importRunId): Prisma.TradePartnerFactCreateManyInput[]`, `loadTradePartnersDataFromMirror(db: Pick<MirrorClient, "tradePartnerEntity" | "tradePartnerFact">): Promise<TradePartnersData>`; parameters use the readonly types from Task 1 and `importRunId: string`.
- In `servedDataDb.ts`: `loadTradePartnersDataFromDb(): Promise<TradePartnersData>`.

- [x] Write failures for stale CSV/catalogue/report fingerprints, an entity-label/source-code change, nullable amounts accidentally becoming zero, a mismatched source-document relation, a missing record and an exact decimal change (`100.00000000000000000001`). Assert the thin client conversion keeps nulls and excludes source-cell/raw-workbook metadata.
- [x] Run `npx vitest run tests/data/tradePartners/serving.test.ts tests/data/tradePartners/mirror.test.ts`; confirm the unimplemented behavior fails.
- [x] Implement accepted CSV/catalogue loading and the CSV/db switch by following `importTradeOverview.ts`; verify all report fingerprints, including the scoped English companions. Register canonical paths in `SERVED_DATA_FILES`. Add `TradePartnerEntity` and `TradePartnerFact`, with fact key `[entityId, indicatorId, year]`, nullable `Decimal(40,20)`, retained metadata and relations to entity/source document/import run. Map each native source ID to an explicit registered document ID using the repository's underscore convention; derived rows relate to their first source reference while retaining both references. Register only the four original workbooks as source documents and add their reviewed English source companions. Update the existing import transaction's deletion order, createMany, complete entity/fact parity and report counts; never run a standalone production insert/update.
- [x] Generate SQL with installed Prisma 7.10.0 after checking `npx prisma migrate dev --help`. Prefer `npx prisma migrate dev --create-only --name trade_partners` against a verified disposable PostgreSQL target: explicitly set both `DIRECT_URL` and `DATABASE_URL` because `prisma.config.ts` prefers the former. If no disposable target is available, use the non-connecting schema diff (`npx prisma migrate diff --from-schema output/trade-partners-before.prisma --to-schema prisma/schema.prisma --script --output output/trade-partners-migration.sql`) after saving the unmodified schema, then place reviewed SQL in a folder named with the actual execution timestamp and record that generation was offline. Both new tables need RLS enabled and public API grants revoked. Run `npx prisma generate`, focused tests, `npm run typecheck`, `npm run i18n:check` and the existing `tests/factQuery/reference.test.ts` because the shared source registry changed; do not alter a conflicting reference expectation. When a disposable target is available, require migration, importer round-trip, rollback on parity failure and actual role-restriction evidence through `mirrorIntegration.test.ts`. An intentional skip is an unverified real-database boundary, not a successful rehearsal.
- [x] Commit: `feat: mirror reviewed trade partners with exact parity`.

The migration flags above were checked against the [locked Prisma 7.10.0 migrate-dev source](https://raw.githubusercontent.com/prisma/prisma/7.10.0/packages/migrate/src/commands/MigrateDev.ts) and [migrate-diff source](https://raw.githubusercontent.com/prisma/prisma/7.10.0/packages/migrate/src/commands/MigrateDiff.ts); current unversioned Prisma pages redirect to a newer major version. The private-table requirements follow the existing migration and [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Task 3: Shared selection, chart values and ranking calculations

This step defines the behavior independently of page styling, including mixed selections and correct national denominators.

**Files:**
- Create: `apps/web/lib/explorer/tradePartnersState.ts`, `tradePartners.ts`.
- Test: `apps/web/tests/explorer/tradePartnersState.test.ts`, `tradePartners.test.ts`.

**Interfaces:**
- `TradePartnersTab = "countries" | "groups"`; `TradePartnersState = { mode: "line" | "table"; measure: TradeOverviewIndicator; tab: TradePartnersTab; range: PeriodRange; selectedIds: string[] }`.
- Export `TRADE_PARTNER_TOTAL_ID = "goods.total"`, `DEFAULT_TRADE_PARTNERS_STATE`, `tradePartnersCoverage(data: ClientTradePartnersData): { min: number; max: number; years: number[] }`, `parseTradePartnersHash(hash: string, data: ClientTradePartnersData): TradePartnersState`, `serializeTradePartnersHash(state: TradePartnersState): string`, `setTradePartnersTab(state: TradePartnersState, tab: TradePartnersTab): TradePartnersState`, `tradePartnersBulkSelection(data: ClientTradePartnersData): string[]`.
- Export `TradePartnerRankingRow = { entityId: string; kind: TradePartnerKind; label: string; valueUsd: number | null; shareOfNational: number | null; rank: number | null; color: string }` and `TradePartnersModel = { years: number[]; range: ResolvedPeriodRange; unit: ValueUnit; selectedIds: string[]; valuesByEntity: Record<string, Record<number, number | null>>; activeEntities: TradePartnerEntity[]; offTabSelected: TradePartnerEntity[]; ranking: TradePartnerRankingRow[]; missingRanking: TradePartnerRankingRow[]; selectedCount: number; totalCount: number }`.
- Export `buildTradePartnersModel(data: ClientTradePartnersData, state: TradePartnersState, presentation: Presentation): TradePartnersModel` and `tradePartnerColor(id: string): string`. Use the existing editorial palette with deterministic ID assignment; total is `INK`. Labels come from `publicLabel` and the reviewed catalogue, with group identity clear.

- [x] Write model/state regressions using Task 1's fixtures and Task 2's conversion. Assert the exact default and URL round-trip:

```ts
expect(parseTradePartnersHash("", data)).toMatchObject({
  measure: "trade.turnover", tab: "countries", mode: "line", selectedIds: ["goods.total"],
});
const saved = parseTradePartnersHash("#sel=partner.1995-2025.643,group.eu&tab=groups&measure=trade.exports&view=table&start=2025&end=2025", data);
expect(parseTradePartnersHash(serializeTradePartnersHash(saved), data)).toEqual(saved);
expect(setTradePartnersTab(saved, "countries").selectedIds).toEqual(saved.selectedIds);
```

Pin explicit empty/unknown/duplicate IDs, partial/reversed/out-of-coverage years and all-catalogue bulk selection. For the fixture, EU turnover is 600 and its share is `600 / 3000 = 0.2`; EU exports share is `400 / 1000 = 0.4`, irrespective of selected countries or groups. Balance shares are null. Missing counterparts stay null, zero remains zero, balance ranks use absolute magnitude, and unavailable rows receive no rank. Tiny signed values keep the existing `<0.01`/`>−0.01` floor behavior when a billion unit with two decimals would round them away.
- [x] Run `npx vitest run tests/explorer/tradePartnersState.test.ts tests/explorer/tradePartners.test.ts`; confirm failures before implementing.
- [x] Implement the pure state/model functions. Hash keys are `measure`, `tab`, `view`, `sel` and the existing annual-range keys; an explicit empty selection never restores the total. Derive coverage only from the accepted partner facts and map the national reference by matching year/indicator. Keep the shared ID universe, count and stable colors unchanged when tabs/search/measure change. Build active-tab ranking independently of selected IDs; tie-break by localized label then ID. Use the existing `resolveRange`, `refitRange`, `unitFor`, `formatInUnit` and `publicLabel`, not new global formatting or state frameworks.
- [x] Rerun the two focused files; require the arithmetic, denominator, missingness, stability and round-trip assertions above to pass. Confirm the full frozen catalogue yields 218 shared choices including Georgia total, without hardcoding that count in product code.
- [x] Commit: `feat: model mixed trade partner comparisons and rankings`.

## Task 4: Native Excel export for the shared selection

This step makes the download match the visible measure, years and every selected country/group.

**Files:**
- Create: `apps/web/lib/explorer/tradePartnersWorkbook.ts`.
- Test: `apps/web/tests/explorer/tradePartnersWorkbook.test.ts`.

**Interface:** Export `buildTradePartnersWorkbookModel(input: { data: ClientTradePartnersData; state: TradePartnersState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel`; consume Task 3's model and the existing workbook model/writer.

- [ ] Write export regressions: the mixed saved state includes both Russia and EU even while browsing Countries; clearing selection gives no series. Assert active measure/range, USD headings, readable country/group labels, actual basis, unspecified publication status, blank missing cells and nonzero underlying amounts for tiny values. Source selection includes the applicable country/group export and/or import originals; include the existing national original only when the national reference is exported. Turnover/Balance require both counterpart sources. Include the group-overlap note for any selected group, both applicable formulas and no percentage/internal-ID/source-cell columns.
- [ ] Run `npx vitest run tests/explorer/tradePartnersWorkbook.test.ts`; verify it fails before the builder exists.
- [ ] Implement through `buildWorkbookExportModel`, following `tradeOverviewWorkbook.ts`. The filename base is `trade-partners`. Preserve `Simple table / Data / Sources` and their Georgian equivalents; group analysis rows under Countries or Country groups. Use the writer's existing internal amount field but present nominal USD everywhere. Use neutral signed number formats and source links from the validated public archive only.
- [ ] Rerun the focused workbook test, generate/reopen a real XLSX using the existing writer/reader test pattern, and verify numbers, blank cells, basis, group note and source URLs in both languages.
- [ ] Commit: `feat: export mixed trade partner comparisons to Excel`.

## Task 5: Bilingual page, selector, ranking and sources

This step builds the approved page from existing controls and makes it reachable from the Trade hub.

**Files:**
- Create: `apps/web/components/trade/trade-partners.tsx`, `trade-partners-series-panel.tsx`, `trade-partners-ranking.tsx`, `use-trade-partners-state.ts`.
- Create: `apps/web/app/(ka)/explorer/trade/partners/page.tsx`, `apps/web/app/(en)/en/explorer/trade/partners/page.tsx`.
- Modify: `apps/web/lib/pages/trade.tsx`, `apps/web/lib/explorer/tradeHubCards.ts`, `apps/web/components/shell/data-sidebar.tsx`, `apps/web/lib/seo/sitemap.ts`, `apps/web/lib/i18n/inventory.server.ts`.
- Modify: `apps/web/lib/i18n/messages/ka/trade.json`, `apps/web/lib/i18n/messages/en/trade.json`, `apps/web/lib/i18n/messages/ka/common.json`, `apps/web/lib/i18n/messages/en/common.json`, `data/localization/en/page-revisions.json`, `data/localization/en/documents.json`, `data/methodology/source-archives/trade.csv`.
- Modify: `apps/web/lib/methodology/content/trade.ts`, `apps/web/lib/methodology/content/en/trade.ts`, `Project_Definition.md`, `DESIGN.md`, `docs/data-methodology/trade-annual.md`.
- Test: `apps/web/tests/explorer/tradePartnersRender.test.tsx`, `apps/web/tests/explorer/tradeHubCards.test.ts`, `apps/web/tests/i18n/tradePresentation.test.ts`, `apps/web/tests/browser/trade-partners.spec.ts`, `apps/web/tests/seo/routes.test.ts`, `apps/web/tests/methodology/prepareArchives.test.ts`, `apps/web/tests/methodology/sourceManifest.test.ts`, `apps/web/tests/i18n/methodologySources.test.ts`.

**Interfaces:**
- Export `tradePartnersMetadata(locale: Locale): Promise<Metadata>` and `renderTradePartnersPage(locale: Locale): Promise<ReactNode>` from `lib/pages/trade.tsx`. The route wrappers delegate to those, following Overview.
- `TradePartners({ data, sources, lastReviewedAt, siteOrigin })` uses `ClientTradePartnersData`, `WorkbookPublicSource[]`, `string`, `string` respectively.
- `useTradePartnersState(data: ClientTradePartnersData): { state: TradePartnersState; update: (change: (previous: TradePartnersState) => TradePartnersState, push?: boolean) => void }` follows the existing hash/history hook.
- `TradePartnersSeriesPanel({ data, state, model, onTabChange, onSelectionChange, downloadAction })` uses Tasks 2–3's types; callbacks are `(tab: TradePartnersTab) => void` and `(ids: string[]) => void`, action is `ReactNode`.
- `TradePartnersRanking({ model, tab })` uses `TradePartnersModel` and `TradePartnersTab`; its Show all state stays component-local. `buildTradeHubCards` gains required third argument `partnerCoverage: ReturnType<typeof tradePartnersCoverage>` after its current facts/presentation arguments; update its existing caller/tests and keep Overview card behavior.

- [ ] Write render/browser regressions for total-only defaults, mixed selections across browsing tabs, visible/removable off-tab checkbox rows, global Clear/Select all despite a restrictive search, `Series selected/all`, and empty-state persistence. Pin chart/table, range/measure, URL reload/back/forward, language changes and active sidebar clicks on desktop/phone. Ranking starts at ten numerical countries, expands to the complete catalogue with unranked unavailable rows, shows all five groups, has no Balance share and survives an empty main selection. Both languages must have measure/kind/year/units in visible labels and accessible chart/table text.
- [ ] Run focused render/i18n tests to observe the missing page behavior fail. Once a first static build exists, run the new browser spec to establish failing behavior for any remaining regressions; do not substitute a passing component snapshot for those flows.
- [ ] Implement the four components using `ExplorerWorkspace`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesSelector/SeriesSelectorRow`, `SegmentedTabs`, `ExcelDownloadButton` and editorial ranking rows. Keep search local to the selector so keystrokes do not rebuild every chart. Total stays first; off-tab selected checkbox rows precede remaining choices. Clear/Select all apply to the complete shared catalogue with concise countries-and-groups scope copy. Render ordinary amount bars and a neutral signed Balance axis inside the ranking component, not a new generic chart system. Preserve active-link state and close mobile navigation using Overview's existing navigation pattern.
- [ ] Add the route renderers, both wrappers, hub card/sidebar entry, localized inventory/sitemap/review dates and concise metadata/Dataset JSON-LD. English hub summary must now cover national totals and partners rather than claim national-only coverage. Register all four XLSX originals with exact bytes, hashes, attribution, native filenames and lowercase public paths; leave existing `.html.txt` captures and security headers intact. Extend methodology with import sending-country meaning, FOB/CIF, group overlap, historical definitions, missingness, scoped acceptance and national-denominator rules. Update the three canonical owners for the approved extension; leave `AGENTS.md` and frozen research unchanged.
- [ ] Run focused render/model/workbook/i18n/source/archive checks and `npm run i18n:check`, prepare/check methodology archives, then build a CSV production artifact with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`. Serve it on a verified available local port and run `npm run test:browser -- tests/browser/trade-partners.spec.ts` with matching `NEXT_PUBLIC_SITE_URL` and `PLAYWRIGHT_BASE_URL`. Inspect both languages at 1440px, 768px and 390px; verify keyboard behavior and actual XLSX downloads/source hashes. Commit: `feat: add bilingual trading partners explorer`.

## Task 6: Independent review and completion evidence

This step establishes that the complete page meets the approved design and records any remaining database or release boundary.

**Files:** Review the whole task diff; record evidence in this plan and task-owned files under `output/playwright/trade-partners/`. Make only fixes required by that review/spec. No publishing operation is part of this plan.

- [ ] Obtain the independent review prescribed by the selected execution method. Cover the complete native identity universe, exact source bindings/decimals, scoped holds, nullable copying, RLS/grants, mixed selections, national denominators, ranking signs/missingness, state preservation, workbook/source accuracy and both languages. Address concrete findings with meaningful failing regressions before fixes; preserve unrelated work.
- [ ] Check canonical/report/label fingerprints and the final import graph. Raw workbook readers and the wider research package must stay outside the served page's dependency graph; only the thin client projection enters the page. Confirm no Trade MCP tool, dataset or central publication entry was added and run the existing query-service reference fixture if its inputs/import graph changed. Never edit a conflicting reference expectation to make the gate green.
- [ ] Run `npm run check` once on the final product inputs. Run `npm run build` once with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, after stopping any server using that `.next` folder. A passing Task 5 build can satisfy this when its product inputs have not changed. Review requires narrow reruns for fixes and final gates only when their inputs changed.
- [ ] Serve the resulting production artifact and run the full `npm run test:browser` with matching origin/base URL. Record totals and any isolated rerun separately. Require passing checks, generated source/publication hashes, both language Partners URLs and all mixed/table/empty/history/navigation/export flows before claiming local implementation complete. A CSV build or fixture mirror test is not actual PostgreSQL rehearsal or live release proof.
- [ ] Commit final task-owned fixes/evidence. Report exact checkout, branch, commit, local checks and review result, plus any unverified real-database boundary. Publishing, live migration/import, push, draft PR, required CI, merge, deployment and production verification require a separately authorized delivery stage.

## Plan self-review

Spec sections 1–2 are owned by Task 5; workspace/selector/ranking behavior by Tasks 3–5; source meanings and acceptance by Tasks 1 and 5; serving/private parity by Task 2; Excel by Task 4; completion/authority updates by Tasks 5–6. Every Review Focus condition has named assertions in its owning task. Server decimals and missingness stay intact until the thin client projection. Native IDs and a single shared catalogue define state and bulk actions; no inferred memberships or extra public measures are introduced. Existing route groups, mirror helpers, translation/source registries and Prisma 7 flags were inspected before fixing the file map.

Recommended execution: **Native** — implement these six connected tasks here, followed by one independent whole-branch review. The shared data/model/workbook interfaces make repeated fresh implementer contexts unnecessary; source and arithmetic failures are pinned before the UI and checked again during the final review. The user must review this plan and choose the execution method before implementation starts.
