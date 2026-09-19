import { serviceMessage } from "./localization";
// apps/web/lib/factQuery/getSources.ts
//
// Where a figure came from (spec section 6.8). Every other function cites
// source ids; this is how a caller turns one into something a reader can open
// and check.
//
// Two rules do the work. Nothing is ever invented - an unknown id returns a
// structured error with bounded suggestions, never a guessed URL - and
// narrowing never hides provenance: a filter that would leave a source with no
// documents at all is dropped rather than applied, because "here is the source
// with nothing behind it" is a worse answer than an unfiltered list.
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import { buildResponseMeta } from "./meta";
import { getSourcesInput } from "./schemas";
import { selectSources } from "./sources";
import type { FactQueryError, FactQueryResponse, FactQuerySnapshot, PublicDocument, ResolvedSource } from "./types";

const MAX_SUGGESTIONS = 10;

export type ResolvedSourceView = ResolvedSource & {
  /** How many documents the source has before any narrowing. */
  documentCount: number;
  /** True when datasetId/years/entityIds actually reduced the list. */
  narrowed: boolean;
  /**
   * Whether the requested narrowing was applied, and if not, why.
   *
   * "not_requested"      - no filter was given.
   * "applied"            - the filter matched and the list is narrowed.
   * "dropped_no_match"   - the filter matched NOTHING, so it was dropped and
   *                        the full list is returned instead.
   *
   * `narrowed` alone could not express the third case: it is computed as "the
   * list got shorter", which the fallback makes false by construction. A
   * request for a year no document covers therefore returned a document from
   * another year, byte-identical to a genuine match. On the one surface whose
   * whole job is letting a reader check a figure, that is not survivable.
   */
  narrowingOutcome: "not_requested" | "applied" | "dropped_no_match";
};

export type GetSourcesData = {
  sources: ResolvedSourceView[];
  narrowedBy: { datasetId?: string; years?: number[]; entityIds?: string[] } | null;
};

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

/**
 * Bounded, never invented: suggestions are drawn only from ids the snapshot
 * actually has. Scored by longest shared prefix so a near-miss typo surfaces
 * its neighbour, then capped - a caller handed all 104 ids has been given a
 * list to scroll, not a suggestion.
 */
function suggestionsFor(unknownIds: readonly string[], knownIds: readonly string[]): string[] {
  const scored = new Map<string, number>();

  for (const unknown of unknownIds) {
    for (const known of knownIds) {
      let shared = 0;
      while (shared < unknown.length && shared < known.length && unknown[shared] === known[shared]) shared += 1;
      if (known.includes(unknown) || unknown.includes(known)) shared = Math.max(shared, known.length);
      if (shared > 0) scored.set(known, Math.max(scored.get(known) ?? 0, shared));
    }
  }

  return Array.from(scored.entries())
    .sort((left, right) => (right[1] - left[1]) || (left[0] < right[0] ? -1 : 1))
    .slice(0, MAX_SUGGESTIONS)
    .map(([id]) => id);
}

/**
 * A grouped source can archive dozens of originals - the municipality
 * budget-history source carries one workbook per municipality, its documentId
 * ending in that municipality's code. Narrowing matches a document whose id
 * ends in `_<code>`, which is a convenience for finding the right original,
 * never a claim that the others are unrelated.
 */
function matchesEntity(document: PublicDocument, entityIds: readonly string[]): boolean {
  return entityIds.some((entityId) => document.documentId.endsWith(`_${entityId}`) || document.documentId.includes(`.${entityId}.`));
}

