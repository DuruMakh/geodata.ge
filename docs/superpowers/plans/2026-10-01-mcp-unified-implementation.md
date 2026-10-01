# MCP Coverage, Compatibility, Documentation and Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver accurate city coverage, support existing and modern MCP clients, expose reviewed product inflation, and publish matching bilingual connection instructions and bulk files.

**Architecture:** Preserve one public read-only `/mcp` endpoint and the build-time snapshot. Replace only the transport with the official SDK's stateless dual-era handler; add a separate product dataset/tool using the product explorer's existing arithmetic. Existing query envelopes, source resolution, caveat registry, publication builders and UI components remain the foundation.

**Tech Stack:** Next.js 16.3.8, strict TypeScript, Zod 4, Decimal.js, Vitest, Playwright; exact `@modelcontextprotocol/server` and `@modelcontextprotocol/client` 2.2.0, with the existing v1 SDK retained as a development-only compatibility client.

**Specs:** [city coverage](../specs/2026-10-01-mcp-city-coverage-design.md), [client compatibility](../specs/2026-10-01-mcp-client-compatibility-design.md), [documentation](../specs/2026-10-01-mcp-documentation-design.md), [product inflation](../specs/2026-10-01-mcp-inflation-products-design.md). Executors read all four; this unified plan supplies the order and concrete interfaces without expanding their scope.

**Planning status:** The user's request for this unified plan accepts the four specs for implementation planning. Implementation starts after plan review and selection of execution method. No publishing, merging, paid-service change or production database operation is authorized by this planning step.

**Baseline:** `codex/mcp-upgrade-specs`, specification commit `dbef42f1`, based on main `1c2a0acd07f0fa522bf4f6aab33924b319cc2112`. Recheck live Git state before execution; preserve other changes and worktrees.

## Global Constraints

- Npm/test commands run from `apps/web`; Git commands run from the repository root. Paths below are repository-relative. Use PowerShell on this host; do not copy Unix environment-variable syntax into it.
- Keep `/mcp` public, read-only, stateless and snapshot-backed. No model calls, authentication, write tools, new runtime routes or dataset-network/database reads.
- Keep pause, host/origin checks, shared Upstash rate limiting, 32 KiB body cap, 500 query cells, 250 comparison pairs, 512 KiB serialized results, 10-second function ceiling and rank defaults/maxima of 10/100.
- Existing legacy `2025-11-25` behavior remains supported. Modern `2026-07-28` uses discovery and per-request metadata. Data schema becomes `1.5.0` only with the product extension; transport version is a separate concept.
- Product dataset/tool are `inflation-products` / `query_inflation_products`; product IDs remain `cpi.product.pNNNN`, entity `country.georgia`, level `product`, scope `consumer_prices`. Product query measures are exactly `yoy_pct` and `cumulative_pct`.
- Annual values are published annual indices minus 100. Cumulative values compound every monthly index from January `startYear`, relative to the previous December. Never fill missing inputs, sum rates or silently bridge reviewed identity splits.
- `calculationBasePeriod` is optional and appears only on cumulative observations/ranking entries. Both cumulative observation identity and definition identity include the base.
- Queries remain pure; only `buildSnapshot.ts` may load serving data. Keep Decimal/Map caches out of serialized snapshots. No source locators or internal identity-decision metadata in public outputs.
- All new service-message keys/parameters, schemas, source translations and caveats must be declared in their existing owners. Caveats are registered rules, never inline query warnings.
- Derive coverage, newest months, counts and ranking populations from facts. Fixed historical values are allowed in independently reviewed reference fixtures, not production defaults.
- A reference mismatch is a stop condition: investigate and report it, never change an expected number merely to make a test pass.
- No unrelated refactor, UI redesign, database migration, price calculator, product weights/contributions, city products or retired-product access. Preserve `DESIGN.md` v4.1 and bilingual URL conventions.
- Run narrow checks per task and the complete completion gate once after integration. Repeat only checks whose inputs changed.

## Review Focus

1. Mixed country/city requests must not erase legitimate national history or advertise that history for every city; Task 1 tests the union and missing observations separately.
2. A modern protocol probe must not accidentally remove old-client initialization or exhaust request budgets; Task 2 tests real client flows and both rate-limit refusal paths.
3. Different cumulative first years must never produce identical IDs, and output months must not determine the input baseline; Task 4 tests both identities and earlier inputs.
4. Product roster changes, missing cells and bilingual identity limits must survive snapshot hashes, rankings and exports; Tasks 3, 5 and 6 test these boundaries.
5. An SDK success must not become an unsupported claim about a human application's menus, plans or login access; Task 9 requires application-specific evidence or an explicit unverified boundary.

## File Responsibilities

