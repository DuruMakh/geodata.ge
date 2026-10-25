# Homepage Redesign, Step 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the five society chapters (ageing, youth unemployment, wages of women and men, foreign trade, causes of death) to the homepage after the deficit chapter, all computed from served facts.

**Architecture:** Same as step 1. Pure builders in `lib/landing/chapters/` turn served facts into small models inside `HomeChapters` at build time. Headings, ledes, stat cards and legends are server HTML; each canvas chart is a client component whose engine chunk loads near the viewport (`useEngine`) and runs on step 1's `createChartCore`.

**Tech Stack:** Next.js 16 (static), React 19, TypeScript strict, Tailwind v4 tokens, Canvas 2D, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-25-homepage-redesign-step2-design.md`. Design board for exact styles and drawing: `/mnt/project-files/homepage-redesign/design-board/Main.dc.html`. Markup lines 520-680, CSS lines 182-183 and 237-267 (`.fx-stat*`, `.fx-big2`, `.fx-pyr`, `.fx-mig`, `.fx-dmap`, `.fx-waf*`, `.fx-wk*`, `.fx-trio`, `.fx-bfly`, `.fx-trl`, `.fx-spark`, `.fx-g75`, `.fx-g84`, `.fx-row2`). Script: colours line 1886, `hbar` 1920, `spread` 1930, `createLines` 1940, `createSpark` 1996, `createPyr` 2020, `createDmap` 2079, `createMig` 2118, `per100` 2151, `createWaffle` 2157, `createReg` 2183, `createDumb` 2214, `createBfly` 2249, `createTradeLines` 2276, `createUnits` 2285. Port drawing and layout from there. Never copy its data constants.

## Global Constraints

- Branch `claude/project-thread-8baw8w` sits on step 1 (`claude/project-thread-ojqgbj`). Once step 1 is on `main`, merge `origin/main` before the done-check.
- No new npm dependencies. Every number comes from served facts at build time.
- Reuse step 1 as is: `Chapter`, `Reveal`, `useEngine`, `ChartUnavailable`, `createChartCore`, `canvas.ts`, `chart-draw.ts`, `chart-layout.ts`, `chart-format.ts`, `ChartTip`/`showTip`/`hideTip`. New tooltip builders go into `chart-tips.ts`.
- Anchors `ch-06` … `ch-10`, in that order, between `#ch-05` and `#sources`.
- Heading links through `pageHref(path, locale)`: 06 `/explorer/demography`, 07 `/explorer/unemployment`, 08 `/explorer/wages`, 09 `/explorer/trade`, 10 `/explorer/health/causes-of-death`.
- New colours (add to `DESIGN.md` §19): men `#3D5A98`, women `#C26E4C`, exports `#1f6e56`, imports `#3a332a`, births classes `#7d2a1b` (<50), `#b3402a` (50–75), `#d5998a` (75–100), `#8bb9b8` (100–125), `#1e7f86` (≥125).
- All text in `lib/i18n/messages/{ka,en}/landing.json`. Georgian is the board's, English drafts go on the proofread list. Exceptions are labels the explorer already owns: sector, region, partner and product names via `publicLabel`, and cause names via `health.series.health.deaths.<id>`.
- Canvas DPR is capped at 2 (as `sizeCanvas` does). Reduced motion shows final states.
- No share button on these charts (spec §4).
- Do not push, open a PR or run the full gates before Duru approves the preview (project rule).

## Review Focus

