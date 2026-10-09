import { describe, expect, it } from "vitest";
import { ROWS_LAYOUT_MAX_SERIES, usesRowsLayout } from "../../components/main-explorer/explorer-table";

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