| Owner | Responsibility and planned files |
| --- | --- |
| Existing inflation queries | Correct city/mixed coverage in `apps/web/lib/factQuery/inflationData.ts` and `queryInflation.ts`. |
| Transport | Migrate `apps/web/app/mcp/route.ts`, `lib/mcp/tools.ts`, `security.ts` and affected MCP test imports; preserve `limits.ts`, `upstashCounter.ts` and `log.ts` contracts. |
| Product vocabulary | Create `apps/web/lib/factQuery/inflationProductSeries.ts` for measure/definition constants and public snapshot types. |
| Product data helpers | Create `apps/web/lib/factQuery/inflationProductData.ts` for snapshot-index memoization and factual coverage. |
| Product query | Create `apps/web/lib/factQuery/queryInflationProducts.ts`; extend existing `types.ts`, `schemas.ts`, `observations.ts`, `index.ts`. |
| Build snapshot | Extend `apps/web/lib/factQuery/buildSnapshot.ts`; reuse `lib/data/inflation/importProducts.ts` and the existing public source manifests. |
| Product evidence | Create `apps/web/lib/factQuery/caveats/rules.inflation-products.ts`; register it in `caveats/index.ts`, update `localization.ts`, bilingual service messages and the existing grounding methodology. |
| Discovery/calculations | Extend `describeCoverage.ts`, `getSources.ts`, `compare.ts`, `rank.ts`; do not create duplicate public compare/rank tools. |
| Bulk publication | Extend `publications.ts` and existing preparation/check scripts; add two generated files through the builder, not manual edits. |
| Tool/text contract | Extend `lib/mcp/tools.ts`, `outputSchema.ts`, `result.ts`, `instructions.ts`; update existing reference dispatch and fixtures. |
| Human documentation | Extend `lib/pages/connect.tsx`, both connection message files, `public/llms.txt`, `docs/deployment.md`, `Project_Definition.md` and the relevant methodology owners. |
| Review evidence | Create `docs/superpowers/reviews/2026-10-01-mcp-upgrade-verification.md` during execution, recording actual checks, measurements and unverified boundaries. |

Tasks are sequential within this checkout. The independent city and protocol tasks remain separate review/commit units inside this unified plan. Do not run overlapping source edits in the same checkout.

---

### Task 1: Correct city coverage without changing observations

**Files:** Modify `apps/web/lib/factQuery/inflationData.ts`, `queryInflation.ts`, `apps/web/lib/mcp/outputSchema.ts`; test `apps/web/tests/factQuery/inflationCities.test.ts`, `queryInflation.test.ts`, `apps/web/tests/mcp/tools.test.ts`, `outputSchema.test.ts`.

**Interfaces:** Consume `FactQuerySnapshot.inflation`, existing `InflationMeasure` and `PeriodRange`. Produce `inflationRequestCoverage(snapshot: FactQuerySnapshot, entityIds: readonly string[], seriesIds: readonly string[], measure: InflationMeasure): { availablePeriods: PeriodRange | null; availableYears: number[] }` for calls containing cities. Leave national-only coverage paths unchanged.

- [ ] **Step 1: Prepare execution environment.** Read current `AGENTS.md`, `CLAUDE.md`, routed methodology/specs and Git state. Confirm this linked worktree is still suitable; do not create another checkout automatically. Check dependency/lockfile freshness. If dependencies are absent or stale, install the existing lockfile with `npm ci --cache "$env:TEMP/geodata-mcp-npm-cache"`; resolve any Prisma engine/cache failure without touching product code. Run `npm run data:prepare-fact-query-snapshot` before tests reading the packaged snapshot. Existing environment failures must be recorded separately from regressions.
- [ ] **Step 2: Add failing coverage tests.** In the existing city test fixture, assert:

```ts
expect(queryInflation(snapshot, { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }))
  .toMatchObject({ data: { observations: [{ value: 7.0857 }], coverage: { availablePeriods: ["2016-01", "2026-08"] } } });
expect(queryInflation(snapshot, { entityIds: ["city.zugdidi"], seriesIds: ["cpi.headline"], measure: "avg12_pct", fromPeriod: "2016-06", toPeriod: "2016-06" }))
  .toMatchObject({ data: { observations: [{ value: null }], coverage: { availablePeriods: ["2017-12", "2026-08"] } } });
```

