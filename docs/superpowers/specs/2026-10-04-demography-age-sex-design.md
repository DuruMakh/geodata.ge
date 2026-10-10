# Demography: Age and sex — specification

Date: 2026-10-04, rewritten 2026-10-10 against the built Population, Migration and Births pages.
Status: Owner approved the layout (mockup of 2026-10-10, real figures) and the design summary; this file awaits the owner's review before the plan.
Supersedes: the 2026-10-04 version, which assumed the withdrawn click-to-select map block. Foundation rules still come from `2026-10-04-demography-section-design.md` (census break §5, tokens §7).

## 1. Outcome and scope

The work answers: how old are Georgia's people and how has that changed since 2004; how do the regions differ, and cities from villages.

It follows the Births pattern (owner, 2026-10-10):

- **One national page** `/explorer/demography/age-sex` (and `/en/...`), scrolling through four parts: regions by share aged 65+, Georgia's pyramid by year, the age groups over time, the age-by-year heat map.
- **An "Age and sex" block** at the end of the Georgia page and the 11 region pages of Population (`#age-sex`), showing that place's census 2024 pyramid.

Municipality pages get no block: no municipal age rows are served (the data stage reads and validates them only).

Excluded: municipal ages and pyramids; single years of age; median age and dependency ratios; projections; any difference computed across the 2025 break; auto-play or animation; comparing two places on one pyramid; MCP, JSON publications and bulk downloads (as for the other demography pages); per-resident figures.

## 2. Data

Both files are already canonical and validated. This work adds them to the served set; there is no new source, no new reviewed row and no database schema change.

| File | Series | Geographies | Date | Rows |
| --- | --- | --- | --- | ---: |
| `demography-structure-annual.csv` | `demography.population_by_age_sex` (19 groups incl. `age_0`, `age_1_4`, plus `total`; × male, female, total) | Georgia | 1 January 2004–2026 | 1,380 |
| | `demography.population_age_band` (`band_0_14`, `band_15_64`, `band_65_plus` × three sexes) | Georgia | 1 January 2004–2026 | 207 |
| `demography-census-2024-population.csv` | `demography.census_population_by_age` (18 groups × three sexes × total, urban, rural) | Georgia and 11 regions | 14 November 2024 | 1,944 |
| | `demography.census_population_by_settlement` (all ages × three sexes × three settlements) | Georgia, 11 regions, 64 municipalities | 14 November 2024 | 684 |

- **Serving.** Both files join `SERVED_DEMOGRAPHY_FILES` and `SERVED_DATA_FILES` and are mirrored whole (the loader rejects a file with unserved series, as with Births). Mirror 5,525 → 9,740 rows; the deploy log must read `DemographyFact: csv=9740 db=9740`. `DemographyFact` already has `ageGroup` and `settlement` columns. The settlement series is served but only its Georgia and region rows are shown (urban share).
- **One set of 18 groups.** The annual table prints age 0 and 1–4 separately; the census prints 0–4. The model computes `0–4 = age_0 + age_1_4` in whole persons, so every figure uses `0–4, 5–9, …, 80–84, 85+`. The methodology discloses the sum as computed by Fiscal.ge.
- **Basis.** Annual values carry the census-break lineage (foundation §5). Census counts are one date, labelled "census, 14 November 2024", and are never drawn on the annual timeline.
- **Anchors the tests assert.**
  - Census: Georgia 3,929,581 (1,881,004 men, 2,048,577 women), urban 2,455,444, rural 1,474,137; 65+ 692,700 = 17.6%. 65+ share by region: Racha-Lechkhumi and Kvemo Svaneti 31.2, Guria 24.1, Samegrelo-Zemo Svaneti 22.6, Imereti 22.0, Kakheti 21.4, Mtskheta-Mtianeti 20.3, Samtskhe-Javakheti 19.1, Shida Kartli 18.9, Kvemo Kartli 16.2, Tbilisi 14.4, Adjara 13.1. Imereti counted 510,741.
  - Annual: the 18 groups add to the published total in every year and sex; the bands equal the sums of their groups; 65+ share 14.1% (2004), 16.2% (2024), 17.6% (2025), 18.1% (2026); 2026 has 2,053,457 women and 1,887,646 men (108.8 women per 100 men).

