import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ServedGeneralGovernmentBalanceFact } from "../../lib/servedRows";

const facts: ServedGeneralGovernmentBalanceFact[] = [
  { year: 2024, generalGovernmentBalancePctGdp: -2.267, generalGovernmentBalanceGel: -2_109_000_000, status: "actual", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
  { year: 2025, generalGovernmentBalancePctGdp: -1.455, generalGovernmentBalanceGel: -1_526_000_000, status: "actual", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
  { year: 2026, generalGovernmentBalancePctGdp: -2.327, generalGovernmentBalanceGel: -2_672_000_000, status: "projection", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
];

async function loadDeficitComponent() {
  try {
    return await import("../../components/deficit/deficit-explorer");
  } catch {
    return null;
  }
}

describe("general-government deficit route composition", () => {
  it("reuses the one-chart explorer with percentage default and visible projections", async () => {
    const components = await loadDeficitComponent();
    expect(components).not.toBeNull();
    if (!components) return;

    const markup = renderToStaticMarkup(createElement(components.DeficitExplorer, {
      facts,
      workbookSources: [],
      lastUpdatedAt: "2026-09-04",
    }));
    const text = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    expect(markup).toContain('data-testid="deficit-explorer"');
    expect(markup).toContain("რამდენია საქართველოს ბიუჯეტის დეფიციტი");
    expect(text).toContain("2025: ზოგადი მთავრობის ბალანსი · −1.5%");
    expect(markup).toContain('data-measure="percent"');
    expect(markup).toContain('data-testid="chart-frame"');
    expect((markup.match(/data-testid="series-row"/g) ?? [])).toHaveLength(1);
    expect(markup).toContain('data-series-id="deficit.general_government_balance"');
    expect(markup).toContain('data-testid="range-marker"');
    expect(text).toContain("2026–2031 წლები IMF-ის პროგნოზია");
    expect(text).toContain("უარყოფითი მნიშვნელობა დეფიციტია");
    expect(markup).not.toContain('data-testid="site-footer"');
  });
});
