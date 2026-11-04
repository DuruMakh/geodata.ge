import { describe, expect, test } from "vitest";
import enMessages from "../../lib/i18n/messages/en/yearReview.json";
import kaMessages from "../../lib/i18n/messages/ka/yearReview.json";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import { buildFindings, type Finding } from "../../lib/yearReview/findings";
import type { YearReviewData } from "../../lib/yearReview/types";
import { fixture } from "./yearReviewFixture";

const GEORGIAN = /\p{Script=Georgian}/u;

const finding = (data: YearReviewData, year: number, id: Finding["id"], locale: "ka" | "en" = "en") =>
  buildFindings(data, year, locale === "en" ? enMessages : kaMessages, locale).find((item) => item.id === id)!;

const setValues = (data: YearReviewData, id: string, values: (number | null)[]) => {
  const row = [...data.budget.receipts, ...data.budget.fields, ...data.spendingTypes.types].find((item) => item.id === id)!;
  row.values = values;
};

/** The Task 3 fixture with debt service as a field (the fourth largest in 2025 by default). */
function withDebtService(value = 4): YearReviewData {
  const data = fixture();
  data.budget.fields.push({ id: "spending.debt_service", label: "label spending.debt_service", color: "#8C5A32", values: [1, 1, 1, value, 1] });
  return data;
}

