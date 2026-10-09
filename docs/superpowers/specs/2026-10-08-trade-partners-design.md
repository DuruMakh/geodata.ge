# Trading partners: countries and country groups

Date: 2026-10-08
Status: Approved on 2026-10-08 when the user said "approve". The approved design includes Trends first, country groups and mixed country/group comparisons. Implementation follows written-plan review and execution-method selection. Publishing and live database operations remain separate.

## 1. Intended result

Help Fiscal.ge readers see who Georgia trades with, compare those relationships over time, and inspect or download the same annual figures. The page answers both "Who are the largest partners?" and "How has trade with these partners changed?"

Keep the existing editorial appearance and explorer controls. Put the historical comparison workspace first, with a selected-year ranking below. Countries and Geostat's five published country groups belong on the same page. Readers can compare a country and a group together, such as Russia and the EU, without adding their values together.

Decisions already accepted in conversation:

- Trends first rather than Ranking first.
- Countries and country groups on the same Trading partners page.
- Total trade, Exports, Imports and Balance as separate measure choices.
- Existing line chart, table, annual range, searchable checkboxes and Excel export.

The detailed defaults and behavior below are part of the approved design.

## 2. Pages and navigation

- Georgian route: `/explorer/trade/partners`.
- English route: `/en/explorer/trade/partners`.
- Add Trading partners after Overview in the Trade hub and its active sidebar context.
- Extend the existing bilingual Trade methodology at `/methodology/trade` and `/en/methodology/trade`.

Use the existing breadcrumbs, page heading, footer, metadata, language links and sitemap patterns. The hub card shows the accepted annual coverage. Do not invent a country-specific sparkline: the existing national turnover reference can supply the card's contextual series.

This page does not create individual country detail routes, a world map, product-by-country comparisons, services, domestic-export or re-export measures, forecasts, partial 2026 figures, growth rates, GDP shares, currency conversion, or inflation adjustment. Trade MCP and central bulk publications remain outside this stage.

## 3. Trends-first workspace

Under the heading and short goods-only description, place four joined measure choices:

**Total trade | Exports | Imports | Balance**

Only one measure is active at a time. Every selected country, group and national reference uses that measure. This keeps a country comparison from turning into four separate lines per country.

- Initial measure: Total trade.
- Initial display: line chart.
- Initial years: all accepted years, derived from loaded facts.
- Initial selection: Georgia total only; it is first, selectable and removable.
- Selection is unlimited. Clearing every checkbox produces the usual empty-selection state, while the ranking remains visible.
- Measures and years apply equally to the chart, table, selector values and Excel workbook.
- A year without a published value stays missing. Draw a gap, show a dash in the table, and leave an Excel amount blank rather than inserting zero.
- Use the existing annual chart and range controls. The table contains the selected series and annual USD amounts; it does not add a percentage mode or growth columns.
- Use one readable million/billion USD scale derived from the accepted values of the active measure over the active years, independently of checkbox selection. National totals remain a reference, not an extra component to add to partners.

Every series keeps its assigned color through measure, tab and language changes. Reuse the existing stable series-color approach. Labels, checkboxes, table names and hover details must identify the series independently of color. Adding hundreds of unique colors is not a requirement.

## 4. Countries and Country groups selector

Put two text tabs above search, using the existing selector hierarchy:

**Countries | Country groups**

These tabs organize one shared selection. They do not clear selections or change the chart's selected lines. The active tab also determines which ranking appears below the workspace.

The group catalogue contains these five source-published identities:

- European Union (EU).
- Commonwealth of Independent States (CIS).
- Black Sea Economic Cooperation (BSEC).
- Organisation for Economic Co-operation and Development (OECD).
- GUAM.

Selection behavior:

- Georgia total remains the first reference row in either tab and is counted once.
- The active tab shows its available choices with the current measure's end-year values. Sort numerical choices by descending value; for Balance use descending absolute balance size. Put unavailable values after numerical values, with a stable label/ID tie-break.
- When selections from the other tab exist, show those selected checkbox rows in a short, explicitly labelled section before the active tab's remaining choices. Users can identify and remove every selected line without having to switch tabs.
- Search filters the active tab's available choices. It does not hide the selected-from-other-tab section, change a calculation, or limit a bulk action.
- The normal `Clear / Select all` row remains below search. Both actions apply to the complete shared catalogue: Georgia total, all accepted country identities and all five groups. The tab is a browsing filter, not a different selection scope. Briefly label the bulk scope as countries and groups so its effect is clear.
- Show `Series {selected} / {all}` across that complete catalogue. Derive both counts from accepted identities, not from the search, current tab or latest-year numerical rows.
- The Excel action stays below the selector and exports all selected lines, including selections from the other tab.

Browsing tabs, measure, selected IDs, range, chart/table mode and the explicitly empty selection are saved in the URL and survive reload, browser back/forward and language changes. Search stays local to the selector and resets when its browsing tab changes, following the existing pattern.

## 5. Ranking below the workspace

The ranking uses the active end year and measure independently of selected chart lines and selector search. Its heading names the measure, whether it lists countries or groups, and the year.

- Countries: show the largest ten published numerical partners initially, with one Show all countries action to expand the complete ranking. Keep any identities with unavailable end-year observations in a clearly labelled, unranked section when expanded; no missing value receives a numerical rank.
- Country groups: show all five groups, including a dash where a selected-year value is unavailable.
- Exports, Imports and Total trade: use simple horizontal bars, USD amounts, and each row's percentage of the corresponding same-year Georgia total.
- The percentage denominator comes from the already accepted national Overview facts for that same measure and year. It is not the selected-series sum or the sum of groups. If the national denominator is unavailable or zero, show no percentage.
- Balance: use signed horizontal bars around zero, signed USD amounts and descending absolute balance size. Show no balance percentage; a share of a signed national balance would be misleading. Explain the ordering as largest balance differences, with neutral styling for both directions.
- Numerical zero remains a ranked numerical value. Ordering ties have a stable label/ID tie-break, not an arbitrary source-file order.
- The ranking remains present in main-table mode and with no selected series. Changing end year, measure or browsing tab updates it; changing checkboxes does not.
- The complete country ranking is accessible with ordinary page scrolling. Reuse the editorial ranking style and responsive rows rather than adding a chart library or a separate scrolling panel.

The top-ten expansion is the approved readability default for a catalogue containing more than two hundred identities. It limits the initial display, not coverage, selection or export.

## 6. Meaning of country groups and partners

Keep a concise note visible with group selection and the group ranking:

> Groups can overlap. Their values and shares should not be added together.

Do not use a pie chart, stacked composition or combined group total. A mixed comparison is a comparison of separate source-published series, not a partition of Georgia's trade. An individual country may also be included in a group shown beside it.

Use Geostat's published group totals directly. Do not reconstruct them by applying today's country memberships to historical trade. Preserve the publisher's group definitions and explain the limits of historical membership in the methodology. Country-group section totals in the country workbook are supporting controls, not additional country identities or alternative group series.

Export partners are final destinations. Import partners are sending countries, which may differ from manufacturing origins. Exports include re-exports. Exports use FOB valuation and imports use CIF; Balance is the reviewed exports-minus-imports difference under those conventions, not an assessment of whether a relationship is beneficial.

Historical countries and territories retain their reviewed source identities. Do not join Serbia and Montenegro to Serbia or Montenegro, or Netherlands Antilles to a successor, merely because their names or geography are related. Reviewed Georgian and English labels explain historical identities where needed.

## 7. Reviewed data and acceptance

Use the frozen package at `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/`:

- `goods-countries-annual.csv`: source-published country detail rows, retaining original identities, source units and missingness.
- `goods-country-groups-annual.csv`: the five explicit group identities, retaining the published export/import totals.
- Original country and group workbooks, source layouts, source-cell observation inventory, identity review, manifest and reconciliation evidence.
- Existing `data/imports/trade-overview-annual.csv` and its validation report for the national reference and percentage denominators.

The current captured country detail has 212 distinct identities and 12,152 source observations: 11,472 numerical cells, 25 blanks and 655 published non-applicable cells. The five groups add 310 primary export/import observations. These are verification baselines for this frozen capture; the UI derives counts and coverage from accepted facts.

Accept only the country-detail roles and the five group roles for the new partner catalogue. Preserve other source totals and section subtotals in the original research evidence, and use them for checks without duplicating them as public partners. Never count the national total twice.