Also use synthetic facts to assert available-year gaps, empty coverage, two-city union and country/city union. In the mixed test, assert the earlier national range alongside an unchanged missing city observation. Existing headline/target/weights/contribution results must remain identical.
- [ ] **Step 3: Run the failing tests.** `npx vitest run --configLoader native tests/factQuery/inflationCities.test.ts`. Expect the new city-boundary assertions to fail while existing numeric assertions pass.
- [ ] **Step 4: Implement the helper and call it only for city-inclusive requests.** Filter available facts by requested entity/series/measure across complete history. Keep range acceptance independent from response availability; dates before city publication within the existing accepted dataset window still return missing cells. Do not synthesize unavailable intermediate years. Correct the output coverage schema's existing `availablePeriods` tuple declaration to admit null for the specified no-data case, and assert that this transported case validates successfully.
- [ ] **Step 5: Verify and commit.** Run `npx vitest run --configLoader native tests/factQuery/inflationCities.test.ts tests/factQuery/queryInflation.test.ts tests/mcp/tools.test.ts tests/mcp/outputSchema.test.ts`, after rebuilding the packaged snapshot if necessary. Expect all selected tests to pass. Commit only this fix and its tests as `fix(mcp): report city-specific inflation coverage`.

### Task 2: Prove and migrate the stateless dual-protocol transport

**Files:** Modify `apps/web/package.json`, `package-lock.json`, `app/mcp/route.ts`, `lib/mcp/tools.ts`, `security.ts`; create `apps/web/tests/mcp/protocolCompatibility.test.ts`; update existing `tests/mcp/route.test.ts`, `routeFailure.test.ts`, `rateLimitOrder.test.ts`, `security.test.ts`, `tools.test.ts`, `bilingualTransport.test.ts` and any other tests importing the old transport/server API.

**Interfaces:** Preserve exported `POST(request: Request): Promise<Response>`, `OPTIONS/GET/DELETE(request: Request): Response`, and `createMcpServer(): McpServer` (now from the v2 server package). Use `createMcpHandler(createMcpServer, { legacy: "stateless", responseMode: "json" }).fetch(request)` inside the existing guarded route. Keep one shared snapshot/counter per instance, with a fresh server per request.

- [ ] **Step 1: Add the failing protocol matrix.** Use a test-only bounded local HTTP bridge to the route for real v1/v2 HTTP clients; close clients, servers and handlers in teardown. Test a v2 client pinned to `2026-07-28` as well as a v2 automatic client; both must report modern era and complete the same city/source calls. A v1 client must initialize and complete those calls. Raw modern requests must include required `_meta`, protocol/method/name headers. Assert:

```ts
expect(discovery.result.resultType).toBe("complete");
expect(modernCall.result.structuredContent).toEqual(legacyCall.result.structuredContent);
expect(modernResponse.headers.get("mcp-session-id")).toBeNull();
expect((await GET(getRequest)).status).toBe(405);
expect((await DELETE(deleteRequest)).status).toBe(405);
```

Include genuine v2 fallback against a test-only legacy v1 server, declared prior legacy revisions, initialized notification acknowledgement, legacy ping, deterministic tool order and unknown version/method behavior. Missing/mismatched modern metadata/headers must fail correctly with preserved request IDs.
- [ ] **Step 2: Record the pre-migration failure and install reviewed packages.** Modern discovery must fail against the existing server. Pin server/client at 2.2.0, move SDK 1.30.1 to development dependencies for the old client/fallback fixture, and update the lockfile through npm. Check the exact installed release's docs/types; package metadata and official SDK guides were checked during planning. Do not run a broad codemod.
- [ ] **Step 3: Prove the SDK handler independently, then migrate the route.** With the real clients, prove stateless legacy and modern JSON operation before replacing production wiring. Preserve pause/host/origin/body/rate checks before `fetch`; reconstruct the already byte-checked body as a fresh Request rather than reading the caller's stream twice. Use the SDK's era-specific validation; do not reimplement discovery/version negotiation. A failure to support required legacy behavior is a design-stop condition.
- [ ] **Step 4: Preserve operational behavior.** Add `server/discover` to the fixed log inventory and modern required CORS headers to the existing allowlist. Preserve the accepted legacy list or explicitly report a removal. Check modern response shape before log classification; empty notification responses must not trigger JSON parsing failures. Keep safe application exceptions, no-store/CORS error responses and the limiter charging order.
- [ ] **Step 5: Run the complete focused transport suite.** `npx vitest run --configLoader native tests/mcp`. Assert modern/legacy parity plus both rate-limit denial paths, limiter unavailable, pause, invalid host/origin, malformed/oversized body, result size, unreadable snapshot, teardown and no leaked sessions/streams. Adapt old in-memory transport tests to supported v2 APIs or the tested HTTP bridge, preserving their existing assertions. No test timeout increase to hide a hanging transport.
- [ ] **Step 6: Commit.** `feat(mcp): support modern and legacy stateless clients`. Data schema still remains 1.4.0 at this stage. Record the two-client evidence and limitations in the verification document.

### Task 3: Add deterministic product snapshot data and schema 1.5.0

