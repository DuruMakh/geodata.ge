import { periodFromKey, periodKey } from "../data/inflation/periods";
import { productAnnual, productCumulative } from "../explorer/inflationProducts";
import { CAVEAT_RULES, evaluateCaveats } from "./caveats";
import { periodsBetween, yearOfPeriod } from "./inflationData";
import { inflationProductIndex, productQueryCoverage } from "./inflationProductData";
import { PRODUCT_DATASET_ID } from "./inflationProductSeries";
import { serviceMessage, type ServiceMessageKey } from "./localization";
import { buildResponseMeta } from "./meta";
import { buildObservationId, caveatIdsForObservation, countryLevelCaveatContext, resolveDocumentIds, type Observation } from "./observations";
import { queryInflationProductsInput, type QueryInflationProductsInput } from "./schemas";
import { selectSources } from "./sources";
import type { FactQueryError, FactQueryResponse, FactQuerySnapshot } from "./types";

/** Returned cells only; the preceding compounding inputs do not consume the output allowance. */
export function productQueryCellCount(input: Pick<QueryInflationProductsInput, "seriesIds" | "fromPeriod" | "toPeriod">): number {
  try {
    return Math.max(0, periodFromKey(input.toPeriod) - periodFromKey(input.fromPeriod) + 1) * input.seriesIds.length;
  } catch {
    return 0;
  }
}

