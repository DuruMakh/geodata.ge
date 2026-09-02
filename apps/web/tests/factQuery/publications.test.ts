// apps/web/tests/factQuery/publications.test.ts
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import {
  buildAllPublications,
  buildCatalogueFile,
  buildDatasetFiles,
  buildManifestFile,
  buildSourcesFile,
  publicationHeader,
} from "../../lib/factQuery/publications";
import { queryNational } from "../../lib/factQuery/queryNational";

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

type PublishedObservation = {
  observationId: string;
  level: string;
  entityId: string;
  entityType: string;
  measure: string;
  parentSeriesId: string | null;
  value: number | null;
};
type PublishedFile = {
  notice: string;
  licence: string;
  observations: PublishedObservation[];
  catalogue: { series: unknown[]; exclusions: unknown[] };
  coverage: unknown;
  sources: unknown[];
  supportingValues: Record<string, unknown[]>;
};

describe("dataset publications", () => {
  it("publishes the four files with observations, catalogue, sources and caveats", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const files = buildDatasetFiles(snapshot);

    expect(files.map((file) => file.fileName)).toEqual([
      "national-revenue.json",
      "national-expenditure.json",
      "ministries.json",
      "municipal-expenditure.json",
    ]);

    for (const file of files) {
      const published = parse(file.bytes) as unknown as PublishedFile;
      expect(published.observations.length, `${file.fileName} observations`).toBeGreaterThan(0);
      expect(published.observations.length, `${file.fileName} rowCount`).toBe(file.rowCount);
      expect(published.catalogue.series.length, `${file.fileName} series`).toBeGreaterThan(0);
      expect(published.sources.length, `${file.fileName} sources`).toBeGreaterThan(0);
      expect(published.coverage, `${file.fileName} coverage`).toBeDefined();
      expect(published.licence, `${file.fileName} licence`).toBe("CC BY 4.0");
      // Spec 12.1: the file must warn that summing all rows is invalid.
      expect(published.notice, `${file.fileName} notice`).toMatch(/შეკრება/);
    }
  });

  it("gives every observation an explicit role, parentage and level", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    for (const file of buildDatasetFiles(snapshot)) {
      for (const observation of (parse(file.bytes) as unknown as PublishedFile).observations) {
        expect(observation.level, `${file.fileName} ${observation.observationId}`).toBeTruthy();
        expect(observation).toHaveProperty("parentSeriesId");
        expect(observation.entityType, `${file.fileName} ${observation.observationId}`).toBeTruthy();
      }
    }
  });

  it("excludes the five aggregate-only municipalities from the municipal file", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const municipal = parse(buildDatasetFiles(snapshot)[3]!.bytes) as unknown as PublishedFile;
    const entityIds = new Set(municipal.observations.map((observation) => observation.entityId));

    for (const code of ["05", "42", "43", "46", "64"]) {
      expect(entityIds.has(code), `code ${code} published as a territorial row`).toBe(false);
    }
    // They must still be named as exclusions with a reason, not silently absent.
    expect(municipal.catalogue.exclusions.length).toBeGreaterThanOrEqual(5);
  });

  it("separates ministries by hierarchy level", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const ministries = parse(buildDatasetFiles(snapshot)[2]!.bytes) as unknown as PublishedFile;
    const levels = new Set(ministries.observations.map((observation) => observation.level));

    expect(levels.has("admin_category")).toBe(true);
    expect(levels.has("major_program")).toBe(true);
  });

  it("carries the supporting denominators, not precomputed ratios", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const files = buildDatasetFiles(snapshot);
    const revenue = parse(files[0]!.bytes) as unknown as PublishedFile;
    const municipal = parse(files[3]!.bytes) as unknown as PublishedFile;

    expect(revenue.supportingValues.gdpFacts!.length).toBeGreaterThan(0);
    expect(municipal.supportingValues.populationFacts!.length).toBeGreaterThan(0);
    // amount_gel only: ratios are reproducible from the denominators above.
    expect(new Set(revenue.observations.map((observation) => observation.measure))).toEqual(new Set(["amount_gel"]));
  });

  it("keeps every published file within the size budget", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    // A guard against a silent regression republishing per-row duplication:
    // before the citation fix the municipal response alone was 30 MB.
    for (const file of buildAllPublications(snapshot)) {
      expect(file.bytes.byteLength / 1024 / 1024, `${file.fileName} MB`).toBeLessThan(20);
    }
  });

  it("puts the manifest last so it can hash the others", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);

    expect(buildAllPublications(snapshot).map((file) => file.fileName)).toEqual([
      "catalogue.json",
      "sources.json",
      "national-revenue.json",
      "national-expenditure.json",
      "ministries.json",
      "municipal-expenditure.json",
      "manifest.json",
    ]);
  });
});

describe("the published bytes carry the same figures the query core returns", () => {
  it("matches queryNational for every published revenue observation", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const published = parse(buildDatasetFiles(snapshot)[0]!.bytes) as unknown as PublishedFile;

    const years = [...new Set(snapshot.national.facts.map((fact) => fact.year))].sort((left, right) => left - right);
    const seriesIds = [
      ...new Set(snapshot.national.facts.filter((fact) => fact.side === "revenue").map((fact) => fact.itemId)),
    ];
    const direct = queryNational(snapshot, { side: "revenue", seriesIds, years, measure: "amount_gel" });
    const expected = new Map(
      (direct as { data: { observations: PublishedObservation[] } }).data.observations.map((observation) => [
        observation.observationId,
        observation.value,
      ]),
    );

    expect(published.observations.length).toBe(expected.size);
    for (const observation of published.observations) {
      expect(observation.value, observation.observationId).toBe(expected.get(observation.observationId));
    }
  });
});
