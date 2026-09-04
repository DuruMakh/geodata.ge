// apps/web/lib/factQuery/observations.ts
//
// Shared building blocks for the observation-shaped query functions.
// queryNational is the first caller; queryMinistries and queryMunicipal
// (Tasks 13/14) return the same Observation shape (spec section 7.2) and
// face the same three small problems this file solves once: building the
// id, resolving sourceIds into documentIds without re-querying sources per
// row, and deciding which already-evaluated request-level caveats belong on
// one specific observation's caveatIds.
import type { Availability, Basis, Caveat, DatasetId, Measure, PublicDocument, ResolvedSource, Unit } from "./types";

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
  basis: Basis | null;
  valueDefinition: string;
  /**
   * Structured identity of WHAT IS MEASURED, for machine comparison.
   *
   * valueDefinition above is display prose and must never be used to decide
   * whether two years are like-for-like: it is simultaneously too weak and too
   * strong. Too weak, because a municipal FUNCTION series carries a constant
   * string across the 2015 portal-fallback break, so `compare` published a
   * +572.1% education "growth" and `rank` turned it into a 64-row league table.
   * Too strong, because queryMinistries appends the year's own official label
   * when it differs, so a program that was merely RENAMED compared unequal and
   * whole rankings came back empty.
   *
   * This field carries only the things that change the measurement, and nothing
   * cosmetic. Two observations with the same id measure the same quantity the
   * same way; a difference is a real definition break.
   */
  valueDefinitionId: string;
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
 * Which municipality workbooks support ONE observation.
 *
 * `entityCodes` is the set whose own published workbook stands behind this
 * row: one code for a municipality row, its member codes for a region row,
 * every served code for the country row. A document naming a municipality
 * outside that set is not an original supporting this figure, and citing it
 * makes a false provenance claim (spec section 7.2).
 *
 * `allCodes` includes the five aggregate-only codes so a workbook naming one
 * of them is recognised as entity-naming and then correctly excluded, rather
 * than falling through to the year-narrowed cross-municipality branch and
 * being cited on every row.
 */
export type DocumentScope = {
  year: number;
  entityCodes: readonly string[];
  allCodes: readonly string[];
};

/** The archive names a municipality in a document id as `_<code>` or `.<code>.`. */
function namedMunicipality(documentId: string, allCodes: readonly string[]): string | undefined {
  return allCodes.find((code) => documentId.endsWith(`_${code}`) || documentId.includes(`.${code}.`));
}

/**
 * documentIds for one observation, given the sources already resolved for
 * the whole response. Takes the resolved list rather than the snapshot so a
 * caller resolves sourceIds once per response (selectSources over the union
 * of every observation's sourceIds) instead of re-walking snapshot.sources
 * once per row.
 *
 * With no `scope` every document of every cited source is returned, which is
 * correct for national and ministries: their sources archive one or two
 * documents each, none of them entity-specific. queryMunicipal is the only
 * caller that passes a scope, because the municipality budget-history source
 * archives one workbook per municipality and attaching all 75 to every row
 * cited 63 other municipalities' books behind a single municipality's figure.
 */
export function resolveDocumentIds(
  resolvedSources: readonly ResolvedSource[],
  sourceIds: readonly string[],
  scope?: DocumentScope,
): string[] {
  const documentsBySourceId = new Map(resolvedSources.map((source) => [source.sourceId, source.documents]));
  const seen = new Set<string>();
  const documentIds: string[] = [];
  // Hoisted out of the per-document loop: the matcher is called once per
  // document per row, and rebuilding the lookup each time made a full
  // municipal query 5.6x slower.
  const codeOwners = scope === undefined ? null : new Map<string, string | undefined>();

  const supports = (document: PublicDocument): boolean => {
    if (scope === undefined || codeOwners === null) return true;
    let owner = codeOwners.get(document.documentId);
    if (!codeOwners.has(document.documentId)) {
      owner = namedMunicipality(document.documentId, scope.allCodes);
      codeOwners.set(document.documentId, owner);
    }
    // Names a municipality: keep it only for the entities this row covers.
    if (owner !== undefined) return scope.entityCodes.includes(owner);
    // Names none: a cross-municipality workbook, narrowed by its reviewed
    // `years` field. An empty `years` means the metadata does not record
    // coverage, so the document is kept rather than dropped on a guess.
    return document.years.length === 0 || document.years.includes(scope.year);
  };

  for (const sourceId of sourceIds) {
    const documents = documentsBySourceId.get(sourceId) ?? [];
    const supported = documents.filter(supports);
    // Narrowing points at the right original; it never hides provenance
    // (the contract getSources states at its own matcher). If the filter
    // empties a source that HAS documents, this row would cite a source and
    // then show nothing to look at - worse than showing an imprecise
    // original. Fall back to everything the source archives.
    //
    // This is reachable: source.treasury_consolidated_revenue_actual is cited
    // on region.adjara for 2016-2025 but archives only a 2015 form. The
    // fallback keeps that visible rather than silently dropping it, so the
    // underlying metadata gap stays inspectable instead of disappearing.
    for (const document of supported.length > 0 ? supported : documents) {
      if (seen.has(document.documentId)) continue;
      seen.add(document.documentId);
      documentIds.push(document.documentId);
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
 * need a different context shape per rule (municipal_total_definition_changed
 * reads the whole REQUEST's comparison window; revenue_2004_total_scope reads a
 * single observation's own year) and no one per-observation context satisfies
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
 * request (budget_scopes_differ is the rule in this file where that is
 * actually the case - see its own comment; nominal_gel was the other until it
 * was retired on 2026-09-04).
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
  // The finest shape, for a claim true of ONE series of one entity in one year.
  // adjara_consolidation_applied needs it: entity-year could not separate
  // Adjara's consolidated TOTAL from its unconsolidated education amount in the
  // same year, so naming the total in a request stamped the function cell with
  // a consolidation notice that was false of it.
  const entitySeriesYear = `${observation.entityId}:${observation.seriesId}:${observation.year}`;
  const year = String(observation.year);

  return caveats
    .filter(
      (caveat) =>
        caveat.affects.includes(seriesYear) ||
        caveat.affects.includes(entityYear) ||
        caveat.affects.includes(entitySeriesYear) ||
        caveat.affects.includes(observation.seriesId) ||
        caveat.affects.includes(observation.entityId) ||
        caveat.affects.includes(year) ||
        (observation.measure === "share_of_gdp_pct" && (caveat.affects.includes("gdp") || caveat.affects.includes(`gdp:${year}`))),
    )
    .map((caveat) => caveat.code);
}
