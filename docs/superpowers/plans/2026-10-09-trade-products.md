# Trade Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bilingual Products explorer with an immediately visible chart and a searchable category popup covering separate historical product versions from 1995–2025.

**Architecture:** Accept the four frozen HS4 blocks into a reviewed catalogue and annual facts, retaining source identities, decimals and missingness. Reuse national Overview totals, static CSV/private-mirror loading, the editorial chart/table/range controls, ranking presentation and native workbook writer. A thin modal owns draft selection; only its commit changes the explorer, and a catalogue-bound compact hash retains unlimited committed selection.

**Tech Stack:** Existing Node 24, Next.js 16.3.8, React 19.3.0, strict TypeScript, Tailwind v4, locked Prisma 7/Postgres, decimal.js, csv-parse, fflate/SheetJS, ExcelJS, Vitest and Playwright. No new product dependency or UI library.

**Spec:** [Approved Products design](../specs/2026-10-09-trade-products-design.md), approved on 2026-10-09 when the user said "continue" after written-spec review.

**Status:** Approved for inline implementation on 2026-10-09 when the user said "continue"; one independent whole-branch review at the end. Existing isolated checkout: `C:/Users/Mylaptop/.codex/worktrees/fa59/Geodata.ge`, branch `codex/trade-products`, design commit `6731ef8d`. Publishing and live database operations are outside local implementation authorization. All commands below run in `apps/web` unless explicitly identified as repository-root commands.

## Global Constraints

- Georgian: `/explorer/trade/products`. English: `/en/explorer/trade/products`.
- The real popup is closed when entering the page.
- Initial choice: Exports.
- Initial display is Line; initial range is all accepted years, derived from loaded facts.
- Only Georgia total is selected initially. It is first, counted once and removable.
- Selection has no numerical limit.
- Keep only four selected labels visible on desktop and two on a phone.
- Clear and Select all apply to the complete catalogue, including the reference, regardless of query, category, page, source period, year range or active flow.
- Show at most 25 product result rows per page.
- Keep all four blocks separate, including apparently identical codes and names.
- Source publication status remains unspecified and observed basis remains actual.
- No Trade MCP extension, central bulk publication or request-time data API is added.
- No separate domestic-export/re-export measure, turnover, balance, growth, currency conversion, inflation adjustment, services, country × product comparison, map, individual product route, forecast or partial 2026 figure is included.

## Review Focus

- The same four-digit code in different source blocks must stay separately named, selected and plotted. Tasks 1 and 3 pin this with source-key and model tests.
- Switching to a year/flow with no observation must retain the selected historical version and show gaps, not zero or a modern replacement. Tasks 3 and 6 test the retained empty line and labels.
- Bulk actions after search/category/Selected pagination must include the complete catalogue and workbook. Tasks 3–6 test filtered bulk scope and full export.
- Cancelling a changed draft with Escape/backdrop on a scrolled phone page must preserve selection, chart position and opener focus. Tasks 5 and 7 test the real modal lifecycle.
- A saved bitset from a different catalogue must not select unrelated products; a valid empty token must remain empty. Task 3 tests both, and Task 7 tests navigation/history.

## File map and reuse

| Responsibility | Files and reuse decision |
| --- | --- |
| Reviewed package | New `data/imports/trade-products-catalogue.csv`, `trade-products-annual.csv`, `data/reports/trade-products-validation.json`; new `apps/web/lib/data/tradeProducts/{types,prepareTradeProducts,validation,importTradeProducts}.ts` and preparation script. Reuse verified package reads, BOM CSV, generated-artifact checks and exact parity. |
| Exact worksheet reading | New small `apps/web/lib/data/parsing/tradeSourceWorkbook.ts`; extract the already implemented worksheet/XML reading from the partner preparer, which then uses it unchanged. `workbookMatrix.ts` was considered but converts numbers through the ordinary worksheet reader and cannot retain the stored monetary token. This prevents copying a third Trade source reader. |
| Serving mirror | Extend `lib/data/servedData.ts`, `lib/db/{mirrorRows,servedDataDb}.ts`, existing import transaction, Prisma schema and one migration. Reuse private-role restrictions and Decimal(40,20). |
| Explorer decisions | New `lib/explorer/tradeProducts{State,Selection,Catalogue,Workbook}.ts`, `tradeProducts.ts`, and `components/trade/use-trade-products-state.ts`. Reuse annual range/hash utilities, Unicode search, editorial colors and public-label registry. |
| Popup and page | New thin `components/trade/trade-products-picker.tsx` and `trade-products.tsx`. Reuse SeriesSelector/SeriesSelectorRow, editorial controls, native dialog, chart, table, range and Excel button. Add optional selector focus/list settings with unchanged defaults. |
| Ranking | Extend `components/trade/trade-partners-ranking.tsx` with a Products configuration and optional pagination; no copied ranking table. |
| Discovery and sources | Extend existing Trade page loader, hub, sidebar, translation inventory, sitemap, source documents/archive registry and bilingual methodology. Add only two route wrappers. |

