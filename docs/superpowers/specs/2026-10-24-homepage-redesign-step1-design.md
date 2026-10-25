# Homepage redesign, step 1 (budget chapters)

Date: 2026-10-24
Status: Draft for Duru's review. Content of step 1 agreed in the thread "Redesign the homepage" on 2026-10-24 ("ok", 18:36 Tbilisi).
Design source: Duru's redesign canvas https://claude.ai/artifact/NTvuHd3oasbXxkNcZto2Wz, board `project/Main.dc.html` ("მთავარი · დესკტოპი").

## 1. Intended result

The homepage stops being a set of small tables and becomes a short visual story about Georgia's public money. Each section asks one plain question, answers it in one sentence and shows one chart the reader can play with. A first-time visitor should grasp in a minute how big the budget is next to the economy, where it goes, where it comes from, how it is shared between municipalities and how big the deficit is. Every heading leads to the matching explorer page.

Success means:

- The page matches the redesign board for the parts in scope (section 3), on desktop and on a 375px phone.
- Every number, sentence and chart on it is computed at build time from the same served facts as the explorer. Nothing is typed in by hand except population and area, which are hand-maintained today too.
- The page stays as fast as today on phones: no new libraries, charts load only when the reader scrolls near them, phones still never load the 3D map library.
- Georgian and English pages are the same design.

## 2. Decisions already made by Duru

| Date (Tbilisi) | Decision |
| --- | --- |
| 2026-10-24 18:05 | Build in two steps. Step 1 (this spec): hero, country numbers, the five budget chapters, sources, AI, footer. Step 2 (own spec later): ageing population, youth unemployment, wages for women and men, foreign trade, causes of death. |
| 2026-10-24 18:35 | The new footer goes on the homepage, Methodology, AI connection and About. Explorer pages keep today's footer until the explorer redesign. |
| 2026-10-24 18:36 | Agreed the step 1 content list, that each chart is rebuilt as part of our site from live data, and that a chapter's summary sentence may wrap to two lines on a phone (the one-line rule is for page headings). |

## 3. Page order

1. Shared header (unchanged).
2. Living-relief hero (unchanged, including its kicker, H1 and CTA, mobile still image and desktop WebGL rules in `DESIGN.md` §19).
3. Country numbers: population, area, economy size (unchanged content and component).
4. Chapter 01: How big is the budget next to the economy.
5. Chapter 02: How Georgia's budget is spent.
6. Chapter 03: How Georgia's budget is funded.
7. Chapter 04: How municipal budgets are shared out.
8. Chapter 05: How big is Georgia's budget deficit.
9. Sources: every number back to its source.
10. Ask AI (dark band).
11. New footer.

Removed from today's page: the five-link dataset row, the expenditure / revenue / municipal ledger tables, the Government Debt block, the Deficit block and the old methodology block. Government debt stays reachable as a measure in chapter 01 and in the footer and header menus.

Chapter numbers are not shown on the page (the board does not show them); they are used here and as section anchors (`#ch-01` … `#ch-05`, `#sources`, `#ai`).

## 4. Shared chapter layout

Taken from the board:

- 1.5px ink rule on top, then the heading in the display serif (`clamp(22px, 2.2vw, 30px)`), then one summary sentence (15px, body colour, max 860px wide).
- The heading is a link to its explorer page. A small accent arrow follows the last word; on hover the heading underlines in accent and, from 1200px wide, the destination name appears to its right. On touch screens the whole heading is the tap target.
- 96px between chapters (72px below 768px). Content fades and rises 16px into view once, when scrolled to; with reduced motion everything is simply shown.
- Charts use the existing tokens (`--paper`, `--ink`, `--accent` and so on) and fonts. The revenue palette in 4.3 is new and is added to `DESIGN.md`.
- Every chart has an accessible name that states its main numbers, and a tooltip on hover or tap. Keyboard users get the same numbers from the side lists, readouts and accessible names; the chart canvas itself is not a keyboard stop.

