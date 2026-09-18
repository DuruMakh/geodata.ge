import { describe, expect, it } from "vitest";
import { ChartScrollFrame, ChartTooltip } from "../../components/main-explorer/chart-frame";
import { renderGeorgianMarkup } from "../helpers/render-localized";

describe("shared chart frame", () => {
  it("wraps a chart in the scroll hint and a focusable scrolling region", () => {
    const markup = renderGeorgianMarkup(
      <ChartScrollFrame testId="stack-chart-frame" hintTestId="stack-chart-scroll-hint">
        <svg />
      </ChartScrollFrame>,
    );
    expect(markup).toContain('data-testid="stack-chart-scroll-hint"');
    expect(markup).toContain('data-testid="stack-chart-frame"');
    expect(markup).toContain('role="region"');
    expect(markup).toContain("min-w-[720px]");
  });

  it("defaults to the line chart's test ids", () => {
    const markup = renderGeorgianMarkup(<ChartScrollFrame><svg /></ChartScrollFrame>);
    expect(markup).toContain('data-testid="chart-frame"');
    expect(markup).toContain('data-testid="chart-scroll-hint"');
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
});