## 3. National page

`ExplorerPage` → `PageHeader` (coverage `2004–2026`) → `ExplorerHeading` `ასაკი და სქესი` → one lead sentence → four parts, each under a `SectionTitle`, each with its own chart/table switch, source note and Excel action. No top-level tabs.

### 3.1 Regions by share aged 65+

`RegionIndex` (Unemployment → Regions), as it is: the region map shaded by the census share aged 65+, the searchable ranked list, three summary figures — Georgia's share, the oldest region and the youngest region. `metric.hrefForRegion` points to the region's Population page with `#age-sex`. The model is built like `buildUnemploymentRegionMapModel` (`regionalMapGeometry`, `quantileBucket`, ranked descending, ties by `sortOrder`). The page loads the `regionalEconomies` message scope for the index's fixed words. The map's legend and aria wording name the census date. Table view: the ranked list already is the text form, so this part has no switch.

### 3.2 Georgia's pyramid by year

- **Controls.**
  - Year buttons 2004–2026. The 2025 button carries a census-change tag, a dashed divider before it, and a mark on the selected year.
  - Measure `%` | `ადამიანი`.
  - A `შედარება` switch, off by default. When on, it shows a second year row for the comparison year, defaulting to the first year (2004).
- **Figure.** The pyramid for the selected year, at most 640px wide, centred.
  - Men left, women right. Ages run up the centre gutter, 0–4 at the bottom.
  - A tinted band behind the 65+ rows, labelled `65+ · {share}%`.
  - Under the pyramid, one line: 0–14, 15–64 and 65+ shares; women per 100 men.
- **Comparison.** The comparison year is drawn as a 1.5px ink outline over the bars, and the legend names both years.
  - If the two years fall on opposite sides of the 2025 break, the break note shows above the figure. The measure is forced to `%`: the `ადამიანი` tab is disabled, with the reason given. No difference is computed anywhere.
  - Within one side of the break, nothing is restricted.
- **Table view.** The 18 groups plus a total row: men, women, total, share. When the comparison is on, the comparison year's columns are added.
- **Default.** The latest loaded year, `%`, comparison off.

### 3.3 Age groups over time

`EditorialLineChart` of the 0–14 and 65+ shares, 2004–2026, with `breaks=[2025]`. The 15–64 share is not drawn: at about 65% it would flatten the other two lines. Its latest value is printed in the caption. The table view lists all three bands for every year, with the break row (`breakYears`).

### 3.4 Age by year (heat map)

Owner decision, 2026-10-10, during planning: reuse the Unemployment → Age heat map instead of a new compact figure.

- **Component.** The coloured table of `UnemploymentAgeHeatmap`. Its table and legend are lifted into a shared `HeatmapTable`, which both pages use; Unemployment's output stays byte-identical. Rows are the 18 groups (85+ at the top), columns are 2004–2026, and each cell prints and is coloured by that group's share of the year's population.
- **Colour.** The six `MAP_RAMP` steps with `unemploymentAgeHeatmapBin` (equal-width bins from zero to the largest share), as on Unemployment.
- **Scrolling.** It scrolls sideways where it is wider than its column, and opens on the newest years, as Unemployment does.
- **Break.** An optional `breakYear` on `HeatmapTable` draws ExplorerTable's 2px ink rule left of the 2025 column and prints the short break label on its header. A caption says the 2025 re-base moved some groups' shares.
- **Reading note.** One neutral sentence: diagonals running up and to the right are people born in the same years, growing older.
- **No chart/table switch.** The table is its own text form. No tooltip and no "born about" text: the number is in the cell.

## 4. Place block (Georgia and the 11 regions)

`AgeSexSection`, rendered on the Population place page after `VitalSection`, with `id="age-sex"`. It is shown only when the place has census age rows; municipality pages render nothing.

