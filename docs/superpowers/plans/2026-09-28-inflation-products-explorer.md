# Inflation Products Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a bilingual explorer for the latest Geostat basket's individual-product annual inflation, with an optional compounded change over selected years, complete ranked product list, small illustrations and Excel download.

**Architecture:** The reviewed product CSVs remain the source of truth. A validated build-time loader mirrors them transactionally to Postgres and projects compact numeric series to a static page; one pure product model supplies the chart, indicators, table and workbook. The page composes existing editorial explorer controls and treats product art as decorative, ID-addressed assets.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase Postgres, Decimal.js, ExcelJS, Vitest, Playwright, Lucide and the existing Fiscal.ge components.

**Spec:** `docs/superpowers/specs/2026-09-27-inflation-products-explorer-design.md`. Read it with this plan; the approved layout and data rules live there.

**Later user refinement (2026-09-29):** The lower table has its own bilingual search, a “Browse products” heading, no dividing rule above it, and no visible `shown / total` counter. This supersedes the original Task 7 counter instruction; the updated spec and `DESIGN.md` own the final layout.

**Later user refinement (2026-09-30):** The lower table puts selected-years cumulative change before latest annual change and ranks by cumulative change, highest first, with incomplete histories last. The right-side selector retains its latest-annual order. This supersedes Task 7's lower-list sort and column order; the updated spec owns the final behavior.

## Global Constraints

- Use the current-basket catalogue and fact CSVs already in `data/imports/`. The August 2026 regression fixture has **305 products**, **84,056 facts** and **176 explicit unavailable cells**; runtime counts and latest month come from loaded data.
- Public history starts in **2015-01** or at a later reviewed first period. Never infer identity from a name, row number, matching index or illustration. Keep p0179 and p0269 split; preserve p0148's official labels and disclose their inconsistency.
- Annual percent is the published year-on-year index minus 100. Cumulative percent compounds every published previous-month index from January of the selected first year to the selected endpoint, against the preceding December. Missing or shorter histories yield `—`; display rounding happens last.
- The default chart is annual, its only measure control is an icon-only cumulative toggle, and the initial year range is the latest **four calendar years**. Latest annual ranking stays tied to the latest published month when the selected years change.
- The chart uses unlimited product selection. The last selected product drives the first two indicators; an explicit empty selection stays empty. Right-panel search changes neither the selection count nor the lower list.
- Inflation signs are descriptive, not good/bad colours. Values, swatches and labels must remain understandable without relying on colour alone.
- The complete lower list contains every current product. Each has a small, distinct reviewed illustration keyed by product ID. No emoji, initials, generic fallback circles, product cards, month-on-month view or new chart library.
- Preserve static prerendering, CSV fallback and one transactional, exact-parity mirror import. Do not add a browser Supabase fetch, product API, MCP tool or static JSON/CSV publication.
- Run commands from `apps/web`. Read `apps/web/AGENTS.md` and the installed Next.js 16 docs before code; check current Supabase guidance before schema work. Use targeted tests while editing and the `CLAUDE.md` done-check once after the final change. Do not run the import against production or publish without separate delivery authorization.

## Delivery Sequence

1. Close the remaining arithmetic audit and add a parity-checked serving copy of the reviewed CSVs.
2. Build one tested calculation and state model, then prove the full-size Excel export works.
3. Review a small illustration pilot, complete the icon set and assemble the existing chart/selector layout, indicators and list.
4. Add navigation and explanations, then verify both languages, mobile layout and the full repository gates.

## Review Focus

These are the five easily missed conditions the owning tasks must test:

1. A current product without a published annual cell in the latest month ranks after published values but remains visible, with `—`, in both lists and the workbook (Tasks 2–4, 7).
2. One missing monthly index in the chosen span makes the full-range cumulative figure unavailable; the chart, table, indicators and workbook must agree (Tasks 3–4, 7).
3. A product first observed after the chosen start year keeps any valid annual line but cannot claim a shorter cumulative history as the full range (Tasks 3–4, 6–7).
4. A hash with an unknown ID or out-of-coverage years is repaired safely; an explicit empty `sel=` does not restore the default (Tasks 3, 6).
5. Selecting every current product still produces a complete workbook and a usable chart; source links and the two displayed rates survive that scale (Tasks 4, 9).

