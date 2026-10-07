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

  it("leaves the sticky y-axis copy to the client, so hydration matches", () => {
    const markup = renderGeorgianMarkup(
      <ChartScrollFrame yAxis={{ widthPercent: 8, node: <svg data-sticky /> }} scrollKey="2004-2025">
        <svg />
      </ChartScrollFrame>,
    );
    expect(markup).not.toContain("data-sticky");
    expect(markup).not.toContain("chart-frame-y-axis");
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
});
