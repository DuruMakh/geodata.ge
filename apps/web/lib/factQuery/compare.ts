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
// endpoints do not mean the same thing - a 2004 receipts total against 2005, or
// Khulo's 2024 functional fallback against a payment total. Those return both
// endpoints with null change fields and a reason, never a growth figure that
// reads as like-for-like.
//
// One definition change is measured and accepted rather than refused: the 2015
// municipal portal fallback against a later payment total. See
// ACCEPTED_BASIS_CHANGE below for the measurement behind that.
import { CAVEAT_RULES } from "./caveats";
import { buildResponseMeta } from "./meta";
import { queryMinistries } from "./queryMinistries";
import { queryDebt } from "./queryDebt";
import { queryDeficit } from "./queryDeficit";
import { queryMunicipal } from "./queryMunicipal";
import { queryNational } from "./queryNational";
import { compareInput } from "./schemas";
import { selectSources } from "./sources";
import type { Observation } from "./observations";
import type { Basis, DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot, Measure, Unit } from "./types";

export type ComparisonEndpoint = {
  year: number;
  value: number | null;
  availability: "available" | "missing";
  missingReason: string | null;
  basis: Basis | null;
  valueDefinition: string;
  /** Structured identity of what is measured. This, never valueDefinition, decides like-for-like. */
  valueDefinitionId: string;
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

// rate_percent belongs here for the same reason it exists at all: a rate is a
// percent, so the honest difference between two of them is a POINT difference.
// Without it the GEL branch ran, and a rate moving 4.6% -> 6.2% was reported as
// "grew 48.5%" with the point-change column empty - the mislabelling this
// measure was introduced to prevent, one layer further down.
const PERCENTAGE_MEASURES = new Set<Measure>(["share_of_total_pct", "share_of_gdp_pct", "rate_percent"]);

/**
 * The one definition change measured and accepted as comparable.
 *
 * A municipal valueDefinitionId is `municipal:<measure>:<level>:<basis>`. The
 * 2015 figures - total and functions alike - come from the archived portal and
 * carry `portal_functional_total_fallback`; 2016 onward carries the MoF
 * headline `total_payments`.
 *
 * Measured across all 64 municipalities in every year where both totals exist:
 * the median gap is 0.94% in 2016, falling to 0.20% by 2024. The tail is real -
 * p90 of 4.2% in 2016, worst case 13.5% - so the pair still carries
 * municipal_total_definition_changed, now as a note. But refusing every
 * ten-year question outright withheld a usable answer from every reader in
 * order to protect that tail, which is the wrong trade for a public explorer.
 * Owner decision, 2026-09-04.
 *
 * ONLY this pair. Khulo 2024 carries
 * `functional_total_fallback_missing_payment_actual` because its workbook
 * publishes a plan rather than an actual, and still breaks the comparison; so
 * does any definition change introduced later, and so does a change of measure
 * or level. Accepting one measured case is not the same as accepting the idea.
 */
const ACCEPTED_BASIS_CHANGE = new Set(["portal_functional_total_fallback", "total_payments"]);

/** `municipal:amount_gel:total:total_payments` -> scope `municipal:amount_gel:total`, basis `total_payments`. */
function splitDefinition(id: string): [scope: string, basis: string] {
  const cut = id.lastIndexOf(":");
  return cut === -1 ? [id, ""] : [id.slice(0, cut), id.slice(cut + 1)];
}

function definitionChangeBreaks(fromId: string, toId: string): boolean {
  if (fromId === toId) return false;
  const [fromScope, fromBasis] = splitDefinition(fromId);
  const [toScope, toBasis] = splitDefinition(toId);
  // A different measure or level is a different quantity, never merely a
  // different basis for the same one.
  if (fromScope !== toScope) return true;
  return !(ACCEPTED_BASIS_CHANGE.has(fromBasis) && ACCEPTED_BASIS_CHANGE.has(toBasis));
}

/**
 * How each caveat code bears on a two-year comparison, taken from the rule that
 * declares it (caveats/engine.ts ComparisonEffect).
 *
 * This replaced a hand-maintained literal set that contained exactly one code.
 * Nothing could prove that set complete, and it was not: revenue_internal_flows_netted
 * marks the year from which a revenue series SUBTRACTS internal flows, so
 * revenue.grants 2005 and 2020 count different things - and the pair was published
 * as "comparable, +651.19%". Moving the decision onto the rule forces whoever adds
 * the next rule to make it, and a test can now assert every code is classified.
 */
const COMPARISON_EFFECT = new Map(CAVEAT_RULES.map((rule) => [rule.code, rule.comparisonEffect]));

const REASON_SEVERE_ASYMMETRY = "ერთ-ერთ საზღვარზე მოქმედებს მოცულობის შემზღუდველი შენიშვნა, მეორეზე კი არა — წლები ერთსა და იმავეს არ ზომავს.";
const REASON_DEFINITION_CHANGED = "საზღვრები სხვადასხვა განსაზღვრებით არის გაზომილი, ამიტომ ზრდა პირდაპირ შედარებადი არ არის.";
const REASON_BASIS_DIFFERS = "საზღვრებს განსხვავებული საფუძველი აქვს (ფაქტი / გეგმა), ამიტომ ზრდა შედარებადი არ არის.";
const REASON_ENDPOINT_MISSING = "ერთ-ერთი საზღვრის მნიშვნელობა მიუწვდომელია, ამიტომ ცვლილება არ გამოითვლება.";
const REASON_NON_POSITIVE_BASE = "საწყისი მაჩვენებელი ნულოვანი ან უარყოფითია, ამიტომ პროცენტული ზრდა არ გამოითვლება.";
const REASON_GDP_STANDARD_BREAK = "მშპ-ის აღრიცხვის სტანდარტი შუალედში იცვლება, ამიტომ შედარება შეზღუდულია.";
const REASON_HISTORICAL_JOIN = "ერთ-ერთი საზღვარი დამტკიცებული ისტორიული შეერთებით არის მოწოდებული, ამიტომ შედარება შეზღუდულია.";

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
    valueDefinitionId: observation.valueDefinitionId,
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
  // Handed to the sub-query so IT evaluates the comparison-only rules against
  // its own pre-scoped inputs. compare() previously rebuilt a CaveatContext by
  // hand; three of its fields disagreed with the query for the identical rows.
  const comparisonWindow = { fromYear: input.fromYear, toYear: input.toYear };

  // Endpoints come from the observation queries, so `compare` owns no second
  // copy of the value arithmetic (Global Constraints: never duplicate a
  // formula). Their own caveats are recomputed below with `comparison` set,
  // because two rules exist only for comparisons.
  let endpointResult: FactQueryResponse;
  let datasetId: DatasetId;

  if (target.dataset === "national") {
    datasetId = target.side === "revenue" ? "national-revenue" : "national-expenditure";
    endpointResult = queryNational(
      snapshot,
      {
      side: target.side,
      seriesIds: target.seriesIds,
      years,
      measure: input.measure,
      },
      comparisonWindow,
    );
  } else if (target.dataset === "ministries") {
    datasetId = "ministries";
    endpointResult = queryMinistries(
      snapshot,
      {
      level: target.level,
      seriesIds: target.seriesIds,
      years,
      measure: input.measure,
      },
      comparisonWindow,
    );
  } else if (target.dataset === "debt") {
    datasetId = "government-debt";
    endpointResult = queryDebt(
      snapshot,
      {
      seriesIds: target.seriesIds,
      years,
      measure: input.measure,
      },
      comparisonWindow,
    );
  } else if (target.dataset === "deficit") {
    datasetId = "general-government-balance";
    // No seriesIds: the dataset has exactly one series.
    endpointResult = queryDeficit(snapshot, { years, measure: input.measure }, comparisonWindow);
  } else {
    datasetId = "municipal-expenditure";
    endpointResult = queryMunicipal(
      snapshot,
      {
      entityIds: target.entityIds,
      seriesIds: target.seriesIds,
      years,
      measure: input.measure,
      },
      comparisonWindow,
    );
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

  for (const [key, pair] of byPair) {
    const from = pair.from;
    const to = pair.to;
    if (!from || !to) continue;

    const reasons: string[] = [];

    if (from.value === null || to.value === null) reasons.push(REASON_ENDPOINT_MISSING);
    if (from.basis !== null && to.basis !== null && from.basis !== to.basis) reasons.push(REASON_BASIS_DIFFERS);
    // The STRUCTURED identity, never the display prose. valueDefinition is written
    // for a reader: it stays constant across the municipal 2015 portal-fallback
    // break (so a +572.1% education "growth" was published, and rank turned it
    // into a 64-row league table) and it VARIES when a ministries program is
    // merely renamed (so 48 of 48 programs were excluded and rankings came back
    // empty). It is wrong in both directions and must not decide this.
    if (definitionChangeBreaks(from.valueDefinitionId, to.valueDefinitionId)) reasons.push(REASON_DEFINITION_CHANGED);

    // A coverage-changing caveat that describes one endpoint and not the other.
    const codes = Array.from(new Set([...from.caveatIds, ...to.caveatIds]));
    const asymmetric = (code: string) => from.caveatIds.includes(code) !== to.caveatIds.includes(code);
    if (codes.some((code) => COMPARISON_EFFECT.get(code) === "breaks" && asymmetric(code))) {
      reasons.push(REASON_SEVERE_ASYMMETRY);
    }
    const limiting = codes.filter((code) => COMPARISON_EFFECT.get(code) === "limits");

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
    } else if (gdpStandardBreak || limiting.length > 0) {
      // Still answerable, but the reader must be told. A GDP accounting change
      // and an approved program-history join both land here: spec 6.6 requires a
      // join to qualify a comparison, and it previously changed nothing at all.
      comparability = "limited";
      if (gdpStandardBreak) reasons.push(REASON_GDP_STANDARD_BREAK);
      if (limiting.includes("program_historical_join")) reasons.push(REASON_HISTORICAL_JOIN);
    } else {
      comparability = "comparable";
    }

    comparisons.push({
      comparisonId: `${datasetId}:${key.replace("::", ":")}:${input.fromYear}-${input.toYear}:${input.measure}`,
      datasetId,
      entityId: from.entityId,
      entityLabelKa: from.entityLabelKa,
      seriesId: from.seriesId,
      seriesLabelKa: from.seriesLabelKa,
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

  // The sub-query already evaluated every rule against its own pre-scoped
  // context, WITH comparisonWindow set, so the comparison-only rules fired there
  // and their codes are already on the endpoint rows caveatIds. Rebuilding a
  // context here is what produced a false severe provenance caveat on every
  // program cell and silently dropped severe municipal caveats for regions.
  const caveats = endpointResult.meta.caveats;

  const comparableCount = comparisons.filter((c) => c.comparability !== "not_comparable").length;
  // "empty" only when there is genuinely nothing to read. A declined comparison
  // still returns both reviewed endpoint values, and reporting that as empty
  // invited a consumer to short-circuit and discard the two numbers the decline
  // was careful to preserve.
  const status: "ok" | "partial" | "empty" =
    comparisons.length === 0
      ? "empty"
      : comparableCount === comparisons.length
        ? "ok"
        : "partial";

  const meta = buildResponseMeta(snapshot, {
    // Re-resolved from the snapshot rather than reused from the sub-query's
    // meta: that copy is already compacted for a response, and buildResponseMeta
    // needs the full record to decide what this response states once and what
    // it states per document.
    sources: selectSources(snapshot, endpointResult.meta.sources.map((source) => source.sourceId)),
    caveats,
    // A comparison's evidence is whatever supports its two endpoints, not
    // every document of every source the underlying query touched.
    citedDocumentIds: [
      ...new Set(comparisons.flatMap((comparison) => [...comparison.from.documentIds, ...comparison.to.documentIds])),
    ],
  });

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