**Files:** Create `apps/web/lib/factQuery/inflationProductSeries.ts`, `inflationProductData.ts`, `tests/factQuery/inflationProductSnapshot.test.ts`, `data/localization/inflation-product-history.json`; modify `types.ts`, `schemas.ts`, `buildSnapshot.ts`, `describeCoverage.ts`, `getSources.ts`, `apps/web/lib/explorer/inflationProducts.ts`, `data/localization/en/labels.json`; test `tests/factQuery/buildSnapshot.test.ts`, `canonical.test.ts`, `tests/explorer/inflationProducts.test.ts`.

**Interfaces:** Export `PRODUCT_QUERY_MEASURES = ["yoy_pct", "cumulative_pct"] as const`, `ProductQueryMeasure`, `PRODUCT_DATASET_ID`, `ProductSnapshotCatalogueRow` (productId, coicopCode, labelKa, labelEn, firstPeriod), `ProductSnapshotFact` (productId, measure, period, index100, availability, sourceId), and `ProductHistoryNote` (productId, boundaryYear, noteKa, noteEn). Add `snapshot.inflationProducts: { catalogue: ProductSnapshotCatalogueRow[]; facts: ProductSnapshotFact[]; historyNotes: ProductHistoryNote[] }`.

Export `inflationProductIndex(snapshot: FactQuerySnapshot): ProductIndex` from `inflationProductData.ts`, memoized by snapshot. Reuse existing `buildProductIndex` and arithmetic. Widen `packProductFacts` only to accept `readonly Pick<ProductFactRow, "productId" | "measure" | "period" | "index100">[]`, so sanitized facts can be packed without fake locators/review metadata.

- [ ] **Step 1: Add failing snapshot/hash tests.** Compare the sanitized snapshot roster/facts with `loadServedProductData()`, require `SCHEMA_VERSION === "1.5.0"`, and assert stable ordering/hashes after input permutation. Hash tests must mutate an index, public name, first period and public history note individually; each must change `dataVersion`. Assert snapshot/public JSON has no `sourceLocator` or `decisionRef` product properties.
- [ ] **Step 2: Run the tests.** `npx vitest run --configLoader native tests/factQuery/inflationProductSnapshot.test.ts`. Expect missing product block/new schema failures.
- [ ] **Step 3: Extend the schema and builder.** Load products only inside `buildFactQuerySnapshot`, sanitize and sort by stable ID/measure/period, and include the block in deterministic hash content. Add only the new dataset label to the reviewed localization owner; reviewed product labels already come from the bilingual product catalogue. Author `data/localization/inflation-product-history.json` as a validated `ProductHistoryNote[]` from reviewed identity decisions/methodology; both language fields are nonempty, IDs must belong to the reviewed roster, and no internal decision identifiers are copied. Do not translate history claims by guessing. Add the new dataset's basic country/measure summary and source-dataset mapping in the existing exhaustive metadata tables now, so widening `DatasetId` does not leave the intermediate commit type-invalid. Task 5 completes detailed catalogue/search/calculation behavior. Update hand-built unrelated-test snapshots with an empty product block rather than loosening the snapshot type.
- [ ] **Step 4: Validate source resolution and parity.** Product English originals already exist in `source-documents.csv` and the inflation methodology manifest; prove that both registered IDs resolve to official/archive URLs and original metadata. Preserve legitimate document dataset IDs; `get_sources` filtering will explicitly relate them to the new product query dataset in Task 5. Compare CSV/mirror products with the existing `assertProductParity` path using a safe test mirror, not a production import. Record access-related skips and require actual parity before release.
- [ ] **Step 5: Verify and commit.** Run `npm run data:prepare-fact-query-snapshot`, then `npx vitest run --configLoader native tests/factQuery/inflationProductSnapshot.test.ts tests/factQuery/buildSnapshot.test.ts tests/factQuery/canonical.test.ts tests/explorer/inflationProducts.test.ts`. Expect unchanged existing explorer calculations and deterministic new content. Commit as `feat(mcp): package reviewed product inflation snapshot`.

### Task 4: Implement annual and cumulative product queries with evidence

**Files:** Create `apps/web/lib/factQuery/queryInflationProducts.ts`, `caveats/rules.inflation-products.ts`, `tests/factQuery/queryInflationProducts.test.ts`; modify `schemas.ts`, `observations.ts`, `index.ts`, `localization.ts`, `caveats/index.ts`, bilingual `data/localization/{ka,en}/service-messages.json`, `docs/data-methodology/ai-grounding-and-caveats.md`.

**Interfaces:** Export `queryInflationProductsInput` and `QueryInflationProductsInput`; fields match the product spec exactly. Export `queryInflationProducts(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse`. Export `productQueryCellCount(input: Pick<QueryInflationProductsInput, "seriesIds" | "fromPeriod" | "toPeriod">): number`. Add optional `Observation.calculationBasePeriod?: string` and `Measure.cumulative_pct` without making that measure valid in old query tools.

