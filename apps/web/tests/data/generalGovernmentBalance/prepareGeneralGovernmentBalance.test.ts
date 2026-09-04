import { beforeAll, describe, expect, it } from "vitest";

import {
  prepareGeneralGovernmentBalance,
  validateGeneralGovernmentBalanceSeries,
} from "../../../lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance";
import type { GeneralGovernmentBalancePreparationResult } from "../../../lib/data/generalGovernmentBalance/types";

describe("prepareGeneralGovernmentBalance", () => {
  let result: GeneralGovernmentBalancePreparationResult;

  beforeAll(async () => {
    result = await prepareGeneralGovernmentBalance({ write: false, checkArtifacts: false });
  }, 30_000);

  it("preserves the reviewed IMF workbook", () => {
    expect(result.validation.sourceBytes).toBe(5_585_205);
    expect(result.validation.sourceSha256).toBe(
      "B29239CB48F8B895D1E526070C4FDE01147BC8F6BD3B86F636363BB6BD87FE7A",
    );
    expect(result.validation.dataset).toBe("IMF.RES:WEO(9.0.0)");
  });

  it("extracts the exact three Georgia series", () => {
    expect(new Set(result.sourceFacts.map((row) => row.indicatorId))).toEqual(
      new Set(["GGXCNL_NGDP", "GGXCNL", "NGDP_FY"]),
    );
    expect(result.sourceFacts).toHaveLength(111);
  });

  it("creates one canonical row for every 1995-2031 year", () => {
    expect(result.canonicalFacts).toHaveLength(37);
    expect(result.canonicalFacts.map((row) => row.year)).toEqual(
      Array.from({ length: 37 }, (_, index) => 1995 + index),
    );
  });

  it("pins representative actual, surplus, crisis, and projection values", () => {
    const byYear = new Map(result.canonicalFacts.map((row) => [row.year, row]));
    expect(byYear.get(1995)).toMatchObject({
      generalGovernmentBalancePctGdp: -4.888,
      generalGovernmentBalanceGel: -123_000_000,
      status: "actual",
    });
    expect(byYear.get(2004)).toMatchObject({
      generalGovernmentBalancePctGdp: 3.592,
      generalGovernmentBalanceGel: 363_000_000,
      status: "actual",
    });
    expect(byYear.get(2020)).toMatchObject({
      generalGovernmentBalancePctGdp: -9.158,
      generalGovernmentBalanceGel: -4_559_000_000,
      status: "actual",
    });
    expect(byYear.get(2025)).toMatchObject({
      generalGovernmentBalancePctGdp: -1.455,
      generalGovernmentBalanceGel: -1_526_000_000,
      status: "actual",
    });
    expect(byYear.get(2026)).toMatchObject({
      generalGovernmentBalancePctGdp: -2.327,
      generalGovernmentBalanceGel: -2_672_000_000,
      status: "projection",
    });
  });

  it("reconciles nominal balance to percent of fiscal-year GDP", () => {
    expect(result.validation.reconciliationTolerancePercentagePoints).toBe(0.02);
    expect(result.validation.maximumReconciliationDifferencePercentagePoints).toBeCloseTo(
      0.0147828843,
      9,
    );
    expect(result.validation.reconciliationFailureYears).toEqual([]);
  });

  it("rejects a coverage gap and a status-boundary change", () => {
    expect(() =>
      validateGeneralGovernmentBalanceSeries(result.sourceFacts, result.canonicalFacts.slice(1)),
    ).toThrow("Canonical general-government balance coverage must be 1995-2031");
    expect(() =>
      validateGeneralGovernmentBalanceSeries(
        result.sourceFacts,
        result.canonicalFacts.map((row) =>
          row.year === 2026 ? { ...row, status: "actual" as const } : row,
        ),
      ),
    ).toThrow("General-government balance status is invalid for 2026");
  });
});