## File Map

| Responsibility | Files |
| --- | --- |
| Existing source and audit guard | `apps/web/lib/data/inflation/{prepareProducts,validateProducts}.ts`; `apps/web/tests/data/inflation/prepareProducts.test.ts`; `data/reports/inflation-products-validation.json`; `docs/data-methodology/inflation-products.md` |
| CSV serving and mirror | New `apps/web/lib/data/inflation/importProducts.ts`; `apps/web/prisma/schema.prisma` and `apps/web/prisma/migrations/20260928000000_inflation_products/migration.sql`; `apps/web/lib/db/{mirrorRows,servedDataDb}.ts`; `apps/web/scripts/import-budget-facts.ts` |
| Pure view model and state | New `apps/web/lib/explorer/inflationProducts.ts` and `inflationProductState.ts`; tests in `apps/web/tests/explorer/` |
| Product art | `apps/web/public/inflation-products/p0001.webp` through the current catalogue's final ID; new `apps/web/components/inflation/inflation-product-art.tsx` and asset coverage/contact-sheet checks |
| Page and controls | New `apps/web/components/inflation/inflation-products.tsx`, `inflation-product-panel.tsx`, `inflation-product-indicators.tsx`, `inflation-product-table.tsx`; optional art slot in `components/main-explorer/series-selector.tsx`; `lib/pages/inflation.tsx` and both product route files |
| Excel | New `apps/web/lib/explorer/inflationProductWorkbook.ts`; reuse `workbookModel.ts`, `workbookWriter.client.ts` and the existing four archived product source editions |
| Discovery and explanation | `lib/explorer/inflationHubCards.ts`, `components/shell/data-sidebar.tsx`, `lib/i18n/messages/{ka,en}/inflation.json`, `lib/i18n/messages/{ka,en}/common.json`, `lib/i18n/inventory.server.ts`, `lib/seo/sitemap.ts`, `lib/methodology/content/{inflation.ts,en/inflation.ts}`, `Project_Definition.md`, `DESIGN.md` |

---

### Task 1: Close the product-data release audit

**Files:** Modify `apps/web/lib/data/inflation/validateProducts.ts`, `prepareProducts.ts`, `apps/web/tests/data/inflation/prepareProducts.test.ts`, `data/reports/inflation-products-validation.json` and `docs/data-methodology/inflation-products.md`. Keep both canonical product CSVs and `decisions.csv` unchanged.

**Interfaces:** Extend `validateProductIndices(facts: ProductFactRow[], priorYearMonthly?: ReadonlyMap<string, string>): ProductValidationReport`. The map's keys are `productId:YYYY-MM` for identity-verified 2014 previous-month indices from `buildProductIdentityAudit(...).assignments`; they are validation input only, never public facts.

- [ ] **Step 1: Write failing audit tests** named “checks 2015 annual cells against verified 2014 monthly indices” and “keeps conservative identities.” Key assertions: `expect(report.arithmeticChecked).toBe(41_830)`, `expect(report.arithmeticUncomparable).toBe(22)` and `expect(() => validateProductIndices(facts, tampered2014)).toThrow(/annual index/)`. Assert p0179/p0269 first periods and p0148's two labels remain unchanged.
- [ ] **Step 2: Run `npx vitest run tests/data/inflation/prepareProducts.test.ts`.** Expected: the new 2014 coverage assertion fails.
- [ ] **Step 3: Build the 2014 map from verified, assigned source rows and pass it to the existing Decimal arithmetic guard.** Keep the 0.002 index-point tolerance and revision guard. Document why the p0179/p0269 statistical continuity evidence does not justify merging their distinct descriptions, and disclose p0148's Geostat label conflict.
- [ ] **Step 4: Run `npm run data:prepare-inflation-products` to regenerate the validation report, then rerun the targeted test, `npm run data:check-inflation-products` and `npx tsx scripts/audit-inflation-products.ts --check`.** Expected: all pass, the two canonical CSVs have no diff, and the report names the 3,157 added checks.
- [ ] **Step 5: Commit the audit guard, report, tests and methodology note.**

