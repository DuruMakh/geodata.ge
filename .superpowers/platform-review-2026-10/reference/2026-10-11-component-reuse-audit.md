# Fiscal.ge component reuse audit (2026-10-11)

Scope: every Georgian page under `apps/web/app/(ka)` (the `/en` pages call the same renderers in `apps/web/lib/pages/`), read at `main` 12f2bfe1. **No code was changed.** Copied into `docs/superpowers/specs/` as the spec for `docs/superpowers/plans/2026-10-11-component-reuse.md`.

**Update, same day:** since this audit, `main` gained Poverty (an 8th hub copy and a 7th URL-state copy). The unmerged audit-fixes branch already fixes most of row 1 and the dropdown class in row 13. Pending feature branches add 3 more hub copies and 2 more URL-state copies. The plan's "Other branches" section has the details and the order of work.

How it was done: traced each route → its renderer in `lib/pages/` → the components it imports, then compared components that look alike, line by line.

**Bottom line:** the explorer layer already reuses well. Every explorer page uses the shared line chart, range strip, Excel button, source note and series selector, and every hub uses the same card grid. What is left is **copied glue around the shared parts**: one picker copied whole, one URL-state hook copied 6 times, one heading copied 4 times, the topic-hub layout copied 7 times, and KPI/ranking/comparison blocks forked rather than extended. Merging them removes roughly 700–800 lines (an estimate) and needs **no new components**. Every replacement already exists and needs at most a small optional setting.

---

## 1. Page map: which shared blocks each page uses

✓ = uses the shared block · **own** = draws its own version (see §2) · – = the page has no such element

Shared blocks: line chart `EditorialLineChart`, stacked chart `StackedColumnChart`, tabs `TextTab`/`SegmentedTabs`, year range `RangeStrip`, table `ExplorerTable`/`MonthGridTable`, Excel `ExcelDownloadButton`, source line `SourceNote`, hub cards `BudgetHub`, page header `PageHeader` (breadcrumb and coverage), H1 `ExplorerHeading`, series panel `SeriesSelector`, KPI block `HeroKpi`/`SideKpiList`, latest-value line `LatestValueLine`, page shell `ExplorerPage`/`ExplorerWorkspace`.

| Page | Line | Stacked | Tabs | Years | Table | Excel | Source | Hub cards | Header | H1 | Series | KPI | Latest line | Shell |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Budget hub `/explorer` | – | – | – | – | – | – | ✓ | ✓ | ✓ | own (34px) | – | – | – | **own** |
| Expenditure, Revenue | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ (tree) | ✓ | – | ✓ |
| Single-year analysis | own (treemap, radar, field) | – | ✓ | own (single year) | own ranking | ✓ | ✓ | – | ✓ | ✓ | – | – | – | ✓ |
| Debt | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ (own tree logic) | – | – | ✓ |
| Deficit | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | – | – | ✓ |
| Municipalities index | map | – | ✓ | – | – | – | ✓ | – | ✓ | ✓ | ✓ | – | – | **own** |
| Municipal Georgia / region / place | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | `EntityHeading` | ✓ | **own** | – | **own** (+340px aside) |
| Economy hub | – | – | – | – | – | – | – | ✓ | ✓ | ✓ | – | – | – | **own** |
| GDP | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | – | prose summary | ✓ | ✓ |
| Sectors | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | **own** | **own** | ✓ |
| Economy regions index | map | – | – | – | – | – | ✓ | – | ✓ | ✓ | – | – | – | ✓ |
| Economy region page | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | **own** | ✓ | **own** | **own** | **own** workspace |
| Inflation hub | – | – | – | – | – | – | – | ✓ | ✓ | ✓ | – | – | – | **own** |
| Inflation overview | ✓ | – | ✓ | ✓ | ✓ month grid | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Inflation categories | ✓ | ✓ | ✓ | ✓ | ✓ month grid | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Inflation products | ✓ | – | – | ✓ | own browse list | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Inflation cities (Georgia + 6) | ✓ | – | ✓ | ✓ | ✓ month grid | ✓ | ✓ | – | ✓ | **own** | ✓ | ✓ | ✓ | ✓ |
| Trade hub | – | – | – | – | – | – | – | ✓ | ✓ | ✓ | – | – | – | ✓ |
| Trade overview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | – | – | ✓ |
| Trade partners | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | – | – | ✓ |
| Trade products | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | own picker | – | – | ✓ |
| External hub | – | – | – | – | – | – | – | ✓ | ✓ | ✓ | – | – | – | ✓ |
| Money from abroad / Foreign investment / Current account | ✓ | ✓ (CA) | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | – | – | ✓ |
| Unemployment hub | – | – | – | – | – | – | – | ✓ | ✓ | ✓ | – | – | – | ✓ |
| Unemployment overview / age / gender / region | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ / **own** (region) | ✓ | – | ✓ | ✓ |
| Unemployment regions index | map | – | – | – | – | – | ✓ | – | ✓ | ✓ | – | – | – | ✓ |
| Wages hub | – | – | – | – | – | – | – | ✓ | ✓ | ✓ | – | – | – | ✓ |
| Wages overview / industries / region | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ / **own** (region) | ✓ | – | ✓ | ✓ |
| Demography hub | – | – | – | – | – | – | – | ✓ | ✓ | ✓ | – | – | – | **own** |
| Population index | map | – | ✓ | – | – | – | ✓ | – | ✓ | ✓ | ✓ | – | – | ✓ |
| Population place pages | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | `EntityHeading` | ✓ | ✓ | – | `EntityWorkspaceShell` |
| Births and deaths | ✓ | – | ✓ | – | ✓ | ✓ | ✓ | – | ✓ | ✓ | – | – | – | ✓ |
| Migration | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| Methodology hub / article | – | – | – | – | own source archive | – | site footer | – | site header | own | – | – | – | own (site design, by intent) |

