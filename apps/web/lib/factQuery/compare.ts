// apps/web/lib/factQuery/compare.ts
//
// Change between two years, computed here so a language model never does the
// arithmetic itself (spec section 6.6).
//
// Values come from the observation queries rather than a second reading of the
// facts: whatever queryNational/queryMinistries/queryMunicipal return for an
// endpoint is what this function compares, so a figure can never differ
// between "the number" and "the change in the number".
//
// The hard part is not the subtraction. It is refusing to subtract when the
// endpoints do not mean the same thing - a 2004 receipts total against 2005,
// or a 2015 municipal portal fallback against a later payment total. Those
// return both endpoints with null change fields and a reason, never a growth
// figure that reads as like-for-like.
import { CAVEAT_RULES, evaluateCaveats } from "./caveats";
import { buildResponseMeta } from "./meta";
import { queryMinistries } from "./queryMinistries";
import { queryMunicipal } from "./queryMunicipal";
import { queryNational } from "./queryNational";
import { compareInput } from "./schemas";
import type { CaveatContext } from "./caveats";
import type { Observation } from "./observations";
import type { DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot, Measure, Unit } from "./types";

export type ComparisonEndpoint = {
  year: number;
  value: number | null;
  availability: "available" | "missing";
  missingReason: string | null;
  basis: "actual" | "planned" | null;
  valueDefinition: string;
  sourceIds: string[];
  documentIds: string[];
};

export type Comparison = {
  comparisonId: string;
  datasetId: DatasetId;
  entityId: string;
  entityLabelKa: string;
  seriesId: string;
  seriesLabelKa: string;
  measure: Measure;
  unit: Unit;
  from: ComparisonEndpoint;
  to: ComparisonEndpoint;
  /** GEL (or GEL-per-resident) difference. Null for percentage measures. */
  absoluteChange: number | null;
  /** (later - earlier) / earlier * 100. Null for percentage measures and for a non-positive base. */
  percentageChange: number | null;
  /** Percentage-POINT difference. Null for GEL measures. */
  percentagePointChange: number | null;
  comparability: "comparable" | "limited" | "not_comparable";
  reasons: string[];
  caveatIds: string[];
};

const PERCENTAGE_MEASURES = new Set<Measure>(["share_of_total_pct", "share_of_gdp_pct"]);

/**
 * Caveats that say an endpoint's COVERAGE OR DEFINITION differs, as opposed to
 * flagging its provenance or reconciliation quality. Only the former makes two
 * years not like-for-like.
 *
 * The distinction is load-bearing, and getting it wrong in either direction is
 * a product failure. revenue_2004_total_scope says "narrower coverage:
 * increase in liabilities is unavailable" - the 2004 total counts different
 * things than the 2005 one, so growth between them is meaningless.
 * municipal_source_version_difference says the reviewed figure differs between
 * source versions, and municipal_financing_outside_functional says financing
 * sits outside the functional breakdown: both are quality disclosures about a
 * figure that still measures total payments. Treating those as definition
 * breaks declined Tbilisi 2019 -> 2023, a perfectly ordinary payment-total
 * comparison.
 *
 * Most definition changes never reach this set, because they are already
 * visible in valueDefinition - the municipal 2015 portal fallback and Khulo's
 * 2024 fallback both name their measure there, and the inequality check below
 * catches them. This set is the supplement for scope changes that
 * valueDefinition does not encode. Asymmetric quality caveats stay visible on
 * the row's caveatIds and in meta.caveats; they just do not suppress the
 * growth figure.
 */
const SCOPE_BREAK_CAVEATS = new Set(["revenue_2004_total_scope"]);

const REASON_SEVERE_ASYMMETRY = "ერთ-ერთ საზღვარზე მოქმედებს მოცულობის შემზღუდველი შენიშვნა, მეორეზე კი არა — წლები ერთსა და იმავეს არ ზომავს.";
const REASON_DEFINITION_CHANGED = "საზღვრები სხვადასხვა განსაზღვრებით არის გაზომილი, ამიტომ ზრდა პირდაპირ შედარებადი არ არის.";
const REASON_BASIS_DIFFERS = "საზღვრებს განსხვავებული საფუძველი აქვს (ფაქტი / გეგმა), ამიტომ ზრდა შედარებადი არ არის.";
const REASON_ENDPOINT_MISSING = "ერთ-ერთი საზღვრის მნიშვნელობა მიუწვდომელია, ამიტომ ცვლილება არ გამოითვლება.";
const REASON_NON_POSITIVE_BASE = "საწყისი მაჩვენებელი ნულოვანი ან უარყოფითია, ამიტომ პროცენტული ზრდა არ გამოითვლება.";
const REASON_GDP_STANDARD_BREAK = "მშპ-ის აღრიცხვის სტანდარტი შუალედში იცვლება, ამიტომ შედარება შეზღუდულია.";

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

