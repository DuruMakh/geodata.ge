import { describe, expect, it } from "vitest";
import {
  barSlots,
  DEFICIT_RULE_PCT,
  deficitFloor,
  deficitScale,
  dumbbellHeight,
  fiveYearIndices,
  heightVars,
  largestWageGap,
  partnerNameColumn,
  partnersAxisTop,
  plannedRuns,
  plannedSpan,
  pointIndexAt,
  regionsAxisTop,
  regionsHeight,
  revenuePads,
  slotIndexAt,
  tradeYearTicks,
  valueY,
  wagesAxisTop,
  widestDeficitIndex,
  yearLabelIndices,
  yearRange,
} from "../../../components/landing/chapters/chart-layout";

describe("yearLabelIndices", () => {
  it("names the first year, every 4th and the last (2004-2025 as the board: 2004, 2008 ... 2020, 2025; 2024 gives way)", () => {
    const years = Array.from({ length: 22 }, (_, i) => 2004 + i);
    expect(yearLabelIndices(22).map((i) => years[i])).toEqual([2004, 2008, 2012, 2016, 2020, 2025]);
  });

  it("keeps a 4th-year pick that is 3 or more steps from the last", () => {
    expect(yearLabelIndices(20)).toEqual([0, 4, 8, 12, 16, 19]);
    expect(yearLabelIndices(21)).toEqual([0, 4, 8, 12, 16, 20]);
  });

  it("handles one and no years", () => {
    expect(yearLabelIndices(1)).toEqual([0]);
    expect(yearLabelIndices(0)).toEqual([]);
  });
});

describe("fiveYearIndices", () => {
  it("picks the years divisible by five", () => {
    const years = [1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006];
    expect(fiveYearIndices(years)).toEqual([4, 9]);
  });
});

describe("plannedRuns / plannedSpan", () => {
  it("returns maximal runs of consecutive planned years", () => {
    expect(plannedRuns([false, false, true, true, false, true])).toEqual([
      [2, 3],
      [5, 5],
    ]);
    expect(plannedRuns([false, false])).toEqual([]);
    expect(plannedRuns([true, true])).toEqual([[0, 1]]);
  });

  it("starts a span at the actual year before the run, never before the first year", () => {
    expect(plannedSpan([21, 21])).toEqual([20, 21]);
    expect(plannedSpan([0, 2])).toEqual([0, 2]);
  });
});

describe("barSlots / slotIndexAt", () => {
  it("splits the width into equal slots with bars at 66% of a slot, 2..20 px", () => {
    const slots = barSlots(36, 370, 37);
    expect(slots.slot).toBeCloseTo(10, 9);
    expect(slots.bar).toBeCloseTo(6.6, 9);
    expect(slots.center(0)).toBeCloseTo(41, 9);
    expect(slots.center(36)).toBeCloseTo(401, 9);
    expect(barSlots(0, 3000, 10).bar).toBe(20);
    expect(barSlots(0, 20, 37).bar).toBe(2);
  });

  it("finds the slot under a pointer, -1 outside", () => {
    expect(slotIndexAt(40, 36, 10, 37)).toBe(0);
    expect(slotIndexAt(405, 36, 10, 37)).toBe(36);
    expect(slotIndexAt(35, 36, 10, 37)).toBe(-1);
    expect(slotIndexAt(406, 36, 10, 37)).toBe(-1);
  });
});

describe("pointIndexAt", () => {
  it("snaps to the nearest year, allowing a margin outside the plot", () => {
    expect(pointIndexAt(44, 44, 840, 22, 10)).toBe(0);
    expect(pointIndexAt(884, 44, 840, 22, 10)).toBe(21);
    expect(pointIndexAt(44 + 840 / 21 + 5, 44, 840, 22, 10)).toBe(1);
    expect(pointIndexAt(40, 44, 840, 22, 10)).toBe(0);
    expect(pointIndexAt(30, 44, 840, 22, 10)).toBe(-1);
    expect(pointIndexAt(900, 44, 840, 22, 10)).toBe(-1);
  });
});

describe("revenuePads", () => {
  it("leaves room for band labels on wide charts and a share column on phones", () => {
    expect(revenuePads(900)).toEqual([26, 196, 28, 44]);
    expect(revenuePads(619)).toEqual([26, 46, 28, 40]);
    expect(revenuePads(620)).toEqual([26, 196, 28, 44]);
  });
});

describe("deficitScale", () => {
  it("runs -10..4 for the board's data (deepest -9.2, highest about +3)", () => {
    const scale = deficitScale([-9.16, -6.37, 3.1, 1.2, -1.5]);
    expect(scale.lo).toBe(-10);
    expect(scale.hi).toBe(4);
    expect(scale.ticks).toEqual([-10, -8, -6, -4, -2, 2, 4]);
  });

  it("never narrows below -4..2 and gives a value on a tick a step of room", () => {
    expect(deficitScale([-1, 0.5])).toEqual({ lo: -4, hi: 2, ticks: [-4, -2, 2] });
    expect(deficitScale([-4, 2]).lo).toBe(-6);
    expect(deficitScale([-4, 2]).hi).toBe(4);
  });
});