Things that are reused well and need no change: the line and stacked charts, `RangeStrip` (every multi-year page), `ExcelDownloadButton` (every explorer, with no hand-built download buttons), `SourceNote`, the tab components (no hand-built tab bars anywhere), `BudgetHub` (all 8 hubs), `RegionIndex` (shared by economy, unemployment and wages region indexes), `MunicipalitiesIndex` (reused by the population index), `EntityHeading`/`EntityPicker` (reused by population place pages), `UnemploymentAgeHeatmap` (reused by wages), and `MoneyFromAbroadSeriesPanel` plus `useHashState` (already shared by the 3 external pages).

---

## 2. Duplication found

### A. Copies of something that already exists in a shared form

1. **URL-state hook copied 6 times.** `useHashState` already exists in `components/external/use-money-from-abroad-state.ts`. It keeps a page's view in the `#…` part of the URL and handles Back/Forward. The same code is copied in `trade/use-trade-partners-state.ts`, `trade/use-trade-products-state.ts`, `unemployment/use-unemployment-state.ts`, `economic-sectors/use-economic-sectors-state.ts`, `regional-economies/use-regional-economy-state.ts`, and inline in `trade/trade-overview.tsx` and `wages/wages-explorer.tsx`. The 2026-10-10 audit flagged this too.
   - *Side finding:* the region-page copy always adds a Back step (`pushState`), including while you drag the year range. On Economy region pages, Back then replays the drag one year at a time. The Sectors copy deliberately avoids this. The region copy also has no guard for blocked History access.
