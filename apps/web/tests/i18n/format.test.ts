import { describe, expect, it } from "vitest";
import { formatAmount, formatAmountParts, formatDisplayDate, formatPerResidentGel, formatSignedAmount, unitsFor } from "../../lib/explorer/format";

describe("bilingual display formatting", () => {
  it.each([null, undefined, 0, -1000, 1, 9_994, 999_499_999, 999_500_000, 2_200_000_000])("preserves numerical precision and missingness for %s", (value) => {
    for (const signed of [false, true]) {
      expect(formatAmountParts(value, signed, "en").num).toBe(formatAmountParts(value, signed, "ka").num);
    }
  });

  it("uses English currency and magnitude labels", () => {
    expect(formatAmountParts(2_200_000_000, false, "en")).toEqual({ num: "2.2", unit: "bn GEL" });
    expect(formatAmountParts(2_200_000_000)).toEqual({ num: "2.2", unit: "მლრდ ₾" });
    expect(formatAmountParts(null, false, "en")).toEqual({ num: "—", unit: "" });
    expect(formatAmount(15_000_000, "en")).toBe("15.0 mln GEL");
    expect(formatSignedAmount(-15_000_000, "en")).toBe("−15.0 mln GEL");
    expect(formatPerResidentGel(1335.2, "en")).toBe("1,335 GEL");
    expect(formatPerResidentGel(null, "en")).toBe("—");
    expect(unitsFor("en")).toEqual({ bn: { divisor: 1_000_000_000, decimals: 1, label: "bn" }, mln: { divisor: 1_000_000, decimals: 0, label: "mln" } });
    expect(unitsFor("ka").bn.divisor).toBe(unitsFor("en").bn.divisor);
  });

  it("formats a date-only value with an explicit UTC calendar", () => {
    expect(formatDisplayDate("2026-09-05", "en")).toBe("5 September 2026");
    expect(formatDisplayDate("2026-09-05", "ka")).toBe("5 სექტემბერი, 2026");
  });
});
