import { buildProductIndex, packProductFacts, productAnnual, productCumulative, type ProductIndex } from "../explorer/inflationProducts";
import { makePeriod, periodKey, periodYear } from "../data/inflation/periods";
import type { PeriodRange } from "./inflationData";
import type { QueryInflationProductsInput } from "./schemas";
import type { FactQuerySnapshot } from "./types";

const indexCache = new WeakMap<FactQuerySnapshot, ProductIndex>();

export function inflationProductIndex(snapshot: FactQuerySnapshot): ProductIndex {
  let index = indexCache.get(snapshot);
  if (index === undefined) {
    index = buildProductIndex(snapshot.inflationProducts.catalogue, packProductFacts(snapshot.inflationProducts.facts));
    indexCache.set(snapshot, index);
  }
  return index;
}

/** Aggregate available span for selected products; gaps and individual late starts remain possible. */
export function productQueryCoverage(snapshot: FactQuerySnapshot, input: QueryInflationProductsInput): { availablePeriods: PeriodRange | null; availableYears: number[] } {
  const index = inflationProductIndex(snapshot);
  const years = new Set<number>();
  let first = Infinity;
  let last = -Infinity;
  for (const id of input.seriesIds) {
    const run = (input.measure === "yoy_pct" ? index.annual : index.monthly).get(id);
    if (!run) continue;
    const start = input.measure === "cumulative_pct" ? Math.max(run.start, makePeriod(input.startYear!, 1)) : run.start;
    for (let period = start; period < run.start + run.values.length; period++) {
      const value = input.measure === "yoy_pct" ? productAnnual(index, id, period) : productCumulative(index, id, input.startYear!, period).value;
      if (value === null) continue;
      first = Math.min(first, period);
      last = Math.max(last, period);
      years.add(periodYear(period));
    }
  }
  return { availablePeriods: first === Infinity ? null : [periodKey(first), periodKey(last)], availableYears: [...years].sort((a, b) => a - b) };
}
