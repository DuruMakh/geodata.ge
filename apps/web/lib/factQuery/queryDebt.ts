// apps/web/lib/factQuery/queryDebt.ts
//
// Government debt: how much is owed (stock), what was paid on it (service),
// and at what rate (rate). Central-government liabilities published by the
// Ministry of Finance.
//
// This is NOT a budget dataset. Every observation's budgetScope says
// central_government_liabilities, and debt_not_budget_scope
// (caveats/rules.debt.ts) fires on every response, because adding debt to
// expenditure or subtracting it from receipts is the error a reader is most
// likely to make with these numbers in front of them.
import { serviceLabelEn, serviceMessage, type ServiceMessageKey } from "./localization";
import { CAVEAT_RULES, evaluateCaveats } from "./caveats";
import { buildResponseMeta } from "./meta";
import { buildObservationId, caveatIdsForObservation, resolveDocumentIds, uniqueSorted } from "./observations";
import { queryDebtInput } from "./schemas";
import { selectSources, splitSourceIds } from "./sources";
import { DEBT_SERIES_LABELS_KA } from "./types";
import type { CaveatContext } from "./caveats";
import type { Observation } from "./observations";
import type { Basis, Coverage, DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot, Unit } from "./types";

const DATASET_ID: DatasetId = "government-debt";
const ENTITY_ID = "country.georgia";
const ENTITY_LABEL_KA = "საქართველო";
// Must equal describeCoverage.ts's DATASET_META entry for this dataset: an
// observation and the catalogue entry describing it are two halves of one join.
const BUDGET_SCOPE = "central_government_liabilities";

type Family = "stock" | "service" | "rate";

/**
 * A rate is a percent per annum; a stock is an amount. Asking for one with the
 * other's measure is rejected rather than answered with an empty result: an
 * empty result reads as "no data for those years", which would be false.
 */
const MEASURES_BY_FAMILY: Record<Family, ReadonlySet<string>> = {
  stock: new Set(["amount_gel", "share_of_gdp_pct"]),
  service: new Set(["amount_gel", "share_of_gdp_pct"]),
  rate: new Set(["rate_percent"]),
};

const RATE_NOT_PUBLISHED_KEY = "missing.rateNotPublished" as const;
const GDP_DENOMINATOR_MISSING_KEY = "missing.gdpDenominator" as const;


/**
 * Only for input validation, before any fact is in hand; everywhere a fact
 * exists its own typed `family` field is used instead. Falling back rather than
 * casting keeps a future id with an unexpected shape returning a structured
 * measure error instead of throwing on an undefined lookup.
 */
function familyOf(seriesId: string): Family {
  const segment = seriesId.split(".")[1];
  return segment === "stock" || segment === "service" || segment === "rate" ? segment : "stock";
}

/**
 * The served status carries three values; the response model carries two plus
 * null. `not_available` is not a basis at all - it means there is no value to
 * describe, so the cell is missing and its basis is null.
 */
function basisOf(status: string): Basis | null {
  if (status === "actual") return "actual";
  if (status === "projection_existing_portfolio") return "projection";
  return null;
}

function valueDefinitionFor(snapshot: FactQuerySnapshot, locale: "ka" | "en", family: Family, measure: string): string {
  if (measure === "rate_percent") {
    return serviceMessage(snapshot, locale, "definitions.debtRate");
  }
  if (measure === "share_of_gdp_pct") {
    return serviceMessage(snapshot, locale, "definitions.shareOfGdp");
  }
  return family === "stock"
    ? serviceMessage(snapshot, locale, "definitions.debtStock")
    : serviceMessage(snapshot, locale, "definitions.debtService");
}

/**
 * The reviewed debt facts cite a document by its bare manifest id
 * (`mof_public_debt_bulletin_n25`), while data/sources/source-documents.csv
 * requires dot-namespaced ids and registers the same documents as
 * `source.mof_...`. Translating here keeps both files in the form their own
 * validator demands, instead of editing reviewed rows to satisfy a registry.
 */
export function registrySourceId(id: string): string {
  return id.startsWith("source.") ? id : `source.${id}`;
}

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

