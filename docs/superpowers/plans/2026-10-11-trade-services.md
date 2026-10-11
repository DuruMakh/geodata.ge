# Services Trade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bilingual Services trade page with national Overview and twelve Service types for the accepted 2020–2024 snapshot.

**Architecture:** Prepare a separately accepted services dataset from the two original type workbooks, retaining exact source values, missingness and the wider package's country holds. Reuse the existing Trade Overview and partner comparison workspaces through a small services context, with a shared tab-state hook and the native workbook writer. Canonical CSVs and a parity-checked private mirror serve static pages.

**Tech Stack:** Existing Next.js 16.3.8, React 19.3.0, strict TypeScript, Tailwind v4, Prisma 7/Postgres, decimal.js, csv-parse, the existing XLSX/XML reader, ExcelJS, Vitest and Playwright. No new product dependency or UI library.

**Spec:** [Approved Services trade design](../specs/2026-10-11-trade-services-design.md), approved on 2026-10-11 when the owner said "continue" after written-spec review.

**Status:** Plan awaiting owner review. Recommended execution: implement inline in this chat, then obtain one independent whole-branch review. Existing isolated checkout: `C:/Users/Mylaptop/.codex/worktrees/d51c/Geodata.ge`, branch `codex/trade-services`, design commit `14fc0e0a`. Publishing and live database operations are separate. Commands run in `apps/web` unless marked repository root.

## Global Constraints

- Georgian: `/explorer/trade/services`, titled `მომსახურებით ვაჭრობა`. English: `/en/explorer/trade/services`, titled `Services trade`.
- Select **only `dimension=type`** from the frozen `services-annual.csv` for 2020–2024.
- Thirteen identities, 130 original observations (129 numerical and one published dash), 128 numerical derivations and 258 canonical facts.
- Maintenance and repair exports for 2020 remain unavailable. The two unsupported turnover/balance derivations are absent and render as missing.
- Initial selection contains only the removable applicable total; initial mode is line and initial range is all loaded years.
- Service types starts with Total services trade. Show all twelve types in its independent end-year ranking.
- Search never narrows bulk selection, counts, ranking or Excel. Selection is unlimited and explicitly empty selections remain empty.
- Source publication status stays unspecified; observed basis stays actual. Preserve exact source decimals, zero, negative values and missingness.
- Services identities remain services: national `services.total`, never an alias to `goods.total` or a country identity.
- Keep the two UK country-table failures unchanged and outside this separately accepted subset. Do not accept the whole research package.
- Keep one heading, one short lead line and one page-level Overview / Service types tab row.
- No countries, type-country join, combined goods/services headline, NBG history backfill, sub-annual data, growth/GDP measure, currency conversion, new MCP tool or central bulk publication.
- Builds remain prerendered; serving imports no raw workbooks or preparation code. Live migration/import and publishing require separate authorization.

## Review Focus

1. A services comparison accidentally uses goods totals, goods definitions or country labels because the shared components infer their context. Task 3 tests explicit dataset context; Task 4 tests the route and metadata.
2. The 2020 maintenance/repair dash becomes zero or produces a balance/turnover from one numerical input. Tasks 1 and 3 test canonical absence and visible gaps.
3. Balance rankings show a percentage or hide a negative amount. Task 3 tests signed ordering, zero-centered bars and absent balance shares.
4. Empty saved selections or per-view state disappear on language/history navigation. Tasks 3 and 5 test serialization and real navigation.
5. A service workbook inherits a goods/domestic filename or the wrong original-source links. Tasks 3 and 4 test actual XLSX contents and public archive fingerprints.

## File map and reuse

