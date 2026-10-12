# Component Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the copied page glue found by the 2026-10-11 audit with the shared components that already exist, so that the pages render and behave the same while every copy is removed.

**Architecture:** No new design. Each task points the copies at one existing shared piece and gives that piece the small optional settings the copies need; with those settings left off, the piece behaves exactly as it does today. Phase 1 changes produce no visible difference, and diffing the built HTML proves it. Phase 2 merges copies. Phase 3 merges blocks with visual detail and is checked with before/after screenshots.

**Tech Stack:** Next.js 16 (static prerender), React, strict TypeScript, Tailwind v4, Vitest (node environment, `renderToStaticMarkup`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-component-reuse-audit.md`. Its §3 rows are cited below as "row N".

All paths are relative to `apps/web/` unless they start with `docs/`. Run every command from `apps/web/`.

## Global Constraints

- One branch, the current worktree branch `claude/fiscal-ge-component-audit-8d3614`, with one commit per task and one draft PR at the end (owner: batch releases).
- Reuse first (`AGENTS.md`): no new component except `ShareBar` (Task 13, optional). The files that move (Tasks 4, 6, 8) keep their code and only gain optional props.
- Defaults must keep current output. Every new prop is optional, and pages that do not pass it render the same HTML.
- Do not edit existing test expectations to make a task pass. If an existing test fails, the task changed behaviour: stop and report it. Tests may be *added*. The one named exception is Task 6 Step 4 (a snapshot whose diff may only be class order or whitespace).
- Keep every existing `data-testid` exactly. The browser specs depend on them (e.g. `municipal-entity-navigation` in 8 specs, `hub-card` in 14).
- Georgian-first copy; do not change any message text. Functional icons stay `lucide-react`.
- Owner decisions are pre-filled with the recommended answer (see "Decision gates"). If the owner answers otherwise, only the named step changes.
- The done-check runs once, at the end (Task 14), per `CLAUDE.md`. While editing, run only the named test files.

## Other branches (re-checked 2026-10-12, after `git fetch`; branch merged with `main` at d8c23379)

Merged into `main` since the audit: #173 domestic exports, #174 poverty, #175 energy & food, #176 audit fixes, #177 money & banks, #178 local fonts, #179 living standards, #180 age & sex. What that means for this plan:

- **URL-state hook (Task 4).** `components/explorer-shell/use-hash-state.ts` exists (from #176, with `normalize` and `afterWrite`). It is used by Trade (3), External flows (3), Wages, Poverty and Household. Still on their own copies:
  - `unemployment/use-unemployment-state.ts`;
  - `economic-sectors/use-economic-sectors-state.ts`;
  - `regional-economies/use-regional-economy-state.ts`;
  - the inline copy in `money-banks/money-banks-explorer.tsx`;
  - the separate generic hook `explorer-shell/use-hash-explorer-state.ts` (only caller: `energy-food/energy-food-explorer.tsx`).

  `trade/trade-domestic-exports.tsx` (section switcher) and `municipalities/municipalities-index.tsx` (level switch) write the hash for a different job. They stay.
- **Topic hubs (Task 7).** 10 copies in `lib/pages/`: `demography`, `economy`, `energy-food`, `external`, `inflation`, `living-standards`, `moneyBanks`, `trade`, `unemployment`, `wages`. (`/explorer/poverty` now lives under Living standards; `lib/pages/poverty.tsx` renders sub-pages only.) `hub.tsx` is the budget hub: it gets `ExplorerPage` in Task 1 but is not a `TopicHub`.
- **Dropdown class (row 13).** Done as `SELECT_CLASS` in `ui/editorial.tsx`.
- **Still open: `codex/trade-services`** (Codex worktree, 12 commits, "local completion" recorded 2026-10-12, uncommitted edits including `ui/editorial.tsx`). It edits:
  - `lib/pages/trade.tsx`
  - `trade-overview.tsx`
  - `trade-partners-ranking.tsx`
  - `trade-partners-series-panel.tsx`
  - `trade-partners.tsx`
  - `use-trade-partners-state.ts`
  - `trade-domestic-exports.tsx`
  - and adds `trade-services.tsx` and `use-trade-sections-state.ts`.

**Sequencing (supersedes the 2026-10-11 version):**
1. Tasks 0–11 and 13 run now, **leaving Trade files alone**: Task 3 skips `trade-overview.tsx` and `trade-products-picker.tsx`; Task 7 converts the 9 non-Trade hubs.
2. After `codex/trade-services` merges, sync again. Then do Task 12 (ranking) and a short "Trade follow-up" step: the Trade hub via `TopicHub`, `toggleId` in the two Trade files, and a check of `use-trade-sections-state.ts` for another URL-state copy.
3. If Trade services has not merged by the time Task 13 is done, ship Tasks 0–11 and 13 as this PR and do the Trade part as a small follow-up.

## Decision gates (recommended defaults used below)

| Gate | Default in this plan | If the owner says no |
|---|---|---|
| D1. Economy region pages stop adding a Back step per year while the range is dragged (Task 4) | Yes: range and selection replace the entry; view mode and measure push one, as on Sectors | Task 4 Step 6 passes `"push"` at all 4 call sites |
| D2. Economy hub gains breadcrumb JSON-LD (Task 7) | Yes | Task 7 passes `breadcrumb: false` for Economy |
| D3. Coverage line on demography, trade and external hubs (Task 7) | Unchanged (they stay empty) | n/a |
| D4. "Coming soon" pill on hub cards (row 13) | Leave as is: not in this plan | Add a `label` prop to `ComingSoonBadge` later |
| D5. Thin share bars (row 14) | Included as Task 13, optional | Skip Task 13 |

## Review Focus

1. **Shared deep links.** Opening any of the 9 pages from Task 4 with a `#…` URL must show the same view as before. Pinned by the existing specs that open hash URLs (`goto(…#…)` count: sectors 5, region 1, trade overview 3, partners 3, products 2, unemployment 13, wages 2, money from abroad 2), which Task 4 Step 7 runs.
2. **Back/Forward.** A discrete switch adds exactly one history step; a range drag adds none. Pinned by Task 4 Step 1 (`writeHash`) and Step 7 (new browser test on the Economy region page).
3. **Picker focus on Escape.** After Escape, focus returns to *that page's* trigger: the city picker must not focus a region trigger. Pinned by Task 5 Step 1 (trigger selector derives from `testIdPrefix`) and the existing test "Escape closes the picker and returns focus to the trigger" (`inflation-cities.spec.ts:62`), which Task 5 Step 5 runs.
4. **English search in pickers.** On `/en`, typing "batumi" or "imereti" must still find the place. Pinned by Task 5 Step 1.
5. **Search hides the "no matches" note correctly in flat panels.** With a query that matches nothing, the total row stays visible on Sectors, regions and unemployment, and the "no matches" state still shows. Pinned by Task 8 Step 1.

---

## Phase 1: no visible change

### Task 0: Install and baseline

The worktree has **no `node_modules`** (checked 2026-10-11), so nothing runs until it is installed.

- [ ] **Step 0:** Bring the branch up to date with `main` using the app's `sync_with_base_branch` tool (not `git merge`). Then re-run the audit's checks on the new pages, `poverty-explorer.tsx` and `lib/pages/poverty.tsx`, and confirm the only new copies are the two listed under "Other branches". Repeat this step before Task 3, after the audit-fixes branch has merged.
- [ ] **Step 1:** In `apps/web`, run `npm ci`, then `npm run typecheck`. Expected: PASS. A failure here is pre-existing; stop and report it.
- [ ] **Step 2:** Write `$SCRATCH/visible-html.mjs` (`$SCRATCH` = this session's scratchpad directory). It takes an HTML file path and prints the HTML with:
  - every `<script>…</script>` removed except `type="application/ld+json"`. Next's flight-data scripts carry chunk names and module ids that change whenever any client file changes, so without this every page would differ;
  - every `/_next/static/[^"]*` URL removed;
  - every `<!-- -->` text-node marker removed.
- [ ] **Step 3: Baseline:**
```bash
npm run build && rm -rf "$SCRATCH/html-before" && cp -r .next/server/app "$SCRATCH/html-before"
```
Expected: `find "$SCRATCH/html-before" -name '*.html' | wc -l` is in the hundreds (the sitemap lists 442 URLs). If the prerendered HTML is not under `.next/server/app` in this Next version, point Task 3 Step 5 at wherever it is before going on.

### Task 1: Page shells use `ExplorerPage` (row 6)

**Files:**
- Modify: `lib/pages/municipal-country.tsx`, `lib/pages/municipal-index.tsx`, `lib/pages/municipal-region.tsx`, `lib/pages/municipality.tsx`, `lib/pages/hub.tsx`

**Interfaces:**
- Consumes: `ExplorerPage({ testId?, repeatDesktopBottomPadding?, containerQueries?, children })` from `components/explorer-shell/explorer-page.tsx`, unchanged.
- Produces: nothing new.

- [ ] **Step 1:** In the 4 municipal renderers, replace `<main data-testid="explorer-shell" className="min-h-screen …">` plus the inner `<div className="@container mx-auto max-w-[1180px]">` with `<ExplorerPage testId="explorer-shell">`. The JSON-LD elements move inside the column; they render as `<script>` tags, so nothing moves on screen.
- [ ] **Step 2:** In `hub.tsx` (budget hub), use `<ExplorerPage testId="explorer-shell" containerQueries={false}>`. Its column has no `@container` today.
- [ ] **Step 3:** Run `npx vitest run tests/explorer/municipalOverrides.test.tsx`. Expected: PASS, snapshot unchanged.
- [ ] **Step 4: Commit:** `git commit -m "refactor: municipal and budget hub pages use ExplorerPage"`

### Task 2: Region page workspace, latest-value lines, KPI grid constant (rows 7 and 8, part)

**Files:**
- Modify: `components/regional-economies/regional-economy-explorer.tsx`, `components/economic-sectors/economic-sectors-explorer.tsx`, `components/inflation/inflation-category-indicators.tsx`, `components/inflation/inflation-city-indicators.tsx`, `components/inflation/inflation-city-category-indicators.tsx`

**Interfaces:**
- Consumes: `ExplorerWorkspace`; `LatestValueLine({ testId, measure, period, value, note? })`; `KPI_GRID_CLASS` from `components/main-explorer/kpi-blocks.tsx`.

- [ ] **Step 1:** `regional-economy-explorer.tsx:99`: replace the hand-written grid div with `<ExplorerWorkspace>`.
- [ ] **Step 2:** Replace the `regional-headline` paragraph with `<LatestValueLine testId="regional-headline" measure={t("total")} period={model.headline?.year ?? "—"} value={…same expression…} />`.
- [ ] **Step 3:** Replace the `sectors-headline` paragraph with `<LatestValueLine testId="sectors-headline" measure={t("reference")} period={…} value={…} note={model.headline?.status === "preliminary" ? t("preliminary") : undefined} />`.
- [ ] **Step 4:** In the 3 inflation indicator files, replace the inline `mt-[26px] grid @min-[1100px]:grid-cols-[…]` string with `KPI_GRID_CLASS`. In `inflation-category-indicators.tsx`, keep the `hero === null` case byte-identical, including today's trailing space: `hero === null ? "mt-[26px] grid " : KPI_GRID_CLASS`.
- [ ] **Step 5:** Run `npx vitest run tests/explorer/regionalEconomyPage.test.tsx tests/explorer/economicSectorsPresentation.test.tsx`. Expected: PASS.
- [ ] **Step 6: Phase 1 proof (Tasks 1–2):** run `npm run build`, then compare every page's visible HTML (Task 0 Step 2's script) with the Task 0 baseline:
```bash
for f in $(cd "$SCRATCH/html-before" && find . -name '*.html'); do diff <(node "$SCRATCH/visible-html.mjs" "$SCRATCH/html-before/$f") <(node "$SCRATCH/visible-html.mjs" ".next/server/app/$f") >/dev/null || echo "$f"; done
```
Expected: only these files are listed:
  - Economy region pages (added `data-testid="explorer-workspace"`; `<span data-lari>` around ₾ in the headline);
  - the Sectors page (₾ span);
  - municipal pages and `/explorer` (JSON-LD now inside the column div).

  Inspect one of each kind and confirm those are the only differences. Anything else: stop.
- [ ] **Step 7: Commit:** `git commit -m "refactor: region page uses ExplorerWorkspace and LatestValueLine; KPI grid constant"`

### Task 3: Small repeated helpers (row 13). Starts after the audit-fixes branch merges.

The dropdown class is already done on that branch as `SELECT_CLASS` in `ui/editorial.tsx`, so this task does not touch dropdowns. Leave `inflation-category-table.tsx`'s phone select alone: its classes differ (`min-h-11`, 13px, semibold).

**Files:**
- Create: `lib/explorer/selection.ts`
- Modify: `lib/pages/municipal-presentation.server.ts`, the 4 municipal renderers, and the files that toggle an id: `demography/demography-migration.tsx`, `main-explorer/use-explorer-state.ts`, `municipalities/use-municipal-state.ts`, `trade/trade-overview.tsx`, `trade/trade-products-picker.tsx`. The 3 panel files are rewritten in Task 8, so leave them.
- Test: `tests/explorer/selection.test.ts`

**Interfaces:**
- Produces:
  - `toggleId(ids: readonly string[], id: string): string[]`: removes `id` if present, otherwise appends it.
  - `municipalUpdatedNote(messages: Messages, locale: Locale, lastUpdatedAt: string | undefined): string`: returns `""` when there is no date, otherwise exactly today's `message(messages, "municipal.updatedNote", { date: locale === "en" ? formatDisplayDate(d, locale) : d })`.

- [ ] **Step 1: Write the failing test:** `toggleId(["a","b"],"a")` equals `["b"]`; `toggleId(["a"],"b")` equals `["a","b"]`; the input array is not mutated.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/selection.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement the two helpers and swap them in at each listed site. Wages' `toggleSeries` keeps its own ordering logic; it is not a plain toggle.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/selection.test.ts` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Proof of no change:** the second sync brings in other branches' changes, so the Task 0 baseline is stale here. Before editing (right after Task 0 Step 0's second sync), take a fresh baseline into `$SCRATCH/html-before-t3` the same way. After the change, run the same comparison against it. Expected: no file listed.
- [ ] **Step 6: Commit:** `git commit -m "refactor: shared toggleId and municipal updated note"`

---

## Phase 2: merge copies

### Task 4: Finish the one URL-state hook (row 1, gate D1). Starts after the audit-fixes branch merges.

The audit-fixes branch already created `components/explorer-shell/use-hash-state.ts` and moved Trade (3 pages), External flows (3), Wages and Poverty onto it. This task extends that hook additively and converts what is left.

**Files:**
- Modify: `components/explorer-shell/use-hash-state.ts` (extend; the existing callers stay untouched), `components/unemployment/use-unemployment-state.ts`, `components/economic-sectors/use-economic-sectors-state.ts`, `components/regional-economies/use-regional-economy-state.ts`, `components/regional-economies/regional-economy-explorer.tsx`
- Modify, if merged by then:
  - `components/money-banks/money-banks-explorer.tsx` (inline copy);
  - `components/energy-food/*` callers of `explorer-shell/use-hash-explorer-state.ts`: switch them to `useHashState` with `data` unused, and delete that file;
  - `household-explorer.tsx`: its import path, if the second-merging branch did not already fix it.
- Test: `tests/explorer/hashState.test.ts`, `tests/browser/regional-economies.spec.ts`

**Interfaces:**
- Consumes: the merged `useHashState(data, parse, serialize, options?: HashStateOptions<D, S>)`, where `HashStateOptions = { normalize?, afterWrite? }`, `update(change, push?: boolean): void`.
- Produces (all additive, existing callers unchanged):
  ```ts
  export type HistoryMode = "push" | "replace";
  export function writeHash(hash: string, mode: HistoryMode, target?: Pick<Window, "location" | "history">): void;
  // HashStateOptions gains: initial?: S
  // update becomes: (change: (previous: S) => S, history?: boolean | HistoryMode) => S
  ```
  - `writeHash` holds the existing write logic: no call when `target.location.hash === hash`, else `pushState`/`replaceState` inside the existing try/catch. `update` calls it, then `setState`, then `afterWrite` as today.
  - `history`: `true` or `"push"` pushes; `false`, `"replace"` or omitted replaces.
  - `update` now returns the new state (Unemployment and Sectors use it). Returning a value from a function typed `void` at call sites is compatible.
  - `options.initial` replaces `parse("", data)` for the first render (server HTML). Sectors and Regions pass their `DEFAULT_*_STATE` so their server HTML does not change.
  - `parse`, `serialize`, `data` and `options` must keep their identity across renders, per the hook's existing comment.

- [ ] **Step 1: Write the failing tests** in `hashState.test.ts`. Use a fake `target` that records calls.
  - `writeHash("#a", "push", t)` calls `pushState` once with `"#a"`; `"replace"` calls `replaceState`.
  - Same hash: no call.
  - A `pushState` that throws does not throw out of `writeHash`.
  - The parse/serialize functions themselves do not change, so deep links are proven by the existing browser specs in Step 7, not here.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/hashState.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Extend `use-hash-state.ts` with `writeHash`, the return value, `history` modes and `initial`.
- [ ] **Step 4:** Replace the remaining copies:
  - unemployment: `data = useMemo(() => ({ facts, registry, section, regionId }), […])` with module-level adapters;
  - sectors: `parse = (hash, d) => changeSectorMeasure(parseSectorHash(hash, ids(d)), …)` (module level), with `initial: DEFAULT_SECTOR_STATE`;
  - regional: the same pattern with `initial: DEFAULT_REGIONAL_ECONOMY_STATE`;
  - money & banks, energy & food: only if merged (see Files).
- [ ] **Step 5:** Run `npx vitest run tests/explorer/hashState.test.ts tests/explorer/tradePartnersRender.test.tsx tests/explorer/tradeProductsRender.test.tsx tests/explorer/foreignInvestmentRender.test.tsx tests/explorer/regionalEconomyPage.test.tsx`. Expected: PASS. The trade and external tests guard against breaking the existing callers.
- [ ] **Step 6 (gate D1):** In `regional-economy-explorer.tsx`, pass `"push"` on the view-mode (line 103) and measure (line 107) changes. Range (117) and selection (122) use the default (replace), matching `economic-sectors-explorer.tsx` lines 136/156/219/242.
- [ ] **Step 7: Browser test:** add to `regional-economies.spec.ts`: open a region page, switch to table (one push), drag or press the range end handle back 3 years, then `page.goBack()`. Expected: the chart view returns at the default range, so only one Back step was needed. Run `npx playwright test tests/browser/regional-economies.spec.ts tests/browser/economic-sectors.spec.ts tests/browser/trade-partners.spec.ts tests/browser/trade-products.spec.ts tests/browser/unemployment.spec.ts tests/browser/wages.spec.ts tests/browser/trade-overview.spec.ts tests/browser/money-from-abroad.spec.ts tests/browser/foreign-investment.spec.ts tests/browser/current-account.spec.ts`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "refactor: Unemployment, Sectors and Regions use the shared useHashState; region range drags no longer add Back steps"`

### Task 5: City picker becomes a configuration of the region picker (row 2)

**Files:**
- Modify: `components/regional-economies/region-picker.tsx`, `components/inflation/inflation-city-heading.tsx`, `DESIGN.md:1055` (wording only: "`CityPicker`, `RegionPicker`'s anatomy" becomes "the shared `PickerDialog` (as `RegionPicker`)")
- Delete: `components/inflation/city-picker.tsx`
- Test: `tests/explorer/cityPicker.test.tsx`; `tests/explorer/regionalEconomyPicker.test.tsx` must pass unchanged.

**Interfaces:**
- Produces, in `region-picker.tsx`:
  ```ts
  export type PickerOption = { id: string; label: string; href: string; searchTerms: string[] };
  export type PickerText = { title: string; placeholder: string; search: string; results: string; empty: string; clear: string; hint: string };
  export function PickerDialog(props: {
    open: boolean; onClose: () => void;
    options: PickerOption[]; activeId: string | null;
    allOption: { label: string; href: string; searchTerms: string[]; testId: string; current?: boolean };
    text: PickerText;
    testIdPrefix: string; // option ids `${testIdPrefix}-option`; Escape refocuses `[data-testid='${testIdPrefix}-trigger']`
  }): ReactNode;
  ```
  The body is today's `RegionPicker` body made generic. `RegionPicker` keeps its exact props and becomes a wrapper that builds `options` (searchTerms = ka label + English label), `allOption` (`testId: "region-picker-all-option"`), `text` from the `regionalEconomies.picker*` keys, and `testIdPrefix: "region-picker"`.
- `inflation-city-heading.tsx` renders `PickerDialog` with:
  - city options: searchTerms = label + `citySlug(id)`, href = `pageHref(cityPageHref(id), locale)`;
  - `allOption` = Georgia (`testId: "city-picker-georgia-option"`, `current: view.kind === "georgia"`, searchTerms `[label, "georgia"]`);
  - `text` from the `inflation.cityPicker*` keys;
  - `testIdPrefix: "city-picker"`.

- [ ] **Step 1: Write the failing tests** in `cityPicker.test.tsx`. The heading renders the picker closed, so render `PickerDialog` directly, open, with the city configuration:
  - 6 `data-testid="city-picker-option"` and 1 `city-picker-georgia-option`;
  - the Georgia row carries `aria-current="page"` when `current` is true;
  - with the `testIdPrefix` "city-picker", the markup contains no `region-picker` id;
  - places are searchable by English slug. Typing can't be simulated in static markup, so export `filterPickerOptions(options, query): PickerOption[]` from `region-picker.tsx` and assert `filterPickerOptions(cityOptions, "batumi")` returns only Batumi.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/cityPicker.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement `PickerDialog`, `filterPickerOptions` and the `RegionPicker` wrapper; switch the city heading; delete `city-picker.tsx`; update `DESIGN.md:1055`.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/cityPicker.test.tsx tests/explorer/regionalEconomyPicker.test.tsx`. Expected: PASS, with the region test unchanged.
- [ ] **Step 5:** Run `npx playwright test tests/browser/inflation-cities.spec.ts tests/browser/regional-economies.spec.ts tests/browser/unemployment-regions.spec.ts tests/browser/wages.spec.ts`. Expected: PASS, including the existing Escape-focus test at `inflation-cities.spec.ts:62`.
- [ ] **Step 6: Commit:** `git commit -m "refactor: city picker reuses the region picker dialog"`

### Task 6: One "title — place ▾" heading; plain-link option for neighbour links (rows 3 and 4)

**Files:**
- Move: `components/inflation/inflation-city-heading.tsx` → generic `components/explorer-shell/place-heading.tsx`. Keep `InflationCityHeading` as a thin wrapper in its file.
- Modify: `components/explorer-shell/entity-neighbour-links.tsx`, `components/municipalities/entity-heading.tsx`, `components/regional-economies/regional-economy-explorer.tsx`, `components/unemployment/unemployment-explorer.tsx`, `components/wages/wages-explorer.tsx`
- Test: `tests/explorer/placeHeading.test.tsx`

**Interfaces:**
- Consumes: `PickerDialog`, `RegionPicker` (Task 5).
- Produces:
  ```ts
  export function PlaceHeading(props: {
    lead: string; placeLabel: string; triggerTestId: string;
    picker: (open: boolean, close: () => void) => ReactNode;
    neighbours?: { testId: string; previous: { href: string; label: string }; next: { href: string; label: string } };
  }): ReactNode;
  ```
  - The markup is today's `InflationCityHeading` markup: wrapper `relative mt-[34px] mb-3 flex …`, h1 in the left column, picker as the h1's sibling in that column, `aria-haspopup="dialog"` on the trigger, and `EntityNeighbourLinks` on the right.
  - `EntityNeighbourLinks` gains `plainAnchors?: boolean` (default `false`). When true, it renders `<a href>` instead of `next/link`.

- [ ] **Step 1: Write the failing tests:**
  - `PlaceHeading` markup contains the trigger with `data-testid` = `triggerTestId`, `aria-haspopup="dialog"` and `aria-expanded="false"`;
  - with `neighbours`, both hrefs are present inside the given `testId`; without them, the markup contains no `←`;
  - `EntityNeighbourLinks` with `plainAnchors` renders two `<a href=` elements and equal class strings to the default.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/placeHeading.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement. Then replace the inline headings:
  - regional: lead `t("detailHeadingLead")`, trigger `region-picker-trigger`, neighbours testId `regional-entity-navigation`;
  - unemployment: lead `t("regionHeadingLead")`, testId `unemployment-region-navigation`. Pages without a region keep `<ExplorerHeading>`;
  - wages: testId `wages-region-navigation`.

  `EntityHeading` replaces its inline `<span data-testid="municipal-entity-navigation">` with `<EntityNeighbourLinks testId="municipal-entity-navigation" plainAnchors …/>`.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/placeHeading.test.tsx tests/explorer/regionalEconomyPage.test.tsx tests/explorer/municipalOverrides.test.tsx`. Expected: placeHeading and regionalEconomyPage PASS; municipalOverrides FAILS on its snapshot. Its stored `municipal-entity-navigation` markup differs from `EntityNeighbourLinks` in class order on the "next" link (`justify-end text-right` comes last) and in a trailing space when `className` is empty. This is the plan's one allowed snapshot update:
  - run `npx vitest run tests/explorer/municipalOverrides.test.tsx -u`;
  - check with `git diff tests/explorer/__snapshots__/municipalOverrides.test.tsx.snap` that only `class="…"` order or whitespace changed;
  - paste that diff into the commit message.

  Anything more than class order or whitespace: stop and report.
- [ ] **Step 5:** Run `npx playwright test tests/browser/regional-economies.spec.ts tests/browser/unemployment-regions.spec.ts tests/browser/wages.spec.ts tests/browser/inflation-cities.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/mobile-repairs-nav.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit:** `git commit -m "refactor: one PlaceHeading for region and city pages; municipal heading reuses EntityNeighbourLinks"`

### Task 7: One topic-hub layout (row 5, gates D2/D3)

**Files:**
- Modify: `lib/pages/hub.tsx` (add the helper), `lib/pages/economy.tsx`, `lib/pages/demography.tsx`, `lib/pages/inflation.tsx` (`renderInflationHub`), `lib/pages/trade.tsx` (`renderTradeHub`), `lib/pages/external.tsx` (`renderExternalHub`), `lib/pages/unemployment.tsx` (hub branch), `lib/pages/wages.tsx` (hub branch), `lib/pages/poverty.tsx` (`renderPovertyHub`, on `main` since #174)
- Modify, if merged by then: `lib/pages/energy-food.tsx`, `lib/pages/moneyBanks.tsx`, `lib/pages/living-standards.tsx` (same shape, from the energy & food, money & banks and living standards branches). Each passes its current title, summary key, coverage and testId.
- Test: `tests/explorer/topicHub.test.tsx`

**Interfaces:**
- Produces, in `lib/pages/hub.tsx`:
  ```ts
  export function TopicHub(props: {
    locale: Locale; presentation: Presentation; title: string; crumbLabel?: string; summary: string; path: string;
    coverage: string; cards: HubCardModel[]; testId: string; breadcrumb?: boolean; after?: ReactNode;
  }): ReactNode;
  ```
  - It renders `I18nProvider` → `BreadcrumbJsonLd` (Home → `crumbLabel ?? title` at `path`, unless `breadcrumb === false`) → `ExplorerPage containerQueries={false}` → `PageHeader` (crumbs Home / `common.data` / `crumbLabel ?? title`, `coverage`) → `ExplorerHeading` (`title`) → `<p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">` → `BudgetHub` → `after`.
  - `crumbLabel` exists for Inflation: its breadcrumb says `common.inflation`, but its H1 says `inflation.hubHeading`. Every other hub uses one label for both.
  - `Presentation` = `Awaited<ReturnType<typeof getPresentation>>`.

- [ ] **Step 1: Write the failing test:** render `TopicHub` with 2 fake cards. Expect:
  - 2 `data-testid="hub-card"`;
  - the given `testId`;
  - one `application/ld+json` breadcrumb with the title;
  - with `breadcrumb={false}`, no breadcrumb script.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/topicHub.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement `TopicHub`. Convert the 8 hubs on `main` (plus any of the 3 new ones that have merged), keeping each one's current title, summary key, coverage value (D3: demography, trade and external keep `""`) and testId. Unemployment passes `after={<UnemploymentLegacyLink locale={locale} />}`. Economy gets the breadcrumb (D2). Inflation passes `crumbLabel={t("common.inflation")}`.

  Expected visible change: the Economy and Demography summary lines gain the 640px width cap the other five hubs have, so a long summary may wrap earlier on wide screens. Note it in the PR.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/topicHub.test.tsx tests/explorer/economyHub.test.tsx tests/explorer/demographyHub.test.ts`. Expected: PASS.
- [ ] **Step 5:** Run `npx playwright test tests/browser/seo.spec.ts tests/browser/bilingual-seo.spec.ts tests/browser/bilingual-navigation.spec.ts`. Expected: PASS. If a breadcrumb-count assertion fails only for `/explorer/economy`, that is gate D2's intended change: report it to the owner, do not edit the test.
- [ ] **Step 6: Commit:** `git commit -m "refactor: one TopicHub layout for the seven topic hubs; economy hub gains breadcrumb data"`

### Task 8: One flat series panel (row 11)

**Files:**
- Move and rename: `components/external/money-from-abroad-series-panel.tsx` → `components/explorer-shell/flat-series-panel.tsx` (`FlatSeriesPanel`)
- Modify: `components/external/money-from-abroad.tsx`, `foreign-investment.tsx`, `current-account.tsx` (import `FlatSeriesPanel`).
- Modify: `components/economic-sectors/sector-series-panel.tsx`, `components/regional-economies/regional-economy-series-panel.tsx`, `components/unemployment/unemployment-series-panel.tsx`. Each **keeps its file and its exact props** and becomes a thin wrapper that builds `rows` and renders `FlatSeriesPanel`. Reason: `tests/explorer/economicSectorsPresentation.test.tsx` imports `SectorSeriesPanel` directly, and deleting it would mean editing a test.
- Test: `tests/explorer/flatSeriesPanel.test.tsx`

**Interfaces:**
- Consumes: `toggleId` (Task 3), `SeriesSelector`, `SeriesSelectorRow`, `SeriesAside`.
- Produces:
  ```ts
  export type FlatSeriesRow = { id: string; label: string; color: string; value: string; searchTerms?: string[] };
  export function FlatSeriesPanel(props: {
    rows: FlatSeriesRow[]; selectedIds: string[]; onSelectionChange: (ids: string[]) => void;
    caption: ReactNode; searchPlaceholder: string; downloadAction: ReactNode;
    totalId?: string; pinTotal?: boolean; wrapLabel?: boolean; asideLabel?: string;
    controls?: ReactNode; query?: string; onQueryChange?: (query: string) => void;
    selectedCount?: number; totalCount?: number;
  }): ReactNode;
  ```
  - Visible rows = rows matching `matchesLabelQuery(query, searchTerms ?? [label])`, plus the `totalId` row when `pinTotal`.
  - `hasVisibleMatches` = any row matches, with the pinned row not counting.
  - `allSelected` = `selectedCount === totalCount` (defaults `selectedIds.length` / `rows.length`).
  - Bulk = `selectedCount ? [] : rows.map(id)`.
  - Level is `"total"` for `totalId`, otherwise `"item"`.
  - `wrapLabel` defaults to `true`.
  - With `asideLabel`, the panel wraps itself in `SeriesAside`; without it, the caller wraps.
  - Search is internal unless `query`/`onQueryChange` are given.

- [ ] **Step 1: Write the failing tests:**
  - 3 rows with total pinned and the query "zzz": the total row is rendered and the "no matches" state is shown;
  - without `pinTotal` and with "zzz": no rows;
  - `wrapLabel={false}` passes through to the row;
  - `asideLabel` produces an `<aside aria-label=…>`.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/flatSeriesPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement. The explorers keep calling the three wrappers unchanged; only the wrappers' insides change:
  - external pages: same props as today, `totalId` as today, no pin;
  - Sectors: rows from `rankSectorDefinitions`, `searchTerms` = ka/en/code, `pinTotal`, `totalId=SECTOR_GDP`, `wrapLabel={false}`, `asideLabel`, caption `sectors.rowYear`;
  - regions: the same with `regionalEconomy*`. Search now uses `sectorMatchesQuery` semantics (per-label match);
  - unemployment: `controls`, controlled `query`, `pinTotal` on `referenceId`, caption `{endYear} · %|unit`.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/flatSeriesPanel.test.tsx tests/explorer/economicSectorsPresentation.test.tsx tests/explorer/foreignInvestmentRender.test.tsx tests/explorer/regionalEconomyPage.test.tsx`. Expected: PASS.
- [ ] **Step 5:** Run `npx playwright test tests/browser/economic-sectors.spec.ts tests/browser/regional-economies.spec.ts tests/browser/unemployment.spec.ts tests/browser/money-from-abroad.spec.ts tests/browser/foreign-investment.spec.ts tests/browser/current-account.spec.ts tests/browser/mobile-series-picking.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit:** `git commit -m "refactor: one FlatSeriesPanel for external, sectors, regions and unemployment"`

### Task 9: Debt panel uses the shared tree-row builder (row 12)

**Files:**
- Modify: `components/main-explorer/series-panel.tsx`, `components/debt/debt-series-panel.tsx`
- Test: `tests/explorer/seriesSelector.test.ts` (extend)

**Interfaces:**
- Produces, in `series-panel.tsx`:
  ```ts
  export type TreeRow<T> = { item: T; isChild: boolean; hasChildren: boolean; expanded: boolean; locked: boolean };
  export function buildTreeRows<T>(parents: T[], childrenOf: (parent: T) => T[], matches: (item: T, query: string) => boolean, idOf: (item: T) => string, query: string, expandedIds: string[]): TreeRow<T>[];
  ```
  - The algorithm is today's loop in `buildSeriesPanelRows`: a parent is shown if it or a child matches; a parent with matching children and no own match is forced open and locked, showing only the matching children.
  - `buildSeriesPanelRows` keeps its signature and output: total first, then `buildTreeRows` mapped to `SeriesPanelRow` (`isProgram = isChild`, `caretLocked = locked`).

- [ ] **Step 1: Write the failing tests:** a `buildTreeRows` case where a query matches only a child (parent forced open and locked, only that child listed), and an expanded parent with an empty query (all children listed). The existing `buildSeriesPanelRows` tests stay as they are.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/seriesSelector.test.ts`. Expected: FAIL (export missing).
- [ ] **Step 3:** Implement. Point `DebtSeriesPanel`'s `visibleRows` at `buildTreeRows`.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/seriesSelector.test.ts tests/explorer/debtExplorer.test.ts`, then `npx playwright test tests/browser/debt.spec.ts tests/browser/main-explorer.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "refactor: debt panel uses the shared tree-row builder"`

---

## Phase 3: blocks with visual detail

Before Task 10, build and serve once (`NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100`). Then save desktop (1280px) and phone (375px) screenshots of these pages to `$SCRATCH/shots-before/`, with a short Playwright script in `$SCRATCH` (not under `tests/`). The after-shots for each task need a fresh build: stop the server first, because a running `next start` corrupts the `.next` it serves.
- `/explorer/economy/sectors`
- `/explorer/economy/regions/imereti`
- `/explorer/municipalities/georgia`
- one municipality page
- `/explorer/trade/partners#measure=trade.balance`
- `/explorer/trade/products` with "show all" open on page 2

Tasks 10–13 compare against them.

### Task 10: KPI blocks adopted on Sectors, regions and municipal pages (row 8)

**Files:**
- Modify: `components/main-explorer/kpi-blocks.tsx`, `components/economic-sectors/sector-highlights.tsx`, `components/regional-economies/region-highlights.tsx`, `components/municipalities/municipal-indicators.tsx`
- Test: `tests/explorer/kpiBlocks.test.tsx` (extend); `tests/explorer/sectorHighlights.test.tsx` must pass unchanged.

**Interfaces:**
- Produces (all optional; defaults give today's markup):
  - `HeroKpi`: `value: ReactNode` (widened from `string`), `unit?: string` (rendered like today's sector hero unit span, through `withLari`), `testId?: string` (wrapper), `valueTestId?: string`.
  - `SideKpi`: `testId?: string` (replaces `"side-kpi"` on the row when given).
  - `SideKpiList`: `testId?: string` (list wrapper); `rowTestId?: string`. When given, each row is wrapped as `<div data-testid={rowTestId} className={rowClass}><div data-testid={kpi.testId ?? "side-kpi"}>…</div></div>`, which is municipal's current DOM.

- [ ] **Step 1: Write the failing tests:**
  - `HeroKpi` with `unit="მლრდ ₾"` renders a `data-lari` span;
  - `testId` and `valueTestId` appear;
  - `SideKpiList` with `rowTestId="entity-kpi"` renders `entity-kpi` wrapping `side-kpi`;
  - a kpi `testId` of `"sector-highlight-fastest"` replaces `side-kpi` on that row.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/kpiBlocks.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement, then convert:
  - Sectors: hero `testId="sector-highlight-largest"`, `valueTestId="sector-hero-value"`; list `testId="sector-side-kpis"`; row testIds `sector-highlight-${id}`; `wrapDetail: !card.available`;
  - regions: hero plus `SideKpiList`;
  - municipal: hero `testId="entity-kpi"`; list `rowTestId="entity-kpi"`.

  The single-year note branch stays as it is.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/kpiBlocks.test.tsx tests/explorer/sectorHighlights.test.tsx tests/explorer/municipalOverrides.test.tsx`. Expected: PASS.
- [ ] **Step 5:** Run `npx playwright test tests/browser/economic-sectors.spec.ts tests/browser/regional-economies.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/municipal-georgia.spec.ts tests/browser/mobile-repairs-pages.spec.ts`. Expected: PASS. Compare screenshots. Expected differences only:
  - region side list: last row bottom padding −14px, detail text clipping now `KPI_DETAIL_CLIP_CLASS`;
  - Sectors: unavailable details use `break-words` instead of `leading-relaxed`.
- [ ] **Step 6: Commit:** `git commit -m "refactor: sectors, region and municipal KPI blocks use HeroKpi and SideKpiList"`

### Task 11: Shared movers row and period comparison table (row 9)

**Files:**
- Modify: `components/main-explorer/kpi-blocks.tsx` (export the two pieces), `components/main-explorer/indicators.tsx`, `components/municipalities/municipal-indicators.tsx`
- Test: `tests/explorer/periodComparison.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function MoverRow(props: { rank: number; label: string; change: number | null; maxAbs: number }): ReactNode;
  export type ComparisonRow = { key: string; label: string; title: string; color: string; start: number | null; change: number | null; end: number | null; emphasis: boolean };
  export function PeriodComparisonTable(props: {
    heading: string; caption: string; firstColumnLabel: string; changeLabel: string; startYear: number; endYear: number;
    rows: ComparisonRow[]; renderAmount: (value: number | null, signed: boolean) => ReactNode;
    changeColor: (row: ComparisonRow) => string; variant?: "national" | "municipal";
  }): ReactNode;
  ```
  - `MoverRow`: colour `var(--muted)` when `change` is null, otherwise `POSITIVE`/`NEGATIVE`; bar width 0 when null, otherwise `max(4, |change|/maxAbs*100)%`. Markup is today's.
  - Budget movers never pass `null`: `lib/explorer/explorerData.ts:144` filters `row.change !== null`. So today's budget `?? 0` fallback can go without changing output.
  - `variant` selects the column-width classes and wrapper:
    - `"national"` (default): today's budget `colgroup` and no scroll wrapper;
    - `"municipal"`: today's municipal `colgroup` (`@max-[340px]` rules), the `overflow-x-auto` wrapper, `data-testid="comparison-table"`, an emphasis row tint `bg-[var(--tint)]`, and `data-testid="comparison-change-cell"`.

- [ ] **Step 1: Write the failing tests:**
  - `MoverRow` with `change: null` renders width `0%` and colour `var(--muted)`; with `0.5` and `maxAbs: 1`, width `50%`;
  - `PeriodComparisonTable variant="municipal"` contains `comparison-table` and `comparison-change-cell`;
  - `"national"` contains neither;
  - both render one `<tr>` per row plus the header.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/periodComparison.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement and convert:
  - budget: `renderAmount` = today's `comparisonCell` / signed `formatBn`, labels truncated to 40 with full `title`, total first with emphasis;
  - municipal: `renderAmount` = its `AmountText`, `changeColor` = its `growthColor(changeShare)`.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/periodComparison.test.tsx tests/explorer/municipalOverrides.test.tsx`, then `npx playwright test tests/browser/main-explorer.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/mobile-repairs-tables.spec.ts`. Expected: PASS. Screenshots: no difference.
- [ ] **Step 5: Commit:** `git commit -m "refactor: budget and municipal indicators share MoverRow and PeriodComparisonTable"`

### Task 12: Trade ranking renders through `ExternalRanking` (row 10)

**Files:**
- Modify: `components/external/external-ranking.tsx`, `components/trade/trade-partners-ranking.tsx` (it keeps its props and its show-all/paging state, but renders `ExternalRanking`)
- Test: `tests/explorer/externalRanking.test.tsx`; `tests/explorer/tradePartnersRender.test.tsx` and `tradeProductsRender.test.tsx` must pass unchanged.

**Interfaces:**
- Produces, as optional `ExternalRanking` props:
  - `unit?: ValueUnit` (default: today's millions unit);
  - `signed?: boolean` (bars from a centre zero axis, with `data-testid="${testId}-zero-axis"`);
  - `showShare?: boolean` (default `true`; when false, drop the share column and widen the name column to 64%);
  - `rankLabel?: string` (default `"#"`);
  - `unavailableLabel?: string`: inserts a heading row before a `valueUsd === null` row when it is the first rendered row *or* follows a valued row, which is today's trade rule (`index === 0 || rows[index - 1].valueUsd !== null`). This matters on products page 2+, which can start with unavailable rows. Null rows render as kind `"unavailable"` with no bar;
  - `footer?: ReactNode`;
  - `sectionData?: Record<string, string | number>` (alias of today's `data`; keep `data`).
- `TradePartnersRanking`'s `measure` prop is `TradeChartIndicator` since #173. Keep its note rule exactly: the products share note when `tab === "products"` or the measure is `trade.domestic_exports` or `trade.reexports`; otherwise the balance or share note. It is passed to `ExternalRanking` as `note`.
- `TradePartnersRanking` maps its rows (`shareOfNational` → `share`) and passes `testId="trade-partners"`. That reproduces `trade-partners-ranking`, `trade-partners-ranking-row` and `trade-partners-unavailable-row`. Its show-all button (`trade-partners-show-all`) and pager (`trade-products-ranking-previous/next`) go in `footer`. Section data stays `end-year` and `has-share`.

- [ ] **Step 1: Write the failing tests:**
  - `signed` renders the zero axis;
  - `showShare={false}` gives a 3-column header;
  - `unavailableLabel` with rows `[valued, null]` renders the label once and one `trade-partners-unavailable-row`; with rows `[null, null]`, it renders the label once, before the first row;
  - the default render is byte-identical to a snapshot taken from today's component. Write the snapshot assertion *before* changing the component, then run it once to record it.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/externalRanking.test.tsx`. Expected: the snapshot is recorded and the 3 option tests FAIL.
- [ ] **Step 3:** Implement and convert `TradePartnersRanking`.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/externalRanking.test.tsx tests/explorer/tradePartnersRender.test.tsx tests/explorer/tradeProductsRender.test.tsx tests/explorer/foreignInvestmentRender.test.tsx`, then `npx playwright test tests/browser/trade-partners.spec.ts tests/browser/trade-products.spec.ts tests/browser/trade-domestic.spec.ts tests/browser/money-from-abroad.spec.ts tests/browser/foreign-investment.spec.ts`. Expected: PASS. Screenshots: no difference (add `/explorer/trade/domestic-exports#section=countries` to the screenshot list).
- [ ] **Step 5: Commit:** `git commit -m "refactor: trade ranking renders through ExternalRanking"`

### Task 13 (optional, gate D5): `ShareBar` for the thin bars (row 14)

**Files:**
- Modify: `components/ui/editorial.tsx`, `components/economic-sectors/sector-highlights.tsx`, `components/municipalities/municipalities-index.tsx`, `components/municipalities/municipal-indicators.tsx`, `components/demography/demography-migration.tsx`
- Not touched: `components/analysis/ranking.tsx`. Its bar is hidden on phones (`hidden … min-[768px]:inline-block`). Combining that with `ShareBar`'s own `flex` would put two display utilities on one element, and which one wins depends on stylesheet order.
- Test: `tests/explorer/shareBar.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function ShareBar(props: { share: number; color?: string; restColor?: string; className?: string; testId?: string; fillTestId?: string }): ReactNode;
  ```
  - `share` is a 0–1 fraction, clamped.
  - It renders `<span>` elements only, so it is valid inside links and phrasing content: an outer `aria-hidden="true"` `flex h-[3px] bg-[var(--hairline-soft)] {className}` (the bar is decorative; every site already prints the figure as text), a fill of `share*100%` in `color` (default `var(--ink)`), and a second fill of `(1-share)*100%` in `restColor` when given. Widths use `toFixed(1)`.

- [ ] **Step 1: Write the failing tests:**
  - `share: 0.25` gives `width:25.0%`;
  - `share: 1.4` clamps to `100.0%`;
  - `restColor` adds a second span at `75.0%`;
  - the markup contains no `<div`.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/shareBar.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement and convert the 4 sites:
  - municipalities index: `color="var(--accent)"`, `className="mt-[5px]"`, `fillTestId="municipal-row-bar"`;
  - municipal gauge: `testId="municipal-change-gauge"`, `restColor="var(--accent)"`;
  - migration: `restColor="var(--accent)"`;
  - Sectors: `share = largestShare / 100`.
- [ ] **Step 4:** Run `npx vitest run tests/explorer/shareBar.test.tsx`, then `npx playwright test tests/browser/municipalities.spec.ts tests/browser/economic-sectors.spec.ts tests/browser/demography-migration.spec.ts tests/browser/municipal-entity.spec.ts`. Expected: PASS. Screenshots: no difference.
- [ ] **Step 5: Commit:** `git commit -m "refactor: shared ShareBar for the thin share bars"`

---

### Task 14: Done-check and delivery

**Files:**
- Modify: `docs/superpowers/specs/2026-10-11-component-reuse-audit.md` (mark each row done/skipped). `AGENTS.md` and `Project_Definition.md` need no change; `DESIGN.md` was handled in Task 5.

- [ ] **Step 1:** Run `npm run check`. Expected: PASS (lint, typecheck, unit, data validation, i18n).
- [ ] **Step 2:** Build and serve once, then run the full browser suite against it (`CLAUDE.md` recipe):
```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```
Expected: all pass. Download/request specs that fail under load: re-run that file alone before treating it as a failure.
- [ ] **Step 3:** Run `git diff --stat main...HEAD`. Expected: a net line count well below zero; report the number.
- [ ] **Step 4:** Push the branch and open a draft PR. The body lists the 13–14 commits, the gate answers and the before/after screenshots. Then bind it with `ccd_pr`, wait for CI green, and check the touched production URLs after merge.
