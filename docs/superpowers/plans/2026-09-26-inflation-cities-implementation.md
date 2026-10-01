# Inflation Cities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/explorer/inflation/cities` (Georgian and English), which compares annual and monthly inflation in Geostat's six price-collection cities with Georgia's national rate, overall and by COICOP division. Serve the same city data through the read-only MCP and the bulk publications.

**Architecture:** City rows come from the city sheets of the Geostat workbooks we have already archived, via a new city mode on the existing reader. They land in one new canonical CSV, `data/imports/cpi-cities-monthly.csv`, with a Prisma mirror. Georgia's line is never copied into that CSV: the page and the MCP take it from the existing national and category facts. The page is a pure-state module (`lib/explorer/inflationCities.ts`) plus thin components, following the categories page. The MCP adds an optional `entityIds` to `query_inflation`, city entity rankings and city publications, on top of the one existing implementation, `inflationObservations`.

**Tech Stack:** Next.js 16 (static pages), strict TypeScript, Tailwind v4 with the editorial component layer, SheetJS (`xlsx`), decimal.js, Prisma 7 with Postgres, zod, Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-inflation-cities-design.md` (approved 2026-09-26). Read it before starting; the plan argues from it.

## Global Constraints

- City IDs: `city.tbilisi`, `city.kutaisi`, `city.batumi`, `city.gori`, `city.telavi`, `city.zugdidi`. Georgia's line on the page and in the MCP is `country.georgia`. Never reuse `region.*`.
- Series: `cpi.headline` plus the 12 divisions `cpi.cat.01` … `cpi.cat.12`. No subgroups, no core, no `index_2010`, no weights and no contributions for cities.
- Measures: `yoy_pct` and `mom_pct` for all 13 series; `avg12_pct` for `cpi.headline` only.
- City data starts `2016-01` (`CITY_FIRST_PERIOD`). Zugdidi's `yoy_pct` starts `2016-12` and its `avg12_pct` starts `2017-12`. These are shown as late starts and never filled.
- Implied city weights are a validation check. They are written only to `data/reports/inflation-cpi-validation.json`, never to a CSV, page, workbook, publication or MCP answer.
- The page has two tabs, `წლიური ინფლაცია` and `თვიური ინფლაცია`, and lands on the annual tab. There is no 12-month-average tab: `avg12_pct` only feeds the table's `წლის საშუალო` column, which appears when the category is `სულ` on the annual tab.
- All seven lines (Georgia, then the six cities) are selected by default. This is an owner-approved exception to the "only the total is selected" rule.
- Georgia is drawn in `INK`. City colours: Tbilisi `#B3402A`, Kutaisi `#3D5A98`, Batumi `#1F6E56`, Gori `#A5822B`, Telavi `#7A4E8C`, Zugdidi `#4A707A`.
- Indicators always describe the latest published month, year on year, for the picked category. Georgia is never a ranked entry.
- No map, no per-city pages and no new chart library. No shadcn and no new icon family.
- Percentages hold percentage points (`5.6479` = 5.6479%). Deltas between two rates are `პპ` / `pp`.
- `SCHEMA_VERSION` goes from `1.3.0` to `1.4.0`, and the change is additive.
- Existing inflation browser specs must stay green **unmodified**.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Delivery (when authorized): rename the branch to `codex/inflation-cities` before pushing, open a draft PR, get CI green, then merge (AGENTS.md "Workflow and Delivery"). Never push to `main`.
- Georgian copy introduced here has had no native read. Task 15 lists it for the owner.

## File Map

Created:
- `apps/web/lib/explorer/inflationCities.ts`: page state, hash, packing, lines, indicators (pure)
- `apps/web/lib/explorer/inflationCityLabels.ts`: city labels, colours, value formatting
- `apps/web/lib/explorer/inflationCityWorkbook.ts`: Excel export model
- `apps/web/components/inflation/inflation-cities.tsx`: the page
- `apps/web/components/inflation/inflation-city-panel.tsx`: series panel
- `apps/web/components/inflation/inflation-city-table.tsx`: year × month table
- `apps/web/components/inflation/inflation-city-indicators.tsx`: ძირითადი ინდიკატორები
- `apps/web/components/inflation/inflation-city-category-select.tsx`: category picker
- `apps/web/app/(ka)/explorer/inflation/cities/page.tsx`, `apps/web/app/(en)/en/explorer/inflation/cities/page.tsx`
- `apps/web/prisma/migrations/20260926000000_inflation_cities/migration.sql`
- `data/imports/cpi-cities-monthly.csv` (generated)
- Tests: `tests/data/inflation/readGeostatCpiCities.test.ts`, `tests/data/inflation/validateCities.test.ts`, `tests/data/inflation/prepareCities.test.ts`, `tests/explorer/inflationCities.test.ts`, `tests/explorer/inflationCitiesRender.test.tsx`, `tests/explorer/inflationCityWorkbook.test.ts`, `tests/explorer/fixtures/inflationCities.ts`, `tests/browser/inflation-cities.spec.ts`, `tests/factQuery/inflationCities.test.ts`

Modified (by task): see each task's **Files** block.

---

### Task 0: Workspace baseline

**Files:** none.

- [ ] **Step 1: Make sure dependencies match the lockfile**

Run from `apps/web`:

```bash
ls -la --time-style=+%s node_modules/.package-lock.json package-lock.json
```

If `node_modules` is missing, or `node_modules/.package-lock.json` is older than `package-lock.json`, run `npm ci`. A stale `node_modules` fails typecheck with errors that look like real breakage (CLAUDE.md).

- [ ] **Step 2: Baseline the narrow checks**

```bash
npm run typecheck
npx vitest run tests/data/inflation tests/explorer/inflationHub.test.ts
```

Expected: both pass. If they don't, stop and report; don't start the work on a red baseline.

---

### Task 1: City types and the city reader

**Files:**
- Modify: `apps/web/lib/data/inflation/types.ts` (append)
- Modify: `apps/web/lib/data/inflation/readGeostatCpi.ts`
- Test: `apps/web/tests/data/inflation/readGeostatCpiCities.test.ts`

**Interfaces:**
- Produces (types.ts): `CPI_CITY_IDS`, `CpiCityId`, `CITY_SHEETS`, `CITY_FIRST_PERIOD`, `CITY_SERIES_IDS`, `CPI_CITY_MEASURES`, `CpiCityMeasure`, `CpiCityFact`, `ServedCpiCityFact`, `CityFactInput`, `cityFactInput(fact)`.
- Produces (reader): `NATIONAL_SHEET` (now exported), `type CityRole = "yoy" | "mom" | "avg12"`, `type ParsedCitySeries = { seriesId: string; cells: ParsedCpiCell[] }`, and `readGeostatCpiCitySheets(content: Buffer, role: CityRole, language: CpiLanguage, sheetNames: readonly string[]): Map<string, ParsedCitySeries[]>`. The map is keyed by the requested sheet name and returns full history, untrimmed.

- [ ] **Step 1: Append the city types to `types.ts`**

```ts
/** The six cities where Geostat collects prices (metadata §3.7), in Geostat's sheet order. */
export const CPI_CITY_IDS = ["city.tbilisi", "city.kutaisi", "city.batumi", "city.gori", "city.telavi", "city.zugdidi"] as const;
export type CpiCityId = (typeof CPI_CITY_IDS)[number];

/** Sheet names as Geostat writes them; the reader matches them trimmed and case-insensitively. */
export const CITY_SHEETS: Readonly<Record<CpiCityId, { en: string; ka: string }>> = {
  "city.tbilisi": { en: "Tbilisi", ka: "თბილისი" },
  "city.kutaisi": { en: "Kutaisi", ka: "ქუთაისი" },
  "city.batumi": { en: "Batumi", ka: "ბათუმი" },
  "city.gori": { en: "Gori", ka: "გორი" },
  "city.telavi": { en: "Telavi", ka: "თელავი" },
  "city.zugdidi": { en: "Zugdidi", ka: "ზუგდიდი" },
};

/** Spec §1.1: the first month every city is observed, so all six share one window. */
export const CITY_FIRST_PERIOD = "2016-01";

/** Total and the 12 COICOP divisions; subgroups are out of scope for cities (spec §1.1). */
export const CITY_SERIES_IDS: readonly string[] = [
  "cpi.headline",
  ...Array.from({ length: 12 }, (_, index) => `cpi.cat.${String(index + 1).padStart(2, "0")}`),
];

export const CPI_CITY_MEASURES = ["yoy_pct", "mom_pct", "avg12_pct"] as const;
export type CpiCityMeasure = (typeof CPI_CITY_MEASURES)[number];

export type CpiCityFact = {
  cityId: CpiCityId;
  seriesId: string;
  measure: CpiCityMeasure;
  period: string;
  value: string;
  status: "published";
  sourceId: string;
  sourceLocator: string;
  lastReviewedAt: string;
};

export type ServedCpiCityFact = Omit<CpiCityFact, "value"> & { value: number };

/**
 * What the page needs from a city or national fact. `lineId` is a city ID or
 * `country.georgia`: the page draws Georgia beside the cities from the national
 * and category facts, which are never copied into the city CSV.
 */
export type CityFactInput = { lineId: string; seriesId: string; measure: CpiCityMeasure; period: string; value: number };

export function cityFactInput(fact: ServedCpiCityFact): CityFactInput {
  return { lineId: fact.cityId, seriesId: fact.seriesId, measure: fact.measure, period: fact.period, value: fact.value };
}
```

- [ ] **Step 2: Write the failing reader test**

Create `tests/data/inflation/readGeostatCpiCities.test.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { periodKey } from "../../../lib/data/inflation/periods";
import { readGeostatCpiCitySheets, readGeostatCpiFile } from "../../../lib/data/inflation/readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage } from "../../../lib/data/inflation/sourceFiles";

// One parse per workbook: each costs about three seconds.
const buffers = new Map<string, Promise<Buffer>>();
function workbook(language: "en" | "ka", file: string): Promise<Buffer> {
  const key = `${language}/${file}`;
  if (!buffers.has(key)) {
    buffers.set(key, latestCpiVintage().then((vintage) => fs.readFile(path.join(INFLATION_RAW_ROOT, "geostat-cpi", vintage, language, file))));
  }
  return buffers.get(key)!;
}
const EN_CITIES = ["Tbilisi", "Kutaisi", "Batumi", "Gori", "Telavi", "Zugdidi"];
const first = (cells: { period: number }[]) => periodKey(cells[0]!.period);

describe("readGeostatCpiCitySheets", () => {
  it("reads Total and the 12 divisions from every city sheet", async () => {
    const sheets = readGeostatCpiCitySheets(await workbook("en", "cpi-yoy.xlsx"), "yoy", "en", EN_CITIES);
    for (const city of EN_CITIES) {
      const series = sheets.get(city)!;
      expect(series.map((row) => row.seriesId)).toEqual(["cpi.headline", ...Array.from({ length: 12 }, (_, i) => `cpi.cat.${String(i + 1).padStart(2, "0")}`)]);
    }
  });

  it("rebases the =100 index to percentage change", async () => {
    const batumi = readGeostatCpiCitySheets(await workbook("en", "cpi-yoy.xlsx"), "yoy", "en", ["Batumi"]).get("Batumi")!;
    const total = batumi.find((row) => row.seriesId === "cpi.headline")!;
    expect(periodKey(total.cells.at(-1)!.period)).toBe("2026-08");
    expect(total.cells.at(-1)!.value).toBe("7.0857");
  });

  it("accepts Zugdidi's late starts instead of treating them as gaps", async () => {
    const yoy = readGeostatCpiCitySheets(await workbook("en", "cpi-yoy.xlsx"), "yoy", "en", ["Zugdidi"]).get("Zugdidi")!;
    const mom = readGeostatCpiCitySheets(await workbook("en", "cpi-mom.xlsx"), "mom", "en", ["Zugdidi"]).get("Zugdidi")!;
    const avg12 = readGeostatCpiCitySheets(await workbook("en", "cpi-avg12.xlsx"), "avg12", "en", ["Zugdidi"]).get("Zugdidi")!;
    expect(first(yoy[0]!.cells)).toBe("2016-12");
    expect(first(mom[0]!.cells)).toBe("2016-01");
    expect(avg12.map((row) => row.seriesId)).toEqual(["cpi.headline"]);
    expect(first(avg12[0]!.cells)).toBe("2017-12");
  });

  // Both readers share the national sheet, so they must agree on it exactly.
  it("reads the national sheet exactly as the national reader does", async () => {
    const content = await workbook("en", "cpi-yoy.xlsx");
    const city = readGeostatCpiCitySheets(content, "yoy", "en", ["Georgia"]).get("Georgia")![0]!;
    const national = readGeostatCpiFile(content, "yoy", "en")[0]!;
    expect(city.cells.map((cell) => `${cell.period}=${cell.value}`)).toEqual(national.cells.map((cell) => `${cell.period}=${cell.value}`));
  });

  it("carries identical values in the Georgian workbook", async () => {
    const en = readGeostatCpiCitySheets(await workbook("en", "cpi-yoy.xlsx"), "yoy", "en", ["Batumi"]).get("Batumi")!;
    const ka = readGeostatCpiCitySheets(await workbook("ka", "cpi-yoy.xlsx"), "yoy", "ka", ["ბათუმი"]).get("ბათუმი")!;
    expect(ka.map((row) => row.cells.map((cell) => cell.value).join("|"))).toEqual(en.map((row) => row.cells.map((cell) => cell.value).join("|")));
  });

  it("refuses a sheet that is not there", async () => {
    expect(() => readGeostatCpiCitySheets(Buffer.alloc(0), "yoy", "en", ["Rustavi"])).toThrow();
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/readGeostatCpiCities.test.ts`
Expected: FAIL, because `readGeostatCpiCitySheets` is not exported.

- [ ] **Step 4: Implement the reader changes in `readGeostatCpi.ts`**

1. Export the national sheet names: change `const NATIONAL_SHEET` to `export const NATIONAL_SHEET`.
2. Share one parse per buffer. Add this below `locator()`:

```ts
// One parse per workbook buffer: the national, category and city readers all read
// the same yoy/mom/avg12 files, and each parse costs about three seconds.
const books = new WeakMap<Buffer, XLSX.WorkBook>();
function readBook(content: Buffer): XLSX.WorkBook {
  let book = books.get(content);
  if (book === undefined) {
    book = XLSX.read(content, { type: "buffer" });
    books.set(content, book);
  }
  return book;
}
```

   Replace both existing `XLSX.read(content, { type: "buffer" })` calls (in `readGeostatCpiFile` and `readGeostatCpiCategories`) with `readBook(content)`.
3. Add an `allowLateStart` parameter, defaulting to `false`, to `readYearRows` and `readYearColumns`, so the national paths behave exactly as before. In both functions, replace

```ts
      if (raw === null) {
        ended = true;
        continue;
      }
```

   with

```ts
      if (raw === null) {
        // A city may start later than the table (Zugdidi); a hole after the start is still a layout fault.
        if (!allowLateStart || cells.length > 0) ended = true;
        continue;
      }
```

   The signatures become `readYearRows(rows: Rows, sheet: string, rebase: boolean, allowLateStart = false)` and `readYearColumns(rows: Rows, sheet: string, header: { row: number; col: number }, dataRow: number, rebase: boolean, allowLateStart = false)`. Existing call sites stay unchanged.
4. Append the city reader at the end of the file:

```ts
export type CityRole = "yoy" | "mom" | "avg12";
export type ParsedCitySeries = { seriesId: string; cells: ParsedCpiCell[] };

/**
 * Total and the 12 COICOP divisions from each named sheet (Total only for the
 * 12-month average, which Geostat publishes for no category). Full history: the
 * caller trims to the city window, and the consistency and weights checks need
 * the months before it (spec §4.3). A city may start late; after its first
 * value, a gap is a layout fault and throws.
 */
export function readGeostatCpiCitySheets(
  content: Buffer,
  role: CityRole,
  language: CpiLanguage,
  sheetNames: readonly string[],
): Map<string, ParsedCitySeries[]> {
  const book = readBook(content);
  const result = new Map<string, ParsedCitySeries[]>();
  for (const wanted of sheetNames) {
    const found = book.SheetNames.find((name) => name.trim().toLowerCase() === wanted.toLowerCase());
    if (!found) throw new Error(`CPI layout: sheet "${wanted}" not found in ${role}`);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[found]!, { header: 1, raw: true, defval: null });
    if (language === "en" && !text(rows[0]?.[0]).toLowerCase().includes(EN_TITLES[role].toLowerCase())) {
      throw new Error(`CPI layout: ${role} sheet ${found.trim()} title does not contain "${EN_TITLES[role]}"`);
    }
    const sheet = found.trim();
    if (role === "avg12") {
      result.set(wanted, [{ seriesId: "cpi.headline", cells: readYearRows(rows, sheet, true, true) }]);
      continue;
    }
    const header = findMonthHeader(rows);
    const totals = rows.flatMap((row, index) => (index > header.row && text(row[2]) === TOTAL_LABEL[language] ? [index] : []));
    if (totals.length !== 1) throw new Error(`CPI layout: expected one "${TOTAL_LABEL[language]}" row on ${sheet} in ${role}, found ${totals.length}`);
    const series: ParsedCitySeries[] = [{ seriesId: "cpi.headline", cells: readYearColumns(rows, sheet, header, totals[0]!, true, true) }];
    for (let row = header.row + 1; row < rows.length; row += 1) {
      if (numeric(rows[row]?.[0]) !== 2) continue;
      const { categoryId } = categoryIdFromCoicop(text(rows[row]?.[1]), 2);
      series.push({ seriesId: categoryId, cells: readYearColumns(rows, sheet, header, row, true, true) });
    }
    if (series.length !== 13) throw new Error(`CPI layout: expected Total and 12 divisions on ${sheet} in ${role}, found ${series.length}`);
    result.set(wanted, series);
  }
  return result;
}
```

   Add `categoryIdFromCoicop` to the existing `./types` import: `import { categoryIdFromCoicop, type CpiMeasure, type CpiSeriesId } from "./types";`.

- [ ] **Step 5: Run the new test and the existing reader tests**

Run: `npx vitest run tests/data/inflation/readGeostatCpiCities.test.ts tests/data/inflation/readGeostatCpi.test.ts tests/data/inflation/readGeostatCpiCategories.test.ts`
Expected: PASS. The two existing files must pass unmodified, which proves the national paths didn't change.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/data/inflation/types.ts apps/web/lib/data/inflation/readGeostatCpi.ts apps/web/tests/data/inflation/readGeostatCpiCities.test.ts
git commit -m "feat(inflation): read the Geostat city sheets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: City validation, consistency and the implied-weights check

**Files:**
- Modify: `apps/web/lib/data/inflation/validateInflation.ts` (append)
- Test: `apps/web/tests/data/inflation/validateCities.test.ts`

**Interfaces:**
- Consumes: the Task 1 types.
- Produces:
  - `cityFactKey(fact)`
  - `validateCityFacts(facts: CpiCityFact[]): { lastPeriod: string; counts: Record<string, number>; firstPeriods: Record<string, string> }`
  - `findCityRevisions` / `assertNoCityRevisions(previous, next)`
  - `chainIndex(mom: Map<number, number>): Map<number, number>`
  - `cityConsistencyError(series: { yoy: Map<number, number>; mom: Map<number, number>; avg12: Map<number, number> }): { maxPp: number; comparisons: number }`
  - `CITY_CONSISTENCY_TOLERANCE_PP = 0.01`
  - `type ImpliedCityWeights = { year: number; months: number; weights: Record<string, number>; maxResidualPp: number }`
  - `fitImpliedCityWeights(nationalMom: Map<number, number>, cityMom: ReadonlyMap<string, Map<number, number>>, fromYear: number): { years: ImpliedCityWeights[]; skippedYears: number[] }`
  - `assertImpliedCityWeights(fit)`
  - `IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP = 0.01`

- [ ] **Step 1: Write the failing tests**

