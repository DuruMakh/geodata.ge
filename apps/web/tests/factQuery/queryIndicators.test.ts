// apps/web/tests/factQuery/queryIndicators.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { schoolYearLabel } from "../../lib/explorer/education";
import type { Observation } from "../../lib/factQuery/observations";
import { indicatorCellCount, queryIndicators } from "../../lib/factQuery/queryIndicators";
import { queryIndicatorsInput } from "../../lib/factQuery/schemas";
import { topicPeriodLabel } from "../../lib/factQuery/topics/store";
import type { TopicDataset, TopicValueStatus } from "../../lib/factQuery/topics/types";
import type { Caveat, Coverage, FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";
import { outputSchemaFor } from "../../lib/mcp/outputSchema";
import { toolResult } from "../../lib/mcp/result";
import { testSnapshot } from "../helpers/factQuerySnapshot";

let snapshot: FactQuerySnapshot;
beforeAll(() => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
});

function observations(response: FactQueryResponse): Observation[] {
  if (response.kind !== "observations") throw new Error(`Expected observations, received ${response.kind}: ${JSON.stringify(response)}`);
  return (response.data as { observations: Observation[] }).observations;
}

function coverage(response: FactQueryResponse): Coverage {
  if (response.kind === "error") throw new Error(response.error.messageEn);
  return (response.data as { coverage: Coverage }).coverage;
}

/** The CSV's published_value for one cell, read independently of the snapshot build. */
function csvValue(indicatorId: string, geographyId: string, year: number): number {
  const csv = readFileSync(path.join(process.cwd(), "..", "..", "data", "imports", "education-annual.csv"), "utf8").replace(/^﻿/, "");
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const columns = header!.split(",");
  const at = (name: string) => columns.indexOf(name);
  const row = rows.map((line) => line.split(",")).find((cells) => cells[at("indicator_id")] === indicatorId && cells[at("geography_id")] === geographyId && cells[at("year")] === String(year));
  if (!row) throw new Error(`No CSV row ${indicatorId} ${geographyId} ${year}`);
  return Number(row[at("published_value")]);
}

