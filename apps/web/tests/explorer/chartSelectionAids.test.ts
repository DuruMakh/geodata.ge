import { describe, expect, it } from "vitest";
import { enoughInView } from "../../components/explorer-shell/chart-selection-aids";

// Owner decision D4 (2026-10-07): the "↑ chart" pill.
describe("enoughInView", () => {
  it("needs half the chart, or half a screen of a taller one", () => {
    expect(enoughInView(160, 300, 844)).toBe(true);
    expect(enoughInView(100, 300, 844)).toBe(false);
    expect(enoughInView(430, 2800, 844)).toBe(true);
    expect(enoughInView(300, 2800, 844)).toBe(false);
    expect(enoughInView(-50, 300, 844)).toBe(false);
  });
});
