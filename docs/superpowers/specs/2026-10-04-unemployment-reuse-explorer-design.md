# Unemployment explorer — first version using existing components

Date: 2026-10-04
Status: Design and inline implementation plan approved in this conversation on 2026-10-04, after clarification of the rate, count and supporting-indicator scope. Implemented and locally verified on 2026-10-05, with independent reviews and regression-tested fixes. The user authorized GitHub delivery, synchronization and the CI-gated production release on 2026-10-05. The four-card navigation amendment in §7 was separately approved on 2026-10-05 and supersedes the earlier single-page navigation and breakdown-control descriptions.

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

## 7. Approved four-card navigation amendment — 2026-10-05

The user corrected the initial single-page structure to match the Budget, Economy and Inflation section hubs. The unemployment hub at `/explorer/unemployment` reuses the existing cards and links to four static data pages in this exact order:

| Card | Data page |
| --- | --- |
| National overview | `/explorer/unemployment/overview` |
| Regions | `/explorer/unemployment/regions` |
| Age groups | `/explorer/unemployment/age` |
| Gender | `/explorer/unemployment/gender` |

The national overview uses the existing editorial text tabs for Overview, Urban/rural, Education and Long-term unemployment. Those supporting subjects have no separate cards or routes. Education retains its Total/Women/Men control. The national composition chart belongs only to the Overview tab. The other three data pages fix their own comparison, retaining the national reference, unlimited series selection, indicators, years, table and Excel action.

The sidebar repeats the four-card order. Every page has its own heading, description, breadcrumbs, bilingual metadata and sitemap entry. Card years and the national sparkline come from the served facts. Other cards show annual coverage without inventing an aggregate for their groups. Each page receives only its own data and necessary reference facts. Existing shared links migrate from the hub to the matching data page with their hash settings preserved; incompatible hashes cannot change a page into another main section.

Verification must cover card destinations and page defaults in both languages at 390, 768 and 1440 pixels, supporting-tab controls and coverage, history and language switching, legacy-link migration, selected-group table/Excel agreement and source links. Reviewed observations, database structure, original archives and the MCP/publication boundary stay within their existing approved scope. This amendment authorizes implementation; publishing remains a separate operation.

## Approved overview selection amendment — 2026-10-06

The regional map/detail amendment approved later on 2026-10-06 supersedes this section's retained regional dropdown. The user explicitly chose Economy's region-only map/list and separate static `/explorer/unemployment/regions/[id]` pages, mirrored under `/en`, with the existing region picker. The map shows the latest published unemployment rates for eleven modern regions, with non-interactive occupied overlays and reused hover/focus/keyboard interactions.

Region detail and historical comparison views reuse the completed overview's indicator checkboxes, replacing the dropdown. The initial seven indicators omit employment rate; the regional employment-status amendment below adds two children under Employed. Only the selected region's unemployment rate is initially selected, first and removable. Percentages/counts are mutually exclusive; multiple compatible indicators, search-independent bulk actions, charts, tables, range controls and three-sheet Excel exports follow the overview rules. Region names appear in metadata, breadcrumbs, headings, workbook titles and filenames. Each region uses its own published years. Earlier combined groups remain separate in an index comparison view; former shared links retain their groups, years and view with the new checkbox identities. This supersedes the original map/detail exclusion. The navigation change alters no source archives, municipal data or database structure; the data addition is specified below. External publication remains separate.

## Regional employment-status amendment, approved 2026-10-06

The user approved adding Hired and Self-employed beneath each region's Employed row, matching the completed national overview. The archived regional workbook already contains both categories for eleven modern regions in 2020–2025. The earlier description treating them as unavailable was incorrect and is superseded by this amendment.

Promote exactly 132 primary observations to the existing employment-status CSV, preserving all source columns and decimal tokens. Exclude repeated Georgia controls and leave all original captures and the three original canonical CSVs unchanged. Validate the source cells, reconcile hired + self-employed + the unpublished-in-UI unidentified-worker component with Employed, and reconcile regional category totals with the national source.

Use the existing expandable rows and separate rate/count selection rules. A region's selected-series coverage retains its longer Employed history when the parent and children are selected together, with gaps before 2020. Selecting only the children fits to their published 2020–2025 coverage. Display the coverage and remainder explanation in both languages; charts, tables, saved settings and Excel downloads preserve the same values and missing cells. No new database structure, live database import or publication is part of this amendment.

This amendment replaces the overview's single-indicator dropdown and export decisions above. Rename its card, sidebar link and heading to Unemployment overview / უმუშევრობის მიმოხილვა. The Regions, Age groups and Gender pages retain their approved controls.

The national checkbox list uses indicators instead of a Georgia row. Remove employment rate from this overview. Employed people expands to Self-employed and Hired employees. Urban/rural parents select the corresponding unemployment rate and expand to the remaining measures, with employment status grandchildren. Long-term metric parents select Georgia and expand only to Men and Women. Education offers only unemployment rate, retaining education-level checkboxes and Total/Women/Men.

The user explicitly chose mutual exclusion: selecting a percentage unselects all people counts; selecting a people count unselects all percentages. Multiple measures of the same unit remain selectable. Bulk selection uses all series of the current unit, regardless of search. The default is the applicable published unemployment rate. Selections, years and view survive URL restoration and language changes; incompatible mixed selections keep the last valid selected unit. Tables and workbooks identify every selected indicator/group pair, with one unit and exact official source values.

Promote the 96 national/settlement hired and self-employed annual observations from the preserved source extract into an additional canonical BOM CSV. Validate source cells, complete coverage, employed = hired + self-employed + unidentified, and urban/rural component sums. Preserve the unclassified remainder in the official employed total, with a visible explanation. The existing parity-checked import handles the new rows without a schema change. No source recapture, live database write, publication or deployment is authorized by this amendment.

## Gender selection amendment — 2026-10-07

The user requested the Urban/rural selection pattern on the Gender page. Remove the separate indicator dropdown and single-indicator headline. Men and Women select their own unemployment rate and expand to the seven other existing gender indicators, including employment rate. Keep the national unemployment-rate reference first, selectable and selected alone by default. Reuse the existing checkbox panel, percentage/count exclusion, search-independent bulk actions, chart, table, range and Excel export. Labels identify the group and indicator; saved Men/Women comparisons preserve their indicators, years and view across reloads and language changes.

Former national-only Gender links fall back to the national unemployment rate; deliberately empty selections remain empty. This supersedes the earlier retained Gender controls. No data additions, hired/self-employed estimates, age-page changes, database writes or external publication are included.
