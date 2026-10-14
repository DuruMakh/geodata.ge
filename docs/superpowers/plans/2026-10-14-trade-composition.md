# Trade Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved bilingual Trade composition page with separate goods-group and economic-category comparisons using reviewed annual 2000–2025 exports and imports.

**Architecture:** Accept a narrow SITC/BEC subset of the frozen Trade research package into canonical files and the existing parity-checked private database mirror. Extend the shared Trading partners workspace with explicit commodity-category semantics, then mount two compact classification datasets through one thin page wrapper. Reuse existing charts, selectors, tables, ranking, saved comparison state and native Excel export.

**Tech Stack:** Existing Next.js 16, React, strict TypeScript, Tailwind v4, Prisma 7/Postgres, csv-parse, decimal.js, existing workbook parser/writer, Vitest and Playwright. No new dependency.

**Spec:** [Approved Trade composition design](../specs/2026-10-14-trade-composition-design.md)

## Global Constraints

- The chart and table show nominal USD amounts. The end-year ranking shows each category's amount and share of the corresponding national exports or imports.
- Serve only Exports and Imports. A percentage-chart toggle is outside this first release.
- Use stable lowercase ASCII identities `trade.sitc1.{source_code}` and `trade.bec1.{source_code}`. SITC code `0` remains a valid code.
- The scoped serving package contains 17 category identities and 884 original category observations: 520 SITC and 364 BEC. Keep the 104 classification-total observations as validation controls, rather than additional selectable identities or canonical facts.
- Use Decimal precision 50 for exact thousand-USD-to-USD conversion. Reconcile category sums to classification totals and totals to accepted national amounts within USD 1.
- Only removable Georgia total is selected initially, first in the selector. Search does not narrow bulk actions, counts, ranking or export.
- Use `section=sitc` or `section=bec`. Remember each view's comparison and preserve unlimited or explicitly empty selections.
- Missing values remain gaps/dashes/blank cells; published zero and negative values retain their meaning. An unavailable or zero denominator yields no share.
- Following the repository's public-workbook contract, publication status remains private; add no percentage, publication-status or other internal metadata column to this workbook.
- Production follows `DESIGN.md` v4.1. Keep only the heading and one-line lead beneath it.
- Preserve the two outside-scope UK services holds and the wider research package's unresolved status. Do not edit frozen inputs.
- Local implementation and verification only. No production database operations, publication, push, PR or merge in this plan.
- Keep static serving and existing Trade defaults. Add no MCP tool, bulk publication, cross-tab, derivation or separate UI framework; do not rewrite `AGENTS.md`.

## Review Focus

1. A valid-looking but incorrect worksheet code, year, unit or numeric token must fail acceptance even if a test refreshes its input fingerprint — Task 1 source mutation tests.
2. A hold added only to research validation or only to source issues must block the affected goods subset; the two UK services holds must remain outside it — Task 1 scoped-hold tests.
3. A shared link containing another classification's IDs, an unsupported flow or `sel=` must normalize safely and retain deliberate empty selection — Tasks 3 and 5 state/history tests.
4. Null, zero, negative and very small values must remain distinct in shares, ranking, charts and exported cells — Tasks 3 and 5 synthetic-value/workbook tests.
5. Switching classification, flow, language or browser history must restore the comparison without a dataset request or changed existing Trade behavior — Tasks 4 and 5 integration/regression tests.

---

## File and reuse map

All application paths below are relative to `apps/web/`; canonical data and documentation paths are repository-relative.