export function queryInflationProducts(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const bilingual = (key: ServiceMessageKey, values: Record<string, string | number> = {}) => ({
    messageKa: serviceMessage(snapshot, "ka", key, values), messageEn: serviceMessage(snapshot, "en", key, values),
  });
  const error = (code: FactQueryError["code"], key: ServiceMessageKey, values: Record<string, string | number> = {}, validChoices?: string[]): FactQueryResponse => ({
    kind: "error", status: "error", error: { code, ...bilingual(key, values), retryable: false, ...(validChoices ? { validChoices } : {}) }, meta: buildResponseMeta(snapshot),
  });
  const parsed = queryInflationProductsInput.safeParse(rawInput);
  if (!parsed.success) return error("invalid_parameters", "errors.invalidParameters", { issues: parsed.error.issues.map(issue => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ") });
  const input = parsed.data;
  if (input.expectedDataVersion !== undefined && input.expectedDataVersion !== snapshot.dataVersion) return error("data_version_changed", "errors.dataVersionChanged");
  const index = inflationProductIndex(snapshot);
  const unknown = input.seriesIds.filter(id => !index.productById.has(id));
  if (unknown.length) return error("unknown_series", "errors.unknownSeries", { unknownSeriesIds: unknown.join(", ") }, [...index.productById.keys()].sort().slice(0, 20));
  const first = periodKey(Math.min(...[...index.annual.values(), ...index.monthly.values()].map(run => run.start)));
  const last = periodKey(index.latestPeriod);
  if (input.fromPeriod < first || input.toPeriod > last) return error("year_out_of_range", "errors.periodsOutOfRange", {
    outOfRangePeriods: [input.fromPeriod, input.toPeriod].filter(period => period < first || period > last).join(", "), first, last,
  });
  if (input.startYear !== undefined && input.startYear < yearOfPeriod(first)) return error("year_out_of_range", "errors.yearsOutOfRange", { outOfRangeYears: input.startYear, minYear: yearOfPeriod(first), maxYear: yearOfPeriod(last) });
  const periods = periodsBetween(input.fromPeriod, input.toPeriod);
  const basePeriod = input.measure === "cumulative_pct" ? `${input.startYear! - 1}-12` : undefined;
  const sourceId = input.measure === "yoy_pct" ? "source.geostat_product_yoy" : "source.geostat_product_mom";
  const definitionKey = input.measure === "yoy_pct" ? "definitions.inflationProductAnnual" : "definitions.inflationProductCumulative";
  const definitionValues: Record<string, string | number> = basePeriod === undefined ? {} : { basePeriod };
  // Only this response treats the monthly originals as upstream inputs to a
  // Fiscal.ge calculation. The snapshot keeps their primary-publication role.
  const sources = selectSources(snapshot, [sourceId]).map(source => basePeriod === undefined ? source : ({
    ...source,
    derivation: serviceMessage(snapshot, "ka", "definitions.inflationProductCumulativeSource"),
    derivationKa: serviceMessage(snapshot, "ka", "definitions.inflationProductCumulativeSource"),
    derivationEn: serviceMessage(snapshot, "en", "definitions.inflationProductCumulativeSource"),
    documents: source.documents.map(document => ({ ...document, role: "derivation_upstream" as const })),
  }));
  const observations: Observation[] = input.seriesIds.flatMap(id => periods.map(period => {
    const product = index.productById.get(id)!;
    const cumulative = basePeriod === undefined ? null : productCumulative(index, id, input.startYear!, periodFromKey(period));
    const value = cumulative === null ? productAnnual(index, id, periodFromKey(period)) : cumulative.value;
    let missingKey: ServiceMessageKey | undefined;
    let missingValues: Record<string, string | number> = {};
    if (value === null) {
      if (period < product.firstPeriod || cumulative?.reason === "late_start") {
        missingKey = "missing.inflationProductStart";
        missingValues = { first: cumulative?.missingPeriod === null || cumulative?.missingPeriod === undefined ? product.firstPeriod : periodKey(cumulative.missingPeriod) };
      } else {
        missingKey = cumulative === null ? "missing.inflationProductAnnual" : "missing.inflationProductMonthlyInput";
        missingValues = { period: cumulative?.missingPeriod === null || cumulative?.missingPeriod === undefined ? period : periodKey(cumulative.missingPeriod) };
      }
    }
    const historyNotes = snapshot.inflationProducts.historyNotes.filter(note => note.productId === id && (input.startYear ?? yearOfPeriod(period)) <= note.boundaryYear);
    const definitionKa = serviceMessage(snapshot, "ka", definitionKey, definitionValues);
    const definitionEn = serviceMessage(snapshot, "en", definitionKey, definitionValues);
    return {
      observationId: `${buildObservationId(PRODUCT_DATASET_ID, "country.georgia", id, period, input.measure)}${basePeriod === undefined ? "" : `:base=${basePeriod}`}`,
      datasetId: PRODUCT_DATASET_ID, budgetScope: "consumer_prices", entityId: "country.georgia", entityType: "country", entityLabelKa: "საქართველო", entityLabelEn: "Georgia", entitySlug: null,
      seriesId: id, seriesLabelKa: product.labelKa, seriesLabelEn: product.labelEn, level: "product", parentSeriesId: null,
      year: yearOfPeriod(period), period, ...(basePeriod === undefined ? {} : { calculationBasePeriod: basePeriod }),
      measure: input.measure, unit: "percent", value, availability: value === null ? "missing" : "available", basis: value === null ? null : "published",
      missingReason: missingKey === undefined ? null : serviceMessage(snapshot, "ka", missingKey, missingValues),
      missingReasonEn: missingKey === undefined ? null : serviceMessage(snapshot, "en", missingKey, missingValues),
      valueDefinition: [definitionKa, ...historyNotes.map(note => note.noteKa)].join(" "),
      valueDefinitionEn: [definitionEn, ...historyNotes.map(note => note.noteEn)].join(" "),
      valueDefinitionId: `${PRODUCT_DATASET_ID}:${input.measure}${basePeriod === undefined ? "" : `:base=${basePeriod}`}`,
      sourceIds: [sourceId], documentIds: resolveDocumentIds(sources, [sourceId]), caveatIds: [],
    };
  }));
  const years = [...new Set(periods.map(yearOfPeriod))];
  const caveats = evaluateCaveats(snapshot, countryLevelCaveatContext(PRODUCT_DATASET_ID, input.measure, years, input.seriesIds, observations), CAVEAT_RULES);
  for (const observation of observations) observation.caveatIds = caveatIdsForObservation(caveats, observation);
  const available = observations.filter(observation => observation.value !== null);
  return {
    kind: "observations", status: available.length === observations.length ? "ok" : available.length ? "partial" : "empty",
    data: { observations, coverage: {
      requestedYears: years, ...productQueryCoverage(snapshot, input), requestedPeriods: periods,
      returnedYears: [...new Set(available.map(observation => observation.year))],
      missingCells: observations.filter(observation => observation.value === null).map(observation => ({ entityId: observation.entityId, seriesId: observation.seriesId, year: observation.year, period: observation.period!, reason: observation.missingReason!, reasonEn: observation.missingReasonEn! })),
      excludedEntities: [], returnedCount: available.length, expectedCount: observations.length,
    } },
    meta: buildResponseMeta(snapshot, { sources, caveats, citedDocumentIds: [...new Set(observations.flatMap(observation => observation.documentIds))] }),
  };
}
