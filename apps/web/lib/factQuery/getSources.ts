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
import { buildResponseMeta } from "./meta";
import { getSourcesInput } from "./schemas";
import { selectSources } from "./sources";
import type { FactQueryError, FactQueryResponse, FactQuerySnapshot, PublicDocument } from "./types";

const MAX_SUGGESTIONS = 10;

export type ResolvedSourceView = {
  sourceId: string;
  name: string;
  lastReviewedAt: string;
  derivation: string | null;
  documents: PublicDocument[];
  /** How many documents the source has before any narrowing. */
  documentCount: number;
  /** True when datasetId/years/entityIds actually reduced the list. */
  narrowed: boolean;
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

  const resolved = selectSources(snapshot, input.sourceIds);
  const resolvedIds = new Set(resolved.map((source) => source.sourceId));
  const unknownIds = input.sourceIds.filter((id) => !resolvedIds.has(id));

  if (unknownIds.length > 0) {
    return errorResponse(snapshot, {
      code: "unknown_source",
      messageKa: `უცნობი წყაროს იდენტიფიკატორი: ${unknownIds.join(", ")}.`,
      messageEn: `Unknown source id(s): ${unknownIds.join(", ")}.`,
      retryable: false,
      validChoices: suggestionsFor(
        unknownIds,
        snapshot.sources.map((source) => source.sourceId),
      ),
    });
  }

  const hasNarrowing =
    input.datasetId !== undefined || (input.years?.length ?? 0) > 0 || (input.entityIds?.length ?? 0) > 0;

  const sources: ResolvedSourceView[] = resolved.map((source) => {
    let documents = source.documents;

    if (hasNarrowing) {
      const filtered = source.documents.filter((document) => {
        if (input.datasetId !== undefined && document.datasetId !== null && document.datasetId !== input.datasetId) {
          return false;
        }
        if (input.years !== undefined && input.years.length > 0) {
          if (!input.years.some((year) => document.years.includes(year))) return false;
        }
        if (input.entityIds !== undefined && input.entityIds.length > 0) {
          if (!matchesEntity(document, input.entityIds)) return false;
        }
        return true;
      });

      // Narrowing is a convenience, not a filter that may hide where a figure
      // came from. If it would leave nothing, return the unnarrowed list.
      if (filtered.length > 0) documents = filtered;
    }

    return {
      sourceId: source.sourceId,
      name: source.name,
      lastReviewedAt: source.lastReviewedAt,
      derivation: source.derivation,
      documents,
      documentCount: source.documents.length,
      narrowed: documents.length !== source.documents.length,
    };
  });

  const status: "ok" | "partial" | "empty" = sources.length === 0 ? "empty" : "ok";
  const data: GetSourcesData = {
    sources,
    narrowedBy: hasNarrowing
      ? { datasetId: input.datasetId, years: input.years, entityIds: input.entityIds }
      : null,
  };

  return { kind: "sources", status, data, meta: buildResponseMeta(snapshot, { sources: resolved, caveats: [] }) };
}
