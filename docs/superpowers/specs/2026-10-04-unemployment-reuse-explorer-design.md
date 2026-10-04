# Unemployment explorer — first version using existing components

Date: 2026-10-04
Status: Design and inline implementation plan approved in this conversation on 2026-10-04, after clarification of the rate, count and supporting-indicator scope. Implementation is in progress; publication and deployment are not authorized.

## 1. Intended result

Make the collected annual unemployment data understandable inside Fiscal.ge's familiar explorer. Readers should be able to see a trend, compare published groups, inspect the same figures in a table and download their selection to Excel.

Use the production editorial appearance and existing chart components. The first version adds no heatmap, paired-dot chart, scatterplot, new chart library or redesigned dashboard.

This is a new dataset integration, even though its visual components already exist: the current application has an unemployment coming-soon marker and the data remains a research package. The feature needs a reviewed serving dataset, one public explorer and its source/methodology support.

## 2. Included pages and navigation

- One unemployment explorer at `/explorer/unemployment`, with its English mirror at `/en/explorer/unemployment`.
- Replace the existing unemployment coming-soon marker with a working link in the current sidebar position. Demography keeps its current behavior.
- One methodology page at `/methodology/unemployment` and its English mirror, using the current methodology components and original-source archive tooling.
- Use the existing page heading, breadcrumbs, coverage/review date, source note, language switch, page metadata and sitemap patterns.
- No separate region, age or education detail routes. These are selectable groups inside the one explorer.

The existing non-clickable unemployment marker is activated only when the page, validated serving data, methodology and source downloads are ready together. This design proposes the bounded scope extension; `Project_Definition.md` and the affected marker descriptions in `DESIGN.md` change during approved implementation.

## 3. What the reader sees

### Main workspace

Reuse the national economic-sectors workspace as the closest implementation pattern:

- Existing line chart and Chart/Table switch.
- Existing annual year-range controls.
- Existing right-hand searchable, unlimited series selection.
- Existing Clear/Select all controls and selection count.
- Existing Excel download action for the active indicator, years and selected series.
- Existing empty-selection, empty-range and missing-value treatment.

Default to the national unemployment rate, the full available comparable annual range and only the Georgia total selected. In the collected package this means 2010–2025 and a final-year headline of 13.9%; neither coverage nor values are hardcoded.

Show one indicator at a time so counts and percentages never share an axis. The compact indicator control follows the existing editorial control appearance. Available indicators depend on the active breakdown:

| Breakdown | Available indicators |
| --- | --- |
| National, sex, urban/rural, age and regions | The eight published core indicators: unemployment rate, unemployed people, employment rate, employed people, participation rate, labour force, people outside the labour force and survey population aged 15+ |
| Education | Unemployment, employment and participation rates only |
| Long-term unemployment | Long-term unemployed people, their rate relative to the labour force and their share of all unemployed people |

Place the breakdown control above the series search, using the existing control and selector layout. The choices are National, Sex, Urban/rural, Age, Regions, Education and Long-term. Education also has the source-supported Total/Women/Men choice, using the existing segmented-tab component. Other breakdowns do not gain a sex filter that their source lacks.

Each breakdown keeps its applicable, separately published total/reference first, selectable and removable. For education this is the matching national or sex rate from the core workbook; it is not an average of education rates. Education defaults to Total. Long-term defaults to its published Georgia total. Switching breakdown resets selection to that reference and keeps the indicator when it exists in the destination; otherwise it selects the destination's unemployment-rate measure and visibly updates the indicator label. Switching to Long-term selects the long-term unemployment rate when the previous measure has no matching long-term measure.

Available years come from the active breakdown and measure, including its reference. Clamp an incompatible selected range to the loaded coverage and announce the resulting range using the existing accessible status pattern. Preserve compatible settings when switching chart/table mode or language. Save the active indicator, breakdown, education sex, years and selected series through the existing URL-state approach so a shared link reproduces the view.

Bulk actions apply to every series in the active breakdown, independently of the search. A selected series without a value in the selected final year shows a dash; its count and checked state remain visible. Category colors stay stable when searching, changing years or changing indicators.

### Population composition

Below the main workspace, reuse the existing stacked-column chart for the three mutually exclusive national groups: employed, unemployed and outside the labour force. Use counts in thousand persons over the active year range, with a clear Georgia/aged-15+ label. This adds no derived percentage dataset and avoids stacking rates with different denominators.

This national context chart is independent of the main chart's checked groups. It uses exact source values for the stack and the source's one-decimal display precision. Its tooltip and accessible label explain all three parts. It does not invent transitions between people or reasons for being outside the labour force.

## 4. Data and comparison rules