- **Reused unchanged:** page/workspace shells, editorial line chart, table, range controls, selection aids, series selector, `TextTab`, Excel button/writer, `ExternalRanking`, `components/trade/use-trade-sections-state.ts`, `lib/data/parsing/tradeSourceWorkbook.ts`, source-archive infrastructure and transactional importer architecture.
- **Small additions:** `lib/data/tradePartners/importTradePartners.ts` client context; `lib/explorer/tradePartners{,State,Workbook}.ts`; `components/trade/trade-partners{,-series-panel,-ranking}.tsx` and `use-trade-partners-state.ts`; serving/import registries, page factory, hub, sidebar, i18n, SEO and source inventory.
- **New, justified by source acceptance:** `lib/data/tradeComposition/{types,validation,prepareTradeComposition,importTradeComposition}.ts`, `scripts/prepare-trade-composition.ts`, three accepted artifacts and two private mirror tables. Follow Services/Products; do not create a generic Trade pipeline framework.
- **New UI:** only `components/trade/trade-composition.tsx` and two route wrappers. Services/Domestic wrappers have different view sets; reuse their shared tab-state hook instead of copying their workspaces.
- **Tests:** focused composition tests beside existing data/explorer/methodology/browser tests; extend existing hub, sidebar/i18n and sitemap coverage.

## Task 1: Accept and reproduce the composition data

**Files:**
- Create: `lib/data/tradeComposition/{types,validation,prepareTradeComposition}.ts`; `scripts/prepare-trade-composition.ts`.
- Create: `data/imports/trade-composition-annual.csv`, `data/taxonomy/trade-composition.json`, `data/reports/trade-composition-validation.json`.
- Modify: `data/localization/en/labels.json`, `package.json`.
- Create tests: `tests/data/tradeComposition/{prepareTradeComposition,validation}.test.ts`.

**Interfaces:**
- Consumes: frozen `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/`, accepted `data/imports/trade-overview-annual.csv`, existing source workbook parser, fingerprint/parity helpers and localized-label format.
- Produces in `types.ts`: `TradeCompositionClassification = "sitc" | "bec"`; `TradeCompositionEntity = { id: string; classification: TradeCompositionClassification; sourceCode: string; labelKa: string; labelEn: string }`; `TradeCompositionData = { entities: TradeCompositionEntity[]; facts: TradeCompositionFact[] }`.
- `TradeCompositionFact` preserves every `TradePartnerFact` field, with `indicatorId: "trade.exports" | "trade.imports"`, `role: "detail"`, `sourceBlock: "2000-2025"`; maintain the existing metadata/value-status shape and nullable decimal string representation. The accepted snapshot must contain 884 numeric observations and no unavailable/derived observations.
- `TradeCompositionAcceptance`: Services-style fingerprint/inventory report, `scope: "annual_goods_composition"`, `status: "passed"`, 26 years, 17 identities, 884 primary observations, 104 control observations, per-classification counts and reconciliation evidence; reviewed date `2026-10-14`, outside-scope holds and unresolved research status retained.
- Produces: `buildTradeCompositionData(root: string): Promise<{ data: TradeCompositionData; report: TradeCompositionAcceptance }>`; `prepareTradeCompositionData(root: string, mode: "write" | "check"): Promise<void>`; `validateTradeCompositionData(data: TradeCompositionData, report: TradeCompositionAcceptance, englishLabels: Record<string, string>): void`; `tradeCompositionFactKey(fact: Pick<TradeCompositionFact, "entityId" | "year" | "indicatorId">): string`; `tradeCompositionCsv(data: TradeCompositionData): string`.

- [ ] **1. Prepare the existing toolchain after plan approval.** Verify Git/worktree state, read the data-methodology owner and the Supabase skill before database work; install locked dependencies with `npm ci` in `apps/web`. Its `postinstall` generates Prisma; run `npm run prisma:generate` only if needed. Read installed Next.js static-route/metadata guides and `npx prisma migrate diff --help` before relying on those interfaces. Do not change dependency versions.
- [ ] **2. Write source acceptance tests.** Follow the Services temporary-root fixture; copy only exact inputs and originals, never mutate the research package. Test both untouched acceptance and semantic corruptions with refreshed test fingerprints.

