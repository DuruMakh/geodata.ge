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