| Responsibility | Files and reuse decision |
| --- | --- |
| Accepted data | New `apps/web/lib/data/tradeServices/{types,prepareTradeServices,validation,importTradeServices}.ts`, preparation script, canonical CSV, catalogue and scoped report. Reuse verified package reads, exact XLSX/XML reading, BOM serialization and artifact/parity helpers. |
| Private mirror | Extend `apps/web/prisma/schema.prisma`, `lib/db/{mirrorRows,servedDataDb}.ts`, `lib/data/servedData.ts` and `scripts/import-budget-facts.ts`; add one generated `trade_services` migration. Follow existing nullable Trade partner/product mappings and transaction boundaries. |
| Shared explorer | Extend `components/trade/{trade-overview,trade-partners,trade-partners-series-panel,trade-partners-ranking,use-trade-partners-state}.tsx/ts`, their existing model/state/workbook files, and the client partner data type. Preserve the canonical goods entity types and defaults. |
| Tab composition | Extract the small shared hook into `components/trade/use-trade-sections-state.ts`; use it in the current `trade-domestic-exports.tsx` and a thin new `trade-services.tsx`. Two real consumers justify this extraction; do not duplicate either workspace. |
| Discovery and sources | Extend `lib/pages/trade.tsx`, `lib/explorer/tradeHubCards.ts`, `components/shell/data-sidebar.tsx`, `lib/seo/sitemap.ts`, translation inventories/catalogues, source registries and existing bilingual methodology. Add the two small route wrappers. |
| Checks | New focused data, mirror, services state/render/workbook/source and browser tests; retain the existing Trade suites as regression checks. |

## Before execution

- [ ] Confirm the branch, clean/user-owned changes and current instructions. Reuse this existing worktree.
- [ ] Read the execution/TDD/verification skills, Supabase guidance for the private mirror, and installed Next.js guides for static routes and metadata before changing their code. Inspect installed Prisma CLI help before producing the offline migration.
- [ ] Install the locked web dependencies with `npm ci` if absent or stale; run `npm run prisma:generate`. Do this only after plan approval. Do not install a new library or call live database operations.

### Task 1: Accept, prepare and load the services subset

**Files:** Create `apps/web/lib/data/tradeServices/{types,prepareTradeServices,validation,importTradeServices}.ts`, `apps/web/scripts/prepare-trade-services.ts`, `data/imports/trade-services-annual.csv`, `data/taxonomy/trade-services.json`, `data/reports/trade-services-validation.json` and `apps/web/tests/data/tradeServices/{prepareTradeServices,validation}.test.ts`. Modify `apps/web/package.json`, `data/localization/en/labels.json` and the label inventory in `apps/web/lib/i18n/inventory.server.ts`.

**Interfaces:**

- `TradeServiceEntity`: `{ id: string; kind: "national" | "service_type"; labelKa: string; labelEn: string }`, using exactly the thirteen IDs in the spec.
- `TradeServiceFact`: `entityId`, `year`, `indicatorId: TradeOverviewIndicator`, `valueUsd: string | null`, `unit: "usd"`, `basis: "actual"`, `valueStatus: "numeric" | "not_applicable"`, `publicationStatus: "unspecified"`, `role: "total" | "detail" | "derived"`, native `sourceId/sourceRefs/sourceValue/sourceUnit/sourceLabel/sourceNumberFormat/sourceBlock`, and `lastReviewedAt`. Native source fields are nullable only for derivations; the published dash retains `sourceValue: "-"`.
- `TradeServicesData = { entities: TradeServiceEntity[]; facts: TradeServiceFact[] }`; fact key is `(entityId, year, indicatorId)`.
- `TradeServicesAcceptance`: passed `annual_services_types` scope, source years, source/value/derivation counts, source/input/canonical/catalogue/scoped-English SHA-256 fingerprints, review date `2026-10-11`, wider research status and outside-scope holds.
- `buildTradeServicesData(root: string): Promise<{ data: TradeServicesData; report: TradeServicesAcceptance }>`; `tradeServicesCsv(data: TradeServicesData): string`; `prepareTradeServicesData(root: string, mode: "write" | "check"): Promise<void>`.
- `validateTradeServicesData(data: TradeServicesData, report: TradeServicesAcceptance, englishLabels: Record<string, string>): void`; `loadTradeServicesData(): Promise<TradeServicesData>`; `assertTradeServicesParity(csv: TradeServicesData, mirror: TradeServicesData): void`. Task 2 adds the served CSV/DB bridge once both loaders exist.
- Export the two native source IDs and their explicit `source.geostat_services_...` document bindings in `types.ts`. Later tasks use these constants rather than guessing a source from a label.

