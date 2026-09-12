# Inflation: categories section specification

Date: 2026-09-12
Status: Draft for user review. Design direction approved in conversation on 2026-09-12 from an interactive mockup built on the real archived figures (`.tmp/inflation-categories-preview/`, not committed).

## 1. Outcome and scope

Add **კატეგორიები** (Categories) as the second section of the Inflation dataset, at `/explorer/inflation/categories`. The section decomposes Georgia's consumer price index into its COICOP groups and answers one question the overview cannot: *which groups drive the headline, and by how much*.

Three centred indicator tabs over one shared workspace:

1. `წლიური ინფლაცია` — group price change, year on year, %.
2. `თვიური ინფლაცია` — group price change, month on month, %.
3. `წვლილი ინფლაციაში` — each group's contribution to the annual headline, in percentage points.

This milestone includes: category extraction from the already-archived Geostat workbooks, a new archived basket-weights source, canonical CSVs, database mirror and parity, the categories page with its stacked-column chart and two-level series panel, the monthly table, localized Excel download, methodology, Georgian and English.

Out of scope, each a later separately approved section: city indices, product-level indices (Geostat's two "Consumer Price Detail Indices" files), the price calculator, every non-CPI price index, a standalone basket-composition section, MCP intents and JSON publications for inflation.

### 1.1 User-approved decisions (2026-09-12)

- **Contributions are computed, not published.** Geostat publishes group price changes and basket weights but no contribution series. Fiscal.ge derives them, with an explicit residual so the parts always re-add to the published headline (§4.6).
- **Both COICOP levels ship**: 12 divisions and 43 subgroups, through the two-level selector pattern the ministries explorer already uses.
- **Basket weights are context, not their own section.** They appear on selector rows, in the table and in exports. The `სამომხმარებლო კალათა` hub card stays a coming-soon marker.
- **The contribution tab uses a new stacked-column chart.** It is the only form in which "the parts add up to the published whole" is visible.

### 1.2 Decisions taken in this spec

Two observations from the mockup were not settled in conversation. Both are recorded here as bounded decisions, and are the first things to confirm on review:

- **Default selection on the contribution tab is all 12 divisions.** The reader sees the complete basket and removes what they do not want, rather than the page hiding data by default. The alternative — defaulting to the top contributors and folding the rest into the residual — is rejected because it makes the page's headline claim depend on a Fiscal.ge ranking rather than on the whole published basket. This is a deliberate, documented departure from the `DESIGN.md` "only the total is selected by default" rule, which still holds on the two rate tabs: a stack of one series is meaningless.
- **The indicators block stays below the workspace**, as on the overview. In the mockup it is the fastest-reading part of the page and an argument exists for promoting it above the chart, but the two inflation sections must read as one family; changing the order for one page is a `DESIGN.md`-level change that belongs to its own decision.

## 2. Scope amendment

`Project_Definition.md` §2C currently lists "inflation categories, basket weights" among the still-excluded items. Amend §2C to admit exactly what this spec delivers: national COICOP division and subgroup price changes, the annual consumer-basket weights, and the derived contribution measure. City indices, product-level indices, the price calculator, other price indices, HICP, and inflation MCP/JSON publications remain excluded, as does monthly or quarterly data for any other dataset.

`DESIGN.md` gains the stacked-column chart, the two-level category selector, and the category colour block, alongside the §25 Inflation surfaces added by the overview.

## 3. Data

### 3.1 Sources

**No new monthly download.** Category rows are already inside the archived workbooks the overview reads: `docs/Raw Data/Inflation/geostat-cpi/<vintage>/{en,ka}/cpi-yoy.xlsx` and `cpi-mom.xlsx`. Their `Georgia` / `საქართველო` sheet carries `Level`, `Code` and `Groups` columns; the overview's reader takes only the `Total` row and ignores the rest. Those files are already byte- and hash-verified by `npm run data:check-inflation`.

| Level | Rows | y/y coverage | m/m coverage |
| --- | --- | --- | --- |
| 2 — divisions | 12 | 2005-01 – 2026-08 | 2004-01 – 2026-08 |
| 3 — subgroups | 43 | 2005-01 – 2026-08 (six exceptions, §3.4) | 2004-01 – 2026-08 |

**One new source:** Geostat *Consumer Basket Weights* (`https://geostat.ge/media/76662/Consumer-basket-weights.xlsx`, English, retrieved 2026-09-12, 25,626 bytes), a single `Weights` sheet: `N`, `Level`, `COICOP code`, `Groups/subgroups`, then one column per year 2012–2026. Values are fractions of one; divisions sum to exactly 1.0 for every year and so do subgroups. The file holds 12 divisions and 41 subgroups — two fewer than the CPI workbooks, exactly the two that ended in 2011 (§3.4).

**Collection task:** locate the Georgian twin on `https://www.geostat.ge/ka/modules/categories/26/cpi-inflation`. The URL obtained from an automated read of the page (media id 76653) returns 404 and must not be trusted. If no Georgian weights file is published, record that in the methodology and treat the English file as canonical — Georgian category labels do not depend on it (§3.3).

### 3.2 Archive

Weights live in their own tree, `docs/Raw Data/Inflation/geostat-basket-weights/<year>/`, with the same `source-manifest.csv` (URL, capture date, byte count, SHA-256) and `README.md` as the CPI vintages, because they refresh once a year in January rather than monthly with the CPI. The retention rule of the CPI vintages (latest only, earlier ones recoverable from git) applies unchanged.

### 3.3 Identity and labels

Category IDs are Geostat's COICOP codes, normalised: divisions `cpi.cat.01` … `cpi.cat.12`, subgroups `cpi.cat.01_1`, `cpi.cat.10_5` and so on. Codes, not slugs, because they are the internationally stable identifier and survive Geostat relabelling a group. Lowercase ASCII, as the project requires; labels are display data.

Georgian labels come from the archived `ka` CPI workbooks, matched to the English rows by COICOP code — Geostat's own wording, sourced rather than translated, and available whether or not a Georgian weights file exists. English labels come from the `en` workbooks. Both carry review dates so `npm run i18n:check` passes.

### 3.4 Gaps

The overview requires every series to be contiguous from its first month to its last. Category series legitimately are not, and the rule is relaxed for them: a category may start late, end early, or have interior gaps. Today, from the 2026-08 vintage:

| Code | Group | Behaviour |
| --- | --- | --- |
| 04.2 | Imputed rentals for housing | ends 2011-12 |
| 08.1 | Postal services | ends 2011-12 |
| 08.2 | Telephone and telefax equipment | starts 2011-01 |
| 09.2 | Other major durables for recreation | starts 2015-01 |
| 09.6 | Package holidays | starts 2020-01 |
| 12.5, 12.6 | Insurance; financial services | 48 and 36 interior gaps |

Every gap is recorded in the validation report. The revision guard is unchanged and still fails on any change to a value already published.

The two subgroups that end in 2011 have no weights — the weights file starts in 2012 — so they appear on the rate tabs and never in a contribution. This is a consistency check, not a coincidence, and §4.4 asserts it.

### 3.5 Canonical CSVs

Two new files; the overview's `cpi-national-monthly.csv` and `nbg-inflation-target.csv` are not touched.

`data/imports/cpi-categories-monthly.csv` — one row per category, measure and month; 27,668 rows for the 2026-08 vintage (13,492 y/y, 14,176 m/m):

`category_id`, `coicop_code`, `level`, `parent_id`, `measure` (`yoy_pct` | `mom_pct`), `period` (`YYYY-MM`), `value`, `status` (`published`), `source_id`, `source_locator`, `last_reviewed_at`.

`data/imports/cpi-basket-weights.csv` — one row per category and year, about 780 rows:

`category_id`, `year`, `weight_pct`, `source_id`, `last_reviewed_at`.

Geostat publishes weights as fractions of one. They are stored as **percentages with six decimals** (`30.320378`), matching how every other percentage in this dataset is stored and giving the mirror a `DECIMAL(12,6)` column. At that precision a level's yearly sum can drift from 100 by rounding, so the sum check below is stated as a tolerance rather than an equality.

Values are published precision. Percentages hold percentage points, as the overview does. `parent_id` is empty for divisions. **No contribution column**: contributions are derived at serving time (§4.6), following the `% of GDP` precedent at `lib/explorer/debtExplorer.ts`.

## 4. Pipeline

### 4.1 Reader

`lib/data/inflation/readGeostatCpi.ts` gains a category mode for the `yoy` and `mom` roles. It keeps the existing discipline: rows and columns located by content, anything unexpected throws. New anchors — the `Level` / `Code` / `Groups` header cells, the level column's values, and the code column — and the existing `Total` path is untouched, so the overview's extraction cannot change.

### 4.2 Prepare

`scripts/prepare-inflation.ts --write | --check` writes the two new CSVs alongside the existing ones, unchanged in its refresh, review and revision-guard behaviour.

### 4.3 Refresh

Categories refresh with the monthly CPI vintage and need no extra step — the same files already being replaced carry them. Weights refresh annually: download the new file into `geostat-basket-weights/<year>/`, update the manifest and the methodology archive CSV, rerun prepare, review a diff that adds exactly one year column. Both procedures go in the methodology.

### 4.4 Validation

Added to `npm run data:validate` through the existing `data:check-inflation`:

- exactly 12 level-2 rows; every level-3 row's `parent_id` resolves;
- weights sum to 100% at each level for every year, within 0.001 pp of the stored six-decimal values (the source fractions sum to exactly 1.0 today, at every level and in every year);
- every category carrying a weight has price data, and every category without one is absent from the weights file for a reason recorded in the report;
- English and Georgian category values identical, and the COICOP code↔label pairing stable against the previous vintage;
- gaps enumerated in `data/reports/inflation-cpi-validation.json`;
- the reconstruction check of §4.6.

### 4.5 Serving and mirror

Two Prisma models mirroring the two CSVs, one hand-written migration per `docs/data-methodology/database-import.md`, included in `npm run data:import` with row-count and value-sum parity per category and measure. CSV mode stays the build fallback and pages stay static.

At roughly 28,000 rows this is the largest dataset in the repository — four times the municipal dataset. The build-time selection must be memoized once per build rather than rebuilt per page, which is the regression PR #102 fixed in `factQuery`; a test asserts the builder runs once.

### 4.6 The contribution measure

For category *i* in month *m* of year *y*:

```
contribution_i(m) = weight_pct_i(y) / 100 × published_change_i(m)
```

with the weight taken from the calendar year of the month being measured, and the change in percentage points. Both operands and the result are percentage points; the division by 100 converts the stored percentage back to the fraction the arithmetic needs. The measure is derived in `lib/explorer/inflationCategories.ts` at build time from stored published values, never written to a CSV and never presented as a Geostat figure.

**The residual.** The chart, table and export show `დანარჩენი` = `published headline − Σ(selected contributions)`. One definition does three jobs: the stack always closes exactly on the published headline; selecting three subgroups rather than the whole basket is a meaningful view rather than a broken one; and the approximation inherent in the method is absorbed visibly rather than hidden.

**Why it is an approximation.** The basket rebases every January, so a year-on-year change spans two weight regimes and the parts do not re-add exactly. Measured against the published headline across the 2026-08 vintage:

| Period | mean abs error | worst month |
| --- | --- | --- |
| y/y, 2012 | 0.824 pp | 1.834 pp |
| y/y, 2013–2026 | 0.021 – 0.336 pp | 0.585 pp (2021-04) |
| m/m, 2012–2026 | 0.010 – 0.062 pp | 0.336 pp (2021) |

The monthly row is evidence that the method itself is sound — over a single month there is only one weight regime, and the parts nearly close — and it is monitored on every run. It is not a promise of a monthly contribution series: this section derives contributions for the annual headline only.

**Contributions therefore start 2013-01**, not 2012-01. The 2012 column is an order of magnitude worse than every later year — its weights are the first published and its comparison base predates them — and a residual of nearly 2 pp would be the largest thing on the chart. 2012 weights still ship and still appear as context on selector rows; they simply do not produce a contribution.

Validation fails the build if any month's absolute reconstruction error over all divisions exceeds **1.0 pp**, or if the mean over all months exceeds **0.2 pp**. Both are monitoring tripwires against a future Geostat change, not accuracy claims; the measured figures above are written to the validation report on every run.

## 5. Navigation and routes

- `/explorer/inflation/categories` — Georgian canonical; `/en/explorer/inflation/categories` — English.
- The sidebar's inflation section list gains `კატეგორიები` below `ინფლაციის მიმოხილვა`, with the active-row, collapse, keyboard and mobile behaviour of every other section.
- Hub card 02 becomes active: title `კატეგორიები`, an ink sparkline of the largest division's contribution, footer `{latest month} · {top contributor} {value} პპ`. Cards 03–05 stay coming-soon.
- `/methodology/inflation` gains the weights source and the category decision record.

## 6. Page composition

```text
Home / Data / Inflation / Categories        Jan 2004 – Aug 2026 · updated YYYY-MM-DD

კატეგორიები
პროცენტული პუნქტი · წვლილი წლიურ ინფლაციაში (5.65%)

     წლიური ინფლაცია   თვიური ინფლაცია   წვლილი ინფლაციაში

სვეტები | ცხრილი                                │  სერიები
stacked columns, or line chart, or month grid    │  12 divisions, expandable
legend                                           │  weights per row
monthly range strip                              │  ჩამოტვირთვა
source note + methodology link                   │

ძირითადი ინდიკატორები
hero: largest contributor   │  next three, with sparklines
```

- **No headline value line.** `DESIGN.md` §25 and the GDP extension, as amended on 2026-09-12 (`f8dd5e05c`), carry **the unit line alone** under the H1 on both overviews, with 16px beneath it and 12px under the tabs. This page follows that rule: the "largest contributor" figure lives in the indicators hero, which is where the page already answers that question. **Unit line:** contribution `პროცენტული პუნქტი · წვლილი წლიურ ინფლაციაში ({headline}%)`; y/y `პროცენტი · წინა წლის შესაბამის თვესთან შედარებით`; m/m `პროცენტი · წინა თვესთან შედარებით`.

  (The 2026-09-12 mockup predates this check and drew a headline line. It is wrong on that point and the spec governs.)
- **Tabs** are production `TextTab` in a centred, scrollable row, as on the overview and GDP. A tab switches chart, table, panel, unit line, available range, download and default selection together. They are ordered `წლიური ინფლაცია`, `თვიური ინფლაცია`, `წვლილი ინფლაციაში` so the two rate tabs keep the order a reader already knows from the overview, but the **landing tab is `წვლილი ინფლაციაში`**, not the first one: the section exists for the decomposition, and the rate tabs are the supporting detail. The three tabs have three different coverages — 2005-01, 2004-01 and 2013-01 — and the overview's existing range-transition rule (keep the intersection, keep "all" as "all", fall back to the destination's full range, announce the change) handles them unchanged.
- **Toolbar.** `SegmentedTabs`, labelled `სვეტები | ცხრილი` on the contribution tab and `ხაზი | ცხრილი` on the rate tabs. The mode persists across tabs.
- **Series panel.** The ministries two-level pattern: 12 division rows, each expanding to its subgroups, search above, and the count line `ჯგუფები {selected} / 12 · ქვეჯგუფები {selectedSubgroups}` so a selected subgroup is never hidden by the division count. Search never scopes the bulk action or the denominator. Every row carries its basket weight for the latest year, right-aligned in mono; a row with no weight shows `—`. A category with no value on the active tab — the two subgroups that ended in 2011, on the contribution tab — shows `—` and is left out of the chart, exactly as the overview treats core inflation on the index tab.
- **Default selection.** Contribution tab: all 12 divisions (§1.2). Rate tabs: the headline total only, first, selectable and removable, per the UI contract.
- **Indicators.** `ძირითადი ინდიკატორები` reports the latest published month regardless of tab or range: hero, the largest contributor with the 62px value in percentage points, its own price change, its basket share and one sentence; then the next three contributors as KPIs with a 36-month sparkline each. Negative contributors are described as `გაიაფდა`, never coloured as good or bad.
- **Deltas and colour.** Percentage points are `პპ`. Category colour is stable across every surface, per `DESIGN.md` §4.2.

