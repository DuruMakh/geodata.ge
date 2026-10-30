// One chosen year's view of the year-review data: pure arithmetic the page runs in the browser as the year
// ruler moves. Shares and changes are fractions (formatShare); the average interest rate stays in percent, as served.
// Shares of the grid, the treemap and the long view are of the positive drawn sum; the ranking's are of the true total.

import { wholePercents } from "../explorer/format";
import { squarify, type TreemapRect } from "../explorer/treemapLayout";
import { REVENUE_BANDS } from "../landing/chapters/budgetSeries";
import type { Category, Values, YearReviewData } from "./types";

export type Picked<T> = { year: number; value: T; fallback: boolean }; // fallback: year !== chosen year
export type Grouping = "fields" | "institutions";

const SOCIAL_BENEFITS_ID = "spending_type.social_benefits";
export const TREEMAP_WIDTH = 1000; // buysView's layout box, in the units of its rects
export const TREEMAP_HEIGHT = 430;

const valueAt = (years: readonly number[], values: Values, year: number): number | null => values[years.indexOf(year)] ?? null;

/** Per position: the sum of the non-null values, null where every one is null. */
function sumOf(series: readonly Values[], length: number): Values {
  return Array.from({ length }, (_, index) => {
    const present = series.map((values) => values[index]).filter((value): value is number => value !== null && value !== undefined);
    return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0);
  });
}

/** `values` (aligned to `from`) re-aligned to `years`, null where `from` has no such year. */
export const onYears = (years: readonly number[], from: readonly number[], values: Values): Values => years.map((year) => valueAt(from, values, year));

/** Per position: the first series' value where every series has one, else null, so a nearest year has every part. */
export function whereAll(series: readonly Values[]): Values {
  return series[0]!.map((value, index) => (series.every((values) => values[index] !== null && values[index] !== undefined) ? value : null));
}

/** Per position: the sum of the series, null where any one is missing. */
export const sumAll = (series: readonly Values[]): Values =>
  whereAll(series).map((value, index) => (value === null ? null : series.reduce((sum, values) => sum + values[index]!, 0)));

/** Per year: `values` divided by the population of that year, null where either is missing. */
function perResident(data: YearReviewData, years: readonly number[], values: Values): Values {
  return years.map((year, index) => {
    const value = values[index];
    const population = valueAt(data.budget.years, data.budget.population, year);
    return value === null || value === undefined || !population ? null : value / population;
  });
}

