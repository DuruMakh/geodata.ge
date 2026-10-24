import { describe, expect, it } from "vitest";
import { ChartShareButton } from "../../components/explorer-shell/chart-share-button";
import { ShareCard } from "../../components/explorer-shell/share-card";
import { EditorialLineChart } from "../../components/main-explorer/editorial-line-chart";
import { renderGeorgianMarkup, renderPageMarkup } from "../helpers/render-localized";

describe("share card", () => {
  it("carries title, unit line, legend, source and the brand", () => {
    const html = renderGeorgianMarkup(<ShareCard title="ხელფასები" caption="₾ თვეში · 1995–2025" legend={[{ label: "საშუალო", color: "#1E1B16" }]} source="წყარო: საქსტატი" chart={<svg data-geometry="desktop" />} />);
    for (const text of ['data-testid="share-card"', "ხელფასები", "₾ თვეში · 1995–2025", "საშუალო", "#1E1B16", "წყარო: საქსტატი", "/fiscal-ge-logo.svg", "fiscal.ge"]) expect(html).toContain(text);
  });

  it("draws its chart in the desktop geometry", () => {
    const chart = <EditorialLineChart years={[2024, 2025]} series={[{ id: "a", label: "A", color: "#1E1B16", vals: [1, 2] }]} share={false} unit={{ divisor: 1, label: "₾", decimals: 0 }} shareLabel="%" />;
    const html = renderGeorgianMarkup(<ShareCard title="t" caption="c" source="s" chart={chart} />);
    expect(html).toContain('data-geometry="desktop"');
    expect(html).not.toContain('data-geometry="mobile"');
  });

  it("leaves the legend out when none is given", () => {
    expect(renderGeorgianMarkup(<ShareCard title="t" caption="c" source="s" chart={<svg />} />)).not.toContain('data-testid="share-card-legend"');
  });
});

describe("share button", () => {
  it("a closed share button is a labelled disclosure with no menu", () => {
    const html = renderGeorgianMarkup(<ChartShareButton title="t" caption="c" source="s" chart={<svg />} fileStem="x" />);
    expect(html).toContain('data-testid="chart-share"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("გაზიარება");
    expect(html).not.toContain('data-testid="chart-share-menu"');
  });

  it("reads Share on the English page", () => {
    expect(renderPageMarkup("en", <ChartShareButton title="t" caption="c" source="s" chart={<svg />} fileStem="x" />)).toContain(">Share<");
  });
});