describe("queryIndicators", () => {
  it("serves Shuakhevi's pupils for 2015/16 and 2025/26 exactly as the CSV publishes them", () => {
    const response = queryIndicators(snapshot, { datasetId: "education-schools", seriesIds: ["education.pupils.total"], entityIds: ["10"], years: [2015, 2025] });
    const [first, last] = observations(response);
    expect(response.status).toBe("ok");
    expect(first).toMatchObject({
      observationId: "education-schools:10:education.pupils.total:2015:value",
      datasetId: "education-schools", budgetScope: "topic", entityId: "10", entityType: "municipality", entityLabelKa: "შუახევი", entityLabelEn: "Shuakhevi",
      seriesId: "education.pupils.total", level: "total", parentSeriesId: null, year: 2015, periodLabel: "2015/16",
      measure: "value", unit: "persons", value: csvValue("education.pupils.total", "10", 2015), availability: "available", basis: "actual",
      valueDefinitionId: "education-schools:education.pupils.total:persons", sourceIds: ["source.geostat_education_municipal"], documentIds: ["geostat_education_municipal"], caveatIds: [],
    });
    expect(first!.value).toBe(2410);
    expect(last).toMatchObject({ year: 2025, periodLabel: "2025/26", value: csvValue("education.pupils.total", "10", 2025) });
    expect(last!.value).toBe(1137);
    expect(response.meta.sources.map((source) => source.sourceId)).toEqual(["source.geostat_education_municipal"]);
    expect(response.meta.caveats).toEqual([]);
    expect(outputSchemaFor("query_indicators").parse(toolResult(response).structuredContent)).toEqual(response);
  });

  it("prints the school year, not the start year, in the text twin", () => {
    const text = toolResult(queryIndicators(snapshot, { datasetId: "education-schools", seriesIds: ["education.pupils.total"], entityIds: ["10"], years: [2015] })).content[0]!.text;
    expect(text).toContain("\t2015/16\t");
    expect(text).not.toMatch(/\t2015\tvalue\t/);
  });

  it("labels school years like the pages do and leaves calendar years unlabelled", () => {
    const dataset = (id: string) => snapshot.topics.datasets.find((entry) => entry.page.datasetId === id)!;
    for (const year of [1999, 2009, 2015, 2025]) expect(topicPeriodLabel(dataset("education-schools"), year)).toBe(schoolYearLabel(year));
    // The vocational page counts calendar years (educationPeriodLabel("vocational") is String).
    const vocational = observations(queryIndicators(snapshot, { datasetId: "education-vocational", seriesIds: ["education.vet_admitted.total"], years: [2015] }));
    expect(vocational[0]).toMatchObject({ year: 2015, value: csvValue("education.vet_admitted.total", "country.georgia", 2015) });
    expect(vocational[0]).not.toHaveProperty("periodLabel");
  });

  it("defaults to the country entity and to every year of the dataset", () => {
    const response = queryIndicators(snapshot, { datasetId: "education-schools", seriesIds: ["education.schools.total"] });
    const rows = observations(response);
    const dataset = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "education-schools")!;
    expect(new Set(rows.map((row) => row.entityId))).toEqual(new Set(["country.georgia"]));
    expect(coverage(response).requestedYears).toEqual(coverage(response).availableYears);
    expect(coverage(response).requestedYears[0]).toBe(dataset.firstYear);
    expect(coverage(response).requestedYears.at(-1)).toBe(dataset.lastYear);
    expect(indicatorCellCount(snapshot, { datasetId: "education-schools", seriesIds: ["education.schools.total"] })).toBe(rows.length);
  });

  it("takes fromYear and toYear as an inclusive range", () => {
    const rows = observations(queryIndicators(snapshot, { datasetId: "education-schools", seriesIds: ["education.pupils.total"], entityIds: ["10", "06"], fromYear: 2020, toYear: 2022 }));
    expect(rows.map((row) => `${row.entityId}:${row.year}`)).toEqual(["10:2020", "10:2021", "10:2022", "06:2020", "06:2021", "06:2022"]);
    expect(indicatorCellCount(snapshot, { datasetId: "education-schools", seriesIds: ["education.pupils.total"], entityIds: ["10", "06"], fromYear: 2020, toYear: 2022 })).toBe(6);
  });

  it("refuses an out-of-range span by its ends without listing it", () => {
    const input = { datasetId: "education-schools", seriesIds: ["education.pupils.total"], fromYear: 2020, toYear: 1_000_000_000 };
    expect(indicatorCellCount(snapshot, input)).toBe(1_000_000_000 - 2020 + 1);
    const response = queryIndicators(snapshot, input);
    expect(response).toMatchObject({ kind: "error", error: { code: "year_out_of_range" } });
    if (response.kind !== "error") throw new Error("expected an error");
    expect(response.error.messageEn).toContain("1000000000");
  });

  it("refuses a place the page does not list, with the dataset's own entity ids", () => {
    const response = queryIndicators(snapshot, { datasetId: "education-universities", seriesIds: ["education.he_students.total"], entityIds: ["10"], years: [2024] });
    expect(response).toMatchObject({ kind: "error", error: { code: "unknown_entity", validChoices: ["country.georgia"] } });
    if (response.kind !== "error") throw new Error("expected an error");
    expect(response.error.messageEn).toContain("10");
    expect(response.error.messageKa).toMatch(/[Ⴀ-ჿ]/);
  });

  it("serves a missing cell as missing, never zero, with the school year in its reason", () => {
    const response = queryIndicators(snapshot, { datasetId: "education-schools", seriesIds: ["education.teachers.women"], years: [2010, 2016] });
    const [missing, present] = observations(response);
    expect(response.status).toBe("partial");
    expect(missing).toMatchObject({ year: 2010, value: null, availability: "missing", basis: null, sourceIds: [], documentIds: [], caveatIds: [] });
    expect(missing!.missingReasonEn).toContain("2010/11");
    expect(missing!.missingReasonEn).toContain("not mean zero");
    expect(present).toMatchObject({ year: 2016, availability: "available" });
    expect(present!.value).toBeGreaterThan(0);
    expect(coverage(response).missingCells).toEqual([{ entityId: "country.georgia", seriesId: "education.teachers.women", year: 2010, reason: missing!.missingReason, reasonEn: missing!.missingReasonEn }]);
    expect(coverage(response)).toMatchObject({ returnedCount: 1, expectedCount: 2, returnedYears: [2016] });
  });

  it("labels a sub-series with its heading and marks it a series, not a total", () => {
    const [row] = observations(queryIndicators(snapshot, { datasetId: "education-universities", seriesIds: ["education.he_students.level_bachelor"], years: [2024] }));
    expect(row).toMatchObject({ level: "series", parentSeriesId: "education.he_students.total", seriesLabelEn: "Students — Bachelor", seriesLabelKa: "სტუდენტები — ბაკალავრიატი" });
  });

  it.each([
    [{ datasetId: "education-nowhere", seriesIds: ["x"] }, "unknown_dataset"],
    [{ datasetId: "education-schools", seriesIds: ["education.nothing"] }, "unknown_series"],
    [{ datasetId: "education-schools", seriesIds: ["education.pupils.total"], years: [1990] }, "year_out_of_range"],
    [{ datasetId: "education-schools", seriesIds: ["education.pupils.total"], expectedDataVersion: "0".repeat(64) }, "data_version_changed"],
    [{ datasetId: "education-schools", seriesIds: ["education.pupils.total"], fromYear: 2020 }, "invalid_parameters"],
    [{ datasetId: "education-schools", seriesIds: ["education.pupils.total"], years: [2020], fromYear: 2020, toYear: 2021 }, "invalid_parameters"],
  ])("answers %j with %s in both languages", (input, code) => {
    const response = queryIndicators(snapshot, input);
    expect(response).toMatchObject({ kind: "error", status: "error", error: { code, retryable: false } });
    if (response.kind !== "error") throw new Error("expected an error");
    expect(response.error.messageKa).toMatch(/[Ⴀ-ჿ]/);
    expect(response.error.messageEn).toMatch(/[a-z]{4,}/);
    // The pre-count counts nothing it cannot resolve, so the query itself answers with its error.
    if (code === "unknown_dataset" || code === "invalid_parameters") expect(indicatorCellCount(snapshot, input)).toBe(0);
  });

  it("names the topic datasets when the dataset is unknown", () => {
    const response = queryIndicators(snapshot, { datasetId: "education-nowhere", seriesIds: ["x"] });
    if (response.kind !== "error") throw new Error("expected an error");
    expect(response.error.validChoices).toEqual(snapshot.topics.datasets.map((dataset) => dataset.page.datasetId).slice(0, 50));
  });

  it("caps validChoices at 50", () => {
    const response = queryIndicators(snapshot, { datasetId: "education-schools", seriesIds: ["education.pupils.total"], entityIds: ["nowhere"], years: [2024] });
    if (response.kind !== "error") throw new Error("expected an error");
    expect(response.error.code).toBe("unknown_entity");
    expect(response.error.validChoices).toHaveLength(50);
  });

  it("accepts only the declared input fields", () => {
    expect(queryIndicatorsInput.safeParse({ datasetId: "education-schools", seriesIds: ["a"], measure: "value" }).success).toBe(false);
    expect(queryIndicatorsInput.safeParse({ datasetId: "education-schools", seriesIds: [] }).success).toBe(false);
    expect(queryIndicatorsInput.safeParse({ datasetId: "education-schools", seriesIds: ["a", "a"], years: [2021, 2020, 2021] }).data).toEqual({ datasetId: "education-schools", seriesIds: ["a"], years: [2020, 2021] });
  });
});