```ts
it("accepts only the 17 categories and 884 details", async () => {
  const { data, report } = await buildTradeCompositionData(root);
  expect(data.entities).toHaveLength(17); expect(data.facts).toHaveLength(884);
  expect(data.facts.filter(f => f.entityId.startsWith("trade.sitc1."))).toHaveLength(520);
  expect(data.facts.filter(f => f.entityId.startsWith("trade.bec1."))).toHaveLength(364);
  expect(data.entities.find(e => e.id === "trade.sitc1.0")?.sourceCode).toBe("0");
  expect(report.controlObservations).toBe(104); expect(report.outsideScopeHoldCount).toBe(2);
});
// Parameterized named tests: omitted/duplicate key; wrong source, code, label,
// year, unit, number format, worksheet binding, stored token, source hash/size;
// wrong category inventory; sum/control or national discrepancy > USD 1.
// Each corrupted fixture: await expect(buildTradeCompositionData(fixture)).rejects.toThrow(...).
// Hold tests: a goods hold in either evidence file rejects; unchanged UK holds pass.
// Artifact tests: BOM bytes are EF BB BF; write->check passes without writes;
// a changed CSV, catalogue, English label or report fingerprint fails check mode.
```

- [ ] **3. Run red:** `npx vitest run tests/data/tradeComposition/prepareTradeComposition.test.ts tests/data/tradeComposition/validation.test.ts`. Expect failure because the composition modules/artifacts are absent.
- [ ] **4. Implement the narrow source-bound preparer and validator.** Read `goods-products-annual/{sitc1,bec1}-2000-2025.csv` and the four chunks under `source-observations/`: `geostat_trade_export-sitc-2000-2026-02-2000-2025.csv`, `geostat_trade_import-sitc-2000-2026-02-2000-2025.csv`, `geostat_trade_export-bec-2000-2026-02-2000-2025.csv`, `geostat_trade_import-bec-2000-2026-02-2000-2025.csv`. Read original files `official/Export-SITC_2000-2026.xlsx`, `official/Import-SITC_2000-2026.xlsx`, `official/Export-BEC_2000-2026.xlsx`, `official/Import-BEC-2000-2026.xlsx`. Bind them through `full-source-manifest.json`, `source-layouts.json`, `expected-observation-inventory.json`, `prepared-validation.json`, `independent-verification.json`, `prepared-reconciliation.csv`, `unresolved-source-issues.json` and `coverage.csv`; verify both fingerprint layers and all source cells/keys. Use exact stored tokens and Decimal precision 50; retain controls only for USD 1 reconciliation. Produce deterministic sorted BOM CSV, reviewed concise bilingual catalogue and acceptance report. Reuse existing helpers without importing preparation into serving modules.
- [ ] **5. Register and generate:** add `data:prepare-trade-composition` (`--write`) and `data:check-trade-composition` (`--check`) scripts, append check mode once to `data:validate`, run write mode, and run check mode plus the Task 1 tests. Expect exact counts above and all tests passing; confirm research inputs are unchanged.
- [ ] **6. Commit:** stage only Task 1 files; `git commit -m "feat: accept reviewed trade composition data"`.

## Task 2: Serve accepted data and extend the private mirror

**Files:**
- Create: `lib/data/tradeComposition/importTradeComposition.ts`.
- Modify: `lib/data/tradePartners/importTradePartners.ts`, `lib/data/servedData.ts`, `lib/db/{mirrorRows,servedDataDb}.ts`, `scripts/import-budget-facts.ts`, `prisma/schema.prisma`, `docs/data-methodology/database-import.md`.
- Create: `prisma/migrations/20261014120000_trade_composition/migration.sql`.
- Create tests: `tests/data/tradeComposition/{servingBoundary,mirrorRows}.test.ts`; extend `tests/data/servedData.test.ts` with the two composition file registrations.

