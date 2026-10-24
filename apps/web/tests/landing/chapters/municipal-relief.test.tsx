import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MunicipalRelief, type MunicipalLabels } from "../../../components/landing/chapters/municipal-relief";
import type { MunicipalChapter, ReliefPlace } from "../../../lib/landing/chapters/types";

const labels: MunicipalLabels = {
  bnGel: "მლრდ ₾",
  mlnGel: "მლნ ₾",
  gel: "₾",
  budget: "ბიუჯეტი",
  perResident: "ერთ მოსახლეზე",
  rank: "რანგი ბიუჯეტით",
  occupied: "ოკუპირებული ტერიტორია",
  occupiedNote: "მუნიციპალური ბიუჯეტის მონაცემები არ არსებობს",
  total: "სულ",
  share: "წილი",
  chartSummary: "საქართველოს მუნიციპალიტეტების ბიუჯეტის სამგანზომილებიანი რელიეფი",
  unavailable: "ვიზუალი ვერ ჩაიტვირთა — მონაცემები ხელმისაწვდომია ექსპლორერში",
};

const place = (code: string, name: string, totalGel: number, rank: number, city = false): ReliefPlace => ({
  code,
  name,
  totalGel,
  perResidentGel: 1500,
  rank,
  city,
});
const places = [
  place("04", "თბილისი", 2.1084e9, 1),
  place("06", "ბათუმი", 486.2e6, 2, true),
  place("20", "ქუთაისი", 159.3e6, 3, true),
  place("25", "ზუგდიდი", 90e6, 4),
];
const data: MunicipalChapter = {
  year: 2025,
  totalGel: places.reduce((sum, p) => sum + p.totalGel, 0),
  places,
  grid: { cols: 4, rows: 1, cells: [0, 1, 2, 3] },
};

describe("MunicipalRelief (server render)", () => {
  const html = renderToStaticMarkup(<MunicipalRelief data={data} labels={labels} />);

  it("renders a full-bleed reveal wrapper holding a figure with the fixed-height stage", () => {
    expect(html).toMatch(/^<div class="home-rv home-muni"><figure><div class="home-muni-stage"><canvas/);
  });

  it("describes the canvas as an image with the year, the total of all places and the largest place's share", () => {
    const canvas = html.match(/<canvas[^>]*>/)?.[0] ?? "";
    expect(canvas).toContain('role="img"');
    expect(canvas).toContain(
      'aria-label="საქართველოს მუნიციპალიტეტების ბიუჯეტის სამგანზომილებიანი რელიეფი, 2025: სულ 2.84 მლრდ ₾; თბილისი 2.11 მლრდ ₾, წილი 74.1%"',
    );
  });

  it("names the three largest places in hidden HTML labels", () => {
    const layer = html.match(/<div aria-hidden="true" class="pointer-events-none absolute inset-0">(.*?)<\/div>/)?.[1] ?? "";
    const texts = [...layer.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(texts).toEqual(["თბილისი · 2.11 მლრდ ₾", "ბათუმი · 486 მლნ ₾", "ქუთაისი · 159 მლნ ₾"]);
  });

  it("keeps the two-row tooltip out of the accessibility tree", () => {
    const tip = html.match(/<div aria-hidden="true"[^>]*opacity-0[^>]*>(.*?)<\/div><\/div><\/figure>/)?.[1] ?? "";
    expect((tip.match(/<b /g) ?? []).length).toBe(2);
  });
});