## 7. Components

Reused unchanged: `PageHeader`, `TextTab`, `SegmentedTabs`, `SeriesSelector`, `SeriesSelectorRow`, `Sparkline`, `RangeStrip` (already monthly after the overview), `ExcelDownloadButton`, `SourceNote`, `HorizontalScrollHint`, `BudgetHub`, the workbook writer, the i18n and route systems.

Narrow extensions, with existing behaviour and tests unchanged:

- `EditorialLineChart` — used as-is for the rate tabs; monthly axis support already shipped with the overview.
- The overview's month-grid table gains a contribution tint scale and accepts a category series; its year × month anatomy and series switcher are unchanged.
- `SeriesSelectorRow` — an optional trailing metric slot, used here for the weight.

New:

- **`StackedColumnChart`** (`components/main-explorer/stacked-column-chart.tsx`). Months on the x axis under the existing dot-lattice thinning rule, percentage points on the y axis, positive segments above and negative below a drawn zero line, the published headline as an ink line over the stack with a dot on the last point, and the residual as the final segment. Tooltips name the category, the month and the value; the chart is keyboard reachable and every segment carries a title. No new chart library.
- **Category colours.** Twelve entries added to `SERIES_COLORS` from the existing editorial palette, keeping a concept's colour site-wide — health `#1F6E56`, education `#3D5A98`, transport `#C26E4C`, housing `#A5822B`, and so on; the residual takes the existing `#94856D`. Subgroups inherit their division's colour; because the residual absorbs everything unselected, a readable stack never needs 43 distinct colours.
- **`lib/explorer/inflationCategories.ts`** — selection, state, hash, the contribution derivation and the residual.

