# Explorer redesign: 8 groups, group pages and the All data search page

Date: 2026-10-24
Status: Approved by Duru on 2026-10-24 (decision card "Approve the spec so I can write the build plan?", answer "Approve, write the plan", 18:44 Tbilisi). Design parts 1–3 were agreed in the thread "Redesign and regroup the explorer" on 2026-10-24 (18:17–18:35 Tbilisi).
Note (2026-10-24, after approval): main later added Tax breaks and refunds (Budget) and Funded pension (Health and social protection), so the counts below are now 102 pages (Budget 8, Living standards and health 12); the text keeps the approved figures.
Source design: Duru's canvas https://claude.ai/artifact/NTvuHd3oasbXxkNcZto2Wz, page "მონაცემები — ჰაბები და ძებნა" (board `DX-App.dc.html` and the boards that import it).

## 0. In plain words

- The left sidebar stops listing 20 topics. It lists **8 groups** instead, each with an icon and a page count. Any group opens to show its topics and pages.
- Each group gets **its own page**. The page shows four headline numbers, links that jump to each topic, and one card per chart page.
- `/explorer` becomes **All data**: a big search box and an A to Z list of all 100 pages. Search finds pages in Georgian, in English, or in Georgian typed on an English keyboard. It also finds **towns and regions**: a place shows a card with its key numbers and links to its own pages.
- The old topic pages (for example `/explorer/wages`) **forward** to their group page, at that topic's section.
- The chart pages themselves (charts, series lists, tables, Excel) **do not change**. Their addresses do not change either.
- Everything ships as **one release**.

## 1. Intended result and success criteria

A reader finds any of the site's 100 chart pages in two clicks or one search, and sees the latest number before opening the page. The sidebar fits on one screen without scrolling at 1440×900 (8 groups in place of 20 topics).

The work is done when:

1. The sidebar, the 8 group pages and the All data page match the design boards (desktop 1440, collapsed rail, phone 375, English). The differences listed in §9 are the only exceptions.
2. Every number on the group pages and on All data is computed at build time from the same served facts as the chart pages. No figure is typed by hand.
3. Each of the 20 old topic addresses, in Georgian and English, forwards permanently to its group page and section.
4. Search returns the expected first result for the test words in §7.5, in both languages.
5. Typing any of the 11 regions or 63 municipalities shows its place card, with links to that place's own pages.
6. `npm run check`, `npm run build` and the full browser suite pass, along with the axe accessibility scans at phone and desktop widths.

## 2. Decisions on record (Duru, 2026-10-24, Tbilisi time)

| Time | Question | Answer |
| --- | --- | --- |
| 18:07 | Keep the headline numbers at the top of each group page? | **Keep them, as in the redesign.** This replaces the 2026-10-10 rule "no at-a-glance block on hub pages" for the group pages. |
| 18:08 | What happens to the 20 topic pages such as `/explorer/wages`? | **Forward to the group page**, at that topic's section. |
| 18:11 | One release or two? | **One release with everything**, place search included. |
| 18:17–18:35 | Design parts 1 (sidebar and addresses), 2 (group pages) and 3 (All data and search) | "okay" / "ok" / "ok" |

These rules from project memory still hold: one short line under every page heading; chart pages unchanged; yearly data on hubs; Georgia first in place lists.

## 3. Groups and addresses

The 20 topics keep their ids and pages. Each topic belongs to exactly one group:

| # | Group (ka / en) | Address | Icon (Lucide) | Topics, in order | Pages |
| --- | --- | --- | --- | --- | --- |
| 1 | ბიუჯეტი / Budget | `/explorer/budget` | `Landmark` | Budget | 7 |
| 2 | ეკონომიკა და ბიზნესი / Economy and business | `/explorer/economy` | `Factory` | Economy, Business, Housing and construction | 13 |
| 3 | ფასები და ფული / Prices and money | `/explorer/prices` | `Coins` | Inflation, Money and banks | 8 |
| 4 | შრომის ბაზარი / Labour market | `/explorer/labour` | `BriefcaseBusiness` | Unemployment and jobs, Wages | 11 |
| 5 | ცხოვრების დონე და ჯანდაცვა / Living standards and health | `/explorer/living` | `HeartPulse` | Living standards, Health and social protection | 11 |
| 6 | საგარეო სექტორი / External sector | `/explorer/external` | `Ship` | Trade, External flows | 11 |
| 7 | დემოგრაფია / Demography | `/explorer/demography` | `UsersRound` | Demography | 5 |
| 8 | საზოგადოება და გარემო / Society and environment | `/explorer/society` | `Trees` | Education, Science and culture, Crime and justice, Internet and technology, Energy and food, Environment and climate, Transport | 34 |