Extend `inflationProductData.ts` with `productQueryCoverage(snapshot: FactQuerySnapshot, input: QueryInflationProductsInput): { availablePeriods: PeriodRange | null; availableYears: number[] }`; cumulative availability depends on the chosen `startYear` and complete inputs. The aggregate span never promises gap-free data for every product.

- [ ] **Step 1: Add failing synthetic arithmetic tests.** Reuse the explorer test fact pattern: monthly indices 101 and 102, annual indices 150 and 160, first month January 2026. Assert:

```ts
expect(queryInflationProducts(snapshot, { seriesIds: [id], measure: "yoy_pct", fromPeriod: "2026-02", toPeriod: "2026-02" }))
  .toMatchObject({ data: { observations: [{ value: 60, unit: "percent", basis: "published" }] } });
expect(queryInflationProducts(snapshot, { seriesIds: [id], measure: "cumulative_pct", startYear: 2026, fromPeriod: "2026-02", toPeriod: "2026-02" }))
  .toMatchObject({ data: { observations: [{ value: 3.02, calculationBasePeriod: "2025-12" }] } });
```

Compare numbers using source-appropriate tolerance where binary floating output requires it. Assert distinct observation/definition IDs for different first years; a one-month output window still consumes prior January inputs. Test first-year 2015, completed December, incomplete latest year, zero/negative change, later product start, missing inside span, irrelevant missing before span, invalid periods/fields, retired/unknown ID and stale data version.
- [ ] **Step 2: Run and implement.** Run `npx vitest run --configLoader native tests/factQuery/queryInflationProducts.test.ts`; expect missing query/schema failure. Implement using the existing memoized product index and annual/cumulative helpers, not another arithmetic formula. Definitions identify the baseline and derivation, and missing responses name the actual start/first missing month.
- [ ] **Step 3: Register evidence rules and messages.** Register `inflation_product_cumulative_derived` (severe, comparison effect none), `inflation_product_history_limits` (note, comparison effect limits) for selected histories affected by reviewed links, and `inflation_product_label_discrepancy` (note, comparison effect none) for affected p0148 observations. Declare bilingual keys/parameters. Scope rules to selected series/periods; do not warn about every product merely because one has an identity limitation. Annual source is `source.geostat_product_yoy`; cumulative source is `source.geostat_product_mom` with a derivation-specific source view that marks originals as upstream without mutating the snapshot's primary annual/monthly source records.
- [ ] **Step 4: Verify and commit.** Run `npx vitest run --configLoader native tests/factQuery/queryInflationProducts.test.ts tests/factQuery/caveats tests/factQuery/purity.test.ts tests/explorer/inflationProducts.test.ts`, plus `npm run i18n:check`. All must pass. Commit as `feat(mcp): query sourced annual and cumulative product inflation`.

### Task 5: Add product discovery, source filtering, comparison and ranking

**Files:** Modify `apps/web/lib/factQuery/describeCoverage.ts`, `getSources.ts`, `schemas.ts`, `compare.ts`, `rank.ts`, `inflationProductData.ts`; create `tests/factQuery/inflationProductDiscovery.test.ts`, `compareInflationProducts.test.ts`, `rankInflationProducts.test.ts`; update existing source/schema/coverage tests.

**Interfaces:** Extend `CoverageData` product series with optional `coicopCode`, `firstPeriod`, `measures`, and reviewed bilingual history notes, preserving other entries. Existing `describeCoverage/getSources/compare/rank(snapshot, rawInput): FactQueryResponse` signatures stay. Product `compare` target uses dataset `inflation-products` and annual measure only; product `rank` uses dimension series/metric value with annual or cumulative measure. Add `RankEntry.calculationBasePeriod?: string`. Route both calculations through Task 4's query, consuming its missingness, definitions, sources and caveats.

