import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { niceScale } from "../../lib/explorer/chartScale";
import { annualAgeFacts, annualPyramid, shareOf, type Pyramid } from "../../lib/explorer/demographyAgeSex";
import { PYRAMID, pyramidLayout } from "../../lib/explorer/pyramidLayout";

const shares = (pyramid: Pyramid) => ({
  male: pyramid.rows.map((row) => shareOf(row.male, pyramid.total)),
  female: pyramid.rows.map((row) => shareOf(row.female, pyramid.total)),
});

let now: { male: number[]; female: number[] };
let then: { male: number[]; female: number[] };
beforeAll(async () => {
  const annual = annualAgeFacts((await loadServedDemographyData()).facts);
  now = shares(annualPyramid(annual, 2026));
  then = shares(annualPyramid(annual, 2004));
});

describe("pyramid layout", () => {
  it("puts a 44px gutter between two halves that meet the bars", () => {
    const layout = pyramidLayout({ width: 600, ...now });
    expect(layout.width).toBe(600);
    expect(layout.centreRight - layout.centreLeft).toBe(44);
    const half = (600 - PYRAMID.gutter - 2 * PYRAMID.pad) / 2;
    expect(layout.centreLeft).toBe(PYRAMID.pad + half);
    expect(layout.rows).toHaveLength(18);
    for (const row of layout.rows) {
      expect(row.maleX + row.maleWidth).toBeCloseTo(layout.centreLeft, 9);
      expect(row.maleWidth).toBeLessThanOrEqual(half);
      expect(row.femaleWidth).toBeLessThanOrEqual(half);
    }
    expect(layout.height).toBe(PYRAMID.header + 18 * PYRAMID.rowPitch + PYRAMID.axis);
  });

  it("draws equal values at equal widths and the youngest row at the bottom", () => {
    const layout = pyramidLayout({ width: 600, male: [1, 2, 3], female: [3, 2, 1] });
    expect(layout.rows[0]!.maleWidth).toBe(layout.rows[2]!.femaleWidth);
    expect(layout.rows[1]!.maleWidth).toBe(layout.rows[1]!.femaleWidth);
    const full = pyramidLayout({ width: 600, ...now });
    expect(full.rows[0]!.y).toBeGreaterThan(full.rows[17]!.y);
  });

  it("shares one nice scale with the comparison year", () => {
    const layout = pyramidLayout({ width: 600, ...now, compare: then });
    const all = [...now.male, ...now.female, ...then.male, ...then.female];
    expect(layout.scaleMax).toBe(niceScale(0, Math.max(...all)).top);
    for (const value of all) expect(layout.scaleMax).toBeGreaterThanOrEqual(value);
    const alone = pyramidLayout({ width: 600, ...now });
    expect(alone.scaleMax).toBe(niceScale(0, Math.max(...now.male, ...now.female)).top);
  });

  it("ticks run from 0 to the scale's top, mirrored", () => {
    const layout = pyramidLayout({ width: 600, ...now });
    const { step } = niceScale(0, Math.max(...now.male, ...now.female));
    expect(layout.ticks[0]!.value).toBe(0);
    expect(layout.ticks.at(-1)!.value).toBe(layout.scaleMax);
    expect(layout.ticks[1]!.value).toBeCloseTo(step, 9);
    for (const tick of layout.ticks) {
      expect(layout.centreLeft - tick.leftX).toBeCloseTo(tick.rightX - layout.centreRight, 9);
    }
    expect(layout.ticks[0]!.leftX).toBe(layout.centreLeft);
    expect(layout.ticks[0]!.rightX).toBe(layout.centreRight);
  });

  it("never lays out narrower than 320px", () => {
    expect(pyramidLayout({ width: 200, ...now }).width).toBe(PYRAMID.minWidth);
  });

  it("draws the comparison outline only with a comparison", () => {
    expect(pyramidLayout({ width: 600, ...now }).outline).toBeNull();
    expect(pyramidLayout({ width: 600, ...now, compare: null }).outline).toBeNull();
    const outline = pyramidLayout({ width: 600, ...now, compare: then }).outline!;
    expect(outline.left).toMatch(/^M/);
    expect(outline.right).toMatch(/^M/);
    expect(outline.left).toMatch(/H/);
    expect(outline.left).toMatch(/V/);
  });

  it("covers the five oldest rows with the 65+ band", () => {
    const layout = pyramidLayout({ width: 600, ...now });
    expect(Math.abs(layout.oldBandY - layout.rows[17]!.y)).toBeLessThan(PYRAMID.rowPitch);
    expect(layout.oldBandHeight).toBe(5 * PYRAMID.rowPitch);
    expect(layout.oldBandY + layout.oldBandHeight).toBeLessThanOrEqual(layout.rows[12]!.y);
  });
});
