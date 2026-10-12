import { describe, expect, it } from "vitest";
import { HeroKpi, SideKpiList } from "../../components/main-explorer/kpi-blocks";
import { renderGeorgianMarkup } from "../helpers/render-localized";

describe("KPI blocks", () => {
  it("renders the hero label, value and caller-owned body", () => {
    const markup = renderGeorgianMarkup(<HeroKpi label="წლიური ინფლაცია" value="5.6%"><p>body</p></HeroKpi>);
    expect(markup).toContain("წლიური ინფლაცია");
    expect(markup).toContain(">5.6%<");
    expect(markup).toContain("<p>body</p>");
  });

  it("renders one side KPI per entry with an optional sparkline", () => {
    const markup = renderGeorgianMarkup(
      <SideKpiList kpis={[
        { label: "საბაზო", value: "3.8%", unit: "", color: "var(--ink)", detail: "წლიური", spark: { values: [1, 2, 3], color: "#3D5A98" } },
        { label: "თვიური", value: "+0.4%", unit: "", color: "var(--ink)", detail: "ივლისთან", spark: null },
      ]} />,
    );
    expect(markup.match(/data-testid="side-kpi"/g)).toHaveLength(2);
    expect(markup.match(/<svg/g)).toHaveLength(1);
  });

  it("sets an optional unit in the sans lari face and carries test ids", () => {
    const markup = renderGeorgianMarkup(<HeroKpi label="ყველაზე დიდი" value="7.2" unit="მლრდ ₾" testId="sector-highlight-largest" valueTestId="sector-hero-value"><p>body</p></HeroKpi>);
    expect(markup).toContain('data-testid="sector-highlight-largest"');
    expect(markup).toContain('data-testid="sector-hero-value"');
    expect(markup).toContain("data-lari");
    expect(markup).toContain("მლრდ");
  });

  it("wraps each side row in its own test id when asked", () => {
    const markup = renderGeorgianMarkup(
      <SideKpiList rowTestId="entity-kpi" kpis={[{ label: "წილი", value: "4.1%", unit: "", color: "var(--ink)", detail: "", spark: null }]} />,
    );
    expect(markup).toMatch(/data-testid="entity-kpi"[^>]*><div data-testid="side-kpi"/);
  });

  it("names a side row by its own test id and the list by the list's", () => {
    const markup = renderGeorgianMarkup(
      <SideKpiList testId="sector-side-kpis" kpis={[{ label: "სწრაფი", value: "+3.0%", unit: "", color: "var(--ink)", detail: "", spark: null, testId: "sector-highlight-fastest" }]} />,
    );
    expect(markup).toContain('data-testid="sector-side-kpis"');
    expect(markup).toContain('data-testid="sector-highlight-fastest"');
    expect(markup).not.toContain('data-testid="side-kpi"');
  });
});