- [ ] **Write the data regressions first.** In `prepareTradeServices.test.ts`, assert these independently established values:

```ts
expect(result.data.entities).toHaveLength(13);
expect(result.data.facts).toHaveLength(258);
expect(result.report.primaryObservations).toBe(130);
expect(result.report.derivedObservations).toBe(128);
expect(result.report.outsideScopeHoldCount).toBe(2);
expect(totalExports2024.valueUsd).toBe("7706284984.7599976");
expect(repairExports2020).toMatchObject({ valueUsd: null, sourceValue: "-", valueStatus: "not_applicable" });
expect(repairDerived2020).toHaveLength(0);
```

Also pin 20 national/238 type facts, all five years, both native sources, exact ordered derivation references, the independent ten type sums and the absence of country rows. Mutation tests reject omitted/duplicate/extra keys, swapped identity/year/source/cell/role/unit/labels, rounded values, a dash changed to zero, modified originals/inventory and a newly affected hold. Use temporary copies of only required inputs. For semantic mutations refresh the fixture's relevant artifact hash so the test reaches the cell/identity check; never change the real archive.
- [ ] **Run the failing suite.** `npx vitest run tests/data/tradeServices/prepareTradeServices.test.ts tests/data/tradeServices/validation.test.ts`. Require a failure caused by the absent services implementation or the tested behavior.
- [ ] **Implement the minimal data family.** Call `readVerifiedPackageFile`, `readTradeSourceWorksheet`, Decimal precision 50, `serializeBomCsvRows`, `assertGeneratedArtifactMatches` and `assertSameServedRows`. Check the selected inputs against the frozen manifest/layout/inventory and independent evidence. Keep all 130 native records; derive only matching numerical pairs. Do not import large research inputs into serving code or clone an existing preparer wholesale.
- [ ] **Write the accepted artifacts and loading checks.** Add reviewed Georgian/English names for the spec's IDs; bind their scoped fingerprint. Add `data:prepare-trade-services` / `data:check-trade-services` and the latter to `data:validate`. The canonical loader checks every catalogue/fact field and acceptance fingerprint; no reference to an unimplemented DB loader is needed in this task.
- [ ] **Verify and commit.** Run the focused suites, `npm run data:prepare-trade-services`, then `npm run data:check-trade-services`; expect the specified counts, deterministic bytes and exit 0. Check the BOM and unchanged research holds. Commit only this task's files.

### Task 2: Add the private serving mirror

**Files:** Modify `apps/web/prisma/schema.prisma`, `apps/web/lib/db/{mirrorRows,servedDataDb}.ts`, `apps/web/lib/data/servedData.ts`, `apps/web/lib/data/tradeServices/importTradeServices.ts`, `apps/web/scripts/import-budget-facts.ts`; add one generated `apps/web/prisma/migrations/*_trade_services/migration.sql` and `apps/web/tests/data/tradeServices/mirrorRows.test.ts`. Reuse the existing guarded disposable-Postgres test pattern if a suitable test database is available; do not create a new database or use production credentials.

**Interfaces:** Consume Task 1's accepted data and explicit document bindings. Produce `tradeServiceEntityMirrorCreateRows(entities: readonly TradeServiceEntity[], importRunId: string): Prisma.TradeServiceEntityCreateManyInput[]`, `tradeServiceFactMirrorCreateRows(facts: readonly TradeServiceFact[], importRunId: string): Prisma.TradeServiceFactCreateManyInput[]`, `loadTradeServicesDataFromMirror(db: Pick<MirrorClient, "tradeServiceEntity" | "tradeServiceFact">): Promise<TradeServicesData>`, `loadTradeServicesDataFromDb(): Promise<TradeServicesData>` and `loadServedTradeServicesData(): Promise<TradeServicesData>` (cached accepted CSV loading, then lazy DB loading plus parity when DB mode is selected).