**Interfaces:**
- Consumes Task 1 types, artifacts and `validateTradeCompositionData`; existing `packTradePartnerFacts` and `toClientTradeOverviewFact`.
- Extend `ClientTradePartnerEntity.kind` with `"commodity_group"`. Extend `ClientTradePartnersData` with a discriminated composition member `{ dataset: "composition"; classification: TradeCompositionClassification }`, leaving the legacy/services member unchanged. Existing tuple packing remains unchanged.
- Produces: `loadTradeCompositionData(): Promise<TradeCompositionData>`; `assertTradeCompositionParity(csv: TradeCompositionData, mirror: TradeCompositionData): void`; `loadServedTradeCompositionData(): Promise<TradeCompositionData>`; `toClientTradeCompositionData(data: TradeCompositionData, national: readonly TradeOverviewFact[]): { sitc: ClientTradePartnersData; bec: ClientTradePartnersData; englishLabels: Record<string, string> }`.
- Produces in mirror helpers: `tradeCompositionEntityMirrorCreateRows(entities: readonly TradeCompositionEntity[], importRunId: string): Prisma.TradeCompositionEntityCreateManyInput[]`; `tradeCompositionFactMirrorCreateRows(facts: readonly TradeCompositionFact[], importRunId: string): Prisma.TradeCompositionFactCreateManyInput[]`; `loadTradeCompositionDataFromMirror(db: Pick<MirrorClient, "tradeCompositionEntity" | "tradeCompositionFact">): Promise<TradeCompositionData>`; database adapter `loadTradeCompositionDataFromDb(): Promise<TradeCompositionData>`.

- [ ] **1. Write failing loader/mirror tests.** Mock the raw-source parser and preparation imports to throw, as existing `servingBoundary.test.ts` files do. Pin the following named assertions using real accepted fixtures and mirror delegates from the Services test pattern.

```ts
// "serves only accepted files without raw-source imports"
expect((await loadTradeCompositionData()).facts).toHaveLength(884);
// "projects separate classifications and restricted national references"
expect(client.sitc.entities).toHaveLength(10); expect(client.bec.entities).toHaveLength(7);
expect(client.sitc.measures).toEqual(["trade.exports", "trade.imports"]);
expect(client.sitc.nationalFacts.every(f => f.year >= 2000 && f.year <= 2025)).toBe(true);
// "round-trips exact decimals and every provenance field"
expect(() => assertTradeCompositionParity(csv, roundTrippedMirror)).not.toThrow();
// Mutate each entity/fact field, omit/duplicate a row, or return wrong source binding:
expect(() => assertTradeCompositionParity(csv, corruptedMirror)).toThrow();
```

- [ ] **2. Run red:** `npx vitest run tests/data/tradeComposition/servingBoundary.test.ts tests/data/tradeComposition/mirrorRows.test.ts`. Expect missing composition loader/delegates to fail.
- [ ] **3. Implement accepted loaders and client projection.** Load/hash/validate only accepted CSV/catalogue/report/labels. Use the existing CSV-versus-DB switch and fieldwise decimal-normalized parity check. Return two compact datasets with exports/imports only, category entities in source-code order, and accepted national facts restricted to each dataset's coverage. Register canonical files in `SERVED_DATA_FILES`.
- [ ] **4. Extend schema and generate the offline migration.** Add `TradeCompositionEntity` and `TradeCompositionFact`, nullable `Decimal(40,20)` values, unique entity/year/indicator keys, source-document and ImportRun relations and existing indexes. Compare prior/current schemas offline with installed Prisma CLI; append matching RLS and revoked `PUBLIC`, `anon`, `authenticated` access. Generate client types. Inspect generated SQL; it must only add composition tables/relations/indexes/security.
- [ ] **5. Extend transactional import.** Bind four source IDs explicitly to existing `source.${source_id.replaceAll("-", "_")}` document identities, delete facts before entities, insert 17 entities and 884 facts with import-run links, batch facts consistently and check every field before commit. Add report counts and document this private mirror extension. Preserve existing transaction limits and all other dataset imports.
- [ ] **6. Run green:** Task 2 tests plus `npx vitest run tests/data/servedData.test.ts` and `npm run typecheck`. Expect passing loaders, exact round-trip/parity and generated types. Run migration/import integration only against an explicitly configured disposable local test database; otherwise record that live migration/import is unverified. Never substitute a production connection.
- [ ] **7. Commit:** stage only Task 2 files; `git commit -m "feat: serve and mirror trade composition"`.

