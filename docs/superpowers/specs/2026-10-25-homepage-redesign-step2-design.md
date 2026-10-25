# Homepage redesign, step 2 (society chapters)

Date: 2026-10-25
Status: Draft for Duru's review. Content agreed in the thread "Build homepage redesign part 2" on 2026-10-25 ("ok", 12:51 Tbilisi).
Design source: Duru's redesign canvas https://claude.ai/artifact/NTvuHd3oasbXxkNcZto2Wz, board `project/Main.dc.html`, sections `ch-09`, `ch-10`, `ch-11`, `ch-13` and `ch-14` (copy in `/mnt/project-files/homepage-redesign/design-board/`).
Builds on: step 1, `docs/superpowers/specs/2026-10-24-homepage-redesign-step1-design.md` (branch `claude/project-thread-ojqgbj`).

## 1. Intended result

After the five budget chapters, the homepage goes on to tell five short stories about Georgian society: an ageing population, youth unemployment, the pay gap between women and men, foreign trade, and causes of death. Each one uses the same layout as step 1: a question or claim as the heading, one sentence, and charts the reader can hover or tap.

Success means:

- The five sections match the board on desktop and on a 375px phone.
- Every number, sentence and chart is computed at build time from the same served facts as the matching explorer page. Nothing is typed in by hand.
- Wording that makes a claim follows the data, so a data update can never leave a false heading or sentence (section 4).
- The page stays as fast as step 1 made it: no new libraries, and chart code loads only when the reader scrolls near it.
- The Georgian and English pages have the same design.

## 2. Decisions already made by Duru

| Date (Tbilisi) | Decision |
| --- | --- |
| 2026-10-24 18:05 | Step 2 covers the five society chapters: ageing, youth unemployment, women's and men's wages, foreign trade, causes of death. |
| 2026-10-25 12:51 | Agreed the content list and the choices below: claim wording follows the data, the "cars" card becomes "largest export product", heading links follow the explorer addresses, step 1's building blocks are reused, and there is no share button (like step 1). |

## 3. Page order

Step 1's order, with the new chapters between the deficit and Sources:

1–8. Header, hero, country numbers, chapters 01–05 (unchanged from step 1).
9. Chapter 06: Georgia is ageing (`#ch-06`).
10. Chapter 07: Youth unemployment (`#ch-07`).
11. Chapter 08: Who earns how much (`#ch-08`).
12. Chapter 09: Who Georgia trades with (`#ch-09`).
13. Chapter 10: What people in Georgia die of (`#ch-10`).
14. Sources, Ask AI, footer (unchanged from step 1).

The board's internal numbers (09, 10, 11, 13, 14) are not shown on the page. The anchors continue step 1's sequence.

## 4. Shared rules

- Every chapter uses step 1's `Chapter` frame (ink rule, display-serif heading linking to the explorer, one lede, fade-in on scroll) and step 1's chart helpers. Chart heights, phone layouts and colours follow the board. The board's men/women colours (`#3D5A98`, `#C26E4C`), export/import colours (`#1f6e56`, `#3a332a`) and the five births-map classes are new and are added to `DESIGN.md`.
- Number cards ("stat cards") are real HTML: a small label, a big number and one note line. They read and index without JavaScript.
- "Latest year" always means the latest year that measure has in the served data. Each chart says its year in its title.
- **Claim wording follows the data.** When a heading or sentence makes a comparison, the build picks the wording from the actual numbers:
  - Chapter 06's heading reads "Georgia is ageing" only while the share of people aged 65+ in the latest year is higher than in the first year. Otherwise it reads "How Georgia's population is changing".
  - Chapter 07's heading takes its comparison word from the ratio of youth to overall unemployment: below 1.2 "a little higher", 1.2–1.75 "about one and a half times higher", 1.75–1.95 "almost twice as high", 1.95–2.05 "twice as high", above 2.05 "more than twice as high". Today's 25.4% / 13.9% = 1.83 gives the board's "almost twice".
  - Chapter 10's "every fifth death has no established cause" names the fraction from the actual share (one in N, rounded to the nearest whole N from 2 to 10). Outside that range it says the percentage instead.
- Every chart has an accessible name that states its main numbers (built from the data, like step 1), and a tooltip on hover or tap. The stat cards and side lists carry the same numbers for keyboard and screen-reader users.
- No share button. Like step 1's charts, these are homepage charts, not explorer chart panels, and the board shows none.

## 5. The chapters

### 5.1 Chapter 06, an ageing population

