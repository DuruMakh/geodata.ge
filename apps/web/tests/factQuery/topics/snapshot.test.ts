// apps/web/tests/factQuery/topics/snapshot.test.ts
//
// The topics section of the fact-query snapshot (spec §5.1): the topic datasets, their sources merged into
// snapshot.sources, the unit names, and the topic pages leaving the website-only list. The shared snapshot is the
// generated file; this file also builds one with no topic adapters, through the mocked registry below, to prove the
// topics add to the snapshot and change nothing already in it.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import { CORE_SERVED_PAGES, MCP_SERVED_PAGES } from "../../../lib/factQuery/servedPages";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { buildTopicsSnapshot } from "../../../lib/factQuery/topics/registry";
import { unpackTopicFacts } from "../../../lib/factQuery/topics/store";
import type { TopicAdapter, TopicDatasetBuild } from "../../../lib/factQuery/topics/types";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { PAGE_COUNT } from "../../../lib/navigation/navTree";
import { testSnapshot } from "../../helpers/factQuerySnapshot";

// A build in this file uses the adapters it is given and none when called without them, so buildFactQuerySnapshot here
// builds the snapshot as it was before any topic adapter.
vi.mock("../../../lib/factQuery/topics/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/factQuery/topics/registry")>();
  return { ...actual, buildTopicsSnapshot: (adapters?: Parameters<typeof actual.buildTopicsSnapshot>[0]) => actual.buildTopicsSnapshot(adapters ?? []) };
});

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-08-28T00:00:00.000Z" };
/** The Demography sources the core datasets already resolve, from the Geostat demography package (sources.test.ts). */
const CORE_RESOLVED = /^source\.geostat_(demography_|census2024_|municipal_population$)/;

let snapshot: FactQuerySnapshot;
beforeAll(() => { snapshot = testSnapshot(OPTIONS); });

