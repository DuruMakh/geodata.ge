// apps/web/tests/factQuery/publications.test.ts
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import {
  buildAllPublications,
  buildCatalogueFile,
  buildDatasetFiles,
  buildManifestFile,
  buildSourcesFile,
  publicationHeader,
} from "../../lib/factQuery/publications";
import { queryNational } from "../../lib/factQuery/queryNational";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-09-02T00:00:00.000Z" };
const parse = (bytes: Buffer): Record<string, never> => JSON.parse(bytes.toString("utf8"));

// One build for the whole file, like every sibling in tests/factQuery/.
// Rebuilding per `it` cost 47.6s here against 10.2s for a complete
// build-and-write run.
let snapshot: FactQuerySnapshot;
// The published files are pure over the snapshot, and 22 tests read them.
// Rebuilding per `it` re-serialised all of them 23 times: 32.7s for this file
// against 5.9s built once. `buildAllPublications` already composes the other
// three builders, and `buildDatasetFiles` is the only expensive one (1.8s of
// its 2.1s), so everything is taken from that single call rather than built
// again alongside it. Selected by name, not position, so a reordering fails in
// the test that pins the order rather than silently here.
let datasetFiles: ReturnType<typeof buildDatasetFiles>;
let allPublications: ReturnType<typeof buildAllPublications>;
let catalogueFile: ReturnType<typeof buildCatalogueFile>;
let sourcesFile: ReturnType<typeof buildSourcesFile>;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot(OPTIONS);
  allPublications = buildAllPublications(snapshot);
  catalogueFile = allPublications.find((file) => file.fileName === "catalogue.json")!;
  sourcesFile = allPublications.find((file) => file.fileName === "sources.json")!;
  datasetFiles = allPublications.filter(
    (file) => file.fileName.endsWith(".json") && !["catalogue.json", "sources.json", "manifest.json"].includes(file.fileName),
  );
});

