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
