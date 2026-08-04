import { describe, expect, it } from "vitest";
import type { MunicipalFunction, MunicipalFunctionFact, MunicipalTotalFact } from "../../lib/data/municipal/types";
import type { SourceDocumentRow } from "../../lib/data/sources";
import {
  aggregateFactsForEntity,
  buildMunicipalEntityModel,
  getDefaultMunicipalSelection,
  MIXED_PUBLIC_TOTAL_MEASURE,
  MIXED_SOURCE_ID,
} from "../../lib/explorer/municipalData";

const FUNCTIONS: MunicipalFunction[] = [
  { id: "municipal.economic_affairs", kaLabel: "ეკონომიკური საქმიანობა", functionalCode: "7.4", sortOrder: 4 },
  { id: "municipal.education", kaLabel: "განათლება", functionalCode: "7.9", sortOrder: 9 },
  { id: "municipal.health", kaLabel: "ჯანმრთელობის დაცვა", functionalCode: "7.7", sortOrder: 7 },
];

const SOURCES: SourceDocumentRow[] = [
  {
    sourceId: "source.municipal_portal_archive",
    sourceName: "ადგილობრივი ბიუჯეტების შესრულება",
    sourceUrlOrFile: "mof.ge",
    lastReviewedAt: "2026-08-01",
  },
];

function fact(year: number, categoryId: string, amountGel: number): MunicipalFunctionFact {
  const found = FUNCTIONS.find((f) => f.id === categoryId)!;
  return {
    year,
    municipalityCode: "04",
    categoryId,
    functionalCode: found.functionalCode,
    amountGel,
    basis: "actual",
    sourceId: "source.municipal_portal_archive",
  };
}

function total(year: number, publicTotalGel: number, functionalSumGel: number, showWarning = false): MunicipalTotalFact {
  return {
    year,
    municipalityCode: "04",
    publicTotalGel,
    publicTotalMeasure: "total_payments",
    totalPaymentsGel: publicTotalGel,
    expensesGel: null,
    nonfinancialAssetGrowthGel: null,
    financialAssetGrowthGel: null,
    liabilityDecreaseGel: null,
    functionalSumGel,
    reconciliationDifferenceGel: publicTotalGel - functionalSumGel,
    warningAmountGel: showWarning ? publicTotalGel - functionalSumGel : null,
    showWarning,
    warningType: showWarning ? "source_version_difference" : "none",
    basis: "actual",
    sourceId: "source.municipal_portal_archive",
  };
}

const FUNCTION_FACTS: MunicipalFunctionFact[] = [
  fact(2015, "municipal.economic_affairs", 100), fact(2015, "municipal.education", 50), fact(2015, "municipal.health", 10),
  fact(2016, "municipal.economic_affairs", 200), fact(2016, "municipal.education", 60), fact(2016, "municipal.health", 5),
  fact(2017, "municipal.economic_affairs", 300), fact(2017, "municipal.education", 70), fact(2017, "municipal.health", 0),
];

const TOTAL_FACTS: MunicipalTotalFact[] = [
  total(2015, 160, 160),
  total(2016, 300, 265, true),
  total(2017, 370, 370),
];

function build(startYear = 2015, endYear = 2017) {
  return buildMunicipalEntityModel({
    functions: FUNCTIONS,
    functionFacts: FUNCTION_FACTS,
    totalFacts: TOTAL_FACTS,
    sourceDocuments: SOURCES,
    startYear,
    endYear,
  });
}

