// apps/web/tests/factQuery/topics/hierarchy.test.ts
//
// The reviewed totals and breakdowns (full review R37): a link is applied only where the figures bear it out, and the
// served datasets carry the reviewed links.
import { beforeAll, describe, expect, it } from "vitest";
import { applyTopicHierarchy, TOPIC_HIERARCHY, type TopicHierarchyLink } from "../../../lib/factQuery/topics/hierarchy";
import type { TopicDatasetBuild, TopicFact, TopicSeries } from "../../../lib/factQuery/topics/types";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { testSnapshot } from "../../helpers/factQuerySnapshot";

const series = (seriesId: string, unit = "persons"): TopicSeries => ({ seriesId, labelKa: seriesId, labelEn: seriesId, headingKa: "h", headingEn: "h", parentSeriesId: null, isTotal: false, unit });
const fact = (seriesId: string, year: number, value: number): TopicFact => ({ entityId: "country.georgia", seriesId, year, value, basis: "published", status: "official", sourceIds: [] });
const build = (values: Record<string, number[]>, units: Record<string, string> = {}): TopicDatasetBuild => ({
  page: { datasetId: "test-staff", pagePath: "/explorer/test/staff", family: "science-culture", periodKind: "year" },
  titleKa: "t", titleEn: "t",
  series: Object.keys(values).map((id) => series(id, units[id])),
  entities: [{ entityId: "country.georgia", entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null }],
  facts: Object.entries(values).flatMap(([id, byYear]) => byYear.map((value, index) => fact(id, 2020 + index, value))),
  breaks: [],
});
const link = (overrides: Partial<TopicHierarchyLink> = {}): TopicHierarchyLink => ({ datasetId: "test-staff", parentSeriesId: "total", seriesIds: ["women", "men"], breakdown: "sex", proof: "sum", ...overrides });

describe("reviewed topic hierarchy", () => {
  it("links parts that add up to their total, within the rounding of printed parts", () => {
    const linked = applyTopicHierarchy(build({ total: [10, 20.0001], women: [4, 9], men: [6, 11] }), [link()]);
    expect(linked.series.find((entry) => entry.seriesId === "women")).toMatchObject({ parentSeriesId: "total", breakdown: "sex" });
    expect(linked.series.find((entry) => entry.seriesId === "total")).toMatchObject({ parentSeriesId: null });
    expect(linked.facts).toEqual(build({ total: [10, 20.0001], women: [4, 9], men: [6, 11] }).facts);
  });

  it("stops the build when the figures do not bear a link out", () => {
    expect(() => applyTopicHierarchy(build({ total: [10, 21], women: [4, 9], men: [6, 11] }), [link()])).toThrow(/total is not the sum of women, men at country.georgia 2021/);
    expect(() => applyTopicHierarchy(build({ total: [12], women: [4], men: [6] }), [link({ proof: "between" })])).toThrow(/not the aggregate/);
    expect(() => applyTopicHierarchy(build({ total: [10], women: [4], men: [6] }), [link({ seriesIds: ["women", "nobody"] })])).toThrow(/nobody, which is not served/);
    expect(() => applyTopicHierarchy(build({ total: [10], women: [4], men: [6] }, { men: "percent" }), [link()])).toThrow(/men is not in the unit of total/);
    expect(() => applyTopicHierarchy(build({ total: [10], women: [4], men: [6] }), [link(), link({ breakdown: "again" })])).toThrow(/linked twice/);
  });

  it("checks an average or a rate of the whole lies between its parts", () => {
    expect(applyTopicHierarchy(build({ total: [5], women: [4], men: [6] }), [link({ proof: "between" })]).series[1]).toMatchObject({ parentSeriesId: "total" });
  });

  // Re-review 2, R2-2: a total its parts make up less a series it subtracts (GDP, less imports).
  it("detaches a series the total subtracts, proving the total is its parts less it", () => {
    const gdp = build({ total: [10], c: [8], x: [5], m: [3] });
    const net = link({ seriesIds: ["c", "x"], subtracted: ["m"], breakdown: undefined });
    const linked = applyTopicHierarchy(gdp, [net]);
    expect(linked.series.find((entry) => entry.seriesId === "m")).toMatchObject({ parentSeriesId: null, subtractedFrom: "total" });
    expect(linked.series.find((entry) => entry.seriesId === "c")).toMatchObject({ parentSeriesId: "total" });
    expect(() => applyTopicHierarchy(build({ total: [10], c: [8], x: [5], m: [2] }), [net])).toThrow(/total is not the sum of c, x less m/);
    expect(() => applyTopicHierarchy(gdp, [{ ...net, proof: "between" }])).toThrow(/only a "sum" proof checks/);
  });

  // Re-review 2, R2-1: a breakdown whose parts fall short of the total in some years (vocational students by field).
  it("checks a breakdown with an unstated remainder adds up to no more than its total", () => {
    const short = applyTopicHierarchy(build({ total: [10, 12], women: [4, 5], men: [6, 6] }), [link({ proof: "within" })]);
    expect(short.series.find((entry) => entry.seriesId === "men")).toMatchObject({ parentSeriesId: "total", breakdown: "sex" });
    expect(() => applyTopicHierarchy(build({ total: [10], women: [5], men: [6] }), [link({ proof: "within" })])).toThrow(/total is not the sum or more of women, men/);
  });

  it("links by label only a total and parts proven a sum at another measure", () => {
    const measures = build({ "t.amount": [10], "a.amount": [4], "b.amount": [6], "t.growth": [5], "a.growth": [3], "c.growth": [1] });
    const sum = link({ parentSeriesId: "t.amount", seriesIds: ["a.amount", "b.amount"], breakdown: undefined });
    const label = (seriesIds: string[]) => link({ parentSeriesId: "t.growth", seriesIds, breakdown: undefined, proof: "label" });
    expect(applyTopicHierarchy(measures, [sum, label(["a.growth"])]).series.find((entry) => entry.seriesId === "a.growth")).toMatchObject({ parentSeriesId: "t.growth" });
    expect(() => applyTopicHierarchy(measures, [label(["a.growth"])])).toThrow(/t.growth is linked to a.growth by label only, and no sum link proves/);
    expect(() => applyTopicHierarchy(measures, [sum, label(["c.growth"])])).toThrow(/by label only/);
    // A "between" proof at the other measure is not enough: it does not show the parts make up the total.
    const averages = build({ "t.amount": [5], "a.amount": [4], "b.amount": [6], "t.growth": [5], "a.growth": [3] });
    expect(() => applyTopicHierarchy(averages, [{ ...sum, proof: "between" }, label(["a.growth"])])).toThrow(/by label only/);
  });
});

describe("served topic hierarchy", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
  });

  it("carries every reviewed link into the snapshot", () => {
    for (const entry of TOPIC_HIERARCHY) {
      const dataset = snapshot.topics.datasets.find((candidate) => candidate.page.datasetId === entry.datasetId)!;
      for (const seriesId of entry.seriesIds) {
        expect(dataset.series.find((candidate) => candidate.seriesId === seriesId), `${entry.datasetId} ${seriesId}`).toMatchObject({ parentSeriesId: entry.parentSeriesId, ...(entry.breakdown ? { breakdown: entry.breakdown } : {}) });
      }
    }
  });
});