### Task 2: Serve the reviewed catalogue and facts with exact mirror parity

**Files:** Create `apps/web/lib/data/inflation/importProducts.ts`, `apps/web/tests/data/inflation/importProducts.test.ts` and the Prisma migration. Modify `apps/web/prisma/schema.prisma`, `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts` and `apps/web/scripts/import-budget-facts.ts`.

**Interfaces:** `loadProductCatalogueCsv(file?: string): Promise<ProductCatalogueRow[]>`; `loadProductFactsCsv(file?: string): Promise<ProductFactRow[]>`; `assertProductParity(csv: ServedProductData, db: ServedProductData): void`; `loadServedProductData(): Promise<ServedProductData>`, where `ServedProductData = { catalogue: ProductCatalogueRow[]; facts: ProductFactRow[] }` retains source-precision index strings. Mirror readers are `loadProductCatalogueFromMirror(db: MirrorClient)` and `loadProductFactsFromMirror(db: MirrorClient)` with the same row types.

- [ ] **Step 1: Write failing loader/parity tests** named “serves the reviewed current roster” and “rejects any changed mirror field.” Key assertions: `expect(data.catalogue).toHaveLength(305)`, `expect(data.facts).toHaveLength(84_056)` and `expect(() => assertProductParity(data, altered)).toThrow(/differs/)`. Test the 176 unavailable cells, registered sources, first periods, each changed index/availability/locator/review date/label, and a current product missing its latest annual cell.
- [ ] **Step 2: Run `npx vitest run tests/data/inflation/importProducts.test.ts`.** Expected: the new serving interface is absent.
- [ ] **Step 3: Add the validated, memoized CSV loader and two Prisma models.** Catalogue fields mirror ID, COICOP, both labels, first period and decision reference. Fact key is product ID + measure + month, with nullable precise index, availability, source locator, reviewed date, source document and import run. Choose a decimal column scale that fits every source digit and reject future inputs beyond it rather than silently truncating them. Compare normalized decimal values so trailing-zero formatting does not create false mismatches. Add RLS and revoke public-role table access, following the existing inflation migration.
- [ ] **Step 4: Extend the one existing import transaction.** Delete child facts before catalogue rows, insert facts in bounded batches inside that transaction, read both tables back and run `assertProductParity` before commit; include their counts in the parity report. The existing transaction timeout is 120 seconds: measure the 84,056-row import in a safe mirror and increase that timeout only if the measured run requires it, preserving one rollback boundary. DB-mode build loading compares its rows with CSV on every build. Do not broaden `loadServedInflationData` or load all product histories for the hub client.
- [ ] **Step 5: Run the targeted test, `npx prisma validate --schema prisma/schema.prisma` and `npm run typecheck`.** Expected: green. If a safe nonproduction mirror is configured, apply the migration there, verify the tables' public-role revocation/RLS and rollback on a deliberate parity mismatch, then run the full `npm run data:import` and a targeted DB-loader parity test. Otherwise retain those as explicit release gates. Commit the loader, migration and importer.

### Task 3: Build one pure model for ranking, compounding and URL state

**Files:** Create `apps/web/lib/explorer/inflationProducts.ts`, `inflationProductState.ts`, `apps/web/tests/explorer/inflationProducts.test.ts` and `inflationProductState.test.ts`.

