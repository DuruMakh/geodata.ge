// apps/web/lib/factQuery/observations.ts
//
// Shared building blocks for the observation-shaped query functions.
// queryNational is the first caller; queryMinistries and queryMunicipal
// (Tasks 13/14) return the same Observation shape (spec section 7.2) and
// face the same three small problems this file solves once: building the
// id, resolving sourceIds into documentIds without re-querying sources per
// row, and deciding which already-evaluated request-level caveats belong on
// one specific observation's caveatIds.
import type { Caveat, DatasetId, Measure, ResolvedSource, Availability } from "./types";

/**
 * One value on one line of a query-function response, per spec section 7.2.
 * Georgian labels only: there is no seriesLabelEn/entityLabelEn/labelEn
 * field anywhere in this shape. The stable id (seriesId, entityId) carries
 * the Latin handle a caller needs for matching; only Caveat and
 * FactQueryError carry English text.
 */
export type Observation = {
  observationId: string;
  datasetId: DatasetId;
  budgetScope: string;
  entityId: string;
  entityType: "country" | "municipality" | "region";
  entityLabelKa: string;
  /** The existing URL slug. Present for municipalities only; null otherwise. */
  entitySlug: string | null;
  seriesId: string;
  seriesLabelKa: string;
  level: string;
  parentSeriesId: string | null;
  year: number;
  measure: Measure;
  unit: "GEL" | "percent" | "GEL_per_resident";
  value: number | null;
  availability: Availability;
  missingReason: string | null;
  basis: "actual" | "planned" | null;
  valueDefinition: string;
  sourceIds: string[];
  documentIds: string[];
  caveatIds: string[];
};

/** observationId's one fixed template (spec section 7.2), so every query function builds it identically. */
export function buildObservationId(datasetId: DatasetId, entityId: string, seriesId: string, year: number, measure: Measure): string {
  return `${datasetId}:${entityId}:${seriesId}:${year}:${measure}`;
}

export function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

/**
 * documentIds for one observation, given the sources already resolved for
 * the whole response. Takes the resolved list rather than the snapshot so a
 * caller resolves sourceIds once per response (selectSources over the union
 * of every observation's sourceIds) instead of re-walking snapshot.sources
 * once per row.
 */
export function resolveDocumentIds(resolvedSources: readonly ResolvedSource[], sourceIds: readonly string[]): string[] {
  const documentIdsBySourceId = new Map(resolvedSources.map((source) => [source.sourceId, source.documents.map((doc) => doc.documentId)]));
  const seen = new Set<string>();
  const documentIds: string[] = [];

  for (const sourceId of sourceIds) {
    for (const documentId of documentIdsBySourceId.get(sourceId) ?? []) {
      if (seen.has(documentId)) continue;
      seen.add(documentId);
      documentIds.push(documentId);
    }
  }

  return documentIds;
}

/**
 * Which of the request's already-evaluated caveats (meta.caveats) belong on
 * one specific observation's caveatIds.
 *
 * Caveat.affects (caveats/engine.ts) has no single shape across the 22
 * rules: some list bare series or entity ids, some "id:year", some bare
 * years, and the two GDP rules list "gdp"/"gdp:year" since GDP is a
 * denominator a rule can flag, not a queryable series of its own. This
 * matches every shape a rule in the catalogue actually produces, rather
 * than re-deriving each rule's own `applies` per observation - that would
 * need a different context shape per rule (nominal_gel reads the whole
 * REQUEST's year count; revenue_2004_total_scope reads a single
 * observation's own year) and no one per-observation context satisfies
 * both.
 */
export function caveatIdsForObservation(
  caveats: readonly Caveat[],
  observation: { entityId: string; seriesId: string; year: number; measure: Measure },
): string[] {
  const seriesYear = `${observation.seriesId}:${observation.year}`;
  const entityYear = `${observation.entityId}:${observation.year}`;
  const year = String(observation.year);

  return caveats
    .filter(
      (caveat) =>
        caveat.affects.includes(seriesYear) ||
        caveat.affects.includes(entityYear) ||
        caveat.affects.includes(observation.seriesId) ||
        caveat.affects.includes(observation.entityId) ||
        caveat.affects.includes(year) ||
        (observation.measure === "share_of_gdp_pct" && (caveat.affects.includes("gdp") || caveat.affects.includes(`gdp:${year}`))),
    )
    .map((caveat) => caveat.code);
}
