// apps/web/lib/factQuery/meta.ts
//
// Shared response-meta builder. Every query function's envelope repeats the
// same publication facts (schema/data version, release identity, licence);
// this is the one place that assembles them, so they cannot drift per
// function. describeCoverage (Task 11) is the first caller; queryNational,
// queryMinistries, queryMunicipal, compare, rank and getSources (Tasks 12-17)
// reuse it unchanged, supplying whatever sources they resolved and caveats
// they evaluated for their own request.
import { HOISTABLE_DOCUMENT_FIELDS } from "./types";
import type { Caveat, DocumentDefaults, FactQuerySnapshot, ResolvedSource, ResponseMeta, ResponseSource } from "./types";

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
   * describeCoverage, whose result carries no documentIds to narrow by.
   */
  citedDocumentIds?: readonly string[];
  /**
   * Documents the answer was computed from but whose rows it does not show - a
   * top-N ranking reads every candidate's workbook and returns a few rows. They
   * are named by id on their source (`inputDocumentIds`) instead of being given
   * in full, so no document the answer used is dropped. Used with
   * `citedDocumentIds`; a document in both stays in full.
   */
  inputOnlyDocumentIds?: readonly string[];
};

/**
 * State once what every document of a source agrees on, and drop the two fields
 * that answer a question this block is not asked.
 *
 * Nothing is lost and no document is omitted: a hoisted value is stated on the
 * source instead of repeated on each document, and sha256/byteSize remain in
 * get_sources' own payload and in the published sources.json. A ranking over 64
 * municipalities cited 66 documents and spent 69 KiB doing it, most of it the
 * same seven values written 65 times.
 */
function compactSource(source: ResolvedSource): ResponseSource {
  const documents = source.documents;
  const defaults: DocumentDefaults = {};

  if (documents.length > 0) {
    for (const field of HOISTABLE_DOCUMENT_FIELDS) {
      const first = documents[0]![field];
      // Identical across every document, or it stays on each of them. A source
      // whose documents disagree about their publisher must keep saying so.
      if (documents.every((document) => document[field] === first)) {
        Object.assign(defaults, { [field]: first });
      }
    }
  }

  const hoisted = new Set<string>(Object.keys(defaults));
  const trimmed = documents.map((document) => {
    const entries = Object.entries(document).filter(
      ([key]) => !hoisted.has(key) && key !== "sha256" && key !== "byteSize",
    );
    return Object.fromEntries(entries) as ResponseSource["documents"][number];
  });

  const { documents: _documents, ...rest } = source;
  return {
    ...rest,
    ...(hoisted.size > 0 ? { documentDefaults: defaults } : {}),
    documents: trimmed,
  };
}

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
  const inputOnly = extra?.inputOnlyDocumentIds === undefined ? null : new Set(extra.inputOnlyDocumentIds);

  return {
    schemaVersion: snapshot.schemaVersion,
    dataVersion: snapshot.dataVersion,
    releaseCommit: snapshot.releaseCommit,
    generatedAt: snapshot.generatedAt,
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    // Narrow first, then compact what survives: which documents belong here is
    // a different question from how compactly to state them.
    sources: (cited === null
      ? sources.map(compactSource)
      : sources.map((source) => {
          const kept = source.documents.filter((document) => cited.has(document.documentId));
          const inputIds = inputOnly === null ? [] : source.documents.map((document) => document.documentId).filter((id) => inputOnly.has(id) && !cited.has(id));
          // Narrowing points at the right original; it never hides
          // provenance. A source the rows cite must always show something a
          // reader can open, so an empty filter falls back to everything the
          // source archives - the same rule resolveDocumentIds applies. A source
          // whose only documents are ranking inputs is named by those ids instead.
          if (kept.length === 0 && inputIds.length === 0) return compactSource(source);
          const compact = compactSource({ ...source, documents: kept });
          return inputIds.length > 0 ? { ...compact, inputDocumentIds: inputIds } : compact;
        })),
    caveats: extra?.caveats ?? [],
  };
}
