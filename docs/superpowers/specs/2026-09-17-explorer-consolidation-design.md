# Explorer and pipeline consolidation: specification

Date: 2026-09-17
Status: Draft for user review. Scope and packaging were approved in conversation on 2026-09-17, after a reviewed audit of the work merged 2026-09-02..09-14. This spec is the explicit approval to refactor shared modules that earlier feature specs told implementers not to touch (e.g. `2026-09-11-economic-sectors-design.md:136`, `:165`).
Baseline: `main` at `c7451ceaf`. Line numbers refer to that commit. Paths are under `apps/web/` unless they start with `data/`, `docs/` or name a root document.
Series: audit remediation, spec 8 of 8, and the last to land. Preconditions:
- Spec 2 is merged (the chart pieces exist).
- Spec 3 is merged (hash write rules settled).
- Spec 1 is merged (workbook `showChangeColumn` input and the "calculated" basis).

## 1. Outcome and scope

The six explorers added in September duplicate code the budget explorer already had. This spec consolidates that code into single implementations. Every part is behaviour-preserving: pages, URLs, workbooks and generated artifacts stay identical, except for the one visible change listed in §3.

| § | Duplication | Single implementation |
|---|---|---|
| 2 | Page wrapper, heading, workspace grid, series aside, measure pill, `appReady` effect | Shared shell components and `useAppReady()` |
| 3 | Four hand-built workbook models | Generalised `buildWorkbookExportModel` |
| 4 | Range and tab logic in four modules; duplicate source projection | `periodRange.ts`, `projectArchiveSources()` |
| 5 | Two KPI block copies | `HeroKpi` / `SideKpiList` with two small props |
| 6 | Manifest readers, BOM CSV serializers, freshness checks | `lib/data/sourcePackage.ts`, `assertGeneratedArtifactMatches` |
| 7 | Seven URL-hash codecs and write hooks | Shared hash helpers and one `useHashState` hook |
| 8 | Nested provider, literal ink, hand-formatted billions | Existing providers, `INK`, format helpers |

### 1.1 User-approved decisions (2026-09-17)

- All audit fixes are specified, including consolidation. Consolidation comes last.

### 1.2 Decisions taken in this spec

- **Separate PRs.** Each section is its own PR. None changes a test expectation except where this spec lists one.
- **Municipal pages.** Their own shell variants (36px heading, non-sticky aside) are out of scope, except the KPI blocks in §5.
- **Identical output.** "Behaviour-preserving" is measured by these tests and checks:
  - the unit, route and browser tests, unchanged
  - identical workbook models for fixed inputs
  - byte-identical generated artifacts, via `npm run data:validate`

## 2. Explorer shell

Evidence of duplication:
- **Heading:** the H1 class string appears 8 times — `components/main-explorer/main-explorer.tsx:301`, `components/debt/debt-explorer.tsx:148`, `components/deficit/deficit-explorer.tsx:144`, `components/gdp/gdp-overview.tsx:117`, `components/inflation/inflation-overview.tsx:100`, `components/inflation/inflation-categories.tsx:144`, `components/economic-sectors/economic-sectors-explorer.tsx:92`, `lib/pages/inflation.tsx:44`.
- **Series aside:** the class string appears 6 times — `components/main-explorer/series-panel.tsx:139`, `components/debt/debt-series-panel.tsx:87`, `deficit-explorer.tsx:251`, `components/inflation/inflation-series-panel.tsx:35`, `components/inflation/inflation-category-panel.tsx:67`, `components/economic-sectors/sector-series-panel.tsx:45`.
- **Workspace grid:** 6 copies (`components/main-explorer/explorer-view.tsx:120` and the five new explorers).
- **Page wrapper:** the `main` classes appear 12 times, six of them on the new surfaces.
- **Measure pill:** 3 copies (`explorer-view.tsx:137-149`, `debt-explorer.tsx:194-206`, `deficit-explorer.tsx:176-187`).
- **`appReady` effect:** `document.body.dataset.appReady` is set in 9 identical effects plus one set-only case (`components/shell/legacy-hash-redirect.tsx:17`). 23 browser test files wait on it.
- **Why `ExplorerView` itself can't be reused:** it is budget-typed (`explorer-view.tsx:23-66`).

Change:
- Add `components/explorer-shell/`: `ExplorerPage` (wrapper and container), `ExplorerHeading`, `ExplorerWorkspace`, `SeriesAside`, `MeasurePill` and `useAppReady()`.
- Adopt them in the budget explorer, debt, deficit, GDP, both inflation pages, sectors, and the headings in `lib/pages/inflation.tsx` and `lib/pages/economy.tsx`. The economy heading was aligned in spec 3.
- `legacy-hash-redirect.tsx` keeps its set-only behaviour through a hook option.