**Interfaces:** `ClientProduct = Pick<ProductCatalogueRow, "productId" | "labelEn" | "labelKa" | "firstPeriod">`; `PackedProductSeries = { k: string; s: string; q: number; v: Array<number | null> }`, where `q` preserves every source decimal place; `packProductFacts(facts: ProductFactRow[]): PackedProductSeries[]`; `buildProductIndex(products: ClientProduct[], series: PackedProductSeries[]): ProductIndex`; `productAnnual(index, id, period): number | null`; `productCumulative(index, id, startYear, endPeriod): { value: number | null; reason: "late_start" | "missing_month" | null; missingPeriod: number | null }`; `rankProducts(index): string[]`. State exports `ProductState = { indicator: "annual" | "cumulative"; range: { startYear: number; endYear: number }; selected: string[] }`, `parseProductHash(hash, index)`, `serializeProductHash(state)` and `toggleProduct(state, id)`.

- [ ] **Step 1: Write failing pure tests** named “packs source precision,” “compounds monthly indices only,” and “ranks the latest published month.” Key assertions: `expect(unpackedIndex).toBe(101.6031)`, `expect(productAnnual(index, "cpi.product.p0058", latest)).toBeCloseTo(57.5291)` and `expect(productCumulative(twoMonthIndex, id, 2026, feb).value).toBeCloseTo(3.02)`. Exercise unavailable cells, one-year and partial-year endpoints, 2015, a past December, start-year rebasing, missing interior month, late start, unrounded ranks, ID ties and missing-latest last. An incomplete selected span has no cumulative chart line. The current-data default range is 2023–2026, computed from loaded years.
- [ ] **Step 2: Run both targeted Vitest files.** Expected: missing functions fail.
- [ ] **Step 3: Implement packed numeric runs and the pure model.** One product/measure run has a start month, source-derived safe-integer scale and nullable values; reject source precision that cannot fit that representation. Client payload omits provenance and repeats each bilingual label once. Build per-product Decimal.js cumulative prefixes and missing-period flags once, then derive any selected endpoint from those prefixes; do not re-multiply the whole span for every chart point or table row. Convert to a display number only at the end and benchmark construction with the real dataset. Every valid cumulative line uses the same selected December baseline; if the full selected span is incomplete, omit that product's cumulative line and explain the missing or later first month. Derive latest month and latest-four-year default from facts.
- [ ] **Step 4: Implement state parsing and test `i=annual|cumulative&r=YYYY-YYYY&sel=<ordered IDs>`.** Unknown IDs are dropped, years clamped, last selected becomes focus, and `sel=` stays empty. Panel search and lower-list expansion are not encoded.
- [ ] **Step 5: Run both targeted tests and `npm run typecheck`; commit the model and state.**

### Task 4: Prove the three-sheet Excel export at full scale

**Files:** Create `apps/web/lib/explorer/inflationProductWorkbook.ts` and `apps/web/tests/explorer/inflationProductWorkbook.test.ts`; add the needed export labels to both `apps/web/lib/i18n/messages/{ka,en}/inflation.json` files. Touch `apps/web/lib/explorer/workbookWriter.client.ts` only if the real all-selected stress test proves its existing writer insufficient.

**Interfaces:** `buildInflationProductWorkbookExportModel({ index, state, presentation, sources, siteOrigin }): WorkbookExportModel`. Reuse `SHEET_NAMES`, `monthlyWorkbookSources`, `pickLocaleEditions` and the Task 3 annual/cumulative functions; Task 6 connects the completed builder to `downloadWorkbook`.

