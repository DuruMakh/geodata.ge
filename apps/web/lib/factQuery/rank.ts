import { serviceMessage, type ServiceMessageKey } from "./localization";
// apps/web/lib/factQuery/rank.ts
//
// Ordering among PEERS (spec section 6.7). The constraint that shapes this
// file is that a total never competes with its own components: revenue.total
// against revenue.vat, admin_spending.total against a ministry, or the
// Georgia aggregate against a municipality would each produce a "largest"
// answer that is just the sum of the field it is ranked against.
//
// Values and changes both come from the existing functions - queryNational /
// queryMinistries / queryMunicipal for a single year, compare for the change
// metrics - so a ranking can never disagree with the figure a direct query
// returns for the same cell.
import { compare } from "./compare";
import { describeCoverage } from "./describeCoverage";
import { buildResponseMeta } from "./meta";
import { inflationObservations } from "./queryInflation";
import { queryInflationProducts } from "./queryInflationProducts";
import { inflationProductSources } from "./inflationProductData";
import { queryMinistries } from "./queryMinistries";
import { queryMunicipal } from "./queryMunicipal";
import { queryNational } from "./queryNational";
import { INPUT_LIMITS, rankInput } from "./schemas";
import { selectSources } from "./sources";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "./types";
import type { Comparison } from "./compare";
import type { Observation } from "./observations";
import type { Basis, DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot, Measure, ResolvedSource, Unit } from "./types";

const EXCLUDED = new Set<string>(AGGREGATE_ONLY_MUNICIPAL_CODES);
const TOTAL_LEVEL = "total";
const GEL_METRICS = new Set(["absolute_change", "percentage_change"]);
const PERCENTAGE_MEASURES = new Set<Measure>(["share_of_total_pct", "share_of_gdp_pct", "yoy_pct", "mom_pct", "contribution_pp"]);

export type RankEntry = {
  position: number;
  tied: boolean;
  entityId: string;
  entityLabelKa: string;
  entityLabelEn: string;
  seriesId: string;
  seriesLabelKa: string;
  seriesLabelEn: string;
  value: number | null;
  unit: Unit;
  basis: Basis | null;
  caveatIds: string[];
  /** Inflation value rankings only: the month ranked. */
  period?: string;
  calculationBasePeriod?: string;
};

export type RankData = {
  entries: RankEntry[];
  universe: {
    dimension: "series" | "entities";
    description: string;
    descriptionEn: string;
    candidateCount: number;
    eligibleCount: number;
    returnedCount: number;
    /** True when `limit` splits a group of equal values, so the cutoff is arbitrary. */
    cutoffSplitsTie: boolean;
  };
  /**
   * Grouped by reason, not one row per entity. A refusal covering 64
   * municipalities repeated one identical Georgian sentence 64 times - 16.9 KiB
   * of a 91 KiB response saying the same thing. Reasons keep first-seen order,
   * and ids keep their order within a reason.
   */
  exclusions: { reason: string; reasonEn: string; ids: string[] }[];
  rankingDefinition: string;
  rankingDefinitionEn: string;
};

type Candidate = {
  entityId: string;
  entityLabelKa: string;
  entityLabelEn: string;
  seriesId: string;
  seriesLabelKa: string;
  seriesLabelEn: string;
  /** Never null: a row with no value is an exclusion, never a candidate. */
  value: number;
  unit: Unit;
  basis: Basis | null;
  caveatIds: string[];
  period?: string;
  calculationBasePeriod?: string;
  /** Stable sort key, used only to break exact ties reproducibly. */
  stableId: string;
};

/** Collapse one row per excluded entity into one row per distinct reason. */
function groupByReason(flat: readonly { id: string; reason: string; reasonEn: string }[]): RankData["exclusions"] {
  const byReason = new Map<string, RankData["exclusions"][number]>();
  for (const { id, reason, reasonEn } of flat) {
    const group = byReason.get(reason);
    if (group === undefined) byReason.set(reason, { reason, reasonEn, ids: [id] });
    else group.ids.push(id);
  }
  return [...byReason.values()];
}

const REASON_NOT_COMPARABLE = "ranking.notComparable";
const REASON_NO_VALUE = "ranking.noValue";

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