- [ ] **Step 1: Add failing behavioral tests.** Lookup by reviewed English/Georgian product names and stable ID must return the same series with classification, first month and legal measures. Unscoped search must identify its dataset. Synthetic annual rates 5 and 8 must yield percentage-point change 3 with null absolute/percentage change; a missing endpoint must be not comparable. A cumulative compare request must return a useful unsupported-comparison refusal. Rank fixtures include genuine zero, negative, equal values, a missing value and incomplete cumulative history; assert candidate/eligible counts, stable ties, cutoff flag and exclusions.
- [ ] **Step 2: Run the three new test files to record failures.** `npx vitest run --configLoader native tests/factQuery/inflationProductDiscovery.test.ts tests/factQuery/compareInflationProducts.test.ts tests/factQuery/rankInflationProducts.test.ts`.
- [ ] **Step 3: Implement catalogue/source integration.** Derive periods and years from snapshot facts, disclose conditional cumulative coverage, and return the full product catalogue without histories in every entry. Extend new-dataset filtering to the existing registered product-source documents without relabelling the originals. Preserve no-match narrowing behavior. Unknown product suggestions remain bounded, never the whole roster.
- [ ] **Step 4: Extend the existing validators/dispatchers.** Update compare's monthly branch to recognize the new dataset, reject cumulative compare with query guidance, and preserve all existing target rules. Product rank accepts `period`, optional `startYear` only for cumulative, order and bounded limit. Reject entity/region/parent/level filters, change metrics and irrelevant year fields. Preserve existing nonproduct rules, especially national totals and city rankings.
- [ ] **Step 5: Verify and commit.** Repeat only the new files plus existing `describeCoverage.test.ts`, `getSources.test.ts`, `compare.test.ts`, `rank.test.ts`, `schemas.test.ts` under `tests/factQuery`. Assert full catalogue response fits 512 KiB after transport serialization in Task 7. Commit as `feat(mcp): discover compare and rank current products`.

### Task 6: Publish exact product inputs and compact metadata

**Files:** Modify `apps/web/lib/factQuery/publications.ts`, `apps/web/scripts/prepare-fact-query-publications.ts` only where checker assumptions need expansion; create `apps/web/tests/factQuery/inflationProductPublications.test.ts`; update `publications.test.ts`, `bilingualPublications.test.ts`, `agreement.test.ts` as required by inventories.

**Interfaces:** Add `buildInflationProductsCsv(snapshot: FactQuerySnapshot): PublicationArtifact`, `buildInflationProductsJson(snapshot: FactQuerySnapshot, csv: PublicationArtifact): PublicationArtifact`; include both in `buildAllPublications`. CSV columns are exactly `series_id,measure,period,index_100,availability,source_ids`, in stable product/measure/period order. Metadata includes `publicationHeader`, the bilingual product catalogue, factual coverage, supported query measures, published input-index definitions, cumulative derivation, source views and the CSV's row/hash/byte metadata.

- [ ] **Step 1: Add failing publication assertions.** Require both named files; parse CSV and compare every index/availability/source ID to sanitized snapshot inputs with exact decimal value semantics. Missing values must be blank, not zero. Metadata retains both languages, base definition and licensing/source roles. Assert no locators, internal decision fields, or full bilingual observation envelope for each input cell.
- [ ] **Step 2: Run the failing file.** `npx vitest run --configLoader native tests/factQuery/inflationProductPublications.test.ts` must fail for missing files/builders.
- [ ] **Step 3: Extend the current builder/checker.** Add the two artifacts to the manifest and build checks. Do not route their raw input rows through the query-output cell cap, precompute every possible cumulative range, or change existing publications to a new format. The current expected inventory grows to 22 listed files / 23 including the manifest, but code derives its inventory.
- [ ] **Step 4: Verify and commit.** Run the new test and existing publication/agreement tests, then `npm run data:prepare-fact-query-publications` and `npm run data:check-fact-query-publications`. They must report matching row/byte/hash metadata and complete source references. Commit as `feat(data): publish reviewed product indices and metadata`.

### Task 7: Expose the product tool and preserve text/structured parity

**Files:** Modify `apps/web/lib/mcp/tools.ts`, `outputSchema.ts`, `result.ts`, `instructions.ts`, `apps/web/lib/factQuery/schemas.ts`; test `apps/web/tests/mcp/tools.test.ts`, `outputSchema.test.ts`, `result.test.ts`, `protocolCompatibility.test.ts`; update `apps/web/tests/factQuery/fixtures/referenceIntents.ts`, `reference.test.ts`.

**Interfaces:** Add one `TOOLS` entry `query_inflation_products`, input Task 4 schema/run function, output kind observations. Expand output/schema declarations for new catalogue fields and cumulative base fields. Use `productQueryCellCount` before product calculation; continue `boundedToolResult` after complete evidence rendering. No second compare/rank/source tool.

