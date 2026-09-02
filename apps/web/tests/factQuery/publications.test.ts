// apps/web/tests/factQuery/publications.test.ts
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import {
  buildCatalogueFile,
  buildManifestFile,
  buildSourcesFile,
  publicationHeader,
} from "../../lib/factQuery/publications";

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-09-02T00:00:00.000Z" };
const parse = (bytes: Buffer): Record<string, never> => JSON.parse(bytes.toString("utf8"));

describe("publication header", () => {
  it("carries the four identity fields and the licence verbatim", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const header = publicationHeader(snapshot);

    expect(header.schemaVersion).toBe(snapshot.schemaVersion);
    expect(header.dataVersion).toBe(snapshot.dataVersion);
    expect(header.releaseCommit).toBe("test-commit");
    expect(header.generatedAt).toBe("2026-09-02T00:00:00.000Z");
    // Must match buildResponseMeta exactly, or a downloaded file and an MCP
    // answer would state different licences for the same figures.
    expect(header.licence).toBe("CC BY 4.0");
    expect(header.licenceUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
  });
});

describe("catalogue.json", () => {
  it("publishes all four datasets with their series and entities", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const catalogue = parse(buildCatalogueFile(snapshot).bytes) as unknown as {
      datasets: { datasetId: string; series: unknown[]; entities?: unknown[] }[];
      exclusions: unknown[];
    };

    expect(catalogue.datasets.map((dataset) => dataset.datasetId).sort()).toEqual([
      "ministries",
      "municipal-expenditure",
      "national-expenditure",
      "national-revenue",
    ]);
    for (const dataset of catalogue.datasets) {
      expect(dataset.series.length, `${dataset.datasetId} series`).toBeGreaterThan(0);
    }
    const municipal = catalogue.datasets.find((dataset) => dataset.datasetId === "municipal-expenditure");
    expect(municipal?.entities?.length).toBeGreaterThan(0);
    expect(catalogue.exclusions.length).toBeGreaterThan(0);
  });

  it("never lists an excluded municipality as a queryable entity", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const catalogue = parse(buildCatalogueFile(snapshot).bytes) as unknown as {
      datasets: { datasetId: string; entities?: { entityId: string }[] }[];
    };
    const municipal = catalogue.datasets.find((dataset) => dataset.datasetId === "municipal-expenditure");
    const entityIds = (municipal?.entities ?? []).map((entity) => entity.entityId);

    for (const code of ["05", "42", "43", "46", "64"]) {
      expect(entityIds, `code ${code}`).not.toContain(code);
    }
  });
});

describe("sources.json", () => {
  it("publishes every source with its documents and derivation", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const published = parse(buildSourcesFile(snapshot).bytes) as unknown as {
      sources: { sourceId: string; derivation: string | null; documents: { role: string }[] }[];
    };

    expect(published.sources.length).toBe(snapshot.sources.length);
    for (const source of published.sources) {
      // Spec 8.1: a source resolves to a public document or a stated derivation.
      expect(source.documents.length > 0 || source.derivation !== null, source.sourceId).toBe(true);
    }
  });

  it("keeps the derivation-upstream role on published documents", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const published = parse(buildSourcesFile(snapshot).bytes) as unknown as {
      sources: { sourceId: string; documents: { role: string }[] }[];
    };
    const derived = published.sources.find((source) => source.sourceId === "source.adjara_consolidated_budget");

    // Without the role a consumer rendering documents presents the republican-
    // payments PDF as the publication of the consolidated total.
    expect(derived?.documents.map((document) => document.role)).toEqual([
      "derivation_upstream",
      "derivation_upstream",
    ]);
  });
});

describe("manifest.json", () => {
  it("records the exact bytes and hash of every artifact it describes", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const catalogue = buildCatalogueFile(snapshot);
    const sources = buildSourcesFile(snapshot);
    const manifest = parse(buildManifestFile(snapshot, [catalogue, sources]).bytes) as unknown as {
      files: { fileName: string; byteSize: number; sha256: string; url: string }[];
    };

    for (const artifact of [catalogue, sources]) {
      const entry = manifest.files.find((file) => file.fileName === artifact.fileName);
      expect(entry, `${artifact.fileName} missing from manifest`).toBeDefined();
      expect(entry?.byteSize).toBe(artifact.bytes.byteLength);
      expect(entry?.sha256).toBe(createHash("sha256").update(artifact.bytes).digest("hex"));
      expect(entry?.url).toBe(`/downloads/data/${artifact.fileName}`);
    }
  });

  it("does not describe itself", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const catalogue = buildCatalogueFile(snapshot);
    const manifest = parse(buildManifestFile(snapshot, [catalogue]).bytes) as unknown as {
      files: { fileName: string }[];
    };

    // A manifest cannot carry its own hash: writing the hash changes the bytes.
    expect(manifest.files.map((file) => file.fileName)).not.toContain("manifest.json");
  });
});
