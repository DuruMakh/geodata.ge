import { describe, expect, it } from "vitest";
import { yearRowScrollLeft } from "../../components/analysis/analysis-view";

const row = (scrollLeft: number) => ({ scrollLeft, clientWidth: 350, scrollWidth: 1300 });

describe("analysis year row scroll", () => {
  it("opens on the latest year at the row's end", () => {
    expect(yearRowScrollLeft(row(0), { offsetLeft: 1260, offsetWidth: 40 })).toBe(950);
  });

  it("centres an out-of-view year", () => {
    expect(yearRowScrollLeft(row(950), { offsetLeft: 500, offsetWidth: 40 })).toBe(345);
  });

  it("never scrolls before the start", () => {
    expect(yearRowScrollLeft(row(950), { offsetLeft: 0, offsetWidth: 40 })).toBe(0);
  });

  it("leaves the row alone when the active year is already visible", () => {
    expect(yearRowScrollLeft(row(950), { offsetLeft: 1000, offsetWidth: 40 })).toBe(950);
  });
});
