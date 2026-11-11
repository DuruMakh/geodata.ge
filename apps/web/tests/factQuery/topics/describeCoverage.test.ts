// apps/web/tests/factQuery/topics/describeCoverage.test.ts
//
// describe_coverage over the topic datasets: the education family (the only one built so far) and the generic
// behaviour every later family relies on, tested on a synthetic large dataset so it does not wait for trade data.
import { beforeAll, describe, expect, it } from "vitest";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { describeCoverage } from "../../../lib/factQuery/describeCoverage";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import type { TopicDataset } from "../../../lib/factQuery/topics/types";
import { LIMITS, boundedToolResult } from "../../../lib/mcp/result";
import { outputSchemaFor } from "../../../lib/mcp/outputSchema";

type Data = {
  datasets: { datasetId: string; labelKa: string; labelEn: string; years: [number, number]; entityTypes: string[]; periodKind?: string; pageUrlKa?: string; pageUrlEn?: string; seriesCount?: number; entityCount?: number }[];
  series?: { seriesId: string; labelEn?: string; datasetId?: string; headingKa?: string; headingEn?: string; unit?: string; years: number[]; level: string }[];
  entities?: { entityId: string; entityType: string; datasetId?: string }[];
  breaks?: { breakId: string; seriesIds: string[]; referenceDate: string; reasonEn: string }[];
  bulkUrl?: string;
  headings?: { headingKa: string | null; headingEn: string | null; seriesCount: number }[];
  seriesOmitted?: number;
  seriesOmittedNoteKa?: string;
  seriesOmittedNoteEn?: string;
  websitePages?: { topicId: string; urlKa: string }[];
};
const dataOf = (snapshot: FactQuerySnapshot, input: Record<string, unknown>) => (describeCoverage(snapshot, input) as unknown as { data: Data }).data;

