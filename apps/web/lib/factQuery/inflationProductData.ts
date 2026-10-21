import { buildProductIndex, packProductFacts, productAnnual, productCumulative, type ProductIndex } from "../explorer/inflationProducts";
import { makePeriod, periodKey, periodYear } from "../data/inflation/periods";
import type { PeriodRange } from "./inflationData";
import { queryInflationProductsInput, type QueryInflationProductsInput } from "./schemas";
import { PRODUCT_QUERY_MEASURES, type ProductQueryMeasure } from "./inflationProductSeries";
import { serviceMessage } from "./localization";
import { selectSources } from "./sources";
import type { FactQuerySnapshot } from "./types";

type CoverageSummary = { readonly first: number; readonly last: number; readonly years: readonly number[] };
type ProductCache = {
  index?: ProductIndex;
  catalogue?: ReturnType<typeof buildProductCatalogue>;
  annual: Map<string, CoverageSummary>;
  cumulative: Map<number, Map<string, CoverageSummary>>;
};
const snapshotCache = new WeakMap<FactQuerySnapshot, ProductCache>();
function productCache(snapshot: FactQuerySnapshot): ProductCache {
  let cache = snapshotCache.get(snapshot);
  if (!cache) {
    cache = { annual: new Map(), cumulative: new Map() };
    snapshotCache.set(snapshot, cache);
  }
  return cache;
}

/** A response-specific derivation view; registered originals stay unchanged. */
export function inflationProductSources(snapshot: FactQuerySnapshot, measure: ProductQueryMeasure) {
  const sources = selectSources(snapshot, [measure === "yoy_pct" ? "source.geostat_product_yoy" : "source.geostat_product_mom"]);
  return measure === "yoy_pct" ? sources : sources.map(source => ({
    ...source,
    derivation: serviceMessage(snapshot, "ka", "definitions.inflationProductCumulativeSource"),
    derivationKa: serviceMessage(snapshot, "ka", "definitions.inflationProductCumulativeSource"),
    derivationEn: serviceMessage(snapshot, "en", "definitions.inflationProductCumulativeSource"),
    documents: source.documents.map(document => ({ ...document, role: "derivation_upstream" as const })),
  }));
}

/** Cumulative spans describe published inputs, conditional on the chosen startYear. */
export function inflationProductCatalogue(snapshot: FactQuerySnapshot) {
  const cache = productCache(snapshot);
  cache.catalogue ??= buildProductCatalogue(snapshot);
  // All nested arrays/notes belong to the caller; cached factual summaries
  // never escape or borrow mutable arrays from the snapshot.
  return structuredClone(cache.catalogue);
}

function buildProductCatalogue(snapshot: FactQuerySnapshot) {
  const byProduct = new Map<string, Record<ProductQueryMeasure, string[]>>();
  for (const fact of snapshot.inflationProducts.facts) {
    if (fact.index100 === null) continue;
    const periods = byProduct.get(fact.productId) ?? { yoy_pct: [], cumulative_pct: [] };
    periods[fact.measure === "yoy_index_100" ? "yoy_pct" : "cumulative_pct"].push(fact.period);
    byProduct.set(fact.productId, periods);
  }
  return snapshot.inflationProducts.catalogue.map(product => {
    const periods = byProduct.get(product.productId) ?? { yoy_pct: [], cumulative_pct: [] };
    const yearsByMeasure: Record<string, number[]> = {};
    const periodsByMeasure: Record<string, [string, string]> = {};
    for (const measure of PRODUCT_QUERY_MEASURES) {
      const sorted = periods[measure].sort();
      yearsByMeasure[measure] = [...new Set(sorted.map(period => Number(period.slice(0, 4))))].sort((a, b) => a - b);
      if (sorted.length) periodsByMeasure[measure] = [sorted[0]!, sorted.at(-1)!];
    }
    const all = [...periods.yoy_pct, ...periods.cumulative_pct].sort();
    const historyNotes = snapshot.inflationProducts.historyNotes.filter(note => note.productId === product.productId)
      .map(({ boundaryYear, noteKa, noteEn }) => ({ boundaryYear, noteKa, noteEn }));
    return {
      seriesId: product.productId, labelKa: product.labelKa, labelEn: product.labelEn,
      level: "product", parentSeriesId: null, availability: all.length ? "served" as const : "taxonomy_only" as const,
      coicopCode: product.coicopCode, firstPeriod: product.firstPeriod, measures: [...PRODUCT_QUERY_MEASURES],
      years: [...new Set(all.map(period => Number(period.slice(0, 4))))].sort((a, b) => a - b),
      yearsByMeasure, periodsByMeasure,
      ...(all.length ? { periods: [all[0]!, all.at(-1)!] as [string, string] } : {}),
      ...(historyNotes.length ? { historyNotes } : {}),
    };
  });
}

