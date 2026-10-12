# Services trade: Overview and service types

Date: 2026-10-11
Status: First-release scope approved on 2026-10-11 when the owner selected "Overview + service types first (Recommended)". The written design was approved on 2026-10-11 when the owner said "continue" after the specification was presented for review. Implementation follows review of the written plan. Publishing and live database operations remain separate.

## 1. Intended result and scope

Help Fiscal.ge readers understand Georgia's services exports and imports, see their balance, and compare the twelve published service types over time. Readers can inspect and download the same annual figures in Georgian or English using the established Trade controls.

Navigation amendment approved 2026-10-12: the owner requested moving the four measure controls to the page-level tabs, replacing Service types. Keep Overview followed by Total services trade, Services exports, Services imports and Services balance. The four measure tabs share the existing service-type comparison state and retain the existing saved-link format.

The owner approved one Services trade page with **Overview** and **Service types** views for the captured 2020–2024 annual data. Countries are deferred. Preserve the source's missing observation, exact decimals and two unresolved country-table discrepancies.

Approaches considered:

- **One comparison workspace:** fewer controls, but mixes national indicators and service categories in one selector.
- **Overview and Service types views, selected:** follows Domestic exports, separates the national comparison from comparisons between categories, and reuses the existing Trade workspaces.
- **Include countries now:** adds a useful third view, but requires a separate decision about conflicting publisher representations. The owner deferred it.

The first release has no country or type-by-country comparisons, combined goods-and-services headline, domestic/re-export concepts, regions, sub-annual periods, extrapolated years, growth measure, GDP share, currency conversion, inflation adjustment, new MCP tool or central bulk publication. The national services line on Current account remains its separate NBG dataset and vintage; it is not a source of additional years for this page.

## 2. Pages, navigation and copy

- Georgian: `/explorer/trade/services`, titled `მომსახურებით ვაჭრობა`.
- English: `/en/explorer/trade/services`, titled `Services trade`.
- Add a Services trade card after Domestic exports on the existing Trade hub, with coverage derived from the accepted services facts and a sparkline of services turnover.
- Add the same child after Domestic exports in the active Trade sidebar context.
- Extend the existing `/methodology/trade` page and its English mirror.
- Reuse breadcrumbs, source notes, language links, metadata, Dataset JSON-LD and sitemap patterns. Coverage and review dates come from the accepted package.

Keep one heading and one short lead line: "Georgia's annual services trade, in nominal US dollars." Do not add a summary paragraph or source-warning block beneath the heading. Put definitions and the reason for deferring countries in the methodology. Use one row of text tabs, **Overview | Total services trade | Services exports | Services imports | Services balance**, below the lead line.

This is services supplied between residents and non-residents. Services exports are supplied by Georgian residents to non-residents; services imports are received by Georgian residents from non-residents. Do not reuse the goods-only FOB/CIF, final-destination, sending-country or re-export explanations. Travel remains the publisher's Travel category, and Telecommunications, computer, and information services remains the complete published category rather than an IT-only estimate.

## 3. Overview view

Reuse `TradeOverview` with a small explicit services dataset option. Do not copy the workspace into a services-specific implementation.

- Four indicators, in the established order: Total services trade, Services exports, Services imports, Services balance.
- Use the existing `trade.turnover`, `trade.exports`, `trade.imports` and `trade.balance` measure IDs inside the separate services dataset. Labels, source selection and workbook titles identify services explicitly.
- Initially select only removable Total services trade, use line mode and include all loaded annual years.
- Reuse the unlimited checkbox selection, Clear/Select all, line/table switch, annual range and selected-series Excel action.
- Reuse the four independent end-year summary figures and the signed balance context chart. Their values follow the selected end year and range, independently of the checkbox selection.
- Explain the balance neutrally: exports minus imports; a positive amount means services exports exceed imports. Keep signed values and a visible zero line.
- Use one million/billion USD scale across the workspace, determined from all national indicators in the active range. Changing checkboxes must not change it.
- An empty main selection retains the summary figures and balance context, and disables the selected-series workbook action.