- Heading: `საქართველო ბერდება` / "Georgia is getting older" (see 4) → `/explorer/demography`.
- Lede: `{year} წლის 1 იანვრისთვის 65 წლისა და უფროსი ასაკის მოსახლეობის წილი {share}% იყო — {firstYear} წელს {firstShare}%; {vitalYear} წელს ყოველ 100 გარდაცვლილზე {births} ახალშობილი მოდიოდა.`
- Pyramid (left, 7/12 wide on desktop): men left, women right, 18 five-year age groups from 0–4 to 85+, as % of the whole population on 1 January of the latest year. The first year's shape (2004 today) is drawn as a thin ink outline over it. Tooltip: men's and women's share and count, and both sexes' share in the first year.
- Census break: Geostat re-based the population after the 2024 census, so the first year's outline and 65+ share predate the re-base. The outline's legend item says so ("Structure in 2004 (before the census re-base)"); no other line is added. Owner decision pending; this is the recommended option (the alternative is to compare within one basis).
- Stat cards (right column):
  1. Women per 100 men, latest year, with a note giving the ratio in the 85+ group ("2.6 times as many").
  2. Life expectancy at birth, latest year, with women's and men's values in the note.
  3. Total fertility rate, latest year, with the note that about 2.1 is needed to replace generations (a fixed fact).
  4. Net migration, latest year, with a small bar chart of every year in the comparable series (2012 onwards: teal above zero, accent red below) and a note with the series total.
- Map (full width under them): births per 100 deaths in every municipality in the latest year, drawn as flat dots on step 1's municipal dot grid (same shape, same excluded codes, occupied areas outlined). Five colour classes: under 50, 50–75, 75–100, 100–125, 125 and over; municipalities without data are hollow. Labels on the highest and lowest municipality, Tbilisi, and the next highest. Tooltip: name, births per 100 deaths, births, deaths, natural increase or decrease.
- Data: `demography.population_by_age_sex` (age groups by sex), `demography.population_age_band` (65+ share), `demography.live_births` and `demography.deaths` (country and municipalities), `demography.life_expectancy_*`, `demography.total_fertility_rate`, `demography.net_migration`.

### 5.2 Chapter 07, youth unemployment

- Heading: `ახალგაზრდებში უმუშევრობა {comparison}` / "Youth unemployment is {comparison}" (see 4) → `/explorer/unemployment`.
- Lede: `{year} წელს უმუშევრობის დონე {rate}% იყო, 15–29 წლის ახალგაზრდებში — {youthRate}%.`
- Two 10×10 square grids side by side (stacked on phones): "out of every 100 people aged 15+" and "out of every 100 young people aged 15–29": employed (ink), unemployed (accent), outside the labour force (hollow). Shares are rounded so the three always add up to 100. Each grid has a key with the whole number and the count (million or thousand people). Tooltip: share, count, and a line with the unemployment rate or the size of the labour force.
- Regions (full width): the unemployment rate in each region in the latest year, highest first, as dots on lines, with a dashed accent line at the Georgia rate. Tooltip: rate and the difference from Georgia in percentage points.
- Data: the labour force survey facts the unemployment explorer serves. Ages 15–29 are the sum of the 15–19, 20–24 and 25–29 groups (employed, unemployed, outside the labour force), and their rate is computed from those sums. Regions are the regions that have a rate in the latest year.

### 5.3 Chapter 08, wages of women and men

- Heading: `ვინ რამდენს გამოიმუშავებს` / "Who earns how much" → `/explorer/wages`.
- Lede: `საშუალო თვიური ხელფასი {year} წელს {avg} ლარი იყო; ქალები კაცების საშუალო ხელფასის {ratio}%-ს იღებენ.`
- Dumbbell chart (left): one row per economic activity (19 today), highest average wage first. Each row shows women's average (copper dot), men's average (blue dot), the line between them and a tick at the all-employee average; women's pay as a % of men's is on the right. Tooltip: men, women, average, and the ratio.
- Stat cards (right): average wage, with a small line of every year since the first year and a note with the first year's value; median wage; women's pay as a % of men's, with both amounts in the note; public sector average, with the non-public average in the note.
- Data: the wages explorer's facts: national average and median, `sex` by sector, `ownership` public and non-public. Activity names are the wages explorer's own labels.

### 5.4 Chapter 09, foreign trade