Total: 100 pages, matching `NAV_TREE` today. All counts come from the config and are never typed by hand.

Every route also exists under `/en`. `/explorer/economy`, `/explorer/external` and `/explorer/demography` keep their addresses, which now serve group pages. A topic's section on its group page has the anchor `#t-{topic}`, for example `#t-wages` or `#t-business`.

### 3.1 Forwarding (permanent, `next.config.ts` `redirects()`, Georgian and `/en`)

| Old address | Forwards to |
| --- | --- |
| `/explorer/business`, `/explorer/housing` | `/explorer/economy#t-business`, `#t-housing` |
| `/explorer/inflation`, `/explorer/money` | `/explorer/prices#t-inflation`, `#t-money` |
| `/explorer/unemployment`, `/explorer/wages` | `/explorer/labour#t-unemployment`, `#t-wages` |
| `/explorer/living-standards`, `/explorer/health` | `/explorer/living#t-living-standards`, `#t-health` |
| `/explorer/trade` | `/explorer/external#t-trade` |
| `/explorer/education`, `/explorer/science-culture`, `/explorer/crime`, `/explorer/internet`, `/explorer/energy-food`, `/explorer/environment`, `/explorer/transport` | `/explorer/society#t-{topic}` |
| existing `/explorer/poverty` forwards | updated so they skip the extra hop: `/explorer/poverty` → `/explorer/living#t-living-standards` |

Only the exact topic addresses forward. Addresses below them, such as `/explorer/wages/overview` and `/explorer/wages/regions/adjara`, stay as they are. `/explorer` itself becomes All data and cannot forward to Budget. People who bookmarked it land on All data, which links Budget first.

How the section is reached: the server forward carries the topic as `?topic={topic}` (for example `/explorer/labour?topic=wages`) and no `#` part, so the browser keeps any `#…` the old link had. On the group page a small script then rewrites the address to `#t-{topic}` and scrolls there. Before that, it hands an old link's view state to the page that now serves it: the Unemployment hub's legacy `#breakdown=…` links (today `UnemploymentLegacyLink`) move to the Labour market page, and the Budget hub's legacy `#nav=…` links (`LegacyHashRedirect`) stay on `/explorer`. A forward cannot write `#t-…` itself, because a `#` in the forward's target would replace the old link's `#…` state.

## 4. Sidebar (`components/shell/data-sidebar.tsx`)

**Expanded, desktop (from 900px).** 272px wide, `ink` background, sticky and full height. From the top:

1. The brand block (mark, `Fiscal.ge`, `ღია მონაცემები`), which links home, as today. The collapse toggle sits at its right (Lucide `PanelLeftClose` / `PanelLeftOpen`).
2. **Search all data**: a full-width button with the search icon, the label and a `/` key hint. It opens All data with the search box focused. The `/` key does the same from any explorer page, except while typing in a field.
3. **All data**: a link with the grid icon (`LayoutGrid`) and the page count (100). It is current on `/explorer`.
4. The overline `თემები` / `Hubs`, then the 8 groups. Each row has the icon, the name and the page count. The row links to the group page, and a separate chevron button opens or closes the row's list. The current group is open on load. Others open with their chevron, and opened rows stay open until closed.
5. An open group shows its topics as small headings (only when it has more than one topic), each with its pages as rows. The current page has the accent left border.
6. Foot: the language switch (`ქარ` / `EN`), then `მეთოდოლოგია` and `AI-კავშირი` (`/methodology`, `/connect`).

**Collapsed rail (from 900px).** 72px wide, with the brand mark, the search icon, the All data icon and the 8 group icons. Hovering over a group icon or focusing it opens a 320px pop-out beside the rail. The pop-out has the group name (linked), its topics and page count, and all its pages. Escape or moving away closes it, and clicking the icon opens the group page. The language switch stacks vertically at the foot. The collapsed choice persists as today (`geodata:sidebar-collapsed`). This replaces the rule "sections are not reachable while collapsed".

**Below 900px.** A 56px top bar with the brand, a search button and a menu button. The menu opens the sidebar full screen, with a close button in place of the collapse toggle. While it is open the page behind is hidden, so focus stays in the menu. Escape and the close button both close it and return focus to the menu button. A link closes it. Every row is at least 44px tall.

The design switches to the phone layout at 768px. We keep **900px**, the site's existing switch point (owner decision D3), because chart pages lose too much width to a 272px sidebar between 768 and 900px.

## 5. Group pages (`/explorer/{group}`)

Order on the page:

