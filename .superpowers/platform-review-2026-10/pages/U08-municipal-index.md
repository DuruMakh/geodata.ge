# U08-municipal-index review: /explorer/municipalities and /explorer/municipalities/georgia (ka + en)

Reviewed against the live build at http://localhost:3100 (canonical host https://fiscal.ge). Read-only. Existing specs `municipalities.spec.ts` + `municipal-georgia.spec.ts` ran green (28 tests, 32.7 s, one worker). `municipalOverrides.test.tsx` green (12 tests, 2.9 s).

## Summary

No critical or high problems. The unit is in good shape on SEO, bilingual parity and security. The weak spots are phone and screen-reader details, and wasted prefetch traffic.
Scores (1-10): code quality 7, performance 6, UI/UX 8, mobile 7, accessibility 6, bilingual 9, SEO/metadata 9, security 9, tests 7.
Counts: 5 medium, 8 low. Most important: every visible row link on the index prefetches a full 120 KB page, about 1 MB gzip on a phone that scrolls the list (U08-municipal-index-01).

Measured numbers

| page | HTML raw / gzip | inline RSC payload | JS (all files loaded, raw / gzip) |
|---|---|---|---|
| ka /explorer/municipalities | 400,940 / 37,716 B | ~116 KB | 35 files, 1,336,783 / 413,236 B |
| ka /explorer/municipalities/georgia | 254,465 / 30,178 B | ~122 KB | same 35 files |
| en /explorer/municipalities | 311,938 / 33,369 B | n/a | n/a |
| en /explorer/municipalities/georgia | 203,189 / 27,501 B | n/a | n/a |

- The JS set is identical to `/explorer/revenue`: no page-specific bundle, nothing to trim in this unit.
- The map definitions SVG is 236,747 B raw and 72,565 B gzip. It is immutable-cached and gzip-served.
- Fonts 154 KB (3 woff2). CSS 76 KB.
- Metadata checked and correct on all four URLs: title, description, canonical, hreflang ka/en/x-default, og tags, lang attribute, sitemap entries with alternates, Dataset JSON-LD (index has 76 `hasPart`, Georgia has `isPartOf` and `omitMeasures`) and BreadcrumbList.
- Hash input: `#sel=<img onerror>`, `#r=abc`, `#%E0%A4%A`, `#r=9999-1` were tried on the Georgia page. None threw, none reached the DOM, and the range was clamped. `rel="noreferrer"` is on the one external link. There is no `dangerouslySetInnerHTML`.

## Findings