type CatalogueSeries = { seriesId: string; labelKa: string; level: string; parentSeriesId: string | null; availability: string };

function catalogueSeries(snapshot: FactQuerySnapshot, datasetId: DatasetId): CatalogueSeries[] {
  const catalogue = describeCoverage(snapshot, { datasetId });
  if (catalogue.kind === "error") return [];
  return ((catalogue.data as { series?: CatalogueSeries[] }).series ?? []).filter(
    (entry) => entry.availability !== "taxonomy_only",
  );
}

export function rank(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  // Named before schema validation, because the enum's own message lists the
  // four legal ids without saying why these two are not among them - a model
  // reading it may retry with a different dimension rather than understand that
  // a single-entity dataset can never be ranked.
  const requestedDataset = (rawInput as { datasetId?: unknown } | null)?.datasetId;
  if (requestedDataset === "government-debt" || requestedDataset === "general-government-balance") {
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: serviceMessage(snapshot, "ka", "errors.rankSingleEntity"),
      messageEn: serviceMessage(snapshot, "en", "errors.rankSingleEntity", { requestedDataset }),
      retryable: false,
      validChoices: ["national-revenue", "national-expenditure", "ministries", "municipal-expenditure", "inflation"],
    });
  }

  const parsed = rankInput.safeParse(rawInput);

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
    return errorResponse(snapshot, {
      code: "data_version_changed",
      messageKa: serviceMessage(snapshot, "ka", "errors.dataVersionChanged"),
      messageEn: serviceMessage(snapshot, "en", "errors.dataVersionChanged"),
      retryable: false,
    });
  }

  const isMunicipal = input.datasetId === "municipal-expenditure";
  const isInflation = input.datasetId === "inflation";
  const isProduct = input.datasetId === "inflation-products";
  const isValueMetric = input.metric === "value";

  if (input.withinRegionId !== undefined && !snapshot.municipal.regions.some((r) => r.id === input.withinRegionId)) {
    return errorResponse(snapshot, {
      code: "unknown_entity",
      messageKa: serviceMessage(snapshot, "ka", "errors.rankUnknownRegion"),
      messageEn: serviceMessage(snapshot, "en", "errors.rankUnknownRegion"),
      retryable: false,
      validChoices: snapshot.municipal.regions.map((r) => r.id),
    });
  }

  // rankInput's refine already pairs `value` with one year and change metrics
  // with two; this rejects the other direction (a value ranking handed a
  // range, or a change ranking handed a single year), which the schema allows
  // because both fields are independently optional.
  if (isValueMetric && (input.fromYear !== undefined || input.toYear !== undefined)) {
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: serviceMessage(snapshot, "ka", "errors.rankValueYearOnly"),
      messageEn: serviceMessage(snapshot, "en", "errors.rankValueYearOnly"),
      retryable: false,
    });
  }
  if (!isValueMetric && input.year !== undefined) {
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: serviceMessage(snapshot, "ka", "errors.rankChangeYears"),
      messageEn: serviceMessage(snapshot, "en", "errors.rankChangeYears"),
      retryable: false,
    });
  }

  if (!isValueMetric) {
    const wantsPercentagePoints = input.metric === "percentage_point_change";
    const measureIsPercentage = PERCENTAGE_MEASURES.has(input.measure);
    if (wantsPercentagePoints && !measureIsPercentage) {
      return errorResponse(snapshot, {
        code: "unsupported_measure",
        messageKa: serviceMessage(snapshot, "ka", "errors.rankPercentagePoints"),
        messageEn: serviceMessage(snapshot, "en", "errors.rankPercentagePoints"),
        retryable: false,
      });
    }
    if (GEL_METRICS.has(input.metric) && measureIsPercentage) {
      return errorResponse(snapshot, {
        code: "unsupported_measure",
        messageKa: serviceMessage(snapshot, "ka", "errors.rankAmountChanges"),
        messageEn: serviceMessage(snapshot, "en", "errors.rankAmountChanges"),
        retryable: false,
      });
    }
  }

  const entityRanking = input.dimension === "entities";
  const inflationCities = isInflation && entityRanking;
  if ((entityRanking && !isMunicipal && !isInflation) || (!entityRanking && isMunicipal)) {
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: serviceMessage(snapshot, "ka", "errors.rankDimension"),
      messageEn: serviceMessage(snapshot, "en", "errors.rankDimension"),
      retryable: false,
    });
  }

  // ---- universe: peers only -------------------------------------------------

  let entityIds: string[] = [];
  let seriesIds: string[] = [];
  let universeKey: ServiceMessageKey;
  let universeValues: Record<string, string> = {};

  if (isMunicipal) {
    if (input.seriesId === undefined || input.entityType === undefined) {
      return errorResponse(snapshot, {
        code: "invalid_parameters",
        messageKa: serviceMessage(snapshot, "ka", "errors.rankMunicipalInput"),
        messageEn: serviceMessage(snapshot, "en", "errors.rankMunicipalInput"),
        retryable: false,
      });
    }
    seriesIds = [input.seriesId];

    if (input.entityType === "region") {
      entityIds = snapshot.municipal.regions.map((region) => region.id).sort();
      universeKey = "ranking.regions";
    } else {
      entityIds = snapshot.municipal.municipalities
        .filter((row) => input.withinRegionId === undefined || row.regionId === input.withinRegionId)
        // Belt and braces: the roster never contains an aggregate-only code,
        // but a ranking is exactly where one appearing would be worst.
        .filter((row) => !EXCLUDED.has(row.code))
        .map((row) => row.code)
        .sort();
      universeKey = input.withinRegionId ? "ranking.withinRegion" : "ranking.municipalities";
      if (input.withinRegionId) universeValues = { regionId: input.withinRegionId };
    }
  } else {
    const series = isProduct ? [] : catalogueSeries(snapshot, input.datasetId);
    if (inflationCities) {
      if (input.seriesId === undefined || input.entityType !== "city") {
        return errorResponse(snapshot, {
          code: "invalid_parameters",
          messageKa: serviceMessage(snapshot, "ka", "errors.rankInflationCityInput"),
          messageEn: serviceMessage(snapshot, "en", "errors.rankInflationCityInput"),
          retryable: false,
        });
      }
      seriesIds = [input.seriesId];
      universeKey = "ranking.inflationCities";
    } else if (isProduct) {
      seriesIds = snapshot.inflationProducts.catalogue.map(product => product.productId).sort();
      universeKey = "ranking.inflationProducts";
    } else if (isInflation) {
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
      const level = input.level ?? "admin_category";
      seriesIds = series
        // admin_spending.total needs no separate exclusion: its catalogue
        // level is "total", so it can never equal a request level of
        // admin_category or major_program.
        .filter((entry) => entry.level === level)
        .filter((entry) => input.parentSeriesId === undefined || entry.parentSeriesId === input.parentSeriesId)
        .map((entry) => entry.seriesId)
        .sort();
      universeKey = level === "major_program"
        ? input.parentSeriesId ? "ranking.programmesWithinParent" : "ranking.programmes"
        : "ranking.categories";
      if (input.parentSeriesId) universeValues = { parentId: input.parentSeriesId };
    } else {
      seriesIds = series
        .filter((entry) => entry.level !== TOTAL_LEVEL)
        .map((entry) => entry.seriesId)
        .sort();
      universeKey = "ranking.publicFields";
    }
    entityIds = inflationCities ? snapshot.inflation.cityEntities.map((city) => city.id) : ["country.georgia"];
  }

  const candidateCount = isMunicipal || inflationCities ? entityIds.length : seriesIds.length;

  if (candidateCount === 0) {
    return errorResponse(snapshot, {
      code: "unknown_series",
      messageKa: serviceMessage(snapshot, "ka", "errors.rankNoCandidates"),
      messageEn: serviceMessage(snapshot, "en", "errors.rankNoCandidates"),
      retryable: false,
    });
  }

  // ---- gather candidate values ---------------------------------------------

  const exclusions: { id: string; reason: string; reasonEn: string }[] = [];
  const candidates: Candidate[] = [];
  let sources: ResolvedSource[] = [];
  // Which documents the ranked observations actually cite. The sub-query
  // already worked this out; taking the full sources without it made a ranking
  // cite every document its sources archive rather than the ones it read.
  let citedDocumentIds: string[] = [];
  let caveats: FactQueryResponse["meta"]["caveats"] = [];

  const runObservations = (years: number[]): FactQueryResponse => {
    if (input.datasetId === "ministries") {
      return queryMinistries(snapshot, { level: input.level ?? "admin_category", seriesIds, years, measure: input.measure });
    }
    if (isMunicipal) {
      return queryMunicipal(snapshot, { entityIds, seriesIds, years, measure: input.measure });
    }
    return queryNational(snapshot, {
      side: input.datasetId === "national-revenue" ? "revenue" : "expenditure",
      seriesIds,
      years,
      measure: input.measure,
    });
  };

  if (isValueMetric) {
    let result: FactQueryResponse;
    if (isProduct) {
      const observations: Observation[] = [];
      const mergedCaveats = new Map<string, FactQueryResponse["meta"]["caveats"][number]>();
      // Keep each query within the public series cap, while covering the entire roster.
      for (let offset = 0; offset < seriesIds.length; offset += INPUT_LIMITS.series) {
        const batch = queryInflationProducts(snapshot, {
          seriesIds: seriesIds.slice(offset, offset + INPUT_LIMITS.series), measure: input.measure,
          fromPeriod: input.period, toPeriod: input.period,
          ...(input.startYear === undefined ? {} : { startYear: input.startYear }),
        });
        if (batch.kind === "error") return errorResponse(snapshot, batch.error);
        observations.push(...(batch.data as { observations: Observation[] }).observations);
        for (const caveat of batch.meta.caveats) {
          const previous = mergedCaveats.get(caveat.code);
          mergedCaveats.set(caveat.code, { ...caveat, affects: [...new Set([...(previous?.affects ?? []), ...caveat.affects])] });
        }
      }
      sources = inflationProductSources(snapshot, input.measure as "yoy_pct" | "cumulative_pct");
      result = { kind: "observations", status: "ok", data: { observations }, meta: buildResponseMeta(snapshot, { sources, caveats: [...mergedCaveats.values()], citedDocumentIds: [...new Set(observations.flatMap(observation => observation.documentIds))] }) };
    } else result = isInflation
      ? inflationObservations(snapshot, { seriesIds, measure: input.measure, periods: [input.period as string], ...(inflationCities ? { entityIds } : {}) }, { includeResidual: false })
      : runObservations([input.year as number]);
    if (result.kind === "error") return errorResponse(snapshot, result.error);

    const observations = (result.data as { observations: Observation[] }).observations;
    if (!isProduct) sources = selectSources(snapshot, result.meta.sources.map((source) => source.sourceId));
    citedDocumentIds = isProduct
      ? [...new Set(observations.flatMap(observation => observation.documentIds))]
      : result.meta.sources.flatMap((source) => source.documents.map((document) => document.documentId));
    caveats = result.meta.caveats;


    for (const observation of observations) {
      const stableId = isMunicipal || inflationCities ? observation.entityId : observation.seriesId;
      if (observation.value === null) {
        exclusions.push({ id: stableId, reason: observation.missingReason ?? serviceMessage(snapshot, "ka", REASON_NO_VALUE), reasonEn: observation.missingReasonEn ?? serviceMessage(snapshot, "en", REASON_NO_VALUE) });
        continue;
      }
      candidates.push({
        entityId: observation.entityId,
        entityLabelKa: observation.entityLabelKa,
        entityLabelEn: observation.entityLabelEn,
        seriesId: observation.seriesId,
        seriesLabelKa: observation.seriesLabelKa,
        seriesLabelEn: observation.seriesLabelEn,
        value: observation.value,
        unit: observation.unit,
        basis: observation.basis,
        caveatIds: observation.caveatIds,
        ...(observation.period !== undefined ? { period: observation.period } : {}),
        ...(observation.calculationBasePeriod !== undefined ? { calculationBasePeriod: observation.calculationBasePeriod } : {}),
        stableId,
      });
    }
  } else {
    const target = isInflation
      ? ({ dataset: "inflation", seriesIds, ...(inflationCities ? { entityIds } : {}) } as const)
      : isMunicipal
        ? ({ dataset: "municipal", entityIds, seriesIds } as const)
        : input.datasetId === "ministries"
          ? ({ dataset: "ministries", level: input.level ?? "admin_category", seriesIds } as const)
          : ({ dataset: "national", side: input.datasetId === "national-revenue" ? "revenue" : "expenditure", seriesIds } as const);

    const result = compare(
      snapshot,
      isInflation
        ? { target, fromPeriod: input.fromPeriod, toPeriod: input.toPeriod, measure: input.measure }
        : { target, fromYear: input.fromYear as number, toYear: input.toYear as number, measure: input.measure },
    );
    if (result.kind === "error") return errorResponse(snapshot, result.error);

    const comparisons = (result.data as { comparisons: Comparison[] }).comparisons;
    sources = selectSources(snapshot, result.meta.sources.map((source) => source.sourceId));
    citedDocumentIds = result.meta.sources.flatMap((source) => source.documents.map((document) => document.documentId));
    caveats = result.meta.caveats;

    for (const comparison of comparisons) {
      const stableId = isMunicipal || inflationCities ? comparison.entityId : comparison.seriesId;

      // Spec section 6.7: omit what is not comparable and report it. A
      // `limited` comparison may remain, carrying its caveat.
      if (comparison.comparability === "not_comparable") {
        exclusions.push({ id: stableId, reason: comparison.reasons[0] ?? serviceMessage(snapshot, "ka", REASON_NOT_COMPARABLE), reasonEn: comparison.reasonsEn[0] ?? serviceMessage(snapshot, "en", REASON_NOT_COMPARABLE) });
        continue;
      }

      const value =
        input.metric === "absolute_change"
          ? comparison.absoluteChange
          : input.metric === "percentage_change"
            ? comparison.percentageChange
            : comparison.percentagePointChange;

      if (value === null) {
        // compare() already knows WHY - most often a zero or negative base,
        // which makes percentage change undefined while both endpoint values
        // exist. Reporting "the indicator is unavailable" there was a wrong
        // statement about the data, and exclusions are a ranking honesty
        // mechanism. Mirrors the not_comparable branch just above.
        exclusions.push({ id: stableId, reason: comparison.reasons[0] ?? serviceMessage(snapshot, "ka", REASON_NO_VALUE), reasonEn: comparison.reasonsEn[0] ?? serviceMessage(snapshot, "en", REASON_NO_VALUE) });
        continue;
      }

      candidates.push({
        entityId: comparison.entityId,
        entityLabelKa: comparison.entityLabelKa,
        entityLabelEn: comparison.entityLabelEn,
        seriesId: comparison.seriesId,
        seriesLabelKa: comparison.seriesLabelKa,
        seriesLabelEn: comparison.seriesLabelEn,
        value,
        // The unit must describe THIS entry's `value`, and on a change ranking
        // that value is a change, not an endpoint. `comparison.unit` is the
        // MEASURE's unit, so a percentage_change ranking over amount_gel
        // published `{ value: 464.33, unit: "GEL" }` - read plainly, "464 GEL"
        // instead of "+464%". compare() escapes this because its unit describes
        // the two endpoints and its changes sit in separately named fields;
        // rank collapses both into one value/unit pair, so it has to choose.
        //
        // percentage_point_change is reported as "percent" too: the Unit union
        // has no percentage-point member, and adding one changes the shared
        // schema. "percent" is imprecise for points but no longer false about
        // the order of magnitude, and `rankingDefinition` names the exact
        // metric. Adding a distinct unit is an open contract decision.
        unit: input.metric === "absolute_change" ? comparison.unit : isInflation ? "percentage_points" : "percent",
        basis: comparison.to.basis,
        caveatIds: comparison.caveatIds,
        stableId,
      });
    }
  }

  // Spec section 6.7: one ordering needs one consistent actual/planned basis,
  // or a plan and an outturn are presented as the same kind of number. Checked
  // over the CANDIDATES so it covers change rankings as well as value ones -
  // compare() rejects a mixed basis within a single pair, but nothing stopped
  // one candidate being actual->actual and another planned->planned in the same
  // table. Currently unreachable (every reviewed fact is "actual"), but the
  // rule outlives that, which is the same reason the value branch had it.
  const bases = new Set(candidates.filter((c) => c.basis !== null).map((c) => c.basis));
  if (bases.size > 1) {
    return errorResponse(snapshot, {
      code: "unsupported_comparison",
      messageKa: serviceMessage(snapshot, "ka", "errors.rankMixedBasis"),
      messageEn: serviceMessage(snapshot, "en", "errors.rankMixedBasis"),
      retryable: false,
    });
  }

  // ---- order, tie-flag, cut -------------------------------------------------

  const direction = input.order === "ascending" ? 1 : -1;
  // Ordering happens on full-precision values; formatting is a presentation
  // concern and never decides position. Exact ties fall back to the stable id
  // so the same request always returns the same order.
  const ordered = [...candidates].sort((left, right) => {
    const byValue = (left.value - right.value) * direction;
    if (byValue !== 0) return byValue;
    return left.stableId < right.stableId ? -1 : left.stableId > right.stableId ? 1 : 0;
  });

  const valueCounts = new Map<number, number>();
  for (const entry of ordered) valueCounts.set(entry.value, (valueCounts.get(entry.value) ?? 0) + 1);
  const tiedValues = new Set(Array.from(valueCounts).filter(([, count]) => count > 1).map(([value]) => value));

  const cut = ordered.slice(0, input.limit);
  const cutoffSplitsTie =
    ordered.length > input.limit && ordered[input.limit - 1]?.value === ordered[input.limit]?.value;

  const entries: RankEntry[] = cut.map((entry, index) => ({
    position: index + 1,
    // An arbitrary tie-break must never read as a meaningful difference.
    tied: tiedValues.has(entry.value),
    entityId: entry.entityId,
    entityLabelKa: entry.entityLabelKa,
    entityLabelEn: entry.entityLabelEn,
    seriesId: entry.seriesId,
    seriesLabelKa: entry.seriesLabelKa,
    seriesLabelEn: entry.seriesLabelEn,
    value: entry.value,
    unit: entry.unit,
    basis: entry.basis,
    caveatIds: entry.caveatIds,
    ...(entry.period !== undefined ? { period: entry.period } : {}),
    ...(entry.calculationBasePeriod !== undefined ? { calculationBasePeriod: entry.calculationBasePeriod } : {}),
  }));

  const rankingDefinitionFor = (locale: "ka" | "en") => {
    const order = serviceMessage(snapshot, locale, input.order === "ascending" ? "ranking.ascending" : "ranking.descending");
    if (isProduct && input.measure === "cumulative_pct") return serviceMessage(snapshot, locale, "ranking.productCumulativeDefinition", { period: input.period!, basePeriod: `${input.startYear! - 1}-12`, order });
    if (isInflation || isProduct) {
      return isValueMetric
        ? serviceMessage(snapshot, locale, "ranking.valueDefinitionPeriod", { measure: input.measure, period: input.period as string, order })
        : serviceMessage(snapshot, locale, "ranking.changeDefinitionPeriod", { metric: input.metric, measure: input.measure, fromPeriod: input.fromPeriod as string, toPeriod: input.toPeriod as string, order });
    }
    return isValueMetric
      ? serviceMessage(snapshot, locale, "ranking.valueDefinition", { measure: input.measure, year: input.year as number, order })
      : serviceMessage(snapshot, locale, "ranking.changeDefinition", { metric: input.metric, measure: input.measure, fromYear: input.fromYear as number, toYear: input.toYear as number, order });
  };

  const status: "ok" | "partial" | "empty" =
    entries.length === 0 ? "empty" : exclusions.length === 0 ? "ok" : "partial";

  // A RankEntry carries no documentIds of its own, so the narrowing comes from
  // the observations the ranking was computed from: every document those cite,
  // and no more. A ranking over all 64 municipalities still names 64 workbooks -
  // it genuinely read them - but not the documents its sources merely archive.
  const meta = buildResponseMeta(snapshot, { sources, caveats, citedDocumentIds });

  const data: RankData = {
    entries,
    universe: {
      dimension: input.dimension,
      description: serviceMessage(snapshot, "ka", universeKey, universeValues),
      descriptionEn: serviceMessage(snapshot, "en", universeKey, universeValues),
      candidateCount,
      eligibleCount: candidates.length,
      returnedCount: entries.length,
      cutoffSplitsTie,
    },
    exclusions: groupByReason(exclusions),
    rankingDefinition: rankingDefinitionFor("ka"),
    rankingDefinitionEn: rankingDefinitionFor("en"),
  };

  return { kind: "ranking", status, data, meta };
}