describe("valueY", () => {
  it("maps the top of the axis to the top and the bottom to the bottom", () => {
    expect(valueY(4, -10, 4, 34, 280)).toBe(34);
    expect(valueY(-10, -10, 4, 34, 280)).toBe(314);
    expect(valueY(0, -10, 4, 34, 280)).toBeCloseTo(34 + (4 / 14) * 280, 9);
  });

  it("puts the -3% rule between zero and the bottom", () => {
    const rule = valueY(DEFICIT_RULE_PCT, -10, 4, 34, 280);
    expect(rule).toBeCloseTo(34 + (7 / 14) * 280, 9);
    expect(rule).toBeGreaterThan(valueY(0, -10, 4, 34, 280));
  });
});

describe("yearRange", () => {
  it("writes a single year once and a range with an en dash", () => {
    expect(yearRange(2004, 2004)).toBe("2004");
    expect(yearRange(2004, 2007)).toBe("2004–2007");
  });
});

describe("regionsHeight", () => {
  it("gives 28 px per region and 40 px when narrow, plus 56 px", () => {
    expect(regionsHeight(11, false)).toBe(364);
    expect(regionsHeight(11, true)).toBe(496);
  });
});

describe("regionsAxisTop", () => {
  it("is the next multiple of 5 above the highest rate, also for an exact multiple", () => {
    expect(regionsAxisTop(17.5)).toBe(20);
    expect(regionsAxisTop(7)).toBe(10);
    expect(regionsAxisTop(20)).toBe(25);
  });
});

describe("dumbbellHeight", () => {
  it("gives 27 px per sector and 44 px when narrow, plus 40 px", () => {
    expect(dumbbellHeight(19, false)).toBe(553);
    expect(dumbbellHeight(19, true)).toBe(876);
  });
});

describe("wagesAxisTop", () => {
  it("is the next multiple of 2,000 above the highest wage, also for an exact multiple", () => {
    expect(wagesAxisTop(5900)).toBe(6000);
    expect(wagesAxisTop(6100)).toBe(8000);
    expect(wagesAxisTop(6000)).toBe(8000);
  });
});

describe("largestWageGap", () => {
  const sector = (id: string, women: number, men: number) => ({ id, label: id, average: (women + men) / 2, women, men });

  it("is the sector whose women's and men's wages are furthest apart, in either direction", () => {
    expect(largestWageGap([sector("a", 4000, 4500), sector("b", 3000, 3900), sector("c", 4700, 4000)]).id).toBe("b");
    expect(largestWageGap([sector("a", 4000, 4500), sector("c", 5600, 4000)]).id).toBe("c");
  });

  it("fails without sectors", () => {
    expect(() => largestWageGap([])).toThrow("Wages chapter: no sectors");
  });
});

describe("partnersAxisTop", () => {
  it("is the next whole billion above the largest one-way flow, also for an exact billion", () => {
    expect(partnersAxisTop(2.79)).toBe(3);
    expect(partnersAxisTop(0.4)).toBe(1);
    expect(partnersAxisTop(3)).toBe(4);
  });
});

describe("tradeYearTicks", () => {
  it("labels the first year and every tenth year after it", () => {
    const years = Array.from({ length: 31 }, (_, i) => 1995 + i);
    expect(tradeYearTicks(years).map((i) => years[i])).toEqual([1995, 2005, 2015, 2025]);
  });

  it("follows the years that exist, not their count", () => {
    expect(tradeYearTicks([2000, 2005, 2010, 2012])).toEqual([0, 2]);
    expect(tradeYearTicks([])).toEqual([]);
  });
});

describe("widestDeficitIndex", () => {
  it("is the year in which imports exceed exports by the most", () => {
    expect(widestDeficitIndex([1, 2, 7], [3, 9, 18])).toBe(2);
    expect(widestDeficitIndex([1, 2, 7], [3, 15, 9])).toBe(1);
  });

  it("is -1 when imports never exceed exports", () => {
    expect(widestDeficitIndex([4, 5], [4, 3])).toBe(-1);
  });
});

describe("heightVars", () => {
  it("sets the phone and desktop heights as the custom properties the wrapper's height classes read", () => {
    expect(heightVars(216, 168)).toEqual({ "--h-narrow": "216px", "--h-wide": "168px" });
  });
});

describe("deficitFloor", () => {
  it("is the lower of the two lines in each year, so the shading is the gap only where imports are above exports", () => {
    expect(deficitFloor([1, 5, 3], [3, 4, 3])).toEqual([1, 4, 3]);
  });
});

describe("partnerNameColumn", () => {
  it("fits the widest name plus 20 (12 when narrow) within 112 px (84) and a third of the plot (44%)", () => {
    expect(partnerNameColumn(60, 700, false)).toBe(112);
    expect(partnerNameColumn(150, 700, false)).toBe(170);
    expect(partnerNameColumn(40, 331, true)).toBe(84);
    expect(partnerNameColumn(90, 331, true)).toBe(102);
  });

  it("never takes more than 34% of the plot width (44% when narrow), but at least its minimum", () => {
    expect(partnerNameColumn(400, 700, false)).toBeCloseTo(238, 5);
    expect(partnerNameColumn(400, 300, false)).toBe(112);
    expect(partnerNameColumn(200, 331, true)).toBeCloseTo(145.64, 5);
  });
});
