import { describe, expect, it } from "vitest";
import { categoryIdFromCoicop } from "../../../lib/data/inflation/types";

describe("categoryIdFromCoicop", () => {
  it("pads divisions to two digits", () => {
    expect(categoryIdFromCoicop("1", 2)).toEqual({ categoryId: "cpi.cat.01", parentId: null });
    expect(categoryIdFromCoicop("12", 2)).toEqual({ categoryId: "cpi.cat.12", parentId: null });
  });

  it("separates a subgroup from the division sharing its digits", () => {
    expect(categoryIdFromCoicop("11", 3)).toEqual({ categoryId: "cpi.cat.01_1", parentId: "cpi.cat.01" });
    expect(categoryIdFromCoicop("11", 2)).toEqual({ categoryId: "cpi.cat.11", parentId: null });
  });

  it("splits three-digit codes on the last digit", () => {
    expect(categoryIdFromCoicop("105", 3)).toEqual({ categoryId: "cpi.cat.10_5", parentId: "cpi.cat.10" });
    expect(categoryIdFromCoicop("127", 3)).toEqual({ categoryId: "cpi.cat.12_7", parentId: "cpi.cat.12" });
  });

  it("rejects codes outside the twelve divisions", () => {
    expect(() => categoryIdFromCoicop("13", 2)).toThrow(/division/);
    expect(() => categoryIdFromCoicop("0", 2)).toThrow(/division/);
    expect(() => categoryIdFromCoicop("x1", 3)).toThrow(/COICOP code/);
  });
});
