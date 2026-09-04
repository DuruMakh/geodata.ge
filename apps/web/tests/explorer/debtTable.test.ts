import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExplorerTable } from "../../components/main-explorer/explorer-table";
import type { DebtExplorerTableRow } from "../../lib/explorer/debtExplorer";
import { UNIT_MLN } from "../../lib/explorer/format";

const row: DebtExplorerTableRow = {
  itemId: "debt.service.total",
  parentItemId: null,
  kaLabel: "ვალის გადახდა",
  enLabel: "Debt service",
  color: "#1F6E56",
  valuesByYear: { 2025: 40_000_000, 2026: 38_000_000 },
  statusByYear: { 2025: "actual", 2026: "projection_existing_portfolio" },
};

describe("ExplorerTable forecast labels", () => {
  it("labels optional marked-year cells with caller supplied text", () => {
    const markup = renderToStaticMarkup(
      createElement(ExplorerTable, {
        caption: "ვალის გადახდა",
        rows: [row],
        totalRow: null,
        showTotal: false,
        years: [2025, 2026],
        firstColumnLabel: "სერია",
        unit: UNIT_MLN,
        share: false,
        showChangeColumn: false,
        forecastYears: [2026],
        forecastLabel: "პროგნოზი",
        shareValueForYear: () => null,
      }),
    );

    expect(markup).toContain("პროგნოზი");
  });

  it("labels optional marked-year cells in the displayed total row", () => {
    const markup = renderToStaticMarkup(
      createElement(ExplorerTable, {
        caption: "ვალის გადახდა",
        rows: [],
        totalRow: row,
        showTotal: true,
        years: [2025, 2026],
        firstColumnLabel: "სერია",
        unit: UNIT_MLN,
        share: false,
        showChangeColumn: false,
        forecastYears: [2026],
        forecastLabel: "პროგნოზი",
        shareValueForYear: () => null,
      }),
    );

    expect(markup).toContain("პროგნოზი");
  });
});
