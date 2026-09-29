# Inflation: individual-product explorer specification

Date: 2026-09-27
Status: Approved for implementation planning by the user's 2026-09-27 request to write the plan. The page layout and illustration direction were approved in conversation. This document specifies the production implementation; it does not claim the page is built or published.

## 1. Outcome and approved decisions

Add a Georgian-first, bilingual **Products / პროდუქტები** section at `/explorer/inflation/products` (English: `/en/explorer/inflation/products`). A reader can find any product in the **latest Geostat consumer basket**, compare its published annual price changes over time, switch the chart to price change accumulated across selected years, and scan a ranked list of every current product. The page describes price **changes**, not GEL shelf prices, basket weights or contributions to headline CPI.

The production page uses `DESIGN.md` v4.1 and the existing explorer shell, chart, range, selector and indicator anatomy. The approved mockup fixes **order and behavior**, not its standalone CSS or typography:

1. Annual line chart on the left and a searchable, selectable product list on the right. The list is sorted by the latest published annual change, highest first.
2. The existing year-range control sits below the chart.
3. Four indicators follow the workspace: selected product's latest annual change, its selected-range cumulative change, the highest latest annual change and the lowest latest annual change.
4. A ranked list of **all current products** follows, with a small product illustration beside each name, the latest 12-month change and the cumulative change over the selected years.

Annual inflation is the default chart measure. **One icon-only control** switches cumulative mode on and off. There is no separate annual icon, and the control has no visible `დაგროვილი` / `Cumulative` text. Its accessible name and the existing `ControlTooltip` explain the action; its pressed state, chart heading, units and tooltip make the active measure clear. There is no month-on-month view or additional chart/table mode switch.

### 1.1 Decisions made explicit by this specification

- The current source's latest month is August 2026. “Latest 12-month change” means **August 2026 against August 2025**, using Geostat's published same-month-of-previous-year index. It never means the last complete calendar year. The latest period comes from loaded facts on refresh.
- The selected years affect the chart, cumulative values and export history. The latest annual ranking and the latest annual column stay anchored to the latest published month, even if the selected range ends earlier. Their visible caption states that month.
- The default range is the latest **four calendar years** available (currently 2023–2026), derived from the facts. `5წ`, `10წ` and `ყველა` quick choices retain the existing `RangeStrip` behavior; manual handles can select any inclusive start/end years back to 2015.
- The first product in the latest annual ranking is selected initially (currently tomato), derived from facts rather than hardcoded. Multiple products can be selected, with no selection cap. The most recently added selected product is the focus for the first two indicators; it has the existing selected-row emphasis plus a clear focus cue. If it is removed, the next most recently added selected product becomes the focus. Empty selection shows the existing no-selection callout and `—` for those two indicators.
- The lower ranked list initially shows a manageable first page and reveals further rows with **More products** until all current products are reachable. It is one list, not a grid of image tiles. Clicking a product name adds or removes that product from the chart. Searching in the right panel filters only that panel, not the lower list or the selection count.
- Product illustrations are small companions to names, never picture-sized tiles. This is a bounded visual exception for **data illustrations**, not a second family of functional UI icons.

## 2. Scope and boundaries

The reviewed data foundation is already committed: `data/imports/cpi-products.csv`, `data/imports/cpi-products-monthly.csv`, the identity decisions and the source archive. The August 2026 vintage has **305 current-basket products** and **84,056 product facts** from 2015 onward. Product history starts in 2015 or at the first verified later observation. Retired products remain in the original archive but are absent from the current catalogue and page. The count, period bounds and default product must be derived from the served data, not coded as constants.

This implementation includes the product route in both languages, hub and sidebar navigation, production illustrations, the existing three-sheet Excel pattern, source and methodology text, static serving and database mirror parity, accessibility, SEO and verification. It also updates `Project_Definition.md` §2C and `DESIGN.md` §25 when implemented so those canonical owners admit the page and its illustration treatment.

On the Inflation hub, remove the **Consumer basket / სამომხმარებლო კალათა** card. Make **Products / პროდუქტები** the third, live card after Overview and Categories; Cities remains a coming-soon card. Add Products as the third live nested Inflation sidebar link, with the same active-state behavior as its siblings. There is no standalone basket-composition route.

Out of scope: individual GEL prices, product weights or contributions, city-level product indices, retired products, product detail routes, a price calculator, month-on-month display, new chart libraries, a new visual system, and expansion of `/mcp` or the static JSON/CSV publications. The existing CPI overview and category pages keep their behavior.

## 3. Data meaning and calculations

### 3.1 Published annual series

For product `p` and month `t`, displayed annual change is:

```text
annual_pct(p, t) = published_yoy_index_100(p, t) - 100
```

The chart plots the **published annual change at each month** in the selected calendar years; the lower list and latest-value selector use the newest month in the served product dataset. A missing product value in that month displays `—` and a chart gap, never zero or an interpolated point. Sort by the unrounded annual value descending, then stable product ID for ties; missing latest values go last. Display to one decimal with a sign and percent unit. A negative rate means the product's measured price level fell relative to the same month a year earlier; do not colour it as inherently good or bad.

### 3.2 Accumulated price change

Geostat's previous-month index is the only valid source for cumulative change. For a selected first year `Y0` and final calendar month `T`:

```text
cumulative_pct(p, Y0, T) = 100 × ( product over every month m from Jan Y0 through T
                                      of published_mom_index_100(p, m) / 100 - 1 )
```

This compares the endpoint with **December immediately before `Y0`**. If the selected final year is complete, `T` is December of that year; for the latest incomplete year, it is the latest published month. The cumulative chart recomputes that product from the same starting December for every plotted month. Changing the start year rebases the cumulative line and the cumulative column together. Annual percentages are **never summed or multiplied** to make this measure.

Show `—` for a product's selected-range cumulative value if its verified history starts after January of the chosen first year or any required monthly index in that range is unavailable. Do not start at its later entry date and label the shorter result as the full selected range. In cumulative chart mode, that product has no line for the invalid range and the no-data explanation names its later first period. The published annual line remains available where its annual facts exist. A single selected calendar year is valid: it measures December-before-start through that year's selected endpoint, not zero.

Use the canonical source precision for multiplication, round **only for display**, and test against independently calculated source examples and Geostat's already-validated twelve-month annual reconciliation. Cumulative change is calculated by Fiscal.ge from Geostat's published monthly indices and must be labelled as derived on the page, in the workbook and in methodology. It is not an official Geostat cumulative series.

### 3.3 Identity and trust rules

Product IDs and first periods come only from the reviewed catalogue and `decisions.csv`. Never connect two historical names or groups by similar text, row number, illustration or matching index values. Preserve the 29 reviewed links and 18 conservative splits unless a separately reviewed source decision changes them. In particular, p0179 and p0269 retain their currently shorter histories pending a conclusive identity reason; the public methodology explains the conservative boundary. Preserve Geostat's original p0148 English and Georgian labels and disclose their source-level inconsistency rather than silently translating one to fit the other.

The independent audit in `docs/superpowers/reviews/2026-09-27-inflation-products-full-data-audit.md` is the release checklist for these cases. Before public publication, record the final reasoning for the two splits, disclose the p0148 label issue, and extend automated 2014-backed arithmetic checking for the 3,157 2015 annual cells the audit independently reconciled. This work must not rewrite an already-reviewed fact without the existing revision guard and an explicit reviewed decision.

## 4. Page layout and interaction

Use `ExplorerPage`, `PageHeader`, `ExplorerHeading`, `ExplorerWorkspace`, `SeriesAside`, `RangeStrip`, `EditorialLineChart`, `SourceNote`, `HeroKpi`, `SideKpiList`, `Sparkline`, `ExcelDownloadButton` and the existing typography, rules, colours and responsive breakpoints. Do not copy the preview's standalone styling into production. There are no boxed cards around charts, rows or indicators.

The chart is always a line chart. The annual state is the first render; the cumulative control is a single 36×36 icon button in the chart toolbar using the existing Lucide and `ControlTooltip` pattern. When off, the accessible action says “Show cumulative price change”; when on, it says “Show annual inflation.” `aria-pressed` communicates state. The visible chart title and unit note switch between **Annual inflation (%)** and **Cumulative price change (%)**. No visible word is printed on the toggle. Its icon represents a rising cumulative path, not a summation sign, because the calculation is compounding.

The right panel uses the shared search and series-selection anatomy. Each row has the small product illustration, localized official name, latest annual value, swatch/checkbox and accessible selection state. Search matches official Georgian and English names, case and whitespace normalized. It searches all current products, retains selected products that are outside the results, and never changes the denominator or bulk-action scope. With 305 products there is **Clear**, but no “Select all.” The existing 430px panel scroll is acceptable; keyboard and touch targets remain usable. The order is latest annual descending, including after search.

The year control is based on calendar years and sits directly under the chart, using the standard year strip. Month-level annual observations remain on the line chart, but there is no month picker or month-on-month measure. As on existing inflation charts, the x-axis uses calendar-year labels, its tooltip identifies the exact month and value, gaps break lines, and narrow screens retain readable axes. The source note and methodology link follow the strip.

### 4.1 Four indicators