## 8. State and URL

Hash keys with stable ASCII values: `i=yoy|mom|contrib`, `m=chart|table`, `r=YYYY-MM-YYYY-MM`, `sel=01,04,10_5`, `t=<category>` for the table's active series. Validated and clamped as the overview does; unknown categories are dropped rather than failing. Default: `contrib`, chart, the destination tab's full range, all 12 divisions. Language switching preserves compatible state.

## 9. Excel

One `ჩამოტვირთვა` exports the active tab, range, selection and language through the standard three-sheet workbook:

- `მარტივი ცხრილი` — the grid on screen: one row per selected category and year, month columns labelled by name; the contribution tab adds the `დანარჩენი` row.
- `მონაცემები` — `წელი`, `თვე`, `კატეგორია`, `COICOP კოდი`, `დონე`, `წონა (%)`, `მნიშვნელობა`, `ერთეული`, `სტატუსი`.
- `წყაროები` — the Geostat CPI files and the weights file, with readable archive links.

Contribution exports carry a note naming the measure a Fiscal.ge calculation from published values, with the formula. Internal metadata columns are not exposed.

## 10. Localization, SEO and accessibility

Georgian and English through the existing message and route system, with reviewed labels (`Categories`, `Annual inflation`, `Monthly inflation`, `Contribution to inflation`, `The rest`, `Groups`, `Subgroups`, `Basket share`) and review dates. Standard localized metadata, breadcrumbs, `BreadcrumbList`, sitemap and methodology discovery. The stacked chart exposes an accessible description and a real table alternative; tabs and toggles expose selected state; no hardcoded language in tooltips or exports.