- **Heading.** `ასაკი და სქესი · აღწერა, 14 ნოემბერი 2024`.
- **Controls.** Settlement `ყველა | ქალაქი | სოფელი` and measure `%` | `ადამიანი`, held in component state (as `VitalSection` holds its mode). Shares are of the displayed subset's own total.
- **Figure.** The same pyramid component as §3.2, without year buttons or comparison. Three key figures follow: people counted, share aged 65+, share living in cities. The figures are for the whole place; the share living in cities does not change with the settlement tab.
- **Table view.** The 18 groups plus a total row: men, women, total, share.
- **Below the figure.** A link to the national page; on Georgia's block the link reads as "every year since 2004". Then the source note and the Excel action.
- **Payload.** Only this place's census rows go to the browser.

## 5. Components and reuse

**Reused as is:**
- `RegionIndex` and `RegionMap`, `regionalMapGeometry` and `quantileBucket`.
- `EditorialLineChart` (with `breaks`).
- `ExplorerTable` (with `breakYears`).
- `ChartTooltip`.
- `SectionTitle`, `SegmentedTabs`, `TextTab`, `SourceNote`, `Callout`.
- `ExcelDownloadButton` and the workbook model.
- `ExplorerPage`, `PageHeader`, `BreadcrumbJsonLd`.
- `MAP_RAMP` and `unemploymentAgeHeatmapBin`.
- The Population place page and its loaders.
- The `sex.male` and `sex.female` colour tokens.

