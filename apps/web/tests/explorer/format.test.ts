import { describe, expect, it } from "vitest";
import { formatAmount, formatAmountParts, formatBn, formatShare, formatSignedAmount } from "../../lib/explorer/format";

describe("editorial formatters", () => {
  it("formats billions with fixed decimals and en-US grouping", () => {
    expect(formatBn(26_500_000_000)).toBe("26.50");
    expect(formatBn(1_234_500_000_000)).toBe("1,234.50");
    expect(formatBn(null)).toBe("—");
  });

  it("chooses მლრდ or მლნ by magnitude", () => {
    expect(formatAmount(26_500_000_000)).toBe("26.50 მლრდ ₾");
    expect(formatAmount(450_000_000)).toBe("450.0 მლნ ₾");
    expect(formatAmountParts(2_190_000_000, true)).toEqual({ num: "+2.19", unit: "მლრდ ₾" });
    expect(formatAmountParts(-450_000_000, true)).toEqual({ num: "−450.0", unit: "მლნ ₾" });
    expect(formatSignedAmount(2_190_000_000)).toBe("+2.19 მლრდ ₾");
  });

  it("formats shares with one decimal and a true minus sign", () => {
    expect(formatShare(0.183)).toBe("18.3%");
    expect(formatShare(0.124, true)).toBe("+12.4%");
    expect(formatShare(-0.031, true)).toBe("−3.1%");
    expect(formatShare(null)).toBe("—");
  });
});