let snapshot: FactQuerySnapshot;
beforeAll(() => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

describe("describe_coverage lists the topic datasets", () => {
  it("lists each topic dataset with its pages, years, period kind and counts", () => {
    const listed = dataOf(snapshot, {}).datasets;
    for (const topic of snapshot.topics.datasets) {
      expect(listed.find((entry) => entry.datasetId === topic.page.datasetId)).toEqual(expect.objectContaining({
        labelKa: topic.titleKa, labelEn: topic.titleEn, years: [topic.firstYear, topic.lastYear], periodKind: topic.page.periodKind,
        pageUrlKa: topic.urlKa, pageUrlEn: topic.urlEn, seriesCount: topic.series.length, entityCount: topic.entities.length,
      }));
    }
    expect(listed.find((entry) => entry.datasetId === "education-schools")?.periodKind).toBe("school_year");
  });

  it("keeps the no-argument catalogue within the result limit", () => {
    const response = describeCoverage(snapshot, {});
    const bounded = boundedToolResult(snapshot, response);
    expect(bounded.isError).toBe(false);
    expect(Buffer.byteLength(JSON.stringify(response), "utf8")).toBeLessThan(LIMITS.resultBytes);
  });

  it("describes one topic dataset: series with headings and units, entities, breaks and the CSV link", () => {
    const found = dataOf(snapshot, { datasetId: "education-kindergartens" });
    expect(found.datasets.map((entry) => entry.datasetId)).toEqual(["education-kindergartens"]);
    const staff = found.series?.find((entry) => entry.seriesId === "education.kg_staff.total");
    expect(staff).toEqual(expect.objectContaining({ headingKa: "პერსონალი", headingEn: "Staff", unit: "persons", level: "total" }));
    expect(staff?.years).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(found.entities?.map((entity) => entity.entityId)).toEqual(expect.arrayContaining(["country.georgia", "region.tbilisi"]));
    expect(found.breaks).toEqual([expect.objectContaining({ breakId: "kindergarten_staff_2020", seriesIds: ["education.kg_staff.total"], referenceDate: "2020-09-01", reasonEn: expect.stringContaining("2020/21") })]);
    expect(found.bulkUrl).toBe("https://fiscal.ge/downloads/data/topics/education-kindergartens.csv");
    expect(found).not.toHaveProperty("seriesOmitted");
    expect(outputSchemaFor("describe_coverage").safeParse(describeCoverage(snapshot, { datasetId: "education-kindergartens" })).success).toBe(true);
  });

  it("lists a series only in the years it has a value", () => {
    const schools = snapshot.topics.datasets.find((dataset) => dataset.page.datasetId === "education-schools")!;
    const total = dataOf(snapshot, { datasetId: "education-schools" }).series?.find((entry) => entry.seriesId === "education.pupils.total");
    expect(total?.years[0]).toBeGreaterThanOrEqual(schools.firstYear);
    expect(total?.years.at(-1)).toBeLessThanOrEqual(schools.lastYear);
  });

  it("rejects an unknown dataset id and names the topic datasets among the valid choices", () => {
    const result = describeCoverage(snapshot, { datasetId: "not-a-dataset" }) as unknown as { error: { code: string; messageKa: string; messageEn: string; validChoices: string[] } };
    expect(result.error.code).toBe("invalid_parameters");
    expect(result.error.messageKa).toContain("not-a-dataset");
    expect(result.error.messageEn).toContain("not-a-dataset");
    expect(result.error.validChoices).toEqual(expect.arrayContaining(["national-revenue", "education-schools"]));
  });
});

describe("search finds topic datasets, series, headings and places in both languages", () => {
  it.each(["სკოლა", "schools"])("answers %s with education-schools first, holding education.pupils.total", (search) => {
    const found = dataOf(snapshot, { search });
    expect(found.datasets[0]?.datasetId).toBe("education-schools");
    expect(found.series?.[0]?.datasetId).toBe("education-schools");
    expect(found.series?.filter((entry) => entry.datasetId === "education-schools").map((entry) => entry.seriesId)).toContain("education.pupils.total");
  });

  it("matches a series heading", () => {
    const found = dataOf(snapshot, { datasetId: "education-schools", search: "teachers" });
    expect(found.series?.length).toBeGreaterThan(0);
    for (const entry of found.series ?? []) expect(entry.headingEn).toBe("Teachers");
  });

  it("still finds Batumi through the Georgian genitive", () => {
    const entities = dataOf(snapshot, { search: "ბათუმის" }).entities ?? [];
    expect(entities.map((entity) => `${entity.datasetId}|${entity.entityId}`)).toEqual(expect.arrayContaining(["municipal-expenditure|06", "inflation|city.batumi", "education-schools|06"]));
  });

  it("finds a municipality in each topic dataset that lists it", () => {
    const entities = dataOf(snapshot, { search: "Shuakhevi" }).entities ?? [];
    const datasets = entities.map((entity) => entity.datasetId);
    expect(datasets).toEqual(expect.arrayContaining(["education-schools", "education-kindergartens"]));
  });

  it("finds Shuakhevi in the Population dataset, in both languages", () => {
    for (const search of ["Shuakhevi", "შუახევი"]) {
      const found = dataOf(snapshot, { search });
      expect(found.datasets.map((dataset) => dataset.datasetId)).toContain("demography-population");
      expect(found.entities).toEqual(expect.arrayContaining([expect.objectContaining({ datasetId: "demography-population", entityId: "10", entityType: "municipality" })]));
    }
  });

  it("finds the Pensions dataset first when searching pension, in both languages", () => {
    for (const search of ["პენსია", "პენსიები", "pensions", "pension"]) {
      const found = dataOf(snapshot, { search });
      expect(found.datasets[0]?.datasetId, search).toBe("health-pensions");
      expect(found.datasets.map((dataset) => dataset.datasetId), search).toContain("health-funded-pension");
    }
  });

  it("links no website page for a topic it serves, and keeps links for pages it does not", () => {
    const served = new Set(snapshot.topics.datasets.map((dataset) => dataset.urlKa));
    for (const search of ["schools", "სკოლა", "kindergartens", "education", "უმუშევრობა", "wages", "housing."]) {
      for (const page of dataOf(snapshot, { search }).websitePages ?? []) expect(served.has(page.urlKa), `${search}: ${page.urlKa}`).toBe(false);
    }
    expect((dataOf(snapshot, { search: "housing." }).websitePages ?? []).map((page) => page.topicId)).toContain("housing");
    expect(dataOf(snapshot, { search: "zzzznotathing" })).not.toHaveProperty("websitePages");
  });
});

describe("a series list over the limit returns its totals, its headings and how many series it left out", () => {
  let large: FactQuerySnapshot;
  const SERIES = 400;

  beforeAll(() => {
    const base = snapshot.topics.datasets[0]!;
    const series: TopicDataset["series"] = [
      { seriesId: "synthetic.total", labelKa: "ყველა", labelEn: "All items", headingKa: "ყველა", headingEn: "All", parentSeriesId: null, isTotal: true, unit: base.series[0]!.unit },
      ...Array.from({ length: SERIES - 1 }, (_, index) => ({
        seriesId: `synthetic.item_${index}`,
        labelKa: `პროდუქტი ${index}`,
        labelEn: index === 123 ? "Wine" : `Product ${index}`,
        headingKa: index < 200 ? "ჯგუფი ა" : "ჯგუფი ბ",
        headingEn: index < 200 ? "Group A" : "Group B",
        parentSeriesId: null,
        isTotal: false,
        unit: base.series[0]!.unit,
      })),
    ];
    const dataset: TopicDataset = {
      ...base,
      page: { ...base.page, datasetId: "synthetic-large" },
      titleKa: "ხელოვნური ნაკრები",
      titleEn: "Synthetic large dataset",
      series,
      entities: base.entities.slice(0, 1),
      breaks: [],
      firstYear: 2020,
      lastYear: 2020,
      columns: {
        entity: series.map(() => 0), series: series.map((_, index) => index), year: series.map(() => 2020), value: series.map((_, index) => index),
        basis: series.map(() => 0), status: series.map(() => 0), sources: series.map(() => []), periodEnd: {}, monthsReported: {},
      },
    };
    large = { ...snapshot, topics: { ...snapshot.topics, datasets: [dataset] } };
  });

  it("returns only the totals with the headings, the omitted count and the instruction to narrow with search", () => {
    const response = describeCoverage(large, { datasetId: "synthetic-large" });
    const found = (response as unknown as { data: Data }).data;
    expect(found.series?.map((entry) => entry.seriesId)).toEqual(["synthetic.total"]);
    expect(found.seriesOmitted).toBe(SERIES - 1);
    expect(found.headings).toEqual([
      { headingKa: "ყველა", headingEn: "All", seriesCount: 1 },
      { headingKa: "ჯგუფი ა", headingEn: "Group A", seriesCount: 200 },
      { headingKa: "ჯგუფი ბ", headingEn: "Group B", seriesCount: 199 },
    ]);
    expect(found.seriesOmittedNoteEn).toContain("search");
    expect(found.seriesOmittedNoteEn).toContain(String(SERIES - 1));
    expect(found.seriesOmittedNoteKa).toContain("search");
    expect(found.bulkUrl).toBe("https://fiscal.ge/downloads/data/topics/synthetic-large.csv");
    expect(boundedToolResult(large, response).isError).toBe(false);
    expect(outputSchemaFor("describe_coverage").safeParse(response).success).toBe(true);
  });

  it("returns the narrowed list in full once a search brings it under the limit", () => {
    const found = dataOf(large, { datasetId: "synthetic-large", search: "wine" });
    expect(found.series?.map((entry) => entry.labelEn)).toEqual(["Wine"]);
    expect(found).not.toHaveProperty("seriesOmitted");
    expect(found).not.toHaveProperty("headings");
  });

  it("truncates a search that is still too broad", () => {
    const found = dataOf(large, { datasetId: "synthetic-large", search: "product" });
    // Everything but the total and the one product named Wine.
    expect(found.seriesOmitted).toBe(SERIES - 2);
    expect(found.series).toEqual([]);
    expect(found.headings?.map((heading) => heading.seriesCount)).toEqual([199, 199]);
  });

  it("does not truncate a list at the limit", () => {
    const found = dataOf(large, { datasetId: "synthetic-large", search: "group a" });
    expect(found.series).toHaveLength(200);
    expect(found).not.toHaveProperty("seriesOmitted");
  });
});