Exports and imports retain their exact native decimal values and source references. Total trade equals exports plus imports; Balance equals exports minus imports. Derive them only when the same reviewed entity and year have both numerical counterparts, preserving both source references. A missing counterpart is not zero. No domestic-export subtraction or country/group re-export derivation is included.

Use a small task-owned canonical serving package and a separate scoped validation report following Overview's pattern. The report must verify original workbook hashes, exact source cells, source roles, units, identities, full accepted coverage, missingness, derivations and reconciliation to the matching national totals. Follow the existing documented reconciliation tolerances and exceptions; do not invent a tolerance to pass a failing comparison or modify values to close a difference.

The wider research package's two UK services discrepancies remain explicit holds. They neither block an independently accepted goods-partner subset nor become accepted through this page. Any unresolved discrepancy affecting the chosen countries/groups blocks that affected serving subset until resolved or explicitly reviewed.

Keep originals and research CSVs untouched. Public publication status stays unspecified where Geostat does not declare it. Observed annual records remain distinct from forecasts.

## 8. Static serving, sources and Excel

Follow the existing canonical CSV and private serving-mirror pattern. The reviewed CSV package is the source of truth; database copying uses only the transactional, parity-checked import. Exact monetary decimals, source references, basis, publication status and missingness must survive copying. Changes to the live database and production deployment remain separate release operations.

Both language pages are prerendered. Page rendering reads only the accepted serving package or its validated mirror, not the wider raw workbooks or research preparation code. No request-time data fetching is introduced.

Publish the four relevant original country/group workbooks through the existing Trade archive registry:

- `Export-Country_1995-2026.xlsx`.
- `Import-Country-1995-2026.xlsx`.
- `Export-_Country_Group-1995-2026.xlsx`.
- `Import_Country_Group-1995-2026.xlsx`.

Reuse the existing national workbook for the reference/denominators, retain original bytes and validated public source links, and extend the bilingual methodology rather than creating another source portal.

One Excel action exports the chosen measure, range and shared selection into the established three-sheet workbook. Use nominal USD headings, clear country/group labels, record basis and source links. State the active measure and both applicable turnover/balance formulas; include the group-overlap note whenever group series are selected. The reference source accompanies any exported national series. Ranking percentages are supporting page context and are not an additional workbook measure in this stage. Do not expose internal metadata columns.

## 9. Verification and authority updates

Implementation must verify observable behavior, not only component rendering:

- Source preparation rejects a changed workbook hash, omitted identity/year, duplicate fact, incorrect source role/unit, rounded decimal, invented zero and unmatched derivation.
- Accepted country/group checks remain separate from the unchanged services holds; reconciliation never adds overlapping groups or countries and groups together.
- All five groups, historical identities and missing observations survive the canonical import and private mirror with exact field parity.
- Mixed selections survive browsing-tab changes, measure changes, URL history/reload and language changes. Every off-tab selected series remains identifiable and removable.
- Search never limits bulk selection, the shared count, the ranking or Excel export. Clear removes all mixed selections. Explicitly empty selections stay empty.
- Only Georgia total is selected initially. Counts and years come from loaded facts.
- Ranking denominators use matching national facts; Balance has no percentage. Ranking remains independent of selected lines, and complete/missing country coverage is accessible through expansion.
- Check both languages at desktop and phone widths, keyboard operation, signed chart/table values, labels and workbook contents/source links.
- Source archives preserve exact bytes and existing attachment/plain-text handling.
- Follow the final local checks and completion requirements in `CLAUDE.md`, including the production build and relevant full browser run. Any database rehearsal or production claim requires separate actual evidence.

During implementation, amend `Project_Definition.md` section 2E for the accepted partner/group scope, `DESIGN.md` for the exact page behavior, and `docs/data-methodology/trade-annual.md` for preparation, calculation and source rules. Do not rewrite `AGENTS.md` or the frozen research design.

## 10. Next stage

This written design was approved, including mixed comparison, global bulk actions, the national-only initial selection and the top-ten ranking expansion. Prepare the implementation plan for review and execution-method selection. Written-design approval permits that planning stage; live database operations and publishing remain separate delivery decisions.