- [ ] **Step 1: Add failing transported-tool assertions.** Modern and legacy clients list the new tool, accept the same schema, return equal application values and valid declared structured output. The text result must state the cumulative base and Fiscal.ge derivation, preserve missingness/sources/caveats, and agree with the structured fields. A 501-cell product output must refuse before calculation; cumulative input span must not be mistaken for output size.
- [ ] **Step 2: Implement registration and output rendering.** Extend tool descriptions and server instructions with legal measures, baseline, exclusions and narrowing guidance. Extend the existing schema map and text columns/definition legend only where product output requires it. Ensure successful catalogue/ranking responses validate all added fields rather than being stripped by Zod. Check the final post-SDK tool-result size in both eras, including modern `resultType` overhead, against 512 KiB; an oversized result is wholly refused with guidance, never silently trimmed.
- [ ] **Step 3: Establish independent reference answers.** Add source-grounded product annual, cumulative, late-start, missing-input, rank and unsupported-compare cases to the fixture and add the tool to its dispatcher. Record canonical source rows/archive evidence and independent Decimal calculation for cumulative expectations. Add city-coverage metadata assertions without changing prior expected numbers. Use synthetic missing input for structural coverage if no real reviewed source gap exists; do not falsely label it a published gap.
- [ ] **Step 4: Verify and commit.** Rebuild snapshot then run `npx vitest run --configLoader native tests/mcp/tools.test.ts tests/mcp/outputSchema.test.ts tests/mcp/result.test.ts tests/mcp/protocolCompatibility.test.ts tests/factQuery/reference.test.ts`. Test complete product discovery and realistic ranking with exclusions through `boundedToolResult`; assert positive measured headroom under 512 KiB. Commit as `feat(mcp): expose product tools with verified response contracts`.

### Task 8: Measure bundled snapshot and realistic query costs

**Files:** Modify `apps/web/scripts/measure-bilingual-mcp.ts` to include representative products where its complete-result measurement fits; add actual results to `docs/superpowers/reviews/2026-10-01-mcp-upgrade-verification.md`. No instrumentation in production request flows.

**Interfaces:** Consume the packaged snapshot, `inflationProductIndex`, query/rank functions and `boundedToolResult`. Record snapshot bytes, cold read/parse/index construction, warm annual/cumulative endpoint batches, all-product rank and full product catalogue serialization, plus final result bytes.

- [ ] **Step 1: Run representative measurements.** Run `npx tsx scripts/measure-bilingual-mcp.ts --output ../../docs/superpowers/reviews/2026-10-01-mcp-response-measurements.json` after extending its scenarios. Use fresh-process Node timings for cold work. Include a complete single-product history, multi-product cumulative endpoints, top 100 rank and a missing-history-heavy rank. Record environment/sample count so timings are assessable, not advertised guarantees.
- [ ] **Step 2: Inspect bundle and failure boundaries.** Confirm the snapshot is traced into the MCP bundle and queries do not import runtime serving loaders. Both languages, sources and caveats count toward the result cap. Requests must finish within the existing ten-second ceiling and respect 512 KiB; oversized requests must return useful narrowing/bulk guidance.
- [ ] **Step 3: Resolve measured regressions narrowly.** Fix only demonstrated repeated scans, duplicate text or bundle problems; do not raise limits or trim evidence. If honest product catalogue/query results cannot fit, report the design boundary before changing the public contract. Rerun only affected measurements/tests and save the verified evidence.
- [ ] **Step 4: Commit.** `test(mcp): measure product snapshot and response budgets`.

### Task 9: Update bilingual discovery, application guidance and canonical documentation

**Files:** Modify `apps/web/lib/pages/connect.tsx`, `lib/i18n/messages/ka/connect.json`, `lib/i18n/messages/en/connect.json`, `public/llms.txt`, `docs/deployment.md`, `Project_Definition.md`, `docs/data-methodology/inflation-products.md`, `docs/data-methodology/ai-grounding-and-caveats.md`; test `apps/web/tests/browser/connect.spec.ts`, `tests/seo/connect.test.tsx`, `tests/mcp/coverageLanguages.test.ts`, `tests/methodology/inflationProductsContent.test.ts` and affected localization tests.

**Interfaces:** Preserve `renderConnectPage(locale)` and the current connection-page coverage helper. Add snapshot-derived product coverage/example parameters; dynamic examples use actual valid periods. Retain the existing layout/copy controls and URLs.

- [ ] **Step 1: Verify named applications and record evidence.** Check current official instructions and available actual Codex/Claude connection flows, recording version, plan/account eligibility, date, protocol and a sourced answer. Do not ask the user to share credentials. A blocked human-login step is explicitly unverified; keep generic client capability wording and avoid claiming tested menus. Add direct ChatGPT setup only if its own flow is verified; otherwise retain the existing web-reading fallback. Use the openai-docs skill for Codex/OpenAI product guidance when executing this step.
- [ ] **Step 2: Add focused content/browser checks.** Assert both locales include national/city/product examples, explain cumulative December baseline, and match available capability/period data. Check copy controls, links, keyboard access, 390px width and no console errors. Preserve access to existing budget/economy examples.
- [ ] **Step 3: Update only the relevant text and owners.** Explain annual-rate comparison as percentage points; distinguish product inputs/derived cumulative results and published indices. Replace stale schema/count statements in the runbook with current schema and manifest-derived inventory references. Describe both protocols separately from data schema 1.5.0. Amend §2C only for this product extension; keep earlier specs as historical approvals. No health polling/status UI or deployment automation.
- [ ] **Step 4: Verify and commit.** Run `npm run i18n:check` and the focused content/unit tests. Defer the full browser/build gate to Task 10 rather than building repeatedly. Commit as `docs(mcp): document supported clients and product inflation access`.

