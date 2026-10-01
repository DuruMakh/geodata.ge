# Inflation City Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single inflation cities page into a Georgia comparison page (total only) plus six per-city pages chosen through a heading picker, annual inflation only, with the category `<select>` and the y/y–m/m tabs removed.

**Architecture:** One client component, `InflationCities`, renders both page kinds from a serializable `CityView` prop (`{ kind: "georgia" }` or `{ kind: "city", cityId }`). A view decides what a "line" is: on the Georgia page a line is a place on the total (`country.georgia`, `city.*`); on a city page it is one of that city's 13 series (`cpi.headline`, `cpi.cat.01`–`12`). All state, hash, coverage, table and workbook logic takes the view. New static routes `/explorer/inflation/cities/[city]` (ka and en) render the city pages; a new `CityPicker` copies `RegionPicker`'s anatomy.

**Tech Stack:** Next.js 16 static pages (App Router, `generateStaticParams`, `dynamicParams = false`), strict TypeScript, Tailwind v4 editorial components, Vitest, Playwright (local Edge), `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md` (amends `docs/superpowers/specs/2026-09-26-inflation-cities-design.md`). Read both.

## Global Constraints

- Work on the existing branch `claude/cities-inflation-tasks-78945d` in this worktree. Never push, never merge. Never use bare `git stash`.
- Commit messages end with `Co-Authored-By: Claude <your model name> <noreply@anthropic.com>`.
- All commands run in `apps/web` unless a path says otherwise.
- Files touched here are LF-only UTF-8. Do not convert line endings; after editing JSON or docs, check `git diff --stat` shows only the lines you meant.
- The MCP, the publications, the data pipeline, the CSVs and the Prisma schema are **not** changed. `npx vitest run tests/factQuery/reference.test.ts` must stay green untouched; a failure there is a stop condition — report it, do not edit the fixture.
- Annual inflation (`yoy_pct`) only on the pages; `avg12_pct` only feeds the table and workbook `წლის საშუალო` column for a total line. No page payload carries `mom_pct`.
- Georgia page: seven lines (`country.georgia` first, in ink, then the six cities in Geostat's order), all selected by default. City page: `cpi.headline` (label `სულ`) plus the 12 divisions, only `cpi.headline` selected by default.
- City colours stay as built (`SERIES_COLORS`); on a city page the total is `INK` and divisions use `categoryColor(categoryId)`.
- Differences shown in indicators subtract the printed one-decimal figures (`displayedValue`), never full precision.
- `RegionPicker` and `EntityPicker` are not modified.
- Feedback loop: `npx vitest run <file>` and `npm run typecheck` while working. Full gates (`npm run check`, `npm run build`, `npm run test:browser`) run once, in Task 6.

## File map

| File | Responsibility | Task |
| --- | --- | --- |
| `lib/explorer/inflationCityRoutes.ts` (new) | `CityView`, `CITIES_PATH`, slugs, hrefs, neighbours | 1 |
| `lib/explorer/inflationCityIndicators.ts` (new) | Georgia-page indicators (moved) and city-page indicators (new) | 1, 2 |
| `lib/explorer/inflationCityLabels.ts` | view-aware line labels and colours | 1, 2 |
| `lib/explorer/inflationCities.ts` | view-aware state, hash, coverage, lines, table options, averages | 2 |
| `lib/explorer/inflationCityWorkbook.ts` | view-aware Excel model | 2 |
| `components/inflation/inflation-cities.tsx` | the page component for both views | 2, 3, 4 |
| `components/inflation/inflation-city-panel.tsx`, `inflation-city-table.tsx`, `inflation-city-indicators.tsx` | view-aware panel and table; Georgia indicators | 2 |
| `components/inflation/inflation-city-category-select.tsx` | deleted | 2 |
| `components/inflation/city-picker.tsx` (new) | the heading picker dialog | 3 |
| `components/inflation/inflation-city-heading.tsx` (new) | H1 with trigger and previous/next links | 3 |
| `components/inflation/inflation-city-category-indicators.tsx` (new) | city-page indicators block | 4 |
| `lib/pages/inflation.tsx` | per-page payloads, city metadata, static params, rendering | 4 |
| `app/(ka)/explorer/inflation/cities/[city]/page.tsx`, `app/(en)/en/explorer/inflation/cities/[city]/page.tsx` (new) | routes | 4 |
| `lib/seo/sitemap.ts`, `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json`, `components/shell/data-sidebar.tsx` | route registration | 4 |
| `lib/i18n/messages/{ka,en}/inflation.json` | new and changed strings | 1, 2, 3, 4 |
| `tests/browser/inflation-cities.spec.ts` | rewritten | 5 |
| `DESIGN.md`, `Project_Definition.md`, `docs/data-methodology/inflation-cpi-national.md`, `lib/methodology/content/{,en/}inflation.ts`, `public/llms.txt` | documents | 6 |

---

### Task 1: Routes, view type, view labels and the indicators module

**Files:**
- Create: `apps/web/lib/explorer/inflationCityRoutes.ts`
- Create: `apps/web/lib/explorer/inflationCityIndicators.ts`
- Modify: `apps/web/lib/explorer/inflationCities.ts` (remove `CityRate`, `CityIndicators`, `SPARK_MONTHS`, `latestCityIndicators` — moved)
- Modify: `apps/web/lib/explorer/inflationCityLabels.ts`
- Modify: `apps/web/lib/explorer/inflationHubCards.ts:10` (import path)
- Modify: `apps/web/components/inflation/inflation-city-indicators.tsx:6` (import path)
- Modify: `apps/web/lib/i18n/messages/ka/inflation.json`, `apps/web/lib/i18n/messages/en/inflation.json`
- Create: `apps/web/tests/explorer/inflationCityRoutes.test.ts`
- Create: `apps/web/tests/explorer/inflationCityIndicators.test.ts`
- Modify: `apps/web/tests/explorer/inflationCities.test.ts` (move the `latestCityIndicators` describe block out)

**Interfaces:**
- Produces:
  - `inflationCityRoutes.ts`: `type CityView = { kind: "georgia" } | { kind: "city"; cityId: CpiCityId }`; `GEORGIA_VIEW: CityView`; `CITIES_PATH = "/explorer/inflation/cities"`; `citySlug(cityId: CpiCityId): string`; `cityPageHref(cityId: CpiCityId): string`; `cityIdForSlug(slug: string): CpiCityId | null`; `neighbourCities(cityId: CpiCityId): { previous: CpiCityId; next: CpiCityId }`; `CITY_PAGE_PATHS: string[]`.
  - `inflationCityIndicators.ts`: `latestCityIndicators(index: CityIndex, category: string): CityIndicators | null` (moved unchanged; Task 2 drops `category`), types `CityRate`, `CityIndicators`; `latestCityCategoryIndicators(index: CityIndex, cityId: CpiCityId): CityCategoryIndicators | null`, types `CityCategoryRate`, `CityCategoryIndicators`.
  - `inflationCityLabels.ts`: `cityPlaceLabel(messages, view)`, `cityViewLineLabel(messages, view, lineId)`, `cityViewLineColor(view, lineId)`.
  - Messages: `inflation.cityCategoryVsNational`.

- [ ] **Step 1: Write the failing routes test**

`apps/web/tests/explorer/inflationCityRoutes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CITIES_PATH, CITY_PAGE_PATHS, cityIdForSlug, cityPageHref, citySlug, neighbourCities } from "../../lib/explorer/inflationCityRoutes";

describe("inflation city routes", () => {
  it("builds one page per city under the cities path", () => {
    expect(CITIES_PATH).toBe("/explorer/inflation/cities");
    expect(citySlug("city.batumi")).toBe("batumi");
    expect(cityPageHref("city.batumi")).toBe("/explorer/inflation/cities/batumi");
    expect(CITY_PAGE_PATHS).toEqual([
      "/explorer/inflation/cities/tbilisi",
      "/explorer/inflation/cities/kutaisi",
      "/explorer/inflation/cities/batumi",
      "/explorer/inflation/cities/gori",
      "/explorer/inflation/cities/telavi",
      "/explorer/inflation/cities/zugdidi",
    ]);
  });

  it("maps slugs back to city IDs and refuses anything else", () => {
    expect(cityIdForSlug("zugdidi")).toBe("city.zugdidi");
    expect(cityIdForSlug("georgia")).toBeNull();
    expect(cityIdForSlug("rustavi")).toBeNull();
  });

  it("walks the cities in Geostat's order and wraps at both ends", () => {
    expect(neighbourCities("city.batumi")).toEqual({ previous: "city.kutaisi", next: "city.gori" });
    expect(neighbourCities("city.tbilisi").previous).toBe("city.zugdidi");
    expect(neighbourCities("city.zugdidi").next).toBe("city.tbilisi");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/explorer/inflationCityRoutes.test.ts`
Expected: FAIL — cannot resolve `../../lib/explorer/inflationCityRoutes`.

- [ ] **Step 3: Create the routes module**

`apps/web/lib/explorer/inflationCityRoutes.ts`:

```ts
import { CPI_CITY_IDS, type CpiCityId } from "../data/inflation/types";

// The cities section is a Georgia page plus one page per city
// (docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md §2).
// A view names which of those pages is rendering.

export type CityView = { kind: "georgia" } | { kind: "city"; cityId: CpiCityId };
export const GEORGIA_VIEW: CityView = { kind: "georgia" };

export const CITIES_PATH = "/explorer/inflation/cities";

export function citySlug(cityId: CpiCityId): string {
  return cityId.slice("city.".length);
}

export function cityPageHref(cityId: CpiCityId): string {
  return `${CITIES_PATH}/${citySlug(cityId)}`;
}

export function cityIdForSlug(slug: string): CpiCityId | null {
  return CPI_CITY_IDS.find((cityId) => citySlug(cityId) === slug) ?? null;
}

/** Previous and next city in Geostat's order, wrapping, as region pages do. */
export function neighbourCities(cityId: CpiCityId): { previous: CpiCityId; next: CpiCityId } {
  const position = CPI_CITY_IDS.indexOf(cityId);
  const count = CPI_CITY_IDS.length;
  return { previous: CPI_CITY_IDS[(position - 1 + count) % count]!, next: CPI_CITY_IDS[(position + 1) % count]! };
}

export const CITY_PAGE_PATHS: string[] = CPI_CITY_IDS.map(cityPageHref);
```

- [ ] **Step 4: Run the routes test**

Run: `npx vitest run tests/explorer/inflationCityRoutes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Move the Georgia indicators into their own module**

Create `apps/web/lib/explorer/inflationCityIndicators.ts` and move, byte for byte, from `lib/explorer/inflationCities.ts`: the `CityRate` and `CityIndicators` types, `const SPARK_MONTHS = 36;`, and the whole `latestCityIndicators` function with its doc comment. Delete them from `inflationCities.ts`. The new file's header:

```ts
import type { CpiCityId } from "../data/inflation/types";
import { CITY_CATEGORIES, GEORGIA_LINE_ID, HEADLINE_ID, cityValues, type CityIndex } from "./inflationCities";
import { displayedValue } from "./inflationGrid";
import { periodBounds } from "./periodRange";

// ძირითადი ინდიკატორები for the cities pages: the latest published month, year on
// year. Differences argue from the printed one-decimal figures, so a reader's own
// subtraction always agrees with the page.
```

In `inflationCities.ts`, remove `displayedValue` from the `./inflationGrid` import if nothing else there uses it (only `decemberAverages` remains), and `periodBounds` stays (coverage uses it).

Update the two importers:
- `lib/explorer/inflationHubCards.ts:10` → `import { buildCityIndex } from "./inflationCities";` and `import { latestCityIndicators } from "./inflationCityIndicators";`
- `components/inflation/inflation-city-indicators.tsx:6` → `import { type CityIndex } from "../../lib/explorer/inflationCities";` and `import { latestCityIndicators } from "../../lib/explorer/inflationCityIndicators";`

Move the `describe("latestCityIndicators", …)` block (four tests) from `tests/explorer/inflationCities.test.ts` into a new `tests/explorer/inflationCityIndicators.test.ts` with these imports, and remove `latestCityIndicators` from the old file's import list:

```ts
import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import { buildCityIndex } from "../../lib/explorer/inflationCities";
import { latestCityIndicators } from "../../lib/explorer/inflationCityIndicators";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const index = buildCityIndex(fixtureCityFacts);
```

Run: `npx vitest run tests/explorer/inflationCityIndicators.test.ts tests/explorer/inflationCities.test.ts tests/explorer/inflationHub.test.ts && npm run typecheck`
Expected: the moved Georgia tests pass and typecheck is clean.

- [ ] **Step 6: Write the failing city-indicator tests**

In `tests/explorer/inflationCityIndicators.test.ts`, change the indicators import to `import { latestCityCategoryIndicators, latestCityIndicators } from "../../lib/explorer/inflationCityIndicators";`, add `import type { CityFactInput } from "../../lib/data/inflation/types";`, and append:

```ts
// Batumi in August 2026 with four divisions, and Georgia's rates for the same month.
const AUGUST = "2026-08";
const batumi = (seriesId: string, value: number): CityFactInput => ({ lineId: "city.batumi", seriesId, measure: "yoy_pct", period: AUGUST, value });
const georgia = (seriesId: string, value: number): CityFactInput => ({ lineId: "country.georgia", seriesId, measure: "yoy_pct", period: AUGUST, value });
const cityFacts: CityFactInput[] = [
  batumi("cpi.headline", 7.0857),
  batumi("cpi.cat.01", 9.46),
  batumi("cpi.cat.02", 3.04),
  batumi("cpi.cat.05", -0.38),
  batumi("cpi.cat.07", 1.2),
  georgia("cpi.headline", 5.6479),
  georgia("cpi.cat.01", 8.04),
  georgia("cpi.cat.05", -1.02),
];

describe("latestCityCategoryIndicators", () => {
  const latest = latestCityCategoryIndicators(buildCityIndex(cityFacts), "city.batumi")!;

  it("reports the city's total against Georgia from the printed figures", () => {
    expect(latest.period).toBe(makePeriod(2026, 8));
    expect(latest.total).toMatchObject({ value: 7.0857, national: 5.6479, deltaPp: 1.5 });
  });

  it("names the fastest and slowest division with their distance from Georgia's same division", () => {
    expect(latest.fastest).toMatchObject({ categoryId: "cpi.cat.01", value: 9.46, deltaPp: 1.5 });
    expect(latest.slowest).toMatchObject({ categoryId: "cpi.cat.05", deltaPp: 0.6, fell: true });
  });

  it("leaves the distance empty when Georgia has no figure for that division", () => {
    const withoutGeorgia = latestCityCategoryIndicators(buildCityIndex(cityFacts.filter((fact) => fact.seriesId !== "cpi.cat.01" || fact.lineId !== "country.georgia")), "city.batumi")!;
    expect(withoutGeorgia.fastest.deltaPp).toBeNull();
  });

  it("counts divisions whose printed rate is above zero", () => {
    expect(latest.breadth).toMatchObject({ rose: 3, total: 4 });
  });

  it("says prices fell only when the printed rate is negative", () => {
    const nearZero = latestCityCategoryIndicators(buildCityIndex(cityFacts.map((fact) => (fact.seriesId === "cpi.cat.05" && fact.lineId === "city.batumi" ? { ...fact, value: -0.03 } : fact))), "city.batumi")!;
    expect(nearZero.slowest.fell).toBe(false);
    expect(nearZero.breadth.rose).toBe(3);
  });

  it("breaks ties by COICOP order, as the Categories page does", () => {
    const tied = latestCityCategoryIndicators(buildCityIndex([...cityFacts.filter((fact) => fact.seriesId !== "cpi.cat.02"), batumi("cpi.cat.02", 9.46)]), "city.batumi")!;
    expect(tied.fastest.categoryId).toBe("cpi.cat.01");
  });

  it("returns null for a city with no divisions", () => {
    expect(latestCityCategoryIndicators(buildCityIndex(cityFacts), "city.gori")).toBeNull();
  });
});
```

The arithmetic uses printed figures: 7.1 − 5.6 = 1.5 for the total; 9.5 − 8.0 = 1.5 for food (full precision would give 1.42); −0.4 − (−1.0) = 0.6 for furnishings.

- [ ] **Step 7: Run to see them fail**

Run: `npx vitest run tests/explorer/inflationCityIndicators.test.ts`
Expected: FAIL — `latestCityCategoryIndicators` is not exported.

- [ ] **Step 8: Implement `latestCityCategoryIndicators`**

Append to `lib/explorer/inflationCityIndicators.ts`:

```ts
export type CityCategoryRate = { categoryId: string; value: number; deltaPp: number | null };
export type CityCategoryIndicators = {
  period: number;
  /** The city's total with Georgia's beside it; null if the city has no total that month. */
  total: { value: number; national: number | null; deltaPp: number | null } | null;
  fastest: CityCategoryRate;
  /** `fell` follows the printed rate, so −0.03 (shown 0.0%) never reads as a fall. */
  slowest: CityCategoryRate & { fell: boolean };
  breadth: { rose: number; total: number; spark: Array<number | null> };
};

const printedDelta = (value: number, national: number | undefined): number | null =>
  national === undefined ? null : displayedValue(displayedValue(value) - displayedValue(national));

/**
 * Spec 2026-09-30 §5: a city page's indicators — the city's total against Georgia,
 * then the Categories page's three rate questions over the city's own divisions.
 * Each division is compared with Georgia's same division. Ties keep COICOP order.
 */
export function latestCityCategoryIndicators(index: CityIndex, cityId: CpiCityId): CityCategoryIndicators | null {
  const divisions = CITY_CATEGORIES.slice(1).flatMap((categoryId) => {
    const values = cityValues(index, cityId, categoryId, "yoy_pct");
    return values ? [{ categoryId, values }] : [];
  });
  if (divisions.length === 0) return null;
  const period = periodBounds(divisions.map((entry) => entry.values), "City data has no periods").max;
  const present = divisions.flatMap((entry) => {
    const value = entry.values.get(period);
    return value === undefined ? [] : [{ categoryId: entry.categoryId, value }];
  });
  if (present.length === 0) return null;
  const rate = (row: { categoryId: string; value: number }): CityCategoryRate => ({
    categoryId: row.categoryId,
    value: row.value,
    deltaPp: printedDelta(row.value, cityValues(index, GEORGIA_LINE_ID, row.categoryId, "yoy_pct")?.get(period)),
  });
  const ranked = [...present].sort((a, b) => b.value - a.value);
  const slowest = ranked.at(-1)!;
  const totalNow = cityValues(index, cityId, HEADLINE_ID, "yoy_pct")?.get(period);
  const nationalTotal = cityValues(index, GEORGIA_LINE_ID, HEADLINE_ID, "yoy_pct")?.get(period);
  const window = Array.from({ length: SPARK_MONTHS }, (_, offset) => period - SPARK_MONTHS + 1 + offset);
  return {
    period,
    total: totalNow === undefined ? null : { value: totalNow, national: nationalTotal ?? null, deltaPp: printedDelta(totalNow, nationalTotal) },
    fastest: rate(ranked[0]!),
    slowest: { ...rate(slowest), fell: displayedValue(slowest.value) < 0 },
    breadth: {
      rose: present.filter((row) => displayedValue(row.value) > 0).length,
      total: present.length,
      spark: window.map((month) => {
        const rows = divisions.flatMap((entry) => {
          const value = entry.values.get(month);
          return value === undefined ? [] : [value];
        });
        return rows.length === 0 ? null : rows.filter((value) => displayedValue(value) > 0).length;
      }),
    },
  };
}
```

`Array.prototype.sort` is stable, so equal values keep `CITY_CATEGORIES` order: the first tied division is `fastest`, the last tied division is `slowest`.

- [ ] **Step 9: Add the view-aware label helpers**

In `lib/explorer/inflationCityLabels.ts` add (keep every existing export):

```ts
import { categoryColor, categoryLabel } from "./inflationCategoryLabels";
import { GEORGIA_LINE_ID, HEADLINE_ID } from "./inflationCities";
import type { CityView } from "./inflationCityRoutes";

/** The picker's place name: საქართველო on the Georgia page, else the city. */
export function cityPlaceLabel(messages: Messages, view: CityView): string {
  return cityLineLabel(messages, view.kind === "georgia" ? GEORGIA_LINE_ID : view.cityId);
}

/** A line is a place on the Georgia page and a series on a city page. */
export function cityViewLineLabel(messages: Messages, view: CityView, lineId: string): string {
  return view.kind === "georgia" ? cityLineLabel(messages, lineId) : cityCategoryLabel(messages, lineId);
}

/** Cities keep their colours; on a city page the total is ink and divisions wear the Categories page's colours. */
export function cityViewLineColor(view: CityView, lineId: string): string {
  if (view.kind === "georgia") return cityLineColor(lineId);
  return lineId === HEADLINE_ID ? INK : categoryColor(lineId);
}
```

(Merge `categoryColor` into the existing `import { categoryLabel } from "./inflationCategoryLabels";` line.) Add to `tests/explorer/inflationCityRoutes.test.ts`:

```ts
import { cityPlaceLabel, cityViewLineColor, cityViewLineLabel } from "../../lib/explorer/inflationCityLabels";
import { INK, SERIES_COLORS } from "../../lib/explorer/colors";
import inflation from "../../lib/i18n/messages/en/inflation.json";

describe("view labels", () => {
  const messages = inflation as Record<string, string>;
  it("names the place and the lines for each view", () => {
    expect(cityPlaceLabel(messages, { kind: "georgia" })).toBe("Georgia");
    expect(cityPlaceLabel(messages, { kind: "city", cityId: "city.batumi" })).toBe("Batumi");
    expect(cityViewLineLabel(messages, { kind: "georgia" }, "city.gori")).toBe("Gori");
    expect(cityViewLineLabel(messages, { kind: "city", cityId: "city.gori" }, "cpi.headline")).toBe("Total");
  });
  it("colours the total ink on a city page and keeps city colours on the Georgia page", () => {
    expect(cityViewLineColor({ kind: "city", cityId: "city.gori" }, "cpi.headline")).toBe(INK);
    expect(cityViewLineColor({ kind: "city", cityId: "city.gori" }, "cpi.cat.01")).toBe(SERIES_COLORS["cpi.cat.01"]);
    expect(cityViewLineColor({ kind: "georgia" }, "city.batumi")).toBe("#1F6E56");
  });
});
```

If `Messages` rejects a plain JSON object, build it the way `tests/explorer/inflationCityWorkbook.test.ts` does: `const messages = await getMessages("en", ["inflation"]);` inside an `async` test.

- [ ] **Step 10: Add the new message**

In both `lib/i18n/messages/ka/inflation.json` and `lib/i18n/messages/en/inflation.json`, directly after the `"inflation.cityColumn"` line, add:

- ka: `"inflation.cityCategoryVsNational": "{category} · საქართველოს იმავე ჯგუფთან {delta} პპ",`
- en: `"inflation.cityCategoryVsNational": "{category} · {delta} pp against Georgia's same group",`

- [ ] **Step 11: Run the task's checks**

Run: `npx vitest run tests/explorer/inflationCityRoutes.test.ts tests/explorer/inflationCityIndicators.test.ts tests/explorer/inflationCities.test.ts tests/explorer/inflationHub.test.ts tests/explorer/inflationCitiesRender.test.tsx && npm run typecheck && npx eslint lib/explorer/inflationCity*.ts lib/explorer/inflationCities.ts lib/explorer/inflationHubCards.ts components/inflation/inflation-city-indicators.tsx tests/explorer/inflationCity*.ts`
Expected: all pass, no type or lint errors.

- [ ] **Step 12: Commit**

```bash
git add lib/explorer/inflationCityRoutes.ts lib/explorer/inflationCityIndicators.ts lib/explorer/inflationCities.ts lib/explorer/inflationCityLabels.ts lib/explorer/inflationHubCards.ts components/inflation/inflation-city-indicators.tsx lib/i18n/messages/ka/inflation.json lib/i18n/messages/en/inflation.json tests/explorer/inflationCityRoutes.test.ts tests/explorer/inflationCityIndicators.test.ts tests/explorer/inflationCities.test.ts
git commit -m "feat(inflation): add city page routes, view labels and city indicators"
```

---

### Task 2: One view-aware cities page — remove the tabs, the monthly measure and the category select

**Files:**
- Rewrite: `apps/web/lib/explorer/inflationCities.ts`
- Modify: `apps/web/lib/explorer/inflationCityIndicators.ts` (drop `latestCityIndicators`'s `category` parameter)
- Modify: `apps/web/lib/explorer/inflationCityLabels.ts` (`formatCityValue` loses its `tab` parameter)
- Rewrite: `apps/web/lib/explorer/inflationCityWorkbook.ts`
- Rewrite: `apps/web/components/inflation/inflation-cities.tsx`
- Rewrite: `apps/web/components/inflation/inflation-city-panel.tsx`, `apps/web/components/inflation/inflation-city-table.tsx`
- Modify: `apps/web/components/inflation/inflation-city-indicators.tsx`
- Delete: `apps/web/components/inflation/inflation-city-category-select.tsx`
- Modify: `apps/web/lib/explorer/inflationHubCards.ts:74`
- Modify: `apps/web/lib/pages/inflation.tsx` (pass `view={GEORGIA_VIEW}`; stop shipping `mom_pct`)
- Modify: `apps/web/lib/i18n/messages/{ka,en}/inflation.json` (delete `inflation.cityCategoryLabel`; reword `inflation.citiesDescription`)
- Rewrite: `apps/web/tests/explorer/inflationCities.test.ts`, `apps/web/tests/explorer/inflationCitiesRender.test.tsx`, `apps/web/tests/explorer/inflationCityWorkbook.test.ts`
- Modify: `apps/web/tests/explorer/inflationCityIndicators.test.ts` (drop the category argument)

**Interfaces:**
- Consumes (Task 1): `CityView`, `GEORGIA_VIEW`, `CITIES_PATH`, `citySlug`, `cityPlaceLabel`, `cityViewLineLabel`, `cityViewLineColor`.
- Produces (`inflationCities.ts`): `GEORGIA_LINE_ID`, `HEADLINE_ID`, `CITY_LINE_IDS`, `CityLineId`, `CITY_CATEGORIES`, `CityState = { mode; range; selected: string[]; tableSeries: string | null }`, `defaultCityState(view)`, `cityViewLineIds(view)`, `cityLineSource(view, lineId): { entityId: string; seriesId: string }`, `cityLineSlug(view, lineId)`, `packCityFacts`, `unpackCityFacts`, `buildCityIndex`, `cityValues`, `cityCoverage(index, view)`, `resolveCityRange(state, index, view)`, `restoreCityState(hash, index, view)`, `rangeFromPatch`, `toggleCityLine(state, view, lineId)`, `toggleAllCityLines(state, view)`, `buildCityLines(index, view, state, range)`, `cityPanelValue(index, view, lineId, range)`, `cityTableOptions(index, view, state)`, `effectiveCityTableSeries(index, view, state)`, `cityAnnualAverages(index, view, lineId)`, `parseCityHash(hash, view)`, `serializeCityHash(state, view)`, types `CityIndex`, `PackedCitySeries`, `ResolvedPeriodRange`; re-export `type CityView`.
- Produces: `latestCityIndicators(index: CityIndex): CityIndicators | null`; `formatCityValue(value: number): string`; `buildInflationCityWorkbookExportModel({ index, view, state, range, presentation, sources, siteOrigin })`; `InflationCities` props `{ view: CityView; facts; lastReviewedAt; sources; siteOrigin }`.

- [ ] **Step 1: Rewrite the state tests (failing)**

Replace `tests/explorer/inflationCities.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import type { CityFactInput } from "../../lib/data/inflation/types";
import {
  CITY_CATEGORIES,
  CITY_LINE_IDS,
  buildCityIndex,
  buildCityLines,
  cityAnnualAverages,
  cityCoverage,
  defaultCityState,
  effectiveCityTableSeries,
  packCityFacts,
  parseCityHash,
  resolveCityRange,
  restoreCityState,
  serializeCityHash,
  toggleAllCityLines,
  toggleCityLine,
  unpackCityFacts,
} from "../../lib/explorer/inflationCities";
import { GEORGIA_VIEW, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const index = buildCityIndex(fixtureCityFacts);
const BATUMI: CityView = { kind: "city", cityId: "city.batumi" };

describe("Georgia page state", () => {
  it("defaults to the chart, the full range and all seven lines, Georgia first", () => {
    expect(defaultCityState(GEORGIA_VIEW)).toEqual({ mode: "chart", range: { kind: "all" }, selected: [...CITY_LINE_IDS], tableSeries: null });
    expect(CITY_LINE_IDS[0]).toBe("country.georgia");
  });

  it("round-trips the facts through the packed wire form", () => {
    expect(unpackCityFacts(packCityFacts(fixtureCityFacts))).toHaveLength(fixtureCityFacts.length);
  });

  it("draws each selected place's annual total", () => {
    const state = defaultCityState(GEORGIA_VIEW);
    const { lines } = buildCityLines(index, GEORGIA_VIEW, state, resolveCityRange(state, index, GEORGIA_VIEW));
    expect(lines.map((line) => line.key)).toEqual([...CITY_LINE_IDS]);
    expect(lines.find((line) => line.key === "city.batumi")!.values.at(-1)).toBeCloseTo(7.0857, 4);
  });

  it("keeps Georgia first and removable when toggling", () => {
    const without = toggleCityLine(defaultCityState(GEORGIA_VIEW), GEORGIA_VIEW, "country.georgia");
    expect(without.selected[0]).toBe("city.tbilisi");
    expect(toggleCityLine(without, GEORGIA_VIEW, "country.georgia").selected[0]).toBe("country.georgia");
    expect(toggleAllCityLines(defaultCityState(GEORGIA_VIEW), GEORGIA_VIEW).selected).toEqual([]);
  });

  it("gives every line the annual average, since every line is a total", () => {
    expect(cityAnnualAverages(index, GEORGIA_VIEW, "city.batumi")?.get(2025)).toBe(4.1);
  });

  it("round-trips the hash with place slugs and ignores the retired tab and category keys", () => {
    const state = { ...defaultCityState(GEORGIA_VIEW), mode: "table" as const, selected: ["country.georgia", "city.batumi"], tableSeries: "city.batumi" };
    const hash = serializeCityHash(state, GEORGIA_VIEW);
    expect(hash).toContain("sel=georgia%2Cbatumi");
    expect(hash).not.toMatch(/(^|&)(i|c)=/);
    expect(parseCityHash(`#${hash}`, GEORGIA_VIEW)).toMatchObject({ mode: "table", selected: ["country.georgia", "city.batumi"], tableSeries: "city.batumi" });
    expect(parseCityHash("#i=mom&c=07&sel=rustavi,batumi&t=rustavi", GEORGIA_VIEW)).toMatchObject({ selected: ["city.batumi"], tableSeries: null });
  });
});

describe("city page state", () => {
  const facts: CityFactInput[] = [
    ...fixtureCityFacts,
    { lineId: "city.batumi", seriesId: "cpi.cat.07", measure: "yoy_pct", period: "2026-08", value: 1.2 },
  ];
  const cityIndex = buildCityIndex(facts);

  it("selects only the total by default and offers the total plus 12 divisions", () => {
    expect(defaultCityState(BATUMI).selected).toEqual(["cpi.headline"]);
    expect(CITY_CATEGORIES).toHaveLength(13);
  });

  it("draws the city's own series", () => {
    const state = { ...defaultCityState(BATUMI), selected: ["cpi.headline", "cpi.cat.01"] };
    const { lines } = buildCityLines(cityIndex, BATUMI, state, resolveCityRange(state, cityIndex, BATUMI));
    expect(lines.map((line) => line.key)).toEqual(["cpi.headline", "cpi.cat.01"]);
    expect(lines[1]!.values.at(-1)).toBeCloseTo(5.9542, 4);
  });

  it("gives the annual average to the total only", () => {
    expect(cityAnnualAverages(cityIndex, BATUMI, "cpi.headline")?.get(2025)).toBe(4.1);
    expect(cityAnnualAverages(cityIndex, BATUMI, "cpi.cat.01")).toBeUndefined();
  });

  it("round-trips the hash with COICOP codes", () => {
    const state = { ...defaultCityState(BATUMI), selected: ["cpi.headline", "cpi.cat.07"], tableSeries: "cpi.cat.07" };
    const hash = serializeCityHash(state, BATUMI);
    expect(hash).toContain("sel=total%2C07");
    expect(hash).toContain("t=07");
    expect(parseCityHash(`#${hash}`, BATUMI)).toMatchObject({ selected: ["cpi.headline", "cpi.cat.07"], tableSeries: "cpi.cat.07" });
  });

  it("falls back to the first selected series in the table", () => {
    const state = { ...defaultCityState(BATUMI), selected: ["cpi.cat.01"] };
    expect(effectiveCityTableSeries(cityIndex, BATUMI, state)).toBe("cpi.cat.01");
  });

  it("takes coverage from that city's own series", () => {
    const zugdidi = buildCityIndex([
      { lineId: "city.zugdidi", seriesId: "cpi.headline", measure: "yoy_pct", period: "2016-12", value: 1 },
      { lineId: "city.zugdidi", seriesId: "cpi.headline", measure: "yoy_pct", period: "2026-08", value: 2 },
      { lineId: "city.tbilisi", seriesId: "cpi.headline", measure: "yoy_pct", period: "2016-01", value: 3 },
    ]);
    expect(cityCoverage(zugdidi, { kind: "city", cityId: "city.zugdidi" })).toEqual({ min: makePeriod(2016, 12), max: makePeriod(2026, 8) });
  });

  it("clamps a restored range that lies outside the coverage", () => {
    const restored = restoreCityState("#r=2030-01-2030-06", cityIndex, BATUMI);
    expect(restored.range).toEqual({ kind: "all" });
  });
});
```

Before relying on the `#r=…` form, open `lib/explorer/urlState.ts` and use the exact range syntax `parseMonthRangeKey` reads; adjust the literal if it differs.

In `tests/explorer/inflationCityIndicators.test.ts`, change every `latestCityIndicators(x, "cpi.headline")` to `latestCityIndicators(x)`, and delete the `"follows the picked category"` test (the Georgia page no longer has a category).

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/explorer/inflationCities.test.ts`
Expected: FAIL — `defaultCityState`, `restoreCityState` and the view parameters do not exist.

- [ ] **Step 3: Rewrite `lib/explorer/inflationCities.ts`**

Replace the whole file with:

```ts
import { periodFromKey, periodKey } from "../data/inflation/periods";
import { CPI_CITY_IDS, type CityFactInput, type CpiCityMeasure } from "../data/inflation/types";
import { decemberAverages } from "./inflationGrid";
import type { CityView } from "./inflationCityRoutes";
import { periodBounds, rangeFromPatch, refitRange, resolveRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseMonthRangeKey, writeMonthRangeKey } from "./urlState";

// Pure state and data selection for the inflation cities pages
// (docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md). On the
// Georgia page a line is a place on the total; on a city page it is one of that
// city's 13 series. Annual inflation only. Nothing here renders or reads the DOM.

export type { CityView };
export const GEORGIA_LINE_ID = "country.georgia";
export const HEADLINE_ID = "cpi.headline";
export const CITY_LINE_IDS = [GEORGIA_LINE_ID, ...CPI_CITY_IDS] as const;
export type CityLineId = (typeof CITY_LINE_IDS)[number];
export const CITY_CATEGORIES: readonly string[] = [HEADLINE_ID, ...Array.from({ length: 12 }, (_, index) => `cpi.cat.${String(index + 1).padStart(2, "0")}`)];

export type CityState = {
  mode: "chart" | "table";
  range: PeriodRange;
  selected: string[];
  tableSeries: string | null;
};

export function cityViewLineIds(view: CityView): readonly string[] {
  return view.kind === "georgia" ? CITY_LINE_IDS : CITY_CATEGORIES;
}

/** Which place and series a line draws. */
export function cityLineSource(view: CityView, lineId: string): { entityId: string; seriesId: string } {
  return view.kind === "georgia" ? { entityId: lineId, seriesId: HEADLINE_ID } : { entityId: view.cityId, seriesId: lineId };
}

// The Georgia page opens on all seven lines (owner decision 2026-09-26); a city
// page on its total alone, the project's default rule.
export function defaultCityState(view: CityView): CityState {
  return { mode: "chart", range: { kind: "all" }, selected: view.kind === "georgia" ? [...CITY_LINE_IDS] : [HEADLINE_ID], tableSeries: null };
}

const factKey = (lineId: string, seriesId: string, measure: string) => `${lineId}|${seriesId}|${measure}`;

export type CityIndex = { values: Map<string, Map<number, number>> };
export type { ResolvedPeriodRange };

/** Dense runs per series, as the categories page packs its facts. */
export type PackedCitySeries = { k: string; s: string; v: Array<number | null> };

export function packCityFacts(facts: CityFactInput[]): PackedCitySeries[] {
  const byKey = new Map<string, Map<number, number>>();
  for (const fact of facts) {
    const key = factKey(fact.lineId, fact.seriesId, fact.measure);
    if (!byKey.has(key)) byKey.set(key, new Map());
    byKey.get(key)!.set(periodFromKey(fact.period), fact.value);
  }
  return [...byKey].map(([k, values]) => {
    const periods = [...values.keys()].sort((a, b) => a - b);
    const start = periods[0]!;
    const end = periods.at(-1)!;
    return { k, s: periodKey(start), v: Array.from({ length: end - start + 1 }, (_, offset) => values.get(start + offset) ?? null) };
  });
}

export function unpackCityFacts(series: PackedCitySeries[]): CityFactInput[] {
  return series.flatMap(({ k, s, v }) => {
    const [lineId, seriesId, measure] = k.split("|") as [string, string, CpiCityMeasure];
    const start = periodFromKey(s);
    return v.flatMap((value, offset) => (value === null ? [] : [{ lineId, seriesId, measure, period: periodKey(start + offset), value }]));
  });
}

export function buildCityIndex(facts: CityFactInput[]): CityIndex {
  const values = new Map<string, Map<number, number>>();
  for (const fact of facts) {
    const key = factKey(fact.lineId, fact.seriesId, fact.measure);
    if (!values.has(key)) values.set(key, new Map());
    values.get(key)!.set(periodFromKey(fact.period), fact.value);
  }
  return { values };
}

export function cityValues(index: CityIndex, lineId: string, seriesId: string, measure: CpiCityMeasure): Map<number, number> | undefined {
  return index.values.get(factKey(lineId, seriesId, measure));
}

function lineValues(index: CityIndex, view: CityView, lineId: string): Map<number, number> | undefined {
  const { entityId, seriesId } = cityLineSource(view, lineId);
  return cityValues(index, entityId, seriesId, "yoy_pct");
}

/** A page's coverage: every one of its lines. Zugdidi's page therefore starts 2016-12. */
export function cityCoverage(index: CityIndex, view: CityView): { min: number; max: number } {
  return periodBounds(cityViewLineIds(view).map((lineId) => lineValues(index, view, lineId)), "City data has no periods");
}

export function resolveCityRange(state: CityState, index: CityIndex, view: CityView): ResolvedPeriodRange {
  return resolveRange(state.range, cityCoverage(index, view));
}

export { rangeFromPatch };

export function toggleCityLine(state: CityState, view: CityView, lineId: string): CityState {
  const next = state.selected.includes(lineId) ? state.selected.filter((entry) => entry !== lineId) : [...state.selected, lineId];
  return { ...state, selected: cityViewLineIds(view).filter((entry) => next.includes(entry)) };
}

export function toggleAllCityLines(state: CityState, view: CityView): CityState {
  return { ...state, selected: state.selected.length > 0 ? [] : [...cityViewLineIds(view)] };
}

export function buildCityLines(index: CityIndex, view: CityView, state: CityState, range: ResolvedPeriodRange) {
  const periods = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
  const lines = state.selected.flatMap((lineId) => {
    const values = lineValues(index, view, lineId);
    return values ? [{ key: lineId, values: periods.map((period) => values.get(period) ?? null) }] : [];
  });
  return { periods, lines };
}

export function cityPanelValue(index: CityIndex, view: CityView, lineId: string, range: ResolvedPeriodRange): number | null {
  const values = lineValues(index, view, lineId);
  if (!values) return null;
  for (let period = range.end; period >= range.start; period -= 1) {
    const value = values.get(period);
    if (value !== undefined) return value;
  }
  return null;
}

export function cityTableOptions(index: CityIndex, view: CityView, state: CityState): string[] {
  return state.selected.filter((lineId) => lineValues(index, view, lineId) !== undefined);
}

export function effectiveCityTableSeries(index: CityIndex, view: CityView, state: CityState): string | null {
  const options = cityTableOptions(index, view, state);
  return state.tableSeries !== null && options.includes(state.tableSeries) ? state.tableSeries : (options[0] ?? null);
}

/** Geostat's December 12-month average: the table's წლის საშუალო, for a total line only. */
export function cityAnnualAverages(index: CityIndex, view: CityView, lineId: string): Map<number, number> | undefined {
  const { entityId, seriesId } = cityLineSource(view, lineId);
  if (seriesId !== HEADLINE_ID) return undefined;
  return decemberAverages(cityValues(index, entityId, HEADLINE_ID, "avg12_pct"));
}

/** Short, stable hash values: place slugs on the Georgia page, `total` and COICOP codes on a city page. */
export function cityLineSlug(view: CityView, lineId: string): string {
  if (view.kind === "georgia") return lineId.split(".")[1]!;
  return lineId === HEADLINE_ID ? "total" : lineId.replace("cpi.cat.", "");
}

export function parseCityHash(hash: string, view: CityView): CityState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const ids = cityViewLineIds(view);
  const bySlug = new Map(ids.map((lineId) => [cityLineSlug(view, lineId), lineId]));
  // Unknown values — and the retired `i` and `c` keys — are dropped rather than failing the page.
  const requested = (params.get("sel") ?? "").split(",");
  return {
    mode: params.get("m") === "table" ? "table" : "chart",
    range: parseMonthRangeKey(params),
    selected: params.has("sel") ? ids.filter((lineId) => requested.includes(cityLineSlug(view, lineId))) : defaultCityState(view).selected,
    tableSeries: bySlug.get(params.get("t") ?? "") ?? null,
  };
}

/** The hash, read after hydration, with its range refitted to the page's coverage. */
export function restoreCityState(hash: string, index: CityIndex, view: CityView): CityState {
  const parsed = parseCityHash(hash, view);
  return { ...parsed, range: refitRange(parsed.range, cityCoverage(index, view), { collapseToAll: true }) };
}

export function serializeCityHash(state: CityState, view: CityView): string {
  const params = new URLSearchParams({ m: state.mode });
  writeMonthRangeKey(params, state.range);
  params.set("sel", state.selected.map((lineId) => cityLineSlug(view, lineId)).join(","));
  if (state.tableSeries !== null) params.set("t", cityLineSlug(view, state.tableSeries));
  return params.toString();
}
```

- [ ] **Step 4: Update the indicators, labels and hub for the new signatures**

- `lib/explorer/inflationCityIndicators.ts`: change `latestCityIndicators(index: CityIndex, category: string)` to `latestCityIndicators(index: CityIndex)` and replace every use of `category` in its body with `HEADLINE_ID`. Update its doc comment's first sentence to "Spec 2026-09-30 §4: the latest published month, year on year, on the total."
- `lib/explorer/inflationCityLabels.ts`: replace `formatCityValue` with

```ts
/** Annual rates, in percent at one decimal. */
export function formatCityValue(value: number): string {
  return formatShare(displayedValue(value) / 100);
}
```

- `lib/explorer/inflationHubCards.ts:74`: `latestCityIndicators(cityIndex)`.

- [ ] **Step 5: Rewrite the panel**

Replace `components/inflation/inflation-city-panel.tsx` with:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { MISSING } from "../../lib/explorer/format";
import { cityPanelValue, cityViewLineIds, type CityIndex, type CityState, type CityView, type ResolvedPeriodRange } from "../../lib/explorer/inflationCities";
import { cityViewLineColor, cityViewLineLabel, formatCityValue } from "../../lib/explorer/inflationCityLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

// The Georgia page lists seven places; a city page, its total and 12 divisions.
// Search never scopes the bulk action or the denominator (AGENTS.md UI contract).
export function InflationCityPanel({
  index,
  view,
  state,
  range,
  onToggle,
  onToggleAll,
  downloadAction,
}: {
  index: CityIndex;
  view: CityView;
  state: CityState;
  range: ResolvedPeriodRange;
  onToggle: (lineId: string) => void;
  onToggleAll: () => void;
  downloadAction: ReactNode;
}) {
  const { messages } = useI18n();
  const [query, setQuery] = useState("");
  const lineIds = cityViewLineIds(view);
  const rows = lineIds.map((lineId) => ({ lineId, label: cityViewLineLabel(messages, view, lineId), value: cityPanelValue(index, view, lineId, range) }));
  const visible = rows.filter((row) => matchesLabelQuery(query, [row.label, row.lineId]));
  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        selectedCount={state.selected.length}
        totalCount={lineIds.length}
        hasSelection={state.selected.length > 0}
        allSelected={state.selected.length === lineIds.length}
        onToggleAll={onToggleAll}
        hasVisibleMatches={visible.length > 0}
      >
        {visible.map((row) => (
          <SeriesSelectorRow
            key={row.lineId}
            id={row.lineId}
            label={row.label}
            color={cityViewLineColor(view, row.lineId)}
            value={row.value === null ? MISSING : formatCityValue(row.value)}
            selected={state.selected.includes(row.lineId)}
            onToggle={() => onToggle(row.lineId)}
          />
        ))}
      </SeriesSelector>
      {downloadAction}
    </SeriesAside>
  );
}
```

- [ ] **Step 6: Rewrite the table**

Replace `components/inflation/inflation-city-table.tsx` with:

```tsx
"use client";

import { YOY_BINS, buildMonthGrid, legendLabels } from "../../lib/explorer/inflationGrid";
import {
  cityAnnualAverages,
  cityLineSource,
  cityTableOptions,
  cityValues,
  effectiveCityTableSeries,
  type CityIndex,
  type CityState,
  type CityView,
  type ResolvedPeriodRange,
} from "../../lib/explorer/inflationCities";
import { cityCategoryLabel, cityLineLabel, cityViewLineLabel, formatCityValue } from "../../lib/explorer/inflationCityLabels";
import { MONTH_NUMBERS, periodLabel } from "../../lib/explorer/inflationLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { MonthGridTable } from "../main-explorer/month-grid-table";
import { TextTab } from "../ui/editorial";

// ცხრილი: one line at a time. წლის საშუალო appears for a total line only —
// Geostat publishes no division average (spec 2026-09-30 §4–§5).
export function InflationCityTable({
  index,
  view,
  state,
  range,
  onTableSeriesChange,
}: {
  index: CityIndex;
  view: CityView;
  state: CityState;
  range: ResolvedPeriodRange;
  onTableSeriesChange: (lineId: string) => void;
}) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const active = effectiveCityTableSeries(index, view, state);
  if (active === null) return null;
  const options = cityTableOptions(index, view, state);
  const { entityId, seriesId } = cityLineSource(view, active);
  const summaryByYear = cityAnnualAverages(index, view, active);
  const rows = buildMonthGrid({ values: cityValues(index, entityId, seriesId, "yoy_pct")!, range, edges: YOY_BINS, summaryByYear });

  return (
    <MonthGridTable
      caption={t("tableCaption", {
        series: `${cityLineLabel(messages, entityId)} · ${cityCategoryLabel(messages, seriesId)}`,
        tab: t("categoryTab.yoy"),
        unit: t("categoryWorkbookUnit.yoy"),
        start: periodLabel(messages, range.start, "short"),
        end: periodLabel(messages, range.end, "short"),
      })}
      yearLabel={t("year")}
      monthLabels={MONTH_NUMBERS.map((month) => message(messages, `inflation.monthShort.${month}`))}
      monthNames={MONTH_NUMBERS.map((month) => message(messages, `inflation.month.${month}`))}
      summaryLabel={summaryByYear ? t("annualAverage") : undefined}
      rows={rows}
      formatValue={(value) => formatCityValue(value)}
      legend={legendLabels(YOY_BINS).map((label, tint) => ({ label, tint }))}
      legendLabel={t("legend")}
      picker={
        options.length > 1 ? (
          <div role="group" aria-label={t("tableSeries")} data-testid="inflation-city-table-series" className="flex flex-wrap gap-5">
            {options.map((lineId) => (
              <TextTab
                key={lineId}
                testId={`inflation-city-table-series-${lineId}`}
                label={cityViewLineLabel(messages, view, lineId)}
                active={lineId === active}
                onClick={() => onTableSeriesChange(lineId)}
              />
            ))}
          </div>
        ) : null
      }
    />
  );
}
```

- [ ] **Step 7: Update the Georgia indicators component**

In `components/inflation/inflation-city-indicators.tsx`: the signature becomes `export function InflationCityIndicators({ index }: { index: CityIndex })`, the call becomes `latestCityIndicators(index)`, and the header comment's second line reads `// year on year, on the total. Cities only; Georgia is the benchmark.` Nothing else changes.

- [ ] **Step 8: Rewrite the workbook model (test first)**

Replace `tests/explorer/inflationCityWorkbook.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { CityFactInput } from "../../lib/data/inflation/types";
import { buildCityIndex, defaultCityState, resolveCityRange, type CityState } from "../../lib/explorer/inflationCities";
import { GEORGIA_VIEW, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { buildInflationCityWorkbookExportModel } from "../../lib/explorer/inflationCityWorkbook";
import { SUMMARY_COLUMN } from "../../lib/explorer/inflationWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const BATUMI: CityView = { kind: "city", cityId: "city.batumi" };

async function model(view: CityView, state: CityState = defaultCityState(view), facts: CityFactInput[] = fixtureCityFacts) {
  const messages = await getMessages("en", ["inflation"]);
  const built = buildCityIndex(facts);
  return buildInflationCityWorkbookExportModel({
    index: built,
    view,
    state,
    range: resolveCityRange(state, built, view),
    presentation: { locale: "en", messages, englishLabels: {} },
    sources: [],
    siteOrigin: "https://fiscal.ge",
  });
}

describe("buildInflationCityWorkbookExportModel", () => {
  it("writes one readable row per place and year on the Georgia page, with the annual average", async () => {
    const workbook = await model(GEORGIA_VIEW);
    expect(workbook.readable.years).toContain(SUMMARY_COLUMN);
    expect(new Set(workbook.readable.rows.map((row) => row.parentLabel))).toEqual(new Set(["Georgia", "Tbilisi", "Kutaisi", "Batumi", "Gori", "Telavi", "Zugdidi"]));
    expect(workbook.readable.title).toBe("Cities · Georgia");
    expect(workbook.readable.subtitle).toContain("recorded once and applied to every city");
    expect(workbook.filename).toMatch(/^inflation-cities-2025-09-2026-08/);
  });

  it("names the city's series on a city page and keeps the average for the total only", async () => {
    const workbook = await model(BATUMI, { ...defaultCityState(BATUMI), selected: ["cpi.headline", "cpi.cat.01"] });
    expect(workbook.readable.title).toBe("Cities · Batumi");
    expect(workbook.readable.years).toContain(SUMMARY_COLUMN);
    const food = workbook.analysis.rows.find((row) => row[3] !== "Total")!;
    expect(food[2]).toBe("Batumi");
    expect(food[4]).toBe("01");
    expect(workbook.filename).toMatch(/^inflation-batumi-/);
  });

  it("drops the average column when no total is selected", async () => {
    const workbook = await model(BATUMI, { ...defaultCityState(BATUMI), selected: ["cpi.cat.01"] });
    expect(workbook.readable.years).not.toContain(SUMMARY_COLUMN);
  });

  it("exports rates as fractions and never an implied weight", async () => {
    const workbook = await model(GEORGIA_VIEW);
    const batumi = workbook.analysis.rows.find((row) => row[2] === "Batumi" && row[0] === 2026 && row[1] === 8)!;
    expect(batumi[5]).toBeCloseTo(0.070857, 6);
    expect(JSON.stringify(workbook).toLowerCase()).not.toContain("weight");
  });
});
```

The filename assertion assumes `workbookFilename` keeps the stem at the start; if it prefixes something, loosen the regex to `/inflation-cities-2025-09-2026-08/`.

Run: `npx vitest run tests/explorer/inflationCityWorkbook.test.ts` — expected FAIL (no `view` input yet).

Replace `lib/explorer/inflationCityWorkbook.ts` with:

```ts
import { periodKey, periodMonth, periodYear } from "../data/inflation/periods";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { HEADLINE_ID, buildCityLines, cityAnnualAverages, cityLineSource, type CityIndex, type CityState, type CityView, type ResolvedPeriodRange } from "./inflationCities";
import { cityCategoryLabel, cityLineLabel, cityPlaceLabel } from "./inflationCityLabels";
import { citySlug } from "./inflationCityRoutes";
import { MONTH_NUMBERS, periodLabel } from "./inflationLabels";
import {
  SUMMARY_COLUMN,
  calendarYearsOf,
  monthlyReadableRows,
  monthlyWorkbookSources,
  pickLocaleEditions,
  type InflationWorkbookSource,
} from "./inflationWorkbook";
import { SHEET_NAMES, type WorkbookExportModel, type WorkbookReadableRow, workbookFilename } from "./workbookModel";

// Spec 2026-09-30 §5: the readable sheet mirrors ცხრილი — one row per selected line
// and year, months across, plus წლის საშუალო when a total line is selected (blank
// for divisions). Annual rates only, as fractions under Excel's % format. The
// same-price-everywhere note travels on the sheet. Implied city weights never appear.
export function buildInflationCityWorkbookExportModel(input: {
  index: CityIndex;
  view: CityView;
  state: CityState;
  range: ResolvedPeriodRange;
  presentation: Presentation;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
}): WorkbookExportModel {
  const { index, view, state, range, presentation, sources, siteOrigin } = input;
  const { messages, locale } = presentation;
  const t = (key: string) => message(messages, `inflation.${key}`);
  const scale = (value: number) => value / 100;
  const { periods, lines } = buildCityLines(index, view, state, range);
  const withSummary = lines.some((line) => cityLineSource(view, line.key).seriesId === HEADLINE_ID);
  const columns: number[] = [...MONTH_NUMBERS, ...(withSummary ? [SUMMARY_COLUMN] : [])];
  const calendarYears = calendarYearsOf(range);
  const rowLabel = (lineId: string) => (view.kind === "georgia" ? cityLineLabel(messages, lineId) : cityCategoryLabel(messages, lineId));

  const rows: WorkbookReadableRow[] = lines.flatMap((line) => {
    const byPeriod = new Map(periods.map((period, position) => [period, line.values[position] ?? null]));
    const averages = cityAnnualAverages(index, view, line.key);
    return monthlyReadableRows(rowLabel(line.key), byPeriod, calendarYears, scale, withSummary ? (year) => averages?.get(year) ?? null : undefined);
  });

  const analysisRows = periods.flatMap((period, position) =>
    lines.flatMap((line) => {
      const value = line.values[position];
      if (value === null || value === undefined) return [];
      const { entityId, seriesId } = cityLineSource(view, line.key);
      const coicop = seriesId === HEADLINE_ID ? "" : seriesId.replace("cpi.cat.", "");
      return [[periodYear(period), periodMonth(period), cityLineLabel(messages, entityId), cityCategoryLabel(messages, seriesId), coicop, scale(value), "%", t("published")]];
    }),
  );

  const usedSourceIds = new Set<string>(["source.geostat_cpi_yoy"]);
  if (withSummary) usedSourceIds.add("source.geostat_cpi_avg12");
  const chosen = pickLocaleEditions(sources, usedSourceIds, locale);
  const subtitle = `${periodLabel(messages, range.start, "long")} – ${periodLabel(messages, range.end, "long")} · ${t("categoryUnit.yoy")}`;
  const stem = view.kind === "georgia" ? "inflation-cities" : `inflation-${citySlug(view.cityId)}`;

  return {
    locale,
    filename: workbookFilename(`${stem}-${periodKey(range.start)}-${periodKey(range.end)}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${t("citiesHeading")} · ${cityPlaceLabel(messages, view)}`,
      subtitle: `${subtitle} · ${t("cityCentralPricesNote")}`,
      unitLabel: t("categoryWorkbookUnit.yoy"),
      numberFormat: "0.0%",
      showChangeColumn: false,
      years: columns,
      headerLabels: {
        category: t("seriesYear"),
        columns: columns.map((column) => (column === SUMMARY_COLUMN ? t("annualAverage") : message(messages, `inflation.month.${column}`))),
      },
      rows,
    },
    analysis: {
      headers: [t("year"), t("month"), t("cityColumn"), t("categoryColumn"), t("coicopColumn"), t("value"), t("unitColumn"), t("status")],
      rows: analysisRows,
      numericFormats: { 6: "0.00%" },
    },
    sources: monthlyWorkbookSources(chosen, calendarYears, siteOrigin),
    sourceYears: calendarYears,
  };
}
```

- [ ] **Step 9: Rewrite the page component**

Delete `components/inflation/inflation-city-category-select.tsx` (`git rm`). Replace `components/inflation/inflation-cities.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { periodMonth, periodYear } from "../../lib/data/inflation/periods";
import { formatDisplayDate } from "../../lib/explorer/format";
import {
  buildCityIndex,
  buildCityLines,
  cityCoverage,
  defaultCityState,
  rangeFromPatch,
  resolveCityRange,
  restoreCityState,
  serializeCityHash,
  toggleAllCityLines,
  toggleCityLine,
  unpackCityFacts,
  type CityState,
  type CityView,
  type PackedCitySeries,
} from "../../lib/explorer/inflationCities";
import { cityLineLabel, cityPlaceLabel, cityViewLineColor, cityViewLineLabel } from "../../lib/explorer/inflationCityLabels";
import { CITIES_PATH } from "../../lib/explorer/inflationCityRoutes";
import { buildInflationCityWorkbookExportModel } from "../../lib/explorer/inflationCityWorkbook";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import type { InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { RangeStrip } from "../main-explorer/range-strip";
import { PageHeader } from "../shell/page-header";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { InflationCityIndicators } from "./inflation-city-indicators";
import { InflationCityPanel } from "./inflation-city-panel";
import { InflationCityTable } from "./inflation-city-table";

// Inflation cities (spec 2026-09-30): the Georgia page compares seven places on the
// total; a city page shows that city's total and divisions. Annual inflation only.
// No headline value line under the H1 (DESIGN.md §25).

const PCT_UNIT = { divisor: 1, label: "", decimals: 1 };

export type InflationCitiesProps = {
  view: CityView;
  facts: PackedCitySeries[];
  lastReviewedAt: string;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationCities({ view, facts, lastReviewedAt, sources, siteOrigin }: InflationCitiesProps) {
  const presentation = useI18n();
  const { messages, locale } = presentation;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const index = useMemo(() => buildCityIndex(unpackCityFacts(facts)), [facts]);
  const [state, setState] = useState<CityState>(() => defaultCityState(view));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(restoreCityState(window.location.hash, index, view));
    setReady(true);
  }, [index, view]);
  useAppReady();
  useReplaceHash(serializeCityHash(state, view), ready);

  const range = resolveCityRange(state, index, view);
  const coverage = cityCoverage(index, view);
  const periods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  const displayDate = locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt;
  const lines = buildCityLines(index, view, state, range);
  const hasSeries = lines.lines.length > 0;

  const chartSeries: ChartSeries[] = lines.lines.map((line) => ({
    id: line.key,
    label: cityViewLineLabel(messages, view, line.key),
    color: cityViewLineColor(view, line.key),
    vals: line.values,
    planned: line.values.map(() => false),
  }));
  const citiesCrumb = { label: t("citiesHeading"), ...(view.kind === "city" ? { href: pageHref(CITIES_PATH, locale) } : {}) };

  return (
    <ExplorerPage testId="inflation-cities">
      <PageHeader
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
          citiesCrumb,
          ...(view.kind === "city" ? [{ label: cityLineLabel(messages, view.cityId) }] : []),
        ]}
        coverage={`${periodLabel(messages, coverage.min, "short")} – ${periodLabel(messages, coverage.max, "short")} · ${message(messages, "main.updated", { date: displayDate })}`}
      />
      <ExplorerHeading>
        {t("cityHeadingLead")} {cityPlaceLabel(messages, view)}
      </ExplorerHeading>
      <p data-testid="inflation-city-unit" className="mb-4 text-[13px] text-[var(--muted)]">
        {t("categoryUnit.yoy")}
      </p>

      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={state.mode} className="border-t border-[var(--ink)] pt-3">
            <div className="flex flex-wrap items-center justify-end gap-4">
              <SegmentedTabs<CityState["mode"]>
                ariaLabel={message(messages, "controls.viewMode")}
                value={state.mode}
                onChange={(mode) => setState((current) => ({ ...current, mode }))}
                options={[
                  { value: "chart", label: message(messages, "controls.chart"), testId: "chart-mode-chart" },
                  { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
                ]}
              />
            </div>
            {!hasSeries ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout>
              </div>
            ) : state.mode === "table" ? (
              <InflationCityTable index={index} view={view} state={state} range={range} onTableSeriesChange={(lineId) => setState((current) => ({ ...current, tableSeries: lineId }))} />
            ) : (
              <div className="mt-5">
                <EditorialLineChart
                  years={lines.periods}
                  series={chartSeries}
                  share
                  unit={PCT_UNIT}
                  shareLabel={t("categoryTab.yoy")}
                  periodsPerYear={12}
                  formatPeriod={(period, kind) =>
                    kind === "axis" && periodMonth(period) === 1 ? String(periodYear(period)) : periodLabel(messages, period, kind === "axis" ? "short" : "long")
                  }
                />
              </div>
            )}
            <RangeStrip
              years={periods}
              range={range}
              periodsPerYear={12}
              formatPeriod={(period) => periodLabel(messages, period, "short")}
              onChange={(patch) => setState((current) => ({ ...current, range: rangeFromPatch(range, patch) }))}
            />
          </section>
          <div className="mt-[18px] space-y-2">
            <SourceNote testId="source-label">
              {t("citySource")} {message(messages, "main.lastUpdated", { date: displayDate })}
            </SourceNote>
            <p data-testid="inflation-city-central-prices" className="text-xs text-[var(--muted)]">
              {t("cityCentralPricesNote")}
            </p>
            <Link href={pageHref("/methodology/inflation", locale)} className="text-xs text-[var(--muted)] underline underline-offset-4">
              {t("methodology")}
            </Link>
          </div>
        </div>

        <InflationCityPanel
          index={index}
          view={view}
          state={state}
          range={range}
          onToggle={(lineId) => setState((current) => toggleCityLine(current, view, lineId))}
          onToggleAll={() => setState((current) => toggleAllCityLines(current, view))}
          downloadAction={
            <ExcelDownloadButton
              testId="inflation-city-download"
              disabled={!hasSeries}
              onDownload={() => downloadWorkbook(buildInflationCityWorkbookExportModel({ index, view, state, range, presentation, sources, siteOrigin }))}
            />
          }
        />
      </ExplorerWorkspace>

      {view.kind === "georgia" ? <InflationCityIndicators index={index} /> : null}
    </ExplorerPage>
  );
}
```

The `ExplorerHeading` here is temporary: Task 3 replaces it with the picker heading.

- [ ] **Step 10: Messages and the Georgia page payload**

In both `lib/i18n/messages/{ka,en}/inflation.json`:
- delete the `"inflation.cityCategoryLabel"` line;
- add after `"inflation.cityCategoryVsNational"`: ka `"inflation.cityHeadingLead": "ინფლაცია ქალაქებში —",`; en `"inflation.cityHeadingLead": "Inflation by city —",`
- replace `"inflation.citiesDescription"` values with — ka: `"ინფლაცია იმ ექვს ქალაქში, სადაც საქსტატი ფასებს აღრიცხავს, საქართველოს მაჩვენებელთან ერთად; თითოეულ ქალაქს აქვს საკუთარი გვერდი კატეგორიების მიხედვით."` en: `"Inflation in the six cities where Geostat records prices, beside Georgia's rate, with a page for each city's categories."`

Run `grep -rn "cityCategoryLabel" apps/web/lib apps/web/components apps/web/tests` from the repo root — expected: no matches.

In `lib/pages/inflation.tsx`:
- replace `georgiaCityLine` with

```ts
const PAGE_MEASURES: ReadonlySet<string> = new Set(["yoy_pct", "avg12_pct"]);

/** Georgia's total for the Georgia page: the national annual rate and 12-month average from 2016, never copied into the city CSV. */
function georgiaTotals(data: Awaited<ReturnType<typeof loadServedInflationData>>): CityFactInput[] {
  return data.facts
    .filter((fact) => fact.seriesId === "cpi.headline" && PAGE_MEASURES.has(fact.measure) && fact.period >= CITY_FIRST_PERIOD)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: "cpi.headline", measure: fact.measure as CpiCityMeasure, period: fact.period, value: fact.value }));
}
```

- in `renderInflationCities`, pass `view={GEORGIA_VIEW}` and
  `facts={packCityFacts([...georgiaTotals(data), ...data.cities.filter((fact) => fact.seriesId === "cpi.headline" && PAGE_MEASURES.has(fact.measure)).map(cityFactInput)])}`;
- import `GEORGIA_VIEW` from `../explorer/inflationCityRoutes`.

- [ ] **Step 11: Rewrite the render test**

Replace `tests/explorer/inflationCitiesRender.test.tsx`'s body (keep its imports, add `import { GEORGIA_VIEW } from "../../lib/explorer/inflationCityRoutes";`, and pass `view={GEORGIA_VIEW}` to `InflationCities`) with these tests:

```tsx
describe("InflationCities — Georgia page", () => {
  it("has no tab row, no select and no monthly measure", () => {
    expect(markup).not.toContain('data-testid="inflation-city-tabs"');
    expect(markup).not.toContain("<select");
    expect(markup).not.toContain("თვიური ინფლაცია");
  });

  it("names Georgia in the heading and carries the unit line", () => {
    expect(markup).toContain("ინფლაცია ქალაქებში — საქართველო");
    expect(block(markup, "inflation-city-unit")).toContain("პროცენტი");
  });

  it("selects all seven lines by default, Georgia first", () => {
    const rows = [...markup.matchAll(/data-testid="series-row" data-series-id="([^"]+)"/g)].map((match) => match[1]);
    expect(rows).toEqual(["country.georgia", "city.tbilisi", "city.kutaisi", "city.batumi", "city.gori", "city.telavi", "city.zugdidi"]);
    expect(block(markup, "series-status")).toContain("7 / 7");
  });

  it("names the highest city in the indicators and never ranks Georgia", () => {
    const indicators = markup.slice(markup.indexOf('data-testid="inflation-city-indicators"'));
    expect(block(indicators, "inflation-city-hero")).toContain("ბათუმი");
    expect(indicators).toContain("ყველაზე დაბალი");
    expect(indicators).toContain("ქალაქებს შორის სხვაობა");
    expect(indicators).toContain("2 / 6");
  });

  it("states that some prices are the same in every city", () => {
    expect(markup).toContain("ყველა ქალაქზე ვრცელდება");
  });
});
```

If the rendered heading splits `—` and `საქართველო` with a React text boundary (`<!-- -->`), assert the two parts separately.

- [ ] **Step 12: Update the browser spec so it does not describe removed controls**

In `tests/browser/inflation-cities.spec.ts`: delete the test `"the category picker drives the chart, the hash and the indicators"`; in the layout test replace the tabs assertion with `await expect(page.getByTestId("inflation-city-tabs")).toHaveCount(0);`; in `"the annual average column…"` replace the body with a navigation to `/en${CITIES}#m=table` and a single `toContainText("Annual average")`; in the Zugdidi test change the URL hash to `#m=table&t=zugdidi`. Do not run the browser suite now; Task 5 rewrites and runs this file.

- [ ] **Step 13: Run the task's checks**

Run: `npx vitest run tests/explorer/inflationCities.test.ts tests/explorer/inflationCityIndicators.test.ts tests/explorer/inflationCityWorkbook.test.ts tests/explorer/inflationCitiesRender.test.tsx tests/explorer/inflationCityRoutes.test.ts tests/explorer/inflationHub.test.ts && npm run typecheck && npm run lint && npm run i18n:check`
Expected: all pass. If `i18n:check` reports an unused or missing key, fix the key, not the check.

- [ ] **Step 14: Commit**

```bash
git add -A lib/explorer lib/pages/inflation.tsx components/inflation lib/i18n/messages tests/explorer tests/browser/inflation-cities.spec.ts
git commit -m "feat(inflation): make the cities page view-aware and drop its tabs and category select"
```

---

### Task 3: The heading picker and previous/next links

**Files:**
- Create: `apps/web/components/inflation/city-picker.tsx`
- Create: `apps/web/components/inflation/inflation-city-heading.tsx`
- Modify: `apps/web/components/inflation/inflation-cities.tsx` (use the heading)
- Modify: `apps/web/lib/i18n/messages/{ka,en}/inflation.json`
- Modify: `apps/web/tests/explorer/inflationCitiesRender.test.tsx`

**Interfaces:**
- Consumes: `CityView`, `CITIES_PATH`, `cityPageHref`, `citySlug`, `neighbourCities` (Task 1); `cityLineLabel`, `cityPlaceLabel` (Task 1/existing); `GEORGIA_LINE_ID` (Task 2).
- Produces: `CityPicker({ open, onClose, view })`; `InflationCityHeading({ view })`; test IDs `city-picker-trigger`, `city-picker-georgia-option`, `city-picker-option`, `city-entity-navigation`; messages `inflation.cityPickerTitle`, `cityPickerSearch`, `cityPickerPlaceholder`, `cityPickerResults`, `cityPickerHint`, `cityPickerEmpty`, `cityPickerClear`.

- [ ] **Step 1: Add the picker messages**

In both `inflation.json` files, after `"inflation.cityHeadingLead"`, add:

| key | ka | en |
| --- | --- | --- |
| `inflation.cityPickerTitle` | `ქალაქის არჩევა` | `Choose a city` |
| `inflation.cityPickerSearch` | `ქალაქის ძიება` | `Search cities` |
| `inflation.cityPickerPlaceholder` | `ქალაქის ძიება` | `Search cities` |
| `inflation.cityPickerResults` | `ქალაქების შედეგები` | `City results` |
| `inflation.cityPickerHint` | `გადაადგილდით ისრებით და ქალაქის გასახსნელად დააჭირეთ Enter-ს.` | `Use the arrow keys to move and Enter to open a city.` |
| `inflation.cityPickerEmpty` | `ქალაქი ვერ მოიძებნა` | `No cities found` |
| `inflation.cityPickerClear` | `ძიების გასუფთავება` | `Clear search` |

- [ ] **Step 2: Write the failing render test**

Append to `tests/explorer/inflationCitiesRender.test.tsx` (inside the Georgia describe):

```tsx
  it("puts the place name in a picker trigger with no previous/next links", () => {
    expect(block(markup, "city-picker-trigger")).toContain("საქართველო");
    expect(block(markup, "city-picker-trigger")).toContain('aria-expanded="false"');
    expect(markup).not.toContain('data-testid="city-entity-navigation"');
  });
```

and a new describe for a city page:

```tsx
describe("InflationCities — city page", () => {
  const cityMarkup = renderGeorgianMarkup(
    <InflationCities view={{ kind: "city", cityId: "city.batumi" }} facts={packCityFacts(fixtureCityFacts)} lastReviewedAt="2026-09-11" sources={[]} siteOrigin="https://fiscal.ge" />,
    { ...common, ...controls, ...inflation, ...main },
  );

  it("names the city in the trigger and links its neighbours in Geostat's order", () => {
    expect(block(cityMarkup, "city-picker-trigger")).toContain("ბათუმი");
    const navigation = block(cityMarkup, "city-entity-navigation");
    expect(navigation).toContain('href="/explorer/inflation/cities/kutaisi"');
    expect(navigation).toContain('href="/explorer/inflation/cities/gori"');
  });

  it("lists the total and 12 divisions with only the total selected", () => {
    expect(block(cityMarkup, "series-status")).toContain("1 / 13");
  });
});
```

Run: `npx vitest run tests/explorer/inflationCitiesRender.test.tsx`
Expected: FAIL — no `city-picker-trigger`.

- [ ] **Step 3: Create the picker**

`apps/web/components/inflation/city-picker.tsx` — `RegionPicker`'s markup, classes and keys, with the Georgia page as the first option:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CPI_CITY_IDS, type CpiCityId } from "../../lib/data/inflation/types";
import { GEORGIA_LINE_ID } from "../../lib/explorer/inflationCities";
import { cityLineLabel } from "../../lib/explorer/inflationCityLabels";
import { CITIES_PATH, cityPageHref, citySlug, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";

// The cities heading picker (spec 2026-09-30 §3): RegionPicker's anatomy and keys,
// with საქართველო — the comparison page — first, styled as its "all" row.

function focusTrigger() {
  document.querySelector<HTMLButtonElement>("[data-testid='city-picker-trigger']")?.focus();
}

export function CityPicker({ open, onClose, view }: { open: boolean; onClose: () => void; view: CityView }) {
  const { locale, messages } = useI18n();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const georgiaLabel = cityLineLabel(messages, GEORGIA_LINE_ID);
  const needle = query.trim();
  const includeGeorgia = !needle || matchesLabelQuery(needle, [georgiaLabel, "georgia"]);
  const filtered = useMemo<CpiCityId[]>(
    () => (needle ? CPI_CITY_IDS.filter((cityId) => matchesLabelQuery(needle, [cityLineLabel(messages, cityId), citySlug(cityId)])) : [...CPI_CITY_IDS]),
    [messages, needle],
  );
  const optionCount = filtered.length + (includeGeorgia ? 1 : 0);
  const cityOffset = includeGeorgia ? 1 : 0;
  const activeCityId = view.kind === "city" ? view.cityId : null;

  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); focusTrigger(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);

  if (!open) return null;
  const select = (index: number) => {
    if (includeGeorgia && index === 0) {
      window.location.href = pageHref(CITIES_PATH, locale);
      return;
    }
    const cityId = filtered[index - cityOffset];
    if (!cityId) return;
    window.location.href = pageHref(cityPageHref(cityId), locale);
  };
  const move = (delta: 1 | -1) => {
    if (!optionCount) return;
    const next = activeIndex === null
      ? delta === 1 ? 0 : optionCount - 1
      : (activeIndex + delta + optionCount) % optionCount;
    setActiveIndex(next);
  };
  const listboxId = `${baseId}-listbox`;
  const activeOptionId = activeIndex === null
    ? undefined
    : activeIndex === 0 && includeGeorgia
      ? `${baseId}-georgia`
      : `${baseId}-${filtered[activeIndex - cityOffset]}`;

  return (
    <div className="relative">
      <div aria-hidden className="fixed inset-0 z-30" onClick={() => { onClose(); focusTrigger(); }} />
      <div role="dialog" aria-label={message(messages, "inflation.cityPickerTitle")} className="absolute top-1 left-0 z-40 w-[360px] max-w-[92vw] border border-[var(--control)] bg-[var(--tile)]">
        <div className="border-b border-[var(--hairline-soft)] p-3">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(null); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
              else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
              else if (event.key === "Enter" && activeIndex !== null) { event.preventDefault(); select(activeIndex); }
              else if (event.key === "Tab") onClose();
            }}
            placeholder={message(messages, "inflation.cityPickerPlaceholder")}
            aria-label={message(messages, "inflation.cityPickerSearch")}
            className="h-[34px] w-full border border-[var(--control)] bg-[var(--paper)] px-2.5 text-[13px] outline-none"
          />
        </div>
        <div id={listboxId} role="listbox" aria-label={message(messages, "inflation.cityPickerResults")} className="max-h-[340px] overflow-y-auto">
          {includeGeorgia ? (
            <Link
              id={`${baseId}-georgia`}
              data-testid="city-picker-georgia-option"
              href={pageHref(CITIES_PATH, locale)}
              role="option"
              aria-selected={activeIndex === 0}
              aria-current={view.kind === "georgia" ? "page" : undefined}
              tabIndex={-1}
              onClick={onClose}
              className={`block border-b border-l-2 border-b-[var(--hairline-soft)] bg-[var(--tint)] px-3 py-2 text-[12px] font-semibold text-[var(--accent)] ${activeIndex === 0 ? "border-l-[var(--ink)]" : "border-l-transparent"}`}
            >
              {georgiaLabel}
            </Link>
          ) : null}
          {filtered.map((cityId, index) => (
            <Link
              key={cityId}
              id={`${baseId}-${cityId}`}
              href={pageHref(cityPageHref(cityId), locale)}
              role="option"
              aria-selected={index + cityOffset === activeIndex}
              aria-current={cityId === activeCityId ? "page" : undefined}
              tabIndex={-1}
              data-testid="city-picker-option"
              onClick={onClose}
              className={`block border-b border-l-2 border-b-[var(--row-border)] px-3 py-2 text-[13px] ${index + cityOffset === activeIndex ? "border-l-[var(--ink)] bg-[var(--tint)]" : "border-l-transparent"} ${cityId === activeCityId ? "font-semibold text-[var(--accent)]" : "text-[var(--body)]"}`}
            >
              {cityLineLabel(messages, cityId)}
            </Link>
          ))}
        </div>
        {optionCount === 0 ? (
          <div className="px-3 py-6 text-center text-[13px]">
            <span role="status">{message(messages, "inflation.cityPickerEmpty")}</span>
            <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="mt-3 block w-full text-[12px] text-[var(--accent)]">{message(messages, "inflation.cityPickerClear")}</button>
          </div>
        ) : null}
        <div className="border-t border-[var(--hairline-soft)] px-3 py-2 text-[11px] text-[var(--faint)]">{message(messages, "inflation.cityPickerHint")}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the heading**

`apps/web/components/inflation/inflation-city-heading.tsx` — the regions page heading's markup (`components/regional-economies/regional-economy-explorer.tsx`, the block around `region-picker-trigger`):

```tsx
"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cityLineLabel, cityPlaceLabel } from "../../lib/explorer/inflationCityLabels";
import { cityPageHref, neighbourCities, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { CityPicker } from "./city-picker";

// `ინფლაცია ქალაქებში — {place} ▾`, as region and municipality pages open. City
// pages add previous/next links in Geostat's order; the Georgia page has none.
export function InflationCityHeading({ view }: { view: CityView }) {
  const { locale, messages } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const neighbours = view.kind === "city" ? neighbourCities(view.cityId) : null;
  return (
    <div className="relative mt-[34px] mb-3 flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between">
      <h1 className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
        {message(messages, "inflation.cityHeadingLead")}{" "}
        <button
          data-testid="city-picker-trigger"
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]"
        >
          {cityPlaceLabel(messages, view)}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
        </button>
      </h1>
      <CityPicker open={pickerOpen} onClose={() => setPickerOpen(false)} view={view} />
      {neighbours ? (
        <span data-testid="city-entity-navigation" className="grid w-full min-w-0 grid-cols-2 items-center gap-4 min-[768px]:flex min-[768px]:w-auto min-[768px]:max-w-[40%] min-[768px]:shrink">
          <Link href={pageHref(cityPageHref(neighbours.previous), locale)} className="block min-w-0 truncate font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            ← {cityLineLabel(messages, neighbours.previous)}
          </Link>
          <Link href={pageHref(cityPageHref(neighbours.next), locale)} className="block min-w-0 truncate text-right font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            {cityLineLabel(messages, neighbours.next)} →
          </Link>
        </span>
      ) : null}
    </div>
  );
}
```

Before relying on the class strings, open `regional-economy-explorer.tsx` and confirm they still match there; if they differ, copy the current ones.

- [ ] **Step 5: Use it in the page**

In `components/inflation/inflation-cities.tsx`: replace the `<ExplorerHeading>…</ExplorerHeading>` element with `<InflationCityHeading view={view} />`, add `import { InflationCityHeading } from "./inflation-city-heading";`, and remove the now-unused `ExplorerHeading` and `cityPlaceLabel` imports.

- [ ] **Step 6: Run the task's checks**

Run: `npx vitest run tests/explorer/inflationCitiesRender.test.tsx && npm run typecheck && npx eslint components/inflation && npm run i18n:check`
Expected: all pass. If the Georgia heading test from Task 2 (`"ინფლაცია ქალაქებში — საქართველო"`) now fails because the place name sits inside the button, change it to assert `"ინფლაცია ქალაქებში —"` and rely on the trigger test for the name.

- [ ] **Step 7: Commit**

```bash
git add components/inflation lib/i18n/messages tests/explorer/inflationCitiesRender.test.tsx
git commit -m "feat(inflation): choose the city from a heading picker, as region pages do"
```

---

### Task 4: City page routes, payloads, indicators and registration

**Files:**
- Create: `apps/web/components/inflation/inflation-city-category-indicators.tsx`
- Modify: `apps/web/components/inflation/inflation-cities.tsx` (city indicators)
- Modify: `apps/web/lib/pages/inflation.tsx`
- Create: `apps/web/app/(ka)/explorer/inflation/cities/[city]/page.tsx`
- Create: `apps/web/app/(en)/en/explorer/inflation/cities/[city]/page.tsx`
- Modify: `apps/web/lib/seo/sitemap.ts`, `apps/web/lib/i18n/inventory.server.ts:22`, `data/localization/en/page-revisions.json`, `apps/web/components/shell/data-sidebar.tsx:39`
- Modify: `apps/web/lib/i18n/messages/{ka,en}/inflation.json`
- Modify: `apps/web/tests/seo/routes.test.ts:53`, `apps/web/tests/browser/seo.spec.ts:440,457`, `apps/web/tests/browser/bilingual-complete.spec.ts:8`
- Modify: `apps/web/tests/explorer/inflationCitiesRender.test.tsx`

**Interfaces:**
- Consumes: `latestCityCategoryIndicators` (Task 1), `InflationCities` with `view` (Task 2), `CITY_PAGE_PATHS`, `cityIdForSlug`, `cityPageHref`, `citySlug`, `CITIES_PATH` (Task 1).
- Produces: `inflationCityStaticParams(): { city: string }[]`, `inflationCityPageMetadata(slug: string, locale: Locale)`, `renderInflationCityPage(slug: string, locale: Locale)`; messages `inflation.cityPageMetaTitle`, `inflation.cityPageDescription`.

- [ ] **Step 1: Write the failing render test for the city indicators**

Add to the city-page describe in `tests/explorer/inflationCitiesRender.test.tsx`:

```tsx
  it("shows the city's own indicators, not the city ranking", () => {
    const indicators = cityMarkup.slice(cityMarkup.indexOf('data-testid="inflation-city-category-indicators"'));
    expect(cityMarkup).toContain('data-testid="inflation-city-category-indicators"');
    expect(cityMarkup).not.toContain('data-testid="inflation-city-indicators"');
    expect(block(indicators, "inflation-city-category-hero")).toContain("ბათუმი");
    expect(indicators).toContain("ყველაზე გაძვირებული");
    expect(indicators).toContain("ინფლაციის სიგანე");
  });
```

The shared fixture gives Batumi `cpi.headline` and `cpi.cat.01` only, so breadth reads `1 / 1`; that is fine for a render test.

Run: `npx vitest run tests/explorer/inflationCitiesRender.test.tsx` — expected FAIL.

- [ ] **Step 2: Create the city indicators component**

`apps/web/components/inflation/inflation-city-category-indicators.tsx`:

```tsx
"use client";

import { INK } from "../../lib/explorer/colors";
import { formatShare } from "../../lib/explorer/format";
import { categoryLabel, formatContribution } from "../../lib/explorer/inflationCategoryLabels";
import { type CityIndex } from "../../lib/explorer/inflationCities";
import { latestCityCategoryIndicators, type CityCategoryRate } from "../../lib/explorer/inflationCityIndicators";
import { cityLineLabel } from "../../lib/explorer/inflationCityLabels";
import type { CpiCityId } from "../../lib/data/inflation/types";
import { displayedValue } from "../../lib/explorer/inflationGrid";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeroKpi, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle } from "../ui/editorial";

// ძირითადი ინდიკატორები on a city page (spec 2026-09-30 §5): the city's total
// against Georgia, then the Categories page's three rate questions over the city's
// divisions, each against Georgia's same division. A fall is never coloured.
export function InflationCityCategoryIndicators({ index, cityId }: { index: CityIndex; cityId: CpiCityId }) {
  const { messages } = useI18n();
  const latest = latestCityCategoryIndicators(index, cityId);
  if (!latest) return null;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const pct = (value: number) => formatShare(displayedValue(value) / 100);
  const delta = (value: number | null) => (value === null ? "—" : formatContribution(value));
  const city = cityLineLabel(messages, cityId);
  const rateKpi = (entry: CityCategoryRate, label: string): SideKpi => ({
    label,
    value: pct(entry.value),
    unit: "",
    color: "var(--ink)",
    detail: t("cityCategoryVsNational", { category: categoryLabel(messages, entry.categoryId), delta: delta(entry.deltaPp) }),
    spark: null,
  });
  const sideKpis: SideKpi[] = [
    rateKpi(latest.fastest, t("fastestRise")),
    rateKpi(latest.slowest, t(latest.slowest.fell ? "biggestFall" : "smallestRise")),
    {
      label: t("inflationBreadth"),
      value: t("breadthValue", { rose: String(latest.breadth.rose), total: String(latest.breadth.total) }),
      unit: "",
      color: "var(--ink)",
      detail: t("breadthDetail"),
      spark: { values: latest.breadth.spark, color: INK },
    },
  ];

  return (
    <section data-testid="inflation-city-category-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{message(messages, "main.indicators")}</SectionTitle>
      <div data-testid="period-kpi-cards" className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {latest.total ? (
          <HeroKpi label={`${t("categoryTab.yoy")} · ${periodLabel(messages, latest.period, "long")}`} value={pct(latest.total.value)}>
            <p data-testid="inflation-city-category-hero" className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
              {t("cityHeroDetail", {
                city,
                value: pct(latest.total.value),
                national: latest.total.national === null ? "—" : pct(latest.total.national),
                delta: delta(latest.total.deltaPp),
              })}
            </p>
          </HeroKpi>
        ) : (
          <div />
        )}
        <SideKpiList kpis={sideKpis} />
      </div>
    </section>
  );
}
```

In `inflation-cities.tsx` replace `{view.kind === "georgia" ? <InflationCityIndicators index={index} /> : null}` with:

```tsx
      {view.kind === "georgia" ? <InflationCityIndicators index={index} /> : <InflationCityCategoryIndicators index={index} cityId={view.cityId} />}
```

and import `InflationCityCategoryIndicators` from `./inflation-city-category-indicators`.

Run: `npx vitest run tests/explorer/inflationCitiesRender.test.tsx` — expected PASS.

- [ ] **Step 3: City page messages**

In both `inflation.json` files, after `"inflation.cityPickerClear"`:
- ka: `"inflation.cityPageMetaTitle": "{city}: ინფლაცია {first}–{last} | Fiscal.ge",` and `"inflation.cityPageDescription": "{city}: წლიური ინფლაცია სულ და COICOP-ის 12 ჯგუფის მიხედვით, საქსტატის მონაცემებით, საქართველოს მაჩვენებელთან შედარებით.",`
- en: `"inflation.cityPageMetaTitle": "{city} inflation {first}–{last} | Fiscal.ge",` and `"inflation.cityPageDescription": "{city}: annual inflation overall and in the 12 COICOP groups, from Geostat data, compared with Georgia's rate.",`

- [ ] **Step 4: Page module — payloads, metadata, static params, rendering**

In `lib/pages/inflation.tsx`:

1. Imports: add `import { notFound } from "next/navigation";`; add `CPI_CITY_IDS` and `type CpiCityId` to the `../data/inflation/types` import; add `import { CITIES_PATH, GEORGIA_VIEW, cityIdForSlug, cityPageHref, citySlug, type CityView } from "../explorer/inflationCityRoutes";` and delete the local `const CITIES_PATH = …` line.

2. Below `georgiaTotals`, add:

```ts
/** Georgia's total and division rates in one month: a city page compares against them in its indicators only. */
function georgiaRatesAt(data: Awaited<ReturnType<typeof loadServedInflationData>>, period: string): CityFactInput[] {
  const total = data.facts
    .filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === period)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: "cpi.headline", measure: "yoy_pct" as const, period, value: fact.value }));
  const divisions = data.categories
    .filter((fact) => fact.level === 2 && fact.measure === "yoy_pct" && fact.period === period)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: fact.categoryId, measure: "yoy_pct" as const, period, value: fact.value }));
  return [...total, ...divisions];
}

function cityForSlug(slug: string): CpiCityId {
  const cityId = cityIdForSlug(slug);
  if (!cityId) notFound();
  return cityId;
}

export function inflationCityStaticParams() {
  return CPI_CITY_IDS.map((cityId) => ({ city: citySlug(cityId) }));
}
```

3. Extract the body shared by both page kinds from `renderInflationCities` into:

```ts
async function renderCitiesView(locale: Locale, view: CityView, facts: CityFactInput[], lastReviewedAt: string) {
  const root = repositoryRoot();
  const [presentation, manifest, catalogue] = await Promise.all([
    getPresentation(locale, ["inflation", "common", "controls", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, catalogue.documents);
  const t = (key: string) => message(presentation.messages, key);
  const crumbs = [
    { name: t("common.home"), path: pageHref("/", locale) },
    { name: t("common.inflation"), path: pageHref(HUB_PATH, locale) },
    { name: t("inflation.citiesHeading"), path: pageHref(CITIES_PATH, locale) },
    ...(view.kind === "city" ? [{ name: t(`inflation.city.${view.cityId}`), path: pageHref(cityPageHref(view.cityId), locale) }] : []),
  ];
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd items={crumbs} />
      <InflationCities view={view} facts={packCityFacts(facts)} lastReviewedAt={lastReviewedAt} sources={sources} siteOrigin={resolveSiteUrl()} />
    </I18nProvider>
  );
}
```

4. Replace `renderInflationCities` and add the city functions:

```ts
export async function renderInflationCities(locale: Locale) {
  const data = await loadServedInflationData();
  const facts = [...georgiaTotals(data), ...data.cities.filter((fact) => fact.seriesId === "cpi.headline" && PAGE_MEASURES.has(fact.measure)).map(cityFactInput)];
  return renderCitiesView(locale, GEORGIA_VIEW, facts, data.cities.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "");
}

export async function inflationCityPageMetadata(slug: string, locale: Locale) {
  const cityId = cityForSlug(slug);
  const [{ cities }, messages] = await Promise.all([loadServedInflationData(), getMessages(locale, ["inflation"])]);
  const years = cities.filter((fact) => fact.cityId === cityId && fact.measure === "yoy_pct").map((fact) => periodYear(periodFromKey(fact.period)));
  const city = message(messages, `inflation.city.${cityId}`);
  return fiscalMetadata({
    locale,
    path: cityPageHref(cityId),
    title: message(messages, "inflation.cityPageMetaTitle", { city, first: Math.min(...years), last: Math.max(...years) }),
    description: message(messages, "inflation.cityPageDescription", { city }),
  });
}

export async function renderInflationCityPage(slug: string, locale: Locale) {
  const cityId = cityForSlug(slug);
  const data = await loadServedInflationData();
  const own = data.cities.filter((fact) => fact.cityId === cityId && PAGE_MEASURES.has(fact.measure));
  const latest = own.filter((fact) => fact.measure === "yoy_pct").map((fact) => fact.period).sort().at(-1)!;
  const facts = [...own.map(cityFactInput), ...georgiaRatesAt(data, latest)];
  return renderCitiesView(locale, { kind: "city", cityId }, facts, own.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "");
}
```

If `message()` rejects numeric values in its `values` argument, mirror how `inflationCitiesMetadata` passes `first`/`last` today.

- [ ] **Step 5: Routes**

`apps/web/app/(ka)/explorer/inflation/cities/[city]/page.tsx`:

```tsx
import { inflationCityPageMetadata, inflationCityStaticParams, renderInflationCityPage } from "../../../../../../lib/pages/inflation";

export const dynamicParams = false;
export const generateStaticParams = inflationCityStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  return inflationCityPageMetadata((await params).city, "ka");
}
export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  return renderInflationCityPage((await params).city, "ka");
}
```

`apps/web/app/(en)/en/explorer/inflation/cities/[city]/page.tsx`: the same with `"../../../../../../../lib/pages/inflation"` (one more `../`) and `"en"`.

- [ ] **Step 6: Register the routes**

- `lib/seo/sitemap.ts`: import `{ CITY_PAGE_PATHS }` from `"../explorer/inflationCityRoutes"`; directly after the `/explorer/inflation/cities` entry add `...CITY_PAGE_PATHS.map((path) => ({ url: \`${siteUrl}${path}\`, lastModified: inflationModified })),`.
- `lib/i18n/inventory.server.ts:22`: import `CITY_PAGE_PATHS` the same way and append `...CITY_PAGE_PATHS` after `"/explorer/inflation/cities"` in that array.
- `data/localization/en/page-revisions.json`: set `"/explorer/inflation/cities"` to `"2026-09-30"` and add, directly after it, six entries `"/explorer/inflation/cities/tbilisi": "2026-09-30"` … `"/explorer/inflation/cities/zugdidi": "2026-09-30"` in Geostat's order (mind the trailing commas).
- `components/shell/data-sidebar.tsx:39`: `const inflationCitiesActive = pathname.includes("/explorer/inflation/cities");`
- Count pins (the sitemap lists every page in both languages, so it grows by 12): `tests/seo/routes.test.ts:53` `228` → `240`; `tests/browser/seo.spec.ts:440` and `:457` `228` → `240`; `tests/browser/bilingual-complete.spec.ts:8` `114` → `120`. Read `tests/seo/routes.test.ts` in full: if it lists expected URLs explicitly, add the six city URLs there too.

- [ ] **Step 7: Run the task's checks**

Run: `npx vitest run tests/explorer tests/seo && npm run typecheck && npm run lint && npm run i18n:check`
Expected: all pass. (`tests/seo` includes the sitemap count.)

- [ ] **Step 8: Commit**

```bash
git add -A app/(ka)/explorer/inflation/cities app/(en)/en/explorer/inflation/cities components/inflation components/shell/data-sidebar.tsx lib/pages/inflation.tsx lib/seo/sitemap.ts lib/i18n tests ../../data/localization/en/page-revisions.json
git commit -m "feat(inflation): add a page per city with its own categories and indicators"
```

(Quote the `app/(ka)…` paths in PowerShell or Bash if the shell expands parentheses.)

---

### Task 5: Browser spec for both page kinds

**Files:**
- Rewrite: `apps/web/tests/browser/inflation-cities.spec.ts`

**Interfaces:**
- Consumes: test IDs `city-picker-trigger`, `city-picker-georgia-option`, `city-picker-option`, `city-entity-navigation`, `series-row` (with `data-series-id`), `series-status`, `chart-mode-table`, `month-grid`, `month-grid-row` (with `data-year`), `inflation-city-table-series-*`, `explorer-header`, `inflation-cities-link`, `inflation-hub`, `no-selection-callout`, `series-toggle-all`.

- [ ] **Step 1: Replace the spec**

```ts
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const CITIES = "/explorer/inflation/cities";
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const locale of ["ka", "en"] as const) {
  const prefix = locale === "en" ? "/en" : "";
  for (const width of [390, 1440]) {
    test(`Georgia page layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${prefix}${CITIES}`);
      await ready(page);
      await expect(page.getByTestId("inflation-city-tabs")).toHaveCount(0);
      await expect(page.locator("select")).toHaveCount(0);
      await expect(page.getByTestId("series-row")).toHaveCount(7);
      await expect(page.getByTestId("series-status")).toContainText("7 / 7");
      expect(await noOverflow(page)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`cities-${locale}-${width}.png`), fullPage: true });

      await page.getByTestId("chart-mode-table").click();
      await expect(page.getByTestId("month-grid")).toBeVisible();
      expect(/[Ⴀ-ჿ]/.test((await page.getByTestId("month-grid").innerText()).normalize())).toBe(locale === "ka");
      expect(await noOverflow(page)).toBe(true);
    });

    test(`city page layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${prefix}${CITIES}/batumi`);
      await ready(page);
      await expect(page.getByTestId("series-row")).toHaveCount(13);
      await expect(page.getByTestId("series-status")).toContainText("1 / 13");
      await expect(page.getByTestId("city-entity-navigation")).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`city-batumi-${locale}-${width}.png`), fullPage: true });
    });
  }
}

test("the heading picker searches and opens a city page", async ({ page }) => {
  await page.goto(CITIES);
  await ready(page);
  await page.getByTestId("city-picker-trigger").click();
  const dialog = page.getByRole("dialog", { name: "ქალაქის არჩევა" });
  await expect(dialog).toBeVisible();
  await dialog.locator("input").fill("ბათ");
  await expect(page.getByTestId("city-picker-option")).toHaveCount(1);
  await page.getByTestId("city-picker-option").click();
  await expect(page).toHaveURL(/\/explorer\/inflation\/cities\/batumi$/);
});

test("Escape closes the picker and returns focus to the trigger", async ({ page }) => {
  await page.goto(`/en${CITIES}/gori`);
  await ready(page);
  await page.getByTestId("city-picker-trigger").click();
  await expect(page.getByRole("dialog", { name: "Choose a city" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Choose a city" })).toHaveCount(0);
  await expect(page.getByTestId("city-picker-trigger")).toBeFocused();
});

test("the keyboard reaches Georgia first and opens the comparison page", async ({ page }) => {
  await page.goto(`/en${CITIES}/telavi`);
  await ready(page);
  await page.getByTestId("city-picker-trigger").click();
  const search = page.getByRole("combobox", { name: "Search cities" });
  await search.press("ArrowDown");
  await expect(page.getByTestId("city-picker-georgia-option")).toHaveAttribute("aria-selected", "true");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/en\/explorer\/inflation\/cities$/);
});

test("previous and next follow Geostat's order and wrap", async ({ page }) => {
  await page.goto(`/en${CITIES}/batumi`);
  await ready(page);
  const navigation = page.getByTestId("city-entity-navigation");
  await expect(navigation.getByRole("link").first()).toHaveText("← Kutaisi");
  await expect(navigation.getByRole("link").last()).toHaveText("Gori →");
  await page.goto(`/en${CITIES}/tbilisi`);
  await expect(page.getByTestId("city-entity-navigation").getByRole("link").first()).toHaveText("← Zugdidi");
});

test("a city page opens on its total and adds a division", async ({ page }) => {
  await page.goto(`/en${CITIES}/kutaisi`);
  await ready(page);
  await page.locator('[data-testid="series-row"][data-series-id="cpi.cat.01"] button').first().click();
  await expect(page.getByTestId("series-status")).toContainText("2 / 13");
  await expect(page).toHaveURL(/sel=total%2C01/);
});

test("the annual average column follows the total", async ({ page }) => {
  await page.goto(`/en${CITIES}#m=table`);
  await ready(page);
  await expect(page.getByTestId("month-grid")).toContainText("Annual average");
  await page.goto(`/en${CITIES}/batumi#m=table&sel=total%2C01&t=01`);
  await ready(page);
  await expect(page.getByTestId("month-grid")).not.toContainText("Annual average");
  await page.getByTestId("inflation-city-table-series-cpi.headline").click();
  await expect(page.getByTestId("month-grid")).toContainText("Annual average");
});