Acceptance:
- A route-level test captures the class lists of the wrapper, heading, workspace, aside and pill on each adopting page before the refactor, and asserts them unchanged after it.
- `data-app-ready` timing is unchanged; all browser tests pass.

## 3. Workbook model

Evidence:
- **Hand-built models:** four builders construct `WorkbookExportModel` literals themselves — `lib/explorer/gdpWorkbook.ts:38-89`, `lib/explorer/inflationWorkbook.ts:17-117`, `lib/explorer/inflationCategoryWorkbook.ts:31-175`, `lib/explorer/economicSectorsWorkbook.ts:22-150`.
- **Re-implemented merging:** source merging is re-implemented in `economicSectorsWorkbook.ts:62-78`. Month rows and the locale-preferring source picker are duplicated between `inflationWorkbook.ts:38-57`, `:83-87` and `inflationCategoryWorkbook.ts:71-86`, `:123-127`.
- **Limits of the shared builder** (`lib/explorer/workbookModel.ts:131-198`):
  - it fixes the analysis columns (`:155-166`)
  - it supports year columns only (`:136`)
  - its subtitle knows only actual, planned, forecast and not_available, so published or preliminary data would be labelled "Actual" (`:113-126`)
  - it filters sources by model years only (`:169-181`)
- **Filename outlier:** GDP filenames end in `-ka`/`-en` (`gdpWorkbook.ts:53`); every other workbook adds only `-en`.

Change: generalise `WorkbookExportInput`:
- `columns`: `{ kind: "years"; years }` or `{ kind: "months"; periods }`.
- A basis vocabulary covering `actual`, `planned`, `forecast`, `not_available`, `published`, `preliminary` and `calculated`, each with its subtitle and cell label.
- `numberFormat` and `numericFormats` as explicit inputs.
- An analysis schema supplied by the caller: headers plus a row mapper.
- `sources`, with strategy `byYear`, `bySourceYears` or `byLanguage`.
- Filename rule: the base, then `-en` for English only.

Route the four builders through it and delete their local merging, month rows and picker.

Visible change (intentional): the Georgian GDP workbook filename loses `-ka`. Add GDP to the rule in `tests/browser/bilingual-workbooks.spec.ts:36-45`.

Acceptance:
- Each builder's unit test (`tests/explorer/{gdp,inflation,inflationCategory,economicSectors}Workbook.test.ts`) passes with an identical model, except the GDP filename.
- A new test asserts the subtitle for published and preliminary data is not "Actual".
- Debt, deficit, budget and municipal workbook tests pass unchanged.

## 4. Period range

Evidence:
- **Mirrored module:** `lib/explorer/inflationCategories.ts:139-316` mirrors `lib/explorer/inflationOverview.ts:62-149` (bounds, resolve, tab change, patch, table series; about eight functions), and says so at `:5-6`.
- **Four range-to-state copies:** `components/gdp/gdp-overview.tsx:231-243`, `components/economic-sectors/economic-sectors-explorer.tsx:211-223`, `inflationOverview.ts:102-106`, `inflationCategories.ts:177-181`.
- **Deliberate difference on tab change:**
  - GDP and inflation collapse a range equal to full coverage to "all" (`lib/explorer/gdpOverview.ts:55`, `inflationOverview.ts:98`).
  - Sectors keep a manual range (`lib/explorer/economicSectors.ts:62-63`, pinned by `tests/explorer/economicSectors.test.ts:56-62`).
- **Duplicated source projection:** `lib/pages/inflation.tsx:76-87` and `:123-134`.

Change:
- `lib/explorer/periodRange.ts`, generic over annual and monthly periods: `resolveRange`, `rangeFromPatch`, and `changeTab(state, coverage, { collapseToAll })`, where GDP and inflation pass `true` and sectors `false`.
- `projectArchiveSources()` for the inflation pages.

Acceptance: all existing range and page tests pass unchanged.

## 5. KPI blocks

Evidence:
- **Sectors copy:** `components/economic-sectors/sector-highlights.tsx:50-81` re-inlines `components/main-explorer/kpi-blocks.tsx:9-64`. Its hero shows a separately styled unit that `HeroKpi`'s string `value` cannot carry, and its side cards wrap an "unavailable" detail.
- **Municipal copy:** `components/municipalities/municipal-indicators.tsx:84-137` is an earlier copy that hard-codes `index === 2` for the last card (`:119`).

Change:
- `HeroKpi` gains `unit?: string`, rendered with the sector hero's unit styling.
- `SideKpiList` gains `wrapDetail?: boolean`.
- Both copies adopt the shared blocks; the municipal last-card check becomes "last index".

Acceptance: identical text and class lists in the sectors and municipal route tests.

