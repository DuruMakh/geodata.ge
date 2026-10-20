# Pensions and Social Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four bilingual pages to the Health and social protection hub, serving about 14,000 reviewed Social Service Agency (SSA) values for 2013–2025:

- Social payments;
- Pensions, as an index map plus 75 place pages;
- Subsistence allowance, as an index map plus 75 place pages;
- Social package.

Alongside them comes `/methodology/social-protection`.

**Architecture:** The data pipeline follows Education (merge `a8ac0083`; `git show a8ac0083 --stat -m --first-parent` lists every shared file it touched):

- the research package already committed at `docs/Raw Data/Social/ssa-statistics/`;
- a TypeScript prepare/check step writing one canonical CSV;
- a loader with CSV/DB parity and a private Prisma mirror table.

The index maps and place pages copy Education's Schools pages:

- `lib/pages/education-places.tsx`, `lib/explorer/educationPlaces.ts`, `educationIndex.ts` and `components/education/education-place-explorer.tsx`;
- `placePageHref`, `placeHrefById`, `placePagePaths` and `placeNeighbours` from `demographyPlaceRoutes.ts`;
- `unitList.ts` with `groupOf`.

Social payments and Social package follow Education's topic pages (`components/education/education-explorer.tsx`). The share of residents, the value at 2025 prices and the % of GDP are computed in the page model from facts the site already serves, as Crime's per-100,000 rate (`lib/explorer/crime.ts:40-60`) and Money and banks' % of GDP (`lib/explorer/moneyBanks.ts:75`) are. Such a value is marked `calculated`.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase, Vitest, Playwright, Python 3 stdlib (research package), Node (independent verifier).

**Spec:** `docs/superpowers/specs/2026-10-20-social-protection-design.md` (approved by Duru on 2026-10-20, "yes", 11:28 Tbilisi).

**Branch:** `claude/project-thread-aa1to5`, from `origin/main` at `a8ac0083`. It already carries the research sources (`3785aed5`) and the spec (`9e654a78`).

## Global Constraints