**Small additive changes; default output unchanged:**
- The year-button row in `components/analysis/analysis-view.tsx` is lifted into a shared `YearButtonRow`, with an optional per-year tag (the "planned" tag there, the census tag here). Analysis must render exactly as before, and its browser specs prove it.
- The table and legend of `UnemploymentAgeHeatmap` are lifted into a shared `HeatmapTable` (`components/main-explorer/heatmap-table.tsx`) with an optional `breakYear`; Unemployment renders exactly as before (§3.4).
- Demography loader, validation and served-file lists gain the two files; `servedRows` gains a client projection for age rows.
- `DEMOGRAPHY_PAGES` flips `age-sex` to live, and the hub card gains a figure (Georgia's 65+ share, latest year).
- Sitemap, `llms.txt`, sidebar, methodology demography content (structure and census families, the computed 0–4) and the release-check runbook.

**Genuinely new:**
- `PopulationPyramid`, drawn from a pure `pyramidLayout.ts` (scale, ticks, rows, outline path). Nothing existing draws mirrored horizontal bars.
- `lib/explorer/demographyAgeSex.ts`: groups, the 0–4 sum, shares, sex ratio, hash state, the region model.
- `demographyAgeSexWorkbook.ts`.
- `components/demography/age-sex-explorer.tsx` (national parts 3.2–3.4) and `age-sex-section.tsx` (place block).
- `lib/pages/demography-age-sex.tsx` and the `(ka)` and `(en)` route files.

## 6. Pyramid drawing

The pyramid measures its container (`ResizeObserver`) and sets the viewBox to the measured width, so 11px mono labels never scale. It renders at 520px on the server and before measurement, with a minimum of 320px and no horizontal scroll. Its geometry:

- Row pitch 22px, bar 18px.
- A 44px centre gutter holds the age labels. Each half is `(width − gutter − 16) / 2`.
- Four hairline rules per side mark a nice scale (`niceMax`). Tick labels sit under the plot.
- A header row carries a swatch, the label and the share or total for each sex. The text is in ink, never in the series colour.

When a comparison year is shown, both share one scale.

Rows are the interactive unit. Each has an aria-label such as `25–29: მამაკაცები 123,456, ქალები 130,000, სულ 253,456 (7.3%)`, and one row is the tab stop. ↑/↓ move between rows, and Home/End jump to the ends. Hover or focus shows `ChartTooltip`, with the comparison year's values when it is on.

## 7. State

The national page keeps `year`, `compare` (absent = off), `measure` (`share|persons`) and each part's `mode` in the hash. Updates use replace, not push (`useReplaceHash`, as on inflation cities). Rules:

- Unknown values are rejected.
- Years are clamped to loaded facts.
- A comparison year equal to the year is dropped.
- A comparison across the break forces `share`.

The place block keeps local state only.

## 8. Numbers

- Persons are exact integers. Shares are `persons / displayed total × 100`, printed with `formatShare` to one decimal.
- Women per 100 men is `women / men × 100`, to one decimal.
- No share, ratio or count is subtracted across the break.
- Bins, scales and the outline path are pure functions with unit tests.

## 9. Excel

Every workbook keeps basis and source hyperlinks and has no internal columns. Georgian and English as elsewhere.

| Download | Readable sheet | Data sheet | Source | Notes |
| --- | --- | --- | --- | --- |
| National pyramid | 18 rows: men, women, total for the year (plus the comparison year's columns when on); shares are in the data sheet, because a readable sheet has one number format | year, sex, age group, persons, share, basis | the annual age-by-sex original | |
| Age groups over time | | bands × years | the annual age-by-sex original | |
| Heat map | groups × years, shares | year, group, persons, share, basis | the annual age-by-sex original | |
| Place block | the 18 groups for the place and settlement: men, women, total (shares in the data sheet) | | the census original | census date in the subtitle |

## 10. Accessibility and responsive

- Every figure is `role="img"` or a named group, and has a table twin.
- Focus is the 2px accent ring.
- Sex is carried by position and labels, not only colour.
- Pyramids fit 320px without scrolling; the heat map scrolls inside its own frame, as on Unemployment; no horizontal page overflow.
- Nothing animates.
- Checked at 390, 768, 1100 and 1440px in both languages.

## 11. Tests and acceptance

**Unit:**
- The 0–4 sum; groups add to totals; bands equal group sums.
- Shares and the sex ratio.
- Pyramid geometry: symmetry, shared scale, ticks, outline path, row order.
- The heat-map rows (18 groups, shares adding to 100 in every year).
- Hash round-trip, rejection and the break rules.
- The region model's order and the §2 anchors.
- Workbook models.
- Served-file parity: the CSV and database row counts match, and the totals become 9,740.
- Payload: only this place's census rows reach the place page; no internal fields reach the browser.

**Browser (both languages):**
- The national page's four parts.
- Year buttons and keys.
- Comparison within one side of the break, and across it (note shown, `%` forced, no difference).
- The table twins.
- The heat map's break rule and label, and Unemployment's heat map unchanged.
- A region row link landing on `#age-sex`.
- The place block's settlement and measure switches.
- No block on a municipality page.
- The downloads.
- Widths 390–1440.
- The Analysis year row unchanged.

Ripple counts are re-derived during the plan, not guessed here: the sitemap (+2), the bilingual identities (+1), the sidebar "coming soon" count (1 → 0), the methodology and `llms.txt` lists, and the hub card.

**Acceptance:**
- The §2 anchors agree across pyramid, table, summary, tooltip, workbook and heat map.
- No figure spans the break with a difference.
- Existing pages are unchanged.
- `npm run check`, `npm run build` and the browser suite pass once at the end.
- The methodology doc `docs/data-methodology/demography.md` and `DESIGN.md` are updated in the same change.

## 12. Settled decisions

| # | Decision | Decided by |
| --- | --- | --- |
| 1 | National page plus a block on Georgia and region pages | owner |
| 2 | The layout as in the mockup of 2026-10-10 | owner |
| 3 | Comparison outline off by default | assistant default, accepted with the design |
| 4 | 15–64 not drawn on the over-time chart | assistant default, accepted with the design |
| 5 | Comparison across the break allowed, with the note and forced `%` | |
| 6 | Heat map reuses Unemployment's coloured table, showing shares | owner, during planning |
| 7 | Region order by 65+ share, descending | |
| 8 | No auto-play | |

Georgian wording is drafted and reviewed by the owner at the end, as for the other pages.