test("Zugdidi's annual series starts late and is never filled", async ({ page }) => {
  await page.goto(`/en${CITIES}#m=table&t=zugdidi`);
  await ready(page);
  await expect(page.getByTestId("inflation-city-table-series-city.zugdidi")).toHaveAttribute("aria-pressed", "true");
  const monthCells = page.locator('[data-testid="month-grid-row"][data-year="2016"] td');
  for (let month = 0; month < 11; month += 1) {
    await expect(monthCells.nth(month)).toHaveText("—");
    await expect(monthCells.nth(month)).not.toHaveAttribute("data-testid", "month-grid-cell");
  }
  await expect(monthCells.nth(11)).toHaveAttribute("data-testid", "month-grid-cell");
  await expect(monthCells.nth(11)).not.toHaveText("—");

  await page.goto(`/en${CITIES}/zugdidi`);
  await ready(page);
  await expect(page.getByTestId("explorer-header")).toContainText("Dec 2016 –");
});

test("an old link with the retired tab and category keys still opens", async ({ page }) => {
  await page.goto(`/en${CITIES}#i=mom&c=07`);
  await ready(page);
  await expect(page.getByTestId("series-status")).toContainText("7 / 7");
});

test("clearing the selection can be undone from the same control", async ({ page }) => {
  await page.goto(`/en${CITIES}`);
  await ready(page);
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("series-status")).toContainText("7 / 7");
});

