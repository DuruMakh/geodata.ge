import { buildProductIndex, packProductFacts, productAnnual, productCumulative, type ProductIndex } from "../explorer/inflationProducts";
import { makePeriod, periodKey, periodYear } from "../data/inflation/periods";
import type { PeriodRange } from "./inflationData";
import type { QueryInflationProductsInput } from "./schemas";
import { PRODUCT_QUERY_MEASURES, type ProductQueryMeasure } from "./inflationProductSeries";
import { serviceMessage } from "./localization";
import { selectSources } from "./sources";
import type { FactQuerySnapshot } from "./types";

const indexCache = new WeakMap<FactQuerySnapshot, ProductIndex>();

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
