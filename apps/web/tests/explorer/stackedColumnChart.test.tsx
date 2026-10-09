import { describe, expect, it } from "vitest";
import { buildStackReadout, StackedColumnChart, type StackedColumnChartProps } from "../../components/main-explorer/stacked-column-chart";
import { chartGeometry, renderGeorgianMarkup } from "../helpers/render-localized";

const props: StackedColumnChartProps = {
  periods: [24157, 24158],
  segments: [
    { id: "a", label: "Food", color: "#B3402A", values: [1.5, 1.2] },
    { id: "b", label: "Communication", color: "#4A707A", values: [-0.3, -0.2] },
  ],
  overlay: { label: "Headline", values: [1.2, 1.0] },
  formatPeriod: (period: number) => String(period),
  formatValue: (value: number) => value.toFixed(1),
  ariaLabel: "Contribution to inflation",
};

const markup = renderGeorgianMarkup(<StackedColumnChart {...props} />);

/** The y of the first rect carrying this segment id. */
function segmentY(html: string, id: string): number {
  const rect = new RegExp(`<rect[^>]*data-segment="${id}"[^>]*>`).exec(html)?.[0] ?? "";
  return Number(/\by="([-\d.]+)"/.exec(rect)?.[1]);
}

describe("StackedColumnChart", () => {
  it("preserves monthly calendar boundaries by default", () => {
    const months = Array.from({ length: 36 }, (_, i) => 24288 + i);
    const monthly = chartGeometry(renderGeorgianMarkup(<StackedColumnChart {...props} periods={months} formatPeriod={period => `month.${period}`} />), "desktop");
    expect(monthly.match(/>month\.\d+<\/text>/g)).toHaveLength(3);
  });
  it("draws one rect per segment and period", () => {
    expect(chartGeometry(markup, "desktop").match(/data-segment="/g)).toHaveLength(4);
    expect(chartGeometry(markup, "mobile").match(/data-segment="/g)).toHaveLength(4);
  });

  it("puts negative segments below the zero line", () => {
    const zero = Number(/<line[^>]*data-zero[^>]*\by1="([-\d.]+)"/.exec(markup)?.[1]);
    expect(Number.isFinite(zero)).toBe(true);
    expect(segmentY(markup, "b")).toBeGreaterThanOrEqual(zero - 0.01);
  });

  it("draws the overlay over the stack", () => {
    expect(markup).toContain("data-overlay");
    expect(markup.indexOf("data-overlay")).toBeGreaterThan(markup.indexOf('data-segment="a"'));
  });

  it("names every segment for assistive technology", () => {
    expect(markup).toContain('aria-label="Contribution to inflation"');
    expect(markup).toContain('role="img"');
    expect(markup).toContain("Food");
    expect(markup).toContain("Communication");
    expect(markup).toContain("Headline");
  });

  it("renders nothing but an empty frame with no periods", () => {
    const empty = renderGeorgianMarkup(<StackedColumnChart {...props} periods={[]} segments={[]} overlay={null} />);
    expect(empty).not.toContain("data-segment=");
    expect(empty).toContain('role="img"');
  });

  it("uses the chart tokens, not undefined custom properties", () => {
    expect(markup).not.toContain("var(--rule)");
    expect(markup).not.toContain("ink-soft");
    expect(markup).not.toContain("font-mono");
    expect(markup).toContain('fill="#6A6050"');
    expect(markup).toContain("var(--font-numeric)");
  });

  it("sits in the shared scroll frame and is keyboard focusable", () => {
    expect(markup).toContain('data-testid="stack-chart-frame"');
    expect(markup).toMatch(/<svg[^>]*tabindex="0"/);
    expect(markup).toMatch(/<svg[^>]*aria-describedby="[^"]+"/);
  });

  // The first column was centred on the plot's left edge and drawn over the
  // y-axis labels ("250(" for 2500); the axis printed 5000 where lists say 5,000.
  it("keeps every column inside the plot and groups axis thousands", () => {
    const years = Array.from({ length: 16 }, (_, index) => 2010 + index);
    const wide = renderGeorgianMarkup(
      <StackedColumnChart
        {...props}
        periods={years}
        segments={[
          { id: "employed", label: "Employed", color: "#1F6E56", values: years.map(() => 1300) },
          { id: "outside", label: "Outside", color: "#8A7B64", values: years.map(() => 1850) },
        ]}
        overlay={null}
      />,
    );
    const rects = [...chartGeometry(wide, "desktop").matchAll(/<rect[^>]*data-segment="[^"]+"[^>]*>/g)].map((match) => ({
      x: Number(/\bx="([-\d.]+)"/.exec(match[0])?.[1]),
      width: Number(/\bwidth="([-\d.]+)"/.exec(match[0])?.[1]),
    }));
    expect(rects.length).toBe(32);
    expect(Math.min(...rects.map((rect) => rect.x))).toBeGreaterThanOrEqual(74);
    expect(Math.max(...rects.map((rect) => rect.x + rect.width))).toBeLessThanOrEqual(920 - 30);

    const axis = [...wide.matchAll(/<text[^>]*text-anchor="end"[^>]*>([^<]+)<\/text>/g)].map((match) => match[1]);
    expect(axis).toContain("3,500");
    expect(axis).not.toContain("3500");
  });

  // D1: the phone drawing fits the frame (340 units before measuring, one per
  // pixel) with its columns inside the plot and a thinned, collision-free axis.
  it("draws a phone geometry that keeps columns inside and labels the first and latest period", () => {
    const years = Array.from({ length: 16 }, (_, index) => 2010 + index);
    const wide = renderGeorgianMarkup(
      <StackedColumnChart
        {...props}
        periods={years}
        segments={[{ id: "employed", label: "Employed", color: "#1F6E56", values: years.map(() => 1300) }]}
        overlay={null}
      />,
    );
    const phone = chartGeometry(wide, "mobile");
    expect(phone).toMatch(/viewBox="0 0 340 \d+"/);
    expect(chartGeometry(wide, "desktop")).toContain('viewBox="0 0 920 320"');
    const rects = [...phone.matchAll(/<rect[^>]*data-segment="[^"]+"[^>]*>/g)].map((match) => ({
      x: Number(/\bx="([-\d.]+)"/.exec(match[0])?.[1]),
      width: Number(/\bwidth="([-\d.]+)"/.exec(match[0])?.[1]),
    }));
    expect(rects.length).toBe(16);
    expect(Math.max(...rects.map((rect) => rect.x + rect.width))).toBeLessThanOrEqual(340 - 12);
    const labels = [...phone.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="start"[^>]*>(\d{4})<\/text>/g)].map((match) => ({
      x: Number(match[1]),
      text: match[2]!,
    }));
    expect(labels[0]!.text).toBe("2010");
    expect(labels.at(-1)!.text).toBe("2025");
    expect(labels.length).toBeLessThan(16);
    // Four-digit mono labels are 26.4 units wide; consecutive ones never touch.
    for (let index = 1; index < labels.length; index += 1) expect(labels[index]!.x - labels[index - 1]!.x).toBeGreaterThan(26.4);
    expect(labels.at(-1)!.x + 26.4).toBeLessThanOrEqual(340);
  });

  // Annual periods (unemployment) were laid out as months: 2016 was the only
  // "January" (2016 % 12 === 0), so labels fell back to every third year and the
  // lattice had one dot column per year instead of the two that line charts use.
  it("lays annual periods out as years: year-rule labels and two lattice columns per year", () => {
    const years = Array.from({ length: 16 }, (_, index) => 2010 + index);
    const render = (periodsPerYear?: number) =>
      chartGeometry(
        renderGeorgianMarkup(
          <StackedColumnChart
            {...props}
            periods={years}
            periodsPerYear={periodsPerYear}
            segments={[{ id: "employed", label: "Employed", color: "#1F6E56", values: years.map(() => 1300) }]}
            overlay={null}
          />,
        ),
        "desktop",
      );
    const annual = render(1);
    const labels = [...annual.matchAll(/<text[^>]*text-anchor="middle"[^>]*>(\d{4})<\/text>/g)].map((match) => match[1]);
    expect(labels).toEqual(["2010", "2012", "2014", "2016", "2018", "2020", "2022", "2025"]);
    const pitch = (svg: string) => Number(/<pattern[^>]*\bwidth="([\d.]+)"/.exec(svg)?.[1]);
    const yearPitch = (920 - 74 - 30) * (15 / 16) / 15;
    expect(pitch(annual)).toBeCloseTo(yearPitch / 2, 1);
    // Monthly is the default (inflation contributions) and keeps its calendar lattice.
    expect(pitch(render(undefined))).toBeCloseTo(yearPitch, 1);
  });

  it("ends the headline overlay in a dot", () => {
    expect(markup).toContain("data-overlay-end");
  });

  it("has no per-bar hover rectangles and no in-flow readout", () => {
    expect(markup).not.toContain('fill="transparent"');
    expect(markup).not.toContain("mt-2 font-mono");
  });

  describe("readout rows", () => {
    const segment = (id: string, value: number, extra: object = {}) => ({ id, label: id, color: "#000", values: [value], ...extra });
    // Six gains and six losses, interleaved so neither the input nor the signed order is the answer.
    const segments = [
      segment("in:a", 5, { readoutLabel: "A", marker: "up" }),
      segment("out:a", -50, { readoutLabel: "A", marker: "down" }),
      segment("in:b", 40, { readoutLabel: "B", marker: "up" }),
      segment("out:b", -4, { readoutLabel: "B", marker: "down" }),
      segment("in:c", 30, { readoutLabel: "C", marker: "up" }),
      segment("out:c", -30, { readoutLabel: "C", marker: "down" }),
      segment("in:d", 3, { readoutLabel: "D", marker: "up" }),
      segment("out:d", -40, { readoutLabel: "D", marker: "down" }),
      segment("in:e", 20, { readoutLabel: "E", marker: "up" }),
      segment("out:e", -2, { readoutLabel: "E", marker: "down" }),
      segment("in:f", 10, { readoutLabel: "F", marker: "up" }),
      segment("out:f", -20, { readoutLabel: "F", marker: "down" }),
    ];

    it("keeps today's order and cap by default: ranked by signed value, ten rows, the rest counted", () => {
      const { rows, hidden } = buildStackReadout(segments, 0, "value", 10);
      expect(rows.map((row) => row.id)).toEqual(["in:b", "in:c", "in:e", "in:f", "in:a", "in:d", "out:e", "out:b", "out:f", "out:c"]);
      expect(hidden).toBe(2);
      // Without the optional fields nothing extra reaches the row.
      const plain = buildStackReadout([segment("x", 1)], 0, "value", 10).rows[0]!;
      expect(Object.keys(plain).sort()).toEqual(["color", "id", "label", "value"]);
    });

    it("lists every gain by size, then every loss by size, when asked, and hides nothing at a cap of twelve", () => {
      const { rows, hidden } = buildStackReadout(segments, 0, "sign-then-magnitude", 12);
      expect(rows.map((row) => row.id)).toEqual(["in:b", "in:c", "in:e", "in:f", "in:a", "in:d", "out:a", "out:d", "out:c", "out:f", "out:b", "out:e"]);
      expect(hidden).toBe(0);
    });

    it("carries the short name, the marker and the full name for screen readers", () => {
      const row = buildStackReadout(segments, 0, "sign-then-magnitude", 12).rows[0]!;
      expect(row).toMatchObject({ label: "B", marker: "up", srLabel: "in:b" });
    });
  });

  it("prints the overlay line of the caption with formatOverlayValue and the segments with formatValue", () => {
    const html = renderGeorgianMarkup(<StackedColumnChart {...props} formatValue={(value) => `u${Math.abs(value)}`} formatOverlayValue={(value) => `s${value}`} />);
    expect(html).toContain("Headline: s1");
    expect(html).toContain("Food: u1.2");
    expect(html).toContain("Communication: u0.2");
    // The default keeps one formatter for both.
    expect(markup).toContain("Headline: 1.0");
  });
});
