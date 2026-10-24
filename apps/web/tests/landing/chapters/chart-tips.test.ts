import { describe, expect, it } from "vitest";
import { deficitTip, plannedYearText, revenueTip } from "../../../components/landing/chapters/chart-tips";
import type { DeficitChapter, RevenueSeries } from "../../../lib/landing/chapters/types";

const labels = {
  bnGel: "მლრდ ₾",
  mlnGel: "მლნ ₾",
  planned: "გეგმა",
  total: "სულ",
  taxes: "გადასახადები",
  imf: "IMF",
  vsGdp: "მშპ-სთან",
  inGel: "ლარში",
  deficit: "დეფიციტი",
  surplus: "პროფიციტი",
};

const revenue: RevenueSeries = {
  years: [2024, 2025],
  planned: [false, true],
  totals: [12e9, 14e9],
  taxShare: [1, 0.8571],
  bands: [
    { id: "vat", label: "დღგ", values: [8e9, 9e9] },
    { id: "income", label: "საშემოსავლო", values: [4e9, 3e9] },
    { id: "liabilities", label: "ვალდებულებების ზრდა", values: [null, 2e9] },
  ],
  peakBorrowing: null,
};
const colors = ["#28568e", "#50aed5", "var(--accent)"];

describe("revenueTip", () => {
  it("lists the top band first and shows a dash for a band without a value", () => {
    const tip = revenueTip(revenue, labels, colors, 0);
    expect(tip.rows.map((row) => row.name)).toEqual(["ვალდებულებების ზრდა", "საშემოსავლო", "დღგ"]);
    expect(tip.rows.map((row) => row.key)).toEqual(["var(--accent)", "#50aed5", "#28568e"]);
    expect(tip.rows[0].val).toBe("—");
    expect(tip.rows[2].val).toBe("8.00 მლრდ ₾");
  });

  it("puts the planned suffix in the title of a planned year only", () => {
    expect(revenueTip(revenue, labels, colors, 1).title).toBe("2025 (გეგმა)");
    expect(revenueTip(revenue, labels, colors, 0).title).toBe("2024");
    expect(plannedYearText(revenue, 1, "გეგმა")).toBe("2025 (გეგმა)");
  });

  it("closes with the total and the tax share", () => {
    expect(revenueTip(revenue, labels, colors, 1).foot).toBe("სულ 14.0 მლრდ ₾ · გადასახადები 86%");
  });
});

const deficit: DeficitChapter = {
  years: [2004, 2020, 2026],
  pctGdp: [1.234, -9.16, -2.5],
  gel: [0.3e9, -4.6e9, -2.9e9],
  projectionFrom: 2026,
  deepest: { year: 2020, pct: -9.16 },
  earlier: null,
  surplusRun: null,
};

describe("deficitTip", () => {
  it("titles a projected year with the forecast label", () => {
    expect(deficitTip(deficit, labels, 2).title).toBe("2026 · IMF");
    expect(deficitTip(deficit, labels, 1).title).toBe("2020");
    expect(deficitTip({ ...deficit, projectionFrom: null }, labels, 2).title).toBe("2026");
  });

  it("reads deficit for a negative balance and surplus for a positive one, with matching key colour", () => {
    const negative = deficitTip(deficit, labels, 1);
    expect(negative.foot).toBe("დეფიციტი");
    expect(negative.rows[0]).toEqual({ key: "var(--ink)", val: "−9.16%", name: "მშპ-სთან" });
    expect(negative.rows[1]).toEqual({ val: "−4.60 მლრდ ₾", name: "ლარში" });
    const positive = deficitTip(deficit, labels, 0);
    expect(positive.foot).toBe("პროფიციტი");
    expect(positive.rows[0].key).toBe("var(--positive)");
    expect(positive.rows[0].val).toBe("1.23%");
  });
});