test("the hub links the Georgia page and the sidebar stays on the section across city pages", async ({ page }) => {
  await page.goto("/en/explorer/inflation");
  await page.getByTestId("inflation-hub").locator('a[href="/en/explorer/inflation/cities"]').click();
  await ready(page);
  await expect(page.getByTestId("inflation-cities-link")).toHaveAttribute("aria-current", "page");
  await page.goto(`/en${CITIES}/gori`);
  await expect(page.getByTestId("inflation-cities-link")).toHaveAttribute("aria-current", "page");
});

test("every city page is statically available in both languages", async ({ request }) => {
  for (const prefix of ["", "/en"]) {
    for (const slug of ["tbilisi", "kutaisi", "batumi", "gori", "telavi", "zugdidi"]) {
      const response = await request.get(`${prefix}${CITIES}/${slug}`);
      expect(response.status(), `${prefix || "/ka"}:${slug}`).toBe(200);
      await response.dispose();
    }
  }
  expect((await request.get(`${CITIES}/rustavi`)).status()).toBe(404);
});
```

Check two literals against the code before running: the English short label for December (`inflation.monthShort.12` in `lib/i18n/messages/en/inflation.json`; replace `Dec` if it differs) and the Georgian search text `ბათ` (it must match only Batumi).

- [ ] **Step 2: Build once and run the spec against the production server**

From `apps/web` (stop any server on :3100 first):

```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build
npm run start -- --port 3100
```

(run `start` in the background), then:

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/inflation-cities.spec.ts
```

