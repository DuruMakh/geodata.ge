// apps/web/tests/factQuery/topics/compare.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import type { Observation } from "../../../lib/factQuery/observations";
import { queryIndicators } from "../../../lib/factQuery/queryIndicators";
import { compareInput } from "../../../lib/factQuery/schemas";
import type { TopicDataset, TopicValueStatus } from "../../../lib/factQuery/topics/types";
import type { FactQueryResponse, FactQuerySnapshot } from "../../../lib/factQuery/types";
import { outputSchemaFor } from "../../../lib/mcp/outputSchema";
import { toolResult } from "../../../lib/mcp/result";
import { testSnapshot } from "../../helpers/factQuerySnapshot";

let snapshot: FactQuerySnapshot;
beforeAll(() => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
});

function comparisons(response: FactQueryResponse): Comparison[] {
  if (response.kind !== "comparisons") throw new Error(`Expected comparisons, received ${response.kind}: ${JSON.stringify(response)}`);
  return (response.data as { comparisons: Comparison[] }).comparisons;
}

const topicCompare = (datasetId: string, seriesIds: string[], fromYear: number, toYear: number, extra: object = {}) =>
  compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds, ...extra }, fromYear, toYear, measure: "value" });

describe("compare topic", () => {
  it("compares Georgia's school pupils 2015/16 to 2025/26 from the CSV's published figures", () => {
    // education-annual.csv, country.georgia, education.pupils_national.total: 553.9 in 2015, 644.2 in 2025 (thousand persons).
    const response = topicCompare("education-schools", ["education.pupils_national.total"], 2015, 2025);
    const [pair] = comparisons(response);
    expect(response.status).toBe("ok");
    expect(pair).toMatchObject({
      comparisonId: "education-schools:country.georgia:education.pupils_national.total:2015-2025:value",
      datasetId: "education-schools", entityId: "country.georgia", measure: "value", unit: "persons_thousand", comparability: "comparable", reasons: [], caveatIds: [],
      from: { year: 2015, periodLabel: "2015/16", value: 553.9, basis: "actual" }, to: { year: 2025, periodLabel: "2025/26", value: 644.2 },
    });
    expect(pair!.absoluteChange).toBeCloseTo(644.2 - 553.9, 9);
    expect(pair!.percentageChange).toBeCloseTo(((644.2 - 553.9) / 553.9) * 100, 9);
    expect(pair!.percentagePointChange).toBeNull();
    expect(`${pair!.from.periodLabel} → ${pair!.to.periodLabel}`).toBe("2015/16 → 2025/26");
    expect(toolResult(response).content[0]!.text).toContain("2015/16→2025/26");
    expect(outputSchemaFor("compare").parse(toolResult(response).structuredContent)).toEqual(response);
  });

  it("refuses kindergarten staff 2019/20 to 2020/21: a reviewed break separates them", () => {
    const response = topicCompare("education-kindergartens", ["education.kg_staff.total"], 2019, 2020);
    const [pair] = comparisons(response);
    expect(response.status).toBe("partial");
    expect(pair).toMatchObject({ comparability: "not_comparable", absoluteChange: null, percentageChange: null, percentagePointChange: null, from: { value: 14309, periodLabel: "2019/20" }, to: { value: 16234, periodLabel: "2020/21" } });
    expect(pair!.caveatIds).toContain("topic_series_break");
    expect(pair!.reasonsEn).toHaveLength(1);
    expect(pair!.reasonsEn[0]).toContain("2020-09-01: ");
    expect(pair!.reasonsEn[0]).toContain("no change is computed across this point");
    expect(pair!.reasons[0]).toContain("2020-09-01: ");
    // Either side of the break is comparable again.
    expect(comparisons(topicCompare("education-kindergartens", ["education.kg_staff.total"], 2020, 2025))[0]!.comparability).toBe("comparable");
    expect(comparisons(topicCompare("education-kindergartens", ["education.kg_staff.total"], 2017, 2019))[0]!.comparability).toBe("comparable");
  });

  it("reports unknown ids, out-of-range years and a wrong measure as errors", () => {
    const unknownDataset = topicCompare("education-nowhere", ["x"], 2015, 2025);
    expect(unknownDataset.kind === "error" && unknownDataset.error.code).toBe("unknown_dataset");
    expect(topicCompare("education-kindergartens", ["education.kg_staff.total"], 2010, 2020).kind === "error" && (topicCompare("education-kindergartens", ["education.kg_staff.total"], 2010, 2020) as { error: { code: string } }).error.code).toBe("year_out_of_range");
    const unknownEntity = topicCompare("education-universities", ["education.he_students.total"], 2015, 2025, { entityIds: ["10"] });
    expect(unknownEntity.kind === "error" && unknownEntity.error.code).toBe("unknown_entity");
    expect(compare(snapshot, { target: { dataset: "topic", datasetId: "education-schools", seriesIds: ["education.pupils_national.total"] }, fromYear: 2015, toYear: 2025, measure: "amount_gel" }).kind).toBe("error");
    expect(compareInput.safeParse({ target: { dataset: "national", side: "revenue", seriesIds: ["a"] }, fromYear: 2015, toYear: 2025, measure: "value" }).success).toBe(false);
  });

  // A partial or preliminary endpoint limits the comparison. The education data are all official actuals, so the
  // synthetic case restates one vocational cell as partial.
  it("limits a comparison when an endpoint is partial", () => {
    const topics = structuredClone(snapshot.topics);
    const dataset: TopicDataset = topics.datasets.find((entry) => entry.page.datasetId === "education-vocational")!;
    const statuses: TopicValueStatus[] = ["official", "survey_estimate", "derived", "partial"];
    topics.statusCodes = statuses;
    const rowOf = (seriesId: string, year: number) => dataset.columns.year.findIndex((value, row) => value === year && dataset.series[dataset.columns.series[row]!]!.seriesId === seriesId && dataset.columns.value[row] !== null);
    const series = dataset.series.find((entry) => rowOf(entry.seriesId, 2020) >= 0 && rowOf(entry.seriesId, 2025) >= 0)!;
    dataset.columns.status = dataset.columns.status.map(() => 0);
    const last = rowOf(series.seriesId, 2025);
    dataset.columns.status[last] = 3;
    dataset.columns.monthsReported[last] = 6;
    const response = compare({ ...snapshot, topics }, { target: { dataset: "topic", datasetId: "education-vocational", seriesIds: [series.seriesId] }, fromYear: 2020, toYear: 2025, measure: "value" });
    const [pair] = comparisons(response);
    expect(pair).toMatchObject({ comparability: "limited", caveatIds: ["topic_partial_period"] });
    expect(pair!.absoluteChange).not.toBeNull();
  });

  // Enabled in Task 16 with the money-transfers data: a transfer year with months the source left blank.
  it.todo("a partial money-transfer year endpoint is limited: comparability 'limited', caveatIds contain 'topic_partial_period'");
});