describe("buildMunicipalEntityModel", () => {
  it("emits one row per function, in taxonomy sort order", () => {
    expect(build().rows.map((row) => row.itemId)).toEqual([
      "municipal.economic_affairs",
      "municipal.health",
      "municipal.education",
    ]);
  });

  it("makes the total row the FUNCTIONAL sum, not the official headline", () => {
    // 2016 is the divergent year: official 300, functional 265.
    expect(build().totalRow.valuesByYear[2016]).toBe(265);
  });

  it("keeps the official headline as a separate measure", () => {
    expect(build().officialTotalByYear[2016]).toBe(300);
  });

  it("never conflates the two totals", () => {
    const model = build();
    expect(model.totalRow.valuesByYear[2016]).not.toBe(model.officialTotalByYear[2016]);
  });

  it("makes the ten functions sum to the functional total in every year", () => {
    const model = build();
    for (const year of model.years) {
      const summed = model.rows.reduce((sum, row) => sum + (row.valuesByYear[year] ?? 0), 0);
      expect(summed).toBeCloseTo(model.totalRow.valuesByYear[year]!, 6);
    }
  });

  it("clips to the selected range", () => {
    expect(build(2016, 2017).years).toEqual([2016, 2017]);
  });

  it("scopes change and share to the selected range, not the full span", () => {
    // The bug this guards: rendering a model built for the whole span next to
    // range-filtered year columns, so ცვლილება describes a period the reader
    // is not looking at. economic_affairs: 100→300 full span, 200→300 clipped.
    const economicFull = build().rows.find((row) => row.itemId === "municipal.economic_affairs")!;
    const economicClipped = build(2016, 2017).rows.find((row) => row.itemId === "municipal.economic_affairs")!;
    expect(economicFull.change).toBeCloseTo(2, 6);
    expect(economicClipped.change).toBeCloseTo(0.5, 6);
    expect(build(2015, 2016).totalRow.change).not.toBe(build().totalRow.change);
  });

  it("reports warnings only for years inside the range", () => {
    expect(build().warnings.map((w) => w.year)).toEqual([2016]);
    expect(build(2017, 2017).warnings).toEqual([]);
  });

  it("carries the warning amount and type", () => {
    expect(build().warnings[0]).toEqual({ year: 2016, type: "source_version_difference", amountGel: 35 });
  });

  it("treats a zero function as a real zero, not a gap", () => {
    // municipal.defence collapses to 0 in the served data; the chart must draw
    // the line to zero rather than breaking it.
    const health = build().rows.find((row) => row.itemId === "municipal.health")!;
    expect(health.valuesByYear[2017]).toBe(0);
  });

  it("gives every row its stable colour token", () => {
    const economic = build().rows.find((row) => row.itemId === "municipal.economic_affairs")!;
    expect(economic.color).toBe("#C26E4C");
  });
});

describe("getDefaultMunicipalSelection", () => {
  it("takes the top five by latest-year value", () => {
    expect(getDefaultMunicipalSelection(build())).toEqual([
      "municipal.economic_affairs",
      "municipal.education",
      "municipal.health",
    ]);
  });

  it("never includes a derived total", () => {
    expect(getDefaultMunicipalSelection(build())).not.toContain(build().totalRow.itemId);
  });
});

describe("buildMunicipalEntityModel total row source attribution", () => {
  // Real served data proves source_id genuinely varies by year within one
  // municipality (e.g. municipality 04: 2015 is the portal archive, 2016-2025
  // are MoF workbooks). A total row that reads its source from a single fact
  // — first-in-array, or otherwise not keyed by year — silently mislabels the
  // source for every other year.
  const MULTI_SOURCE_DOCS: SourceDocumentRow[] = [
    ...SOURCES,
    {
      sourceId: "source.municipal_mof_annual_and_history_workbooks",
      sourceName: "წლიური და საარქივო პუბლიკაციები",
      sourceUrlOrFile: "mof.gov.ge",
      lastReviewedAt: "2026-08-01",
    },
  ];

  const MULTI_SOURCE_TOTAL_FACTS: MunicipalTotalFact[] = [
    total(2015, 160, 160),
    { ...total(2016, 300, 265, true), sourceId: "source.municipal_mof_annual_and_history_workbooks" },
    { ...total(2017, 370, 370), sourceId: "source.municipal_mof_annual_and_history_workbooks" },
  ];

  it("looks up the total row's source per year, not from a single fact for the whole range", () => {
    const model = buildMunicipalEntityModel({
      functions: FUNCTIONS,
      functionFacts: FUNCTION_FACTS,
      totalFacts: MULTI_SOURCE_TOTAL_FACTS,
      sourceDocuments: MULTI_SOURCE_DOCS,
      startYear: 2015,
      endYear: 2017,
    });

    expect(model.totalRow.sourceByYear[2015].sourceName).toBe("ადგილობრივი ბიუჯეტების შესრულება");
    expect(model.totalRow.sourceByYear[2017].sourceName).toBe("წლიური და საარქივო პუბლიკაციები");
  });
});