The geographical entity picker cannot be extended narrowly: it navigates to one place instead of staging multiple selections. The fixed two-column ExplorerWorkspace cannot supply the approved full-width chart; compose the existing full-width ExplorerPage pattern. Table/picker/ranking pagination stays task-local; do not create a general pagination framework.

## Task 1: Accept the complete, separately versioned HS4 catalogue

**Files:**
- Create: `apps/web/lib/data/tradeProducts/types.ts`, `prepareTradeProducts.ts`, `validation.ts`; `apps/web/lib/data/parsing/tradeSourceWorkbook.ts`; `apps/web/scripts/prepare-trade-products.ts`.
- Create: `data/imports/trade-products-catalogue.csv`, `trade-products-annual.csv`; `data/reports/trade-products-validation.json`.
- Modify: `apps/web/lib/data/tradePartners/prepareTradePartners.ts`, `apps/web/package.json`, `apps/web/lib/i18n/inventory.server.ts`, `data/localization/en/labels.json`, `docs/data-methodology/trade-annual.md`.
- Test: `apps/web/tests/data/tradeProducts/{fixtures,prepareTradeProducts.test,validation.test}.ts`; existing partner preparation tests.

**Interfaces:**
- `TradeProductMeasure = "trade.exports" | "trade.imports"`; `TradeProductSourceBlock = "1995-1999" | "2000-2014" | "2015-2019" | "2020-2025"`.
- `TradeProductCategoryId` is the union of the eight stable IDs in spec §5. `TradeProductEntity = { id: string; sourceBlock: TradeProductSourceBlock; code: string; labelKa: string; sourceLabelEn: string; categoryId: TradeProductCategoryId; aliasesKa: string[]; aliasesEn: string[] }`.
- `TradeProductFact` has the existing partner fact's fields, with `indicatorId: TradeProductMeasure`, `role: "detail"` and `sourceBlock: TradeProductSourceBlock`. Retain nullable exact-decimal `valueUsd` and all source metadata; no derived facts.
- `TradeProductsData = { entities: TradeProductEntity[]; facts: TradeProductFact[] }`. `TradeProductsAcceptance` records passed `annual_goods_products` scope, years, product/control/observation counts, status counts, source/input/canonical/catalogue/scoped-English SHA256 fingerprints, review date and unchanged outside-scope holds.
- Export `prepareTradeProductsData(repositoryRoot: string, mode: "write" | "check"): Promise<void>`, `validateTradeProductsData(data: TradeProductsData, report: TradeProductsAcceptance): void`, `tradeProductFactKey(fact: Pick<TradeProductFact, "entityId" | "indicatorId" | "year">): string`.
- Export `readTradeProductCatalogue(repositoryRoot: string): Promise<TradeProductEntity[]>` from the lightweight catalogue.ts reader for direct catalogue parsing without acceptance-report dependencies. The translation inventory calls this reader rather than the later serving loader, avoiding a report/English-inventory cycle.
- Shared `readTradeSourceWorksheet(bytes: Buffer, sheetName: string): { sheet: XLSX.WorkSheet; storedValues: Map<string, string> }` reads the native worksheet and its stored numeric tokens. Test fixture exports `createTradeProductsPackageFixture(): Promise<string>`, cleanup, `tradeProductEntities(): TradeProductEntity[]`, `tradeProductFacts(): TradeProductFact[]` and `tradeProductNationalFacts(): TradeOverviewFact[]`. Small fixtures include `goods.hs4.2015-2019.8703` export USD 100 in 2019 and `goods.hs4.2020-2025.8703` export/import USD 200/300 in 2025; national 2025 export/import are USD 1000/2000. Separate missing, zero and negative records support the corresponding tests.

- [x] After plan approval, install the existing lockfile with `npm ci`, record its exit status and run the existing Trade unit tests as baseline. Read applicable installed Next.js guides before application code, and current Prisma/Supabase documentation before mirror APIs; use Context7 or official docs. Preserve all existing worktrees and source captures.
- [x] Write failing source tests using copied frozen inputs and six original workbooks. Pin the accepted counts:

```ts
expect(report).toMatchObject({
  status: "passed", scope: "annual_goods_products", productEntities: 4768,
  primaryObservations: 69624, controlObservations: 62,
  primaryValueStatusCounts: { numeric: 66627, blank: 0, not_applicable: 2997 },
  outsideScopeHoldCount: 2,
});
expect(facts).toHaveLength(69624);
expect(new Set(entities.map(e => e.id)).size).toBe(4768);
```

Reject a changed original hash, omitted code/year, duplicate cell, wrong role/unit, altered cell/label/format, rounded normalized money, invented zero and an in-scope source hold. Assert the four blocks remain separate, leading zeros survive, and native `0.0056028686687583999000` normalizes exactly without monetary rounding. Check per-block counts from spec §8 and that 62 controls are excluded from selectable facts. Mutations affect temporary fixtures only.
- [x] Run `npx vitest run tests/data/tradeProducts/prepareTradeProducts.test.ts tests/data/tradeProducts/validation.test.ts`; require failure from the missing implementation.
- [x] Implement the scoped preparer over only the four HS4 files. Reuse package hashes/layouts/coverage/key fingerprints and Decimal precision 50. Extract the shared worksheet reader and replace only partner preparer's equivalent read block; preserve its output bytes. Reconcile product detail/native controls/national Overview using documented USD 1 tolerance and source exceptions. Preserve the two services holds and reject an affected HS4 hold. Use review date `2026-10-09` and deterministic BOM CSV/report output.
- [x] Build the reviewed catalogue from the union of native block/code identities, not code alone. Review Georgian names and all eight category assignments against historical source names; add English `{ text, reviewedAt }` companions and only reviewed identity-specific everyday aliases. Include both captured flow names in search when they differ, retaining both original labels in the facts. Use the direct catalogue reader in the translation inventory. Do not use current HS names to overwrite older definitions. Add `data:prepare-trade-products` / `data:check-trade-products` and append the check to `data:validate`; update the methodology for this scoped package.
- [x] Run the focused new/partner preparation tests, `npm run data:prepare-trade-products`, `npm run data:check-trade-products`, `npm run data:check-trade-partners` and `npm run i18n:check`. Require exact counts, deterministic bytes, complete bilingual labels and unchanged partner outputs. Commit the task-owned files as `feat: prepare reviewed historical trade products`.

## Task 2: Static loading and exact private-mirror copying

