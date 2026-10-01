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
import { CITY_FIRST_PERIOD } from "../data/inflation/types";
import { periodFromKey } from "../data/inflation/periods";
import { CAVEAT_RULES, evaluateCaveats, type CaveatContext } from "./caveats";
import { contributionIndex, inflationRequestCoverage, measurePeriodRange, periodsBetween, weightYearRange, yearOfPeriod, type PeriodRange } from "./inflationData";
import {
  CITY_SERIES_MEASURES,
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

export type InflationRequest = { seriesIds: string[]; measure: string; periods?: string[]; years?: number[]; entityIds?: string[] };
export type InflationOptions = { includeResidual: boolean; comparison?: CaveatContext["comparison"] };

type SeriesInfo = { labelKa: string; labelEn: string; level: string; parentSeriesId: string | null; measures: readonly string[] };
type Cell = { value: number | null; sourceIds: string[]; missingKey?: ServiceMessageKey; missingValues?: Record<string, string | number> };
type RawCell = { entityId: string; seriesId: string; info: SeriesInfo; key: string; cell: Cell };

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
export function inflationCellCount(input: { seriesIds?: string[]; measure?: string; fromPeriod?: string; toPeriod?: string; entityIds?: string[] }): number {
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
  return span * ((input.seriesIds?.length ?? 0) + (input.measure === "contribution_pp" ? 1 : 0)) * Math.max(1, input.entityIds?.length ?? 1);
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

  if (hasCity) {
    // A city publishes only cpi.headline and cpi.cat.01-12: a series outside that
    // vocabulary is unknown for a city (not merely the wrong measure), and a
    // measure outside that series' own city measures is unsupported (spec §11).
    const cityUnknownSeriesIds = request.seriesIds.filter((id) => !Object.hasOwn(CITY_SERIES_MEASURES, id));
    if (cityUnknownSeriesIds.length > 0) {
      return errorResponse(snapshot, {
        code: "unknown_series",
        ...bilingual(snapshot, "errors.inflationCityInput"),
        retryable: false,
        validChoices: Object.keys(CITY_SERIES_MEASURES),
      });
    }
    const cityMismatched = request.seriesIds.filter((id) => !CITY_SERIES_MEASURES[id]!.includes(measure));
    if (cityMismatched.length > 0) {
      return errorResponse(snapshot, {
        code: "unsupported_measure",
        ...bilingual(snapshot, "errors.inflationCityInput"),
        retryable: false,
        validChoices: [...CITY_SERIES_MEASURES[cityMismatched[0]!]!],
      });
    }
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

  if (hasCity) ({ availablePeriods, availableYears } = inflationRequestCoverage(snapshot, entityIds, request.seriesIds, measure));

  const factMeasure = measure === "contribution_pp" ? "yoy_pct" : measure;
  const nationalFacts = new Map(snapshot.inflation.facts.filter((f) => f.measure === factMeasure).map((f) => [`${f.seriesId}|${f.period}`, f]));
  const categoryFacts = new Map(snapshot.inflation.categories.filter((f) => f.measure === factMeasure).map((f) => [`${f.categoryId}|${f.period}`, f]));
  const weights = new Map(snapshot.inflation.weights.map((row) => [`${row.categoryId}|${row.year}`, row]));
  const cityFactsForMeasure = hasCity ? snapshot.inflation.cities.filter((f) => f.measure === factMeasure) : [];
  const cityFacts = new Map(cityFactsForMeasure.map((f) => [`${f.cityId}|${f.seriesId}|${f.period}`, f]));
  // A city's own first month can start later than CITY_FIRST_PERIOD (Zugdidi's
  // yoy_pct starts 2016-12, its avg12_pct 2017-12): the missing reason must name
  // that city, series and measure's real start, not the generic city window.
  const cityFirstPeriods = new Map<string, string>();
  for (const fact of cityFactsForMeasure) {
    const key = `${fact.cityId}|${fact.seriesId}`;
    const existing = cityFirstPeriods.get(key);
    if (existing === undefined || fact.period < existing) cityFirstPeriods.set(key, fact.period);
  }
  const missing = (missingKey: ServiceMessageKey, missingValues?: Record<string, string | number>): Cell => ({ value: null, sourceIds: [], missingKey, missingValues });

  const cellFor = (entityId: string, seriesId: string, series: SeriesInfo, key: string): Cell => {
    if (entityId !== INFLATION_ENTITY_ID) {
      const fact = cityFacts.get(`${entityId}|${seriesId}|${key}`);
      if (fact) return { value: fact.value, sourceIds: [fact.sourceId] };
      const first = cityFirstPeriods.get(`${entityId}|${seriesId}`) ?? CITY_FIRST_PERIOD;
      return missing("missing.inflationCityNotObserved", { first });
    }
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

  const raw: RawCell[] = entityIds.flatMap((entityId) =>
    request.seriesIds.flatMap((seriesId) =>
      keys.map((key) => ({ entityId, seriesId, info: info.get(seriesId)!, key, cell: cellFor(entityId, seriesId, info.get(seriesId)!, key) })),
    ),
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
      raw.push({ entityId: INFLATION_ENTITY_ID, seriesId: RESIDUAL_SERIES_ID, info: residualInfo, key, cell });
    }
  }

  const sources = selectSources(snapshot, [...new Set(raw.flatMap((entry) => entry.cell.sourceIds))]);
  const observations: Observation[] = raw.map(({ entityId, seriesId, info: series, key, cell }) => {
    const definitionKey = seriesId === RESIDUAL_SERIES_ID ? "residual" : measure;
    const year = monthly ? yearOfPeriod(key) : Number(key);
    const city = cityEntities.get(entityId);
    return {
      observationId: buildObservationId(INFLATION_DATASET_ID, entityId, seriesId, monthly ? key : year, measure),
      datasetId: INFLATION_DATASET_ID,
      budgetScope: "consumer_prices",
      entityId,
      entityType: city ? "city" : "country",
      entityLabelKa: city ? city.labelKa : "საქართველო",
      entityLabelEn: city ? city.labelEn : "Georgia",
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
    { ...countryLevelCaveatContext(INFLATION_DATASET_ID, measure, years, [...new Set(observations.map((o) => o.seriesId))], observations, options.comparison ?? null), entityIds },
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
      ? { seriesIds: input.seriesIds, measure: input.measure, years: [...new Set(periods.map(yearOfPeriod))], entityIds: input.entityIds }
      : { seriesIds: input.seriesIds, measure: input.measure, periods, entityIds: input.entityIds };
  return inflationObservations(snapshot, request, { includeResidual: true });
}
