# Economy: GDP overview specification

Date: 2026-09-10
Status: Approved for inline implementation on 2026-09-11. The navigation and four-tab structure were agreed in conversation.

## 1. Outcome and scope

Add Economy immediately below Budget in the Data Explorer's main navigation. Economy is a peer of Budget, not a budget subsection. Its landing page follows the existing budget hub card design. The first functional card opens GDP overview: one page presenting four annual indicators through centered tabs and one shared chart/table workspace.

This first implementation includes the Economy entry point, its hub, GDP overview, the supporting reviewed data, localized Excel downloads, methodology and source archive. It does not implement the sector or regional explorers. Their already-collected data remains separate research material.

User-approved decisions:

- Reuse the production explorer components and layout wherever possible. Similar colors or a recreated chart are insufficient.
- Four tabs, in this order: Real GDP, Nominal GDP, GDP growth, GDP per capita.
- Center these tabs below the page title and summary, above the chart workspace.
- Put the GEL/USD switch in the chart toolbar, using the current share-toggle styling and placement.
- No separate Nominal/Real dropdown and no right-side Display panel.
- National GDP per capita is nominal only. No cumulative growth, real GDP per capita, regional population or regional per-capita work.

The HTML previews are exploratory references for behavior only. In any visual conflict, current production components and DESIGN.md take precedence.

## 2. Navigation and routes

Proposed canonical Georgian routes:

- `/explorer/economy`: Economy hub.
- `/explorer/economy/gdp`: GDP overview.
- `/methodology/gdp`: concise GDP methodology and original sources.

English uses the existing `/en` prefix and equivalent routes. Preserve all current budget URLs.

The Economy hub uses the existing budget hub card anatomy, typography and spacing:

1. GDP overview: active link, with data-derived coverage and a real headline value following the existing card pattern.
2. Economic sectors: non-clickable Coming soon card.
3. Regional economies: non-clickable Coming soon card.

Do not present sector/regional cards as implemented merely because their research data exists. Do not create dead routes. Economy expands its own section navigation following the existing Budget behavior; active route styling must distinguish the two families. Replace the redundant Economic growth teaser with the Economy entry; retain unrelated future markers. Preserve sidebar collapse, keyboard and mobile navigation behavior.

Budget hub content and the homepage's current statistics remain unchanged. New GDP routes receive normal localized metadata, breadcrumbs, sitemap and methodology discovery. No new public API or MCP query intents are added in this scope.

## 3. Page composition

Reuse the explorer shell, footer, PageHeader, breadcrumb treatment, page width, heading and compact summary line.

```text
Home / Data / Economy / GDP overview              Coverage · Updated

GDP overview
[last selected year]: [active indicator] · [value] · [status when applicable]

        Real GDP   Nominal GDP   GDP growth   GDP per capita

Chart | Table                                      GEL | USD (when applicable)
Active unit / price basis

                    Existing explorer chart or annual table

Existing year range slider and 5y / 10y / All shortcuts
Download
Source and methodology note
```

The centered tab group spans the chart workspace, not the entire viewport including the sidebar. It reuses the established text-tab treatment. On small screens it forms one horizontally scrollable row; selecting or focusing a tab keeps it visible. Do not wrap it into inconsistent multi-row groups.

Chart/Table remains left-aligned in the chart toolbar. The currency switch is right-aligned where the budget share control appears. It uses the same compact pill treatment, with GEL and USD explicitly identified and active state exposed accessibly. It must not imply a percentage/share operation.

Only one indicator is visible at a time. There is no series search, bulk selector, empty-selection flow, right panel, dashboard KPI grid, giant headline value or additional derived-indicator section. The single active GDP series is always displayed. Download sits below the range controls using ExcelDownloadButton; do not reserve an empty right column solely for the action.

Growth uses the existing line chart. The first discarded preview's bar chart is not a requirement. Negative growth remains visible below zero.

## 4. Indicator contract

| Tab | Source | Collected annual coverage | Display | Currency control |
| --- | --- | --- | --- | --- |
| Real GDP | World Bank NY.GDP.MKTP.KD, GEO | 1960–2025 | Constant 2015 USD, normally billions | Hidden |
| Nominal GDP | Geostat | 1996–2025 | Current GEL or USD, normally billions | GEL / USD |
| GDP growth | World Bank NY.GDP.MKTP.KD.ZG, GEO | 1961–2025 | Annual real change, percent | Hidden |
| GDP per capita | Geostat | 1996–2025 | Current GEL or USD per person | GEL / USD |

Coverage above describes the collected snapshot, not hardcoded UI limits. Derive years, latest observation and range from loaded facts.

Real GDP remains the original World Bank constant-price dollar amounts. No joining to Geostat, custom normalization, index starting at 100, interpolation or forecast extension. Dividing amounts by one billion for display is a unit conversion only. Growth uses the published annual World Bank series, not changes in nominal amounts. Missing 1960 growth stays unavailable.

Nominal GDP and nominal GDP per capita use both published Geostat currency values. Do not convert at a current exchange rate or divide total GDP by a newly chosen population series. This preserves the completed national per-capita collection while deferring broader population work.