1. The breadcrumb row: `მთავარი / მონაცემები / {group}`. `მონაცემები` now links to All data. On the right, mono, sits the meta line: `{n} ქვეთემა · {pages} გვერდი · განახლდა {latest review date}`.
2. The H1 with the group icon in accent, then **one short line** (`HUB_LINE` text of the design, e.g. "უმუშევრობა, დასაქმება და ხელფასები").
3. **Four headline numbers**. Each has a label, the latest value with its period, and a 24px trend line, and links to its page:

| Group | Numbers (page) |
| --- | --- |
| Budget | Revenue, Expenditure, Debt, Deficit as % of GDP |
| Economy and business | Real GDP (economy/gdp; changed from Nominal GDP on 2026-10-25 so the figure follows the GDP overview page's line), Business sales, Jobs in business, Building permits |
| Prices and money | Inflation (latest month), Interest rate (policy rate), Money supply, Loans and deposits |
| Labour market | Unemployment rate, Average monthly wage, People in work (jobs by industry), Informal jobs |
| Living standards and health | Household income, Poverty, Inequality (Gini), Pensioners |
| External sector | Trade turnover, Remittances (money from abroad), Foreign investment, Largest trading partner |
| Demography | Population, Aged 65+, Births, Net migration |
| Society and environment | School pupils, University students, Internet users, Recorded crimes |

   Four columns on desktop, two from 768px down.
4. **Topic links**, only for groups with more than one topic. One link per topic, with its name, a small block per page and the page count. The row sticks to the top while scrolling and scrolls sideways on phones.
5. **One section per topic.** The heading row has the topic name and, mono on the right, `{years} · განახლდა {date} · {n} გვერდი`. Below it is the topic's one short line. A group with one topic (Budget, Demography) shows no topic heading.
6. **Cards**, three columns on desktop, two at tablet width, one on phones. Each card is a link with an index (`01`) and arrow, the page title, a graphic, the latest value with its caption and period, and a footer with the years covered.
   - The **first card of a topic is the lead card**. It is wider, with a larger area chart labelled with its first and last values and years, and it shows the page's description. Its span follows the design: the whole row, two columns, or two columns by two rows, depending on how many pages the topic has.
   - **Graphics:** a line with an end dot for any page with a national series; the **region spread** (one dot per region on a scale, Georgia marked with a dashed line, the lowest and highest named) for every Regions page; **bars** for Unemployment by age; **two bars** for Unemployment by sex (men, women); **top three bars** for Wages by industry. A page without a series or region values shows "Map and list · 11 regions" with the map icon, or keeps the empty graphic band.
7. The explorer footer, as on every explorer page. Its source note names the institutions behind that group's pages.

A topic's latest value, caption, years and update date come from that topic's existing hub card builder (`lib/explorer/*HubCards.ts`) and its coverage label. The group page assembles those builders. It never computes a figure a chart page does not.

## 6. All data page (`/explorer`)

1. The breadcrumb row: `მთავარი / მონაცემები`, meta `100 გვერდი · განახლდა {latest date}`.
2. The H1 `ყველა მონაცემი` / `All data`, then **one short line**: `მოძებნეთ ან დაათვალიერეთ.` / `Search or browse every page.`
3. **The search box** (66px tall, 1.5px ink border, the search icon, placeholder `ინფლაცია, ბათუმი, ხელფასები…`, a `/` hint, and a clear button while it has text). Below it a `სცადეთ:` row of five example words: Georgian `ბათუმი, ინფლაცია, ხელფასები, მშპ, NEET`; English `Batumi, inflation, wages, GDP, xelfasebi`.
4. With an **empty box**, all pages A to Z. A letter bar sticks to the top: Georgian `ა–ჰ`, English `A–Z`, and letters with no page are dimmed and unlinked. Pages are grouped by first letter in two balanced columns, one on phones. Each row shows the page name, its group's icon and name, a 44px trend line (the map icon for a Regions page without one), and the latest value with its period. Vague names get their topic in front: Regions, Spending, Revenue, Products, Categories, Cities, Industries, Sectors, Analysis, Sales, Jobs, Sex, Age groups, Debt and Municipalities. For example `ხელფასები — რეგიონები` / `Wages — regions`.
5. With **text in the box**, results replace the list (§7). The query lives in the page address hash (`#q=ბათუმი`) through the existing `use-hash-state`, so a search can be shared and the back button works.

The A to Z list is rendered on the server and is in the page's HTML for search engines. Search runs in the browser.

## 7. Search

### 7.1 What is searched

- **Pages**: each page's Georgian and English names, its topic and group names in both languages, and a short list of extra words per page (the design's search words, for example `m3`, `npl`, `fdi`, `gini`, `salary`). The extra words are kept with the page's navigation entry, in both languages.
- **Groups and topics**: if every word matches a group's or topic's name, a shortcut row to it appears above the results.
- **Places**: Georgia's 11 regions (Tbilisi counted as a region) and its 63 municipalities, by Georgian and English names.

