import { describe, expect, it, vi } from "vitest";
import { formatAmount, formatAmountParts, formatBn, formatInUnit, formatPerResidentGel, formatPoints, formatShare, formatSignedAmount, roundForDisplay, roundShown, UNIT_BN, UNIT_MLN, wholePercents } from "../../lib/explorer/format";

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

  it("rounds a last-digit 5 up in percentages and points, as Excel and Geostat do", () => {
    // toFixed rounds the binary value: (0.95).toFixed(1) is "0.9" but (10.25).toFixed(1) is "10.3".
    expect(formatShare(0.0095)).toBe("1.0%");
    expect(formatShare(0.0145)).toBe("1.5%");
    expect(formatShare(0.0735)).toBe("7.4%");
    expect(formatShare(0.0165)).toBe("1.7%");
    expect(formatShare(0.1285)).toBe("12.9%");
    expect(formatShare(-0.0095, true)).toBe("−1.0%");
    expect(formatShare(0.1025)).toBe("10.3%");
    expect(formatPoints(0.95)).toBe("1.0");
    expect(formatPoints(1.65, true)).toBe("+1.7");
    expect(formatPoints(-0.95, true)).toBe("−1.0");
    expect(formatPoints(12.85)).toBe("12.9");
    expect(formatShare(0.0097, false, 2)).toBe("0.97%");
    expect(formatShare(0.03965, false, 2)).toBe("3.97%");
    // Every x.x5 tie survives the fraction × 100 inside formatShare.
    for (let tenths = -300; tenths <= 300; tenths += 1) {
      const tie = (tenths * 10 + 5) / 100;
      const expected = (Math.sign(tie) * Math.round(Math.abs(tie) * 10 + 1e-9)) / 10;
      expect(formatShare(tie / 100), String(tie)).toBe(`${expected < 0 ? "−" : ""}${Math.abs(expected).toFixed(1)}%`);
    }
  });

  it("does not trim the digits of a large value while rounding it", () => {
    // The 12-significant-digit noise trim is for percentages and points; once the value counted in units of its last
    // shown decimal reaches 1e9, it keeps every digit.
    expect(formatPoints(123456789.1234, false, 4)).toBe("123,456,789.1234");
    expect(formatPoints(123456789.1246, false, 2)).toBe("123,456,789.12");
    expect(formatPoints(1234567890123.4, false, 0)).toBe("1,234,567,890,123");
    expect(formatPoints(123456789012.35, false, 2)).toBe("123,456,789,012.35");
    expect(roundForDisplay(98765432109876.5, 0)).toBe(98765432109877);
  });

  it("rounds a calculated value for a workbook cell as the page shows it, and keeps a gap a gap", () => {
    // toFixed rounds the binary value, so (0.95).toFixed(1) is "0.9" while the page shows 1.0.
    expect(roundShown(0.95, 1)).toBe(1);
    expect(roundShown(1.45, 1)).toBe(1.5);
    expect(roundShown(-0.95, 1)).toBe(-1);
    expect(roundShown(230.44, 1)).toBe(230.4);
    expect(roundShown(null, 1)).toBeNull();
  });

  it("groups thousands in percentages and points like every other figure", () => {
    expect(formatShare(45.651, true)).toBe("+4,565.1%");
    expect(formatShare(-12.5)).toBe("−1,250.0%");
    expect(formatShare(0.139)).toBe("13.9%");
    expect(formatShare(-0.0001, true)).toBe("−0.0%");
    expect(formatPoints(-1234.56)).toBe("−1,234.6");
    expect(formatPoints(1.25, true)).toBe("+1.3");
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

describe("wholePercents", () => {
  it("rounds shares to whole percentages that add up to 100 by largest remainder", () => {
    // The 2025 receipts bands: rounded one by one they read 31 + 26 + 9 + 8 + 5 + 12 + 10 = 101.
    const bands = [10_158_086_603, 8_261_217_582, 2_881_352_179, 2_728_646_345, 1_507_047_362, 3_730_637_205, 3_101_893_132];
    const total = bands.reduce((sum, value) => sum + value, 0);
    expect(bands.map((value) => Math.round((value / total) * 100)).reduce((sum, share) => sum + share, 0)).toBe(101);
    const whole = wholePercents(bands);
    expect(whole.reduce((sum, share) => sum + share, 0)).toBe(100);
    expect(whole).toEqual([31, 25, 9, 8, 5, 12, 10]);
  });

  it("gives an equal remainder to the earlier value and keeps all zeros at zero", () => {
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercents([0, 0])).toEqual([0, 0]);
    expect(wholePercents([5])).toEqual([100]);
  });
});

describe("formatAmountParts with significantBillions", () => {
  it("keeps three significant digits in billions and leaves the default one decimal unchanged", () => {
    expect(formatAmountParts(2_108_420_516, false, "ka", true)).toEqual({ num: "2.11", unit: "მლრდ ₾" });
    expect(formatAmountParts(27_723_319_039, false, "en", true)).toEqual({ num: "27.7", unit: "bn GEL" });
    expect(formatAmountParts(-1_526_000_000, false, "ka", true).num).toBe("−1.53");
    expect(formatAmountParts(486_198_057, false, "ka", true)).toEqual({ num: "486", unit: "მლნ ₾" });
    expect(formatAmountParts(2_108_420_516)).toEqual({ num: "2.1", unit: "მლრდ ₾" });
  });
});