## Task 3: Add composition semantics to the shared comparison workspace

**Files:**
- Modify: `lib/explorer/tradePartners{,State,Workbook}.ts`, `components/trade/trade-partners{,-series-panel,-ranking}.tsx`, `components/trade/use-trade-partners-state.ts`, `lib/i18n/messages/{ka,en}/trade.json`.
- Create tests: `tests/explorer/tradeComposition.test.ts`, `tests/explorer/tradeCompositionState.test.ts`, `tests/explorer/tradeCompositionWorkbook.test.ts`, `tests/explorer/tradeCompositionRender.test.tsx`.
- Extend existing partners/services/domestic tests only where needed to pin unchanged defaults.

**Interfaces:**
- Consumes Task 2 compact datasets and existing `TradePartnersState`, `TradePartnersModel`, `WorkbookExportModel`, `WorkbookPublicSource`, presentation types and component props.
- Add semantic `TradePartnersTab = ... | "categories"`; keep existing parse/serialize/model/workbook signatures. For composition, default to `categories`, exports, line, all years and `["goods.total"]`; serialize `section` as the dataset classification before the existing domestic `measures` branch. Emit `trade-composition-state` from the existing comparison hook before its domestic branch so the wrapper caches changes.
- Existing `tradePartnerColor(id: string): string` assigns the ten SITC/seven BEC IDs distinct colors within their classification using source-code order and the existing palette; ink remains national. Do not change current partner/service colors.
- Existing `buildTradePartnersWorkbookModel` gains the explicit composition dataset option and relevant source selection. Its result remains the existing three-sheet `WorkbookExportModel`.

- [ ] **1. Write failing state/model/render/workbook tests with two small classification fixtures.** Name tests after the assertions below; test every combination of two classifications and two flows.

```ts
// "normalizes foreign IDs/unsupported measures but keeps sel="
expect(parseTradePartnersHash("#sel=&measure=trade.balance", sitc).selectedIds).toEqual([]);
expect(parseTradePartnersHash("#sel=trade.bec1.1", sitc).selectedIds).toEqual([]);
expect(parseTradePartnersHash("#measure=trade.balance", sitc).measure).toBe("trade.exports");
expect(serializeTradePartnersHash(state, bec)).toContain("section=bec");
// "uses national end-year shares and independent complete ranking"
expect(category.shareOfNational).toBeCloseTo(0.25); // 25 / same-year, same-flow national 100
expect(model.ranking).toHaveLength(10); // remains ten with search/empty selection
// "keeps null, zero, negative and tiny source values distinct"
expect(noDenominator.shareOfNational).toBeNull(); expect(zero.valueUsd).toBe(0);
expect(negative.valueUsd).toBe(-2); expect(missing.valueUsd).toBeNull();
// "keeps colors and scale independent of selected lines"
expect(new Set(sitc.entities.map(e => tradePartnerColor(e.id))).size).toBe(10);
expect(allSelected.unit).toEqual(totalOnly.unit);
// "exports every selected series/year with correct sources and private status omitted"
expect(workbook.sheetNames).toHaveLength(3); expect(workbook.analysis.headers).toHaveLength(5);
// Inspect real model fields/written workbook cells: exact raw values, blank nulls,
// actual/unavailable basis, tiny nonzero precision, no percent/publication/internal columns,
// correct classification/flow source and national source only when selected.
```

