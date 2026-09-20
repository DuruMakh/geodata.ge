import { describe, expect, test } from "vitest";
import { shareOfRegionGdpPercent } from "../../../lib/data/regionalEconomies/calculations";

describe("regional GDP share calculation", () => {
  test("uses the selected region's full market-price GDP denominator", () => {
    expect(shareOfRegionGdpPercent("715.676721667705", "7203.151022643833")).toBe(
      "9.93560622868940159713",
    );
    expect(shareOfRegionGdpPercent("7203.151022643833", "7203.151022643833")).toBe("100");
  });

  test("preserves zero and negative numerators", () => {
    expect(shareOfRegionGdpPercent("0", "120")).toBe("0");
    expect(shareOfRegionGdpPercent("-3", "120")).toBe("-2.5");
  });

  test("rejects invalid inputs and non-positive regional GDP", () => {
    expect(() => shareOfRegionGdpPercent("1", "0")).toThrow(/positive regional GDP/i);
    expect(() => shareOfRegionGdpPercent("1", "-1")).toThrow(/positive regional GDP/i);
    expect(() => shareOfRegionGdpPercent("NaN", "1")).toThrow(/decimal/i);
    expect(() => shareOfRegionGdpPercent("Infinity", "1")).toThrow(/decimal/i);
    expect(() => shareOfRegionGdpPercent("1e3", "1")).toThrow(/decimal/i);
  });

  test("rounds once to twenty decimal places with decimal arithmetic", () => {
    expect(shareOfRegionGdpPercent("1", "3")).toBe("33.33333333333333333333");
    expect(shareOfRegionGdpPercent("2", "3")).toBe("66.66666666666666666667");
    expect(shareOfRegionGdpPercent("0.1", "0.3")).toBe("33.33333333333333333333");
  });
});
