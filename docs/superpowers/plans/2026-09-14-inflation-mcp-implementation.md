# Inflation MCP and Publications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the inflation dataset (monthly national CPI, NBG target, COICOP groups, basket weights, derived contributions) through the read-only `/mcp` endpoint and the bulk publications.

**Architecture:** The snapshot gains an `inflation` block. A vocabulary module (`inflationSeries.ts`), a snapshot-derived coverage module (`inflationData.ts`) and one query module (`queryInflation.ts`) own all inflation logic; `describeCoverage`, `getSources`, `compare`, `rank` and `publications` call into them. Observations gain an optional `period` (`YYYY-MM`); schema 1.1.0 → 1.2.0.

**Tech Stack:** Next.js 16, strict TypeScript, zod, `@modelcontextprotocol/sdk`, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`

## Global Constraints

- Run every command from `apps/web`.
- Series IDs are the reviewed CSV IDs: `cpi.headline`, `cpi.core`, `cpi.core_ex_tobacco`, `cpi.cat.NN`, `cpi.cat.NN_M`; plus `cpi.target` and `cpi.contribution_residual`.
- Measures: `yoy_pct`, `mom_pct`, `avg12_pct`, `index_2010`, `target_pct`, `basket_weight_pct`, `contribution_pp`. New units: `index_2010_100`, `percentage_points`.
- `SCHEMA_VERSION` becomes `"1.2.0"`. Periods match `/^\d{4}-(0[1-9]|1[0-2])$/`.
- `lib/factQuery/` (except `buildSnapshot.ts`) never imports `fs`, network, db or `lib/i18n/messages` (`tests/factQuery/purity.test.ts`).
- Coverage (periods, years, counts) is read from the snapshot, never written into code, text or tests. Tests compare against served data, not against today's row counts.
- Error codes come only from `errorCodeSchema`. Caveats come only from registered rules in `CAVEAT_RULES`; a query module never contains the word `severity` (`tests/factQuery/caveats/registered.test.ts`).
- Every `{parameter}` in a new service message is declared in `SERVICE_MESSAGE_PARAMETERS` (`lib/factQuery/localization.ts`), or `i18n:check` fails.
- The MCP cell limit is 500 per call (`LIMITS.cells`).
- `npx vitest run tests/factQuery/reference.test.ts` disagreeing with a hand-checked expectation is a stop condition: report it, never edit the expectation to match the code.
- Tests that call `loadPackagedSnapshot()` need `npm run data:prepare-fact-query-snapshot` first whenever snapshot content or service messages changed.
- Feedback loop: `npx vitest run <file>` and `npm run typecheck`. The full gates run once, in Task 9.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Inflation vocabulary, snapshot block and catalogue

Makes inflation discoverable: `describe_coverage` lists the dataset, its series and their month spans, and `get_sources` narrows to it. Widening `DatasetId` forces `describeCoverage` and `getSources` to handle the new id, so they ship in this task to keep the typecheck green.

**Files:**
- Create: `apps/web/lib/factQuery/inflationSeries.ts`
- Create: `apps/web/lib/factQuery/inflationData.ts`
- Modify: `apps/web/lib/factQuery/types.ts` (SCHEMA_VERSION, DatasetId, Measure, Unit, FactQuerySnapshot)
- Modify: `apps/web/lib/factQuery/observations.ts` (Observation.period, buildObservationId)
- Modify: `apps/web/lib/factQuery/schemas.ts` (PERIOD_PATTERN, periodKeySchema, observationSchema, describeCoverageInput, getSourcesInput)
- Modify: `apps/web/lib/factQuery/buildSnapshot.ts` (load inflation, group labels, labelsEn, content)
- Modify: `apps/web/lib/factQuery/describeCoverage.ts`
- Modify: `apps/web/lib/factQuery/getSources.ts`
- Modify: `apps/web/lib/mcp/outputSchema.ts` (catalogue periods)
- Modify: `data/localization/en/labels.json` (dataset label)
- Test: `apps/web/tests/factQuery/inflationCatalogue.test.ts`

**Interfaces:**
- Produces (`inflationSeries.ts`): `INFLATION_DATASET_ID = "inflation"`, `INFLATION_ENTITY_ID = "country.georgia"`, `TARGET_SERIES_ID = "cpi.target"`, `RESIDUAL_SERIES_ID = "cpi.contribution_residual"`, `INFLATION_MEASURES` (readonly tuple), `type InflationMeasure`, `INFLATION_MEASURE_UNITS: Record<InflationMeasure, Unit>`, `NATIONAL_SERIES: Record<"cpi.headline" | "cpi.core" | "cpi.core_ex_tobacco", { labelKa; labelEn; measures: readonly string[] }>`, `TARGET_SERIES`, `RESIDUAL_SERIES`, `GROUP_MEASURES: readonly InflationMeasure[]`, `INFLATION_DEFINITIONS: Record<InflationMeasure | "residual", { ka: string; en: string }>`, `type InflationGroup = { id; coicopCode; level: "division" | "subgroup"; parentId: string | null; labelKa; labelEn }`.
- Produces (`inflationData.ts`): `type PeriodRange = [string, string]`, `type SeriesCoverage`, `periodsBetween(from, to): string[]`, `yearOfPeriod(period): number`, `contributionIndex(snapshot): Map<string, Map<number, number>>`, `inflationSeriesCoverage(snapshot): Map<string, SeriesCoverage>`, `measurePeriodRange(snapshot, measure): PeriodRange | null`, `weightYearRange(snapshot): [number, number]`, `inflationCatalogueSeries(snapshot)`, `inflationDatasetPeriods(snapshot): PeriodRange`.
- Produces (`schemas.ts`): `PERIOD_PATTERN`, `periodKeySchema`.
- Produces (`observations.ts`): `Observation.period?: string`; `buildObservationId(datasetId, entityId, seriesId, yearOrPeriod: number | string, measure)`.
- Produces (`FactQuerySnapshot`): `inflation: { facts: ServedCpiFact[]; targets: ServedInflationTargetRow[]; categories: ServedCpiCategoryFact[]; weights: ServedBasketWeightRow[]; groups: InflationGroup[] }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/factQuery/inflationCatalogue.test.ts`:

```ts
// apps/web/tests/factQuery/inflationCatalogue.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage, type CoverageData } from "../../lib/factQuery/describeCoverage";
import { getSources } from "../../lib/factQuery/getSources";
import { serviceLabelEn } from "../../lib/factQuery/localization";
import { SCHEMA_VERSION, type FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

function catalogue(input: unknown): CoverageData {
  const response = describeCoverage(snapshot, input);
  if (response.kind !== "catalogue") throw new Error(JSON.stringify(response));
  return response.data as CoverageData;
}

describe("inflation snapshot and catalogue", () => {
  it("is schema 1.2.0", () => {
    expect(SCHEMA_VERSION).toBe("1.2.0");
  });

  it("carries every served inflation row", async () => {
    const served = await loadServedInflationData();
    expect(snapshot.inflation.facts).toHaveLength(served.facts.length);
    expect(snapshot.inflation.categories).toHaveLength(served.categories.length);
    expect(snapshot.inflation.weights).toHaveLength(served.weights.length);
    expect(snapshot.inflation.targets).toHaveLength(served.targets.length);
  });

  it("names 12 divisions and 43 subgroups in both languages", () => {
    const { groups } = snapshot.inflation;
    expect(groups.filter((g) => g.level === "division")).toHaveLength(12);
    expect(groups.filter((g) => g.level === "subgroup")).toHaveLength(43);
    expect(groups.find((g) => g.id === "cpi.cat.01_1")).toMatchObject({ parentId: "cpi.cat.01", labelKa: "სურსათი", labelEn: "Food" });
    for (const group of groups) expect(group.labelKa).toMatch(/\p{Script=Georgian}/u);
    for (const id of ["inflation", "cpi.headline", "cpi.core", "cpi.core_ex_tobacco", "cpi.target", "cpi.contribution_residual", "cpi.cat.07"]) {
      expect(serviceLabelEn(snapshot, id).trim()).not.toBe("");
    }
  });

  it("lists inflation with its month span read from the data", () => {
    const dataset = catalogue({}).datasets.find((d) => d.datasetId === "inflation") as CoverageData["datasets"][number] & { periods: [string, string] };
    const periods = [...snapshot.inflation.facts, ...snapshot.inflation.categories].map((f) => f.period).sort();
    expect(dataset.periods).toEqual([periods[0], periods.at(-1)]);
    expect(dataset.budgetScope).toBe("consumer_prices");
    expect(dataset.measures).toContain("contribution_pp");
    expect(dataset.labelEn).toBe("Consumer price inflation");
  });

  it("describes each series' measures and months, and never offers the residual", () => {
    type Entry = { seriesId: string; level: string; parentSeriesId: string | null; periodsByMeasure: Record<string, [string, string]>; yearsByMeasure?: Record<string, number[]> };
    const series = catalogue({ datasetId: "inflation" }).series as unknown as Entry[];
    const byId = new Map(series.map((s) => [s.seriesId, s]));
    expect(byId.has("cpi.contribution_residual")).toBe(false);
    expect(byId.get("cpi.cat.07")).toMatchObject({ level: "division", parentSeriesId: null });
    expect(byId.get("cpi.cat.07_1")).toMatchObject({ level: "subgroup", parentSeriesId: "cpi.cat.07" });
    expect(byId.get("cpi.core")!.periodsByMeasure.index_2010).toBeUndefined();
    expect(byId.get("cpi.target")!.periodsByMeasure.target_pct[0]).toBe(snapshot.inflation.targets.map((t) => t.effectiveFrom).sort()[0]);
    expect(byId.get("cpi.cat.01")!.periodsByMeasure.contribution_pp[0]).toBe("2013-01");
    expect(byId.get("cpi.cat.01")!.yearsByMeasure!.basket_weight_pct[0]).toBe(Math.min(...snapshot.inflation.weights.map((w) => w.year)));
  });

  it("finds groups by label and narrows by level", () => {
    const found = catalogue({ search: "Food" }).series!;
    expect(found.some((s) => (s as { datasetId?: string }).datasetId === "inflation" && s.seriesId === "cpi.cat.01_1")).toBe(true);
    expect(catalogue({ datasetId: "inflation", level: "subgroup" }).series!).toHaveLength(43);
  });

  it("narrows source evidence to the inflation dataset", () => {
    const response = getSources(snapshot, { sourceIds: ["source.nbg_inflation_target"], datasetId: "inflation" });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    expect(JSON.stringify(response.data)).not.toContain('"narrowingOutcome":"dropped_no_match"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/factQuery/inflationCatalogue.test.ts`
Expected: FAIL — `SCHEMA_VERSION` is `"1.1.0"` and `snapshot.inflation` is undefined.

- [ ] **Step 3: Create the vocabulary module**

Create `apps/web/lib/factQuery/inflationSeries.ts`:

```ts
// apps/web/lib/factQuery/inflationSeries.ts
//
// The inflation dataset's fixed vocabulary: the series beside the COICOP groups,
// the measures each publishes, units and definitions. COICOP group labels are
// not here: they are Geostat's wording, read from the site's inflation message
// catalogue by buildSnapshot, so the page and an MCP answer name a group alike.
import { CPI_SERIES_MEASURES } from "../data/inflation/types";
import type { Unit } from "./types";

export const INFLATION_DATASET_ID = "inflation" as const;
export const INFLATION_ENTITY_ID = "country.georgia";
export const TARGET_SERIES_ID = "cpi.target";
export const RESIDUAL_SERIES_ID = "cpi.contribution_residual";

export const INFLATION_MEASURES = ["yoy_pct", "mom_pct", "avg12_pct", "index_2010", "target_pct", "basket_weight_pct", "contribution_pp"] as const;
export type InflationMeasure = (typeof INFLATION_MEASURES)[number];

export const INFLATION_MEASURE_UNITS: Record<InflationMeasure, Unit> = {
  yoy_pct: "percent",
  mom_pct: "percent",
  avg12_pct: "percent",
  index_2010: "index_2010_100",
  target_pct: "percent",
  basket_weight_pct: "percent",
  contribution_pp: "percentage_points",
};

type SeriesVocabulary = { labelKa: string; labelEn: string; measures: readonly string[] };

/** Measures as Geostat publishes them: core has neither an index level nor a 12-month average. */
export const NATIONAL_SERIES: Record<"cpi.headline" | "cpi.core" | "cpi.core_ex_tobacco", SeriesVocabulary> = {
  "cpi.headline": { labelKa: "საერთო ინფლაცია", labelEn: "Headline inflation", measures: CPI_SERIES_MEASURES["cpi.headline"] },
  "cpi.core": { labelKa: "საბაზო ინფლაცია", labelEn: "Core inflation", measures: CPI_SERIES_MEASURES["cpi.core"] },
  "cpi.core_ex_tobacco": { labelKa: "საბაზო, თამბაქოს გარეშე", labelEn: "Core excluding tobacco", measures: CPI_SERIES_MEASURES["cpi.core_ex_tobacco"] },
};

export const TARGET_SERIES: SeriesVocabulary = { labelKa: "მიზნობრივი მაჩვენებელი", labelEn: "Inflation target", measures: ["target_pct"] };
export const RESIDUAL_SERIES: SeriesVocabulary = { labelKa: "დანარჩენი", labelEn: "Residual", measures: ["contribution_pp"] };
export const GROUP_MEASURES: readonly InflationMeasure[] = ["yoy_pct", "mom_pct", "basket_weight_pct", "contribution_pp"];

export type InflationGroup = {
  id: string;
  coicopCode: string;
  level: "division" | "subgroup";
  parentId: string | null;
  labelKa: string;
  labelEn: string;
};

export const INFLATION_DEFINITIONS: Record<InflationMeasure | "residual", { ka: string; en: string }> = {
  yoy_pct: {
    ka: "სამომხმარებლო ფასების ცვლილება წინა წლის იმავე თვესთან, პროცენტებში, როგორც საქსტატი აქვეყნებს: 2.4 ნიშნავს 2.4%-ს.",
    en: "Change in consumer prices against the same month a year earlier, in percent as Geostat publishes it: 2.4 means 2.4%.",
  },
  mom_pct: {
    ka: "ფასების ცვლილება წინა თვესთან, პროცენტებში, როგორც საქსტატი აქვეყნებს. თვიური ცვლილებები წლიურ ცვლილებას არ ჯამდება.",
    en: "Change against the previous month, in percent as Geostat publishes it. Monthly changes do not add up to the annual change.",
  },
  avg12_pct: {
    ka: "12-თვიური საშუალო ინფლაცია, როგორც საქსტატი აქვეყნებს; ეს წლიური (წინა წლის იმავე თვესთან) ინფლაცია არ არის.",
    en: "Twelve-month average inflation as Geostat publishes it; not the annual (year-on-year) rate.",
  },
  index_2010: {
    ka: "სამომხმარებლო ფასების ინდექსის დონე, 2010 = 100, როგორც საქსტატი აქვეყნებს; ეს დონეა, არა პროცენტი.",
    en: "Consumer price index level, 2010 = 100, as Geostat publishes it; a level, not a percentage.",
  },
  target_pct: {
    ka: "საქართველოს ეროვნული ბანკის ამ თვეში მოქმედი ინფლაციის მიზნობრივი მაჩვენებელი, პროცენტებში; ეს ორიენტირია, არა პროგნოზი ან შედეგი.",
    en: "The National Bank of Georgia's inflation target in force that month, in percent; a reference, not a forecast or an outcome.",
  },
  basket_weight_pct: {
    ka: "ჯგუფის წილი სამომხმარებლო კალათაში ამ წელს, პროცენტებში, როგორც საქსტატი აქვეყნებს; განყოფილებების ჯამი 100-ია.",
    en: "The group's share of the consumer basket in that year, in percent, as Geostat publishes it; divisions sum to 100.",
  },
  contribution_pp: {
    ka: "Fiscal.ge-ის გაანგარიშება: კალათის წილი / 100 × ჯგუფის წლიური ცვლილება, პროცენტულ პუნქტებში. მიახლოებითია და საქსტატის მაჩვენებელი არ არის.",
    en: "Fiscal.ge's calculation: basket weight / 100 × the group's year-on-year change, in percentage points. An approximation, not a Geostat figure.",
  },
  residual: {
    ka: "გამოქვეყნებული საერთო წლიური ინფლაცია გამოკლებული მოთხოვნილი ჯგუფების წვლილი, პროცენტულ პუნქტებში: ყველაფერი, რაც არ მოითხოვეთ, და მიახლოების ცდომილება.",
    en: "Published headline year-on-year inflation minus the requested groups' contributions, in percentage points: everything not requested plus approximation error.",
  },
};
```

- [ ] **Step 4: Widen the shared types**

In `apps/web/lib/factQuery/types.ts`:

1. Replace `export const SCHEMA_VERSION = "1.1.0" as const;` with `export const SCHEMA_VERSION = "1.2.0" as const;`.
2. Add `| "inflation"` as the last member of `DatasetId`.
3. Replace the `Measure` union's last line `| "real_growth_pct";` with:

```ts
  | "real_growth_pct"
  | "yoy_pct"
  | "mom_pct"
  | "avg12_pct"
  | "index_2010"
  | "target_pct"
  | "basket_weight_pct"
  | "contribution_pp";
```

4. Replace the `Unit` line with:

```ts
export type Unit = "GEL" | "percent" | "GEL_per_resident" | "USD" | "USD_2015" | "GEL_per_person" | "USD_per_person" | "index_2010_100" | "percentage_points";
```

5. In `FactQuerySnapshot`, after the `economicSectors` line, add:

```ts
  inflation: {
    facts: import("../data/inflation/types").ServedCpiFact[];
    targets: import("../data/inflation/types").ServedInflationTargetRow[];
    categories: import("../data/inflation/types").ServedCpiCategoryFact[];
    weights: import("../data/inflation/types").ServedBasketWeightRow[];
    groups: import("./inflationSeries").InflationGroup[];
  };
```

- [ ] **Step 5: Add `period` to observations and the observation schema**

In `apps/web/lib/factQuery/observations.ts`, in `Observation`, after `year: number;` add:

```ts
  /** Monthly observations only (inflation): YYYY-MM. `year` stays the calendar year of that month. */
  period?: string;
```

Replace `buildObservationId` with:

```ts
/** observationId's one fixed template (spec section 7.2). A monthly observation puts its period where the year goes. */
export function buildObservationId(datasetId: DatasetId, entityId: string, seriesId: string, yearOrPeriod: number | string, measure: Measure): string {
  return `${datasetId}:${entityId}:${seriesId}:${yearOrPeriod}:${measure}`;
}
```

In `apps/web/lib/factQuery/schemas.ts`:

1. After the `expectedDataVersion` declaration add:

```ts
export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const periodKeySchema = z.string().regex(PERIOD_PATTERN, "use YYYY-MM");
```

2. In `describeCoverageInput` and `getSourcesInput`, add `"inflation"` as the last `datasetId` enum member.
3. In `describeCoverageInput`, replace `level: z.enum(["admin_category", "major_program"]).optional(),` with `level: z.enum(["admin_category", "major_program", "division", "subgroup"]).optional(),`.
4. In `observationSchema`, after `year: z.number().int(),` add `period: periodKeySchema.optional(),` and replace its `unit` line with:

```ts
  unit: z.enum(["GEL", "percent", "GEL_per_resident", "USD", "USD_2015", "GEL_per_person", "USD_per_person", "index_2010_100", "percentage_points"]),
```

- [ ] **Step 6: Create the snapshot-derived coverage module**

Create `apps/web/lib/factQuery/inflationData.ts`:

```ts
// apps/web/lib/factQuery/inflationData.ts
//
// Coverage and derived values for the inflation dataset, read from the snapshot.
// Pure and memoised per snapshot: the category table is about 28,000 rows and
// these are asked for on every inflation call.
import { buildContributionIndex } from "../data/inflation/contributions";
import { periodFromKey, periodKey } from "../data/inflation/periods";
import { categoryFactInput } from "../data/inflation/types";
import { NATIONAL_SERIES, TARGET_SERIES, TARGET_SERIES_ID, type InflationMeasure } from "./inflationSeries";
import type { FactQuerySnapshot } from "./types";

export type PeriodRange = [first: string, last: string];

export type SeriesCoverage = {
  periodsByMeasure: Partial<Record<InflationMeasure, PeriodRange>>;
  years: number[];
  weightYears: number[];
};

function memo<T>(cache: WeakMap<FactQuerySnapshot, T>, snapshot: FactQuerySnapshot, build: () => T): T {
  let value = cache.get(snapshot);
  if (value === undefined) {
    value = build();
    cache.set(snapshot, value);
  }
  return value;
}

/** Every month from `from` to `to`, inclusive, as YYYY-MM. Empty when `from` is later. */
export function periodsBetween(from: string, to: string): string[] {
  const periods: string[] = [];
  for (let period = periodFromKey(from); period <= periodFromKey(to); period += 1) periods.push(periodKey(period));
  return periods;
}

export function yearOfPeriod(period: string): number {
  return Number(period.slice(0, 4));
}

function rangeOf(periods: Iterable<string>): PeriodRange | null {
  let first: string | null = null;
  let last: string | null = null;
  for (const period of periods) {
    if (first === null || period < first) first = period;
    if (last === null || period > last) last = period;
  }
  return first === null || last === null ? null : [first, last];
}

const contributionCache = new WeakMap<FactQuerySnapshot, Map<string, Map<number, number>>>();

/** The site's own contribution arithmetic (lib/data/inflation/contributions.ts), built once per snapshot. */
export function contributionIndex(snapshot: FactQuerySnapshot): Map<string, Map<number, number>> {
  return memo(contributionCache, snapshot, () =>
    buildContributionIndex(snapshot.inflation.categories.map(categoryFactInput), snapshot.inflation.weights),
  );
}

const coverageCache = new WeakMap<FactQuerySnapshot, Map<string, SeriesCoverage>>();

/**
 * Per requestable series: the month span of each measure, every year with a
 * value, and the years with a basket weight. The target spans from its first
 * reviewed month to the last published headline month, because the target in
 * force carries forward.
 */
export function inflationSeriesCoverage(snapshot: FactQuerySnapshot): Map<string, SeriesCoverage> {
  return memo(coverageCache, snapshot, () => {
    const periods = new Map<string, Map<InflationMeasure, string[]>>();
    const add = (seriesId: string, measure: InflationMeasure, period: string) => {
      const byMeasure = periods.get(seriesId) ?? new Map<InflationMeasure, string[]>();
      periods.set(seriesId, byMeasure);
      const list = byMeasure.get(measure) ?? [];
      byMeasure.set(measure, list);
      list.push(period);
    };
    for (const fact of snapshot.inflation.facts) add(fact.seriesId, fact.measure, fact.period);
    for (const fact of snapshot.inflation.categories) add(fact.categoryId, fact.measure, fact.period);
    for (const [seriesId, byPeriod] of contributionIndex(snapshot)) {
      for (const period of byPeriod.keys()) add(seriesId, "contribution_pp", periodKey(period));
    }
    const headline = rangeOf(snapshot.inflation.facts.filter((f) => f.seriesId === "cpi.headline" && f.measure === "yoy_pct").map((f) => f.period));
    const targets = rangeOf(snapshot.inflation.targets.map((row) => row.effectiveFrom));
    if (headline !== null && targets !== null && targets[0] <= headline[1]) {
      for (const period of periodsBetween(targets[0], headline[1])) add(TARGET_SERIES_ID, "target_pct", period);
    }

    const ids = [...Object.keys(NATIONAL_SERIES), TARGET_SERIES_ID, ...snapshot.inflation.groups.map((group) => group.id)];
    const result = new Map<string, SeriesCoverage>();
    for (const id of ids) {
      const byMeasure = periods.get(id) ?? new Map<InflationMeasure, string[]>();
      const weightYears = [...new Set(snapshot.inflation.weights.filter((w) => w.categoryId === id).map((w) => w.year))].sort((a, b) => a - b);
      const years = new Set<number>(weightYears);
      for (const list of byMeasure.values()) for (const period of list) years.add(yearOfPeriod(period));
      result.set(id, {
        periodsByMeasure: Object.fromEntries([...byMeasure].map(([measure, list]) => [measure, rangeOf(list)!])),
        years: [...years].sort((a, b) => a - b),
        weightYears,
      });
    }
    return result;
  });
}

/** Where a monthly measure is published anywhere in the dataset; requests outside it are refused. */
export function measurePeriodRange(snapshot: FactQuerySnapshot, measure: InflationMeasure): PeriodRange | null {
  return rangeOf([...inflationSeriesCoverage(snapshot).values()].flatMap((coverage) => coverage.periodsByMeasure[measure] ?? []));
}

export function weightYearRange(snapshot: FactQuerySnapshot): [number, number] {
  const years = snapshot.inflation.weights.map((row) => row.year);
  return [Math.min(...years), Math.max(...years)];
}

/** Catalogue entries for describe_coverage. The residual is never listed: its value depends on the request. */
export function inflationCatalogueSeries(snapshot: FactQuerySnapshot) {
  const coverage = inflationSeriesCoverage(snapshot);
  const entry = (seriesId: string, labelKa: string, level: string, parentSeriesId: string | null) => {
    const series = coverage.get(seriesId)!;
    const periods = rangeOf((Object.values(series.periodsByMeasure) as PeriodRange[]).flat());
    return {
      seriesId,
      labelKa,
      level,
      parentSeriesId,
      availability: "served" as const,
      years: series.years,
      ...(periods !== null ? { periods } : {}),
      periodsByMeasure: series.periodsByMeasure as Record<string, PeriodRange>,
      ...(series.weightYears.length > 0 ? { yearsByMeasure: { basket_weight_pct: series.weightYears } } : {}),
    };
  };
  return [
    ...Object.entries(NATIONAL_SERIES).map(([id, series]) => entry(id, series.labelKa, "national", null)),
    entry(TARGET_SERIES_ID, TARGET_SERIES.labelKa, "reference", null),
    ...snapshot.inflation.groups.map((group) => entry(group.id, group.labelKa, group.level, group.parentId)),
  ];
}

export function inflationDatasetPeriods(snapshot: FactQuerySnapshot): PeriodRange {
  return rangeOf([...snapshot.inflation.facts, ...snapshot.inflation.categories].map((fact) => fact.period))!;
}
```

- [ ] **Step 7: Load inflation into the snapshot**

In `apps/web/lib/factQuery/buildSnapshot.ts`:

1. Add imports next to the other data loaders:

```ts
import { loadServedInflationData } from "../data/inflation/importInflation";
import { NATIONAL_SERIES, RESIDUAL_SERIES, RESIDUAL_SERIES_ID, TARGET_SERIES, TARGET_SERIES_ID, type InflationGroup } from "./inflationSeries";
```

2. Add this module-level function directly above `function sortedBy`:

```ts
/**
 * The COICOP tree with Geostat's own Georgian and English wording, read from
 * the site's inflation message catalogue so the MCP names a group exactly as
 * the page does. A group without both labels stops the build.
 */
async function loadInflationGroups(
  repositoryRoot: string,
  categories: readonly { categoryId: string; coicopCode: string; level: 2 | 3; parentId: string | null }[],
): Promise<InflationGroup[]> {
  const [ka, en] = await Promise.all(
    (["ka", "en"] as const).map(async (locale) =>
      JSON.parse(await readFile(path.join(repositoryRoot, "apps", "web", "lib", "i18n", "messages", locale, "inflation.json"), "utf8")) as Record<string, string>,
    ),
  );
  const byId = new Map(categories.map((fact) => [fact.categoryId, fact]));
  return [...byId.values()]
    .sort((a, b) => (a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0))
    .map((fact) => {
      const key = `inflation.category.${fact.categoryId}`;
      if (!ka[key]?.trim() || !en[key]?.trim()) throw new Error(`Missing reviewed inflation group label: ${fact.categoryId}`);
      return { id: fact.categoryId, coicopCode: fact.coicopCode, level: fact.level === 2 ? "division" : "subgroup", parentId: fact.parentId, labelKa: ka[key], labelEn: en[key] };
    });
}
```

3. In the `labelIds` array, after `...ECONOMIC_SECTORS.map(r=>r.id), "economic-sectors",` add `"inflation",`.

4. Immediately after the `const localization: ServiceLocalization = { ... };` block, add:

```ts
  const inflation = await loadServedInflationData();
  const inflationGroups = await loadInflationGroups(repositoryRoot, inflation.categories);
  Object.assign(localization.labelsEn, Object.fromEntries([
    ...Object.entries(NATIONAL_SERIES).map(([id, series]) => [id, series.labelEn]),
    [TARGET_SERIES_ID, TARGET_SERIES.labelEn],
    [RESIDUAL_SERIES_ID, RESIDUAL_SERIES.labelEn],
    ...inflationGroups.map((group) => [group.id, group.labelEn]),
  ]));
```

5. In the snapshot content object, after the `economicSectors: {...},` line, add:

```ts
    inflation: {
      facts: sortedBy(inflation.facts, (f) => f.seriesId, (f) => f.measure, (f) => f.period),
      targets: sortedBy(inflation.targets, (row) => row.effectiveFrom),
      categories: sortedBy(inflation.categories, (f) => f.categoryId, (f) => f.measure, (f) => f.period),
      weights: sortedBy(inflation.weights, (row) => row.categoryId, (row) => row.year),
      groups: inflationGroups,
    },
```

6. In `data/localization/en/labels.json`, after the `"economic-sectors"` entry, add:

```json
  "inflation": {
    "text": "Consumer price inflation",
    "reviewedAt": "2026-09-14"
  },
```

- [ ] **Step 8: Add inflation to the catalogue**

In `apps/web/lib/factQuery/describeCoverage.ts`:

1. Add imports:

```ts
import { inflationCatalogueSeries, inflationDatasetPeriods } from "./inflationData";
import { INFLATION_MEASURES } from "./inflationSeries";
```

2. Append `"inflation",` to `DATASET_IDS`.
3. In `BaseSeriesEntry`, after `yearsByMeasure?: Record<string, number[]>;` add:

```ts
  periods?: [string, string];
  periodsByMeasure?: Record<string, [string, string]>;
```

4. In `DatasetSummary`, after `measures: Measure[];` add `periods?: [string, string];`.
5. In `DATASET_META`, after the `"economic-sectors"` entry add:

```ts
  inflation: { budgetScope: "consumer_prices", labelKa: "ინფლაცია", entityTypes: ["country"], measures: [...INFLATION_MEASURES] },
```

6. In `buildDatasetSummary`'s switch, after the `"economic-sectors"` case add:

```ts
    case "inflation":
      years = yearRange(inflationCatalogueSeries(snapshot).flatMap((series) => series.years), datasetId);
      break;
```

7. In its returned object, after the `...(datasetId === "economic-sectors" ? {...} : {}),` spread add:

```ts
    ...(datasetId === "inflation" ? { periods: inflationDatasetPeriods(snapshot) } : {}),
```

8. In `baseSeriesForDataset`'s switch, after the `"economic-sectors"` case add:

```ts
    case "inflation":
      return inflationCatalogueSeries(snapshot);
```

- [ ] **Step 9: Narrow sources to inflation**

In `apps/web/lib/factQuery/getSources.ts`:

1. In the `documentDataset` map, after `"economic-sectors": "economic-sectors",` add `inflation: "inflation",`.
2. Replace the `packageSourceIds` tail `: input.datasetId === "economic-sectors" ? snapshot.economicSectors.facts.map(f=>f.sourceId) : [],` with:

```ts
          : input.datasetId === "economic-sectors" ? snapshot.economicSectors.facts.map(f=>f.sourceId)
            : input.datasetId === "inflation"
              ? [...snapshot.inflation.facts, ...snapshot.inflation.targets, ...snapshot.inflation.categories, ...snapshot.inflation.weights].map((row) => row.sourceId)
              : [],
```

- [ ] **Step 10: Declare the new catalogue fields**

In `apps/web/lib/mcp/outputSchema.ts`, in `dataShapes.catalogue`:
- in the `datasets` object, after `measures: z.array(z.string()),` add `periods: z.tuple([z.string(), z.string()]).optional(),`
- in the `series` object, after `yearsByMeasure: z.record(z.string(), z.array(z.number())).optional(),` add `periods: z.tuple([z.string(), z.string()]).optional(), periodsByMeasure: z.record(z.string(), z.tuple([z.string(), z.string()])).optional(),`

- [ ] **Step 11: Run tests to verify they pass**

Run: `npx vitest run tests/factQuery/inflationCatalogue.test.ts tests/factQuery/describeCoverage.test.ts tests/factQuery/getSources.test.ts tests/factQuery/purity.test.ts tests/factQuery/buildSnapshot.test.ts`
Then: `npm run typecheck`
Expected: PASS. If `describeCoverage.test.ts` or `buildSnapshot.test.ts` pin the dataset list or a label count, add `"inflation"` after `"economic-sectors"` in that one expectation and change nothing else.

- [ ] **Step 12: Commit**

```bash
git add apps/web/lib/factQuery/inflationSeries.ts apps/web/lib/factQuery/inflationData.ts apps/web/lib/factQuery/types.ts apps/web/lib/factQuery/observations.ts apps/web/lib/factQuery/schemas.ts apps/web/lib/factQuery/buildSnapshot.ts apps/web/lib/factQuery/describeCoverage.ts apps/web/lib/factQuery/getSources.ts apps/web/lib/mcp/outputSchema.ts data/localization/en/labels.json apps/web/tests/factQuery
git commit -m "feat(mcp): make inflation discoverable in the fact-query catalogue" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 2: Inflation service messages and caveat rules

Registers the four inflation caveats with bilingual messages, lets a caveat name one month rather than a whole year, and adds every message later tasks need.

**Files:**
- Modify: `data/localization/en/service-messages.json`, `data/localization/ka/service-messages.json`
- Modify: `apps/web/lib/factQuery/localization.ts` (SERVICE_MESSAGE_KEYS, SERVICE_MESSAGE_PARAMETERS)
- Create: `apps/web/lib/factQuery/caveats/rules.inflation.ts`
- Modify: `apps/web/lib/factQuery/caveats/index.ts`
- Modify: `apps/web/lib/factQuery/caveats/engine.ts` (CaveatContext observation `period`)
- Modify: `apps/web/lib/factQuery/observations.ts` (caveatIdsForObservation, countryLevelCaveatContext)
- Modify: `docs/data-methodology/ai-grounding-and-caveats.md`
- Modify: `apps/web/tests/factQuery/caveats/engine.test.ts`, `apps/web/tests/factQuery/bilingualEvidence.test.ts`
- Test: `apps/web/tests/factQuery/caveats/inflationRules.test.ts`

**Interfaces:**
- Consumes: `RESIDUAL_SERIES_ID`, `TARGET_SERIES_ID` (Task 1).
- Produces: caveat codes `inflation_contribution_derived` (severe, `none`), `inflation_contribution_residual` (note, `none`), `inflation_contribution_weights_differ` (note, `limits`), `inflation_target_unverified_before_2015` (note, `none`). Each affects `${seriesId}:${period}`.
- Produces: `caveatIdsForObservation(caveats, { entityId, seriesId, year, period?, measure })` also matches `${seriesId}:${period}`.
- Produces: `countryLevelCaveatContext(datasetId, measure, years, seriesIds, observations, comparison = null)`.
- Produces message keys: `caveats.inflation_contribution_derived`, `caveats.inflation_contribution_residual`, `caveats.inflation_contribution_weights_differ`, `caveats.inflation_target_unverified_before_2015`, `comparison.basketReweighted`, `errors.contributionMixedLevels`, `errors.periodRangeReversed`, `errors.periodsOutOfRange` {first, last, outOfRangePeriods}, `missing.inflationContribution`, `missing.inflationContributionStart` {firstYear}, `missing.inflationMonth`, `missing.inflationResidualHeadline`, `missing.inflationTargetUnverified`, `missing.inflationWeight`, `ranking.changeDefinitionPeriod` {fromPeriod, measure, metric, order, toPeriod}, `ranking.inflationDivisions`, `ranking.inflationSubgroups`, `ranking.inflationSubgroupsWithinParent` {parentId}, `ranking.valueDefinitionPeriod` {measure, order, period}.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/factQuery/caveats/inflationRules.test.ts`:

```ts
// apps/web/tests/factQuery/caveats/inflationRules.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import { CAVEAT_RULES, evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats";
import { caveatIdsForObservation } from "../../../lib/factQuery/observations";
import type { FactQuerySnapshot, Measure } from "../../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

type Cell = { seriesId: string; period: string; value: number | null };

function context(measure: Measure, cells: Cell[], comparison: CaveatContext["comparison"] = null): CaveatContext {
  return {
    datasetId: "inflation",
    measure,
    years: [...new Set(cells.map((cell) => Number(cell.period.slice(0, 4))))],
    seriesIds: [...new Set(cells.map((cell) => cell.seriesId))],
    entityIds: ["country.georgia"],
    observations: cells.map((cell) => ({
      entityId: "country.georgia",
      seriesId: cell.seriesId,
      level: "division",
      parentSeriesId: null,
      year: Number(cell.period.slice(0, 4)),
      period: cell.period,
      value: cell.value,
      basis: cell.value === null ? null : "published",
      valueDefinitionId: `inflation:${measure}`,
    })),
    municipalTotalInputs: [],
    municipalInputServedBy: {},
    gdpInputs: [],
    comparison,
    historicalJoinSeriesYears: [],
    adminCategoryYears: [],
  };
}

const codes = (c: CaveatContext) => evaluateCaveats(snapshot, c, CAVEAT_RULES).map((caveat) => caveat.code);

describe("inflation caveat rules", () => {
  it("marks each contribution as derived and the residual as a residual, per month", () => {
    const caveats = evaluateCaveats(
      snapshot,
      context("contribution_pp", [
        { seriesId: "cpi.cat.07", period: "2026-08", value: 1.7 },
        { seriesId: "cpi.contribution_residual", period: "2026-08", value: 0.1 },
      ]),
      CAVEAT_RULES,
    );
    expect(caveats.map((caveat) => caveat.code)).toEqual(["inflation_contribution_derived", "inflation_contribution_residual"]);
    expect(caveats[0]!.severity).toBe("severe");
    expect(caveats[0]!.affects).toEqual(["cpi.cat.07:2026-08"]);
    expect(caveatIdsForObservation(caveats, { entityId: "country.georgia", seriesId: "cpi.cat.07", year: 2026, period: "2026-08", measure: "contribution_pp" })).toEqual(["inflation_contribution_derived"]);
    expect(caveatIdsForObservation(caveats, { entityId: "country.georgia", seriesId: "cpi.cat.07", year: 2026, period: "2026-07", measure: "contribution_pp" })).toEqual([]);
  });

  it("says nothing about a published price change", () => {
    expect(codes(context("yoy_pct", [{ seriesId: "cpi.cat.07", period: "2026-08", value: 15.1989 }]))).toEqual([]);
  });

  it("limits a contribution comparison only across calendar years", () => {
    const cells = [
      { seriesId: "cpi.cat.07", period: "2025-12", value: 1.2 },
      { seriesId: "cpi.cat.07", period: "2026-01", value: 1.3 },
    ];
    expect(codes(context("contribution_pp", cells, { fromYear: 2025, toYear: 2026 }))).toContain("inflation_contribution_weights_differ");
    expect(codes(context("contribution_pp", cells, { fromYear: 2026, toYear: 2026 }))).not.toContain("inflation_contribution_weights_differ");
  });

  it("calls a missing early target unverified, and says nothing once a target is in force", () => {
    expect(codes(context("target_pct", [{ seriesId: "cpi.target", period: "2014-06", value: null }]))).toEqual(["inflation_target_unverified_before_2015"]);
    expect(codes(context("target_pct", [{ seriesId: "cpi.target", period: "2026-08", value: 3 }]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/factQuery/caveats/inflationRules.test.ts`
Expected: FAIL — no inflation rule fires (`[]` instead of the expected codes) and `period` is not a known observation field.

- [ ] **Step 3: Add the service messages**

Add these entries to `data/localization/en/service-messages.json` (key order in the file does not matter):

```json
  "caveats.inflation_contribution_derived": "Contributions are Fiscal.ge's approximation from Geostat's published price changes and basket weights, not a figure Geostat publishes.",
  "caveats.inflation_contribution_residual": "The residual is the published headline minus the requested groups' contributions: everything not requested plus approximation error, not a category of goods.",
  "caveats.inflation_contribution_weights_differ": "The consumer basket is re-weighted every January, so contributions in different years rest on different weights.",
  "caveats.inflation_target_unverified_before_2015": "No earlier numeric inflation target is verified in the reviewed sources; this does not mean none existed.",
  "comparison.basketReweighted": "The consumer basket is re-weighted between these months, so the two contributions rest on different weights.",
  "errors.contributionMixedLevels": "Contributions cannot mix divisions and subgroups: subgroups are parts of divisions, so their sum would count them twice.",
  "errors.periodRangeReversed": "fromPeriod must not be later than toPeriod.",
  "errors.periodsOutOfRange": "Requested period(s) {outOfRangePeriods} fall outside this measure's coverage ({first} to {last}).",
  "missing.inflationContribution": "No contribution can be derived for this month: the group's year-on-year change or its basket weight is not published.",
  "missing.inflationContributionStart": "Contributions are derived only from {firstYear}; earlier basket weights reconstruct the headline too poorly to publish.",
  "missing.inflationMonth": "No value is published for this series in this month; this does not mean zero.",
  "missing.inflationResidualHeadline": "The published headline is not available for this month, so no residual can be derived.",
  "missing.inflationTargetUnverified": "No numeric inflation target for this month is verified in the reviewed sources; this does not mean none existed.",
  "missing.inflationWeight": "No basket weight is published for this group in this year.",
  "ranking.changeDefinitionPeriod": "Ranked by {metric} ({measure}), {fromPeriod}→{toPeriod}, {order}.",
  "ranking.inflationDivisions": "COICOP divisions of the national consumer price index; the headline, the target and the residual are excluded.",
  "ranking.inflationSubgroups": "COICOP subgroups of the national consumer price index.",
  "ranking.inflationSubgroupsWithinParent": "COICOP subgroups within {parentId}.",
  "ranking.valueDefinitionPeriod": "Ranked by {measure} in {period}, {order}.",
```

Add these entries to `data/localization/ka/service-messages.json`:

```json
  "caveats.inflation_contribution_derived": "წვლილები Fiscal.ge-ის მიახლოებითი გაანგარიშებაა საქსტატის გამოქვეყნებული ფასების ცვლილებებიდან და კალათის წილებიდან; საქსტატი ამ მაჩვენებელს არ აქვეყნებს.",
  "caveats.inflation_contribution_residual": "დანარჩენი = გამოქვეყნებული საერთო ინფლაცია გამოკლებული მოთხოვნილი ჯგუფების წვლილი: ყველაფერი, რაც არ მოითხოვეთ, და მიახლოების ცდომილება; ეს საქონლის კატეგორია არ არის.",
  "caveats.inflation_contribution_weights_differ": "სამომხმარებლო კალათის წილები ყოველ იანვარში განახლდება, ასე რომ სხვადასხვა წლის წვლილები სხვადასხვა წილებს ეყრდნობა.",
  "caveats.inflation_target_unverified_before_2015": "გადამოწმებულ წყაროებში ადრეული ინფლაციის მიზნობრივი მაჩვენებელი დადასტურებული არ არის; ეს არ ნიშნავს, რომ ის არ არსებობდა.",
  "comparison.basketReweighted": "ამ თვეებს შორის სამომხმარებლო კალათის წილები განახლდა, ასე რომ ორი წვლილი სხვადასხვა წილებს ეყრდნობა.",
  "errors.contributionMixedLevels": "წვლილებში განყოფილებები და ქვეჯგუფები არ ერთიანდება: ქვეჯგუფები განყოფილებების ნაწილია, და ჯამი მათ ორჯერ დაითვლის.",
  "errors.periodRangeReversed": "fromPeriod არ უნდა იყოს toPeriod-ზე გვიან.",
  "errors.periodsOutOfRange": "მოთხოვნილი პერიოდ(ებ)ი {outOfRangePeriods} სცილდება ამ მაჩვენებლის დაფარვას ({first}–{last}).",
  "missing.inflationContribution": "ამ თვისთვის წვლილი არ გაანგარიშდება: ჯგუფის წლიური ცვლილება ან კალათის წილი გამოქვეყნებული არ არის.",
  "missing.inflationContributionStart": "წვლილები გაანგარიშებულია მხოლოდ {firstYear} წლიდან; ადრეული წილები საერთო ინფლაციას ზედმეტად უზუსტოდ აღადგენს.",
  "missing.inflationMonth": "ამ სერიისთვის ამ თვეში მნიშვნელობა გამოქვეყნებული არ არის — ეს ნულს არ ნიშნავს.",
  "missing.inflationResidualHeadline": "ამ თვისთვის გამოქვეყნებული საერთო ინფლაცია არ არის, ასე რომ დანარჩენი არ გაანგარიშდება.",
  "missing.inflationTargetUnverified": "გადამოწმებულ წყაროებში ამ თვის ინფლაციის რიცხობრივი მიზნობრივი მაჩვენებელი დადასტურებული არ არის; ეს არ ნიშნავს, რომ ის არ არსებობდა.",
  "missing.inflationWeight": "ამ ჯგუფისთვის ამ წელს კალათის წილი გამოქვეყნებული არ არის.",
  "ranking.changeDefinitionPeriod": "დალაგება ცვლილებით {metric} ({measure}), {fromPeriod}→{toPeriod}, {order}.",
  "ranking.inflationDivisions": "ეროვნული სამომხმარებლო ფასების ინდექსის COICOP განყოფილებები; საერთო ინფლაცია, მიზნობრივი მაჩვენებელი და დანარჩენი არ მონაწილეობს.",
  "ranking.inflationSubgroups": "ეროვნული სამომხმარებლო ფასების ინდექსის COICOP ქვეჯგუფები.",
  "ranking.inflationSubgroupsWithinParent": "COICOP ქვეჯგუფები განყოფილებაში {parentId}.",
  "ranking.valueDefinitionPeriod": "დალაგება მაჩვენებლით {measure}, {period}, {order}.",
```

- [ ] **Step 4: Register the keys and their parameters**

In `apps/web/lib/factQuery/localization.ts`, in `SERVICE_MESSAGE_KEYS` (kept alphabetical):
- after `"caveats.gdp_world_bank_history",` add the four `"caveats.inflation_*"` keys above, in the order listed;
- after `"comparison.basisDiffers",` add `"comparison.basketReweighted",`;
- before `"errors.dataVersionChanged",` add `"errors.contributionMixedLevels",`;
- after `"errors.measureSeriesMismatch",` add `"errors.periodRangeReversed",` and `"errors.periodsOutOfRange",`;
- after `"missing.gdpDenominator",` add `"missing.inflationContribution",`, `"missing.inflationContributionStart",`, `"missing.inflationMonth",`, `"missing.inflationResidualHeadline",`, `"missing.inflationTargetUnverified",`, `"missing.inflationWeight",`;
- after `"ranking.changeDefinition",` add `"ranking.changeDefinitionPeriod",`;
- after `"ranking.descending",` add `"ranking.inflationDivisions",`, `"ranking.inflationSubgroups",`, `"ranking.inflationSubgroupsWithinParent",`;
- after `"ranking.valueDefinition",` add `"ranking.valueDefinitionPeriod",`.

Add these entries to the `SERVICE_MESSAGE_PARAMETERS` object:

```ts
  "errors.periodsOutOfRange": { ka: ["first", "last", "outOfRangePeriods"], en: ["first", "last", "outOfRangePeriods"] },
  "missing.inflationContributionStart": { ka: ["firstYear"], en: ["firstYear"] },
  "ranking.changeDefinitionPeriod": { ka: ["fromPeriod", "measure", "metric", "order", "toPeriod"], en: ["fromPeriod", "measure", "metric", "order", "toPeriod"] },
  "ranking.inflationSubgroupsWithinParent": { ka: ["parentId"], en: ["parentId"] },
  "ranking.valueDefinitionPeriod": { ka: ["measure", "order", "period"], en: ["measure", "order", "period"] },
```

- [ ] **Step 5: Let caveats name a month**

In `apps/web/lib/factQuery/caveats/engine.ts`, in the `CaveatContext.observations` element type, replace:

```ts
    year: number;
    value: number | null;
```

with:

```ts
    year: number;
    /** Monthly observations only (inflation), YYYY-MM. */
    period?: string;
    value: number | null;
```

In `apps/web/lib/factQuery/observations.ts`:

1. Change the `caveatIdsForObservation` parameter type to `observation: { entityId: string; seriesId: string; year: number; period?: string; measure: Measure }`, and in its filter, directly before `caveat.affects.includes(seriesYear) ||`, add:

```ts
        (observation.period !== undefined && caveat.affects.includes(`${observation.seriesId}:${observation.period}`)) ||
```

2. Replace `countryLevelCaveatContext`'s signature and `comparison: null,` so it reads:

```ts
export function countryLevelCaveatContext(
  datasetId: DatasetId,
  measure: Measure,
  years: number[],
  seriesIds: string[],
  observations: readonly Observation[],
  comparison: CaveatContext["comparison"] = null,
): CaveatContext {
```

and inside the returned object `comparison,` instead of `comparison: null,`.

- [ ] **Step 6: Write the rules**

Create `apps/web/lib/factQuery/caveats/rules.inflation.ts`:

```ts
// apps/web/lib/factQuery/caveats/rules.inflation.ts
//
// Four rules, all gated on the inflation dataset and scoped to single months.
// Facts true of every inflation answer (the index is a weighted mean of city
// indices; percentages are percentages) live in the server instructions, not
// here, for the reason nominal_gel was retired: a caveat on every answer
// teaches a client to ignore caveats.
import { RESIDUAL_SERIES_ID, TARGET_SERIES_ID } from "../inflationSeries";
import type { CaveatContext, CaveatRule } from "./engine";

const DATASET_ID = "inflation";
const OWNER = "inflation-cpi-national.md";
const OWNER_EN = "/en/methodology/inflation";

type Cell = CaveatContext["observations"][number];
const cellKey = (cell: Cell) => `${cell.seriesId}:${cell.period ?? cell.year}`;

const contributionCells = (c: CaveatContext) =>
  c.measure === "contribution_pp" ? c.observations.filter((o) => o.seriesId !== RESIDUAL_SERIES_ID && o.value !== null) : [];
const residualCells = (c: CaveatContext) => c.observations.filter((o) => o.seriesId === RESIDUAL_SERIES_ID);
const targetGaps = (c: CaveatContext) => c.observations.filter((o) => o.seriesId === TARGET_SERIES_ID && o.value === null);

export const INFLATION_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "inflation_contribution_derived",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.inflation_contribution_derived",
    methodologyRef: OWNER,
    methodologyRefEn: OWNER_EN,
    // Severe: presented as a Geostat figure, a contribution is a false provenance claim.
    applies: (c) => c.datasetId === DATASET_ID && contributionCells(c).length > 0,
    affects: (c) => contributionCells(c).map(cellKey),
  },
  {
    code: "inflation_contribution_residual",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.inflation_contribution_residual",
    methodologyRef: OWNER,
    methodologyRefEn: OWNER_EN,
    applies: (c) => c.datasetId === DATASET_ID && residualCells(c).length > 0,
    affects: (c) => residualCells(c).map(cellKey),
  },
  {
    code: "inflation_contribution_weights_differ",
    severity: "note",
    // The basket is re-weighted each January: usable, but not like-for-like.
    comparisonEffect: "limits",
    messageKey: "caveats.inflation_contribution_weights_differ",
    methodologyRef: OWNER,
    methodologyRefEn: OWNER_EN,
    applies: (c) => c.datasetId === DATASET_ID && c.comparison !== null && c.comparison.fromYear !== c.comparison.toYear && contributionCells(c).length > 0,
    affects: (c) => contributionCells(c).map(cellKey),
  },
  {
    code: "inflation_target_unverified_before_2015",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.inflation_target_unverified_before_2015",
    methodologyRef: OWNER,
    methodologyRefEn: OWNER_EN,
    // A missing target month exists only before the first reviewed target, which carries forward.
    applies: (c) => c.datasetId === DATASET_ID && targetGaps(c).length > 0,
    affects: (c) => targetGaps(c).map(cellKey),
  },
];
```

In `apps/web/lib/factQuery/caveats/index.ts`, add `import { INFLATION_CAVEAT_RULES } from "./rules.inflation";` and append `...INFLATION_CAVEAT_RULES,` after `...SECTORS_CAVEAT_RULES,`. Extend the doc comment's last sentence to: `The GDP overview and economic sectors add two and one, registered on 2026-09-14 after shipping inline, and inflation adds four; the GDP overview's preliminary cells share gdp_preliminary.` (keep the sentence about the count being asserted against the grounding doc).

- [ ] **Step 7: Update the pinned registry tests**

In `apps/web/tests/factQuery/caveats/engine.test.ts`, change `toHaveLength(33)` to `toHaveLength(37)` and after `expect(codes).toContain("sectors_preliminary");` add:

```ts
    expect(codes).toContain("inflation_contribution_derived");
    expect(codes).toContain("inflation_contribution_residual");
    expect(codes).toContain("inflation_contribution_weights_differ");
    expect(codes).toContain("inflation_target_unverified_before_2015");
```

In `apps/web/tests/factQuery/bilingualEvidence.test.ts`, change the allowed-reference pattern's alternation `debt|gdp|economic-sectors` to `debt|gdp|economic-sectors|inflation`.

- [ ] **Step 8: Document the codes**

In `docs/data-methodology/ai-grounding-and-caveats.md`:

1. Replace `33 codes are registered.` with `37 codes are registered.`
2. After the table row ``| `sectors_preliminary` | note | `none` | `economic-sectors.md` |`` add:

```markdown
| `inflation_contribution_derived` | severe | `none` | `inflation-cpi-national.md` |
| `inflation_contribution_residual` | note | `none` | `inflation-cpi-national.md` |
| `inflation_contribution_weights_differ` | note | `limits` | `inflation-cpi-national.md` |
| `inflation_target_unverified_before_2015` | note | `none` | `inflation-cpi-national.md` |
```

3. After the paragraph ending `which would have become false the day Geostat finalised that year.` add the four sections below. The Georgian and English lines must equal the service messages from Step 3 exactly (`documented.test.ts` checks this):

```markdown
### `inflation_contribution_derived`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `inflation-cpi-national.md`

**Trigger.** Any returned `contribution_pp` cell of a COICOP group.

**Georgian.** წვლილები Fiscal.ge-ის მიახლოებითი გაანგარიშებაა საქსტატის გამოქვეყნებული ფასების ცვლილებებიდან და კალათის წილებიდან; საქსტატი ამ მაჩვენებელს არ აქვეყნებს.

**English.** Contributions are Fiscal.ge's approximation from Geostat's published price changes and basket weights, not a figure Geostat publishes.

Severe because the failure is provenance: a contribution quoted as a Geostat statistic claims a publication that does not exist. The arithmetic is the site's own `buildContributionIndex`, and the approximation it carries is measured in `inflation-cpi-national.md`.

### `inflation_contribution_residual`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `inflation-cpi-national.md`

**Trigger.** The residual series is returned, which happens on every contribution request.

**Georgian.** დანარჩენი = გამოქვეყნებული საერთო ინფლაცია გამოკლებული მოთხოვნილი ჯგუფების წვლილი: ყველაფერი, რაც არ მოითხოვეთ, და მიახლოების ცდომილება; ეს საქონლის კატეგორია არ არის.

**English.** The residual is the published headline minus the requested groups' contributions: everything not requested plus approximation error, not a category of goods.

The residual changes with the selection, so it is never a candidate in a ranking or a target of a comparison.

### `inflation_contribution_weights_differ`

**Severity:** note  
**Comparison effect:** `limits`  
**Owner document:** `inflation-cpi-national.md`

**Trigger.** A contribution comparison whose two months fall in different calendar years.

**Georgian.** სამომხმარებლო კალათის წილები ყოველ იანვარში განახლდება, ასე რომ სხვადასხვა წლის წვლილები სხვადასხვა წილებს ეყრდნობა.

**English.** The consumer basket is re-weighted every January, so contributions in different years rest on different weights.

Within one calendar year the weights are identical and the comparison is comparable; across a January it is reported as limited rather than declined.

### `inflation_target_unverified_before_2015`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `inflation-cpi-national.md`

**Trigger.** A target cell before the first reviewed target month is returned missing.

**Georgian.** გადამოწმებულ წყაროებში ადრეული ინფლაციის მიზნობრივი მაჩვენებელი დადასტურებული არ არის; ეს არ ნიშნავს, რომ ის არ არსებობდა.

**English.** No earlier numeric inflation target is verified in the reviewed sources; this does not mean none existed.

A secondary lead shows 6% for 2010–2014, but no primary National Bank document was archived for those years, so the months stay missing. Reporting "Georgia had no target" would state something the sources do not.
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/factQuery/caveats tests/factQuery/bilingualEvidence.test.ts tests/factQuery/localization.test.ts`
Then: `npm run i18n:check && npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add data/localization apps/web/lib/factQuery/localization.ts apps/web/lib/factQuery/caveats apps/web/lib/factQuery/observations.ts docs/data-methodology/ai-grounding-and-caveats.md apps/web/tests/factQuery
git commit -m "feat(mcp): register inflation caveats and service messages" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 3: `query_inflation` over MCP

Adds the one implementation of an inflation cell (`inflationObservations`), the public `queryInflation`, and registers `query_inflation` as the twelfth MCP tool with its instructions and cell gate.

**Files:**
- Modify: `apps/web/lib/factQuery/schemas.ts` (queryInflationInput)
- Create: `apps/web/lib/factQuery/queryInflation.ts`
- Modify: `apps/web/lib/factQuery/index.ts`
- Modify: `apps/web/lib/mcp/tools.ts`, `apps/web/lib/mcp/instructions.ts`, `apps/web/lib/mcp/outputSchema.ts`
- Modify: `apps/web/tests/factQuery/caveats/registered.test.ts`, `apps/web/tests/mcp/tools.test.ts`, `apps/web/tests/mcp/route.test.ts`, `apps/web/tests/mcp/bilingualTransport.test.ts`
- Test: `apps/web/tests/factQuery/queryInflation.test.ts`

**Interfaces:**
- Consumes: Task 1 (`inflationSeries.ts`, `inflationData.ts`, `periodKeySchema`), Task 2 (messages, rules, `countryLevelCaveatContext(..., comparison)`).
- Produces (`queryInflation.ts`):
  - `type InflationRequest = { seriesIds: string[]; measure: string; periods?: string[]; years?: number[] }` — `periods` for monthly measures, `years` for `basket_weight_pct`.
  - `type InflationOptions = { includeResidual: boolean; comparison?: CaveatContext["comparison"] }`.
  - `inflationObservations(snapshot, request, options): FactQueryResponse` — used by Tasks 4, 5, 6.
  - `queryInflation(snapshot, rawInput): FactQueryResponse`.
  - `inflationCellCount(input: { seriesIds?; measure?; fromPeriod?; toPeriod? }): number`.
- Produces (`schemas.ts`): `queryInflationInput = z.strictObject({ seriesIds, measure: z.enum(INFLATION_MEASURES), fromPeriod, toPeriod, expectedDataVersion })`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/factQuery/queryInflation.test.ts`:

```ts
// apps/web/tests/factQuery/queryInflation.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { periodFromKey } from "../../lib/data/inflation/periods";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { contributionIndex } from "../../lib/factQuery/inflationData";
import type { Observation } from "../../lib/factQuery/observations";
import { inflationCellCount, queryInflation } from "../../lib/factQuery/queryInflation";
import { errorCodeSchema, observationSchema } from "../../lib/factQuery/schemas";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

function rows(response: FactQueryResponse): Observation[] {
  if (response.kind !== "observations") throw new Error(JSON.stringify(response));
  return (response.data as { observations: Observation[] }).observations;
}

function errorOf(response: FactQueryResponse) {
  if (response.kind !== "error") throw new Error(`expected an error, got ${response.kind}`);
  expect(errorCodeSchema.options).toContain(response.error.code);
  return response.error;
}

const headlineYoy = (period: string) =>
  snapshot.inflation.facts.find((f) => f.seriesId === "cpi.headline" && f.measure === "yoy_pct" && f.period === period)!.value;

describe("queryInflation", () => {
  it("returns a published monthly value with its period, unit and evidence", () => {
    const [row] = rows(queryInflation(snapshot, { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }));
    observationSchema.parse(row);
    expect(row).toMatchObject({
      observationId: "inflation:country.georgia:cpi.headline:2026-08:yoy_pct",
      datasetId: "inflation",
      period: "2026-08",
      year: 2026,
      value: 5.6479,
      unit: "percent",
      basis: "published",
      sourceIds: ["source.geostat_cpi_yoy"],
    });
    expect(row!.documentIds.length).toBeGreaterThan(0);
  });

  it("returns one basket weight per calendar year the range touches, without a period", () => {
    const weights = rows(queryInflation(snapshot, { seriesIds: ["cpi.cat.01"], measure: "basket_weight_pct", fromPeriod: "2024-06", toPeriod: "2025-02" }));
    expect(weights.map((row) => row.year)).toEqual([2024, 2025]);
    expect(weights.every((row) => row.period === undefined)).toBe(true);
    for (const row of weights) {
      expect(row.value).toBe(snapshot.inflation.weights.find((w) => w.categoryId === "cpi.cat.01" && w.year === row.year)!.weightPct);
    }
  });

  it("rejects a measure the series does not publish, naming the valid ones", () => {
    const error = errorOf(queryInflation(snapshot, { seriesIds: ["cpi.core"], measure: "index_2010", fromPeriod: "2026-08", toPeriod: "2026-08" }));
    expect(error.code).toBe("unsupported_measure");
    expect(error.validChoices).toEqual(["mom_pct", "yoy_pct"]);
  });

  it("does not accept the residual or an unknown group as a series", () => {
    for (const seriesId of ["cpi.contribution_residual", "cpi.cat.99"]) {
      const error = errorOf(queryInflation(snapshot, { seriesIds: [seriesId], measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" }));
      expect(error.code).toBe("unknown_series");
      expect(error.validChoices).toContain("cpi.cat.07");
      expect(error.validChoices).not.toContain("cpi.contribution_residual");
    }
  });

  it("reports the target before its first reviewed month as unverified, never zero", () => {
    const [early] = rows(queryInflation(snapshot, { seriesIds: ["cpi.target"], measure: "target_pct", fromPeriod: "2014-06", toPeriod: "2014-06" }));
    expect(early).toMatchObject({ value: null, availability: "missing", caveatIds: ["inflation_target_unverified_before_2015"] });
    expect(early!.missingReasonEn).toContain("does not mean none existed");
    const [current] = rows(queryInflation(snapshot, { seriesIds: ["cpi.target"], measure: "target_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }));
    const inForce = snapshot.inflation.targets.find((t) => t.effectiveFrom <= "2026-08" && (t.effectiveTo === null || "2026-08" <= t.effectiveTo))!;
    expect(current!.value).toBe(inForce.targetPct);
  });

  it("closes division contributions on the published headline with a residual", () => {
    const divisions = snapshot.inflation.groups.filter((g) => g.level === "division").map((g) => g.id);
    const response = queryInflation(snapshot, { seriesIds: divisions, measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" });
    const cells = rows(response);
    expect(cells).toHaveLength(13);
    const residual = cells.at(-1)!;
    expect(residual).toMatchObject({ seriesId: "cpi.contribution_residual", level: "residual", unit: "percentage_points", caveatIds: ["inflation_contribution_residual"] });
    const sum = cells.reduce((total, row) => total + row.value!, 0);
    expect(Math.abs(sum - headlineYoy("2026-08"))).toBeLessThan(1e-9);
    expect(cells.slice(0, 12).every((row) => row.caveatIds.includes("inflation_contribution_derived"))).toBe(true);
    expect(response.meta.caveats[0]!.severity).toBe("severe");
  });

  it("serves exactly the site's contribution arithmetic", () => {
    const divisions = snapshot.inflation.groups.filter((g) => g.level === "division").map((g) => g.id);
    const cells = rows(queryInflation(snapshot, { seriesIds: divisions, measure: "contribution_pp", fromPeriod: "2013-01", toPeriod: "2013-12" }));
    const index = contributionIndex(snapshot);
    for (const row of cells.filter((cell) => cell.seriesId !== "cpi.contribution_residual" && cell.value !== null)) {
      expect(row.value).toBe(index.get(row.seriesId)!.get(periodFromKey(row.period!)));
    }
  });

  it("refuses contributions that mix divisions and subgroups", () => {
    const error = errorOf(queryInflation(snapshot, { seriesIds: ["cpi.cat.01", "cpi.cat.01_1"], measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" }));
    expect(error.code).toBe("invalid_parameters");
  });

  it("explains a contribution before contributions begin", () => {
    const [row] = rows(queryInflation(snapshot, { seriesIds: ["cpi.cat.01"], measure: "contribution_pp", fromPeriod: "2012-06", toPeriod: "2012-06" }));
    expect(row).toMatchObject({ value: null, availability: "missing" });
    expect(row!.missingReasonEn).toContain("2013");
  });

  it("refuses a reversed or out-of-range request", () => {
    expect(errorOf(queryInflation(snapshot, { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-01" })).code).toBe("invalid_parameters");
    expect(errorOf(queryInflation(snapshot, { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "1999-12", toPeriod: "2004-01" })).code).toBe("year_out_of_range");
  });

  it("counts cells before any work", () => {
    expect(inflationCellCount({ seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2024-01", toPeriod: "2025-12" })).toBe(24);
    expect(inflationCellCount({ seriesIds: Array.from({ length: 12 }, (_, i) => `d${i}`), measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" })).toBe(13);
    expect(inflationCellCount({ seriesIds: ["cpi.cat.01"], measure: "basket_weight_pct", fromPeriod: "2024-06", toPeriod: "2025-02" })).toBe(2);
    expect(inflationCellCount({ seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "bad", toPeriod: "2025-02" })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/factQuery/queryInflation.test.ts`
Expected: FAIL — cannot resolve `../../lib/factQuery/queryInflation`.

- [ ] **Step 3: Add the input schema**

In `apps/web/lib/factQuery/schemas.ts`, add `import { INFLATION_MEASURES } from "./inflationSeries";` and, after `queryEconomicSectorsInput`, add:

```ts
export const inflationMeasure = z.enum(INFLATION_MEASURES);
export const queryInflationInput = z.strictObject({
  seriesIds: seriesIdList,
  measure: inflationMeasure,
  fromPeriod: periodKeySchema.describe("First month, YYYY-MM, inclusive."),
  toPeriod: periodKeySchema.describe("Last month, YYYY-MM, inclusive. basket_weight_pct returns one cell per calendar year the range touches."),
  expectedDataVersion,
});
```

- [ ] **Step 4: Write the query module**

Create `apps/web/lib/factQuery/queryInflation.ts`:

```ts
// apps/web/lib/factQuery/queryInflation.ts
//
// Monthly national CPI, the NBG target, COICOP group price changes, annual
// basket weights and Fiscal.ge-derived contributions
// (docs/superpowers/specs/2026-09-14-inflation-mcp-design.md).
//
// inflationObservations is the one implementation of an inflation cell:
// queryInflation, compare, rank and the publications all call it, so a figure
// cannot differ between an answer, a comparison and a download.
import { CONTRIBUTION_FIRST_YEAR } from "../data/inflation/contributions";
import { periodFromKey } from "../data/inflation/periods";
import { CAVEAT_RULES, evaluateCaveats, type CaveatContext } from "./caveats";
import { contributionIndex, measurePeriodRange, periodsBetween, weightYearRange, yearOfPeriod, type PeriodRange } from "./inflationData";
import {
  GROUP_MEASURES,
  INFLATION_DATASET_ID,
  INFLATION_DEFINITIONS,
  INFLATION_ENTITY_ID,
  INFLATION_MEASURES,
  INFLATION_MEASURE_UNITS,
  NATIONAL_SERIES,
  RESIDUAL_SERIES,
  RESIDUAL_SERIES_ID,
  TARGET_SERIES,
  TARGET_SERIES_ID,
  type InflationMeasure,
} from "./inflationSeries";
import { serviceMessage, type ServiceMessageKey } from "./localization";
import { buildResponseMeta } from "./meta";
import { buildObservationId, caveatIdsForObservation, countryLevelCaveatContext, resolveDocumentIds, type Observation } from "./observations";
import { queryInflationInput } from "./schemas";
import { selectSources } from "./sources";
import type { FactQueryError, FactQueryResponse, FactQuerySnapshot } from "./types";

export type InflationRequest = { seriesIds: string[]; measure: string; periods?: string[]; years?: number[] };
export type InflationOptions = { includeResidual: boolean; comparison?: CaveatContext["comparison"] };

type SeriesInfo = { labelKa: string; labelEn: string; level: string; parentSeriesId: string | null; measures: readonly string[] };
type Cell = { value: number | null; sourceIds: string[]; missingKey?: ServiceMessageKey; missingValues?: Record<string, string | number> };
type RawCell = { seriesId: string; info: SeriesInfo; key: string; cell: Cell };

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

function bilingual(snapshot: FactQuerySnapshot, key: ServiceMessageKey, values: Record<string, string | number> = {}) {
  return { messageKa: serviceMessage(snapshot, "ka", key, values), messageEn: serviceMessage(snapshot, "en", key, values) };
}

function seriesInfo(snapshot: FactQuerySnapshot, seriesId: string): SeriesInfo | undefined {
  if (Object.hasOwn(NATIONAL_SERIES, seriesId)) {
    const series = NATIONAL_SERIES[seriesId as keyof typeof NATIONAL_SERIES];
    return { labelKa: series.labelKa, labelEn: series.labelEn, level: "national", parentSeriesId: null, measures: series.measures };
  }
  if (seriesId === TARGET_SERIES_ID) return { ...TARGET_SERIES, level: "reference", parentSeriesId: null };
  const group = snapshot.inflation.groups.find((candidate) => candidate.id === seriesId);
  return group === undefined
    ? undefined
    : { labelKa: group.labelKa, labelEn: group.labelEn, level: group.level, parentSeriesId: group.parentId, measures: GROUP_MEASURES };
}

function requestableSeriesIds(snapshot: FactQuerySnapshot): string[] {
  return [...Object.keys(NATIONAL_SERIES), TARGET_SERIES_ID, ...snapshot.inflation.groups.map((group) => group.id)].sort();
}

const yearsBetween = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, index) => first + index);

/** Cells a query_inflation call would return, counted before any work (the MCP 500-cell gate). */
export function inflationCellCount(input: { seriesIds?: string[]; measure?: string; fromPeriod?: string; toPeriod?: string }): number {
  if (input.fromPeriod === undefined || input.toPeriod === undefined) return 0;
  let from: number;
  let to: number;
  try {
    from = periodFromKey(input.fromPeriod);
    to = periodFromKey(input.toPeriod);
  } catch {
    return 0;
  }
  if (to < from) return 0;
  const span = input.measure === "basket_weight_pct" ? yearOfPeriod(input.toPeriod) - yearOfPeriod(input.fromPeriod) + 1 : to - from + 1;
  return span * ((input.seriesIds?.length ?? 0) + (input.measure === "contribution_pp" ? 1 : 0));
}

export function inflationObservations(snapshot: FactQuerySnapshot, request: InflationRequest, options: InflationOptions): FactQueryResponse {
  if (!(INFLATION_MEASURES as readonly string[]).includes(request.measure)) {
    return errorResponse(snapshot, {
      code: "unsupported_measure",
      ...bilingual(snapshot, "errors.measureSeriesMismatch", { measure: request.measure, mismatched: request.seriesIds.join(", ") }),
      retryable: false,
      validChoices: [...INFLATION_MEASURES],
    });
  }
  const measure = request.measure as InflationMeasure;
  const info = new Map(request.seriesIds.map((id) => [id, seriesInfo(snapshot, id)] as const));

  const unknownSeriesIds = request.seriesIds.filter((id) => info.get(id) === undefined);
  if (unknownSeriesIds.length > 0) {
    return errorResponse(snapshot, {
      code: "unknown_series",
      ...bilingual(snapshot, "errors.unknownSeries", { unknownSeriesIds: unknownSeriesIds.join(", ") }),
      retryable: false,
      validChoices: requestableSeriesIds(snapshot),
    });
  }

  const mismatched = request.seriesIds.filter((id) => !info.get(id)!.measures.includes(measure));
  if (mismatched.length > 0) {
    return errorResponse(snapshot, {
      code: "unsupported_measure",
      ...bilingual(snapshot, "errors.measureSeriesMismatch", { measure, mismatched: mismatched.join(", ") }),
      retryable: false,
      validChoices: [...info.get(mismatched[0]!)!.measures].sort(),
    });
  }

  if (measure === "contribution_pp" && new Set(request.seriesIds.map((id) => info.get(id)!.level)).size > 1) {
    return errorResponse(snapshot, { code: "invalid_parameters", ...bilingual(snapshot, "errors.contributionMixedLevels"), retryable: false });
  }

  const monthly = measure !== "basket_weight_pct";
  const keys = monthly ? (request.periods ?? []) : (request.years ?? []).map(String);
  let availableYears: number[];
  let availablePeriods: PeriodRange | null = null;

  if (monthly) {
    // The target and contributions are answered over the headline's months, so a
    // month before either begins comes back missing with its reason, not refused.
    const range = measurePeriodRange(snapshot, measure === "target_pct" || measure === "contribution_pp" ? "yoy_pct" : measure)!;
    availablePeriods = range;
    availableYears = yearsBetween(yearOfPeriod(range[0]), yearOfPeriod(range[1]));
    const outside = keys.filter((period) => period < range[0] || period > range[1]);
    if (outside.length > 0) {
      return errorResponse(snapshot, {
        code: "year_out_of_range",
        ...bilingual(snapshot, "errors.periodsOutOfRange", { outOfRangePeriods: outside.join(", "), first: range[0], last: range[1] }),
        retryable: false,
      });
    }
  } else {
    const [minYear, maxYear] = weightYearRange(snapshot);
    availableYears = yearsBetween(minYear, maxYear);
    const outside = (request.years ?? []).filter((year) => year < minYear || year > maxYear);
    if (outside.length > 0) {
      return errorResponse(snapshot, {
        code: "year_out_of_range",
        ...bilingual(snapshot, "errors.yearsOutOfRange", { outOfRangeYears: outside.join(", "), minYear, maxYear }),
        retryable: false,
      });
    }
  }

  const factMeasure = measure === "contribution_pp" ? "yoy_pct" : measure;
  const nationalFacts = new Map(snapshot.inflation.facts.filter((f) => f.measure === factMeasure).map((f) => [`${f.seriesId}|${f.period}`, f]));
  const categoryFacts = new Map(snapshot.inflation.categories.filter((f) => f.measure === factMeasure).map((f) => [`${f.categoryId}|${f.period}`, f]));
  const weights = new Map(snapshot.inflation.weights.map((row) => [`${row.categoryId}|${row.year}`, row]));
  const missing = (missingKey: ServiceMessageKey, missingValues?: Record<string, string | number>): Cell => ({ value: null, sourceIds: [], missingKey, missingValues });

  const cellFor = (seriesId: string, series: SeriesInfo, key: string): Cell => {
    if (measure === "basket_weight_pct") {
      const row = weights.get(`${seriesId}|${key}`);
      return row ? { value: row.weightPct, sourceIds: [row.sourceId] } : missing("missing.inflationWeight");
    }
    if (measure === "target_pct") {
      const row = snapshot.inflation.targets.find((t) => t.effectiveFrom <= key && (t.effectiveTo === null || key <= t.effectiveTo));
      return row ? { value: row.targetPct, sourceIds: [row.sourceId] } : missing("missing.inflationTargetUnverified");
    }
    if (series.level === "national") {
      const fact = nationalFacts.get(`${seriesId}|${key}`);
      return fact ? { value: fact.value, sourceIds: [fact.sourceId] } : missing("missing.inflationMonth");
    }
    const fact = categoryFacts.get(`${seriesId}|${key}`);
    if (measure !== "contribution_pp") return fact ? { value: fact.value, sourceIds: [fact.sourceId] } : missing("missing.inflationMonth");
    if (yearOfPeriod(key) < CONTRIBUTION_FIRST_YEAR) return missing("missing.inflationContributionStart", { firstYear: CONTRIBUTION_FIRST_YEAR });
    const value = contributionIndex(snapshot).get(seriesId)?.get(periodFromKey(key));
    const weight = weights.get(`${seriesId}|${yearOfPeriod(key)}`);
    return value !== undefined && fact && weight ? { value, sourceIds: [fact.sourceId, weight.sourceId] } : missing("missing.inflationContribution");
  };

  const raw: RawCell[] = request.seriesIds.flatMap((seriesId) =>
    keys.map((key) => ({ seriesId, info: info.get(seriesId)!, key, cell: cellFor(seriesId, info.get(seriesId)!, key) })),
  );

  if (measure === "contribution_pp" && options.includeResidual) {
    const residualInfo: SeriesInfo = { ...RESIDUAL_SERIES, level: "residual", parentSeriesId: null };
    const headline = new Map(snapshot.inflation.facts.filter((f) => f.seriesId === "cpi.headline" && f.measure === "yoy_pct").map((f) => [f.period, f]));
    for (const key of keys) {
      const published = headline.get(key);
      const parts = raw.filter((entry) => entry.key === key && entry.cell.value !== null);
      const cell: Cell =
        published === undefined
          ? missing("missing.inflationResidualHeadline")
          : yearOfPeriod(key) < CONTRIBUTION_FIRST_YEAR
            ? missing("missing.inflationContributionStart", { firstYear: CONTRIBUTION_FIRST_YEAR })
            : {
                value: published.value - parts.reduce((total, entry) => total + (entry.cell.value as number), 0),
                sourceIds: [...new Set([published.sourceId, ...parts.flatMap((entry) => entry.cell.sourceIds)])],
              };
      raw.push({ seriesId: RESIDUAL_SERIES_ID, info: residualInfo, key, cell });
    }
  }

  const sources = selectSources(snapshot, [...new Set(raw.flatMap((entry) => entry.cell.sourceIds))]);
  const observations: Observation[] = raw.map(({ seriesId, info: series, key, cell }) => {
    const definitionKey = seriesId === RESIDUAL_SERIES_ID ? "residual" : measure;
    const year = monthly ? yearOfPeriod(key) : Number(key);
    return {
      observationId: buildObservationId(INFLATION_DATASET_ID, INFLATION_ENTITY_ID, seriesId, monthly ? key : year, measure),
      datasetId: INFLATION_DATASET_ID,
      budgetScope: "consumer_prices",
      entityId: INFLATION_ENTITY_ID,
      entityType: "country",
      entityLabelKa: "საქართველო",
      entityLabelEn: "Georgia",
      entitySlug: null,
      seriesId,
      seriesLabelKa: series.labelKa,
      seriesLabelEn: series.labelEn,
      level: series.level,
      parentSeriesId: series.parentSeriesId,
      year,
      ...(monthly ? { period: key } : {}),
      measure,
      unit: INFLATION_MEASURE_UNITS[measure],
      value: cell.value,
      availability: cell.value === null ? "missing" : "available",
      missingReason: cell.missingKey ? serviceMessage(snapshot, "ka", cell.missingKey, cell.missingValues) : null,
      missingReasonEn: cell.missingKey ? serviceMessage(snapshot, "en", cell.missingKey, cell.missingValues) : null,
      basis: cell.value === null ? null : "published",
      valueDefinition: INFLATION_DEFINITIONS[definitionKey].ka,
      valueDefinitionEn: INFLATION_DEFINITIONS[definitionKey].en,
      // Constant per measure: the January re-weighting is a limiting caveat, not a definition break.
      valueDefinitionId: `inflation:${definitionKey}`,
      sourceIds: cell.sourceIds,
      documentIds: resolveDocumentIds(sources, cell.sourceIds),
      caveatIds: [],
    };
  });

  const years = [...new Set(observations.map((o) => o.year))].sort((a, b) => a - b);
  const caveats = evaluateCaveats(
    snapshot,
    countryLevelCaveatContext(INFLATION_DATASET_ID, measure, years, [...new Set(observations.map((o) => o.seriesId))], observations, options.comparison ?? null),
    CAVEAT_RULES,
  );
  for (const observation of observations) observation.caveatIds = caveatIdsForObservation(caveats, observation);

  const available = observations.filter((o) => o.availability === "available");
  const coverage = {
    requestedYears: years,
    availableYears,
    returnedYears: [...new Set(available.map((o) => o.year))].sort((a, b) => a - b),
    missingCells: observations
      .filter((o) => o.availability === "missing")
      .map((o) => ({ entityId: o.entityId, seriesId: o.seriesId, year: o.year, ...(o.period ? { period: o.period } : {}), reason: o.missingReason!, reasonEn: o.missingReasonEn! })),
    excludedEntities: [],
    returnedCount: available.length,
    expectedCount: observations.length,
    ...(monthly ? { requestedPeriods: keys, availablePeriods } : {}),
  };

  return {
    kind: "observations",
    status: available.length === observations.length ? "ok" : available.length > 0 ? "partial" : "empty",
    data: { observations, coverage },
    meta: buildResponseMeta(snapshot, { sources, caveats, citedDocumentIds: [...new Set(observations.flatMap((o) => o.documentIds))] }),
  };
}

export function queryInflation(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const parsed = queryInflationInput.safeParse(rawInput);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: serviceMessage(snapshot, "ka", "errors.invalidParameters"),
      messageEn: serviceMessage(snapshot, "en", "errors.invalidParameters", { issues }),
      retryable: false,
    });
  }
  const input = parsed.data;
  if (input.expectedDataVersion !== undefined && input.expectedDataVersion !== snapshot.dataVersion) {
    return errorResponse(snapshot, { code: "data_version_changed", ...bilingual(snapshot, "errors.dataVersionChanged"), retryable: false });
  }
  if (input.fromPeriod > input.toPeriod) {
    return errorResponse(snapshot, { code: "invalid_parameters", ...bilingual(snapshot, "errors.periodRangeReversed"), retryable: false });
  }
  const periods = periodsBetween(input.fromPeriod, input.toPeriod);
  const request: InflationRequest =
    input.measure === "basket_weight_pct"
      ? { seriesIds: input.seriesIds, measure: input.measure, years: [...new Set(periods.map(yearOfPeriod))] }
      : { seriesIds: input.seriesIds, measure: input.measure, periods };
  return inflationObservations(snapshot, request, { includeResidual: true });
}
```

In `apps/web/lib/factQuery/index.ts`, after `export { queryGdp } from "./queryGdp";` add `export { queryInflation } from "./queryInflation";`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/factQuery/queryInflation.test.ts tests/factQuery/purity.test.ts`
Expected: PASS.

- [ ] **Step 6: Extend the registered-caveat guard**

In `apps/web/tests/factQuery/caveats/registered.test.ts`, add `import { queryInflation } from "../../../lib/factQuery/queryInflation";` and, before the `"builds no caveat inline in a query module"` test, add:

```ts
  it("registers every caveat inflation emits", () => {
    const divisions = snapshot.inflation.groups.filter((group) => group.level === "division").map((group) => group.id);
    const codes = new Set(
      [
        ...expectRegistered(queryInflation(snapshot, { seriesIds: divisions, measure: "contribution_pp", fromPeriod: "2025-01", toPeriod: "2025-12" }), "contributions"),
        ...expectRegistered(queryInflation(snapshot, { seriesIds: ["cpi.target"], measure: "target_pct", fromPeriod: "2014-01", toPeriod: "2015-06" }), "target"),
        ...expectRegistered(queryInflation(snapshot, { seriesIds: ["cpi.headline", "cpi.core"], measure: "yoy_pct", fromPeriod: "2024-01", toPeriod: "2024-12" }), "rates"),
      ].map((caveat) => caveat.code),
    );
    expect([...codes].sort()).toEqual(["inflation_contribution_derived", "inflation_contribution_residual", "inflation_target_unverified_before_2015"]);
  });
```

Run: `npx vitest run tests/factQuery/caveats/registered.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing MCP tests**

In `apps/web/tests/mcp/tools.test.ts`, add `"query_inflation",` to `TOOL_NAMES` directly after `"query_gdp",`, and before the `"keeps every tool name in the advertised set"` test add:

```ts
  it("answers query_inflation with a monthly period in structured content", async () => {
    const client = await connected();
    const result = await client.callTool({
      name: "query_inflation",
      arguments: { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ data: { observations: [{ period: "2026-08", unit: "percent" }] } });
  });

  it("refuses an oversized inflation request before calculating it", async () => {
    const client = await connected();
    const snapshot = loadPackagedSnapshot();
    const result = await client.callTool({
      name: "query_inflation",
      arguments: { seriesIds: snapshot.inflation.groups.map((group) => group.id), measure: "yoy_pct", fromPeriod: "2025-01", toPeriod: "2025-12" },
    });
    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0]!.text).toContain("result_too_large");
  });

  it("tells clients inflation is the one monthly dataset", () => {
    const instructions = serverInstructions({}, ENTITY_COUNTS);
    expect(instructions).toContain("INFLATION");
    expect(instructions).toContain("only monthly dataset");
    expect(instructions).toContain("schema 1.2.0");
    expect(instructions).not.toContain("Quarterly or monthly data, live budget execution");
  });
```

In `apps/web/tests/mcp/route.test.ts` and `apps/web/tests/mcp/bilingualTransport.test.ts`, change `expect(tools).toHaveLength(11);` to `expect(tools).toHaveLength(12);`. In `bilingualTransport.test.ts`, add this row to the `it.each` table after the `query_debt` row:

```ts
    ["query_inflation", { seriesIds: ["cpi.cat.07"], measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" }],
```

- [ ] **Step 8: Run the MCP tests to verify they fail**

Run: `npm run data:prepare-fact-query-snapshot && npx vitest run tests/mcp/tools.test.ts tests/mcp/route.test.ts tests/mcp/bilingualTransport.test.ts`
Expected: FAIL — `query_inflation` is not a registered tool and the instructions have no INFLATION section.

- [ ] **Step 9: Register the tool and its cell gate**

In `apps/web/lib/mcp/tools.ts`:

1. Change the header comment `// The eleven read-only tools,` to `// The twelve read-only tools,`.
2. Add imports:

```ts
import { inflationDatasetPeriods } from "../factQuery/inflationData";
import { inflationCellCount, queryInflation } from "../factQuery/queryInflation";
import { queryInflationInput } from "../factQuery/schemas";
```

3. Replace the `ServiceFacts` type with:

```ts
/** Other counts and ranges the text states, read from the same snapshot. */
type ServiceFacts = {
  datasetCount: number;
  sectorMeasureYears: SectorMeasureYears;
  inflationPeriods: string;
  inflationGroupCount: number;
};
```

4. In `TOOLS`, directly after the `query_gdp` entry, add:

```ts
  {
    name: "query_inflation",
    title: "ინფლაცია / Inflation",
    describe: (_coverage, facts) =>
      `Monthly consumer-price inflation for Georgia, ${facts.inflationPeriods}: national CPI (cpi.headline, cpi.core, cpi.core_ex_tobacco), ` +
      `the National Bank of Georgia target (cpi.target), ${facts.inflationGroupCount} COICOP divisions and subgroups, their annual basket weights, ` +
      "and Fiscal.ge-derived contributions to annual inflation. Pass fromPeriod and toPeriod as YYYY-MM (inclusive) and one measure: " +
      "yoy_pct, mom_pct, avg12_pct, index_2010, target_pct, basket_weight_pct (one cell per calendar year) or contribution_pp. " +
      "A measure a series does not publish is rejected with the valid measures. Percent values use 2.4 for 2.4%. " +
      "Contributions are percentage points, never mix divisions and subgroups, and arrive with a residual series that closes them on the published headline. " +
      "Take the latest month from describe_coverage. Monthly changes do not add up to annual inflation, and the 12-month average is not annual inflation.",
    schema: queryInflationInput,
    run: (snapshot, input) => queryInflation(snapshot, input),
  },
```

5. In `createMcpServer`, replace the `const facts: ServiceFacts = { ... };` line with:

```ts
  const facts: ServiceFacts = {
    datasetCount: Object.keys(coverage).length,
    sectorMeasureYears: sectorMeasureYears(snapshot),
    inflationPeriods: inflationDatasetPeriods(snapshot).join(" to "),
    inflationGroupCount: snapshot.inflation.groups.length,
  };
```

6. In the tool handler, replace:

```ts
        const count = tool.name === "compare"
          ? (input.target?.entityIds?.length ?? 1) * (input.target?.seriesIds?.length ?? 1)
          : tool.name.startsWith("query_")
```

with:

```ts
        const count = tool.name === "compare"
          ? (input.target?.entityIds?.length ?? 1) * (input.target?.seriesIds?.length ?? 1)
          : tool.name === "query_inflation"
            ? inflationCellCount(args as Parameters<typeof inflationCellCount>[0])
            : tool.name.startsWith("query_")
```

- [ ] **Step 10: Declare the inflation coverage fields**

In `apps/web/lib/mcp/outputSchema.ts`, in the `coverage` schema, replace:

```ts
  missingCells: z.array(z.object({ entityId: z.string(), seriesId: z.string(), year: z.number().int(), reason: z.string(), reasonEn: z.string().min(1) })),
  excludedEntities: z.array(bilingualExcludedEntity), returnedCount: z.number().int(), expectedCount: z.number().int(),
```

with:

```ts
  missingCells: z.array(z.object({ entityId: z.string(), seriesId: z.string(), year: z.number().int(), period: z.string().optional(), reason: z.string(), reasonEn: z.string().min(1) })),
  excludedEntities: z.array(bilingualExcludedEntity), returnedCount: z.number().int(), expectedCount: z.number().int(),
  requestedPeriods: z.array(z.string()).optional(), availablePeriods: z.tuple([z.string(), z.string()]).optional(),
```

- [ ] **Step 11: Tell clients about inflation**

In `apps/web/lib/mcp/instructions.ts`:

1. Replace the opening two lines of the returned text:

```
  return `Fiscal.ge serves reviewed annual data on Georgia's state and municipal budgets,
government debt and fiscal balance, GDP and national economic sectors.
```

with:

```
  return `Fiscal.ge serves reviewed data on Georgia's state and municipal budgets, government
debt and fiscal balance, GDP and national economic sectors (all annual), and monthly
consumer-price inflation.
```

2. Replace:

```
  IMF, ${range("general-government-balance")}.
Coverage is derived from the loaded data and is reported by describe_coverage.
```

with:

```
  IMF, ${range("general-government-balance")}.
- Consumer-price inflation, ${range("inflation")}, through query_inflation. It is
  monthly; read INFLATION below before answering.
Coverage is derived from the loaded data and is reported by describe_coverage.
```

3. Replace `Clients must accept additive fields and schema 1.1.0; exact-version or unknown-field` with:

```
Clients must accept additive fields and schema 1.2.0, which adds an optional period
(YYYY-MM) on inflation observations, comparison endpoints and ranking entries;
exact-version or unknown-field
```

4. Replace:

```
Quarterly or monthly data, live budget execution, individual capital
projects, procurement, and anything after the last reviewed year that is not
```

with:

```
Quarterly or monthly data for any dataset other than inflation; city or product
price indices, HICP and other price indices; live budget execution, individual
capital projects, procurement, and anything after the last reviewed year that is not
```

5. Replace `figures, and "published" or "preliminary" for GDP and sector figures. For` with `figures, and "published" or "preliminary" for GDP, sector and inflation figures. For`.

6. Directly before the line `HOW TO PRESENT AN ANSWER`, insert:

```
INFLATION
- Inflation is the only monthly dataset. Periods are YYYY-MM. Take the latest
  month from describe_coverage; never assume the current month is published.
- Annual (yoy_pct), monthly (mom_pct) and 12-month average (avg12_pct) are
  different measures. Monthly changes do not add up to the annual change, and
  the 12-month average is not annual inflation.
- 2.4 means 2.4%. Contributions (contribution_pp) are percentage points; with
  the residual that comes with them they sum to the published headline annual
  rate. They are Fiscal.ge's approximation, not a Geostat figure - say so.
- The National Bank of Georgia target is a reference. "Above target" compares
  two published numbers; it is not a verdict on the central bank. No target
  before the first reviewed month is verified; do not say none existed.
- The national CPI is a weighted mean of city indices. It is not a region's
  inflation, a household's cost of living, or wage growth.
- This service does not adjust budget figures for inflation. If you do, present
  it as your own calculation, not as a Fiscal.ge figure.
- Do not state causes of price changes or the success or failure of monetary policy.

```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npm run data:prepare-fact-query-snapshot && npx vitest run tests/mcp tests/factQuery/queryInflation.test.ts tests/factQuery/caveats/registered.test.ts`
Then: `npm run typecheck`
Expected: PASS. If `tests/mcp/outputSchema.test.ts` enumerates tools, add `query_inflation` with kind `observations` to that list.

- [ ] **Step 13: Commit**

```bash
git add apps/web/lib/factQuery/schemas.ts apps/web/lib/factQuery/queryInflation.ts apps/web/lib/factQuery/index.ts apps/web/lib/mcp apps/web/tests/factQuery apps/web/tests/mcp
git commit -m "feat(mcp): serve monthly inflation through query_inflation" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 4: `compare` between two months

Adds the inflation target to `compare`, pairing endpoints on `period` for monthly measures and on `year` for basket weights, with the January re-weighting reported as a limited comparison.

**Files:**
- Modify: `apps/web/lib/factQuery/schemas.ts` (compareInput)
- Modify: `apps/web/lib/factQuery/compare.ts`
- Modify: `apps/web/lib/mcp/tools.ts` (compare description)
- Modify: `apps/web/lib/mcp/outputSchema.ts` (comparison coverage)
- Test: `apps/web/tests/factQuery/compareInflation.test.ts`

**Interfaces:**
- Consumes: `inflationObservations(snapshot, request, { includeResidual: false, comparison })` (Task 3); message `comparison.basketReweighted` (Task 2).
- Produces: `compareInput` accepts `target: { dataset: "inflation", seriesIds }`, optional `fromYear`/`toYear`, optional `fromPeriod`/`toPeriod`, and the seven inflation measures. `ComparisonEndpoint.period?: string`. Comparison `coverage.requestedPeriods?: [string, string]`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/factQuery/compareInflation.test.ts`:

```ts
// apps/web/tests/factQuery/compareInflation.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare, type Comparison } from "../../lib/factQuery/compare";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

function comparisons(response: FactQueryResponse): Comparison[] {
  if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
  return (response.data as { comparisons: Comparison[] }).comparisons;
}

const national = (seriesId: string, measure: string, period: string) =>
  snapshot.inflation.facts.find((f) => f.seriesId === seriesId && f.measure === measure && f.period === period)!.value;

describe("compare on inflation", () => {
  it("gives a percentage-point change between two months", () => {
    const [row] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct" }));
    expect(row).toMatchObject({
      comparisonId: "inflation:country.georgia:cpi.headline:2025-08-2026-08:yoy_pct",
      comparability: "comparable",
      unit: "percent",
      absoluteChange: null,
      percentageChange: null,
    });
    expect(row!.from.period).toBe("2025-08");
    expect(row!.to.period).toBe("2026-08");
    expect(row!.percentagePointChange!).toBeCloseTo(national("cpi.headline", "yoy_pct", "2026-08") - national("cpi.headline", "yoy_pct", "2025-08"), 12);
  });

  it("gives absolute and percentage change for the index level", () => {
    const [row] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "index_2010" }));
    const from = national("cpi.headline", "index_2010", "2025-08");
    const to = national("cpi.headline", "index_2010", "2026-08");
    expect(row!.percentagePointChange).toBeNull();
    expect(row!.absoluteChange!).toBeCloseTo(to - from, 12);
    expect(row!.percentageChange!).toBeCloseTo(((to - from) / from) * 100, 9);
  });

  it("limits a contribution comparison across a January and says why", () => {
    const [across] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.cat.07"] }, fromPeriod: "2025-12", toPeriod: "2026-01", measure: "contribution_pp" }));
    expect(across!.comparability).toBe("limited");
    expect(across!.caveatIds).toContain("inflation_contribution_weights_differ");
    expect(across!.reasonsEn.join(" ")).toContain("re-weighted");
    const [within] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.cat.07"] }, fromPeriod: "2026-01", toPeriod: "2026-08", measure: "contribution_pp" }));
    expect(within!.comparability).toBe("comparable");
  });

  it("never compares the residual", () => {
    const divisions = snapshot.inflation.groups.filter((g) => g.level === "division").map((g) => g.id);
    const rows = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: divisions }, fromPeriod: "2026-01", toPeriod: "2026-08", measure: "contribution_pp" }));
    expect(rows).toHaveLength(12);
    expect(rows.some((row) => row.seriesId === "cpi.contribution_residual")).toBe(false);
  });

  it("compares basket weights between years", () => {
    const [row] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.cat.01"] }, fromYear: 2024, toYear: 2025, measure: "basket_weight_pct" }));
    const weight = (year: number) => snapshot.inflation.weights.find((w) => w.categoryId === "cpi.cat.01" && w.year === year)!.weightPct;
    expect(row!.from.period).toBeUndefined();
    expect(row!.percentagePointChange!).toBeCloseTo(weight(2025) - weight(2024), 12);
  });

  it("refuses years for a monthly measure and periods for a budget target", () => {
    expect(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromYear: 2025, toYear: 2026, measure: "yoy_pct" }).kind).toBe("error");
    expect(compare(snapshot, { target: { dataset: "national", side: "expenditure", seriesIds: ["spending.health"] }, fromPeriod: "2025-01", toPeriod: "2025-02", measure: "amount_gel" }).kind).toBe("error");
    expect(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromPeriod: "2026-08", toPeriod: "2026-01", measure: "yoy_pct" }).kind).toBe("error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/factQuery/compareInflation.test.ts`
Expected: FAIL — `compare` returns `invalid_parameters` because `inflation` is not a target.

- [ ] **Step 3: Widen the compare input**

In `apps/web/lib/factQuery/schemas.ts`, replace the whole `export const compareInput = z ... ;` declaration with:

```ts
export const compareInput = z
  .strictObject({
    target: z.discriminatedUnion("dataset", [
      z.strictObject({ dataset: z.literal("national"), side: z.enum(["revenue", "expenditure"]), seriesIds: seriesIdList }),
      z.strictObject({ dataset: z.literal("ministries"), level: z.enum(["admin_category", "major_program"]), seriesIds: seriesIdList }),
      z.strictObject({ dataset: z.literal("municipal"), entityIds: entityIdList, seriesIds: seriesIdList }),
      z.strictObject({ dataset: z.literal("debt"), seriesIds: seriesIdList }),
      // No seriesIds: the balance dataset has exactly one series.
      z.strictObject({ dataset: z.literal("deficit") }),
      z.strictObject({ dataset: z.literal("inflation"), seriesIds: seriesIdList }),
    ]),
    fromYear: z.number().int().optional(),
    toYear: z.number().int().optional(),
    fromPeriod: periodKeySchema.optional().describe("Inflation monthly measures only: the earlier month, YYYY-MM."),
    toPeriod: periodKeySchema.optional().describe("Inflation monthly measures only: the later month, YYYY-MM."),
    measure: z.enum([
      "amount_gel", "share_of_total_pct", "share_of_gdp_pct", "gel_per_resident", "rate_percent",
      "yoy_pct", "mom_pct", "avg12_pct", "index_2010", "target_pct", "basket_weight_pct", "contribution_pp",
    ]),
    expectedDataVersion,
  })
  .superRefine((input, context) => {
    const issue = (path: string, message: string) => context.addIssue({ code: "custom", path: [path], message });
    const monthly = input.target.dataset === "inflation" && input.measure !== "basket_weight_pct";
    if (monthly) {
      if (input.fromYear !== undefined || input.toYear !== undefined) issue("fromYear", "inflation monthly measures take fromPeriod and toPeriod, not years");
      if (input.fromPeriod === undefined || input.toPeriod === undefined) issue("fromPeriod", "inflation monthly measures need fromPeriod and toPeriod");
      else if (!(input.fromPeriod < input.toPeriod)) issue("fromPeriod", "fromPeriod must be earlier than toPeriod");
      return;
    }
    if (input.fromPeriod !== undefined || input.toPeriod !== undefined) issue("fromPeriod", "fromPeriod and toPeriod apply only to inflation monthly measures");
    if (input.fromYear === undefined || input.toYear === undefined) issue("fromYear", "fromYear and toYear are required");
    else if (!(input.fromYear < input.toYear)) issue("fromYear", "fromYear must be earlier than toYear");
  });
```

- [ ] **Step 4: Compare inflation endpoints**

In `apps/web/lib/factQuery/compare.ts`:

1. Add `import { inflationObservations } from "./queryInflation";`.
2. In `ComparisonEndpoint`, after `year: number;` add `/** Monthly endpoints only (inflation): YYYY-MM. */ period?: string;`.
3. Replace the `PERCENTAGE_MEASURES` declaration with:

```ts
// The index level is the only inflation measure that is not a percent or
// percentage points, so it alone gets absolute and percentage change.
const PERCENTAGE_MEASURES = new Set<Measure>([
  "share_of_total_pct", "share_of_gdp_pct", "rate_percent",
  "yoy_pct", "mom_pct", "avg12_pct", "target_pct", "basket_weight_pct", "contribution_pp",
]);
```

4. After `const REASON_HISTORICAL_JOIN = "comparison.historicalJoin";` add `const REASON_BASKET_REWEIGHTED = "comparison.basketReweighted";`.
5. In `endpointOf`, after `year: observation.year,` add `...(observation.period !== undefined ? { period: observation.period } : {}),`.
6. Replace:

```ts
  const years = [input.fromYear, input.toYear];
  const target = input.target;
  // Handed to the sub-query so IT evaluates the comparison-only rules against
  // its own pre-scoped inputs. compare() previously rebuilt a CaveatContext by
  // hand; three of its fields disagreed with the query for the identical rows.
  const comparisonWindow = { fromYear: input.fromYear, toYear: input.toYear };
```

with:

```ts
  const target = input.target;
  // Inflation's monthly measures pair endpoints on their period; everything
  // else, basket weights included, pairs on the year. The schema guarantees
  // whichever pair applies is present.
  const monthly = target.dataset === "inflation" && input.measure !== "basket_weight_pct";
  const fromKey = monthly ? input.fromPeriod! : String(input.fromYear!);
  const toKey = monthly ? input.toPeriod! : String(input.toYear!);
  const fromYear = monthly ? Number(fromKey.slice(0, 4)) : input.fromYear!;
  const toYear = monthly ? Number(toKey.slice(0, 4)) : input.toYear!;
  const years = [fromYear, toYear];
  // Handed to the sub-query so IT evaluates the comparison-only rules against
  // its own pre-scoped inputs. compare() previously rebuilt a CaveatContext by
  // hand; three of its fields disagreed with the query for the identical rows.
  const comparisonWindow = { fromYear, toYear };
```

7. Replace `  } else if (target.dataset === "deficit") {` with:

```ts
  } else if (target.dataset === "inflation") {
    datasetId = "inflation";
    // No residual: its value depends on the rest of the selection, so a change
    // in it is not a change in anything.
    endpointResult = inflationObservations(
      snapshot,
      monthly
        ? { seriesIds: target.seriesIds, measure: input.measure, periods: [fromKey, toKey] }
        : { seriesIds: target.seriesIds, measure: input.measure, years },
      { includeResidual: false, comparison: comparisonWindow },
    );
  } else if (target.dataset === "deficit") {
```

8. Replace the two pairing lines:

```ts
    if (observation.year === input.fromYear) pair.from = observation;
    if (observation.year === input.toYear) pair.to = observation;
```

with:

```ts
    const endpointKey = observation.period ?? String(observation.year);
    if (endpointKey === fromKey) pair.from = observation;
    if (endpointKey === toKey) pair.to = observation;
```

9. After `if (limiting.includes("program_historical_join")) reasons.push(REASON_HISTORICAL_JOIN);` add:

```ts
      if (limiting.includes("inflation_contribution_weights_differ")) reasons.push(REASON_BASKET_REWEIGHTED);
```

10. Replace `comparisonId: \`${datasetId}:${key.replace("::", ":")}:${input.fromYear}-${input.toYear}:${input.measure}\`,` with `comparisonId: \`${datasetId}:${key.replace("::", ":")}:${fromKey}-${toKey}:${input.measure}\`,`.
11. In the returned `coverage`, after `requestedYears: years,` add `...(monthly ? { requestedPeriods: [fromKey, toKey] } : {}),`.

- [ ] **Step 5: Describe and declare**

In `apps/web/lib/mcp/tools.ts`, in the `compare` description, replace `"yourself: it is what detects a definition change between the two years.",` with:

```ts
      "yourself: it is what detects a definition change between the two years. For inflation use target " +
      "{ dataset: \"inflation\", seriesIds } with fromPeriod and toPeriod (YYYY-MM); basket_weight_pct takes fromYear and toYear.",
```

In `apps/web/lib/mcp/outputSchema.ts`, in `dataShapes.comparisons.coverage`, after `requestedYears: z.array(z.number()),` add `requestedPeriods: z.tuple([z.string(), z.string()]).optional(),`. The `endpoint` schema picks from `observationSchema`; add `period: true` to its `pick({...})` list.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/factQuery/compareInflation.test.ts tests/factQuery/compare.test.ts tests/factQuery/schemas.test.ts tests/factQuery/reference.test.ts`
Then: `npm run data:prepare-fact-query-snapshot && npx vitest run tests/mcp && npm run typecheck`
Expected: PASS. The existing compare and reference expectations must not change.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/factQuery/schemas.ts apps/web/lib/factQuery/compare.ts apps/web/lib/mcp apps/web/tests/factQuery/compareInflation.test.ts
git commit -m "feat(mcp): compare inflation between two months" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 5: `rank` COICOP groups in a month

Adds inflation to `rank` as small branches inside its existing flow, so ordering, ties, cutoff and exclusions stay single-sourced.

**Files:**
- Modify: `apps/web/lib/factQuery/schemas.ts` (rankInput)
- Modify: `apps/web/lib/factQuery/rank.ts`
- Modify: `apps/web/lib/mcp/tools.ts` (rank description), `apps/web/lib/mcp/outputSchema.ts` (ranking entry period)
- Test: `apps/web/tests/factQuery/rankInflation.test.ts`

**Interfaces:**
- Consumes: `inflationObservations` (Task 3); `compare` inflation target (Task 4); messages `ranking.inflationDivisions`, `ranking.inflationSubgroups`, `ranking.inflationSubgroupsWithinParent`, `ranking.valueDefinitionPeriod`, `ranking.changeDefinitionPeriod` (Task 2).
- Produces: `rankInput` accepts `datasetId: "inflation"`, `level: "division" | "subgroup"`, `period`, `fromPeriod`, `toPeriod`, measures `yoy_pct`, `mom_pct`, `contribution_pp`. `RankEntry.period?: string` on value rankings.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/factQuery/rankInflation.test.ts`:

```ts
// apps/web/tests/factQuery/rankInflation.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare, type Comparison } from "../../lib/factQuery/compare";
import { rank, type RankData } from "../../lib/factQuery/rank";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

function ranking(response: FactQueryResponse): RankData {
  if (response.kind !== "ranking") throw new Error(JSON.stringify(response));
  return response.data as RankData;
}

describe("rank on inflation", () => {
  it("orders divisions by annual price change in one month", () => {
    const data = ranking(rank(snapshot, { datasetId: "inflation", dimension: "series", level: "division", period: "2026-08", measure: "yoy_pct", metric: "value", limit: 3 }));
    expect(data.entries.map((entry) => entry.seriesId)).toEqual(["cpi.cat.07", "cpi.cat.04", "cpi.cat.12"]);
    expect(data.entries.map((entry) => entry.value)).toEqual([15.1989, 8.4682, 7.1272]);
    expect(data.entries.every((entry) => entry.unit === "percent" && entry.period === "2026-08")).toBe(true);
    expect(data.universe).toMatchObject({ candidateCount: 12, eligibleCount: 12 });
    expect(data.rankingDefinitionEn).toContain("2026-08");
  });

  it("ranks only the subgroups of the requested division", () => {
    const data = ranking(rank(snapshot, { datasetId: "inflation", dimension: "series", level: "subgroup", parentSeriesId: "cpi.cat.01", period: "2026-08", measure: "yoy_pct", metric: "value", limit: 100 }));
    const expected = snapshot.inflation.groups.filter((g) => g.parentId === "cpi.cat.01").length;
    expect(data.universe.candidateCount).toBe(expected);
    expect(data.entries.every((entry) => entry.seriesId.startsWith("cpi.cat.01_"))).toBe(true);
  });

  it("ranks percentage-point change in the same figures compare returns", () => {
    const data = ranking(rank(snapshot, { datasetId: "inflation", dimension: "series", level: "division", fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct", metric: "percentage_point_change", limit: 12 }));
    const response = compare(snapshot, { target: { dataset: "inflation", seriesIds: [data.entries[0]!.seriesId] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    const [comparison] = (response.data as { comparisons: Comparison[] }).comparisons;
    expect(data.entries[0]!.value).toBe(comparison!.percentagePointChange);
    expect(data.entries.every((entry) => entry.unit === "percentage_points")).toBe(true);
  });

  it("refuses rankings that do not fit inflation", () => {
    const base = { datasetId: "inflation", dimension: "series", period: "2026-08", measure: "yoy_pct", metric: "value" };
    expect(rank(snapshot, base).kind).toBe("error");
    expect(rank(snapshot, { ...base, level: "admin_category" }).kind).toBe("error");
    expect(rank(snapshot, { ...base, level: "division", year: 2026 }).kind).toBe("error");
    expect(rank(snapshot, { ...base, level: "division", period: undefined, fromPeriod: "2025-08", toPeriod: "2026-08", metric: "absolute_change" }).kind).toBe("error");
    expect(rank(snapshot, { datasetId: "national-expenditure", dimension: "series", period: "2026-08", measure: "amount_gel", metric: "value" }).kind).toBe("error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/factQuery/rankInflation.test.ts`
Expected: FAIL — `rank` returns `invalid_parameters` because `inflation` is not a ranking dataset.

- [ ] **Step 3: Widen the rank input**

In `apps/web/lib/factQuery/schemas.ts`, replace the whole `export const rankInput = z ... ;` declaration with:

```ts
export const rankInput = z
  .strictObject({
    // Deliberately excludes government-debt and general-government-balance:
    // both are country-level, so there is nothing to rank.
    datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure", "inflation"]),
    dimension: z.enum(["series", "entities"]),
    level: z.enum(["admin_category", "major_program", "division", "subgroup"]).optional(),
    parentSeriesId: z.string().optional().describe("For ministries with level major_program, or inflation with level subgroup: filters to that parent."),
    entityType: z.enum(["municipality", "region"]).optional(),
    seriesId: z.string().optional(),
    withinRegionId: z.string().optional().describe("Only for municipal rankings with entityType municipality; obtain the region id from describe_coverage."),
    year: z.number().int().optional(),
    fromYear: z.number().int().optional(),
    toYear: z.number().int().optional(),
    period: periodKeySchema.optional().describe("Inflation only, with metric value: the month to rank, YYYY-MM."),
    fromPeriod: periodKeySchema.optional().describe("Inflation only, with percentage_point_change: the earlier month."),
    toPeriod: periodKeySchema.optional().describe("Inflation only, with percentage_point_change: the later month."),
    measure: z.enum(["amount_gel", "share_of_total_pct", "share_of_gdp_pct", "gel_per_resident", "yoy_pct", "mom_pct", "contribution_pp"]),
    metric: z.enum(["value", "absolute_change", "percentage_change", "percentage_point_change"]),
    order: z.enum(["descending", "ascending"]).default("descending"),
    limit: z.number().int().min(1).max(100).default(10),
    expectedDataVersion,
  })
  .refine((input) => input.datasetId === "inflation" || (input.metric === "value" ? input.year !== undefined : input.fromYear !== undefined && input.toYear !== undefined), {
    message: "value ranking needs one year; change rankings need fromYear and toYear",
  })
  .refine((input) => input.datasetId !== "inflation" || (input.metric === "value" ? input.period !== undefined : input.fromPeriod !== undefined && input.toPeriod !== undefined), {
    message: "inflation value ranking needs one period; change rankings need fromPeriod and toPeriod",
  })
  .superRefine((input, context) => {
    const municipal = input.datasetId === "municipal-expenditure";
    const ministries = input.datasetId === "ministries";
    const inflation = input.datasetId === "inflation";
    const ministriesLevel = input.level === "admin_category" || input.level === "major_program";
    const inflationLevel = input.level === "division" || input.level === "subgroup";
    if (inflation && input.level === undefined) {
      context.addIssue({ code: "custom", path: ["level"], message: "inflation rankings need level division or subgroup." });
    }
    const invalid = [
      !municipal && input.entityType !== undefined ? "entityType" : null,
      !municipal && input.seriesId !== undefined ? "seriesId" : null,
      (!municipal || input.entityType !== "municipality") && input.withinRegionId !== undefined ? "withinRegionId" : null,
      input.level !== undefined && !(ministries && ministriesLevel) && !(inflation && inflationLevel) ? "level" : null,
      input.parentSeriesId !== undefined && !(ministries && input.level === "major_program") && !(inflation && input.level === "subgroup") ? "parentSeriesId" : null,
      inflation && (input.year !== undefined || input.fromYear !== undefined || input.toYear !== undefined) ? "year" : null,
      !inflation && (input.period !== undefined || input.fromPeriod !== undefined || input.toPeriod !== undefined) ? "period" : null,
    ];
    for (const field of invalid) {
      if (field !== null) context.addIssue({ code: "custom", path: [field], message: `${field} does not apply to this ranking mode; omit it or choose its supported mode.` });
    }
  });
```

- [ ] **Step 4: Rank inflation groups**

In `apps/web/lib/factQuery/rank.ts`:

1. Add `import { inflationObservations } from "./queryInflation";`.
2. Replace `const PERCENTAGE_MEASURES = new Set<Measure>(["share_of_total_pct", "share_of_gdp_pct"]);` with `const PERCENTAGE_MEASURES = new Set<Measure>(["share_of_total_pct", "share_of_gdp_pct", "yoy_pct", "mom_pct", "contribution_pp"]);`.
3. In `RankEntry`, replace:

```ts
  unit: Unit;
  basis: Basis | null;
  caveatIds: string[];
};

export type RankData = {
```

with:

```ts
  unit: Unit;
  basis: Basis | null;
  caveatIds: string[];
  /** Inflation value rankings only: the month ranked. */
  period?: string;
};

export type RankData = {
```

4. In `Candidate`, replace `  caveatIds: string[];\n  /** Stable sort key, used only to break exact ties reproducibly. */` with:

```ts
  caveatIds: string[];
  period?: string;
  /** Stable sort key, used only to break exact ties reproducibly. */
```

5. In the single-entity error, replace `validChoices: ["national-revenue", "national-expenditure", "ministries", "municipal-expenditure"],` with `validChoices: ["national-revenue", "national-expenditure", "ministries", "municipal-expenditure", "inflation"],`.
6. After `const isMunicipal = input.datasetId === "municipal-expenditure";` add `const isInflation = input.datasetId === "inflation";`. Add `type MinistriesLevel = "admin_category" | "major_program";` above `export function rank`, and replace both occurrences of `level: input.level ?? "admin_category"` with `level: (input.level ?? "admin_category") as MinistriesLevel`.
7. Replace:

```ts
    const series = catalogueSeries(snapshot, input.datasetId);
    if (input.datasetId === "ministries") {
```

with:

```ts
    const series = catalogueSeries(snapshot, input.datasetId);
    if (isInflation) {
      // Peers only: one COICOP level, never the headline, the target or the residual.
      seriesIds = snapshot.inflation.groups
        .filter((group) => group.level === input.level)
        .filter((group) => input.parentSeriesId === undefined || group.parentId === input.parentSeriesId)
        .map((group) => group.id)
        .sort();
      universeKey = input.level === "subgroup"
        ? input.parentSeriesId ? "ranking.inflationSubgroupsWithinParent" : "ranking.inflationSubgroups"
        : "ranking.inflationDivisions";
      if (input.parentSeriesId) universeValues = { parentId: input.parentSeriesId };
    } else if (input.datasetId === "ministries") {
```

8. Replace `    const result = runObservations([input.year as number]);` with:

```ts
    const result = isInflation
      ? inflationObservations(snapshot, { seriesIds, measure: input.measure, periods: [input.period as string] }, { includeResidual: false })
      : runObservations([input.year as number]);
```

9. In the value branch's `candidates.push({...})`, replace `        caveatIds: observation.caveatIds,\n        stableId,` with:

```ts
        caveatIds: observation.caveatIds,
        ...(observation.period !== undefined ? { period: observation.period } : {}),
        stableId,
```

10. Replace the change branch's `const target = ...;` and `const result = compare(snapshot, {...});` with:

```ts
    const target = isInflation
      ? ({ dataset: "inflation", seriesIds } as const)
      : isMunicipal
        ? ({ dataset: "municipal", entityIds, seriesIds } as const)
        : input.datasetId === "ministries"
          ? ({ dataset: "ministries", level: (input.level ?? "admin_category") as MinistriesLevel, seriesIds } as const)
          : ({ dataset: "national", side: input.datasetId === "national-revenue" ? "revenue" : "expenditure", seriesIds } as const);

    const result = compare(
      snapshot,
      isInflation
        ? { target, fromPeriod: input.fromPeriod, toPeriod: input.toPeriod, measure: input.measure }
        : { target, fromYear: input.fromYear as number, toYear: input.toYear as number, measure: input.measure },
    );
```

11. Replace `        unit: input.metric === "absolute_change" ? comparison.unit : "percent",` with:

```ts
        unit: input.metric === "absolute_change" ? comparison.unit : isInflation ? "percentage_points" : "percent",
```

12. In the `entries` map, replace `    caveatIds: entry.caveatIds,\n  }));` with:

```ts
    caveatIds: entry.caveatIds,
    ...(entry.period !== undefined ? { period: entry.period } : {}),
  }));
```

13. In `rankingDefinitionFor`, directly after the `const order = ...;` line add:

```ts
    if (isInflation) {
      return isValueMetric
        ? serviceMessage(snapshot, locale, "ranking.valueDefinitionPeriod", { measure: input.measure, period: input.period as string, order })
        : serviceMessage(snapshot, locale, "ranking.changeDefinitionPeriod", { metric: input.metric, measure: input.measure, fromPeriod: input.fromPeriod as string, toPeriod: input.toPeriod as string, order });
    }
```

- [ ] **Step 5: Describe and declare**

In `apps/web/lib/mcp/tools.ts`, in the `rank` description, replace `"says when the cutoff splits one, and names every excluded candidate with its reason.",` with:

```ts
      "says when the cutoff splits one, and names every excluded candidate with its reason. For inflation: dimension series, " +
      "level division or subgroup (optionally parentSeriesId), and period with metric value or fromPeriod and toPeriod with percentage_point_change.",
```

In `apps/web/lib/mcp/outputSchema.ts`, in `dataShapes.ranking.entries`, after `caveatIds: z.array(z.string()),` add `period: z.string().optional(),`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/factQuery/rankInflation.test.ts tests/factQuery/rank.test.ts tests/factQuery/schemas.test.ts tests/factQuery/reference.test.ts`
Then: `npm run data:prepare-fact-query-snapshot && npx vitest run tests/mcp && npm run typecheck`
Expected: PASS, with every existing rank and reference expectation unchanged.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/factQuery/schemas.ts apps/web/lib/factQuery/rank.ts apps/web/lib/mcp apps/web/tests/factQuery/rankInflation.test.ts
git commit -m "feat(mcp): rank inflation groups in a month" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 6: Inflation publications

Publishes `inflation-national.json` (observation envelope), `inflation-categories.csv` and `inflation-categories.json` (metadata with the CSV's hash), all built from `inflationObservations`.

**Files:**
- Modify: `apps/web/lib/factQuery/publications.ts`
- Modify: `apps/web/tests/factQuery/bilingualPublications.test.ts`
- Test: `apps/web/tests/factQuery/inflationPublications.test.ts`

**Interfaces:**
- Consumes: `inflationObservations` (Task 3); `inflationSeriesCoverage`, `measurePeriodRange`, `periodsBetween`, `weightYearRange` (Task 1); `INFLATION_DEFINITIONS`, `NATIONAL_SERIES`, `TARGET_SERIES_ID` (Task 1).
- Produces: `INFLATION_CATEGORIES_CSV_COLUMNS` (exported), three artifacts from `buildAllPublications`, and `"inflation"` in `catalogue.json` and the manifest's coverage.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/factQuery/inflationPublications.test.ts`:

```ts
// apps/web/tests/factQuery/inflationPublications.test.ts
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { buildAllPublications, INFLATION_CATEGORIES_CSV_COLUMNS, type PublicationArtifact } from "../../lib/factQuery/publications";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
let files: PublicationArtifact[];
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
  files = buildAllPublications(snapshot);
}, 120_000);

const file = (name: string) => files.find((artifact) => artifact.fileName === name)!;
const json = (name: string) => JSON.parse(file(name).bytes.toString("utf8"));
const headlineYoy = (period: string) =>
  snapshot.inflation.facts.find((f) => f.seriesId === "cpi.headline" && f.measure === "yoy_pct" && f.period === period)?.value;

describe("inflation publications", () => {
  it("lists the three files in the manifest with their exact hashes", () => {
    const manifest = json("manifest.json");
    for (const name of ["inflation-national.json", "inflation-categories.csv", "inflation-categories.json"]) {
      const entry = manifest.files.find((f: { fileName: string }) => f.fileName === name);
      expect(entry.sha256).toBe(createHash("sha256").update(file(name).bytes).digest("hex"));
    }
  });

  it("publishes national CPI, the target and basket weights as observations", () => {
    const national = json("inflation-national.json");
    expect(national).toMatchObject({ schemaVersion: "1.2.0", datasetId: "inflation" });
    const headline = national.observations.find((o: { observationId: string }) => o.observationId === "inflation:country.georgia:cpi.headline:2026-08:yoy_pct");
    expect(headline.value).toBe(headlineYoy("2026-08"));
    expect(national.observations.some((o: { seriesId: string }) => o.seriesId === "cpi.target")).toBe(true);
    const weight = national.observations.find((o: { measure: string }) => o.measure === "basket_weight_pct");
    expect(weight.period).toBeUndefined();
    expect(national.observations.some((o: { measure: string }) => o.measure === "contribution_pp")).toBe(false);
  });

  it("publishes group rates and contributions that close on the headline", () => {
    const bytes = file("inflation-categories.csv").bytes;
    expect(bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191]))).toBe(true);
    const rows = parse(bytes, { bom: true, columns: true }) as Record<string, string>[];
    expect(Object.keys(rows[0]!)).toEqual([...INFLATION_CATEGORIES_CSV_COLUMNS]);
    expect(rows.find((r) => r.series_id === "cpi.cat.07" && r.measure === "yoy_pct" && r.period === "2026-08")).toMatchObject({ value: "15.1989", calculation: "published" });
    const divisions = rows.filter((r) => r.selection === "divisions");
    expect(divisions.every((r) => r.calculation === "fiscal_ge_derived")).toBe(true);
    const byPeriod = new Map<string, number>();
    for (const row of divisions) byPeriod.set(row.period!, (byPeriod.get(row.period!) ?? 0) + Number(row.value));
    expect(byPeriod.size).toBeGreaterThan(100);
    for (const [period, sum] of byPeriod) expect(Math.abs(sum - headlineYoy(period)!)).toBeLessThan(1e-9);
    expect(rows.some((r) => r.selection === "subgroups" && r.series_id === "cpi.contribution_residual")).toBe(true);
  });

  it("describes the CSV in a metadata file without repeating its rows", () => {
    const metadata = json("inflation-categories.json");
    expect(metadata.observations).toBeUndefined();
    expect(metadata.data.sha256).toBe(createHash("sha256").update(file("inflation-categories.csv").bytes).digest("hex"));
    expect(metadata.data.url).toBe("/downloads/data/inflation-categories.csv");
    expect(metadata.catalogue.datasets[0].datasetId).toBe("inflation");
    expect(metadata.caveats.map((c: { code: string }) => c.code)).toContain("inflation_contribution_derived");
  });

  it("adds inflation to the published catalogue", () => {
    expect(json("catalogue.json").datasets.map((d: { datasetId: string }) => d.datasetId)).toContain("inflation");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/factQuery/inflationPublications.test.ts`
Expected: FAIL — `INFLATION_CATEGORIES_CSV_COLUMNS` is not exported and no inflation file exists.

- [ ] **Step 3: Build the files**

In `apps/web/lib/factQuery/publications.ts`:

1. Add imports:

```ts
import { CONTRIBUTION_FIRST_YEAR } from "../data/inflation/contributions";
import { inflationSeriesCoverage, measurePeriodRange, periodsBetween, weightYearRange } from "./inflationData";
import { INFLATION_DEFINITIONS, NATIONAL_SERIES, TARGET_SERIES_ID, type InflationMeasure } from "./inflationSeries";
import { inflationObservations } from "./queryInflation";
```

2. Append `"inflation",` to this file's `DATASET_IDS`.
3. Replace:

```ts
export function buildAllPublications(snapshot: FactQuerySnapshot): PublicationArtifact[] {
  const artifacts = [buildCatalogueFile(snapshot), buildSourcesFile(snapshot), ...buildDatasetFiles(snapshot),
```

with:

```ts
export function buildAllPublications(snapshot: FactQuerySnapshot): PublicationArtifact[] {
  const inflationCategories = inflationCategoryParts(snapshot);
  const inflationCategoriesCsv = buildInflationCategoriesCsv(inflationCategories);
  const artifacts = [buildCatalogueFile(snapshot), buildSourcesFile(snapshot), ...buildDatasetFiles(snapshot),
```

and replace `buildGdpCsv(snapshot), buildEconomicSectorsJson(snapshot), buildEconomicSectorsCsv(snapshot)];` with:

```ts
 buildGdpCsv(snapshot), buildEconomicSectorsJson(snapshot), buildEconomicSectorsCsv(snapshot),
    buildInflationNationalJson(snapshot), inflationCategoriesCsv, buildInflationCategoriesJson(snapshot, inflationCategories, inflationCategoriesCsv)];
```

4. Append at the end of the file:

```ts
/** Several observation responses of one dataset as one, with coverage, sources and caveats merged. */
function mergeObservationResponses(label: string, responses: FactQueryResponse[]): FactQueryResponse {
  const parts = responses.map((response) => observationsOf(response, label));
  const first = responses[0]!;
  if (first.kind !== "observations") throw new Error(`${label}: expected observations`);
  const observations = parts.flatMap((part) => part.data.observations);
  const returnedCount = observations.filter((o) => o.availability === "available").length;
  return {
    ...first,
    status: returnedCount === observations.length ? "ok" : returnedCount > 0 ? "partial" : "empty",
    data: {
      observations,
      coverage: { ...parts[0]!.data.coverage, missingCells: parts.flatMap((part) => part.data.coverage.missingCells), expectedCount: observations.length, returnedCount },
    },
    meta: {
      ...first.meta,
      sources: parts.reduce<ResolvedSource[]>((all, part) => mergeSources(all, part.meta.sources), []),
      caveats: parts.reduce<Caveat[]>((all, part) => mergeCaveats(all, part.meta.caveats), []),
    },
  };
}

/** Every month any of these series publishes the measure. */
function inflationMonths(snapshot: FactQuerySnapshot, seriesIds: string[], measure: InflationMeasure): string[] {
  const coverage = inflationSeriesCoverage(snapshot);
  const ranges = seriesIds.flatMap((id) => coverage.get(id)?.periodsByMeasure[measure] ?? []);
  const firsts = ranges.filter((_, index) => index % 2 === 0).sort();
  const lasts = ranges.filter((_, index) => index % 2 === 1).sort();
  return periodsBetween(firsts[0]!, lasts.at(-1)!);
}

function buildInflationNationalJson(snapshot: FactQuerySnapshot): PublicationArtifact {
  const national = (["index_2010", "yoy_pct", "mom_pct", "avg12_pct"] as const).map((measure) => {
    const seriesIds = Object.entries(NATIONAL_SERIES).filter(([, series]) => series.measures.includes(measure)).map(([id]) => id);
    return inflationObservations(snapshot, { seriesIds, measure, periods: inflationMonths(snapshot, seriesIds, measure) }, { includeResidual: false });
  });
  const headline = measurePeriodRange(snapshot, "yoy_pct")!;
  const target = inflationObservations(snapshot, { seriesIds: [TARGET_SERIES_ID], measure: "target_pct", periods: periodsBetween(headline[0], headline[1]) }, { includeResidual: false });
  const [minYear, maxYear] = weightYearRange(snapshot);
  const weights = inflationObservations(
    snapshot,
    { seriesIds: snapshot.inflation.groups.map((group) => group.id), measure: "basket_weight_pct", years: Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i) },
    { includeResidual: false },
  );
  return datasetFile(snapshot, "inflation", "inflation-national.json", mergeObservationResponses("inflation-national.json", [...national, target, weights]), {});
}

type InflationCategoryPart = { selection: "" | "divisions" | "subgroups"; response: FactQueryResponse };

/** Group rates for every group, then contributions per full level with that level's residual. */
function inflationCategoryParts(snapshot: FactQuerySnapshot): InflationCategoryPart[] {
  const ids = (level?: "division" | "subgroup") => snapshot.inflation.groups.filter((g) => level === undefined || g.level === level).map((g) => g.id);
  const rates = (measure: "yoy_pct" | "mom_pct"): InflationCategoryPart => ({
    selection: "",
    response: inflationObservations(snapshot, { seriesIds: ids(), measure, periods: inflationMonths(snapshot, ids(), measure) }, { includeResidual: false }),
  });
  const contributionMonths = periodsBetween(`${CONTRIBUTION_FIRST_YEAR}-01`, measurePeriodRange(snapshot, "yoy_pct")![1]);
  const contributions = (level: "division" | "subgroup"): InflationCategoryPart => ({
    selection: level === "division" ? "divisions" : "subgroups",
    response: inflationObservations(snapshot, { seriesIds: ids(level), measure: "contribution_pp", periods: contributionMonths }, { includeResidual: true }),
  });
  return [rates("yoy_pct"), rates("mom_pct"), contributions("division"), contributions("subgroup")];
}

export const INFLATION_CATEGORIES_CSV_COLUMNS = ["series_id", "level", "parent_id", "selection", "measure", "period", "value", "unit", "status", "calculation", "source_ids"] as const;

/** Available cells only; labels, definitions and caveats live in inflation-categories.json. */
function buildInflationCategoriesCsv(parts: InflationCategoryPart[]): PublicationArtifact {
  const lines: string[] = [];
  for (const part of parts) {
    for (const o of observationsOf(part.response, "inflation-categories.csv").data.observations) {
      if (o.value === null) continue;
      lines.push(
        [o.seriesId, o.level, o.parentSeriesId ?? "", part.selection, o.measure, o.period ?? "", String(o.value), o.unit, o.basis ?? "",
          o.measure === "contribution_pp" ? "fiscal_ge_derived" : "published", o.sourceIds.join(";")]
          .map(csvEscape)
          .join(","),
      );
    }
  }
  const text = `\uFEFF${INFLATION_CATEGORIES_CSV_COLUMNS.join(",")}\n${lines.join("\n")}\n`;
  return { fileName: "inflation-categories.csv", bytes: Buffer.from(text, "utf8"), rowCount: lines.length };
}

function buildInflationCategoriesJson(snapshot: FactQuerySnapshot, parts: InflationCategoryPart[], csv: PublicationArtifact): PublicationArtifact {
  const results = parts.map((part) => observationsOf(part.response, "inflation-categories.json"));
  const bytes = serialize({
    ...publicationHeader(snapshot),
    datasetId: "inflation",
    notice: serviceMessage(snapshot, "ka", "publication.sumWarning"),
    noticeEn: serviceMessage(snapshot, "en", "publication.sumWarning"),
    catalogue: catalogueData(snapshot, "inflation"),
    data: {
      url: "/downloads/data/inflation-categories.csv",
      mediaType: "text/csv",
      columns: [...INFLATION_CATEGORIES_CSV_COLUMNS],
      rowCount: csv.rowCount,
      byteSize: csv.bytes.byteLength,
      sha256: sha256(csv.bytes),
    },
    definitions: INFLATION_DEFINITIONS,
    sources: results.reduce<ResolvedSource[]>((all, result) => mergeSources(all, result.meta.sources), []),
    caveats: results.reduce<Caveat[]>((all, result) => mergeCaveats(all, result.meta.caveats), []),
  });
  return { fileName: "inflation-categories.json", bytes, rowCount: csv.rowCount };
}
```

- [ ] **Step 4: Update the pinned publication list**

In `apps/web/tests/factQuery/bilingualPublications.test.ts`, add `"inflation-national.json", "inflation-categories.csv", "inflation-categories.json"` to the expected file-name array and change `toBe("1.1.0")` to `toBe("1.2.0")`. If `tests/factQuery/publications.test.ts` pins the published dataset list or file names, add `"inflation"` (or the three file names) to that expectation and change nothing else.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/factQuery/inflationPublications.test.ts tests/factQuery/bilingualPublications.test.ts tests/factQuery/publications.test.ts tests/data/economicSectors/publication.test.ts`
Then: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/factQuery/publications.ts apps/web/tests/factQuery
git commit -m "feat(publications): publish inflation JSON and categories CSV" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 7: Reference fixture 28 → 34 intents

Pins six inflation answers to values read by hand from the reviewed CSVs, and brings `ai-reference-intents.md` up to date (it still lists only rows 1–20).

**Files:**
- Modify: `apps/web/tests/factQuery/fixtures/referenceIntents.ts`
- Modify: `apps/web/tests/factQuery/reference.test.ts`
- Modify: `docs/data-methodology/ai-reference-intents.md`

**Interfaces:**
- Consumes: `queryInflation` (Task 3), inflation `compare` (Task 4) and `rank` (Task 5).

Hand-checked values (awk over `data/imports/`, 2026-09-14): headline y/y 2025-08 = 4.6496, 2026-08 = 5.6479 (`cpi-national-monthly.csv`); division contributions for 2026-08 = `weight_pct(2026) / 100 × yoy_pct(2026-08)` from `cpi-basket-weights.csv` and `cpi-categories-monthly.csv`, summing to 5.508274333681, so the residual is 0.139625666319; top three division y/y in 2026-08: `cpi.cat.07` 15.1989, `cpi.cat.04` 8.4682, `cpi.cat.12` 7.1272; `nbg-inflation-target.csv` has no row before 2015-01.

- [ ] **Step 1: Add the intents**

In `apps/web/tests/factQuery/fixtures/referenceIntents.ts`, change `ExpectedCell.unit` to `unit: "GEL" | "percent" | "GEL_per_resident" | "percentage_points";`.

Directly before the final `] as const;`, add:

```ts
  {
    id: 29,
    promptKa: "რამდენი იყო წლიური ინფლაცია 2026 წლის აგვისტოში?",
    promptEn: "What was annual inflation in August 2026?",
    call: { tool: "query_inflation", arguments: { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" } },
    expectedStatus: "ok",
    expectedCells: [{ id: "inflation:country.georgia:cpi.headline:2026-08:yoy_pct", value: 5.6479, unit: "percent" }],
    allowedRounding: EXACT,
    expectedBudgetScope: "consumer_prices",
    requiredSourceIds: ["source.geostat_cpi_yoy"],
    requiredDocumentIds: [],
    requiredCaveatCodes: [],
    mustDeclineOrQualify: false,
    note: "Read from data/imports/cpi-national-monthly.csv: cpi.headline yoy_pct 2026-08 = 5.6479, published. A percentage: 5.6479 means 5.6479%.",
  },
  {
    id: 30,
    promptKa: "რამდენი იყო საბაზო ინფლაციის ინდექსი 2026 წლის აგვისტოში?",
    promptEn: "What was the core inflation index level in August 2026?",
    call: { tool: "query_inflation", arguments: { seriesIds: ["cpi.core"], measure: "index_2010", fromPeriod: "2026-08", toPeriod: "2026-08" } },
    expectedStatus: "error",
    allowedRounding: EXACT,
    expectedBudgetScope: null,
    requiredSourceIds: [],
    requiredDocumentIds: [],
    requiredCaveatCodes: [],
    mustDeclineOrQualify: true,
    note: "Geostat publishes no index level for core inflation; the service must refuse and name the valid measures, never derive one.",
  },
  {
    id: 31,
    promptKa: "რამდენი იყო ეროვნული ბანკის ინფლაციის მიზნობრივი მაჩვენებელი 2014 წლის ივნისში?",
    promptEn: "What was the National Bank of Georgia's inflation target in June 2014?",
    call: { tool: "query_inflation", arguments: { seriesIds: ["cpi.target"], measure: "target_pct", fromPeriod: "2014-06", toPeriod: "2014-06" } },
    expectedStatus: "empty",
    expectedCells: [{ id: "inflation:country.georgia:cpi.target:2014-06:target_pct", value: null, unit: "percent" }],
    allowedRounding: EXACT,
    expectedBudgetScope: "consumer_prices",
    requiredSourceIds: [],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["inflation_target_unverified_before_2015"],
    mustDeclineOrQualify: true,
    note: "nbg-inflation-target.csv starts 2015-01. Missing, never assumed, and never reported as 'no target existed'.",
  },
  {
    id: 32,
    promptKa: "რა ჯგუფებმა შეადგინეს წლიური ინფლაცია 2026 წლის აგვისტოში?",
    promptEn: "Which groups made up annual inflation in August 2026?",
    call: {
      tool: "query_inflation",
      arguments: {
        seriesIds: ["cpi.cat.01", "cpi.cat.02", "cpi.cat.03", "cpi.cat.04", "cpi.cat.05", "cpi.cat.06", "cpi.cat.07", "cpi.cat.08", "cpi.cat.09", "cpi.cat.10", "cpi.cat.11", "cpi.cat.12"],
        measure: "contribution_pp",
        fromPeriod: "2026-08",
        toPeriod: "2026-08",
      },
    },
    expectedStatus: "ok",
    expectedCells: [
      { id: "inflation:country.georgia:cpi.cat.01:2026-08:contribution_pp", value: 1.684193337606, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.02:2026-08:contribution_pp", value: 0.359982644148, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.03:2026-08:contribution_pp", value: 0.028247565552, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.04:2026-08:contribution_pp", value: 0.819812962514, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.05:2026-08:contribution_pp", value: -0.08803876217, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.06:2026-08:contribution_pp", value: 0.429405221168, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.07:2026-08:contribution_pp", value: 1.737025285125, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.08:2026-08:contribution_pp", value: -0.236331741975, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.09:2026-08:contribution_pp", value: 0.061319423926, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.10:2026-08:contribution_pp", value: 0.125853650299, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.11:2026-08:contribution_pp", value: 0.225514720704, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.cat.12:2026-08:contribution_pp", value: 0.361290026784, unit: "percentage_points" },
      { id: "inflation:country.georgia:cpi.contribution_residual:2026-08:contribution_pp", value: 0.139625666319, unit: "percentage_points" },
    ],
    allowedRounding: RATIO_TOLERANCE,
    expectedBudgetScope: "consumer_prices",
    requiredSourceIds: ["source.geostat_cpi_yoy", "source.geostat_basket_weights"],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["inflation_contribution_derived", "inflation_contribution_residual"],
    mustDeclineOrQualify: true,
    note: "Each value is weight_pct(2026)/100 × yoy_pct(2026-08), computed by hand from the two CSVs; they sum to 5.508274333681 and the residual closes them on the published 5.6479.",
  },
  {
    id: 33,
    promptKa: "როგორ შეიცვალა წლიური ინფლაცია 2025 წლის აგვისტოდან 2026 წლის აგვისტომდე?",
    promptEn: "How did annual inflation change from August 2025 to August 2026?",
    call: { tool: "compare", arguments: { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct" } },
    expectedStatus: "ok",
    expectedComparison: {
      id: "inflation:country.georgia:cpi.headline:2025-08-2026-08:yoy_pct",
      from: 4.6496,
      to: 5.6479,
      absoluteChange: null,
      percentageChange: null,
      percentagePointChange: 0.9983,
      comparability: "comparable",
    },
    allowedRounding: RATIO_TOLERANCE,
    expectedBudgetScope: null,
    requiredSourceIds: ["source.geostat_cpi_yoy"],
    requiredDocumentIds: [],
    requiredCaveatCodes: [],
    mustDeclineOrQualify: false,
    note: "A point change between two published months: 5.6479 − 4.6496 = 0.9983 percentage points, never '+21.5%'.",
  },
  {
    id: 34,
    promptKa: "რომელ ჯგუფებში გაიზარდა ფასები ყველაზე მაღლა 2026 წლის აგვისტოში?",
    promptEn: "Which groups had the highest annual price growth in August 2026?",
    call: { tool: "rank", arguments: { datasetId: "inflation", dimension: "series", level: "division", period: "2026-08", measure: "yoy_pct", metric: "value", limit: 3 } },
    expectedStatus: "ok",
    expectedRanking: { orderedIds: ["cpi.cat.07", "cpi.cat.04", "cpi.cat.12"], topValues: [15.1989, 8.4682, 7.1272], unit: "percent", candidateCount: 12, eligibleCount: 12 },
    allowedRounding: EXACT,
    expectedBudgetScope: null,
    requiredSourceIds: ["source.geostat_cpi_yoy"],
    requiredDocumentIds: [],
    requiredCaveatCodes: [],
    mustDeclineOrQualify: false,
    note: "Read from data/imports/cpi-categories-monthly.csv: the 12 division yoy_pct rows for 2026-08, sorted by hand.",
  },
```

- [ ] **Step 2: Run the fixture through the service**

In `apps/web/tests/factQuery/reference.test.ts`:
1. Add `import { queryInflation } from "../../lib/factQuery/queryInflation";`.
2. In `dispatch`, after `query_economic_sectors: ...,` add `query_inflation: (input) => queryInflation(snapshot, input),`.
3. Change both `28`s in the count test (`toHaveLength(28)` and `{ length: 28 }`) to `34`, the test title to `"covers 34 intents, each asked in both languages"`, and append to the comment above it: `Six more on 2026-09-14 for inflation: a published month, a refused core index, an unverified early target, contributions with their residual, a two-month point change, and a division ranking.`

Run: `npx vitest run tests/factQuery/reference.test.ts`
Expected: PASS. If any intent disagrees, STOP and report it with the actual and expected value; do not edit the expectation.

- [ ] **Step 3: Update the intents document**

In `docs/data-methodology/ai-reference-intents.md`:
1. Replace `Twenty-four budget questions` with `Thirty-four questions`.
2. Replace `The 24 existing numerical` with `The existing numerical`.
3. Replace the heading `## The twenty intents` with `## The intents`.
4. Directly after the table row that begins `| 20 |`, add:

```markdown
| 21 | Government debt, 2024 | 33,169,300,000 GEL | Debt is a central-government liability, not a budget figure (severe) |
| 22 | Debt service, 2027 | 4,388,380,862.53 GEL | Not a budget figure; a schedule of the existing portfolio, not an outcome (severe) |
| 23 | Average interest rate on external debt, 2016 | **Missing** — never estimated | Not a budget figure; no reviewed source published the rate |
| 24 | Budget deficit as a share of GDP, 2020 | −9.158% of GDP | The IMF general government balance, not receipts minus expenditure (severe); the sign is the answer |
| 25 | Nominal GDP, 2024 | 93,022,275,315.71 GEL | Nothing further: one published SNA 2008 year |
| 26 | Nominal GDP, 2025, and whether it is final | 104,598,139,883.33 GEL | The figure is preliminary |
| 27 | Construction's share of GDP, 2024 | 7.4114% | A percentage of all national GDP, not a fraction |
| 28 | Construction's real growth, 2010 | **Missing** — never 0 | Real growth starts a year after the nominal series |
| 29 | Annual inflation, August 2026 | 5.6479% | Nothing further: one published Geostat month |
| 30 | Core inflation index level, August 2026 | **Declined** — core has no published index | The valid measures are named instead |
| 31 | National Bank target, June 2014 | **Missing** — never assumed | No earlier target is verified; that does not mean none existed |
| 32 | Groups making up annual inflation, August 2026 | Twelve division contributions and a 0.1396 pp residual, summing to 5.6479% | Contributions are Fiscal.ge's approximation, not Geostat figures (severe); the residual is not a category |
| 33 | Change in annual inflation, August 2025 → August 2026 | +0.9983 percentage **points** | A point change between two published months |
| 34 | Highest annual price growth by division, August 2026 | Division 07 (transport) 15.1989%, then 04 (housing and utilities) 8.4682%, 12 (miscellaneous) 7.1272% | Twelve eligible divisions; the headline, target and residual are excluded |
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/factQuery/fixtures/referenceIntents.ts apps/web/tests/factQuery/reference.test.ts docs/data-methodology/ai-reference-intents.md
git commit -m "test(mcp): extend the reference fixture to inflation" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 8: `/connect`, llms.txt, schema-version mentions and scope docs

Tells people and agents that inflation is served, and records the approved scope change.

**Files:**
- Modify: `apps/web/lib/pages/connect.tsx`, `apps/web/lib/i18n/messages/en/connect.json`, `apps/web/lib/i18n/messages/ka/connect.json`
- Modify: `apps/web/public/llms.txt`, `apps/web/tests/seo/agentFiles.test.ts`
- Modify: `apps/web/tests/browser/connect.spec.ts`, `apps/web/tests/browser/bilingual-complete.spec.ts`
- Modify: `Project_Definition.md`, `docs/data-methodology/inflation-cpi-national.md`, `docs/deployment.md`
- Test: `apps/web/tests/seo/connect.test.tsx`

**Interfaces:**
- Consumes: `inflationCatalogueSeries`, `inflationDatasetPeriods` (Task 1); the three publications (Task 6).

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/seo/connect.test.tsx`:

```tsx
test.each(["ka", "en"] as const)("Connect advertises monthly inflation coverage and files in %s", async locale => {
  const messages = await getMessages(locale, ["common", "connect"]);
  const html = renderToStaticMarkup(<I18nProvider locale={locale} messages={messages}>{await renderConnectPage(locale)}</I18nProvider>);
  const coverage = html.match(/data-testid="connect-inflation-coverage">(.*?)<\/li>/)?.[1];
  expect(coverage).toContain("2013-01");
  expect(coverage).not.toContain("{");
  expect(html).toContain("query_inflation");
  for (const name of ["inflation-national.json", "inflation-categories.csv", "inflation-categories.json"]) {
    expect(html).toContain(`href="/downloads/data/${name}"`);
  }
  expect(html).toContain(`href="${locale === "en" ? "/en" : ""}/methodology/inflation"`);
  if (locale === "en") expect(coverage).not.toMatch(/\p{Script=Georgian}/u);
});
```

Run: `npm run data:prepare-fact-query-snapshot && npx vitest run tests/seo/connect.test.tsx`
Expected: FAIL — no `connect-inflation-coverage` element.

- [ ] **Step 2: Add the page copy**

In `apps/web/lib/i18n/messages/en/connect.json`, add:

```json
  "connect.inflationCoverage": "Consumer price inflation, monthly — {nationalRange}; {groupCount} COICOP groups; basket weights {weightRange}; contributions from {contributionStart}; National Bank of Georgia target from {targetStart}.",
  "connect.inflationQuery": "Use query_inflation with fromPeriod and toPeriod (YYYY-MM) and one measure: yoy_pct, mom_pct, avg12_pct, index_2010, target_pct, basket_weight_pct or contribution_pp. compare takes two months; rank orders divisions or subgroups in one month. Contributions are Fiscal.ge's approximation, not Geostat figures.",
  "connect.inflationCategoriesMetadata": "Categories metadata",
  "connect.inflationMethodology": "Inflation methodology",
```

and replace the `connect.notServed1` value with `"Quarterly and monthly data for any dataset other than inflation"`, and in `connect.languageContract` replace both `1.1.0` with `1.2.0`.

In `apps/web/lib/i18n/messages/ka/connect.json`, add:

```json
  "connect.inflationCoverage": "სამომხმარებლო ფასების ინფლაცია, თვიური — {nationalRange}; {groupCount} COICOP ჯგუფი; კალათის წილები {weightRange}; წვლილები {contributionStart}-დან; ეროვნული ბანკის მიზნობრივი მაჩვენებელი {targetStart}-დან.",
  "connect.inflationQuery": "query_inflation აბრუნებს fromPeriod-დან toPeriod-მდე (YYYY-MM) ერთ მაჩვენებელს: yoy_pct, mom_pct, avg12_pct, index_2010, target_pct, basket_weight_pct ან contribution_pp. compare ადარებს ორ თვეს; rank ალაგებს განყოფილებებს ან ქვეჯგუფებს ერთ თვეში. წვლილები Fiscal.ge-ის მიახლოებითი გაანგარიშებაა და საქსტატის მაჩვენებელი არ არის.",
  "connect.inflationCategoriesMetadata": "კატეგორიების მეტამონაცემები",
  "connect.inflationMethodology": "ინფლაციის მეთოდოლოგია",
```

and replace the `connect.notServed1` value with `"კვარტალური და თვიური მონაცემები — ინფლაციის გარდა"`, and in `connect.languageContract` replace both `1.1.0` with `1.2.0`.

- [ ] **Step 3: Render the inflation line**

In `apps/web/lib/pages/connect.tsx`:

1. Add `import { inflationCatalogueSeries, inflationDatasetPeriods } from "../factQuery/inflationData";`.
2. In `coverage()`'s return type, after `sectorRanges: Record<string, string>;` add:

```ts
  inflation: { nationalRange: string; groupCount: number; weightRange: string; contributionStart: string; targetStart: string };
```

3. In its returned object, directly before `municipalities: snapshot.municipal.municipalities.length,` add:

```ts
    inflation: (() => {
      const series = inflationCatalogueSeries(snapshot);
      const firstOf = (measure: string) =>
        series.map((entry) => entry.periodsByMeasure[measure]?.[0]).filter((period): period is string => period !== undefined).sort()[0]!;
      const [firstPeriod, lastPeriod] = inflationDatasetPeriods(snapshot);
      const years = snapshot.inflation.weights.map((row) => row.year);
      return {
        nationalRange: `${firstPeriod}–${lastPeriod}`,
        groupCount: snapshot.inflation.groups.length,
        weightRange: `${Math.min(...years)}–${Math.max(...years)}`,
        contributionStart: firstOf("contribution_pp"),
        targetStart: firstOf("target_pct"),
      };
    })(),
```

4. Replace `const { ranges, municipalities, regions, excludedCodes, sectorCount, sectorRanges } = coverage();` with `const { ranges, municipalities, regions, excludedCodes, sectorCount, sectorRanges, inflation } = coverage();`.
5. Directly after the line `<li data-testid="connect-sector-coverage">...</li>` add:

```tsx
                  <li data-testid="connect-inflation-coverage">{message(messages, "connect.inflationCoverage", { nationalRange: inflation.nationalRange, groupCount: inflation.groupCount, weightRange: inflation.weightRange, contributionStart: inflation.contributionStart, targetStart: inflation.targetStart })}</li>
```

6. Replace:

```tsx
                  <a className="underline" href={pageHref("/methodology/economic-sectors", locale)}>{message(messages, "connect.sectorMethodology")}</a>
                </p>
```

with:

```tsx
                  <a className="underline" href={pageHref("/methodology/economic-sectors", locale)}>{message(messages, "connect.sectorMethodology")}</a>
                </p>
                <p className="mt-3 text-[13px] leading-[1.8] text-[var(--body)]" data-testid="connect-inflation-discovery">
                  {message(messages, "connect.inflationQuery")}{" "}
                  <a className="underline" href="/downloads/data/inflation-national.json">JSON</a>{" · "}
                  <a className="underline" href="/downloads/data/inflation-categories.csv">CSV</a>{" · "}
                  <a className="underline" href="/downloads/data/inflation-categories.json">{message(messages, "connect.inflationCategoriesMetadata")}</a>{" · "}
                  <a className="underline" href={pageHref("/methodology/inflation", locale)}>{message(messages, "connect.inflationMethodology")}</a>
                </p>
```

Run: `npx vitest run tests/seo/connect.test.tsx tests/i18n`
Expected: PASS.

- [ ] **Step 4: Update llms.txt**

In `apps/web/public/llms.txt`:
1. Replace `the monthly inflation series are on the site and in their CSV, not in the MCP connection.` with `inflation is the one monthly dataset, served through the MCP connection and the bulk files below.`
2. After the bullet that ends `Regional queries, sector rankings and cumulative comparisons are unsupported.` add:

```markdown
- [Inflation, national](https://fiscal.ge/downloads/data/inflation-national.json) — monthly national CPI in every published measure, the National Bank of Georgia target and annual basket weights; each observation carries its `period` (YYYY-MM), unit, sources and caveats. Use `query_inflation`; 2.4 means 2.4%.
- [Inflation categories CSV](https://fiscal.ge/downloads/data/inflation-categories.csv) and [its metadata](https://fiscal.ge/downloads/data/inflation-categories.json) — COICOP group price changes and Fiscal.ge-derived contributions in percentage points, with a residual that closes each month on the published headline. Contributions are an approximation, not Geostat figures.
```

3. Replace `query_gdp, query_economic_sectors, compare` with `query_gdp, query_economic_sectors, query_inflation, compare`.
4. Replace `Schema 1.1.0 supplies reviewed` with `Schema 1.2.0 adds an optional period (YYYY-MM) on inflation observations and supplies reviewed`, and `schema 1.1.0 rather than` with `schema 1.2.0 rather than`.
5. After the example pair about the general government balance, add:

```markdown
- „რამდენი იყო წლიური ინფლაცია 2026 წლის აგვისტოში და რომელმა ჯგუფებმა შეადგინეს იგი?“ / “What was annual inflation in August 2026, and which groups made it up?”
```

In `apps/web/tests/seo/agentFiles.test.ts`, directly after `"https://fiscal.ge/downloads/data/economic-sectors.csv",` add:

```ts
  "https://fiscal.ge/downloads/data/inflation-national.json",
  "https://fiscal.ge/downloads/data/inflation-categories.csv",
  "https://fiscal.ge/downloads/data/inflation-categories.json",
```

Run: `npx vitest run tests/seo/agentFiles.test.ts`
Expected: PASS.

- [ ] **Step 5: Update browser specs pinning the schema version**

In `apps/web/tests/browser/connect.spec.ts` and `apps/web/tests/browser/bilingual-complete.spec.ts`, change `"1.1.0"` to `"1.2.0"`.

- [ ] **Step 6: Record scope, methodology and release notes**

In `Project_Definition.md`:
1. After the bullet `- Methodology page \`/methodology/inflation\` with the archived Geostat and NBG source files.` add:

```markdown
- Read-only MCP access and bulk publications for the inflation data above: `query_inflation`; inflation in `describe_coverage`, `get_sources`, `compare` and `rank`; and `inflation-national.json`, `inflation-categories.csv` and `inflation-categories.json`. Approved 2026-09-14 (`docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`).
```

2. In the `Still excluded:` line, delete `MCP intents and JSON publications for inflation, `.
3. Replace `- Any dataset V1 does not already serve, including quarterly and monthly data,` with `- Any dataset V1 does not already serve, including quarterly and monthly data (inflation: see 2C),`.

In `docs/data-methodology/inflation-cpi-national.md`:
1. Replace `although MCP serves no inflation figures` with `and MCP serves the figures through \`query_inflation\``.
2. After the Serving paragraph ending `(\`data:check-inflation-public\` in \`postbuild\`).` add:

```markdown

The fact-query snapshot carries all four tables. `query_inflation`, `describe_coverage`, `get_sources`, `compare` and `rank` answer from it, and `inflation-national.json`, `inflation-categories.csv` and `inflation-categories.json` are published beside the manifest. MCP contributions come from the same `buildContributionIndex` as the page, and each carries the severe `inflation_contribution_derived` caveat (`ai-grounding-and-caveats.md`). Design: `docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`.
```

In `docs/deployment.md`, after the paragraph ending `preliminary values are not forecasts or planned budgets.` add:

```markdown

The inflation MCP addition (`docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`) brings the endpoint to twelve tools with `query_inflation`, moves the schema to 1.2.0 (an additive `period` on monthly observations, comparison endpoints and ranking entries), and adds `inflation-national.json`, `inflation-categories.csv` and `inflation-categories.json` to the manifest. The packaged snapshot grows to roughly 8 MB. After deployment, verify the deployed commit; that `tools/list` on `https://fiscal.ge/mcp` includes `query_inflation`; one real call each of `query_inflation`, `compare` with an inflation target and `rank` with `datasetId: "inflation"`; and that the three files are served with the manifest's hashes.
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/pages/connect.tsx apps/web/lib/i18n/messages apps/web/public/llms.txt apps/web/tests/seo apps/web/tests/browser Project_Definition.md docs/data-methodology/inflation-cpi-national.md docs/deployment.md
git commit -m "docs(mcp): advertise inflation on /connect and llms.txt and record its scope" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 9: Done-check

Runs every gate once, against the finished change.

**Files:** none changed unless a gate fails.

- [ ] **Step 1: Reference fixture**

Run: `npx vitest run tests/factQuery/reference.test.ts`
Expected: 34 intents PASS. A disagreement is a stop condition: report it.

- [ ] **Step 2: Full check**

Run: `npm run check`
Expected: lint, typecheck, unit tests, `data:validate` (including `data:check-fact-query-snapshot`) and `i18n:check` all PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS, including the post-build `data:check-fact-query-publications` over the three inflation files.

- [ ] **Step 4: Browser suite against the build**

`/connect` changed, so run the browser suite against the production bundle (four workers):

```bash
npm run start -- --port 3100
```

in one terminal, then:

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: every spec PASS. If `municipal-entity.spec.ts`'s "sourced percentage workbook" download times out, rerun that spec alone before treating it as a regression.

- [ ] **Step 5: Hand-check one live-shaped call**

With the server from Step 4 running and `MCP_ENABLED=true` set for it, POST a `tools/call` for `query_inflation` (`cpi.headline`, `yoy_pct`, `2026-08`–`2026-08`) to `http://localhost:3100/mcp` with `accept: application/json, text/event-stream`, and confirm the text shows 5.6479 with its Georgian and English definitions and sources.

- [ ] **Step 6: Report, then deliver on request**

Report the gate results. Pushing, opening a PR and merging need the user's go-ahead. This branch sits on the GDP/sectors fix (PR #118); rebase onto `main` after #118 merges so the inflation PR contains only its own commits.