- [ ] **Step 1: Write failing tests** named “exports the full current summary with empty selection” and “uses the same rates as the page.” Key assertions: `expect(model.readable.rows).toHaveLength(index.products.length)`, `expect(model.analysis.rows).toHaveLength(0)` for empty selection, `expect(summaryAnnual).toBeCloseTo(productAnnual(index, id, latest)! / 100)` and `expect(missingMonthSummaryCumulative).toBeNull()`. Data rows carry selected month, measure, index/percent, unit and published/derived status; Sources links validated YoY/monthly editions in the reader's language. A past range still cites the latest annual month's source.
- [ ] **Step 2: Run `npx vitest run tests/explorer/inflationProductWorkbook.test.ts`.** Expected: builder missing.
- [ ] **Step 3: Build the three-sheet model from the shared product index.** The current Summary writer uses numeric column slots even for named measures: use slots `1` and `2` with `headerLabels.columns` for latest annual and selected-range cumulative, disable its change column, and pass actual calendar years separately as `sourceYears`. Write percentage values as Excel fractions (for example `57.5%` as `0.575`), with a sign-neutral number format; test the generated cells so they do not display `5750%`. Label the cumulative column as Fiscal.ge-derived in the Summary subtitle and Data status; never mark it “published.” For a missing rate, append the specific later first period or missing month to that row's Summary label. No invented values or internal locators enter the sheets.
- [ ] **Step 4: Run the builder test and an ExcelJS buffer test with every current product selected.** Expected: all rows, three sheets and validated archive links present, no truncation, and workbook values match the model at one decimal. Record elapsed time and memory observed. If the in-memory writer cannot finish at this scale, make the smallest writer change that does and test it before illustration production. Commit.

### Task 5: Produce and audit the complete illustration set

**Files:** Create one optimized transparent `apps/web/public/inflation-products/<short-product-id>.webp` per current catalogue ID, `apps/web/components/inflation/inflation-product-art.tsx`, `apps/web/tests/explorer/inflationProductArt.test.ts` and a labelled contact-sheet artifact under `docs/superpowers/reviews/`.

**Interfaces:** `productArtPath(productId: string): string` resolves `cpi.product.p0058` to `/inflation-products/p0058.webp`. `InflationProductArt` renders the 28–36 px cutout with empty alt text beside its official text label; lower-list instances lazy-load.

- [ ] **Step 1: Write a failing test** named “covers every current product with one transparent icon.” Key assertion: `expect(assetIds).toEqual(catalogueIds)` after sorting. Reject missing, extra, identical-file duplicates, opaque-background and unreadable files; enforce a maximum final size of 128×128 px and 40 KB per icon. Assert no fallback emoji or initials are rendered.
- [ ] **Step 2: Run `npx vitest run tests/explorer/inflationProductArt.test.ts`.** Expected: the complete production set is absent.
- [ ] **Step 3: Produce a nine-product pilot across food, household goods and services.** Render its labelled contact sheet at the actual 32 px size on paper and inspect likeness, legibility and transparency before committing to the whole set. Keep ambiguous labels, especially p0148, conservatively depicted.
- [ ] **Step 4: Complete the remaining art in COICOP-group batches using the approved style reference.** Avoid the reference's dark ground, glows and grid; optimize each image, save by stable ID and update a contact sheet labelled with ID and both official names after every batch. Correct wrong or visually repeated mappings; use the existing Next.js image component for display.
- [ ] **Step 5: Run the coverage test.** Expected: every current product has exactly one valid asset and the pilot style holds across all groups. Commit the assets, component, contact sheet and test.

### Task 6: Add the annual chart, cumulative toggle and product selector

**Files:** Create `apps/web/components/inflation/inflation-products.tsx`, `inflation-product-panel.tsx`, `apps/web/app/(ka)/explorer/inflation/products/page.tsx` and `apps/web/app/(en)/en/explorer/inflation/products/page.tsx`. Modify `apps/web/lib/pages/inflation.tsx`, `apps/web/components/main-explorer/series-selector.tsx` and the two inflation message files. Create `apps/web/tests/explorer/inflationProductsRender.test.tsx`.

**Interfaces:** `renderInflationProducts(locale: Locale)` and `inflationProductsMetadata(locale: Locale)` follow the overview/categories route wrappers. `InflationProducts` accepts packed facts, projected catalogue, review date, four existing product workbook-source editions and site origin; `InflationProductPanel` receives the ranked IDs, state and toggle/clear callbacks. Add one optional decorative-art slot to `SeriesSelectorRow` without changing existing callers.

