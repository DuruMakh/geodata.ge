# MCP: reviewed individual-product inflation

Date: 2026-10-01
Status: draft for user review. The user requested this expansion and its specification; the proposed public contract still needs written-spec review before implementation planning.
Baseline: fetched main `1c2a0acd07f0fa522bf4f6aab33924b319cc2112`.

## 1. Outcome and scope

An outside AI assistant can find a current consumer-basket product by its Georgian or English name, obtain published annual price changes or Fiscal.ge-calculated cumulative changes, compare annual rates between months, rank current products, and cite the reviewed original sources. The values agree with the product explorer and its workbook.

Serve only products in the latest reviewed Geostat basket, preserving stable `cpi.product.pNNNN` IDs and reviewed histories. At this baseline the roster has 305 products, history begins in 2015 or a later verified start, and the latest month is August 2026. These are observations; bounds, defaults and counts come from facts.

Included: snapshot integration, `query_inflation_products`, catalogue search, sources, annual-rate comparisons, annual/cumulative value rankings, bilingual definitions/caveats, compact bulk publications, discovery documentation and regression/reference evidence.

Excluded: retail prices in GEL, individual-product weights, contributions to headline inflation, city-level products, retired-product queries, guessed name links, interpolation, a price calculator, new UI routes, monthly-change display, rebased product-index series and any noninflation dataset expansion.

The earlier [product-explorer spec](2026-09-27-inflation-products-explorer-design.md) explicitly excluded MCP/publication expansion. This is a new, bounded extension. On implementation, amend `Project_Definition.md` §2C to authorize exactly this contract and update `docs/data-methodology/inflation-products.md`; do not rewrite the earlier approval as though it already authorized the connection.

## 2. Chosen architecture

Considered extending `query_inflation` with a product level versus introducing a product-specific tool. Choose one additional tool, `query_inflation_products`, under dataset `inflation-products`, with budget scope `consumer_prices` and entity `country.georgia` (`country`). It keeps national/category/city measure rules intact and makes product calculation requirements explicit.

Products are series, not geographic entities. `seriesId` is the existing product ID; `level` is `product`, `parentSeriesId` is null. Catalogue product entries add their reviewed `coicopCode` as classification metadata rather than making a category in another dataset an implicit parent. No second ID mapping is introduced.

Build from the existing `loadServedProductData()` loader in `lib/data/inflation/importProducts.ts` and its parity-checked reviewed catalogue/facts. Preparation and the product mirror remain unchanged. Runtime queries never access the database or source workbooks.

Reuse the pure `packProductFacts`, `buildProductIndex`, `productAnnual` and `productCumulative` calculations in `lib/explorer/inflationProducts.ts`. If server import would pull presentation-only code into the bundle, extract only the shared pure calculation portion and preserve existing callers/tests; no wider explorer refactor. Memoize indexes by snapshot using the existing pattern. Preserve decimal/source precision and compare before display rounding.

Use the existing query envelopes, observation identities, errors, output schemas, source resolution and limits. The new dataset, tool, cumulative measure and optional calculation fields advance Fiscal.ge's public data schema from 1.4.0 to 1.5.0. The transport version is independent.

## 3. Query contract

`query_inflation_products` accepts:

| Field | Rule |
| --- | --- |
| `seriesIds` | Required nonempty unique product-ID list; existing 200-series input cap. |
| `measure` | `yoy_pct` or `cumulative_pct`. |
| `fromPeriod`, `toPeriod` | Required inclusive YYYY-MM output window, with from <= to. Bounds are checked against the reviewed product dataset. |
| `startYear` | Required only for cumulative queries; first calendar year of compounding. Must be <= the year of `fromPeriod` and within reviewed product history. Rejected for annual queries. |
| `expectedDataVersion` | Existing optional snapshot-consistency guard. |

Entity is implicitly Georgia; no `entityIds`, latest-month magic string or currency parameter. Callers obtain product IDs and periods from `describe_coverage`.

Examples (illustrative periods; callers discover coverage first):

```json
{"seriesIds":["cpi.product.p0001"],"measure":"yoy_pct","fromPeriod":"2026-08","toPeriod":"2026-08"}
```

```json
{"seriesIds":["cpi.product.p0001"],"measure":"cumulative_pct","startYear":2023,"fromPeriod":"2026-08","toPeriod":"2026-08"}
```

The second returns one accumulated endpoint, calculated from January 2023 even though the output window is one month. An output window covering several months returns one cumulative value at each month against that same baseline. The calculation input window and output window must never be confused.

### Annual changes

`yoy_pct = Geostat published yoy_index_100 - 100`, unit `percent`, basis `published`. This is a rate against the same month a year earlier, not a GEL price or cumulative change since the beginning of the displayed history.

### Cumulative changes