2. **City picker is a near-verbatim copy of the region picker.** `inflation/city-picker.tsx` (152 lines) matches `regional-economies/region-picker.tsx` (155 lines): same search, keyboard handling, layout and "all" row. The file's own comment says so. Only the option list, the "all" row and the text keys differ.
3. **"Title — place ▾" heading with previous/next copied 4 times.** `inflation/inflation-city-heading.tsx` is a clean component. The same markup is pasted inline in `regional-economy-explorer.tsx` (with a hand-written `<h1>`), `unemployment-explorer.tsx` and `wages-explorer.tsx`. The copies have drifted: the 3 region triggers lack `aria-haspopup="dialog"`, which the city and municipal triggers have.
4. **Previous/next links inlined in the municipal heading.** `municipalities/entity-heading.tsx` rebuilds `EntityNeighbourLinks` by hand (same classes) because it wants plain `<a>` links (a full page load).
5. **Topic hub layout copied 7 times.** Economy, demography, inflation, trade, external, unemployment and wages hubs (`lib/pages/*.tsx`) each repeat breadcrumbs → `PageHeader` → `ExplorerHeading` → summary line → `BudgetHub`. The copies have drifted:
   - the **Economy hub has no breadcrumb structured data** (`BreadcrumbJsonLd`); the other 6 do;
   - economy, demography and inflation build their own `<main>` instead of `ExplorerPage`;
   - two summary lines lack the 640px width cap;
   - 4 hubs show a coverage line, while demography, trade and external pass an empty one.
6. **Page shell hand-written 8 times.** The 4 municipal renderers (`municipal-country`, `municipal-index`, `municipal-region`, `municipality`), the budget hub and the 3 hubs above write out `ExplorerPage`'s exact classes by hand.
7. **Region page rebuilds the workspace and the latest-value line.** `regional-economy-explorer.tsx:99` pastes `ExplorerWorkspace`'s grid by hand. Both it (`regional-headline`) and `economic-sectors-explorer.tsx` (`sectors-headline`) hand-write the one-line latest value, although `LatestValueLine` exists. Its own comment even says it is "the sectors page's headline line".
8. **KPI blocks hand-built from the class constants.** `HeroKpi` and `SideKpiList` exist in `main-explorer/kpi-blocks.tsx`, but `economic-sectors/sector-highlights.tsx`, `regional-economies/region-highlights.tsx` and `municipalities/municipal-indicators.tsx` copy their inner markup. The region copy has already drifted: it skips `sideKpiRowClass`, so its last row keeps extra bottom padding. Separately, 3 inflation indicator files write out the `KPI_GRID_CLASS` string instead of using the constant.

### B. Near-identical components that differ only in data or one small option

9. **Budget vs municipal "movers" and period comparison.** `municipalities/municipal-indicators.tsx` is a fork of `main-explorer/indicators.tsx`. `MoverRow` is the same markup in both files, and the 4-column start / change / end comparison table is the same apart from the column header and how cells format amounts.
10. **Two ranking tables.** `external/external-ranking.tsx` and `trade/trade-partners-ranking.tsx` draw the same rank / name with bar / amount / share table. Trade adds signed bars, a hidden share column for the balance measure, an "unavailable" group, "show all" and paging.
11. **Four flat series panels.** `sector-series-panel.tsx`, `regional-economy-series-panel.tsx` and `unemployment-series-panel.tsx` have the same shape as `MoneyFromAbroadSeriesPanel`, which already serves 3 pages: a "{year} · unit" caption, a total row, search, toggle, and select/clear all. The trade-partners panel is different (country/group tabs, off-tab selections) and stays.
12. **Debt rebuilds the tree-search rows.** `debt/debt-series-panel.tsx` re-implements the parent/child search-and-expand logic of `buildSeriesPanelRows` (`main-explorer/series-panel.tsx`).
13. **Small repeated helpers:**
    - "add or remove this id from the selection" is written out in about 10 files;
    - an identical dropdown style string `selectClass` sits in both `unemployment-explorer.tsx` and `wages-explorer.tsx`;
    - the "· updated {date}" source-note suffix is built the same way in 4 municipal renderers;
    - `BudgetHub` draws its own "coming soon" pill instead of `ComingSoonBadge`, with a slightly different border colour.

### Looked at and *not* recommended (real differences)