Expected: all tests pass. Look at the four `city-batumi-*` and `cities-*` screenshots in the test output folder: heading on one line at 1440px, the picker trigger wrapping cleanly at 390px, no clipped labels. Fix and re-run this file only. Leave the server running for Task 6 if Task 6 follows immediately; otherwise stop it.

- [ ] **Step 3: Commit**

```bash
git add tests/browser/inflation-cities.spec.ts
git commit -m "test(browser): cover the Georgia page, city pages and the heading picker"
```

---

### Task 6: Documents and the completion gates

**Files:**
- Modify: `DESIGN.md` (§ route table line 325, URL-state table line 359, §25.2)
- Modify: `Project_Definition.md:126`
- Modify: `docs/data-methodology/inflation-cpi-national.md` (after the paragraph at line 134)
- Modify: `apps/web/lib/methodology/content/inflation.ts:56`, `apps/web/lib/methodology/content/en/inflation.ts:56`
- Modify: `apps/web/public/llms.txt:26`

- [ ] **Step 1: DESIGN.md**

- Route table (line 325): replace the cities row with two rows: `/explorer/inflation/cities` — `Inflation by city: Georgia page (§25.2)` and `/explorer/inflation/cities/[city]` — `Inflation in one city (§25.2)`, in the table's existing column format.
- URL-state table (line 359): replace the row with `| Inflation cities | \`m\`, \`r\`, \`sel\` (place slugs on the Georgia page; \`total\`, \`01\`–\`12\` on a city page), \`t\` table line | — |`.
- Replace the whole of §25.2 (from `### 25.2 Cities` through the paragraph ending `…2026-09-26-inflation-cities-design.md.`) with:

