import { describe, expect, it } from "vitest";
import { shareOfTotal } from "../../lib/explorer/share";

describe("shareOfTotal", () => {
  it("divides the value by the total", () => {
    expect(shareOfTotal(200, 300)).toBeCloseTo(200 / 300, 12);
  });

  it("returns 1 when the value is the total", () => {
    expect(shareOfTotal(300, 300)).toBe(1);
  });

  it("keeps a served zero as a zero share", () => {
    expect(shareOfTotal(0, 300)).toBe(0);
  });

  it("returns null when the value is missing", () => {
    expect(shareOfTotal(null, 300)).toBeNull();
    expect(shareOfTotal(undefined, 300)).toBeNull();
  });

  it("returns null when the total is missing or zero", () => {
    expect(shareOfTotal(200, null)).toBeNull();
    expect(shareOfTotal(200, undefined)).toBeNull();
    expect(shareOfTotal(200, 0)).toBeNull();
  });
});