### Task 10: Run the completion gate and review the whole change

**Files:** No new feature scope. Update the verification document with actual command output summaries, review outcomes and unverified boundaries; repair only demonstrated defects in earlier task files.

**Interfaces:** Integrated schema 1.5.0, one dual-era endpoint, 14 tools and 11 dataset families at this planned baseline, two additional manifest files and unchanged product-explorer arithmetic.

- [ ] **Step 1: Inspect the integrated diff.** Check every changed line against a spec requirement, source/privacy rules, registered caveats, exact dependency versions and compatibility contracts. Remove only imports/files made unnecessary by this work. Recheck `git status` and preserve unrelated edits.
- [ ] **Step 2: Run one full local gate.** From `apps/web`, set `$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'`, then `npm run check` and `npm run build`. The check must pass lint, types, tests, data validation and localization. Build must pass all postbuild publication checks. Verify `tests/factQuery/reference.test.ts` was included and passed; run it separately only if it was not. Record actual counts, not guessed totals.
- [ ] **Step 3: Run the browser gate against the built artifact.** Start `npm run start -- --port 3100` in a managed process, set `$env:CI='1'`, `$env:PLAYWRIGHT_BASE_URL='http://localhost:3100'` and run `npx playwright test`. This runs the full required browser gate once, covering connection content and existing product pages. Use the applicable browser skill for the visual gut-check when the server starts. Stop the managed server after verification; never rebuild the artifact while it is serving.
- [ ] **Step 4: Review independently using the selected execution method.** Focus on same-source calculation parity, modern/legacy error and security paths, missingness, bounds, output schema/text equivalence, source attribution and static/runtime separation. Fix actionable findings and rerun affected checks; never repeat a passing full gate whose inputs did not change.
- [ ] **Step 5: Save the complete local result.** The report distinguishes automated protocol proof, human-application proof, safe-mirror parity and any remaining unverified access boundary. Commit final evidence/repairs. Completion of this task proves local readiness, not publication.

### Task 11: Authorized delivery and separate production proof

**Condition:** Execute only when publishing/merging is explicitly authorized. This task is a release checklist, not authorization from the current planning request.

**Files/owners:** Existing GitHub/Actions/Vercel delivery procedure in `docs/deployment.md`; verification evidence document. No deployment-workflow feature changes.

- [ ] **Step 1: Recheck Git/worktree/delivery state.** If main advanced, integrate it safely, inspect changes and rerun only affected verification. Push the `codex/*` branch, create/attach a draft PR, wait for required CI/review and resolve conversations. Do not push implementation commits directly to main or bypass checks.
- [ ] **Step 2: Merge only after required checks/review pass.** Use the existing Actions-owned release. Verify the actual Vercel deployment is READY, aliases point to it and its commit matches the merge. A successful deploy hook alone is insufficient.
- [ ] **Step 3: Verify both live protocol flows.** Run legacy initialization and modern discovery/direct calls; list tools; check corrected Batumi/Zugdidi/mixed coverage; product bilingual lookup, annual/cumulative values, annual comparison, both ranking modes and sources. Exercise stale-version, unknown product, missing input, unsupported cumulative compare and oversized-result refusal without exhausting public quotas.
- [ ] **Step 4: Verify publication/UI agreement.** Check live manifest release/data identity against MCP, all listed file hashes/bytes/rows including products, both connection URLs/copy controls, relevant product routes and the runtime-error window from the runbook. Check accounts/clients only where the actual flow is available; report any unverified client explicitly.
- [ ] **Step 5: Finalize within authorized scope.** Record production evidence, synchronize approved local checkouts while preserving other work, and delete only this task's release branch after successful delivery. Do not archive/remove a user-owned worktree or discard unrelated files.

## Completion and Handoff

The requested planning deliverable is this unified document; unchecked tasks describe future execution, not completed implementation. The four specifications remain its authoritative scope, and the method/order above keeps each part testable without creating four competing plans.

Recommended execution: native implementation in this chat, sequentially, with an independent whole-branch review at Task 10. The tasks share query types, snapshot identity and output schemas, so one implementer minimizes interface coordination; the transport and data risks still warrant independent review before any release. Alternatively, use a fresh implementing/reviewing agent for each task if the user chooses that method.

Before execution, the user reviews this plan and selects the method. Delivery remains a later explicit authorization, followed by Task 11's production proof.

Primary SDK references checked for this plan: [official protocol versions](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md), [HTTP serving](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md), [legacy clients](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/legacy-clients.md). The exact stable package version was rechecked against the npm registry on 2026-10-01; its stateless legacy and JSON handler options were checked against current official documentation.
