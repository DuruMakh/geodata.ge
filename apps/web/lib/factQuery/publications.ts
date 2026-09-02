// apps/web/lib/factQuery/publications.ts
//
// Build-time bulk publications (spec section 12.1). Pure: a snapshot in, byte
// buffers out. No filesystem, no process, no network - the script in
// scripts/prepare-fact-query-publications.ts owns all I/O, exactly as
// buildSnapshot and prepare-fact-query-snapshot already split those concerns.
//
// Every figure here comes from the Part 1 query functions. Nothing in this
// file recalculates a budget number, so a published file and an MCP answer
// cannot disagree: there is only one implementation of an observation.
import { createHash } from "node:crypto";
import { describeCoverage, type CoverageData } from "./describeCoverage";
import type { DatasetId, FactQuerySnapshot } from "./types";

export type PublicationHeader = {
  schemaVersion: string;
  dataVersion: string;
  releaseCommit: string;
  generatedAt: string;
  publisher: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
};

export type PublicationArtifact = {
  fileName: string;
  bytes: Buffer;
  rowCount: number;
};

const DATASET_IDS: readonly DatasetId[] = [
  "national-revenue",
  "national-expenditure",
  "ministries",
  "municipal-expenditure",
];

/**
 * Repeated at the top of every published file so a download read on its own,
 * without llms.txt or the manifest, still states its version, licence and
 * attribution (spec section 12.1).
 */
export function publicationHeader(snapshot: FactQuerySnapshot): PublicationHeader {
  return {
    schemaVersion: snapshot.schemaVersion,
    dataVersion: snapshot.dataVersion,
    releaseCommit: snapshot.releaseCommit,
    generatedAt: snapshot.generatedAt,
    publisher: "Fiscal.ge",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "Fiscal.ge, CC BY 4.0",
  };
}

/** Stable two-space JSON with a trailing newline, matching the snapshot writer. */
export function serialize(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * describeCoverage returns FactQueryResponse, whose `data` is `unknown` by
 * contract. The kind check is what makes the cast safe: a catalogue response
 * always carries CoverageData, and anything else is a build-stopping bug
 * rather than something to publish.
 */
export function catalogueData(snapshot: FactQuerySnapshot, datasetId?: DatasetId): CoverageData {
  const response = describeCoverage(snapshot, datasetId === undefined ? {} : { datasetId });
  if (response.kind !== "catalogue") {
    throw new Error(`describeCoverage(${datasetId ?? "all"}) returned ${response.kind}, expected catalogue`);
  }
  return response.data as CoverageData;
}

export function buildCatalogueFile(snapshot: FactQuerySnapshot): PublicationArtifact {
  const overview = catalogueData(snapshot);

  const datasets = DATASET_IDS.map((datasetId) => {
    const data = catalogueData(snapshot, datasetId);
    const summary = data.datasets.find((entry) => entry.datasetId === datasetId);
    if (summary === undefined) throw new Error(`No dataset summary for ${datasetId}`);
    return {
      ...summary,
      series: data.series ?? [],
      ...(data.entities !== undefined ? { entities: data.entities } : {}),
    };
  });

  const bytes = serialize({
    ...publicationHeader(snapshot),
    notice:
      "ეს გადამოწმებული კატალოგია: რომელი მონაცემთა ნაკრები, ერთეული და სერია არსებობს. ციფრები ცალკეულ ფაილებშია.",
    datasets,
    exclusions: overview.exclusions,
  });

  return {
    fileName: "catalogue.json",
    bytes,
    rowCount: datasets.reduce((total, dataset) => total + dataset.series.length, 0),
  };
}

export function buildSourcesFile(snapshot: FactQuerySnapshot): PublicationArtifact {
  const bytes = serialize({
    ...publicationHeader(snapshot),
    notice:
      'დოკუმენტი role="derivation_upstream" აღნიშნავს, რომ ის გაანგარიშების საწყისი მონაცემია და არა საბოლოო ციფრის პუბლიკაცია.',
    sources: snapshot.sources,
  });

  return { fileName: "sources.json", bytes, rowCount: snapshot.sources.length };
}

/**
 * Built LAST, over the exact buffers that get written. Hashing a
 * re-serialization would let the manifest describe bytes nobody published.
 * The manifest cannot list itself: writing its own hash would change its own
 * bytes.
 */
export function buildManifestFile(
  snapshot: FactQuerySnapshot,
  artifacts: readonly PublicationArtifact[],
): PublicationArtifact {
  const bytes = serialize({
    ...publicationHeader(snapshot),
    files: artifacts.map((artifact) => ({
      fileName: artifact.fileName,
      url: `/downloads/data/${artifact.fileName}`,
      rowCount: artifact.rowCount,
      byteSize: artifact.bytes.byteLength,
      sha256: sha256(artifact.bytes),
      mediaType: "application/json",
    })),
  });

  return { fileName: "manifest.json", bytes, rowCount: artifacts.length };
}