The services option supplies the page context and sources without changing the existing goods or Domestic exports defaults.

## 4. Service types view

Reuse `TradePartners`, its model, series panel and ranking through a small explicit services dataset option. The existing country/group and Domestic exports behavior keeps its defaults. Services identities remain service types; do not disguise them as countries or rename the services total to `goods.total`.

- One measure at a time: Total services trade, Services exports, Services imports or Services balance. Start with Total services trade, matching the current partner comparison default.
- One series selector: the removable national services total first, followed by the twelve published service types. Initially only the total is selected.
- No Countries/Country groups browsing controls. The four page-level measure tabs open this comparison directly; do not repeat measure controls below search.
- Reuse multilingual search, unlimited selections and the standard `Series {selected} / {all}` count. The denominator is thirteen, derived from the accepted catalogue. Search does not narrow Clear/Select all, counts, ranking or Excel.
- Sort type choices by the active end-year amount, or absolute amount for Balance; put unavailable choices last with a stable label/ID tie-break.
- Keep the applicable national total in ink and assign stable editorial colors to the twelve types using the existing palette. Color never substitutes for a readable label.
- Reuse line/table mode, years and USD scaling. The active measure's full accepted catalogue over the active years sets the scale, independently of selected lines.
- Below the workspace show all twelve types in the end-year ranking, independently of search and selected chart lines. This small catalogue needs no top-ten expansion or pagination.
- For exports, imports and turnover, show amounts and each type's share of the corresponding same-year services national total. A missing or zero denominator produces no share. Never divide by the selected-series sum.
- For Balance, rank by absolute magnitude, retain signed values and use the existing neutral zero-centered bars. Show no balance share.
- Missing amounts stay gaps/dashes/blank workbook cells and have no numerical rank; published zero remains numerical and rankable. Empty selection leaves the ranking available and disables the selected-series workbook action.

Preserve the published type identities and meanings:

| Stable ID | Published English name |
| --- | --- |
| `services.manufacturing` | Manufacturing services on physical inputs owned by others |
| `services.maintenance_repair` | Maintenance and repair services n.i.e. |
| `services.transport` | Transport |
| `services.travel` | Travel |
| `services.construction` | Construction |
| `services.insurance_pension` | Insurance and pension services |
| `services.financial` | Financial services |
| `services.intellectual_property` | Charges for the use of intellectual property n.i.e. |
| `services.telecommunications_computer_information` | Telecommunications, computer, and information services |
| `services.other_business` | Other business services |
| `services.personal_cultural_recreational` | Personal, cultural, and recreational services |
| `services.government` | Government goods and services n.i.e. |

The national identity is `services.total`. Add reviewed Georgian names and the matching English companions using the existing catalogue/translation workflow. Explain n.i.e. as "not included elsewhere" in methodology rather than replacing the source category with a narrower meaning.

## 5. Saved comparisons and language changes

Save the active view, measure where applicable, selected IDs, chart/table mode and selected years in the existing hash-based URL format. Use `section=overview` or `section=types` so shared links reopen the correct view. Empty selections remain explicitly empty.

Switching views remembers that view's latest comparison during the visit, following Domestic exports. Reload, browser history, language changes and active sidebar links preserve the current comparison. Unknown view/measure/IDs or out-of-range years follow the existing normalization rules. Search stays local to its selector and is not saved in the URL.

Extend the existing Trade state and tab-handling code narrowly to support the services context. `TradeDomesticExports` is the closest existing tab container; extend its container for the two services views, or share its small tab-state logic between the existing wrapper and the services composition. A shared extraction is justified only for those two actual users and must preserve the Domestic exports URL behavior. Do not add another general routing or state framework, and do not copy the Domestic exports wrapper wholesale into a parallel implementation.

## 6. Accepted source subset and derivations