describe("query_indicators series-break caveat", () => {
  const staff = (fromYear: number, toYear: number) =>
    queryIndicators(snapshot, { datasetId: "education-kindergartens", seriesIds: ["education.kg_staff.total"], fromYear, toYear });
  const rows = (response: FactQueryResponse) => (response as { data: { observations: Observation[] } }).data.observations;

  it("marks kindergarten staff observations 2017/18-2025/26 when the request spans the 2020/21 break", () => {
    const response = staff(2017, 2025);
    const available = rows(response).filter((observation) => observation.availability === "available");
    expect(available.length).toBeGreaterThan(0);
    for (const observation of available) expect(observation.caveatIds).toContain("topic_series_break");
    const caveat = response.meta.caveats.find((entry) => entry.code === "topic_series_break")!;
    expect(caveat.severity).toBe("severe");
    expect(caveat.messageEn).toContain("2020-09-01: ");
    expect(caveat.messageKa).toContain("2020-09-01: ");
    expect(caveat.messageEn).toContain("no change is computed across this point");
  });

  it("leaves a request that starts at the break, and other series, unmarked", () => {
    expect(rows(staff(2020, 2025)).every((observation) => !observation.caveatIds.includes("topic_series_break"))).toBe(true);
    const children = queryIndicators(snapshot, { datasetId: "education-kindergartens", seriesIds: ["education.kg_children.total"], fromYear: 2017, toYear: 2025 });
    expect(rows(children).every((observation) => observation.caveatIds.length === 0)).toBe(true);
  });
});