1. **Sources with different latest years** (pyramid on 1 Jan 2026, births 2025, trade 2025): each number carries its own year, never one global year. Covered in Task 1 (pyramid and births years asserted separately).
2. **Youth age groups lag the national LFS row, or youth unemployment is not above the national rate**: the chapter uses the latest year where the national row and all three youth groups exist, and the heading takes the neutral `notHigher` wording when ratio ≤ 1. Covered in Task 2.
3. **A municipality on the grid without vital data, or vital data for an excluded code**: the grid place shows "no data" (hollow), and the excluded code is ignored. Covered in Task 1.
4. **A sector missing women's or men's pay, or a median missing in the latest average year**: the row is dropped, and the median card uses its own latest year. Covered in Task 3.
5. **"Cause not established" is the largest group, or a cause has zero deaths**: zero causes never rank, and the accent and lede name the largest established cause. Covered in Task 5.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/web/lib/landing/chapters/ageing.ts` | Chapter 06 model (Task 1) |
| `apps/web/lib/landing/chapters/youthJobs.ts` | Chapter 07 model and comparison word (Task 2) |
| `apps/web/lib/landing/chapters/wageGap.ts` | Chapter 08 model (Task 3) |
| `apps/web/lib/landing/chapters/trade.ts` | Chapter 09 model (Task 4) |
| `apps/web/lib/landing/chapters/deaths.ts` | Chapter 10 model and "one in N" (Task 5) |
| `apps/web/lib/landing/chapters/types.ts`, `index.ts` | New types; `buildHomeChapters` and sentences/headings (Tasks 1-6) |
| `apps/web/lib/pages/home.tsx` | Loads the five datasets, label ids, `health` scope (Task 6) |
| `apps/web/components/landing/chapters/stat-card.tsx` | Server stat card (Task 7) |
| `apps/web/components/landing/chapters/ageing-chapter.tsx`, `pyramid-chart.tsx`/`-engine.ts`, `migration-chart.tsx`/`-engine.ts`, `births-map.tsx`/`-engine.ts` | Task 7 |
| `.../jobs-chapter.tsx`, `waffle-chart.tsx`/`-engine.ts`, `regions-chart.tsx`/`-engine.ts` | Task 8 |
| `.../wages-chapter.tsx`, `dumbbell-chart.tsx`/`-engine.ts` | Task 9 |
| `.../trade-chapter.tsx`, `butterfly-chart.tsx`/`-engine.ts`, `trade-lines-chart.tsx`/`-engine.ts` | Task 10 |
| `.../deaths-chapter.tsx`, `unit-chart.tsx`/`-engine.ts` | Task 11 |
| `apps/web/components/landing/landing-page.tsx` | One `<Chapter>` per UI task |

Every `*-chart.tsx` follows `deficit-chart.tsx`: a `"use client"` figure with a server-rendered caption and legend, a canvas with `role="img"` and a data-built `aria-label`, `ChartTip`, `useEngine(wrapRef, () => import("./x-engine"))`, a `live` ref for labels, and `ChartUnavailable` on failure. Every engine exports `createX({ wrap, canvas, data, labels, onHover, onLeave }): { destroy(): void }` built on `createChartCore`.

### Model types (added to `types.ts` by the task that builds each one)

```ts
export type AgeingChapter = {
  pyramid: { year: number; baseYear: number; ages: string[]; men: number[]; women: number[]; baseMen: number[]; baseWomen: number[] }; // ages youngest first: "0–4" … "85+"; persons
  oldShare: { year: number; share: number }; oldShareBase: { year: number; share: number }; // 65+ share, fraction
  ageing: boolean; // oldShare.share > oldShareBase.share
  womenPer100Men: number; oldestWomenPerMan: number; // latest pyramid year; 85+ women / men
  lifeExpectancy: { year: number; total: number; women: number; men: number };
  fertility: { year: number; rate: number };
  migration: { years: number[]; net: number[] }; // consecutive years with a net value, ascending
  births: { year: number; births: number; deaths: number; places: ({ births: number; deaths: number } | null)[] }; // places aligned with MunicipalChapter.places
};
export type LabourSplit = { employed: number; unemployed: number; outside: number; rate: number; per100: [number, number, number] }; // thousand persons; rate percent
export type ComparisonId = "notHigher" | "littleHigher" | "oneAndHalf" | "almostTwice" | "twice" | "moreThanTwice";
export type YouthJobsChapter = { year: number; all: LabourSplit; youth: LabourSplit; ratio: number; comparison: ComparisonId; regions: { id: string; label: string; rate: number }[] }; // regions rate desc
export type WageGapChapter = {
  year: number; average: number; women: number; men: number; ratio: number; // ratio = women / men
  median: { year: number; value: number }; publicSector: number; nonPublic: number;
  history: { years: number[]; values: number[] }; // national average, first..latest
  sectors: { id: string; label: string; average: number; women: number; men: number }[]; // average desc
};
export type TradeChapter = {
  year: number; exportsUsd: number; importsUsd: number; turnoverUsd: number; balanceUsd: number;
  years: number[]; exports: number[]; imports: number[]; // USD
  partners: { id: string; label: string; exportsUsd: number; importsUsd: number; turnoverUsd: number }[]; // ≤10, turnover desc
  topProduct: { label: string; usd: number; share: number }; secondProduct: { label: string; usd: number } | null;
};
export type DeathGroupKind = "top" | "unknown" | "established" | "other";
export type DeathsChapter = { year: number; total: number; groups: { id: string; label: string; count: number; kind: DeathGroupKind }[]; top: { id: string; label: string; share: number }; unknownShare: number };
```

`HomeChapters` gains `ageing`, `youthJobs`, `wageGap`, `trade`, `deaths`, and `sentences` gains the same five keys plus `headings: { ageing: string; youthJobs: string }`.

---

### Task 1: Chapter 06 ageing model

**Files:** Create `apps/web/lib/landing/chapters/ageing.ts`; Modify `types.ts`; Test `apps/web/tests/landing/chapters/ageing.test.ts`.

**Interfaces:**
- Consumes: `ServedDemographyObservation[]` (`loadServedDemographyData`), `ReliefPlace[]` (`MunicipalChapter.places`, step 1).
- Produces: `buildAgeingChapter(facts: ServedDemographyObservation[], places: ReliefPlace[]): AgeingChapter`.

- [ ] **Step 1: Failing tests.** Use the real served data (`await loadServedDemographyData()`) plus a built `MunicipalChapter` from step 1's test helpers for alignment, and small fixtures for the edge cases:
  - `pyramid is the latest population_by_age_sex year against the first`: `year === 2026`, `baseYear === 2004`, `ages[0] === "0–4"` (`age_0` + `age_1_4` summed), `ages.at(-1) === "85+"`, 18 entries, `men[17] === 19083`, `women[17] === 49131`.
  - `65+ share from population_age_band`: `oldShare` ≈ 0.1808 (2026), `oldShareBase` ≈ 0.1407 (2004), `ageing === true`. A fixture where the share falls gives `ageing === false`.
  - `women per 100 men` ≈ 108.8 and `oldestWomenPerMan` ≈ 2.6 (2026).
  - `life expectancy and fertility take their own latest year`: `{ year: 2025, total: 76.0, women: 80.6, men: 71.4 }`, `{ year: 2025, rate: 1.53 }`.
  - `migration is the consecutive net series`: `years[0] === 2012`, `net.at(-1) === 17127`, sum `-26795`.
  - `births per place are aligned with the relief places`: Georgia `{ year: 2025, births: 37867, deaths: 44319 }`; the place with code `06` → `{ births: 2630, deaths: 1779 }`; a fixture place without vital rows → `null`; a vital row for code `05` (not on the grid) is ignored.
- [ ] **Step 2:** `cd apps/web && npx vitest run tests/landing/chapters/ageing.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement.** Filter `geographyId === "country.georgia"` for the pyramid, shares and rates, and `sex === "total"` where a `sex` exists. Births and deaths use `demography.live_births` and `demography.deaths` keyed by `geographyId` (two-digit code) for the latest year that has Georgia's births. Throw with the series id if a required series has no year.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(home): ageing chapter model`.