- [ ] **2. Run red:** `npx vitest run tests/explorer/tradeComposition.test.ts tests/explorer/tradeCompositionState.test.ts tests/explorer/tradeCompositionWorkbook.test.ts tests/explorer/tradeCompositionRender.test.tsx`. Expect unsupported categories/context/source behavior to fail.
- [ ] **3. Extend state and model with explicit composition branches.** Use commodity-group entities and active classification only, exclude country-group warnings/off-tab country semantics, and normalize invalid links through existing range/selection rules. Ranking includes all categories, numerical amount ordering with stable ties and unavailable rows last. Divide by same-year/flow national values only; zero/missing denominator has no share. Keep scale based on all active-classification/flow facts over the range, not selection.
- [ ] **4. Extend the shared series panel/ranking rendering.** Add the complete Georgian/English `trade.composition` namespace, including approved page titles/lead, classification names, category/flow/search/count/ranking/source/workbook copy. Use one total first, bilingual label/code search, full global bulk/count/export scope, and embedded exports/imports below search. Show all ten/seven ranking rows independently of selections; extend existing signed neutral bars for negative categories. Retain existing responsive, focus and accessibility patterns. No new chart/selector/ranking component.
- [ ] **5. Extend workbook labeling/source selection.** Keep existing writer, readable USD scaling and unrounded analysis amounts with actual/unavailable basis. Select original SITC/BEC flow file and, when national is selected, `ftrade_1995-2026.xlsx`; omit publication status only for composition. Keep existing datasets' headers/output unchanged.
- [ ] **6. Run green:** Task 3 tests plus `npx vitest run tests/explorer/tradePartners.test.ts tests/explorer/tradePartnersState.test.ts tests/explorer/tradePartnersWorkbook.test.ts tests/explorer/tradePartnersRender.test.tsx tests/explorer/tradeServicesState.test.ts tests/explorer/tradeServicesWorkbook.test.ts tests/explorer/tradeServicesRender.test.tsx tests/explorer/tradeDomesticState.test.ts tests/explorer/tradeDomesticWorkbook.test.ts`. Expect all focused composition and existing Trade regressions to pass.
- [ ] **7. Commit:** stage only Task 3 files; `git commit -m "feat: reuse trade comparison for composition"`.

## Task 4: Connect the bilingual page, original sources and navigation

**Files:**
- Create: `components/trade/trade-composition.tsx`, `app/explorer/trade/composition/page.tsx`, `app/en/explorer/trade/composition/page.tsx`.
- Modify: `lib/pages/trade.tsx`, `lib/explorer/tradeHubCards.ts`, `components/shell/data-sidebar.tsx`, `lib/seo/sitemap.ts`, `lib/i18n/inventory.server.ts`.
- Modify: `lib/i18n/messages/{ka,en}/common.json`, `data/localization/en/documents.json`.
- Modify: `data/methodology/source-archives/trade.csv`, `lib/methodology/sourceInventory.ts`, `lib/methodology/content/{trade.ts,en/trade.ts}`; generated archive outputs only through the existing preparer.
- Modify: `Project_Definition.md` section 2, `DESIGN.md`, `docs/data-methodology/trade-annual.md`.
- Create: `tests/methodology/tradeCompositionSources.test.ts`; extend `tests/explorer/tradeHubCards.test.ts`, `tests/i18n/tradePresentation.test.ts`, `tests/seo/{sitemapPresentation,sitemapFreshness}.test.ts` and Task 3 render tests.

**Interfaces:**
- Consumes Task 2 `ReturnType<typeof toClientTradeCompositionData>`, source records, locale presentation and existing `useTradeSectionsState`.
- Produces `TradeComposition({ data, sources, lastReviewedAt, siteOrigin }: { data: ReturnType<typeof toClientTradeCompositionData>; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string })`.
- Produces page-factory exports `tradeCompositionMetadata(locale: Locale): Promise<Metadata>` and `renderTradeCompositionPage(locale: Locale): Promise<React.JSX.Element>`, matching existing factories; route wrappers delegate to them.
- Extend `buildTradeHubCards` with optional final `compositionFacts?: readonly ClientTradeOverviewFact[]`; append sixth card, leaving earlier arguments/order unchanged. Pass the composition projection's restricted national exports.

