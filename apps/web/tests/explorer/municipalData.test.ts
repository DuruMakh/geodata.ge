import { describe, expect, it } from "vitest";
import type { Municipality, MunicipalFunction, MunicipalFunctionFact, MunicipalTotalFact } from "../../lib/data/municipal/types";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { loadServedLandingData, loadServedMunicipalData } from "../../lib/data/servedData";
import {
  aggregateFactsForEntity,
  buildComparisonRows,
  buildEntityKpis,
  buildIndexKpis,
  buildMovers,
  buildMunicipalEntityModel,
  buildMunicipalListRows,
  buildPickerGroups,
  getDefaultMunicipalSelection,
  latestReviewedAtForMunicipalFacts,
  MIXED_PUBLIC_TOTAL_MEASURE,
  MIXED_SOURCE_ID,
  regionFactsFor,
} from "../../lib/explorer/municipalData";
import { formatAmount, MISSING } from "../../lib/explorer/format";

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

  it("leaves English metadata blank when the municipal taxonomy has only Georgian labels", () => {
    expect(build().rows.map((row) => row.enLabel)).toEqual(["", "", ""]);
  });

  it("uses the official MoF total as the public total row", () => {
    const model = build();
    expect(model.totalRow.itemId).toBe("municipal.total");
    expect(model.totalRow.kaLabel).toBe("მთლიანი ბიუჯეტი");
    expect(model.totalRow.valuesByYear[2016]).toBe(300);
    expect(model.totalRow.shareEndYear).toBe(1);
  });

  it("keeps function values unchanged and divides their shares by the official total", () => {
    const model = build(2016, 2016);
    const economic = model.rows.find((row) => row.itemId === "municipal.economic_affairs")!;
    const shareSum = model.rows.reduce((sum, row) => sum + (row.shareEndYear ?? 0), 0);

    expect(economic.valuesByYear[2016]).toBe(200);
    expect(economic.shareEndYear).toBeCloseTo(200 / 300, 6);
    expect(shareSum).toBeCloseTo(265 / 300, 6);
    expect(shareSum).not.toBeCloseTo(1, 6);
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
  it("defaults a populated municipal model to only its official total", () => {
    expect(getDefaultMunicipalSelection(build())).toEqual(["municipal.total"]);
  });
});

describe("buildMunicipalEntityModel total row source attribution", () => {
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

  it("attributes the official total to the official-total facts", () => {
    const model = buildMunicipalEntityModel({
      functions: FUNCTIONS,
      functionFacts: FUNCTION_FACTS,
      totalFacts: MULTI_SOURCE_TOTAL_FACTS,
      sourceDocuments: MULTI_SOURCE_DOCS,
      startYear: 2015,
      endYear: 2017,
    });

    expect(model.totalRow.sourceByYear[2016].sourceName).toBe("წლიური და საარქივო პუბლიკაციები");
    expect(model.totalRow.sourceByYear[2017].sourceName).toBe("წლიური და საარქივო პუბლიკაციები");
  });

  it("uses the real 2016 Tbilisi official-total provenance", async () => {
    const [{ functions, functionFacts, totalFacts }, { sourceDocuments }] = await Promise.all([
      loadServedMunicipalData(),
      loadServedLandingData(),
    ]);
    const model = buildMunicipalEntityModel({
      functions,
      functionFacts: functionFacts.filter((row) => row.municipalityCode === "04"),
      totalFacts: totalFacts.filter((row) => row.municipalityCode === "04"),
      sourceDocuments,
      startYear: 2016,
      endYear: 2016,
    });

    expect(model.totalRow.sourceByYear[2016].sourceName).toBe(
      sourceDocuments.find((row) => row.sourceId === "source.municipal_mof_annual_and_history_workbooks")?.sourceName,
    );
  });
});

