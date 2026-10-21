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

// Moved from debtTable.test.ts: per-cell share decimals (a debt rate printed with one decimal beside one with two).
describe("ExplorerTable rate precision", () => {
  it("formats each share cell at its own decimals, so 9.20% and 8.3% sit in one row", () => {
    const rateRow: DebtExplorerTableRow = {
      itemId: "debt.rate.domestic", parentItemId: "debt.rate.total", kaLabel: "საშინაო განაკვეთი", enLabel: "Domestic rate", color: "#1F6E56",
      valuesByYear: { 2018: 8.3, 2022: 9.2 }, statusByYear: { 2018: "actual", 2022: "actual" },
    };
    const markup = renderGeorgianMarkup(
      createElement(ExplorerTable, {
        caption: "საპროცენტო განაკვეთი", rows: [rateRow], totalRow: null, showTotal: false, years: [2018, 2022],
        firstColumnLabel: "სერია", unit: UNIT_MLN, share: true, showChangeColumn: false,
        shareValueForYear: (row: { valuesByYear: Record<number, number | null> }, year: number) => (row.valuesByYear[year] ?? 0) / 100,
        shareDecimalsForRow: (_row: unknown, year: number) => (year === 2018 ? 1 : 2),
      }),
    );
    expect(markup).toContain(">8.3%<");
    expect(markup).toContain(">9.20%<");
  });
});
