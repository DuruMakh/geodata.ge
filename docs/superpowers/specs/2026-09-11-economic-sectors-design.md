# National economic sectors — implementation specification

Date: 2026-09-11
Status: Implementation authorized in this session on 2026-09-11; in progress.
Scope: National economic activities, annual 2010–2025, one chart workspace.

## 1. Product decision and design authority

Build the national Economic sectors page inside the existing Economy section. It should help readers compare the size of economic sectors, their share of GDP, and their annual real growth using the same selected sectors and time range.

Confirmed user decisions:

- National sectors only. Regional sectors belong to a separate Regional economies implementation.
- Annual 2010–2025 is the initial period.
- One chart workspace with a compact measure switcher; no separate top-level indicator tabs.
- Include nominal amounts, share of GDP and real growth in that switcher.
- Reuse existing components and the current design system.
- The exploratory HTML preview is only a rough interaction sketch. Its visual design was rejected as too different from the site.

**DESIGN.md v4.1 and the existing production explorer components govern the implementation. Neither preview version is a visual reference or production asset.** Do not copy its HTML, CSS, sidebar, fonts, sample lines, selected-five default, dark selector, supplementary cards or spacing. Preview values and line shapes are not a data source.

The user authorized implementation of this specification in this session on 2026-09-11. Publication remains separately authorized. Following source inspection, the user approved nominal values and GDP shares for 2010–2025 and real growth for 2011–2025. Measure-specific coverage controls the available range; missing 2010 growth is not estimated.

## 2. Included scope and boundaries

Deliver:

- `/explorer/economy/sectors` and `/en/explorer/economy/sectors`.
- The 20 published NACE Rev.2 activities A–T, plus one national GDP reference series.
- Nominal GEL, share of same-year GDP, and annual real growth.
- Existing line/table modes, range controls, searchable unlimited selection and Excel download.
- Georgian and English presentation, concise source notes, methodology and archived originals.
- Reviewed data preparation, validation, CSV/database parity, and static rendering.
- Publication readiness through the existing read-only MCP and central static data downloads, using the same reviewed facts and definitions.

Excluded: regional or municipal sectors, pre-2010 historical classification splicing, quarterly data, forecasts, sector detail routes, employment, wages, turnover, productivity, investment, exports, real-level/index modes, USD conversion, stacked/bar charts, growth contributions, and ranking/KPI sections beyond the four approved highlights below, or historical essays. The analogy to the existing ₾ / $ switch concerns the control's appearance and behavior; it does not add a USD measure here.

Approved highlights extension: four existing-style KPI blocks below the workspace use the selected final year and every national activity, excluding GDP from ranking. Show largest nominal sector with its GDP share; maximum annual real growth; minimum annual real growth (labelled largest decline when negative, slowest growth otherwise); and sum of the GDP shares of the three largest nominal sectors. The top-three denominator remains national market-price GDP, not selected-sector or total GVA. If every sector declines, the maximum-growth block says smallest decline. Ties follow stable classification order. Year 2010 leaves the growth blocks unavailable and states the source-derived first growth year. Summary values do not change with checked series or active chart measure, only with final year. Preliminary status and Geostat source remain visible. No new data imports or public query measures are added.

Do not reproduce Budget's derived indicators below the workspace automatically. A sector's annual real growth is not nominal budget growth, a sum of growth rates, or a contribution to GDP growth.

Approved visual correction: the highlights use Budget/municipality detail's one large hero plus three stacked side KPIs, not four equal columns. Reuse the existing 1.35fr/1fr split, 62px/44px hero value, 24px side values, separators and Sparkline component. The hero gauge represents the largest sector's GDP share, not a period-change gauge. Decorative side trends trace the selected year's winning sector(s) from the first available year through the selected year; the top-three sparkline keeps those same three members fixed. Gaps remain null and insufficient history draws no line. Headline calculations and selection independence are unchanged.

## 3. What data already exists and what remains

The source inspection during this discussion established the following distinction: sector rows already exist in an archived workbook, but the current application preparation reads GDP totals rather than serving the sector rows.

