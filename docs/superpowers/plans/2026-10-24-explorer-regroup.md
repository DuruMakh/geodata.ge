# Explorer regrouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 20-topic sidebar with 8 groups. Add the 8 group pages and the All data page with search (pages and places) at `/explorer`, and forward the 16 old topic hubs, as one release.

**Architecture:** `navTree.ts` stays the one navigation config and gains `NAV_GROUPS`. Each topic's hub data (cards, coverage) comes from its existing render code, extracted into one loader registry. Group pages and All data assemble from it, so no figure is computed twice. A build-time place index (one adapter per place page family) feeds the region-spread graphic and the place search. It is served as a prerendered JSON file per language.

**Tech Stack:** Next.js 16 (App Router, static), React, strict TypeScript, Tailwind v4, lucide-react, vitest (`renderToStaticMarkup` for components), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-explorer-regroup-design.md` (approved 2026-10-24 18:44 Tbilisi). The prototype it describes is copied to `docs/superpowers/specs/assets/2026-10-24-explorer-prototype.dc.html`. Its `<style>` block is the visual reference (class names `dx-*`), and its script section is the reference algorithm for search (`norm`, `KB`, `stem`, `wscore`, `WT`, `pageScore`, `placeFor`, `segs`, `search`) and for card layout (`card`, the lead rule). Port these, do not invent.

## Global Constraints

- Under every page heading: one short line only (AGENTS.md UI contract). Group pages: icon + H1, one line, then the four headline numbers (Duru, 2026-10-24 18:07).
- Every number shown is computed at build time from served facts. Nothing is typed by hand, and year ranges are never hardcoded.
- Icons: Lucide only: `Landmark, Factory, Coins, BriefcaseBusiness, HeartPulse, Ship, UsersRound, Trees` (groups), `LayoutGrid` (All data), `Search`, `PanelLeftClose`/`PanelLeftOpen` (collapse), `ChevronRight`, `X`, `Menu`, `MapPin` (place card), `Map` (map-only card), `ArrowUpRight` (card corner), `Languages` (keyboard reading notice).
- Phone layout below **900px** (not the prototype's 768). Sidebar 272px expanded, 72px rail, 320px pop-out.
- Colors and fonts come from the existing tokens in `app/globals.css`. Add no new hex values except the prototype's two ink-surface lines (`#2c2720` hub divider and `#3a342b` ink-line), as tokens `--ink-divider` and `--ink-line`.
- Every route exists in Georgian and under `/en`. Georgian strings go into `lib/i18n/messages/ka/*.json` and English into `en/*.json` with identical keys (`npm run i18n:check`).
- Strings the sidebar needs go in `common.json` (shipped on every page). All data and group page strings go in new namespaces `allData.json` and `groups.json`, loaded only by those pages.
- No new runtime dependency.
- Do not push, open a PR or run the full gates before Duru's OK on the preview (project rule). Commit locally after every task.

## Review Focus

1. **Mixed or decorated queries.** `„ბათუმი“`, `  wages  `, `WAGES`, `ხელფასები,` must give the same results as the plain word. Test in Task 4.
2. **Tbilisi is a region, a municipality page (Budget) and a city (inflation, air quality) at once.** Typing `თბილისი` shows one place card ("დედაქალაქი"). Its own rows include the Budget page `/explorer/municipalities/tbilisi`, Population `region/tbilisi`, the inflation city and air-quality city pages, with no duplicate rows. Test in Task 3.
3. **Old addresses in every spelling.** `/en/explorer/wages`, `/explorer/wages/` (trailing slash) and `/explorer/unemployment#breakdown=region` (legacy hash) must end on the right group section or legacy target. Tests in Task 6 (config) and Task 9 (browser).
4. **Places data slow or failing.** Typing before `explorer-places.*.json` arrives shows page results at once, and the place card appears when the file lands. A 404 or network error leaves page search working with no error text. Test in Task 7.
5. **Width changes while menus are open.** Opening the phone menu and then widening past 900px must leave the desktop sidebar visible and the page not hidden. A rail pop-out must close when the rail expands. Test in Task 8.

---

### Task 1: Groups in the navigation config

**Files:**
- Modify: `apps/web/lib/navigation/navTree.ts`, `apps/web/lib/navigation/datasetHubs.ts`
- Modify: `apps/web/lib/i18n/messages/{ka,en}/common.json`
- Create: `apps/web/lib/i18n/messages/{ka,en}/groups.json`, `apps/web/lib/i18n/messages/{ka,en}/allData.json` (register both namespaces wherever namespaces are listed for `getMessages`/`i18n:check`)
- Test: `apps/web/tests/navigation/navTree.test.ts`, `apps/web/tests/site/datasetHubs.test.ts`

