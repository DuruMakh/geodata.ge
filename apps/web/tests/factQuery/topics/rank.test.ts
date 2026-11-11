// apps/web/tests/factQuery/topics/rank.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { rank, type RankData } from "../../../lib/factQuery/rank";
import { rankInput } from "../../../lib/factQuery/schemas";
import type { FactQueryResponse, FactQuerySnapshot } from "../../../lib/factQuery/types";
import { outputSchemaFor } from "../../../lib/mcp/outputSchema";
import { toolResult } from "../../../lib/mcp/result";
import { testSnapshot } from "../../helpers/factQuerySnapshot";

let snapshot: FactQuerySnapshot;
beforeAll(() => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
});

function ranking(response: FactQueryResponse): RankData {
  if (response.kind !== "ranking") throw new Error(`Expected a ranking, received ${response.kind}: ${JSON.stringify(response)}`);
  return response.data as RankData;
}

const schoolRanking = (extra: object = {}) => rank(snapshot, {
  datasetId: "education-schools", dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total", measure: "value",
  metric: "percentage_change", fromYear: 2015, toYear: 2025, order: "ascending", limit: 5, ...extra,
});
const oneDecimal = (value: number | null) => Math.round(value! * 10) / 10;

describe("rank topic datasets", () => {
  it("ranks municipalities by the change in school pupils 2015/16 to 2025/26", () => {
    const response = schoolRanking();
    const data = ranking(response);
    expect(data.entries.map((entry) => [entry.entityLabelEn, oneDecimal(entry.value)])).toEqual([
      ["Shuakhevi", -52.8], ["Khulo", -47.3], ["Lentekhi", -27.0], ["Tsalka", -22.7], ["Tsageri", -19.6],
    ]);
    expect(data.entries.every((entry) => entry.unit === "percent" && entry.entityLabelKa.length > 0 && entry.seriesId === "education.pupils.total")).toBe(true);
    expect(data.rankingDefinitionEn).toContain("2015/16→2025/26");
    expect(data.rankingDefinition).toContain("2015/16→2025/26");
    expect(data.universe).toMatchObject({ dimension: "entities", returnedCount: 5 });
    expect(data.universe.candidateCount).toBe(63);
    expect(toolResult(response).content[0]!.text).toContain("2015/16→2025/26");
    expect(outputSchemaFor("rank").parse(toolResult(response).structuredContent)).toEqual(response);
  });

  it("ranks by absolute change in the series' own unit", () => {
    const data = ranking(schoolRanking({ metric: "absolute_change", limit: 2 }));
    expect(data.entries.map((entry) => [entry.entityLabelEn, entry.value])).toEqual([["Khulo", -1861], ["Shuakhevi", -1273]]);
    expect(data.entries[0]!.unit).toBe("persons");
  });

  it("ranks one year's values with the school-year label", () => {
    const response = rank(snapshot, { datasetId: "education-schools", dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total", measure: "value", metric: "value", year: 2025, limit: 3 });
    const data = ranking(response);
    expect(data.entries).toHaveLength(3);
    // Tbilisi is a region on this page, not one of its municipalities.
    expect(data.entries[0]!.entityLabelEn).toBe("Batumi");
    expect(data.rankingDefinitionEn).toContain("2025/26");
    expect(data.entries[0]!.value!).toBeGreaterThanOrEqual(data.entries[1]!.value!);
  });

  it("ranks only the municipalities of one region", () => {
    const data = ranking(schoolRanking({ withinRegionId: "region.adjara", limit: 10 }));
    expect(data.universe.candidateCount).toBe(6);
    expect(data.entries).toHaveLength(6);
    expect(data.entries.map((entry) => entry.entityLabelEn).sort()).toEqual(["Batumi", "Keda", "Khelvachauri", "Khulo", "Kobuleti", "Shuakhevi"]);
    expect(data.universe.descriptionEn).toContain("Adjara");
  });

  it("refuses an unknown region with the dataset's regions", () => {
    const response = schoolRanking({ withinRegionId: "region.nowhere" });
    expect(response).toMatchObject({ kind: "error", error: { code: "unknown_entity" } });
    if (response.kind !== "error") throw new Error("unreachable");
    expect(response.error.validChoices).toContain("region.adjara");
  });

  it("ranks regions", () => {
    const data = ranking(rank(snapshot, { datasetId: "education-schools", dimension: "entities", entityType: "region", seriesId: "education.pupils.total", measure: "value", metric: "value", year: 2025 }));
    expect(data.universe.candidateCount).toBe(11);
    expect(data.entries.every((entry) => entry.entityId.startsWith("region."))).toBe(true);
  });

  it("ranks the series under one heading for one place, never the total", () => {
    const data = ranking(rank(snapshot, { datasetId: "education-schools", dimension: "series", seriesId: "education.pupils_national.public", measure: "value", metric: "value", year: 2025 }));
    expect(data.universe).toMatchObject({ dimension: "series" });
    expect(data.entries.every((entry) => entry.entityId === "country.georgia")).toBe(true);
    expect(data.entries.map((entry) => entry.seriesId)).not.toContain("education.pupils_national.total");
    expect(data.entries[0]!.seriesId).toBe("education.pupils_national.public");
    // Other series under the same heading have no value for Georgia in that year and are named, not zeroed.
    const byParent = ranking(rank(snapshot, { datasetId: "education-schools", dimension: "series", parentSeriesId: "education.pupils_national.total", measure: "value", metric: "percentage_change", fromYear: 2015, toYear: 2025 }));
    expect(byParent.entries.map((entry) => entry.seriesId).sort()).toEqual(["education.pupils_national.private", "education.pupils_national.public"]);
  });

  it("excludes places whose series has a reviewed break between the years, with the break's reason", () => {
    // The shipped schools register has no break; give the pupils series one dated inside 2020/21.
    const withBreak: FactQuerySnapshot = { ...snapshot, topics: { ...snapshot.topics, datasets: snapshot.topics.datasets.map((dataset) =>
      dataset.page.datasetId === "education-schools" ? { ...dataset, breaks: [{ breakId: "test_break", seriesIds: ["education.pupils.total"], referenceDate: "2020-09-01", reasonEn: "Counting rules changed." }] } : dataset) } };
    const across = ranking(rank(withBreak, { datasetId: "education-schools", dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total", measure: "value", metric: "percentage_change", fromYear: 2015, toYear: 2025 }));
    expect(across.entries).toEqual([]);
    expect(across.exclusions).toHaveLength(1);
    expect(across.exclusions[0]!.ids).toHaveLength(63);
    expect(across.exclusions[0]!.reasonEn).toContain("2020-09-01: Counting rules changed.");
    expect(across.exclusions[0]!.reasonEn).toContain("no change is computed across this point");
    expect(across.exclusions[0]!.reason).toContain("2020-09-01: ");
    // Years on one side of the break rank as usual.
    expect(ranking(rank(withBreak, { datasetId: "education-schools", dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total", measure: "value", metric: "percentage_change", fromYear: 2020, toYear: 2025 })).entries.length).toBeGreaterThan(0);
  });

  it("finds no peers for a heading that holds only a total", () => {
    const response = rank(snapshot, { datasetId: "education-kindergartens", dimension: "series", seriesId: "education.kg_staff.total", measure: "value", metric: "value", year: 2025 });
    expect(response).toMatchObject({ kind: "error", error: { code: "unknown_series" } });
  });

  it("names a place with a missing endpoint and one starting from zero instead of ranking them", () => {
    // Georgia's pupils figures never gap, so make two municipalities do so: Khulo (11) has no 2015/16 figure, Keda (09) starts from zero.
    const patched: FactQuerySnapshot = { ...snapshot, topics: { ...snapshot.topics, datasets: snapshot.topics.datasets.map((dataset) => {
      if (dataset.page.datasetId !== "education-schools") return dataset;
      const value = [...dataset.columns.value];
      const row = (entityId: string) => dataset.columns.year.findIndex((year, index) => year === 2015
        && dataset.entities[dataset.columns.entity[index]!]!.entityId === entityId && dataset.series[dataset.columns.series[index]!]!.seriesId === "education.pupils.total");
      value[row("11")] = null;
      value[row("09")] = 0;
      return { ...dataset, columns: { ...dataset.columns, value } };
    }) } };
    const request = { datasetId: "education-schools", dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total", measure: "value", metric: "percentage_change", fromYear: 2015, toYear: 2025, limit: 100 };
    const data = ranking(rank(patched, request));
    expect(data.universe).toMatchObject({ candidateCount: 63, eligibleCount: 61 });
    expect(data.entries.map((entry) => entry.entityId)).not.toEqual(expect.arrayContaining(["09"]));
    expect(data.exclusions.flatMap((group) => group.ids).sort()).toEqual(["09", "11"]);
    expect(data.exclusions.find((group) => group.ids.includes("11"))!.reasonEn.length).toBeGreaterThan(0);
    // The zero base blocks only the percentage: its absolute change still ranks.
    const absolute = ranking(rank(patched, { ...request, metric: "absolute_change" }));
    expect(absolute.exclusions.flatMap((group) => group.ids)).toEqual(["11"]);
  });

  it("asks in chunks when a dataset lists more places than one query takes, and joins the answers", () => {
    // 50 copies of Khulo's rows as extra municipalities: 113 places, over the 100-id cap of one query.
    const extra = Array.from({ length: 50 }, (_unused, index) => `copy${String(index).padStart(2, "0")}`);
    const grown: FactQuerySnapshot = { ...snapshot, topics: { ...snapshot.topics, datasets: snapshot.topics.datasets.map((dataset) => {
      if (dataset.page.datasetId !== "education-schools") return dataset;
      const khulo = dataset.entities.findIndex((entity) => entity.entityId === "11");
      const rows = dataset.columns.entity.flatMap((entity, row) => (entity === khulo ? [row] : []));
      const columns = { ...dataset.columns, entity: [...dataset.columns.entity], series: [...dataset.columns.series], year: [...dataset.columns.year], value: [...dataset.columns.value], basis: [...dataset.columns.basis], status: [...dataset.columns.status], sources: [...dataset.columns.sources] };
      extra.forEach((_id, index) => {
        for (const row of rows) {
          columns.entity.push(dataset.entities.length + index);
          for (const key of ["series", "year", "value", "basis", "status", "sources"] as const) columns[key].push(dataset.columns[key][row] as never);
        }
      });
      const entities = [...dataset.entities, ...extra.map((entityId) => ({ ...dataset.entities[khulo]!, entityId }))];
      return { ...dataset, entities, columns };
    }) } };
    const request = { datasetId: "education-schools", dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total", measure: "value", metric: "percentage_change", fromYear: 2015, toYear: 2025, order: "ascending", limit: 100 };
    const data = ranking(rank(grown, request));
    expect(data.universe).toMatchObject({ candidateCount: 113, eligibleCount: 113 });
    expect(data.entries.filter((entry) => entry.entityId.startsWith("copy"))).toHaveLength(50);
    expect(data.entries[0]!.entityLabelEn).toBe("Shuakhevi");
    const values = ranking(rank(grown, { ...request, metric: "value", fromYear: undefined, toYear: undefined, year: 2025 }));
    expect(values.universe.eligibleCount).toBe(113);
  });

  it("states what the request is missing or has wrong", () => {
    const base = { datasetId: "education-schools", measure: "value", metric: "value", year: 2025 };
    expect(rank(snapshot, { ...base, dimension: "entities", seriesId: "education.pupils.total" })).toMatchObject({ kind: "error", error: { code: "invalid_parameters" } });
    expect(rank(snapshot, { ...base, dimension: "series" })).toMatchObject({ kind: "error", error: { code: "invalid_parameters" } });
    expect(rank(snapshot, { ...base, dimension: "series", seriesId: "education.nope" })).toMatchObject({ kind: "error", error: { code: "unknown_series" } });
    expect(rank(snapshot, { ...base, dimension: "entities", entityType: "municipality", seriesId: "education.nope" })).toMatchObject({ kind: "error", error: { code: "unknown_series" } });
    expect(rank(snapshot, { ...base, dimension: "series", seriesId: "education.pupils_national.public", entityId: "nowhere" })).toMatchObject({ kind: "error", error: { code: "unknown_entity" } });
    expect(rank(snapshot, { ...base, year: 1900, dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total" })).toMatchObject({ kind: "error", error: { code: "year_out_of_range" } });
  });

  it("refuses an unknown dataset with the rankable ids", () => {
    const response = rank(snapshot, { datasetId: "education-nothing", dimension: "entities", measure: "value", metric: "value", year: 2025 });
    expect(response).toMatchObject({ kind: "error", error: { code: "invalid_parameters" } });
    if (response.kind !== "error") throw new Error("unreachable");
    expect(response.error.validChoices).toEqual(expect.arrayContaining(["municipal-expenditure", "education-schools"]));
  });

  it("keeps measure value for topic datasets and the other measures for the rest", () => {
    const base = { dimension: "entities", entityType: "municipality", seriesId: "municipal.total", metric: "value", year: 2024 };
    expect(rank(snapshot, { ...base, datasetId: "municipal-expenditure", measure: "value" })).toMatchObject({ kind: "error", error: { code: "invalid_parameters" } });
    expect(rankInput.safeParse({ ...base, datasetId: "education-schools", measure: "amount_gel" }).success).toBe(false);
    expect(rankInput.safeParse({ ...base, datasetId: "education-schools", measure: "value" }).success).toBe(true);
    expect(rankInput.safeParse({ ...base, datasetId: "municipal-expenditure", measure: "amount_gel" }).success).toBe(true);
    // Fields that rank other datasets do not travel to a topic ranking.
    expect(rankInput.safeParse({ ...base, datasetId: "education-schools", measure: "value", level: "division" }).success).toBe(false);
    expect(rankInput.safeParse({ ...base, datasetId: "education-schools", measure: "value", entityId: "x" }).success).toBe(false);
    expect(rankInput.safeParse({ ...base, datasetId: "education-schools", measure: "value", entityType: "region", withinRegionId: "region.adjara" }).success).toBe(false);
  });

  it("serves the same ranking in the same order twice", () => {
    expect(ranking(schoolRanking()).entries).toEqual(ranking(schoolRanking()).entries);
  });

  it("excludes every place with the census re-base reason when ranking the population 2024 to 2025", () => {
    const population = (entityType: string, fromYear: number, toYear: number) => ranking(rank(snapshot, {
      datasetId: "demography-population", dimension: "entities", entityType, seriesId: "demography.population_total", measure: "value", metric: "percentage_change", fromYear, toYear, limit: 100,
    }));
    for (const [entityType, count] of [["municipality", 63], ["region", 11]] as const) {
      const across = population(entityType, 2024, 2025);
      expect(across.entries).toEqual([]);
      expect(across.exclusions).toHaveLength(1);
      expect(across.exclusions[0]!.ids).toHaveLength(count);
      expect(across.exclusions[0]!.reasonEn).toContain("2025-01-01: Geostat recalculated the 1 January 2025 population from the 2024 census");
      expect(across.exclusions[0]!.reason).toContain("2025-01-01: ");
    }
    // Either side of the re-base ranks every place.
    expect(population("municipality", 2015, 2024).entries).toHaveLength(63);
    expect(population("municipality", 2025, 2026).entries).toHaveLength(63);
  });
});

// Final review I1: a series ranking orders like with like - one unit, never a series beside its own parts, and one
// breakdown of a parent (trade partners by country, not the country groups that overlap them).
describe("rank topic series peers", () => {
  const seriesRanking = (datasetId: string, peers: { seriesId?: string; parentSeriesId?: string }, year: number) =>
    ranking(rank(snapshot, { datasetId, dimension: "series", ...peers, measure: "value", metric: "value", year, limit: 100 }));
  const idsOf = (data: RankData) => data.entries.map((entry) => entry.seriesId);

  it("ranks the National counts of unemployment-overview without the rates beside them, and without employed beside its parts", () => {
    const data = seriesRanking("unemployment-overview", { seriesId: "unemployed" }, 2024);
    expect(new Set(data.entries.map((entry) => entry.unit))).toEqual(new Set(["thousand_persons"]));
    expect(idsOf(data)).toEqual(expect.arrayContaining(["unemployed", "self_employed", "hired", "labour_force"]));
    expect(idsOf(data)).not.toContain("participation_rate");
    expect(idsOf(data)).not.toContain("employed");
    // The rate ranks among the rates of its heading (the unemployment rate is the heading's total).
    expect(idsOf(seriesRanking("unemployment-overview", { seriesId: "participation_rate" }, 2024))).toEqual(["participation_rate"]);
  });

  it("ranks farming output in tonnes apart from litres and pieces, and farm-gate prices per kg apart from per litre", () => {
    const meat = seriesRanking("energy-food-farming", { seriesId: "farming.products.beef" }, 2023);
    expect(new Set(meat.entries.map((entry) => entry.unit))).toEqual(new Set(["thousand_tonnes"]));
    expect(idsOf(meat)).not.toContain("farming.products.milk");
    expect(idsOf(meat)).not.toContain("farming.products.eggs");
    const prices = seriesRanking("energy-food-farming", { seriesId: "farming.price.wheat" }, 2023);
    expect(new Set(prices.entries.map((entry) => entry.unit))).toEqual(new Set(["gel_per_kg"]));
  });

  it("ranks GDP by expenditure amounts in GEL apart from the shares of GDP", () => {
    const data = seriesRanking("economy-expenditure", { seriesId: "gdp_use.households.nominal" }, 2024);
    expect(data.entries.length).toBeGreaterThan(1);
    expect(new Set(data.entries.map((entry) => entry.unit))).toEqual(new Set(["gel"]));
    expect(idsOf(data).every((id) => id.endsWith(".nominal"))).toBe(true);
  });

  it("ranks the VAT breaks without the VAT total, and the group totals together by their parent", () => {
    const vat = seriesRanking("tax-breaks-refunds", { seriesId: "tax_breaks.vat.education" }, 2024);
    expect(idsOf(vat)).not.toContain("tax_breaks.vat.total");
    expect(idsOf(vat)).toHaveLength(8);
    expect(idsOf(vat).every((id) => id.startsWith("tax_breaks.vat."))).toBe(true);
    expect(idsOf(seriesRanking("tax-breaks-refunds", { parentSeriesId: "tax_breaks.total" }, 2024))).toEqual(["tax_breaks.vat.total", "tax_breaks.income.total"]);
  });

  it("ranks trade partners by country without the country groups, and the groups by themselves", () => {
    const countries = seriesRanking("trade-partners", { parentSeriesId: "trade.exports" }, 2024);
    expect(countries.universe.candidateCount).toBe(187);
    expect(idsOf(countries).some((id) => id.includes(".group."))).toBe(false);
    const groups = seriesRanking("trade-partners", { parentSeriesId: "trade.exports", seriesId: "trade.exports.group.eu" }, 2024);
    expect(idsOf(groups).sort()).toEqual(["trade.exports.group.bsec", "trade.exports.group.cis", "trade.exports.group.eu", "trade.exports.group.guam", "trade.exports.group.oecd"]);
    expect(idsOf(seriesRanking("trade-partners", { seriesId: "trade.exports.group.eu" }, 2024))).toEqual(idsOf(groups));
  });

  // Re-review NEW-I1: one heading, one unit, but several measures, each under its own parent.
  it("ranks a series among its own parent's children: shares of GDP without real growth, active firms without new or closed ones, one poverty line", () => {
    const shares = seriesRanking("economy-expenditure", { seriesId: "gdp_use.imports.share_of_gdp" }, 2024);
    expect(shares.entries.length).toBeGreaterThan(1);
    expect(idsOf(shares).every((id) => id.endsWith(".share_of_gdp"))).toBe(true);
    const firms = seriesRanking("business-firms", { seriesId: "business.active.sector_c" }, 2023);
    expect(firms.entries.length).toBeGreaterThan(1);
    expect(idsOf(firms).every((id) => id.startsWith("business.active.sector_"))).toBe(true);
    const poverty = seriesRanking("living-standards-poverty", { seriesId: "poverty.relative_60.settlement.urban" }, 2024);
    expect(idsOf(poverty).sort()).toEqual(["poverty.relative_60.settlement.rural", "poverty.relative_60.settlement.urban"]);
  });

  it("says a series under no heading has no peers to rank (money-interest-rates)", () => {
    const response = rank(snapshot, { datasetId: "money-interest-rates", dimension: "series", seriesId: "rates.policy", measure: "value", metric: "value", year: 2024 });
    expect(response).toMatchObject({ kind: "error", error: { code: "invalid_parameters" } });
    if (response.kind !== "error") throw new Error("unreachable");
    expect(response.error.messageEn).toContain("rates.policy is listed under no heading");
    expect(response.error.messageKa).toContain("rates.policy");
  });
});