describe("aggregateFactsForEntity", () => {
  it("sums both totals independently across municipalities, never conflating them", () => {
    // Two municipalities, each with its own public/functional divergence, rolled
    // into one region. If the aggregator ever reconciled one total against the
    // other instead of summing each independently, 250 and 240 would collapse
    // to the same number.
    const functionFacts: MunicipalFunctionFact[] = [
      fact(2015, "municipal.economic_affairs", 100),
      {
        year: 2015,
        municipalityCode: "06",
        categoryId: "municipal.economic_affairs",
        functionalCode: "7.4",
        amountGel: 50,
        basis: "actual",
        sourceId: "source.municipal_portal_archive",
      },
    ];
    const totalFacts: MunicipalTotalFact[] = [
      total(2015, 160, 160),
      {
        year: 2015,
        municipalityCode: "06",
        publicTotalGel: 90,
        publicTotalMeasure: "total_payments",
        totalPaymentsGel: 90,
        expensesGel: null,
        nonfinancialAssetGrowthGel: null,
        financialAssetGrowthGel: null,
        liabilityDecreaseGel: null,
        functionalSumGel: 80,
        reconciliationDifferenceGel: 10,
        warningAmountGel: 10,
        showWarning: true,
        warningType: "source_version_difference",
        basis: "actual",
        sourceId: "source.municipal_portal_archive",
      },
    ];

    const aggregated = aggregateFactsForEntity("region.test", functionFacts, totalFacts);

    expect(aggregated.functionFacts).toEqual([
      {
        year: 2015,
        municipalityCode: "region.test",
        categoryId: "municipal.economic_affairs",
        functionalCode: "7.4",
        amountGel: 150,
        basis: "actual",
        sourceId: "source.municipal_portal_archive",
      },
    ]);

    expect(aggregated.totalFacts).toHaveLength(1);
    const regionTotal = aggregated.totalFacts[0]!;
    expect(regionTotal.publicTotalGel).toBe(250);
    expect(regionTotal.functionalSumGel).toBe(240);
    expect(regionTotal.publicTotalGel).not.toBe(regionTotal.functionalSumGel);
  });

  it("suppresses the per-municipality warning on the rolled-up total", () => {
    // A region's own two totals reconcile by construction (each is an
    // independent sum), so it must not inherit a source municipality's warning.
    const totalFacts: MunicipalTotalFact[] = [total(2015, 160, 160), total(2016, 300, 265, true)];

    const aggregated = aggregateFactsForEntity("region.test", [], totalFacts);

    for (const row of aggregated.totalFacts) {
      expect(row.showWarning).toBe(false);
      expect(row.warningType).toBe("none");
      expect(row.warningAmountGel).toBeNull();
    }
  });
});