Create `tests/data/inflation/validateCities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePeriod, periodKey } from "../../../lib/data/inflation/periods";
import { CITY_SERIES_IDS, CPI_CITY_IDS, type CpiCityFact } from "../../../lib/data/inflation/types";
import {
  assertImpliedCityWeights,
  assertNoCityRevisions,
  chainIndex,
  cityConsistencyError,
  fitImpliedCityWeights,
  validateCityFacts,
} from "../../../lib/data/inflation/validateInflation";

const LATE: Record<string, string> = { "city.zugdidi:yoy_pct": "2016-12", "city.zugdidi:avg12_pct": "2017-12" };
const months = (from: string, to: string) => {
  const out: string[] = [];
  for (let p = makePeriod(+from.slice(0, 4), +from.slice(5)); p <= makePeriod(+to.slice(0, 4), +to.slice(5)); p += 1) out.push(periodKey(p));
  return out;
};

/** A complete, valid city fact set for 2016-01 … 2017-12. */
function validFacts(): CpiCityFact[] {
  const facts: CpiCityFact[] = [];
  for (const cityId of CPI_CITY_IDS) {
    for (const measure of ["yoy_pct", "mom_pct", "avg12_pct"] as const) {
      const series = measure === "avg12_pct" ? ["cpi.headline"] : CITY_SERIES_IDS;
      for (const seriesId of series) {
        for (const period of months(LATE[`${cityId}:${measure}`] ?? "2016-01", "2017-12")) {
          facts.push({ cityId, seriesId, measure, period, value: "1.5", status: "published", sourceId: "source.geostat_cpi_yoy", sourceLocator: "Tbilisi!D7", lastReviewedAt: "2026-09-11" });
        }
      }
    }
  }
  return facts;
}

describe("validateCityFacts", () => {
  it("accepts the full set and reports Zugdidi's late starts", () => {
    const result = validateCityFacts(validFacts());
    expect(result.lastPeriod).toBe("2017-12");
    expect(result.firstPeriods["city.zugdidi:cpi.headline:yoy_pct"]).toBe("2016-12");
    expect(result.firstPeriods["city.tbilisi:cpi.headline:yoy_pct"]).toBe("2016-01");
  });

  it("rejects a month before the city window", () => {
    expect(() => validateCityFacts([...validFacts(), { ...validFacts()[0]!, period: "2015-12" }])).toThrow(/before 2016-01/);
  });

  it("rejects a gap after a series starts", () => {
    const facts = validFacts().filter((fact) => !(fact.cityId === "city.gori" && fact.seriesId === "cpi.cat.03" && fact.measure === "mom_pct" && fact.period === "2016-06"));
    expect(() => validateCityFacts(facts)).toThrow(/gap/);
  });

  it("rejects an unexpected late start", () => {
    const facts = validFacts().filter((fact) => !(fact.cityId === "city.batumi" && fact.measure === "yoy_pct" && fact.period === "2016-01"));
    expect(() => validateCityFacts(facts)).toThrow(/starts 2016-02/);
  });

  it("rejects a 12-month average for a category", () => {
    expect(() => validateCityFacts([...validFacts(), { ...validFacts()[0]!, seriesId: "cpi.cat.01", measure: "avg12_pct" }])).toThrow(/does not publish/);
  });

  it("rejects a missing division", () => {
    expect(() => validateCityFacts(validFacts().filter((fact) => fact.seriesId !== "cpi.cat.12" || fact.cityId !== "city.telavi"))).toThrow(/cpi.cat.12/);
  });
});

describe("assertNoCityRevisions", () => {
  it("stops on a changed published value", () => {
    const previous = validFacts();
    const next = previous.map((fact, index) => (index === 0 ? { ...fact, value: "9.9" } : fact));
    expect(() => assertNoCityRevisions(previous, next)).toThrow(/revised/);
  });
});

// Hand-built series: three cities, known weights, one calendar year.
const MOM: Record<string, number[]> = {
  a: [0.4, -0.2, 1.1, 0.3, 0.0, 0.7, -0.5, 0.9, 0.2, 0.6, -0.1, 0.8],
  b: [1.2, 0.5, -0.3, 0.1, 0.9, -0.4, 0.3, 0.2, 1.0, -0.2, 0.4, 0.0],
  c: [-0.6, 0.8, 0.2, 1.4, -0.3, 0.1, 0.6, -0.2, 0.3, 0.9, 0.5, -0.4],
};
const WEIGHTS: Record<string, number> = { a: 0.5, b: 0.3, c: 0.2 };
function series() {
  const cityMom = new Map(Object.entries(MOM).map(([id, values]) => [id, new Map(values.map((value, i) => [makePeriod(2016, i + 1), value]))]));
  const levels = new Map([...cityMom].map(([id, mom]) => [id, chainIndex(mom)]));
  const nationalLevel = (period: number) => Object.entries(WEIGHTS).reduce((sum, [id, weight]) => sum + weight * levels.get(id)!.get(period)!, 0);
  const nationalMom = new Map(Array.from({ length: 12 }, (_, i) => {
    const period = makePeriod(2016, i + 1);
    return [period, (nationalLevel(period) / nationalLevel(period - 1) - 1) * 100] as const;
  }));
  return { cityMom, nationalMom };
}

describe("fitImpliedCityWeights", () => {
  it("recovers the weights a national index was built from", () => {
    const { cityMom, nationalMom } = series();
    const fit = fitImpliedCityWeights(nationalMom, cityMom, 2016);
    expect(fit.years).toHaveLength(1);
    for (const [id, weight] of Object.entries(WEIGHTS)) expect(fit.years[0]!.weights[id]).toBeCloseTo(weight, 9);
    expect(fit.years[0]!.maxResidualPp).toBeLessThan(1e-9);
    expect(() => assertImpliedCityWeights(fit)).not.toThrow();
  });

  it("fails when the national index is not a weighted mean of the cities", () => {
    const { cityMom, nationalMom } = series();
    nationalMom.set(makePeriod(2016, 6), nationalMom.get(makePeriod(2016, 6))! + 0.05);
    expect(() => assertImpliedCityWeights(fitImpliedCityWeights(nationalMom, cityMom, 2016))).toThrow(/residual/);
  });

  it("skips a year with too few months to determine the weights", () => {
    const { cityMom, nationalMom } = series();
    for (const map of [nationalMom, ...cityMom.values()]) for (const month of [4, 5, 6, 7, 8, 9, 10, 11, 12]) map.delete(makePeriod(2016, month));
    const fit = fitImpliedCityWeights(nationalMom, cityMom, 2016);
    expect(fit.years).toHaveLength(0);
    expect(fit.skippedYears).toEqual([2016]);
    expect(() => assertImpliedCityWeights(fit)).toThrow(/no year/);
  });
});

describe("cityConsistencyError", () => {
  it("agrees with a y/y and 12-month average derived from the same chain", () => {
    const mom = new Map(Array.from({ length: 36 }, (_, i) => [makePeriod(2016, 1) + i, 0.3 + (i % 5) * 0.1] as const));
    const index = chainIndex(mom);
    const yoy = new Map([...mom.keys()].filter((p) => index.has(p - 12)).map((p) => [p, (index.get(p)! / index.get(p - 12)! - 1) * 100] as const));
    const result = cityConsistencyError({ yoy, mom, avg12: new Map() });
    expect(result.comparisons).toBeGreaterThan(20);
    expect(result.maxPp).toBeLessThan(1e-9);
    yoy.set([...yoy.keys()][3]!, yoy.get([...yoy.keys()][3]!)! + 0.5);
    expect(cityConsistencyError({ yoy, mom, avg12: new Map() }).maxPp).toBeGreaterThan(0.4);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run tests/data/inflation/validateCities.test.ts`
Expected: FAIL, because the imports don't exist yet.

- [ ] **Step 3: Implement in `validateInflation.ts`**

Extend the `./types` import with `CITY_FIRST_PERIOD, CITY_SERIES_IDS, CPI_CITY_IDS, CPI_CITY_MEASURES, type CpiCityFact`, and the `./periods` import with `makePeriod, periodYear`. Then append:

```ts
// City facts (spec 2026-09-26 §4.3). Unlike categories, a city series may start
// late but never has a hole; unlike the national series, two late starts are
// expected and named, so any other late start fails as a changed layout.
const EXPECTED_CITY_LATE_STARTS: Readonly<Record<string, string>> = {
  "city.zugdidi:yoy_pct": "2016-12",
  "city.zugdidi:avg12_pct": "2017-12",
};

export function cityFactKey(fact: Pick<CpiCityFact, "cityId" | "seriesId" | "measure" | "period">): string {
  return `${fact.cityId}:${fact.seriesId}:${fact.measure}:${fact.period}`;
}

export function validateCityFacts(facts: CpiCityFact[]): { lastPeriod: string; counts: Record<string, number>; firstPeriods: Record<string, string> } {
  const seen = new Set<string>();
  const periodsByGroup = new Map<string, number[]>();
  for (const fact of facts) {
    const key = cityFactKey(fact);
    if (!(CPI_CITY_IDS as readonly string[]).includes(fact.cityId)) throw new Error(`Unknown city ${fact.cityId}`);
    if (!CITY_SERIES_IDS.includes(fact.seriesId)) throw new Error(`Unknown city series ${fact.seriesId}`);
    if (!(CPI_CITY_MEASURES as readonly string[]).includes(fact.measure)) throw new Error(`Unknown city measure ${fact.measure}`);
    if (fact.measure === "avg12_pct" && fact.seriesId !== "cpi.headline") throw new Error(`City series ${fact.seriesId} does not publish avg12_pct`);
    if (!PERIOD.test(fact.period)) throw new Error(`Invalid city period ${fact.period}`);
    if (fact.period < CITY_FIRST_PERIOD) throw new Error(`City observation ${key} is before ${CITY_FIRST_PERIOD}`);
    if (seen.has(key)) throw new Error(`Duplicate city observation ${key}`);
    seen.add(key);
    const value = new Decimal(fact.value);
    if (!value.isFinite()) throw new Error(`Non-finite city observation ${key}`);
    if (value.decimalPlaces() > 6) throw new Error(`City observation ${key} has more than 6 decimals: ${fact.value}`);
    if (value.abs().gte(PLAUSIBLE_RATE_PCT * 8)) throw new Error(`City rate ${key} is outside a plausible range: ${fact.value}`);
    if (fact.status !== "published") throw new Error(`Invalid city status ${key}`);
    if (!fact.sourceId || !fact.sourceLocator || !DATE.test(fact.lastReviewedAt)) throw new Error(`City provenance missing ${key}`);
    const group = `${fact.cityId}:${fact.seriesId}:${fact.measure}`;
    periodsByGroup.set(group, [...(periodsByGroup.get(group) ?? []), periodFromKey(fact.period)]);
  }

  const counts: Record<string, number> = {};
  const firstPeriods: Record<string, string> = {};
  let last: number | null = null;
  for (const cityId of CPI_CITY_IDS) {
    for (const measure of CPI_CITY_MEASURES) {
      for (const seriesId of measure === "avg12_pct" ? ["cpi.headline"] : CITY_SERIES_IDS) {
        const group = `${cityId}:${seriesId}:${measure}`;
        const periods = (periodsByGroup.get(group) ?? []).sort((a, b) => a - b);
        if (periods.length === 0) throw new Error(`City coverage missing: ${group}`);
        for (let index = 1; index < periods.length; index += 1) {
          if (periods[index] !== periods[index - 1]! + 1) throw new Error(`City coverage gap: ${group} after ${periodKey(periods[index - 1]!)}`);
        }
        const expectedFirst = EXPECTED_CITY_LATE_STARTS[`${cityId}:${measure}`] ?? CITY_FIRST_PERIOD;
        if (periodKey(periods[0]!) !== expectedFirst) throw new Error(`City series ${group} starts ${periodKey(periods[0]!)}, expected ${expectedFirst}`);
        const end = periods.at(-1)!;
        if (last !== null && end !== last) throw new Error(`City series end in different months: ${group} ends ${periodKey(end)}, others ${periodKey(last)}`);
        last = end;
        counts[group] = periods.length;
        firstPeriods[group] = periodKey(periods[0]!);
      }
    }
  }
  return { lastPeriod: periodKey(last!), counts, firstPeriods };
}

export function findCityRevisions(previous: CpiCityFact[], next: CpiCityFact[]): string[] {
  const nextByKey = new Map(next.map((fact) => [cityFactKey(fact), fact]));
  const problems: string[] = [];
  for (const fact of previous) {
    const current = nextByKey.get(cityFactKey(fact));
    if (!current) problems.push(`${cityFactKey(fact)} removed`);
    else if (!new Decimal(current.value).eq(fact.value)) problems.push(`${cityFactKey(fact)} ${fact.value} → ${current.value}`);
  }
  return problems;
}

export function assertNoCityRevisions(previous: CpiCityFact[], next: CpiCityFact[]): void {
  const revisions = findCityRevisions(previous, next);
  if (revisions.length > 0) {
    throw new Error(`Geostat revised published city history; review before accepting (${revisions.length}):\n${revisions.slice(0, 20).join("\n")}`);
  }
}

/** A price level chained from month-on-month changes: 100 in the month before the first. Validation only. */
export function chainIndex(mom: Map<number, number>): Map<number, number> {
  const periods = [...mom.keys()].sort((a, b) => a - b);
  const index = new Map<number, number>();
  if (periods.length === 0) return index;
  let level = 100;
  index.set(periods[0]! - 1, level);
  for (const period of periods) {
    level *= 1 + mom.get(period)! / 100;
    index.set(period, level);
  }
  return index;
}

// A tripwire for a shifted column, not an accuracy claim: the 2026-08 vintage
// agrees with its own m/m chain within 0.0002 pp in every city.
export const CITY_CONSISTENCY_TOLERANCE_PP = 0.01;

export function cityConsistencyError(series: { yoy: Map<number, number>; mom: Map<number, number>; avg12: Map<number, number> }): { maxPp: number; comparisons: number } {
  const index = chainIndex(series.mom);
  let maxPp = 0;
  let comparisons = 0;
  for (const [period, value] of series.yoy) {
    const now = index.get(period);
    const before = index.get(period - 12);
    if (now === undefined || before === undefined) continue;
    maxPp = Math.max(maxPp, Math.abs((now / before - 1) * 100 - value));
    comparisons += 1;
  }
  for (const [period, value] of series.avg12) {
    let now = 0;
    let before = 0;
    let complete = true;
    for (let offset = 0; offset < 12 && complete; offset += 1) {
      const a = index.get(period - offset);
      const b = index.get(period - offset - 12);
      if (a === undefined || b === undefined) complete = false;
      else {
        now += a;
        before += b;
      }
    }
    if (!complete) continue;
    maxPp = Math.max(maxPp, Math.abs((now / before - 1) * 100 - value));
    comparisons += 1;
  }
  return { maxPp, comparisons };
}

export type ImpliedCityWeights = { year: number; months: number; weights: Record<string, number>; maxResidualPp: number };

// Geostat does not publish city weights (metadata §18.5). The national index is a
// weighted mean of the city indices, re-weighted each December, so within a year
// each month's national movement since December is Σ w · (the city's movement).
// These weights are a check that the cities add up to the national figure —
// never a published number (spec §3.5).
export const IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP = 0.01;

function solveLeastSquares(rows: number[][], targets: number[]): number[] {
  const size = rows[0]!.length;
  const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => rows.reduce((sum, row) => sum + row[i]! * row[j]!, 0)));
  const vector = Array.from({ length: size }, (_, i) => rows.reduce((sum, row, k) => sum + row[i]! * targets[k]!, 0));
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) if (Math.abs(matrix[row]![col]!) > Math.abs(matrix[pivot]![col]!)) pivot = row;
    [matrix[col], matrix[pivot]] = [matrix[pivot]!, matrix[col]!];
    [vector[col], vector[pivot]] = [vector[pivot]!, vector[col]!];
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = matrix[row]![col]! / matrix[col]![col]!;
      for (let c = col; c < size; c += 1) matrix[row]![c] = matrix[row]![c]! - factor * matrix[col]![c]!;
      vector[row] = vector[row]! - factor * vector[col]!;
    }
  }
  return vector.map((value, i) => value / matrix[i]![i]!);
}

export function fitImpliedCityWeights(
  nationalMom: Map<number, number>,
  cityMom: ReadonlyMap<string, Map<number, number>>,
  fromYear: number,
): { years: ImpliedCityWeights[]; skippedYears: number[] } {
  const national = chainIndex(nationalMom);
  const ids = [...cityMom.keys()];
  const cities = ids.map((id) => chainIndex(cityMom.get(id)!));
  const lastYear = periodYear(Math.max(...nationalMom.keys()));
  const years: ImpliedCityWeights[] = [];
  const skippedYears: number[] = [];
  for (let year = fromYear; year <= lastYear; year += 1) {
    const base = makePeriod(year - 1, 12);
    const rows: number[][] = [];
    const targets: number[] = [];
    for (let month = 1; month <= 12; month += 1) {
      const period = makePeriod(year, month);
      const ratios = cities.map((index) => (index.has(period) && index.has(base) ? index.get(period)! / index.get(base)! : null));
      if (!national.has(period) || !national.has(base) || ratios.some((ratio) => ratio === null)) continue;
      rows.push(ratios as number[]);
      targets.push(national.get(period)! / national.get(base)!);
    }
    // More equations than unknowns, or the weights are not determined.
    if (rows.length <= ids.length) {
      skippedYears.push(year);
      continue;
    }
    const solved = solveLeastSquares(rows, targets);
    const maxResidualPp = Math.max(...rows.map((row, k) => Math.abs(row.reduce((sum, ratio, i) => sum + ratio * solved[i]!, 0) - targets[k]!) * 100));
    years.push({ year, months: rows.length, weights: Object.fromEntries(ids.map((id, i) => [id, solved[i]!])), maxResidualPp });
  }
  return { years, skippedYears };
}

export function assertImpliedCityWeights(fit: { years: ImpliedCityWeights[] }): void {
  if (fit.years.length === 0) throw new Error("City weights: no year has enough months to check that the cities add up to the national index");
  for (const entry of fit.years) {
    if (entry.maxResidualPp > IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP) {
      throw new Error(`City weights ${entry.year}: the cities miss the national index by ${entry.maxResidualPp.toFixed(4)} pp (residual limit ${IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP})`);
    }
    const values = Object.values(entry.weights);
    if (values.some((weight) => !(weight > 0 && weight < 1))) throw new Error(`City weights ${entry.year}: a weight falls outside (0, 1)`);
    const sum = values.reduce((total, weight) => total + weight, 0);
    if (Math.abs(sum - 1) > 0.001) throw new Error(`City weights ${entry.year}: weights sum to ${sum.toFixed(4)}, not 1`);
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/data/inflation/validateCities.test.ts tests/data/inflation/validateCategories.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/data/inflation/validateInflation.ts apps/web/tests/data/inflation/validateCities.test.ts
git commit -m "feat(inflation): validate city facts and check the cities add up to the national index

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Prepare, the canonical CSV and the data methodology

**Files:**
- Modify: `apps/web/lib/data/inflation/prepareInflation.ts`
- Modify: `apps/web/lib/data/inflation/importInflation.ts` (add `loadCpiCityFacts` only; serving comes in Task 4)
- Create: `data/imports/cpi-cities-monthly.csv` (generated)
- Modify: `data/reports/inflation-cpi-validation.json` (generated)
- Modify: `docs/Raw Data/Inflation/geostat-cpi/2026-08/README.md`, `docs/data-methodology/inflation-cpi-national.md`
- Test: `apps/web/tests/data/inflation/prepareCities.test.ts`

**Interfaces:**
- Consumes: `readGeostatCpiCitySheets`, `NATIONAL_SHEET` and the Task 2 validators.
- Produces:
  - `prepareInflationCities(options?: { rawRoot?: string; files?: VerifiedCpiFile[]; previousFacts?: CpiCityFact[] | null; headlineFacts?: CpiFact[] }): Promise<{ facts: CpiCityFact[]; validation: InflationCityReport }>`
  - `serializeCityFacts(facts): string`
  - `type InflationCityReport`
  - `CPI_CITY_FACTS_CSV = "../../data/imports/cpi-cities-monthly.csv"`
  - `loadCpiCityFacts(relativePath?)`
  - `prepareInflation` and `prepareInflationCategories` gain an optional `files` option, so one run reads each workbook once.

- [ ] **Step 1: Write the failing test**

Create `tests/data/inflation/prepareCities.test.ts`:

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCpiFacts } from "../../../lib/data/inflation/importInflation";
import { prepareInflationCities, serializeCityFacts } from "../../../lib/data/inflation/prepareInflation";
import { INFLATION_RAW_ROOT, latestCpiVintage, readVerifiedCpiFiles } from "../../../lib/data/inflation/sourceFiles";
import { IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP } from "../../../lib/data/inflation/validateInflation";

// The same verified buffers serve every call, so the reader's book cache parses
// each of the six workbooks once for the whole file (a parse costs ~3 s).
const files = latestCpiVintage().then((vintage) => readVerifiedCpiFiles(path.join(INFLATION_RAW_ROOT, "geostat-cpi", vintage)));
const prepared = files.then((shared) => prepareInflationCities({ previousFacts: null, files: shared }));

describe("prepareInflationCities", () => {
  it("extracts six cities from 2016 in three measures", async () => {
    const { facts, validation } = await prepared;
    expect(validation.cityCount).toBe(6);
    expect(facts).toHaveLength(20570);
    expect(facts.every((fact) => fact.period >= "2016-01")).toBe(true);
    expect(facts.filter((fact) => fact.measure === "avg12_pct").every((fact) => fact.seriesId === "cpi.headline")).toBe(true);
    expect(validation.firstPeriods["city.zugdidi:cpi.headline:yoy_pct"]).toBe("2016-12");
    expect(validation.firstPeriods["city.zugdidi:cpi.headline:avg12_pct"]).toBe("2017-12");
  });

  it("keeps the published value and a sheet locator", async () => {
    const { facts } = await prepared;
    const batumi = facts.find((fact) => fact.cityId === "city.batumi" && fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2026-08")!;
    expect(batumi.value).toBe("7.0857");
    expect(batumi.sourceId).toBe("source.geostat_cpi_yoy");
    expect(batumi.sourceLocator).toMatch(/^Batumi!/);
  });

  it("proves the cities add up to the national index, within the limit, every year", async () => {
    const { validation } = await prepared;
    expect(validation.impliedWeights.map((entry) => entry.year)[0]).toBe(2016);
    for (const entry of validation.impliedWeights) expect(entry.maxResidualPp).toBeLessThan(IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP);
    const latest = validation.impliedWeights.at(-1)!;
    expect(latest.weights["city.tbilisi"]).toBeGreaterThan(0.5);
    expect(validation.maxConsistencyErrorPp).toBeLessThan(0.001);
  });

  it("stops on a revised published value", async () => {
    const { facts } = await prepared;
    const previous = facts.map((fact, index) => (index === 0 ? { ...fact, value: "99" } : fact));
    await expect(prepareInflationCities({ previousFacts: previous, files: await files })).rejects.toThrow(/revised/);
  });

  it("stops when the national sheet disagrees with the headline being written", async () => {
    const headline = await loadCpiFacts();
    const tampered = headline.map((fact) => (fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2020-01" ? { ...fact, value: "1" } : fact));
    await expect(prepareInflationCities({ previousFacts: null, headlineFacts: tampered, files: await files })).rejects.toThrow(/national sheet/);
  });

  it("serializes with a BOM and the documented header", async () => {
    const text = serializeCityFacts((await prepared).facts.slice(0, 1));
    expect(text.startsWith("﻿city_id,series_id,measure,period,value,status,source_id,source_locator,last_reviewed_at\n")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/prepareCities.test.ts`
Expected: FAIL, because `prepareInflationCities` is not exported.

- [ ] **Step 3: Implement `prepareInflationCities` in `prepareInflation.ts`**

Imports to add:
- From `./readGeostatCpi`: `NATIONAL_SHEET`, `readGeostatCpiCitySheets`
- From `./sourceFiles`: `type VerifiedCpiFile`
- From `./types`: `CITY_FIRST_PERIOD`, `CITY_SHEETS`, `CPI_CITY_IDS`, `CPI_CITY_MEASURES`, `type CpiCityFact`, `type CpiCityMeasure`
- From `./validateInflation`: `CITY_CONSISTENCY_TOLERANCE_PP`, `assertImpliedCityWeights`, `assertNoCityRevisions`, `cityConsistencyError`, `fitImpliedCityWeights`, `validateCityFacts`, `type ImpliedCityWeights`
- From `./importInflation`: `loadCpiCityFacts`
- From `./periods`: `periodYear`

Constants next to the others:

```ts
const CITY_FACTS_FILE = path.join(REPO_ROOT, "data/imports/cpi-cities-monthly.csv");
const CITY_HEADERS = ["city_id", "series_id", "measure", "period", "value", "status", "source_id", "source_locator", "last_reviewed_at"];
```

Add `files?: VerifiedCpiFile[]` to the options of both `prepareInflation` and `prepareInflationCategories`, and replace their `const files = await readVerifiedCpiFiles(...)` with:

```ts
  const files = options.files ?? (await readVerifiedCpiFiles(path.join(rawRoot, "geostat-cpi", vintage)));
```

Extend the report type:

```ts
export type InflationReportFile = InflationValidationReport & { categories: InflationCategoryReport; cities: InflationCityReport };

export type InflationCityReport = {
  cityCount: number;
  lastPeriod: string;
  firstPeriods: Record<string, string>;
  maxConsistencyErrorPp: number;
  /** Validation evidence only (spec §3.5): never written to a CSV, page, workbook or answer. */
  impliedWeights: ImpliedCityWeights[];
  skippedWeightYears: number[];
};
```

Add the prepare function:

```ts
const CITY_ROLES = ["yoy", "mom", "avg12"] as const;
const CITY_ROLE_MEASURE: Record<(typeof CITY_ROLES)[number], CpiCityMeasure> = { yoy: "yoy_pct", mom: "mom_pct", avg12: "avg12_pct" };
const GEORGIA = "country.georgia";

/**
 * City rows come from the same yoy, mom and avg12 workbooks the national series
 * reads: one sheet per city. Georgia's sheet is read too, but only as evidence —
 * the reader must agree with the national reader on it, and the cities must add
 * up to it (spec 2026-09-26 §4.3). It is never written to the city CSV.
 */
export async function prepareInflationCities(
  options: { rawRoot?: string; files?: VerifiedCpiFile[]; previousFacts?: CpiCityFact[] | null; headlineFacts?: CpiFact[] } = {},
) {
  const rawRoot = options.rawRoot ?? INFLATION_RAW_ROOT;
  const files = options.files ?? (await readVerifiedCpiFiles(path.join(rawRoot, "geostat-cpi", await latestCpiVintage(rawRoot))));
  const lines = [GEORGIA, ...CPI_CITY_IDS] as const;
  const sheetFor = (line: (typeof lines)[number], language: "en" | "ka") => (line === GEORGIA ? NATIONAL_SHEET[language] : CITY_SHEETS[line][language]);

  const facts: CpiCityFact[] = [];
  // Full-history headline per line, for the consistency and weights checks.
  const full = new Map<string, Record<CpiCityMeasure, Map<number, number>>>(
    lines.map((line) => [line, { yoy_pct: new Map(), mom_pct: new Map(), avg12_pct: new Map() }]),
  );
  for (const role of CITY_ROLES) {
    const english = files.find((file) => file.file_role === role && file.language === "en")!;
    const georgian = files.find((file) => file.file_role === role && file.language === "ka")!;
    const en = readGeostatCpiCitySheets(english.content, role, "en", lines.map((line) => sheetFor(line, "en")));
    const ka = readGeostatCpiCitySheets(georgian.content, role, "ka", lines.map((line) => sheetFor(line, "ka")));
    const measure = CITY_ROLE_MEASURE[role];
    for (const line of lines) {
      const enSeries = en.get(sheetFor(line, "en"))!;
      const kaSeries = ka.get(sheetFor(line, "ka"))!;
      enSeries.forEach((series, position) => {
        const other = kaSeries[position];
        const left = series.cells.map((cell) => `${cell.period}=${cell.value}`).join("|");
        const right = other?.cells.map((cell) => `${cell.period}=${cell.value}`).join("|");
        if (other?.seriesId !== series.seriesId || left !== right) throw new Error(`English and Georgian ${role} files differ for ${line} ${series.seriesId}`);
        if (series.seriesId === "cpi.headline") for (const cell of series.cells) full.get(line)![measure].set(cell.period, Number(cell.value));
        if (line === GEORGIA) return;
        for (const cell of series.cells) {
          const period = periodKey(cell.period);
          if (period < CITY_FIRST_PERIOD) continue;
          facts.push({
            cityId: line,
            seriesId: series.seriesId,
            measure,
            period,
            value: cell.value,
            status: "published",
            sourceId: english.source_id,
            sourceLocator: cell.locator,
            lastReviewedAt: english.retrieved_at,
          });
        }
      });
    }
  }
  facts.sort(
    (a, b) => a.cityId.localeCompare(b.cityId) || a.seriesId.localeCompare(b.seriesId) || a.measure.localeCompare(b.measure) || a.period.localeCompare(b.period),
  );

  const coverage = validateCityFacts(facts);

  // Both readers read the national sheet, so they must agree on it (spec §4.3).
  const headline = options.headlineFacts ?? (await loadCpiFacts());
  for (const measure of CPI_CITY_MEASURES) {
    for (const fact of headline.filter((row) => row.seriesId === "cpi.headline" && row.measure === measure && row.period >= CITY_FIRST_PERIOD)) {
      if (full.get(GEORGIA)![measure].get(periodFromKey(fact.period)) !== Number(fact.value)) {
        throw new Error(`City reader and national reader disagree on the national sheet: ${measure} ${fact.period}`);
      }
    }
  }

  let maxConsistencyErrorPp = 0;
  for (const [line, series] of full) {
    const result = cityConsistencyError({ yoy: series.yoy_pct, mom: series.mom_pct, avg12: series.avg12_pct });
    if (result.comparisons === 0) throw new Error(`City consistency: nothing to compare for ${line}`);
    if (result.maxPp > CITY_CONSISTENCY_TOLERANCE_PP) throw new Error(`City consistency: ${line} differs from its own m/m chain by ${result.maxPp.toFixed(4)} pp`);
    maxConsistencyErrorPp = Math.max(maxConsistencyErrorPp, result.maxPp);
  }

  const fit = fitImpliedCityWeights(
    full.get(GEORGIA)!.mom_pct,
    new Map(CPI_CITY_IDS.map((cityId) => [cityId, full.get(cityId)!.mom_pct])),
    periodYear(periodFromKey(CITY_FIRST_PERIOD)),
  );
  assertImpliedCityWeights(fit);

  const previous = options.previousFacts === undefined ? await loadPreviousCityFacts() : options.previousFacts;
  if (previous) assertNoCityRevisions(previous, facts);

  const round = (value: number) => Number(value.toFixed(6));
  const validation: InflationCityReport = {
    cityCount: CPI_CITY_IDS.length,
    lastPeriod: coverage.lastPeriod,
    firstPeriods: coverage.firstPeriods,
    maxConsistencyErrorPp: round(maxConsistencyErrorPp),
    impliedWeights: fit.years.map((entry) => ({
      year: entry.year,
      months: entry.months,
      weights: Object.fromEntries(Object.entries(entry.weights).map(([id, weight]) => [id, round(weight)])),
      maxResidualPp: round(entry.maxResidualPp),
    })),
    skippedWeightYears: fit.skippedYears,
  };
  return { facts, validation };
}

async function loadPreviousCityFacts(): Promise<CpiCityFact[] | null> {
  try {
    return await loadCpiCityFacts();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function serializeCityFacts(facts: CpiCityFact[]): string {
  const lines = facts.map((fact) =>
    [fact.cityId, fact.seriesId, fact.measure, fact.period, fact.value, fact.status, fact.sourceId, fact.sourceLocator, fact.lastReviewedAt].map(csvEscape).join(","),
  );
  return BOM + [CITY_HEADERS.join(","), ...lines].join("\n") + "\n";
}
```

The consistency error message must contain the word "national sheet" for the test above. It does ("…disagree on the national sheet…").

In `writeInflationArtifacts`, replace the two prepare calls and the outputs list with:

```ts
  // One verified read of the workbooks for all three extractions: each workbook
  // is then parsed once (readGeostatCpi's book cache is keyed by the buffer).
  const files = await readVerifiedCpiFiles(path.join(INFLATION_RAW_ROOT, "geostat-cpi", await latestCpiVintage()));
  const { facts, validation } = await prepareInflation({ files });
  const categories = await prepareInflationCategories({ headlineFacts: facts, files });
  const cities = await prepareInflationCities({ headlineFacts: facts, files });
  const outputs: Array<[string, string]> = [
    [CPI_FACTS_FILE, serializeCpiFacts(facts)],
    [CATEGORY_FACTS_FILE, serializeCategoryFacts(categories.facts)],
    [BASKET_WEIGHTS_FILE, serializeBasketWeights(categories.weights)],
    [CITY_FACTS_FILE, serializeCityFacts(cities.facts)],
    [
      REPORT_FILE,
      `${JSON.stringify({ ...validation, categories: categories.validation, cities: cities.validation } satisfies InflationReportFile, null, 2)}\n`,
    ],
  ];
```

In `importInflation.ts`, add after the category loaders:

```ts
export const CPI_CITY_FACTS_CSV = "../../data/imports/cpi-cities-monthly.csv";

export async function loadCpiCityFacts(relativePath = CPI_CITY_FACTS_CSV): Promise<CpiCityFact[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map((row): CpiCityFact => {
    if (!(CPI_CITY_IDS as readonly string[]).includes(row.city_id)) throw new Error(`Unknown city ${row.city_id}`);
    if (!(CPI_CITY_MEASURES as readonly string[]).includes(row.measure)) throw new Error(`Unknown city measure ${row.measure}`);
    return {
      cityId: row.city_id as CpiCityFact["cityId"],
      seriesId: row.series_id,
      measure: row.measure as CpiCityMeasure,
      period: row.period,
      value: new Decimal(row.value).toFixed(),
      status: row.status as CpiCityFact["status"],
      sourceId: row.source_id,
      sourceLocator: row.source_locator,
      lastReviewedAt: row.last_reviewed_at,
    };
  });
  validateCityFacts(facts);
  return facts;
}
```

Extend that file's imports accordingly: `CPI_CITY_IDS`, `CPI_CITY_MEASURES`, `type CpiCityFact` and `type CpiCityMeasure` from `./types`, and `validateCityFacts` from `./validateInflation`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/data/inflation/prepareCities.test.ts`
Expected: PASS. The test reads no CSV that doesn't exist yet (`previousFacts: null`), so it runs before the CSV is written.

- [ ] **Step 5: Generate the CSV and report, then review the diff**

```bash
npm run data:prepare-inflation
git status --short ../../data
git diff --stat ../../data
git diff ../../data/reports/inflation-cpi-validation.json | head -80
```

Expected:
- A new `data/imports/cpi-cities-monthly.csv` of 20,571 lines (header plus 20,570 rows), starting with a BOM and using LF line endings. Check with `head -c 3 ../../data/imports/cpi-cities-monthly.csv | od -c` (shows `357 273 277`) and `grep -c $'\r' ../../data/imports/cpi-cities-monthly.csv` (prints `0`).
- The report changes only by the new `"cities"` block.
- `cpi-national-monthly.csv`, `cpi-categories-monthly.csv` and `cpi-basket-weights.csv` are byte-for-byte unchanged (absent from `git status`).

Then check that the 2026 implied weights in the report are close to the audit's: Tbilisi 0.555, Kutaisi 0.122, Batumi 0.108, Telavi 0.079, Zugdidi 0.077, Gori 0.060.

- [ ] **Step 6: Run the check mode**

Run: `npm run data:check-inflation`
Expected: exits 0 with the national report JSON printed.

- [ ] **Step 7: Update the vintage README and the data methodology**

In `docs/Raw Data/Inflation/geostat-cpi/2026-08/README.md`, replace the sentence "Only the national sheet (`Georgia` / `საქართველო`) is read." with: "The national sheet (`Georgia` / `საქართველო`) and, in the `yoy`, `mom` and `avg12` files, the six city sheets are read."

In `docs/data-methodology/inflation-cpi-national.md`:
1. Add `data/imports/cpi-cities-monthly.csv` to the "Owner of:" list, and `docs/superpowers/specs/2026-09-26-inflation-cities-design.md` to its specs.
2. In "Sources and vintages", change "(national sheet only)" to "(national sheet; the `yoy`, `mom` and `avg12` files also supply the six city sheets, see Cities)".
3. Add a section before "Monthly refresh":

```markdown
## Cities

Geostat collects prices in six cities — Tbilisi, Kutaisi, Batumi, Gori, Telavi and Zugdidi — chosen by the region's share of population expenditure and city size, with the same consumer basket in each (Geostat CPI metadata, `https://www.geostat.ge/media/76676/0601_030226_EN.PDF`, §3.7, §18.1). The `yoy`, `mom` and `avg12` workbooks carry one sheet per city in the national sheet's layout. `prepare-inflation` reads Total and the 12 COICOP divisions from each (Total only from `avg12`) into `data/imports/cpi-cities-monthly.csv`: `city_id` (`city.tbilisi` … `city.zugdidi`), `series_id` (`cpi.headline`, `cpi.cat.01`–`12`), `measure` (`yoy_pct`, `mom_pct`, `avg12_pct`), `period`, `value` (percentage change: the published index minus 100), status and provenance. 20,570 rows for the 2026-08 vintage. Georgia is not repeated: the page and the MCP take the national line from `cpi-national-monthly.csv` and `cpi-categories-monthly.csv`.

**Scope (owner decisions, 2026-09-26).** City data starts 2016-01, the first month Zugdidi is observed. Divisions only, no subgroups. No 2010 = 100 index for any city: Zugdidi has none, and each city's index is relative to its own 2010 prices, so it cannot show which city is dearer. Core inflation is published for Georgia only.

**Late starts.** Zugdidi's first priced month is 2015-12, so its annual change starts 2016-12 and its 12-month average 2017-12. These are late starts, never filled; any other late start fails validation.

**Same price everywhere.** Some prices — pharmaceuticals, new and used cars, fuel, train and air fares, mobile tariffs, banking fees, intercity call tariffs — are recorded once and extended to every city (metadata §18.3). City differences in those items are not measured differences; the page, workbook and MCP say so.

**City weights are not published.** Geostat derives city weights from regional expenditure shares and updates them annually (metadata §18.5) but does not publish them. Validation recovers implied weights: within each calendar year the national index's movement since December is fitted as a weighted sum of the city indices' movements (each index chained from published m/m). On the 2026-08 vintage the fit is exact to 0.0001 pp in every year from 2016 (2026: Tbilisi 0.555, Kutaisi 0.122, Batumi 0.108, Telavi 0.079, Zugdidi 0.077, Gori 0.060). These are price-updated effective weights, not Geostat's, and they are used only as a check — written to `data/reports/inflation-cpi-validation.json`, never to a CSV, page, workbook, publication or MCP answer.

**Validation.** Six city sheets per workbook matched by trimmed, case-insensitive name; Total plus exactly 12 divisions per city; English and Georgian values identical; no gap after a series starts; first months 2016-01 except Zugdidi's two late starts; each city's y/y and 12-month average agree with its own m/m chain within 0.01 pp (a column-shift tripwire; measured ≤ 0.0002 pp); the city reader agrees with the national reader on the national sheet; the implied-weights fit residual ≤ 0.01 pp with every weight in (0, 1) and the weights summing to 1 within 0.001 (a year with no more months than cities is skipped and listed); the revision guard over every published city value.

**Refresh.** Cities arrive in the same workbooks as the national series; `prepare-inflation` rewrites `cpi-cities-monthly.csv` in the same run. Review: exactly one new month per city series.
```

4. In "Known limitations", append: "City figures are the six observation cities, not their regions; a city's inflation is not its cost of living or price level."

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/data/inflation/prepareInflation.ts apps/web/lib/data/inflation/importInflation.ts apps/web/tests/data/inflation/prepareCities.test.ts data/imports/cpi-cities-monthly.csv data/reports/inflation-cpi-validation.json "docs/Raw Data/Inflation/geostat-cpi/2026-08/README.md" docs/data-methodology/inflation-cpi-national.md
git commit -m "feat(inflation): prepare the city CSV with consistency and implied-weights checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Run `git add` from the repository root, or adjust the paths.)

---

### Task 4: Serving and the database mirror

**Files:**
- Modify: `apps/web/lib/data/inflation/importInflation.ts`
- Modify: `apps/web/lib/data/servedData.ts` (the `SERVED_DATA_FILES` entry)
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/20260926000000_inflation_cities/migration.sql`
- Modify: `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`
- Modify: `docs/data-methodology/database-import.md`
- Test: `apps/web/tests/data/inflation/importInflation.test.ts` (extend)

**Interfaces:**
- Produces:
  - `ServedInflationData.cities: ServedCpiCityFact[]`
  - `assertInflationParity(csv, db)`, where both sides now carry `cities: CpiCityFact[]`
  - `loadInflationCityFactsFromMirror(db)`
  - `loadInflationDataFromDb()`, which returns `cities`

- [ ] **Step 1: Extend the failing serving test**

In `tests/data/inflation/importInflation.test.ts`, add `loadCpiCityFacts` to the import. Add `cities: await loadCpiCityFacts(),` to the `csv` object in the first test, and add these assertions to that test:

```ts
    expect(() =>
      assertInflationParity(csv, { ...csv, cities: [{ ...csv.cities[0]!, value: "1" }, ...csv.cities.slice(1)] }),
    ).toThrow(/differs/);
```

Then add a test:

```ts
  it("serves the city facts as numbers", async () => {
    const { cities } = await loadServedInflationData();
    expect(cities).toHaveLength(20570);
    expect(typeof cities[0]!.value).toBe("number");
  });
```

Run: `npx vitest run tests/data/inflation/importInflation.test.ts`
Expected: FAIL. TypeScript/Vitest reports that `cities` does not exist on the parity input or on the served data.

- [ ] **Step 2: Serve the cities**

In `importInflation.ts`:
- Add `cities: CpiCityFact[]` to both parameter object types of `assertInflationParity`. Inside it, add `validateCityFacts(db.cities);` and `assertSameServedRows("Inflation CPI cities", csv.cities, db.cities, cityFactKey);`. Import `cityFactKey` from `./validateInflation` and `type ServedCpiCityFact` from `./types`.
- Add `cities: ServedCpiCityFact[];` to `ServedInflationData` and to the return type of `loadServedInflationDataUncached`.
- In `loadServedInflationDataUncached`, add `let cities = await loadCpiCityFacts();`. Include `...cities` in the registered-source loop. Pass `cities` into `assertInflationParity({ facts, targets, categories, weights, cities }, db)` and assign `cities = db.cities;` in db mode. Return `cities: cities.map((fact) => ({ ...fact, value: Number(fact.value) })),`.

In `lib/data/servedData.ts`, add to `SERVED_DATA_FILES`:

```ts
  inflationCityFacts: "../../data/imports/cpi-cities-monthly.csv",
```

- [ ] **Step 3: Add the mirror model and migration**

In `prisma/schema.prisma`, add after `model InflationBasketWeight`:

```prisma
model InflationCityFact {
  cityId           String
  seriesId         String
  measure          String
  period           String
  value            Decimal        @db.Decimal(20, 6)
  status           String
  sourceLocator    String
  sourceDocumentId String
  sourceDocument   SourceDocument @relation(fields: [sourceDocumentId], references: [id])
  lastReviewedAt   DateTime       @db.Date
  importRunId      String?
  importRun        ImportRun?     @relation(fields: [importRunId], references: [id])

  @@id([cityId, seriesId, measure, period])
}
```

Add `inflationCityFacts InflationCityFact[]` directly under `inflationBasketWeights InflationBasketWeight[]` in both `SourceDocument` and `ImportRun` (the two blocks around lines 80–118).

Create `prisma/migrations/20260926000000_inflation_cities/migration.sql`:

```sql
CREATE TABLE "InflationCityFact" (
  "cityId" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "measure" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "value" DECIMAL(20,6) NOT NULL,
  "status" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "InflationCityFact_pkey" PRIMARY KEY ("cityId", "seriesId", "measure", "period"),
  CONSTRAINT "InflationCityFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationCityFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "InflationCityFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InflationCityFact" FROM anon, authenticated;
```

Run `npm run prisma:generate`. Never run `prisma:migrate` or `prisma:deploy` from this task; the release pipeline applies migrations (`docs/data-methodology/database-import.md`).

- [ ] **Step 4: Wire the mirror**

In `lib/db/mirrorRows.ts`, add `CpiCityFact` to the inflation type import and append:

```ts
export async function loadInflationCityFactsFromMirror(db: MirrorClient): Promise<CpiCityFact[]> {
  const rows = await db.inflationCityFact.findMany({ orderBy: [{ cityId: "asc" }, { seriesId: "asc" }, { measure: "asc" }, { period: "asc" }] });
  return rows.map((row) => ({
    cityId: row.cityId as CpiCityFact["cityId"],
    seriesId: row.seriesId,
    measure: row.measure as CpiCityFact["measure"],
    period: row.period,
    value: row.value.toFixed(),
    status: row.status as CpiCityFact["status"],
    sourceId: row.sourceDocumentId,
    sourceLocator: row.sourceLocator,
    lastReviewedAt: isoDate(row.lastReviewedAt),
  }));
}
```

In `lib/db/servedDataDb.ts`, import it, add it to the `Promise.all` in `loadInflationDataFromDb`, and return `{ facts, targets, categories, weights, cities }`.

In `scripts/import-budget-facts.ts`, mirroring the category lines exactly:
- Import `loadCpiCityFacts` and `loadInflationCityFactsFromMirror`.
- Add `const inflationCityFacts = await loadCpiCityFacts(SERVED_DATA_FILES.inflationCityFacts);` and add `...inflationCityFacts` to the "Inflation source IDs" `assertSubset`.
- Add `await tx.inflationCityFact.deleteMany();` after `await tx.inflationBasketWeight.deleteMany();`.
- After the basket-weight `createMany`, add:

```ts
        await tx.inflationCityFact.createMany({
          data: inflationCityFacts.map(({ sourceId, lastReviewedAt, ...fact }) => ({
            ...fact,
            sourceDocumentId: sourceId,
            lastReviewedAt: new Date(`${lastReviewedAt}T00:00:00.000Z`),
            importRunId: run.id,
          })),
        });
```

- Add `cities: await loadInflationCityFactsFromMirror(tx),` to `mirrorInflation`, and `cities: inflationCityFacts,` to the CSV side of `assertInflationParity`.
- Add a parity report row: `{ table: "InflationCityFact", csvRows: inflationCityFacts.length, dbRows: mirrorInflation.cities.length },`.

In `docs/data-methodology/database-import.md`, add a table row after `InflationBasketWeight`:

```markdown
| `InflationCityFact` | `data/imports/cpi-cities-monthly.csv` (six Geostat price-collection cities from 2016-01: Total and 12 COICOP divisions y/y and m/m, Total 12-month average; 20,570 rows; generated by `npm run data:prepare-inflation`; migration `20260926000000_inflation_cities`) |
```

- [ ] **Step 5: Run the checks**

```bash
npx vitest run tests/data/inflation
npm run typecheck
```