```markdown
### 25.2 Cities

The section is a **Georgia page** at `/explorer/inflation/cities` and **one page per city** at `/explorer/inflation/cities/{tbilisi|kutaisi|batumi|gori|telavi|zugdidi}`. Both show annual inflation only (the unit line alone under the H1, no tabs) and repeat the overview's workspace, range strip, series panel, month grid, Excel action and indicators.

**Heading picker.** Both open with `ინფლაცია ქალაქებში — {place} ▾`, the place being the regions page's trigger (accent text, dashed accent underline, Lucide `ChevronDown`). It opens `CityPicker`, `RegionPicker`'s anatomy: search combobox, listbox, arrow keys and Enter, Escape or an outside click to close and refocus the trigger, the empty-search state and hint. `საქართველო` is first, styled as the "all" row; the six cities follow in Geostat's order; the current page is `aria-current`. City pages add `← {previous} · {next} →` on the right, wrapping; the Georgia page has none. There is no category select anywhere in the section.

**Georgia page.** Seven lines on the total: `საქართველო` first in ink as the benchmark, then the six cities, all selected by default — an owner-approved departure from the "only the total" rule; the count reads `სერიები {selected} / 7`. Indicators: hero = the city with the highest annual rate with its distance from Georgia in `პპ`; `ყველაზე დაბალი`; `ქალაქებს შორის სხვაობა` (36-month sparkline); `ეროვნულზე მაღალი` (`{n} / 6`, sparkline). Georgia is never ranked.

**City page.** The city's `სულ` in ink plus the 12 divisions in the Categories page's colours; only `სულ` is selected by default (`სერიები 1 / 13`). Georgia's line is not drawn. Coverage follows the city (Zugdidi from December 2016). Indicators: hero = the city's total with Georgia's beside it; `ყველაზე გაძვირებული`, `ყველაზე ნაკლებად გაძვირებული` / `ყველაზე გაიაფებული`, `ინფლაციის სიგანე` (`{n} / 12`, sparkline), each division against Georgia's same division in `პპ`.

**Shared rules.** Every difference subtracts the printed one-decimal figures. The month grid shows `წლის საშუალო` for a total line only; Zugdidi's late start leaves empty cells, never filled values. One standing note under the source says some prices are recorded once and applied to every city.

**City colours** (§4.2): Tbilisi `#B3402A`, Kutaisi `#3D5A98`, Batumi `#1F6E56`, Gori `#A5822B`, Telavi `#7A4E8C`, Zugdidi `#4A707A`, each ≥ 3:1 against paper and tint.

