# Inflation: city pages (amendment to the cities section)

Date: 2026-09-30
Status: Approved by the owner on 2026-09-30.
Amends: `docs/superpowers/specs/2026-09-26-inflation-cities-design.md` ("the cities spec"). Everything in the cities spec not changed here still holds — data, pipeline, validation, mirror, MCP, publications and methodology scope.

## 1. Why

The owner reviewed the built cities page on 2026-09-30 and rejected its category picker (a native `<select>`, the one control the editorial layer did not already have). Rather than restyle the picker, the owner changed the page's shape:

- The comparison of cities shows the **total only**. Comparing one category across cities is not needed on the page (the MCP and the bulk files still carry it).
- Each city gets **its own page**, where its categories live.
- The city choice works **exactly like the regions and municipalities pages**: a picker inside the heading, not a row of all cities.
- **No monthly inflation** on these pages, so the tab switcher goes.

### 1.1 Owner decisions (2026-09-30)

These replace the listed items of the cities spec §1.1:

- **Comparison plus per-city pages** replaces "Comparison, not deep dive". The out-of-scope item "a per-city deep-dive page" is withdrawn. A city page shows no contributions (Geostat publishes no city weights); it shows the city's own categories.
- **Georgia page: total only.** No category choice on the comparison. "Indicators follow the picked category" is withdrawn; the Georgia page's indicators describe the total.
- **Annual inflation only on the pages.** "Two tabs, as on the overview" is withdrawn. Monthly (`mom_pct`) city data stays in the CSV, the mirror, the MCP and the `inflation-cities` publications, unchanged; only the pages stop showing it.
- **City pages do not draw Georgia's line.** Georgia appears on a city page only in the indicators' comparison sentence.
- Unchanged: 2016-01 start, Total + 12 divisions, no city index, weights internal only, all six cities plus Georgia selected by default on the Georgia page, no map, MCP and publications in the same delivery.

## 2. Routes

| Route (ka; `/en` mirrors each) | Page |
| --- | --- |
| `/explorer/inflation/cities` | Georgia page: the six cities compared on the total |
| `/explorer/inflation/cities/{slug}` | City page, `slug` ∈ `tbilisi`, `kutaisi`, `batumi`, `gori`, `telavi`, `zugdidi` |

- `slug` is the city ID without its `city.` prefix. City pages are prerendered with `dynamicParams = false`, as region pages are; an unknown slug is a 404.
- 12 new pages (6 × ka/en). The sitemap (both languages) grows by 12 URLs and the public page inventory by 6 paths.
- The sidebar keeps one `ქალაქები` row, pointing to the Georgia page and active on the Georgia page and every city page.
- Hub card 04 is unchanged and links to the Georgia page.
- The `/methodology/inflation` city section text is updated to describe the new page shape (no tabs, per-city pages).

## 3. The heading picker

Both page types open with the same heading pattern the regions and municipalities pages use:

```text
ინფლაცია ქალაქებში — საქართველო ▾          (Georgia page; no previous/next links)
ინფლაცია ქალაქებში — ბათუმი ▾      ← ქუთაისი · გორი →      (city page)
```

