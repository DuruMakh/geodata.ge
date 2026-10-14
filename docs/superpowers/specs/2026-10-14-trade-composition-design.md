# Trade composition: goods groups and economic categories

Date: 2026-10-14
Status: Draft for owner review. The owner authorized the Trade composition feature after discussing the two official groupings. This written design has not yet been approved for implementation.

## 1. Intended result

Help readers understand the broad composition of Georgia's goods exports and imports and compare categories over time. Show the same reviewed figures in Georgian and English through the established Trade chart, table, ranking and native Excel controls.

The first release is one page with two mutually exclusive views:

- **Goods groups:** the ten published one-digit SITC sections.
- **Economic categories:** the seven published one-digit BEC categories.

Use the captured complete annual 2000–2025 data. Coverage, selectable years and counts come from the accepted facts and catalogue, rather than hardcoded UI values. These are alternative classifications of the same goods trade; categories from the two views are never mixed or added together.

## 2. Approach and boundaries

Use two views on one page. A combined category selector would mix alternative classifications, while two separate pages would add navigation for two small, closely related datasets.

The chart and table show nominal USD amounts. The end-year ranking shows each category's amount and share of the corresponding national exports or imports. A percentage-chart toggle is outside this first release; readers can change the end year to compare composition shares.

Serve only Exports and Imports. Add no category turnover, balance or re-export derivations, three-way capital/intermediate/consumer regrouping, growth calculation, GDP ratio, currency conversion, inflation adjustment, regional/country cross-tab, detail pages, services, incomplete 2026 period, forecast, MCP tool or central bulk publication.

## 3. Pages and navigation

- Georgian route: `/explorer/trade/composition`; title: `საქონლით ვაჭრობის სტრუქტურა`.
- English route: `/en/explorer/trade/composition`; title: `Trade composition`.
- One short lead line: `Compare Georgia's goods exports and imports by broad product groups and economic categories.` Provide its Georgian translation.
- One page-level text-tab row: **Goods groups | Economic categories**, with localized labels. Start with Goods groups.
- Append the page as the sixth Trade hub card and the last Trade sidebar child, preserving the existing five entries' order. Use loaded coverage and a national goods-exports sparkline restricted to those years.
- Reuse breadcrumbs, language links, metadata, Dataset JSON-LD, sitemap and the existing page shell.
- Extend the existing bilingual `/methodology/trade` page and the Trade source archive.

Keep only the heading and one-line lead beneath it. Put definitions and caveats in the established source-note area and methodology, following `DESIGN.md` v4.1.

## 4. Comparison workspace

Reuse the Trading partners comparison workspace through a small explicit composition dataset option. Use proper commodity-category identities; do not disguise the groups as partner countries or overlapping country groups.

- Default to Exports, Line mode and the full accepted range in each view.
- Only removable Georgia total is selected initially, first in the selector.
- Exports/Imports controls sit below search in the series panel, matching the established embedded Trade layout. Do not add a second page-level tab row.
- Keep unlimited selection, local bilingual label/code search, global Clear/Select all, the standard selected/all count and the native Excel action.
- The full catalogue consists of Georgia total plus ten or seven categories, according to the active view. Search does not narrow bulk actions, counts, ranking or export.
- Reuse the line chart, table, year range controls, selection aids and source note. Missing values remain gaps/dashes/blank cells; published zero and negative values retain their meaning.
- The USD scale depends on the complete active classification and flow over the selected years, independently of selected lines.
- Use ink for Georgia total and deterministic, distinguishable editorial colors for categories. A category keeps its color across flows, years, chart and ranking.
- Empty selection retains the year range and independent ranking and disables the selected-series workbook download.
- Use the existing responsive layout, wrapped Georgian labels, keyboard controls and chart accessibility behavior.

## 5. Category ranking and shares

Below the workspace, show all ten or seven categories for the active end year and flow, independently of search and selected chart lines. Reuse the shared ranking component; this small catalogue needs no pagination or top-ten expansion.

Rank numerical observations by their amounts, with stable label/identity tie-breaking. Keep unavailable observations listed without numerical ranks. Retain signed amounts; if a published category amount is negative, use the existing neutral, zero-centered ranking bars.

