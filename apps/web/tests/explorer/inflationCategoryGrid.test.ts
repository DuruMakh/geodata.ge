import { describe, expect, it } from "vitest";
import { CONTRIBUTION_BINS, GRID_TINTS, binFor, contrastRatio, legendLabelsPp } from "../../lib/explorer/inflationGrid";

describe("contribution bins", () => {
  it("puts a negative contribution in the deflation bin", () => {
    expect(binFor(-0.24, CONTRIBUTION_BINS)).toBe(0);
  });

  it("separates a small contribution from a large one", () => {
    expect(binFor(0.1, CONTRIBUTION_BINS)).toBe(1);
    expect(binFor(1.74, CONTRIBUTION_BINS)).toBe(4);
  });

  it("labels the legend in percentage points", () => {
    expect(legendLabelsPp(CONTRIBUTION_BINS)[0]).toBe("< 0 პპ");
    expect(legendLabelsPp(CONTRIBUTION_BINS).at(-1)).toBe("≥ 1.5 პპ");
  });

  it("keeps every tint readable", () => {
    for (const tint of GRID_TINTS) expect(contrastRatio(tint.text, tint.background)).toBeGreaterThanOrEqual(4.5);
  });
});