- [ ] **Step 1: Write failing tests** named “lands on annual with the latest leader” and “searches bilingual products without changing selection scope.” Key assertions: `expect(toggle).toHaveAttribute("aria-pressed", "false")`, `expect(selectedIds).toEqual(["cpi.product.p0058"])` and `expect(selectorTotal).toBe(305)` after searching. Search normalizes case and whitespace in both official names, and filtered rows retain latest-annual descending order. There is no annual button, monthly tab, chart/table switch or Select all action. The single rising-path Lucide button has a localized action/tooltip but no visible “Cumulative” word on the button; Clear shows the no-selection callout.
- [ ] **Step 2: Run `npx vitest run tests/explorer/inflationProductsRender.test.tsx`.** Expected: no product route/component yet.
- [ ] **Step 3: Compose the existing `ExplorerPage`, `ExplorerWorkspace`, `EditorialLineChart`, `RangeStrip`, `SeriesAside` and `SeriesSelector`.** Place the year strip under the chart, monthly observations on year-labelled axes, exact month in tooltips, source note and methodology link after the strip. Missing annual values break their line instead of becoming zero; add a concise screen-reader chart summary. Use `TrendingUp` and `ControlTooltip` for the single 36×36 toggle; update the chart title and unit, and keep keyboard/pressed semantics. Assign stable product colours from the existing editorial palette and pair chart lines with labelled selector swatches. Wire the Task 4 Excel builder to one `ExcelDownloadButton` at the selector foot, including for empty selection. Reuse `useReplaceHash` after hydration.
- [ ] **Step 4: Pass only packed display data over the static server/client boundary.** Add both routes and localized metadata; avoid a runtime data request. Run the targeted render test and `npm run typecheck`. Expected: both routes render the same state model. Commit the page skeleton and chart/selector.

### Task 7: Add four indicators and the complete ranked list

**Files:** Create `apps/web/components/inflation/inflation-product-indicators.tsx`, `inflation-product-table.tsx` and tests `apps/web/tests/explorer/inflationProductIndicators.test.tsx` and `inflationProductTable.test.tsx`. Modify `inflation-products.tsx` and both inflation message files.

**Interfaces:** Both components consume the Task 3 `ProductIndex`, `ProductState` and its range result; the table also receives `onToggle(productId)`. All displayed annual/cumulative figures call `productAnnual` or `productCumulative`.

- [ ] **Step 1: Write failing tests** named “focus follows last selected product” and “cohort extremes ignore selection.” Key assertions: `expect(heroProductId).toBe(state.selected.at(-1))` and `expect(sideKpis).toHaveLength(3)`. The hero uses the cohort min–max scale, including a centred marker when all rates coincide; highest/lowest exclude unpublished latest rates. The cumulative side sparkline follows the selected full-range path only when complete, while the two cohort sparklines follow each winner's annual history. Removing focus restores the prior product; clearing shows `—`. An all-positive minimum says “lowest change.”
- [ ] **Step 2: Write failing list tests** named “reveals every current product” and “keeps latest annual values anchored.” Key assertions: `expect(initialRows).toHaveLength(40)` and, after repeated “More products” clicks, `expect(finalRows).toHaveLength(index.products.length)`. The shown count reaches total; right-panel search does not filter this list. Order and annual values stay tied to the newest month when mode/range changes, and headings name that month and selected endpoint. Each row has official bilingual labels, decorative art, both rates and late/missing explanations; selected rows use the existing tint and their button toggles the chart line.
- [ ] **Step 3: Run both targeted tests.** Expected: components are absent.
- [ ] **Step 4: Implement with `HeroKpi`, `SideKpiList`, `Sparkline` and a semantic table in `ExplorerTable`'s rule/type anatomy.** Add the “More products” button and `shown / total` count; reuse `HorizontalScrollHint` on phones, preserve both numeric columns and avoid page overflow. Run both tests and `npm run typecheck`; commit.

### Task 8: Make the page discoverable and explain its source meaning

