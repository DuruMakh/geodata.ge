import React, { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../lib/i18n/provider";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";
import { beforeAll, describe, expect, it } from "vitest";
import { selectDebtSeries } from "../../lib/explorer/debtExplorer";
import { loadGovernmentDebtFacts } from "../../lib/data/governmentDebt/importGovernmentDebtFacts";
import type {
  DebtSeriesId,
  ServedGovernmentDebtFact,
  ServedNationalGdpFact,
} from "../../lib/servedRows";

const reviewedAt = "2026-09-01";

let presentation: Presentation;
beforeAll(async () => { presentation = await getPresentation("ka", ["common", "controls", "format", "main", "debt"], [...new Set(facts.map(fact => fact.seriesId))]); });
function renderGeorgianMarkup(children: ReactNode) { return renderToStaticMarkup(<I18nProvider {...presentation}>{children}</I18nProvider>); }

function debtFact(
  year: number,
  family: ServedGovernmentDebtFact["family"],
  seriesId: DebtSeriesId,
  value: number | null,
  status: ServedGovernmentDebtFact["status"] = "actual",
): ServedGovernmentDebtFact {
  return {
    year,
    family,
    seriesId,
    value,
    valueKind: family === "rate" ? "percent" : "amount_gel",
    status,
    sourceId: status === "not_available" ? null : "test-debt-source",
    snapshotDate: status === "projection_existing_portfolio" ? "2025-12-31" : null,
    lastReviewedAt: reviewedAt,
  };
}

const facts: ServedGovernmentDebtFact[] = [
  debtFact(2013, "stock", "debt.stock.total", 8_000_000_000),
  debtFact(2024, "stock", "debt.stock.total", 30_000_000_000),
  debtFact(2025, "stock", "debt.stock.total", 35_000_000_000),
  debtFact(2013, "stock", "debt.stock.domestic", 2_000_000_000),
  debtFact(2025, "stock", "debt.stock.domestic", 10_000_000_000),
  debtFact(2013, "stock", "debt.stock.external", 6_000_000_000),
  debtFact(2025, "stock", "debt.stock.external", 25_000_000_000),
  debtFact(2013, "service", "debt.service.total", 900_000_000),
  debtFact(2025, "service", "debt.service.total", 4_300_000_000),
  debtFact(2026, "service", "debt.service.total", 5_100_000_000, "projection_existing_portfolio"),
  debtFact(2013, "service", "debt.service.principal", 650_000_000),
  debtFact(2025, "service", "debt.service.principal", 2_700_000_000),
  debtFact(2026, "service", "debt.service.principal", 3_500_000_000, "projection_existing_portfolio"),
  debtFact(2013, "service", "debt.service.interest", 250_000_000),
  debtFact(2025, "service", "debt.service.interest", 1_600_000_000),
  debtFact(2026, "service", "debt.service.interest", 1_600_000_000, "projection_existing_portfolio"),
  debtFact(2015, "rate", "debt.rate.total", 4.1),
  debtFact(2024, "rate", "debt.rate.total", 5),
  debtFact(2025, "rate", "debt.rate.total", 4.7),
  debtFact(2015, "rate", "debt.rate.domestic", 7.2),
  debtFact(2025, "rate", "debt.rate.domestic", null, "not_available"),
  debtFact(2015, "rate", "debt.rate.external", 2.4),
  debtFact(2025, "rate", "debt.rate.external", null, "not_available"),
];

const gdpFacts: ServedNationalGdpFact[] = [
  { year: 2013, gdpCurrentPricesGel: 27_000_000_000, accountingStandard: "sna_2008", status: "final_as_published", sourceId: "gdp" },
  { year: 2025, gdpCurrentPricesGel: 100_000_000_000, accountingStandard: "sna_2008", status: "preliminary", sourceId: "gdp" },
];

async function loadDebtComponents() {
  try {
    return await import("../../components/debt/debt-explorer");
  } catch {
    return null;
  }
}

function selectedSeries(markup: string): string[] {
  return [...markup.matchAll(/data-testid="series-row"(?:(?!data-testid="series-row").)*?data-series-id="([^"]+)"(?:(?!data-testid="series-row").)*?aria-pressed="true"/g)]
    .map((match) => match[1]!);
}

function deckText(markup: string): string {
  const match = markup.match(/<p data-testid="debt-deck"[^>]*>([\s\S]*?)<\/p>/);
  return (match?.[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function seriesRow(markup: string, id: DebtSeriesId): string {
  const start = markup.indexOf(`data-series-id="${id}"`);
  expect(start, `${id} row must exist`).toBeGreaterThan(-1);
  const next = markup.indexOf('data-testid="series-row"', start);
  return markup.slice(start, next === -1 ? undefined : next);
}

describe("Government Debt route composition", () => {
  it("renders the approved H1, total-only default, nine expanded rows and one chart", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const markup = renderGeorgianMarkup(createElement(components.DebtExplorer, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
    }));

    expect(markup).toContain("რამდენია მთავრობის ვალი და როგორ ვიხდით მას");
    expect((markup.match(/data-testid="series-row"/g) ?? [])).toHaveLength(9);
    expect((markup.match(/aria-expanded="true"/g) ?? [])).toHaveLength(3);
    expect(selectedSeries(markup)).toEqual(["debt.stock.total"]);
    expect(markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).toContain("სერიები 1 / 9");
    expect(markup).toContain('aria-label="მთლიანი ვალი — ქვესერიების ჩაკეცვა"');
    expect(markup).toContain('aria-label="ვალის გადახდა — ქვესერიების ჩაკეცვა"');
    expect(markup).toContain('aria-label="საპროცენტო განაკვეთი — ქვესერიების ჩაკეცვა"');
    expect(markup).not.toContain('aria-label="ქვეპროგრამები"');
    expect(seriesRow(markup, "debt.stock.domestic")).toContain("text-[12px]");
    expect(seriesRow(markup, "debt.stock.domestic")).not.toContain("text-[11.5px]");
    expect((markup.match(/data-testid="chart-frame"/g) ?? [])).toHaveLength(1);
    expect(markup).not.toContain('data-testid="explorer-table"');
    expect(markup).not.toContain('data-testid="site-footer"');
    const excelButton = markup.match(/<button[^>]*data-testid="debt-excel"[^>]*>/)?.[0];
    expect(excelButton).toBeDefined();
    expect(excelButton).not.toContain(' disabled=""');
    expect(markup).toContain("2019");
    expect(markup).toContain("2022");
    expect(markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).toContain(
      "2025: მთავრობის ვალი · 35.0 მლრდ ₾ +16.7% წინა წელთან",
    );
  });

  it("keeps the deck on latest family coverage when the selected range ends earlier", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "stock",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end: 2013, min: 2013, max: 2025 },
      selectedIds: ["debt.stock.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));
    const visibleText = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    expect(visibleText).toContain("2025: მთავრობის ვალი · 35.0 მლრდ ₾ +16.7% წინა წელთან");
    expect(visibleText).not.toContain("2013: მთავრობის ვალი · 8.0 მლრდ ₾");
  });

  it("leads the service deck with the latest actual total, never a projection", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "service",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end: 2025, min: 2013, max: 2026 },
      selectedIds: ["debt.service.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));
    const deck = deckText(markup);

    // The fixture has no 2024 service total, so no change is shown.
    expect(deck).toBe("2025: ვალის გადახდა · 4.3 მლრდ ₾");
  });

  it("reports the interest-rate deck change in percentage points", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "rate",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2015, end: 2025, min: 2015, max: 2025 },
      selectedIds: ["debt.rate.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));

    // Fixture: 2024 = 5.0%, 2025 = 4.7%.
    expect(deckText(markup)).toBe("2025: საპროცენტო განაკვეთი · 4.7% −0.3 პპ წინა წელთან");
  });

  it("uses actual service and latest published rate facts in real-data selector summaries", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;
    const realFacts = await loadGovernmentDebtFacts();
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorer, {
      facts: realFacts,
      gdpFacts: [],
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
    }));

    // Row values read as text: the ₾ sits in its own sans span (withLari).
    const rowText = (id: DebtSeriesId) => seriesRow(markup, id).replace(/<[^>]*>/g, "");
    expect(rowText("debt.service.total")).toContain("4.4 მლრდ ₾");
    expect(rowText("debt.service.total")).not.toContain("3.7 მლრდ ₾");
    expect(rowText("debt.service.principal")).toContain("2.7 მლრდ ₾");
    expect(rowText("debt.service.principal")).not.toContain("2.9 მლრდ ₾");
    expect(rowText("debt.service.interest")).toContain("1.6 მლრდ ₾");
    expect(rowText("debt.service.interest")).not.toContain("832 მლნ ₾");
    expect(seriesRow(markup, "debt.rate.domestic")).toContain("8.8% · 2024");
    expect(seriesRow(markup, "debt.rate.external")).toContain("3.1% · 2024");
  });

  it("keeps multiple lines in one family and clears them on a cross-family choice", () => {
    expect(selectDebtSeries(
      ["debt.stock.total", "debt.stock.domestic"],
      "debt.stock.external",
    )).toEqual(["debt.stock.total", "debt.stock.domestic", "debt.stock.external"]);
    expect(selectDebtSeries(
      ["debt.stock.total", "debt.stock.domestic"],
      "debt.service.interest",
    )).toEqual(["debt.service.interest"]);
  });

  it("shows the stock GDP pill but hides it for service and rate measures", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const base = { facts, gdpFacts, workbookSources: [], lastUpdatedAt: reviewedAt };
    const noop = () => {};
    const stock = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      ...base,
      family: "stock",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end: 2025, min: 2013, max: 2025 },
      selectedIds: ["debt.stock.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));
    const service = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      ...base,
      family: "service",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end: 2026, min: 2013, max: 2026 },
      selectedIds: ["debt.service.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));
    const rate = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      ...base,
      family: "rate",
      chartMode: "table",
      shareOfGdp: false,
      range: { start: 2015, end: 2025, min: 2015, max: 2025 },
      selectedIds: ["debt.rate.domestic"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));

    expect(stock).toContain('data-testid="measure-share-toggle"');
    expect(service).not.toContain('data-testid="measure-share-toggle"');
    expect(service).toContain('data-measure="amount"');
    expect(rate).not.toContain('data-testid="measure-share-toggle"');
    expect(rate).toContain('data-measure="percent"');
    expect(rate).toContain("—");
  });

  it("marks and explains the existing-portfolio service forecast", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "service",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end: 2026, min: 2013, max: 2026 },
      selectedIds: ["debt.service.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));

    expect(markup).toContain('data-testid="chart-series-debt.service.total-forecast"');
    expect(markup).toContain('data-testid="range-marker"');
    expect(markup).toContain('data-testid="debt-forecast-note"');
    expect(markup).toContain("2025-12-31");
    expect(markup).toContain("არ წარმოადგენს მომავალი ბიუჯეტის სრულ პროგნოზს");
  });

  it("keeps the full-family forecast boundary on an actual-only selected range", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "service",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end: 2025, min: 2013, max: 2030 },
      selectedIds: ["debt.service.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));

    expect(markup).toContain('data-testid="range-marker"');
    expect(markup).toContain("პროგნოზი");
    expect(markup).not.toContain('data-testid="chart-series-debt.service.total-forecast"');
  });

  it("shows the canonical no-range-data callout when every selected rate value is unavailable", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const base = {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "rate" as const,
      shareOfGdp: false,
      range: { start: 2025, end: 2025, min: 2015, max: 2025 },
      selectedIds: ["debt.rate.domestic"] as DebtSeriesId[],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    };
    const line = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      ...base,
      chartMode: "line",
    }));
    const table = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      ...base,
      chartMode: "table",
    }));

    for (const markup of [line, table]) {
      expect(markup).toContain('data-testid="no-range-data-callout"');
      expect(markup).toContain("არჩეული სერიებისთვის ამ დიაპაზონში მონაცემები არ არის");
      expect(markup).not.toContain('data-testid="chart-frame"');
      expect(markup).not.toContain('data-testid="explorer-table"');
    }
  });

  it("offers the bulk control on an empty selection so clearing can be undone", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "stock",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end: 2025, min: 2013, max: 2025 },
      selectedIds: [],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));
    const visibleText = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    expect(visibleText).toContain("სერიები 0 / 9");
    expect(visibleText).toContain("ყველას მონიშვნა");
    expect(markup).toMatch(/<button[^>]*data-testid="series-toggle-all"[^>]*aria-checked="false"/);
  });

  it("shows the bulk checkbox full only when every row of the active family is selected", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const bulkState = (family: "stock" | "service", selectedIds: DebtSeriesId[]) => {
      const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
        facts,
        gdpFacts,
        workbookSources: [],
        lastUpdatedAt: reviewedAt,
        family,
        chartMode: "line",
        shareOfGdp: false,
        range: { start: 2013, end: 2025, min: 2013, max: 2025 },
        selectedIds,
        onChartModeChange: noop,
        onShareChange: noop,
        onRangeChange: noop,
        onSelectionChange: noop,
        onToggleSeries: noop,
      }));
      return markup.match(/<button[^>]*data-testid="series-toggle-all"[^>]*aria-checked="([a-z]+)"/)?.[1];
    };

    // The default total alone is a partial selection, as in every other explorer.
    expect(bulkState("stock", ["debt.stock.total"])).toBe("mixed");
    expect(bulkState("service", ["debt.service.total"])).toBe("mixed");
    expect(bulkState("service", ["debt.service.total", "debt.service.principal", "debt.service.interest"])).toBe("true");
  });

  it("names preliminary GDP years in the stock source note only when they are in range", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const render = (end: number) => renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "stock",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end, min: 2013, max: 2025 },
      selectedIds: ["debt.stock.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));

    // Fixture: GDP 2025 is preliminary, 2013 is final; stock facts exist for 2013, 2024, 2025.
    expect(render(2025)).toContain("2025 წლის მშპ წინასწარია.");
    expect(render(2024)).not.toContain("მშპ წინასწარია");
  });
});
