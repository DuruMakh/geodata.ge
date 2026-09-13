import { expect, test } from "vitest";
import { sharePercent, annualGrowthPercent, indexToGrowthPercent } from "../../../lib/data/economicSectors/calculations";

test("GDP share is percent, using the full GDP denominator", () => {
  expect(sharePercent("15", "120")).toBe("12.5");
  expect(sharePercent("120", "120")).toBe("100");
  expect(sharePercent("0", "120")).toBe("0");
  expect(sharePercent("15", null)).toBeNull();
  expect(sharePercent("15", "0")).toBeNull();
});
test("annual real growth retains contraction and missing history", () => {
  expect(annualGrowthPercent("90", "100")).toBe("-10");
  expect(annualGrowthPercent("100", "100")).toBe("0");
  expect(annualGrowthPercent("90", null)).toBeNull();
  expect(annualGrowthPercent("90", "0")).toBeNull();
});
test("null numerators and non-positive denominators produce gaps", () => {
  expect(sharePercent(null, "120")).toBeNull();
  expect(sharePercent("15", "-1")).toBeNull();
  expect(annualGrowthPercent(null, "100")).toBeNull();
  expect(annualGrowthPercent("90", "-1")).toBeNull();
});
test("calculated values round to twenty decimal places without binary floating point", () => {
  expect(sharePercent("1", "3")).toBe("33.33333333333333333333");
  expect(sharePercent("2", "3")).toBe("66.66666666666666666667");
  expect(annualGrowthPercent("1", "3")).toBe("-66.66666666666666666667");
  expect(sharePercent("0.1", "0.3")).toBe("33.33333333333333333333");
});
test("published previous-year-100 indices convert to percentage growth", () => {
  expect(indexToGrowthPercent("107.46161492416432")).toBe("7.46161492416432");
  expect(indexToGrowthPercent("107.5")).toBe("7.5");
  expect(indexToGrowthPercent("90")).toBe("-10");
  expect(indexToGrowthPercent("100")).toBe("0");
  expect(indexToGrowthPercent("0")).toBe("-100");
  expect(indexToGrowthPercent(null)).toBeNull();
});
