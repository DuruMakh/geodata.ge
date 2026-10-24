import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { coverageBar, SourcesSection, type SourcesLabels } from "../../../components/landing/chapters/sources-section";
import type { HomeChapters } from "../../../lib/landing/chapters/types";

const labels: SourcesLabels = {
  title: "ყოველი ციფრი — პირველწყარომდე",
  lede: "თითოეული რიცხვი უკავშირდება ოფიციალურ წყაროს.",
  meta: "3 კრებული · ბოლო გადამოწმება 2026-10-20",
  methodologyLink: "მეთოდოლოგიის ნახვა →",
  flow: "წყარო → მეთოდი → შემოწმება → მონაცემი",
  steps: [
    { title: "ოფიციალური დოკუმენტის შენარჩუნება", text: "ტექსტი 1" },
    { title: "კლასიფიკაცია და გარდაქმნის წესი", text: "ტექსტი 2" },
    { title: "შეჯერება და ხარისხის შემოწმება", text: "ტექსტი 3" },
    { title: "ჩამოსატვირთი მონაცემები", text: "ტექსტი 4" },
  ],
  coverageTitle: "კრებულები და მათი დროითი დაფარვა",
  coverageHint: "მარჯვნივ — პირველწყაროების რაოდენობა",
  axisName: "კრებული",
  since: (year) => `${year}-დან`,
  total: "3 კრებული · მითითებული პირველწყაროები",
};

const sources: HomeChapters["sources"] = {
  rows: [
    { name: "სახელმწიფო ბიუჯეტი", firstYear: 2004, lastYear: 2025, files: 120 },
    { name: "მშპ", firstYear: 1960, lastYear: 2024, files: 35 },
    { name: "ინფლაცია", firstYear: 1990, lastYear: 2030, files: 7 },
  ],
  totalFiles: 162,
  reviewedAt: "2026-10-20",
};

const render = (locale: "ka" | "en" = "ka") =>
  renderToStaticMarkup(<SourcesSection sources={sources} labels={labels} locale={locale} />);

describe("coverageBar", () => {
  it("places the bar on the 1990-2030 axis", () => {
    expect(coverageBar(2004, 2025)).toEqual({ left: (14 / 40) * 100, width: (22 / 40) * 100 });
  });

  it("cuts a bar that starts before the axis at its left edge", () => {
    expect(coverageBar(1960, 2024)).toEqual({ left: 0, width: (35 / 40) * 100 });
  });

  it("fills the whole axis for 1990-2029 and stops at 2030 beyond it", () => {
    expect(coverageBar(1990, 2029)).toEqual({ left: 0, width: 100 });
    expect(coverageBar(1990, 2030)).toEqual({ left: 0, width: 100 });
  });
});

describe("SourcesSection", () => {
  it("is the #sources chapter with its title and lede", () => {
    const html = render();
    expect(html).toContain('id="sources"');
    expect(html).toContain("ყოველი ციფრი — პირველწყარომდე");
    expect(html).toContain("თითოეული რიცხვი უკავშირდება ოფიციალურ წყაროს.");
    expect(html).toContain("3 კრებული · ბოლო გადამოწმება 2026-10-20");
  });

  it("lists the four steps in order, numbered", () => {
    const html = render();
    const items = html.match(/<li class="home-step">/g) ?? [];
    expect(items).toHaveLength(4);
    expect(html.indexOf("ოფიციალური დოკუმენტის შენარჩუნება")).toBeLessThan(html.indexOf("ჩამოსატვირთი მონაცემები"));
    for (const n of ["01", "02", "03", "04"]) expect(html).toContain(`>${n}</div>`);
  });

  it("renders one row per source with its years and file count", () => {
    const html = render();
    expect(html.match(/home-cov-row/g)).toHaveLength(3);
    expect(html).toMatch(/სახელმწიფო ბიუჯეტი<\/span>.*?2004–2025.*?>120<\/span>/);
    expect(html).toMatch(/მშპ<\/span>.*?1960–2024.*?>35<\/span>/);
    expect(html).toMatch(/ინფლაცია<\/span>.*?1990–2030.*?>7<\/span>/);
  });

  it("shows the total of files and collections", () => {
    const html = render();
    expect(html).toContain("3 კრებული · მითითებული პირველწყაროები");
    expect(html).toMatch(/<b class="[^"]*">162<\/b>/);
  });

  it("links the methodology page, with the /en prefix in English", () => {
    expect(render("ka")).toMatch(/href="\/methodology"[^>]*>მეთოდოლოგიის ნახვა →/);
    expect(render("en")).toMatch(/href="\/en\/methodology"/);
  });

  it("tags only the sources that start before 1990", () => {
    const html = render();
    expect(html.match(/1960-დან/g)).toHaveLength(1);
    expect(html).not.toContain("1990-დან");
    expect(html).not.toContain("2004-დან");
  });

  it("sets each bar's left and width from the 1990-2030 axis, staggered by row", () => {
    const html = render();
    expect(html).toContain("left:35.00%;width:55.00%;transition-delay:0ms");
    expect(html).toContain("left:0.00%;width:87.50%;transition-delay:30ms");
    expect(html).toContain("left:0.00%;width:100.00%;transition-delay:60ms");
  });

  it("hides the decorative bars and tick marks from assistive technology", () => {
    const html = render();
    expect(html.match(/<i aria-hidden="true" class="home-cov-bar/g)).toHaveLength(3);
    expect(html).toContain(">2030</span>");
  });
});