- **Trigger.** The place name is a button in the H1 with the regions page's styling: accent text, dashed accent underline, Lucide `ChevronDown`, `aria-expanded`. Clicking opens the picker; the H1 lead text is not part of the button.
- **Picker.** The regions picker's anatomy and behaviour: a non-modal dialog under the heading with a search combobox, a listbox, arrow-key navigation, Enter to go, Escape or an outside click to close and return focus to the trigger, the empty-search state with `ძებნის გასუფთავება`, and the hint footer. Options: `საქართველო` first, styled like `ყველა რეგიონი` (tint row, accent text), then the six cities in Geostat's order. The current page's option is marked `aria-current="page"` and bold accent. Choosing an option navigates to that page in the current language.
- **Previous / next.** City pages only, on the heading's right, exactly as region pages: `← {previous city}` and `{next city} →` in Geostat's order, wrapping (Zugdidi's next is Tbilisi). The Georgia page has none, as the municipalities Georgia page has none.
- **Component.** A new `CityPicker` in the inflation component family, a sibling of `RegionPicker` with the same markup, classes and keyboard behaviour. `RegionPicker` and `EntityPicker` are not refactored or changed.
- **Labels.** H1 lead `ინფლაცია ქალაქებში —` / `Inflation by city —`. The trigger shows `საქართველო` / `Georgia` or the city's reviewed label. The breadcrumb stays `მთავარი / მონაცემები / ინფლაცია / ქალაქები` on the Georgia page and gains the city name on a city page (`… / ქალაქები / ბათუმი`).

## 4. The Georgia page

```text
Home / Data / Inflation / Cities                 Jan 2016 – Aug 2026 · updated YYYY-MM-DD

ინფლაცია ქალაქებში — საქართველო ▾
პროცენტი · წინა წლის შესაბამის თვესთან შედარებით

ხაზი | ცხრილი                                     │  სერიები 7 / 7
line chart: Georgia (ink) + 6 cities, total      │  ☑ საქართველო
legend · monthly range strip · source note        │  ☑ თბილისი … ☑ ზუგდიდი
                                                  │  ჩამოტვირთვა
ძირითადი ინდიკატორები
hero: highest city │ lowest city │ gap between cities │ cities above national
```

- **Removed:** the tab row, the category picker, the monthly measure.
- **Kept as built:** the unit line, the seven-line default with Georgia first and in ink, the six city colours, the series panel with bulk actions and count, `ხაზი | ცხრილი`, the month-grid table with its `წლის საშუალო` column (every line here is a total, so the column is always present), the range strip, the Excel download, the source note with the same-price-everywhere sentence.
- **Indicators:** as built (highest, lowest, gap, above national), always on the total. The differences argue from the printed one-decimal figures (fixed on 2026-09-29).

## 5. The city page

```text
Home / Data / Inflation / Cities / Batumi        Jan 2016 – Aug 2026 · updated YYYY-MM-DD

ინფლაცია ქალაქებში — ბათუმი ▾                    ← ქუთაისი · გორი →
პროცენტი · წინა წლის შესაბამის თვესთან შედარებით

ხაზი | ცხრილი                                     │  სერიები 1 / 13
line chart: Batumi total (ink) + picked divisions│  ☑ სულ
legend · monthly range strip · source note        │  ☐ სურსათი და უალკოჰოლო სასმელები … (12)
                                                  │  ჩამოტვირთვა
ძირითადი ინდიკატორები
hero: city total vs Georgia │ ყველაზე გაძვირებული │ ყველაზე ნაკლებად გაძვირებული │ ინფლაციის სიგანე
```

- **Coverage** comes from that city's loaded facts: Zugdidi's page runs from 2016-12, the others from 2016-01. The breadcrumb coverage label and the range strip follow it.
- **Series panel.** `სულ` (the city's total) plus the 12 divisions, with the existing reviewed category labels. **Only `სულ` is selected by default**, per the project rule; it stays first, selectable and removable. Bulk actions and `სერიები {selected} / 13` as on every panel; the search box stays.
- **Colours.** The total in ink; divisions in the colours the national Categories page already gives each `cpi.cat.*`, so a division is the same colour on both pages.
- **Table.** The same month grid, one series at a time through the existing series switcher. `წლის საშუალო` appears for `სულ` only (Geostat publishes a 12-month average for the city total, not for divisions).
- **Indicators** (latest published month, year on year, divisions only; Georgia is the reference, never ranked):
  - **Hero:** the city's total rate at 62px; the existing hero sentence (`ბათუმი: წლიური ინფლაცია 7.1%; საქართველოში 5.6%, სხვაობა +1.5 პპ.`); like the Georgia page's hero, it has no sparkline.
  - **`ყველაზე გაძვირებული`**: the division with the highest rate; detail: its distance from Georgia's same division in `პპ`.
  - **`ყველაზე ნაკლებად გაძვირებული`**, or **`ყველაზე გაიაფებული`** when its printed rate is negative (the Categories page's labels and rule): the division with the lowest rate, same detail, never coloured good or bad.
  - **`ინფლაციის სიგანე`**: divisions with a positive printed rate, as `{n} / 12` with `ჯგუფი გაძვირდა`, and a 36-month sparkline of that count — the Categories page's breadth indicator.
  - Differences use the printed one-decimal figures; ties resolve exactly as on the Categories page: ranking uses the unrounded rates, and an exact tie keeps COICOP order (so the fastest is the earlier division and the slowest the later one).
- **Caveat.** The same standing same-price-everywhere sentence in the source note. It matters more here, because a city page shows the categories where the centrally priced items sit.
- **Excel.** The standard three-sheet workbook for the selected series of that city over the range: `მარტივი ცხრილი` (one row per series and year, `წლის საშუალო` for `სულ` only), `მონაცემები` (`წელი`, `თვე`, `ქალაქი`, `კატეგორია`, `COICOP კოდი`, `მნიშვნელობა`, `ერთეული`, `სტატუსი`), `წყაროები`. The same note; no weights.

## 6. State and URL

Both page types keep their state in the hash, validated as today; unknown values are dropped; language switching preserves compatible state.

- Georgia page: `m=chart|table`, `r=YYYY-MM-YYYY-MM`, `sel=georgia,tbilisi,…`, `t=<line>`. The keys `i` and `c` are no longer written; an old link carrying them still opens (the values are ignored).
- City page: `m`, `r`, `sel=total,01,…,12`, `t=total|01…12`.

## 7. Page payload

Each page ships only what it draws: the Georgia page, the seven lines' total `yoy_pct` plus December `avg12_pct`; a city page, that city's 13 series' `yoy_pct` plus its total's December `avg12_pct`, and Georgia's latest-month total and division rates for the indicators. No page ships `mom_pct`.

## 8. What is removed from the branch

The native category select (`inflation-city-category-select.tsx`), its `DESIGN.md` §25 paragraph, the tab row and every `mom` path in the cities page, state, table and workbook, and the category argument of the Georgia page's indicators. The `cityCategoryLabel`/`cityCategoryTotal` strings stay only if a city page still uses them. Messages that nothing reads any more are deleted so `i18n:check` stays clean.

## 9. Documents

- `Project_Definition.md` §2C: the cities item describes the Georgia page and six city pages, annual inflation only on the pages, monthly city data through MCP and publications.
- `DESIGN.md` §25: the Cities surface is rewritten — heading picker, Georgia page, city page, indicators; the native-select paragraph is removed.
- `docs/data-methodology/inflation-cpi-national.md`: the page description paragraph only; data and validation text is unchanged.
- `public/llms.txt`: the cities line describes the Georgia page and says each city has its own page; individual city URLs are not listed, as individual region URLs are not.
- The cities spec gets a status line pointing to this amendment.

## 10. Verification

- Unit: Georgia-page state without tab or category; city-page state, hash round trip and default selection; city indicators (fastest, slowest, fell wording on the printed rate, breadth, ties, distance from Georgia's same division); the per-page payload carries no `mom_pct`; workbook models for both page types.
- Browser (`tests/browser/inflation-cities.spec.ts`, rewritten): heading picker opens, searches, navigates and closes with Escape on both page types; previous/next on a city page and their wrap; the Georgia page's seven-line default; a city page's total-only default and turning a division on; Zugdidi's page starting 2016-12; the annual-average column rules; no tab row and no `<select>`; both languages; mobile width without horizontal overflow.
- Everything else as the cities spec §12: the reference fixture unchanged (the MCP is not touched), publications matching the snapshot, `npm run check`, `npm run build`, `npm run test:browser`.

## 11. Authority and next step

Approval of this amendment authorizes the Georgia page and six city pages as described, and the removals in §8. The MCP, publications, data and pipeline are not changed. After owner review, write the implementation plan as separate test-first tasks on the existing branch `claude/cities-inflation-tasks-78945d`.
