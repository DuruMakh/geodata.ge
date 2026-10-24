import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeficitChart, type DeficitLabels } from "../../../components/landing/chapters/deficit-chart";
import type { DeficitChapter } from "../../../lib/landing/chapters/types";

const labels: DeficitLabels = {
  title: "ზოგადი მთავრობის ბალანსი, % მშპ-სთან",
  bnGel: "მლრდ ₾",
  mlnGel: "მლნ ₾",
  deficit: "დეფიციტი",
  surplus: "პროფიციტი",
  forecast: "პროგნოზი",
  imf: "IMF-ის პროგნოზი",
  surplusRun: "პროფიციტი",
  vsGdp: "მშპ-სთან",
  inGel: "ლარში",
  deepest: "ყველაზე ღრმა",
  chartSummary: "ზოგადი მთავრობის ბალანსი მშპ-სთან",
};

const data = (overrides: Partial<DeficitChapter> = {}): DeficitChapter => ({
  years: [2019, 2020, 2021, 2022, 2023],
  pctGdp: [-1.8, -9.2, -6, -2.3, -1.5],
  gel: [-1e9, -4.6e9, -3.4e9, -1.7e9, -1.2e9],
  projectionFrom: 2023,
  deepest: { year: 2020, pct: -9.2 },
  earlier: null,
  surplusRun: null,
  ...overrides,
});

describe("DeficitChart (server render)", () => {
  const html = renderToStaticMarkup(<DeficitChart data={data()} labels={labels} />);
  const noProjection = renderToStaticMarkup(<DeficitChart data={data({ projectionFrom: null })} labels={labels} />);

  it("has an HTML legend: deficit, surplus, forecast and the -3% rule, with colour keys", () => {
    const items = [...html.matchAll(/<li[^>]*data-key="([^"]+)"[^>]*><i[^>]*class="([^"]*)"[^>]*><\/i>([^<]*)<\/li>/g)];
    expect(items.map((m) => m[1])).toEqual(["deficit", "surplus", "forecast", "rule"]);
    expect(items[0][2]).toContain("bg-[var(--ink)]");
    expect(items[1][2]).toContain("bg-[var(--positive)]");
    expect(items[2][2]).toContain("opacity-40");
    expect(items[3][2]).toContain("bg-[var(--accent)]");
    expect(items.map((m) => m[3])).toEqual(["დეფიციტი", "პროფიციტი", "პროგნოზი", "−3%"]);
  });

  it("drops the forecast entry when there is no projection", () => {
    expect(noProjection).not.toContain('data-key="forecast"');
  });

  it("describes the canvas with the latest actual year and the deepest year, not the projection", () => {
    const canvas = html.match(/<canvas[^>]*>/)?.[0] ?? "";
    expect(canvas).toContain('role="img"');
    expect(canvas).toContain("ზოგადი მთავრობის ბალანსი მშპ-სთან 2019–2023");
    expect(canvas).toContain("2022: −2.3% მშპ-სთან");
    expect(canvas).toContain("ყველაზე ღრმა: −9.2%, 2020");
    expect(noProjection.match(/<canvas[^>]*>/)?.[0]).toContain("2023: −1.5% მშპ-სთან");
  });

  it("keeps the chart in a fixed-height wrapper with a two-row tooltip hidden from assistive technology", () => {
    expect(html).toMatch(/<div[^>]*class="relative h-\[340px\][^"]*"[^>]*><canvas/);
    const tip = html.match(/<div[^>]*aria-hidden="true"[^>]*opacity-0[^>]*>(.*?)<\/div><\/div><\/figure>/)?.[1] ?? "";
    expect((tip.match(/<b /g) ?? []).length).toBe(2);
  });
});