| id | area | severity | evidence | problem | suggested fix | effort | shared? |
|---|---|---|---|---|---|---|---|
| U08-municipal-index-01 | performance | medium | `components/municipalities/municipalities-index.tsx` row `<Link>` (about line 106) has no `prefetch` prop. CDP measurement at 375px: scrolling the page once fired 79 extra `_rsc` requests, 1,044,066 B encoded. At 1280px: 21 extra requests, 1.5 MB decoded. Each municipality payload is about 120 KB (e.g. `/explorer/municipalities/tbilisi?_rsc=...` returns 121,348 B). | Next prefetches the full static payload of every row that scrolls into view. On a phone the whole 64-row list is visible, so one scroll pulls about 1 MB gzip the reader may never use. The component is also used by the demography population and births-deaths indexes, so they pay the same cost. | Set `prefetch={false}` on row links (the destination is a static page and loads fast on click). Keep prefetch for the Georgia row if wanted. | S | n |
| U08-municipal-index-02 | mobile | medium | Measured on `/explorer/municipalities` at 375px (map 335px wide): city-marker touch disks are Batumi 6.7px, Kutaisi 9.9px, Tbilisi 15.4px, Rustavi 15.4px, Poti 21.6px across, while the visible markers are 5px. 16 polygons with a long side under 24px get no disk at all (codes 34 = 16x13px, 26 = 22x13, 27 = 21x10, 28, 22, 09, 31, 47 ...). DESIGN.md §20 says city markers get disks "up to 32px". | `lib/explorer/mapTouchTargets.ts` shrinks each disk to half the distance to its nearest small neighbour. It drops the disk when `r <= size/2`. It also assumes a 350px map (`PHONE_MAP_WIDTH_PX`) where the real map at 375px is 335px. Batumi and Kutaisi, which are marker-only, are therefore far below the 24px WCAG 2.2 minimum and below what §20 promises. | Give city markers a minimum disk (24px) regardless of neighbours. Use the real rendered width, not the 350 constant. Add a test that every marker disk is at least 24px. | M | y (`lib/explorer/mapTouchTargets.ts`, also used by regional maps) |
| U08-municipal-index-03 | accessibility | medium | `municipalities-index.tsx:269` renders the empty state as a plain `<div data-testid="municipal-empty">`. The picker's equivalent (`entity-picker.tsx:329`) uses `role="status"`. `data-testid="row-count"` (about line 258) shows a bare `64` or `3 / 64` with no label and no live region. | A screen-reader user typing into the index search hears nothing when results narrow or run out. DESIGN.md §20 ("Search surfaces answer") asks for a live status, and the picker already does it. | Add `role="status"` to the empty block. Make the count a polite live region with a label (e.g. "3 of 64"). Reuse the picker's markup. | S | n (shared by the demography indexes that reuse this component) |
| U08-municipal-index-04 | accessibility | medium | Georgia page HTML: `<svg role="img" aria-label="Multi-year trend">` (desktop and mobile copies) inside `role="region" tabindex="0" aria-label="Multi-year chart"`. No `desc`, no data summary. | The chart has a name but no values: a screen-reader user gets "Multi-year trend, image" and must know to switch to the Table mode. | Put a short generated summary in the svg (series name, first and latest value, range) or `aria-describedby` a visually hidden summary. | M | y (`components/main-explorer/editorial-line-chart.tsx`) |
| U08-municipal-index-05 | accessibility | medium | Playwright Tab walk on `/explorer/municipalities` at 1440px: the first map target is tab stop 23, after 22 sidebar and header links. Page HTML has no "skip to content" link (`grep -i skip` finds nothing) and `<main>` has no id. | WCAG 2.4.1 bypass blocks: keyboard users tab through the whole sidebar on every page before reaching content. The landmarks (`nav`, `main`) help screen-reader users but not plain keyboard users. | Add a visually hidden skip link as the first focusable element, targeting `<main id=...>`. | S | y (shell: `components/shell/` / `components/explorer-shell/`) |
| U08-municipal-index-06 | performance / security | low | Georgia page RSC payload (about 111 KB): `totalFacts` ships 11 rows x 16 fields including `reconciliationDifferenceGel`, `warningAmountGel`, `showWarning`, `warningType`, `totalPaymentsGel`, `expensesGel`. `functionFacts` ships 110 rows with `municipalityCode:"country.georgia"`, `functionalCode` and `sourceId:"source.municipal_portal_archive"`. `workbookSources` and the two other source lists add about 29 KB. The client (`buildMunicipalEntityModel`, `lib/explorer/municipalData.ts`) reads only year, categoryId, amountGel, publicTotalGel. | Unused internal ids and reconciliation metadata reach the browser (DESIGN.md says no reconciliation warning appears in the explorer; the Excel test already guards `country.georgia`). About 28 KB raw of payload plus the source lists are only needed on Excel click. | Project the facts to the four used fields on the server (`lib/pages/municipal-country.tsx`). Load workbook sources lazily on download. | M | n |
| U08-municipal-index-07 | performance | low | `/explorer/municipalities` Dataset JSON-LD is 37,657 B raw (about 9% of the 400,940 B HTML): 76 `hasPart` entries each repeating `"${name}. ${subsetDescription}"` (`lib/pages/municipal-index.tsx` about line 66). | The same long description string is repeated 76 times. Small after gzip but pure repetition. | Drop the repeated description from `hasPart` entries (name and url are enough) or keep it only on the parent. | S | n |
| U08-municipal-index-08 | code quality | low | The literal `nameKa: "საქართველო"` appears in `lib/pages/municipal-country.tsx:148`, `municipality.tsx:235`, `municipal-region.tsx:271`, `lib/explorer/municipalData.ts:316`, `lib/explorer/demographyPopulationIndex.ts:70`, `lib/pages/demography-population-place.tsx:170`. The "updated note" expression `message(..."municipal.updatedNote"..., locale === "en" ? formatDisplayDate(...) : lastUpdatedAt)` is copied in `municipal-index.tsx:135`, `municipal-country.tsx:153`, `municipal-region.tsx:281`, `municipality.tsx:245`. | Same snippet repeated four to six times; a wording or format change must be made everywhere. | One helper for the picker country object and one for the source-note suffix, in `lib/explorer/municipalData.ts` (where `buildCountryListRow` already lives). | S | n |
| U08-municipal-index-09 | UI/UX | low | 1700px wide screenshot: in the 336px column, 4-digit per-resident values wrap to two lines ("1,579 ერთ / მოსახლეზე", 122px amount column) while "993 ერთ მოსახლეზე" fits on one, so row heights differ (about 59px vs 52px). Region subtitles are cut to "სამეგრელო-ზემო სვ…" via `min-[768px]:truncate` with no `title`. | Uneven row rhythm and a cut region name with no way to read it. Tbilisi's own row reads "თბილისი / თბილისი" (name repeated as region), same in English. | Widen the amount column or shorten the line to fit; add `title` to truncated subtitles; hide the subtitle when it equals the name. | S | n |
| U08-municipal-index-10 | UI/UX | low | `municipalities-index.tsx` lines about 60-75: level state starts as `"muni"` and `#lvl=region` is applied in `useEffect` after hydration. The Regions panel carries the native `hidden` attribute until then. | A `#lvl=region` deep link (the language switch keeps it) first paints municipalities, then swaps (visible flash and layout shift). Without JavaScript the Regions tab and its panel cannot be reached at all, although its links are in the HTML. | Accept as intended or render the region panel visible when no JS (`<noscript>` style). Low priority. | S | n |
| U08-municipal-index-11 | accessibility | low | `components/ui/editorial.tsx:15` `TextTab` renders `<button aria-pressed>`; the two index tabs have no group label and are not tied to their panels (`municipal-list-muni`/`-region`). The index goes h1 then h2 "ძირითადი ინდიკატორები" and the list has no heading. | The Municipalities/Regions switch is announced as two toggle buttons with no context, and the list has no heading to jump to. | Wrap in `role="group"` with a label, or use real tabs; add a visually hidden heading for the list. | S | y (`components/ui/editorial.tsx`) |
| U08-municipal-index-12 | tests | low | See "Missing tests" below. | | | | |
| U08-municipal-index-13 | performance | low | Georgia page: both the desktop and mobile chart SVGs are in the DOM (`data-geometry="desktop"` and `"mobile"`, one hidden by CSS); the `<table>` mode and the 11 series rows duplicate values already inside the payload. | The chart markup is built twice. The cost is small for one series but grows with selection. | Render only the active geometry. | M | y (`components/main-explorer/editorial-line-chart.tsx`) |

