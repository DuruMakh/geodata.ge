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
});