See `docs/superpowers/specs/2026-09-26-inflation-cities-design.md` as amended by `docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md`.
```

- [ ] **Step 2: Project_Definition.md, methodology, llms.txt**

- `Project_Definition.md:126`: replace the item with: `- Inflation cities at \`/explorer/inflation/cities\` and one page per city at \`/explorer/inflation/cities/{city}\`: annual inflation in Geostat's six price-collection cities (Tbilisi, Kutaisi, Batumi, Gori, Telavi, Zugdidi) from 2016-01. The Georgia page compares the six cities' totals with Georgia's national rate; each city page shows that city's total and 12 COICOP divisions. The 12-month average feeds the table's annual-average column; line chart, year × month table, Excel download; Georgian and English. Monthly city rates are served through the MCP and the bulk publications only. Implied city weights are a validation check only and are never published.` In line 122, append `, amended 2026-09-30 (\`docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md\`)` after the 2026-09-26 reference.
- `docs/data-methodology/inflation-cpi-national.md`: after the paragraph beginning `Geostat collects prices in six cities` (line 134), add the paragraph: `The site shows annual inflation only: a Georgia page comparing the six cities' totals with the national rate, and one page per city with its total and 12 divisions. Monthly city rates (\`mom_pct\`) stay in the CSV, the mirror, the MCP and the \`inflation-cities\` publications.`
- `lib/methodology/content/en/inflation.ts:56`: replace `The cities page shows each city's annual and monthly inflation from January 2016, overall and for the 12 COICOP groups, beside Georgia's national rate.` with `The cities pages show annual inflation from January 2016: one page compares the six cities' overall rates with Georgia's, and each city has its own page with its 12 COICOP groups.`
- `lib/methodology/content/inflation.ts:56`: replace `ქალაქების გვერდზე ჩანს თითოეული ქალაქის წლიური და თვიური ინფლაცია 2016 წლის იანვრიდან, სულ და COICOP-ის 12 ჯგუფის მიხედვით, საქართველოს მაჩვენებელთან ერთად.` with `ქალაქების გვერდებზე ჩანს წლიური ინფლაცია 2016 წლის იანვრიდან: ერთი გვერდი ექვსი ქალაქის საერთო მაჩვენებელს საქართველოს მაჩვენებელს ადარებს, ხოლო თითოეულ ქალაქს აქვს საკუთარი გვერდი COICOP-ის 12 ჯგუფით.`
- `public/llms.txt:26`: replace the text after the link with `— annual inflation in Tbilisi, Kutaisi, Batumi, Gori, Telavi and Zugdidi from 2016 compared with Georgia's national rate, plus one page per city with its 12 COICOP divisions. Some prices (fuel, medicines, cars, mobile tariffs, flights) are recorded once and applied to every city.` (keep the link itself unchanged).

