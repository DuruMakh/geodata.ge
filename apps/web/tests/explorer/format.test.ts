import { describe, expect, it, vi } from "vitest";
import { formatAmount, formatAmountParts, formatBn, formatInUnit, formatPerResidentGel, formatPoints, formatShare, formatSignedAmount, UNIT_BN, UNIT_MLN } from "../../lib/explorer/format";

describe("editorial formatters", () => {
  it("reuses number-format rules across subsequent chart and map values", () => {
    const OriginalNumberFormat = Intl.NumberFormat;
    const numberFormat = vi.spyOn(Intl, "NumberFormat").mockImplementation(function (locales, options) {
      return new OriginalNumberFormat(locales, options);
    });
    try {
      formatBn(2_000_000_000);
      formatAmount(450_000_000);
      formatAmount(8_000_000);
      formatPerResidentGel(1_000);
      numberFormat.mockClear();

      expect(formatBn(2_500_000_000)).toBe("2.5");
      expect(formatAmount(750_000_000)).toBe("750 მლნ ₾");
      expect(formatAmount(1_250_000)).toBe("1.25 მლნ ₾");
      expect(formatPerResidentGel(1_334.6)).toBe("1,335 ₾");
      expect(numberFormat).not.toHaveBeenCalled();
    } finally {
      numberFormat.mockRestore();
    }
  });

  it("formats billions with one decimal and en-US grouping", () => {
    expect(formatBn(26_500_000_000)).toBe("26.5");
    expect(formatBn(1_234_500_000_000)).toBe("1,234.5");
    expect(formatBn(null)).toBe("—");
  });

  it("chooses მლრდ or მლნ by magnitude", () => {
    expect(formatAmount(26_500_000_000)).toBe("26.5 მლრდ ₾");
    expect(formatAmount(450_400_000)).toBe("450 მლნ ₾");
    expect(formatAmountParts(2_190_000_000, true)).toEqual({ num: "+2.2", unit: "მლრდ ₾" });
    expect(formatAmountParts(-450_400_000, true)).toEqual({ num: "−450", unit: "მლნ ₾" });
    expect(formatSignedAmount(2_190_000_000)).toBe("+2.2 მლრდ ₾");
  });

  // Standalone amounts carry their own unit label, so unlike a shared column
  // they can vary precision per value. Three significant digits keeps a KPI
  // short while a small series-panel row stays readable instead of collapsing
  // to "0 მლნ ₾" (ონი 2025 social protection, 421,165 ₾).
  it("keeps three significant digits in მლნ", () => {
    expect(formatAmount(450_400_000)).toBe("450 მლნ ₾");
    expect(formatAmount(26_763_674)).toBe("26.8 მლნ ₾");
    expect(formatAmount(8_223_393)).toBe("8.22 მლნ ₾");
    expect(formatAmount(421_165)).toBe("0.42 მლნ ₾");
    expect(formatAmount(133_333)).toBe("0.13 მლნ ₾");
  });

  it("floors a small standalone amount instead of printing zero", () => {
    expect(formatAmount(1_295)).toBe("<0.01 მლნ ₾");
    expect(formatAmount(-1_295)).toBe(">−0.01 მლნ ₾");
  });

  // D11: an unfunded line reads as plain zero, not as a scaled "0.00 მლნ ₾".
  it("prints an exact zero as 0 ₾ / 0 GEL, unsigned", () => {
    expect(formatAmount(0)).toBe("0 ₾");
    expect(formatAmount(0, "en")).toBe("0 GEL");
    expect(formatSignedAmount(0)).toBe("0 ₾");
    expect(formatAmountParts(0, true)).toEqual({ num: "0", unit: "₾" });
  });

  it("keeps the direction sign on a signed amount below the display threshold", () => {
    expect(formatSignedAmount(67.79)).toBe("+<0.01 მლნ ₾");
    expect(formatSignedAmount(-67.79)).toBe(">−0.01 მლნ ₾");
  });

  it("switches units at the rounded-billion boundary", () => {
    expect(formatAmount(999_499_999)).toBe("999 მლნ ₾");
    expect(formatAmount(999_500_000)).toBe("1.0 მლრდ ₾");
    expect(formatAmount(-999_499_999)).toBe("−999 მლნ ₾");
    expect(formatAmount(-999_500_000)).toBe("−1.0 მლრდ ₾");
  });

  it("formats per-resident amounts as rounded whole lari", () => {
    expect(formatPerResidentGel(1_334.6)).toBe("1,335 ₾");
    expect(formatPerResidentGel(null)).toBe("—");
  });

  it("formats shares with one decimal and a true minus sign", () => {
    expect(formatShare(0.183)).toBe("18.3%");
    expect(formatShare(0.124, true)).toBe("+12.4%");
    expect(formatShare(-0.031, true)).toBe("−3.1%");
    expect(formatShare(null)).toBe("—");
  });

  it("formats percentage-point differences like shares, without a percent sign", () => {
    expect(formatPoints(4.7 - 4.9, true)).toBe("−0.2");
    expect(formatPoints(5 - 3.9, true)).toBe("+1.1");
    expect(formatPoints(0.3)).toBe("0.3");
    expect(formatPoints(null)).toBe("—");
    expect(formatPoints(Number.NaN)).toBe("—");
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
    expect(formatInUnit(16_900_000, UNIT_MLN)).toBe("17");
    expect(formatInUnit(2_108_000_000, UNIT_MLN)).toBe("2,108");
  });

  it("uses U+2212 for negatives and an em dash for missing values", () => {
    expect(formatInUnit(-16_900_000, UNIT_MLN)).toBe("−17");
    expect(formatInUnit(null, UNIT_MLN)).toBe("—");
    expect(formatInUnit(undefined, UNIT_BN)).toBe("—");
  });

  it("labels the units in Georgian", () => {
    expect(UNIT_BN.label).toBe("მლრდ");
    expect(UNIT_MLN.label).toBe("მლნ");
  });
});