Use the frozen package `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/`, selecting **only `dimension=type`** from `services-annual.csv`, backed by these unchanged originals:

- `official/Georgian-Exports-of-services-by-types.xlsx`, source ID `geostat_services_georgian-exports-of-services-by-types`.
- `official/Georgian-Imports-of-services-by-types.xlsx`, source ID `geostat_services_georgian-imports-of-services-by-types`.

The selected subset has thirteen identities, five years and two source flows: **130 original observations**, comprising 129 numerical observations and one published dash. Maintenance and repair exports for 2020 remain unavailable. Do not replace that dash with the zero in the alternative joint table or an NBG rounded value.

Derive turnover as exports plus imports and balance as exports minus imports only where the same identity and year have two numerical source counterparts. Retain ordered export/import source references and the exact decimal inputs. There are **128 numerical derived observations**, giving **258 canonical facts**: twenty national facts and 238 service-type facts. The two unsupported 2020 maintenance/repair derivations are absent and render as missing; they are not zero.

Preparation must:

1. Verify original byte sizes/SHA-256, source layouts, observation inventory and relevant frozen input fingerprints before reading values.
2. Match every selected worksheet/cell, annual header, native label, role, thousand-USD unit, number format, raw decimal and missing-value status. Reject missing, extra or duplicate keys and any country/type-country observation.
3. Normalize numerical amounts to USD with exact decimal arithmetic and preserve native source values, symbols, units, labels and references. Use the existing Decimal precision-50 and source-workbook reader patterns.
4. Verify the twelve types' numerical sum against each published national export/import amount under the existing USD 1 reconciliation tolerance. Preserve the missing child independently of the publisher's numerical total.
5. Check complete, identity-correct derivation inputs and keys, rather than arithmetic alone. Reject an in-scope unresolved comparison or a newly failing check affecting this subset.
6. Record separately that the wider package remains held by the two UK country-to-type-country import comparisons for 2022 and 2024. Their source files, failed statuses and evidence remain unchanged. Accepting national/types does not accept those representations or the broader package.

On 2026-10-11 the six published services workbooks matched the archived original hashes. A separate read of the selected two workbooks matched all 130 cells and reproduced all ten national/type sums within the existing tolerance. This establishes the proposed subset's feasibility; the implementation still needs its reproducible preparer and regression coverage.

## 7. Canonical files and private serving mirror

Follow the existing Trade preparation/import patterns:

- `data/imports/trade-services-annual.csv`: deterministic UTF-8 with BOM, complete canonical source/derived facts and provenance.
- `data/taxonomy/trade-services.json`: the national identity and twelve service-type identities with reviewed labels.
- `data/reports/trade-services-validation.json`: separately passed `annual_services_types` scope, years, complete source/status/derivation counts, canonical/catalogue/scoped-label and frozen-input fingerprints, review date and unchanged outside-scope holds.
- `npm run data:prepare-trade-services` writes the accepted artifacts; `npm run data:check-trade-services` reproduces them without writing and participates in `data:validate`.

Serving loads only accepted canonical files, the catalogue, scoped translations and the report. Preparation code, raw XLSX parsing and large research files must not enter the page or methodology dependency graph. Keep this explorer fully prerendered, with no request-time dataset database/filesystem access or source fetch.

Add private `TradeServiceEntity` and `TradeServiceFact` models, following the existing Trade tables: stable catalogue IDs, unique `(entityId, year, indicatorId)` keys, nullable Decimal(40,20) USD amounts, source-document/import-run relations, RLS enabled and `anon`/`authenticated` grants revoked. The existing transactional `data:import` path copies the accepted package and compares every catalogue/fact field before commit; a mismatch rolls back. CSV and database builds use identical accepted facts.

Generate the migration offline against the prior schema unless an explicitly named disposable test database is configured. The design does not authorize running a live migration, production import or publishing operation.

## 8. Source archive, methodology and Excel

