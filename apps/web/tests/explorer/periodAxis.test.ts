import { describe, expect, it } from "vitest";
import { periodLabelIndices } from "../../lib/explorer/periodAxis";

describe("periodLabelIndices", () => {
  it("keeps the year rule: every ceil(n/12)-th year plus the last, never crowding it", () => {
    const years = Array.from({ length: 22 }, (_, index) => 2004 + index);
    // n = 22 → step 2; index 20 is dropped because it sits one step from the last.
    expect(periodLabelIndices(years)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 21]);
  });

  it("labels calendar-year starts on a monthly axis, thinned to twelve", () => {
    const months = Array.from({ length: 272 }, (_, index) => 2004 * 12 + index);
    const indices = periodLabelIndices(months, 12);
    expect(indices.map((index) => Math.floor(months[index]! / 12))).toEqual([2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026]);
  });

  it("falls back to evenly spaced months under two calendar years", () => {
    const months = Array.from({ length: 14 }, (_, index) => 2025 * 12 + 3 + index);
    expect(periodLabelIndices(months, 12)).toEqual([0, 3, 6, 9, 13]);
  });
});