Follow the existing **one hero plus three side KPIs** under `ძირითადი ინდიკატორები`, without cards:

1. **Hero — focused product, latest annual change.** Show its name, the exact comparison months and a small scale from the cohort's latest minimum to maximum, with the focused product marked. If all values coincide, place the mark centrally. This is a product-rate scale, not the NBG target gauge.
2. **Side — focused product, selected-range cumulative change.** Show the exact endpoints and `—` with the first available year when the full range is unavailable. Its sparkline follows that product's cumulative path in the selected years only when the path is complete.
3. **Side — highest latest annual change.** Rank all current products with published latest annual values, independent of chart selection; show the product name and a sparkline of that winner's annual history.
4. **Side — lowest latest annual change.** Same population and period; show the product name and that winner's annual sparkline. Use neutral “lowest change” wording so a positive minimum never falsely claims a price fall.

The first two follow the focused product, even with several chart lines; the last two remain cohort-wide. Each value carries `%`; the name and period are visible without hover. The KPI sparklines are supporting context, not separate metrics.

### 4.2 Complete product list

Place a semantic, responsive table after the indicators, in the existing `ExplorerTable` type system. The section has a “Browse products” heading and its own bilingual search field, without a dividing rule above it or a visible row counter. Search matches either official name, independently of the chart selector search; changing the query resets the visible list to its first batch. Include **every product in the current catalogue** through incremental “More products” batches, scoped to the search results; never drop a row merely because its history begins later. The table columns are:

| Column | Meaning |
| --- | --- |
| Product | Small illustration and official name in the active language, with the other official language as the secondary label. |
| Latest 12-month change | The cohort's latest published same-month-of-prior-year rate; latest month printed in the heading. |
| Selected-years cumulative change | The full selected January-to-endpoint compounded change, or `—` with the first available year when incomplete. Heading updates with the selected years and last month. |

The list stays sorted by the **latest annual** column even when searched, when the cumulative chart is active or when the year range changes. Its search does not change chart selection. The selected rows use the existing tint; a product clicked here toggles it on the chart. On narrow screens, preserve the name and both numerical columns with the project's existing table scroll hint rather than shrinking Georgian labels or hiding the cumulative column. No large product image, card grid or separate basket-weight list appears.

## 5. Production illustrations

![Approved illustration style reference](assets/inflation-products-illustration-reference.webp)

The user selected **only the object illustration style** in this reference, not its grid composition, coloured glows or dark background. Production uses small transparent cutouts beside names on the site's paper background. The warm, textured objects are displayed at roughly **28–36 CSS px**. The earlier usable icons were preview assets outside the repository; the repository currently has no complete product icon set. Implementation must create, optimize, source-control and review a **one-to-one ID-to-illustration mapping for every current catalogue product** before the page is called complete. A labelled contact sheet and an automated coverage check make omissions and wrong mappings visible during review. Assets use stable product IDs, not translated names or year-local source row numbers. The final page must not use emoji, reused unrelated objects, empty circles or text initials as permanent substitutes.

Illustrations are representative objects/services, not evidence of a particular brand, package, quality or price observation. Keep p0148 and other ambiguous source descriptions conservative; an image must not assert a more specific identity than the reviewed label. Illustrations have empty `alt` text because the adjacent official name supplies the accessible meaning. Lazy-load lower-list art, avoid loading all 305 full-size images on initial render, and use an optimized small format. The cumulative toggle remains a **functional Lucide icon**, separate from these product illustrations.

## 6. Serving, state and export

Add a validated loader for the two existing canonical product CSVs. Mirror the product catalogue and facts in Prisma/Postgres through the existing **single transactional `npm run data:import`** workflow, with exact row, value, availability, product ID, source locator and review-date parity before commit. Follow the existing inflation mirror's RLS/revoked public-role pattern. CSV mode remains the static build fallback; no browser query to Supabase or request-time product-data API is added. The two registered Geostat product sources and their four archived language editions are reused, not downloaded again for this feature.

The page is prerendered. Project only display fields and packed annual/monthly numeric runs needed by the client, as the category page does; do not serialize 84,056 verbose provenance objects into HTML. Catalogue labels and icon IDs cross the boundary once. The Inflation hub card uses only a compact latest-product summary, not the full histories. Rank, cumulative math and hash restoration must remain responsive on ordinary desktop and mobile devices; measure the compressed client payload and initial interaction timing before sign-off. Preserve published previous-month precision in the packed input (for example, as scaled integers), or precompute cumulative prefixes at that precision; never compound already rounded one-decimal display rates. Full source precision stays in the canonical and mirror layers. The server and client must agree at displayed precision.