export function inflationProductIndex(snapshot: FactQuerySnapshot): ProductIndex {
  const cache = productCache(snapshot);
  return cache.index ??= buildProductIndex(snapshot.inflationProducts.catalogue, packProductFacts(snapshot.inflationProducts.facts));
}

/** Aggregate available span for selected products; gaps and individual late starts remain possible. */
export function productQueryCoverage(snapshot: FactQuerySnapshot, input: QueryInflationProductsInput): { availablePeriods: PeriodRange | null; availableYears: number[] } {
  const index = inflationProductIndex(snapshot);
  // Query callers already validate these fields. Keep this internal entry
  // bounded too: unsupported requests must never create cache keys.
  const firstPeriod = Math.min(...[...index.annual.values(), ...index.monthly.values()].map(run => run.start));
  if (!queryInflationProductsInput.safeParse(input).success
    || (input.expectedDataVersion !== undefined && input.expectedDataVersion !== snapshot.dataVersion)
    || input.seriesIds.some(id => !index.productById.has(id))
    || input.fromPeriod < periodKey(firstPeriod) || input.toPeriod > periodKey(index.latestPeriod)
    || (input.startYear !== undefined && (input.startYear < index.earliestYear || input.startYear > periodYear(index.latestPeriod)))) {
    return { availablePeriods: null, availableYears: [] };
  }
  const cache = productCache(snapshot);
  let summaries = cache.annual;
  if (input.measure === "cumulative_pct") {
    summaries = cache.cumulative.get(input.startYear!) ?? new Map();
    cache.cumulative.set(input.startYear!, summaries);
  }
  const years = new Set<number>();
  let first = Infinity;
  let last = -Infinity;
  for (const id of input.seriesIds) {
    let summary = summaries.get(id);
    if (!summary) {
      const run = (input.measure === "yoy_pct" ? index.annual : index.monthly).get(id);
      let productFirst = Infinity;
      let productLast = -Infinity;
      const productYears = new Set<number>();
      if (run) {
        const start = input.measure === "cumulative_pct" ? Math.max(run.start, makePeriod(input.startYear!, 1)) : run.start;
        for (let period = start; period < run.start + run.values.length; period++) {
          const value = input.measure === "yoy_pct" ? productAnnual(index, id, period) : productCumulative(index, id, input.startYear!, period).value;
          if (value === null) continue;
          productFirst = Math.min(productFirst, period);
          productLast = Math.max(productLast, period);
          productYears.add(periodYear(period));
        }
      }
      summary = Object.freeze({ first: productFirst, last: productLast, years: Object.freeze([...productYears].sort((a, b) => a - b)) });
      summaries.set(id, summary);
    }
    first = Math.min(first, summary.first);
    last = Math.max(last, summary.last);
    for (const year of summary.years) years.add(year);
  }
  return { availablePeriods: first === Infinity ? null : [periodKey(first), periodKey(last)], availableYears: [...years].sort((a, b) => a - b) };
}