| Requirement | Evidence available | Implementation work |
|---|---|---|
| Nominal sector value added | `docs/Raw Data/Economy/gdp-overview/sources/geostat_nominal_current.xlsx`, sheet `GDP at current prices`, activity rows 3–22 | Extract annual columns only; review and normalize all 20 activities |
| National nominal GDP and reconciliation | Same workbook: basic-price total, taxes on products, subsidies on products and market-price GDP, rows 23–26 | Preserve source precision; reconcile every year and reuse the same-vintage total |
| GDP shares | Numerators and denominator in the same nominal workbook | Calculate sector value added / market-price GDP |
| Sector annual real growth | Not yet archived and validated for this feature | Obtain and review official Geostat activity-level volume/growth data |
| Public sector dataset | No reviewed sector serving dataset currently established | Add canonical inputs, validation, serving, exports and discovery |

The nominal workbook is also preserved as `docs/Raw Data/GDP/national-nominal-gdp/official/03_GDP-at-Current-Prices.xlsx`; the inspected copies have identical bytes. Reuse registered originals and archive tooling rather than creating unnecessary duplicate downloads.

The inspected nominal sheet's data area is `A1:CE39`. Annual headers are interleaved with quarters, so extraction must identify and validate headers rather than read every numeric column as an annual year. Validate activity labels/codes and total-row labels as well as positions. The approved selection is 2010–2025; retain 2025's preliminary flag from the source.

Use Geostat's official [GDP source page](https://www.geostat.ge/index.php/en/modules/categories/23/gross-domestic-product-gdp) to obtain the activity-level real series. Candidate publications are GDP at constant prices and Real GDP Growth; neither candidate's sector coverage, units or full annual comparability is considered verified by this spec.

The first implementation milestone must establish the exact workbook, sheet, annual columns, classification, valuation, units, status and release vintage for real growth. Prefer published annual sector growth. If only comparable volume levels are provided, calculate growth as described below and document that it is calculated. An aggregate-only growth workbook does not satisfy this requirement.

For a 2010 growth observation, use a published 2010 annual rate or a comparable 2009 volume observation from the same reviewed series. Do not derive it from an incompatible legacy classification. Supporting 2009 inputs may be archived without extending the public range before 2010. If the required growth coverage cannot be validated, report the exact missing activity/years before presenting the full feature as ready; never substitute nominal growth or silently drop the mode.

## 4. Activity registry and accounting meaning

Keep one flat, bilingual registry in official A–T order:

| Code | Activity meaning |
|---|---|
| A | Agriculture, forestry and fishing |
| B | Mining and quarrying |
| C | Manufacturing |
| D | Electricity, gas, steam and air conditioning supply |
| E | Water supply; sewerage, waste management and remediation |
| F | Construction |
| G | Wholesale and retail trade; repair of motor vehicles and motorcycles |
| H | Transportation and storage |
| I | Accommodation and food service activities |
| J | Information and communication |
| K | Financial and insurance activities |
| L | Real estate activities |
| M | Professional, scientific and technical activities |
| N | Administrative and support service activities |
| O | Public administration and defence; compulsory social security |
| P | Education |
| Q | Human health and social work activities |
| R | Arts, entertainment and recreation |
| S | Other service activities |
| T | Activities of households as employers and for own use |

These are source activity categories, not the site's budget spending fields. In particular, public administration is an economic activity, not a measure of all government spending. Keep the household row and small values; no top-five truncation or invented residual sector.

Use stable lowercase ASCII identities such as `sector.a` through `sector.t`, and `economy.gdp_total` for the reference series. Store official full names and reviewed Georgian/English display labels separately. The names above define the intended mapping; final display translations must be checked against official Georgian terminology. Codes need not occupy scarce chart-label space; search can match them and both languages.

Sector amounts are gross value added (GVA) at basic prices. National GDP is measured at market prices:

```text
sum of sector GVA = total GVA at basic prices
GDP at market prices = total GVA + taxes on products − subsidies on products
```