describe("publication header", () => {
  it("carries the four identity fields and the licence verbatim", () => {
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
  it("publishes every dataset with its series and entities", async () => {
    const catalogue = parse(catalogueFile.bytes) as unknown as {
      datasets: { datasetId: string; series: unknown[]; entities?: unknown[] }[];
      exclusions: unknown[];
    };

    expect(catalogue.datasets.map((dataset) => dataset.datasetId).sort()).toEqual([
      "economic-sectors",
      "gdp-overview",
      "general-government-balance",
      "government-debt",
      "ministries",
      "municipal-expenditure",
      "national-expenditure",
      "national-revenue",
      "regional-economies",
    ]);
    for (const dataset of catalogue.datasets) {
      expect(dataset.series.length, `${dataset.datasetId} series`).toBeGreaterThan(0);
    }
    const municipal = catalogue.datasets.find((dataset) => dataset.datasetId === "municipal-expenditure");
    expect(municipal?.entities?.length).toBeGreaterThan(0);
    expect(catalogue.exclusions.length).toBeGreaterThan(0);
  });

  it("never lists an excluded municipality as a queryable entity", async () => {
    const catalogue = parse(catalogueFile.bytes) as unknown as {
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
    const published = parse(sourcesFile.bytes) as unknown as {
      sources: { sourceId: string; derivation: string | null; documents: { role: string }[] }[];
    };

    expect(published.sources.length).toBe(snapshot.sources.length);
    for (const source of published.sources) {
      // Spec 8.1: a source resolves to a public document or a stated derivation.
      expect(source.documents.length > 0 || source.derivation !== null, source.sourceId).toBe(true);
    }
  });

  it("keeps the derivation-upstream role on published documents", async () => {
    const published = parse(sourcesFile.bytes) as unknown as {
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
    const catalogue = catalogueFile;
    const sources = sourcesFile;
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
    const catalogue = catalogueFile;
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
  it("publishes every dataset file with observations, catalogue, sources and caveats", async () => {
    const files = datasetFiles;

    expect(files.map((file) => file.fileName)).toEqual([
      "national-revenue.json",
      "national-expenditure.json",
      "ministries.json",
      "municipal-expenditure.json",
      "government-debt.json",
      "government-debt-rates.json",
      "general-government-balance.json",
      "gdp-overview.json",
      "economic-sectors.json",
      "regional-economies.json",
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
    for (const file of datasetFiles) {
      for (const observation of (parse(file.bytes) as unknown as PublishedFile).observations) {
        expect(observation.level, `${file.fileName} ${observation.observationId}`).toBeTruthy();
        expect(observation).toHaveProperty("parentSeriesId");
        expect(observation.entityType, `${file.fileName} ${observation.observationId}`).toBeTruthy();
      }
    }
  });

  it("excludes the five aggregate-only municipalities from the municipal file", async () => {
    const municipal = parse(datasetFiles[3]!.bytes) as unknown as PublishedFile;
    const entityIds = new Set(municipal.observations.map((observation) => observation.entityId));

    for (const code of ["05", "42", "43", "46", "64"]) {
      expect(entityIds.has(code), `code ${code} published as a territorial row`).toBe(false);
    }
    // They must still be named as exclusions with a reason, not silently absent.
    expect(municipal.catalogue.exclusions.length).toBeGreaterThanOrEqual(5);
  });

  it("separates ministries by hierarchy level", async () => {
    const ministries = parse(datasetFiles[2]!.bytes) as unknown as PublishedFile;
    const levels = new Set(ministries.observations.map((observation) => observation.level));

    expect(levels.has("admin_category")).toBe(true);
    expect(levels.has("major_program")).toBe(true);
  });

  it("carries the supporting denominators, not precomputed ratios", async () => {
    const files = datasetFiles;
    const revenue = parse(files[0]!.bytes) as unknown as PublishedFile;
    const municipal = parse(files[3]!.bytes) as unknown as PublishedFile;

    expect(revenue.supportingValues.gdpFacts!.length).toBeGreaterThan(0);
    expect(municipal.supportingValues.populationFacts!.length).toBeGreaterThan(0);
    // amount_gel only: ratios are reproducible from the denominators above.
    expect(new Set(revenue.observations.map((observation) => observation.measure))).toEqual(new Set(["amount_gel"]));
  });

  it("keeps every published file within the size budget", async () => {
    // A guard against a silent regression republishing per-row duplication:
    // before the citation fix the municipal response alone was 30 MB.
    for (const file of allPublications) {
      expect(file.bytes.byteLength / 1024 / 1024, `${file.fileName} MB`).toBeLessThan(20);
    }
  });

  it("puts the manifest last so it can hash the others", async () => {

    expect(allPublications.map((file) => file.fileName)).toEqual([
      "catalogue.json",
      "sources.json",
      "national-revenue.json",
      "national-expenditure.json",
      "ministries.json",
      "municipal-expenditure.json",
      "government-debt.json",
      "government-debt-rates.json",
      "general-government-balance.json",
      "gdp-overview.json",
      "gdp-overview.csv",
      "economic-sectors.json",
      "economic-sectors.csv",
      "regional-economies.json",
      "regional-economies.csv",
      "manifest.json",
    ]);
  });
});

describe("the published bytes carry the same figures the query core returns", () => {
  it("matches queryNational for every published revenue observation", async () => {
    const published = parse(datasetFiles[0]!.bytes) as unknown as PublishedFile;

    const years = [...new Set(snapshot.national.facts.map((fact) => fact.year))].sort((left, right) => left - right);
    // Includes the calculated total, which the published file carries and
    // which has no fact row to derive it from.
    const seriesIds = [
      ...new Set(snapshot.national.facts.filter((fact) => fact.side === "revenue").map((fact) => fact.itemId)),
      "revenue.total",
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

describe("regressions from the Part 2 review", () => {
  // REVIEW CRITICAL 1. seriesIds were derived from the served facts, and a
  // CALCULATED total has no fact row, so revenue.total, expenditure.total and
  // admin_spending.total vanished from three of four files while each file's
  // own catalogue still advertised them with a full year range. The municipal
  // file was correct only because "municipal.total" had been hardcoded once.
  //
  // The knock-on was worse than the omission: budget_scopes_differ gates on a
  // total being requested, so both national files shipped side by side with
  // nothing warning that subtracting their totals is not a deficit - a spec 5.1
  // non-negotiable. revenue_2004_total_scope was suppressed the same way.
  it("publishes an observation for every total its own catalogue advertises", () => {
    for (const file of datasetFiles) {
      const published = parse(file.bytes) as unknown as {
        catalogue: { series: { seriesId: string; level: string }[] };
        observations: { seriesId: string }[];
      };
      const advertised = published.catalogue.series
        .filter((entry) => entry.level === "total")
        .map((entry) => entry.seriesId);
      const returned = new Set(published.observations.map((observation) => observation.seriesId));

      // The two debt files are exempt from "must advertise a total". A debt
      // total (debt.stock.total) is a served row published by the Ministry,
      // not a figure this service calculates - so there is no derived total
      // that could silently vanish, which is the regression above. Their
      // series level is the family (stock/service/rate). The balance file is
      // not exempt: its single series IS a total.
      if (!file.fileName.startsWith("government-debt")) {
        expect(advertised.length, `${file.fileName} advertises no total`).toBeGreaterThan(0);
      }
      for (const total of advertised) {
        expect(returned.has(total), `${file.fileName} advertises ${total} but publishes no row for it`).toBe(true);
      }
    }
  });

  it("warns that the two national totals are different accounting boundaries", () => {
    const files = datasetFiles;
    for (const index of [0, 1]) {
      const published = parse(files[index]!.bytes) as unknown as { caveats: { code: string }[] };

      expect(
        published.caveats.map((caveat) => caveat.code),
        `${files[index]!.fileName} must carry budget_scopes_differ`,
      ).toContain("budget_scopes_differ");
    }
  });

  // REVIEW CRITICAL 2. The ministries file unioned two responses' caveats with
  // a first-wins dedup by code, but `affects` is computed per response. Both
  // levels fire nominal_gel with disjoint lists, so the 48 program series were
  // discarded: 1,056 of 1,364 rows declared a caveat whose published scope
  // excluded them. Harmless for a note, silently wrong for a severe one.
  it("keeps every declared caveat resolvable back to the row that declares it", () => {
    for (const file of datasetFiles) {
      const published = parse(file.bytes) as unknown as {
        caveats: { code: string; affects: string[] }[];
        observations: { observationId: string; entityId: string; seriesId: string; year: number; caveatIds: string[] }[];
      };
      const affectsByCode = new Map(published.caveats.map((caveat) => [caveat.code, new Set(caveat.affects)]));

      for (const observation of published.observations) {
        for (const code of observation.caveatIds) {
          const affects = affectsByCode.get(code);
          expect(affects, `${file.fileName}: ${observation.observationId} declares undefined caveat ${code}`).toBeDefined();
          // The grains affects() is allowed to use (lib/factQuery/observations.ts).
          const shapes = [
            observation.seriesId,
            observation.entityId,
            String(observation.year),
            `${observation.entityId}:${observation.year}`,
            `${observation.seriesId}:${observation.year}`,
            `${observation.entityId}:${observation.seriesId}:${observation.year}`,
          ];
          expect(
            shapes.some((shape) => affects!.has(shape)),
            `${file.fileName}: ${observation.observationId} declares ${code} but the published affects excludes it`,
          ).toBe(true);
        }
      }
    }
  });

  // REVIEW IMPORTANT (reviewer 1). Narrowing points at the right original; it
  // must never hide provenance. The year filter applied to every unnamed
  // document of every cited source, not just the budget-history workbooks, so
  // 10 published rows cited source.treasury_consolidated_revenue_actual and
  // showed none of its documents - a figure whose origin nobody can open.
  it("never cites a source while showing none of its documents", () => {
    for (const file of datasetFiles) {
      const published = parse(file.bytes) as unknown as {
        sources: { sourceId: string; documents: { documentId: string }[] }[];
        observations: { observationId: string; sourceIds: string[]; documentIds: string[] }[];
      };
      const documentsBySourceId = new Map(
        published.sources.map((source) => [source.sourceId, source.documents.map((d) => d.documentId)]),
      );

      for (const observation of published.observations) {
        for (const sourceId of observation.sourceIds) {
          const archived = documentsBySourceId.get(sourceId) ?? [];
          if (archived.length === 0) continue;
          expect(
            observation.documentIds.some((documentId) => archived.includes(documentId)),
            `${file.fileName}: ${observation.observationId} cites ${sourceId} but shows none of its ${archived.length} documents`,
          ).toBe(true);
        }
      }
    }
  });

  // REVIEW MINOR. The old "does not describe itself" test passed [catalogue]
  // and asserted manifest.json was absent - buildManifestFile maps the array it
  // is given, so it could not have failed. This pins the real invariant in
  // buildAllPublications instead.
  it("hashes every published file except the manifest itself", () => {
    const all = allPublications;
    const manifest = all[all.length - 1]!;
    const described = (parse(manifest.bytes) as unknown as { files: { fileName: string }[] }).files.map(
      (file) => file.fileName,
    );

    expect(manifest.fileName).toBe("manifest.json");
    expect(described).not.toContain("manifest.json");
    expect(described).toEqual(all.slice(0, -1).map((file) => file.fileName));
  });
  // REVIEW IMPORTANT (reviewer 2). The municipal catalogue said
  // "municipal_functional_public_total" while all 9,196 of its observations
  // said "municipal_budget_expenditure". Those were the only two occurrences of
  // either string in the repo, so no test compared them until both shipped in
  // one file and the obvious consumer join returned nothing.
  it("agrees with itself about each dataset's accounting boundary", () => {
    for (const file of datasetFiles) {
      const published = parse(file.bytes) as unknown as {
        datasetId: string;
        catalogue: { datasets: { datasetId: string; budgetScope: string }[] };
        observations: { budgetScope: string }[];
      };
      const summary = published.catalogue.datasets.find((entry) => entry.datasetId === published.datasetId);
      const onRows = new Set(published.observations.map((observation) => observation.budgetScope));

      expect(onRows.size, `${file.fileName} mixes budget scopes`).toBe(1);
      expect([...onRows][0], `${file.fileName} catalogue and observations disagree`).toBe(summary!.budgetScope);
    }
  });
});


describe("the published catalogue", () => {
  it("describes every dataset the endpoint serves", () => {
    // publications.ts kept its own DATASET_IDS list, so catalogue.json and
    // manifest.json's coverage described four datasets while manifest.json's
    // files listed all ten. A bulk client told to read the catalogue first was
    // told debt and the balance do not exist.
    const catalogue = parse(catalogueFile.bytes) as unknown as {
      datasets: { datasetId: string }[];
    };
    const served = describeCoverage(snapshot, {});
    if (served.kind !== "catalogue") throw new Error("expected a catalogue");

    expect(catalogue.datasets.map((d) => d.datasetId).sort()).toEqual(
      (served.data as { datasets: { datasetId: string }[] }).datasets.map((d) => d.datasetId).sort(),
    );
  });
});
