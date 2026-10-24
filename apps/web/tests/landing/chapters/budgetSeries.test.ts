import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "../../../lib/data/glossary";
import type { Presentation } from "../../../lib/i18n/types";
import { REVENUE_BANDS, buildRevenueSeries, buildSpendingSeries } from "../../../lib/landing/chapters/budgetSeries";
import type { ServedBudgetFact } from "../../../lib/servedRows";

const glossary = new Map<string, GlossaryEntry>(
  [
    ["spending.health", "ჯანდაცვა"],
    ["spending.education", "განათლება"],
    ["spending.defence", "თავდაცვა"],
    ["spending.other_unclassified", "სხვა"],
    ["revenue.vat", "დღგ"],
  ].map(([id, kaLabel]) => [id, { id, kaLabel, enLabel: id, description: "", notes: "" }]),
);

const presentation: Presentation = {
  locale: "ka",
  englishLabels: {},
  messages: {
    "landing.revBand.vat": "დღგ",
    "landing.revBand.income": "საშემოსავლო",
    "landing.revBand.profit": "მოგების",
    "landing.revBand.excise": "აქციზი",
    "landing.revBand.otherTaxes": "სხვა გადასახადები",
    "landing.revBand.otherIncome": "სხვა შემოსავლები",
    "landing.revBand.liabilities": "ვალდებულებების ზრდა",
  },
};

function spend(year: number, itemId: string, amountGel: number, basis: "actual" | "planned" = "actual"): ServedBudgetFact {
  return { year, side: "expenditure", itemId, amountGel, basis, sourceId: "source.a" };
}

function rev(year: number, itemId: string, amountGel: number, basis: "actual" | "planned" = "actual"): ServedBudgetFact {
  return { year, side: "revenue", itemId, amountGel, basis, sourceId: "source.a" };
}

describe("buildSpendingSeries", () => {
  it("uses actual over planned and marks planned years", () => {
    const series = buildSpendingSeries(
      [spend(2024, "spending.health", 50, "planned"), spend(2025, "spending.health", 400, "planned"), spend(2025, "spending.health", 40)],
      glossary,
      presentation,
    );
    const health = series.fields.find((field) => field.id === "spending.health")!;

    expect(series.years).toEqual([2024, 2025]);
    expect(series.planned).toEqual([true, false]);
    expect(health.values).toEqual([50, 40]);
  });

  it("totals equal the field sum and fields sort by latest value with other_unclassified last", () => {
    const series = buildSpendingSeries(
      [
        spend(2025, "spending.other_unclassified", 900),
        spend(2025, "spending.health", 10),
        spend(2025, "spending.education", 30),
        spend(2025, "spending.defence", 20),
        spend(2025, "expenditure.total", 5_000),
      ],
      glossary,
      presentation,
    );

    expect(series.fields.map((field) => field.id)).toEqual([
      "spending.education",
      "spending.defence",
      "spending.health",
      "spending.other_unclassified",
    ]);
    expect(series.fields[0].label).toBe("განათლება");
    expect(series.totals).toEqual([960]);
  });

  it("runs from the first to the latest year with any field fact and fills a missing field-year with 0", () => {
    const series = buildSpendingSeries(
      [spend(2020, "spending.health", 5), spend(2022, "spending.health", 7), spend(2022, "spending.defence", 3), spend(2023, "expenditure.total", 99)],
      glossary,
      presentation,
    );

    expect(series.years).toEqual([2020, 2021, 2022]);
    expect(series.fields.find((field) => field.id === "spending.health")!.values).toEqual([5, 0, 7]);
    expect(series.fields.find((field) => field.id === "spending.defence")!.values).toEqual([0, 0, 3]);
    expect(series.totals).toEqual([5, 0, 10]);
  });
});

describe("buildRevenueSeries", () => {
  it("groups items into seven bands", () => {
    const series = buildRevenueSeries(
      [
        rev(2024, "revenue.vat", 100),
        rev(2024, "revenue.income_tax", 40),
        rev(2024, "revenue.profit_tax", 30),
        rev(2024, "revenue.excise_tax", 20),
        rev(2024, "revenue.import_tax", 1),
        rev(2024, "revenue.property_tax", 2),
        rev(2024, "revenue.other_taxes", 3),
        rev(2024, "revenue.grants", 4),
        rev(2024, "revenue.other_revenue", 5),
        rev(2024, "revenue.asset_decrease", 6),
        rev(2024, "revenue.increase_liabilities", 10),
        rev(2024, "revenue.total", 9_999),
        rev(2025, "revenue.vat", 100),
      ],
      glossary,
      presentation,
    );
    const band = (id: string) => series.bands.find((entry) => entry.id === id)!;

    expect(series.bands.map((entry) => entry.id)).toEqual(Object.keys(REVENUE_BANDS));
    expect(band("otherTaxes").values).toEqual([6, null]);
    expect(band("otherIncome").values).toEqual([15, null]);
    expect(band("liabilities").values).toEqual([10, null]);
    expect(band("vat").label).toBe("დღგ");
    expect(series.years).toEqual([2024, 2025]);
    expect(series.totals).toEqual([221, 100]);
  });

  it("taxShare is (vat+income+profit+excise+otherTaxes)/total and peakBorrowing is the highest liabilities share, earliest on ties", () => {
    const series = buildRevenueSeries(
      [
        rev(2020, "revenue.vat", 80),
        rev(2020, "revenue.other_taxes", 10),
        rev(2020, "revenue.increase_liabilities", 10),
        rev(2021, "revenue.vat", 160),
        rev(2021, "revenue.other_taxes", 20),
        rev(2021, "revenue.increase_liabilities", 20),
        rev(2022, "revenue.vat", 100),
      ],
      glossary,
      presentation,
    );

    expect(series.taxShare[0]).toBeCloseTo(0.9);
    expect(series.taxShare[1]).toBeCloseTo(0.9);
    expect(series.taxShare[2]).toBe(1);
    expect(series.peakBorrowing).toEqual({ year: 2020, share: 0.1 });
  });

  it("has no peakBorrowing when no year carries liabilities", () => {
    const series = buildRevenueSeries([rev(2020, "revenue.vat", 80)], glossary, presentation);

    expect(series.peakBorrowing).toBeNull();
  });

  it("an item outside REVENUE_BANDS throws, naming the item", () => {
    expect(() => buildRevenueSeries([rev(2020, "revenue.new_levy", 1)], glossary, presentation)).toThrow("revenue.new_levy");
  });
});