- Heading: `ვისთან ვაჭრობს საქართველო` / "Who Georgia trades with" → `/explorer/trade`.
- Lede: `{year} წელს საგარეო სავაჭრო ბრუნვამ {turnover} მილიარდი დოლარი შეადგინა: ექსპორტი {exports} მილიარდი იყო, იმპორტი — {imports}.`
- Butterfly chart (left): the 10 largest partner countries by turnover in the latest year, exports to the left (green), imports to the right (dark), with values. Tooltip: turnover, exports, imports, balance.
- Lines (right): exports and imports in billion US dollars from the first year to the latest, with the gap between them shaded as the deficit. Tooltip: both values and the balance.
- Three stat cards: turnover; trade balance, with the note "imports are N times exports"; the largest export product's share of exports, with its value and the second-largest product in the note. The card's label is "largest export product" and its name comes from the data (passenger cars today).
- Data: trade overview facts (totals), partner facts (countries only, not groups), product facts (four-digit goods; names from the product catalogue).

### 5.5 Chapter 10, causes of death

- Heading: `რისგან კვდებიან საქართველოში` / "What people in Georgia die of" → `/explorer/health/causes-of-death`.
- Lede: `{year} წელს {total} ადამიანი გარდაიცვალა, {topShare}% — {topCause}; {unknownPhrase} მიზეზი დადგენილი არ არის.` The cause's Georgian grammatical form comes from a per-cause message key, so any cause can be the largest.
- Unit chart (full width): one square for every 100 deaths, in rows grouped by cause: the five largest causes by count, then "other causes". The largest cause is accent red, "cause not established" is hollow squares, "other causes" are light grey, the rest ink. Each group shows its name, count and share. Tooltip: name, count, share and number of squares.
- Data: the health explorer's `health.deaths.*` facts for Georgia in the latest year; `health.deaths.total` is the total.

## 6. How it is built

### Reused as is

- Step 1's `Chapter`, `Reveal`, chart core (`chart-core.ts`, `canvas.ts`, `chart-draw.ts`, `chart-layout.ts`, `chart-format.ts`, `chart-tip.tsx`, `chart-tips.ts`) and the lazy-loading pattern of its chart components.
- Step 1's municipal dot grid (`MunicipalChapter.grid` and its place codes) for the births map.
- The served loaders the explorer pages use: `loadServedDemographyData`, `loadServedUnemploymentData`, `loadServedWagesData`, `loadServedTradeOverviewData`, `loadServedTradePartnersData`, `loadServedTradeProductsData`, `loadServedHealthData`, plus their label helpers (regions, activities, partners, products, causes).
- Number and share formatters from `lib/explorer/format`.

### Small additions

- `lib/landing/chapters/types.ts` and `index.ts`: five new chapter models and sentences in `HomeChapters`.
- `lib/pages/home.tsx`: loads the five datasets above.
- `landing.json` (ka, en): headings, ledes, comparison words, card labels and notes, legend and tooltip labels, cause forms.
- `landing-page.tsx`: five more `Chapter` blocks.

### Genuinely new

- One builder per chapter in `lib/landing/chapters/` (`ageing.ts`, `youthJobs.ts`, `wageGap.ts`, `trade.ts`, `deaths.ts`), each a pure function from served facts to a small model.
- Chart engines and components in `components/landing/chapters/`: pyramid, migration bars, births map, square grid, regions, dumbbell, butterfly, trade lines, unit chart, plus a shared stat-card component. Ported from the board's script onto step 1's chart core.
- Explorer charts considered and not reused: `PopulationPyramid`, `MunicipalityMap`, `EditorialLineChart` and the bar charts are SVG explorer components with series lists, tables and their own interaction; the homepage uses the board's canvas look, as step 1 decided for its charts.

### Speed

- Each chapter's chart code is its own chunk, loaded when the section comes within about a screen of view, as in step 1.
- The homepage model grows by a few hundred numbers. The large trade product table is read only at build time; the page receives only the top two products.

## 7. Testing

- Unit tests (Vitest) for each builder against the real served data and small fixtures: pyramid shares add up to 100, 65+ shares, births per 100 deaths for Georgia and every municipality on the grid, youth sums and rate (25.4% for 2025), waffles adding to 100, the comparison word thresholds, the ageing heading switch, sector rows and ratios, top-10 partners exclude groups, largest product share, deaths groups add up to the total, the "one in N" phrase.
- Browser tests (Playwright) in `landing.spec.ts`: the five sections appear after the deficit chapter and before Sources in both languages with their headings and links; stat cards show numbers; tooltips appear on hover; reduced motion shows final states; no horizontal overflow at 375px and 390px; no console errors.
- The existing accessibility scan (axe) passes on the homepage.

## 8. Documents updated with the build

- `DESIGN.md` §19: the five chapters and the new colours.
- Proofread list for Duru: every new Georgian and English string, in `/mnt/project-files/homepage-redesign-step2/notes-for-duru.md`.

## 9. Out of scope

- Any change to step 1's sections, the explorer, or the data.
- Board sections not listed above.
- The explorer redesign's new addresses: heading links use whichever explorer addresses are live when this merges.