Geostat's historical nominal series uses SNA 1993 through 2009 and SNA 2008 from 2010. Document this boundary; do not imply a uniformly revised historical accounting series. The 2025 Geostat observations are preliminary. World Bank observations retain their published status without invented finality labels. Preliminary is not planned or forecast: never reuse planned styling or flags to misclassify it.

The early World Bank observations are published historical data; the collected metadata does not resolve their year-by-year reconstruction. The methodology must say this plainly. Before implementation accepts the data, independently reproduce the source extraction and verify country, indicator, dates, units and hashes, including the earliest years. If the source fails those checks, report it rather than silently filling or shortening the series.

## 5. Defaults and interaction

Proposed defaults: Real GDP, Chart view, full available range. Default nominal currency is GEL.

- Clicking a top tab updates chart/table, headline, units, source note, source links, year coverage and download together.
- Preserve Chart/Table mode across tabs.
- Remember the user's GEL/USD choice across the two nominal tabs; hiding the currency control must not reset it.
- For a manually narrowed range, preserve its intersection with the destination indicator's available years. If there is no intersection, use the destination's full range.
- If the user was viewing All, continue to show All for the destination indicator. This avoids accidentally hiding the longer real series after a nominal view.
- When a switch changes the range, announce the new period briefly for assistive technology; visible range and coverage must also update.
- RangeStrip retains its current behavior, including quick ranges and accessible handles. A single-year selection shows one observation, not a fabricated line or zero growth.
- The headline uses the last available observation within the active range, with its actual year and applicable status.
- Tooltips and table headings always communicate the active currency/price basis or percentage unit. Short axis units may be used to avoid clipping, with the full unit above the chart.

Persist indicator, view, range and nominal currency using the existing explorer URL-hash approach, with stable ASCII values (`real`, `nominal`, `growth`, `per_capita`; `line`, `table`; `gel`, `usd`). Validate unknown values and clamp ranges; invalid state falls back safely. Switching language retains compatible state. Hash variants are not separate canonical SEO pages.

## 6. Table and Excel

Reuse ExplorerTable: one indicator row, chronological year columns, existing sticky labels, horizontal scrolling, number formatting and missing-value conventions. Do not add a cumulative/change column. The growth tab already is the requested annual change measure.

One Excel action exports the active indicator, range, currency and language. Use the existing three-sheet workbook appearance and native XLSX writer, not the standalone research workbook or CSV downloads.

- Readable table: one indicator row, selected years as columns.
- Data sheet: typed year/value/unit and applicable status using labels appropriate to the active indicator. Never label USD amounts or percentages as GEL.
- Sources sheet: only relevant original sources, with readable archive links and publication context.
- Real GDP retains full constant-2015 USD values; nominal amounts retain full currency amounts; per-capita values retain per-person units; growth retains percentage meaning consistently with Excel percentage formatting.
- A preliminary flag is visible for affected Geostat years in both table presentation and workbook. Internal hashes, source cells and accounting metadata stay in the internal manifest/methodology rather than cluttering public data columns.

Any small required extension to the shared workbook model must preserve existing Budget and Debt export contracts; no global relabeling of amount columns.

## 7. Data and provenance implementation boundary

Research package location at specification time:
`C:/Users/Mylaptop/.codex/visualizations/2026/09/09/01a08781-3744-72d2-a57e-552083073a21/gdp-final/Georgia-GDP-complete-data-package.zip`.

Import only GDP overview inputs from that package. Do not load sectors/regions into the application for this milestone.

Relevant extracted files:
- `real-gdp-1960-2025.csv`
- `real-gdp-growth-1961-2025.csv`
- `nominal-gdp-gel-usd-1996-2025.csv`
- `nominal-gdp-per-capita-gel-usd-1996-2025.csv`
- Original source files and the source/validation manifests.

Move approved source snapshots into a durable repository raw-data archive with documented provenance during implementation; do not leave runtime/build dependencies on a conversation directory. Establish a deterministic prepare/check script and reviewed canonical CSV imports using existing repository conventions. Reuse the existing national nominal GDP facts where identical; reconcile all years before extending their use. Do not change the budget GDP denominator or downstream budget ratios as a side effect.

Keep clear distinctions between currency, price basis, unit, source, period and status. Use stable metric IDs. Check duplicate years, expected coverage, missing versus zero, finite numeric values and source parity. Recompute World Bank growth from real levels as a validation only, retaining published growth as the delivered series. Verify Geostat published currency pairs against the archived annual rate within source precision.

Serving follows the established reviewed-CSV/static build path and any required database-mirror conventions in `docs/data-methodology/database-import.md`. No direct database edits and no runtime source downloads. The implementation plan must specify how new facts participate in the current serving mode and parity checks before schema changes are made. All chart data is bundled/prerendered; no new request-time route.

Add a concise GDP methodology page and untouched original-source downloads through the current archive tooling. WB originals are JSON; label them accurately, without presenting them as original Excel. Record source release and capture dates separately. An unavailable or changed upstream file does not authorize replacing the reviewed snapshot during an ordinary build.