The selectable national reference is labelled `მთლიანი მშპ` / `Total GDP`, not “total sector value added.” It uses the published market-price GDP amount, 100% in GDP-share mode when the denominator is present, and the reviewed Geostat national real GDP growth in growth mode. Its nominal amount is not a sum of the 20 displayed sectors; explain the tax/subsidy distinction in the short share-mode note and methodology. Do not expose taxes and subsidies as extra sectors or allocate them across activities.

## 5. Measures, units and numerical rules

Approved presentation refinement: use `სექტორები` / `Sectors` as the short page/card/sidebar/workbook name. Share/growth descriptions are concise, with a stable-height description area across measures; remove the redundant measure/unit row below the chart/table buttons. Tooltips appear on hover or keyboard-visible focus, not latched mouse/touch click focus. Display order follows the active measure's selected end-year value descending in selector, table and workbook; GDP stays first, missing values last, classification order breaks ties. This supersedes earlier visible unit-row and fixed display-order wording, without changing canonical IDs, values, methodology caveats or source accounting.

| Switch label (KA / EN) | Meaning | Calculation/source |
|---|---|---|
| `₾` / `₾` | Nominal value added at current prices; total row is GDP | Published million GEL multiplied by 1,000,000 |
| `% მშპ-ში` / `% of GDP` | Sector size relative to the whole economy | Same-year sector nominal GVA / same-year nominal GDP at market prices |
| `რეალური ზრდა %` / `Real growth %` | Annual change in volume, removing price changes | Published sector annual volume growth, or comparable volume levels: `100 × (level[t] / level[t−1] − 1)` |

Use the existing `SegmentedTabs` component for the three-way measure control, as already used for the GDP currency switch. This is a bounded use of that existing control, not new top tabs or a redesign of Budget controls. Show one active measure and one vertical scale at a time.

Approved icon refinement (2026-09-12): the labels above remain accessible names and hover/focus explanations, not long visible button text. Render literal `₾`, Lucide `ChartPie` and `ChartNoAxesCombined` in that order, following the functional icon standard in `DESIGN.md` §7.2a. The selected measure remains readable beside the chart for touch users. This changes presentation only, not values or state behavior.

GDP share is **not** sector GVA divided by the sum of selected sectors or by total GVA. The 20 sector GDP shares are not forced to sum to 100%; net product taxes explain the difference. The earlier preview's “% GDP” label attached to a GVA denominator is superseded by this rule.

Use the market-price denominator from the same reviewed nominal source vintage as sector GVA. Reuse the GDP overview's full-precision nominal series where it is identical, with explicit parity checks. Do not modify the existing rounded national Budget denominator or change Budget ratios as a side effect. Document precision differences without representing them as different accounting definitions.

Retain canonical decimal precision through extraction and validation. Round only for display. Nominal chart/table units use the existing shared formatting rules, normally billions of GEL, with sufficient supported precision and below-threshold formatting so small household-sector values never become fake zeros. Standalone row and tooltip amounts use the existing amount formatter.

Precision correction (2026-09-13): extract original numeric XML text for sector values, GDP denominators, growth indices and supporting volumes. Preserve the existing GDP overview file unchanged; verify its exact legacy numeric projection and report the tiny representation difference separately, as specified in the sector methodology. Do not discard source digits to force cross-dataset string equality.

At the canonical/public machine-data boundary, real growth uses percentage points (`7.5` means `7.5%`), and calculated GDP shares use explicitly labelled percent values. At the existing UI adapters, `EditorialLineChart` takes percentage points, while percentage table/workbook cells use fractions (`0.075` displayed as `7.5%`). Convert exactly once at each boundary and test it.

Never sum or average sector growth rates to produce total GDP growth. Chain-linked volumes are not assumed additive. A missing or invalid previous level yields missing growth, not zero or infinity. GDP shares require a present, positive denominator. Preserve negative observations and distinguish missing data from true zero.

Preliminary is a publication status, not a budget plan or forecast. A derived share is preliminary if either input is preliminary; calculated growth inherits relevant input status. Keep status at observation level, since source vintages or activity coverage can differ. Do not label every sector final merely because the nominal total is available.

## 6. Page composition and direct component reuse

