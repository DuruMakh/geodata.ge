# Year in review (წლის მიმოხილვა)

Date: 2026-10-30
Status: Approved (Duru, 2026-10-30 09:36 Tbilisi, "Ok"; D1 and D2 as recommended).
Design source: Duru's redesign canvas https://claude.ai/artifact/NTvuHd3oasbXxkNcZto2Wz, page "analysis" ("წლის მიმოხილვა — რედიზაინი"). The prototype is `project/AN-App.dc.html`. The other boards import it with different settings: `AN-Pin` (a category picked), `AN-2020` (another year), `AN-Adm` (institutions), `AN-En` (English), `AN-Phone` and `AN-Phone-2026` (375px phone).

## 1. Intended result

Today's Analysis page (`/explorer/analysis`) shows one year of the state budget as a treemap, a 100-cell grid, a radar, a bubble field and a ranking. The new page tells the story of **one year from every angle**: what came in, what the state gave up in tax breaks, where the money went and what it bought, the deficit and debt, and how much it comes to per resident and per municipality. A year ruler at the top moves every section to another year at once.

Success means:

- The page matches the redesign boards on desktop and on a 375px phone, in Georgian and English, with the deviations listed in section 9.
- Every number, sentence and chart is computed at build time from the data already served on fiscal.ge. Nothing is typed in by hand.
- It is one release (Duru, 2026-10-30 09:18 Tbilisi).
- Every chart carries the share button (DESIGN.md §7.17).
- The page ships less data to the browser than today's Analysis page, and stays fully static (prerendered).

## 2. Decisions made by Duru

| Date (Tbilisi) | Decision |
| --- | --- |
| 2026-10-30 08:41 | Build the redesign of the year review page from the canvas page "analysis". |
| 2026-10-30 09:18 | Release all six sections at once, not in two steps. |
| 2026-10-30 09:36 | Spec approved. D1: the line under the heading is `ერთი წელი ყველა კუთხიდან` / `One year from every angle`. D2: no Excel download on this page. |

Assumptions told to Duru on 2026-10-30 (none corrected): same address, new name in the menu; the radar and the bubble field go; numbers only from served data; a share button on every chart; no footer line; the notes list stays; per-resident figures use Geostat population for every year.

## 3. Address, name and links

- The address stays `/explorer/analysis` (English `/en/explorer/analysis`), so old links keep working. Old `#ay=` (year) and `#ag=` (grouping) links still open that year and grouping. `#as=revenue` opens the long-view chart (section 06) on receipts.
- The page's name changes from `ანალიზი` / `Analysis` to `წლის მიმოხილვა` / `Year in review` everywhere it appears: sidebar, breadcrumbs, the All data list and search, the Budget group page card, the homepage chapter 01 destination name (`ბიუჯეტის ანალიზი` becomes `წლის მიმოხილვა`), the page title and the search-engine description.
- The page keeps its place in the Budget sidebar list (between Municipalities and Debt).

## 4. Page layout, top to bottom

The page uses the normal explorer shell (sidebar, breadcrumbs, the updated-date line on the right of the breadcrumbs). Sections are numbered 01–06, each with a 1px ink rule on top, the number in accent, an H2 and a short mono line on the right (as in the board).

### Header

- H1 `წლის მიმოხილვა` / `Year in review`.
- One short line under it. See decision D1 in section 10: the board's line wraps to three lines on a phone, which breaks the one-line rule.
- **Year ruler**: one tick per year of the state budget (2004 to the planned year, now 2026). The chosen year is a large dot with its label in bold; planned years carry a small `გეგმა` / `plan` tag. Click, drag or the arrow keys pick a year (a radio group for assistive technology). Below 768px the ruler labels every fourth year plus the chosen one, as in the phone board.
- The page opens on the **latest year with actual spending** (now 2025), not on the plan year.
- When a category is picked anywhere (see "Picking a category"), a chip with its colour and name appears beside the ruler. Pressing it clears the pick.

### 01 · `{year} ერთ სურათზე` / `{year} at a glance`

Right-hand line: `სადაც {year} წლის მონაცემი არ არის, ნაჩვენებია უახლოესი ხელმისაწვდომი წელი`.

