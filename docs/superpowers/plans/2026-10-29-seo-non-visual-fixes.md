# Fiscal.ge SEO fixes — implementation plan

2026-10-29 · Spec: reviewed SEO audit (see "Spec" below)

## In plain words

This plan fixes four findings from the [reviewed SEO audit](https://claude.ai/artifact/CuJcue4xyShvweAKy6TFMx) in three releases. None of them changes anything a visitor sees: the changes are in what Google and AI tools read.

| Release | Finding | What changes for search engines and AI tools | Time |
| --- | --- | --- | --- |
| 1 | A2 | Every chart page carries its year-by-year table inside the page, hidden until someone presses the table button, exactly as today. | 1 to 1.5 build days |
| 2 | A5 + N2 | About 1,100 town and region pages get titles worded the way people search, such as "ხაშურის მუნიციპალიტეტის მოსახლეობა 2026" or "უმუშევრობა კახეთში 2025". This also fixes the 11 regional descriptions with a grammar slip. | About 1 build day + your proofread |
| 3 | B4 + A3 (first batch) + N1 | The 162 population and demography pages get Dataset labels. Four new data files are published for population, wages, unemployment and social protection (including pensions). The list of files (`manifest.json`) names every file. | About 1 build day |

**What I read your message to mean.** "Low ones" means every finding rated Low or Low–medium in the report. Those are left out, and so is A4. That leaves A2, A5, B4 and A3. A1 and B6 need no code; they are your own tasks, listed at the end. Three tiny issues the reviewers found go along because they sit in the same files (N1, N2). If you also want the cheap Low–medium items that do not change the screen (C3 descriptions, B7 llms.txt wording, B9 IndexNow, B2 hidden city links), they can be a fourth release.

**Approving this plan also approves two scope changes**, because the project rules said "not yet" for both. Demography pages get Dataset labels (decision 5 in the report). Population, wages, unemployment and social protection get data files (decision 2, first batch). There will still be no AI query tools for them. The data files appear only in the Dataset labels, `llms.txt` and the file list, with no new download buttons, because those would change the screen.

**What you will be asked to check.** Before release 2, you proofread a list of the new Georgian titles, in particular the "-ში" forms of the 11 region names. Before each release, I show you evidence that the screen did not change (before and after screenshots) and what Google now sees, and push only after you say go.

## Plan for the build threads

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Copy this plan to `docs/superpowers/plans/2026-10-29-seo-non-visual-fixes.md` on the release branch.

**Goal:** Search engines and AI tools can read each chart's yearly figures, place pages carry search-shaped titles, demography pages carry Dataset labels, and four more topics publish bulk CSV files, with no visible change to any page.

**Architecture:** Release 1 adds one optional prop to the shared `ExplorerTable` and renders a hidden copy of the table in chart mode on 47 explorer components. Release 2 adds one helper for Georgian place-name forms plus new metadata-only title keys. Release 3 extends the existing Dataset vocabulary to demography and the existing `preparePublicDatasets` CSV pipeline to four reviewed CSVs, and lists every side-written CSV in `manifest.json`.

**Tech stack:** Next.js 16 static build, strict TypeScript, Tailwind v4, Vitest, Playwright, schema.org JSON-LD.

**Spec:** the reviewed audit <https://claude.ai/artifact/CuJcue4xyShvweAKy6TFMx> (findings A2, A3, A5, B4, N1, N2; copy in `/mnt/project-files/seo-audit/`), with the reviewers' notes in `/mnt/project-files/seo-audit/reviews/` (A2.txt, A3.txt, A5.txt, B4.txt).

**Reuse (AGENTS.md "Reuse first").** Used as is: `ExplorerTable`, `explorerDatasetJsonLd`, `datasetJsonLd`, `REGION_GENITIVE_KA`, `municipalities.csv` `name_ka`, `serializeBomCsv`, `buildManifestFile`, `npm run seo:measure`. Small additions: an optional `crawlCopy` prop on `ExplorerTable`; optional `officialNameKa` and `selfGoverningCity` on `DemographyPlace`; `demography` in `TopicDatasetId`; four outputs in `preparePublicDatasets`; an extra-files argument to `buildAllPublications`; a `latestYear` member on `RegionAreaFrameConfig`. Genuinely new: `lib/seo/placeTitleForms.ts` (no existing helper derives Georgian place forms for titles; `municipalityBudgetTitleKa` handles only the budget title) and `REGION_LOCATIVE_KA`.

### Out of scope

A4 and every finding rated Low or Low–medium: B1, B2, B3, B5, B7, B8, B9, C1, C2, C3, C4, and N3–N10. Inflation tables (`InflationTable`, `InflationCityTable`, the client-loaded Inflation by product page) are left as they are: inflation is already served as CSV and through MCP. The age-sex pyramid (`PyramidTable`) is left as it is: it shows one date, not a yearly table. Air-quality city titles are left as they are: they name measuring stations, not municipalities. No MCP tool is added.

### Global constraints

- No visible change: in the default state, every page renders pixel-identical to `main` at 390 px and 1280 px.
- A hidden copy is hidden with a stylesheet class (Tailwind `hidden`, `display:none`), never the `hidden` attribute, `aria-hidden` or an inline style.
- The visible H1, breadcrumb labels and Dataset `name` keep their current message keys; only the `<title>` changes in Release 2.
- English pages carry no Georgian, in text or in JSON-LD (`tests/browser/bilingual-seo.spec.ts`).
- A title's year is the latest year of that page's own data, never a hardcoded year (AGENTS.md: derive coverage from loaded facts).
- Planned values stay marked (`basis = planned`) wherever they appear, including the hidden table and the new CSVs.
- Public CSVs are UTF-8 with BOM (`serializeBomCsv`) and drop internal locator columns (`source_sheet`, `source_cell`, `source_number_format`, `source_workbook`).
- `npx vitest run tests/factQuery/reference.test.ts` must pass unchanged in Release 3; a disagreement is a stop condition.
- Data changes update the matching `docs/data-methodology/` file in the same change; scope changes update `Project_Definition.md` section 2.
- Duru sees evidence and says go before any push (project rule).

### Review focus

1. Switching to table mode shows the table once: no visible duplicate, and the hidden copy is gone from the page. Test in Task 2.
2. A heavy page does not balloon: trade partners, the municipal Georgia page and the expenditure page grow by at most 15 KB of raw HTML each. Test in Task 5.
3. Places with unusual names get correct forms: Tbilisi, the self-governing cities (Batumi, Kutaisi, Rustavi, Poti), "რაჭა-ლეჭხუმი და ქვემო სვანეთი" and hyphenated regions, and Georgia itself. Test in Task 6.
4. A place whose data ends earlier than the country's takes its own latest year in the title. Test in Task 8.
5. The new CSVs are stable from run to run, and `--check` in `data:validate` catches a stale file. Test in Task 11.

## Release 1 — Yearly figures in the delivered page (A2)

One branch, one PR. In chart mode, every explorer that switches between chart and table also renders the same `ExplorerTable`, hidden, so the static HTML carries the yearly figures. Pressing "ცხრილი" shows that same table instance, so nothing is duplicated on screen.

### Task 1: `crawlCopy` prop on ExplorerTable

**Files:**

- Modify: `apps/web/components/main-explorer/explorer-table.tsx` (props type, both layout returns)
- Test: `apps/web/tests/explorer/explorerTable.test.tsx`

**Interfaces:**

- Produces: `ExplorerTableProps.crawlCopy?: boolean` (default `false`). When `true`: the outer `@container` div carries the class `hidden`; the scroller's `data-testid` is `explorer-table-crawl` instead of `explorer-table`; the scroller has no `tabIndex`. Everything else (caption, rows, status marks, planned marks) is unchanged.

* [ ] **Step 1: Write the failing tests** in `explorerTable.test.tsx`, rendering the file's existing `georgia`/`adjara`/`imereti` fixture with `crawlCopy`:

```tsx
describe("ExplorerTable crawl copy", () => {
  const crawl = renderGeorgianMarkup(<ExplorerTable {...sameProps} crawlCopy />);
  it("is hidden by a stylesheet class only", () => {
    expect(crawl).toMatch(/<div class="[^"]*\bhidden\b[^"]*"/);
    expect(crawl).not.toMatch(/\shidden(=|\s|>)/);
    expect(crawl).not.toContain("aria-hidden");
    expect(crawl).not.toMatch(/style="[^"]*display/);
  });
  it("keeps every figure and a test id of its own", () => {
    expect(crawl).toContain('data-testid="explorer-table-crawl"');
    expect(crawl).not.toContain('data-testid="explorer-table"');
    expect(crawl).not.toContain("tabindex");
    for (const year of ["2024", "2025"]) expect(crawl).toContain(`>${year}<`);
  });
  it("leaves the visible table unchanged", () => expect(renderGeorgianMarkup(<ExplorerTable {...sameProps} />)).toBe(html));
});
```

- [ ] **Step 2: Run** `npx vitest run tests/explorer/explorerTable.test.tsx` and confirm the new tests fail.
- [ ] **Step 3: Implement** the prop in both layout returns (rows and columns).
- [ ] **Step 4: Run** the same command and confirm everything passes.
- [ ] **Step 5: Commit** `feat(seo): ExplorerTable can render a hidden crawl copy`.

### Task 2: Place-page explorers (about 900 pages)

**Files (modify):** `components/demography/population-place-explorer.tsx`, `components/demography/vital-section.tsx`, `components/demography/marriage-section.tsx`, `components/education/education-place-explorer.tsx`, `components/social/social-place-explorer.tsx`, `components/municipalities/municipal-explorer.tsx`. **Test (create):** `apps/web/tests/browser/crawl-table.spec.ts`.

**Interfaces:** consumes `crawlCopy` from Task 1.

The pattern, the same in every file: the table is rendered in both modes, and the chart only in line mode.

```tsx
// before
: state.mode === "line" ? <div className="mt-5">{chart}</div> : <ExplorerTable {...tableProps} />
// after
: <>{state.mode === "line" ? <div className="mt-5">{chart}</div> : null}<ExplorerTable {...tableProps} crawlCopy={state.mode === "line"} /></>
```

- [ ] **Step 1: Write the failing browser spec** `crawl-table.spec.ts` with one table-driven test per row, run against a built server (CLAUDE.md "Test loop"):

| Path | Raw HTML must contain |
| --- | --- |
| `/explorer/demography/population/khashuri` | `explorer-table-crawl` and `formatInUnit(52692, UNIT_PERSONS)` (Khashuri, 2015) |
| `/en/explorer/education/schools/khashuri` | `explorer-table-crawl` |
| `/explorer/health/pensions/khashuri` | `explorer-table-crawl` |
| `/explorer/municipalities/khashuri` | `explorer-table-crawl` |

Read the raw response with `request.get` and strip `<script>` blocks first, as the existing "raw homepage response" test in `seo.spec.ts` does, so a figure found only in the data payload does not count. A second test per row loads the page, presses the table tab and asserts `getByTestId("explorer-table")` is visible exactly once and `getByTestId("explorer-table-crawl")` has count 0. A third asserts the crawl copy `toBeHidden()` in chart mode.

- [ ] **Step 2: Run** `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/crawl-table.spec.ts` and confirm it fails.
- [ ] **Step 3: Apply the pattern** to the six files.
- [ ] **Step 4: Rebuild, re-serve and re-run** the spec, plus `demography-population.spec.ts`, `education.spec.ts`, `social.spec.ts` and `municipal-entity.spec.ts`. All pass; the existing "no table in chart mode" assertions still pass because they query `explorer-table`.
- [ ] **Step 5: Commit** `feat(seo): place pages carry their yearly table in the HTML`.

### Task 3: Region and area explorers

**Files (modify):** `components/business/business-area-explorer.tsx`, `components/housing/housing-area-explorer.tsx`, `components/internet/internet-area-explorer.tsx`, `components/transport/transport-area-explorer.tsx`, `components/money-banks/money-banks-area-explorer.tsx`, `components/science-culture/museum-area-explorer.tsx`, `components/health/health-deaths-explorer.tsx`, `components/household/household-explorer.tsx`, `components/environment/environment-explorer.tsx`, `components/unemployment/unemployment-explorer.tsx`, `components/wages/wages-explorer.tsx`, `components/regional-economies/regional-economy-explorer.tsx`.

- [ ] **Step 1: Add rows** to `crawl-table.spec.ts`: `/en/explorer/unemployment/regions/imereti` must contain `explorer-table-crawl` and `20.9` (2019 rate); `/explorer/money/regions/imereti` and `/explorer/economy/regions/imereti` must contain `explorer-table-crawl`. Run them and confirm they fail.
- [ ] **Step 2: Apply the Task 2 pattern** to the twelve files.
- [ ] **Step 3: Rebuild and run** `crawl-table.spec.ts` plus the twelve families' existing specs (`business`, `housing`, `internet`, `transport`, `money-banks`, `science-culture`, `health`, `household`, `environment`, `unemployment-regions`, `wages`, `regional-economies`). All pass.
- [ ] **Step 4: Commit** `feat(seo): region pages carry their yearly table in the HTML`.

### Task 4: National explorers and the coverage guard

**Files (modify):** the remaining 29 components with `<ExplorerTable` and a mode switch: `business-explorer`, `crime-explorer`, `debt-explorer`, `deficit-explorer`, `demography-migration`, `marriage-explorer`, `national-vital-charts`, `economic-sectors-explorer`, `education-explorer`, `energy-food-explorer`, `current-account`, `external-position`, `foreign-investment`, `money-from-abroad`, `gdp-overview`, `health-explorer`, `housing-explorer`, `internet-explorer`, `explorer-view`, `money-banks-explorer`, `poverty-explorer`, `science-culture-explorer`, `social-explorer`, `tax-breaks-refunds-explorer`, `trade-overview`, `trade-partners`, `trade-products`, `transport-explorer`, `labour-explorer`. **Test (create):** `apps/web/tests/explorer/crawlTableCoverage.test.ts`.

- [ ] **Step 1: Write the coverage guard**, modelled on `tests/explorer/chartShareCoverage.test.ts`: every file under `components/` that contains both `<ExplorerTable` and `<ModeTabs` must contain `crawlCopy=`. Assert at least 47 such files, so the guard cannot pass on an empty list. Run it and confirm it lists exactly these 29 files as failing.
- [ ] **Step 2: Apply the pattern** to the 29 files. Where a table renders under a `chartMode === "table"` branch with a third state (debt, deficit, explorer-view, gdp-overview), keep the third state as it is and render the crawl copy only in the chart branch.
- [ ] **Step 3: Run** `npx vitest run tests/explorer/crawlTableCoverage.test.ts` and `npm run typecheck`. Both pass.
- [ ] **Step 4: Add rows** `/explorer/expenditure` and `/en/explorer/trade/partners` to `crawl-table.spec.ts`, rebuild, and run the spec plus `main-explorer.spec.ts`, `debt.spec.ts`, `deficit.spec.ts` and `trade*.spec.ts`. All pass.
- [ ] **Step 5: Commit** `feat(seo): national chart pages carry their yearly table in the HTML`.

### Task 5: Page weight and done-check

**Files:** Modify `apps/web/scripts/measure-seo-output.ts` (`AUDITED_ROUTES`) and its test `tests/seo/outputMeasurement.test.ts`.

- [ ] **Step 1: Add** `/explorer/municipalities/georgia`, `/en/explorer/trade/partners` and `/explorer/demography/population/khashuri` to `AUDITED_ROUTES`. Record `npm run seo:measure` on `main` first (the expenditure page is 256,581 bytes, trade partners 872,176 and Khashuri population 272,103), then on the branch.
- [ ] **Step 2: Assert** in `outputMeasurement.test.ts` that the measurement returns a row for each new route. Put the before/after table in the PR body; each route must grow by at most 15 KB raw.
- [ ] **Step 3: Screenshot check.** Capture the six spec pages at 390 px and 1280 px on `main` and on the branch with Playwright `toHaveScreenshot`; they match. Send them to Duru with three raw-HTML excerpts showing the yearly figures.
- [ ] **Step 4: Done-check** (CLAUDE.md): `npm run check`, `npm run build`, the full `npm run test:browser` against one built server. In Search Console's URL inspection, "View crawled page" on Khashuri population after release shows the table text.
- [ ] **Step 5: Commit** `test(seo): measure crawl-copy page weight`, then wait for Duru's go before pushing.

## Release 2 — Place titles worded the way people search (A5, N2)

One branch, one PR, after Release 1 is live. Only `<title>` changes. Headings, breadcrumbs and Dataset names keep their keys.

**Title forms by page family** (Georgian is a draft for Duru's proofread; `{year}` is the page's own latest year):

| Family | Pages (ka) | Georgian | English |
| --- | --- | --- | --- |
| Population | 76 | `{placeOf} მოსახლეობა {year}` | `{place} population {year}` |
| Schools | 76 | `{placeOf} სკოლები {period}` | `Schools in {place} {period}` |
| Kindergartens | 76 | `{placeOf} საბავშვო ბაღები {period}` | `Kindergartens in {place} {period}` |
| Pensions | 76 | `პენსიები {placeIn} {year}` | `Pensions in {place} {year}` |
| Subsistence allowance | 76 | `საარსებო შემწეობა {placeIn} {year}` | `Subsistence allowance in {place} {year}` |
| Unemployment | 11 | `უმუშევრობა {placeIn} {year}` | `Unemployment in {place} {year}` |
| Wages | 11 | `ხელფასები {placeIn} {year}` | `Wages in {place} {year}` |
| Bank loans | 12 | `ბანკების სესხები {placeIn} {year}` | `Bank loans in {place} {year}` |
| Business | 12 | `ბიზნესი {placeIn} {year}` | `Business in {place} {year}` |
| Housing | 12 | `საცხოვრებელი და მშენებლობა {placeIn} {year}` | `Housing and construction in {place} {year}` |
| Home internet | 12 | `სახლის ინტერნეტი {placeIn} {year}` | `Home internet in {place} {year}` |
| Transport | 12 | `ტრანსპორტი {placeIn} {year}` | `Transport in {place} {year}` |
| Household income | 12 | `შინამეურნეობების შემოსავლები {placeIn} {year}` | `Household income in {place} {year}` |
| Household spending | 12 | `შინამეურნეობების ხარჯები {placeIn} {year}` | `Household spending in {place} {year}` |
| Causes of death | 12 | `სიკვდილის მიზეზები {placeIn} {year}` | `Causes of death in {place} {year}` |
| Museums | 12 | `{placeOf} მუზეუმები {year}` | `Museums in {place} {year}` |
| Waste | 12 | `{placeOf} ნარჩენები {year}` | `Waste in {place} {year}` |
| Forests | 12 | `{placeOf} ტყეები {year}` | `Forests in {place} {year}` |
| Regional economy | 11 | `{placeOf} ეკონომიკა {year}` | `{place} economy {year}` |

Municipal budget titles already follow this pattern and stay as they are.

### Task 6: Georgian place forms for titles

**Files:**

- Create: `apps/web/lib/seo/placeTitleForms.ts`
- Modify: `apps/web/lib/explorer/municipalLabels.ts` (add `REGION_LOCATIVE_KA` beside `REGION_GENITIVE_KA`, same comment style)
- Modify: `apps/web/lib/explorer/demographyAreas.ts` (`DemographyPlace` gains optional `officialNameKa` and `selfGoverningCity`, filled in `buildDemographyPlaces` from the municipality rows' `name_ka` and `is_self_governing_city`)
- Test: `apps/web/tests/seo/placeTitleForms.test.ts`

**Interfaces (produces):**

```ts
export type TitlePlace = Pick<DemographyPlace, "id" | "level" | "nameKa" | "nameEn"> & { officialNameKa?: string; selfGoverningCity?: boolean };
export function placeOfKa(place: TitlePlace): string;         // genitive: ხაშურის მუნიციპალიტეტის, ბათუმის, კახეთის, საქართველოს
export function placeInKa(place: TitlePlace): string;         // "-ში": ხაშურის მუნიციპალიტეტში, ბათუმში, კახეთში, საქართველოში
export function placeTitleNameEn(place: TitlePlace): string;  // Khashuri Municipality, Batumi, Kakheti, Georgia
export function latestYearOf<T extends { year: number }>(facts: readonly T[], keep: (fact: T) => boolean): number; // throws when nothing is kept
```

Rules: Georgia is fixed text. A region reads `REGION_GENITIVE_KA` / `REGION_LOCATIVE_KA` and throws when the id is missing. Tbilisi is the region `region.tbilisi`. A self-governing city takes its genitive from the official name ("ქალაქ ბათუმის მუნიციპალიტეტი" gives "ბათუმის"), and its "-ში" form from the display name with the final ი replaced by ში. Any other municipality uses its official name, + ს for the genitive, and the final ი replaced by ში for "-ში". An official name that does not end in მუნიციპალიტეტი throws, as `municipalityBudgetTitleKa` already does. Draft `REGION_LOCATIVE_KA`: თბილისში, აჭარაში, გურიაში, იმერეთში, კახეთში, მცხეთა-მთიანეთში, რაჭა-ლეჭხუმსა და ქვემო სვანეთში, სამეგრელო-ზემო სვანეთში, სამცხე-ჯავახეთში, ქვემო ქართლში, შიდა ქართლში.

- [ ] **Step 1: Write the failing tests:**
  - Khashuri (`47`) gives `ხაშურის მუნიციპალიტეტის`, `ხაშურის მუნიციპალიტეტში` and `Khashuri Municipality`.
  - Batumi (`06`) gives `ბათუმის`, `ბათუმში` and `Batumi`.
  - `region.tbilisi` gives `თბილისის` and `თბილისში`.
  - `region.racha_lechkhumi_kvemo_svaneti` gives `რაჭა-ლეჭხუმისა და ქვემო სვანეთის` and `რაჭა-ლეჭხუმსა და ქვემო სვანეთში`.
  - Georgia gives `საქართველოს`, `საქართველოში` and `Georgia`.
  - Every region in `REGIONAL_ECONOMY_REGIONS` has both forms.
  - Every row of `data/imports/municipalities.csv` yields forms that differ from its display name.
  - The official name `ხაშური` throws.
  - `latestYearOf([{year:2023,a:"x"},{year:2025,a:"y"}], f => f.a === "x")` is `2023`.
- [ ] **Step 2: Run** `npx vitest run tests/seo/placeTitleForms.test.ts` and confirm it fails.
- [ ] **Step 3: Implement** `placeTitleForms.ts`, `REGION_LOCATIVE_KA` and the two optional `DemographyPlace` fields.
- [ ] **Step 4: Run** the test and `npm run typecheck`; both pass.
- [ ] **Step 5: Commit** `feat(seo): Georgian place forms for page titles`.

### Task 7: Municipal place families

**Files (modify):** `lib/pages/demography-population-place.tsx` (`populationPlaceMetadata`), `lib/pages/education-places.tsx`, `lib/pages/social-places.tsx`; new keys in `lib/i18n/messages/{ka,en}/demography.json` (`demography.placeSeoTitle`), `education.json` (`education.place.seoTitle.schools`, `.kindergartens`), `social.json` (`social.place.seoTitle.pensions`, `.subsistence-allowance`). **Test (create):** `apps/web/tests/seo/placeTitles.test.ts`.

**Interfaces:** consumes `placeOfKa`, `placeInKa`, `placeTitleNameEn` and `latestYearOf` from Task 6. The year is `latestYearOf(facts, fact => fact is this place)`. Schools and kindergartens use the page's own period label for that year (the one the table header shows, such as `2025–26`).

- [ ] **Step 1: Write failing tests** that call the three metadata functions:
  - Khashuri population, ka: `ხაშურის მუნიციპალიტეტის მოსახლეობა 2026 | Fiscal.ge`.
  - Khashuri population, en: `Khashuri Municipality population 2026 | Fiscal.ge`.
  - Kutaisi population, ka: `ქუთაისის მოსახლეობა 2026 | Fiscal.ge`.
  - Georgia population, ka: `საქართველოს მოსახლეობა 2026 | Fiscal.ge`.
  - Khashuri pensions, ka: matches `/^პენსიები ხაშურის მუნიციპალიტეტში \d{4} \| Fiscal\.ge$/`.
  - Akhalkalaki schools, ka: matches `/^ახალქალაქის მუნიციპალიტეტის სკოლები \d{4}–\d{2} \| Fiscal\.ge$/`.
  - Every English title contains no Georgian letter (`/[Ⴀ-ჿ]/`).
- [ ] **Step 2: Run** `npx vitest run tests/seo/placeTitles.test.ts` and confirm it fails.
- [ ] **Step 3: Implement** the new keys and switch the three metadata functions to them. The page body keeps `placeMetaTitle`, `education.place.metaTitle` and `social.place.metaTitle`.
- [ ] **Step 4: Run** the test, `npm run i18n:check` and the tests that pinned the old titles (`grep -rln "— მოსახლეობა\|placeMetaTitle" tests`). Update only title expectations, never heading ones.
- [ ] **Step 5: Commit** `feat(seo): search-shaped titles for municipal place pages`.

### Task 8: Region-only families and the regional description (N2)

**Files (modify):** `lib/pages/region-area-frame.tsx` (`RegionAreaFrameConfig` gains `latestYear(facts: Fact[], area: Area): number`; `areaPageMetadata` loads `config.load()` and uses `${hub}.page.area.seoTitle`), the four frame users `lib/pages/{housing,transport,internet,money-banks-regions}-shared.tsx`, plus `lib/pages/business-regions.tsx`, `health-deaths.tsx`, `household.tsx`, `science-culture-shared.tsx`, `environment-areas.tsx`, `unemployment-regions.tsx`, `wages.tsx` and `regional-economy.tsx`, with the matching `seoTitle` keys in `lib/i18n/messages/{ka,en}/*.json`. In `regional-economy.tsx` the title moves to a new `regionalEconomies.detailSeoTitle`. `detailMetaTitle` stays as the Dataset name. **N2:** `regionalEconomies.detailMetaDescription` (ka) takes `{regionOf}` = `placeOfKa(region)`, so it reads "გაეცანით თბილისის მშპ-სა…". The English text is unchanged. **Test (create):** `apps/web/tests/seo/regionPlaceTitles.test.ts`.

- [ ] **Step 1: Write failing tests:**
  - Kakheti unemployment, ka: `უმუშევრობა კახეთში {latest} | Fiscal.ge`.
  - Samegrelo bank loans, ka: `ბანკების სესხები სამეგრელო-ზემო სვანეთში {latest} | Fiscal.ge`.
  - Imereti economy, ka: `იმერეთის ეკონომიკა 2024 | Fiscal.ge`.
  - The Georgia area page of housing, ka, contains `საქართველოში`.
  - The Tbilisi economy description contains `გაეცანით თბილისის მშპ-სა`.
  - A frame configured with facts where one area ends in 2023 titles that area 2023 (Review focus 4).
  - `{latest}` is computed in the test from the same loader.
- [ ] **Step 2: Run** the test and confirm it fails.
- [ ] **Step 3: Implement** the keys and the metadata changes in the twelve files.
- [ ] **Step 4: Run** the test, `npm run i18n:check`, `npm run typecheck` and the tests that pinned old region titles (`grep -rln "regionTitle\|— თბილისი" tests`). Update title expectations only.
- [ ] **Step 5: Commit** `feat(seo): search-shaped titles for region pages`.

### Task 9: Proofread, sitemap-wide check, done-check

**Files:** Modify `apps/web/tests/browser/seo.spec.ts`.

- [ ] **Step 1: Add a browser test** that reads `/sitemap.xml`, requests every `/explorer/**` and `/en/explorer/**` URL with four or more path segments, and asserts every `<title>` is unique. Titles of the families in the table above must not contain " — ", and English titles must contain no Georgian letter.
- [ ] **Step 2: Build, serve and run** `seo.spec.ts`, `bilingual-seo.spec.ts` and `crawl-table.spec.ts`. All pass.
- [ ] **Step 3: Write the proofread list** `/mnt/project-files/seo-fixes/place-titles-for-proofread.md`. It holds one example title per family and language, and all 11 regions in both Georgian forms. Send it to Duru and apply their corrections to `REGION_LOCATIVE_KA` and the message keys. Re-run Steps 1–2 after any change.
- [ ] **Step 4: Done-check:** `npm run check`, `npm run build` and the full `npm run test:browser`. Screenshots at 390 px and 1280 px of three place pages match `main` (only the browser tab title differs).
- [ ] **Step 5: Commit** `test(seo): place titles are unique and search-shaped`, then wait for Duru's go before pushing.

## Release 3 — Demography Dataset labels and four data files (B4, A3 first batch, N1)

One branch, one PR, after Release 2 is live. Both parts lift a recorded "not yet", so the scope documents change first, in the same PR.

### Task 10: Scope documents and the demography vocabulary

**Files:**

- Modify: `Project_Definition.md` section 2. In the demography line, "The section has no MCP tool, bulk file or Dataset markup yet." becomes "Every page carries Dataset markup and the population figures are published as `/downloads/data/population.csv`; the section has no MCP tool." Make the same change wherever section 2 says wages, unemployment or social protection have no bulk file (`grep -n "bulk file" Project_Definition.md`).
- Modify: `docs/data-methodology/demography.md` (the "No MCP tool, bulk download, Dataset markup … is approved" sentence) and `docs/superpowers/specs/2026-10-04-demography-section-design.md` §10. Add a dated amendment line rather than rewriting the spec.
- Modify: `apps/web/lib/seo/datasetVocabulary.ts`. Drop `"demography"` from the `Exclude<…>` in `TopicDatasetId`, and add `TOPIC_DATASETS.demography`. Keywords en: Georgia, population, demography, migration, births, deaths, marriages; ka: the same words in Georgian, for Duru's proofread. `measurementTechnique`: Geostat's 1 January population estimates, the 2024 census and registered births, deaths, marriages, divorces and border crossings. `sources: ["geostat"]`.
- Test: `apps/web/tests/seo/datasetVocabulary.enums.test.ts` (and the vocabulary test beside it).

* [ ] **Step 1: Write a failing test** that `datasetVocabulary("demography", "en")` returns the keywords above and Geostat as the source, and that its `ka` strings contain Georgian letters while its `en` strings contain none.
* [ ] **Step 2: Run it** and confirm it fails. Implement. Run it plus `npm run typecheck`; both pass.
* [ ] **Step 3: Commit** `docs(scope): demography gets Dataset markup and a population file`, then `feat(seo): demography Dataset vocabulary`.

### Task 11: Dataset labels on the demography pages (B4)

**Files (modify):**

- `lib/pages/demography-population.tsx`: the index is the parent dataset.
- `lib/pages/demography-population-place.tsx`: `partOf` the index, `spatialCoverageName` = `placeLabel(place, locale)`, `withinGeorgia` except for Georgia. Follow the pattern in `lib/pages/wages.tsx` lines 56–60.
- `lib/pages/demography-age-sex.tsx`, `demography-births-deaths.tsx`, `demography-migration.tsx`, `demography-marriages-divorces.tsx`.
- `lib/pages/methodology-article.tsx`: remove the demography skip at lines 277–278.
- `lib/pages/methodology.tsx`: remove the `entry.id !== "demography"` filter from the DataCatalog.

Each page uses `explorerDatasetJsonLd` with `datasetId: "demography"`. `name` is the page's existing title message, `description` its existing meta description (50 characters or more), and `variableMeasured` the series labels the page shows.

- [ ] **Step 1: Turn the absence tests into presence tests:**
  - `tests/explorer/demographyPages.test.tsx` and `tests/explorer/populationPlacePages.test.tsx`: every demography page, ka and en, renders `explorer-dataset-json-ld` with `@type` `Dataset`. Khashuri's node has `isPartOf.url` ending `/explorer/demography/population` and `spatialCoverage.name` `ხაშური` / `Khashuri`.
  - `tests/methodology/methodologyArticle.test.tsx`: `/methodology/demography` carries `dataset-json-ld`.
  - `tests/seo/structuredData.test.ts` (line 656 onward): remove the demography exemption.
  - `tests/browser/demography-population.spec.ts`, `demography-migration.spec.ts` and `methodology.spec.ts`: flip their "no Dataset" assertions.
  - Keep the assertion that no demography page except the population index emits a `downloadPath` (Task 13 adds that one).
- [ ] **Step 2: Run** `npx vitest run tests/explorer/demographyPages.test.tsx tests/explorer/populationPlacePages.test.tsx tests/methodology/methodologyArticle.test.tsx tests/seo/structuredData.test.ts` and confirm they fail.
- [ ] **Step 3: Implement** the labels on the six pages, the methodology article and the catalog.
- [ ] **Step 4: Run** the same command, then build and run the three browser specs plus `bilingual-seo.spec.ts` (no Georgian in English JSON-LD). All pass.
- [ ] **Step 5: Commit** `feat(seo): demography pages carry Dataset labels`.

### Task 12: Four public CSV files (A3, first batch)

**Files:**

- Modify: `apps/web/lib/data/publicDatasetExports.ts`. `PublicDatasetId` gains `"population" | "wages" | "unemployment" | "social-protection"`. Add four outputs written by `serializeBomCsv`, sorted by `byYearAndId`.
- Modify: `docs/data-methodology/demography.md`, `wages-annual.md`, `unemployment-annual.md` and `social-protection-annual.md`. Each gets a "Bulk file" paragraph with the file name, columns, row count and what is left out.
- Test: `apps/web/tests/data/publicDatasetExports.test.ts`.

**Interfaces (produces):** `PUBLIC_DATASET_FILE_NAMES: readonly string[]`, every CSV this module writes (5 existing + 4 new), exported for Task 13.

| File | From (`data/imports/`) | Columns, in order | Rows |
| --- | --- | --- | --- |
| `population.csv` | `demography-population-annual.csv` | series\_id, geography\_id, year, value, unit, estimate\_basis, status, source\_id, source\_locator, last\_reviewed\_at | the rows the population pages serve |
| `wages.csv` | `wages-annual.csv` | year, indicator\_id, dimension, group\_id, sector\_id, value, published\_value, unit, basis, value\_status, source\_id, last\_reviewed\_at | the rows `loadServedWagesData` serves |
| `unemployment.csv` | `unemployment-annual.csv`, `-education-`, `-employment-status-`, `-long-term-annual.csv` | year, frequency, dimension, group\_id, group\_label\_en, indicator\_id, sex, unit, value, published\_value, basis, value\_status, methodology\_epoch, role, source\_id | the served rows of all four; `sex` is blank where a file has none |
| `social-protection.csv` | `social-protection-annual.csv` | year, indicator\_id, geography\_id, value, unit, months, basis, value\_status, source\_id, last\_reviewed\_at | the served rows only: discontinued series stay archived in the reviewed CSV, not published |

- [ ] **Step 1: Write failing tests** for each new file:
  - It starts with a BOM, its header equals the columns above, and it has no `source_sheet`, `source_cell`, `source_workbook` or `source_number_format` column.
  - Its row count equals the served loader's count.
  - `population.csv` has the row `demography.population_total,47,2015,52692,…`.
  - Two runs produce identical bytes.
  - Changing one byte on disk makes `--check-output` report `content differs` (Review focus 5).
- [ ] **Step 2: Run** `npx vitest run tests/data/publicDatasetExports.test.ts` and confirm it fails.
- [ ] **Step 3: Implement** the four outputs and `PUBLIC_DATASET_FILE_NAMES`, and write the four methodology paragraphs.
- [ ] **Step 4: Run** the test, then `npm run data:prepare-public-datasets` and `npm run data:validate`. Both pass.
- [ ] **Step 5: Commit** `feat(data): publish population, wages, unemployment and social-protection CSVs`.

### Task 13: Download links in Dataset labels, a complete manifest (N1), llms.txt

**Files:**

- Modify: `lib/pages/demography-population.tsx`, `lib/pages/wages.tsx`, `lib/pages/unemployment.tsx` and `lib/pages/social.tsx`. The national pages get `downloadPath` (`/downloads/data/population.csv`, `wages.csv`, `unemployment.csv`, `social-protection.csv`). Place and region pages keep `partOf` and get none.
- Modify: `lib/factQuery/publications.ts`. The signature becomes `buildAllPublications(snapshot, sideFiles: readonly PublicationArtifact[] = [])`, and `buildManifestFile` lists `sideFiles` after the snapshot artifacts.
- Modify: `scripts/prepare-fact-query-publications.ts`. Read every name in `PUBLIC_DATASET_FILE_NAMES`, plus `inflation-cpi-national.csv`, from `OUTPUT_DIR` (written earlier in `prebuild`). The `rowCount` is the number of data lines. A missing file stops the step with its name.
- Modify: `public/llms.txt`. The unemployment, wages, population and social-protection lines change from "Browse-only: there is no MCP tool and no bulk file" to "Bulk file: [… CSV](https://fiscal.ge/downloads/data/….csv); there is no MCP tool". Add the four files to the bulk-file list beside the data manifest line.
- Methodology pages keep `DATASET_DOWNLOADS` `null` for these four. A value there would add a visible download link, which is a screen change and out of scope.
- Test: `tests/factQuery/publications.test.ts` (or the file that covers `buildManifestFile`), `tests/seo/agentFiles.test.ts`, `tests/browser/seo.spec.ts` (the "explorer datasets publish … CSV distributions" test at line 112).

* [ ] **Step 1: Write failing tests:**
  - The manifest built with two side files lists them with `mediaType` `text/csv` and the right `sha256`.
  - `agentFiles.test.ts` expects the four new links, and no "no bulk file" phrase on those four lines.
  - The browser test checks the four national pages' Dataset `distribution[0].contentUrl` answers 200 with `text/csv`.
* [ ] **Step 2: Run** the unit tests and confirm they fail.
* [ ] **Step 3: Implement.**
* [ ] **Step 4: Run** `npx vitest run tests/factQuery/reference.test.ts`. It must pass unchanged; a disagreement is a stop condition, so report it and do not edit the expectation. Then run the unit tests, `npm run build` (the manifest now names about 39 files instead of 22), `npm run data:check-fact-query-publications` and `seo.spec.ts`. All pass.
* [ ] **Step 5: Done-check:** `npm run check`, `npm run build` and the full `npm run test:browser`. Commit `feat(seo): Dataset labels link the new CSVs; manifest lists every file`, then wait for Duru's go before pushing.

## Delivery and your own tasks

**Order.** Release 1, then 2, then 3, each merged only after the previous one is live (the project's one-release-at-a-time rule). Each release follows the same steps:

1. The build thread finishes the tasks and the done-check.
2. You get the evidence: before and after screenshots that match, raw-HTML excerpts or the title list, and for Release 2 the proofread list.
3. After your go: push the branch, open a draft PR, wait for green CI, then merge.
4. Check it is live: production URLs fetched and the deployed commit confirmed; for Release 1 also Search Console's "View crawled page" on Khashuri population.

About 3 to 3.5 build days in all.

**Overlap with the MCP fixes.** The separate MCP-audit plan (`docs/superpowers/plans/2026-10-29-mcp-audit-fixes.md`) also edits `lib/factQuery/` and bumps the data schema to 1.7.0. Release 3 touches `lib/factQuery/publications.ts`. Whichever merges second brings `main` in and re-runs the reference fixture and `data:check-fact-query-publications` before its PR.

**How to run it.** I recommend one build thread doing the tasks itself, with one fresh reviewer checking the whole branch before each PR. Most tasks repeat one small pattern across many files, and the tests pin each one, so a reviewer per task would add cost without catching much. The alternative is a fresh helper plus a reviewer for every task: more thorough, roughly twice the cost.

**Your tasks (no code, from the report):**

- [ ] A1 (10 minutes). In Search Console, check that the property type is "Domain". If it is not, add it, with the TXT record in Cloudflare. Confirm the sitemap shows "Success" with about 1,556 pages, and send me a screenshot of the Pages report.
- [ ] A1. In Bing Webmaster Tools, choose "Import from Google Search Console" and check that the sitemap is processed.
- [ ] A1. In Cloudflare, keep fiscal.ge on "DNS only" (grey cloud).
- [ ] B6 (ongoing). Contact ISET-PI, IDFI/datalab.ge, Transparency International Georgia, FactCheck.ge and Georgia Today. Tell me which official Fiscal.ge profiles you control, for the organisation label.

**Self-review of this plan.** Each finding maps to tasks: A2 to Tasks 1–5, A5 to Tasks 6–9, N2 to Task 8, B4 to Tasks 10–11, A3's first batch to Tasks 12–13, and N1 to Task 13. Names are consistent across tasks: `crawlCopy`, `placeOfKa`, `placeInKa`, `placeTitleNameEn`, `latestYearOf`, `PUBLIC_DATASET_FILE_NAMES`. Each of the five Review focus items has a test in the task named beside it.
