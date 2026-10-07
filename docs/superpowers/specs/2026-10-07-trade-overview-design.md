# Trade hub and national goods overview

Date: 2026-10-07
Status: Approved in this conversation on 2026-10-08, when the user said "continue" after the written-design review request. The Trade hub, Overview-first scope and checkbox comparison are confirmed. The implementation plan is the next review; publishing and live database operations remain separate.

## 1. Intended result

Help Fiscal.ge readers understand how Georgia's trade in goods has changed, compare exports and imports, and inspect or download the same annual figures.

Reuse the production editorial appearance and existing explorer components. The first page covers national goods totals. Other Trade sections will be designed individually in later conversations.

## 2. Pages and navigation

- Trade hub: `/explorer/trade`, with English mirror `/en/explorer/trade`.
- Overview: `/explorer/trade/overview`, with English mirror `/en/explorer/trade/overview`.
- Trade methodology: `/methodology/trade`, mirrored in English, using the existing methodology and source-archive components.

The hub initially has one working Overview entry, following the existing section-hub pattern. Its coverage and total-trade sparkline come from the same served national facts as Overview. Add Trade after Unemployment in the main sidebar and Overview beneath it when Trade is active. Preserve the Demography marker. Future sections receive links when they are implemented; this stage creates no inactive country, product, domestic-export, services or region routes.

Reuse the existing breadcrumbs, page headings, language links, footer source note, metadata and sitemap patterns. Trade receives its own active sidebar context rather than appearing as a Budget page.

## 3. Overview layout and behavior

Use the heading `Trade overview` and a short explanation that the page covers Georgia's trade in goods, in current USD. Georgian labels follow the existing terminology and bilingual catalogue conventions.

### Main workspace

Reuse `ExplorerWorkspace`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector` and the Excel download action. The desktop layout has the chart/table on the left and indicator checkboxes on the right; mobile follows the existing stacked layout.

The four indicators have this stable order:

| Indicator | Meaning | Stable UI ID |
| --- | --- | --- |
| Total trade | Exports plus imports; also called trade turnover | `trade.turnover` |
| Exports | Published national merchandise exports | `trade.exports` |
| Imports | Published national merchandise imports | `trade.imports` |
| Trade balance | Exports minus imports | `trade.balance` |

Default to line mode, the full loaded annual coverage and only Total trade selected. Total trade remains first, selectable and removable. Any combination of the four checkboxes is valid because all indicators have the same USD unit. Reuse the existing search, Clear/Select all and selection-count behavior; search does not change the bulk-action scope or denominator.

Use distinct stable colours from the existing editorial palette, with Total trade in ink. Negative balance values extend below a clearly drawn zero line. Missing observations remain gaps or dashes. An empty main selection uses the existing empty-state message and disables the selected-series Excel action.

Amounts have explicit USD scale labels, following the existing million/billion formatting conventions. Use the same scale for the main chart, table and selector. The page introduces no currency conversion, percentage measure or growth control. Adapt any shared table labels narrowly so trade never displays GEL, budget categories or GDP-share columns.

Available years come from loaded facts; the collected coverage is currently 1995-2025. Preserve the selected years, indicators and chart/table mode in URL state and across language changes. Clamp invalid shared settings to the loaded scope using the existing approach.

### Four summary figures

Below the main workspace, show Total trade, Exports, Imports and Trade balance using the existing editorial indicator treatment. Label them with the last year in the selected range. They always describe all four national indicators, independently of checkbox selection. A missing end-year observation displays a dash rather than a value from an earlier year.

### Trade-balance context chart

Below the summary figures, reuse `StackedColumnChart` with one signed balance series and no overlay. Bars extend above or below zero and use the same selected years as the main workspace. Explain plainly that a negative balance means imports exceed exports; do not assign a good/bad judgment to the sign.

This context chart remains visible in main-table mode and with no main series selected. Reuse its accessible description and readout. Readers can check Trade balance in the main workspace to inspect or download its exact annual figures.

## 4. Data scope and source acceptance

The source authority is `docs/data-methodology/trade-annual.md` and the frozen package at `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/`. Preserve its original workbooks and research artifacts.

Promote only the national goods export/import rows from `goods-national-annual.csv` and the matching national goods `trade_turnover` and `trade_balance` rows from `derived-annual.csv` into a small reviewed canonical serving package. The current capture contains 62 primary observations and 62 observations for these two derivations. Exclude the re-export rows present in the same derived file. Preserve exact decimal values, source references, row roles, units and publication status.

Validate that turnover equals exports plus imports and balance equals exports minus imports for every eligible year. Both inputs must have matching national goods scope and available numeric values. Reject omitted or duplicate observations, extra indicators, swapped signs, altered values, inconsistent source references and unsupported periods.

The research package's overall source acceptance remains held by two UK services comparisons. Overview needs a separate, explicit acceptance report for its national-goods subset, establishing complete coverage, source fidelity and exact derivation identities. Any unresolved issue affecting that subset prevents promotion. Do not relabel the full package as accepted, modify its held comparisons or treat its failing acceptance command as a success.

The source note and methodology explain that exports use FOB valuation and imports use CIF valuation, including freight and insurance. Values are nominal USD, not adjusted for inflation. Preserve the source's unspecified publication status; do not label every complete annual period as final. No services values, combined goods/services headline, domestic-export data, 2026 partial periods or forecasts enter this page.

## 5. Serving, sources and Excel

Keep the pages prerendered. Follow the existing CSV loader, numeric client projection and private database-mirror patterns. Add only the national overview dataset to the transactional, parity-checked import pipeline, preserving the same values and source status in both serving modes. The page never fetches publisher data or reads original workbooks at request time. Live migration and import belong to separately authorized delivery.

Publish the relevant national goods workbook and methodology material through the existing source-archive tooling; unrelated trade workbooks remain in the research package. Reuse the three-sheet Excel writer for Summary, Data and Sources in the selected language. Export the selected indicators and years with explicit USD units, missing cells, source publication status, derived-measure explanations and validated original-source links. Retain unrounded numeric values and source lineage internally without exposing internal identifiers or cell references as analysis columns.

The page does not add trade MCP tools, central CSV/JSON publications, a public API or additional trade sections. Metadata must not advertise an unavailable dataset download address.

## 6. Verification and next stage

During implementation, update `Project_Definition.md` for this bounded product scope, `DESIGN.md` for the Trade surfaces and the trade methodology for the national-only acceptance, serving and export rules. Preserve the existing user changes in `AGENTS.md`.

Verification must establish:

1. The serving package matches the frozen national source and derivations exactly, with explicit subset acceptance and unchanged services holds. CSV and database mappings preserve the same fields and decimals; import failures roll back the transaction.
2. The default is Total trade only. Adding Exports and Imports compares both; removing Total trade works. Search, bulk actions, empty selection and invalid saved settings follow the existing contract.
3. Changing the selected final year updates the table, selector and all four summary figures. Both charts use the same year range; the context chart remains independent of main selection and mode. Negative balance signs and zero baselines remain correct.
4. Chart, table and Excel agree for the selected years and indicators. Source links, methodology, hub navigation and both language routes work together.
5. Georgian and English layouts work at 390, 768 and 1440 pixels, with readable labels, keyboard controls, contained chart/table scrolling and settings preserved across language changes.
6. Run narrow relevant checks while editing, then the completion gates in `CLAUDE.md` once: `npm run check`, `npm run build` and `npm run test:browser`. Review the final implementation against this scope before delivery.

After written-design approval, prepare the implementation plan for review and execution-method selection. Local design work does not authorize pushing, creating a PR, merging, deploying or modifying the live database.