**Files:**
- Create: `apps/web/lib/data/tradeProducts/importTradeProducts.ts`; timestamped `apps/web/prisma/migrations/*_trade_products/migration.sql`.
- Modify: `apps/web/lib/data/servedData.ts`, `apps/web/lib/db/mirrorRows.ts`, `servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `apps/web/prisma/schema.prisma`, `data/sources/source-documents.csv`, `data/localization/en/sources.json`, `docs/data-methodology/trade-annual.md`.
- Test: `apps/web/tests/data/tradeProducts/{serving.test,mirror.test,mirrorIntegration.test}.ts`.

**Interfaces:**
- Export `loadTradeProductEntities(): Promise<TradeProductEntity[]>`, `loadTradeProductsData(): Promise<TradeProductsData>`, `loadServedTradeProductsData(): Promise<TradeProductsData>`, `assertTradeProductsParity(csv: TradeProductsData, mirror: TradeProductsData): void`.
- Export `loadTradeProductCatalogueFingerprint(): Promise<string>` for the static page loader to bind saved selection to the accepted catalogue's exact bytes.
- `ClientTradeProductFact = [entityIndex: number, year: number, measureIndex: 0 | 1, valueUsd: number | null]`, where 0 is Exports and 1 Imports. `ClientTradeProductsData = { entities: TradeProductEntity[]; years: number[]; facts: ClientTradeProductFact[]; nationalFacts: ClientTradeOverviewFact[]; catalogueFingerprint: string }`. Entity order is deterministic source-block chronology then code; canonical IDs remain authoritative.
- `toClientTradeProductsData(data: TradeProductsData, nationalFacts: readonly TradeOverviewFact[], catalogueFingerprint: string): ClientTradeProductsData` retains null and omits repeated source-cell metadata. Source choice is reusable block/flow metadata, not a per-chart-cell provenance copy.
- Add `TRADE_PRODUCT_SOURCES` (block → export/import native ID) and `TRADE_PRODUCT_DOCUMENT_IDS` to Task 1 types, using exact six captured identities and existing source-document ID conventions.
- Mirror exports: `tradeProductEntityMirrorCreateRows(entities: readonly TradeProductEntity[], importRunId: string): Prisma.TradeProductEntityCreateManyInput[]`, `tradeProductFactMirrorCreateRows(facts: readonly TradeProductFact[], importRunId: string): Prisma.TradeProductFactCreateManyInput[]`, `loadTradeProductsDataFromMirror(db: Pick<MirrorClient, "tradeProductEntity" | "tradeProductFact">): Promise<TradeProductsData>`; `servedDataDb.ts` exports `loadTradeProductsDataFromDb(): Promise<TradeProductsData>`.

- [x] Write failing tests for report/catalogue/CSV/English fingerprint drift, label/code/category/alias mismatch, source-document reassignment, missing row and null becoming zero. Assert exact preservation of `100.00000000000000000001`, source references and status; the thin tuples retain entity mapping and do not disclose raw cell metadata.

In `mirror.test.ts`, name the test `retains exact decimal and unavailable status`; use one Task 1 fact with the indicated value and a second unavailable fact, mapped back through the mirror loader:

```ts
expect(mirror.facts[0].valueUsd).toBe("100.00000000000000000001");
expect(mirror.facts[1].valueUsd).toBeNull();
expect(mirror.facts[1].valueStatus).toBe("not_applicable");
expect(() => assertTradeProductsParity(csv, mirror)).not.toThrow();
expect(() => assertTradeProductsParity(csv, { ...mirror, facts: mirror.facts.slice(1) })).toThrow();
```

- [x] Run `npx vitest run tests/data/tradeProducts/serving.test.ts tests/data/tradeProducts/mirror.test.ts`; confirm failure before implementation.
- [x] Implement verified catalogue/fact loading and the existing CSV/db switch. Register `tradeProductEntities` and `tradeProductFacts` paths in `SERVED_DATA_FILES`. Add `TradeProductEntity` / `TradeProductFact`, unique fact key `[entityId, indicatorId, year]`, nullable Decimal(40,20), canonical catalogue fields, source-document/import-run relations and retained fact metadata. Extend the existing transaction's deletion, insertion, complete parity and row reports, using established batch handling for the full 69,624 observations.
- [x] Generate the migration after checking installed Prisma help. Use a verified disposable target and `--create-only`, or an offline `migrate diff` from the saved unmodified schema if none is available; document the chosen boundary. Name the directory with the actual execution timestamp. Enable RLS and revoke `anon`/`authenticated` access on both tables. Generate the client and run focused tests, `npm run typecheck`, `npm run i18n:check` and `npx vitest run tests/factQuery/reference.test.ts` because the shared source registry changed. Never alter a conflicting reference expectation.
- [x] Follow the existing local-disposable database integration pattern with `TRADE_PRODUCTS_TEST_DATABASE_URL`, requiring loopback host and `/trade_products_test` database name. Test actual migration, complete row parity, rollback on deliberate mismatch and role restrictions when that target exists. A skipped real-database test remains unverified; do not run the importer against production during this task. Commit as `feat: add private exact trade product serving`.

## Task 3: Comparison model, catalogue search and compact saved selection

**Files:**
- Create: `apps/web/lib/explorer/tradeProducts.ts`, `tradeProductsState.ts`, `tradeProductsSelection.ts`, `tradeProductsCatalogue.ts`; `apps/web/components/trade/use-trade-products-state.ts`.
- Test: `apps/web/tests/explorer/{tradeProducts.test,tradeProductsState.test,tradeProductsCatalogue.test}.ts`.

**Interfaces:**
- `TRADE_PRODUCT_TOTAL_ID = "goods.total"`; `TradeProductsState = { mode: "line" | "table"; measure: TradeProductMeasure; range: PeriodRange; selectedIds: string[] }`.
- Export `tradeProductsCoverage(data: ClientTradeProductsData): { min: number; max: number; years: number[] }`, `tradeProductsBulkSelection(data: ClientTradeProductsData): string[]`, `parseTradeProductsHash(hash: string, data: ClientTradeProductsData): TradeProductsState & { selectionReset: boolean }`, `serializeTradeProductsHash(state: TradeProductsState, data: ClientTradeProductsData): string`.
- Selection codec exports `encodeTradeProductsSelection(selectedIds: readonly string[], data: ClientTradeProductsData): string` and `decodeTradeProductsSelection(token: string, data: ClientTradeProductsData): { selectedIds: string[]; invalid: boolean }`.
- `TradeProductRankingRow = { entityId: string; label: string; valueUsd: number | null; shareOfNational: number | null; rank: number | null; color: string }`. `TradeProductsModel = { years: number[]; range: ResolvedPeriodRange; unit: ValueUnit; selectedIds: string[]; valuesByEntity: Record<string, Record<number, number | null>>; ranking: TradeProductRankingRow[]; missingRanking: TradeProductRankingRow[]; selectedCount: number; totalCount: number }`.
- Export `buildTradeProductsModel(data: ClientTradeProductsData, state: TradeProductsState, presentation: Presentation): TradeProductsModel`, `tradeProductColor(id: string): string`, `tradeProductLabel(entity: TradeProductEntity, presentation: Presentation): string` (public name plus code and source period).
- `TradeProductsBrowseView = "categories" | "all" | "selected"`. `findTradeProducts(input: { data: ClientTradeProductsData; model: TradeProductsModel; presentation: Presentation; view: TradeProductsBrowseView; categoryId: TradeProductCategoryId | null; query: string; selectedIds: readonly string[]; page: number }): { rows: TradeProductRankingRow[]; totalMatches: number; page: number; pageCount: number; categoryCounts: Record<TradeProductCategoryId, number> }` returns up to 25 product rows, excluding the separately pinned national reference.
- Hook `useTradeProductsState(data: ClientTradeProductsData)` supplies `{ state, selectionReset, update }`, following the existing history/ready hook; `update(change, push?)` has the partner hook's function signature with Products state.

- [ ] Write failures pinning national-only Exports/Line/all-years default, removable total, explicit empty selection and full 4,769 bulk IDs. Use two same-code entities in different blocks; assert their independent values/gaps and version labels. Changing flow/range preserves selection, including an entirely unavailable old version. Unit choice is independent of selection and national share uses the matching year/flow denominator; zero denominator gives no share. Numeric zero/negative values remain numeric, missing values unranked.
- [ ] Test the codec round-trip for empty, sparse, mixed historical and all-selected lists; require each current-catalogue token length below 1,024 characters. Reject malformed base64, version/fingerprint mismatch, wrong byte count and nonzero unused bits. Missing `sel` means default; a valid empty token stays empty. Hash range/mode/measure parsing and serialization use the existing annual utilities.

Name the state test `round-trips full and empty catalogue-bound selection`; construct `data` from the accepted Task 2 client conversion:

```ts
const all = tradeProductsBulkSelection(data);
const token = encodeTradeProductsSelection(all, data);
expect(token.length).toBeLessThan(1024);
expect(decodeTradeProductsSelection(token, data)).toEqual({ selectedIds: all, invalid: false });
expect(decodeTradeProductsSelection(encodeTradeProductsSelection([], data), data)).toEqual({ selectedIds: [], invalid: false });
expect(decodeTradeProductsSelection(token, { ...data, catalogueFingerprint: "b".repeat(64) }).invalid).toBe(true);
```

- [ ] Test name/code/Georgian/English/source-name/alias search, exact-match precedence, category counts totaling 4,768, stable end-year ordering and 25-row pages. Assert Selected search/paging changes only visible rows and the complete bulk denominator/selection remains unchanged. Run `npx vitest run tests/explorer/tradeProducts.test.ts tests/explorer/tradeProductsState.test.ts tests/explorer/tradeProductsCatalogue.test.ts`; require new behavior to fail.
- [ ] Implement an indexed tuple lookup and Set-based selection membership, reusing existing unit/color/range/public-label/search helpers. Use versioned `v1.<catalogueFingerprint>.<base64urlBits>` selection in `sel`, total first and deterministic catalogue order. Compute catalogue views independently of chart selection; keep draft/search out of the model/state hook. Use existing popstate/hashchange and navigation conventions, never substitute a current version for an older ID.
- [ ] Run the focused tests and `npm run typecheck`; require all source-period, missingness, link-size and filtering assertions to pass. Commit as `feat: model unlimited historical product comparisons`.

## Task 4: Verified original sources and complete Excel downloads

**Files:**
- Create: `apps/web/lib/explorer/tradeProductsWorkbook.ts`.
- Modify: `data/methodology/source-archives/trade.csv`, `apps/web/lib/methodology/sourceInventory.ts`, `apps/web/lib/methodology/content/trade.ts`, `content/en/trade.ts`, `data/localization/en/sources.json`, `docs/data-methodology/trade-annual.md`.
- Test: `apps/web/tests/explorer/tradeProductsWorkbook.test.ts`, `apps/web/tests/methodology/tradeProductSources.test.ts` and existing archive/reference tests.

**Interfaces:**
- `buildTradeProductsWorkbookModel(input: { data: ClientTradeProductsData; state: TradeProductsState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel` reuses `buildWorkbookExportModel` and the existing writer.
- Source projection uses Task 2 block/flow IDs and existing validated public source links; national selection also includes the existing FTrade source.

- [ ] Write failures for a workbook spanning two versions of one code, unavailable amounts, true zero, negative amount and a selection beyond 25 visible rows. Assert three established sheets, every selected identity/year, USD headings, version-qualified names, actual basis, unspecified publication status, source hyperlinks and the historical-definition note. No percentage/growth/internal-cell columns appear.

Name the workbook test `exports all committed historical series beyond the table page`; use 30 selected fixture identities and three selected years, and inspect the generated native workbook with the existing writer test helpers:

```ts
expect(workbook.worksheets).toHaveLength(3);
expect(model.analysis.rows).toHaveLength(90);
expect(model.analysis.rows.some(row => row.includes(actualLabel))).toBe(true);
expect(model.readable.subtitle).toContain("2019–2021");
```

Here `actualLabel` is the existing localized workbook basis label. Also assert both block-qualified 8703 labels, blank missing-value cells and all selected original-source links using the established workbook model fields.

- [ ] Write source tests requiring the exact six original hashes, lowercase archive paths and all existing Trade originals unchanged. Run `npx vitest run tests/explorer/tradeProductsWorkbook.test.ts tests/methodology/tradeProductSources.test.ts`; require failure before implementation.
- [ ] Implement the workbook adapter using committed model rows and existing precision/format conventions. Select original sources by each selected entity's block and active flow, even for an old version without end-year data; never use table/picker page rows as export input. Register the six original files from spec §9 through the archive whitelist/manifest and reviewed bilingual source registry, preserving bytes and native IDs.
- [ ] Extend bilingual Trade methodology with full HS4 coverage, separate versions, navigation-only categories, nominal USD/FOB/CIF, exact source retention and absence/zero rules. Regenerate archives with `npm run data:prepare-methodology-archives`, check with `npm run data:check-methodology-archives`, then run focused archive/workbook tests, `npm run i18n:check` and `npx vitest run tests/factQuery/reference.test.ts`. The unchanged Trade MCP/data scope must still pass.
- [ ] Commit as `feat: add source-faithful product workbooks and archives`.

## Task 5: Staged product selection inside the accessible popup

**Files:**
- Create: `apps/web/components/trade/trade-products-picker.tsx`.
- Modify: `apps/web/components/main-explorer/series-selector.tsx`, `apps/web/lib/i18n/messages/ka/trade.json`, `messages/en/trade.json`.
- Test: `apps/web/tests/explorer/tradeProductsPicker.test.tsx`; final real-browser cases in Task 7.

**Interfaces:**
- `TradeProductsPicker(props: { data: ClientTradeProductsData; model: TradeProductsModel; selectedIds: readonly string[]; initialView: "categories" | "selected"; returnFocusTo: HTMLElement | null; onApply: (selectedIds: string[]) => void; onClose: () => void })` is mounted only while open and owns its draft/query/category/page.
- Add optional `SeriesSelector` props `searchFocus?: "page" | "local"` and `listLayout?: "aside" | "flow"`, defaulting to existing page/aside behaviour. Local search omits the page-scrolling focus handler; flow list omits the aside's nested 430px scroll. Keep all existing markup/action/count defaults.

- [ ] Write failures that the rendered selector hierarchy is tabs → search → global actions/count → pinned reference/results, that category totals/counts match the complete catalogue, and that a filtered/page-limited list still exposes a 4,769-series bulk denominator. Assert every row has readable code/source-period identity and a checkbox; initial category view has eight tiles and no thousand-row list. Existing selector output must remain unchanged without the optional props.

Name the picker rendering test `keeps global selection count while displaying eight category tiles`; obtain `html` through `renderToStaticMarkup` and I18nProvider as existing Trade rendering tests do:

```ts
expect(html.match(/data-testid="trade-product-category"/g)).toHaveLength(8);
expect(html).toContain("1 / 4769");
expect(html).not.toContain('data-testid="trade-product-result"');
```

The pinned total uses its own row identifier, so the zero result-row assertion describes the category start view.

- [ ] Run `npx vitest run tests/explorer/tradeProductsPicker.test.tsx` plus the existing selector tests located by `rg --files tests | rg 'seriesSelector|SeriesSelector'`; require failure for the new popup behaviour, and preserve passing existing defaults.
- [ ] Implement the thin native dialog using Task 3 search/page helpers and existing controls/rows. Mount draft from committed selection; category/tab/query changes reset only the documented browsing state. Pin the removable national row, render at most 25 products and keep the draft count/Compare action reachable. Use reviewed bilingual category/alias/empty/unavailable/bulk-scope copy; no new search service or dependencies.
- [ ] Wire Compare to `onApply(draft)` and closing; Close/cancel/Escape/backdrop to discard via `onClose`. Focus Close on opening, lock background scrolling while mounted, contain keyboard navigation and restore previous body style/scroll/opener focus on unmount. Backdrop handling distinguishes clicks on the actual backdrop from dialog content; don't rely on `closedby`. Reopening remounts clean state, including in React strict mode.
- [ ] Run focused popup/selector tests and `npm run typecheck`. Reserve focus, viewport and cancel/commit assertions for the actual routed browser checks in Task 7. Commit as `feat: add staged category product picker`.

## Task 6: Chart-first page and existing Trade navigation

**Files:**
- Create: `apps/web/components/trade/trade-products.tsx`; `apps/web/app/(ka)/explorer/trade/products/page.tsx`, `apps/web/app/(en)/en/explorer/trade/products/page.tsx`.
- Modify: `apps/web/components/trade/trade-partners-ranking.tsx`, `apps/web/lib/pages/trade.tsx`, `apps/web/lib/explorer/tradeHubCards.ts`, `apps/web/components/shell/data-sidebar.tsx`, `apps/web/lib/i18n/inventory.server.ts`, `apps/web/lib/seo/sitemap.ts`, bilingual `trade.json` messages, `Project_Definition.md` §2E, `DESIGN.md` §28.
- Test: `apps/web/tests/explorer/tradeProductsRender.test.tsx`, existing partner rendering/hub tests, `apps/web/tests/i18n/tradePresentation.test.ts`, existing SEO/sitemap tests; modify `apps/web/tests/browser/trade-overview.spec.ts` and `trade-partners.spec.ts` for the approved third hub card and six additional archive originals only.

**Interfaces:**
- `TradeProducts({ data, sources, lastReviewedAt, siteOrigin })` has Task 2 client data, `WorkbookPublicSource[]`, date/origin strings, following partner page props.
- `tradeProductsMetadata(locale: Locale)` and `renderTradeProductsPage(locale: Locale)` in the existing Trade page module load accepted Products plus national facts and only required translation IDs/source projections. Route wrappers follow existing language groups and remain static.
- Broaden existing ranking props narrowly: `model: Pick<TradePartnersModel, "range" | "unit"> & { ranking: readonly TradeProductRankingRow[]; missingRanking: readonly TradeProductRankingRow[] }`, `tab: "countries" | "groups" | "products"`, existing `measure: TradeOverviewIndicator`, optional `pageSize?: number`. Partner rows structurally satisfy this interface; existing call sites need no change. Products supplies `pageSize={25}`; defaults preserve country/group presentation.

- [ ] Write failures for total-only Exports/Line default, no mounted popup on entry, full-width chart with no SeriesAside, correct toolbar/source/version copy, two/four removable selected labels with +N more, complete row/export counts and bounded table pages. Rank top ten independently of selected lines; expand Products in pages of 25, label missing historical records, and preserve signed values/share denominator. Existing country/group rendering remains unchanged.

Name the page test `starts with the national export chart and a closed picker`; render `html` with the existing server-markup test pattern:

```ts
expect(html).toContain('data-mode="line"');
expect(html).toContain('data-measure="trade.exports"');
expect(html).not.toContain('data-testid="trade-products-picker"');
expect(html.match(/data-testid="trade-products-selected-label"/g)).toHaveLength(1);
```

- [ ] Write discovery/metadata failures for the two route paths, third hub/sidebar entry, language alternates, Dataset temporal coverage, reviewed date and sitemap entry. Run `npx vitest run tests/explorer/tradeProductsRender.test.tsx tests/explorer/tradePartnersRender.test.tsx tests/explorer/tradeHubCards.test.ts tests/i18n/tradePresentation.test.ts tests/seo/sitemapFreshness.test.ts`; require the new Products expectations to fail first.
- [ ] Implement the main page in spec §3 order: compact heading/flow/add row, Line/Table/unit/Excel toolbar, existing plot or table, compact selection summary, range, source/definition note, ranking. Table supplies only its 25 selected rows while retaining full count/export inputs. Add and +N more open the picker in the specified view and remember the actual opener. Draft edits never rebuild the committed plot; Apply and remove controls save the committed state. Show a clear reset message only for an invalid saved selection.
- [ ] Extend the existing ranking's row/label configuration and optional pagination without duplicating its table. Keep positive amount bars as existing; when Products has negative amounts, use its existing centered signed-bar machinery while retaining the share column. National total is excluded from product ranking. Use one ordered expanded list of ranked then unavailable rows, 25 per page, with unavailable section labels wherever applicable. Keep top-ten/groups/default behavior for partners.
- [ ] Add route wrappers, loader/source metadata/JSON-LD, hub/card coverage, sidebar and sitemap using established patterns. Extend `buildTradeHubCards` with optional Products coverage so existing consumers retain their two-card output until the loader supplies Products. Update routed hub assertions from two cards to three and the Trade archive-link assertion from seven originals to thirteen; retain all original hash assertions and partner behavior. Update canonical scope/design sections only for the approved page; run focused rendering/i18n/SEO/partner tests and `npm run typecheck`. Read the React best-practices skill after the TSX edits and apply its scoped checklist. Commit as `feat: add chart-first bilingual trade Products page`.

## Task 7: Full-flow verification and branch review

**Files:**
- Create: `apps/web/tests/browser/trade-products.spec.ts`.
- Modify only if verification exposes a Products defect: files owned by Tasks 1–6 and their focused tests.
- Evidence: ignored `apps/web/output/trade-products-verification.md` and screenshots; link final readable evidence without adding test logs to durable instructions.

**Interfaces:** Browser assertions use `trade-products`, `trade-products-picker`, product entity IDs and existing chart/table/download test IDs. Add narrowly named identifiers where the new Products controls require them; do not rename shared existing identifiers.

- [ ] Write routed browser tests in both languages at 1366 × 768 and 390 × 844. On clean entry assert the popup is closed, total only selected, data-derived 1995–2025 range and plot top within viewport. Verify modal opening keeps plot/page position; clicking, typing and toggling draft does not change committed line count. Close, Escape and backdrop each cancel, restore scroll and the actual opener focus; Compare commits. Phone controls and keyboard focus remain reachable with no horizontal overflow.

Name the browser test `opens the finder over the visible chart and cancels its draft`; run for each language/viewport, with `plot` targeting the existing line-chart frame, `opener` the Add products button and `picker` the Products dialog:

```ts
await expect(picker).toHaveCount(0);
const before = await plot.boundingBox();
expect(before!.y).toBeLessThan(page.viewportSize()!.height);
await opener.click();
await expect(picker).toBeVisible();
expect((await plot.boundingBox())!.y).toBeCloseTo(before!.y, 0);
await page.keyboard.press("Escape");
await expect(picker).toHaveCount(0);
await expect(opener).toBeFocused();
```

The full case also checks unchanged committed selection after altering the draft before Escape.

- [ ] Add complete selection tests: search exact code and everyday alias; category/All/Selected paging; Clear then Select all while filtered; apply all 4,769 IDs; reopen and remove one historical identity. Assert no selection cap/downsampling, bounded table/picker/ranking rows, full Excel series/year count and valid source links. Test switching Imports and a historical end year, valid empty hash, back/forward, reload, language and active sidebar links. Version-specific gaps and labels remain intact.
- [ ] Run the narrow new browser file against one existing preview/build server as appropriate; record all-selected open/search/apply/reopen timings and the built route payload size. No passing performance claim comes from row counts alone. If an interaction blocks access or drops frames substantially, profile and make only the needed memoization/index/paging fix; rerun the affected case. Keep unlimited chart lines and export coverage.
- [ ] Run the final `npm run check` once after edits. Stop any preview server before building, set `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` and run `npm run build`. Start that build on port 3100, set `PLAYWRIGHT_BASE_URL=http://localhost:3100`, `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, `CI=1`, and run `npm run test:browser` once against it. Inspect both language desktop/phone screenshots and full output. Do not repeat a passing gate unless its inputs change; focused corrections get focused reruns. Stop the owned preview server when finished.
- [ ] Use requesting-code-review and verification-before-completion skills; follow the chosen execution method's review requirement. Review the whole diff against spec scope/reuse, historical identity, nullable exact data, global selection, private mirror, accessibility, rendering size and all-source Excel behavior. Resolve findings and rerun only affected checks. Record any skipped disposable-database test explicitly.
- [ ] Commit verified fixes/tests as `test: verify complete trade product browsing and comparison`. Report the local branch/commit, browser/check/build evidence and actual database boundary. Show the implemented page preview in Codex. Do not claim production, push/merge or operate on a live database without separate delivery authorization.

## Plan review and execution choice

Self-review checks: each spec section maps to the tasks above; interfaces share the same identity/measure/model fields; all five Review Focus conditions have named owning tests; changes to shared pieces preserve defaults; source/Excel/history scope remains bounded.

Recommended execution: implement directly in this session, then have a fresh reviewer check the whole branch. The tasks share the same historical data and selection interfaces, so keeping implementation in one session avoids repeated context setup. The alternative is one fresh implementer and reviewer per task, which adds independent review checkpoints and uses more time/context. The user approved the plan and this recommended inline method on 2026-10-09 by saying "continue". Proceed through all tasks without intermediate approval requests.