describe("aggregateFactsForEntity — fields that must not present one constituent's value as the group's", () => {
  // region.adjara's real 2024 rows (data/imports/municipal-total-facts-2015-2025.csv):
  // Batumi (06) reports on the normal total_payments measure with every
  // component populated; Khulo (11) is the one municipality that year on the
  // functional-total fallback measure, where the component fields and the
  // reconciliation difference are genuinely absent (empty in the CSV), not zero.
  const BATUMI_2024: MunicipalTotalFact = {
    year: 2024,
    municipalityCode: "06",
    publicTotalGel: 412598028.9,
    publicTotalMeasure: "total_payments",
    totalPaymentsGel: 412598028.9,
    expensesGel: 231633660.18,
    nonfinancialAssetGrowthGel: 144589147.83,
    financialAssetGrowthGel: 0,
    liabilityDecreaseGel: 36375220.89,
    functionalSumGel: 376223011.21,
    reconciliationDifferenceGel: 36375017.69,
    warningAmountGel: 36375017.69,
    showWarning: true,
    warningType: "financing_outside_functional",
    basis: "actual",
    sourceId: "source.municipal_mof_annual_and_history_workbooks",
  };

  const KHULO_2024: MunicipalTotalFact = {
    year: 2024,
    municipalityCode: "11",
    publicTotalGel: 30969077.43,
    publicTotalMeasure: "functional_total_fallback_missing_payment_actual",
    totalPaymentsGel: null,
    expensesGel: null,
    nonfinancialAssetGrowthGel: null,
    financialAssetGrowthGel: null,
    liabilityDecreaseGel: null,
    functionalSumGel: 30969077.43,
    reconciliationDifferenceGel: null,
    warningAmountGel: null,
    showWarning: false,
    warningType: "source_actual_missing",
    basis: "actual",
    sourceId: "source.municipal_mof_annual_and_history_workbooks",
  };

  it("merges differing publicTotalMeasure values to the mixed marker, not to either input", () => {
    const aggregated = aggregateFactsForEntity("region.adjara", [], [BATUMI_2024, KHULO_2024]);

    expect(aggregated.totalFacts).toHaveLength(1);
    const row = aggregated.totalFacts[0]!;
    expect(row.publicTotalMeasure).not.toBe("total_payments");
    expect(row.publicTotalMeasure).not.toBe("functional_total_fallback_missing_payment_actual");
    expect(row.publicTotalMeasure).toBe(MIXED_PUBLIC_TOTAL_MEASURE);
  });

  it("collapses a nullable component field to null when any constituent is missing it, never treating the gap as zero", () => {
    const aggregated = aggregateFactsForEntity("region.adjara", [], [BATUMI_2024, KHULO_2024]);

    const row = aggregated.totalFacts[0]!;
    expect(row.totalPaymentsGel).toBeNull();
    expect(row.expensesGel).toBeNull();
    expect(row.nonfinancialAssetGrowthGel).toBeNull();
    expect(row.financialAssetGrowthGel).toBeNull();
    expect(row.liabilityDecreaseGel).toBeNull();
    expect(row.reconciliationDifferenceGel).toBeNull();

    // The two headline totals are unaffected: they are summed independently
    // of the component fields and are never null on a served row.
    expect(row.publicTotalGel).toBeCloseTo(412598028.9 + 30969077.43, 2);
    expect(row.functionalSumGel).toBeCloseTo(376223011.21 + 30969077.43, 2);
  });

  it("carries agreeing values through unchanged, so the fix does not erase good data", () => {
    // A second total_payments municipality (region.adjara's Kobuleti, 07) that
    // agrees with Batumi on both string fields and has every component
    // populated too.
    const KOBULETI_2024: MunicipalTotalFact = {
      ...BATUMI_2024,
      municipalityCode: "07",
      publicTotalGel: 70198849.48,
      totalPaymentsGel: 70198849.48,
      expensesGel: 45115764.33,
      nonfinancialAssetGrowthGel: 24408785.49,
      financialAssetGrowthGel: 0,
      liabilityDecreaseGel: 674299.66,
      functionalSumGel: 69524549.82,
      reconciliationDifferenceGel: 674299.66,
      warningAmountGel: null,
      showWarning: false,
      warningType: "none",
    };

    const aggregated = aggregateFactsForEntity("region.adjara", [], [BATUMI_2024, KOBULETI_2024]);

    const row = aggregated.totalFacts[0]!;
    // Both agree on measure and source, so the group keeps the real value —
    // the mixed marker only appears on genuine disagreement.
    expect(row.publicTotalMeasure).toBe("total_payments");
    expect(row.sourceId).toBe("source.municipal_mof_annual_and_history_workbooks");
    expect(row.sourceId).not.toBe(MIXED_SOURCE_ID);
    // Both have real numbers for the nullable fields, so they still sum.
    expect(row.totalPaymentsGel).toBeCloseTo(412598028.9 + 70198849.48, 2);
    expect(row.expensesGel).toBeCloseTo(231633660.18 + 45115764.33, 2);
    expect(row.liabilityDecreaseGel).toBeCloseTo(36375220.89 + 674299.66, 2);
    expect(row.reconciliationDifferenceGel).toBeCloseTo(36375017.69 + 674299.66, 2);
  });
});
