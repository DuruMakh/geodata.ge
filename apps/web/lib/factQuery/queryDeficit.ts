// apps/web/lib/factQuery/queryDeficit.ts
//
// The general government balance, published by the IMF (World Economic
// Outlook). One series, two measures, both taken from the reviewed row: the
// percent of GDP and the GEL amount are published, not derived here.
//
// Two things about this dataset are easy to get wrong, and both are guarded:
//
// 1. VALUES ARE SIGNED. A negative value is a deficit. Nothing here takes an
//    absolute value or flips a sign, and the valueDefinition says so in
//    Georgian so a client repeating it cannot quietly drop the sign.
// 2. GENERAL government is a wider boundary than either national series this
//    service serves. It is NOT their difference, which is why
//    deficit_general_government_scope fires on every response.
import { serviceLabelEn, serviceMessage } from "./localization";
import { CAVEAT_RULES, evaluateCaveats } from "./caveats";
import { buildResponseMeta } from "./meta";
import { buildObservationId, caveatIdsForObservation, resolveDocumentIds, uniqueSorted } from "./observations";
import { queryDeficitInput } from "./schemas";
import { selectSources, splitSourceIds } from "./sources";
import { DEFICIT_SERIES_ID } from "./types";
import type { CaveatContext } from "./caveats";
import type { Observation } from "./observations";
import type { Basis, Coverage, DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot, Unit } from "./types";

const DATASET_ID: DatasetId = "general-government-balance";
const ENTITY_ID = "country.georgia";
const ENTITY_LABEL_KA = "საქართველო";
const SERIES_LABEL_KA = "ზოგადი მთავრობის ბალანსი";
// Must equal describeCoverage.ts's DATASET_META entry for this dataset.
const BUDGET_SCOPE = "general_government_imf";



function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

export function queryDeficit(
  snapshot: FactQuerySnapshot,
  rawInput: unknown,
  comparison: CaveatContext["comparison"] = null,
): FactQueryResponse {
  const parsed = queryDeficitInput.safeParse(rawInput);

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
  const facts = snapshot.deficit.facts;
  const availableYears = Array.from(new Set(facts.map((fact) => fact.year))).sort((a, b) => a - b);
  const minYear = availableYears[0];
  const maxYear = availableYears[availableYears.length - 1];

  if (minYear === undefined || maxYear === undefined) {
    throw new Error(`queryDeficit: dataset "${DATASET_ID}" has no facts to derive a year range from`);
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

  const factByYear = new Map(facts.map((fact) => [fact.year, fact]));
  const cores: Omit<Observation, "caveatIds" | "documentIds">[] = [];

  for (const year of input.years) {
    const fact = factByYear.get(year);

    // Both measures come straight off the reviewed row. Neither is computed
    // from the other, and neither is re-signed.
    const value =
      fact === undefined
        ? null
        : input.measure === "amount_gel"
          ? fact.generalGovernmentBalanceGel
          : fact.generalGovernmentBalancePctGdp;
    const availability = value === null ? "missing" : "available";
    const unit: Unit = input.measure === "amount_gel" ? "GEL" : "percent";
    const basis: Basis | null = fact === undefined ? null : fact.status === "projection" ? "projection" : "actual";

    cores.push({
      observationId: buildObservationId(DATASET_ID, ENTITY_ID, DEFICIT_SERIES_ID, year, input.measure),
      datasetId: DATASET_ID,
      budgetScope: BUDGET_SCOPE,
      entityId: ENTITY_ID,
      entityType: "country",
      entityLabelKa: ENTITY_LABEL_KA,
        entityLabelEn: serviceLabelEn(snapshot, ENTITY_ID),
      entitySlug: null,
      seriesId: DEFICIT_SERIES_ID,
      seriesLabelKa: SERIES_LABEL_KA,
      seriesLabelEn: serviceLabelEn(snapshot, DEFICIT_SERIES_ID),
      level: "total",
      parentSeriesId: null,
      year,
      measure: input.measure,
      unit,
      value,
      availability,
      missingReason: availability === "missing" ? serviceMessage(snapshot, "ka", "missing.balanceYear", { year }) : null,
      missingReasonEn: availability === "missing" ? serviceMessage(snapshot, "en", "missing.balanceYear", { year }) : null,
      basis: availability === "missing" ? null : basis,
      valueDefinition: serviceMessage(snapshot, "ka", input.measure === "amount_gel" ? "definitions.balanceAmount" : "definitions.balanceShare"),
      valueDefinitionEn: serviceMessage(snapshot, "en", input.measure === "amount_gel" ? "definitions.balanceAmount" : "definitions.balanceShare"),
      valueDefinitionId: `${DATASET_ID}:${input.measure}`,
      sourceIds: fact === undefined ? [] : splitSourceIds(fact.sourceId),
    });
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
    seriesIds: [DEFICIT_SERIES_ID],
    // Empty for the same reason queryNational leaves it empty: no
    // entity-selection dimension, and "country.georgia" here would fire the
    // municipal rules that key on that literal id.
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
    // The IMF publishes its own GDP alongside the ratio, so this service's GDP
    // facts are not a denominator here and must not be cited as one.
    gdpInputs: [],
    comparison,
    historicalJoinSeriesYears: snapshot.ministries.historicalJoinSeriesYears,
    adminCategoryYears: [],
  };
  const caveats = evaluateCaveats(caveatContext, CAVEAT_RULES);

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
