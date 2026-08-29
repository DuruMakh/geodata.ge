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
  return {
    schemaVersion: snapshot.schemaVersion,
    dataVersion: snapshot.dataVersion,
    releaseCommit: snapshot.releaseCommit,
    generatedAt: snapshot.generatedAt,
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    sources: extra?.sources ?? [],
    caveats: extra?.caveats ?? [],
  };
}