**Interfaces:**
- Produces:
  - `type TopicId = "budget" | "economy" | "business" | "housing" | "inflation" | "money" | "unemployment" | "wages" | "living-standards" | "health" | "education" | "science-culture" | "crime" | "internet" | "trade" | "external" | "energy-food" | "environment" | "transport" | "demography"`
  - `NavHub` gains `id: TopicId`. Its `href` keeps meaning "the topic's base address" (Budget's stays `/explorer`, holding every page no other topic holds).
  - `type GroupId = "budget" | "economy" | "prices" | "labour" | "living" | "external" | "demography" | "society"`
  - `type NavGroup = { id: GroupId; href: \`/explorer/${string}\`; labelKey: string; topics: readonly TopicId[] }` and `NAV_GROUPS: readonly NavGroup[]`, in the spec §3 order and membership.
  - `ALL_DATA_PATH = "/explorer"`
  - `groupOfTopic(id: TopicId): NavGroup`
  - `topicHub(id: TopicId): NavHub`
  - `currentGroup(pathname: string): NavGroup | null`: a group's own page, else the group of `openHub(pathname)`; `null` on `/explorer`.
  - `groupPages(group: NavGroup): NavSection[]` (the group's topics' sections, in order).
  - `PAGE_COUNT` (100, derived).
  - `LEGACY_TOPIC_FORWARDS: readonly { topic: TopicId; from: string; to: string }[]`: every topic except Budget whose `href` is not its group's `href` (16 rows). `to` is `${group.href}?topic=${topic}`.
  - `common.json` keys: `common.allData`, `common.searchAll`, `common.hubsOverline` (`თემები` / `Hubs`), `common.group.<GroupId>` (8 names, spec §3), `common.topic.<TopicId>` (20 names, the prototype's `TOPICS` ka/en first two columns), `common.groupToggleOpen` / `common.groupToggleClose` (`{name}` placeholder), `common.closeMenu`, `common.methodology`, `common.aiConnection`, `common.pagesCount` (`{n} გვერდი` / `{n} pages`, plural-safe like existing counts).
  - `groups.json`: `groups.line.<GroupId>` (the prototype's `HUB_LINE`), `groups.topicLine.<TopicId>` (`TOPICS` columns 5–6; Budget and Demography have none), `groups.headline.<key>` (labels used in Task 6), `groups.topicsNav`, `groups.meta` (`{topics} ქვეთემა · {pages} გვერდი · განახლდა {date}`), `groups.annual`, `groups.mapAndList` (`რუკა და სია · {n} რეგიონი`), `groups.metaTitle.<GroupId>` and `groups.metaDescription.<GroupId>`.
  - `allData.json`: title, line, meta, label, placeholder, clear, try, chips (`ka`: ბათუმი, ინფლაცია, ხელფასები, მშპ, NEET; `en`: Batumi, inflation, wages, GDP, xelfasebi), keys hint, none/noneHint/showAll, reading notice (`ქართული განლაგებით:` / `Read with the Georgian keyboard:`), alphabet label, results label, place type labels (`რეგიონი · {n} მუნიციპალიტეტი`, `მუნიციპალიტეტი · {region}`, `დედაქალაქი`), place fact labels, `allData.words.<href without /explorer/, slashes as dots>` (the prototype `PG` search words column, split into ka and en words), metaTitle, metaDescription. Copy the Georgian and English text verbatim from the prototype where it exists.
- `DATASET_HUBS` becomes `NAV_GROUPS.map(({ href, labelKey }) => ({ href, labelKey }))`.

- [ ] **Step 1: Write failing tests** in `navTree.test.ts`:
  - `NAV_GROUPS.map(g => g.id)` equals the spec order.
  - Every `NAV_TREE` id appears in exactly one group.
  - Per-group page counts are `[7, 13, 8, 11, 11, 11, 5, 34]` and `PAGE_COUNT === 100`.
  - `currentGroup("/explorer")` is `null`; `currentGroup("/explorer/labour")?.id === "labour"`; `currentGroup("/explorer/wages/regions/adjara")?.id === "labour"`; `currentGroup("/explorer/deficit")?.id === "budget"`; `currentGroup("/explorer/economy")?.id === "economy"`; `currentGroup("/explorer/prices")?.id === "prices"`.
  - `LEGACY_TOPIC_FORWARDS` has 16 rows, includes `{ topic: "wages", from: "/explorer/wages", to: "/explorer/labour?topic=wages" }`, and has none for budget, economy, external or demography.
  - Every `common.group.*` and `common.topic.*` key exists in both languages.

  Update `datasetHubs.test.ts` to expect the 8 group hrefs.
- [ ] **Step 2: Run** `npx vitest run tests/navigation/navTree.test.ts tests/site/datasetHubs.test.ts`. Expected: FAIL (missing exports).
- [ ] **Step 3: Implement** the exports and messages above. Keep `openHub`, `currentEntry`, `isActivePath` and `sourceNoteKey` working for chart pages. Add `PAGE_SOURCE_NOTES` entries for the 8 group paths and `/explorer`, with new keys `common.sourceNote.group.<GroupId>` and `common.sourceNote.allData`, each naming the institutions of its member topics' existing notes.
- [ ] **Step 4: Run** the same tests plus `npm run i18n:check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(nav): eight groups over the twenty topics in the navigation config`.

### Task 2: Topic hub data registry, with latest values on every card

**Files:**
- Create: `apps/web/lib/explorer/topicHub.ts` (types), `apps/web/lib/pages/topicHubs.server.ts` (registry)
- Modify: `apps/web/lib/explorer/hubCards.ts` (`HubCardModel`) and every builder: `businessHubCards, crimeHubCards, demographyHubCards, economyHubCards, educationHubCards, energyFoodHubCards, environmentHubCards, externalHubCards, healthHubCards, householdHubCards, housingHubCards, hubCards (budget), inflationHubCards, internetHubCards, labourHubCards, moneyBanksHubCards, povertyHubCards, scienceCultureHubCards, socialHubCards, tradeHubCards, transportHubCards, unemploymentHubCards, wagesHubCards`
- Modify: the topic render functions, which move into loaders: `lib/pages/hub.tsx` (`renderHubPage`), `lib/pages/hubs/*.tsx`, `lib/pages/{economy,business,living-standards,education,demography}.tsx` (and wherever Health and Housing hubs render)
- Test: `apps/web/tests/explorer/topicHubs.test.ts`

**Interfaces:**
- Produces:
  - `HubCardModel` gains:
    - `latest?: { value: string; period: string; caption?: string } | null`: the figure the footer already prints. `period` is formatted as on the page (`2025`, `2025/26`, `სექ 2026`). `caption` is the qualifier (`ნომინალური მშპ`, `თურქეთი, უმსხვილესი`).
    - `years?: string`: the coverage range, en dash.
    - `graphic?: CardGraphic`.
  - `type CardGraphic = { kind: "bars"; bars: { label: string; value: number; accent: boolean }[]; first: string; last: string } | { kind: "pair"; rows: { label: string; value: number; text: string; accent: boolean }[]; max: number }`.
    - Unemployment age: `bars`, first three age bands accent.
    - Unemployment sex: `pair`, men then women.
    - Wages industries: `pair` of the top 3 industries by latest average wage, first accent.
  - `type TopicHubData = { topic: TopicId; lastReviewedAt: string; firstPeriod: string; lastPeriod: string; cards: HubCardModel[] }`
  - `TOPIC_HUB_LOADERS: Record<TopicId, (locale: Locale) => Promise<TopicHubData>>` and `loadTopicHubs(locale: Locale, topics: readonly TopicId[]): Promise<TopicHubData[]>`, memoised per locale for the build.
- Existing `footer`, `description` and `series` are unchanged. `BudgetHub` still renders cards for the City air quality index.

- [ ] **Step 1: Write the failing test** `topicHubs.test.ts`, `describe.each(["ka", "en"])`. For every `TopicId`:
  - Card hrefs equal `topicHub(id).sections.map(s => s.href)` in order.
  - Every card with a non-null `series` has `latest` with a non-empty `value`, and `card.footer` contains `latest.value`.
  - Every card has `years` matching `/^\d{4}(\/\d{2})?(–\d{4}(\/\d{2})?)?$/`.
  - `lastReviewedAt` matches `/^\d{4}-\d{2}-\d{2}$/`.

  Plus:
  - `graphic.kind === "bars"` on `/explorer/unemployment/age` with 11 bars.
  - `"pair"` with 2 rows on `/explorer/unemployment/gender`.
  - `"pair"` with 3 rows on `/explorer/wages/industries`.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/topicHubs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Move each render function's data loading and card building into its loader. The coverage range and date are the ones it passes to `coverageLabel` today. Then fill `latest`, `years` and `graphic` in each builder from the values its footer and summary already use. The old render functions go when their routes go (Tasks 6–7). Leave them for now, but make them call the loaders.
- [ ] **Step 4: Run** the new test and the existing `*HubCards`/hub tests (`npx vitest run tests/explorer -t "hub"`). Expected: PASS, with existing snapshots unchanged.
- [ ] **Step 5: Commit** `refactor(hubs): one loader per topic hub; cards carry their latest value`.

### Task 3: Place index

**Files:**
- Create: `apps/web/lib/explorer/places/types.ts`, `apps/web/lib/explorer/places/places.server.ts` (the place list and card facts), `apps/web/lib/explorer/places/adapters/*.ts` (one per family below), `apps/web/lib/explorer/places/buildPlaceIndex.server.ts`
- Test: `apps/web/tests/explorer/placeIndex.test.ts`

**Interfaces:**
- Produces:
  - `type Place = { id: string /* "region.adjara" | municipality code "06" */; kind: "region" | "municipality"; nameKa: string; nameEn: string; regionId: string; capital: boolean; municipalityCount?: number; facts: { label: "population" | "budget" | "perResident" | "birthsPer100Deaths"; value: string; period: string }[] }`
  - `type PlaceEntry = { placeId: string /* also "country.georgia" */; page: string /* the NavSection href */; href: string; value: string; number: number; period: string }`
  - `type PlaceIndex = { places: Place[]; entries: PlaceEntry[] }`
  - `buildPlaceIndex(locale: Locale): Promise<PlaceIndex>`, memoised per locale.
  - `entriesForPage(index: PlaceIndex, page: string): PlaceEntry[]`
- Places: the 11 regions (Tbilisi `region.tbilisi`, `capital: true`) and 63 municipalities (codes except `04`). That is 74 places. Names come from `loadServedMunicipalData()` (Georgian) and English labels (`region.<id>`, municipality code) via `getPresentation`. Municipality `04` and city `tbilisi` resolve to `region.tbilisi`.
- Card facts, using the existing helpers named in each case:
  - **Population**: `buildPopulationIndexModel` rows at the latest year.
  - **Budget**: `buildMunicipalListRows` total; regions are summed with the Adjara adjustment.
  - **Per resident**: `buildMunicipalListRows` with population at `MUNICIPAL_PER_RESIDENT_YEAR`, formatted with `formatPerResidentGel`.
  - **Births per 100 deaths**: `buildVitalIndexModel(...).municipalities/regions`.
- Adapters. Each emits the latest loaded value its place page states, regardless of the reader's range, formatted with the formatter named. Href helper in brackets:

| Adapter file | Page (`page`) | Places | Value |
| --- | --- | --- | --- |
| `municipalBudget.ts` | `/explorer/municipalities` | 64 + regions (`municipalityHrefForCode`, `/explorer/municipalities/region/<id>`) | `formatAmount(publicTotalGel)` latest year |
| `population.ts` | `/explorer/demography/population` | 63 + 11 (`populationPlaceHref`) | `demography.population_total` latest, persons |
| `vital.ts` | `/explorer/demography/births-deaths` | as population, href `populationHrefById(id) + "#births-deaths"` | births per 100 deaths |
| `marriages.ts` | `/explorer/demography/marriages-divorces` | as population, `#marriages-divorces` | latest marriages count |
| `education.ts` | schools, kindergartens | 63 + 11 (`placePageHref(educationPlaceBase(set), id)`) | `educationCountLabel` of `education.pupils.total` / `education.kg_children.total` |
| `social.ts` | pensions, subsistence-allowance | 63 + 11 (`socialPlaceBase`) | `formatInUnit(v, UNIT_PERSONS)` of `social.pension.recipients` / `social.subsistence.families` |
| `inflationCities.ts` | `/explorer/inflation/cities` | 6 cities (`cityPageHref`): tbilisi→`region.tbilisi`, others by `MUNICIPALITY_ROUTES` slug | `formatInflationValue(latestEntry(cityValues(index, id, "cpi.headline", "yoy_pct")), "yoy")`, period = month label |
| `airQuality.ts` | `/explorer/environment/air-quality` | 9 cities (`environmentCityHref`); `zestaponi` → municipality slug `zestafoni` | `environmentLatest(facts, environmentCityHeadline(city), t)` |
| `regionalEconomy.ts` | `/explorer/economy/regions` | 11 (`regionalEconomyHref`) | latest `economy.regional_gdp_total`, `formatAmount` (whole range, not the reader's) |
| `areaFamilies.ts` | business, housing, transport, internet/homes, science-culture/museums, environment/waste, environment/forests | 11 + Georgia (`*AreaHref`, `region_x` ↔ `region.x` via `areaRoutes().mapId`) | the headline series named in the family's explorer: `business.turnover`, `housing.permits_count`, `transport.registered`, `internet.homes_internet`, `science_culture.museum_visitors`, `environment.waste.collected`, `environment.forest.timber_cut` (Tbilisi: illegal logging), each with its page formatter (`formatAmount`, `housingCount`, `transportLatestValue`, `internetPercent`, `formatInUnit`, `environmentLatest`) |
| `household.ts` | living-standards income, spending | 11 + Georgia (`householdRegionHref`) | `sectionTotal(section)`, `per_household`, 1 decimal ₾ |
| `labourRegions.ts` | unemployment/regions, wages/regions | 11 (`unemploymentRegionHref`, `wagesRegionHref`) + Georgia (national row, `href` = the general page) | `unemployment_rate` via `formatUnemploymentValue`; `average_monthly_nominal_earnings` total sector, 1 decimal ₾ |
| `healthDeaths.ts` | health/causes-of-death | 11 + Georgia (`healthDeathsAreaHref`) | `health.deaths.total`, `formatInUnit` |

Where an existing page computes its value inside a client component, extract that pick into a pure function next to the component's model code. Then call it from both the component and the adapter, so the two cannot drift.

- [ ] **Step 1: Write failing tests** `placeIndex.test.ts` (`ka` and `en`):
  - `places.length === 74`.
  - Batumi (`06`) has 4 facts with non-empty values.
  - Entries for `06` include hrefs `/explorer/municipalities/batumi`, `/explorer/demography/population/batumi`, `/explorer/education/schools/batumi`, `/explorer/inflation/cities/batumi`, `/explorer/environment/air-quality/batumi`.
  - Entries for `region.adjara` include `/explorer/wages/regions/adjara`.
  - Entries for `region.tbilisi` include `/explorer/municipalities/tbilisi`, `/explorer/inflation/cities/tbilisi` and `/explorer/demography/population/region/tbilisi`, with no `(placeId, href)` pair twice.
  - The Zestafoni municipality gets the air-quality page `/explorer/environment/air-quality/zestaponi`.
  - Every entry `href` is a statically generated path. Check against the families' `generateStaticParams` / `placePagePaths`.
  - Every entry's `value` for a sample (Adjara wages, Batumi schools) equals what the place page's latest line renders.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/placeIndex.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** types, places, the adapters and `buildPlaceIndex`.
- [ ] **Step 4: Run** the test. Expected: PASS. Also run the touched families' existing tests.
- [ ] **Step 5: Commit** `feat(places): build-time index of every place page and its latest value`.

### Task 4: Search engine

**Files:**
- Create: `apps/web/lib/explorer/search/searchExplorer.ts`, `apps/web/lib/explorer/search/georgian.ts` (`stem`, `latinToGeorgian`)
- Modify: `apps/web/lib/i18n/search.ts` (export `fold`)
- Test: `apps/web/tests/explorer/searchExplorer.test.ts`

**Interfaces:**
- Consumes: `Place`, `PlaceEntry` (Task 3); `NAV_GROUPS`, `NAV_TREE` (Task 1).
- Produces:
  - `type SearchPage = { href: string; group: GroupId; topic: TopicId; name: { ka: string; en: string }; topicName: { ka: string; en: string }; groupName: { ka: string; en: string }; words: string; value: string; period: string; spark: (number | null)[] | null }`
  - `type SearchShortcut = { kind: "group" | "topic"; href: string; group: GroupId; name: { ka: string; en: string }; count: number }`
  - `type Segment = { text: string; mark: boolean }`
  - `type ResultRow = { href: string; page: SearchPage; label: Segment[]; mirror: Segment[]; value: string; period: string }`
  - `type SearchResult = { reading: string | null; place: { place: Place; typeLabelArgs: { kind: "region" | "municipality" | "capital"; count?: number; region?: string } } | null; groups: { kind: "own" | "region" | "flat"; label: string; rows: ResultRow[] }[]; shortcuts: SearchShortcut[]; total: number }`
  - `searchExplorer(query: string, locale: Locale, pages: SearchPage[], shortcuts: SearchShortcut[], places: { places: Place[]; entries: PlaceEntry[] } | null): SearchResult | null` (`null` for an empty query)
  - `rowLabel(page: SearchPage, locale: Locale): string`: the vague-name prefix. It applies when `page.name.ka` is one of the prototype's `GENERIC` list, as `{topic} — {name}` (English lowercases the page name).
- Algorithm: port the prototype's `norm` (on top of `fold`), `KB`, `stem`, `wscore`, `WT = [10, 10, 4, 3, 6]` over `[name in locale, name in other language, topic, group, words]`, exact-name `+8`, `placeFor` thresholds (≥1.8 per word, ≥2 for the joined phrase), `segs`, and the place/own/region grouping of `search()`. Rows link to `PlaceEntry.href`. Own rows are entries whose `placeId` is the place, with the municipal budget first. Region rows are entries for its `regionId`, minus pages already listed. `country.georgia` entries never list.

- [ ] **Step 1: Write failing tests.** A fixture built from the real `NAV_TREE` names and words (no data values) plus a small place fixture. Cover the spec §7.5 table exactly, plus:
  - `latinToGeorgian("xelfasebi") === "ხელფასები"` and `reading === "ხელფასები"` for that query.
  - `stem("ხელფასების") === stem("ხელფასები")`.
  - `„ბათუმი“`, `" WAGES "` and `"ხელფასები,"` equal their plain forms (Review Focus 1).
  - `searchExplorer("ბათუმი სკოლა", …)` has one own row, the Batumi schools page.
  - `searchExplorer("qwzx", …).total === 0`.
  - `searchExplorer("თბილისი", …).place.typeLabelArgs.kind === "capital"`, with no duplicate hrefs across groups (Review Focus 2).
  - The highlight of `ინფლაცია` in `ინფლაციის მიმოხილვა` marks the first 8 letters.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/searchExplorer.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(search): explorer search over pages and places, Georgian endings and keyboard`.

### Task 5: Cards and graphics

**Files:**
- Create: `apps/web/components/explorer-groups/explorer-card.tsx`, `apps/web/components/explorer-groups/card-graphics.tsx`, `apps/web/lib/explorer/regionSpread.ts`
- Modify: `apps/web/components/ui/sparkline.tsx` (optional `area?: boolean`, `endDot?: boolean`; default output unchanged)
- Test: `apps/web/tests/explorer/explorerCard.test.tsx`, `apps/web/tests/explorer/regionSpread.test.ts`

**Interfaces:**
- Consumes: `HubCardModel` (Task 2), `PlaceEntry` / `entriesForPage` (Task 3).
- Produces:
  - `type LeadSpan = "lead3" | "lead2" | "lead2x2"`
  - `leadSpan(pageCount: number): LeadSpan`, the prototype rule: `(n - 1) % 3 === 1 → "lead2"`, `=== 2 → "lead2x2"`, else `"lead3"`.
  - `type RegionSpread = { points: { x: number; key: boolean }[]; georgiaX: number | null; low: string; high: string; lowX: number; value: string; caption: string }` (x in percent)
  - `regionSpread(entries: PlaceEntry[], regionName: (id: string) => string, locale: Locale): RegionSpread | null`: null unless there are at least 2 regions. Scale min/max is padded the way the prototype's examples are.
  - `ExplorerCard({ card, locale, lead?: LeadSpan, spread?: RegionSpread | null, regionCount: number }): JSX.Element`: the prototype `dx-card` anatomy.
    - The graphic order is: `graphic` → `spread` → lead area chart (series) → line with end dot (series) → "Map and list · {n} regions" for a `/regions` page → empty band.
    - The value row is `latest.value` + `[caption, period].join(" · ")`.
    - The footer is `years`, plus `· {annual}` when there is no period.
    - A lead card shows `description`.
    - The link is named by the title and described by the value and footer (`aria-describedby`).

- [ ] **Step 1: Write failing tests:**
  - `leadSpan(1) === "lead3"`, `leadSpan(2) === "lead2"`, `leadSpan(3) === "lead2x2"`, `leadSpan(4) === "lead3"`, `leadSpan(8) === "lead2"`.
  - `regionSpread` on a fixture of 11 regions and Georgia gives 11 points, `georgiaX` set, and low/high naming the extremes.
  - `renderToStaticMarkup(<ExplorerCard …/>)` for a series card contains one `svg`, the latest value and the years. A lead card contains the description and first/last year labels. A `/regions` card without a spread contains the map text. The unemployment-age card renders 11 bars.
  - `Sparkline` without the new props renders the same markup as before (snapshot).
- [ ] **Step 2: Run** `npx vitest run tests/explorer/explorerCard.test.tsx tests/explorer/regionSpread.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, styling with Tailwind classes that reproduce the prototype's `.dx-card*`, `.dx-mv-*` and `.dx-lead*` rules (tokens only; 3/2/1 columns at ≥1101 / ≥768 / phone, with the 1101px split lead layout).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cards): explorer card with lead chart, region spread and bar graphics`.

### Task 6: Group pages, forwards, sitemap

**Files:**
- Create: `apps/web/lib/explorer/groupHeadlines.ts`, `apps/web/lib/pages/group.tsx`, `apps/web/components/explorer-groups/group-page.tsx`, `apps/web/components/explorer-groups/group-topic-scroll.tsx` (client)
- Create routes: `app/(ka)/explorer/{budget,prices,labour,living,society}/page.tsx` and `app/(en)/en/explorer/…` mirrors
- Replace: `app/(ka)/explorer/{economy,external,demography}/page.tsx` and the `en` mirrors, so they render the group page
- Delete: the `page.tsx` (only that file) of `business, housing, inflation, money, unemployment, wages, living-standards, health, education, science-culture, crime, internet, energy-food, environment, transport, trade` in both languages. Then delete the render/metadata functions and `TopicHub` they leave unused.
- Modify: `apps/web/next.config.ts` (forwards), `apps/web/lib/seo/sitemap.ts`, `apps/web/components/unemployment/unemployment-legacy-link.tsx` (mounted by the Labour page via `GroupTopicScroll`)
- Test: `apps/web/tests/explorer/groupPage.test.tsx`, `apps/web/tests/site/redirects.test.ts`, the sitemap test

**Interfaces:**
- Consumes: Tasks 1, 2, 3, 5.
- Produces:
  - `GROUP_HEADLINES: Record<GroupId, readonly { page: string; labelKey?: string }[]>`. Exactly these pages (labels are `groups.headline.<key>`; without a key the card title is used):
    - budget: `/explorer/revenue`, `/explorer/expenditure`, `/explorer/debt`, `/explorer/deficit` (`deficitShare`)
    - economy: `/explorer/economy/gdp` (`nominalGdp`), `/explorer/business/sales` (`businessSales`), `/explorer/business/jobs` (`jobsInBusiness`), `/explorer/housing/permits`
    - prices: `/explorer/inflation/overview`, `/explorer/money/interest-rates`, `/explorer/money/supply`, `/explorer/money/loans-deposits`
    - labour: `/explorer/unemployment/overview` (`unemploymentRate`), `/explorer/wages/overview` (`averageWage`), `/explorer/unemployment/industries` (`peopleInWork`), `/explorer/unemployment/informal`
    - living: `/explorer/living-standards/income`, `/explorer/living-standards/poverty`, `/explorer/living-standards/inequality`, `/explorer/health/pensions`
    - external: `/explorer/trade/overview` (`tradeTurnover`), `/explorer/external/money-from-abroad` (`remittances`), `/explorer/external/foreign-investment`, `/explorer/trade/partners` (`largestPartner`)
    - demography: `/explorer/demography/population`, `/explorer/demography/age-sex` (`aged65`), `/explorer/demography/births-deaths` (`births`), `/explorer/demography/migration` (`netMigration`)
    - society: `/explorer/education/schools` (`schoolPupils`), `/explorer/education/universities` (`students`), `/explorer/internet/users`, `/explorer/crime/recorded`
  - The value is the card's `latest`, and a pick with no `latest` throws at build. The trend is the card's `series`.
  - `renderGroupPage(group: GroupId, locale: Locale)`, `groupPageMetadata(group: GroupId, locale: Locale)`:
    - The meta line is `groups.meta` (topic count only when more than one; latest `lastReviewedAt` of its topics).
    - Breadcrumbs are `მთავარი / მონაცემები (→ /explorer) / {group}`, with `BreadcrumbJsonLd`.
    - Sections have `id="t-{topic}"`, with a `scroll-margin-top` that clears the sticky topic links.
  - `GroupTopicScroll({ locale, group })`. On mount:
    - Read `?topic=`. If the hash carries a legacy view and the group is labour, run `UnemploymentLegacyLink`'s forward.
    - Otherwise `history.replaceState` to `#t-{topic}` without the query, and scroll the section into view.
  - `next.config.ts` `redirects()` gains `LEGACY_TOPIC_FORWARDS × ["", "/en"]` (permanent). The poverty forwards' destinations become `/explorer/living?topic=living-standards` and the two section pages stay as they are.

- [ ] **Step 1: Write failing tests:**
  - `groupPage.test.tsx`: `renderToStaticMarkup(await renderGroupPage("labour", "ka"))`:
    - It contains exactly one `h1` with `შრომის ბაზარი`.
    - It has 4 headline links with hrefs in the `GROUP_HEADLINES.labour` order and 2 topic links (`#t-unemployment`, `#t-wages`).
    - It has 11 card links whose hrefs equal `groupPages(labour)`.
    - The first card per topic carries the lead class.
    - `/explorer/unemployment/regions` has the spread graphic.
    - Text under the H1 is one paragraph only.

    Also `renderGroupPage("budget", "en")` has no topic links and 7 cards, and every group renders in both languages without throwing.
  - `redirects.test.ts`: for each `LEGACY_TOPIC_FORWARDS` row and each prefix, `nextConfig.redirects()` contains `{ source, destination, permanent: true }`. No source equals a group href or `/explorer`.
  - Sitemap test: contains the 8 group pages and `/explorer` in both languages, and none of the 16 forwarded addresses.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/groupPage.test.tsx tests/site/redirects.test.ts tests/seo`. Expected: FAIL.
- [ ] **Step 3: Implement**, following the prototype's hub markup (`dx-hub-h1`, `dx-stats`, `dx-tabs`, `dx-topic*`, `dx-grid`) with existing `PageHeader`, `ExplorerPage` and `ExplorerHeading`.
- [ ] **Step 4: Run** those tests, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(groups): eight group pages; old topic hubs forward to their section`.

### Task 7: All data page and places file

**Files:**
- Create: `apps/web/lib/explorer/allDataIndex.ts`, `apps/web/lib/pages/all-data.tsx`, `apps/web/components/explorer-groups/all-data-index.tsx` (server, A to Z), `apps/web/components/explorer-groups/explorer-search.tsx` (client)
- Create routes: `apps/web/app/explorer-places.ka.json/route.ts`, `apps/web/app/explorer-places.en.json/route.ts` (`export const dynamic = "force-static"`; `GET` returns `Response.json({ places, entries })` from `buildPlaceIndex(locale)`)
- Replace: `app/(ka)/explorer/page.tsx`, `app/(en)/en/explorer/page.tsx` (All data); move the Budget hub's cards to `/explorer/budget` (done in Task 6)
- Test: `apps/web/tests/explorer/allDataIndex.test.ts`, `apps/web/tests/explorer/explorerSearch.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 3, 4.
- Produces:
  - `type AzGroup = { letter: string; id: string; rows: SearchPage[] }`
  - `buildSearchPages(topics: TopicHubData[], locale: Locale, messagesKa: Messages, messagesEn: Messages): SearchPage[]`
  - `buildShortcuts(locale): SearchShortcut[]`
  - `azGroups(pages: SearchPage[], locale: Locale): AzGroup[]`: Georgian order `აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ`, English `localeCompare`. It sorts by `rowLabel`.
  - `azColumns(groups: AzGroup[]): [AzGroup[], AzGroup[]]`: the prototype's balance, with weight = rows + 1.4.
  - `ExplorerSearch({ locale, pages, shortcuts })`:
    - The query lives in the hash `q=` through `useHashState` (`replace` while typing).
    - An empty `#q=` focuses the input on load.
    - The first non-empty query fetches `/explorer-places.{locale}.json` once, then re-runs the search.
    - Before the A to Z list (rendered by the server and passed as children) it renders the combobox, chips, reading notice, place card, result groups, shortcuts and the none state, and it hides the list while a query is active.
    - Keyboard: ↑ ↓ move `aria-activedescendant`, Enter navigates, Esc clears.
  - The page renders the `LegacyHashRedirect` (moved from the Budget hub).

- [ ] **Step 1: Write failing tests:**
  - `allDataIndex.test.ts`:
    - `buildSearchPages` yields 100 pages in both languages, each with group and topic.
    - `rowLabel` gives `ხელფასები — რეგიონები` / `Wages — regions`.
    - `azGroups(…, "ka")[0].letter === "ა"`, and letters are in alphabet order.
    - The two columns differ by at most one group's weight.
  - `explorerSearch.test.tsx` (static render):
    - With no hash it renders the input with `role="combobox"`, five chips, and children.
    - Unit-test the fetch helper `loadPlaces(fetchImpl)`: it resolves `null` on a rejected or non-OK fetch and caches the first success (Review Focus 4).
- [ ] **Step 2: Run** `npx vitest run tests/explorer/allDataIndex.test.ts tests/explorer/explorerSearch.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**, with markup and classes after the prototype's `dx-search`, `dx-q`, `dx-try`, `dx-place`, `dx-res`, `dx-row`, `dx-grp`, `dx-idx`, `dx-az` and `dx-ix` rules.
- [ ] **Step 4: Run** the tests, then `npm run build` once to confirm both JSON routes prerender (`.next/server/app/explorer-places.ka.json.body` exists).
- [ ] **Step 5: Commit** `feat(all-data): All data page with A to Z list and search`.

### Task 8: Sidebar

**Files:**
- Modify: `apps/web/components/shell/data-sidebar.tsx`, `apps/web/components/shell/section-nav.tsx`, `apps/web/lib/pages/explorer-layout.tsx` (grid widths), `apps/web/app/globals.css` (`--ink-divider`, `--ink-line`)
- Create: `apps/web/components/shell/group-icons.tsx` (`GROUP_ICONS: Record<GroupId, LucideIcon>`), `apps/web/components/shell/use-slash-search.ts`
- Modify: `apps/web/components/site/site-header.tsx`, `site-footer-view.tsx`, `apps/web/app/global-not-found.tsx` (they read `DATASET_HUBS`; check labels and counts)
- Test: `apps/web/tests/explorer/dataSidebar.test.tsx`

**Interfaces:**
- Consumes: Task 1.
- Produces these test ids:
  - `data-sidebar`, `sidebar-toggle`, `sidebar-search` (a link to `/explorer#q=`), `all-data-link`
  - `group-link-{id}`, `group-toggle-{id}`, `group-panel-{id}`
  - page rows keep their existing `testId`s
  - `sidebar-menu-button`, `sidebar-close`
- `useSlashSearch()` does `router.push(pageHref("/explorer", locale) + "#q=")` on `/` outside editable fields. On `/explorer` it focuses `#explorer-q`.
- Behaviour, per spec §4:
  - The open set is `useState<Set<GroupId>>` seeded with `currentGroup(page)`, and it re-adds the current group on navigation.
  - The rail pop-out opens on `mouseenter`/`focusin` of a group item and closes on `mouseleave`/`focusout` outside it and on Escape.
  - Below 900px the menu is `fixed inset-0`, with the page content `hidden` while open, focus moved to `sidebar-close`, and Escape/close returning focus to `sidebar-menu-button`. The `matchMedia` change to desktop closes it (Review Focus 5).

- [ ] **Step 1: Write failing tests** (`renderToStaticMarkup` inside `I18nProvider` with a mocked `usePathname`):
  - On `/explorer/wages/regions/adjara` the labour panel is rendered and the wages-regions row has `aria-current="page"`.
  - There are 8 `group-link-*` with counts 7/13/8/11/11/11/5/34 and `all-data-link` shows 100.
  - Other groups' panels are not rendered.
  - On `/explorer` the `all-data-link` has `aria-current="page"`.
  - The toggle buttons have `aria-expanded` and `aria-controls`.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/dataSidebar.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**, after the prototype's `dx-side*`, `dx-hub*`, `dx-pl`, `is-rail` and phone rules. The breakpoint is 900px.
- [ ] **Step 4: Run** the test and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sidebar): eight groups, search, All data, icon rail with pop-outs, full-screen phone menu`.

### Task 9: Browser tests

**Files:**
- Create: `apps/web/tests/browser/explorer-groups.spec.ts`
- Modify: every spec that visits a forwarded topic hub, the Budget hub at `/explorer`, or a removed sidebar test id. Find them with `grep -rlE 'goto\("(/en)?/explorer(/(business|housing|inflation|money|unemployment|wages|living-standards|health|education|science-culture|crime|internet|energy-food|environment|transport|trade|economy|external|demography))?"\)|-hub"|economy-link|wages-link|inflation-link' tests/browser`. Also update the page-count and hub-count helpers, which `tests/browser/*` derive from the registries.

**Interfaces:**
- Consumes: the test ids of Tasks 6–8.

- [ ] **Step 1: Write `explorer-groups.spec.ts`:**
  - Sidebar at 1440: open and close Society; the rail pop-out by hover and by keyboard focus, closed by Escape; the collapsed state persists after reload.
  - `/` opens All data with the input focused.
  - Phone at 375: the menu opens full screen, Escape returns focus, a link closes it, and widening to 1200 shows the desktop sidebar (Review Focus 5).
  - Each group page in ka and en: 4 headline links resolve, topic links scroll to their sections, card count equals the config.
  - All data:
    - The A to Z letter jump works.
    - `ინფლაცია` → first row Inflation overview.
    - `xelfasebi` → the reading notice plus Wages.
    - `ბათუმი` → the place card with 4 facts; Enter on the first row opens `/explorer/municipalities/batumi`.
    - ↑/↓/Esc work, and the URL hash holds `q=`.
    - With `page.route("**/explorer-places.*.json", r => r.abort())`, `ხელფასები` still lists Wages (Review Focus 4).
  - Forwards (Review Focus 3):
    - `/explorer/wages` and `/en/explorer/wages` land on `/explorer/labour#t-wages`, with the section in view.
    - `/explorer/unemployment#breakdown=region` lands on the unemployment regions page.
    - `/explorer#nav=analysis` lands on `/explorer/analysis`.
  - Axe scans of `/explorer`, `/explorer/labour` and the open phone menu at 375 and 1440.
- [ ] **Step 2: Update the existing specs** found by the grep. Topic-hub card assertions move to the group page sections (`#t-{topic}`). Budget hub assertions move to `/explorer/budget`, and topic-hub sidebar ids become `group-link-*`.
- [ ] **Step 3: Run** after a build with the project's server recipe (CLAUDE.md, port 3100, `CI=1`): first `npx playwright test tests/browser/explorer-groups.spec.ts`, then each updated spec. Expected: PASS, with no test reported flaky.
- [ ] **Step 4: Commit** `test(browser): groups, All data, search and forwards`.

### Task 10: Documents, review material, preview

**Files:**
- Modify: `DESIGN.md` §6.2, §6.6, §6.7, §7.7, §17, plus a new section "Group pages and All data". `Project_Definition.md` §1 "Current Product Focus". `AGENTS.md` Project Snapshot route-families sentence.
- Create: `/mnt/project-files/explorer-redesign/notes-for-duru.md` (every new Georgian label for proofreading, with its English) and screenshots in `/mnt/project-files/explorer-redesign/screenshots/`

- [ ] **Step 1: Update the three documents** so they describe the built behaviour (the 900px switch, forwards with `?topic=`, the group-page headline exception dated 2026-10-24).
- [ ] **Step 2: Screenshots** from the built server with Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, see memory `preview-via-branch-push`). Take the prototype boards' equivalents: All data, the Batumi search, Labour, the Labour rail with the Society pop-out, English All data, and phone All data / search / Labour / menu.
- [ ] **Step 3: Narrow checks only:** `npm run typecheck`, `npm run lint`, `npm run i18n:check`, and the new and touched vitest files. The full gates wait for Duru's OK.
- [ ] **Step 4: Commit** `docs: explorer groups, group pages and All data` and post the screenshots with the preview decision card. Push the branch (no PR) only after Duru picks the clickable preview.
- [ ] **Step 5: After Duru's OK:** `npm run check`, `npm run build`, the full browser suite against the built server, then the PR (template, attribution block, assignee and reviewer), CI green, and the merge with Duru's go.