## 6. Pipeline helpers

Evidence:
- **Manifest readers:** six sha256/size manifest readers — `lib/data/inflation/sourceFiles.ts:38-57`, `lib/data/inflation/basketWeightFiles.ts:39-56`, `lib/data/gdpOverview/prepareGdpOverview.ts:25-32`, `lib/data/economicSectors/prepareEconomicSectors.ts:48-56`, `lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.ts:53-80`, `lib/data/governmentDebt/sourceManifest.ts:57`.
  - None has the path-traversal and symlink checks of `lib/methodology/sourceManifest.ts:126-182`. That reader cannot read package manifests (`lib/factQuery/buildSnapshot.ts:255-260`).
- **CSV serializers:** BOM CSV serializers are repeated, including the byte-identical pair `prepareGeneralGovernmentBalance.ts:117-122` / `lib/data/nationalGdp/prepareNationalGdp.ts:64-69`. Three more are identical one-liners: `lib/data/governmentDebt/importGovernmentDebtFacts.ts:226`, `lib/data/governmentDebt/prepareGovernmentDebtPackage.ts:940`, `lib/data/municipalIndicators/prepareGeostatPackage.ts:556`.
- **Freshness checks:** re-implemented in `prepareEconomicSectors.ts:203-207` and `importGovernmentDebtFacts.ts:237-243` instead of `lib/data/generatedArtifacts.ts:10-19`.

Change:
- `lib/data/sourcePackage.ts` with two functions:
  - `readVerifiedPackageFiles(manifestDir, entries)`: byte size, sha256, and path-traversal and symlink rejection.
  - `serializeBomCsv(headers, rows, { lineEnding })`, with `"\n"` or `"\r\n"` preserved per caller.
- Migrate every site listed above.
- Both freshness checks call `assertGeneratedArtifactMatches`.

Acceptance: `npm run data:validate` passes with every generated artifact byte-identical and nothing regenerated. New unit tests reject `../` paths, symlinks, size mismatches and hash mismatches.

## 7. URL-hash code

Evidence:
- **Private helpers:** `lib/explorer/urlState.ts:39-67` keeps its shared helpers (`parseSharedHashKeys`, `writeSharedHashKeys`) private.
- **Copies in the codecs:** `lib/explorer/debtUrlState.ts:23-61` copies `selectionIds` and the range parsing. Deficit, GDP, sectors and both inflation codecs each hand-roll their parsing. Write effects differ per page; spec 3 aligned their behaviour.

Change:
- Export the shared helpers, with a monthly range variant for the inflation codecs.
- Debt and deficit codecs use them.
- Add one `useHashState({ parse, serialize, history })` hook implementing spec 3's rules: never stamp a pristine URL, replace by default, push only for declared discrete actions.
- All seven explorers adopt the hook. Keys and values are unchanged; spec 3's DESIGN.md §6.3 table stays authoritative.

Acceptance: all seven codec unit tests (`tests/explorer/{urlState,debtUrlState,deficitUrlState,gdpOverview,economicSectors,inflationOverview,inflationCategories}.test.ts`) and spec 3's history tests pass unchanged.

## 8. Small cleanups

- **Nested provider:** `components/gdp/gdp-overview.tsx:204-225` nests a second `I18nProvider` to inject one table label. Pass the label as a prop instead.
- **Literal ink:** replace `#1E1B16` with `INK` (`lib/explorer/colors.ts`) in `gdp-overview.tsx:73` and `lib/explorer/economyHubCards.ts:26`.
- **Hand-formatted billions:** `economyHubCards.ts:26` formats billions by hand. Use the shared format helpers in `lib/explorer/format.ts` (`unitsFor`/`formatInUnit`); the output stays "27.1".

Acceptance: `tests/explorer/economyHub.test.tsx` and the GDP route tests pass unchanged.

## 9. Non-goals

- Municipal page shells.
- Hash key renames.
- New workbook sheets or columns.
- Changing any generated artifact or data value.
- Per-request MCP server construction.

## 10. Verification and acceptance

- Per PR: the targeted tests named in each section while editing, then `npm run check`, `npm run build` and `npm run test:browser` on the production-build recipe. §6 also needs `npm run data:validate` with a clean `git status` afterwards, confirming no artifact was regenerated.
- Series acceptance: the §1 table's duplicates are gone. The only changed test expectation is the GDP workbook filename, and no page, URL, workbook or artifact differs otherwise.

## 11. Authority and next step

This spec owns the bounded decisions in §1 and grants the refactoring approval earlier specs withheld. DESIGN.md is unchanged by this spec. After user review, and after specs 1–3 merge, the next step is an implementation plan at `docs/superpowers/plans/2026-09-17-explorer-consolidation.md`, possibly split per section.
