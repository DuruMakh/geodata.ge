import { describe, expect, it } from "vitest";
import { MUNICIPAL_YEARS } from "../../../lib/data/coverage";
import { MIXED_SOURCE_ID } from "../../../lib/data/municipal/aggregateMunicipalFacts";
import {
  assertMunicipalAggregateSourceIds,
  assertMunicipalCountryPanel,
} from "../../../lib/data/municipal/sourceValidation";
import { MUNICIPAL_COUNTRY_ID, type MunicipalFunctionFact, type MunicipalTotalFact } from "../../../lib/data/municipal/types";

const functionFacts: MunicipalFunctionFact[] = MUNICIPAL_YEARS.map((year) => ({
  year,
  municipalityCode: MUNICIPAL_COUNTRY_ID,
  categoryId: "municipal.education",
  functionalCode: "09",
  amountGel: 1,
  basis: "actual",
  sourceId: "source.municipal_official",
}));

const totalFacts: MunicipalTotalFact[] = MUNICIPAL_YEARS.map((year) => ({
  year,
  municipalityCode: MUNICIPAL_COUNTRY_ID,
  publicTotalGel: 1,
  publicTotalMeasure: "total_payments",
  totalPaymentsGel: 1,
  expensesGel: 1,
  nonfinancialAssetGrowthGel: 0,
  financialAssetGrowthGel: 0,
  liabilityDecreaseGel: 0,
  functionalSumGel: 1,
  reconciliationDifferenceGel: 0,
  warningAmountGel: null,
  showWarning: false,
  warningType: "none",
  basis: "actual",
  sourceId: "source.municipal_official",
}));

describe("municipal aggregate source validation", () => {
  const registeredSourceIds = new Set(["source.municipal_official"]);

  it("accepts registered source IDs and the deliberate mixed-source sentinel", () => {
    expect(() =>
      assertMunicipalAggregateSourceIds(
        "Georgia municipal facts",
        ["source.municipal_official", MIXED_SOURCE_ID],
        registeredSourceIds,
      ),
    ).not.toThrow();
  });

  it("rejects every other unknown source ID", () => {
    expect(() =>
      assertMunicipalAggregateSourceIds(
        "Georgia municipal facts",
        ["source.municipal_official", "source.not_registered"],
        registeredSourceIds,
      ),
    ).toThrow("Georgia municipal facts reference unknown source documents: source.not_registered");
  });
});

describe("Georgia municipal panel validation", () => {
  it("accepts one complete country row for every year and category", () => {
    expect(() =>
      assertMunicipalCountryPanel({
        functionFacts,
        totalFacts,
        categoryIds: new Set(["municipal.education"]),
        registeredSourceIds: new Set(["source.municipal_official"]),
      }),
    ).not.toThrow();
  });

  it("rejects an incomplete or duplicated country panel", () => {
    expect(() =>
      assertMunicipalCountryPanel({
        functionFacts: [...functionFacts.slice(1), functionFacts[1]!],
        totalFacts,
        categoryIds: new Set(["municipal.education"]),
        registeredSourceIds: new Set(["source.municipal_official"]),
      }),
    ).toThrow(/Georgia municipal function facts.*missing.*duplicate/);
  });
});