Expected: PASS. `tests/data/inflation/servingBoundary.test.ts` must still pass: serving must not import the reader.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/data apps/web/prisma apps/web/lib/db apps/web/scripts/import-budget-facts.ts apps/web/tests/data/inflation/importInflation.test.ts docs/data-methodology/database-import.md
git commit -m "feat(inflation): serve and mirror the city facts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: City labels, colours and messages

**Files:**
- Modify: `apps/web/lib/explorer/colors.ts`
- Create: `apps/web/lib/explorer/inflationCityLabels.ts`
- Modify: `apps/web/lib/i18n/messages/ka/inflation.json`, `apps/web/lib/i18n/messages/en/inflation.json`, `apps/web/lib/i18n/messages/ka/common.json`, `apps/web/lib/i18n/messages/en/common.json`
- Modify: `data/localization/en/page-revisions.json`
- Test: `apps/web/tests/explorer/colors.test.ts` (extend)

**Interfaces:**
- Produces:
  - `cityLineColor(lineId: string): string` (INK for Georgia)
  - `cityLineLabel(messages, lineId)`
  - `cityCategoryLabel(messages, category)`
  - `formatCityValue(value: number, tab: "yoy" | "mom"): string`

- [ ] **Step 1: Write the failing colour test**

Append to `tests/explorer/colors.test.ts`:

```ts
describe("inflation city colours", () => {
  const CITIES = ["city.tbilisi", "city.kutaisi", "city.batumi", "city.gori", "city.telavi", "city.zugdidi"];
  it("gives each city a distinct colour that holds 3:1 against paper and tint", () => {
    const colours = CITIES.map((id) => SERIES_COLORS[id]);
    expect(new Set(colours).size).toBe(6);
    for (const colour of colours) {
      expect(colour).toMatch(/^#[0-9A-F]{6}$/);
      expect(contrastRatio(colour!, PAPER)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(colour!, TINT)).toBeGreaterThanOrEqual(3);
    }
  });
});
```

Run: `npx vitest run tests/explorer/colors.test.ts`
Expected: FAIL, because the `SERIES_COLORS` entries are undefined.

- [ ] **Step 2: Add the colours**

In `lib/explorer/colors.ts`, after `"cpi.cat.residual": "#94856D",`:

```ts

  // Inflation cities (spec 2026-09-26 §6). Six hue families; Georgia is the ink
  // benchmark and needs no entry.
  "city.tbilisi": "#B3402A",
  "city.kutaisi": "#3D5A98",
  "city.batumi": "#1F6E56",
  "city.gori": "#A5822B",
  "city.telavi": "#7A4E8C",
  "city.zugdidi": "#4A707A",
```

- [ ] **Step 3: Add the labels module**

Create `lib/explorer/inflationCityLabels.ts`:

```ts
import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { INK, SERIES_COLORS } from "./colors";
import { formatShare } from "./format";
import { categoryLabel } from "./inflationCategoryLabels";
import { displayedValue } from "./inflationGrid";

// Labels and colours for the cities page. Georgia is the ink benchmark; each city
// keeps one colour across chart, panel, table and indicators (DESIGN.md §4.2).

export function cityLineColor(lineId: string): string {
  return SERIES_COLORS[lineId] ?? INK;
}

export function cityLineLabel(messages: Messages, lineId: string): string {
  return message(messages, `inflation.city.${lineId}`);
}

/** `cpi.headline` reads as სულ / Total; the divisions keep Geostat's own wording. */
export function cityCategoryLabel(messages: Messages, category: string): string {
  return category === "cpi.headline" ? message(messages, "inflation.cityCategoryTotal") : categoryLabel(messages, category);
}

/** Percentage points shown as percent; monthly change is signed. */
export function formatCityValue(value: number, tab: "yoy" | "mom"): string {
  return formatShare(displayedValue(value) / 100, tab === "mom");
}
```

- [ ] **Step 4: Add the messages**

Add these keys to `lib/i18n/messages/ka/inflation.json` after `"inflation.categoriesMetaTitle"` (same order in `en`):

| key | ka | en |
| --- | --- | --- |
| `inflation.citiesHeading` | `ქალაქები` | `Cities` |
| `inflation.citiesDescription` | `ინფლაცია იმ ექვს ქალაქში, სადაც საქსტატი ფასებს აღრიცხავს — სულ და კატეგორიების მიხედვით, საქართველოს მაჩვენებელთან ერთად.` | `Inflation in the six cities where Geostat records prices — overall and by category, beside Georgia's rate.` |
| `inflation.citiesMetaTitle` | `ინფლაცია ქალაქების მიხედვით {first}–{last} \| Fiscal.ge` | `Inflation by city {first}–{last} \| Fiscal.ge` |
| `inflation.city.country.georgia` | `საქართველო` | `Georgia` |
| `inflation.city.city.tbilisi` | `თბილისი` | `Tbilisi` |
| `inflation.city.city.kutaisi` | `ქუთაისი` | `Kutaisi` |
| `inflation.city.city.batumi` | `ბათუმი` | `Batumi` |
| `inflation.city.city.gori` | `გორი` | `Gori` |
| `inflation.city.city.telavi` | `თელავი` | `Telavi` |
| `inflation.city.city.zugdidi` | `ზუგდიდი` | `Zugdidi` |
| `inflation.cityCategoryLabel` | `კატეგორია` | `Category` |
| `inflation.cityCategoryTotal` | `სულ` | `Total` |
| `inflation.citySource` | `მონაცემები: საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი), სამომხმარებლო ფასების ინდექსი ქალაქების მიხედვით.` | `Data: National Statistics Office of Georgia (Geostat), consumer price index by city.` |
| `inflation.cityCentralPricesNote` | `ზოგიერთი ფასი — საწვავი, მედიკამენტები, ავტომობილები, მობილური კავშირის ტარიფები, ავია- და მატარებლის ბილეთები — ერთხელ აღირიცხება და ყველა ქალაქზე ვრცელდება, ამიტომ ამ პროდუქტებში ქალაქებს შორის სხვაობა გაზომილი არ არის.` | `Some prices — fuel, medicines, cars, mobile tariffs, flights and train fares — are recorded once and applied to every city, so city differences in those items are not measured differences.` |
| `inflation.cityHighest` | `ყველაზე მაღალი` | `Highest` |
| `inflation.cityLowest` | `ყველაზე დაბალი` | `Lowest` |
| `inflation.cityGap` | `ქალაქებს შორის სხვაობა` | `Gap between cities` |
| `inflation.cityGapDetail` | `უმაღლესსა და უდაბლესს შორის` | `highest minus lowest` |
| `inflation.cityAboveNational` | `ეროვნულზე მაღალი` | `Above national` |
| `inflation.cityAboveNationalValue` | `{count} / {total}` | `{count} / {total}` |
| `inflation.cityAboveNationalDetail` | `ქალაქი საქართველოს მაჩვენებელზე მაღლა` | `cities above Georgia's rate` |
| `inflation.cityHeroDetail` | `{city}: წლიური ინფლაცია {value}; საქართველოში {national}, სხვაობა {delta} პპ.` | `{city}: annual inflation {value}; Georgia {national}, a difference of {delta} pp.` |
| `inflation.cityVsNational` | `{city} · საქართველოსთან {delta} პპ` | `{city} · {delta} pp against Georgia` |
| `inflation.cityFellDetail` | `{city} · გაიაფდა, საქართველოსთან {delta} პპ` | `{city} · prices fell, {delta} pp against Georgia` |
| `inflation.cityColumn` | `ქალაქი` | `City` |

Add `"common.inflationCities": "ქალაქები"` to `ka/common.json` and `"common.inflationCities": "Cities"` to `en/common.json`, directly after `common.inflationCategories`.

In `data/localization/en/page-revisions.json`, add `"/explorer/inflation/cities": "2026-09-26"` after the categories entry, and set `"/methodology/inflation"` to `"2026-09-26"` (its page changes in Task 10).

- [ ] **Step 5: Run the checks**

```bash
npx vitest run tests/explorer/colors.test.ts
npm run i18n:check
```

Expected: PASS. `i18n:check` enforces ka/en key parity and page revisions.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/explorer/colors.ts apps/web/lib/explorer/inflationCityLabels.ts apps/web/lib/i18n/messages apps/web/tests/explorer/colors.test.ts data/localization/en/page-revisions.json
git commit -m "feat(inflation): city colours, labels and messages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Page state, hash and indicators

**Files:**
- Create: `apps/web/lib/explorer/inflationCities.ts`
- Create: `apps/web/tests/explorer/fixtures/inflationCities.ts`
- Test: `apps/web/tests/explorer/inflationCities.test.ts`

**Interfaces:**
- Consumes: `CityFactInput`, `CPI_CITY_IDS`, `periodRange` helpers, `decemberAverages`.
- Produces:
  - Constants and types: `GEORGIA_LINE_ID`, `HEADLINE_ID`, `CITY_LINE_IDS`, `CityLineId`, `CITY_TABS`, `CityTab`, `CITY_CATEGORIES`, `CityState`, `DEFAULT_CITY_STATE`, `PackedCitySeries`
  - Packing and index: `packCityFacts`, `unpackCityFacts`, `buildCityIndex`, `CityIndex`, `cityValues(index, lineId, seriesId, measure)`
  - Range and tabs: `cityCoverage(index, tab)`, `resolveCityRange`, `changeCityTab`, `rangeFromPatch`
  - Selection: `toggleCityLine`, `toggleAllCityLines`
  - Chart, panel and table: `buildCityLines`, `cityPanelValue`, `cityTableOptions`, `effectiveCityTableSeries`, `cityAnnualAverages`
  - Indicators: `latestCityIndicators(index, category): CityIndicators | null`
  - Hash: `parseCityHash`, `serializeCityHash`

- [ ] **Step 1: Write the fixture**

Create `tests/explorer/fixtures/inflationCities.ts`:

```ts
import type { CityFactInput } from "../../../lib/data/inflation/types";

const MONTHS = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

/** Annual rates for August 2026, the latest month; earlier months are the same value minus 0.1 per month back. */
const LATEST: Record<string, { total: number; food: number }> = {
  "country.georgia": { total: 5.6479, food: 5.0154 },
  "city.tbilisi": { total: 5.6358, food: 4.8642 },
  "city.kutaisi": { total: 5.7517, food: 6.507 },
  "city.batumi": { total: 7.0857, food: 5.9542 },
  "city.gori": { total: 5.3103, food: 4.0405 },
  "city.telavi": { total: 4.3561, food: 3.4353 },
  "city.zugdidi": { total: 5.1062, food: 4.8152 },
};

export const fixtureCityFacts: CityFactInput[] = Object.entries(LATEST).flatMap(([lineId, latest]) =>
  MONTHS.flatMap((period, index) => {
    const back = (MONTHS.length - 1 - index) * 0.1;
    return [
      { lineId, seriesId: "cpi.headline", measure: "yoy_pct" as const, period, value: latest.total - back },
      { lineId, seriesId: "cpi.cat.01", measure: "yoy_pct" as const, period, value: latest.food - back },
      { lineId, seriesId: "cpi.headline", measure: "mom_pct" as const, period, value: 0.2 },
      ...(period === "2025-12" ? [{ lineId, seriesId: "cpi.headline", measure: "avg12_pct" as const, period, value: 4.1 }] : []),
    ];
  }),
);
```

- [ ] **Step 2: Write the failing state test**

Create `tests/explorer/inflationCities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import {
  CITY_LINE_IDS,
  DEFAULT_CITY_STATE,
  buildCityIndex,
  buildCityLines,
  changeCityTab,
  cityAnnualAverages,
  latestCityIndicators,
  packCityFacts,
  parseCityHash,
  resolveCityRange,
  serializeCityHash,
  toggleAllCityLines,
  toggleCityLine,
  unpackCityFacts,
} from "../../lib/explorer/inflationCities";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const index = buildCityIndex(fixtureCityFacts);

describe("inflation cities state", () => {
  it("defaults to annual inflation, the total and all seven lines, Georgia first", () => {
    expect(DEFAULT_CITY_STATE).toMatchObject({ tab: "yoy", mode: "chart", category: "cpi.headline", tableSeries: null });
    expect(DEFAULT_CITY_STATE.selected).toEqual([...CITY_LINE_IDS]);
    expect(CITY_LINE_IDS[0]).toBe("country.georgia");
  });

  it("round-trips the facts through the packed wire form", () => {
    expect(unpackCityFacts(packCityFacts(fixtureCityFacts))).toHaveLength(fixtureCityFacts.length);
  });

  it("draws one line per selected series for the picked category", () => {
    const state = { ...DEFAULT_CITY_STATE, category: "cpi.cat.01" };
    const range = resolveCityRange(state, index);
    const { lines } = buildCityLines(index, state, range);
    expect(lines.map((line) => line.key)).toEqual([...CITY_LINE_IDS]);
    expect(lines.find((line) => line.key === "city.kutaisi")!.values.at(-1)).toBeCloseTo(6.507, 4);
  });

  it("keeps Georgia first and removable when toggling", () => {
    const without = toggleCityLine(DEFAULT_CITY_STATE, "country.georgia");
    expect(without.selected[0]).toBe("city.tbilisi");
    expect(toggleCityLine(without, "country.georgia").selected[0]).toBe("country.georgia");
    expect(toggleAllCityLines(DEFAULT_CITY_STATE).selected).toEqual([]);
    expect(toggleAllCityLines({ ...DEFAULT_CITY_STATE, selected: [] }).selected).toEqual([...CITY_LINE_IDS]);
  });

  it("offers the annual average only for the total on the annual tab", () => {
    expect(cityAnnualAverages(index, DEFAULT_CITY_STATE, "city.batumi")?.get(2025)).toBe(4.1);
    expect(cityAnnualAverages(index, { ...DEFAULT_CITY_STATE, category: "cpi.cat.01" }, "city.batumi")).toBeUndefined();
    expect(cityAnnualAverages(index, { ...DEFAULT_CITY_STATE, tab: "mom" }, "city.batumi")).toBeUndefined();
  });

  it("refits the range when the tab changes", () => {
    const state = changeCityTab({ ...DEFAULT_CITY_STATE, range: { kind: "manual", start: makePeriod(2026, 1), end: makePeriod(2026, 8) } }, "mom", index);
    expect(state.tab).toBe("mom");
  });

  it("round-trips the hash with short, stable values", () => {
    const state = { ...DEFAULT_CITY_STATE, tab: "mom" as const, mode: "table" as const, category: "cpi.cat.07", selected: ["country.georgia", "city.batumi"] as typeof DEFAULT_CITY_STATE.selected, tableSeries: "city.batumi" as const };
    const hash = serializeCityHash(state);
    expect(hash).toContain("c=07");
    expect(hash).toContain("sel=georgia%2Cbatumi");
    expect(parseCityHash(`#${hash}`)).toMatchObject({ tab: "mom", mode: "table", category: "cpi.cat.07", selected: ["country.georgia", "city.batumi"], tableSeries: "city.batumi" });
  });

  it("drops unknown hash values rather than failing", () => {
    expect(parseCityHash("#i=index&c=99&sel=rustavi,batumi&t=rustavi")).toMatchObject({ tab: "yoy", category: "cpi.headline", selected: ["city.batumi"], tableSeries: null });
  });
});