- [ ] **Write the failing mirror tests.** Round-trip all thirteen entities/258 facts through the existing mapping-test pattern, preserving null, the native dash, raw source strings, labels and dates. Alter each protected field, the source-document relation and a derivation reference; require parity/relation rejection. Exercise the existing transaction's mismatch rollback contract; if a real disposable database is unavailable, clearly distinguish mapping/mocked-transaction evidence from a real rollback test.
- [ ] **Run the failing test.** `npx vitest run tests/data/tradeServices/mirrorRows.test.ts`.
- [ ] **Implement schema, mappings and transaction integration.** Use `TradeServiceEntity`/`TradeServiceFact`, nullable Decimal(40,20), existing import/source relations and the composite unique key. Preserve native source strings without monetary rounding. Insert/delete in foreign-key order, compare complete imported data before commit and add both tables to the existing parity report. Reuse current batching/transaction code without a second importer.
- [ ] **Generate and inspect the offline migration.** Diff the previous and updated schemas using the installed Prisma CLI; add RLS and revoke public grants following the adjacent Trade migrations. Confirm only the two new tables, their keys/indexes/relations and private-role settings change. Run `npm run prisma:generate`; do not run `prisma migrate dev/deploy` or `data:import` against a live database.
- [ ] **Verify and commit.** Run the mirror suite, affected import/parity tests and `npm run typecheck`. If an explicitly approved disposable target exists, verify migration, full round-trip, rollback and role restrictions there; otherwise record that boundary. Commit the schema/mapping/test changes together.

### Task 3: Reuse the Trade workspaces, state and Excel for services

**Files:** Modify `apps/web/lib/data/tradePartners/importTradePartners.ts`; `apps/web/lib/explorer/tradePartners{,State,Workbook}.ts`, `tradeOverviewWorkbook.ts`; `apps/web/components/trade/{trade-overview,trade-partners,trade-partners-series-panel,trade-partners-ranking,trade-domestic-exports}.tsx` and `use-trade-partners-state.ts`. Create `apps/web/components/trade/{use-trade-sections-state.ts,trade-services.tsx}` and `apps/web/tests/explorer/{tradeServicesState.test.ts,tradeServicesRender.test.tsx,tradeServicesWorkbook.test.ts}`. Add the services client adapter to Task 1's `importTradeServices.ts` and services messages to the existing Georgian/English `trade.json` files.

**Interfaces:**

- Add optional `dataset?: "services"` to `ClientTradePartnersData`; widen only its client entity kind with `"service_type"`. Do not widen the canonical goods entity validation/schema.
- `tradePartnersTotalId(data: Pick<ClientTradePartnersData, "dataset">): "goods.total" | "services.total"` centralizes reference identity in the existing model/state/bulk/workbook paths; the old total remains the default.
- Extend client `TradePartnersTab` with `"types"`. Services normalizes to this tab and serializes `section=types`; existing goods/domestic hashes retain their meaning.
- Add optional `dataset?: "services"` to the `TradeOverview` props, its embedded state hook and both existing workbook builders' input. Its services hash uses `section=overview` and dispatches `trade-services-state`; default contexts retain their current behavior.
- `toClientTradeServicesData(data: TradeServicesData): { national: ClientTradeOverviewFact[]; types: ClientTradePartnersData; englishLabels: Record<string, string> }` projects exactly twenty numeric national points and the type facts, including null. `types.dataset` is `"services"`; its entities are twelve service types and its reference is `services.total`.
- `useTradeSectionsState<T extends string>(sections: readonly T[], defaultSection: T, eventName: string): { section: T; changeSection: (next: T) => void }` shares only the existing Domestic exports tab cache/history logic. Call it from both actual wrappers.
- `TradeServices` consumes the client adapter, public sources, review date and site origin, then composes `TradeOverview`/`TradePartners` with explicit services context. It owns the single heading/lead/tab row.