describe("the snapshot's topics section", () => {
  it("is schema 1.8.0", () => {
    expect(snapshot.schemaVersion).toBe("1.8.0");
  });

  it("carries the Schools page as a dataset with its addresses, group and years", () => {
    const schools = snapshot.topics.datasets.find((dataset) => dataset.page.datasetId === "education-schools");
    expect(schools).toBeDefined();
    expect(schools).toMatchObject({
      page: { pagePath: "/explorer/education/schools", periodKind: "school_year" }, groupId: "society",
      urlKa: "https://fiscal.ge/explorer/education/schools", urlEn: "https://fiscal.ge/en/explorer/education/schools",
    });
    expect(schools!.titleKa.trim()).not.toBe("");
    expect(schools!.titleEn.trim()).not.toBe("");
    const years = [...new Set(schools!.columns.year)];
    expect(schools!.firstYear).toBe(Math.min(...years));
    expect(schools!.lastYear).toBe(Math.max(...years));
    // Datasets follow the page list's order.
    const order = snapshot.topics.datasets.map((dataset) => TOPIC_PAGES.findIndex((page) => page.datasetId === dataset.page.datasetId));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("cites only sources that snapshot.sources resolves to archived documents, each once", () => {
    const byId = new Map(snapshot.sources.map((source) => [source.sourceId, source]));
    expect(byId.size).toBe(snapshot.sources.length);
    expect(snapshot.topics.sourceIds.length).toBeGreaterThan(0);
    for (const dataset of snapshot.topics.datasets) {
      for (const indexes of dataset.columns.sources) {
        for (const index of indexes) {
          const source = byId.get(snapshot.topics.sourceIds[index]!);
          expect(source, snapshot.topics.sourceIds[index]).toBeDefined();
          expect(source!.documents.length).toBeGreaterThan(0);
          for (const document of source!.documents) {
            expect(document.titleEn.trim()).not.toBe("");
            // A source the core datasets already cite keeps the core's resolution, listed once: the Geostat demography package's
            // own manifest names each official file and its hash, with no archived copy.
            if (CORE_RESOLVED.test(source!.sourceId)) expect(document).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), sha256: expect.stringMatching(/^[0-9a-f]{64}$/), archiveUrl: null });
            else expect(document.archiveUrl).toMatch(/^https:\/\/fiscal\.ge\/downloads\/methodology\//);
          }
        }
      }
    }
    expect(byId.get("source.geostat_education_municipal")!.nameEn).toBe("Number of public and private schools, pupils and teachers by municipality (table 11)");
  });

  it("names every unit a series uses in Georgian and English, as the site's unit messages do", () => {
    for (const dataset of snapshot.topics.datasets) {
      for (const series of dataset.series) {
        const unit = snapshot.topics.units[series.unit];
        expect(unit, series.unit).toBeDefined();
        expect(unit!.labelKa.trim()).not.toBe("");
        expect(unit!.labelEn.trim()).not.toBe("");
      }
    }
    expect(snapshot.topics.units.persons).toEqual({ labelKa: "ადამიანი", labelEn: "persons" });
    expect(snapshot.topics.units.institutions).toEqual({ labelKa: "დაწესებულება", labelEn: "institutions" });
  });

  it("holds one fact per place, series and year, and a value for every series", () => {
    for (const dataset of snapshot.topics.datasets) {
      const facts = unpackTopicFacts(dataset, snapshot.topics);
      const cells = new Set(facts.map((fact) => `${fact.entityId}:${fact.seriesId}:${fact.year}`));
      expect(cells.size, dataset.page.datasetId).toBe(facts.length);
      const valued = new Set(facts.filter((fact) => fact.value !== null).map((fact) => fact.seriesId));
      for (const series of dataset.series) expect(valued.has(series.seriesId), `${dataset.page.datasetId} ${series.seriesId}`).toBe(true);
    }
  });

  it("serves every topic page, and the website-only list keeps a topic page only until its dataset is built", () => {
    for (const page of TOPIC_PAGES) expect(MCP_SERVED_PAGES[page.pagePath]).toEqual([page.datasetId]);
    for (const [pagePath, datasets] of Object.entries(CORE_SERVED_PAGES)) expect(MCP_SERVED_PAGES[pagePath]).toEqual(datasets);
    const listed = new Set(snapshot.website.pages.map((page) => page.href));
    expect(listed.has("/explorer/education/schools")).toBe(false);
    const built = new Set(snapshot.topics.datasets.map((dataset) => dataset.page.pagePath));
    for (const page of TOPIC_PAGES) expect(listed.has(page.pagePath), page.pagePath).toBe(!built.has(page.pagePath));
  });

  it("builds a dataset for every topic page: every Explorer chart page is served", () => {
    expect(snapshot.topics.datasets.map((dataset) => dataset.page)).toEqual(TOPIC_PAGES);
  });

  it("changes nothing the snapshot already held", async () => {
    const bare = await buildFactQuerySnapshot(OPTIONS);
    expect(bare.topics).toEqual({ datasets: [], sourceIds: [], basisCodes: [], statusCodes: [], units: {} });
    const unchanged = (Object.keys(bare) as (keyof FactQuerySnapshot)[]).filter((key) => !["topics", "sources", "website", "dataVersion"].includes(key));
    expect(unchanged).toContain("national");
    for (const key of unchanged) expect(snapshot[key], key).toEqual(bare[key]);
    // A bare build lists every non-core page; the topic pages with a dataset leave that list and nothing else changes.
    expect(bare.website.pages).toHaveLength(PAGE_COUNT - Object.keys(CORE_SERVED_PAGES).length);
    const built = new Set<string>(snapshot.topics.datasets.map((dataset) => dataset.page.pagePath));
    expect(snapshot.website.pages).toEqual(bare.website.pages.filter((page) => !built.has(page.href)));
    // The core sources are all still there, unchanged; every added one is a topic source.
    const coreIds = new Set(bare.sources.map((source) => source.sourceId));
    expect(snapshot.sources.filter((source) => coreIds.has(source.sourceId))).toEqual(bare.sources);
    for (const source of snapshot.sources.filter((entry) => !coreIds.has(entry.sourceId))) expect(snapshot.topics.sourceIds).toContain(source.sourceId);
  }, 300_000);
});