describe("latestCityIndicators", () => {
  it("names the highest and lowest city against Georgia for the total", () => {
    const latest = latestCityIndicators(index, "cpi.headline")!;
    expect(latest.period).toBe(makePeriod(2026, 8));
    expect(latest.highest.cityIds).toEqual(["city.batumi"]);
    expect(latest.highest.deltaPp).toBeCloseTo(7.0857 - 5.6479, 6);
    expect(latest.lowest.cityIds).toEqual(["city.telavi"]);
    expect(latest.lowest.fell).toBe(false);
    expect(latest.gap.value).toBeCloseTo(7.0857 - 4.3561, 6);
    expect(latest.aboveNational).toMatchObject({ count: 2, total: 6 });
  });

  it("follows the picked category", () => {
    const latest = latestCityIndicators(index, "cpi.cat.01")!;
    expect(latest.highest.cityIds).toEqual(["city.kutaisi"]);
    expect(latest.aboveNational?.count).toBe(2);
  });

  it("never ranks Georgia", () => {
    const latest = latestCityIndicators(index, "cpi.headline")!;
    expect([...latest.highest.cityIds, ...latest.lowest.cityIds]).not.toContain("country.georgia");
  });

  it("names every tied city", () => {
    // Set exactly, not by arithmetic: 5.3103 + 1.7754 need not equal 7.0857 in floating point.
    const tied = buildCityIndex(fixtureCityFacts.map((fact) => (fact.lineId === "city.gori" && fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2026-08" ? { ...fact, value: 7.0857 } : fact)));
    expect(latestCityIndicators(tied, "cpi.headline")!.highest.cityIds).toEqual(["city.batumi", "city.gori"]);
  });
});
```

Run: `npx vitest run tests/explorer/inflationCities.test.ts`
Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement `lib/explorer/inflationCities.ts`**

```ts
import { periodFromKey, periodKey } from "../data/inflation/periods";
import { CPI_CITY_IDS, type CityFactInput, type CpiCityMeasure } from "../data/inflation/types";
import { decemberAverages } from "./inflationGrid";
import { periodBounds, rangeFromPatch, refitRange, resolveRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseMonthRangeKey, writeMonthRangeKey } from "./urlState";

// Pure state and data selection for the inflation cities section
// (docs/superpowers/specs/2026-09-26-inflation-cities-design.md). Components
// compose these; nothing here renders or reads the DOM.

export const GEORGIA_LINE_ID = "country.georgia";
export const HEADLINE_ID = "cpi.headline";
export const CITY_LINE_IDS = [GEORGIA_LINE_ID, ...CPI_CITY_IDS] as const;
export type CityLineId = (typeof CITY_LINE_IDS)[number];
export const CITY_TABS = ["yoy", "mom"] as const;
export type CityTab = (typeof CITY_TABS)[number];
export const CITY_CATEGORIES: readonly string[] = [HEADLINE_ID, ...Array.from({ length: 12 }, (_, index) => `cpi.cat.${String(index + 1).padStart(2, "0")}`)];

export type CityState = {
  tab: CityTab;
  mode: "chart" | "table";
  range: PeriodRange;
  category: string;
  selected: CityLineId[];
  tableSeries: CityLineId | null;
};

// All seven lines start selected: a Cities page that opened on Georgia alone
// would show nothing city-specific (spec §1.1, owner decision 2026-09-26).
export const DEFAULT_CITY_STATE: CityState = {
  tab: "yoy",
  mode: "chart",
  range: { kind: "all" },
  category: HEADLINE_ID,
  selected: [...CITY_LINE_IDS],
  tableSeries: null,
};

const TAB_MEASURE: Record<CityTab, CpiCityMeasure> = { yoy: "yoy_pct", mom: "mom_pct" };
const factKey = (lineId: string, seriesId: string, measure: string) => `${lineId}|${seriesId}|${measure}`;

export type CityIndex = { values: Map<string, Map<number, number>> };
export type { ResolvedPeriodRange };

/** Dense runs per series, as the categories page packs its facts: ~22,000 rows cross the wire. */
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

/** A tab's coverage: every line's total on that measure. Zugdidi's late start does not narrow it. */
export function cityCoverage(index: CityIndex, tab: CityTab): { min: number; max: number } {
  return periodBounds(CITY_LINE_IDS.map((lineId) => cityValues(index, lineId, HEADLINE_ID, TAB_MEASURE[tab])), "City data has no periods");
}

export function resolveCityRange(state: CityState, index: CityIndex): ResolvedPeriodRange {
  return resolveRange(state.range, cityCoverage(index, state.tab));
}

export function changeCityTab(state: CityState, tab: CityTab, index: CityIndex): CityState {
  return { ...state, tab, range: refitRange(state.range, cityCoverage(index, tab), { collapseToAll: true }) };
}

export { rangeFromPatch };

export function toggleCityLine(state: CityState, lineId: CityLineId): CityState {
  const next = state.selected.includes(lineId) ? state.selected.filter((entry) => entry !== lineId) : [...state.selected, lineId];
  return { ...state, selected: CITY_LINE_IDS.filter((entry) => next.includes(entry)) };
}

export function toggleAllCityLines(state: CityState): CityState {
  return { ...state, selected: state.selected.length > 0 ? [] : [...CITY_LINE_IDS] };
}

export function buildCityLines(index: CityIndex, state: CityState, range: ResolvedPeriodRange) {
  const periods = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
  const lines = state.selected.flatMap((lineId) => {
    const values = cityValues(index, lineId, state.category, TAB_MEASURE[state.tab]);
    return values ? [{ key: lineId, values: periods.map((period) => values.get(period) ?? null) }] : [];
  });
  return { periods, lines };
}

export function cityPanelValue(index: CityIndex, lineId: CityLineId, state: CityState, range: ResolvedPeriodRange): number | null {
  const values = cityValues(index, lineId, state.category, TAB_MEASURE[state.tab]);
  if (!values) return null;
  for (let period = range.end; period >= range.start; period -= 1) {
    const value = values.get(period);
    if (value !== undefined) return value;
  }
  return null;
}

export function cityTableOptions(index: CityIndex, state: CityState): CityLineId[] {
  return state.selected.filter((lineId) => cityValues(index, lineId, state.category, TAB_MEASURE[state.tab]) !== undefined);
}

export function effectiveCityTableSeries(index: CityIndex, state: CityState): CityLineId | null {
  const options = cityTableOptions(index, state);
  return state.tableSeries !== null && options.includes(state.tableSeries) ? state.tableSeries : (options[0] ?? null);
}

/** Geostat's December 12-month average: the table's წლის საშუალო, for the total on the annual tab only. */
export function cityAnnualAverages(index: CityIndex, state: CityState, lineId: string): Map<number, number> | undefined {
  if (state.tab !== "yoy" || state.category !== HEADLINE_ID) return undefined;
  return decemberAverages(cityValues(index, lineId, HEADLINE_ID, "avg12_pct"));
}

export type CityRate = { cityIds: string[]; value: number; deltaPp: number | null };
export type CityIndicators = {
  period: number;
  national: number | null;
  highest: CityRate;
  /** `fell` says whether the lowest city actually got cheaper, so the page never claims a fall that did not happen. */
  lowest: CityRate & { fell: boolean };
  gap: { value: number; spark: Array<number | null> };
  aboveNational: { count: number; total: number; spark: Array<number | null> } | null;
};

const SPARK_MONTHS = 36;

/**
 * Spec §6: the latest published month, year on year, for the picked category,
 * whatever the tab or range. Cities only — Georgia is the benchmark, never a
 * ranked entry. Ties name every tied city.
 */
export function latestCityIndicators(index: CityIndex, category: string): CityIndicators | null {
  const series = CPI_CITY_IDS.flatMap((cityId) => {
    const values = cityValues(index, cityId, category, "yoy_pct");
    return values ? [{ cityId, values }] : [];
  });
  if (series.length === 0) return null;
  const period = periodBounds(series.map((entry) => entry.values), "City data has no periods").max;
  const national = cityValues(index, GEORGIA_LINE_ID, category, "yoy_pct");
  const at = (month: number) =>
    series.flatMap((entry) => {
      const value = entry.values.get(month);
      return value === undefined ? [] : [{ cityId: entry.cityId, value }];
    });
  const present = at(period);
  if (present.length === 0) return null;
  const nationalNow = national?.get(period) ?? null;
  const max = Math.max(...present.map((row) => row.value));
  const min = Math.min(...present.map((row) => row.value));
  const rate = (value: number): CityRate => ({
    cityIds: present.filter((row) => row.value === value).map((row) => row.cityId),
    value,
    deltaPp: nationalNow === null ? null : value - nationalNow,
  });
  const window = Array.from({ length: SPARK_MONTHS }, (_, offset) => period - SPARK_MONTHS + 1 + offset);
  return {
    period,
    national: nationalNow,
    highest: rate(max),
    lowest: { ...rate(min), fell: min < 0 },
    gap: {
      value: max - min,
      spark: window.map((month) => {
        const rows = at(month);
        return rows.length < 2 ? null : Math.max(...rows.map((row) => row.value)) - Math.min(...rows.map((row) => row.value));
      }),
    },
    aboveNational:
      nationalNow === null
        ? null
        : {
            count: present.filter((row) => row.value > nationalNow).length,
            total: present.length,
            spark: window.map((month) => {
              const base = national?.get(month);
              const rows = at(month);
              return base === undefined || rows.length === 0 ? null : rows.filter((row) => row.value > base).length;
            }),
          },
  };
}

const CATEGORY_CODE = /^(0[1-9]|1[0-2])$/;
const slug = (lineId: string) => lineId.split(".")[1]!;
const LINE_BY_SLUG = new Map(CITY_LINE_IDS.map((lineId) => [slug(lineId), lineId]));

export function parseCityHash(hash: string): CityState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const tab = CITY_TABS.find((entry) => entry === params.get("i")) ?? DEFAULT_CITY_STATE.tab;
  const code = params.get("c") ?? "";
  // Unknown values are dropped rather than failing the page (spec §8).
  const requested = (params.get("sel") ?? "").split(",");
  return {
    tab,
    mode: params.get("m") === "table" ? "table" : "chart",
    range: parseMonthRangeKey(params),
    category: CATEGORY_CODE.test(code) ? `cpi.cat.${code}` : HEADLINE_ID,
    selected: params.has("sel") ? CITY_LINE_IDS.filter((lineId) => requested.includes(slug(lineId))) : [...CITY_LINE_IDS],
    tableSeries: LINE_BY_SLUG.get(params.get("t") ?? "") ?? null,
  };
}

export function serializeCityHash(state: CityState): string {
  const params = new URLSearchParams({ i: state.tab, m: state.mode });
  writeMonthRangeKey(params, state.range);
  params.set("c", state.category === HEADLINE_ID ? "total" : state.category.replace("cpi.cat.", ""));
  params.set("sel", state.selected.map(slug).join(","));
  if (state.tableSeries !== null) params.set("t", slug(state.tableSeries));
  return params.toString();
}
```

Check that `refitRange`, `resolveRange`, `periodBounds` and the `PeriodRange` `manual` shape match `lib/explorer/periodRange.ts`. If the manual range kind has a different name there, use that name in the test.

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/explorer/inflationCities.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/explorer/inflationCities.ts apps/web/tests/explorer/inflationCities.test.ts apps/web/tests/explorer/fixtures/inflationCities.ts
git commit -m "feat(inflation): cities page state, hash and indicators

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The Excel workbook

**Files:**
- Create: `apps/web/lib/explorer/inflationCityWorkbook.ts`
- Test: `apps/web/tests/explorer/inflationCityWorkbook.test.ts`

**Interfaces:**
- Consumes: `buildCityLines`, `cityAnnualAverages`, `HEADLINE_ID`, the labels module, and the `inflationWorkbook` helpers (`calendarYearsOf`, `monthlyReadableRows`, `monthlyWorkbookSources`, `pickLocaleEditions`, `SUMMARY_COLUMN`, `InflationWorkbookSource`).
- Produces: `buildInflationCityWorkbookExportModel(input: { index; state; range; presentation; sources; siteOrigin }): WorkbookExportModel`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildCityIndex, DEFAULT_CITY_STATE, resolveCityRange } from "../../lib/explorer/inflationCities";
import { buildInflationCityWorkbookExportModel } from "../../lib/explorer/inflationCityWorkbook";
import { SUMMARY_COLUMN } from "../../lib/explorer/inflationWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const index = buildCityIndex(fixtureCityFacts);

async function model(state = DEFAULT_CITY_STATE) {
  const messages = await getMessages("en", ["inflation"]);
  return buildInflationCityWorkbookExportModel({
    index,
    state,
    range: resolveCityRange(state, index),
    presentation: { locale: "en", messages, englishLabels: {} },
    sources: [],
    siteOrigin: "https://fiscal.ge",
  });
}

describe("buildInflationCityWorkbookExportModel", () => {
  it("writes one readable row per line and year, with the annual average for the total", async () => {
    const workbook = await model();
    expect(workbook.readable.years).toContain(SUMMARY_COLUMN);
    expect(new Set(workbook.readable.rows.map((row) => row.parentLabel))).toEqual(new Set(["Georgia", "Tbilisi", "Kutaisi", "Batumi", "Gori", "Telavi", "Zugdidi"]));
    expect(workbook.readable.subtitle).toContain("recorded once and applied to every city");
  });

  it("drops the annual average for a category and names the category", async () => {
    const workbook = await model({ ...DEFAULT_CITY_STATE, category: "cpi.cat.01" });
    expect(workbook.readable.years).not.toContain(SUMMARY_COLUMN);
    expect(workbook.readable.title).toContain("Food");
    expect(workbook.filename).toContain("inflation-cities-yoy-01-");
  });

  it("exports rates as fractions and never an implied weight", async () => {
    const workbook = await model();
    const batumi = workbook.analysis.rows.find((row) => row[2] === "Batumi" && row[0] === 2026 && row[1] === 8)!;
    expect(batumi[5]).toBeCloseTo(0.070857, 6);
    expect(JSON.stringify(workbook).toLowerCase()).not.toContain("weight");
  });
});
```

Run: `npx vitest run tests/explorer/inflationCityWorkbook.test.ts`
Expected: FAIL, because the module doesn't exist.

- [ ] **Step 2: Implement `lib/explorer/inflationCityWorkbook.ts`**

```ts
import { periodKey, periodMonth, periodYear } from "../data/inflation/periods";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { HEADLINE_ID, buildCityLines, cityAnnualAverages, type CityIndex, type CityState, type ResolvedPeriodRange } from "./inflationCities";
import { cityCategoryLabel, cityLineLabel } from "./inflationCityLabels";
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

// Spec §9: the readable sheet mirrors ცხრილი — one row per selected line and year,
// months across, plus წლის საშუალო for the total on the annual tab. Rates leave as
// fractions under Excel's % format. The same-price-everywhere note travels on the
// sheet. Implied city weights never appear here.
export function buildInflationCityWorkbookExportModel(input: {
  index: CityIndex;
  state: CityState;
  range: ResolvedPeriodRange;
  presentation: Presentation;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
}): WorkbookExportModel {
  const { index, state, range, presentation, sources, siteOrigin } = input;
  const { messages, locale } = presentation;
  const t = (key: string) => message(messages, `inflation.${key}`);
  const scale = (value: number) => value / 100;
  const { periods, lines } = buildCityLines(index, state, range);
  const withSummary = state.tab === "yoy" && state.category === HEADLINE_ID;
  const columns: number[] = [...MONTH_NUMBERS, ...(withSummary ? [SUMMARY_COLUMN] : [])];
  const calendarYears = calendarYearsOf(range);
  const category = cityCategoryLabel(messages, state.category);

  const rows: WorkbookReadableRow[] = lines.flatMap((line) => {
    const byPeriod = new Map(periods.map((period, position) => [period, line.values[position] ?? null]));
    const averages = cityAnnualAverages(index, state, line.key);
    return monthlyReadableRows(cityLineLabel(messages, line.key), byPeriod, calendarYears, scale, withSummary ? (year) => averages?.get(year) ?? null : undefined);
  });

  const coicop = state.category === HEADLINE_ID ? "" : state.category.replace("cpi.cat.", "");
  const analysisRows = periods.flatMap((period, position) =>
    lines.flatMap((line) => {
      const value = line.values[position];
      return value === null || value === undefined
        ? []
        : [[periodYear(period), periodMonth(period), cityLineLabel(messages, line.key), category, coicop, scale(value), "%", t("published")]];
    }),
  );

  const usedSourceIds = new Set<string>([state.tab === "yoy" ? "source.geostat_cpi_yoy" : "source.geostat_cpi_mom"]);
  if (withSummary) usedSourceIds.add("source.geostat_cpi_avg12");
  const chosen = pickLocaleEditions(sources, usedSourceIds, locale);
  const subtitle = `${periodLabel(messages, range.start, "long")} – ${periodLabel(messages, range.end, "long")} · ${t(`categoryUnit.${state.tab}`)}`;

  return {
    locale,
    filename: workbookFilename(`inflation-cities-${state.tab}-${coicop || "total"}-${periodKey(range.start)}-${periodKey(range.end)}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${t("citiesHeading")} · ${category}`,
      subtitle: `${subtitle} · ${t("cityCentralPricesNote")}`,
      unitLabel: t(`categoryWorkbookUnit.${state.tab}`),
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

- [ ] **Step 3: Run the test**

Run: `npx vitest run tests/explorer/inflationCityWorkbook.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/explorer/inflationCityWorkbook.ts apps/web/tests/explorer/inflationCityWorkbook.test.ts
git commit -m "feat(inflation): Excel export for the cities page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Page components, routes, navigation and hub card

**Files:**
- Create: `apps/web/components/inflation/inflation-city-category-select.tsx`, `inflation-city-panel.tsx`, `inflation-city-table.tsx`, `inflation-city-indicators.tsx`, `inflation-cities.tsx`
- Create: `apps/web/app/(ka)/explorer/inflation/cities/page.tsx`, `apps/web/app/(en)/en/explorer/inflation/cities/page.tsx`
- Modify: `apps/web/lib/pages/inflation.tsx`, `apps/web/lib/explorer/inflationHubCards.ts`, `apps/web/components/shell/data-sidebar.tsx`, `apps/web/lib/seo/sitemap.ts`, `apps/web/lib/i18n/inventory.server.ts`, `apps/web/public/llms.txt`
- Test: `apps/web/tests/explorer/inflationCitiesRender.test.tsx` (new), `apps/web/tests/explorer/inflationHub.test.ts`, `apps/web/tests/seo/agentFiles.test.ts`

**Interfaces:**
- Produces:
  - `InflationCities` props: `{ facts: PackedCitySeries[]; lastReviewedAt: string; sources: InflationWorkbookSource[]; siteOrigin: string }`
  - `renderInflationCities(locale)` and `inflationCitiesMetadata(locale)`
  - `buildInflationHubCards(facts, presentation, categories, weights, cities: CityFactInput[])`

- [ ] **Step 1: Write the failing render test**

Create `tests/explorer/inflationCitiesRender.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { InflationCities } from "../../components/inflation/inflation-cities";
import { packCityFacts } from "../../lib/explorer/inflationCities";
import common from "../../lib/i18n/messages/ka/common.json";
import controls from "../../lib/i18n/messages/ka/controls.json";
import inflation from "../../lib/i18n/messages/ka/inflation.json";
import main from "../../lib/i18n/messages/ka/main.json";
import { renderGeorgianMarkup } from "../helpers/render-localized";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const markup = renderGeorgianMarkup(
  <InflationCities facts={packCityFacts(fixtureCityFacts)} lastReviewedAt="2026-09-11" sources={[]} siteOrigin="https://fiscal.ge" />,
  { ...common, ...controls, ...inflation, ...main },
);

function block(html: string, testId: string): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  return start === -1 ? "" : html.slice(start, start + 800);
}

describe("InflationCities", () => {
  it("has two tabs and lands on annual inflation", () => {
    expect(block(markup, "inflation-city-tab-yoy")).toContain('aria-pressed="true"');
    expect(block(markup, "inflation-city-tab-mom")).toContain('aria-pressed="false"');
    expect(markup).not.toContain('data-testid="inflation-city-tab-avg12"');
  });

  it("carries the unit line alone under the H1", () => {
    expect(block(markup, "inflation-city-unit")).toContain("პროცენტი");
  });

  it("selects all seven lines by default, Georgia first", () => {
    const rows = [...markup.matchAll(/data-testid="series-row" data-series-id="([^"]+)"/g)].map((match) => match[1]);
    expect(rows).toEqual(["country.georgia", "city.tbilisi", "city.kutaisi", "city.batumi", "city.gori", "city.telavi", "city.zugdidi"]);
    expect(block(markup, "series-status")).toContain("7 / 7");
  });

  it("offers the category picker at სულ", () => {
    expect(block(markup, "inflation-city-category")).toContain("სულ");
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

Run: `npx vitest run tests/explorer/inflationCitiesRender.test.tsx`
Expected: FAIL, because the component doesn't exist.

- [ ] **Step 2: The category picker**

`components/inflation/inflation-city-category-select.tsx`:

```tsx
"use client";

import { useId } from "react";
import { CITY_CATEGORIES } from "../../lib/explorer/inflationCities";
import { cityCategoryLabel } from "../../lib/explorer/inflationCityLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";

// A labelled native select (spec §6): the editorial layer has no select control,
// and a native one is keyboard- and screen-reader-complete with no new code.
export function InflationCityCategorySelect({ value, onChange }: { value: string; onChange: (category: string) => void }) {
  const { messages } = useI18n();
  const id = useId();
  return (
    <div className="flex items-baseline gap-2">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {message(messages, "inflation.cityCategoryLabel")}
      </label>
      <select
        id={id}
        data-testid="inflation-city-category"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[260px] border-0 border-b border-[var(--control)] bg-transparent py-1 pr-1 text-[12.5px] text-[var(--ink)] outline-none focus-visible:border-[var(--ink)]"
      >
        {CITY_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {cityCategoryLabel(messages, category)}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: The series panel**

`components/inflation/inflation-city-panel.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { MISSING } from "../../lib/explorer/format";
import { CITY_LINE_IDS, cityPanelValue, type CityIndex, type CityLineId, type CityState, type ResolvedPeriodRange } from "../../lib/explorer/inflationCities";
import { cityLineColor, cityLineLabel, formatCityValue } from "../../lib/explorer/inflationCityLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

// Seven rows: Georgia first as the benchmark, then the cities in Geostat's order.
// Search never scopes the bulk action or the denominator (AGENTS.md UI contract).
export function InflationCityPanel({
  index,
  state,
  range,
  onToggle,
  onToggleAll,
  downloadAction,
}: {
  index: CityIndex;
  state: CityState;
  range: ResolvedPeriodRange;
  onToggle: (lineId: CityLineId) => void;
  onToggleAll: () => void;
  downloadAction: ReactNode;
}) {
  const { messages } = useI18n();
  const [query, setQuery] = useState("");
  const rows = CITY_LINE_IDS.map((lineId) => ({ lineId, label: cityLineLabel(messages, lineId), value: cityPanelValue(index, lineId, state, range) }));
  const visible = rows.filter((row) => matchesLabelQuery(query, [row.label, row.lineId]));
  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        selectedCount={state.selected.length}
        totalCount={CITY_LINE_IDS.length}
        hasSelection={state.selected.length > 0}
        allSelected={state.selected.length === CITY_LINE_IDS.length}
        onToggleAll={onToggleAll}
        hasVisibleMatches={visible.length > 0}
      >
        {visible.map((row) => (
          <SeriesSelectorRow
            key={row.lineId}
            id={row.lineId}
            label={row.label}
            color={cityLineColor(row.lineId)}
            value={row.value === null ? MISSING : formatCityValue(row.value, state.tab)}
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

- [ ] **Step 4: The table**

`components/inflation/inflation-city-table.tsx`:

```tsx
"use client";

import { MOM_BINS, YOY_BINS, buildMonthGrid, legendLabels } from "../../lib/explorer/inflationGrid";
import {
  cityAnnualAverages,
  cityTableOptions,
  cityValues,
  effectiveCityTableSeries,
  type CityIndex,
  type CityLineId,
  type CityState,
  type ResolvedPeriodRange,
} from "../../lib/explorer/inflationCities";
import { cityCategoryLabel, cityLineLabel, formatCityValue } from "../../lib/explorer/inflationCityLabels";
import { MONTH_NUMBERS, periodLabel } from "../../lib/explorer/inflationLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { MonthGridTable } from "../main-explorer/month-grid-table";
import { TextTab } from "../ui/editorial";

// ცხრილი: one line at a time, like the overview. წლის საშუალო appears for the
// total on the annual tab only — Geostat publishes no category average (spec §6).
export function InflationCityTable({
  index,
  state,
  range,
  onTableSeriesChange,
}: {
  index: CityIndex;
  state: CityState;
  range: ResolvedPeriodRange;
  onTableSeriesChange: (lineId: CityLineId) => void;
}) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const active = effectiveCityTableSeries(index, state);
  if (active === null) return null;
  const options = cityTableOptions(index, state);
  const edges = state.tab === "yoy" ? YOY_BINS : MOM_BINS;
  const measure = state.tab === "yoy" ? "yoy_pct" : "mom_pct";
  const summaryByYear = cityAnnualAverages(index, state, active);
  const rows = buildMonthGrid({ values: cityValues(index, active, state.category, measure)!, range, edges, summaryByYear });

  return (
    <MonthGridTable
      caption={t("tableCaption", {
        series: `${cityLineLabel(messages, active)} · ${cityCategoryLabel(messages, state.category)}`,
        tab: t(`categoryTab.${state.tab}`),
        unit: t(`categoryWorkbookUnit.${state.tab}`),
        start: periodLabel(messages, range.start, "short"),
        end: periodLabel(messages, range.end, "short"),
      })}
      yearLabel={t("year")}
      monthLabels={MONTH_NUMBERS.map((month) => message(messages, `inflation.monthShort.${month}`))}
      monthNames={MONTH_NUMBERS.map((month) => message(messages, `inflation.month.${month}`))}
      summaryLabel={summaryByYear ? t("annualAverage") : undefined}
      rows={rows}
      formatValue={(value) => formatCityValue(value, state.tab)}
      legend={legendLabels(edges).map((label, tint) => ({ label, tint }))}
      legendLabel={t("legend")}
      picker={
        options.length > 1 ? (
          <div role="group" aria-label={t("tableSeries")} data-testid="inflation-city-table-series" className="flex flex-wrap gap-5">
            {options.map((lineId) => (
              <TextTab
                key={lineId}
                testId={`inflation-city-table-series-${lineId}`}
                label={cityLineLabel(messages, lineId)}
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

- [ ] **Step 5: The indicators**

`components/inflation/inflation-city-indicators.tsx`:

```tsx
"use client";

import { INK } from "../../lib/explorer/colors";
import { formatShare } from "../../lib/explorer/format";
import { formatContribution } from "../../lib/explorer/inflationCategoryLabels";
import { latestCityIndicators, type CityIndex } from "../../lib/explorer/inflationCities";
import { cityLineLabel } from "../../lib/explorer/inflationCityLabels";
import { displayedValue } from "../../lib/explorer/inflationGrid";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeroKpi, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle } from "../ui/editorial";

// ძირითადი ინდიკატორები for the cities page (spec §6): the latest published month,
// year on year, for the picked category. Cities only; Georgia is the benchmark.
// A negative rate reads as გაიაფდა, never coloured good or bad.
export function InflationCityIndicators({ index, category }: { index: CityIndex; category: string }) {
  const { messages } = useI18n();
  const latest = latestCityIndicators(index, category);
  if (!latest) return null;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const pct = (value: number) => formatShare(displayedValue(value) / 100);
  const names = (ids: string[]) => ids.map((id) => cityLineLabel(messages, id)).join(", ");
  const delta = (value: number | null) => (value === null ? "—" : formatContribution(value));
  const { highest, lowest } = latest;

  const sideKpis: SideKpi[] = [
    {
      label: t("cityLowest"),
      value: pct(lowest.value),
      unit: "",
      color: "var(--ink)",
      detail: t(lowest.fell ? "cityFellDetail" : "cityVsNational", { city: names(lowest.cityIds), delta: delta(lowest.deltaPp) }),
      spark: null,
    },
    {
      label: t("cityGap"),
      value: displayedValue(latest.gap.value).toFixed(1),
      unit: t("pp"),
      color: "var(--ink)",
      detail: t("cityGapDetail"),
      spark: { values: latest.gap.spark, color: INK },
    },
  ];
  if (latest.aboveNational) {
    sideKpis.push({
      label: t("cityAboveNational"),
      value: t("cityAboveNationalValue", { count: String(latest.aboveNational.count), total: String(latest.aboveNational.total) }),
      unit: "",
      color: "var(--ink)",
      detail: t("cityAboveNationalDetail"),
      spark: { values: latest.aboveNational.spark, color: INK },
    });
  }

  return (
    <section data-testid="inflation-city-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{message(messages, "main.indicators")}</SectionTitle>
      <div data-testid="period-kpi-cards" className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <HeroKpi label={`${t("cityHighest")} · ${periodLabel(messages, latest.period, "long")}`} value={pct(highest.value)}>
          <p data-testid="inflation-city-hero" className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
            {t("cityHeroDetail", {
              city: names(highest.cityIds),
              value: pct(highest.value),
              national: latest.national === null ? "—" : pct(latest.national),
              delta: delta(highest.deltaPp),
            })}
          </p>
        </HeroKpi>
        <SideKpiList kpis={sideKpis} />
      </div>
    </section>
  );
}
```

- [ ] **Step 6: The page component**

`components/inflation/inflation-cities.tsx`. This is the categories page anatomy with the stacked chart removed and the category select added:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { periodMonth, periodYear } from "../../lib/data/inflation/periods";
import { formatDisplayDate } from "../../lib/explorer/format";
import {
  CITY_TABS,
  DEFAULT_CITY_STATE,
  buildCityIndex,
  buildCityLines,
  changeCityTab,
  cityCoverage,
  parseCityHash,
  rangeFromPatch,
  resolveCityRange,
  serializeCityHash,
  toggleAllCityLines,
  toggleCityLine,
  unpackCityFacts,
  type CityState,
  type CityTab,
  type PackedCitySeries,
} from "../../lib/explorer/inflationCities";
import { cityLineColor, cityLineLabel } from "../../lib/explorer/inflationCityLabels";
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
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { InflationCityCategorySelect } from "./inflation-city-category-select";
import { InflationCityIndicators } from "./inflation-city-indicators";
import { InflationCityPanel } from "./inflation-city-panel";
import { InflationCityTable } from "./inflation-city-table";

// Inflation cities (spec 2026-09-26 §6): the overview's anatomy, seven lines —
// Georgia in ink, then the six cities — and a category picker. No headline value
// line under the H1 (DESIGN.md §25).

const PCT_UNIT = { divisor: 1, label: "", decimals: 1 };

export type InflationCitiesProps = {
  facts: PackedCitySeries[];
  lastReviewedAt: string;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationCities({ facts, lastReviewedAt, sources, siteOrigin }: InflationCitiesProps) {
  const presentation = useI18n();
  const { messages, locale } = presentation;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const index = useMemo(() => buildCityIndex(unpackCityFacts(facts)), [facts]);
  const [state, setState] = useState<CityState>(DEFAULT_CITY_STATE);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const parsed = parseCityHash(window.location.hash);
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(changeCityTab(parsed, parsed.tab, index));
    setReady(true);
  }, [index]);
  useAppReady();
  useReplaceHash(serializeCityHash(state), ready);

  const range = resolveCityRange(state, index);
  const tabPeriods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  const coverage = cityCoverage(index, "mom");
  const displayDate = locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt;
  const lines = buildCityLines(index, state, range);
  const hasSeries = lines.lines.length > 0;

  function selectTab(tab: CityTab) {
    const next = changeCityTab(state, tab, index);
    const nextRange = resolveCityRange(next, index);
    setState(next);
    setAnnouncement(t("rangeChanged", { start: periodLabel(messages, nextRange.start, "short"), end: periodLabel(messages, nextRange.end, "short") }));
  }

  const chartSeries: ChartSeries[] = lines.lines.map((line) => ({
    id: line.key,
    label: cityLineLabel(messages, line.key),
    color: cityLineColor(line.key),
    vals: line.values,
    planned: line.values.map(() => false),
  }));

  return (
    <ExplorerPage testId="inflation-cities">
      <PageHeader
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
          { label: t("citiesHeading") },
        ]}
        coverage={`${periodLabel(messages, coverage.min, "short")} – ${periodLabel(messages, coverage.max, "short")} · ${message(messages, "main.updated", { date: displayDate })}`}
      />
      <ExplorerHeading>{t("citiesHeading")}</ExplorerHeading>
      <p data-testid="inflation-city-unit" className="mb-4 text-[13px] text-[var(--muted)]">
        {t(`categoryUnit.${state.tab}`)}
      </p>

      <div
        data-testid="inflation-city-tabs"
        role="group"
        aria-label={t("tabs")}
        className="mb-3 overflow-x-auto py-2"
        onFocusCapture={(event) => event.target.scrollIntoView({ block: "nearest", inline: "nearest" })}
      >
        <div className="mx-auto flex w-max gap-7 px-1">
          {CITY_TABS.map((tab) => (
            <TextTab key={tab} testId={`inflation-city-tab-${tab}`} label={t(`categoryTab.${tab}`)} active={state.tab === tab} onClick={() => selectTab(tab)} />
          ))}
        </div>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={state.mode} data-tab={state.tab} className="border-t border-[var(--ink)] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <InflationCityCategorySelect value={state.category} onChange={(category) => setState((current) => ({ ...current, category }))} />
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
              <InflationCityTable index={index} state={state} range={range} onTableSeriesChange={(lineId) => setState((current) => ({ ...current, tableSeries: lineId }))} />
            ) : (
              <div className="mt-5">
                <EditorialLineChart
                  years={lines.periods}
                  series={chartSeries}
                  share
                  unit={PCT_UNIT}
                  shareLabel={t(`categoryTab.${state.tab}`)}
                  periodsPerYear={12}
                  formatPeriod={(period, kind) =>
                    kind === "axis" && periodMonth(period) === 1 ? String(periodYear(period)) : periodLabel(messages, period, kind === "axis" ? "short" : "long")
                  }
                />
              </div>
            )}
            <RangeStrip
              years={tabPeriods}
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
          state={state}
          range={range}
          onToggle={(lineId) => setState((current) => toggleCityLine(current, lineId))}
          onToggleAll={() => setState((current) => toggleAllCityLines(current))}
          downloadAction={
            <ExcelDownloadButton
              testId="inflation-city-download"
              disabled={!hasSeries}
              onDownload={() => downloadWorkbook(buildInflationCityWorkbookExportModel({ index, state, range, presentation, sources, siteOrigin }))}
            />
          }
        />
      </ExplorerWorkspace>

      <InflationCityIndicators index={index} category={state.category} />
    </ExplorerPage>
  );
}
```

The unit line reuses `inflation.categoryUnit.yoy` / `.mom`, which is the same text as the overview's unit line. Check that `inflation.rangeChanged`, `inflation.tabs`, `inflation.methodology`, `inflation.categoryTab.*`, `inflation.categoryWorkbookUnit.*`, `inflation.tableCaption`, `inflation.tableSeries`, `inflation.legend`, `inflation.year`, `inflation.pp`, `inflation.annualAverage`, `inflation.seriesYear`, `inflation.month*`, `inflation.value`, `inflation.unitColumn`, `inflation.status`, `inflation.published`, `inflation.categoryColumn` and `inflation.coicopColumn` exist (`grep` the en catalogue). All are used by the existing pages.

- [ ] **Step 7: Run the render test**

Run: `npx vitest run tests/explorer/inflationCitiesRender.test.tsx`
Expected: PASS. If `renderGeorgianMarkup` needs a message namespace the test didn't pass, add it to the spread, mirroring `inflationCategoriesRender.test.tsx`.

- [ ] **Step 8: Server render, routes and metadata**

In `lib/pages/inflation.tsx`:

```tsx
import { InflationCities } from "../../components/inflation/inflation-cities";
import { CITY_FIRST_PERIOD, cityFactInput, type CityFactInput, type CpiCityMeasure } from "../data/inflation/types";
import { GEORGIA_LINE_ID, packCityFacts } from "../explorer/inflationCities";

const CITIES_PATH = "/explorer/inflation/cities";

/** Georgia's line for the cities page: the national total and divisions from 2016, never copied into the city CSV. */
function georgiaCityLine(data: Awaited<ReturnType<typeof loadServedInflationData>>): CityFactInput[] {
  const total = data.facts
    .filter((fact) => fact.seriesId === "cpi.headline" && (fact.measure === "yoy_pct" || fact.measure === "mom_pct" || fact.measure === "avg12_pct") && fact.period >= CITY_FIRST_PERIOD)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: "cpi.headline", measure: fact.measure as CpiCityMeasure, period: fact.period, value: fact.value }));
  const divisions = data.categories
    .filter((fact) => fact.level === 2 && fact.period >= CITY_FIRST_PERIOD)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: fact.categoryId, measure: fact.measure, period: fact.period, value: fact.value }));
  return [...total, ...divisions];
}