export function getSources(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const parsed = getSourcesInput.safeParse(rawInput);

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

  const resolved = selectSources(snapshot, input.sourceIds);
  const resolvedIds = new Set(resolved.map((source) => source.sourceId));
  const unknownIds = input.sourceIds.filter((id) => !resolvedIds.has(id));

  if (unknownIds.length > 0) {
    return errorResponse(snapshot, {
      code: "unknown_source",
      messageKa: serviceMessage(snapshot, "ka", "errors.unknownSource", { unknownIds: unknownIds.join(", ") }),
      messageEn: serviceMessage(snapshot, "en", "errors.unknownSource", { unknownIds: unknownIds.join(", ") }),
      retryable: false,
      validChoices: suggestionsFor(
        unknownIds,
        snapshot.sources.map((source) => source.sourceId),
      ),
    });
  }

  // Strict on every id namespace, not just source ids. An unknown entity or an
  // impossible year used to return status "ok" with the full unnarrowed list,
  // so a caller asking about a municipality that does not exist got a
  // confident-looking answer about a different one.
  const knownEntityIds = new Set<string>([
    MUNICIPAL_COUNTRY_ID,
    ...snapshot.municipal.regions.map((region) => region.id),
    ...snapshot.municipal.municipalities.map((municipality) => municipality.code),
  ]);
  const unknownEntityIds = (input.entityIds ?? []).filter((id) => !knownEntityIds.has(id));
  if (unknownEntityIds.length > 0) {
    return errorResponse(snapshot, {
      code: "unknown_entity",
      messageKa: serviceMessage(snapshot, "ka", "errors.unknownEntity", { unknownEntityIds: unknownEntityIds.join(", ") }),
      messageEn: serviceMessage(snapshot, "en", "errors.unknownEntity", { unknownEntityIds: unknownEntityIds.join(", ") }),
      retryable: false,
      validChoices: Array.from(knownEntityIds).sort(),
    });
  }

  const coveredYears = [
    ...snapshot.national.facts.map((f) => f.year),
    ...snapshot.ministries.facts.map((f) => f.year),
    ...snapshot.municipal.totalFacts.map((fact) => fact.year),
    // Without these, a year only the new datasets reach - the balance starts
    // in 1995, debt service runs to 2030 - came back as a false out-of-range
    // error, breaking the documented flow: query a year, take its sourceIds,
    // then ask get_sources about that same year.
    ...snapshot.debt.facts.map((fact) => fact.year),
    ...snapshot.deficit.facts.map((f) => f.year),
    ...snapshot.gdpOverview.facts.map(f=>f.year),
  ];
  const minYear = Math.min(...coveredYears);
  const maxYear = Math.max(...coveredYears);
  const outOfRangeYears = (input.years ?? []).filter((year) => year < minYear || year > maxYear);
  if (outOfRangeYears.length > 0) {
    return errorResponse(snapshot, {
      code: "year_out_of_range",
      messageKa: serviceMessage(snapshot, "ka", "errors.sourceYearsOutOfRange", { outOfRangeYears: outOfRangeYears.join(", "), minYear, maxYear }),
      messageEn: serviceMessage(snapshot, "en", "errors.sourceYearsOutOfRange", { outOfRangeYears: outOfRangeYears.join(", "), minYear, maxYear }),
      retryable: false,
    });
  }

  const hasNarrowing =
    input.datasetId !== undefined || (input.years?.length ?? 0) > 0 || (input.entityIds?.length ?? 0) > 0;

  const documentDataset = input.datasetId === undefined ? undefined : {
    "national-revenue": "revenue",
    "national-expenditure": "expenditure",
    ministries: "expenditure",
    "municipal-expenditure": "municipalities",
    "government-debt": "debt",
    "general-government-balance": "deficit",
    "gdp-overview": "gdp",
    "economic-sectors": "economic-sectors",
    inflation: "inflation",
  }[input.datasetId];
  const entityCodes = (input.entityIds ?? []).flatMap((id) => {
    if (id.startsWith("region.")) return snapshot.municipal.municipalities.filter((m) => m.regionId === id).map((m) => m.code);
    return [id];
  });
  const packageSourceIds = new Set(
    input.datasetId === "government-debt"
      ? snapshot.debt.facts.flatMap((f) => (f.sourceId ? [f.sourceId] : []))
      : input.datasetId === "general-government-balance"
        ? snapshot.deficit.facts.map((f) => f.sourceId)
        : input.datasetId === "gdp-overview" ? snapshot.gdpOverview.facts.map(f=>f.sourceId)
          : input.datasetId === "economic-sectors" ? snapshot.economicSectors.facts.map(f=>f.sourceId)
            : input.datasetId === "inflation"
              ? [...snapshot.inflation.facts, ...snapshot.inflation.targets, ...snapshot.inflation.categories, ...snapshot.inflation.weights].map((row) => row.sourceId)
              : [],
  );

  const sources: ResolvedSourceView[] = resolved.map((source) => {
    let documents = source.documents;

    let narrowingOutcome: ResolvedSourceView["narrowingOutcome"] = "not_requested";

    // A derived source is exempt. Its documents are the inputs to the stated
    // calculation, so showing one of the two Adjara republican-payments
    // originals beside a derivation reading "members plus republican payments"
    // would leave the sentence unsupported by what is displayed.
    if (hasNarrowing && source.derivation === null) {
      const filtered = source.documents.filter((document) => {
        // A document with no datasetId is NOT treated as matching every dataset.
        // Exempting it returned the Geostat municipal-population workbook as a
        // match for national-revenue; the honest outcome is that the filter
        // matched nothing, which the caller is now told.
        if (documentDataset !== undefined && document.datasetId !== documentDataset && !(document.datasetId === null && packageSourceIds.has(source.sourceId))) {
          return false;
        }
        if (input.years !== undefined && input.years.length > 0) {
          if (!input.years.some((year) => document.years.includes(year))) return false;
        }
        if (input.entityIds !== undefined && input.entityIds.length > 0) {
          // Every source in this catalogue concerns Georgia. A country filter
          // includes both national originals and the complete municipal panel.
          if (!input.entityIds.includes(MUNICIPAL_COUNTRY_ID) && !matchesEntity(document, entityCodes)) return false;
        }
        return true;
      });

      // Narrowing is a convenience, not a filter that may hide where a figure
      // came from. If it would leave nothing, return the unnarrowed list - and
      // say so, rather than passing it off as a match.
      if (filtered.length > 0) {
        documents = filtered;
        narrowingOutcome = "applied";
      } else {
        narrowingOutcome = "dropped_no_match";
      }
    }

    return {
      ...source,
      documents,
      documentCount: source.documents.length,
      narrowed: documents.length !== source.documents.length,
      narrowingOutcome,
    };
  });

  const status: "ok" | "partial" | "empty" = sources.length === 0 ? "empty" : "ok";
  const data: GetSourcesData = {
    sources,
    narrowedBy: hasNarrowing
      ? { datasetId: input.datasetId, years: input.years, entityIds: input.entityIds }
      : null,
  };

  return { kind: "sources", status, data, meta: buildResponseMeta(snapshot, { sources: sources.map(({ documentCount: _count, narrowed: _narrowed, narrowingOutcome: _outcome, ...source }) => source), caveats: [] }) };
}