Add the two original type workbooks and the already captured Geostat services metadata PDF (`official/1004_180325_EN.PDF`) to the existing public Trade source archive, with original bytes, hashes, native filenames and bilingual descriptions. Use the existing source manifest, source-document registry and archive generation. Link Geostat's services source page and metadata in methodology. Do not publish country workbooks as sources for this first-release subset.

Extend both Trade methodology translations with the residents/non-residents definition, twelve types, annual coverage, nominal USD, the unavailable 2020 observation, derivation rules and the country-table hold. Distinguish this Geostat snapshot from the NBG Current account series; do not combine publishers or extend services history from that page.

Reuse the native three-sheet Excel writer. Summary, Data and Sources follow the active view, selected measure/indicators, full selected series and selected years. Sources cite the applicable original export/import workbook; balance and turnover cite both. Use services-specific titles, filenames and labels, explicit USD units, observed/actual basis and unspecified publication status. Preserve zero and negative values; missing amounts remain blank. Keep internal IDs, source-cell metadata and private validation fields out of public workbook columns. Do not add growth or percentage columns to the selected-series download.

## 9. Reuse and necessary additions

**Used as is:** `ExplorerWorkspace`, `EditorialLineChart`, `StackedColumnChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector`, `SeriesSelectorRow`, `TextTab`, `SegmentedTabs`, source-note/download controls, native workbook writer, shell/SEO/source-archive components, verified source reader, exact-decimal conventions and served-row parity helpers.

**Small additions:** services context support in `TradeOverview`, `TradePartners`, their state/models/selectors/ranking/workbook builders, and the existing Trade tab wrapper pattern; a services card/sidebar child; source/translation inventories and the import/mirror transaction. Default options preserve the current goods and Domestic exports output. No new chart, selector, table, ranking or workbook implementation is justified.

**New:** the services-only canonical preparation/loading/validation family, thirteen-entry catalogue, private mirror models/migration, bilingual route wrappers and the small page composition for the two existing workspaces. Existing goods and domestic families cannot store this dataset because their source, domain, key inventories and acceptance boundaries are deliberately different. These new data-family files must call shared helpers rather than copy the existing preparers wholesale.

Update the canonical owners during implementation: `Project_Definition.md` section 2E for scope, `DESIGN.md` section 28 for the two views, and `docs/data-methodology/trade-annual.md` for acceptance/serving/source rules. Do not edit `AGENTS.md` or unrelated explorers.

## 10. Verification and completion

1. Focused data regressions reject changed original hashes, stale/missing input fingerprints, omitted/duplicate/extra keys, wrong cell/year/identity/role/unit/label, monetary rounding, invented zero, incorrect derivation counterparts and an affected source hold. Assert all 130 source observations, 128 valid derivations, the missing 2020 amount and unchanged two country holds.
2. Validate canonical loading and every-field CSV/mirror parity, including null/source fields and rollback on mismatch. Check generated schema/migration isolation and revoked public access; do not report an unrun real-database test as passing.
3. Verify the two defaults, removable total, all thirteen type selections, empty state, search-independent bulk actions, stable scales/colors, signed balance, independent ranking and same-year services denominators.
4. Verify shared links, explicit empty selections, both tab memories, reload, back/forward and language changes. Reject goods IDs and unsupported years without relabeling them as services.
5. Verify chart, table, end-year figures, ranking and Excel agree for the same state. Both languages' downloads include all selected series/years, blank missing amounts, correct units/status and validated applicable source links. Confirm the original archive hashes and contents.
6. Check Georgian and English at 390, 768 and 1440 pixels, including keyboard operation, readable category names, mobile controls and existing Trade regressions affected by shared additions.
7. Run the full completion gate from `CLAUDE.md` once after focused checks pass: `npm run check`, `npm run build` and `npm run test:browser`. Repeat a passing gate only if its inputs change.

Local implementation completion requires the above evidence. A future publishing request follows the repository's branch, draft PR, required CI, review, merge and deployment-verification workflow; a commit or passing build alone is not live-production proof.