**Six headline numbers**, each with a small trend line for every year and a dot on the chosen year:

| Number | Source page | Detail line |
| --- | --- | --- |
| State budget spending | Expenditure | change on the year before (`+6.8% · 2024 წელთან`) |
| Tax revenue | Revenue (taxes only) | share of GDP |
| Balance, % of GDP | Deficit | amount in GEL and a record phrase (`deficit — smallest since 2018`, `largest since 1995`, or `surplus`) |
| Public debt | Debt | share of GDP and the external share |
| Tax breaks | Tax breaks and refunds | `GEL per 100 GEL of tax` |
| Spending per resident | Expenditure ÷ Geostat population on 1 January | GEL a day |

Where a dataset has no value for the chosen year, the nearest year is used and a small boxed year tag shows which (the board's `2024` tag on tax breaks).

**Findings** (`მიგნებები`): six cards, each a sentence computed from the data, a detail line and a small picture. Each card links to its page.

1. Receipts: which tax fell, or that every tax grew and which grew fastest (with a trend line).
2. Tax breaks: for every 100 GEL of VAT collected, how many were given up, compared with the first year of the report (two bars).
3. Spending: debt service's rank among the spending fields and the gap to the next one (two bars). The sentence follows the data: if debt service is not near the top, the card names the largest field and its lead instead.
4. What the money buys: the spending type that moved against all the others (`the only one of 8 types that fell`), with a trend line.
5. Debt: repayments plus interest as a share of tax revenue (two bars).
6. Municipalities: how few municipalities account for half of municipal spending (one stacked bar).

The exact sentence patterns are the board's (the `f1`…`f6` strings). Section 7 lists the rules for each.

### 02 · `რას თმობს სახელმწიფო` / `What the state gives up`

Right-hand line: `შეღავათები: {year} · დაბრუნება: {year}`.

- **Collected vs given up** (left): three columns (VAT, income and profit tax, all taxes). The ink part above the line is what came in; the hatched accent part below it is what tax breaks cost. Under each column: `{n} ₾ ყოველ 100 ₾-ზე`.
- **Tax refunds** (right): the big number for the chosen year, its share of tax revenue, and a record phrase when it is the highest since 2008. Below it, a column chart 2008–latest with the chosen year in ink.
- The board's note under the section stays.

### 03 · `სად მიდის ფული` / `Where the money goes`

Right-hand line: `{year} · სახელმწიფო ბიუჯეტი`, and a two-button switch `სფეროები` / `უწყებები` (fields / institutions).

- **Every 100 GEL** (`სად მიდის ყოველი 100 ლარი`): a 10×10 grid, cells in category colours, whole GEL that always add up to 100. Beside it, the ranking: rank, swatch, GEL of every 100, name, amount · share · change, and a trend line per category. Under the grid, `2004 წელს`: the same grid for the first year and, for the hovered or picked category, `{then} ₾ → {now} ₾`.
- **What changed** (`რა შეიცვალა {previous year} წელთან შედარებით`): three facts (total change, largest increase, largest decrease) and a bar per category, increases right and decreases left, with amount and percentage. When the chosen year is a plan, the line says `2026 — გეგმა, 2025 — ფაქტი`. On the first year it says there is nothing to compare with.
- **What the money buys** (`რას ყიდულობს ფული`): a treemap of general-government spending by economic type (Spending by type page) for the chosen year, with each tile's amount, share and change. Tiny types are listed under it. The board's note that general government is wider than the state budget stays.

### 04 · `დეფიციტი და ვალი` / `Deficit and debt`

- **Deficit and surplus, % of GDP**: one column per year 1995–2031, surplus green and deficit accent red, projection years hatched. The chosen year has a value label, and so does the deepest deficit.
- **Debt at year end**: the big number, a two-part bar (external / domestic, with percentages and amounts), then three figures: to GDP, per resident, and the average interest rate. Under them, a small line chart of average interest rates (all debt, external, domestic). Beside them, a column chart of debt by year, external and domestic stacked.
- **Debt repayments by year**: principal and interest stacked, 2013–2030, the years from 2026 hatched as the schedule for existing debt. The peak is labelled. The board's note about new borrowing stays.

### 05 · `ქვეყანა და რეგიონები` / `Country and regions`

- **`{year}: how much per resident`**: six rows, each with a name, its scope in small text, a bar and the GEL amount: state budget spending, tax revenue, public debt, debt repayments and interest, social benefits (general government), and the median municipality's spending. The board's note that the rows come from different datasets stays.
- **By region**: one row per region, sorted by its average. Each municipality is a dot at its spending per resident, with a tick for the region's average and a dashed line for the national median. Hovering a dot names the municipality. A screen-reader list gives every municipality's figure. The board's note about Adjara stays.

Municipal figures are the Municipalities page's own (same per-resident year, same population, same exclusions), so the two pages always agree. When the chosen year is not that year, the year tag shows it.

### 06 · `დიდი სურათი: 2004–{last}` / `The long view`

Two switches: expenditure / receipts, and share / GEL. Two facts: the largest share gain and the largest share loss over the whole period. Then a stacked area chart of every category over all years, with the chosen year marked by a line, the plan year hatched, labels at the right edge, a hover readout, and a legend underneath.

### Notes and source

The board's `შენიშვნები და წყარო` list, with its dates, years and population figures filled in from the data, then the row of links to the source pages and Methodology. No footer line (see section 9).

## 5. Picking a category

Hovering a category anywhere (grid cell, ranking row, change bar, long-view band or legend) highlights it in sections 03 and 06: the other categories fade, as in the `AN-Pin` board. Clicking or tapping pins it; the chip by the ruler clears it. The pick is not saved in the address.

## 6. Where the numbers come from

Every number comes from the existing served data, the same loaders the topic pages use:

| Data | Loader (existing) | Scope |
| --- | --- | --- |
| State budget spending by field and by institution, receipts | `loadServedExplorerData` (facts, admin facts, GDP) | state budget; receipts consolidated budget; actual wins over planned |
| Spending by economic type | `loadServedExpenditureTypesData` | general government |
| Tax breaks, tax refunds | `loadServedTaxBreaksRefundsData` | MoF estimate; Treasury |
| Balance | `loadServedGeneralGovernmentBalanceData` | general government, actual + projection |
| Debt stock, service, schedule, rates | `loadServedGovernmentDebtData` | MoF |
| Municipal spending and per resident | `loadServedMunicipalData` + `buildMunicipalListRows` | as on the Municipalities page |
| Population on 1 January | demography served data (`demography.population_total`, Georgia) | Geostat |

The server turns these into one small year-review data object: a few hundred numbers per series, with names in the page language. The browser gets only that object, not the raw facts (today's Analysis page ships every budget fact). The browser then works out the chosen year's view from it, so moving the ruler needs no network request.

## 7. Rules for computed text

- **Nearest year.** A dataset without the chosen year uses its nearest year at or before it; if there is none before, the nearest after it. The year shown in the tag is the one used.
- **Records** (balance, refunds): the phrase is chosen by comparing the chosen year with every earlier actual year in that series. Projection years never count.
- **Plan years.** A planned value is always marked `გეგმა` / `plan`, and a change from a plan year to an actual year says so (`planVsActual`).
- **Finding 1 (taxes).** Among tax lines with a positive value in both years: if exactly one fell, `f6one`; if several fell, `f6many` naming the largest fall; if none fell, `f6none` naming the fastest growth.
- **Finding 3 (debt service).** If debt service is the largest field, `f1top`; otherwise `f1h` with its rank written as a Georgian ordinal (`მე-4`) or an English one (`4th`), and the gap to the field above it (`f1close` when the gap is under 1% of the total, otherwise `f1far`).
- **Finding 4 (spending types).** If exactly one type moved against the direction of all the others, `f3onlyDown` or `f3onlyUp`; otherwise the type with the largest percentage change.
- **Finding 6 (municipalities).** The smallest number of municipalities, largest first, whose spending passes half of the municipal total.
- Georgian sentences are templates with whole words only, so no grammatical case is built in code. Every template is in the message files and goes through `i18n:check`.

## 8. What is reused, extended and new (AGENTS.md "Reuse first")

**Reused as is**

- Explorer shell, `PageHeader`, breadcrumbs JSON-LD, `fiscalMetadata`, `coverageLabel`.
- `ChartShareButton` + `ShareCard` under every chart.
- `Sparkline` (`components/ui/sparkline.tsx`) for the headline and ranking trend lines.
- Served-data loaders in section 6, `buildMunicipalListRows` and `chooseActivePublicFacts` (actual wins over planned).
- The squarified layout (`squarify` in `lib/explorer/treemapLayout.ts`) and the largest-remainder "every 100" rounding (`wholeGelFrom100` in `lib/explorer/singleYear.ts`) that today's Analysis page uses.
- Number formatting (`lib/explorer/format.ts`), category colours and the planned-value rules.

**Small additions**

- `StackedColumnChart` (`components/main-explorer/stacked-column-chart.tsx`) draws refunds, the deficit, debt by year and repayments. It gets two optional props whose defaults leave every current chart unchanged: a highlighted period (the chosen year in ink, with its label) and a "projection from" period (hatched columns).
- `urlState.ts`: `as=revenue` now selects the long-view side.
- The navigation label key for the page, and the homepage chapter 01 destination name.

**New** (none of the existing charts has these shapes)

- `lib/yearReview/`: the server-side builder of the year-review data, and the pure functions that turn it into one year's view, findings included.
- `components/year-review/`: the page, year ruler, headline numbers, findings cards, the collected-vs-given-up chart, waffle with ranking, change bars, the per-resident ledger, the regional dot plot and the long-view stacked area chart.

**Removed** (only today's Analysis page uses them): `analysis-explorer.tsx`, `analysis-view.tsx`, `radar.tsx`, `budget-field.tsx`, `every-100.tsx`, `ranking.tsx`, `treemap.tsx`, and the parts of `lib/explorer/singleYear.ts` only they use, with their tests. DESIGN.md §9 is rewritten for the new page.

## 9. Deviations from the board

1. **No footer line** (`© 2026 Fiscal.ge · CC BY 4.0 · info@fiscal.ge`). Duru ruled on 2026-10-25 that explorer pages have no footer.
2. **Share buttons** are added under each chart, at the right of its note, or right-aligned under the chart when it has no note.
3. **Charts drawn by the site's own column chart** (refunds, deficit, debt by year, repayments) take its look: dot-lattice grid, hover readout, keyboard steps and phone readout panel. The board draws plain gridlines.
4. **Per resident** uses Geostat's population on 1 January of each year, so the figure exists for every year from 2004. The board had it only for 2025 and 2026, with 2025 worked out from municipal data. The notes say so.
5. The `8 მონაცემთა ნაკრები · განახლდა …` line becomes the site's usual updated-date line in the same place.

## 10. Questions settled with Duru (2026-10-30 09:36)

- **D1 — the line under the heading.** The board's line, `ერთი წელი ყველა კუთხიდან: შემოსავალი, შეღავათები, ხარჯი, ვალი და მუნიციპალიტეტები.`, takes three lines on a phone. Your rule is one short line that fits a phone. Recommended: `ერთი წელი ყველა კუთხიდან` / `One year from every angle`.
- **D2 — Excel.** Today's Analysis page has no Excel download and neither does the board. Recommended: none on this page; the source links at the bottom lead to each page's own Excel.

## 11. Testing

- Unit tests for the year-review builder against the real served data: totals match the topic pages for 2025 (state spending, tax revenue, balance, debt, tax breaks, refunds, the Municipalities page's per-resident figures), nearest-year fallback, plan marking, and each findings rule with small synthetic inputs (including the "none fell" and "debt service is largest" branches).
- `StackedColumnChart`: the new props are off by default (existing snapshots unchanged), and on, they draw the highlighted and hatched periods.
- Browser tests: the page renders in both languages, the ruler changes every section, the grouping switch and the long-view switches work, picking highlights and the chip clears it, old `#ay=` / `#ag=` / `#as=` links, no horizontal scroll at 375px, the heading line fits one line at 375px, axe accessibility scan, and each share button produces a picture.
- `tests/explorer/chartShareCoverage.test.ts` stays green; the new page's chart files are added to it.
- The existing browser and SEO tests that name `ანალიზი` / `Analysis` are updated to the new name.
- Done-check per CLAUDE.md: `npm run check`, `npm run build`, the browser suite, after Duru approves the screenshots and preview.