Each summary sentence is a message template with numbers filled in from data, so it changes when the data changes. The Georgian templates are the board's sentences; English ones are drafted to match and go on Duru's proofread list.

## 5. The chapters

All years below are "latest" at the time of writing (2025); the build always uses the latest year the data has.

### 5.1 Chapter 01, budget next to the economy

- Heading: `რამხელაა ბიუჯეტი ეკონომიკასთან შედარებით` → `/explorer/analysis`.
- Sentence: `ყოველი კვადრატი 10 მილიონი ლარია.`
- Chart: a field of squares, one per 10 million GEL of nominal GDP in the latest GDP year (10,460 for 2025), filled column by column from the bottom left. The chosen measure's squares are dark; a marker shows where it ends with its share of GDP.
- Measure buttons, each with its value: nominal GDP; consolidated budget receipts (revenue chapter total); state budget spending; government debt; budget deficit (or surplus, by sign); municipal budgets; foreign direct investment; money transfers from abroad. Default: state budget spending. Readout: value in billion GEL, share of GDP and number of squares.
- Data: all for the latest GDP year. A measure without a value for that year is left out. FDI (`fdi.total`) and money transfers (`transfer.total`, received) are in US dollars; they are converted with that year's nominal GDP in GEL divided by nominal GDP in USD (both Geostat).
- Animation: squares fade in once, then the chosen share fills; switching measures re-fills with a short wave of accent colour at the edge. Reduced motion: the final state only.

### 5.2 Chapter 02, how the budget is spent

