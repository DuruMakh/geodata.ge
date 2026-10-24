import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpendingChapter, type SpendingLabels } from "../../../components/landing/chapters/spending-chapter";
import type { SpendingSeries } from "../../../lib/landing/chapters/types";

const labels: SpendingLabels = {
  year: "წელი",
  total: "მთლიანი ხარჯი",
  bnGel: "მლრდ ₾",
  mlnGel: "მლნ ₾",
  planned: "გეგმა",
  maxFrame: "2025 წლის ბიუჯეტის მასშტაბი",
  play: "გაგრძელება",
  pause: "პაუზა",
  replay: "ჩართე 2004-დან",
  yearPicker: "წლის არჩევა",
  axisCaption: "ხარჯები წლების მიხედვით",
  listCaption: "სფეროები",
  share: "ბიუჯეტის წილი",
  vsPrevious: "წინა წელთან: ",
  chartSummary: "სახელმწიფო ბიუჯეტის ხარჯები სფეროების მიხედვით; ფართობი ხარჯის პროპორციულია",
  unavailable: "ვიზუალი ვერ ჩაიტვირთა — მონაცემები ხელმისაწვდომია ექსპლორერში",
  largest: "ყველაზე დიდი",
};

const years = [2023, 2024, 2025];
const field = (id: string, label: string, values: number[]) => ({ id, label, values });
const fields = [
  field("social_protection", "სოციალური დაცვა", [7_000_000_000, 7_800_000_000, 8_400_000_000]),
  field("health", "ჯანდაცვა", [3_000_000_000, 3_300_000_000, 3_600_000_000]),
  field("education", "განათლება", [2_100_000_000, 2_300_000_000, 2_500_000_000]),
  field("culture", "კულტურა", [100_000_000, 110_000_000, 120_000_000]),
  field("spending.other_unclassified", "სხვა", [50_000_000, 60_000_000, 70_000_000]),
];
const totals = years.map((_, i) => fields.reduce((sum, f) => sum + f.values[i], 0));

const data = (planned: boolean[]): SpendingSeries => ({ years, planned, totals, fields });

describe("SpendingChapter (server render = latest year)", () => {
  const html = renderToStaticMarkup(<SpendingChapter data={data([false, false, true])} labels={labels} />);
  const unplanned = renderToStaticMarkup(<SpendingChapter data={data([false, false, false])} labels={labels} />);

  it("shows the latest year with the planned suffix only when that year is planned", () => {
    expect(html).toMatch(/>2025<small[^>]*>[^<]*გეგმა<\/small>/);
    expect(html).toContain("14.7");
    expect(unplanned).toContain(">2025</div>");
    expect(unplanned).not.toContain("გეგმა");
  });

  it("has a play button whose label and visible text agree, with a decorative icon", () => {
    const button = html.match(/<button[^>]*aria-label="ჩართე 2004-დან"[^>]*>(.*?)<\/button>/)?.[1] ?? "";
    expect(button).toContain('aria-hidden="true"');
    expect(button).toContain("ჩართე 2004-დან");
  });

  it("has a range input from the first to the latest year with a screen-reader label", () => {
    const input = html.match(/<input[^>]*type="range"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('min="2023"');
    expect(input).toContain('max="2025"');
    expect(input).toContain('value="2025"');
    expect(input).toContain('step="1"');
    const id = input.match(/id="([^"]+)"/)?.[1];
    expect(html).toMatch(new RegExp(`<label[^>]*class="sr-only"[^>]*for="${id}"[^>]*>წლის არჩევა</label>|<label[^>]*for="${id}"[^>]*class="sr-only"[^>]*>წლის არჩევა</label>`));
  });

  it("lists every field as a button, biggest first", () => {
    const rows = [...html.matchAll(/<button[^>]*data-field="([^"]+)"[^>]*>(.*?)<\/button>/g)];
    expect(rows.map((row) => row[1])).toEqual(fields.map((f) => f.id));
    expect(rows[0][2]).toContain("სოციალური დაცვა");
    expect(rows[0][2]).toContain("8.40 მლრდ ₾");
    expect(rows[0][2]).toContain("57.2%");
  });

  it("describes the canvas as an image with the year, total and largest field", () => {
    const canvas = html.match(/<canvas[^>]*>/)?.[0] ?? "";
    expect(canvas).toContain('role="img"');
    expect(canvas).toContain("სახელმწიფო ბიუჯეტის ხარჯები სფეროების მიხედვით");
    expect(canvas).toContain("2025 (გეგმა)");
    expect(canvas).toContain("14.7 მლრდ ₾");
    expect(canvas).toContain("ყველაზე დიდი: სოციალური დაცვა");
  });

  it("marks a planned year in the side-list heading", () => {
    expect(html).toContain("სფეროები · 2025 (გეგმა)");
    expect(unplanned).toContain("სფეროები · 2025</div>");
  });

  it("keeps the tooltip out of the accessibility tree", () => {
    expect(html).toMatch(/<div[^>]*aria-hidden="true"[^>]*opacity-0/);
  });
});