export function queryDebt(
  snapshot: FactQuerySnapshot,
  rawInput: unknown,
  comparison: CaveatContext["comparison"] = null,
): FactQueryResponse {
  const parsed = queryDebtInput.safeParse(rawInput);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: serviceMessage(snapshot, "ka", "errors.invalidParameters"),
      messageEn: serviceMessage(snapshot, "en", "errors.invalidParameters", { issues: issues }),
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
  const facts = snapshot.debt.facts;
  const knownSeriesIds = new Set<string>(facts.map((fact) => fact.seriesId));

  const unknownSeriesIds = input.seriesIds.filter((id) => !knownSeriesIds.has(id));
  if (unknownSeriesIds.length > 0) {
    return errorResponse(snapshot, {
      code: "unknown_series",
      messageKa: serviceMessage(snapshot, "ka", "errors.unknownSeries", { unknownSeriesIds: unknownSeriesIds.join(", ") }),
      messageEn: serviceMessage(snapshot, "en", "errors.unknownSeries", { unknownSeriesIds: unknownSeriesIds.join(", ") }),
      retryable: false,
      validChoices: Array.from(knownSeriesIds).sort(),
    });
  }

  const mismatched = input.seriesIds.filter((id) => !MEASURES_BY_FAMILY[familyOf(id)].has(input.measure));
  if (mismatched.length > 0) {
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: serviceMessage(snapshot, "ka", "errors.measureSeriesMismatch", { measure: input.measure, mismatched: mismatched.join(", ") }),
      messageEn: serviceMessage(snapshot, "en", "errors.measureSeriesMismatch", { measure: input.measure, mismatched: mismatched.join(", ") }),
      retryable: false,
      validChoices: Array.from(MEASURES_BY_FAMILY[familyOf(mismatched[0]!)]).sort(),
    });
  }

  // Per family, not across the dataset: stock ends at the last actual year
  // while service runs on into its projections, and a request for a service
  // projection year must not be refused because no stock row reaches it.
  const requestedFamilies = new Set(input.seriesIds.map(familyOf));
  const familyYears = facts.filter((fact) => requestedFamilies.has(fact.family)).map((fact) => fact.year);
  const availableYears = Array.from(new Set(familyYears)).sort((a, b) => a - b);
  const minYear = availableYears[0];
  const maxYear = availableYears[availableYears.length - 1];

  if (minYear === undefined || maxYear === undefined) {
    throw new Error(`queryDebt: dataset "${DATASET_ID}" has no facts to derive a year range from`);
  }

  const outOfRangeYears = input.years.filter((year) => year < minYear || year > maxYear);
  if (outOfRangeYears.length > 0) {
    return errorResponse(snapshot, {
      code: "year_out_of_range",
      messageKa: serviceMessage(snapshot, "ka", "errors.yearsOutOfRange", { outOfRangeYears: outOfRangeYears.join(", "), minYear: minYear, maxYear: maxYear }),
      messageEn: serviceMessage(snapshot, "en", "errors.yearsOutOfRange", { outOfRangeYears: outOfRangeYears.join(", "), minYear: minYear, maxYear: maxYear }),
      retryable: false,
    });
  }

  const factByKey = new Map(facts.map((fact) => [`${fact.seriesId}:${fact.year}`, fact]));
  const gdpByYear = new Map(snapshot.gdpFacts.map((fact) => [fact.year, fact]));
  const usedGdpYears = new Set<number>();
  const cores: Omit<Observation, "caveatIds" | "documentIds">[] = [];

  for (const seriesId of input.seriesIds) {
    const family = familyOf(seriesId);

    for (const year of input.years) {
      const fact = factByKey.get(`${seriesId}:${year}`);

      let value: number | null = null;
      let basis: Basis | null = null;
      let sourceIds: string[] = [];
      let missingReasonKey: ServiceMessageKey | null = null;

      if (fact === undefined) {
        missingReasonKey = "missing.seriesYear";
      } else if (fact.value === null) {
        // A published gap, not an absent row: the reviewed data says this
        // year/scope was never published rather than saying nothing at all.
        // Branching on the family rather than assuming: every null in the
        // reviewed file today is a rate, and a future null amount must not
        // inherit a message about interest rates.
        missingReasonKey = fact.family === "rate" ? RATE_NOT_PUBLISHED_KEY : "missing.seriesYear";
      } else {
        basis = basisOf(fact.status);
        const factSourceIds =
          fact.sourceId === null || fact.sourceId === ""
            ? []
            : splitSourceIds(fact.sourceId).map(registrySourceId);

        if (input.measure === "share_of_gdp_pct") {
          usedGdpYears.add(year);
          const gdp = gdpByYear.get(year);
          if (!gdp || gdp.gdpCurrentPricesGel <= 0) {
            missingReasonKey = GDP_DENOMINATOR_MISSING_KEY;
            basis = null;
          } else {
            value = (fact.value / gdp.gdpCurrentPricesGel) * 100;
            sourceIds = uniqueSorted([...factSourceIds, ...splitSourceIds(gdp.sourceId)]);
          }
        } else {
          value = fact.value;
          sourceIds = factSourceIds;
        }
      }

      const availability = value === null ? "missing" : "available";
      const unit: Unit = input.measure === "amount_gel" ? "GEL" : "percent";

      cores.push({
        observationId: buildObservationId(DATASET_ID, ENTITY_ID, seriesId, year, input.measure),
        datasetId: DATASET_ID,
        budgetScope: BUDGET_SCOPE,
        entityId: ENTITY_ID,
        entityType: "country",
        entityLabelKa: ENTITY_LABEL_KA,
        entityLabelEn: serviceLabelEn(snapshot, ENTITY_ID),
        entitySlug: null,
        seriesId,
        seriesLabelKa: DEBT_SERIES_LABELS_KA[seriesId] ?? seriesId,
        seriesLabelEn: serviceLabelEn(snapshot, seriesId),
        level: family,
        parentSeriesId: null,
        year,
        measure: input.measure,
        unit,
        value,
        availability,
        missingReason: availability === "missing" && missingReasonKey !== null ? serviceMessage(snapshot, "ka", missingReasonKey, { year: year }) : null,
        missingReasonEn: availability === "missing" && missingReasonKey !== null ? serviceMessage(snapshot, "en", missingReasonKey, { year: year }) : null,
        basis: availability === "missing" ? null : basis,
        valueDefinition: valueDefinitionFor(snapshot, "ka", family, input.measure),
        valueDefinitionEn: valueDefinitionFor(snapshot, "en", family, input.measure),
        // Carries the family and the measure, so compare() can tell a stock
        // from a service figure even when both are amount_gel.
        valueDefinitionId: `${DATASET_ID}:${family}:${input.measure}`,
        sourceIds,
      });
    }
  }

  const resolvedSources = selectSources(snapshot, uniqueSorted(cores.flatMap((core) => core.sourceIds)));
  const withDocuments: Omit<Observation, "caveatIds">[] = cores.map((core) => ({
    ...core,
    documentIds: resolveDocumentIds(resolvedSources, core.sourceIds),
  }));

  const caveatContext: CaveatContext = {
    datasetId: DATASET_ID,
    measure: input.measure,
    years: input.years,
    seriesIds: input.seriesIds,
    // Empty for the same reason queryNational leaves it empty: debt has no
    // entity-selection dimension, and populating it with "country.georgia"
    // would fire the municipal rules that key on that literal id.
    entityIds: [],
    observations: withDocuments.map((o) => ({
      entityId: o.entityId,
      seriesId: o.seriesId,
      level: o.level,
      parentSeriesId: o.parentSeriesId,
      year: o.year,
      value: o.value,
      basis: o.basis,
      valueDefinitionId: o.valueDefinitionId,
    })),
    municipalTotalInputs: [],
    municipalInputServedBy: {},
    gdpInputs: snapshot.gdpFacts.filter((fact) => usedGdpYears.has(fact.year)),
    comparison,
    historicalJoinSeriesYears: snapshot.ministries.historicalJoinSeriesYears,
    adminCategoryYears: [],
  };
  const caveats = evaluateCaveats(snapshot, caveatContext, CAVEAT_RULES);

  const observations: Observation[] = withDocuments.map((o) => ({ ...o, caveatIds: caveatIdsForObservation(caveats, o) }));
  const returnedCount = observations.filter((o) => o.availability === "available").length;

  const coverage: Coverage = {
    requestedYears: input.years,
    availableYears,
    returnedYears: Array.from(
      new Set(observations.filter((o) => o.availability === "available").map((o) => o.year)),
    ).sort((a, b) => a - b),
    missingCells: observations
      .filter((o) => o.availability === "missing")
      .map((o) => ({ entityId: o.entityId, seriesId: o.seriesId, year: o.year, reason: o.missingReason ?? "", reasonEn: o.missingReasonEn ?? "" })),
    excludedEntities: [],
    returnedCount,
    expectedCount: observations.length,
  };

  const status: "ok" | "partial" | "empty" =
    returnedCount === 0 ? "empty" : returnedCount === observations.length ? "ok" : "partial";
  const meta = buildResponseMeta(snapshot, {
    sources: resolvedSources,
    caveats,
    citedDocumentIds: [...new Set(observations.flatMap((observation) => observation.documentIds))],
  });

  return { kind: "observations", status, data: { observations, coverage }, meta };
}