export async function inflationCitiesMetadata(locale: Locale) {
  const [{ cities }, messages] = await Promise.all([loadServedInflationData(), getMessages(locale, ["inflation"])]);
  const years = cities.map((fact) => periodYear(periodFromKey(fact.period)));
  return fiscalMetadata({
    locale,
    path: CITIES_PATH,
    title: message(messages, "inflation.citiesMetaTitle", { first: Math.min(...years), last: Math.max(...years) }),
    description: message(messages, "inflation.citiesDescription"),
  });
}

export async function renderInflationCities(locale: Locale) {
  const root = repositoryRoot();
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedInflationData(),
    getPresentation(locale, ["inflation", "common", "controls", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, catalogue.documents);
  const t = (key: string) => message(presentation.messages, key);
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.home"), path: pageHref("/", locale) },
          { name: t("common.inflation"), path: pageHref(HUB_PATH, locale) },
          { name: t("inflation.citiesHeading"), path: pageHref(CITIES_PATH, locale) },
        ]}
      />
      <InflationCities
        facts={packCityFacts([...georgiaCityLine(data), ...data.cities.map(cityFactInput)])}
        lastReviewedAt={data.cities.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? ""}
        sources={sources}
        siteOrigin={resolveSiteUrl()}
      />
    </I18nProvider>
  );
}
```

In `renderInflationHub`, destructure `cities` too and pass `cities.map(cityFactInput)` as the fifth argument to `buildInflationHubCards`.

Create both route files, copying the categories pair with the names swapped:

```tsx
// apps/web/app/(ka)/explorer/inflation/cities/page.tsx
import { inflationCitiesMetadata, renderInflationCities } from "../../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationCitiesMetadata("ka");
}

export default function Page() {
  return renderInflationCities("ka");
}
```

The English file is at `app/(en)/en/explorer/inflation/cities/page.tsx`, with one more `../` and `"en"`.

- [ ] **Step 9: Hub card, sidebar and discovery**

`lib/explorer/inflationHubCards.ts`:
- Change `COMING_SOON` usage so the card order stays 01 overview, 02 categories, 03 basket (coming soon), 04 cities (live), 05 products (coming soon).
- Add the parameter `cities: CityFactInput[]`.
- Build the cities card:

```ts
  // Cities lead with the highest city's annual rate; the sparkline is the gap
  // between cities, the question the section adds (spec §5).
  const cityIndex = cities.length > 0 ? buildCityIndex(cities) : null;
  const cityLatest = cityIndex === null ? null : latestCityIndicators(cityIndex, "cpi.headline");
  const comingSoon = (name: "Basket" | "Products", position: string): HubCardModel => ({
    index: position,
    title: t(`card${name}`),
    description: t(`card${name}Description`),
    href: null,
    comingSoon: true,
    series: null,
    seriesColor: null,
    footer: null,
  });
```

  and return `[overviewCard, categoriesCard, comingSoon("Basket", "03"), citiesCard, comingSoon("Products", "05")]`, where:

```ts
  const citiesCard: HubCardModel = {
    index: "04",
    title: t("citiesHeading"),
    description: t("citiesDescription"),
    href: "/explorer/inflation/cities",
    comingSoon: false,
    series: cityLatest === null ? null : cityLatest.gap.spark.filter((value): value is number => value !== null),
    seriesColor: INK,
    footer: cityLatest === null
      ? null
      : `${periodLabel(presentation.messages, cityLatest.period, "long")} · ${cityLatest.highest.cityIds.map((id) => cityLineLabel(presentation.messages, id)).join(", ")} ${formatShare(cityLatest.highest.value / 100)}`,
  };
```

  Keep the existing overview and categories card objects unchanged and name them `overviewCard` and `categoriesCard`. Remove the `COMING_SOON` constant and update the file's header comment to name the three live sections.

`tests/explorer/inflationHub.test.ts`: pass `cities.map(cityFactInput)` (from `loadServedInflationData()`) as the fifth argument in all three tests. Update the expected hrefs to `["/explorer/inflation/overview", "/explorer/inflation/categories", null, "/explorer/inflation/cities", null]`, and change `cards.slice(2).every(...)` to check `[cards[2]!, cards[4]!]`. Add:

```ts
  it("leads the cities card with the highest city", async () => {
    const { facts, categories, weights, cities } = await loadServedInflationData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} }, categories, weights, cities.map(cityFactInput));
    expect(cards[3]!.comingSoon).toBe(false);
    expect(cards[3]!.footer).toMatch(/Batumi 7\.1%$/);
  });
```

`components/shell/data-sidebar.tsx`: add `const inflationCitiesActive = pathname.endsWith("/explorer/inflation/cities");` beside `inflationCategoriesActive`. Copy the categories `<Link>` block directly below it with `href={pageHref("/explorer/inflation/cities", locale)}`, `data-testid="inflation-cities-link"`, `inflationCitiesActive` and `message(messages, "common.inflationCities")`.

`lib/seo/sitemap.ts`: add `{ url: \`${siteUrl}/explorer/inflation/cities\`, lastModified: inflationModified },` after the categories line.

`lib/i18n/inventory.server.ts`: append `"/explorer/inflation/cities"` to the inflation paths line.

`public/llms.txt`: after the "Inflation categories" line, add:

```text
- [Inflation by city](https://fiscal.ge/explorer/inflation/cities) — annual and monthly inflation in Tbilisi, Kutaisi, Batumi, Gori, Telavi and Zugdidi from 2016, overall and by the 12 COICOP divisions, beside Georgia's national rate. Some prices (fuel, medicines, cars, mobile tariffs, flights) are recorded once and applied to every city.
```

`tests/seo/agentFiles.test.ts`: add `"https://fiscal.ge/explorer/inflation/cities",` after the categories URL in `requiredTargets`.

- [ ] **Step 10: Run the narrow checks**

```bash
npx vitest run tests/explorer/inflationCitiesRender.test.tsx tests/explorer/inflationHub.test.ts tests/seo/agentFiles.test.ts tests/explorer/inflationCities.test.ts
npm run typecheck
npm run lint
```

Expected: PASS. If a sitemap, inventory or bilingual SEO test lists every page and now fails only because of the new path, add the path to that list. That's the registration working, not a regression. Report which files changed.

- [ ] **Step 11: Commit**

```bash
git add apps/web/components/inflation apps/web/app apps/web/lib/pages/inflation.tsx apps/web/lib/explorer/inflationHubCards.ts apps/web/components/shell/data-sidebar.tsx apps/web/lib/seo/sitemap.ts apps/web/lib/i18n/inventory.server.ts apps/web/public/llms.txt apps/web/tests
git commit -m "feat(inflation): the cities page, navigation and live hub card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Browser spec

**Files:**
- Create: `apps/web/tests/browser/inflation-cities.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const CITIES = "/explorer/inflation/cities";

for (const locale of ["ka", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`inflation cities layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${locale === "en" ? "/en" : ""}${CITIES}`);
      await ready(page);
      await expect(page.getByTestId("inflation-city-tabs").getByRole("button")).toHaveCount(2);
      await expect(page.getByTestId("series-row")).toHaveCount(7);
      await expect(page.getByTestId("series-status")).toContainText("7 / 7");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`cities-${locale}-${width}.png`), fullPage: true });

      await page.getByTestId("chart-mode-table").click();
      await expect(page.getByTestId("month-grid")).toBeVisible();
      const grid = (await page.getByTestId("month-grid").innerText()).normalize();
      expect(/[Ⴀ-ჿ]/.test(grid)).toBe(locale === "ka");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`cities-table-${locale}-${width}.png`), fullPage: true });
    });
  }
}

test("the category picker drives the chart, the hash and the indicators", async ({ page }) => {
  await page.goto(`/en${CITIES}`);
  await ready(page);
  const hero = page.getByTestId("inflation-city-hero");
  const before = await hero.innerText();
  await page.getByTestId("inflation-city-category").selectOption("cpi.cat.07");
  await expect(page).toHaveURL(/c=07/);
  await expect(hero).not.toHaveText(before);
  await expect(page.getByTestId("inflation-city-unit")).toContainText("Percent");
});

test("the annual average column appears only for the total on the annual tab", async ({ page }) => {
  await page.goto(`/en${CITIES}#i=yoy&m=table&c=total`);
  await ready(page);
  await expect(page.getByTestId("month-grid")).toContainText("Annual average");
  await page.getByTestId("inflation-city-category").selectOption("cpi.cat.01");
  await expect(page.getByTestId("month-grid")).not.toContainText("Annual average");
});

test("Zugdidi's annual series starts late and is never filled", async ({ page }) => {
  await page.goto(`/en${CITIES}#i=yoy&m=table&c=total&t=zugdidi`);
  await ready(page);
  await expect(page.getByTestId("inflation-city-table-series-city.zugdidi")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("month-grid")).toContainText("—");
});

test("clearing the selection can be undone from the same control", async ({ page }) => {
  await page.goto(`/en${CITIES}`);
  await ready(page);
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("series-status")).toContainText("7 / 7");
});

test("the hub links the live cities card and the sidebar names the section", async ({ page }) => {
  await page.goto("/en/explorer/inflation");
  await ready(page);
  await page.locator('a[href="/en/explorer/inflation/cities"]').first().click();
  await ready(page);
  await expect(page.getByTestId("inflation-cities-link")).toHaveAttribute("aria-current", "page");
});
```

Check the `Annual average` English string against `inflation.annualAverage` in `en/inflation.json`, and adjust the literal if the wording differs.

- [ ] **Step 2: Run the spec against a production build**

Follow CLAUDE.md's fast recipe (stop any server on :3100 before building):

```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/inflation-cities.spec.ts tests/browser/inflation-categories.spec.ts tests/browser/inflation-overview.spec.ts
```

Run the server in the background. Expected: all pass, and the two existing inflation specs pass **unmodified**. Look at the eight screenshots (desktop and mobile, both languages): no clipped axis labels, the select readable at 390px, seven legend colours distinct.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/browser/inflation-cities.spec.ts
git commit -m "test(inflation): browser coverage for the cities page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Public methodology, scope and design records

**Files:**
- Modify: `apps/web/lib/methodology/content/en/inflation.ts`, `apps/web/lib/methodology/content/inflation.ts`
- Modify: `Project_Definition.md`, `DESIGN.md`, `AGENTS.md`

- [ ] **Step 1: Public methodology page**

In `lib/methodology/content/en/inflation.ts`:
- Set `reviewedAt: "2026-09-26"`.
- In the `sources` section, change "Six Geostat consumer price index files, national sheet (Georgia) only." to "Six Geostat consumer price index files: the national sheet (Georgia) and, in the annual, monthly and 12-month average files, one sheet for each of six cities."
- Add a section after `categories`:

```ts
    {
      id: "cities",
      kind: "scope",
      title: "Cities",
      paragraphs: [
        "Geostat records prices in six cities — Tbilisi, Kutaisi, Batumi, Gori, Telavi and Zugdidi — with the same consumer basket in each. The cities page shows each city's annual and monthly inflation from January 2016, overall and for the 12 COICOP groups, beside Georgia's national rate. Zugdidi's annual inflation starts in December 2016 and its 12-month average in December 2017, because Geostat began recording prices there in December 2015; those months are left empty, not filled.",
        "Some prices — fuel, medicines, cars, mobile tariffs, flights and train fares — are recorded once and applied to every city, so differences between cities in those items are not measured differences.",
        "The national index is a weighted average of the city indices. Geostat does not publish the city weights, and Fiscal.ge does not show them; it uses the published figures only to check that the six cities add up to the national index every year. The price index (2010 = 100) is not shown for cities: each city's index is relative to its own 2010 prices, so it cannot say which city is more expensive.",
      ],
    },
```

Mirror the same in `lib/methodology/content/inflation.ts` (Georgian). Match the file's existing Georgian terms:
- Sources sentence: "საქსტატის სამომხმარებლო ფასების ინდექსის ექვსი ფაილი: ეროვნული ფურცელი (საქართველო) და, წლიური, თვიური და 12-თვიანი საშუალოს ფაილებში, ექვსი ქალაქის ფურცელი."
- Section title: `ქალაქები`.
- Paragraphs:
  1. "საქსტატი ფასებს ექვს ქალაქში აღრიცხავს — თბილისში, ქუთაისში, ბათუმში, გორში, თელავსა და ზუგდიდში — ყველგან ერთი და იგივე სამომხმარებლო კალათით. ქალაქების გვერდზე ჩანს თითოეული ქალაქის წლიური და თვიური ინფლაცია 2016 წლის იანვრიდან, სულ და COICOP-ის 12 ჯგუფის მიხედვით, საქართველოს მაჩვენებელთან ერთად. ზუგდიდის წლიური ინფლაცია 2016 წლის დეკემბრიდან იწყება, 12-თვიანი საშუალო კი — 2017 წლის დეკემბრიდან, რადგან საქსტატმა იქ ფასების აღრიცხვა 2015 წლის დეკემბერში დაიწყო; ეს თვეები ცარიელია და არ ივსება."
  2. "ზოგიერთი ფასი — საწვავი, მედიკამენტები, ავტომობილები, მობილური კავშირის ტარიფები, ავია- და მატარებლის ბილეთები — ერთხელ აღირიცხება და ყველა ქალაქზე ვრცელდება, ამიტომ ამ პროდუქტებში ქალაქებს შორის სხვაობა გაზომილი არ არის."
  3. "ეროვნული ინდექსი ქალაქების ინდექსების შეწონილი საშუალოა. საქსტატი ქალაქების წონებს არ აქვეყნებს და Fiscal.ge მათ არ აჩვენებს; გამოქვეყნებულ მონაცემებს მხოლოდ იმის შესამოწმებლად იყენებს, რომ ექვსი ქალაქი ყოველ წელს ეროვნულ ინდექსს ემთხვევა. ფასების ინდექსი (2010 = 100) ქალაქებისთვის არ ჩანს: თითოეული ქალაქის ინდექსი საკუთარ 2010 წლის ფასებთანაა შეფარდებული, ამიტომ ვერ გვეტყვის, რომელი ქალაქია უფრო ძვირი."

Run: `npx vitest run tests/methodology` and `npm run i18n:check`.
Expected: PASS.

- [ ] **Step 2: Project_Definition.md §2C**

- Change the first sentence's approvals to also cite "and extended 2026-09-26 (`docs/superpowers/specs/2026-09-26-inflation-cities-design.md`)".
- Add a bullet after the categories bullet:

```markdown
- Inflation cities at `/explorer/inflation/cities`: annual and monthly inflation in Geostat's six price-collection cities (Tbilisi, Kutaisi, Batumi, Gori, Telavi, Zugdidi) from 2016-01, for the total and the 12 COICOP divisions, beside Georgia's national rate; the 12-month average feeds the table's annual-average column; line chart, year × month table, Excel download; Georgian and English. Implied city weights are a validation check only and are never published.
```

- Extend the MCP bullet with: "…and, approved 2026-09-26, city data through `query_inflation` `entityIds`, city rankings in `rank`, city comparisons in `compare`, and `inflation-cities.csv` / `inflation-cities.json`."
- Replace "city indices" in "Still excluded" with "city subgroups, city price indices (2010 = 100), city weights and contributions, core inflation by city".

- [ ] **Step 3: DESIGN.md**

- Line 31: "the Inflation hub (overview, categories)" becomes "the Inflation hub (overview, categories, cities)".
- The route table: add `/explorer/inflation/cities                              Inflation by city (§25.2)` after the categories row.
- The URL-state table: add `| Inflation cities | \`i\` yoy/mom, \`m\`, \`r\`, \`c\` total or 01–12, \`sel\` line slugs, \`t\` table line | — |`.
- §25 intro sentence: "`ინფლაციის მიმოხილვა` and `კატეგორიები` are live; basket, cities and products are…" becomes "`ინფლაციის მიმოხილვა`, `კატეგორიები` and `ქალაქები` are live; basket and products are…".
- Section 406: "Inflation's overview / categories" becomes "Inflation's overview / categories / cities".
- Add after §25.1:

```markdown
### 25.2 Cities

`ქალაქები`, at `/explorer/inflation/cities`, repeats the overview's anatomy — unit line alone under the H1, centred `TextTab`s, workspace, range strip, series panel, indicators — with **two tabs** (`წლიური ინფლაცია`, `თვიური ინფლაცია`, landing on the first) and **seven lines**: `საქართველო` first, drawn in ink as the benchmark, then the six cities in Geostat's order, all selected by default — a deliberate, owner-approved departure from the "only the total" rule, since a Cities page that opened on the national line alone would show nothing city-specific. Georgia stays first, selectable and removable; the count reads `სერიები {selected} / 7`.

**Category picker.** A labelled native `<select>` in the toolbar (`კატეგორია: სულ`, then the 12 divisions), styled with a bottom hairline on the paper ground and 12.5px text, left of `ხაზი / ცხრილი`. It applies to both tabs and to the indicators. It is the editorial layer's only select; do not introduce another without a design decision.

**City colours** (§4.2): Tbilisi `#B3402A`, Kutaisi `#3D5A98`, Batumi `#1F6E56`, Gori `#A5822B`, Telavi `#7A4E8C`, Zugdidi `#4A707A`, each ≥ 3:1 against paper and tint.

The month grid shows `წლის საშუალო` only for `სულ` on the annual tab. Zugdidi's late start leaves empty cells, never filled values. Indicators: hero = the city with the highest annual rate for the picked category in the latest month, with its distance from Georgia in `პპ`; then `ყველაზე დაბალი` (never claims a fall that did not happen), `ქალაქებს შორის სხვაობა` (highest minus lowest, 36-month sparkline) and `ეროვნულზე მაღალი` (`{n} / 6`, sparkline). Georgia is never ranked. One standing note under the source says some prices are recorded once and applied to every city. See `docs/superpowers/specs/2026-09-26-inflation-cities-design.md`.
```

- [ ] **Step 4: AGENTS.md**

In "Project Snapshot", change "inflation (overview, categories)" to "inflation (overview, categories, cities)". Change nothing else.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/methodology Project_Definition.md DESIGN.md AGENTS.md
git commit -m "docs(inflation): record the cities section in scope, design and methodology

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: MCP — city data in the snapshot and `query_inflation`

**Files:**
- Modify: `apps/web/lib/factQuery/types.ts`, `inflationSeries.ts`, `buildSnapshot.ts`, `schemas.ts`, `queryInflation.ts`, `observations.ts`, `localization.ts`, `caveats/rules.inflation.ts`
- Modify: `apps/web/lib/mcp/tools.ts`
- Modify: `data/localization/en/service-messages.json`, `data/localization/ka/service-messages.json`
- Test: `apps/web/tests/factQuery/inflationCities.test.ts`

**Interfaces:**
- Produces:
  - `snapshot.inflation.cities: ServedCpiCityFact[]` and `snapshot.inflation.cityEntities: InflationCityEntity[]`
  - `type InflationCityEntity = { id: string; labelKa: string; labelEn: string }`
  - `CITY_SERIES_MEASURES`
  - `InflationRequest.entityIds?: string[]`
  - `inflationCellCount` counts entities
  - `Observation.entityType` gains `"city"`
  - The caveat `inflation_city_central_prices`

- [ ] **Step 1: Write the failing tests**

Create `tests/factQuery/inflationCities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { queryInflation, inflationCellCount } from "../../lib/factQuery/queryInflation";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";

const snapshot = loadPackagedSnapshot();
type Obs = { observationId: string; entityType: string; value: number | null; availability: string; missingReasonEn: string | null; caveatIds: string[] };
const observations = (response: ReturnType<typeof queryInflation>) => (response as { data: { observations: Obs[] } }).data.observations;