## 11. Methodology

`docs/data-methodology/inflation-cpi-national.md` gains: the category extraction and its anchors, the COICOP levels and the 2004 break, the gap inventory of §3.4 and why gaps are permitted, the weights source with its own refresh cadence and archive, the contribution formula, its residual, the measured reconstruction error, and the reason contributions start in 2013. The public `/methodology/inflation` page gains the weights source and a plain-language statement that contributions are calculated by Fiscal.ge from published Geostat values, with the residual explained.

## 12. Verification and acceptance

Data: archive hash and byte parity, including the new weights file; extraction parity against the workbooks at both levels; en/ka value parity; weight sums at both levels for every year; the gap inventory; the weights/price consistency assertion; the revision guard exercised with a modified fixture; reconstruction error within the §4.6 bounds; import parity; the overview's own facts, the national series and every other dataset unchanged.

Behaviour: each tab's series, unit line and coverage, with no headline value line on any of them; contributions absent before 2013; the stack closing exactly on the published headline at display precision, with and without a full selection; the residual responding to selection; subgroup selection and the two-level counts; the table's tint bins and empty cells; range transitions across three different coverages; hash restore and language switch; workbooks matching tab, range, selection and language.

Visual and browser: the new page against the overview at desktop and mobile widths in both languages; the twelve category colours and the residual passing WCAG AA against the paper ground and against each other where adjacent; no clipped axis labels or horizontal page overflow; a new `tests/browser/inflation-categories.spec.ts`; every existing inflation spec green **unmodified**.

Gates per `CLAUDE.md`: targeted tests while working; `npm run check`, `npm run build` and `npm run test:browser` once, when finished.

## 13. Authority and next step

Approval of this document authorizes the categories section described here and the §2 scope amendment — not cities, products, the calculator, a basket section, or any other price index. After user review, write the implementation plan as separate, test-first steps: reader, prepare and validation, weights archive and collection, serving and mirror, contribution derivation, stacked chart, page and panel, table, workbook, i18n, methodology, verification.
