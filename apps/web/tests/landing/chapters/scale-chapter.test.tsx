import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScaleChapter, type ScaleLabels } from "../../../components/landing/chapters/scale-chapter";
import type { ScaleChapter as ScaleData } from "../../../lib/landing/chapters/types";

const labels: ScaleLabels = {
  squareNote: "■ = 10 მლნ ₾",
  ofGdp: "მშპ-ის",
  cumulative: "დაგროვილი ჯამი",
  included: "შედის: ",
  notIncluded: "მიღმაა: ",
  bnGel: "მლრდ ₾",
  square: "კვადრატი",
  squareNoteSpoken: "თითოეული 10 მილიონი ლარი",
  measureGroup: "მაჩვენებლის არჩევა",
  unavailable: "ვიზუალი ვერ ჩაიტვირთა — მონაცემები ხელმისაწვდომია ექსპლორერში",
};

const gdpGel = 104_598_139_883;
const measure = (id: ScaleData["measures"][number]["id"], label: string, valueGel: number): ScaleData["measures"][number] => ({
  id,
  label,
  valueGel,
  squares: Math.round(valueGel / 10_000_000),
  share: valueGel / gdpGel,
});

const data: ScaleData = {
  year: 2025,
  gdpGel,
  squares: 10460,
  defaultId: "spending",
  measures: [
    measure("gdp", "ნომინალური მშპ", gdpGel),
    measure("revenue", "ნაერთი ბიუჯეტის შემოსულობები", 31_200_000_000),
    measure("spending", "სახელმწიფო ბიუჯეტის ხარჯები", 33_400_000_000),
    measure("debt", "მთავრობის ვალი", 41_000_000_000),
  ],
};

describe("ScaleChapter (server render = default state)", () => {
  const html = renderToStaticMarkup(<ScaleChapter data={data} labels={labels} />);

  it("renders one button per measure with the default measure pressed", () => {
    const buttons = [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>/g)];
    expect(buttons).toHaveLength(data.measures.length);
    expect(buttons.map((b) => b[1])).toEqual(["false", "false", "true", "false"]);
    const pressed = html.match(/<button[^>]*aria-pressed="true"[^>]*>(.*?)<\/button>/)?.[1] ?? "";
    expect(pressed).toContain("სახელმწიფო ბიუჯეტის ხარჯები");
    expect(pressed).toContain("33.4\u00a0მლრდ ₾");
  });

  it("announces the selected measure in a polite live region", () => {
    const live = html.match(/<div aria-live="polite"[^>]*>(.*?)<\/div><\/div>/)?.[1] ?? "";
    expect(live).toContain("სახელმწიფო ბიუჯეტის ხარჯები");
    expect(live).toContain("33.4");
    expect(live).toContain("31.9% მშპ-ის");
    expect(live).toContain("3,340 კვადრატი");
  });

  it("describes the canvas as an image naming the squares and the measure", () => {
    const canvas = html.match(/<canvas[^>]*>/)?.[0] ?? "";
    expect(canvas).toContain('role="img"');
    expect(canvas).toContain('aria-label="10,460 კვადრატი, თითოეული 10 მილიონი ლარი; სახელმწიფო ბიუჯეტის ხარჯები: 33.4 მლრდ ₾, 31.9% მშპ-ის (3,340 კვადრატი)"');
  });

  it("names the button group", () => {
    expect(html).toContain('role="group" aria-label="მაჩვენებლის არჩევა"');
  });

  it("keeps the tooltip out of the accessibility tree and the marker label on the default measure", () => {
    expect(html).toMatch(/<div[^>]*aria-hidden="true"[^>]*opacity-0/);
    expect(html).toContain(">31.9% მშპ-ის</span>");
    expect(html).toContain("10,460 კვადრატი = ნომინალური მშპ, 2025");
  });
});
