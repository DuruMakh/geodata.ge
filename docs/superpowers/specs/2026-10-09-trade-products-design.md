# Trade Products: chart first, catalogue in a popup

Date: 2026-10-09
Status: The visual direction and full 1995–2025 coverage were approved in conversation. This written design is pending review. No Products serving package, application page or production release has been implemented by this document.

## 1. Intended result and accepted decisions

Help readers find the goods they care about and compare Georgia's annual exports or imports over time. The catalogue contains thousands of products, so the chart must be visible immediately and product discovery must fit inside an Add products popup.

The user approved these decisions:

- Keep the chart at the top of the Products page.
- Put search and category browsing inside Add products.
- Include all collected 1995–2025 history, clearly separating different historical product versions.

The approved visual reference is the chart-first page with the category finder over it. Its four example selections illustrate a comparison; the actual page follows the repository default of selecting only the applicable national total. The real popup is closed when entering the page.

This document fills in defaults and reliable behaviour using the existing Trade explorers. Search results are paginated rather than presented as an endless narrow list. Selection has no numerical limit.

## 2. Pages, scope and navigation

- Georgian: `/explorer/trade/products`.
- English: `/en/explorer/trade/products`.
- Add Products after Overview and Trading partners in the existing hub and active Trade sidebar.
- Extend the existing bilingual Trade methodology and original-source archive.

Use the existing shell, breadcrumbs, heading, footer, language links, metadata and sitemap patterns. The hub card derives coverage from accepted facts and can reuse the existing national Trade reference for its contextual sparkline.

This page compares annual goods Exports or Imports in nominal US dollars. Exports include re-exports; exports use FOB valuation and imports use CIF. The choice applies to every selected line, the table, end-year ranking and workbook. Initial choice: Exports.

No separate domestic-export/re-export measure, turnover, balance, growth, currency conversion, inflation adjustment, services, country × product comparison, map, individual product route, forecast or partial 2026 figure is included. HS6, SITC and BEC remain research evidence. No Trade MCP extension, central bulk publication or request-time data API is added.

## 3. Main page order

The main workspace spans the available content width. Do not reserve a permanent product selector column.

1. Heading and a short explanation of goods, nominal USD and historical definitions.
2. Compact Exports / Imports controls and Add products button.
3. Existing Line / Table controls, visible Million/Billion USD unit and Excel action.
4. Existing line chart or annual table.
5. Compact removable selected-series labels and access to the complete Selected list.
6. Existing annual range strip.
7. Concise source and historical-definition notes.
8. Leading products in the selected end year.

Initial display is Line; initial range is all accepted years, derived from loaded facts. Only Georgia total is selected initially. It is first, counted once and removable. Explicitly empty selection shows the established empty state; the ranking remains present.

Keep only four selected labels visible on desktop and two on a phone. Each identifies the product and historical period and has an accessible remove action. If more are selected, show a selected count and a +N more control that opens the popup's Selected tab. These display limits do not limit chart lines, selection, table coverage or export. With empty selection, keep Add products available without adding a tall placeholder above the plot.

Reuse the existing stable identity-based editorial colors. A product retains its color when changing flow, range, browsing view or language. The total uses ink. Labels identify products independently of color; repeating colors across a large catalogue is acceptable.

Choose a readable million/billion USD scale from the active flow's accepted values, including the national reference, over the selected years. Checkbox changes cannot change that display unit. Plot scaling follows the existing chart. Do not add a percentage chart mode. The existing capped hover readout can remain; visible rows must include product code and historical period, and its hidden-row count must remain accurate.

The graph must begin within the first viewport on entry at 1366 × 768 desktop and 390 × 844 phone sizes, in both languages. Controls and labels must not overflow horizontally. Changing selection must not push the chart down the page; selected labels sit after it.

## 4. Add products popup

Opening Add products displays a modal over the existing page without moving or rebuilding its chart. It starts with a copy of the committed selection. Checkboxes edit this draft. Compare selected products commits it, closes the popup and updates the chart, table, workbook and URL together.

Close, Escape and clicking the backdrop discard draft changes. They preserve the committed selection and return focus to the opening button. Opening from +N more starts on Selected; ordinary Add products starts on Browse categories. Reopening resets the query, result page and draft from the current committed selection.

Use a native `dialog` opened with `showModal()`, the existing editorial controls and Lucide icons. Give it an accessible heading, an explicit Close control and contained keyboard navigation. Initially focus Close so opening the category view does not automatically summon the phone keyboard. The underlying page is inactive while open. Use supported event handling for backdrop dismissal rather than relying on newer `closedby` support. This choice follows the [current dialog documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).

