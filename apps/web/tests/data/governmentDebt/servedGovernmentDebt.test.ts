import { beforeEach, describe, expect, it } from "vitest";
import { resetServedDataCacheForTests } from "../../../lib/data/servedData";
import { loadServedGovernmentDebtData } from "../../../lib/data/governmentDebt/importGovernmentDebtFacts";

beforeEach(() => {
  resetServedDataCacheForTests();
  delete process.env.GEODATA_DATA_SOURCE;
});

describe("served Government Debt facts", () => {
  it("serves the nine approved series at their exact annual coverages", async () => {
    const { facts } = await loadServedGovernmentDebtData();

    expect(facts).toHaveLength(126);
    expect(Object.keys(facts[0]!).sort()).toEqual([
      "family",
      "lastReviewedAt",
      "seriesId",
      "snapshotDate",
      "sourceId",
      "status",
      "value",
      "valueKind",
      "year",
    ]);

    const expectedCoverage = {
      "debt.stock.total": [2013, 2025],
      "debt.stock.domestic": [2013, 2025],
      "debt.stock.external": [2013, 2025],
      "debt.service.total": [2013, 2030],
      "debt.service.principal": [2013, 2030],
      "debt.service.interest": [2013, 2030],
      "debt.rate.total": [2015, 2025],
      "debt.rate.domestic": [2015, 2025],
      "debt.rate.external": [2015, 2025],
    } as const;

    for (const [seriesId, [start, end]] of Object.entries(expectedCoverage)) {
      const years = facts.filter((fact) => fact.seriesId === seriesId).map((fact) => fact.year);
      expect(years, seriesId).toEqual(Array.from({ length: end - start + 1 }, (_, index) => start + index));
    }
  });

  it("preserves documented rate gaps and actual debt-service totals", async () => {
    const { facts } = await loadServedGovernmentDebtData();
    const rateGaps = facts.filter(
      (fact) => fact.family === "rate" && fact.value === null,
    );

    expect(rateGaps.map((fact) => `${fact.seriesId}:${fact.year}`)).toEqual([
      "debt.rate.domestic:2015",
      "debt.rate.external:2015",
      "debt.rate.domestic:2016",
      "debt.rate.external:2016",
      "debt.rate.domestic:2017",
      "debt.rate.external:2017",
      "debt.rate.external:2018",
      "debt.rate.external:2019",
      "debt.rate.external:2020",
      "debt.rate.domestic:2025",
      "debt.rate.external:2025",
    ]);
    expect(rateGaps.every((fact) => fact.status === "not_available")).toBe(true);

    for (let year = 2013; year <= 2025; year += 1) {
      const factFor = (seriesId: string) =>
        facts.find((fact) => fact.seriesId === seriesId && fact.year === year)?.value;
      expect(factFor("debt.service.total"), `service total ${year}`).toBeCloseTo(
        factFor("debt.service.principal")! + factFor("debt.service.interest")!,
        6,
      );
    }

    expect(
      facts.find(
        (fact) => fact.seriesId === "debt.service.total" && fact.year === 2026,
      ),
    ).toMatchObject({
      value: 5_160_829_110.5122,
      status: "projection_existing_portfolio",
      snapshotDate: "2025-12-31",
    });
  });
});

it("cites source-registry ids on every sourced debt fact", async () => {
  const { loadGovernmentDebtFacts } = await import("../../../lib/data/governmentDebt/importGovernmentDebtFacts");
  const facts = await loadGovernmentDebtFacts();
  const sourced = facts.filter((fact) => fact.sourceId !== null);
  expect(sourced.length).toBeGreaterThan(0);
  expect(sourced.every((fact) => fact.sourceId!.startsWith("source.mof_"))).toBe(true);
});