Run: `npx vitest run tests/seo/agentFiles.test.ts && npm run i18n:check`
Expected: PASS. If `i18n:check` asks for the methodology translation review date, set `inflation` in `lib/methodology/content/en/revisions.ts` to `"2026-09-30"`; if a methodology test pins `reviewedAt`, update both content files' `reviewedAt` to `"2026-09-30"` together.

- [ ] **Step 3: Commit the documents**

```bash
git add ../../DESIGN.md ../../Project_Definition.md ../../docs/data-methodology/inflation-cpi-national.md lib/methodology public/llms.txt
git commit -m "docs(inflation): describe the Georgia page and the city pages"
```

- [ ] **Step 4: Completion gates (once)**

From `apps/web`:

```bash
npm run check
```

Expected: exit 0 (lint, typecheck, all unit tests, `data:validate`, `i18n:check`). Then the reference fixture explicitly:

```bash
npx vitest run tests/factQuery/reference.test.ts
```

Expected: PASS with 40 intents, unchanged. Then stop any server on :3100 and run:

```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build
```

Expected: exit 0, including `postbuild` publication checks. Start `npm run start -- --port 3100` in the background and run the whole browser suite:

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all pass. A download/request spec that fails under load is re-run alone before debugging. Stop the server afterwards.

- [ ] **Step 5: Confirm the tree is clean**

Run: `git status --short` — expected: empty (the build regenerates tracked publications only if data changed; it did not).