### 7.2 Matching

- Case and punctuation are ignored. A word matches the start of a word in a field, anywhere inside a field from 3 letters, or as a stem with common Georgian endings removed (`ების`, `ებში`, `ით`, `ის`, `ში`, `ზე`…).
- Weights: page name 10, the other language's name 10, topic 4, group 3, extra words 6. An exact full-name match adds 8. Every word must match for a page to be shown.
- **Latin typed on a Georgian keyboard**: if a Latin query finds nothing, it is read through the standard Georgian keyboard layout (`xelfasebi` → `ხელფასები`). A notice shows the reading: `ქართული განლაგებით: ხელფასები`.
- Matching letters are highlighted in each result name.

### 7.3 Results

- **No place in the query:** one list, best match first. Each row has the group icon, the page name with highlights, a mono line `{group} › {topic}` plus the name in the other language, an 88px trend line, and the latest value with its period.
- **A place in the query** (with or without other words): first the **place card**, with the name, the type ("რეგიონი · 9 მუნიციპალიტეტი", "მუნიციპალიტეტი · აჭარა", "დედაქალაქი") and four facts with their years: population, budget, budget per resident, births per 100 deaths. Then the group **"{place}"**: the place's own pages, each linking to that place's page (for example `/explorer/education/schools/batumi`) with the place's latest value; the place's municipal budget comes first. Then the group **"{region}"**: the pages that have data for its region, each linking to the region's page with the region's value. Other words narrow the lists (`ბათუმი სკოლა` shows only the Schools rows).
- **Nothing found:** `„{q}“ ვერ მოიძებნა`, a hint, and a "show all pages" button that clears the box.
- **Keyboard:** the box is an ARIA combobox over a listbox. ↑ and ↓ move, Enter opens, and Esc clears. A polite live region announces the result count.

### 7.4 Search data

The page names, values and trend lines are already on the page for the A to Z list. The place index (75 places × their pages) is a separate prerendered JSON file per language. It is a `force-static` route handler, as the sitemap and Open Graph images are today. The page fetches it the first time someone types. If it fails to load, page search still works and the place card is simply absent.

### 7.5 Expected results (become tests)

| Query | First result |
| --- | --- |
| `ინფლაცია` | shortcut to Inflation in Prices and money, then Inflation overview |
| `ხელფასები` / `wages` / `xelfasebi` | shortcut to Wages, then Wages overview (the last one with the keyboard notice) |
| `მშპ` / `GDP` | Economy overview |
| `NEET` | Young people not in work or study |
| `ბათუმი` / `Batumi` | Batumi place card, then Batumi's municipal budget |
| `ბათუმი სკოლა` | Batumi card, then Schools in Batumi only |
| `აჭარა` | Adjara region card ("რეგიონი · 6 მუნიციპალიტეტი"), then its pages |
| `qwzx` | nothing found |

## 8. Place index

One adapter per place page family. Each turns that family's served facts into `{ placeId, href, value, period }` with the same latest figure the place page shows. The adapter lives beside the family's existing route helper, and place ids are the shared ones (`region.{id}`, municipality code; `demographyAreas.ts`, `placePageHref`).

| Level | Families (place page exists) |
| --- | --- |
| Municipality and region | Municipal budgets, Population, Schools, Kindergartens, Pensions, Subsistence allowance |
| City | Inflation cities, City air quality |
| Region | Regional economies, Business regions, Housing regions, Transport regions, Internet at home, Income, Spending, Unemployment regions, Wages regions, Causes of death regions, Museums, Forests, Waste, Population by region (age and sex) |

A page with place figures but no place page (Births and deaths, Marriages and divorces) links to the general page with the place's value. The place card's four facts come from the Population, Municipal budget (total and per resident) and Births and deaths data. For a region, the budget is the sum of its municipalities, as the municipal region pages already show.

The same index feeds the region-spread graphic of §5.

## 9. Where the build differs from the prototype

