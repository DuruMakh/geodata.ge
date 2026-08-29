// apps/web/lib/factQuery/sources.ts
import type { SourceDocumentRow } from "../data/sources";
import type { FactQuerySnapshot, ResolvedSource } from "./types";

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
export type ManifestDocument = {
  /**
   * Repo-relative path this document was archived from, e.g.
   * "docs/Raw Data/Expenditure/treasury.ge/2017-....pdf". Matched against
   * data/sources/source-documents.csv's `source_url_or_file` column. Never
   * itself emitted as a public URL — see buildSnapshot.ts's purity note.
   */
  repositoryPath: string;
  documentId: string;
  title: string;
  officialUrl: string | null;
  archiveUrl: string | null;
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
  const exact = manifestDocuments.filter((doc) => doc.repositoryPath === filePath);
  if (exact.length > 0) return exact;

  const directoryPrefix = `${filePath}/`;
  return manifestDocuments.filter((doc) => doc.repositoryPath.startsWith(directoryPrefix));
}

/**
 * Resolves every data/sources/source-documents.csv row to the public
 * documents backing it, joining on repository file path rather than source
 * id: the fact-data source registry (data/sources/source-documents.csv) and
 * the reviewed methodology manifests (data/methodology/source-archives/,
 * docs/Raw Data/GDP/national-nominal-gdp/source-manifest.csv) use unrelated
 * id schemes, but `source_url_or_file` always names the exact repository
 * path(s) the manifests archived (spec section 8.1).
 *
 * A row whose file(s) match nothing in `manifestDocuments` resolves to an
 * empty `documents` array rather than a fabricated link — this function never
 * invents a URL or an id. It also never sorts: array order is hash-
 * significant (lib/factQuery/canonical.ts), and buildSnapshot.ts is the one
 * file in lib/factQuery/ responsible for imposing that order, with the same
 * sortedBy helper it uses for every other snapshot array.
 */
export function resolvePublicSources(input: ResolvePublicSourcesInput): ResolvedSource[] {
  const { sourceDocuments, manifestDocuments } = input;

  return sourceDocuments.map((row): ResolvedSource => {
    const seenDocumentIds = new Set<string>();
    const documents: ResolvedSource["documents"] = [];

    for (const filePath of splitFilePaths(row.sourceUrlOrFile)) {
      for (const doc of matchDocuments(filePath, manifestDocuments)) {
        if (seenDocumentIds.has(doc.documentId)) continue;
        seenDocumentIds.add(doc.documentId);
        documents.push({
          documentId: doc.documentId,
          title: doc.title,
          officialUrl: doc.officialUrl,
          archiveUrl: doc.archiveUrl,
        });
      }
    }

    return {
      sourceId: row.sourceId,
      name: row.sourceName,
      lastReviewedAt: row.lastReviewedAt,
      documents,
    };
  });
}
