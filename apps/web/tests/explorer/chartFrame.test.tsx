import { describe, expect, it } from "vitest";
import { ChartScrollFrame, ChartTooltip } from "../../components/main-explorer/chart-frame";
import { renderGeorgianMarkup } from "../helpers/render-localized";

describe("shared chart frame", () => {
  it("wraps a chart in a focusable scrolling region", () => {
    const markup = renderGeorgianMarkup(
      <ChartScrollFrame testId="stack-chart-frame">
        <svg />
      </ChartScrollFrame>,
    );
    expect(markup).toContain('data-testid="stack-chart-frame"');
    expect(markup).toContain('role="region"');
    expect(markup).toContain("min-w-[720px]");
  });

  // A phone chart fits its frame (D1), so its name no longer promises a sideways
  // scroll; the browser adds that wording once it measures a real overflow.
  it("names the region without scroll wording until an overflow is measured", () => {
    const markup = renderGeorgianMarkup(<ChartScrollFrame fit><svg /></ChartScrollFrame>);
    expect(markup).toContain('aria-label="მრავალწლიანი გრაფიკი"');
    expect(markup).not.toContain("ჰორიზონტალურად");
  });

  it("leaves the sticky y-axis copy to the client, so hydration matches", () => {
    const markup = renderGeorgianMarkup(
      <ChartScrollFrame yAxis={{ widthPercent: 8, node: <svg data-sticky /> }} scrollKey="2004-2025">
        <svg />
      </ChartScrollFrame>,
    );
    expect(markup).not.toContain("data-sticky");
    expect(markup).not.toContain("chart-frame-y-axis");
  });

  it("drops the scroll minimum on phones: before measuring by CSS, once fitted entirely", () => {
    const unmeasured = renderGeorgianMarkup(<ChartScrollFrame><svg /></ChartScrollFrame>);
    expect(unmeasured).toContain("max-[768px]:min-w-0");
    const fitted = renderGeorgianMarkup(<ChartScrollFrame fit><svg /></ChartScrollFrame>);
    expect(fitted).not.toContain("min-w-[720px]");
    expect(fitted).toContain('role="region"');
    expect(fitted).toContain('tabindex="0"');
  });

  it("renders the phone readout in flow, at 12px, with the tooltip's rows in order", () => {
    const markup = renderGeorgianMarkup(
      <ChartTooltip
        variant="panel"
        leftPercent={70}
        header="2026-08"
        rows={[
          { id: "a", label: "Food", color: "#B3402A", value: 1.2 },
          { id: "b", label: "Transport", color: "#4A707A", value: 0.4 },
        ]}
        hidden={2}
        formatValue={(value) => value.toFixed(1)}
      />,
    );
    expect(markup).toContain('data-placement="panel"');
    expect(markup).not.toContain("absolute");
    expect(markup).not.toContain("text-[11px]");
    expect(markup).toContain("text-[12px]");
    expect(markup.indexOf("Food")).toBeLessThan(markup.indexOf("Transport"));
    expect(markup).toContain("+2");
  });

  it("defaults to the line chart's test id", () => {
    const markup = renderGeorgianMarkup(<ChartScrollFrame><svg /></ChartScrollFrame>);
    expect(markup).toContain('data-testid="chart-frame"');
  });

  it("lists rows, the header pair and the hidden remainder, flipping past 60%", () => {
    const markup = renderGeorgianMarkup(
      <ChartTooltip
        leftPercent={70}
        header="2026-08"
        headerRight="Headline 5.6"
        rows={[{ id: "a", label: "Food", color: "#B3402A", value: 1.2 }]}
        hidden={3}
        formatValue={(value) => value.toFixed(1)}
      />,
    );
    expect(markup).toContain('data-testid="chart-tooltip"');
    expect(markup).toContain("Food");
    expect(markup).toContain("1.2");
    expect(markup).toContain("Headline 5.6");
    expect(markup).toContain("+3");
    expect(markup).toContain("translateX(calc(-100% - 12px))");
  });

  it("draws a coloured arrow instead of the colour bar for a row with a marker, and keeps the full name for screen readers", () => {
    const rows = [
      { id: "in", label: "Russia", srLabel: "Arrivals · Russia", marker: "up" as const, color: "#B3402A", value: 5 },
      { id: "out", label: "Russia", srLabel: "Departures · Russia", marker: "down" as const, color: "#4A707A", value: 3 },
    ];
    for (const variant of ["float", "panel"] as const) {
      const markup = renderGeorgianMarkup(
        <ChartTooltip variant={variant} leftPercent={10} header="2016" rows={rows} hidden={0} formatValue={(value) => String(value)} />,
      );
      expect(markup.match(/<svg/g)).toHaveLength(2);
      expect(markup).toContain("lucide-arrow-up");
      expect(markup).toContain("lucide-arrow-down");
      expect(markup).toContain("color:#B3402A");
      expect(markup).not.toContain("background-color");
      expect(markup).toContain('<span class="sr-only">Arrivals · Russia</span>');
      expect(markup).toContain('<span class="sr-only">Departures · Russia</span>');
    }
  });

  it("renders a row without a marker as a colour bar with no screen-reader duplicate", () => {
    const markup = renderGeorgianMarkup(
      <ChartTooltip leftPercent={10} header="2026-08" rows={[{ id: "a", label: "Food", color: "#B3402A", value: 1.2 }]} hidden={0} formatValue={(value) => value.toFixed(1)} />,
    );
    expect(markup).toContain("background-color:#B3402A");
    expect(markup).not.toContain("<svg");
    expect(markup).not.toContain("sr-only");
    expect(markup).not.toContain("aria-hidden=\"true\"><");
  });

  it("tightens the float readout's rows only when asked", () => {
    const rows = [{ id: "a", label: "Food", color: "#B3402A", value: 1.2 }];
    const render = (compact?: boolean) =>
      renderGeorgianMarkup(<ChartTooltip leftPercent={10} header="2026-08" rows={rows} hidden={0} formatValue={(value) => value.toFixed(1)} compact={compact} />);
    expect(render()).toContain("flex-col gap-1 overflow-hidden");
    expect(render()).not.toContain("leading-[14px]");
    expect(render()).toContain('class="flex items-center justify-between gap-2"');
    expect(render(true)).toContain("flex-col gap-0 overflow-hidden");
    expect(render(true)).toContain("leading-[14px]");
  });
});