- **Municipality map vs region map:** markers, occupied areas and about 60 shapes versus 11 regions. Merging is high risk for little gain.
- **`EntityPicker` vs `RegionPicker`:** grouped lists, a country row and the ⌘K shortcut make them different tools.
- **`EntityWorkspaceShell` (340px aside) vs `ExplorerWorkspace` (292px):** this is a visual difference. Unifying them changes layout, which is a `DESIGN.md` decision, not a cleanup.
- **The single-year analysis year buttons:** they pick one year, which is a different control from a range.
- **Things that are one of a kind:** the analysis charts (treemap, radar, budget field, "every 100"), the GDP prose summary and the inflation product browse list.
- **Methodology pages:** they use the site design (1240px column, site header and footer) by intent, so the explorer blocks do not apply.
- **The `MonthGridTable` wrappers** (3 inflation tables): they are already thin and differ in data.
- **Where the page shell lives:** some client components render `ExplorerPage` and `PageHeader` themselves (debt, deficit, GDP, inflation), while others get them from `lib/pages`. This is inconsistent but not duplicated, so it is not worth churning.

---

## 3. Findings table

Risk: **Low** = no visible change expected, provable by comparing built HTML. **Med** = small visual or behaviour details must be carried over exactly. **High** = none recommended.

| # | What is duplicated | Copies | Shared component that should replace it | Small option it would need | Risk |
|---|---|---|---|---|---|
| 1 | URL `#hash` state hook (restore on Back/Forward, write on change) | 6 + 1 original | `useHashState`, moved from `external/` to `explorer-shell/` | `update` returns the new state (Sectors uses it); accept `"push"`/`"replace"` as well as `true`/`false`; callers with extra inputs (unemployment, wages) pass a stable parse function | **Med**: Back/Forward behaviour; the region page's push-per-drag needs an owner call (fixing it changes Back) |
| 2 | City picker = region picker | 1 | `RegionPicker` | Accept a generic option list (`id`, label, search words, link) and an "all" row (label, link); text keys and test-id prefix as props, so `city-picker-*` ids stay | **Low–Med**: 2 test files use the city ids; keyboard behaviour is identical |
| 3 | "Title — place ▾" heading + previous/next | 3 inline + 1 component | `InflationCityHeading`, moved to `explorer-shell/` | Props for lead text, place label, picker element, optional neighbours, trigger test id | **Low–Med**: margins differ by a few px between copies (choose the city version); fixes the missing `aria-haspopup` |
| 4 | Previous/next links in the municipal heading | 1 | `EntityNeighbourLinks` | `plainAnchors` (default off) for full-page-load `<a>` links | **Low**: the `municipal-entity-navigation` id (8 tests) is passed as `testId` |
| 5 | Topic hub layout | 7 | One server helper in `lib/pages/hub.tsx` built from `ExplorerPage` + `PageHeader` + `ExplorerHeading` + `BudgetHub` + `BreadcrumbJsonLd` | Inputs: title, summary, path, coverage (may be empty), cards, test id, optional extra block (unemployment's legacy link) | **Low**: adds the missing Economy breadcrumb data (an SEO-visible change, owner OK needed) |
| 6 | Hand-written page shell | 8 | `ExplorerPage` | None (`testId="explorer-shell"`, `containerQueries` already exist) | **Low**: classes are identical; JSON-LD tags move inside the column div with no visual effect |
| 7 | Region page grid; Sectors and region latest-value lines | 3 | `ExplorerWorkspace`, `LatestValueLine` | None (`note` covers Sectors' "· preliminary"); keep the existing test ids | **Low**: adds the ₾ formatting `withLari` applies elsewhere |
| 8 | KPI hero and side list hand-built | 3 (+3 inline grid strings) | `HeroKpi`, `SideKpiList`, `KPI_GRID_CLASS` | `HeroKpi`: `value` may carry a unit (or a `unit` prop), plus `testId`; `SideKpiList`: optional per-row `testId` | **Med**: test ids `sector-highlight-*`, `entity-kpi`; the region list gains the shared last-row padding (−14px) |
| 9 | Movers row + period comparison table | 1 fork | `MoverRow` and the comparison table, exported from `kpi-blocks.tsx` (extracted from `indicators.tsx`) | Rows passed as label / colour / start / change / end / bold; a cell formatter (municipal's unit-under-number `AmountText`); a first-column label | **Med**: phone column widths differ (municipal has narrower name column rules) and must be kept |
| 10 | Ranking table | 1 | `ExternalRanking` | `signed` bars with zero axis; `showShare`; an "unavailable" row group; `collapsedLimit` (top 10 + "show all"); `pageSize` | **Med**: trade products paging; `testId="trade-partners"` reproduces the existing ids |
| 11 | Flat series panel | 3 | `MoneyFromAbroadSeriesPanel`, promoted to `explorer-shell/` | `caption`, `controls` slot, optional controlled search, `pinnedIds` (total stays visible while searching), `wrapLabel`, wrap in `SeriesAside` or not | **Low–Med**: whether the total row hides during search differs per page and must be preserved |
| 12 | Tree search rows in the debt panel | 1 | `buildSeriesPanelRows` | Accessors for "parent of" and "matches" so it works on debt items | **Low–Med**: unit tests cover both |
| 13 | Toggle-id helper, `selectClass`, "updated" suffix, coming-soon pill | ~16 small | One helper / constant each; `ComingSoonBadge` | Badge: a `label` prop so the server-rendered hub can use it | **Low**: the badge border colour differs (owner call) |
| 14 | Thin 3px bars drawn by hand. One-colour fill: Sectors share-of-GDP bar, municipalities index row bars, analysis ranking share bar. Two-colour split: municipal change gauge, migration arrivals/departures split. (Added after a second pass.) | 5 | None exists (`SwatchBar` is a colour chip, not a bar), so this would be the plan's only **new** component, a small `ShareBar` in `ui/editorial.tsx` | Fill share; optional second colour for the split version | **Low**, but low value too. The inflation target gauge and product scale have markers and labels, so they stay as they are. Optional row. |

---

## 4. Plan

One branch and one PR with **one commit per row** (owner preference: batch releases, a commit per task). Nothing new is designed. The plan, as `AGENTS.md` asks:

- **Reused as is:** `ExplorerPage`, `ExplorerWorkspace`, `LatestValueLine`, `KPI_GRID_CLASS`, `BudgetHub`, `PageHeader`, `ExplorerHeading`, `BreadcrumbJsonLd`.
- **Small optional additions:** `useHashState`, `RegionPicker`, `InflationCityHeading`, `EntityNeighbourLinks`, `HeroKpi`/`SideKpiList`, `ExternalRanking`, `MoneyFromAbroadSeriesPanel`, `buildSeriesPanelRows`, `ComingSoonBadge`. Each default leaves current pages and tests unchanged.
- **Genuinely new:** none. Rows 1, 3 and 11 *move* an existing file to `explorer-shell/`; row 9 *exports* two functions that already exist privately.

**Before any code: owner decisions**

- (a) May the Economy region range drag stop adding Back steps (row 1)?
- (b) May the Economy hub gain breadcrumb structured data (row 5)?
- (c) Should demography, trade and external hubs keep an empty coverage line or show one (row 5)?
- (d) Which colour should the "coming soon" pill border use (row 13)?

**Phase 1: no visible change (rows 6, 7, 13 and the inline grid strings)**

Proof: build before and after, then diff the prerendered HTML in `.next/server/app` for the touched routes. The only expected differences are the added `data-testid="explorer-workspace"` and the ₾ symbol on the 2 latest-value lines. Also run `npx vitest run` on the touched tests and `npx playwright test` on the economy and municipal specs.

**Phase 2: merge copies (rows 1, 2, 3, 4, 5, 11, 12)**

Do these one at a time. After each one:
- run the matching unit tests (`*UrlState*`, `*State*`, picker and panel tests) and the matching browser spec;
- for row 1, add a unit test that range drags replace the history entry and discrete switches push one.

**Phase 3: blocks with visual detail (rows 8, 9, 10)**

After each one, run the KPI, municipal and trade browser specs at desktop and 375px, and compare screenshots before and after for Sectors, an Economy region page, a municipality page, Trade partners (balance measure) and Trade products (paging).

**Done-check (once, at the end):** `npm run check`, `npm run build`, and the full browser suite against the built server (`CLAUDE.md` recipe with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`). Then the draft PR, CI green, merge, and live check of the touched URLs.

**Not part of this plan:** maps, pickers with groups, the 340px municipal aside, analysis charts and methodology pages (see "not recommended" above).