Use the current Budget explorer's workspace composition and the Economy overview's navigation/header conventions. Do not mount the whole Budget explorer with artificial budget categories merely to obtain its styling.

| Page responsibility | Existing implementation to reuse |
|---|---|
| Shell, sidebar, breadcrumb and footer | `apps/web/components/shell/`, `PageHeader`, existing explorer layouts and `SiteFooter` |
| Workspace geometry and responsive placement | `apps/web/components/main-explorer/explorer-view.tsx` and its existing container rules |
| Joined mode and measure controls | `SegmentedTabs` in `apps/web/components/ui/editorial.tsx`; current currency usage in `components/gdp/gdp-overview.tsx` |
| Chart and tooltip behavior | `EditorialLineChart` in `components/main-explorer/editorial-line-chart.tsx` |
| Table and horizontal scrolling | `ExplorerTable` and `HorizontalScrollHint` |
| Year range and quick ranges | `RangeStrip` |
| Search, counts, bulk action and rows | `SeriesSelector` and `SeriesSelectorRow` in `components/main-explorer/series-selector.tsx` |
| Notices, swatches and source copy | Existing `Callout`, `SwatchBar` and `SourceNote` |
| Excel action and workbook styling | `ExcelDownloadButton`, `lib/explorer/workbookModel.ts`, `workbookWriter.client.ts`; GDP workbook adapter as reference |
| Data/locale/navigation integration | Existing GDP loaders, message catalogues, `pageHref`, Economy hub model and archive registries |

Composition:

1. Existing breadcrumb and data-derived coverage/review-date row.
2. H1 `ეკონომიკის სექტორები` / `Economic sectors`, followed by a compact national-reference summary and active-measure explanation in the existing heading styles.
3. Standard workspace: chart/table column plus the standard 292px paper-backed series aside when the content column has sufficient width.
4. Chart toolbar: existing Line/Table control on the left; compact three-way measure control on the right. Wrap controls in the existing mobile flow; no new top tabs.
5. Chart or table, then existing range strip and concise source note. The GDP-share note explains sector GVA versus total GDP; growth context explicitly says annual real growth.
6. Aside: existing heading, search, action/status row, scrollable series list and dataset-owned Excel button.
7. Existing site footer and its methodology discovery path.

The headline is an explicitly labelled national reference at the last available year within the active range and measure, independent of sector selection. In GDP-share mode it reads Total GDP, 100%, rather than describing this as a sector composition total. No extra YoY delta is attached to an already annual-growth headline. If a reference observation is absent, use the existing missing presentation; do not show a value from outside the range.

Preserve actual site fonts, tokens, ink rules, stable swatches, dot-grid chart, tooltip behavior, spacing, compact controls and content-container breakpoints. Only the navigation shell is dark. The sector panel stays on paper. Reuse stable series-color utilities; provide deterministic assignments for all 20 sector IDs, verified for distinguishability and contrast rather than blindly cycling duplicate colors after the existing palette is exhausted. Keep the GDP reference ink-coloured and colors stable across measures, language, ordering and selections.

New feature code should own the sector registry, source transformations, state and model adapters, sector-specific copy and workbook content. Prefer existing component props. A narrow backwards-compatible extension is allowed where the data meaning requires it, for example observation-level preliminary annotation. Do not fork chart/slider/table rendering, add a library, duplicate shared markup wholesale, or refactor unrelated pages. Keep full source names available in accessible labels/table content even where compact visual labels are necessary.

## 7. Selection, state and edge behavior

Defaults: nominal GEL, line mode, full loaded annual range, and only Total GDP selected. This follows the existing total-only contract; the preview's five selected sectors are discarded.