describe("queryIndicators caveats", () => {
  // The education data are all official actuals, so the status and basis rules are proven on one synthetic dataset:
  // the vocational dataset with its first four facts restated as the other statuses and bases.
  function synthetic(): { snapshot: FactQuerySnapshot; cells: { seriesId: string; year: number }[] } {
    const topics = structuredClone(snapshot.topics);
    const dataset: TopicDataset = topics.datasets.find((entry) => entry.page.datasetId === "education-vocational")!;
    const statuses: TopicValueStatus[] = ["official", "survey_estimate", "derived", "partial"];
    topics.statusCodes = statuses;
    topics.basisCodes = ["actual", "planned", "preliminary", "projection"];
    const rows = dataset.columns.value.map((value, row) => (value === null ? -1 : row)).filter((row) => row >= 0);
    const cell = (row: number) => ({ seriesId: dataset.series[dataset.columns.series[row]!]!.seriesId, year: dataset.columns.year[row]! });
    dataset.columns.status = dataset.columns.status.map(() => 0);
    dataset.columns.basis = dataset.columns.basis.map(() => 0);
    const [survey, derived, partial, planned, preliminary, projection] = rows;
    dataset.columns.status[survey!] = 1;
    dataset.columns.status[derived!] = 2;
    dataset.columns.status[partial!] = 3;
    dataset.columns.monthsReported[partial!] = 6;
    dataset.columns.periodEnd[partial!] = "2014-06-30";
    dataset.columns.basis[planned!] = 1;
    dataset.columns.basis[preliminary!] = 2;
    dataset.columns.basis[projection!] = 3;
    // A missing cell marked partial still carries no status caveat (ruling R8).
    const missing = dataset.columns.value.findIndex((value) => value === null);
    dataset.columns.status[missing] = 3;
    dataset.columns.monthsReported[missing] = 3;
    return { snapshot: { ...snapshot, topics }, cells: [survey!, derived!, partial!, planned!, preliminary!, projection!, missing].map(cell) };
  }

  it("discloses survey estimates, Fiscal.ge derivations, partial years and non-actual bases on exactly their cells", () => {
    const { snapshot: modified, cells } = synthetic();
    const seriesIds = [...new Set(cells.map((cell) => cell.seriesId))];
    const years = [...new Set(cells.map((cell) => cell.year))];
    const response = queryIndicators(modified, { datasetId: "education-vocational", seriesIds, years });
    const rows = observations(response);
    const at = (index: number) => rows.find((row) => row.seriesId === cells[index]!.seriesId && row.year === cells[index]!.year)!;
    const codes = response.meta.caveats.map((caveat: Caveat) => `${caveat.code}:${caveat.severity}`);
    expect(codes).toEqual(["topic_partial_period:severe", "topic_planned:severe", "topic_projection:severe", "topic_derived:note", "topic_preliminary:note", "topic_survey_estimate:note"]);
    expect(at(0).caveatIds).toEqual(["topic_survey_estimate"]);
    expect(at(1).caveatIds).toEqual(["topic_derived"]);
    expect(at(2).caveatIds).toEqual(["topic_partial_period"]);
    expect(at(2).periodEnd).toBe("2014-06-30");
    expect(at(3)).toMatchObject({ basis: "planned", caveatIds: ["topic_planned"] });
    expect(at(4)).toMatchObject({ basis: "preliminary", caveatIds: ["topic_preliminary"] });
    expect(at(5)).toMatchObject({ basis: "projection", caveatIds: ["topic_projection"] });
    expect(at(6)).toMatchObject({ value: null, basis: null, caveatIds: [], sourceIds: [] });
    const caveat = (code: string) => response.meta.caveats.find((entry: Caveat) => entry.code === code)!;
    // The months are the partial row's own: its definition states them, and no other row's definition changes.
    expect(at(2).valueDefinitionEn).toContain("6 months of the year");
    expect(at(2).valueDefinition).toContain("6 თვეს");
    expect(at(2).valueDefinitionId).toBe(`education-vocational:${at(2).seriesId}:${at(2).unit}`);
    expect(at(0).valueDefinitionEn).not.toContain("months");
    expect(at(6).valueDefinitionEn).not.toContain("months");
    expect(caveat("topic_planned").messageEn).toBe("The result contains planned rather than actual values.");
    expect(caveat("topic_survey_estimate").affects).toEqual([`country.georgia:${cells[0]!.seriesId}:${cells[0]!.year}`]);
    for (const code of ["topic_partial_period", "topic_derived"]) expect(caveat(code).affects).toHaveLength(1);
    for (const entry of response.meta.caveats) {
      expect(entry.messageKa).toMatch(/[Ⴀ-ჿ]/);
      expect(entry.messageEn).not.toMatch(/[Ⴀ-ჿ]/);
    }
    expect(outputSchemaFor("query_indicators").parse(toolResult(response).structuredContent)).toEqual(response);
    expect(toolResult(response).content[0]!.text).toContain("2014-06-30");
  });
});
