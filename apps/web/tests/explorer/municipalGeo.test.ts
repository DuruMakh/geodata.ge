import { describe, expect, it } from "vitest";
import { GEORGIA_GEO } from "../../lib/landing/georgiaGeo";

const EXPECTED_ISO = [
  "GE-AB", "GE-AJ", "GE-GU", "GE-IM", "GE-KA", "GE-KK",
  "GE-MM", "GE-RL", "GE-SJ", "GE-SK", "GE-SZ", "GE-TB",
].sort();

describe("region geometry", () => {
  it("carries all twelve ADM1 units, each with a stable ISO code", () => {
    expect(GEORGIA_GEO.regions).toHaveLength(12);
    expect(GEORGIA_GEO.regions.map((region) => region.iso).sort()).toEqual(EXPECTED_ISO);
  });

  it("keeps every ring inside Georgia's bounding box", () => {
    for (const region of GEORGIA_GEO.regions) {
      for (const [lon, lat] of region.ring) {
        expect(lon).toBeGreaterThanOrEqual(39.9);
        expect(lon).toBeLessThanOrEqual(46.8);
        expect(lat).toBeGreaterThanOrEqual(41.0);
        expect(lat).toBeLessThanOrEqual(43.7);
      }
    }
  });

  it("simplifies to a path budget the index page can inline", () => {
    const points = GEORGIA_GEO.regions.reduce((sum, region) => sum + region.ring.length, 0);
    // 3,720 raw points at source; Douglas-Peucker at 0.006° yields ~1,194.
    expect(points).toBeGreaterThan(600);
    expect(points).toBeLessThan(1600);
  });

  it("keeps every ring a usable polygon", () => {
    for (const region of GEORGIA_GEO.regions) {
      expect(region.ring.length).toBeGreaterThanOrEqual(20);
    }
  });
});
