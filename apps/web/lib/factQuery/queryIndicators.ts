// apps/web/lib/factQuery/queryIndicators.ts
//
// query_indicators: the topic chart pages' figures (snapshot.topics), one dataset per call, as the shared Observation
// shape. Values are the stored numbers unchanged; a missing cell stays missing. Runtime code: of the topic modules it
// imports only topics/store and topics/types (ruling R3). Caveats come from the registered catalogue
// (caveats/rules.topics.ts).
import { TOPIC_CAVEAT_RULES, evaluateCaveats, type CaveatContext } from "./caveats";
import { caveatIdsForObservation, buildObservationId, resolveDocumentIds, type Observation } from "./observations";
import { serviceMessage, type ServiceMessageKey } from "./localization";
import { buildResponseMeta } from "./meta";
import { queryIndicatorsInput, type QueryIndicatorsInput } from "./schemas";
import { selectSources } from "./sources";
import { topicCell, topicPeriodLabel } from "./topics/store";
import type { TopicDataset, TopicFact } from "./topics/types";
import type { FactQueryError, FactQueryResponse, FactQuerySnapshot } from "./types";

/** A topic dataset lists up to ~1,200 series; an error names at most this many valid ids. */
const VALID_CHOICES_CAP = 50;

const yearsByDataset = new WeakMap<TopicDataset, number[]>();

/** Every year the dataset holds a cell for, ascending. */
function datasetYears(dataset: TopicDataset): number[] {
  let years = yearsByDataset.get(dataset);
  if (!years) {
    years = [...new Set(dataset.columns.year)].sort((a, b) => a - b);
    yearsByDataset.set(dataset, years);
  }
  return years;
}

function datasetOf(snapshot: FactQuerySnapshot, datasetId: string): TopicDataset | undefined {
  return snapshot.topics.datasets.find((dataset) => dataset.page.datasetId === datasetId);
}

/** The dataset's country entity, or its only entity; a dataset with neither answers for all its places. */
function defaultEntityIds(dataset: TopicDataset): string[] {
  const country = dataset.entities.filter((entity) => entity.entityType === "country");
  return (country.length > 0 ? country : dataset.entities).map((entity) => entity.entityId);
}

function requestedYears(input: QueryIndicatorsInput, dataset: TopicDataset): number[] {
  if (input.years) return input.years;
  if (input.fromYear !== undefined && input.toYear !== undefined) return Array.from({ length: input.toYear - input.fromYear + 1 }, (_value, index) => input.fromYear! + index);
  return datasetYears(dataset);
}

/** Cells the request asks for, for the tool's pre-check: 0 when the request names no dataset the snapshot holds. */
export function indicatorCellCount(snapshot: FactQuerySnapshot, rawInput: unknown): number {
  const parsed = queryIndicatorsInput.safeParse(rawInput);
  if (!parsed.success) return 0;
  const dataset = datasetOf(snapshot, parsed.data.datasetId);
  if (!dataset) return 0;
  const { entityIds, seriesIds, years, fromYear, toYear } = parsed.data;
  // Counted, not listed: a caller-chosen range must not allocate one entry per year before it is refused.
  const yearCount = years?.length ?? (fromYear !== undefined && toYear !== undefined ? toYear - fromYear + 1 : datasetYears(dataset).length);
  return (entityIds ?? defaultEntityIds(dataset)).length * seriesIds.length * yearCount;
}

