import { beforeAll, describe, expect, it } from "vitest";

import {
  prepareGeneralGovernmentBalance,
  validateGeneralGovernmentBalanceManifest,
  validateGeneralGovernmentBalanceSeries,
} from "../../../lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance";
import type { GeneralGovernmentBalancePreparationResult } from "../../../lib/data/generalGovernmentBalance/types";

const REVIEWED_MANIFEST: Record<string, string> = {
  source_id: "source.imf_weo_april_2026_general_government_balance",
  publisher: "International Monetary Fund",
  dataset: "World Economic Outlook",
  dataset_version: "IMF.RES:WEO(9.0.0)",
  publication_date: "2026-04-14",
  source_page_url: "https://data.imf.org/Datasets/WEO",
  retrieved_file_url:
    "https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx",
  retrieved_at: "2026-09-04",
  local_file: "official/WEOApr2026all.xlsx",
  sha256: "B29239CB48F8B895D1E526070C4FDE01147BC8F6BD3B86F636363BB6BD87FE7A",
  bytes: "5585205",
  country_id: "GEO",
  source_sheet: "Countries",
  percent_series_code: "GEO.GGXCNL_NGDP.A",
  nominal_series_code: "GEO.GGXCNL.A",
  validation_gdp_series_code: "GEO.NGDP_FY.A",
  year_min: "1995",
  year_max: "2031",
  latest_actual_year: "2025",
  methodology: "GFSM 2001",
  valuation: "Cash",
  general_government_composition: "Central Government; Local Government",
};

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

  it("accepts the exact reviewed source manifest", () => {
    expect(validateGeneralGovernmentBalanceManifest(REVIEWED_MANIFEST)).toEqual(
      REVIEWED_MANIFEST,
    );
  });

  it("accepts a later WEO manifest with the same extraction contract", () => {
    const later = {
      ...REVIEWED_MANIFEST,
      source_id: "source.imf_weo_october_2026_general_government_balance",
      publication_date: "2026-10-13",
      retrieved_file_url: "https://data.imf.org/files/WEOOct2026all.xlsx",
      retrieved_at: "2026-11-02",
      local_file: "official/WEOOct2026all.xlsx",
      year_max: "2032",
      latest_actual_year: "2026",
    };

    expect(validateGeneralGovernmentBalanceManifest(later)).toEqual(later);
    for (const mismatch of [
      { source_id: "source.imf_weo_april_2026_general_government_balance" },
      { local_file: "official/WEOApr2026all.xlsx" },
      { retrieved_file_url: "https://data.imf.org/files/WEOApr2026all.xlsx" },
    ]) {
      expect(() =>
        validateGeneralGovernmentBalanceManifest({ ...later, ...mismatch }),
      ).toThrow(/edition/i);
    }
  });

  it.each([
    ["publisher", "Another publisher"],
    ["dataset", "Another dataset"],
    ["publication_date", "2026-05-15"],
    ["source_page_url", "https://example.com"],
    ["retrieved_file_url", "https://example.com/WEO.xlsx"],
    ["retrieved_at", "2026/09/03"],
    ["local_file", "official/other.xlsx"],
    ["methodology", "GFSM 2014"],
    ["valuation", "Accrual"],
    ["general_government_composition", "Central Government"],
  ])("rejects a changed reviewed manifest %s field", (field, changedValue) => {
    expect(() =>
      validateGeneralGovernmentBalanceManifest({
        ...REVIEWED_MANIFEST,
        [field]: changedValue,
      }),
    ).toThrow();
  });

  it("rejects an unexpected manifest column", () => {
    expect(() =>
      validateGeneralGovernmentBalanceManifest({
        ...REVIEWED_MANIFEST,
        unexpected: "value",
      }),
    ).toThrow();
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

  it("rejects a canonical percentage that differs from the IMF source fact", () => {
    const changedFacts = result.canonicalFacts.map((row) =>
      row.year === 2020 ? { ...row, generalGovernmentBalancePctGdp: -9.157 } : row,
    );

    expect(() =>
      validateGeneralGovernmentBalanceSeries(result.sourceFacts, changedFacts),
    ).toThrow("Canonical general-government balance percentage does not match IMF source for 2020");
  });

  it("rejects a canonical GEL amount that differs from the IMF source conversion", () => {
    const changedFacts = result.canonicalFacts.map((row) =>
      row.year === 2020 ? { ...row, generalGovernmentBalanceGel: -999_000_000 } : row,
    );

    expect(() =>
      validateGeneralGovernmentBalanceSeries(result.sourceFacts, changedFacts),
    ).toThrow("Canonical general-government balance GEL does not match IMF source for 2020");
  });

  it("fails when the IMF balance series exceed the reconciliation tolerance", () => {
    const changedSourceFacts = result.sourceFacts.map((row) =>
      row.year === 2020 && row.indicatorId === "GGXCNL_NGDP" ? { ...row, value: -1 } : row,
    );
    const changedCanonicalFacts = result.canonicalFacts.map((row) =>
      row.year === 2020 ? { ...row, generalGovernmentBalancePctGdp: -1 } : row,
    );

    expect(() =>
      validateGeneralGovernmentBalanceSeries(changedSourceFacts, changedCanonicalFacts),
    ).toThrow("General-government balance reconciliation exceeds 0.02 percentage points for 2020");
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