## 8. Direct component reuse

Reuse or narrowly extend these existing components:
- `DataSidebar`, `SectionNav` patterns, explorer layout and `SiteFooter`.
- Existing budget hub card components and `PageHeader`.
- `TextTab`, `SegmentedTabs`, the existing chart-toolbar share-pill styling adapted to currency.
- `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `HorizontalScrollHint`.
- `ExcelDownloadButton`, `SourceNote`, existing download writer and formatting helpers.

New code should own GDP data selection/state, the GDP-specific labels/units, and Economy navigation/card definitions. Do not copy/paste chart rendering, slider logic, tooltip handling, table markup, or design tokens. Do not edit shared components merely to make the exploratory preview's design match.

Use actual site fonts, breakpoints and compact controls. The standalone preview wrapper, duplicated sidebar and its auxiliary styling are not production assets. No new design library, chart library, theme or global visual refactor.

## 9. Localization and accessibility

Ship Georgian and English through the existing message/route system. Proposed Georgian labels: Economy `ეკონომიკა`; GDP overview `მშპ-ის მიმოხილვა`; Real GDP `რეალური მშპ`; Nominal GDP `ნომინალური მშპ`; GDP growth `მშპ-ის ზრდა`; GDP per capita `მშპ ერთ სულ მოსახლეზე`.

Provide equally clear units, constant-price labels, preliminary notes, methodology and workbook text in both languages. No hardcoded English in Georgian tooltips or exports. Tabs and currency controls need meaningful labels and selected state, keyboard focus and stable touch targets. Follow the existing tab/control semantics, extending shared behavior only when required for accessible focus/selection.

## 10. Verification and acceptance

Data checks:
- Reproduce 66 real observations, 65 growth observations and 30 nominal/per-capita currency pairs from the approved snapshot.
- Source hash and extraction parity; no source splice, invented growth, forecasts or population recalculation.
- Existing nominal GDP denominator and budget ratios remain unchanged.

Behavior checks:
- All four tabs show the correct series, units, source and coverage.
- Currency toggle is present only for nominal tabs; values match the source.
- All/manual range transitions, no-overlap fallback, quick ranges, single-year selection, hash restoration and language switching behave as specified.
- Chart and table agree; negative growth and historical decline display correctly; missing observations remain gaps.
- Downloaded workbooks match indicator/range/currency/language and preserve status and sources.

Visual/browser checks:
- Compare GDP beside an existing Budget/Deficit explorer at desktop and mobile sizes, in both languages.
- Confirm reuse of chart grid, tooltip, text sizes, controls, spacing and slider; no custom SVG chart implementation.
- Centered tabs remain readable and keyboard reachable; no clipped axes, page-level overflow or off-screen currency controls.
- Existing Budget routes, sidebar states, charts and workbooks retain behavior.

Run the relevant targeted checks during work and the required final gates from CLAUDE.md (`check`, `build`, browser tests) once implementation is ready. Spec-only work does not claim those application gates have been run. Publishing remains a separate authorized delivery stage, using the required branch/PR/CI workflow.

## 11. Authority and next step

Approval of this document authorizes the bounded Economy/GDP feature described here, not broader economic indicators. During implementation update Project_Definition.md section 2 and the relevant DESIGN.md sections to record this explicit scope extension; retain other exclusions.

After user review, produce the implementation plan with concrete file boundaries, data preparation, component integration and verification steps. Do not start production implementation from the previews or from the spec-writing request alone.


### User refinement - 2026-09-11

Display the page and its navigation/card label as **Economy overview / ეკონომიკის მიმოხილვა**. Keep the GDP route and four indicator names. GDP growth chart inputs use percentage points (10 means 10%), matching the existing chart contract; table and workbook values remain fractions. Per-capita chart axes use compact currency symbols (₾ / $), with full localized units above the chart.


### Confirmed currency control - 2026-09-11

Use the joined **₾ | $** currency selector approved in the preview, reusing `SegmentedTabs` and its Chart/Table styling, with 40px minimum button widths. Keep GEL/USD accessible names, existing selection persistence, and full units above the chart. This supersedes the earlier separate currency-pill styling.


### Heading metadata refinement - 2026-09-11

Place price-basis and measure details beneath the heading summary, before the indicator tabs. Remove the standalone chart-toolbar unit line. Nominal GDP displays only current-price context there; per-capita adds per-person context, without repeating the selected currency. Real GDP retains its fixed constant-2015-USD basis; growth retains its annual percentage context. Currency controls, values and exports retain their existing meaning.


### Publication-readiness scope approval - 2026-09-11

The user approved completing the readiness review's gaps. This expands the prior local-UI-only milestone to GDP MCP queries, bilingual AI discovery, central JSON/CSV publication and manifest entries, overview Dataset metadata, and disposable-database migration/import/rollback validation. Preserve the six reviewed series and existing budget denominators; no new economic indicators, ranking or cumulative comparison features are authorized. Implementation steps are in `../plans/2026-09-11-gdp-publication-readiness.md`.