- GDP reference first, followed by A–T in stable official order, with no grouping tabs or nested drilldown.
- All 21 rows are individually selectable and removable. The reference is pinned in search results, consistent with the shared selector.
- The ordinary status is selected / all selectable rows, initially `1 / 21`. Derive counts from the registry; do not confuse 20 activities with 21 selectable series.
- Search matches either language and activity code but affects only visible category rows. It does not change chart selection, count denominator, bulk actions or export.
- Reuse the existing bulk behavior: empty selects all; partial/full clears all. Selection is unlimited, including the total alongside sectors.
- Row values refer to the active range's end year and active measure. If missing at that year show a dash, not an unlabelled older observation. Make the value year clear in panel context.
- Switching measure preserves selection, view mode, stable colors and search. It changes values, axis, captions, headline, row values, status/source context and export together.
- Full-range state stays full range for the destination measure. A manual range retains its intersection with the destination's loaded years; if no intersection exists, use the destination's full range. Announce a changed period accessibly.
- Derive coverage from reviewed facts within the approved initial period. Do not hardcode slider limits or accidentally include workbook quarters or 2026 observations.
- Persist measure, line/table mode, range and selection through the existing URL-hash pattern. Use stable measure values `nominal`, `share_of_gdp`, `real_growth`. Distinguish absent selection state (default total) from explicit empty selection. Validate unknown IDs/values, deduplicate IDs and clamp ranges. Language switching and browser back/forward retain compatible state.
- Empty selection keeps controls available and shows the existing callout; the export is disabled. Selected rows with no observations in the range show the existing no-data state. Partial gaps remain gaps, never interpolated.
- A single-year range remains supported. An annual growth value for that year is valid because its previous-year source input is independent of the visible range; do not replace it with zero or a “period change unavailable” warning.
- Negative growth uses the existing negative-domain chart and visible zero line. A percentage axis must not be constrained to 0–100.

## 8. Table and Excel contract

Reuse the existing table with sector rows and chronological year columns. Only selected rows appear, including the reference only when selected. Preserve the existing total-row treatment, sticky names, mono values, latest-column emphasis and horizontal scrolling. No cumulative-change, CAGR, ranking or redundant trailing share column: GDP share and annual real growth already have their own measures.

Sector table names wrap within a bounded sticky column so long Georgian and English labels cannot cover the numerical columns on mobile. This opt-in shared-table extension leaves other explorers unchanged.

One Excel button exports the active measure, selected rows, range and language; search never narrows it. Use the existing three visible sheets and formatting:

- Readable sheet: sectors as rows, years as columns, clear active unit and preliminary markers.
- Data sheet: year, sector, correctly labelled active value and status. Nominal values retain full GEL. In GDP-share mode retain full nominal GEL alongside the GDP-share percentage. Growth mode contains real-growth percentage, without an unrelated nominal amount masquerading as a growth value.
- Sources sheet: relevant untouched originals with validated public archive links; GDP-share exports include the nominal numerator/denominator source, growth exports include the growth/volume source and any supporting preceding-year input needed for a derived rate.

Use correct Excel percentage cells and formats, not percent strings or a second multiplication by 100. Preserve missing cells and numeric zero distinctly. Keep source cell addresses, hashes, internal IDs, classification metadata and review mechanics in internal manifests, not public workbook data columns. Bilingual filenames and sheet names follow the existing writer conventions.

## 9. Data pipeline, serving and public discovery

Follow the established GDP preparation architecture: archived originals and reviewed source manifest → deterministic offline extraction and validation → canonical reviewed CSVs → transactional database mirror → build-time served facts. Ordinary builds never fetch upstream releases.

Add a bounded sector registry and observation dataset. Each canonical observation must identify activity/reference, year, measure, exact decimal value, unit, valuation/price basis as applicable, publication status, source identity/locator and review date. Preserve intermediate tax/subsidy reconciliation facts in staging/reporting rather than publishing them as activities. Use existing source registries where possible.

Validation must prove:

- Exactly the expected 20 activity mappings, without duplicates or missing source rows.
- Initial nominal coverage of 20 × 16 = 320 activity observations, plus 16 national references; real-growth coverage reported independently, not assumed from nominal coverage.
- Unique activity/measure/year keys, annual-only headers, finite values, explicit units/status, expected source hashes and reproducible preparation/check output.
- For every nominal year, activities sum to basic-price total, and basic-price total plus taxes minus subsidies reconciles to market-price GDP within documented source precision. Set precision tolerances before validation; do not widen them to hide extraction errors.
- Same-vintage full-precision nominal totals agree with GDP overview where shared. Existing Budget denominator files and downstream ratios do not change.
- Share calculations use the full national denominator regardless of selected sectors. GDP reference share is 100% only with a valid denominator.
- Real growth matches published rates or the documented calculation within source precision; national growth is separately sourced, and chain-linked component sums are never a validation target.
- Preliminary propagation, missing/zero handling and the 2010 prior-year dependency work explicitly.