**Files:** Modify `apps/web/lib/explorer/inflationHubCards.ts`, `apps/web/components/shell/data-sidebar.tsx`, `apps/web/lib/i18n/inventory.server.ts`, `apps/web/lib/seo/sitemap.ts`, both `inflation.json` and `common.json` files, both `lib/methodology/content/.../inflation.ts` files, `docs/data-methodology/inflation-products.md`, `Project_Definition.md` and `DESIGN.md`. Add targeted hub/navigation/SEO/methodology tests.

**Interfaces:** The hub card builder consumes a compact latest-product summary (one ranked leader, its annual series, latest month and rate), never a client prop containing all product facts. The product page adds localized BreadcrumbList and a product-specific Dataset JSON-LD node without claiming a nonexistent static CSV download; the existing inflation vocabulary helper excludes inflation and must not be reused with an inaccurate dataset ID.

- [ ] **Step 1: Write failing tests** named “shows Products as the third live inflation card” and “indexes both product routes.” Key assertions: `expect(cards.map((card) => card.href)).toEqual(["/explorer/inflation/overview", "/explorer/inflation/categories", "/explorer/inflation/products", null])` and `expect(sitemapUrls).toContain(productUrl)`. Sidebar's third child is localized; metadata has canonical/hreflang and truthful Dataset JSON-LD.
- [ ] **Step 2: Write failing tests** named “explains product rates and source identity in both languages.” Assert both public methodology versions mention the published annual rate, Fiscal.ge-derived cumulative rate, December baseline, late/missing rule, current-basket scope, no GEL prices/weights/contributions, p0179/p0269 conservative splits and p0148's label mismatch. The old claim that “nothing else is computed” must disappear.
- [ ] **Step 3: Run the targeted tests.** Expected: the product card is still coming soon and product explanation/route inventory is absent.
- [ ] **Step 4: Update hub, sidebar, localization, public methodology, sitemap and the two canonical scope/design documents.** Reuse the four already registered and publicly archived product source files; do not add duplicate source records. Run targeted tests, `npm run i18n:check` and `npm run typecheck`; commit.

### Task 9: Verify the shipped behavior and review the branch

**Files:** Create `apps/web/tests/browser/inflation-products.spec.ts`; change only files needed to fix failures found here.

- [ ] **Step 1: Write a browser test for Georgian and English routes.** Check annual default, icon-only toggle and tooltip, search and multi-select, latest-annual order, focused indicators, one-year/manual/quick range changes, late-entry `—`, URL/language restoration, 305-row reachability and a valid workbook download. Include a deliberately empty selection and an all-selected hash.
- [ ] **Step 2: Run the single browser spec against a built/served page; fix observed failures and rerun that spec.** Set `NEXT_PUBLIC_SITE_URL` and `PLAYWRIGHT_BASE_URL` as `CLAUDE.md` describes. Inspect desktop and narrow-screen layouts in both languages against the existing inflation pages: product art stays icon-sized, columns remain readable, focus states work, and no page-level horizontal overflow occurs.
- [ ] **Step 3: Measure the built route's compressed client data and first chart/search/toggle interaction.** Record the figures in the final report; reduce payload or repeated client work if measurements show a material regression against the existing categories page.
- [ ] **Step 4: Run the repository done-check once after changes stop: `npm run check`, `npm run build` in CSV mode, and `npm run test:browser` from `apps/web`.** If a safe nonproduction DB mirror is configured, reuse Task 2's verified import when its inputs have not changed; otherwise reimport. Set `GEODATA_DATA_SOURCE` to `db` in PowerShell, then run `npm run build` and confirm exact parity. If no safe mirror is configured, report the DB-mode verification boundary and do not claim public-release readiness.
- [ ] **Step 5: Review the branch against the spec and audit, including every illustration/contact-sheet entry.** Fix actionable findings, run only affected targeted checks, commit the fixes and report the verified commit, route status and remaining delivery boundary. GitHub publication follows only when authorized.
