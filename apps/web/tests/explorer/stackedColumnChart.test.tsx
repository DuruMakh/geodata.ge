import { describe, expect, it } from "vitest";
import { StackedColumnChart, type StackedColumnChartProps } from "../../components/main-explorer/stacked-column-chart";
import { renderGeorgianMarkup } from "../helpers/render-localized";

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
  it("draws one rect per segment and period", () => {
    expect(markup.match(/data-segment="/g)).toHaveLength(4);
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
    expect(markup).toContain('data-testid="stack-chart-scroll-hint"');
    expect(markup).toMatch(/<svg[^>]*tabindex="0"/);
    expect(markup).toMatch(/<svg[^>]*aria-describedby="[^"]+"/);
  });

  it("ends the headline overlay in a dot", () => {
    expect(markup).toContain("data-overlay-end");
  });

  it("has no per-bar hover rectangles and no in-flow readout", () => {
    expect(markup).not.toContain('fill="transparent"');
    expect(markup).not.toContain("mt-2 font-mono");
  });
});
