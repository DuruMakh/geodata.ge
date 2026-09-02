// apps/web/lib/factQuery/meta.ts
//
// Shared response-meta builder. Every query function's envelope repeats the
// same publication facts (schema/data version, release identity, licence);
// this is the one place that assembles them, so they cannot drift per
// function. describeCoverage (Task 11) is the first caller; queryNational,
// queryMinistries, queryMunicipal, compare, rank and getSources (Tasks 12-17)
// reuse it unchanged, supplying whatever sources they resolved and caveats
// they evaluated for their own request.
import type { Caveat, FactQuerySnapshot, ResolvedSource, ResponseMeta } from "./types";

export type ResponseMetaExtra = {
  sources?: ResolvedSource[];
  caveats?: Caveat[];
  /**
   * Every documentId the returned rows actually cite. When supplied, each
   * source's `documents` is narrowed to it.
   *
   * Without this a one-cell municipal answer carried all 75 municipal
   * workbooks - 77.9 KiB of an 80.0 KiB response - to support a row citing two
   * of them. `documentIds` was narrowed per observation in Part 2; `meta` was
   * not, so the evidence block still answered "which documents exist for this
   * source" rather than "which documents support this answer".
   *
   * Omitted by getSources, whose result IS the document listing, and by
   * describeCoverage and rank, whose results carry no documentIds to narrow by.
   */
  citedDocumentIds?: readonly string[];
};

/**
 * Publication facts copied verbatim from the snapshot, plus whatever
 * request-specific sources and caveats the caller already resolved. Neither
 * extra field is required: a catalogue response (describeCoverage) has no
 * observation to cite a source for and, on the empty-context caveat call
 * every query function will eventually make, often has no caveats either —
 * both default to `[]` rather than forcing every call site to pass them.
 */
export function buildResponseMeta(snapshot: FactQuerySnapshot, extra?: ResponseMetaExtra): ResponseMeta {
  const sources = extra?.sources ?? [];
  const cited = extra?.citedDocumentIds === undefined ? null : new Set(extra.citedDocumentIds);

  return {
    schemaVersion: snapshot.schemaVersion,
    dataVersion: snapshot.dataVersion,
    releaseCommit: snapshot.releaseCommit,
    generatedAt: snapshot.generatedAt,
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    sources:
      cited === null
        ? sources
        : sources.map((source) => {
            const kept = source.documents.filter((document) => cited.has(document.documentId));
            // Narrowing points at the right original; it never hides
            // provenance. A source the rows cite must always show something a
            // reader can open, so an empty filter falls back to everything the
            // source archives - the same rule resolveDocumentIds applies.
            return kept.length > 0 ? { ...source, documents: kept } : source;
          }),
    caveats: extra?.caveats ?? [],
  };
}