describe("buildTopicsSnapshot", () => {
  const page = TOPIC_PAGES.find((entry) => entry.datasetId === "education-schools")!;
  const base = (): TopicDatasetBuild => ({
    page, titleKa: "სკოლები", titleEn: "Schools",
    series: [{ seriesId: "education.schools.total", labelKa: "სკოლები", labelEn: "Schools", headingKa: null, headingEn: null, parentSeriesId: null, isTotal: true, unit: "institutions" }],
    entities: [{ entityId: "country.georgia", entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null }],
    facts: [{ entityId: "country.georgia", seriesId: "education.schools.total", year: 2024, value: 2000, basis: "actual", status: "official", sourceIds: ["geostat_education_schools_national"] }],
    breaks: [],
  });
  const adapter = (edit: (build: TopicDatasetBuild) => void): TopicAdapter => ({
    family: "education", sourceArchive: ["education"], build: async () => { const build = base(); edit(build); return [build]; },
  });

  it("packs a valid dataset and resolves its archive source", async () => {
    const { topics, sources } = await buildTopicsSnapshot([adapter(() => {})]);
    expect(topics.datasets.map((dataset) => dataset.page.datasetId)).toEqual(["education-schools"]);
    expect(topics.sourceIds).toEqual(["source.geostat_education_schools_national"]);
    expect(topics.units).toEqual({ institutions: { labelKa: "დაწესებულება", labelEn: "institutions" } });
    expect(sources.map((source) => source.sourceId)).toEqual(["source.geostat_education_schools_national"]);
    expect(sources[0]!.documents.map((document) => document.documentId)).toEqual(["geostat_education_schools_national"]);
    expect(sources[0]!.documents[0]!.officialUrl).toBe("https://www.geostat.ge/media/75485/01_Number-of-General-Education-Schools-and-Pupils-in-them.xlsx");
  });

  it("fails on a source id no archive resolves", async () => {
    await expect(buildTopicsSnapshot([adapter((build) => { build.facts[0]!.sourceIds = ["geostat_education_nothing"]; })])).rejects.toThrow(/source\.geostat_education_nothing is not in the source registry/);
    // Registered, but the adapter's archive does not hold its file.
    await expect(buildTopicsSnapshot([{ ...adapter(() => {}), sourceArchive: ["housing"] }])).rejects.toThrow(/source\.geostat_education_schools_national resolves to no archived document/);
  });

  it("fails on a unit with no name", async () => {
    await expect(buildTopicsSnapshot([adapter((build) => { build.series[0]!.unit = "furlongs"; })])).rejects.toThrow(/furlongs/);
  });

  it("fails on a series with no value", async () => {
    await expect(buildTopicsSnapshot([adapter((build) => { build.facts[0]!.value = null; })])).rejects.toThrow(/education\.schools\.total/);
    await expect(buildTopicsSnapshot([adapter((build) => { build.series.push({ ...build.series[0]!, seriesId: "education.schools.public", isTotal: false }); })])).rejects.toThrow(/education\.schools\.public/);
  });

  it("fails on two facts for one cell", async () => {
    await expect(buildTopicsSnapshot([adapter((build) => { build.facts.push({ ...build.facts[0]!, value: 1 }); })])).rejects.toThrow(/country\.georgia:education\.schools\.total:2024/);
  });

  it("fails on a page two adapters build", async () => {
    await expect(buildTopicsSnapshot([adapter(() => {}), adapter(() => {})])).rejects.toThrow(/education-schools/);
  });
});