- **Page text.** Under each heading, only the one-line `LatestValueLine`, which must fit one line at 390 px. Under the chart, only one `SourceNote` line.
- **Switches.** No tab rows. The only icon switch is Social payments' million GEL / % of GDP. It reuses Money and banks' `ChartPie` share-of-GDP option.
- **Series list.** Every row is visible from the start under small `FlatSeriesPanel` headings, with no caret-nested rows.
- **One heading at a time.** Ticking a row under another heading replaces the selection (`unitList.ts` with `groupOf` = the row's heading). This applies on place pages and on Social package.
- **Defaults.** The default stays first, selectable and removable. Selection is unlimited, and search never scopes the bulk action or the count.

  | Page | Default series |
  | --- | --- |
  | Social payments | `social.payments.total.amount` |
  | Pensions places | `social.pension.recipients` |
  | Subsistence places | `social.subsistence.families` |
  | Social package | `social.social_package.total.recipients` |

- **Years.** 2013–2025. No 2026 row is ever written.
  - High-mountain series start in 2016, war participants in 2019, the disability severity rows in 2017 and the employment programme rows in 2022.
  - Shares of residents run from 2014.
- **Yearly rule:**
  - people and families: SSA's December count (`official`);
  - money: the sum of 12 monthly "amount transferred" cells (`calculated`);
  - average per month: money ÷ the sum of the monthly counts (`calculated`);
  - All programmes: the sum of its programme rows (`calculated`);
  - social package disability 2025: the sum of four printed totals (`calculated`).
  - People are never summed across programmes.
- **Page-model values**, each marked `calculated` and with no canonical row:
  - **share of residents** = December count ÷ `demography.population_total` on 1 January of year+1 × 100, to one decimal;
  - **at 2025 prices** = average × (mean of 2025's 12 monthly `cpi.headline` `index_2010` ÷ the same mean for the year), to two decimals;
  - **% of GDP** = money ÷ the served nominal GDP × 100, to two decimals.
  - A missing divisor means a gap.
- **Areas.** Region and Georgia values are SSA's printed subtotal and total rows, never sums by fiscal.ge.
  - Tbilisi is `region.tbilisi` only. SSA's `04` row is dropped after asserting that it equals the region row.
  - Akhalgori and Upper Abkhazia are kept as `unit.akhalgori` and `unit.upper_abkhazia`, never drawn and given no page.
  - Codes 05, 42, 43, 46 and 64 stay excluded.
- **IDs.** Stable lowercase ASCII IDs `social.{programme}.{measure}` plus a `geography_id` (`country.georgia`, `region.<id>`, a two-digit code, or `unit.*`).
- **Files.** The canonical CSV is UTF-8 with BOM. The methodology bundle must not pull `docs/Raw Data/Social` (219 MB; PR #170 rule). No MCP tools or central publications, and the fact-query snapshot must not include SSA sources.
- **Review before pushing.**
  - Commit locally. Pushing the branch without a PR is allowed only for the Task 10 preview.
  - Full gates and the PR come only after Duru's OK (Task 12).
  - Times told to Duru are in Tbilisi time (UTC+4).

## Review Focus

1. **A partial year or a blank month.**
   - Workplace-injury 2013 has 9 money months, and COVID-19 has 6 months in each of 2020 and 2021. Their sums are served with `months` < 12, and the table marks them.
   - March 2020's blank national count for the electricity programmes stays blank, and its average uses only months with both values.
   - Owner: Task 1 (`test_partial_months`) and Task 4.
2. **A saved link that mixes headings.** On a place page, `#sel=social.pension.recipients,social.pension.amount` keeps only the first heading, and the range refits. Owner: Task 4.
3. **Share of residents at the edges.**
   - 2013 has no share, because 1 January 2014 population is not served.
   - `unit.*` areas have no share.
   - Tbilisi uses `region.tbilisi` population.
   - Owner: Task 4.
4. **The 2022 and 2025 counting changes.** Subsistence families and people draw a "new counting" rule at 2022, and Social package other groups and disability draw one at 2025. The table marks those years. Owner: Task 4 and Task 8 (browser).
5. **Language switch, place picker and previous/next links** keep the range, selection and chart/table mode. Tbilisi from either map opens `region/tbilisi`. Owner: Task 8 (browser).

---

### Task 1: Research package additions

**Files:**
- Modify:
  - `docs/Raw Data/Social/ssa-statistics/prepare.py`
  - `test_validation.py`
  - `verify_independent.mjs`
  - `README.md`
- Generated:
  - the package CSVs and reports;
  - new `ssa-served-annual.csv`.

**Interfaces:**
- Produces: `ssa-served-annual.csv` with columns:

  ```
  programme,measure,geography_id,year,value,months,value_status,source_table,source_workbook,source_sheet,source_cell
  ```

  - `programme`: one of `pension`, `pension_idp`, `pension_highmountain`, `subsistence_allowance`, `tsa_registered`, `social_package`, `social_package_highmountain`, or one of the other national programmes in spec §4 (the package's existing programme ids), plus `social_package_group`.
  - `measure`: one of `recipients`, `persons`, `employment_families`, `amount`, `employment_amount`, `regular_amount`, `regular_count_months_sum`, `count_months_sum`, `group.<group>.recipients`, `group.<group>.amount`.
  - `source_cell`: for a December count, the cell on the December sheet (e.g. `B12`). For a sum, the column and row with `*` for "every monthly sheet" (e.g. `D12`, sheet `*`).
  - Social package groups: `total`, `disability`, `disability_children`, `disability_severe`, `disability_significant`, `disability_moderate`, `survivors`, `war_participants`, `political_repression`, `other`, mapped from the column labels listed by spec §7. `other` is the sum of the remaining columns, and `disability` 2025 is the sum of the four disability `/ სულ` columns. Both are `calculated`.
- Scope: national programmes for every programme. Areas only for `pension`, `pension_idp`, `pension_highmountain`, `subsistence_allowance` and `tsa_registered`. Years 2013–2025.

- [ ] **Step 1: Add tests to `test_validation.py`:**
  - `test_tsa_registered`: registered families `country.georgia` 2025 = `397144` and 2013 = `524482`. Every mapped municipality has a 2025 row, and the municipal rows plus `unit.*` sum to Georgia, except differences recorded in `source-findings.csv`.
  - `test_served_anchors`: the twelve anchor values of spec §8, by `(programme, measure, geography_id, year)`.
  - `test_partial_months`: `workplace_injury` 2013 amount has `months=9`, and `covid_vulnerable_compensation` 2020 and 2021 have `months=6`. No served row has year 2026 or < 2013.
  - `test_tbilisi`: no `04` row is served. `region.tbilisi` equals the source's `04` row for every programme and year.
  - `test_social_package_groups`: the groups (without `total`, counting `other` and the disability parts once) sum to `total` every year, and 2025 `disability` = 18819+32151+73514+5998.
  - `test_cells`: for 20 random served rows, re-reading `source_workbook!source_sheet!source_cell` (every monthly sheet for `*`) reproduces `value`.
- [ ] **Step 2: Run** `cd "docs/Raw Data/Social/ssa-statistics" && python3 -B -m unittest test_validation -v`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement in `prepare.py`:**
  - a `tsa_db-01` December reader by area, reusing `area_rows` and `area-mapping.csv` (columns: registered families, registered persons);
  - a social package group reader over `socpackage-01` and `socpackage-02`;
  - a writer for `ssa-served-annual.csv`, keeping each value's sheet and cell;
  - entries in `validate`.

  `--check` must cover the new file.
- [ ] **Step 4: Extend `verify_independent.mjs`** to recompute every `ssa-served-annual.csv` row from the workbooks.
- [ ] **Step 5: Run:**

  ```
  python3 -B prepare.py && node verify_independent.mjs --write && python3 -B -m unittest discover -p "test_*.py" && python3 -B prepare.py --check
  ```

  Expected: all PASS, with `"status": "passed"` in both reports.
- [ ] **Step 6:** Add a README section "Served file". Commit `feat(data): extract served SSA social protection values`.

### Task 2: Canonical serving file

**Files:**
- Create:
  - `apps/web/lib/data/social/types.ts`
  - `apps/web/lib/data/social/validation.ts`
  - `apps/web/lib/data/social/prepareSocial.ts`
  - `apps/web/scripts/prepare-social.ts`
  - `apps/web/tests/data/social/social.test.ts`
  - `data/mappings/social/areas.csv` (`source_id,geography_id,mapping_note,reviewed_at`): the package's area ids mapped to site geography ids.
- Generated:
  - `data/imports/social-protection-annual.csv`
  - `data/imports/social-protection-series-breaks.csv`
  - `data/reports/social-protection-validation.json`
- Modify: `apps/web/package.json` (`data:prepare-social`, `data:check-social`) and `apps/web/scripts/validate-all.ts` (beside `data:check-education`).

**Interfaces:**
- Produces (`types.ts`):
  - `SOCIAL_INDICATORS`, as a const list of every served indicator, and `SocialIndicator`. Each indicator id is `social.{programme}.{measure}`, for example `social.pension.recipients`, `social.pension.amount`, `social.pension.avg_monthly`, `social.subsistence.families`, `social.subsistence.persons`, `social.subsistence.employment_families`, `social.subsistence.registered_families`, `social.subsistence.registered_persons`, `social.subsistence.amount`, `social.subsistence.employment_amount`, `social.subsistence.avg_monthly`, `social.social_package.<group>.recipients|amount`, `social.social_package.total.avg_monthly`, `social.payments.<programme>.amount` and `social.payments.total.amount`.
  - `SOCIAL_SOURCES` and `SOCIAL_PUBLIC_SOURCES`.
  - `SocialFact`:

    ```ts
    { year; indicatorId; geographyId; value: string; unit: "persons" | "families" | "gel" | "gel_million"; months: number; basis: "actual"; valueStatus: "official" | "calculated"; sourceId; sourceWorkbook; sourceSheet; sourceCell; lastReviewedAt }
    ```

    Money is stored in GEL as summed (`gel`). Averages are `gel` to two decimals.
  - `ClientSocialFact = Pick<…, "year" | "indicatorId" | "geographyId" | "sourceId" | "months" | "valueStatus"> & { value: number }`.
  - `socialFactKey`.
- Produces (`validation.ts`): `expectedSocialKeys()` and `validateSocialFacts(facts): void`. The validation covers:
  - identity, coverage, duplicates and the source contract, as Education;
  - region equals its parts with the recorded findings;
  - Social package groups equal the total;
  - `payments.total` equals the sum of the programme rows;
  - average = amount ÷ count-months sum, to two decimals;
  - the spec §8 anchors.
- Produces (`prepareSocial.ts`): `prepareSocialData(repositoryRoot, mode: "write" | "check")`, `SOCIAL_CSV_HEADERS` and `REVIEWED_AT = "2026-10-20"`.
  - Averages are computed here from the package's `amount` and `count_months_sum`. The subsistence average uses `regular_amount` and `regular_count_months_sum`.
  - `payments.<programme>.amount` duplicates the national programme amount under the payments id. `pension_idp` is not a payments row.
- Series breaks, in demography's format:
  - `subsistence_employment_2022`: `social.subsistence.families|persons`, `2022-01-01`;
  - `social_package_groups_2025`: `social.social_package.other.*` and `.disability.*`, `2025-01-01`.

  Each takes its reason from spec §10.

- [ ] **Step 1: Write `tests/data/social/social.test.ts`**, modelled on `tests/data/education/education.test.ts`:
  - `prepareSocialData(root, "check")` resolves, and the row count equals the package's served total after averages and payments rows are added.
  - `validateSocialFacts` rejects each of these:
    - an altered value;
    - a duplicate;
    - a missing key;
    - a 2026 row;
    - a 2012 row;
    - an `04` geography;
    - a `payments.total` off by 1 GEL;
    - a pension average off by 0.01;
    - a region row no longer equal to its parts.
  - It accepts the recorded `source-findings` differences.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/data/social/social.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** by mirroring `lib/data/education/*`, `scripts/prepare-education.ts` and the package.json and `validate-all` entries.
- [ ] **Step 4: Run** `npm run data:prepare-social && npm run data:check-social && npx vitest run tests/data/social/social.test.ts`. Expected: `{"status":"passed","scope":"social_protection_annual"}` and PASS.
- [ ] **Step 5: Commit** `feat: prepare reviewed social protection data`.

### Task 3: Loader, mirror table and parity

**Files:**
- Create:
  - `apps/web/lib/data/social/importSocial.ts`
  - `apps/web/prisma/migrations/20261020090000_social/migration.sql`
- Modify:
  - `apps/web/prisma/schema.prisma` (`SocialFact`, `@@id([indicatorId, geographyId, year])`, value `Decimal(30,20)`)
  - `lib/db/mirrorRows.ts`
  - `lib/db/servedDataDb.ts`
  - `scripts/import-budget-facts.ts`
  - `data/sources/source-documents.csv`
  - `docs/deployment.md` (wherever `EducationFact` appears)
- Test: extend `tests/data/social/social.test.ts`.

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `loadSocialFacts()` and `loadSocialBreaks()`;
  - `assertSocialParity(csv, mirror)`;
  - `loadServedSocialData(): Promise<{ facts: SocialFact[]; breaks: SocialSeriesBreak[] }>`;
  - `toClientSocialFact(f)`, which converts `gel` amounts to million GEL (`value / 1e6`) and leaves averages and counts as they are;
  - the mirror mapper and the import comparison, named like Education's.

  The migration enables RLS and revokes public grants exactly as `20261016220000_education/migration.sql` does.

- [ ] **Step 1: Add the tests:**
  - Parity passes on identical arrays and on `"405.13"` vs `"405.130"`, and throws on a changed value or a missing row.
  - `toClientSocialFact` gives `4262.30909` for 2025 pension amount and `405.13` for its average.
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement** by copying each Education addition in the same file. Then run `npx prisma validate && npx prisma generate`.
- [ ] **Step 4: Run** `npx vitest run tests/data/social/social.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: mirror reviewed social protection data with exact parity`.

### Task 4: Explorer models, page-model calculations and state

**Files:**
- Create:
  - `apps/web/lib/explorer/social.ts` (sections, topic pages, calculations)
  - `apps/web/lib/explorer/socialPlaces.ts` (index maps, place pages)
  - `apps/web/tests/explorer/social.test.ts`

**Interfaces:**
- Consumes:
  - `ClientSocialFact`;
  - the `topicSeries` helpers;
  - `unitList.ts` with `groupOf`;
  - `refitRange`;
  - `buildMunicipalityValueMapModel`;
  - the `placeIndexRows` / `buildDemographyPlaces` helpers Education's index uses;
  - `placePageHref`;
  - served demography population facts, CPI facts (`loadCpiFacts`) and `ClientNationalGdpFact`.
- Produces (`social.ts`):
  - `SOCIAL_SECTIONS`: `social-payments`, `pensions`, `subsistence-allowance`, `social-package`, with hrefs `${HEALTH_HUB_PATH}/<id>` and label keys `common.socialPayments|socialPensions|socialSubsistence|socialPackage`. Also `SocialSectionId`, `SocialTopicId = "social-payments" | "social-package"` and `SocialPlaceSet = "pensions" | "subsistence-allowance"`.
  - `SocialHeading`, one of: `money`, `pensioners`, `share`, `average`, `families`, `people`, `recipients`.
  - `SocialSeriesDefinition = { id: string; reference: boolean; heading: SocialHeading; calculated?: "share" | "real" }`. A calculated row's id is the base indicator plus a suffix, `#share` or `#real`, so hashes stay stable.
  - `socialTopicSeries(section)`:
    - Social payments has 19 rows under `money`: total first, then spec §4's order.
    - Social package has spec §7's 10 groups under `recipients`, the same 10 under `money`, and `total.avg_monthly` under `average`.
  - `SocialPayView = "amount" | "gdp"` and `socialPaymentsViewFacts(view, facts, gdpFacts)`.
  - `sharePerHundred(facts, population, placeId): ClientSocialFact[]`, using population for year+1, `calculated`, one decimal.
  - `atPrices(facts, cpi, baseYear = 2025)`, two decimals.
  - `defaultSocialState`, `parseSocialHash`, `serializeSocialHash`, `buildSocialModel(section, facts, state, extras)` (the Education topic model shape, with `breaks`) and `socialSeriesColor`.
- Produces (`socialPlaces.ts`):
  - `socialPlaceBase(set)`.
  - `socialPlaceSeries(set)`, following spec §5 and §6 exactly, with headings:
    - **Pensions:** `pensioners` (`pension.recipients`, `pension_idp.recipients`, `pension_highmountain.recipients`), `share` (`pension.recipients#share`), `money` (`pension.amount`, `pension_idp.amount`, `pension_highmountain.amount`), `average` (`pension.avg_monthly`, `pension.avg_monthly#real`, `pension_highmountain.avg_monthly`).
    - **Subsistence allowance:** `families` (`subsistence.families`, `subsistence.employment_families`, `subsistence.registered_families`), `people` (`subsistence.persons`, `subsistence.registered_persons`), `share` (`subsistence.persons#share`, `subsistence.registered_persons#share`), `money` (`subsistence.amount`, `subsistence.employment_amount`), `average` (`subsistence.avg_monthly`).
  - `socialPlaceDefaultSelection`, `parseSocialPlaceHash`, `changeSocialPlaceSelection` (`groupOf` = heading), `socialPlaceCoverage` and `buildSocialPlaceModel`.
  - `buildSocialIndexModel(set, facts, population, regions, municipalities)`: `{ year; map; municipalities; regions; country }`, shaded by the latest year's share (`pension.recipients#share` or `subsistence.persons#share`). The Georgia row comes first and is unranked.

- [ ] **Step 1: Write `tests/explorer/social.test.ts`:**
  - **Defaults and coverage:**
    - Social payments is `["social.payments.total.amount"]`, 2013–2025.
    - Pensions Georgia is `pension.recipients`, 2013–2025.
    - The high-mountain supplement starts in 2016.
    - Subsistence `employment_families` starts in 2022.
  - **Rows:** Social payments 19, Pensions 10 under 4 headings, Subsistence 10 under 5 headings, Social package 21.
  - **Hash** (Review Focus 2): `#sel=social.pension.recipients,social.pension.amount` keeps `[pension.recipients]`. Ticking `pension.amount` replaces it.
  - **Share** (Review Focus 3):
    - Georgia pension 2025 share = `round(888518 / 3941103 × 100, 1)` = `22.5`.
    - There is no 2013 share.
    - `unit.akhalgori` has none.
    - Tbilisi uses the `region.tbilisi` population.
  - **Real:** the 2013 pension average at 2025 prices = `133.23 × 185.49279166666668 / 106.9681` rounded to two decimals, which is 231.04 (assert the computed constant).
  - **% of GDP:** 2025 total ÷ served GDP 2025 × 100. Assert against the served GDP value read in the test.
  - **Breaks** (Review Focus 4): the subsistence families model has a break at 2022, and Social package `other` has one at 2025.
  - **Partial months** (Review Focus 1): the payments model marks 2020 COVID-19 `months: 6`.
  - **Index:**
    - The Pensions year is 2025.
    - Georgia's row value is the share.
    - There are 63 municipalities plus Tbilisi.
    - Clicking Tbilisi gives `/explorer/health/pensions/region/tbilisi`.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/social.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files.
  - Reuse Crime's rounding (`toPrecision(15)`) for calculated values.
  - If `crimeMeasureFacts`' arithmetic can be extracted as a shared helper with Crime's output unchanged, do so and note it in the commit message.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: model social protection pages, place pages and state`.

### Task 5: Excel workbooks and hub cards

**Files:**
- Create:
  - `apps/web/lib/explorer/socialWorkbook.ts`
  - `apps/web/lib/explorer/socialHubCards.ts`
- Test: extend `tests/explorer/social.test.ts`.

**Interfaces:**
- Produces: `buildSocialWorkbookExportModel(...)`, mirroring `educationWorkbook.ts`.
  - Filenames are `social-<section>-<start>-<end>` and `social-<set>-<scope>-<start>-<end>`.
  - Number formats: `"#,##0"` for persons and families, `"#,##0.0"` for million GEL and %, `"#,##0.00"` for GEL averages and % of GDP.
  - A Summary note `workbook.calculatedNote` appears when any exported series is `calculated`.
  - Only the SSA tables behind the exported series are listed as sources, plus Geostat population, CPI or GDP when a calculated row uses them.
- Produces: `buildSocialHubCards(facts, presentation): HubCardModel[]`, giving four cards (sparklines of the four defaults, Georgia). English footers:
  - `"2025 · 6,166.1 million GEL · 2013–2025"`
  - `"2025 · 888,518 · 2013–2025"`
  - `"2025 · 129,506 · 2013–2025"`
  - `"2025 · 187,764 · 2013–2025"`

- [ ] **Step 1: Write the tests:**
  - A Guria pensions money workbook uses `"#,##0.0"` and lists only `pension-01`.
  - A Georgia average workbook with the `#real` row carries the calculated note and the CPI source.
  - Check the four hub footers.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: export social protection data to Excel and build hub cards`.

### Task 6: Messages and i18n wiring

**Files:**
- Create: `lib/i18n/messages/ka/social.json` and `lib/i18n/messages/en/social.json`.
- Modify:
  - `lib/i18n/messages/{ka,en}/common.json` (`socialPayments`, `socialPensions`, `socialSubsistence`, `socialPackage`, `dataSocial`)
  - `lib/i18n/types.ts`
  - `lib/i18n/messages.server.ts`
  - `lib/i18n/inventory.server.ts`
  - `data/localization/en/page-revisions.json`

The keys mirror `education.json`, plus:
- `heading.<heading>`
- `series.<indicator or id#suffix>`
- `unitPersons`, `unitFamilies`, `unitMlnGel`, `unitGel`, `unitPercent`, `unitPercentGdp`
- `latest.<section>` and `latest.place.<set>`
- `sourceNote.<section>`
- `mapAria` and `mapLegend.<set>`
- `months.partial` ("{n} months")
- `workbook.calculatedNote`

Georgian proposals, for Duru's proofread:
- Pages: სოციალური გასაცემლები, პენსიები, საარსებო შემწეობა, სოციალური პაკეტი.
- Headings: გაცემული თანხა, პენსიონერები, წილი მოსახლეობაში, საშუალოდ თვეში, ოჯახები, ადამიანები, მიმღებები.
- Programme and group names follow SSA's Georgian table titles.

English latest lines (each must fit one line at 390 px; shorten if the browser check fails):

| Line | English text |
| --- | --- |
| Social payments | "2025: 6.17 billion GEL paid in social benefits" |
| Pensions | "2025: 888,518 pensioners" |
| Subsistence allowance | "2025: 129,506 families receive the allowance" |
| Social package | "2025: 187,764 social package recipients" |
| Place pages | "2025: 888,518 pensioners · Georgia", "2025: 129,506 families · Georgia" |

- [ ] **Step 1: Add the files and run** `npm run i18n:check`. Expected: FAIL.
- [ ] **Step 2: Wire the namespace** as Education did.
- [ ] **Step 3: Run** `npm run i18n:check && npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit** `feat: add Georgian and English social protection copy`.

### Task 7: Index and place pages

**Files:**
- Create:
  - `components/social/social-place-explorer.tsx`
  - `lib/pages/social-places.tsx`
  - routes `app/(ka)/explorer/health/{pensions,subsistence-allowance}/{page,georgia/page,region/[id]/page,[slug]/page}.tsx`, with mirrors under `app/(en)/en/explorer/health/…`, copying the Education route files.

**Interfaces:**
- Consumes: Tasks 3–6, `MunicipalitiesIndex`, `EntityHeading`, `EntityWorkspaceShell`, `EntityMemberList`, `buildPickerCountry`, `pickerGroupsFromRows` and `placeNeighbours`.
- Produces:
  - `SocialPlaceExplorer(props)`, Education's place explorer with `breaks` passed to `EditorialLineChart` and `breakYears` to `ExplorerTable`;
  - `renderSocialIndexPage(locale, set)` and `socialIndexMetadata`;
  - `renderSocialPlacePage(route, locale, set)` and `socialPlaceMetadata`;
  - `socialRegionParams` and `socialMunicipalityParams`.
  - Test ids: `social-latest`, `social-excel-download`, `social-place-<set>`.
  - Population, CPI and GDP facts are loaded server side and passed in as client facts.
- Reuse check first: if `EducationPlaceExplorer` can take the series, labels and breaks as props with Education's output unchanged, generalise it instead of copying it. Record the choice in the commit message.

- [ ] **Step 1: Implement** the component, page module and routes.
  - The index passes `overrides.hrefById = placeHrefById(base, places)`, a `percent` value format, `mapWording` and empty `kpis`.
  - Under the heading, only the latest line.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npx vitest run tests/explorer/social.test.ts`. Expected: PASS.
- [ ] **Step 3: Commit** `feat: add pensions and subsistence allowance maps and place pages`.

### Task 8: Topic pages, hub, navigation, SEO and browser tests

**Files:**
- Create:
  - `components/social/social-explorer.tsx`: Social payments and Social package, mirroring `EducationExplorer`, with the `SegmentedTabs` `ChartPie` view switch on Social payments only, `breaks` and the partial-months table mark;
  - `lib/pages/social.tsx`;
  - routes `app/(ka)/explorer/health/{social-payments,social-package}/page.tsx` and their en mirrors;
  - `tests/browser/social.spec.ts`.
- Modify:
  - `lib/pages/hubs/health.tsx`: cards = `buildHealthHubCards` then `buildSocialHubCards`.
  - `lib/navigation/navTree.ts`: Health sections then `SOCIAL_SECTIONS`.
  - `lib/seo/sitemap.ts`
  - `lib/seo/datasetVocabulary.ts`
  - `components/shell/explorer-footer.tsx`
  - `public/llms.txt`
  - `tests/seo/routes.test.ts`, `tests/seo/agentFiles.test.ts`, `tests/navigation/navTree.test.ts`, `tests/site/datasetHubs.test.ts`
  - the browser counts Education touched (`git show a8ac0083 -m --first-parent -- apps/web/tests/browser/landing.spec.ts apps/web/tests/browser/mobile-repairs-nav.spec.ts apps/web/tests/browser/mobile-site-menu.spec.ts apps/web/tests/browser/seo.spec.ts`)

- [ ] **Step 1: Write `tests/browser/social.spec.ts`:**
  - **Hub:** the Health hub shows seven cards, with the four new ones after Causes of death.
  - **Social payments:**
    - One selected row, and the latest line contains `6.17`.
    - The `ChartPie` switch shows % of GDP, with values under 20.
    - Table mode shows the COVID-19 2020 cell marked as partial (Review Focus 1).
  - **Pensions index:**
    - The map draws, with Georgia's row first.
    - Clicking Tbilisi opens `/explorer/health/pensions/region/tbilisi` (Review Focus 5).
  - **Guria Pensions page:**
    - The latest line contains `Guria`, and the four headings are present.
    - Ticking Money paid → State pension replaces Pensioners.
    - Ticking Average → Average pension at 2025 prices shows a value.
    - The next link opens the next region.
  - **Subsistence Georgia page:** with Families → Receiving ticked, the chart shows the "new counting" rule at 2022 (Review Focus 4). The Kept-on-employment-programme row starts at 2022.
  - **Social package:** the 2025 rule appears when Other groups is ticked.
  - **Language switch:** switching to `/en` keeps the hash on Guria Pensions and on Social payments (Review Focus 5).
  - **Excel:** a download fires a `.xlsx` on a place page and on Social payments.
  - **Phone width:** at 390 px there is no horizontal scroll on the hub, both indexes, Guria Pensions and Social payments, and every latest line is one line.
- [ ] **Step 2: Implement** the component, pages, routes, hub, nav, footer, sitemap and SEO. Extend `tests/seo/routes.test.ts` with every new route: 2 topics + 2 × 76 per locale.
- [ ] **Step 3: Run** `npx vitest run tests/seo tests/navigation tests/site tests/explorer/social.test.ts tests/explorer/health.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 4: Run the browser specs** `npx playwright test tests/browser/social.spec.ts tests/browser/health.spec.ts tests/browser/education.spec.ts` against a built server, following CLAUDE.md with `CI=1`.
  - If this checkout's Playwright expects a newer Chromium than `/opt/pw-browsers`, use a wrapper config with `launchOptions.executablePath` set to the installed Chromium.
  - Expected: PASS.
- [ ] **Step 5: Commit** `feat: add social payments and social package pages to the health hub`.

### Task 9: Methodology page and source archive

**Files:**
- Create:
  - `lib/methodology/content/social-protection.ts`
  - `lib/methodology/content/en/social-protection.ts`
  - `data/methodology/source-archives/social-protection.csv` (SSA topic pages plus the Geostat population, CPI and GDP sources)
- Modify: everything Education's methodology step modified, with `social-protection` in place of `education` (`git show a8ac0083 -m --first-parent -- apps/web/lib/methodology apps/web/lib/pages/methodology-article.tsx data/localization/en/documents.json data/localization/en/sources.json data/methodology/decision-register.csv apps/web/lib/factQuery/buildSnapshot.ts`), and the matching tests.

The content covers spec §11's list in plain words. It says which figures SSA published and which fiscal.ge calculated, and it states no causes.

- [ ] **Step 1: Update the catalogue, archive and snapshot tests** to expect `social-protection`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement**, then run `npm run data:check-methodology-archives` and the methodology tests. Expected: PASS, with no SSA source in the snapshot and no `docs/Raw Data/Social` file in the methodology bundle.
- [ ] **Step 4: Commit** `feat: publish social protection methodology and sources`.

### Task 10: Preview for Duru (stop point)

- [ ] **Step 1: Screenshots.** Build and serve following CLAUDE.md, on port 3100. Take screenshots into `/mnt/project-files/screenshots/social/`:
  - ka and en at 1440 px: the hub, Social payments (chart and % of GDP), both indexes, Pensions Georgia (pensioners, then average with 2025 prices), Guria Pensions, a municipality, Subsistence Georgia (families with the 2022 rule), Social package, and the methodology page;
  - ka at 390 px: the hub, the Pensions index, Guria and Social payments.
- [ ] **Step 2: Duru's review.**
  - Push the branch (no PR) for a Vercel preview, as Duru prefers.
  - Find the preview URL through the public GitHub API commit statuses.
  - Reply with the link, the main screenshots and an `ask_decision` card: "Looks good, go ahead" or "Change something".
  - **Wait.** Apply requested changes and repeat until Duru approves.

### Task 11: Scope and design documents

**Files:**
- Create: `docs/data-methodology/social-protection-annual.md`, covering the package, IDs, the yearly rule, checks, serving and export.
- Modify:
  - `Project_Definition.md`: a new approved item after the last lettered one, recording Duru's approvals of 2026-10-19/20, and §2L's "not shown now" sentence updated to point to it;
  - `DESIGN.md`: the Health hub section, with the four pages, the place pages and §6.7's sidebar list.

- [ ] **Step 1:** Write the documents.
- [ ] **Step 2:** Run `npm run i18n:check`.
- [ ] **Step 3:** Commit `docs: record the pensions and social help pages`.

### Task 12: Full gates and delivery (only after Duru's OK in Task 10)

- [ ] **Step 1: Merge main.** Run `git fetch origin main && git merge origin/main`. Keep both sides in shared files. If another hub merged first, renumber the `DESIGN.md` section, the `Project_Definition.md` item, the migration timestamp and the page counts.
- [ ] **Step 2: Full gates.** Run `npm run check`, then `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then the full browser suite against `npm run start -- --port 3100`. Expected: all green.
- [ ] **Step 3: Draft PR.** Run `git push -u origin claude/project-thread-aa1to5`. Open a draft PR with the attribution block. Subscribe to PR activity and drive CI to green.
- [ ] **Step 4: Report.** Reply with the PR link. Merging releases to production, so it waits for Duru's go.