Share = category amount / accepted national amount for the same year and flow. Never divide by the selected-series sum, the other classification, both flows combined or a country-group total. An unavailable or zero denominator yields no share. Share computation is display arithmetic, not a newly stored source observation.

Explain the two views without claiming that the seven BEC categories are a pure three-way split of capital, intermediate and consumer goods. Capital goods includes the publisher's stated parts/accessories; transport equipment is a separate category.

## 6. Published categories

Preserve native code strings, original English source wording and reviewed Georgian display labels. Use stable lowercase ASCII identities `trade.sitc1.{source_code}` and `trade.bec1.{source_code}`. SITC code `0` remains a valid code.

| SITC code | Published group |
| --- | --- |
| 0 | Food and live animals |
| 1 | Beverages and tobacco |
| 2 | Crude materials, inedible, except fuels |
| 3 | Mineral fuels, lubricants and related materials |
| 4 | Animal and vegetable oils, fats and waxes |
| 5 | Chemicals and related products, n.e.s. |
| 6 | Manufactured goods classified chiefly by material |
| 7 | Machinery and transport equipment |
| 8 | Miscellaneous manufactured articles |
| 9 | Commodities not classified elsewhere in the SITC |

| BEC code | Published category |
| --- | --- |
| 1 | Food and beverages |
| 2 | Industrial supplies not elsewhere specified |
| 3 | Fuels and lubricants |
| 4 | Capital goods (except transport equipment), and parts and accessories thereof |
| 5 | Transport equipment and parts and accessories thereof |
| 6 | Consumer goods not elsewhere specified |
| 7 | Goods not elsewhere specified |

Use concise, faithful localized display labels where the source wording is long; retain full original wording privately and explain abbreviations in methodology. Do not infer the classifications from the current HS4 Products catalogue or its navigation categories.

## 7. Saved comparisons

Reuse `useTradeSectionsState` for the two views and the existing Trade hash-state helpers for comparisons. Save the active classification, flow, years, line/table mode and unlimited or explicitly empty selections. Switching views remembers each view's latest comparison during the visit. Reload, browser history, language changes and active sidebar links preserve the comparison.

Use `section=sitc` or `section=bec`. Normalize unsupported flow values, category IDs from the other classification and out-of-range years through the established state rules. The default flow is Exports. Search remains local and is not saved in the URL. Restore keyboard focus appropriately when changing view.

## 8. Accepted data subset

Use the frozen package `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/`:

- `goods-products-annual/sitc1-2000-2025.csv` and its two original SITC workbooks.
- `goods-products-annual/bec1-2000-2025.csv` and its two original BEC workbooks.

The scoped serving package contains 17 category identities and 884 original category observations: 520 SITC and 364 BEC. All captured observations are numerical. Keep the 104 classification-total observations as validation controls, rather than additional selectable identities or canonical facts. Reuse the accepted national Trade Overview for Georgia total and ranking denominators, restricted to the active classification's coverage.

Preserve exact source decimals, source worksheet/cell references, native units, labels, codes, formats, source blocks, actual basis and unspecified publication status. Use Decimal precision 50 for exact thousand-USD-to-USD conversion. Exports use FOB valuation and include re-exports; imports use CIF valuation.

The preparation step must verify original hashes and byte sizes, frozen input fingerprints, worksheet bindings, year/unit/code/label cells, formats, stored numeric tokens, complete keys, category inventories and value-status counts. For every classification/year/flow, reconcile category sums to the original classification total and that total to the accepted national amount within the existing USD 1 tolerance.

Write deterministic, UTF-8-BOM canonical CSV, reviewed bilingual catalogue and scoped acceptance report. Check mode reproduces the exact artifacts without writing. Reject any applicable source hold or failed reconciliation in either the research validation or source-issues evidence. The two UK services discrepancies remain outside this separately accepted goods subset; the wider research package is not relabelled accepted.

Preliminary read-only check on 2026-10-14: all 988 numeric cells, including controls, matched the original stored decimal tokens exactly. Across all 26 years and both flows, the largest category-sum or national-control difference was below USD 0.001. This investigation supports the design and does not replace the implementation's reproducible acceptance checks.