describe("query_inflation for cities", () => {
  it("answers a city's annual inflation", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" });
    expect(response.status).toBe("ok");
    expect(observations(response)[0]).toMatchObject({ observationId: "inflation:city.batumi:cpi.headline:2026-08:yoy_pct", entityType: "city", value: 7.0857 });
  });

  it("keeps the default answer for Georgia unchanged", () => {
    const response = queryInflation(snapshot, { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" });
    expect(observations(response)[0]!.observationId).toBe("inflation:country.georgia:cpi.headline:2026-08:yoy_pct");
  });

  it("returns Zugdidi's late start as missing, never zero", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.zugdidi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2016-06", toPeriod: "2016-06" });
    expect(response.status).toBe("empty");
    expect(observations(response)[0]).toMatchObject({ value: null, availability: "missing" });
    expect(observations(response)[0]!.missingReasonEn).toMatch(/2016-01/);
  });

  it("refuses what Geostat does not publish for cities", () => {
    for (const request of [
      { seriesIds: ["cpi.cat.01_1"], measure: "yoy_pct" },
      { seriesIds: ["cpi.core"], measure: "yoy_pct" },
      { seriesIds: ["cpi.headline"], measure: "index_2010" },
      { seriesIds: ["cpi.cat.01"], measure: "contribution_pp" },
      { seriesIds: ["cpi.cat.01"], measure: "avg12_pct" },
    ]) {
      const response = queryInflation(snapshot, { entityIds: ["city.gori"], ...request, fromPeriod: "2026-08", toPeriod: "2026-08" });
      expect(response.kind, JSON.stringify(request)).toBe("error");
    }
    expect((queryInflation(snapshot, { entityIds: ["city.rustavi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }) as { error: { code: string } }).error.code).toBe("unknown_entity");
  });

  it("flags centrally priced items on city division cells", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.telavi"], seriesIds: ["cpi.cat.07"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" });
    expect(response.meta.caveats.map((caveat) => caveat.code)).toContain("inflation_city_central_prices");
    expect(observations(response)[0]!.caveatIds.length).toBeGreaterThan(0);
  });

  it("counts cells across entities", () => {
    expect(inflationCellCount({ entityIds: ["city.gori", "city.telavi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-01", toPeriod: "2026-08" })).toBe(16);
  });
});
```

`loadPackagedSnapshot` reads the generated snapshot, so regenerate it first: `npm run data:prepare-fact-query-snapshot`.
Run: `npx vitest run tests/factQuery/inflationCities.test.ts`
Expected: FAIL. `entityIds` is rejected by the strict schema.

- [ ] **Step 2: Snapshot**

`lib/factQuery/inflationSeries.ts`, append:

```ts
export type InflationCityEntity = { id: string; labelKa: string; labelEn: string };

/** What Geostat publishes per city (spec 2026-09-26 §1.1): no index, core, weights or contributions. */
export const CITY_SERIES_MEASURES: Readonly<Record<string, readonly InflationMeasure[]>> = Object.fromEntries([
  ["cpi.headline", ["yoy_pct", "mom_pct", "avg12_pct"]],
  ...Array.from({ length: 12 }, (_, index) => [`cpi.cat.${String(index + 1).padStart(2, "0")}`, ["yoy_pct", "mom_pct"]]),
]);
```

`lib/factQuery/types.ts`: in `inflation: { … }`, add:

```ts
    cities: import("../data/inflation/types").ServedCpiCityFact[];
    cityEntities: import("./inflationSeries").InflationCityEntity[];
```

`lib/factQuery/buildSnapshot.ts`: next to `loadInflationGroups`, add a loader reading `inflation.city.${id}` from both message catalogues, exactly as groups do:

```ts
async function loadInflationCityEntities(repositoryRoot: string): Promise<InflationCityEntity[]> {
  const [ka, en] = await Promise.all(
    (["ka", "en"] as const).map(async (locale) =>
      JSON.parse(await readFile(path.join(repositoryRoot, "apps", "web", "lib", "i18n", "messages", locale, "inflation.json"), "utf8")) as Record<string, string>,
    ),
  );
  return CPI_CITY_IDS.map((id) => {
    const key = `inflation.city.${id}`;
    if (!ka[key]?.trim() || !en[key]?.trim()) throw new Error(`Missing reviewed inflation city label: ${id}`);
    return { id, labelKa: ka[key], labelEn: en[key] };
  });
}
```

Then:
- Load it beside `inflationGroups`.
- Add `...inflationCities.map((city) => [city.id, city.labelEn])` to the `labelsEn` assignment.
- Add to the snapshot's `inflation` block:

```ts
      cities: sortedBy(inflation.cities, (f) => f.cityId, (f) => f.seriesId, (f) => f.measure, (f) => f.period),
      cityEntities: inflationCities,
```

- Import `CPI_CITY_IDS` and `type InflationCityEntity`.

- [ ] **Step 3: Schema, entity type and messages**

- `schemas.ts`: in `queryInflationInput`, add `entityIds: entityIdList.optional().describe("country.georgia (the default) or city.* ids from describe_coverage. Cities publish cpi.headline and cpi.cat.01–12: yoy_pct and mom_pct, and avg12_pct for cpi.headline, from 2016-01."),`.
- `observations.ts` line 23: `entityType: "country" | "municipality" | "region" | "city";`.
- `localization.ts`: add `"caveats.inflation_city_central_prices"`, `"missing.inflationCityNotObserved"` and `"errors.inflationCityInput"` to `SERVICE_MESSAGE_KEYS` in their sorted positions. Add `"missing.inflationCityNotObserved": { ka: ["first"], en: ["first"] },` to `SERVICE_MESSAGE_PARAMETERS`.
- `data/localization/en/service-messages.json`:
  - `"caveats.inflation_city_central_prices": "Some prices — fuel, medicines, cars, mobile tariffs, flights and train fares — are recorded once and applied to every city, so city differences in those items are not measured differences."`
  - `"missing.inflationCityNotObserved": "Geostat publishes no value for this city in this month: city data here starts in {first}, and a series starts later where Geostat began observing the city later. This does not mean zero."`
  - `"errors.inflationCityInput": "Cities publish cpi.headline and cpi.cat.01–12 only: yoy_pct and mom_pct, and avg12_pct for cpi.headline. Subgroups, core, the index, weights, contributions and the target are national only."`
- `data/localization/ka/service-messages.json`:
  - `"caveats.inflation_city_central_prices": "ზოგიერთი ფასი — საწვავი, მედიკამენტები, ავტომობილები, მობილური კავშირის ტარიფები, ავია- და მატარებლის ბილეთები — ერთხელ აღირიცხება და ყველა ქალაქზე ვრცელდება, ამიტომ ამ პროდუქტებში ქალაქებს შორის სხვაობა გაზომილი არ არის."`
  - `"missing.inflationCityNotObserved": "საქსტატი ამ ქალაქისთვის ამ თვეში მნიშვნელობას არ აქვეყნებს: ქალაქების მონაცემები აქ {first}-დან იწყება, ხოლო სერია მოგვიანებით იწყება იქ, სადაც საქსტატმა ქალაქის დაკვირვება მოგვიანებით დაიწყო. ეს ნულს არ ნიშნავს."`
  - `"errors.inflationCityInput": "ქალაქებისთვის ქვეყნდება მხოლოდ cpi.headline და cpi.cat.01–12: yoy_pct და mom_pct, ხოლო cpi.headline-ისთვის — avg12_pct. ქვეჯგუფები, საბაზო ინფლაცია, ინდექსი, წონები, წვლილი და მიზნობრივი მაჩვენებელი მხოლოდ ეროვნულ დონეზეა."`

- [ ] **Step 4: `inflationObservations` over entities**

In `queryInflation.ts`:

1. `export type InflationRequest = { seriesIds: string[]; measure: string; periods?: string[]; years?: number[]; entityIds?: string[] };`
2. At the top of `inflationObservations`, after the measure check, resolve the entities:

```ts
  const entityIds = request.entityIds ?? [INFLATION_ENTITY_ID];
  const cityEntities = new Map(snapshot.inflation.cityEntities.map((city) => [city.id, city]));
  const unknownEntityIds = entityIds.filter((id) => id !== INFLATION_ENTITY_ID && !cityEntities.has(id));
  if (unknownEntityIds.length > 0) {
    return errorResponse(snapshot, {
      code: "unknown_entity",
      ...bilingual(snapshot, "errors.unknownEntity", { unknownEntityIds: unknownEntityIds.join(", ") }),
      retryable: false,
      validChoices: [INFLATION_ENTITY_ID, ...cityEntities.keys()],
    });
  }
  const hasCity = entityIds.some((id) => cityEntities.has(id));
```

3. After the existing `unknownSeriesIds` / `mismatched` checks, and before the contribution-level check, refuse what cities don't publish:

```ts
  if (hasCity && request.seriesIds.some((id) => !(CITY_SERIES_MEASURES[id] ?? []).includes(measure))) {
    return errorResponse(snapshot, {
      code: "unsupported_measure",
      ...bilingual(snapshot, "errors.inflationCityInput"),
      retryable: false,
      validChoices: ["yoy_pct", "mom_pct", "avg12_pct"],
    });
  }
```

4. Index the city facts beside `nationalFacts`:

```ts
  const cityFacts = new Map(snapshot.inflation.cities.filter((f) => f.measure === factMeasure).map((f) => [`${f.cityId}|${f.seriesId}|${f.period}`, f]));
```

5. Change `cellFor` to take the entity. For a city it reads the city map, and a missing month uses the new reason:

```ts
  const cellFor = (entityId: string, seriesId: string, series: SeriesInfo, key: string): Cell => {
    if (entityId !== INFLATION_ENTITY_ID) {
      const fact = cityFacts.get(`${entityId}|${seriesId}|${key}`);
      return fact ? { value: fact.value, sourceIds: [fact.sourceId] } : missing("missing.inflationCityNotObserved", { first: CITY_FIRST_PERIOD });
    }
    // …the existing national body, unchanged…
  };
```

6. Build `raw` over entities × series × keys. Give `RawCell` an `entityId: string` field:

```ts
  const raw: RawCell[] = entityIds.flatMap((entityId) =>
    request.seriesIds.flatMap((seriesId) =>
      keys.map((key) => ({ entityId, seriesId, info: info.get(seriesId)!, key, cell: cellFor(entityId, seriesId, info.get(seriesId)!, key) })),
    ),
  );
```

   The residual rows get `entityId: INFLATION_ENTITY_ID`. A residual can only occur with `contribution_pp`, which is refused for cities.
7. In the observation mapping, use the row's entity:

```ts
    const city = cityEntities.get(entityId);
    // …
      observationId: buildObservationId(INFLATION_DATASET_ID, entityId, seriesId, monthly ? key : year, measure),
      entityId,
      entityType: city ? "city" : "country",
      entityLabelKa: city ? city.labelKa : "საქართველო",
      entityLabelEn: city ? city.labelEn : "Georgia",
```

8. Caveat context with the requested entities:

```ts
  const caveats = evaluateCaveats(
    snapshot,
    { ...countryLevelCaveatContext(INFLATION_DATASET_ID, measure, years, [...new Set(observations.map((o) => o.seriesId))], observations, options.comparison ?? null), entityIds },
    CAVEAT_RULES,
  );
```

9. `missingCells` already reads `o.entityId`, so no change is needed.
10. `inflationCellCount`: multiply the returned value by `Math.max(1, input.entityIds?.length ?? 1)`, and add `entityIds?: string[]` to its input type.
11. `queryInflation`: pass `entityIds: input.entityIds` into both request shapes.

Import `CITY_FIRST_PERIOD` from `../data/inflation/types` and `CITY_SERIES_MEASURES` from `./inflationSeries`.

- [ ] **Step 5: The caveat rule**

Append to `INFLATION_CAVEAT_RULES` in `caveats/rules.inflation.ts`:

```ts
  {
    code: "inflation_city_central_prices",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.inflation_city_central_prices",
    methodologyRef: OWNER,
    methodologyRefEn: OWNER_EN,
    // Geostat extends centrally recorded prices to every city (metadata §18.3).
    applies: (c) => c.datasetId === DATASET_ID && cityDivisionCells(c).length > 0,
    affects: (c) => cityDivisionCells(c).map((cell) => `${cell.entityId}:${cell.seriesId}:${cell.year}`),
  },
```

with, above the rules:

```ts
const cityDivisionCells = (c: CaveatContext) => c.observations.filter((o) => o.entityId.startsWith("city.") && o.level === "division" && o.value !== null);
```

`seriesInfo` gives `cpi.cat.01`…`12` the level `division` from `snapshot.inflation.groups`, so no new level is needed. Check that `tests/factQuery/caveats/inflationRules.test.ts` still passes, and add one case there with a city division cell.

- [ ] **Step 6: Tool description**

In `lib/mcp/tools.ts`, append to the `query_inflation` description: `" Optional entityIds: country.georgia (default) or the six city.* ids from describe_coverage — Tbilisi, Kutaisi, Batumi, Gori, Telavi, Zugdidi — from 2016-01, for cpi.headline and cpi.cat.01–12 (yoy_pct, mom_pct; avg12_pct for cpi.headline). Cells count entities × series × months."`

- [ ] **Step 7: Run the checks**

```bash
npm run data:prepare-fact-query-snapshot
npx vitest run tests/factQuery/inflationCities.test.ts tests/factQuery/queryInflation.test.ts tests/factQuery/caveats/inflationRules.test.ts
npx vitest run tests/factQuery/reference.test.ts
npm run typecheck
```

Expected: PASS. The reference fixture must pass **unchanged**. A disagreement is a stop condition: report it, don't edit the expectation (CLAUDE.md DoD 4).

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/factQuery apps/web/lib/mcp/tools.ts apps/web/tests/factQuery data/localization
git commit -m "feat(mcp): serve city inflation through query_inflation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: MCP — rank, compare, describe_coverage, instructions, schema 1.4.0

**Files:**
- Modify: `apps/web/lib/factQuery/schemas.ts`, `rank.ts`, `compare.ts`, `describeCoverage.ts`, `inflationData.ts`, `types.ts`, `localization.ts`
- Modify: `apps/web/lib/mcp/instructions.ts`, `apps/web/lib/mcp/tools.ts`, `apps/web/lib/mcp/outputSchema.ts`
- Modify: `data/localization/{en,ka}/service-messages.json`, `apps/web/public/llms.txt`
- Modify: the tests pinning the version: `tests/factQuery/inflationCatalogue.test.ts`, `tests/factQuery/inflationPublications.test.ts`, `tests/factQuery/bilingualPublications.test.ts`, `tests/mcp/tools.test.ts`, `tests/browser/bilingual-complete.spec.ts`, `tests/browser/connect.spec.ts`
- Test: extend `apps/web/tests/factQuery/inflationCities.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `tests/factQuery/inflationCities.test.ts`:

```ts
import { rank } from "../../lib/factQuery/rank";
import { compare } from "../../lib/factQuery/compare";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { SCHEMA_VERSION } from "../../lib/factQuery/types";

describe("city rankings, comparisons and coverage", () => {
  it("ranks the six cities for one series and month, without Georgia", () => {
    const response = rank(snapshot, { datasetId: "inflation", dimension: "entities", entityType: "city", seriesId: "cpi.cat.01", period: "2026-08", measure: "yoy_pct", metric: "value", limit: 3 });
    const data = (response as { data: { entries: { entityId: string; value: number }[]; universe: { candidateCount: number } } }).data;
    expect(data.entries.map((entry) => entry.entityId)).toEqual(["city.kutaisi", "city.batumi", "city.tbilisi"]);
    expect(data.entries.map((entry) => entry.value)).toEqual([6.507, 5.9542, 4.8642]);
    expect(data.universe.candidateCount).toBe(6);
  });

  it("refuses a city ranking without one seriesId", () => {
    expect(rank(snapshot, { datasetId: "inflation", dimension: "entities", entityType: "city", period: "2026-08", measure: "yoy_pct", metric: "value" }).kind).toBe("error");
  });

  it("compares one city between two months", () => {
    const response = compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"], entityIds: ["city.batumi"] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct" });
    expect(response.kind).toBe("comparisons");
  });

  it("lists the cities as inflation entities with their coverage", () => {
    const response = describeCoverage(snapshot, { datasetId: "inflation" });
    const entities = (response as { data: { entities?: { entityId: string; entityType: string; periods?: [string, string] }[] } }).data.entities!;
    expect(entities.map((entity) => entity.entityId)).toEqual(["country.georgia", "city.tbilisi", "city.kutaisi", "city.batumi", "city.gori", "city.telavi", "city.zugdidi"]);
    expect(entities.find((entity) => entity.entityId === "city.zugdidi")!.periods![0]).toBe("2016-01");
  });

  it("is schema 1.4.0", () => {
    expect(SCHEMA_VERSION).toBe("1.4.0");
  });
});
```

Regenerate the snapshot and run: `npx vitest run tests/factQuery/inflationCities.test.ts`
Expected: FAIL. `rank` refuses `dimension: "entities"` for inflation.

- [ ] **Step 2: Schemas**

In `schemas.ts`:
- `rankInput`: `entityType: z.enum(["municipality", "region", "city"]).optional(),`.
- In the `superRefine`, let `const inflationCities = inflation && input.dimension === "entities";`.
  - Require `level` only when `inflation && !inflationCities`.
  - `entityType`/`seriesId` are valid when `municipal || inflationCities`: change their two `invalid` entries to `!(municipal || inflationCities) && input.entityType !== undefined ? "entityType" : null` and the same for `seriesId`.
  - Add `inflationCities && input.entityType !== "city" ? "entityType" : null`, `municipal && input.entityType === "city" ? "entityType" : null` and `inflationCities && input.level !== undefined ? "level" : null`.
- `compareInput`: `z.strictObject({ dataset: z.literal("inflation"), seriesIds: seriesIdList, entityIds: entityIdList.optional() }),`.
- `describeCoverageInput`: `entityType: z.enum(["country", "municipality", "region", "city"]).optional(),`.

- [ ] **Step 3: rank.ts**

- Replace the dimension check with:

```ts
  const entityRanking = input.dimension === "entities";
  const inflationCities = isInflation && entityRanking;
  if ((entityRanking && !isMunicipal && !isInflation) || (!entityRanking && isMunicipal)) {
    return errorResponse(snapshot, { code: "invalid_parameters", messageKa: serviceMessage(snapshot, "ka", "errors.rankDimension"), messageEn: serviceMessage(snapshot, "en", "errors.rankDimension"), retryable: false });
  }
```

- In the universe block, before `if (isInflation)`, add a branch:

```ts
    if (inflationCities) {
      if (input.seriesId === undefined || input.entityType !== "city") {
        return errorResponse(snapshot, { code: "invalid_parameters", messageKa: serviceMessage(snapshot, "ka", "errors.rankInflationCityInput"), messageEn: serviceMessage(snapshot, "en", "errors.rankInflationCityInput"), retryable: false });
      }
      seriesIds = [input.seriesId];
      universeKey = "ranking.inflationCities";
    } else if (isInflation) { … existing … }
```

  Make sure `entityIds` is set to the city ids for this branch rather than to `["country.georgia"]`: `entityIds = inflationCities ? snapshot.inflation.cityEntities.map((city) => city.id) : ["country.georgia"];`.
- `candidateCount = isMunicipal || inflationCities ? entityIds.length : seriesIds.length;`
- Value branch: `inflationObservations(snapshot, { seriesIds, measure: input.measure, periods: [input.period as string], ...(inflationCities ? { entityIds } : {}) }, { includeResidual: false })`.
- Change branch target: `({ dataset: "inflation", seriesIds, ...(inflationCities ? { entityIds } : {}) } as const)`.
- Both `stableId` lines: `const stableId = isMunicipal || inflationCities ? observation.entityId : observation.seriesId;` (and `comparison.entityId`/`comparison.seriesId` likewise).
- Add service keys `"errors.rankInflationCityInput"` and `"ranking.inflationCities"` to `localization.ts`, and to both service-message files:
  - en: `"errors.rankInflationCityInput": "An inflation city ranking needs entityType city and exactly one seriesId (cpi.headline or cpi.cat.01–12)."`, `"ranking.inflationCities": "The six cities where Geostat records prices; Georgia's national rate is not a candidate."`
  - ka: `"errors.rankInflationCityInput": "ქალაქების ინფლაციის რანჟირებას სჭირდება entityType city და ზუსტად ერთი seriesId (cpi.headline ან cpi.cat.01–12)."`, `"ranking.inflationCities": "ექვსი ქალაქი, სადაც საქსტატი ფასებს აღრიცხავს; საქართველოს ეროვნული მაჩვენებელი კანდიდატი არ არის."`
- Update `errors.rankDimension`:
  - en: `"Municipal data ranks by \"entities\"; inflation ranks COICOP groups by \"series\" or cities by \"entities\"; every other dataset ranks by \"series\"."`
  - ka: `"მუნიციპალური მონაცემები ერთეულებით რანჟირდება; ინფლაცია — ჯგუფები სერიებით, ქალაქები ერთეულებით; დანარჩენი — სერიებით."`

- [ ] **Step 4: compare.ts**

In the inflation branch, pass `entityIds: target.entityIds` into both request shapes of `inflationObservations`. Pairing is already keyed on `entityId::seriesId`.

- [ ] **Step 5: describe_coverage**

- `describeCoverage.ts`: `type EntityType = "country" | "municipality" | "region" | "city";`.
- `DATASET_META.inflation.entityTypes = ["country", "city"]`.
- `EntityEntry` gains an optional `periods?: [string, string]`. In `entitiesForDataset`:

```ts
  if (datasetId === "inflation") {
    const periods = inflationEntityPeriods(snapshot);
    return [
      { entityId: "country.georgia", entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", entitySlug: null, periods: inflationDatasetPeriods(snapshot) },
      ...snapshot.inflation.cityEntities.map((city) => ({ entityId: city.id, entityType: "city" as const, labelKa: city.labelKa, labelEn: city.labelEn, entitySlug: null, periods: periods.get(city.id)! })),
    ];
  }
```

- `inflationData.ts`, add:

```ts
/** First and last month of any city value, per city (describe_coverage). Late starts per series come back as missing cells. */
export function inflationEntityPeriods(snapshot: FactQuerySnapshot): Map<string, PeriodRange> {
  const result = new Map<string, PeriodRange>();
  for (const city of snapshot.inflation.cityEntities) {
    const range = rangeOf(snapshot.inflation.cities.filter((fact) => fact.cityId === city.id).map((fact) => fact.period));
    if (range !== null) result.set(city.id, range);
  }
  return result;
}
```

- `lib/mcp/outputSchema.ts` line 127: add `periods: z.tuple([z.string(), z.string()]).optional(),` to the entity object.

- [ ] **Step 6: Instructions, tool text and schema version**

- `lib/factQuery/types.ts`: `export const SCHEMA_VERSION = "1.4.0" as const;`.
- `lib/mcp/instructions.ts`:
  - The "Schema 1.3.0 adds regional economies after schema 1.2.0 …" sentence begins "Schema 1.4.0 adds inflation cities (the city entity type and query_inflation entityIds) after schema 1.3.0 added regional economies and schema 1.2.0 introduced the optional period (YYYY-MM) on inflation observations, comparison endpoints and ranking entries, while retaining …" (keep the rest).
  - "Clients must accept additive fields and schema 1.3.0" → "schema 1.4.0".
  - In INFLATION, replace the bullet "The national CPI is a weighted mean of city indices. It is not a region's inflation, a household's cost of living, or wage growth." with:

```text
- City figures (query_inflation entityIds, rank dimension entities with entityType
  city) cover the six cities where Geostat records prices, from 2016-01, for the
  total and the 12 divisions. A city's inflation is not its region's, nor that
  city's cost of living or price level. Some prices are recorded once and applied
  to every city; say so when a city difference in a division is the point.
- The national CPI is a weighted mean of the city indices. Geostat does not publish
  the city weights and this service does not supply them: the national rate is not
  the plain average of the cities, and do not estimate weights yourself. It is not
  a household's cost of living or wage growth.
```

  - WHAT IS NOT SERVED: "city or product price indices, HICP and other price indices" → "product price indices, city subgroups, city price-index levels, city weights and core inflation by city, HICP and other price indices".
- `lib/mcp/tools.ts`, the `rank` description: append `" For inflation cities: dimension entities, entityType city, one seriesId, and the same period fields."`
- `public/llms.txt` line 59: "Schema 1.3.0 adds regional economies after schema 1.2.0 …" → "Schema 1.4.0 adds inflation cities after schema 1.3.0 added regional economies and schema 1.2.0 introduced …", and "schema 1.3.0 rather than" → "schema 1.4.0 rather than".
- Update the version pins listed in **Files** from `"1.3.0"` to `"1.4.0"`. In `tests/factQuery/inflationCatalogue.test.ts`, rename the test to "is schema 1.4.0 after adding inflation cities". Before editing, check with `grep -rn "1\.3\.0" apps/web/tests apps/web/lib apps/web/public` that nothing else pins it.

- [ ] **Step 7: Run the checks**

```bash
npm run data:prepare-fact-query-snapshot
npx vitest run tests/factQuery tests/mcp
npm run typecheck
```

Expected: PASS. `tests/factQuery/reference.test.ts` is unchanged and passing. If a describe_coverage test asserts that inflation has no `entities`, update it only to the new documented list, and report it.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib apps/web/public/llms.txt apps/web/tests data/localization
git commit -m "feat(mcp): rank, compare and describe inflation cities; schema 1.4.0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Bulk publications and `/connect`

**Files:**
- Modify: `apps/web/lib/factQuery/publications.ts`, `apps/web/lib/factQuery/localization.ts`
- Modify: `data/localization/{en,ka}/service-messages.json`
- Modify: `apps/web/lib/pages/connect.tsx`, `apps/web/lib/i18n/messages/{ka,en}/connect.json`
- Modify: `apps/web/public/llms.txt`, `apps/web/tests/seo/agentFiles.test.ts`
- Test: `apps/web/tests/factQuery/inflationPublications.test.ts` (extend)

- [ ] **Step 1: Failing test**

Append to `tests/factQuery/inflationPublications.test.ts` (follow its existing snapshot loading):

```ts
  it("publishes the city CSV and its metadata", () => {
    const files = buildAllPublications(snapshot);
    const csv = files.find((file) => file.fileName === "inflation-cities.csv")!;
    const json = JSON.parse(files.find((file) => file.fileName === "inflation-cities.json")!.bytes.toString("utf8"));
    const text = csv.bytes.toString("utf8");
    expect(text.startsWith("﻿entity_id,series_id,measure,period,value,unit,status,source_ids\n")).toBe(true);
    expect(csv.rowCount).toBe(20570);
    expect(text).toContain("city.batumi,cpi.headline,yoy_pct,2026-08,7.0857,percent,published,source.geostat_cpi_yoy");
    expect(text).not.toContain("country.georgia");
    expect(json).toMatchObject({ datasetId: "inflation", data: { url: "/downloads/data/inflation-cities.csv", rowCount: 20570 } });
    expect(JSON.stringify(json)).not.toMatch(/weight/i);
  });
```

Run: `npx vitest run tests/factQuery/inflationPublications.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement**

In `publications.ts`:

```ts
export const INFLATION_CITIES_CSV_COLUMNS = ["entity_id", "series_id", "measure", "period", "value", "unit", "status", "source_ids"] as const;

/** City cells per measure from 2016-01, through the one observation implementation; available cells only. */
function inflationCityParts(snapshot: FactQuerySnapshot): FactQueryResponse[] {
  const entityIds = snapshot.inflation.cityEntities.map((city) => city.id);
  const last = measurePeriodRange(snapshot, "yoy_pct")![1];
  const periods = periodsBetween(CITY_FIRST_PERIOD, last);
  const divisions = Object.keys(CITY_SERIES_MEASURES);
  return [
    inflationObservations(snapshot, { entityIds, seriesIds: divisions, measure: "yoy_pct", periods }, { includeResidual: false }),
    inflationObservations(snapshot, { entityIds, seriesIds: divisions, measure: "mom_pct", periods }, { includeResidual: false }),
    inflationObservations(snapshot, { entityIds, seriesIds: ["cpi.headline"], measure: "avg12_pct", periods }, { includeResidual: false }),
  ];
}

function buildInflationCitiesCsv(parts: FactQueryResponse[]): PublicationArtifact {
  const lines: string[] = [];
  for (const part of parts) {
    for (const o of observationsOf(part, "inflation-cities.csv").data.observations) {
      if (o.value === null) continue;
      lines.push([o.entityId, o.seriesId, o.measure, o.period ?? "", String(o.value), o.unit, o.basis ?? "", o.sourceIds.join(";")].map(csvEscape).join(","));
    }
  }
  const text = `﻿${INFLATION_CITIES_CSV_COLUMNS.join(",")}\n${lines.join("\n")}\n`;
  return { fileName: "inflation-cities.csv", bytes: Buffer.from(text, "utf8"), rowCount: lines.length };
}

function buildInflationCitiesJson(snapshot: FactQuerySnapshot, parts: FactQueryResponse[], csv: PublicationArtifact): PublicationArtifact {
  const results = parts.map((part) => observationsOf(part, "inflation-cities.json"));
  const bytes = serialize({
    ...publicationHeader(snapshot),
    datasetId: "inflation",
    notice: serviceMessage(snapshot, "ka", "publication.inflationCitiesNotice"),
    noticeEn: serviceMessage(snapshot, "en", "publication.inflationCitiesNotice"),
    catalogue: catalogueData(snapshot, "inflation"),
    data: {
      url: "/downloads/data/inflation-cities.csv",
      mediaType: "text/csv",
      columns: [...INFLATION_CITIES_CSV_COLUMNS],
      rowCount: csv.rowCount,
      byteSize: csv.bytes.byteLength,
      sha256: sha256(csv.bytes),
    },
    definitions: { yoy_pct: INFLATION_DEFINITIONS.yoy_pct, mom_pct: INFLATION_DEFINITIONS.mom_pct, avg12_pct: INFLATION_DEFINITIONS.avg12_pct },
    sources: results.reduce<ResolvedSource[]>((all, result) => mergeSources(all, result.meta.sources), []),
    caveats: results.reduce<Caveat[]>((all, result) => mergeCaveats(all, result.meta.caveats), []),
  });
  return { fileName: "inflation-cities.json", bytes, rowCount: csv.rowCount };
}
```

In `buildAllPublications`, add `const inflationCities = inflationCityParts(snapshot); const inflationCitiesCsv = buildInflationCitiesCsv(inflationCities);` beside the category parts, and append `inflationCitiesCsv, buildInflationCitiesJson(snapshot, inflationCities, inflationCitiesCsv),` after the category JSON.

Imports: `CITY_FIRST_PERIOD` (`../data/inflation/types`) and `CITY_SERIES_MEASURES` (`./inflationSeries`).

Service message `publication.inflationCitiesNotice` (add the key to `localization.ts`):
- en: `"Rates never sum. The CSV holds year-on-year and month-on-month rates for the total and the 12 divisions and the total's 12-month average, for the six cities from 2016-01. Georgia's national rate is in inflation-national.json and inflation-categories.csv. City weights are not published by Geostat and are not in this file."`
- ka: `"განაკვეთები არ იკრიბება. CSV შეიცავს ექვსი ქალაქის წლიურ და თვიურ ცვლილებას სულ და 12 ჯგუფისთვის, ასევე სულის 12-თვიან საშუალოს, 2016 წლის იანვრიდან. საქართველოს ეროვნული მაჩვენებელი inflation-national.json-სა და inflation-categories.csv-შია. ქალაქების წონებს საქსტატი არ აქვეყნებს და ეს ფაილი მათ არ შეიცავს."`

`lib/pages/connect.tsx`: after the categories JSON link in `connect-inflation-discovery`, add:

```tsx
                  <a className="underline" href="/downloads/data/inflation-cities.csv">{message(messages, "connect.inflationCitiesCsv")}</a>{" · "}
                  <a className="underline" href="/downloads/data/inflation-cities.json">{message(messages, "connect.inflationCitiesMetadata")}</a>{" · "}
```

`connect.json` messages:
- ka: `"connect.inflationCitiesCsv": "ქალაქები (CSV)"`, `"connect.inflationCitiesMetadata": "ქალაქების მეტამონაცემები"`
- en: `"connect.inflationCitiesCsv": "Cities (CSV)"`, `"connect.inflationCitiesMetadata": "Cities metadata"`

`public/llms.txt`: after the "Inflation categories CSV" line, add:

```text
- [Inflation cities CSV](https://fiscal.ge/downloads/data/inflation-cities.csv) and [its metadata](https://fiscal.ge/downloads/data/inflation-cities.json) — annual and monthly rates for the six Geostat price-collection cities from 2016, total and 12 COICOP divisions, plus the total's 12-month average. Use `query_inflation` with `entityIds`; 2.4 means 2.4%.
```

`tests/seo/agentFiles.test.ts`: add both URLs to `requiredTargets`.

- [ ] **Step 3: Run the checks**

```bash
npm run data:prepare-fact-query-snapshot
npx vitest run tests/factQuery/inflationPublications.test.ts tests/seo/agentFiles.test.ts
npm run i18n:check
```

Expected: PASS. The published files are checked against the snapshot after `npm run build` (`data:check-fact-query-publications` in `postbuild`), which Task 15 runs.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib apps/web/public/llms.txt apps/web/tests data/localization
git commit -m "feat(publications): inflation-cities CSV and metadata

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Reference fixture intents 38–40

**Files:**
- Modify: `apps/web/tests/factQuery/fixtures/referenceIntents.ts`

Each value below was read by hand from the Geostat workbooks during the 2026-09-26 audit (published index minus 100). Before committing, confirm each against `data/imports/cpi-cities-monthly.csv` with `grep`.

- [ ] **Step 1: Confirm the values from the CSV**

```bash
grep -E "^city\.batumi,cpi\.headline,yoy_pct,2026-08," ../../data/imports/cpi-cities-monthly.csv
grep -E "^city\.[a-z]+,cpi\.cat\.01,yoy_pct,2026-08," ../../data/imports/cpi-cities-monthly.csv
grep -cE "^city\.zugdidi,cpi\.headline,yoy_pct,2016-(0[1-9]|1[01])," ../../data/imports/cpi-cities-monthly.csv
```

Expected:
- Batumi `7.0857`.
- Food: Kutaisi `6.507`, Batumi `5.9542`, Tbilisi `4.8642`, Zugdidi `4.8152`, Gori `4.0405`, Telavi `3.4353`.
- Zugdidi count `0`.

If any differs, stop and report; don't change the expectations to match.

- [ ] **Step 2: Append the intents**

After intent 37, in `REFERENCE_INTENTS`:

```ts
  {
    id: 38,
    promptKa: "რამდენი იყო წლიური ინფლაცია ბათუმში 2026 წლის აგვისტოში?",
    promptEn: "What was annual inflation in Batumi in August 2026?",
    call: { tool: "query_inflation", arguments: { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" } },
    expectedStatus: "ok",
    expectedCells: [{ id: "inflation:city.batumi:cpi.headline:2026-08:yoy_pct", value: 7.0857, unit: "percent" }],
    allowedRounding: EXACT,
    expectedBudgetScope: "consumer_prices",
    requiredSourceIds: ["source.geostat_cpi_yoy"],
    requiredDocumentIds: [],
    requiredCaveatCodes: [],
    mustDeclineOrQualify: false,
    note: "Read from data/imports/cpi-cities-monthly.csv: city.batumi cpi.headline yoy_pct 2026-08 = 7.0857 (Geostat Batumi sheet, index 107.0857). Total cells carry no central-prices caveat.",
  },
  {
    id: 39,
    promptKa: "რომელ ქალაქებში გაძვირდა სურსათი ყველაზე მეტად 2026 წლის აგვისტოში?",
    promptEn: "In which cities did food prices rise most in August 2026?",
    call: { tool: "rank", arguments: { datasetId: "inflation", dimension: "entities", entityType: "city", seriesId: "cpi.cat.01", period: "2026-08", measure: "yoy_pct", metric: "value", limit: 3 } },
    expectedStatus: "ok",
    expectedRanking: { orderedIds: ["city.kutaisi", "city.batumi", "city.tbilisi"], topValues: [6.507, 5.9542, 4.8642], unit: "percent", candidateCount: 6, eligibleCount: 6 },
    allowedRounding: EXACT,
    expectedBudgetScope: null,
    requiredSourceIds: ["source.geostat_cpi_yoy"],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["inflation_city_central_prices"],
    mustDeclineOrQualify: false,
    note: "The six cpi.cat.01 yoy_pct rows for 2026-08 in cpi-cities-monthly.csv, sorted by hand. Georgia (5.0154) is not a candidate.",
  },
  {
    id: 40,
    promptKa: "რამდენი იყო წლიური ინფლაცია ზუგდიდში 2016 წლის ივნისში?",
    promptEn: "What was annual inflation in Zugdidi in June 2016?",
    call: { tool: "query_inflation", arguments: { entityIds: ["city.zugdidi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2016-06", toPeriod: "2016-06" } },
    expectedStatus: "empty",
    expectedCells: [{ id: "inflation:city.zugdidi:cpi.headline:2016-06:yoy_pct", value: null, unit: "percent" }],
    allowedRounding: EXACT,
    expectedBudgetScope: "consumer_prices",
    requiredSourceIds: [],
    requiredDocumentIds: [],
    requiredCaveatCodes: [],
    mustDeclineOrQualify: true,
    note: "Geostat began pricing in Zugdidi in 2015-12, so its annual change starts 2016-12. Missing with a reason, never 0 and never filled.",
  },
```

Update the file's header comment count if it states one.

- [ ] **Step 3: Run the fixture**

Run: `npx vitest run tests/factQuery/reference.test.ts`
Expected: PASS. All 40 intents pass, and intents 1–37 are unchanged. A disagreement is a stop condition: report it, don't edit an expectation.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/factQuery/fixtures/referenceIntents.ts
git commit -m "test(mcp): reference intents for city inflation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Done-check and report

**Files:** none unless a gate fails.

- [ ] **Step 1: Full gates, once**

From `apps/web` (stop any server on :3100 first):

```bash
npm run check
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build
```

Then serve the build on :3100 in the background and run the whole browser suite:

```bash
npm run start -- --port 3100
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all three pass. If a download or request spec fails under load, re-run that file alone before debugging (known flake). Don't re-run a gate that passed unless its inputs changed.

- [ ] **Step 2: Byte-level check of the generated files**

```bash
git diff --stat main -- data/imports
grep -c $'\r' data/imports/cpi-cities-monthly.csv
```

Expected:
- `data/imports` changes only by the new cities file.
- CR count is `0`.

- [ ] **Step 3: Report to the owner**

Summarize in plain language:
- What shipped.
- Gate results, with counts.
- The implied-weights figures from the report, as evidence the cities add up.
- **Georgian copy needing a native read:**
  - the new `inflation.*` city messages (Task 5)
  - the methodology paragraphs (Task 10)
  - the three service messages (Tasks 11–13)
  - the notice (Task 13)
- Anything reported as a stop condition.

Delivery (branch rename to `codex/inflation-cities`, push, draft PR, CI) happens only when the owner authorizes publishing.

---

## Self-review notes

- **Spec coverage:**

  | Spec section | Task |
  | --- | --- |
  | §3 data | 1–3 |
  | §4.1–4.3 reader, prepare and validation | 1–3 |
  | §4.4 mirror | 4 |
  | §5 navigation, hub and sitemap | 8 |
  | §6 page | 5–8 |
  | §7 components | 8 |
  | §8 hash | 6 |
  | §9 Excel | 7 |
  | §10 methodology | 3, 10 |
  | §11 MCP | 11–14 |
  | §12 verification | 9, 14, 15 |
  | §2 scope and design records | 10 |

- **Corrections made to the spec while planning** (committed with this plan):
  - schema `1.3.0` → `1.4.0`
  - `rank` reuses `dimension: "entities"`
  - the shared selector keeps its search box
  - the category picker is a native select
  - explicit city colours
  - the national-sheet check is a reader-consistency check
- **Names used across tasks:**
  - `CityFactInput.lineId` (Tasks 1, 6, 8)
  - `GEORGIA_LINE_ID = "country.georgia"` (Tasks 6, 8)
  - `CITY_SERIES_MEASURES` (Tasks 11, 13)
  - `inflation.city.<lineId>` message keys (Tasks 5, 11)
  - `snapshot.inflation.cityEntities` (Tasks 11–13)
