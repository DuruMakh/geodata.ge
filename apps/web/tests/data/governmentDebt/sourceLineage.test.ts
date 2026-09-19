import { describe, expect, it } from "vitest";
import { registryDebtSourceId, sourcesForDebtFact } from "../../../lib/data/governmentDebt/sourceLineage";
import type { ServedGovernmentDebtFact } from "../../../lib/servedRows";

describe("debt source lineage", () => {
  it("turns bare manifest ids into registry ids and leaves registry ids alone", () => {
    expect(registryDebtSourceId("mof_public_debt_bulletin_n25")).toBe("source.mof_public_debt_bulletin_n25");
    expect(registryDebtSourceId("source.mof_public_debt_bulletin_n25")).toBe("source.mof_public_debt_bulletin_n25");
  });

  it("adds the external-service bulletin to actual service", () => {
    const fact: ServedGovernmentDebtFact = {
      year: 2017, family: "service", seriesId: "debt.service.total", value: 1, valueKind: "amount_gel",
      status: "actual", sourceId: "mof_public_debt_bulletin_n25", snapshotDate: null, lastReviewedAt: "2026-09-01",
    };
    expect(sourcesForDebtFact(fact)).toEqual(["source.mof_public_debt_bulletin_n25", "source.mof_public_debt_bulletin_n13"]);
  });

  it("adds nothing to a projected service year", () => {
    const fact: ServedGovernmentDebtFact = {
      year: 2027, family: "service", seriesId: "debt.service.total", value: 1, valueKind: "amount_gel",
      status: "projection_existing_portfolio", sourceId: "mof_public_debt_bulletin_n25", snapshotDate: "2025-12-31", lastReviewedAt: "2026-09-01",
    };
    expect(sourcesForDebtFact(fact)).toEqual(["source.mof_public_debt_bulletin_n25"]);
  });

  it("cites every reviewed rate source for an unpublished rate", () => {
    const fact: ServedGovernmentDebtFact = {
      year: 2016, family: "rate", seriesId: "debt.rate.domestic", value: null, valueKind: "percent",
      status: "not_available", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01",
    };
    expect(sourcesForDebtFact(fact)).toEqual([
      "source.mof_monthly_debt_report_2026_07",
      "source.mof_debt_strategy_2019_2021",
      "source.mof_debt_strategy_2022_2025",
      "source.mof_debt_strategy_2023_2026",
      "source.mof_debt_strategy_2025_2029",
    ]);
  });
});