function endpointOf(observation: Observation): ComparisonEndpoint {
  return {
    year: observation.year,
    value: observation.value,
    availability: observation.availability,
    missingReason: observation.missingReason,
    basis: observation.basis,
    valueDefinition: observation.valueDefinition,
    sourceIds: observation.sourceIds,
    documentIds: observation.documentIds,
  };
}

export function compare(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const parsed = compareInput.safeParse(rawInput);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: "მოთხოვნის პარამეტრები არასწორია.",
      messageEn: `Invalid parameters: ${issues}`,
      retryable: false,
    });
  }

  const input = parsed.data;

  if (input.expectedDataVersion !== undefined && input.expectedDataVersion !== snapshot.dataVersion) {
    return errorResponse(snapshot, {
      code: "data_version_changed",
      messageKa: "მონაცემთა ვერსია შეიცვალა; გამოიძახეთ თავიდან expectedDataVersion-ის გარეშე ან განახლებული ვერსიით.",
      messageEn: "The data version has changed since expectedDataVersion was captured; call again without it or with the current dataVersion.",
      retryable: false,
    });
  }

  const years = [input.fromYear, input.toYear];
  const target = input.target;

  // Endpoints come from the observation queries, so `compare` owns no second
  // copy of the value arithmetic (Global Constraints: never duplicate a
  // formula). Their own caveats are recomputed below with `comparison` set,
  // because two rules exist only for comparisons.
  let endpointResult: FactQueryResponse;
  let datasetId: DatasetId;
  let entityIds: string[];

  if (target.dataset === "national") {
    datasetId = target.side === "revenue" ? "national-revenue" : "national-expenditure";
    entityIds = [];
    endpointResult = queryNational(snapshot, {
      side: target.side,
      seriesIds: target.seriesIds,
      years,
      measure: input.measure,
    });
  } else if (target.dataset === "ministries") {
    datasetId = "ministries";
    entityIds = [];
    endpointResult = queryMinistries(snapshot, {
      level: target.level,
      seriesIds: target.seriesIds,
      years,
      measure: input.measure,
    });
  } else {
    datasetId = "municipal-expenditure";
    entityIds = target.entityIds;
    endpointResult = queryMunicipal(snapshot, {
      entityIds: target.entityIds,
      seriesIds: target.seriesIds,
      years,
      measure: input.measure,
    });
  }

  if (endpointResult.kind === "error") {
    // A measure the target dataset's own schema rejects is an unsupported
    // measure for this comparison, not a malformed compare() call: compareInput
    // accepts all four measures because different datasets support different
    // subsets, so the sub-query is where the mismatch actually surfaces.
    const code =
      endpointResult.error.code === "invalid_parameters" &&
      endpointResult.error.messageEn.includes("measure")
        ? "unsupported_measure"
        : endpointResult.error.code;
    return errorResponse(snapshot, { ...endpointResult.error, code });
  }

  const observations = (endpointResult.data as { observations: Observation[] }).observations;
  const isPercentage = PERCENTAGE_MEASURES.has(input.measure);

  // The endpoint caveats, keyed per observation, decide whether the two years
  // are like-for-like. Recomputed here rather than read off the sub-query's
  // meta so `comparison` is set.
  const endpointCaveats = endpointResult.meta.caveats;


  const byPair = new Map<string, { from?: Observation; to?: Observation }>();
  for (const observation of observations) {
    const key = `${observation.entityId}::${observation.seriesId}`;
    const pair = byPair.get(key) ?? {};
    if (observation.year === input.fromYear) pair.from = observation;
    if (observation.year === input.toYear) pair.to = observation;
    byPair.set(key, pair);
  }

  const gdpStandardBreak = endpointCaveats.some((c) => c.code === "gdp_sna_break_2010");

  const comparisons: Comparison[] = [];
  let definitionChange: { fromDefinition: string; toDefinition: string } | null = null;

  for (const [key, pair] of byPair) {
    const from = pair.from;
    const to = pair.to;
    if (!from || !to) continue;

    const reasons: string[] = [];

    if (from.value === null || to.value === null) reasons.push(REASON_ENDPOINT_MISSING);
    if (from.basis !== null && to.basis !== null && from.basis !== to.basis) reasons.push(REASON_BASIS_DIFFERS);
    if (from.valueDefinition !== to.valueDefinition) {
      reasons.push(REASON_DEFINITION_CHANGED);
      definitionChange ??= { fromDefinition: from.valueDefinition, toDefinition: to.valueDefinition };
    }

    // A scope-break caveat naming one endpoint and not the other.
    const scopeOnFrom = from.caveatIds.filter((id) => SCOPE_BREAK_CAVEATS.has(id));
    const scopeOnTo = to.caveatIds.filter((id) => SCOPE_BREAK_CAVEATS.has(id));
    const asymmetric =
      scopeOnFrom.some((id) => !scopeOnTo.includes(id)) || scopeOnTo.some((id) => !scopeOnFrom.includes(id));
    if (asymmetric) reasons.push(REASON_SEVERE_ASYMMETRY);

    const comparable = reasons.length === 0;

    let absoluteChange: number | null = null;
    let percentageChange: number | null = null;
    let percentagePointChange: number | null = null;

    if (comparable && from.value !== null && to.value !== null) {
      if (isPercentage) {
        percentagePointChange = to.value - from.value;
      } else {
        absoluteChange = to.value - from.value;
        if (from.value > 0) {
          percentageChange = ((to.value - from.value) / from.value) * 100;
        } else {
          // Spec section 6.6: a zero or negative base makes percentage change
          // unavailable but does NOT invalidate the absolute difference.
          reasons.push(REASON_NON_POSITIVE_BASE);
        }
      }
    }

    let comparability: Comparison["comparability"];
    if (!comparable) {
      comparability = "not_comparable";
    } else if (gdpStandardBreak) {
      comparability = "limited";
      reasons.push(REASON_GDP_STANDARD_BREAK);
    } else {
      comparability = "comparable";
    }

    comparisons.push({
      comparisonId: `${datasetId}:${key.replace("::", ":")}:${input.fromYear}-${input.toYear}:${input.measure}`,
      datasetId,
      entityId: from.entityId,
      entityLabelKa: from.entityLabelKa,
      seriesId: from.seriesId,
      seriesLabelKa: to.seriesLabelKa,
      measure: input.measure,
      unit: from.unit,
      from: endpointOf(from),
      to: endpointOf(to),
      absoluteChange,
      percentageChange,
      percentagePointChange,
      comparability,
      reasons,
      caveatIds: Array.from(new Set([...from.caveatIds, ...to.caveatIds])).sort(),
    });
  }

  const caveatContext: CaveatContext = {
    datasetId,
    measure: input.measure,
    years,
    seriesIds: target.seriesIds,
    entityIds,
    observations: observations.map((o) => ({
      entityId: o.entityId,
      seriesId: o.seriesId,
      level: o.level,
      parentSeriesId: o.parentSeriesId,
      year: o.year,
      value: o.value,
      basis: o.basis,
    })),
    municipalTotalInputs:
      datasetId === "municipal-expenditure"
        ? snapshot.municipal.totalFacts.filter(
            (f) => years.includes(f.year) && entityIds.includes(f.municipalityCode),
          )
        : [],
    gdpInputs: input.measure === "share_of_gdp_pct" ? snapshot.gdpFacts.filter((f) => years.includes(f.year)) : [],
    // Set here and nowhere else: non_positive_comparison_base and
    // municipal_total_definition_changed exist only for a comparison, and both
    // read this. The definitions are the endpoints' own valueDefinition
    // strings, so the municipal rule fires on exactly the 2015-to-payment-total
    // case the spec names.
    comparison: {
      fromYear: input.fromYear,
      toYear: input.toYear,
      fromDefinition: definitionChange?.fromDefinition ?? "",
      toDefinition: definitionChange?.toDefinition ?? "",
    },
    historicalJoinSeriesYears: datasetId === "ministries" ? snapshot.ministries.historicalJoinSeriesYears : [],
    adminCategoryYears: [],
  };
  const caveats = evaluateCaveats(caveatContext, CAVEAT_RULES);

  const comparableCount = comparisons.filter((c) => c.comparability !== "not_comparable").length;
  const status: "ok" | "partial" | "empty" =
    comparisons.length === 0 || comparableCount === 0
      ? "empty"
      : comparableCount === comparisons.length
        ? "ok"
        : "partial";

  const meta = buildResponseMeta(snapshot, { sources: endpointResult.meta.sources, caveats });

  return {
    kind: "comparisons",
    status,
    data: {
      comparisons,
      coverage: {
        requestedYears: years,
        comparedPairs: comparisons.length,
        comparableCount,
        notComparableCount: comparisons.length - comparableCount,
      },
    },
    meta,
  };
}