Missing tests (finding 12)
1. `municipalities.spec.ts:419` is named "filters and clears the search" but never clicks the clear button; the empty-state `ძებნის გასუფთავება` button on the index has no test (only the picker's does, `municipal-entity.spec.ts:156`).
2. No test asserts the size of every city marker's touch disk. `mobile-repairs-misc.spec.ts:162-175` covers only Tbilisi (04) and Rustavi (48); Batumi and Kutaisi are 6.7px and 9.9px (finding 02).
3. No test guards the prefetch or payload cost of the list (finding 01), or that `#sel=foo` with only unknown ids falls back to the default (works today; the stale hash `#sel=foo` is kept in the URL).

## Tests to drop or merge

All timings from the live run above (one worker).

| file | test | reason | runtime | drop / merge into |
|---|---|---|---|---|
| tests/browser/municipalities.spec.ts:208 | keeps occupied-area and no-data wording out of the map itself | Its first assertion is identical to the last line of the test at :195; the second ("no data") is the only new line | 972 ms | merge into :195 "occupied overlays expose no interaction or public explanation" |
| tests/browser/municipalities.spec.ts:367 | municipalities index > shows the review date of the consolidated Adjara source | Loads the page only to check one string; `:25` already checks "ბოლო განახლება" on the same page | 639 ms | merge into :25 "states where the index figures come from..." |
| tests/browser/municipalities.spec.ts:428 | uses the same simple search label for municipalities and regions | Checks a placeholder string only; no behaviour | 984 ms | merge into :419 "filters and clears the search" |
| tests/browser/municipalities.spec.ts:246, :271 (and bilingual-municipal.spec.ts:38) | Tbilisi path and marker activate together...; list focus takes priority... | `municipality-map-tooltip toHaveCount(0)` and `[aria-describedby] toHaveCount(0)` are asserted in five places; the popup removal is already proven in :215 | 1.0 s, 0.9 s | drop the repeated popup assertions, keep once in :215 |
| tests/browser/municipalities.spec.ts:271, :292, :307 | list focus takes priority...; map and list highlight each other...; map keyboard focus wins... | Three tests of one rule (which source sets `data-active`: focus > map pointer > list pointer) | 0.9 + 1.0 + 1.3 s | merge into one "map/list highlight priority" test |
| tests/browser/municipalities.spec.ts:318 | region rows do not activate municipality geometry | Asserts `transition-duration: 0.1s` and `background-color rgb(241, 234, 220)`, which are CSS implementation details; the behavioural line is the 60-shape count | 1.1 s | drop the CSS assertions, merge the rest into :374 "lists all municipalities and the country-first region grain" |
| tests/browser/municipalities.spec.ts:473 | starts directly with the municipal comparison workspace | Checks workspace visibility (every other test does) and that a deleted intro sentence is absent; the rule is DESIGN.md §17, covered elsewhere | 566 ms | drop (or merge into :462 KPI test) |
| tests/explorer/municipalOverrides.test.tsx:114, :170, :213, :226, :238 | five "markup is the Budget ... (snapshot)" tests | Snapshot of rendered markup (18 KB `.snap` file); duplicates the behavioural "without them..." tests beside each; breaks on any class change | 1-10 ms each | drop (keep the behavioural tests) |
| tests/explorer/municipalityMapData.test.ts:141-229 | the 7 "rejects invalid nested ... / malformed artifact members" tests | Seven near-identical constructor-validation cases over a vendored generated artifact | each under 10 ms | merge into one table-driven test |
| tests/browser/bilingual-municipal.spec.ts:146 | English mobile municipal pages fit and retain regional navigation | `expectEnglish` is repeated from the no-JS English test (:12); the 390px `scrollWidth` check repeats `municipalities.spec.ts:400` | not measured | merge into :12 / :400 |
| tests/browser/municipal-georgia.spec.ts:24 (workbook part) | Georgia municipal aggregate is a country-only explorer | The workbook hyperlink and "no `country.georgia`" checks repeat the "country preserves selected data..." case at bilingual-municipal.spec.ts:93 | 2.3 s | merge Excel assertions into bilingual-municipal.spec.ts:93 |

## Georgian wording for owner review

| page | current text | issue | suggestion |
|---|---|---|---|
| index vs Georgia | H1 index: "რას ხარჯავენ საქართველოს მუნიციპალიტეტები"; H1 Georgia: "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები" | The two H1s are phrased differently, and the Georgian index H1 means "what", while its English H1 ("How Georgia's municipalities spend their budgets") means "how" | Align the two Georgian H1s, and the Georgian and English index H1s |
| index KPI | "უმსხვილესი სფერო" (EN "Largest spending field") | "სფერო" alone does not say spending; "უმსხვილესი" for an amount is unusual | "ყველაზე დიდი ხარჯვის სფერო" |
| index KPI vs rows | KPI "69 მუნიციპალური საბიუჯეტო ერთეული"; Georgia row "69 მუნიციპალური ბიუჯეტი" | Same fact, two wordings | Use one ("საბიუჯეტო ერთეული") |
| index KPI | "მუნიციპალური ხარჯი" (EN "Municipal expenditure") | Mixes "ხარჯი" with "ბიუჯეტი" used everywhere else on the page | Check the intended term |
| header vs source note | header "განახლდა 2026-08-16" (ISO date); English header "Updated 16 August 2026" | Georgian shows ISO, English a long date | Owner's formatting choice; confirm |

## Not checked (and why)

- Excel workbook contents: not downloaded. Covered by `municipal-georgia.spec.ts` and `bilingual-municipal.spec.ts` (hyperlinks, no `country.georgia`).
- Region and single-municipality pages: other units.
- Number correctness: out of scope.
- Firefox / Safari and real screen readers: only Chromium and the accessibility tree via Playwright.
- `bilingual-municipal.spec.ts` runtime: not run (single-spec rule); timings above are for the two specs I ran.
- Entity picker keyboard behaviour on the Georgia page: reviewed by code and `municipal-entity.spec.ts` names only.