- Phone layout from 900px, not 768px (§4).
- Place results link to the place's own page rather than the general page (agreed in part 3).
- The rail and pop-out icons are Lucide (the project's one icon family). The prototype's inline icons are the same Lucide shapes.
- The prototype's numbers were copied from the live site on 2026-10-24. The build computes them, so they follow the data.
- Footer: the explorer footer stays as it is today. The prototype's one-line footer is only a placeholder.

## 10. Reuse

**Reused as is:** the design tokens in `globals.css` (the prototype uses the same palette and fonts), `PageHeader`, `ExplorerPage`, `ExplorerHeading`, `BreadcrumbJsonLd`, `LanguageSwitch`, `ExplorerFooter`, `use-hash-state`, `coverageLabel`, every topic's `*HubCards.ts` builder and its loaders, place route helpers (`placePageHref`, `areaRoutes`, municipality routes), `MUNICIPALITY_ROUTES`, region labels, the `force-static` route pattern, and `fiscalMetadata`.

**Small additions:**

- `lib/navigation/navTree.ts`: `NAV_GROUPS` (8 groups: id, path, label keys, icon, topic ids) beside `NAV_TREE`. Each topic gains its id and its search words. It stays the one navigation config, and `DATASET_HUBS` (header menu, footer, 404) lists groups.
- `HubCardModel`: optional `latest` (`value`, `period`, `caption`) and optional `graphic`. Each builder fills `latest` from the figure its footer already prints. Current output and tests are unchanged where these fields are unused.
- `Sparkline`: optional area fill and end dot.
- `next.config.ts`: the forwards in §3.1.
- Sitemap: group pages in, old topic hubs out.

**Genuinely new:**

- `GroupPage` (group page layout, headline numbers, topic links, topic sections) and `ExplorerCard` (the card with its graphics). The hub card in `budget-hub.tsx` cannot stretch to lead cards, values and five graphic types without becoming a different component. It is replaced, and it remains in use only for the City air quality index, as DESIGN.md §6.6 records.
- `AllDataPage`, the A to Z list and `ExplorerSearch` (the client search box and results).
- `lib/explorer/search/` holds the matching, the keyboard map and the stems, unit tested.
- `lib/explorer/places/` holds the place index and the adapters.
- The redesigned sidebar rows, the rail pop-out and the phone full-screen menu, inside `data-sidebar.tsx` and `section-nav.tsx`.

## 11. Documents updated in the same change

- `DESIGN.md`: §6.2 (information architecture), §6.6 (cards), §6.7 (shell and sidebar), §7.7 (search), and a new section for the group pages and All data. §17 records the group page headline-numbers exception.
- `Project_Definition.md` §1 "Current Product Focus": 8 groups over 20 topics.
- `AGENTS.md` Project Snapshot: the route families sentence.
- No data methodology changes: no data is added or changed.

## 12. Accessibility

- The sidebar is a `nav` landmark. Group chevrons are buttons with `aria-expanded` and `aria-controls`, and the current page or group carries `aria-current="page"`.
- The rail pop-out opens on focus as well as hover and closes with Escape.
- The phone menu works as a modal: its close button takes focus, the page behind is hidden, and Escape closes it and returns focus to the menu button.
- Search is a labelled combobox with a listbox, `aria-activedescendant`, and a live result count.
- Icons are `aria-hidden` beside text, and icon-only buttons have names.
- Text contrast is at least 4.5:1, using the existing token pairs. Touch targets are at least 44px on phones.
- `prefers-reduced-motion` turns off transitions.

## 13. Testing

- **Unit (vitest):** search matching (§7.5 table, stems, keyboard map, highlighting), place index adapters (one fixture place per family and level), the group config (every `NAV_TREE` topic in exactly one group, counts), `HubCardModel.latest` per builder, forwards (every old address forwards to the right place in both languages), and the sitemap.
- **Browser (Playwright):** a new `explorer-groups.spec.ts` for the sidebar (open and close groups, the rail pop-out, the phone menu, the `/` key), each group page (headline numbers link, topic links jump, card links), All data (A to Z, letter jump, search and keyboard, the place card) and the forwards. Existing specs that open a topic hub (`/explorer/wages` and the like) or the Budget hub at `/explorer` switch to the group pages. Axe scans at phone and desktop widths.
- Screenshots of every board's equivalent for Duru's review before any push.

## 14. Out of scope and dependencies

- Chart pages, data, methodology pages, `/mcp` and the JSON publications are unchanged.
- **Homepage thread:** the homepage links `/explorer` as Budget and to the 20 topic hubs. After this spec is approved, that thread gets the new addresses. The forwards keep old links working in the meantime.
- **Chart share thread:** independent.
- **Other open threads** that add pages (Loans in detail, Tax breaks and refunds, Funded pension): whichever merges second adds its pages to the new config, which means one topic entry plus its search words.
- **Georgian wording** of the new labels (group names, the All data lines, search messages) goes into the proofread list for Duru.