Use the existing research package and `docs/data-methodology/unemployment-annual.md` as the data authority. Do not recollect, reinterpret or overwrite its captured official workbooks.

- Promote the three validated primary files into reviewed canonical inputs under `data/imports/`, preserving exact decimal values, published precision, source references, annual frequency, actual basis and survey-estimate status. The serving dataset contains 2,872 core, 216 education and 54 long-term observations: 3,142 in total.
- Maintain stable ASCII IDs and reviewed Georgian/English labels. Education series identity includes sex. Retain wider historic age bands and combined historic regions as distinct series with explicit coverage in their labels or supporting text.
- Do not join pre-2010 data to the comparable main series, split old age bands, distribute combined regional figures or replace unavailable values with zero. Existing line gaps and table dashes represent missing coverage.
- National/sex/settlement data currently cover 2010–2025; five-year age bands start in 2020; education and long-term start in 2020. Separate Imereti and Racha-Lechkhumi/Kvemo Svaneti start in 2019; separate Guria, Samtskhe-Javakheti and Mtskheta-Mtianeti start in 2017. All controls derive their inventories from facts and explicit coverage.
- Show counts in thousand persons and rates to one decimal. Retain stored precision for validation and serving parity without implying additional sampling accuracy.
- Unemployment rate divides unemployed people by the matching labour force. Employment and participation rates divide by the matching survey population aged 15+. Long-term rate and long-term share have different denominators and explicit distinct labels.
- No education counts or No education rates are published in the collected primary dataset; do not calculate or fabricate them. Its source distributions stay validation evidence.
- Keep a concise survey-estimate/source note visible. The methodology explains classification changes and sampling limitations. Do not claim statistical significance for differences or rankings.

## 5. Serving, sources and Excel

Follow the existing static CSV/database architecture. Add a dataset-specific validated loader, numeric client projection and database mirror mapping without changing unrelated dataset interfaces. Extend the transactional `data:import` pipeline with a versioned Prisma migration, uniqueness constraints, registered sources and exact field/value parity checks. Do not edit or import into a live database during implementation; production migration/import belongs to separately authorized delivery.

Keep the application statically rendered. The page never fetches survey data or reads original workbooks at request time. CSV mode remains available; database mode must fail on a missing or mismatched mirror rather than silently serve different figures.

Register and archive the seven workbooks, source page and metadata through the existing validated methodology/source pipeline. Preserve fingerprints and retrieval dates. Georgian and English methodology text should explain the reader-facing definitions, changing group coverage and survey limitations before extraction detail.

Reuse the three-sheet Excel writer and source-link validation. The workbook contains the active indicator, selected groups and selected years, with correct count/percentage units, missing cells and basis status. The Data sheet uses unemployment-specific headings, such as Number (thousand persons) or Rate (%), rather than GEL/budget headings. Reuse generic formatting where available; make only narrow optional label adaptations if a financial heading is currently fixed. Do not expose internal source-cell or mapping metadata as public analysis columns.

This request authorizes the explorer and its normal Excel/source support. Adding unemployment MCP tools, central machine-readable publications, quarterly observations, forecasts, NEET, municipal unemployment or cross-dataset comparisons remains outside this first version. Metadata must not advertise a downloadable dataset address that does not exist.

## 6. Verification and scope control

Before implementation, review this written design; after approval, prepare and review the implementation plan according to the repository workflow.

The implementation must prove:

1. Canonical inputs reproduce all 3,142 primary observations and explicit source/coverage boundaries; validation rejects altered values, missing groups, duplicate identities and exchanged long-term denominators. The research package's existing checks continue to pass.
2. CSV and database mappings preserve the same fields and exact decimals. Import validation/parity failures roll back the whole transaction.
3. National, age, combined-region, education and long-term examples show the matching official values. Chart, table, selector and Excel agree for the same settings. Composition reconciles against the national survey population using stored source precision.
4. Defaults, unlimited selection, bulk behavior during search, changed coverage, missing values, unit switching, URL state, language changes and empty states work as described.
5. Both languages render correctly at 390, 768 and 1440 pixels, including long Georgian/English labels, keyboard controls, downloads and source links. Existing explorer browser checks remain green.
6. Run the narrow relevant checks during editing, then `npm run check`, `npm run build` and the UI browser completion gate once. An independent code review checks the final feature against this scope before any delivery.

Expected implementation areas are dataset preparation/loading/parity, the dataset-specific explorer model and state, the reused-component page wrapper, Excel labels/model, bilingual messages/navigation/metadata, methodology/source archives and focused regression/browser tests. Preserve the shared visual components wherever their existing inputs already support the data; do not refactor unrelated explorers.

Publishing, pushing, opening a PR, merging and deployment require separate authorization. Their required CI and production-commit/URL verification remain unchanged.
