// apps/web/lib/factQuery/observations.ts
//
// Shared building blocks for the observation-shaped query functions.
// queryNational is the first caller; queryMinistries and queryMunicipal
// (Tasks 13/14) return the same Observation shape (spec section 7.2) and
// face the same three small problems this file solves once: building the
// id, resolving sourceIds into documentIds without re-querying sources per
// row, and deciding which already-evaluated request-level caveats belong on
// one specific observation's caveatIds.
import type { Availability, Caveat, DatasetId, Measure, ResolvedSource, Unit } from "./types";

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
  unit: Unit;
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
 * Caveat.affects (caveats/engine.ts) has no single shape across the 24
 * rules: some list bare series or entity ids, some "id:year", some bare
 * years, and the two GDP rules list "gdp"/"gdp:year" since GDP is a
 * denominator a rule can flag, not a queryable series of its own. This
 * matches every shape a rule in the catalogue actually produces, rather
 * than re-deriving each rule's own `applies` per observation - that would
 * need a different context shape per rule (nominal_gel reads the whole
 * REQUEST's year count; revenue_2004_total_scope reads a single
 * observation's own year) and no one per-observation context satisfies
 * both.
 *
 * PRECISION CONTRACT for every CaveatRule this helper is used against
 * (read this before writing or reviewing a rule in rules.*.ts):
 *
 * This function trusts `affects()`'s output completely - it does string
 * matching, not semantics. That is only safe when `affects()` is precise at
 * the same grain the rule's underlying truth actually varies at. A shape
 * that merely "parses" as one of the id / id:year / bare-year forms above is
 * NOT enough: it also has to be TRUE for every observation it will end up
 * matching against.
 *
 * Two rules in rules.national.ts shipped exactly this bug and were fixed
 * once this helper exposed it in practice, not by inspection:
 *   - revenue_internal_flows_netted's `applies()` fires whenever ANY
 *     requested year is >= 2008, but its old `affects()` returned a bare
 *     seriesId ("revenue.grants"). A request for years [2005, 2020] then
 *     attached the caveat to the 2005 observation too, where the rule's own
 *     comment documents there is no netting - a reader quoting the message
 *     next to the 2005 figure could not tell it was false there.
 *   - revenue_2004_total_scope's `applies()` has two independent firing
 *     paths (the total is named directly; OR the whole request measure is
 *     share_of_total_pct on national-revenue) that affect DIFFERENT sets of
 *     observations - the first affects only revenue.total, the second
 *     affects every requested series. A bare "2004" `affects()` could not
 *     distinguish them, so requesting revenue.total and revenue.vat together
 *     for 2004 (amount_gel) attached the caveat to the VAT observation too,
 *     which has no such gap.
 *   - program_historical_join (rules.ministries.ts) shipped the same shape a
 *     third time, and it is the clearest case that "precise at the grain the
 *     truth varies at" is about the DATA, not the rule: the rule could not be
 *     precise until buildSnapshot.ts started emitting the joined years, because
 *     a joined series is joined for only some of its years and the snapshot
 *     carried a bare id list. Fixing affects() alone was not possible.
 *
 * The fix pattern in both cases (see rules.national.ts): build `affects()`
 * from `c.observations`, filtered by the SAME predicate `applies()` used to
 * decide the caveat fires at all, then map to the precise `${seriesId}:${year}`
 * (or `${entityId}:${year}`) composite - never a bare id or bare year unless
 * the rule's truth is genuinely uniform across every year/series in the
 * request (nominal_gel and budget_scopes_differ are the two rules in this
 * file where that is actually the case - see their own comments).
 * `planned_values` and `negative_revenue_correction` already followed this
 * pattern before the fix; treat them as the reference shape for any new
 * rule.
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