export function queryIndicators(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const error = (code: FactQueryError["code"], key: ServiceMessageKey, values: Record<string, string | number> = {}, validChoices?: string[]): FactQueryResponse => ({
    kind: "error",
    status: "error",
    error: { code, messageKa: serviceMessage(snapshot, "ka", key, values), messageEn: serviceMessage(snapshot, "en", key, values), retryable: false, ...(validChoices ? { validChoices } : {}) },
    meta: buildResponseMeta(snapshot),
  });
  const parsed = queryIndicatorsInput.safeParse(rawInput);
  if (!parsed.success) return error("invalid_parameters", "errors.invalidParameters", { issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ") });
  const input = parsed.data;
  if (input.expectedDataVersion !== undefined && input.expectedDataVersion !== snapshot.dataVersion) return error("data_version_changed", "errors.dataVersionChanged");

  const dataset = datasetOf(snapshot, input.datasetId);
  if (!dataset) return error("unknown_dataset", "errors.unknownDataset", { datasetId: input.datasetId }, snapshot.topics.datasets.map((entry) => entry.page.datasetId).slice(0, VALID_CHOICES_CAP));
  const seriesById = new Map(dataset.series.map((series) => [series.seriesId, series]));
  const entityById = new Map(dataset.entities.map((entity) => [entity.entityId, entity]));
  const unknownSeries = input.seriesIds.filter((id) => !seriesById.has(id));
  if (unknownSeries.length > 0) return error("unknown_series", "errors.unknownSeries", { unknownSeriesIds: unknownSeries.join(", ") }, [...seriesById.keys()].slice(0, VALID_CHOICES_CAP));
  const entityIds = input.entityIds ?? defaultEntityIds(dataset);
  const unknownEntities = entityIds.filter((id) => !entityById.has(id));
  if (unknownEntities.length > 0) return error("unknown_entity", "errors.unknownEntity", { unknownEntityIds: unknownEntities.join(", ") }, [...entityById.keys()].slice(0, VALID_CHOICES_CAP));
  // A range is checked by its ends before it is listed.
  const outOfRange = (input.years ?? (input.fromYear !== undefined && input.toYear !== undefined ? [input.fromYear, input.toYear] : [])).filter((year) => year < dataset.firstYear || year > dataset.lastYear);
  if (outOfRange.length > 0) return error("year_out_of_range", "errors.yearsOutOfRange", { outOfRangeYears: outOfRange.join(", "), minYear: dataset.firstYear, maxYear: dataset.lastYear });
  const years = requestedYears(input, dataset);

  const cells = entityIds.flatMap((entityId) => input.seriesIds.flatMap((seriesId) => years.map((year) => {
    const fact = topicCell(dataset, entityId, seriesId, year, snapshot.topics);
    return { entityId, seriesId, year, fact: fact !== undefined && fact.value !== null ? fact : undefined };
  })));
  const sources = selectSources(snapshot, [...new Set(cells.flatMap((cell) => cell.fact?.sourceIds ?? []))]);
  const available: { observation: Observation; fact: TopicFact }[] = [];
  const observations: Observation[] = cells.map(({ entityId, seriesId, year, fact }) => {
    const entity = entityById.get(entityId)!;
    const series = seriesById.get(seriesId)!;
    const unit = snapshot.topics.units[series.unit]!;
    const periodLabel = topicPeriodLabel(dataset, year);
    // A sub-series' own label ("All", "Public") reads only under its heading, as the page draws it.
    const headed = (heading: string | null, label: string) => (heading !== null && heading !== label ? `${heading} — ${label}` : label);
    const missing = { year: periodLabel ?? year };
    // A partial year states its months in the definition the row carries; the caveat says only that it is partial.
    // A dated point states its date the same way (ruling R30).
    const months = fact?.status === "partial" && fact.monthsReported !== undefined ? fact.monthsReported : undefined;
    const date = fact?.periodEnd;
    const definitionKey = months !== undefined ? "definitions.topicValuePartial" : date !== undefined ? "definitions.topicValueDated" : "definitions.topicValue";
    // A series note (what an "Other countries" line leaves out) follows the value's own sentence. A unit name that ends
    // in an abbreviation's stop ("million t CO₂ eq.") ends the sentence with that one stop.
    const definition = (locale: "ka" | "en") => [serviceMessage(snapshot, locale, definitionKey, {
      page: locale === "ka" ? dataset.urlKa : dataset.urlEn, unit: locale === "ka" ? unit.labelKa : unit.labelEn,
      ...(months !== undefined ? { months } : date !== undefined ? { date } : {}),
    }).replace(/\.\.$/u, "."), ...(series.note === undefined ? [] : [serviceMessage(snapshot, locale, series.note.key, series.note.values)])].join(" ");
    const observation: Observation = {
      observationId: buildObservationId(dataset.page.datasetId as Observation["datasetId"], entityId, seriesId, year, "value"),
      datasetId: dataset.page.datasetId as Observation["datasetId"],
      budgetScope: "topic",
      entityId,
      entityType: entity.entityType,
      entityLabelKa: entity.labelKa,
      entityLabelEn: entity.labelEn,
      entitySlug: null,
      seriesId,
      seriesLabelKa: headed(series.headingKa, series.labelKa),
      seriesLabelEn: headed(series.headingEn, series.labelEn),
      level: series.isTotal ? "total" : "series",
      parentSeriesId: series.parentSeriesId,
      year,
      ...(periodLabel === undefined ? {} : { periodLabel }),
      ...(fact?.periodEnd === undefined ? {} : { periodEnd: fact.periodEnd }),
      measure: "value",
      unit: series.unit,
      value: fact ? fact.value : null,
      availability: fact ? "available" : "missing",
      missingReason: fact ? null : serviceMessage(snapshot, "ka", "missing.seriesYear", missing),
      missingReasonEn: fact ? null : serviceMessage(snapshot, "en", "missing.seriesYear", missing),
      basis: fact ? fact.basis : null,
      valueDefinition: definition("ka"),
      valueDefinitionEn: definition("en"),
      // A partial year's or a dated point's definition names its months or its date, so its id does too: one id, one text.
      valueDefinitionId: `${dataset.page.datasetId}:${seriesId}:${series.unit}${months !== undefined ? `:months=${months}` : date !== undefined ? `:date=${date}` : ""}`,
      sourceIds: fact ? fact.sourceIds : [],
      documentIds: fact ? resolveDocumentIds(sources, fact.sourceIds) : [],
      caveatIds: [],
    };
    if (fact) available.push({ observation, fact });
    return observation;
  });
  const context: CaveatContext = {
    datasetId: dataset.page.datasetId as CaveatContext["datasetId"],
    measure: "value",
    years,
    seriesIds: input.seriesIds,
    entityIds,
    observations: available.map(({ observation, fact }) => ({ ...observation, status: fact.status })),
    municipalTotalInputs: [],
    municipalInputServedBy: {},
    gdpInputs: [],
    comparison: null,
    historicalJoinSeriesYears: [],
    adminCategoryYears: [],
  };
  const caveats = evaluateCaveats(snapshot, context, TOPIC_CAVEAT_RULES);
  for (const { observation } of available) observation.caveatIds = caveatIdsForObservation(caveats, observation);

  return {
    kind: "observations",
    status: available.length === observations.length ? "ok" : available.length > 0 ? "partial" : "empty",
    data: {
      observations,
      coverage: {
        requestedYears: years,
        availableYears: datasetYears(dataset),
        returnedYears: [...new Set(available.map(({ observation }) => observation.year))].sort((a, b) => a - b),
        missingCells: observations
          .filter((observation) => observation.availability === "missing")
          .map((observation) => ({ entityId: observation.entityId, seriesId: observation.seriesId, year: observation.year, reason: observation.missingReason!, reasonEn: observation.missingReasonEn! })),
        excludedEntities: [],
        returnedCount: available.length,
        expectedCount: observations.length,
      },
    },
    meta: buildResponseMeta(snapshot, { sources, caveats, citedDocumentIds: [...new Set(observations.flatMap((observation) => observation.documentIds))] }),
  };
}
