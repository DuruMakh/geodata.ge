# Wages hub — explorer design

Date: 2026-10-09
Status: Approved by the owner on 2026-10-10. Amended the same day by the owner: the Wages overview's Business / non-business tab is removed and Women / men takes its place, replacing the separate Gender page and card. Business and non-business remain groups on Industries. A second amendment that day makes Regions the map and list only, with a page for each region (its average wage beside the Georgia average), replacing the comparison chart and the no-region-pages rule in sections 2 and 3. A third amendment that day removes the overview's tabs, summary and nominal note: Women, Men, Public and Non-public become subcategories of the average in the series list, beside the median.

## 1. Intended result

Let Fiscal.ge readers see how much people in Georgia earn, how that has changed since 1995, and how it differs between women and men, industries, regions and kinds of employer. Readers can inspect the same figures in a table and download their selection to Excel.

The data foundation is the validated research package from PR #163 (`docs/Raw Data/Wages/geostat-earnings-annual/`, methodology `docs/data-methodology/wages-annual.md`): 1,917 annual Geostat values in lari. This design adds the pages that serve it. It reuses the Unemployment hub's layout and components; it adds no new chart type, chart library or visual direction.

## 2. Pages and navigation

A Wages hub at `/explorer/wages` with four cards, mirrored in English under `/en`, in this order:

| Card | Page | What it compares | Coverage in the package |
| --- | --- | --- | --- |
| Wages overview | `/explorer/wages/overview` | Average and median monthly wage for Georgia; supporting tabs for Public/non-public and Business/non-business employers | Average 1995–2025, median 2018–2025, ownership 2000–2025, business sector 2006–2025 |
| Industries | `/explorer/wages/industries` | The 19 economic activities (NACE Rev.2 sections A–S) | 2014–2025 |
| Regions | `/explorer/wages/regions` | The 11 regions | 2010–2025 |
| Gender | `/explorer/wages/gender` | Women and men | 1999–2025 |

- Wages follows Unemployment in the sidebar (the two labour-market hubs sit together), and its four pages appear beneath it when Wages is active, as Unemployment's do.
- One methodology page at `/methodology/wages` and its English mirror, using the existing methodology and source-archive components.
- Reuse the existing hub cards (coverage years and a national sparkline from served facts), breadcrumbs, page headings, latest-value line, language switch, metadata and sitemap patterns.
- No per-region or per-industry detail pages. Unlike unemployment, each region has only one published wage figure per year, so a region page would repeat one line from the comparison.

Georgian names: hub ხელფასები; average monthly nominal wage საშუალო თვიური ნომინალური ხელფასი; median monthly wage მედიანური თვიური ხელფასი. Industry and region names reuse the existing Economy labels for the same IDs.

## 3. What the reader sees

All four pages reuse `ExplorerWorkspace`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, the right-hand series panel (search, Clear / Select all, selection count) and the three-sheet Excel download. Every value is in lari (GEL) per month, so any combination of checkboxes shares one axis and there is no percentage/count switching. Values display to one decimal for averages and whole lari for the median, matching Geostat's publication. Available years come from the loaded facts; nothing is hardcoded. URL state and language changes preserve years, selection, chart/table mode and deliberately empty selections. Missing years are gaps and dashes, never zero.

A short note under each page title says the figures are gross (before income tax) and nominal: they are not adjusted for inflation and do not show purchasing power.

### Wages overview

- **Overview tab:** checkboxes Average wage and Median wage. Average is selected by default, first and removable. The median's own years (2018–2025) appear as its coverage; selecting it alongside the average keeps the average's longer history with gaps before 2018. A visible note says the median comes from Revenue Service tax records and the average from Geostat's enterprise surveys.
- **Public / non-public tab:** Public and Non-public employers, with the Georgia average as the removable reference, selected alone by default.
- **Business / non-business tab:** Business sector and Non-business and financial sector, same reference rule, with a one-line explanation of the non-business group (state bodies, non-commercial entities and all financial institutions).
- The tabs reuse the editorial text tabs from the Unemployment overview.

### Industries

- A compact dropdown (reused from the Unemployment age page) chooses whose wages are shown: All employees, Women, Men, Public, Non-public, Business, Non-business; plus Median (all employees), since Geostat publishes the median by industry for 2018–2025.
- The series list is that group's all-activities total plus each published section. Default: the total only, first and removable.
- Sections a group does not publish are not listed for that group (for example, business-sector tables omit Financial activities and Public administration). Public-sector mining is shown as unavailable, never estimated.
- Below the workspace, the existing age heatmap component shows all sections by year for the chosen group and active years, so readers can scan 19 industries at once. This is a reuse of the Unemployment age heatmap; it is the one element on these pages that is not a line chart or table.

### Regions

- Reuse the Economy / Unemployment region map and ranked list, coloured by the latest year's average wage, with the occupied-territory overlays.
- Below it, the comparison chart and table of all 11 regions, with the Georgia average as the default, removable reference.
- A visible note: some enterprises are counted at their head-office location, so a region's figure can reflect where firms are registered rather than exactly where people work.

### Gender

- Checkboxes Women and Men with the Georgia average as the default reference, selected alone at first.
- No pay-gap calculation is added. Geostat's adjusted gender pay gap was excluded from the collection, and a computed ratio would be a new derived figure.

## 4. Data rules

- Promote the 1,917 primary observations from `earnings-annual.csv` into one reviewed canonical CSV under `data/imports/` (UTF-8 with BOM), preserving exact decimal values, published precision, units, `basis=actual`, `value_status` (survey estimate vs administrative), and source references. Legacy rows (pre-1995 roubles/coupons, NACE Rev.1.1) and control rows stay in the research package and are not served.
- Validation rejects an altered value, a missing or duplicate observation, an extra indicator, a lost unavailable cell or a NACE Rev.1.1 row in the serving file, and reconciles the canonical file with the research package.
- Reuse the existing `sector.a`–`sector.s` and `region.*` IDs.
- No real (inflation-adjusted) wages, growth rates, pay-gap ratios, quarterly figures or estimates. Each would be a separately approved derived calculation.

## 5. Serving, sources and Excel

- Keep all pages prerendered. Follow the existing CSV loader, numeric client projection and private Prisma mirror pattern: one versioned migration, uniqueness constraints and exact parity in the transactional `data:import`. No live database migration or import happens during implementation.
- Publish the seven Geostat workbooks, the Wages page capture, the two 2025 releases and the two metadata documents through the existing source archive.
- Excel: Summary, Data and Sources sheets in the reader's language, with headings in GEL per month, the selected groups and years, missing cells, actual/survey-estimate/administrative status and validated source links. No internal cell references.
- Out of scope: wage MCP tools, central JSON/CSV publications, quarterly data, occupation, labour cost and forecasts.

## 6. Scope documents and verification

Implementation updates `Project_Definition.md` (a new approved Wages extension section), `DESIGN.md` for the Wages hub surfaces, and `docs/data-methodology/wages-annual.md` for serving and export rules.

Verification proves:

1. The canonical file reproduces all 1,917 primary values and the research package's checks still pass; CSV and database modes serve identical values.
2. Each page's defaults, reference rules, dropdown groups, tabs, unavailable cells and coverage match this design; the 2025 values match Geostat's release (average 2,165.2 GEL, median 1,531 GEL).
3. Chart, table, heatmap and Excel agree for the same settings; source links work.
4. Georgian and English layouts work at 390, 768 and 1440 pixels.
5. `npm run check`, `npm run build` and `npm run test:browser` pass, and CI is green on the PR.

Publishing beyond a draft PR, merging, deployment and the live database import remain separate decisions for the owner.
