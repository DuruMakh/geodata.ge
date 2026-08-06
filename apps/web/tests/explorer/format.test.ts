import { describe, expect, it } from "vitest";
import { formatAmount, formatAmountParts, formatBn, formatInUnit, formatShare, formatSignedAmount, UNIT_BN, UNIT_MLN } from "../../lib/explorer/format";

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

  it("accepts a decimals override for 0-decimal signed percents", () => {
    expect(formatShare(1.08, true, 0)).toBe("+108%");
    expect(formatShare(-0.031, true, 0)).toBe("−3%");
    // Negative render must use U+2212, never an ASCII hyphen.
    expect(formatShare(-0.031, true, 0)).not.toMatch(/-/);
  });
});

describe("formatInUnit", () => {
  it("reproduces formatBn exactly for the billions unit", () => {
    for (const value of [0, 1, 1_500_000, 2_034_000_000, 5_625_000_000, -3_200_000_000]) {
      expect(formatInUnit(value, UNIT_BN)).toBe(formatBn(value));
    }
  });

  it("renders municipal magnitudes legibly in millions", () => {
    // ლენტეხი's 2025 total: 0.02 in billions, which is why the unit is a parameter.
    expect(formatInUnit(16_900_000, UNIT_MLN)).toBe("16.9");
    expect(formatInUnit(2_108_000_000, UNIT_MLN)).toBe("2,108.0");
  });

  it("uses U+2212 for negatives and an em dash for missing values", () => {
    expect(formatInUnit(-16_900_000, UNIT_MLN)).toBe("−16.9");
    expect(formatInUnit(null, UNIT_MLN)).toBe("—");
    expect(formatInUnit(undefined, UNIT_BN)).toBe("—");
  });

  it("labels the units in Georgian", () => {
    expect(UNIT_BN.label).toBe("მლრდ");
    expect(UNIT_MLN.label).toBe("მლნ");
  });
});