- Heading: `როგორ იხარჯება საქართველოს ბიუჯეტი` → `/explorer/expenditure`.
- Sentence: `{year} წელს სახელმწიფო ბიუჯეტიდან {total} მილიარდი ლარი დაიხარჯა — ყველაზე მეტი {largestField}-ზე.` (wording of the largest field's case is checked per field during the build).
- Controls: the year shown large, the total for that year, a play button that steps through every year from the first, and a year slider (a real range input) with the total-spending line drawn under it.
- Chart: a squarified block chart of the 13 public spending fields for the chosen year. The whole block shrinks in proportion to the largest year's total, so growth over time is visible; a dashed frame shows the largest year's size when an earlier year is chosen. Labels inside blocks when they fit; tooltip gives amount, share and change from the previous year.
- Side list: every field with amount and share for the chosen year; hovering or focusing a row highlights its block.
- Data: the active public expenditure facts (actual wins over planned). If the chosen year is planned, the year label says so.

### 5.3 Chapter 03, how the budget is funded

- Heading: `როგორ ფინანსდება საქართველოს ბიუჯეტი` → `/explorer/revenue`.
- Sentence: `{year} წელს ნაერთი ბიუჯეტის შემოსულობებმა {total} მილიარდი ლარი შეადგინა: {taxShare}% გადასახადებიდან შემოვიდა, {borrowShare}% — ვალდებულებების ზრდიდან.`
- Chart: stacked areas from the first to the latest year in billion GEL, seven layers: VAT; income tax; profit tax; excise; other taxes (import, property and other taxes); other receipts (grants, other revenue, asset decrease); increase in liabilities. On wide screens the latest year's layers are labelled on the right with amount and share; on phones with share only. One callout marks the year with the highest borrowing share.
- Tooltip: every layer's amount for the hovered year, total and tax share. A missing value shows "—".
- Data: active public revenue facts, item IDs grouped as above.

### 5.4 Chapter 04, municipal budgets

- Heading: `როგორ ნაწილდება მუნიციპალური ბიუჯეტი` → `/explorer/municipalities`.
- Sentence: `{count} მუნიციპალიტეტის {year} წლის ბიუჯეტი {total} მილიარდი ლარია — {tbilisiShareWords}, {tbilisi} მილიარდი, თბილისზე მოდის.` (`tbilisiShareWords` is chosen from the actual share, for example "მესამედზე მეტი").
- Chart: full-width 3D relief of Georgia made of dots. Each municipality's dots rise with its total budget; the city municipalities (Batumi, Kutaisi, Poti, Rustavi and the other markers on the explorer map) are small columns at their marker. Three labels: Tbilisi and the next two largest. A slow camera drift; drag is not needed. Tooltip: name, total budget, budget per resident and rank. Heights: 640px desktop, 500px below 900px, 330px below 600px.
- Map shape: built at build time from the same municipality geometry as the explorer map (`MUNICIPALITY_MAP_ARTIFACT`), rasterised into a dot grid. Occupied areas are drawn as flat, low grey dots. The board's hand-drawn letter grid is not copied.
- Drawing: raw WebGL (no Three.js) with a plain 2D-canvas fallback when WebGL is missing; the board already does both.
- Data: latest municipal total facts and 2025 population, the same values the municipalities explorer uses. The excluded codes stay excluded.

### 5.5 Chapter 05, the deficit

- Heading: `რამდენია საქართველოს ბიუჯეტის დეფიციტი` → `/explorer/deficit`.
- Sentence: `ზოგადი მთავრობის დეფიციტი {year} წელს მშპ-ის {pct}% იყო; ყველაზე ღრმა — {deepestPct}% — {deepestYear} წელს.` The board's "during the pandemic" is kept only as a fixed fact for 2020 if 2020 is the deepest year.
- Chart: one bar per year from 1995 to the last IMF projection year, as % of GDP. Deficits ink, surpluses green, projection years faded on a light band labelled `IMF-ის პროგნოზი`. A dashed accent line at −3% (Georgia's fiscal-rule ceiling) with its label. Value labels sit on the deepest actual deficit and on the deepest actual deficit at least five years before it (today 2020 and 2009); a bracket marks the longest run of actual surplus years (today 2004–2007).
- Tooltip: % of GDP, GEL amount, and whether it is a deficit, surplus or projection.
- Data: `general-government-balance-annual-1995-2031.csv` via the served balance facts; the shaded band starts at the first non-actual year.

### 5.6 Sources

- Heading: `ყოველი ციფრი — პირველწყარომდე` (no link). Sentence from the board. A small line: `{n} კრებული · ბოლო გადამოწმება {date}` and the link `მეთოდოლოგიის ნახვა →`.
- Four steps from the board (keep the original file; classify; reconcile and check; download as CSV, JSON or via MCP under CC BY 4.0).
- Coverage timeline: one row per live methodology dataset, with a bar from its first to last year on a 1990–2030 axis (a "from 1960" tag when earlier) and its number of archived original files on the right; a total row at the bottom.
- Data: `buildMethodologyHubEntries` (the Methodology page's own list), so names, years and file counts always match that page.

### 5.7 Ask AI

- Dark full-width band from the board: heading `ჰკითხე AI-ს — პასუხი წყაროსთან ერთად`, sentence, the line `MCP · Streamable HTTP · ავტორიზაციის გარეშე`.
- The endpoint `https://fiscal.ge/mcp` with a copy button (`კოპირება` → `დაკოპირდა` for about two seconds; falls back to selecting the text if the clipboard is blocked).
- Three facts: read-only, no token, no session. A list of the server's tools taken from the MCP tool registry (all of them, not the board's four). Link `AI-კავშირის ინსტრუქცია →` to `/connect`.
- A card "how it works" with the board's five steps from question to answer.

## 6. New footer

Shared by the homepage, Methodology, AI connection and About (Duru, 18:35). Contents from the board:

- Left: logo (220px wide), the mission sentence `„ჩვენი მიზანია, საქართველოს მონაცემები იყოს არა მხოლოდ საჯარო, არამედ რეალურად ხელმისაწვდომი, გასაგები და გამოყენებადი.“`, and `info@fiscal.ge`.
- Column "მონაცემები": every dataset hub from the shared navigation list.
- Column "პლატფორმა": Methodology, AI connection, About, the other language.
- Bottom line: the source and licence sentence with the last review date, then `© {year} Fiscal.ge` and `CC BY 4.0`.
- Phones: one column, links in two columns of 44px rows (as today).

The explorer keeps today's footer: `SiteFooterView` gains a `variant` prop whose default is today's footer, so explorer output and tests do not change.

## 7. How it is built

### Reused as is

- `SiteHeader`, `HeroReliefLazy` and `hero-relief.tsx`, the country-numbers block and `landingGdpFigure`, the page metadata and canonical tags in `lib/pages/home.tsx`.
- Served-data loaders already called by `renderHomePage` (budget, municipal, debt, balance, GDP), plus the FDI and money-transfer loaders the explorer pages use.
- `chooseActivePublicFacts`, the public label helpers, `DATASET_HUBS`, `buildMethodologyHubEntries` with `loadGeneratedArchiveSummaries`, the MCP tool registry, `MUNICIPALITY_MAP_ARTIFACT`.
- Tokens and fonts from `globals.css`; Lucide for UI icons (play, pause, arrow, copy).

### Small additions

- `lib/landing/landingData.ts`: the model gains the chapter data (yearly series for spending fields and revenue groups, balance series, municipal list with per-resident values and ranks). The ledger summaries and the debt summary that only the removed sections used are removed with them.
- `SiteFooterView`: the `variant` prop above.
- Message files `landing.json` (ka, en): chapter headings, sentence templates, labels.

### Genuinely new

- `components/landing/chapters/`: one client component per chart (squares, spending blocks with year control, revenue areas, municipal relief, deficit bars) plus the sources and AI sections. The explorer's charts were considered and are not reused: they are line and bar charts with series lists and tables, a different visual language from the board's editorial charts.
- A small shared canvas helper for these charts (pixel-ratio sizing, text, tooltip placement, scroll-triggered start, reduced motion), ported from the board's script.
- A build-time helper that turns the municipality geometry into the relief's dot grid.

### Data flow

At build time `renderHomePage` builds one compact homepage model (a few thousand numbers) and passes each chapter only its slice. The page stays fully static. Each chart's code is a separate chunk loaded when its section comes within about one screen of view, so the first screen downloads no chart code.

### Speed and safety

- No new dependencies. Below 768px the hero still uses its still image and never requests Three.js.
- The municipal relief starts drawing only when visible and pauses when off screen or when the tab is hidden.
- Canvas pixel ratio is capped at 2.
- Heavy text stays real HTML (headings, sentences, lists, readouts), so the page reads and indexes without JavaScript; charts show a short "visual could not load, data is in the explorer" note if their script fails, as the hero already does.

## 8. Testing

- Unit tests (Vitest) for the new model: squares count, measure values and currency conversion, spending and revenue grouping and totals, balance series and projection start, municipal ranks and per-resident values, sentence numbers, dot-grid builder (every included municipality gets dots, excluded codes get none).
- Browser tests (Playwright), replacing the parts of `tests/browser/landing.spec.ts` that check removed sections: section order and headings in both languages; heading links; measure buttons update the readout; year slider and play change the spending year; reduced motion shows final states; no horizontal overflow at 375px and 390px; footer on homepage, Methodology, Connect and About and the old footer still on explorer pages; no console errors; hero tests unchanged.
- Existing accessibility scan (axe) passes on the homepage.

## 9. Documents updated with the build

- `DESIGN.md` §19 rewritten for the new section order, chapter layout, charts, revenue palette and the two footer variants.
- `Project_Definition.md` section 2 does not list the homepage sections, so it needs no change.
- Proofread list for Duru: every new Georgian and English string, in `/mnt/project-files/homepage-redesign/notes-for-duru.md`.

## 10. Out of scope

- Step 2 chapters (separate spec).
- Explorer redesign and the explorer footer (thread "Redesign and regroup the explorer"). Heading links use whichever explorer addresses are live when this merges; if that thread renames them first, these links follow.
- The chart share button (its own thread).
- Any data import, new dataset or change to the hero.