describe("latestReviewedAtForMunicipalFacts", () => {
  it("ignores a newer source document that is not referenced by the municipal facts", () => {
    const unrelatedNationalSource: SourceDocumentRow = {
      sourceId: "source.national_budget_2027",
      sourceName: "National budget",
      sourceUrlOrFile: "national-budget.xlsx",
      lastReviewedAt: "2026-12-31",
    };

    expect(latestReviewedAtForMunicipalFacts([...SOURCES, unrelatedNationalSource], FUNCTION_FACTS, TOTAL_FACTS)).toBe(
      "2026-08-01",
    );
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
    // The warning type belongs to one municipality's reconciliation and cannot
    // be attributed honestly to the aggregate row.
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

// Real served data never disagrees here: source_id is uniform within every
// year across all 64 municipalities (data/imports/municipal-function-facts-
// 2015-2025.csv and .../municipal-total-facts-2015-2025.csv), so a genuine
// region never reaches the mixed branch today. That made the FUNCTION-fact
// loop's own `agreeOrMixed` call on sourceId (municipalData.ts, inside the
// `for (const row of functionFacts)` merge branch) provably untested by every
// fixture above it: delete that one line and every existing test still
// passes, because they all agree on sourceId. Nothing above folds 3 or more
// constituents either — every prior multi-municipality fixture uses exactly
// two. Regions are exactly where a real 3+ fold happens. These fixtures are
// deliberately constructed disagreements, for exactly those two reasons.
describe("aggregateFactsForEntity — sourceId fold on the FUNCTION-FACT loop", () => {
  it("merges disagreeing sourceId values on the FUNCTION-FACT loop to the mixed marker, not to either input", () => {
    const functionFacts: MunicipalFunctionFact[] = [
      fact(2015, "municipal.economic_affairs", 100), // 04, source.municipal_portal_archive
      {
        year: 2015,
        municipalityCode: "06",
        categoryId: "municipal.economic_affairs",
        functionalCode: "7.4",
        amountGel: 50,
        basis: "actual",
        sourceId: "source.municipal_mof_annual_and_history_workbooks",
      },
    ];

    const aggregated = aggregateFactsForEntity("region.test", functionFacts, []);

    expect(aggregated.functionFacts).toHaveLength(1);
    const row = aggregated.functionFacts[0]!;
    expect(row.amountGel).toBe(150);
    expect(row.sourceId).not.toBe("source.municipal_portal_archive");
    expect(row.sourceId).not.toBe("source.municipal_mof_annual_and_history_workbooks");
    expect(row.sourceId).toBe(MIXED_SOURCE_ID);
  });

  it("keeps the mixed marker once set, even when a third constituent's sourceId agrees with an earlier one — a fold across 3+ constituents", () => {
    const functionFacts: MunicipalFunctionFact[] = [
      fact(2015, "municipal.economic_affairs", 100), // 04, source.municipal_portal_archive
      {
        year: 2015,
        municipalityCode: "06",
        categoryId: "municipal.economic_affairs",
        functionalCode: "7.4",
        amountGel: 50,
        basis: "actual",
        sourceId: "source.municipal_mof_annual_and_history_workbooks", // disagrees with 04 -> mixes the group
      },
      {
        year: 2015,
        municipalityCode: "07",
        categoryId: "municipal.economic_affairs",
        functionalCode: "7.4",
        amountGel: 20,
        basis: "actual",
        sourceId: "source.municipal_portal_archive", // agrees with municipality 04 ALONE, not with the now-mixed group
      },
    ];

    const aggregated = aggregateFactsForEntity("region.test", functionFacts, []);

    const row = aggregated.functionFacts[0]!;
    expect(row.amountGel).toBe(170);
    // A fold that compared each incoming row only against the FIRST inserted
    // value (rather than the running, already-mixed group value) would wrongly
    // "unmix" back to municipality 04's sourceId here, since row 3 agrees with
    // row 1. It must not: once mixed, always mixed for this group.
    expect(row.sourceId).toBe(MIXED_SOURCE_ID);
  });

  it("carries a three-way agreeing sourceId through unchanged — the mixed marker only appears on genuine disagreement", () => {
    const functionFacts: MunicipalFunctionFact[] = [
      fact(2015, "municipal.economic_affairs", 100),
      { ...fact(2015, "municipal.economic_affairs", 50), municipalityCode: "06" },
      { ...fact(2015, "municipal.economic_affairs", 20), municipalityCode: "07" },
    ];

    const aggregated = aggregateFactsForEntity("region.test", functionFacts, []);

    const row = aggregated.functionFacts[0]!;
    expect(row.amountGel).toBe(170);
    expect(row.sourceId).toBe("source.municipal_portal_archive");
    expect(row.sourceId).not.toBe(MIXED_SOURCE_ID);
  });
});

describe("aggregateFactsForEntity — sourceId fold on the TOTAL-FACT loop, isolated from publicTotalMeasure", () => {
  // The existing publicTotalMeasure-mixing tests above (BATUMI_2024/KHULO_2024)
  // never actually exercise a sourceId disagreement — both fixtures share the
  // same sourceId, so MIXED_SOURCE_ID (imported at the top of this file) was
  // never once asserted to be the ACTUAL result of a merge before this test.
  it("merges disagreeing sourceId values to the mixed marker even when publicTotalMeasure agrees", () => {
    const totalFacts: MunicipalTotalFact[] = [
      total(2015, 160, 160),
      { ...total(2015, 90, 80), municipalityCode: "06", sourceId: "source.municipal_mof_annual_and_history_workbooks" },
    ];

    const aggregated = aggregateFactsForEntity("region.test", [], totalFacts);

    const row = aggregated.totalFacts[0]!;
    // publicTotalMeasure agrees ("total_payments" on both inputs), so it must
    // stay a real value — proving the two string fields fold independently,
    // not as one bundled "something disagreed" flag.
    expect(row.publicTotalMeasure).toBe("total_payments");
    expect(row.sourceId).not.toBe("source.municipal_portal_archive");
    expect(row.sourceId).not.toBe("source.municipal_mof_annual_and_history_workbooks");
    expect(row.sourceId).toBe(MIXED_SOURCE_ID);
  });
});

const MUNICIPALITIES: Municipality[] = [
  { code: "04", sortId: 1, nameKa: "ქალაქ თბილისის მუნიციპალიტეტი", displayNameKa: "თბილისი", regionId: "region.tbilisi", isSelfGoverningCity: true },
  { code: "06", sortId: 2, nameKa: "ქალაქ ბათუმის მუნიციპალიტეტი", displayNameKa: "ბათუმი", regionId: "region.adjara", isSelfGoverningCity: true },
  { code: "07", sortId: 3, nameKa: "ქობულეთის მუნიციპალიტეტი", displayNameKa: "ქობულეთი", regionId: "region.adjara", isSelfGoverningCity: false },
];

const REGION_LABELS = new Map([
  ["region.tbilisi", "თბილისი"],
  ["region.adjara", "აჭარა"],
]);

function totalFor(code: string, year: number, publicTotalGel: number): MunicipalTotalFact {
  return { ...total(year, publicTotalGel, publicTotalGel), municipalityCode: code };
}

const INDEX_TOTALS: MunicipalTotalFact[] = [
  totalFor("04", 2015, 1_000_000_000), totalFor("04", 2025, 2_000_000_000),
  totalFor("06", 2015, 200_000_000), totalFor("06", 2025, 500_000_000),
  totalFor("07", 2015, 50_000_000), totalFor("07", 2025, 100_000_000),
];

const listInput = {
  municipalities: MUNICIPALITIES,
  regionLabels: REGION_LABELS,
  totalFacts: INDEX_TOTALS,
  year: 2025,
};

describe("buildMunicipalListRows", () => {
  it("ranks municipalities by the official total, descending", () => {
    const { municipalities } = buildMunicipalListRows(listInput);
    expect(municipalities.map((row) => row.nameKa)).toEqual(["თბილისი", "ბათუმი", "ქობულეთი"]);
    expect(municipalities.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it("labels a municipality row with its region", () => {
    const { municipalities } = buildMunicipalListRows(listInput);
    expect(municipalities[1]!.subtitleKa).toBe("აჭარა");
  });

  it("rolls regions up and ranks them independently", () => {
    const { regions } = buildMunicipalListRows(listInput);
    expect(regions.map((row) => row.id)).toEqual(["region.tbilisi", "region.adjara"]);
    expect(regions[1]!.valueGel).toBe(600_000_000);
  });

  it("counts a region's members in its subtitle", () => {
    const { regions } = buildMunicipalListRows(listInput);
    expect(regions[1]!.subtitleKa).toBe("2 მუნიციპალიტეტი");
  });
});

describe("regionFactsFor", () => {
  it("selects only the region's members", () => {
    const selected = regionFactsFor("region.adjara", MUNICIPALITIES, [], INDEX_TOTALS);
    expect(selected.memberCodes.sort()).toEqual(["06", "07"]);
    expect(selected.totalFacts).toHaveLength(4);
  });
});

describe("aggregateFactsForEntity", () => {
  const members = regionFactsFor("region.adjara", MUNICIPALITIES, [], INDEX_TOTALS);
  const rolled = aggregateFactsForEntity("region.adjara", members.functionFacts, members.totalFacts);

  it("collapses the members to one row per year", () => {
    expect(rolled.totalFacts).toHaveLength(2);
    expect(rolled.totalFacts.every((row) => row.municipalityCode === "region.adjara")).toBe(true);
  });

  it("sums both totals independently", () => {
    const y2025 = rolled.totalFacts.find((row) => row.year === 2025)!;
    expect(y2025.publicTotalGel).toBe(600_000_000);
    expect(y2025.functionalSumGel).toBe(600_000_000);
  });

  it("carries no municipality-grain warning on the roll-up", () => {
    expect(rolled.totalFacts.every((row) => row.showWarning === false)).toBe(true);
    expect(rolled.totalFacts.every((row) => row.warningType === "none")).toBe(true);
  });

  it("does not mutate the input rows", () => {
    expect(members.totalFacts[0]!.municipalityCode).not.toBe("region.adjara");
  });
});

describe("buildIndexKpis", () => {
  const kpis = () =>
    buildIndexKpis({
      municipalities: MUNICIPALITIES,
      totalFacts: INDEX_TOTALS,
      functionFacts: [],
      functions: FUNCTIONS,
      firstYear: 2015,
      latestYear: 2025,
    });

  it("leads with the municipal total for the latest year", () => {
    expect(kpis()[0]!.value).toBe("2.60 მლრდ ₾");
    expect(kpis()[0]!.detail).toBe("2025 · 3 მუნიციპალიტეტი");
  });

  it("reports growth from the first served year", () => {
    // 1.25bn → 2.6bn
    expect(kpis()[1]!.label).toBe("ზრდა 2015-დან");
    expect(kpis()[1]!.value).toBe("+108%");
  });

  it("reports concentration rather than a max/min ratio", () => {
    expect(kpis()[2]!.label).toBe("თბილისის წილი");
    expect(kpis()[2]!.value).toBe("76.9%");
    expect(kpis()[2]!.detail).toBe("დანარჩენი 2 ერთეული — 23.1%");
  });
});

// growth's sign prefix and formatShare's differ at exactly zero: formatShare
// (and every other change/growth KPI in the app — indicators.tsx,
// explorer-table.tsx, main-explorer.tsx, budget-field.tsx, ranking.tsx — all
// call formatShare(x, true)) only prefixes "+" when the value is > 0, so a
// flat total renders unsigned. Pinned here so a future edit cannot silently
// reintroduce the old hand-rolled ">= 0" branch, which prefixed "+0%".
const ZERO_GROWTH_TOTALS: MunicipalTotalFact[] = [
  totalFor("04", 2015, 1_000_000_000),
  totalFor("04", 2025, 1_000_000_000),
];

describe("buildIndexKpis — growth sign at exactly zero", () => {
  it("renders a flat total as unsigned 0%, not +0%", () => {
    const kpis = buildIndexKpis({
      municipalities: MUNICIPALITIES,
      totalFacts: ZERO_GROWTH_TOTALS,
      functionFacts: [],
      functions: FUNCTIONS,
      firstYear: 2015,
      latestYear: 2025,
    });
    expect(kpis[1]!.value).toBe("0%");
  });
});

// INDEX_TOTALS above sets functionalSumGel equal to publicTotalGel on every
// row (via totalFor), so it cannot tell the two totals apart: a version of
// buildMunicipalListRows/buildIndexKpis that silently read functionalSumGel
// instead of publicTotalGel would pass every test above unchanged. These
// fixtures deliberately diverge — and even invert which municipality leads —
// so such a swap fails loudly.
const DIVERGENT_TOTALS: MunicipalTotalFact[] = [
  { ...total(2015, 50_000_000, 50_000_000), municipalityCode: "04" },
  { ...total(2015, 50_000_000, 50_000_000), municipalityCode: "06" },
  // 2025: თბილისი leads on functionalSumGel (900M), ბათუმი leads on
  // publicTotalGel (300M) — the two measures disagree on both the sum AND
  // the ranking.
  { ...total(2025, 100_000_000, 900_000_000), municipalityCode: "04" },
  { ...total(2025, 300_000_000, 50_000_000), municipalityCode: "06" },
];

describe("buildMunicipalListRows — ranks and sums publicTotalGel, not functionalSumGel", () => {
  const divergentInput = {
    municipalities: MUNICIPALITIES,
    regionLabels: REGION_LABELS,
    totalFacts: DIVERGENT_TOTALS,
    year: 2025,
  };

  it("orders municipalities by publicTotalGel", () => {
    const { municipalities } = buildMunicipalListRows(divergentInput);
    // ბათუმი (06, 300M publicTotalGel) beats თბილისი (04, 100M publicTotalGel)
    // even though თბილისი has the larger functionalSumGel (900M vs 50M).
    expect(municipalities.map((row) => row.id)).toEqual(["06", "04", "07"]);
    expect(municipalities[0]!.valueGel).toBe(300_000_000);
    expect(municipalities[1]!.valueGel).toBe(100_000_000);
  });

  it("rolls regions up on publicTotalGel too", () => {
    const { regions } = buildMunicipalListRows(divergentInput);
    // region.adjara (06 + 07) sums publicTotalGel to 300M, ahead of
    // region.tbilisi's 100M — the functionalSumGel sums (50M vs 900M) would
    // put them in the opposite order.
    expect(regions.map((row) => row.id)).toEqual(["region.adjara", "region.tbilisi"]);
    expect(regions[0]!.valueGel).toBe(300_000_000);
  });
});

describe("buildIndexKpis — uses publicTotalGel, not functionalSumGel", () => {
  const kpis = () =>
    buildIndexKpis({
      municipalities: MUNICIPALITIES,
      totalFacts: DIVERGENT_TOTALS,
      functionFacts: [],
      functions: FUNCTIONS,
      firstYear: 2015,
      latestYear: 2025,
    });

  it("leads with the sum of publicTotalGel", () => {
    // publicTotalGel: 100M + 300M = 400M. Reading functionalSumGel instead
    // would sum to 900M + 50M = 950M.
    expect(kpis()[0]!.value).toBe("400.0 მლნ ₾");
  });

  it("names the municipality that is largest by publicTotalGel", () => {
    // ბათუმი leads on publicTotalGel (300M vs თბილისი's 100M); თბილისი would
    // lead if concentration were computed from functionalSumGel instead.
    expect(kpis()[2]!.label).toBe("ბათუმის წილი");
    expect(kpis()[2]!.label).not.toBe("თბილისის წილი");
  });

  it("shares the largest function against the official total", () => {
    const functionFacts = [
      fact(2025, "municipal.economic_affairs", 200),
      { ...fact(2025, "municipal.education", 65), municipalityCode: "06" },
    ];
    const divergent = buildIndexKpis({
      municipalities: MUNICIPALITIES,
      totalFacts: [{ ...total(2025, 300, 265), municipalityCode: "04" }],
      functionFacts,
      functions: FUNCTIONS,
      firstYear: 2025,
      latestYear: 2025,
    });

    expect(divergent[3]!.value).toBe("66.7%");
  });
});

describe("buildEntityKpis", () => {
  const nationalTotalByYear = { 2016: 740, 2017: 740 };
  const rankByYear = { 2015: 1, 2016: 1, 2017: 1 };
  const kpis = () =>
    buildEntityKpis({
      model: build(),
      nationalTotalByYear,
      rankByYear,
      rankOutOf: 64,
    });

  it("leads with the official total row", () => {
    // 2016 is the divergent year: official 300, functional 265. This test
    // checks the label, the detail's ფინანსთა სამინისტროს wording, and the
    // model's two raw totals — it does NOT discriminate on `.value` itself:
    // at this fixture's toy-number scale formatAmount(300) and
    // formatAmount(265) both round to the identical "0.0 მლნ ₾" string, so
    // the last assertion below would still pass even if the KPI read the
    // functional total instead. The adjacent test right below this one (GEL-
    // realistic magnitude) is the one that actually catches an
    // official/functional swap on `.value` — it covers the gap this test
    // leaves, so do not delete it as "redundant" with this one.
    const model = build(2015, 2016);
    const divergent = buildEntityKpis({ model, nationalTotalByYear, rankByYear, rankOutOf: 64 });
    expect(divergent[0]!.label).toBe("ოფიციალური ბიუჯეტი");
    expect(divergent[0]!.detail).toContain("ფინანსთა სამინისტროს");
    expect(model.totalRow.valuesByYear[2016]).toBe(300);
    expect(divergent[0]!.value).toBe(formatAmount(300));
  });

  it("keeps a missing official end total missing instead of rendering zero", () => {
    const model = build();
    model.totalRow.valuesByYear[2017] = null;
    const missing = buildEntityKpis({ model, nationalTotalByYear, rankByYear, rankOutOf: 64 });

    expect(missing[0]!.value).toBe(MISSING);
  });

  it("renders the official total's own formatted string, distinguishable from the functional one", () => {
    // At the fixture's 100s-scale magnitude, formatAmount(300) and
    // formatAmount(265) both round to the same "0.0 მლნ ₾" string, so the test
    // above cannot actually tell, from divergent[0].value alone, whether the
    // KPI read officialTotalByYear or totalRow — only that its raw output
    // equals formatAmount(300), which a functionalEnd-based value would ALSO
    // equal at this scale. Re-run the same divergence at GEL-realistic
    // magnitude (hundreds of millions), where the two totals format to visibly
    // different strings, so a swap cannot hide behind rounding.
    const bigTotalFacts: MunicipalTotalFact[] = [
      total(2015, 100_000_000, 100_000_000),
      total(2016, 350_000_000, 265_000_000, true),
    ];
    const model = buildMunicipalEntityModel({
      functions: FUNCTIONS,
      functionFacts: FUNCTION_FACTS,
      totalFacts: bigTotalFacts,
      sourceDocuments: SOURCES,
      startYear: 2015,
      endYear: 2016,
    });
    const divergent = buildEntityKpis({
      model,
      nationalTotalByYear: { 2016: 740_000_000 },
      rankByYear,
      rankOutOf: 64,
    });
    expect(divergent[0]!.value).toBe(formatAmount(350_000_000));
    expect(divergent[0]!.value).not.toBe(formatAmount(265_000_000));
  });

  it("reports growth across the selected range", () => {
    expect(kpis()[1]!.label).toBe("ზრდა 2015-დან");
  });

  it("computes growth from the official total", () => {
    const divergent = buildEntityKpis({ model: build(2015, 2016), nationalTotalByYear, rankByYear, rankOutOf: 64 });
    expect(divergent[1]!.value).toBe("+88%");
    expect(divergent[1]!.detail).toBe(`${formatAmount(160)} → ${formatAmount(300)}`);
  });

  it("names the largest function and its share", () => {
    expect(kpis()[2]!.label).toBe("უმსხვილესი სფერო");
    expect(kpis()[2]!.detail).toBe("ეკონომიკური საქმიანობა");
  });

  it("reports the municipality's share of the national municipal total, not a per-capita figure", () => {
    expect(kpis()[3]!.label).toBe("წილი მუნიციპალურ ხარჯებში");
    expect(kpis()[3]!.value).toBe("50.0%");
  });

  it("uses the selected range-end year's national total for the national share", () => {
    const clipped = buildEntityKpis({
      model: build(2015, 2016),
      nationalTotalByYear: { 2016: 600, 2017: 740 },
      rankByYear,
      rankOutOf: 64,
    });

    expect(clipped[3]!.value).toBe("50.0%");
  });

  // `rankByYear` is a real input read by this KPI's detail, not dead weight on
  // the interface: first place reads პირველი, never მე-1 (georgianOrdinal, Task 3).
  it("names the placement with the georgian ordinal of rank, not just the count it is out of", () => {
    expect(kpis()[3]!.detail).toBe("პირველი ადგილი 64-დან");
  });

  it("switches to მე-N for any rank other than first", () => {
    const fifth = buildEntityKpis({
      model: build(),
      nationalTotalByYear,
      rankByYear: { 2015: 5, 2016: 5, 2017: 5 },
      rankOutOf: 64,
    });
    expect(fifth[3]!.detail).toBe("მე-5 ადგილი 64-დან");
  });

  it("uses the selected range-end year's rank", () => {
    const historical = buildEntityKpis({
      model: build(2015, 2016),
      nationalTotalByYear,
      rankByYear: { 2015: 51, 2016: 26 },
      rankOutOf: 64,
    });

    expect(historical[3]!.detail).toBe("მე-26 ადგილი 64-დან");
  });

  it("shares the largest function against the official total", () => {
    const divergent = buildEntityKpis({ model: build(2015, 2016), nationalTotalByYear, rankByYear, rankOutOf: 64 });
    expect(divergent[2]!.value).toBe("66.7%");
  });

  it("shares the national-total KPI against the official total, not the functional one", () => {
    // official (300) / nationalTotalByYear[2016] (740) = 40.5%; functional (265) /
    // 740 would be 35.8%.
    const divergent = buildEntityKpis({ model: build(2015, 2016), nationalTotalByYear, rankByYear, rankOutOf: 64 });
    expect(divergent[3]!.value).toBe("40.5%");
  });
});

describe("buildMovers", () => {
  it("ranks the fastest growers first", () => {
    expect(buildMovers(build()).up[0]!.kaLabel).toBe("ეკონომიკური საქმიანობა");
  });

  it("keeps a shrinking series in the slow-growth column, never called a loss", () => {
    const down = buildMovers(build()).down;
    expect(down[0]!.kaLabel).toBe("ჯანმრთელობის დაცვა");
    expect(down[0]!.growth).toBeLessThan(0);
  });

  it("carries each row's category colour", () => {
    expect(buildMovers(build()).up[0]!.color).toBe("#C26E4C");
  });

  it("excludes a zero-start row instead of ranking its unavailable growth as the slowest mover", () => {
    const zeroStartFacts = FUNCTION_FACTS.map((row) =>
      row.year === 2015 && row.categoryId === "municipal.education" ? { ...row, amountGel: 0 } : row,
    );
    const model = buildMunicipalEntityModel({
      functions: FUNCTIONS,
      functionFacts: zeroStartFacts,
      totalFacts: TOTAL_FACTS,
      sourceDocuments: SOURCES,
      startYear: 2015,
      endYear: 2017,
    });
    const movers = buildMovers(model);

    expect(movers.down[0]!.kaLabel).toBe("ჯანმრთელობის დაცვა");
    expect([...movers.up, ...movers.down].some((row) => row.kaLabel === "განათლება")).toBe(false);
  });
});

describe("buildComparisonRows", () => {
  it("puts the total first, then functions by end-year size", () => {
    const rows = buildComparisonRows(build());
    expect(rows[0]!.isTotal).toBe(true);
    expect(rows.slice(1).map((row) => row.kaLabel)).toEqual([
      "ეკონომიკური საქმიანობა",
      "განათლება",
      "ჯანმრთელობის დაცვა",
    ]);
  });

  it("reports both the absolute and relative change", () => {
    const economic = buildComparisonRows(build()).find((row) => row.kaLabel === "ეკონომიკური საქმიანობა")!;
    expect(economic.fromGel).toBe(100);
    expect(economic.toGel).toBe(300);
    expect(economic.changeGel).toBe(200);
    expect(economic.changeShare).toBeCloseTo(2, 6);
  });
});

describe("buildPickerGroups", () => {
  it("orders regions by value, descending — same order buildMunicipalListRows gives the map/list", () => {
    const groups = buildPickerGroups(listInput);
    expect(groups.map((group) => group.regionId)).toEqual(["region.tbilisi", "region.adjara"]);
  });

  it("orders each region's members by value, descending", () => {
    const groups = buildPickerGroups(listInput);
    const adjara = groups.find((group) => group.regionId === "region.adjara")!;
    // ბათუმი (06, 500M in 2025) outranks ქობულეთი (07, 100M).
    expect(adjara.members.map((member) => member.code)).toEqual(["06", "07"]);
  });

  it("carries each member's display name and value, not the registry's legal name", () => {
    const groups = buildPickerGroups(listInput);
    const tbilisi = groups.find((group) => group.regionId === "region.tbilisi")!;
    expect(tbilisi.members).toEqual([{ code: "04", nameKa: "თბილისი", valueGel: 2_000_000_000 }]);
  });

  it("gives a region its own rolled-up value, not a single member's", () => {
    const groups = buildPickerGroups(listInput);
    const adjara = groups.find((group) => group.regionId === "region.adjara")!;
    // 500M (06) + 100M (07) = 600M — neither constituent alone.
    expect(adjara.valueGel).toBe(600_000_000);
  });

  it("covers every region in the taxonomy, each carrying its members", () => {
    const groups = buildPickerGroups(listInput);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.members.length > 0)).toBe(true);
  });
});
