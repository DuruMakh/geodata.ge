import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MoverRow, PeriodComparisonTable, type ComparisonRow } from "../../components/main-explorer/kpi-blocks";

describe("MoverRow", () => {
  it("draws no bar in the muted colour when there is no change", () => {
    const html = renderToStaticMarkup(<MoverRow rank={1} label="Education" change={null} maxAbs={1} />);
    expect(html).toContain("width:0%");
    expect(html).toContain("var(--muted)");
    expect(html).toContain(">01<");
  });

  it("sizes the bar against the largest change", () => {
    expect(renderToStaticMarkup(<MoverRow rank={2} label="Health" change={0.5} maxAbs={1} />)).toContain("width:50%");
  });
});

describe("PeriodComparisonTable", () => {
  const rows: ComparisonRow[] = [
    { key: "total", label: "Total", title: "Total", color: "var(--ink)", start: "1.0", change: "+0.5", end: "1.5", changeColor: "green", emphasis: true },
    { key: "a", label: "Alpha", title: "Alpha", color: "#123456", start: "0.4", change: "+0.1", end: "0.5", changeColor: "green", emphasis: false },
  ];
  const render = (variant?: "national" | "municipal") => renderToStaticMarkup(
    <PeriodComparisonTable heading="Comparison" caption="Comparison 2020–2025" firstColumnLabel="Field" changeLabel="Change" startYear={2020} endYear={2025} rows={rows} variant={variant} />,
  );

  it("marks the municipal table and its change cells for the place-page tests", () => {
    const html = render("municipal");
    expect(html).toContain('data-testid="comparison-table"');
    expect(html.match(/data-testid="comparison-change-cell"/g) ?? []).toHaveLength(2);
  });

  it("keeps the national table unmarked", () => {
    const html = render();
    expect(html).not.toContain("comparison-table");
    expect(html).not.toContain("comparison-change-cell");
  });

  it("renders a header row and one row per entry", () => {
    expect(render().match(/<tr/g) ?? []).toHaveLength(3);
    expect(render("municipal").match(/<tr/g) ?? []).toHaveLength(3);
  });
});
