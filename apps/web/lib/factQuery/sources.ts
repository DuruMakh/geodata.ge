// apps/web/lib/factQuery/sources.ts
import type { SourceDocumentRow } from "../data/sources";
import type { FactQuerySnapshot, RawPublicDocument, RawResolvedSource, ResolvedSource } from "./types";

/**
 * Pure lookup used by the query path. Unknown ids are dropped, not invented:
 * getSources reports them as a structured error instead (spec section 6.8).
 */
export function selectSources(snapshot: FactQuerySnapshot, sourceIds: readonly string[]): ResolvedSource[] {
  const byId = new Map(snapshot.sources.map((source) => [source.sourceId, source]));
  const seen = new Set<string>();
  const out: ResolvedSource[] = [];

  for (const id of sourceIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const found = byId.get(id);
    if (found) out.push(found);
  }

  return out.sort((a, b) => (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0));
}

/** Expand a `;`-joined source cell into its constituent logical ids. */
export function splitSourceIds(raw: string): string[] {
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * One public document a reviewed source manifest (lib/methodology/
 * sourceManifest.ts) or the GDP source manifest archived. `buildSnapshot.ts`
 * loads these (the one file in lib/factQuery/ allowed to touch the
 * filesystem); resolvePublicSources below only ever compares `repositoryPath`
 * strings already in memory.
 */
export type ManifestDocument = Omit<RawPublicDocument, "role"> & {
  /**
   * Repo-relative path this document was archived from, e.g.
   * "docs/Raw Data/Expenditure/treasury.ge/2017-....pdf". Matched against
   * data/sources/source-documents.csv's `source_url_or_file` column. Never
   * itself emitted as a public URL — see buildSnapshot.ts's purity note.
   */
  repositoryPath: string;
};

/**
 * Fact-data source ids whose `source_url_or_file` names a file EXTRACTED from
 * an archived original rather than the original itself, mapped to the
 * repository path that was actually published.
 *
 * source.municipal_portal_archive is the live case and backs 3,314 rows. It
 * cites .../municipalities.mof.ge-archive-2022/functionals/functionals.csv —
 * the 11.5 MB CSV obtained by unzipping functionals.zip, which sits in the
 * same directory and IS published, with a working Internet Archive URL.
 * Publishing the ZIP rather than its extracted contents is deliberate:
 * lib/methodology/sourceInventory.ts's municipalities rule takes only
 * top-level .zip files from that root.
 *
 * Kept as an explicit two-line map rather than a "strip a path segment and
 * retry" heuristic on purpose. A heuristic would silently match unrelated
 * neighbours and defeat the point of the section 8.1 gate, which exists to
 * make an unresolvable source fail the build rather than quietly publish
 * nothing. Each entry records a reviewed extracted-from relationship, which is
 * also why this lives here instead of being edited into the reviewed CSV: a
 * path rewrite there would erase the fact that the cited file is derived.
 */
const EXTRACTED_FILE_ALIASES: Readonly<Record<string, string>> = {
  "docs/Raw Data/Municipalities/municipalities.mof.ge-archive-2022/functionals/functionals.csv":
    "docs/Raw Data/Municipalities/municipalities.mof.ge-archive-2022/functionals.zip",
  "docs/Raw Data/Municipalities/municipalities.mof.ge-archive-2022/functionalbasictypes/functionalbasictypes.csv":
    "docs/Raw Data/Municipalities/municipalities.mof.ge-archive-2022/functionalbasictypes.zip",
};

/**
 * Sources whose `source_url_or_file` names one of fiscal.ge's own reviewed
 * calculation files rather than an original document, mapped to the upstream
 * source ids whose documents DO back them.
 *
 * source.adjara_consolidated_budget is the live case. Its 11 rows are the
 * country.georgia municipal totals 2015-2025, and its file
 * (data/imports/municipal-adjara-budget-adjustments-2015-2025.csv) is the
 * arithmetic, not a publication. Repository owner's decision, 2026-09-01: state
 * how it was derived and point at the originals. The derivation text is taken
 * from the reviewed `source_name` rather than written here, so the two cannot
 * drift.
 */
const DERIVED_SOURCE_UPSTREAMS: Readonly<Record<string, readonly string[]>> = {
  "source.adjara_consolidated_budget": [
    "source.adjara.republic.2015.actual_payments",
    "source.adjara.republic.2016_2025.actual_payments",
  ],
};

export type ResolvePublicSourcesInput = {
  sourceDocuments: readonly SourceDocumentRow[];
  manifestDocuments: readonly ManifestDocument[];
};

/** Split `source_url_or_file` on its " + " multi-file join (32 of 104 rows use it). */
function splitFilePaths(sourceUrlOrFile: string): string[] {
  return sourceUrlOrFile
    .split(" + ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Documents archived from exactly `filePath`, or — when nothing matches
 * exactly — every document archived from inside it as a directory. A few
 * `source_url_or_file` entries name a folder of many per-year or
 * per-municipality workbooks (the MoF functional-classification and
 * municipality budget-history archives) rather than one file, so a plain
 * equality match would leave those permanently unresolved.
 */
function matchDocuments(filePath: string, manifestDocuments: readonly ManifestDocument[]): ManifestDocument[] {
  const resolvedPath = EXTRACTED_FILE_ALIASES[filePath] ?? filePath;

  const exact = manifestDocuments.filter((doc) => doc.repositoryPath === resolvedPath);
  if (exact.length > 0) return exact;

  const directoryPrefix = `${resolvedPath}/`;
  return manifestDocuments.filter((doc) => doc.repositoryPath.startsWith(directoryPrefix));
}

/**
 * Spec section 8.1, as a pure predicate so it can be tested directly.
 *
 * It lived inline in scripts/prepare-fact-query-snapshot.ts, where the only way
 * to exercise it was to run the whole build. It was verified against an ordinary
 * source, passed, and was declared proven - while the DERIVED branch, the one
 * with a real failure mode, went unchecked and did not fail. A gate that is
 * trusted and cannot fail is worse than no gate.
 */
export type SourceProvenanceFailure = {
  sourceId: string;
  reason: "no_document_and_no_derivation" | "derived_without_upstreams";
};

export function findSourceProvenanceFailures(
  sources: readonly Pick<RawResolvedSource, "sourceId" | "derivation" | "documents">[],
): SourceProvenanceFailure[] {
  const failures: SourceProvenanceFailure[] = [];

  for (const source of sources) {
    if (source.documents.length > 0) continue;
    // Both halves of the non-negotiable: a derived figure must state that it is
    // derived AND cite its upstream originals.
    const states = source.derivation !== null && source.derivation.trim() !== "";
    failures.push({
      sourceId: source.sourceId,
      reason: states ? "derived_without_upstreams" : "no_document_and_no_derivation",
    });
  }

  return failures;
}

/**
 * Resolves every data/sources/source-documents.csv row to the public
 * documents backing it, joining on repository file path rather than source
 * id: the fact-data source registry (data/sources/source-documents.csv) and
 * the reviewed methodology manifests (data/methodology/source-archives/, and
 * the GDP and Geostat package manifests) use unrelated id schemes, but
 * `source_url_or_file` always names the exact repository path(s) the manifests
 * archived (spec section 8.1). Two exceptions are handled explicitly above:
 * a path naming a file extracted from an archived original
 * (EXTRACTED_FILE_ALIASES) and a source that is a derived calculation rather
 * than a document (DERIVED_SOURCE_UPSTREAMS).
 *
 * A row whose file(s) match nothing and which is not a known derived source
 * resolves to an empty `documents` array with `derivation: null` rather than a
 * fabricated link — this function never invents a URL or an id. That state is
 * what scripts/prepare-fact-query-snapshot.ts's --check fails the build on.
 *
 * It also never sorts: array order is hash-significant
 * (lib/factQuery/canonical.ts), and buildSnapshot.ts is the one file in
 * lib/factQuery/ responsible for imposing that order, with the same sortedBy
 * helper it uses for every other snapshot array.
 */
export function resolvePublicSources(input: ResolvePublicSourcesInput): RawResolvedSource[] {
  const { sourceDocuments, manifestDocuments } = input;
  const documentsById = new Map(manifestDocuments.map((doc) => [doc.documentId, doc]));

  return sourceDocuments.map((row): RawResolvedSource => {
    const seenDocumentIds = new Set<string>();
    const documents: RawPublicDocument[] = [];

    const push = (doc: ManifestDocument | undefined, role: RawPublicDocument["role"] = "primary") => {
      if (!doc || seenDocumentIds.has(doc.documentId)) return;
      seenDocumentIds.add(doc.documentId);
      // repositoryPath is an internal path and is deliberately dropped here:
      // ResolvedSource is public output.
      const { repositoryPath: _internal, ...publicFields } = doc;
      documents.push({ ...publicFields, role });
    };

    const upstreamIds = DERIVED_SOURCE_UPSTREAMS[row.sourceId];
    if (upstreamIds) {
      for (const id of upstreamIds) {
        const doc = documentsById.get(id);
        // Throws rather than skipping: this map is hand-authored, so an id that
        // matches nothing is always an authoring error (a typo, or an upstream
        // renamed in a reviewed manifest), never a data condition. Skipping it
        // silently would ship a derived figure with a derivation sentence and
        // no citable original, and the build would stay green.
        if (!doc) {
          throw new Error(
            `DERIVED_SOURCE_UPSTREAMS names upstream "${id}" for ${row.sourceId}, but no manifest document has that id.`,
          );
        }
        push(doc, "derivation_upstream");
      }
    } else {
      for (const filePath of splitFilePaths(row.sourceUrlOrFile)) {
        for (const doc of matchDocuments(filePath, manifestDocuments)) push(doc);
      }
    }

    return {
      sourceId: row.sourceId,
      name: row.sourceName,
      lastReviewedAt: row.lastReviewedAt,
      // The reviewed source_name already states the derivation in prose
      // ("Reviewed consolidated Adjara calculation - municipalities plus
      // republican payments minus internal transfers"); reusing it keeps one
      // wording under review instead of two that can drift.
      derivation: upstreamIds ? row.sourceName : null,
      documents,
    };
  });
}
