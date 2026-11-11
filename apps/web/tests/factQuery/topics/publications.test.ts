// apps/web/tests/factQuery/topics/publications.test.ts
//
// The published topic files (spec §5.3): one CSV per topic dataset under /downloads/data/topics/, listed in the manifest
// and the catalogue, and the same source documents in sources.json that get_sources returns.
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { buildAllPublications, buildTopicCsvFiles, TOPIC_CSV_COLUMNS } from "../../../lib/factQuery/publications";
import { getSources } from "../../../lib/factQuery/getSources";
import type { GetSourcesData } from "../../../lib/factQuery/getSources";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { testSnapshot } from "../../helpers/factQuerySnapshot";

const FORBIDDEN_COLUMNS = ["source_sheet", "source_cell", "source_workbook", "source_number_format"];

let snapshot: FactQuerySnapshot;
let files: ReturnType<typeof buildTopicCsvFiles>;
beforeAll(() => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-09-02T00:00:00.000Z" });
  files = buildTopicCsvFiles(snapshot);
});

describe("topic CSV files", () => {
  it("has one topics/<datasetId>.csv per topic dataset, in page order", () => {
    expect(snapshot.topics.datasets.length).toBeGreaterThan(0);
    expect(files.map((file) => file.fileName)).toEqual(snapshot.topics.datasets.map((dataset) => `topics/${dataset.page.datasetId}.csv`));
  });

  it("starts with the BOM and the agreed header, and never names a workbook-location column", () => {
    for (const file of files) {
      const text = file.bytes.toString("utf8");
      expect(text.charCodeAt(0), file.fileName).toBe(0xfeff);
      const header = text.slice(1, text.indexOf("\n"));
      expect(header).toBe(TOPIC_CSV_COLUMNS.join(","));
      for (const column of FORBIDDEN_COLUMNS) expect(header).not.toContain(column);
    }
  });

  it("has one row per served cell", () => {
    for (const dataset of snapshot.topics.datasets) {
      const file = files.find((entry) => entry.fileName === `topics/${dataset.page.datasetId}.csv`)!;
      const rows = parse(file.bytes.toString("utf8"), { bom: true, columns: true }) as Record<string, string>[];
      expect(rows.length, dataset.page.datasetId).toBe(dataset.columns.year.length);
      expect(file.rowCount).toBe(rows.length);
    }
  });

  it("writes a missing cell as an empty value with no basis and no sources", () => {
    const base = snapshot.topics.datasets[0]!;
    const row = base.columns.year.findIndex((_year, at) => base.columns.value[at] !== null && base.columns.sources[at]!.length > 0);
    const value = base.columns.value.map((entry, at) => (at === row ? null : entry));
    const patched: FactQuerySnapshot = { ...snapshot, topics: { ...snapshot.topics, datasets: [{ ...base, columns: { ...base.columns, value } }] } };
    const rows = parse(buildTopicCsvFiles(patched)[0]!.bytes.toString("utf8"), { bom: true, columns: true }) as Record<string, string>[];
    const missing = rows.filter((entry) => entry.value === "");
    expect(missing.length).toBeGreaterThan(0);
    for (const entry of missing) {
      expect(entry.basis).toBe("");
      expect(entry.source_ids).toBe("");
    }
    expect(rows.filter((entry) => entry.value !== "").every((entry) => entry.basis !== "" && entry.source_ids !== "")).toBe(true);
  });

  it("writes school years as 2015/16 and the series' own unit token", () => {
    const schools = files.find((file) => file.fileName === "topics/education-schools.csv")!.bytes.toString("utf8");
    expect(schools).toMatch(/^2015,2015\/16,/m);
    expect(schools).toMatch(/,(institutions|persons|persons_thousand),actual,official,/);
  });
});

describe("the manifest and catalogue", () => {
  it("lists every topic CSV with its hash, and the topic datasets in the catalogue and coverage", () => {
    const publications = buildAllPublications(snapshot);
    const manifest = JSON.parse(publications.find((file) => file.fileName === "manifest.json")!.bytes.toString("utf8")) as {
      coverage: { datasetId: string }[]; files: { fileName: string; url: string; mediaType: string }[];
    };
    const catalogue = JSON.parse(publications.find((file) => file.fileName === "catalogue.json")!.bytes.toString("utf8")) as { datasets: { datasetId: string }[] };
    for (const file of files) {
      const entry = manifest.files.find((candidate) => candidate.fileName === file.fileName);
      expect(entry, file.fileName).toMatchObject({ url: `/downloads/data/${file.fileName}`, mediaType: "text/csv" });
    }
    for (const dataset of snapshot.topics.datasets) {
      expect(manifest.coverage.map((entry) => entry.datasetId)).toContain(dataset.page.datasetId);
      expect(catalogue.datasets.map((entry) => entry.datasetId)).toContain(dataset.page.datasetId);
    }
  });

  it("puts the topic source documents in sources.json", () => {
    const published = JSON.parse(buildAllPublications(snapshot).find((file) => file.fileName === "sources.json")!.bytes.toString("utf8")) as { sources: { sourceId: string }[] };
    for (const sourceId of snapshot.topics.sourceIds) expect(published.sources.map((source) => source.sourceId)).toContain(sourceId);
  });
});

describe("get_sources for a topic dataset", () => {
  it("returns the Geostat workbooks the dataset's facts cite, with their official URLs", () => {
    const schools = snapshot.topics.datasets.find((dataset) => dataset.page.datasetId === "education-schools")!;
    const cited = [...new Set(schools.columns.sources.flat().map((index) => snapshot.topics.sourceIds[index]!))];
    // get_sources takes at most 100 ids.
    const unrelated = snapshot.topics.sourceIds.filter((id) => !cited.includes(id)).slice(0, 100 - cited.length);
    const result = getSources(snapshot, { sourceIds: [...cited, ...unrelated], datasetId: "education-schools" });
    expect(result.kind).toBe("sources");
    const sources = (result as { data: GetSourcesData }).data.sources;
    for (const source of sources.filter((entry) => cited.includes(entry.sourceId))) {
      expect(source.narrowingOutcome).toBe("applied");
      expect(source.documents.length).toBeGreaterThan(0);
      for (const document of source.documents) expect(document.officialUrl).toMatch(/^https:\/\/www\.geostat\.ge\/media\//);
    }
    // A source this dataset does not cite keeps its full list, marked as unmatched.
    for (const source of sources.filter((entry) => unrelated.includes(entry.sourceId))) expect(source.narrowingOutcome).toBe("dropped_no_match");
  });
});
