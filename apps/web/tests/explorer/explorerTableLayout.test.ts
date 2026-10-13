import { createElement } from "react";
import { renderGeorgianMarkup } from "../helpers/render-localized";
import { describe, expect, it } from "vitest";
import { ExplorerTable, ROWS_LAYOUT_MAX_SERIES, usesRowsLayout } from "../../components/main-explorer/explorer-table";
import type { DebtExplorerTableRow } from "../../lib/explorer/debtExplorer";
import { UNIT_MLN } from "../../lib/explorer/format";

// Owner decision D5 (2026-10-07): phone tables of up to three series list years as rows.
describe("usesRowsLayout", () => {
  it("turns a narrow table of one to three series into year rows", () => {
    expect(ROWS_LAYOUT_MAX_SERIES).toBe(3);
    for (const count of [1, 2, 3]) expect(usesRowsLayout(count, 350)).toBe(true);
  });

  it("keeps year columns for four or more series, wide tables and unmeasured tables", () => {
    expect(usesRowsLayout(4, 350)).toBe(false);
    expect(usesRowsLayout(1, 768)).toBe(false);
    expect(usesRowsLayout(1, 0)).toBe(false);
    expect(usesRowsLayout(0, 350)).toBe(false);
  });
});

// Moved from debtTable.test.ts: the optional forecast label on marked-year cells.
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
    const markup = renderGeorgianMarkup(
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
    const markup = renderGeorgianMarkup(
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