For first year Y and endpoint month T, use the site's existing calculation: compound every `mom_index_100 / 100` from January Y through T, subtract one, and multiply by 100. The base is December immediately before Y. Do not sum annual/monthly rates or reconstruct this from annual indices.

Add optional `calculationBasePeriod` to cumulative observations and cumulative-ranking entries. It is YYYY-12 for the year preceding `startYear`; other observations omit it. Include the base in cumulative `valueDefinitionId` and `observationId` so two different starting years cannot create identically identified values. For example:

```text
inflation-products:country.georgia:cpi.product.p0001:2026-08:cumulative_pct:base=2022-12
```

Cumulative observations keep the existing `basis: published` convention for calculations over published inputs, as inflation contributions already do. The field is not sufficient attribution: every cumulative observation must carry a bilingual Fiscal.ge-derived definition and the severe `inflation_product_cumulative_derived` caveat. Sources identify monthly-index workbooks as upstream inputs, not a Geostat publication of the derived cumulative figure.

## 4. Missingness, identity and caveats

Unknown products return `unknown_series` with bounded reviewed suggestions. Unknown/retired labels are not matched to current IDs by guesswork. Dataset-wide out-of-range months return `year_out_of_range`; requests within that window but before a product's reviewed start return missing cells.

Annual missing source values remain null with bilingual explanations. Cumulative values are null for a product starting after January of `startYear`, any missing monthly input inside the compounding span, or an unavailable endpoint. Identify the actual product first month or first missing input month. Do not return a partial compounded value, zero or interpolation. Missing months before the selected compounding span do not invalidate it.

Expose reviewed `firstPeriod`, measure-specific spans and the relevant identity-limit explanation through catalogue/definitions. Retain conservative identity splits. A reviewed linked history may still change product descriptions; explain that it does not prove an unchanged brand or retail specification. Retain the reviewed p0148 bilingual-label discrepancy in applicable caveats and refer to the public methodology, without exposing internal decision IDs or source-cell locators.

Coverage fields describe available facts for the selected products/measure. For cumulative outputs, availability additionally depends on `startYear` and complete inputs. An aggregate earliest/latest span does not imply that every product is available throughout it. Per-observation missing explanations remain authoritative for gaps and late starts.

## 5. Discovery and sources

`describe_coverage` adds `inflation-products` and country entity metadata. Product series have reviewed Georgian/English labels, COICOP code, first month, supported measures and measure-specific coverage. Cumulative coverage is explicitly conditional on complete input history and the chosen first year.

Search works with or without a dataset ID, using the current bilingual matching rules and stable IDs. The complete 305-product catalogue must fit the existing 512 KiB result limit in a normal dataset-specific discovery call, with measured headroom. Publish compact product-specific catalogue metadata rather than injecting raw histories into discovery. If a request combining all catalogues exceeds the limit, preserve the existing explicit narrowing/bulk fallback; do not silently truncate or introduce unrelated pagination.

`get_sources` accepts the new dataset, resolves `source.geostat_product_yoy` and `source.geostat_product_mom` and their reviewed bilingual original workbooks, and retains validated public archive URLs, document hashes and source licensing/attribution. Annual observations cite the annual-index source; cumulative observations cite monthly-index inputs and their derivation. Generic source text keeps its original wording.

## 6. Compare and rank

### Compare annual rates

Extend `compare` with target `{ dataset: "inflation-products", seriesIds }`, `measure: yoy_pct`, and strictly ordered `fromPeriod`/`toPeriod`. Return both endpoint annual rates and their percentage-point difference. A rate changing from 5% to 8% changes by 3 percentage points; it does not prove that the price grew 3% between those months.

`cumulative_pct` is not a comparison measure in this delivery: use the query's `startYear` and endpoint to obtain the selected-calendar-range accumulated price change. Reject cumulative compare explicitly with guidance. This avoids presenting a difference between two accumulated rates as price growth or adding a second arbitrary-month calculation model beyond the existing page.

Both endpoints come from the same product query function. If either is missing, comparison is `not_comparable`, change fields remain null, and the bilingual reason is carried through. Reviewed product-history limitations travel with both endpoints.

### Rank values

Extend `rank` for `datasetId: inflation-products`, `dimension: series`, `metric: value` only:

- Annual: `measure: yoy_pct`, one `period`.
- Cumulative: `measure: cumulative_pct`, `startYear`, one endpoint `period`.

Candidates are every current reviewed product. Rank unrounded values ascending or descending, report ties/cutoff splits, use stable IDs for deterministic tie order, and explicitly list missing/ineligible products with reasons. Keep the existing default 10 and maximum 100 entries. A ranking with many exclusions must fit the byte limit or return the existing explicit oversized-result error.

Reject entity/region/parent/level filters, change-ranking metrics and ambiguous year/period combinations for product rankings. No new category-filter UI or arbitrary product-weighted aggregate is introduced. Rankings use the same annual/cumulative query helpers; incomplete histories never compete as zero.

