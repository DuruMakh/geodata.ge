import { REGIONAL_GDP_TOTAL } from "../data/regionalEconomies/types";
import { queryRegionalEconomiesInput } from "../mcp/schemas.regional-economies";
import { buildResponseMeta } from "./meta";
import { buildObservationId, resolveDocumentIds, type Observation } from "./observations";
import { REGIONAL_ECONOMY_QUERY_MEASURES } from "./regionalEconomySeries";
import { selectSources } from "./sources";
import type { FactQueryResponse, FactQuerySnapshot } from "./types";

function error(snapshot: FactQuerySnapshot, code: string, messageEn: string, messageKa: string): FactQueryResponse {
  return { kind: "error", status: "error", error: { code, messageEn, messageKa, retryable: false }, meta: buildResponseMeta(snapshot) };
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_value, index) => first + index);
}

export function queryRegionalEconomies(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const parsed = queryRegionalEconomiesInput.safeParse(rawInput);
  if (!parsed.success) {
    return error(snapshot, "invalid_parameters", "Provide valid region IDs, series IDs, annual years and one supported measure.", "მიუთითეთ სწორი რეგიონები, სერიები, წლები და მხარდაჭერილი მაჩვენებელი.");
  }
  const input = parsed.data;
  if (input.expectedDataVersion && input.expectedDataVersion !== snapshot.dataVersion) {
    return error(snapshot, "data_version_changed", "Data version changed; refresh coverage.", "მონაცემების ვერსია შეიცვალა; განაახლეთ დაფარვის ინფორმაცია.");
  }

  const { facts, regions, registry, definitions } = snapshot.regionalEconomies;
  const regionIds = input.regionIds ?? regions.map((region) => region.id);
  const seriesIds = input.seriesIds ?? registry.map((series) => series.id);
  const knownRegions = new Set(regions.map((region) => region.id));
  const knownSeries = new Set(registry.map((series) => series.id));
  if (regionIds.some((id) => !knownRegions.has(id))) {
    return error(snapshot, "unknown_entity", "Unknown regional economy region ID.", "რეგიონული ეკონომიკის რეგიონის ID უცნობია.");
  }
  if (seriesIds.some((id) => !knownSeries.has(id))) {
    return error(snapshot, "unknown_series", "Unknown regional economy series ID.", "რეგიონული ეკონომიკის სერიის ID უცნობია.");
  }

  const availableYears = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);
  const firstYear = availableYears[0]!;
  const lastYear = availableYears.at(-1)!;
  const requestedYears = input.years ?? (
    input.fromYear !== undefined && input.toYear !== undefined
      ? range(input.fromYear, input.toYear)
      : availableYears
  );
  if (requestedYears.some((year) => year < firstYear || year > lastYear)) {
    return error(snapshot, "year_out_of_range", `Years must fall within ${firstYear}–${lastYear}; 2025 is not published.`, `წლები უნდა იყოს ${firstYear}–${lastYear} შუალედში; 2025 წელი გამოქვეყნებული არ არის.`);
  }

  const measure = REGIONAL_ECONOMY_QUERY_MEASURES[input.measure];
  const selected = facts.filter(
    (fact) => fact.measure === measure && regionIds.includes(fact.regionId) && seriesIds.includes(fact.seriesId) && requestedYears.includes(fact.year),
  );
  const factByCell = new Map(selected.map((fact) => [`${fact.regionId}:${fact.seriesId}:${fact.year}`, fact]));
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const seriesById = new Map(registry.map((series) => [series.id, series]));
  const sources = selectSources(snapshot, [...new Set(selected.map((fact) => fact.sourceId))]);
  const documentIdsBySource = new Map(sources.map((source) => [source.sourceId, resolveDocumentIds(sources, [source.sourceId])]));
  const observations: Observation[] = regionIds.flatMap((regionId) =>
    seriesIds.flatMap((seriesId) =>
      requestedYears.map((year) => {
        const fact = factByCell.get(`${regionId}:${seriesId}:${year}`);
        const region = regionById.get(regionId)!;
        const series = seriesById.get(seriesId)!;
        const definition = definitions[measure];
        const total = seriesId === REGIONAL_GDP_TOTAL;
        return {
          observationId: buildObservationId("regional-economies", regionId, seriesId, year, input.measure),
          datasetId: "regional-economies",
          budgetScope: "regional_accounts",
          entityId: regionId,
          entityType: "region",
          entityLabelKa: region.kaLabel,
          entityLabelEn: snapshot.localization.labelsEn[regionId]!,
          entitySlug: null,
          seriesId,
          seriesLabelKa: total ? "რეგიონის მთლიანი მშპ" : series.labelKa,
          seriesLabelEn: total ? "Total regional GDP" : series.labelEn,
          level: total ? "total" : "economic_activity",
          parentSeriesId: null,
          year,
          measure: input.measure,
          unit: measure === "nominal" ? "GEL" : "percent",
          value: fact ? Number(fact.value) : null,
          availability: fact ? "available" : "missing",
          missingReason: fact ? null : "ამ წლის რეგიონული მონაცემი ხელმისაწვდომი არ არის.",
          missingReasonEn: fact ? null : "Regional data for this year are unavailable.",
          basis: fact?.status ?? null,
          valueDefinition: total ? definition.totalKa : definition.ka,
          valueDefinitionEn: total ? definition.totalEn : definition.en,
          valueDefinitionId: `regional-economies:${seriesId}:${measure}`,
          sourceIds: fact ? [fact.sourceId] : [],
          documentIds: fact ? documentIdsBySource.get(fact.sourceId) ?? [] : [],
          caveatIds: [],
        } satisfies Observation;
      }),
    ),
  );
  const available = observations.filter((observation) => observation.availability === "available");
  return {
    kind: "observations",
    status: available.length === observations.length ? "ok" : available.length ? "partial" : "empty",
    data: {
      observations,
      coverage: {
        requestedYears,
        availableYears,
        returnedYears: [...new Set(available.map((observation) => observation.year))],
        missingCells: observations
          .filter((observation) => observation.availability === "missing")
          .map((observation) => ({ entityId: observation.entityId, seriesId: observation.seriesId, year: observation.year, reason: observation.missingReason!, reasonEn: observation.missingReasonEn! })),
        excludedEntities: [],
        returnedCount: available.length,
        expectedCount: observations.length,
      },
    },
    meta: buildResponseMeta(snapshot, {
      sources,
      citedDocumentIds: [...new Set(observations.flatMap((observation) => observation.documentIds))],
    }),
  };
}
