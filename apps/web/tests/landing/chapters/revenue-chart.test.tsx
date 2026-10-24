import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RevenueChart, type RevenueLabels } from "../../../components/landing/chapters/revenue-chart";
import type { RevenueBandId, RevenueSeries } from "../../../lib/landing/chapters/types";

const labels: RevenueLabels = {
  title: "ნაერთი ბიუჯეტის შემოსულობები, მლრდ ₾",
  bnGel: "მლრდ ₾",
  mlnGel: "მლნ ₾",
  planned: "გეგმა",
  total: "სულ",
  taxes: "გადასახადები",
  peakFrom: "ვალდებულებების ზრდიდან",
  chartSummary: "ნაერთი ბიუჯეტის შემოსულობები",
  unavailable: "ვიზუალი ვერ ჩაიტვირთა — მონაცემები ხელმისაწვდომია ექსპლორერში",
};

const bandLabels: Record<RevenueBandId, string> = {
  vat: "დღგ",
  income: "საშემოსავლო",
  profit: "მოგების",
  excise: "აქციზი",
  otherTaxes: "სხვა გადასახადები",
  otherIncome: "სხვა შემოსავლები",
  liabilities: "ვალდებულებების ზრდა",
};
const order = Object.keys(bandLabels) as RevenueBandId[];
const colors = ["#28568e", "#50aed5", "#007f69", "#83c084", "#7668ad", "#d2ab5f", "var(--accent)"];

const years = [2023, 2024, 2025];
const values: Record<RevenueBandId, (number | null)[]> = {
  vat: [8e9, 9e9, 10e9],
  income: [4e9, 4.5e9, 5e9],
  profit: [3e9, 3.2e9, 3.4e9],
  excise: [2e9, 2.2e9, 2.4e9],
  otherTaxes: [3e9, 3.1e9, 3.2e9],
  otherIncome: [2e9, 2.1e9, 2.2e9],
  liabilities: [null, 3e9, 3.2e9],
};
const data = (planned: boolean[]): RevenueSeries => ({
  years,
  planned,
  totals: years.map((_, i) => order.reduce((sum, id) => sum + (values[id][i] ?? 0), 0)),
  taxShare: [0.84, 0.8, 0.79],
  bands: order.map((id) => ({ id, label: bandLabels[id], values: values[id] })),
  peakBorrowing: { year: 2025, share: 0.099 },
});

describe("RevenueChart (server render)", () => {
  const html = renderToStaticMarkup(<RevenueChart data={data([false, false, true])} labels={labels} />);
  const unplanned = renderToStaticMarkup(<RevenueChart data={data([false, false, false])} labels={labels} />);

  it("lists the bands in order with their colours in an HTML legend", () => {
    const items = [...html.matchAll(/<li[^>]*data-band="([^"]+)"[^>]*><i[^>]*style="background:([^"]+)"[^>]*><\/i>([^<]*)<\/li>/g)];
    expect(items.map((m) => m[1])).toEqual(order);
    expect(items.map((m) => m[2])).toEqual(colors);
    expect(items.map((m) => m[3])).toEqual(order.map((id) => bandLabels[id]));
  });

  it("adds a planned entry to the legend only when a year is planned", () => {
    expect(html).toMatch(/data-band="planned"[^>]*>.*?გეგმა<\/li>/);
    expect(unplanned).not.toContain('data-band="planned"');
  });

  it("shows the chart title above the chart", () => {
    expect(html).toContain("<b");
    expect(html).toContain("ნაერთი ბიუჯეტის შემოსულობები, მლრდ ₾</b>");
  });

  it("describes the canvas as an image with the latest year, its total and tax share, marking a planned year", () => {
    const canvas = html.match(/<canvas[^>]*>/)?.[0] ?? "";
    expect(canvas).toContain('role="img"');
    expect(canvas).toContain("ნაერთი ბიუჯეტის შემოსულობები 2023–2025");
    expect(canvas).toContain("დღგ, საშემოსავლო");
    expect(canvas).toContain("2025 (გეგმა): 29.4\u00a0მლრდ ₾, გადასახადები 79%");
    expect(unplanned).toContain("2025: 29.4\u00a0მლრდ ₾");
  });

  it("keeps the chart in a fixed-height wrapper and the tooltip, one row per band, out of the accessibility tree", () => {
    expect(html).toMatch(/<div[^>]*class="relative h-\[360px\][^"]*"[^>]*><canvas/);
    const tip = html.match(/<div[^>]*aria-hidden="true"[^>]*opacity-0[^>]*>(.*?)<\/div><\/div><\/figure>/)?.[1] ?? "";
    expect((tip.match(/<b /g) ?? []).length).toBe(7);
  });

  it("puts the title in a figcaption and draws the planned legend swatch as paper lines over a fill", () => {
    expect(html).toMatch(/<figcaption[^>]*>\s*<b[^>]*>ნაერთი ბიუჯეტის შემოსულობები, მლრდ ₾<\/b>/);
    const swatch = html.match(/data-band="planned"[^>]*><i[^>]*class="([^"]*)"/)?.[1] ?? "";
    expect(swatch).toContain("var(--paper)");
    expect(swatch).toContain(",var(--control)");
  });
});
