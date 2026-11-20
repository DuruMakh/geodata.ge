// apps/web/tests/factQuery/topics/store.test.ts
import { describe, expect, it } from "vitest";
import { packTopicFacts, topicCell, topicNumber, unpackTopicFacts } from "../../../lib/factQuery/topics/store";
import type { TopicDataset, TopicDatasetBuild, TopicFact, TopicsSnapshot } from "../../../lib/factQuery/topics/types";

const entities = ["country.georgia", "region.tbilisi", "region.adjara"].map((entityId) => ({ entityId, entityType: entityId.startsWith("country") ? "country" as const : "region" as const, labelKa: entityId, labelEn: entityId, parentEntityId: null }));
const series = ["a", "b"].map((seriesId) => ({ seriesId, labelKa: seriesId, labelEn: seriesId, headingKa: null, headingEn: null, parentSeriesId: null, isTotal: seriesId === "a", unit: "count" }));

const facts: TopicFact[] = [];
for (const e of entities) for (const s of series) for (const year of [2022, 2023, 2024]) {
  facts.push({ entityId: e.entityId, seriesId: s.seriesId, year, value: year * 2, basis: "actual", status: "official", sourceIds: ["src.one"] });
}
facts[1] = { ...facts[1]!, value: null, status: "partial", sourceIds: [] };
facts[4] = { ...facts[4]!, periodEnd: "2023-09-30", monthsReported: 9, basis: "preliminary", status: "derived", sourceIds: ["src.two", "src.one"] };

const build: TopicDatasetBuild = {
  page: { datasetId: "education-schools", pagePath: "/explorer/education/schools", family: "education", periodKind: "school_year" },
  titleKa: "ა", titleEn: "A", series, entities, facts, breaks: [],
};
const sourceIds = ["src.one", "src.two"];
const basisCodes = ["actual", "preliminary"] as const;
const statusCodes = ["official", "survey_estimate", "derived", "partial"] as const;

function fixture() {
  const columns = packTopicFacts(build, new Map(sourceIds.map((id, index) => [id, index])), [...basisCodes], [...statusCodes]);
  const { facts: _facts, ...rest } = build;
  const dataset: TopicDataset = { ...rest, urlKa: "k", urlEn: "e", groupId: "society", searchKa: "k", searchEn: "e", firstYear: 2022, lastYear: 2024, columns };
  const topics: TopicsSnapshot = { datasets: [dataset], sourceIds, basisCodes: [...basisCodes], statusCodes: [...statusCodes], units: {} };
  return { dataset, topics };
}

describe("topic column store", () => {
  it("round-trips facts, including a null value, periodEnd and monthsReported", () => {
    const { dataset, topics } = fixture();
    expect(unpackTopicFacts(dataset, topics)).toEqual(facts);
  });
  it("keeps optional fields sparse", () => {
    const { dataset } = fixture();
    expect(dataset.columns.periodEnd).toEqual({ 4: "2023-09-30" });
    expect(dataset.columns.monthsReported).toEqual({ 4: 9 });
  });
  it("finds a cell and misses cleanly", () => {
    const { dataset, topics } = fixture();
    expect(topicCell(dataset, "region.tbilisi", "b", 2023, topics)).toEqual(facts.find((f) => f.entityId === "region.tbilisi" && f.seriesId === "b" && f.year === 2023));
    expect(topicCell(dataset, "region.adjara", "a", 2024, topics)?.value).toBe(4048);
    expect(topicCell(dataset, "region.tbilisi", "a", 1999, topics)).toBeUndefined();
    expect(topicCell(dataset, "region.nowhere", "a", 2023, topics)).toBeUndefined();
    expect(topicCell(dataset, "region.tbilisi", "zzz", 2023, topics)).toBeUndefined();
  });
  it("serves a number to 12 significant digits: a floating-point sum's noise is gone, a reviewed figure keeps its digits", () => {
    expect(topicNumber(155199297.00000012)).toBe(155199297);
    expect(topicNumber(1.2908329999999992)).toBe(1.290833);
    expect(topicNumber(559.415)).toBe(559.415);
    const noisy = { ...build, facts: [{ ...facts[0]!, value: 2975.246654386985 }, ...facts.slice(1)] };
    expect(packTopicFacts(noisy, new Map(sourceIds.map((id, index) => [id, index])), [...basisCodes], [...statusCodes]).value[0]).toBe(2975.24665439);
  });
});