Mirror exact decimals and all relevant fields through `npm run data:import`, with read-back parity inside the existing transaction; never write directly to production tables. Verify migrations/import/rollback using the repository's disposable-database procedure before live application. CSV and database builds must serve the same observations. Keep pages fully static.

Full publication readiness includes sector facts in the existing snapshot, capability discovery, bounded read-only queries, central JSON/CSV publications and manifests. Implement a sector-specific query contract rather than mixing activity identifiers into the existing six-series `query_gdp` contract. Support activity/reference selection, year bounds and the three measures; do not add ranking, contribution or cumulative-comparison operations. Preserve current MCP limits and scope validation. Machine responses must define percent units, GVA versus GDP, preliminary status and source references in both languages.

Register `/methodology/economic-sectors` and its English companion through the existing methodology system, with concise coverage, formulas, known gaps/status, classification and original-source archive. Activate the Economy sectors card/navigation only when the dataset and its methodology are ready together; Regional economies remains deferred. Add sitemap, canonical/hreflang, breadcrumbs, Dataset metadata and bilingual discovery using existing patterns. Do not change homepage content as part of this page implementation.

## 10. Implementation sequence and acceptance

1. Establish source completeness and accounting definitions. Archive the missing real-sector data, review bilingual activity mappings, and demonstrate annual nominal reconciliation and real-growth coverage.
2. Build the reviewed data foundation. Prepare canonical files and validation reports; verify deterministic reproduction, source precision and CSV/database parity.
3. Assemble the page from existing components. Wire the three measures, selector, range, table and Excel using the same facts and definitions; compare it directly with current Budget and Economy pages.
4. Complete methodology, archive, localization, SEO, MCP and bulk publications. Check that each surface gives the same result for the same activity/year/measure.
5. Verify the complete feature and review the changes. Publishing follows only when authorized, through the repository's branch/PR/CI/deployment workflow.

Required acceptance evidence:

- Data checks above pass, including every-year reconciliation and explicit real-growth coverage.
- Default is one total reference, with all 20 activities available; there are no top indicator tabs or prototype styles.
- Chart, table, selector values and workbook agree for nominal, GDP share and real growth, including a negative-growth year and the small household activity.
- Measure switching, empty/all selections, no-match search, single-year ranges, missing observations, deep links, reload, back/forward and language switching behave as specified.
- GDP-share denominator remains unchanged when selecting or clearing sectors. Growth remains annual when the visible range changes.
- Preliminary marks are accurate across chart context, tooltip/table, headline, workbook and machine outputs; any mixed-status cells use observation-level status.
- Both languages are reviewed at 390, 768 and 1440px, plus the existing sidebar/container transition widths. Controls remain keyboard operable, labels readable, and scrolling is confined to intended chart/table areas.
- Compare screenshots against the current Budget explorer and Economy overview, not the discarded HTML mockup. Confirm actual component reuse, fonts, paper selector, layout, controls, dot grid and tooltip styling.
- Existing Budget, Debt and GDP overview routes, workbooks and query contracts remain unchanged except for intentional additive discovery.

Use targeted tests during implementation. At completion run the required `CLAUDE.md` gates: `npm run check`, `npm run build`, and `npm run test:browser`; include localization, source/archive and publication checks in their established workflows. Query changes also require the unchanged reference fixture specified there. Do not bypass a required check or revise its expected answer merely to obtain a pass.

During implementation, update `Project_Definition.md` section 2 to record this bounded sectors extension and `DESIGN.md` to document reuse of the three-way segmented measure control, leaving unrelated scope exclusions intact. Add the sector methodology document and update applicable archive/discovery records. This spec-only change does not update production scope, implement the page, apply a database migration or claim application tests/deployment were run.