## 9. Serving and private mirror

Add a small composition serving family following the accepted Trade Products and Services preparation/loading patterns. Serving reads only accepted canonical CSV, catalogue, report and localized labels; raw workbook readers and preparation code remain outside page and methodology serving graphs.

Keep the 17-category catalogue and 884 observations in the private database mirror with exact decimals, source-document/import-run relations, row-level security and revoked public-role access. Extend the existing transactional `data:import` path and compare every category and fact field before commit. CSV and database builds use the same accepted package. A migration is generated offline following the current repository procedure when no explicitly disposable test database is configured.

Both small classification datasets are bundled as compact client projections in the static page; changing tabs makes no dataset request. Extend the shared Trade dataset context, selection model, ranking copy, state serialization and workbook source selection only where composition needs different labels or category semantics. Existing Trade dataset options retain their current defaults and output.

## 10. Excel and original sources

Reuse the existing three-sheet native workbook builder and writer. Export the active classification, flow, selected range and every selected series, including a removable national reference when selected. The readable sheet follows the page's USD scale; the analysis sheet retains unrounded amounts and actual/unavailable basis status. Keep missing values blank and sufficiently precise formatting for small nonzero values. Following the repository's public-workbook contract, publication status remains private; add no percentage, publication-status or other internal metadata column to this workbook.

Include applicable original classification/flow workbook hyperlinks on Sources, and the existing national original when Georgia total is selected. Publish the four unchanged upstream SITC/BEC workbooks through the existing validated Trade archive, with lowercase public paths, native filenames, exact hashes and bilingual attribution. Do not substitute derived HS4 sums or change earlier archives' source contents.

## 11. Reuse inventory

Reused as is: `ExplorerPage`, `PageHeader`, `ExplorerHeading`, `ExplorerWorkspace`, `SeriesAside`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `ChartSelectionAids`, `SeriesSelector`, `SeriesSelectorRow`, `TextTab`, `ExcelDownloadButton`, `ExternalRanking`, `useTradeSectionsState`, the existing workbook writer, exact source-workbook parser, archive infrastructure and transactional importer.

Small additions: explicit composition context in `TradePartners`, its client entity type/model/state/series panel/ranking/workbook source selection; a composition-aware entry in the existing Trade page factory, hub cards, sidebar, locale messages, SEO/sitemap and data-validation/import registries. Preserve the existing country, group, domestic and services behaviors through regression checks.

Genuinely new: the composition catalogue and serving artifacts, narrow source-bound preparation/validation/loader modules, private composition entity/fact tables and migration, a thin `TradeComposition` page wrapper for the two classification views, and focused data/state/workbook/browser tests. The wrapper is needed because the existing Services and Domestic wrappers have different view sets; reuse their shared tab-state hook instead of copying either wrapper. No new chart, selector, ranking, workbook framework, dependency or public endpoint is needed.

## 12. Verification and delivery boundary

Before claiming implementation complete:

1. Focused data checks reproduce source bindings, exact values, complete inventories and reconciliation; corruption, omitted/duplicate keys, wrong source/code/year/units, applicable holds and stale artifacts fail.
2. State/model/workbook checks cover both classifications and flows, correct national shares, independent ranking, stable scaling, unlimited/empty selections, complete export and relevant source hyperlinks. Test unchanged existing Trade dataset defaults.
3. Browser checks cover Georgian/English and desktop/phone: entry defaults, switching classification/flow, search versus global bulk actions, charts/tables, range changes, ranking shares, saved links/history/language changes, keyboard operation and native Excel downloads.
4. Run the repository completion gate once after focused checks: `npm run check`, `npm run build` and `npm run test:browser` in `apps/web`, using the documented build-once browser procedure. Update `Project_Definition.md` section 2, `DESIGN.md` and `docs/data-methodology/trade-annual.md` in the implementation change. Do not rewrite `AGENTS.md` for this feature.

This design covers local implementation and verification. Publishing, production migration/import and merge remain separate authorized operations. When delivery is authorized, use the required `codex/*` branch → commits → push → draft PR → required green CI/review → merge → branch cleanup sequence, then verify the deployed commit and relevant production pages/downloads separately.