## 7. Snapshot and bulk publications

Add the reviewed product catalogue, exact source-precision indices and necessary public identity explanations to the build-time snapshot. Include every newly public value, label, definition and caveat in `dataVersion`. Serialize only plain deterministic data; Decimal/Map indexes remain runtime caches. Keep source locators and internal review metadata out of public outputs.

Publish two manifest-listed files, using the existing category/city CSV-plus-metadata pattern:

- `inflation-products.csv`: current-product published input indices, `series_id`, `measure` (`mom_index_100` or `yoy_index_100`), `period`, exact-decimal `index_100`, availability and source IDs. Missing indices are blank, never zero.
- `inflation-products.json`: schema/release/data identities, reviewed bilingual product catalogue, measures, coverage, source references and derivation definitions needed to interpret the CSV. Do not publish tens of thousands of full bilingual observation envelopes.

The CSV deliberately supplies published monthly inputs for reproducing cumulative changes; it is not a new monthly-change chart or monthly-query measure. Explain index 100 versus percent clearly. Do not publish precomputed cumulative values for every possible starting year.

Extend the existing manifest generation/integrity checks and publication agreement tests. Bulk files and MCP must describe the same roster/history/missingness. Current inventory would become 22 listed files (23 artifacts including the manifest), 11 dataset families and 14 tools; derive actual inventories rather than treating these estimates as immutable.

## 8. Limits, performance and static architecture

Preserve existing request/result/input/rank limits, pause and shared rate limiting. Preflight query cell count is products times output months; cumulative input months do not increase returned-cell allowance. Reject oversized output before building it and direct users to narrowed ranges/bulk files. No silent source/caveat trimming.

Prepare the index once per loaded snapshot using the existing prefix-product/missing-count calculation model. Do not rescan all product inputs for every requested endpoint. Rank at most the reviewed current roster and preserve bounded serialized output. Measure snapshot byte growth, cold read/parse/index preparation, representative warm annual/cumulative query and all-product ranking latency, including source/text serialization. All must fit the existing 10-second request ceiling and result size without weakening limits. Report measurements in review evidence; do not invent a new arbitrary performance budget.

Human pages remain prerendered. `/mcp` remains the sole runtime route. Its sole external call remains the configured rate-limit counter; no query fetches product workbooks or database rows. This task requires no new product database migration or direct database edits.

## 9. Verification and acceptance

1. Bilingual lookup finds a reviewed product with its stable ID, first month and legal measures; current-roster counts and coverage follow fixtures, not hardcoded facts.
2. Annual query agrees with the canonical published annual index and the existing page/workbook helper before display rounding.
3. Cumulative query agrees with the same page/workbook helper for a complete multiyear span, a complete calendar year, an incomplete latest year, and several endpoints sharing one base.
4. Source-grounded reference cases cover an annual value, a cumulative value, a product with later start, a missing monthly input, and a ranked top/bottom result. Establish expectations from reviewed source evidence, not by running the implementation and copying its output.
5. Genuine zero, negative change and missing values remain distinct. Identity splits and the p0148 caveat are preserved.
6. Annual compare returns percentage-point change with honest comparability; cumulative compare is rejected with useful guidance.
7. Rankings preserve candidate/eligible counts, ties, exclusions and completeness rules, and fit the result cap for realistic full-roster requests.
8. Stale data version, unknown/retired IDs, invalid measures/period combinations and oversized results refuse correctly in both text and structured responses.
9. CSV/metadata/manifest hashes, exact decimals, missingness, roster and source references agree with the snapshot. Changing a public product value, label or identity explanation changes `dataVersion`.
10. Both MCP protocol eras serve the added tool with valid declared output schemas and equal application values. Existing tools/reference cases retain their numeric results.

Run focused tests during development, then the repository's full completion gates once: `npm run check`, `npm run build`, reference fixture, and browser checks for accompanying connection-page changes. CSV-mode and serving-mirror snapshot inputs must have verified parity under the existing import/build contract.

For authorized production delivery, verify the deployed commit/data identity, product lookup/query/compare/rank/source calls, failure cases, both protocols, all manifest files and the bilingual connection claims. A passing build, PR or deploy hook is not live proof.

## 10. Sequencing and review boundary

[City coverage](2026-10-01-mcp-city-coverage-design.md) is a small independent reliability fix. [Protocol compatibility](2026-10-01-mcp-client-compatibility-design.md) is independently proven before combining transport and product changes. [Documentation](2026-10-01-mcp-documentation-design.md) lands capability claims with the completed implementation.

These four specifications form one approved workstream only after the written designs are reviewed. Produce an implementation plan next; keep publishing subject to delivery authorization and all normal repository gates.