On desktop, keep the modal comfortably within the viewport, with a bounded results area. On phones, use available width and height while keeping Close, navigation and the commit action reachable, including with the on-screen keyboard. Restore the page's scroll position when closing. Focus must not scroll the background page to the popup's search field.

Popup contents follow the existing selector hierarchy:

1. Browse categories / All products / Selected text tabs.
2. Search field with the existing Search placeholder and keyboard hints.
3. Global Clear / Select all action on the left and Series selected / all on the right.
4. National reference first, then category tiles or result rows and pagination.
5. Persistent draft-selection count and Compare selected products action.

Clear and Select all apply to the complete catalogue, including the reference, regardless of query, category, page, source period, year range or active flow. The denominator always means the complete accepted catalogue. Show a short explanation of that scope beside the bulk control. The existing mixed-state bulk control can be reused: a partial selection shows Clear, and an empty selection shows Select all.

The national reference remains available and removable in every view. Selected lists every draft-selected historical identity; searches and pagination must leave every selection accessible. A category or tab change does not remove selections. Search resets on tab/category changes; page resets on query or browsing changes.

## 5. Finding a product

Search matches reviewed Georgian and English display names, original source names, four-digit codes and reviewed everyday aliases. Reuse the existing Unicode-normalized search helper. Aliases belong to a particular historical identity; they do not establish equivalence between versions. Search runs locally and does not update the main chart.

Each product row shows a checkbox, readable name, four-digit code, source period and the active flow's value in the selected end year. A value unavailable for that year is a dash. Browsing covers the entire history: an older definition remains findable when the end year is 2025. State why older versions can lack a value in the selected year.

Show at most 25 product result rows per page. Include total matching count and Previous / Next controls; let users move through All products, a category or Selected without losing draft choices. Search ranks exact code/name matches first, followed by matches using a stable label/code/period order. Unfiltered result lists put numerical end-year values first in descending order, then unavailable values in stable label/code/period order. Do not assign a numerical rank to missing values.

Browse categories starts with eight navigation tiles, each showing its catalogue count. They are navigation groups, not added trade amounts or harmonized historical aggregate series. Match native HS2 prefixes within each source period:

| Stable ID | English navigation label | Native prefixes |
| --- | --- | --- |
| `food_agriculture` | Food, drink and agriculture | 01–24 |
| `minerals_fuels` | Minerals and fuels | 25–27 |
| `chemicals_materials` | Chemicals, medicines and materials | 28–40 |
| `clothing_wood_paper` | Clothing, leather, wood and paper | 41–67 |
| `metals_stone_glass` | Metals, stone and glass | 68–83 |
| `machinery_electronics` | Machinery and electronics | 84–85 |
| `vehicles_transport` | Vehicles and transport | 86–89 |
| `other_products` | Other products | 90–99 and explicitly unresolved codes |

Counts include separate historical identities once each and exclude the national reference. Review the category assignment for every accepted code; unresolved codes stay explicitly in Other. Provide reviewed Georgian labels. Original historical product names remain authoritative even where the modern classification differs. Category browsing never changes an amount, joins identities or silently drops a code.

## 6. Full history without false continuity

Use the four published source blocks: 1995–1999, 2000–2014, 2015–2019 and 2020–2025. A product's stable identity includes its native source block and four-digit code, following `goods.hs4.{source_block}.{code}`.

Keep all four blocks separate, including apparently identical codes and names. Match exports and imports only within the same reviewed block/code identity; retain each flow's original label and source cell. Do not infer a historical HS edition from current metadata or connect a line across source-block boundaries.

Show the source period in picker rows, selected labels, chart tooltips, table names, rankings and workbook labels. Values outside that identity's published years remain gaps/dashes/blank cells. A selected old version can produce a shorter line or no points within the current range. Explain this without replacing it with a modern product.

The captured identity-review equivalences include export/domestic-source comparisons in overlapping years. They are not evidence that these four HS4 blocks form continuous product series. Do not use them to stitch this page's history.

## 7. Table, ranking and saved state

The annual table uses the existing ExplorerTable and selected-year columns. Paginate selected series in groups of 25 to keep a thousands-product selection usable. Pagination changes visible rows only; the count, URL and workbook retain the full selection. Show which rows are visible and provide Previous / Next. Georgia total stays first in the canonical selection order.