Use stable ASCII hash state, following the other explorers: `i=annual|cumulative`, `r=YYYY-YYYY`, and an ordered `sel=<product IDs>`. The last selected ID is the focused product. Preserve compatible state when switching Georgian/English. Validate unknown IDs and clamp out-of-coverage years; a deliberately empty `sel` remains empty rather than restoring the default. Search text and “More products” expansion are local UI state, not URL state. No hardcoded 2026, 305, 2015–2026 endpoint or default product in page logic; 2015 is the approved historical floor enforced by the canonical data package.

Add one Excel action in the right panel using the site's localized **Summary / Data / Sources** workbook pattern:

- **Summary:** every current product, in the on-page latest-annual ranking, with official names, latest annual rate and selected-range cumulative rate or a clearly explained missing value.
- **Data:** monthly published annual indices/changes and Fiscal.ge cumulative changes for the selected products and selected years. Include measure, month, percent unit and published-versus-derived status; no invented values or internal source locator columns.
- **Sources:** the relevant original Geostat annual and previous-month workbooks, preferring the reader's language edition where available, with validated public archive links and selected coverage.

The export is available with an empty chart selection because the Summary still contains the full current-product list; its Data sheet then has no selected-product history. Avoid recalculating cumulative values by a different rule in Excel: the on-page table, chart and workbook use the same tested function. If a user explicitly selects all 305, the workbook must still complete without truncation or a silent change of scope.

## 7. Localization, methodology, SEO and accessibility

All headings, actions, data notes, labels, tooltips, hash-restored state, workbooks, metadata and empty/error messages have Georgian and English text through the existing i18n system. Product names are Geostat's official bilingual labels from the catalogue, not new translations. Add the two static route variants, localized breadcrumbs, canonical/hreflang metadata, sitemap coverage and the existing `BreadcrumbList` / dataset metadata pattern.

Extend the internal `docs/data-methodology/inflation-products.md` and public `/methodology/inflation` page with the published annual index definition, Fiscal.ge's cumulative formula and December baseline, range-end rules, late-entry `—` rule, the source identity safeguards and audit disclosures, and the distinction from GEL prices, weights and contributions. Link the existing archived source workbooks; do not expose the internal decisions CSV as if it were a Geostat product crosswalk.

The icon-only mode control has a localized accessible name, tooltip and pressed state. Both independent searches, selection, slider handles, “More products” and workbook action work by keyboard and touch. The chart has a concise screen-reader summary; exact series values remain available in the table/export and tooltips. Series colour is paired with labels/swatches rather than relied on alone. Product art is decorative. The complete list is a real table with headers. On phones the workspace stacks in the existing order (chart then selector), followed by indicators and product list, without page-level horizontal overflow.

## 8. Verification and acceptance

The implementation plan should break this into focused tests and changes, then run the repository gates in `CLAUDE.md` once at completion.

- **Data and arithmetic:** all 305 current products resolve to unique IDs; 84,056 reviewed fact rows and 176 explicit unavailable cells retain source parity; annual values equal published index minus 100; cumulative examples match independent products of full-precision monthly indices; annual and cumulative chart endpoints match the list and workbook at display precision; 2015, a one-year range, a past December endpoint, current partial year, later first periods and a synthetic missing monthly cell are exercised.
- **Mirror and refresh:** migration/import is transactional and exact-parity checked in CSV and DB build modes; the existing revision and identity guards still stop changed historical values; the audit's 2014-backed check becomes repeatable; the p0179/p0269/p0148 decisions and disclosures are recorded before public sign-off.
- **Behavior:** default annual chart and top-ranked selection; icon-only cumulative toggle and keyboard/tooltip semantics; multi-selection, focused-product indicators, clear/empty state; bilingual search; descending ranking and stable ties; quick range choices and handle movement; all current products reachable through the table; late products show `—` for incomplete cumulative ranges; URL and language switching restore the view; Excel's three sheets match the page.
- **Visual and accessibility:** compare the page to the existing inflation overview/categories at desktop and mobile widths in both languages. Verify type, spacing, chart axes, table scroll, contrast, focus, no oversize product imagery, no duplicate functional icon family, complete reviewed icon mapping, and no horizontal page overflow. Run the targeted browser spec, then `npm run check`, `npm run build` in CSV and DB modes where configured, and `npm run test:browser` per `CLAUDE.md`.

## 9. Authority and next step

Approval of this document authorizes a plan and implementation for this **product explorer only**, including its necessary scope/design amendments, production icon set, mirror, localized route, Excel and methodology. It does not authorize cities, a basket-weights page, a calculator, a new API/MCP feature, or direct database edits. After the user reviews this written spec, write the implementation plan; implementation and any GitHub delivery follow the repository's normal gates and authorization.