/** Growth from a non-positive base (revenue.other_taxes 2019–2020) or to a negative value is not shown. */
function change(value: number | null, previous: number | null): number | null {
  return previous === null || previous <= 0 || value === null || value < 0 ? null : value / previous - 1;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** The chosen year if it has a value; else the nearest earlier year with one; else the nearest later one. */
export function nearestYear(years: number[], values: Values, chosen: number): number | null {
  const present = years.filter((_, index) => values[index] !== null && values[index] !== undefined);
  return present.findLast((year) => year <= chosen) ?? present.find((year) => year > chosen) ?? null;
}

export function picked(what: string, years: number[], values: Values, chosen: number): { year: number; index: number; fallback: boolean } {
  const year = nearestYear(years, values, chosen);
  if (year === null) throw new Error(`Year in review: ${what} has no value in any year`);
  return { year, index: years.indexOf(year), fallback: year !== chosen };
}

/** Whole cells of 100 per item, largest remainder, ties to the earlier item; a value of zero or less gets none. */
export function hundredCells(values: number[]): number[] {
  return wholePercents(values.map((value) => Math.max(0, value)));
}

/** The position of a budget year; the ruler only offers budget years, so any other year is a caller error. */
function budgetIndex(data: YearReviewData, year: number): number {
  const index = data.budget.years.indexOf(year);
  if (index < 0) throw new Error(`Year in review: ${year} is not a state-budget year`);
  return index;
}

export const groupOf = (data: YearReviewData, grouping: Grouping): Category[] =>
  grouping === "fields" ? data.budget.fields : data.budget.institutions;
export const spendTotals = (data: YearReviewData): Values => sumOf(data.budget.fields.map((field) => field.values), data.budget.years.length);
export const taxTotals = (data: YearReviewData): Values =>
  sumOf(data.budget.receipts.filter((receipt) => receipt.tax).map((receipt) => receipt.values), data.budget.years.length);

export type GlanceKpi = {
  id: "spend" | "tax" | "balance" | "debt" | "breaks" | "perResident";
  year: number;
  fallback: boolean;
  value: number;
  planned: boolean;
  previous: { year: number; value: number } | null;
  spark: Values;
  sparkIndex: number;
};

/** The six headline numbers, each in its dataset's nearest year to the chosen one. */
export function glanceKpis(data: YearReviewData, year: number): GlanceKpi[] {
  const { budget, balance, debt, taxBreaks } = data;
  const spend = spendTotals(data);
  const kpi = (id: GlanceKpi["id"], years: number[], values: Values, planned: readonly boolean[] | null): GlanceKpi => {
    const used = picked(id, years, values, year);
    const previous = used.index > 0 ? values[used.index - 1] ?? null : null;
    return {
      id,
      year: used.year,
      fallback: used.fallback,
      value: values[used.index]!,
      planned: planned?.[used.index] ?? false,
      previous: previous === null ? null : { year: years[used.index - 1]!, value: previous },
      spark: values,
      sparkIndex: used.index,
    };
  };
  return [
    kpi("spend", budget.years, spend, budget.planned),
    kpi("tax", budget.years, taxTotals(data), budget.planned),
    kpi("balance", balance.years, balance.pctGdp, balance.projection),
    kpi("debt", debt.stock.years, debt.stock.total, null),
    kpi("breaks", taxBreaks.years, taxBreaks.all, null),
    kpi("perResident", budget.years, perResident(data, budget.years, spend), budget.planned),
  ];
}

export type BalanceRecord = { kind: "surplus" } | { kind: "smallestSince" | "largestSince"; since: number } | { kind: "smallestEver" | "largestEver" };

/**
 * The record phrase for the balance: against every earlier actual year (projections never count). A deficit smaller
 * than the last actual year's is the smallest since the last year at least as small; otherwise the largest since the
 * last year at least as deep.
 */
export function balanceRecord(data: YearReviewData, year: number): BalanceRecord {
  const { years, pctGdp, projection } = data.balance;
  const used = picked("balance", years, pctGdp, year);
  const value = pctGdp[used.index]!;
  if (value > 0) return { kind: "surplus" };
  const earlier = years.flatMap((other, index) =>
    other < used.year && !projection[index] && pctGdp[index] !== null ? [{ year: other, value: pctGdp[index]! }] : [],
  );
  const previous = earlier.at(-1);
  if (previous && value > previous.value) {
    const since = earlier.findLast((other) => other.value >= value);
    return since ? { kind: "smallestSince", since: since.year } : { kind: "smallestEver" };
  }
  const since = earlier.findLast((other) => other.value <= value);
  return since ? { kind: "largestSince", since: since.year } : { kind: "largestEver" };
}

export type WhereView = {
  items: { id: string; label: string; color: string; value: number; share: number; change: number | null; cells: number; spark: Values }[];
  cells: string[]; // 100 ids in rank order
  thenYear: number;
  thenCells: string[];
  total: number;
  planned: boolean;
};

/** The year's categories, largest first, a negative one included with no cells. */
function ranked(categories: readonly Category[], index: number) {
  return categories
    .flatMap((category) => {
      const value = category.values[index] ?? null;
      return value === null || value === 0 ? [] : [{ category, value }];
    })
    .sort((left, right) => right.value - left.value);
}

const cellIds = (rows: readonly { id: string; cells: number }[]) => rows.flatMap((row) => Array<string>(row.cells).fill(row.id));

/** Every 100 GEL of the chosen year, and the same grid in the grouping's first year (or, from that year, the last actual one). */
export function whereView(data: YearReviewData, grouping: Grouping, year: number): WhereView {
  const { years, planned } = data.budget;
  const categories = groupOf(data, grouping);
  const index = budgetIndex(data, year);
  const rows = ranked(categories, index);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const cells = hundredCells(rows.map((row) => row.value));
  const items = rows.map(({ category, value }, rank) => ({
    id: category.id,
    label: category.label,
    color: category.color,
    value,
    share: value / total,
    change: index > 0 ? change(value, category.values[index - 1] ?? null) : null,
    cells: cells[rank]!,
    spark: category.values,
  }));

  // The first year the grouping has a positive value; when that is the chosen year, the last actual year instead.
  const firstIndex = years.findIndex((_, position) => categories.some((category) => (category.values[position] ?? 0) > 0));
  const thenIndex = index <= firstIndex ? planned.findLastIndex((plan) => !plan) : firstIndex;
  const then = ranked(categories, thenIndex).filter((row) => row.value > 0);
  const thenCells = hundredCells(then.map((row) => row.value));
  return {
    items,
    cells: cellIds(items),
    thenYear: years[thenIndex]!,
    thenCells: cellIds(then.map((row, rank) => ({ id: row.category.id, cells: thenCells[rank]! }))),
    total,
    planned: planned[index]!,
  };
}

export type ChangeView =
  | { none: true }
  | {
      none: false;
      previousYear: number;
      basis: "actual" | "planVsActual";
      total: number;
      totalPct: number;
      rows: { id: string; label: string; color: string; delta: number | null; pct: number | null }[];
      topUp: string | null;
      topDown: string | null;
      upShare: number | null;
    };

/** Change on the year before, per category with a value in the chosen year; one without a previous value has no change. */
export function changeView(data: YearReviewData, grouping: Grouping, year: number): ChangeView {
  const { years, planned } = data.budget;
  const index = budgetIndex(data, year);
  if (index === 0) return { none: true };
  const categories = groupOf(data, grouping);
  const totals = sumOf(categories.map((category) => category.values), years.length);
  const now = totals[index] ?? 0;
  const before = totals[index - 1] ?? 0;
  const total = now - before;

  const rows = categories
    .flatMap((category) => {
      const value = category.values[index] ?? null;
      const previous = category.values[index - 1] ?? null;
      if (value === null || (value === 0 && previous === 0)) return [];
      return [{
        id: category.id,
        label: category.label,
        color: category.color,
        delta: previous === null ? null : value - previous,
        pct: change(value, previous),
      }];
    })
    .sort((left, right) => {
      if (left.delta === null || right.delta === null) return (left.delta === null ? 1 : 0) - (right.delta === null ? 1 : 0);
      return right.delta - left.delta;
    });
  const changed = rows.filter((row): row is (typeof rows)[number] & { delta: number } => row.delta !== null);
  const largest = changed[0];
  const smallest = changed.at(-1);
  const up = largest && largest.delta > 0 ? largest : null;
  const down = smallest && smallest.delta < 0 ? smallest : null;

  return {
    none: false,
    previousYear: years[index - 1]!,
    basis: planned[index] ? "planVsActual" : "actual",
    total,
    totalPct: total / before,
    rows,
    topUp: up?.id ?? null,
    topDown: down?.id ?? null,
    upShare: up && total > 0 && up.delta <= total ? up.delta / total : null,
  };
}

export type BuysView = Picked<{
  total: number;
  tiles: { id: string; label: string; color: string; value: number; share: number; change: number | null; rect: TreemapRect }[];
}>;

/** General-government spending by type, squarified over 1000×430; the page lists tiles under 3% instead of labelling them. */
export function buysView(data: YearReviewData, year: number): BuysView {
  const { years, total: totals, types } = data.spendingTypes;
  const used = picked("spending by type", years, totals, year);
  const tiles = types
    .flatMap((type) => {
      const value = type.values[used.index] ?? null;
      return value !== null && value > 0 ? [{ type, value }] : [];
    })
    .sort((left, right) => right.value - left.value);
  const total = tiles.reduce((sum, tile) => sum + tile.value, 0);
  const rects = squarify(tiles.map((tile) => tile.value), 0, 0, TREEMAP_WIDTH, TREEMAP_HEIGHT);
  return {
    year: used.year,
    fallback: used.fallback,
    value: {
      total,
      tiles: tiles.map(({ type, value }, position) => ({
        id: type.id,
        label: type.label,
        color: type.color,
        value,
        share: value / total,
        change: used.index > 0 ? change(value, type.values[used.index - 1] ?? null) : null,
        rect: rects[position]!,
      })),
    },
  };
}

/** [collected, given up] for VAT, income and profit tax, and all taxes, in the nearest year that has all six. */
export function givesUpView(
  data: YearReviewData,
  year: number,
): Picked<{ vat: [number, number]; income: [number, number]; all: [number, number]; per100: { vat: number; income: number; all: number } }> {
  const { budget, taxBreaks } = data;
  const receipt = (id: string) => onYears(taxBreaks.years, budget.years, budget.receipts.find((row) => row.id === id)?.values ?? []);
  const collectedVat = sumAll(REVENUE_BANDS.vat.map(receipt));
  const collectedIncome = sumAll([...REVENUE_BANDS.income, ...REVENUE_BANDS.profit].map(receipt));
  const collectedAll = onYears(taxBreaks.years, budget.years, taxTotals(data));
  const parts = [collectedVat, taxBreaks.vat, collectedIncome, taxBreaks.income, collectedAll, taxBreaks.all];
  const used = picked("tax breaks", taxBreaks.years, whereAll(parts), year);
  const pair = (collected: Values, given: Values): [number, number] => [collected[used.index]!, given[used.index]!];
  const vat = pair(collectedVat, taxBreaks.vat);
  const income = pair(collectedIncome, taxBreaks.income);
  const all = pair(collectedAll, taxBreaks.all);
  const per100 = ([got, given]: [number, number]) => (given / got) * 100;
  return { year: used.year, fallback: used.fallback, value: { vat, income, all, per100: { vat: per100(vat), income: per100(income), all: per100(all) } } };
}

/** Tax refunds in the nearest year that also has tax revenue, their share of it, and whether they top every earlier year. */
export function refundsView(data: YearReviewData, year: number): Picked<{ value: number; shareOfTax: number; record: boolean }> {
  const { years, values } = data.refunds;
  const tax = onYears(years, data.budget.years, taxTotals(data));
  const used = picked("tax refunds", years, whereAll([values, tax]), year);
  const value = values[used.index]!;
  const earlier = values.slice(0, used.index).filter((other): other is number => other !== null);
  return {
    year: used.year,
    fallback: used.fallback,
    value: {
      value,
      shareOfTax: value / tax[used.index]!,
      record: earlier.length > 0 && earlier.every((other) => other < value),
    },
  };
}

/** Debt at the end of the nearest year with all three stock figures; GDP, population and the average rate of that same year, null where missing. */
export function debtView(
  data: YearReviewData,
  year: number,
): Picked<{ total: number; external: number; domestic: number; toGdp: number | null; perResident: number | null; rate: number | null }> {
  const { stock, rates } = data.debt;
  const used = picked("debt", stock.years, whereAll([stock.total, stock.external, stock.domestic]), year);
  const total = stock.total[used.index]!;
  const gdp = valueAt(data.budget.years, data.budget.gdp, used.year);
  return {
    year: used.year,
    fallback: used.fallback,
    value: {
      total,
      external: stock.external[used.index]!,
      domestic: stock.domestic[used.index]!,
      toGdp: gdp ? total / gdp : null,
      perResident: perResident(data, [used.year], [total])[0] ?? null,
      rate: valueAt(rates.years, rates.total, used.year),
    },
  };
}

/**
 * The ledger: six GEL-per-resident figures, each from its own dataset in its nearest year; municipal is the median place.
 * `planned`: the value comes from a planned budget year or a debt-service projection year.
 */
export function perResidentRows(
  data: YearReviewData,
  year: number,
): { id: "spend" | "tax" | "debt" | "svc" | "soc" | "mun"; value: number; year: number; fallback: boolean; planned: boolean }[] {
  const { budget, debt, spendingTypes, municipal } = data;
  const row = (id: "spend" | "tax" | "debt" | "svc" | "soc", years: number[], values: Values, planned: readonly boolean[] | null) => {
    const series = perResident(data, years, values);
    const used = picked(`${id} per resident`, years, series, year);
    return { id, value: series[used.index]!, year: used.year, fallback: used.fallback, planned: planned?.[used.index] ?? false };
  };
  const service = sumAll([debt.service.principal, debt.service.interest]);
  const social = spendingTypes.types.find((type) => type.id === SOCIAL_BENEFITS_ID);
  if (!social) throw new Error(`Year in review: spending type ${SOCIAL_BENEFITS_ID} is missing`);
  return [
    row("spend", budget.years, spendTotals(data), budget.planned),
    row("tax", budget.years, taxTotals(data), budget.planned),
    row("debt", debt.stock.years, debt.stock.total, null),
    row("svc", debt.service.years, service, debt.service.projection),
    row("soc", spendingTypes.years, social.values, null),
    {
      id: "mun",
      value: median(municipal.places.map((place) => place.perResidentGel)),
      year: municipal.year,
      fallback: municipal.year !== year,
      planned: false,
    },
  ];
}

/**
 * Each region's average (its municipalities' total over their residents), highest first, and the median municipality.
 * Municipalities only: unlike the Municipalities page's Adjara row, the Autonomous Republic's budget is not added.
 */
export function regionsView(data: YearReviewData): {
  median: number;
  regions: { id: string; label: string; average: number; places: YearReviewData["municipal"]["places"] }[];
} {
  const { regions, places } = data.municipal;
  return {
    median: median(places.map((place) => place.perResidentGel)),
    regions: regions
      .map((region) => {
        const own = places.filter((place) => place.regionId === region.id);
        const total = own.reduce((sum, place) => sum + place.totalGel, 0);
        const residents = own.reduce((sum, place) => sum + place.totalGel / place.perResidentGel, 0);
        return { id: region.id, label: region.label, average: total / residents, places: own };
      })
      .filter((region) => region.places.length > 0)
      .sort((left, right) => right.average - left.average),
  };
}

export type LongView = {
  years: number[];
  planned: boolean[];
  bands: { id: string; label: string; color: string; values: number[] }[];
  top: number[]; // per year: the height of the stack (1 for shares)
  gain: { id: string; from: number; to: number } | null;
  loss: { id: string; from: number; to: number } | null;
};

/**
 * Every category of the side (expenditure in the chosen grouping) over the years it has data, as stacked bands of shares or GEL; a negative or missing value
 * counts as 0. Gain and loss compare shares in the first year with the last actual year.
 */
export function longView(data: YearReviewData, grouping: Grouping, side: "expenditure" | "revenue", measure: "share" | "gel"): LongView {
  const { budget } = data;
  const categories: Category[] = side === "expenditure" ? groupOf(data, grouping) : budget.receipts;
  const present = budget.years.map((_, index) => categories.some((category) => category.values[index] !== null));
  const first = present.indexOf(true);
  const last = present.lastIndexOf(true);
  const positions = budget.years.map((_, index) => index).slice(first, last + 1);
  const drawn = (category: Category, index: number) => Math.max(0, category.values[index] ?? 0);
  const totals = positions.map((index) => categories.reduce((sum, category) => sum + drawn(category, index), 0));
  const share = (category: Category, index: number, total: number) => (total > 0 ? drawn(category, index) / total : 0);

  const bands = categories.map((category) => ({
    id: category.id,
    label: category.label,
    color: category.color,
    values: positions.map((index, column) => (measure === "share" ? share(category, index, totals[column]!) : drawn(category, index))),
  }));

  const lastActual = positions.findLastIndex((index) => !budget.planned[index]);
  const moves = categories
    .filter((category) => category.values[positions[0]!] !== null && category.values[positions[lastActual]!] !== null)
    .map((category) => ({
      id: category.id,
      from: share(category, positions[0]!, totals[0]!),
      to: share(category, positions[lastActual]!, totals[lastActual]!),
    }))
    .sort((left, right) => right.to - right.from - (left.to - left.from));
  const most = moves[0];
  const least = moves.at(-1);

  return {
    years: positions.map((index) => budget.years[index]!),
    planned: positions.map((index) => budget.planned[index] ?? false),
    bands,
    top: positions.map((_, column) => bands.reduce((sum, band) => sum + band.values[column]!, 0)),
    gain: most && most.to > most.from ? most : null,
    loss: least && least.to < least.from ? least : null,
  };
}
