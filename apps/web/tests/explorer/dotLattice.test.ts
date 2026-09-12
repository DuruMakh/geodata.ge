import { describe, expect, it } from "vitest";
import { buildDotLattice } from "../../lib/explorer/dotLattice";

describe("buildDotLattice", () => {
  it("puts two columns per year and three rows per gridline step", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 21, gridStepCount: 4 });

    expect(lattice).not.toBeNull();
    expect(lattice?.colPitch).toBeCloseTo(20.4, 5);
    expect(lattice?.rowPitch).toBeCloseTo(278 / 12, 5);
  });

  it("lands every third row on a labelled gridline", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 21, gridStepCount: 4 });
    const stepHeight = 278 / 4;

    expect((lattice?.rowPitch ?? 0) * 3).toBeCloseTo(stepHeight, 5);
  });

  it("halves the density rather than smearing when a pitch falls below the floor", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 60, gridStepCount: 12 });

    // 816/59/2 = 6.9 → below the 12px floor, so one column per year.
    expect(lattice?.colPitch).toBeCloseTo(816 / 59, 5);
    // 278/12/3 = 7.7 → below the floor, so one row per gridline step.
    expect(lattice?.rowPitch).toBeCloseTo(278 / 12, 5);
  });

  it("draws no lattice when there is no interval to divide", () => {
    expect(buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 1, gridStepCount: 4 })).toBeNull();
    expect(buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 21, gridStepCount: 0 })).toBeNull();
    expect(buildDotLattice({ plotWidth: 0, plotHeight: 278, yearCount: 21, gridStepCount: 4 })).toBeNull();
  });
});

describe("buildDotLattice for monthly axes", () => {
  it("keeps year axes unchanged, with no column offset", () => {
    expect(buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 21, gridStepCount: 4 })?.colOffset).toBe(0);
  });

  it("groups months into half-year columns when single months are too dense", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 272, gridStepCount: 4, periodsPerYear: 12, firstPeriod: 2004 * 12 });
    const monthPitch = 816 / 271;
    // 1 and 3 months fall under the 12px floor; 6 months (≈18px) clears it.
    expect(lattice?.colPitch).toBeCloseTo(monthPitch * 6, 5);
    expect(lattice?.colOffset).toBe(0);
  });

  it("aligns columns to calendar boundaries when the range starts mid-year", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 272, gridStepCount: 4, periodsPerYear: 12, firstPeriod: 2004 * 12 + 2 });
    // March start: the first half-year boundary (July) is four months in.
    expect(lattice?.colOffset).toBeCloseTo((816 / 271) * 4, 5);
  });

  it("uses single-month columns on a short range", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 13, gridStepCount: 4, periodsPerYear: 12, firstPeriod: 2025 * 12 });
    expect(lattice?.colPitch).toBeCloseTo(816 / 12, 5);
  });
});