The ranking below the workspace uses the active end year and flow, independently of selected chart lines and popup search. Reuse the existing Trade ranking presentation with a small additive Products configuration instead of copying its table. Show ten numerical products initially, then a Browse all products action revealing pages of 25. Show unavailable identities in a labelled, unranked part of the expanded list. Preserve true zero and negative published amounts with neutral signed display. Each numerical row shows its USD value and share of the matching same-year national flow, when that denominator is positive. The denominator is the accepted Overview figure, never a selected-product sum. Label historical periods so old unavailable versions are understandable.

Save committed flow, selected identities, range and line/table mode in the existing hash-based explorer state pattern. Preserve them through reload, browser history, active sidebar clicks and language changes, including explicit empty selection. Popup visibility, query, category, draft and pagination are temporary interface state; they do not create product detail links or persist an unfinished selection.

Thousands of selected IDs must not create an excessively long link. Add a small Products-specific selection codec to the existing URL-state pattern: encode a versioned bitset over the deterministic accepted catalogue order, including the reference, and bind it to the catalogue fingerprint. The current complete catalogue needs under 1 KB for its selection token. Do not reinterpret bits against a different catalogue. A malformed or mismatched token resets to the documented national-only default with a clear message. Valid explicitly empty tokens remain empty. This is the only new compact state mechanism; other explorer routes keep their current encoding.

## 8. Canonical data and scoped acceptance

Use the frozen research package at `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/`, specifically the four `goods-products-annual/hs4-*.csv` files and their original workbooks, source layouts, cell inventory, manifest, identity review and reconciliation evidence. Reuse the accepted national Overview package for the reference and share denominators.

Fresh counts from this capture are preparation baselines, not acceptance evidence:

| Source block | Detail observations | Distinct block/code identities |
| --- | ---: | ---: |
| 1995–1999 | 9,775 | 1,146 |
| 2000–2014 | 35,160 | 1,240 |
| 2015–2019 | 11,105 | 1,190 |
| 2020–2025 | 13,584 | 1,192 |
| Total | 69,624 | 4,768 |

There are 66,627 numerical observations and 2,997 explicitly not-applicable observations. The picker adds one national reference, counted once. The 62 native product-total controls remain reconciliation evidence rather than additional selectable product facts. Derive public counts and coverage from the accepted package; reject unexpected changes in this frozen input instead of silently accepting new baselines.

Create task-owned reviewed catalogue and annual serving CSVs under `data/imports/`, with a scoped validation report under `data/reports/`, following the existing Trade preparation/import/validation patterns. The catalogue contains stable ID, block, code, source names, reviewed public names, category and reviewed aliases. The facts retain exact normalized USD decimal, native value/unit/label/number format, worksheet/cell references, source ID, flow, year, basis, value status, publication status and review date. Public English labels use the established translation registry.

Do not round source money or modify original files. Preserve explicit dashes as unavailable, absent flow rows as absent, numerical zero as zero and published negative values as signed values. Source publication status remains unspecified and observed basis remains actual. Do not derive any additional monetary measure.

Acceptance independently verifies original workbook hashes, complete key sets, cell identity, codes, source roles, unit headers, labels, decimals and missingness, then reconciles native product controls and detail totals using the existing documented USD 1 tolerance and source exceptions. Do not widen tolerances or borrow HS6-prefix allocations to adjust HS4 amounts. Any unresolved discrepancy inside this subset blocks acceptance of that subset. The wider research package's two UK services holds remain unchanged and outside this page.

Keep the serving mirror private, following the existing Prisma/RLS pattern. The current maximum monetary precision has 10 whole digits and 19 meaningful fraction digits, which fits the existing Decimal(40,20) convention exactly. Copy and verify all canonical fields only through the transactional `npm run data:import` path. Schema files and tests belong in implementation; a live database operation requires a separate authorized delivery step.

Both routes remain prerendered. Prepare a lean client payload from the accepted data, omitting internal per-cell provenance from repeated chart observations and reusing source metadata where possible. Charts use the existing numerical display conversion; canonical CSVs and the mirror retain exact decimals. Measure the built page and all-selected interaction before adding any further optimization.

## 9. Sources and Excel

Publish these six original workbooks through the existing archive registry, preserving exact bytes and validated links:

