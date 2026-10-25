import { describe, expect, it } from "vitest";
import { buildDeficitChapter } from "../../../lib/landing/chapters/deficit";
import type { ServedGeneralGovernmentBalanceFact } from "../../../lib/servedRows";

function fact(year: number, pct: number, status: "actual" | "projection" = "actual"): ServedGeneralGovernmentBalanceFact {
  return {
    year,
    generalGovernmentBalancePctGdp: pct,
    generalGovernmentBalanceGel: Math.round(pct * 1_000_000_000),
    status,
    sourceId: "source.test",
    lastReviewedAt: "2026-01-01",
  };
}

describe("buildDeficitChapter", () => {
  it("years ascending; projectionFrom is the first year with status projection, null when none", () => {
    const chapter = buildDeficitChapter([
      fact(2027, -2.3, "projection"),
      fact(2024, -2.1),
      fact(2026, -2.4, "projection"),
      fact(2025, -1.5),
    ]);
    expect(chapter.years).toEqual([2024, 2025, 2026, 2027]);
    expect(chapter.pctGdp).toEqual([-2.1, -1.5, -2.4, -2.3]);
    expect(chapter.gel).toEqual([-2_100_000_000, -1_500_000_000, -2_400_000_000, -2_300_000_000]);
    expect(chapter.projectionFrom).toBe(2026);
    expect(buildDeficitChapter([fact(2024, -2.1), fact(2025, -1.5)]).projectionFrom).toBeNull();
  });

  it("deepest is the most negative actual pct; earlier is the most negative actual pct at least five years before deepest", () => {
    const chapter = buildDeficitChapter([
      fact(2009, -6.37),
      fact(2015, -1.16),
      fact(2016, -8),
      fact(2019, -1.8),
      fact(2020, -9.16),
      fact(2021, -6),
      fact(2026, -12, "projection"),
    ]);
    expect(chapter.deepest).toEqual({ year: 2020, pct: -9.16 });
    expect(chapter.earlier).toEqual({ year: 2009, pct: -6.37 });
  });

  it("earlier is null when no actual year is five or more years before deepest", () => {
    const chapter = buildDeficitChapter([fact(2017, -1), fact(2018, -2), fact(2019, -3), fact(2020, -9.16)]);
    expect(chapter.deepest).toEqual({ year: 2020, pct: -9.16 });
    expect(chapter.earlier).toBeNull();
  });

  it("latestActual is the last actual year and its pct, also when the first year is already a projection", () => {
    expect(buildDeficitChapter([fact(2024, -2.1), fact(2025, -1.5), fact(2026, -2.4, "projection")]).latestActual).toEqual({ year: 2025, pct: -1.5 });
    expect(buildDeficitChapter([fact(2024, -2.1), fact(2025, 0.4)]).latestActual).toEqual({ year: 2025, pct: 0.4 });
    const projectedFirst = buildDeficitChapter([fact(2023, -3, "projection"), fact(2024, -2.1), fact(2025, -1.5)]);
    expect(projectedFirst.projectionFrom).toBe(2023);
    expect(projectedFirst.latestActual).toEqual({ year: 2025, pct: -1.5 });
  });

  it("a zero balance counts as a surplus year", () => {
    expect(buildDeficitChapter([fact(2004, 0), fact(2005, 0.5), fact(2006, -1)]).surplusRun).toEqual({ first: 2004, last: 2005 });
  });

  it("surplusRun is the longest run of consecutive actual years with pct >= 0 (ties: earliest); null when none", () => {
    const chapter = buildDeficitChapter([
      fact(2003, -0.5),
      fact(2004, 3.6),
      fact(2005, 2.1),
      fact(2006, 3.3),
      fact(2007, 0.8),
      fact(2008, -1.9),
      fact(2010, 1),
      fact(2011, 1),
      fact(2012, 1),
      fact(2013, 1),
      fact(2026, 1, "projection"),
    ]);
    expect(chapter.surplusRun).toEqual({ first: 2004, last: 2007 });
    expect(buildDeficitChapter([fact(2019, -1), fact(2020, -2)]).surplusRun).toBeNull();
  });

  it("a gap in calendar years breaks a surplus run", () => {
    const chapter = buildDeficitChapter([fact(2004, 1), fact(2005, 1), fact(2007, 1), fact(2008, 1), fact(2009, 1), fact(2010, -1)]);
    expect(chapter.surplusRun).toEqual({ first: 2007, last: 2009 });
  });

  it("throws when there is no actual year", () => {
    expect(() => buildDeficitChapter([])).toThrow();
    expect(() => buildDeficitChapter([fact(2026, -2, "projection")])).toThrow();
  });
});
