import { describe, expect, it } from "vitest";
import { INK, PAPER } from "../../lib/explorer/colors";
import { buildStackReadout, stackReadoutHeader, StackedColumnChart, type StackedColumnChartProps } from "../../components/main-explorer/stacked-column-chart";
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

    it("files a departure of zero (-0) with the departures, by marker or by sign", () => {
      const withZero = [
        segment("in:a", 5, { marker: "up" }),
        segment("out:a", -0, { marker: "down" }),
        segment("out:b", -3, { marker: "down" }),
        segment("in:b", 0, { marker: "up" }),
      ];
      expect(buildStackReadout(withZero, 0, "sign-then-magnitude", 12).rows.map((row) => row.id)).toEqual(["in:a", "in:b", "out:b", "out:a"]);
      const unmarked = [segment("in", 2), segment("out", -0), segment("out2", -1)];
      expect(buildStackReadout(unmarked, 0, "sign-then-magnitude", 12).rows.map((row) => row.id)).toEqual(["in", "out2", "out"]);
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

  it("renders a swatch row when legend is given and nothing when it is not", () => {
    const legend = [
      { id: "a", label: "Food", color: "#B3402A" },
      { id: "b", label: "Communication", color: "#4A707A" },
      { id: "headline", label: "Headline", color: "#1E1B16" },
    ];
    const html = renderGeorgianMarkup(<StackedColumnChart {...props} legend={legend} />);
    const row = /<ul[^>]*data-testid="stack-chart-legend"[^>]*>.*?<\/ul>/.exec(html)?.[0] ?? "";
    expect(row.match(/<li/g)).toHaveLength(3);
    for (const entry of legend) {
      expect(row).toContain(`>${entry.label}</span>`);
      expect(row).toContain(`background-color:${entry.color}`);
    }
    // The key sits above the plot.
    expect(html.indexOf("stack-chart-legend")).toBeLessThan(html.indexOf('data-testid="stack-chart-frame"'));
    // Without it the chart is exactly what it was.
    expect(markup).not.toContain("stack-chart-legend");
    expect(html.replace(row, "")).toBe(markup);
    expect(renderGeorgianMarkup(<StackedColumnChart {...props} legend={[]} />)).toBe(markup);
  });
  describe("highlight and projection", () => {
    const years = Array.from({ length: 16 }, (_, index) => 2016 + index);
    const yearProps: StackedColumnChartProps = {
      ...props,
      periods: years,
      periodsPerYear: 1,
      segments: [
        { id: "a", label: "Food", color: "#B3402A", values: years.map(() => 3) },
        { id: "b", label: "Communication", color: "#4A707A", values: years.map(() => -2) },
        { id: "c", label: "Other", color: "#B3402A", values: years.map(() => 1) },
      ],
      overlay: null,
    };
    const rects = (svg: string) => [...svg.matchAll(/<rect[^>]*data-segment="[^"]+"[^>]*>/g)].map((match) => match[0]);
    // Proves the new props are additive: these two drawings were recorded before they existed.
    it("draws exactly what it drew before when neither prop is given", () => {
      expect(markup).toMatchSnapshot("inflation fixture");
      expect(renderGeorgianMarkup(<StackedColumnChart {...yearProps} breaks={[{ period: 2024, label: "Break" }]} />)).toMatchSnapshot("annual fixture");
    });

    it("marks a fit-width chart's drawings, which draw the phone geometry at every width, and no other chart's", () => {
      expect(markup).not.toContain("data-fit-width");
      const fitted = renderGeorgianMarkup(<StackedColumnChart {...yearProps} fitWidth />);
      expect(fitted.match(/<svg[^>]*data-geometry="[^"]+"[^>]*data-fit-width=""/g)?.length).toBeGreaterThan(0);
      expect(fitted.match(/<svg[^>]*data-geometry=/g)).toHaveLength(fitted.match(/data-fit-width=""/g)!.length);
    });

    it("marks the highlighted period's label and puts one ink rule under it", () => {
      for (const geometry of ["desktop", "mobile"] as const) {
        const svg = chartGeometry(renderGeorgianMarkup(<StackedColumnChart {...yearProps} highlightPeriod={2025} />), geometry);
        expect(svg.match(/data-highlight/g)).toHaveLength(1);
        const label = /<text x="([\d.]+)"[^>]*font-weight="600"[^>]*>2025<\/text>/.exec(svg);
        expect(label, geometry).not.toBeNull();
        expect(label![0]).toContain(`fill="${INK}"`);
        expect(svg.match(/font-weight="600"/g)).toHaveLength(1);
        const rule = /<rect[^>]*data-highlight[^>]*>/.exec(svg)![0];
        expect(rule).toContain('width="16"');
        expect(rule).toContain('height="2"');
        expect(rule).toContain(`fill="${INK}"`);
        // Centred under the label, which starts at its x on a phone and is centred on it on a desktop.
        const labelWidth = 4 * 6.6;
        const centre = geometry === "mobile" ? Number(label![1]) + labelWidth / 2 : Number(label![1]);
        expect(Number(/\bx="([-\d.]+)"/.exec(rule)![1]) + 8).toBeCloseTo(centre, 0);
        // Below the label's baseline, inside the drawing.
        const height = Number(/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)![1]);
        const ruleY = Number(/\by="([-\d.]+)"/.exec(rule)![1]);
        expect(ruleY).toBeGreaterThan(height - 8);
        expect(ruleY + 2).toBeLessThanOrEqual(height);
      }
    });

    it("shows a highlighted label the axis would have skipped and drops the ones it would touch", () => {
      const plain = chartGeometry(renderGeorgianMarkup(<StackedColumnChart {...yearProps} />), "mobile");
      const labelled = (svg: string) => [...svg.matchAll(/<text x="[\d.]+"[^>]*text-anchor="start"[^>]*>(\d{4})<\/text>/g)].map((match) => match[1]);
      const before = labelled(plain);
      const skipped = years.find((year, index) => index > 0 && index < years.length - 1 && !before.includes(String(year)))!;
      const withHighlight = chartGeometry(renderGeorgianMarkup(<StackedColumnChart {...yearProps} highlightPeriod={skipped} />), "mobile");
      const after = labelled(withHighlight);
      expect(after).toContain(String(skipped));
      expect(after).not.toContain(String(skipped - 1));
      expect(after).not.toContain(String(skipped + 1));
      // Labels that still show never touch: four-digit labels are 26.4 units wide plus the 8 unit gap.
      const starts = [...withHighlight.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="start"[^>]*>\d{4}<\/text>/g)].map((match) => Number(match[1]));
      for (let index = 1; index < starts.length; index += 1) expect(starts[index]! - starts[index - 1]!).toBeGreaterThanOrEqual(26.4 + 8);
      // The first and latest label stay unless they collide with it.
      expect(after).toContain("2031");
    });

    it("draws no rule for a period that is not on the axis", () => {
      const html = renderGeorgianMarkup(<StackedColumnChart {...yearProps} highlightPeriod={1999} />);
      expect(html).not.toContain("data-highlight");
      expect(html).toBe(renderGeorgianMarkup(<StackedColumnChart {...yearProps} />));
    });

    it("hatches every column from projectionFrom on, and only those, in each segment's own colour", () => {
      const html = renderGeorgianMarkup(<StackedColumnChart {...yearProps} projectionFrom={2026} projectionLabel="plan" />);
      for (const geometry of ["desktop", "mobile"] as const) {
        const svg = chartGeometry(html, geometry);
        const all = rects(svg);
        expect(all).toHaveLength(48);
        // Rects come segment by segment, column by column: 16 per segment.
        all.forEach((rect, position) => {
          const year = years[position % 16]!;
          expect(rect.includes("data-projection"), `${geometry} ${year}`).toBe(year >= 2026);
          if (year >= 2026) expect(rect).toMatch(/fill="url\(#[^)"]+\)"/);
          else expect(rect).toMatch(/fill="#[0-9A-F]{6}"/);
        });
        // One pattern per distinct colour (two segments share one): 45 degrees, a 3px stripe on paper.
        const patterns = [...svg.matchAll(/<pattern[^>]*>[\s\S]*?<\/pattern>/g)].map((match) => match[0]).filter((pattern) => pattern.includes("rotate(45)"));
        expect(patterns).toHaveLength(2);
        for (const pattern of patterns) {
          expect(pattern).toContain(`fill="${PAPER}"`);
          expect(pattern).toMatch(/<rect[^>]*width="3"[^>]*fill="#(B3402A|4A707A)"|<rect[^>]*fill="#(B3402A|4A707A)"[^>]*width="3"/);
        }
        // Every fill reference points at a pattern that exists.
        for (const [, id] of svg.matchAll(/fill="url\(#([^)"]+)\)"/g)) if (id !== "stack-dot-lattice" && id !== "stack-dot-lattice-mobile") expect(svg).toContain(`id="${id}"`);
      }
    });

    it("keeps pattern ids unique across charts and between the two drawings of one chart", () => {
      const two = renderGeorgianMarkup(
        <>
          <StackedColumnChart {...yearProps} projectionFrom={2026} projectionLabel="plan" />
          <StackedColumnChart {...yearProps} projectionFrom={2026} projectionLabel="plan" />
        </>,
      );
      const ids = [...two.matchAll(/<pattern[^>]*\bid="([^"]+)"/g)].map((match) => match[1]!).filter((id) => !id.startsWith("stack-dot-lattice"));
      // Two colours, two drawings, two charts.
      expect(ids).toHaveLength(8);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("appends the projection label to the readout header from projectionFrom on", () => {
      const header = (period: number) => stackReadoutHeader(period, (value) => `y${value}`, 2026, "plan");
      expect(header(2025)).toBe("y2025");
      expect(header(2026)).toBe("y2026 plan");
      expect(header(2031)).toBe("y2031 plan");
      expect(stackReadoutHeader(2031, (value) => `y${value}`)).toBe("y2031");
    });

    it("hatches nothing when projectionFrom lies beyond the last period", () => {
      const html = renderGeorgianMarkup(<StackedColumnChart {...yearProps} projectionFrom={2040} projectionLabel="plan" />);
      expect(html).not.toContain("data-projection");
    });
  });

  describe("value labels", () => {
    const years = [2020, 2021, 2022, 2023];
    const signed: StackedColumnChartProps = {
      ...props,
      periods: years,
      periodsPerYear: 1,
      segments: [
        { id: "up", label: "Surplus", color: "#1F6E56", values: [2, null, null, 1] },
        { id: "down", label: "Deficit", color: "#B3402A", values: [null, -3, -9, null] },
      ],
      overlay: null,
    };
    const labels = (svg: string) => [...svg.matchAll(/<text[^>]*data-value-label="(\d+)"[^>]*>([^<]*)<\/text>/g)];
    const attribute = (tag: string, name: string) => Number(new RegExp(`\\b${name}="([-\\d.]+)"`).exec(tag)![1]);
    const columnY = (svg: string, id: string, position: number) => {
      const rect = [...svg.matchAll(new RegExp(`<rect[^>]*data-segment="${id}"[^>]*>`, "g"))][position]![0];
      return { top: attribute(rect, "y"), bottom: attribute(rect, "y") + attribute(rect, "height") };
    };

    it("draws nothing extra when none are given", () => {
      expect(renderGeorgianMarkup(<StackedColumnChart {...signed} valueLabels={[]} />)).toBe(renderGeorgianMarkup(<StackedColumnChart {...signed} />));
      expect(renderGeorgianMarkup(<StackedColumnChart {...signed} />)).not.toContain("data-value-label");
    });

    it("writes each label above a rising column and below a hanging one, inside the plot, skipping periods off the axis", () => {
      const html = renderGeorgianMarkup(<StackedColumnChart {...signed} valueLabels={[{ period: 2020, text: "+2.0%" }, { period: 2022, text: "−9.0%" }, { period: 1999, text: "x" }]} />);
      for (const geometry of ["desktop", "mobile"] as const) {
        const svg = chartGeometry(html, geometry);
        const found = labels(svg);
        expect(found.map((match) => [match[1], match[2]])).toEqual([["2020", "+2.0%"], ["2022", "−9.0%"]]);
        const [rising, hanging] = found.map((match) => match[0]);
        expect(rising).toContain(`fill="${INK}"`);
        expect(attribute(rising!, "y")).toBeLessThan(columnY(svg, "up", 0).top);
        expect(attribute(hanging!, "y")).toBeGreaterThan(columnY(svg, "down", 1).bottom);
        // Above the period labels' row (they sit 8 units from the bottom).
        const height = Number(/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)![1]);
        expect(attribute(hanging!, "y")).toBeLessThan(height - 26);
      }
    });
  });
});