- [ ] **1. Write failing integration/source tests.** Use existing presentation, page-render and manifest fixtures. Pin the following behaviors with actual component/manifest outputs.

```ts
// "appends composition without changing the five existing cards"
expect(cards.map(c => c.href).at(-1)).toBe("/explorer/trade/composition");
expect(cards.at(-1)?.index).toBe("06"); expect(cards.at(-1)?.footer).toContain("2000–2025");
// "registers both localized routes and reviewed labels/documents"
expect(publicPaths).toContain("/explorer/trade/composition");
// Existing sitemap locale tests also assert the /en route, alternate links and accepted freshness.
// "publishes four unchanged native originals through lowercase archive paths"
expect(tradeArchiveRows).toHaveLength(22); // previous 18 + four composition originals
// For each original: verify native filename, lowercase downloadHref, hash and bytes,
// bilingual attribution, successful public source resolution and workbook source binding.
// "mounts exactly one classification tab row with composition labels"
// Render both locales: expected titles/lead/tabs, no country/group-overlap or domestic copy.
```

- [ ] **2. Run red:** `npx vitest run tests/methodology/tradeCompositionSources.test.ts tests/explorer/tradeHubCards.test.ts tests/i18n/tradePresentation.test.ts tests/seo/sitemapPresentation.test.ts tests/seo/sitemapFreshness.test.ts tests/explorer/tradeCompositionRender.test.tsx`. Expect missing route/manifest/context assertions to fail.
- [ ] **3. Add the thin wrapper and factory.** Mount the active compact dataset through shared `TradePartners`; define module-level `const sections = ["sitc", "bec"] as const` and use `useTradeSectionsState(sections, "sitc", "trade-composition-state")`, stable tab focus IDs and existing event/history behavior. Expose `data-testid="trade-composition"` and `data-section` on the wrapper root for browser checks. Render exactly one page-level Goods groups/Economic categories row and the approved title/one-line lead using Task 3 copy. Do not fetch on tab change. Add static metadata/JSON-LD and both routes.
- [ ] **4. Connect navigation, localization and SEO.** Append sixth hub card and last sidebar link, preserve active comparison hashes through locale/sidebar links and derive coverage from facts. Register route/label/document inventories and add both sitemap URLs with accepted-data freshness. Keep the five earlier entries and their defaults unchanged.
- [ ] **5. Publish source archive artifacts locally.** Add the four manifest entries and approved original-source inventory paths with exact upstream filenames/hashes/bytes, localized document metadata and lowercase public paths. Run `npm run data:prepare-methodology-archives`, then `npm run data:check-methodology-archives`; expect 22 valid Trade archive rows and matching originals. Never alter upstream bytes.
- [ ] **6. Update methodology and canonical owner docs.** Describe SITC versus BEC, source years/counts, nominal USD, FOB exports including re-exports/CIF imports, national-share denominator, validation controls, private mirror and remaining outside-scope holds. State that BEC is seven published categories, not a pure three-way split. Document the single classification tab row and USD-only first release in `DESIGN.md`; add the bounded route to section 2 of `Project_Definition.md`.
- [ ] **7. Run green:** Task 4 tests, `npx vitest run tests/methodology/sourceInventory.test.ts tests/methodology/sourceManifest.test.ts tests/methodology/tradeServiceSources.test.ts`, `npm run i18n:check` and `npm run typecheck`. Expect passing route/translation/source checks. Read and apply the React best-practices skill's checklist after the multiple TSX edits.
- [ ] **8. Commit:** stage only Task 4 files; `git commit -m "feat: add bilingual trade composition page"`.