describe("buildFindings", () => {
  test("six cards in board order, each linking to its page in the page language", () => {
    const findings = buildFindings(withDebtService(), 2025, enMessages, "en");
    expect(findings.map((item) => item.id)).toEqual(["taxes", "breaks", "debtRank", "types", "service", "municipal"]);
    expect(findings.map((item) => item.href)).toEqual([
      "/en/explorer/revenue",
      "/en/explorer/tax-breaks-refunds",
      "/en/explorer/expenditure",
      "/en/explorer/expenditure-types",
      "/en/explorer/debt",
      "/en/explorer/municipalities",
    ]);
    expect(buildFindings(withDebtService(), 2025, kaMessages, "ka")[0]!.href).toBe("/explorer/revenue");
  });

  describe("taxes", () => {
    test("every tax grew: f6none names the fastest growth", () => {
      const item = finding(withDebtService(), 2025, "taxes");
      expect(item.heading).toBe("Every tax grew; label revenue.profit_tax grew fastest");
      expect(item.detail).toBe("<1 mln → <1 mln, +50.0% vs 2024");
      expect(item.yearTag).toBeNull();
      expect(item.visual).toEqual({ kind: "spark", values: [10, 10, 10, 15, null], index: 3, color: "#000000" });
    });

    test("exactly one tax fell: f6one", () => {
      const data = withDebtService();
      setValues(data, "revenue.income_tax", [20, 25, 30, 20, null]);
      expect(finding(data, 2025, "taxes").heading).toBe("label revenue.income_tax was the only tax that fell");
      expect(finding(data, 2025, "taxes", "ka").heading).toBe("label revenue.income_tax — ერთადერთი გადასახადი, რომელიც შემცირდა");
    });

    test("several fell: f6many names the largest fall in GEL", () => {
      const data = withDebtService();
      setValues(data, "revenue.income_tax", [20, 25, 30, 20, null]); // −10, −33%
      setValues(data, "revenue.vat", [40, 50, 60, 48, null]); // −12, −20%
      expect(finding(data, 2025, "taxes").heading).toBe("Largest fall: label revenue.vat");
    });

    test("a line falling to zero or below is a fall, shown without a percentage; growth ranks lines positive in both years", () => {
      const data = withDebtService();
      setValues(data, "revenue.other_taxes", [5, 5, 5, -3, null]);
      const item = finding(data, 2025, "taxes");
      expect(item.heading).toBe("label revenue.other_taxes was the only tax that fell");
      expect(item.detail).toBe("<1 mln → >−1 mln vs 2024");
      expect(finding(data, 2025, "taxes", "ka").detail).toBe("<1 მლნ → >−1 მლნ · 2024 წელთან");
      // A line rising from below zero is no fall, and has no growth rate to rank.
      setValues(data, "revenue.other_taxes", [5, 5, -3, 5, null]);
      expect(finding(data, 2025, "taxes").heading).toBe("Every tax grew; label revenue.profit_tax grew fastest");
    });

    test("served data: in 2019 “Other taxes” fell below zero, and in 2020 further, so neither year reads “every tax grew”", async () => {
      const [{ data: en }, { data: ka }] = await Promise.all([loadYearReviewData("en"), loadYearReviewData("ka")]);
      expect(finding(en, 2019, "taxes")).toMatchObject({ heading: "Other taxes was the only tax that fell", detail: "115 mln → −230 mln vs 2018" });
      expect(finding(ka, 2019, "taxes", "ka")).toMatchObject({
        heading: "სხვა გადასახადები — ერთადერთი გადასახადი, რომელიც შემცირდა",
        detail: "115 მლნ → −230 მლნ · 2018 წელთან",
      });
      expect(finding(en, 2020, "taxes").heading).toBe("Largest fall: VAT");
    });

    test("a year without receipts falls back to the last one, with its year tag", () => {
      expect(finding(withDebtService(), 2026, "taxes")).toMatchObject({ yearTag: 2025, heading: "Every tax grew; label revenue.profit_tax grew fastest" });
    });

    test("the first year has nothing to compare with, so the next year is used", () => {
      expect(finding(withDebtService(), 2022, "taxes")).toMatchObject({ yearTag: 2023 });
    });
  });

  describe("breaks", () => {
    test("falls back to the latest tax-breaks year and compares with the first", () => {
      const item = finding(withDebtService(), 2025, "breaks");
      expect(item.yearTag).toBe(2024);
      expect(item.heading).toBe("For every 100 GEL of VAT collected, 23 GEL was given up in tax breaks");
      expect(item.detail).toBe("In 2023 the figure was 20 GEL");
      expect(item.visual).toEqual({
        kind: "bars",
        rows: [
          { label: "collected", value: 60, color: "#1E1B16" },
          { label: "given up", value: 14, color: "#B3402A", hatched: true },
        ],
      });
    });

    test("in the first tax-breaks year the detail gives the two amounts", () => {
      const item = finding(withDebtService(), 2023, "breaks");
      expect(item.yearTag).toBeNull();
      expect(item.detail).toBe("<1 mln collected · <1 mln given up");
    });
  });

  describe("debtRank", () => {
    test("debt service the largest field: f1top, then the next field and its gap", () => {
      const data = withDebtService(100e9);
      setValues(data, "spending.a", [58, 70, 80, 90e9, 100]);
      const item = finding(data, 2025, "debtRank");
      expect(item.heading).toBe("Debt service was the largest spending item");
      expect(item.detail).toBe("Next: label spending.a, 10.0 bn less");
      expect(finding(data, 2025, "debtRank", "ka").heading).toBe("ვალის მომსახურება — ყველაზე დიდი ხარჯი");
      expect(item.visual).toEqual({
        kind: "bars",
        rows: [
          { label: "label spending.debt_service", value: 100e9, color: "#8C5A32" },
          { label: "label spending.a", value: 90e9, color: "#000000" },
        ],
      });
    });

    test("fourth: the ordinal in each language, and the field above it", () => {
      const data = withDebtService(4);
      expect(finding(data, 2025, "debtRank").heading).toBe("Debt service was the 4th largest spending item");
      expect(finding(data, 2025, "debtRank", "ka").heading).toBe("ვალის მომსახურება — მე-4 უდიდესი ხარჯი");
      expect(finding(data, 2025, "debtRank").detail).toBe("label spending.c was only <1 mln more");
    });

    test("English ordinals: st, nd, rd and th, with 11th–13th", () => {
      const ordinal = (rank: number) => {
        const data = fixture();
        data.budget.fields = Array.from({ length: rank - 1 }, (_, index) => ({
          id: `spending.f${index}`, label: `f${index}`, color: "#000000", values: [1, 1, 1, 1000 - index, 1],
        }));
        data.budget.fields.push({ id: "spending.debt_service", label: "debt service", color: "#8C5A32", values: [1, 1, 1, 1, 1] });
        return finding(data, 2025, "debtRank").heading.match(/the (\S+) largest/)![1];
      };
      expect([2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ordinal)).toEqual(
        ["2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th", "112th"],
      );
    });

    test("a gap of 1% of the year's total or more: f1far", () => {
      const data = withDebtService(20);
      // 2025 total 90 + 30 + 5 + 20 = 145; spending.b is 10 above, well over 1%.
      expect(finding(data, 2025, "debtRank").detail).toBe("label spending.b was <1 mln more");
      expect(finding(data, 2025, "debtRank", "ka").detail).toBe("label spending.b — <1 მლნ-ით მეტი");
    });

    test("a planned year is marked as planned; an actual one is not", () => {
      const data = withDebtService(4);
      expect(finding(data, 2026, "debtRank").planned).toBe(true);
      expect(finding(data, 2025, "debtRank").planned).toBe(false);
    });
  });

  describe("types", () => {
    test("one type moving against all the others: f3onlyDown", () => {
      const data = withDebtService();
      setValues(data, "spending_type.other", [5, 5, 6]);
      const item = finding(data, 2025, "types");
      expect(item.heading).toBe("label spending_type.investment: −14.3% vs 2024");
      expect(item.detail).toBe("the only one of 4 spending types that fell");
      expect(item.visual).toEqual({ kind: "spark", values: [30, 35, 30], index: 2, color: "#000000" });
    });

    test("one type moving up against all the others: f3onlyUp", () => {
      const data = withDebtService();
      setValues(data, "spending_type.social_benefits", [40, 45, 40]);
      setValues(data, "spending_type.interest", [25, 25, 20]);
      setValues(data, "spending_type.investment", [30, 35, 40]);
      expect(finding(data, 2025, "types").heading).toBe("label spending_type.investment: +14.3% vs 2024");
      expect(finding(data, 2025, "types").detail).toBe("the only one of 4 spending types that grew");
      expect(finding(data, 2025, "types", "ka").detail).toBe("4 სახიდან ერთადერთი, რომელიც გაიზარდა");
    });

    test("“of {n}” counts every type with a value in both years, a zero base included, and names only one with a percentage", () => {
      const data = withDebtService();
      setValues(data, "spending_type.other", [0, 0, 4]); // 0 → 4: grew, no percentage
      setValues(data, "spending_type.investment", [30, 35, 40]);
      setValues(data, "spending_type.interest", [25, 25, 20]); // the only fall
      expect(finding(data, 2025, "types")).toMatchObject({ heading: "label spending_type.interest: −20.0% vs 2024", detail: "the only one of 4 spending types that fell" });
      // A lone riser from zero has no percentage, so the largest percentage change is named instead.
      setValues(data, "spending_type.social_benefits", [40, 45, 40]);
      setValues(data, "spending_type.investment", [30, 35, 30]);
      setValues(data, "spending_type.interest", [25, 25, 24]);
      expect(finding(data, 2025, "types").heading).toBe("label spending_type.investment: −14.3% vs 2024");
    });

    test("served data: 2004 counts all eight spending types", async () => {
      const { data } = await loadYearReviewData("en");
      expect(finding(data, 2004, "types").detail).toBe(`the only one of ${data.spendingTypes.types.length} spending types that fell`);
      expect(data.spendingTypes.types).toHaveLength(8);
    });

    test("otherwise the largest percentage change, with its amounts", () => {
      const item = finding(withDebtService(), 2025, "types");
      expect(item.heading).toBe("label spending_type.interest: +48.0% vs 2024");
      expect(item.detail).toBe("<1 mln → <1 mln · general government");
      expect(finding(withDebtService(), 2026, "types").yearTag).toBe(2025);
      expect(finding(withDebtService(), 2023, "types").yearTag).toBe(2024);
    });
  });

  describe("service", () => {
    test("repayments and interest against tax revenue, in the nearest year with both", () => {
      const item = finding(withDebtService(), 2026, "service");
      expect(item.yearTag).toBe(2025);
      expect(item.heading).toBe("Debt repayments and interest came to 8% of tax revenue");
      expect(item.detail).toBe("principal <1 mln · interest <1 mln");
      expect(item.visual).toEqual({
        kind: "bars",
        rows: [
          { label: "taxes", value: 125, color: "#1E1B16" },
          { label: "repayments and interest", value: 10, color: "#B3402A" },
        ],
      });
    });
  });

  describe("municipal", () => {
    test("the fewest places, largest first, whose spending passes half: 50 alone does not", () => {
      const data = withDebtService();
      data.municipal.places = [10, 50, 10, 30].map((totalGel, index) => ({
        code: `0${index + 1}`, label: `p${index + 1}`, regionId: "region.one", totalGel, populationPersons: totalGel / 10, perResidentGel: 10,
      }));
      const item = finding(data, 2025, "municipal");
      expect(item.heading).toBe("80% of municipal spending is in just 2 of the 4 municipalities");
      expect(item.detail).toBe("p2 50.0% · p4 30.0% · the other 2: 20.0%");
      expect(item.yearTag).toBeNull();
      expect(item.visual).toMatchObject({ kind: "split" });
      const parts = item.visual.kind === "split" ? item.visual.parts : [];
      expect(parts.map((part) => part.share)).toEqual([0.5, 0.3, 0.2]);
      expect(new Set(parts.map((part) => part.color)).size).toBe(3);
      expect(finding(data, 2025, "municipal", "ka").heading).toBe("მუნიციპალური ხარჯის 80% 4-⁠დან მხოლოდ 2 მუნიციპალიტეტზე მოდის");
    });

    test("the municipal year is tagged when the chosen year differs", () => {
      expect(finding(withDebtService(), 2024, "municipal").yearTag).toBe(2025);
      expect(finding(withDebtService(), 2025, "municipal").heading).toBe("60% of municipal spending is in just 1 of the 4 municipalities");
    });
  });

  test("details in realistic magnitudes read in mln and bn", () => {
    // The fixture scaled to lari the size of the served data: 10 → 1 bn, so 5 → 500 mln.
    const data = withDebtService();
    const scale = (values: (number | null)[]) => values.map((value) => (value === null ? null : value * 1e8));
    for (const row of [...data.budget.receipts, ...data.budget.fields, ...data.spendingTypes.types]) row.values = scale(row.values);
    data.spendingTypes.total = scale(data.spendingTypes.total);
    data.taxBreaks = { ...data.taxBreaks, vat: scale(data.taxBreaks.vat), income: scale(data.taxBreaks.income), all: scale(data.taxBreaks.all) };
    data.debt.service = { ...data.debt.service, principal: scale(data.debt.service.principal), interest: scale(data.debt.service.interest) };
    const detail = (id: Finding["id"], year = 2025, locale: "ka" | "en" = "en") => finding(data, year, id, locale).detail;
    expect(detail("taxes")).toBe("1.0 bn → 1.5 bn, +50.0% vs 2024");
    expect(detail("taxes", 2025, "ka")).toBe("1.0 მლრდ → 1.5 მლრდ · +50.0% 2024 წელთან");
    expect(detail("breaks", 2023)).toBe("5.0 bn collected · 1.0 bn given up");
    expect(detail("debtRank")).toBe("label spending.c was only 100 mln more");
    expect(detail("types")).toBe("2.5 bn → 3.7 bn · general government");
    expect(detail("service", 2026)).toBe("principal 800 mln · interest 200 mln");
  });

  test("English findings have no Georgian text, in the fixture and in the served data for every budget year", async () => {
    const text = (findings: Finding[]) => findings.flatMap((item) => [item.topic, item.heading, item.detail, ...(item.visual.kind === "bars" ? item.visual.rows.map((row) => row.label) : [])]);
    for (const year of withDebtService().budget.years) {
      for (const line of text(buildFindings(withDebtService(), year, enMessages, "en"))) expect(line).not.toMatch(GEORGIAN);
    }
    const { data } = await loadYearReviewData("en");
    for (const year of data.budget.years) {
      for (const line of text(buildFindings(data, year, enMessages, "en"))) expect(line).not.toMatch(GEORGIAN);
    }
  });
});