- [ ] **Write failing state/model/render/workbook regressions.** Pin services defaults, the thirteen-row bulk scope after search, removable/empty total, all twelve types ranked, same-year services denominators, scale independence and all saved-link transitions. Include a negative service balance: rank by absolute value, retain its sign and show no share. Select 2020 maintenance/repair exports and require gaps/dashes/blank cells; its imports stay numerical and no balance/turnover appears. Assert no country/group control, goods definition or `goods.total` leaks into services.
- [ ] **Write actual XLSX assertions.** Build both language workbooks with the existing writer and load them with ExcelJS. Check services filenames/titles, selected years and complete selected series, actual basis, unspecified publication status, blank missing amounts, signed values and source links. Export/import measures cite only their matching original; turnover/balance cite both. No goods/domestic filename or internal metadata columns may appear.
- [ ] **Run the failing suites.** `npx vitest run tests/explorer/tradeServicesState.test.ts tests/explorer/tradeServicesRender.test.tsx tests/explorer/tradeServicesWorkbook.test.ts`.
- [ ] **Implement small shared additions.** Reuse the current charts, table, range, selectors, palette, ranking and workbook writer. Services context supplies labels, reference identity, source filtering, workbook name and hash section; it must not trigger the Domestic exports branch merely because measures exist. Show all twelve types without pagination, with unavailable rows unranked. Keep the overview's independent figures and signed balance context.
- [ ] **Share tab-state logic and compose the page.** Extract only the existing cache/history logic for two consumers; preserve Domestic exports semantics. Implement the services wrapper's two text tabs and the spec's exact English lead line, with matching Georgian copy and no extra heading paragraph.
- [ ] **Verify and commit.** Run the three new suites plus existing `tradeOverview*`, `tradePartners*` and `tradeDomestic*` explorer suites. Require unchanged default behavior and passing services assertions; run `npm run typecheck`. Commit the shared-context change with its regressions.

### Task 4: Connect the pages, discovery, sources and methodology

**Files:** Create `apps/web/app/(ka)/explorer/trade/services/page.tsx` and `apps/web/app/(en)/en/explorer/trade/services/page.tsx`. Modify `apps/web/lib/pages/trade.tsx`, `apps/web/lib/explorer/tradeHubCards.ts`, `apps/web/components/shell/data-sidebar.tsx`, `apps/web/lib/seo/sitemap.ts`, `apps/web/lib/i18n/inventory.server.ts`, `data/localization/en/{page-revisions,documents}.json`, `data/sources/source-documents.csv`, `data/methodology/source-archives/trade.csv`, `apps/web/lib/methodology/content/{trade.ts,en/trade.ts}`, the existing Trade messages, `Project_Definition.md` §2E, `DESIGN.md` §28 and `docs/data-methodology/trade-annual.md`. Create `apps/web/tests/methodology/tradeServiceSources.test.ts`; extend current Trade hub and presentation tests.

**Interfaces:** `tradeServicesMetadata(locale: Locale)` and `renderTradeServicesPage(locale: Locale)` follow the current Trade page functions. Extend `buildTradeHubCards` with an optional final services-facts argument; defaults preserve the four existing cards. Consume Task 1's served loader and Task 3's client adapter/wrapper.