- `Export-Product-by-4-digit-1995-1999.xlsx`.
- `Export-Product-by-4-digit-2000-2014.xlsx`.
- `Export-Product-by-4-digit-2015-2026.xlsx`.
- `Import-products--1995-1999_eng.xlsx`.
- `Import-Product-by-4-digit-2000-2014.xlsx`.
- `Import-Product-by-4-digit-2015-2026.xlsx`.

Recent source blocks use different worksheets of the same workbook. Preserve native filenames and IDs internally; public archive paths follow the existing lowercase convention. Include the already published national workbook for an exported reference series.

The established three-sheet Excel workbook exports the committed flow, years and entire selection, including series outside the visible table page. Labels include product code and source period. Use clear nominal USD headings, source hyperlinks, basis, unspecified publication status and the historical-definition note. Missing annual amounts are blank; published zero remains zero. Follow the existing public export precision and formatting conventions; do not expose internal cell-metadata columns or imply that Excel's numerical display preserves every source decimal digit. Ranking shares are page context rather than an extra workbook measure.

## 10. Reuse and limited additions

| Existing piece | Decision |
| --- | --- |
| ExplorerPage, shell, Trade loaders/routes, hub cards and navigation registries | Reuse, adding the Products entry through established patterns. |
| EditorialLineChart, chart tooltip, range strip, unit formatting and stable colors | Reuse as is. Version-qualified labels are supplied by Products. |
| ExplorerTable and native workbook writer | Reuse with Products data; page the supplied table rows and export all committed rows. |
| SeriesSelector, normalized search and editorial/Lucide controls | Reuse; add only a scoped optional list/focus setting if the aside scroll or search-focus behaviour conflicts with the modal. Defaults preserve existing pages. |
| TradePartnersRanking | Small additive Products labels/row configuration and optional pagination; preserve existing country/group output. Do not duplicate its ranking markup. |
| Annual range/hash state, source projection, archive preparation, translation registry and import transaction | Reuse the existing machinery; add the separate Products family and compact selection codec. |

Genuinely new pieces are a thin Products picker, Products-specific data/model/state/workbook adapters, and reviewed HS4 catalogue/facts with preparation and scoped validation. The municipality entity picker was considered: it navigates to one place and its rows are tied to geography, so it cannot supply staged multiple selection of thousands of products without a broader rewrite. The existing fixed two-column ExplorerWorkspace was considered: its permanent aside conflicts with the approved full-width chart; use the established full-width explorer composition instead. No new UI library, chart implementation, workbook format or general modal framework is needed.

## 11. Verification and completion

Implementation must verify these observable results:

- Both languages open with total only, full data-derived coverage, popup closed and a chart visible in the first desktop/phone viewport.
- Popup open/close, keyboard and backdrop actions preserve chart position. Cancel discards the draft; Compare commits it; focus and page scroll restore correctly.
- Category browsing and name/code/alias search find modern and historical records. Version labels remain visible and no line crosses source-block identities.
- Search, category, pagination, flow and range never narrow bulk selection or its denominator. All 4,768 captured identities and the one reference are accessible; selecting all has no cap or silent downsampling.
- Large selection remains responsive enough to open, edit, apply and reopen the popup. Table pages render bounded rows and the workbook contains all selected series. Record timings and built payload size before deciding whether targeted tuning is required.
- Valid selection and empty state survive reload, history, language and navigation. Compact links round-trip the whole catalogue, and malformed or different-catalogue tokens cannot select another product accidentally.
- Source preparation rejects changed hashes, duplicate/omitted facts, incorrect roles/units, decimal rounding, invented zero and undocumented identity joins. Scoped acceptance and private-mirror parity cover all accepted fields and missingness.
- End-year ranking uses the correct national denominator, labels unavailable history clearly and stays independent of chart selection. Table/chart/workbook values agree on flow and years.
- Source archives preserve bytes; exported source links work. The workbook explains valuation and separate historical definitions in both languages.
- Follow `CLAUDE.md`: relevant focused checks during edits, then `npm run check`, static build and full browser gate once at completion. A live database or production claim requires separate direct evidence.

During implementation, update `Project_Definition.md` §2E for this bounded Products scope, `DESIGN.md` for chart/popup behaviour and `docs/data-methodology/trade-annual.md` for serving, historical identities, sources and acceptance. Do not rewrite `AGENTS.md`, the frozen research design or unrelated explorers.

## 12. Review boundary

This design now contains the approved chart-first direction and the user's explicit full-history choice. Review this written design before creating the implementation plan. Written-spec approval permits planning; implementation follows the plan review and execution-method choice. Publishing and live database operations remain separate release decisions.