## Task 5: Verify the complete static-page experience

**Files:**
- Create: `tests/browser/trade-composition.spec.ts`.
- Modify only composition implementation/tests if verification exposes a defect; record verified outcomes in this plan.

**Interfaces:**
- Consumes built Georgian/English composition routes, existing browser helpers and actual native workbook downloads. No new production interface.

- [ ] **1. Write browser tests with existing Trade test helpers.** Cover desktop and phone in both locales; default exports/line/full range/only national selected, one classification tab row, exports/imports below search, all ten/seven ranking rows and visible same-flow national shares. Verify label/code search followed by global Select all yields 11/8 selected, Clear retains ranking/range and disables Excel, every selected line exports over the whole range, and keyboard operation/wrapped Georgian labels work without horizontal overflow.
- [ ] **2. Add history and download assertions.** Use named tests `remembers each classification and restores shared links`, `preserves explicit empty selection across history and language`, `switches classification without fetching datasets`, and `exports the active classification and flow with original sources`.

```ts
await expect(page).toHaveURL(/section=bec/);
await expect(page.getByTestId("trade-composition")).toHaveAttribute("data-section", "bec");
// After range/flow/mode/selection changes, switch views/back/history/reload/locale/sidebar:
// expect saved comparison and input focus restored; reject unsupported link values safely.
// Collect requests during tab changes; expect no dataset/API request.
// Parse the actual downloaded .xlsx with the existing workbook library:
expect(downloaded.worksheets).toHaveLength(3);
// Assert selected columns/full years, USD/raw/blank/basis values, no private/percent columns,
// and correct original-source hyperlinks; national source appears only when selected.
```

- [ ] **3. Run the final check gate once:** `npm run check` in `apps/web`. Expect lint, types, unit tests, all accepted-data checks and localization to pass. If it fails, repair only the relevant defect and rerun the affected failing checks; do not repeat already-passing gates without changed inputs.
- [ ] **4. Build once for browser verification.** In PowerShell set `$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'`, run `npm run build`, then start the built app using `npm run start -- --port 3100`. Ensure any old server is stopped before rebuilding. Expect successful static generation of both routes and no new request-time data route.
- [ ] **5. Run the new browser spec against that build.** Set `$env:CI='1'` and `$env:PLAYWRIGHT_BASE_URL='http://localhost:3100'`; retain `NEXT_PUBLIC_SITE_URL`. Run `npx playwright test tests/browser/trade-composition.spec.ts`. Expect all composition checks to pass; visually inspect desktop/phone screenshots for both languages. Repair actual failures before the full suite, rebuilding only if application inputs changed.
- [ ] **6. Run the full UI completion gate once:** `npm run test:browser` against the same verified build. Expect all new and existing browser tests passing. Record command results, build evidence and any explicitly untested disposable-database boundary; stop the preview server afterwards.
- [ ] **7. Complete independent review using the chosen execution method.** For Native, request one fresh whole-branch reviewer using the requesting-code-review skill; for Subagent-driven, retain per-task gates and whole-branch review. Resolve findings, rerun affected checks and review `git diff --check`/scope. No publishing operation is implied.
- [ ] **8. Commit and report:** stage browser tests and any verified fixes; `git commit -m "test: verify trade composition explorer"`. Report exact branch/commit, local check outcomes and that production migration/import/deployment remain separate. Do not claim production delivery.

## Plan self-review

The five tasks cover every approved design section: source acceptance (Task 1), private/static serving (Task 2), comparison/state/ranking/Excel (Task 3), bilingual routes/navigation/archives/owner docs (Task 4), and complete browser/regression evidence (Task 5). Each Review Focus condition belongs to the listed tests, new interfaces are named once and consumed consistently, and existing reusable components are preserved. Execution method and plan review remain pending; no product implementation has started.