- [ ] **Write failing discovery/source assertions.** Require the Services child/card after Domestic exports, correct bilingual paths/title/coverage and a services turnover sparkline. Validate all three original-source hashes/byte sizes and archive entries: the two type workbooks and services metadata PDF. Assert correct original filenames/download paths/document bindings and no country workbook added by this task.
- [ ] **Run the failing tests.** Run the new source test and existing `tradeHubCards.test.ts` / `tradePresentation.test.ts` using explicit paths.
- [ ] **Implement the thin routes and existing discovery additions.** Load only accepted canonical services data and reviewed source manifests. Pass services-specific sources, review date and labels. Add language alternates, breadcrumbs and Dataset markup with data-derived years; update sitemap and page/label/document inventories. Do not touch query snapshots, MCP tools or bulk dataset families.
- [ ] **Extend the existing source archive and methodology.** Add the untouched workbooks/PDF with validated hashes and bilingual descriptions. Explain residents/non-residents, type definitions, nominal USD, the unavailable 2020 figure, exact derivations, country holds and the distinct NBG vintage. Reuse existing rendering/archive components; do not bundle raw research data into methodology.
- [ ] **Update the canonical owners and verify.** Record only this approved extension in scope/design/methodology, without editing `AGENTS.md`. Run the source/hub/presentation tests, `npm run data:prepare-methodology-archives`, `npm run data:check-methodology-archives` and `npm run i18n:check`; expect complete translations and correct hashes. Commit the integration and documentation together.

### Task 5: Verify the complete bilingual flow and review the branch

**Files:** Create `apps/web/tests/browser/trade-services.spec.ts`; update affected existing Trade browser assertions only where the added card/child changes a legitimate count. Store review screenshots under the existing `docs/superpowers/reviews/` convention, and update this plan's completion evidence as work finishes.

**Interfaces:** Consume the completed static routes and public downloads. Browser tests use existing test IDs, adding services wrapper/view IDs where necessary; reuse Trade controls' established IDs inside the active view.

- [ ] **Write the browser tests before the final UI pass.** Cover Georgian/English at 390, 768 and 1440 pixels: both default views, all/empty selection, filtered bulk actions, negative balance, the missing 2020 figure, chart/table and range changes, independent ranking, reload/back/forward, language switching, per-view memory and real Excel downloads. Check the complete selection survives export; inspect the downloaded XLSX. Pin heading/controls readability, keyboard operation, page overflow and source links.
- [ ] **Run the narrow browser feedback loop.** Start this checkout's own development server on a verified free local port with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, and set `PLAYWRIGHT_BASE_URL` explicitly to that port. Run `npx playwright test tests/browser/trade-services.spec.ts`; verify a behavioral failure when applicable, correct it narrowly and rerun only affected cases. Recheck any changed shared Trade browser flow. Capture the six language/width views for visual review. Do not let the default browser configuration reuse another worktree's server.
- [ ] **Run the completion gate once.** Run `npm run check`; stop the development server started for this task before building. Set `$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'` and run `npm run build`. Confirm services routes are static and their bundles exclude research/preparation code. Start this checkout's production artifact on a verified free local port, set `PLAYWRIGHT_BASE_URL` and the same site URL, then run `npm run test:browser`. Do not rebuild while this server is running. Preserve existing environment values and stop only the server started for this task when finished.
- [ ] **Request the selected review.** For recommended inline execution, obtain one independent whole-branch review against the approved spec and actual implementation. Prioritize source/hold boundaries, cross-dataset leakage, nulls, state, source links and shared-default regressions. Resolve concrete findings with focused tests; repeat a passing gate only if its inputs changed.
- [ ] **Record exact evidence and commit.** Record counts, focused/full gate results, screenshots, review outcome and any unrun disposable-database boundary. Verify only authorized files changed and the working tree is clean after committing. Report the checkout, branch, commit and local delivery state. Publishing remains a separate step.

## Plan self-review

- Spec §§1–2 and 8–9 are covered by Tasks 1, 3 and 4; §§3–5 by Tasks 3 and 5; §§6–7 by Tasks 1–2; §10 by Task 5 and each task's focused checks.
- Every Review Focus item has an owning test step. Cross-dataset IDs, source applicability and null-derived amounts are explicit assertions rather than reliance on arithmetic alone.
- Later tasks consume the exact named interfaces above. Only client partner types widen; canonical goods acceptance stays bounded.
- No new chart/selector/table/ranking/workbook, broad state framework, speculative feature or live operation is planned. The one shared hook has two existing-page consumers.