### Task 2: Chapter 07 youth unemployment model

**Files:** Create `apps/web/lib/landing/chapters/youthJobs.ts`; Modify `types.ts`; Test `apps/web/tests/landing/chapters/youthJobs.test.ts`.

**Interfaces:**
- Consumes: `ServedUnemploymentObservation[]`, `REGIONAL_ECONOMY_REGIONS` (`lib/data/regionalEconomies/importRegionalEconomies`), `publicLabel`, `Presentation`.
- Produces: `buildYouthJobsChapter(facts: ServedUnemploymentObservation[], presentation: Presentation): YouthJobsChapter`; `comparisonFor(ratio: number): ComparisonId`; `per100(values: number[]): number[]` (largest remainder, sums to 100).

- [ ] **Step 1: Failing tests:**
  - `all ages 15+, 2025`: `employed 1389.7`, `unemployed 224.0`, `outside 1349.4`, `rate 13.9`, `per100 [47, 8, 45]`.
  - `youth 15–29 sums three age groups`: `employed 195.1`, `unemployed 66.4`, `outside 298.4`, `rate` ≈ 25.38, `per100 [35, 12, 53]`.
  - `comparisonFor`: 1.0 → `notHigher`, 1.1 → `littleHigher`, 1.5 → `oneAndHalf`, 1.83 → `almostTwice`, 2.0 → `twice`, 2.3 → `moreThanTwice`. Boundaries: 1.2 → `oneAndHalf`, 1.75 → `almostTwice`, 1.95 and 2.05 → `twice`.
  - `per100` always sums to 100 (e.g. `[1, 1, 1]` → `[34, 33, 33]`).
  - `regions are the latest year's rates, highest first`: 11 rows, first `region.tbilisi` 17.5, last `region.samtskhe_javakheti` 7.0, labels non-empty.
  - `year falls back to the latest year with the national row and all three youth groups` (fixture: 2026 national only → `year 2025`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Use `value` (unrounded). Use `dimension "national"`/`groupId "georgia"` and `dimension "age"` with `age.15_19`, `age.20_24`, `age.25_29`. Indicators: `employed`, `unemployed`, `outside_labour_force`. Youth rate = unemployed / (employed + unemployed) × 100. `per100` is computed over employed, unemployed and outside.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(home): youth unemployment chapter model`.

### Task 3: Chapter 08 wages model

**Files:** Create `apps/web/lib/landing/chapters/wageGap.ts`; Modify `types.ts`; Test `apps/web/tests/landing/chapters/wageGap.test.ts`.

**Interfaces:**
- Consumes: `WagesFact[]` (`loadServedWagesData`), `ECONOMIC_SECTORS` (`lib/data/economicSectors/importEconomicSectors`), `WAGES_SECTORS`, `publicLabel`, `Presentation`.
- Produces: `buildWageGapChapter(facts: WagesFact[], presentation: Presentation): WageGapChapter`.

- [ ] **Step 1: Failing tests:**
  - `latest year 2025: average ≈ 2165.2, women ≈ 1743.4, men ≈ 2586.5, ratio ≈ 0.674`.
  - `median 1531 (2025)`, `publicSector ≈ 1895`, `nonPublic ≈ 2301` (to 1 GEL).
  - `history starts at the first national average year (13.5 in 1995) and ends at the latest`.
  - `19 sector rows sorted by average desc; sector.k women 3111.6, men 6164.3`.
  - `a sector missing women or men is dropped` (fixture).
  - `median takes its own latest year when the average year has none` (fixture).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Indicator `average_monthly_nominal_earnings`: national `georgia`/`total`; `sex` `women`/`men` with `total` and `sector.*`; `ownership` `public`/`non_public` `total`; the sector average is `national georgia sector.*`. Median is `median_monthly_earnings` national `total`. Use `Number(value)`.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(home): wages chapter model`.

### Task 4: Chapter 09 trade model

**Files:** Create `apps/web/lib/landing/chapters/trade.ts`; Modify `types.ts`; Test `apps/web/tests/landing/chapters/trade.test.ts`.

**Interfaces:**
- Consumes: `TradeOverviewFact[]`, `TradePartnersData`, `TradeProductsData`, `publicLabel`, `Presentation`.
- Produces: `buildTradeChapter(input: { overview: TradeOverviewFact[]; partners: TradePartnersData; products: TradeProductsData }, presentation: Presentation): TradeChapter`.

- [ ] **Step 1: Failing tests:**
  - `2025 totals`: exports ≈ 7.288e9, imports ≈ 18.649e9, turnover ≈ 25.936e9, balance ≈ −11.361e9; `years[0] === 1995`.
  - `top 10 partners are countries by turnover`: no `group.*` ids; first label is Turkey's; Kyrgyzstan (`partner.1995-2025.417`) has exports ≈ 1.499e9.
  - `largest product is passenger cars (8703) with share ≈ 0.386; second is 2616 at ≈ 0.379e9`.
  - `a partner with a null turnover is skipped; fewer than 10 countries returns what exists` (fixture).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** The year is the latest overview year with `trade.exports`. Partners use `entity.kind === "country"`, indicator `trade.turnover`, and non-null `valueUsd`. Products use the year's `trade.exports` facts with non-null values, label `publicLabel(locale, id, labelKa, englishLabels)` (no code or block suffix). Share = product / overview exports.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(home): trade chapter model`.

### Task 5: Chapter 10 causes-of-death model

**Files:** Create `apps/web/lib/landing/chapters/deaths.ts`; Modify `types.ts`; Test `apps/web/tests/landing/chapters/deaths.test.ts`.

**Interfaces:**
- Consumes: `HealthFact[]` (`loadServedHealthData().facts`), `Messages` (`health` scope).
- Produces: `buildDeathsChapter(facts: HealthFact[], messages: Messages): DeathsChapter`; `oneInN(share: number): number | null` (round(1/share) within 2..10, else null).

- [ ] **Step 1: Failing tests:**
  - `2025, Georgia: total 44319; groups are the five largest causes then other`: ids `circulatory, ill_defined, cancer, respiratory, external, other`; `other.count === 5836`; counts sum to 44319.
  - `kinds`: circulatory `top`, ill_defined `unknown`, cancer/respiratory/external `established`, other `other`.
  - `top.share ≈ 0.377`, `unknownShare ≈ 0.212`; `oneInN(0.212) === 5`, `oneInN(0.04) === null`, `oneInN(0.6) === 2`.
  - `ill-defined largest → top is the largest established cause` and `zero-count causes never rank` (fixtures).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Use `areaId === "georgia"`, indicators `health.deaths.<id>` except `total`; the year is the latest with `health.deaths.total`. Labels come from `message(messages, "health.series.health.deaths.<id>")`, and "other" from `landing.deaths.other`.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(home): causes-of-death chapter model`.

### Task 6: Wire the models, sentences and headings

**Files:** Modify `lib/landing/chapters/index.ts`, `types.ts`, `lib/pages/home.tsx`, `lib/i18n/messages/{ka,en}/landing.json`; Test `tests/landing/chapters/homeChapters.test.ts`.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: `HomeChaptersInput` gains `demographyFacts`, `unemploymentFacts`, `wagesFacts`, `trade: { overview; partners; products }`, `healthFacts`. `buildHomeChapters` returns the five models; `sentences.{ageing,youthJobs,wageGap,trade,deaths}` and `sentences.headings.{ageing,youthJobs}`.

- [ ] **Step 1: Failing tests** in `homeChapters.test.ts` (real data, ka and en presentations):
  - ka ledes equal the board's sentences: `65 წლისა და უფროსი ასაკის მოსახლეობის წილი 18.1%-ია — 2004 წელს 14.1% იყო; 2025 წელს ყოველ 100 გარდაცვლილზე 85 ახალშობილი მოდიოდა.`, `2025 წელს უმუშევრობის დონე 13.9% იყო, 15–29 წლის ახალგაზრდებში — 25.4%.`, `საშუალო თვიური ხელფასი 2025 წელს 2 165 ლარი იყო; ქალები კაცების საშუალო ხელფასის 67%-ს იღებენ.`, `2025 წელს საგარეო სავაჭრო ბრუნვამ 25.9 მილიარდი დოლარი შეადგინა: ექსპორტი 7.3 მილიარდი იყო, იმპორტი — 18.6.`, `2025 წელს 44 319 ადამიანი გარდაიცვალა, 38% — სისხლის მიმოქცევის სისტემის დაავადებებით; ყოველი მეხუთე შემთხვევის მიზეზი დადგენილი არ არის.`
  - headings: `საქართველო ბერდება`, `ახალგაზრდებში უმუშევრობა თითქმის ორჯერ მაღალია`; each `ComparisonId` has a ka and en key; the ageing fallback key exists.
  - en ledes contain the same numbers.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Keys: `landing.ch{6..10}.title`/`.hint` (titles 08-10 and hints from the board; 06 and 07 titles come from `landing.ageing.heading.{ageing,changing}` and `landing.jobs.heading.{ComparisonId}`); `landing.sentence.{ageing,youthJobs,wageGap,trade,deaths}`; `landing.deaths.cause.<id>` (instrumental form for every cause, e.g. `სისხლის მიმოქცევის სისტემის დაავადებებით`); `landing.deaths.oneIn.{2..10}` (`ყოველი მეორე შემთხვევის` … `ყოველი მეათე შემთხვევის`) and `landing.deaths.share` (`{pct} შემთხვევის`) for null. Numbers use `formatShare`, `formatInUnit` and the step 1 number grouping (`2 165`, `44 319`). In `home.tsx`, load `loadServedDemographyData`, `loadServedUnemploymentData`, `loadServedWagesData`, `loadServedTradeOverviewData`, `loadServedTradePartnersData`, `loadServedTradeProductsData` and `loadServedHealthData` in the existing `Promise.all`. Add `"health"` to the scopes and pass ids for `WAGES_SECTORS`, `REGIONAL_ECONOMY_REGIONS`, country partner ids and latest-block product ids. `buildAgeingChapter` receives `municipal.places`.
- [ ] **Step 4:** Run → PASS; `npm run typecheck` and `npm run i18n:check` → clean. **Step 5: Commit** `feat(home): society chapter models, sentences and headings`.

### Task 7: Stat card and chapter 06 charts

**Files:** Create `components/landing/chapters/stat-card.tsx`, `ageing-chapter.tsx`, `pyramid-chart.tsx`, `pyramid-engine.ts`, `migration-chart.tsx`, `migration-engine.ts`, `births-map.tsx`, `births-map-engine.ts`; Modify `chart-tips.ts`, `landing-page.tsx`, `landing.json`; Test `tests/landing/chapters/ageing-chapter.test.tsx`, `tests/landing/chapters/chart-tips.test.ts`.

**Interfaces:**
- Consumes: `AgeingChapter`, `MunicipalChapter` (`grid`, `places`), step 1 chart core.
- Produces: `StatCard({ label: string; value: string; unit?: string; note: string; children?: ReactNode })` (server; board `.fx-stat`: 1.5px ink rule, label, `.fx-big2` number with `<small>` unit, note). `AgeingChapter({ data, municipal, labels })`, with `labels` a plain string object built in `landing-page.tsx`.

- [ ] **Step 1: Failing server-render tests** (`renderToStaticMarkup`, as in `deficit-chart.test.tsx`): four stat cards with `108.8`, `76.0`, `1.53`, `+17 127`; pyramid legend men/women/`2004 წლის სტრუქტურა`; map legend has five classes plus "no data"; each canvas `aria-label` contains its key numbers (pyramid `14.1%`→`18.1%`; map highest and lowest place); `chart-tips` tests for `pyramidTip`, `migrationTip` and `birthsTip`, matching the board's tooltip rows.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Port `createPyr` (500px, 470px below 768px; base-year outline in ink), `createMig` (104px; teal `#1e7f86` positive, accent negative), and `createDmap` drawn on `municipal.grid` (aspect ratio 138/71; occupied cells outlined in hairline; labels on highest, lowest, Tbilisi and the second highest). Layout follows `.fx-g75` (7/5 columns from 1000px), with the map in `.fx-row2` below.
- [ ] **Step 4:** Add `<Chapter id="ch-06" …>` after `ch-05` in `landing-page.tsx`. Run the tests → PASS. Smoke check in `npx next dev` at 1440px and 375px: hover tooltips appear, no console errors, no horizontal scroll.
- [ ] **Step 5: Commit** `feat(home): ageing chapter`.

### Task 8: Chapter 07 charts

**Files:** Create `jobs-chapter.tsx`, `waffle-chart.tsx`, `waffle-engine.ts`, `regions-chart.tsx`, `regions-engine.ts`; Modify `chart-tips.ts`, `landing-page.tsx`, `landing.json`; Test `tests/landing/chapters/jobs-chapter.test.tsx`.

**Interfaces:** Consumes `YouthJobsChapter`. Produces `JobsChapter({ data, labels })`, and `WaffleChart({ split, labels })` used twice.

- [ ] **Step 1: Failing tests:** both grids' keys show `47/8/45` and `35/12/53` with counts `1.39 მლნ`, `224 ათასი`, `1.35 მლნ`, `195 ათასი`, `66 ათასი`, `298 ათასი`; the regions `aria-label` names the highest and lowest; the tips for waffle and region match the board (region foot: difference from Georgia in pp).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Port `createWaffle` (square, max 290px; `.fx-waf-row` 2 columns from 520px; `.fx-wafs` 2 columns from 1000px) and `createReg` (dashed accent line at the national rate, labels above rows below 560px; axis top = next multiple of 5 above the max rate).
- [ ] **Step 4:** Add `<Chapter id="ch-07" …>`. Tests → PASS; dev smoke check as in Task 7.
- [ ] **Step 5: Commit** `feat(home): youth unemployment chapter`.

### Task 9: Chapter 08 charts

**Files:** Create `wages-chapter.tsx`, `dumbbell-chart.tsx`, `dumbbell-engine.ts`; Modify `chart-tips.ts`, `landing-page.tsx`, `landing.json`; Test `tests/landing/chapters/wages-chapter.test.tsx`.

**Interfaces:** Consumes `WageGapChapter`, `sparkPoints` (`canvas.ts`). Produces `WagesChapter({ data, labels })`.

- [ ] **Step 1: Failing tests:** cards `2 165 ₾` (note with the first year's `13.5 ₾`), `1 531 ₾`, `67%` (note `1 743 ₾` and `2 587 ₾`), `1 895 ₾` (note `2 301 ₾`); the average card holds an inline `<svg>` sparkline whose polyline has one point per history year; the dumbbell `aria-label` names the sector with the largest gap; the dumbbell tip has men, women and average rows.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** The sparkline is a server-rendered SVG (92px tall, `sparkPoints`), not a canvas, because the board's spark has no tooltip. Port `createDumb`: rows from `sectors` order, axis top = next 2,000 above the max, ratio on the right, labels above rows below 640px. Layout `.fx-g75.fx-g84` (8/4 from 1000px).
- [ ] **Step 4:** Add `<Chapter id="ch-08" …>`. Tests → PASS; dev smoke check.
- [ ] **Step 5: Commit** `feat(home): wages chapter`.

### Task 10: Chapter 09 charts

**Files:** Create `trade-chapter.tsx`, `butterfly-chart.tsx`, `butterfly-engine.ts`, `trade-lines-chart.tsx`, `trade-lines-engine.ts`; Modify `chart-tips.ts`, `landing-page.tsx`, `landing.json`; Test `tests/landing/chapters/trade-chapter.test.tsx`.

**Interfaces:** Consumes `TradeChapter`, `yearRange`, `pointIndexAt`. Produces `TradeChapter({ data, labels })` (component file name `trade-chapter.tsx`; import the type as `TradeChapterModel` to avoid the name clash).

- [ ] **Step 1: Failing tests:** cards `25.9 მლრდ $`, `−11.4 მლრდ $` (note `2.6`-times), and the largest-product card label `უმსხვილესი საექსპორტო საქონელი` with `38.6%` and the second product's name in the note; the butterfly `aria-label` lists the 10 partners in order; tips for butterfly (turnover, exports, imports, balance) and lines (both values and balance).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Port `createBfly` (400px, 340px below 768px; axis top = next whole billion above the max side) and `createTradeLines` on a lines engine (340px; deficit fill `rgba(accent,.14)`, "deficit" label at the widest gap). Use `.fx-g75`, with `.fx-trio` cards below (3 columns from 700px).
- [ ] **Step 4:** Add `<Chapter id="ch-09" …>`. Tests → PASS; dev smoke check.
- [ ] **Step 5: Commit** `feat(home): trade chapter`.

### Task 11: Chapter 10 unit chart

**Files:** Create `deaths-chapter.tsx`, `unit-chart.tsx`, `unit-engine.ts`; Modify `chart-tips.ts`, `landing-page.tsx`, `landing.json`; Test `tests/landing/chapters/deaths-chapter.test.tsx`.

**Interfaces:** Consumes `DeathsChapter`. Produces `DeathsChapter` component (import the type as `DeathsChapterModel`), and `unitLayout(width: number, counts: number[], measure: (s: string) => number, names: string[]): { narrow: boolean; perRow: number; rows: { top: number; lines: string[] }[]; height: number }` exported from `unit-engine.ts` for testing.

- [ ] **Step 1: Failing tests:** the legend shows `= 100 გარდაცვლილი` and the hollow "cause not established" key; the `aria-label` lists the top three groups with counts; `unitLayout` squares per group = `round(count/100)` (circulatory 167), `perRow` is a multiple of 10, `height` grows when narrow (<640px); the tip shows count, share and squares.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Port `createUnits`. The wrapper height follows `unitLayout().height`. Colours: `top` accent, `established` ink, `other` `--control`, `unknown` hollow `--control` stroke.
- [ ] **Step 4:** Add `<Chapter id="ch-10" …>`. Tests → PASS; dev smoke check.
- [ ] **Step 5: Commit** `feat(home): causes-of-death chapter`.

### Task 12: Browser tests, design doc and proofread list

**Files:** Modify `apps/web/tests/browser/landing.spec.ts`, `DESIGN.md` §19; Create `/mnt/project-files/homepage-redesign-step2/notes-for-duru.md`.

- [ ] **Step 1: Extend `landing.spec.ts`:**
  - `homepage sections appear in the approved order` now lists `#ch-01 … #ch-10, #sources, #ai` (ka and en).
  - `society chapter headings link to their explorer pages` (five hrefs, both locales).
  - `stat cards show data numbers` (ka: `108.8`, `25.4%` in the lede, `2 165`, `25.9`, `44 319`).
  - `hovering each society chart shows a tooltip` (pyramid, births map, waffle, regions, dumbbell, butterfly, lines, unit chart).
  - The existing reduced-motion, 375/390px overflow, console-error and axe tests cover the new sections without change; check that they do.
- [ ] **Step 2:** Build and serve once (CLAUDE.md recipe, port 3100), run `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/landing.spec.ts` → all pass.
- [ ] **Step 3:** Add the five chapters and the new colours to `DESIGN.md` §19. Write the proofread list: every new ka and en string by section, plus the explorer labels shown here (sector, region, cause names), noting that long sector names are cut with "…" on desktop.
- [ ] **Step 4: Commit** `test(home): browser coverage for the society chapters; docs`.

### Task 13: Preview for Duru, then delivery

- [ ] **Step 1:** With the 3100 server, screenshot `/` and `/en` at 1440×900 (the five new sections) and 375×812 into `/mnt/project-files/homepage-redesign-step2/screenshots/`. Stop the server group.
- [ ] **Step 2:** Post the screenshots with a decision card ("Clickable preview" / "Screenshots are enough" / "Looks good, go ahead"). Push the branch only after Duru picks the preview. No PR yet.
- [ ] **Step 3:** After Duru's OK: merge `origin/main` (step 1 must be on main first), run `npm run check`, `npm run build` and the full `npm run test:browser` against the built server, open the PR with the attribution block, assign DuruMakh and request their review, and subscribe to PR activity. Merge only on Duru's go, once CI is green and the coordinator says it is this PR's turn.
