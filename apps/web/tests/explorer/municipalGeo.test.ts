import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegionShapes, MAP_HEIGHT, MAP_WIDTH, projectPoint, REGION_ID_BY_SHAPE_ISO } from "../../lib/explorer/municipalGeo";
import { GEORGIA_GEO } from "../../lib/landing/georgiaGeo";

const EXPECTED_ISO = [
  "GE-AB", "GE-AJ", "GE-GU", "GE-IM", "GE-KA", "GE-KK",
  "GE-MM", "GE-RL", "GE-SJ", "GE-SK", "GE-SZ", "GE-TB",
].sort();

// Ties each region's iso to its own identity (en + ka name), not merely to the
// set of all iso values. The "carries all twelve ADM1 units" test below sorts
// both arrays before comparing, so it would still pass if two regions' iso
// values were swapped with each other — and the shape ↔ region join table in
// municipalGeo.ts keys on exactly this pairing, so a swap would silently
// colour one region's shape with a different region's budget data.
const EXPECTED_IDENTITY_BY_ISO: Record<string, { en: string; ka: string }> = {
  "GE-AB": { en: "Abkhazia", ka: "აფხაზეთი" },
  "GE-AJ": { en: "Adjara", ka: "აჭარა" },
  "GE-GU": { en: "Guria", ka: "გურია" },
  "GE-IM": { en: "Imereti", ka: "იმერეთი" },
  "GE-KA": { en: "Kakheti", ka: "კახეთი" },
  "GE-KK": { en: "Kvemo Kartli", ka: "ქვემო ქართლი" },
  "GE-MM": { en: "Mtskheta-Mtianeti", ka: "მცხეთა-მთიანეთი" },
  "GE-RL": { en: "Racha-Lechkhumi", ka: "რაჭა-ლეჩხუმი და ქვემო სვანეთი" },
  "GE-SZ": { en: "Samegrelo-Zemo Svaneti", ka: "სამეგრელო-ზემო სვანეთი" },
  "GE-SJ": { en: "Samtskhe-Javakheti", ka: "სამცხე-ჯავახეთი" },
  "GE-SK": { en: "Shida Kartli", ka: "შიდა ქართლი" },
  "GE-TB": { en: "Tbilisi", ka: "თბილისი" },
};

const servedRegionIds = (
  JSON.parse(
    readFileSync(path.resolve(process.cwd(), "../../data/taxonomy/municipal-regions.json"), "utf8"),
  ) as Array<{ id: string }>
).map((region) => region.id);

describe("region geometry", () => {
  it("carries all twelve ADM1 units, each with a stable ISO code", () => {
    expect(GEORGIA_GEO.regions).toHaveLength(12);
    expect(GEORGIA_GEO.regions.map((region) => region.iso).sort()).toEqual(EXPECTED_ISO);
  });

  it("pairs each region's ISO code to its own identity, not just the set of all codes", () => {
    for (const region of GEORGIA_GEO.regions) {
      const expected = EXPECTED_IDENTITY_BY_ISO[region.iso];
      expect(expected, `${region.iso} is not a recognised Georgian ADM1 code`).toBeDefined();
      expect(region.en, `en name mismatch for ${region.iso}`).toBe(expected!.en);
      expect(region.ka, `ka name mismatch for ${region.iso}`).toBe(expected!.ka);
    }
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

describe("the shape ↔ region join", () => {
  it("resolves every shape to a region or a stated no-data reason", () => {
    for (const shape of buildRegionShapes()) {
      if (shape.regionId === null) {
        expect(shape.noDataReason).toBe("occupied_territory");
      } else {
        expect(servedRegionIds).toContain(shape.regionId);
        expect(shape.noDataReason).toBeNull();
      }
    }
  });

  it("resolves every served region to exactly one shape", () => {
    const shapes = buildRegionShapes();
    for (const regionId of servedRegionIds) {
      const matches = shapes.filter((shape) => shape.regionId === regionId);
      expect(matches, `${regionId} must map to exactly one shape`).toHaveLength(1);
    }
  });

  it("leaves exactly one shape without data — the occupied territory", () => {
    const noData = buildRegionShapes().filter((shape) => shape.regionId === null);
    expect(noData).toHaveLength(1);
    expect(noData[0]!.shapeIso).toBe("GE-AB");
  });

  it("maps no shape to a region outside the served taxonomy", () => {
    for (const regionId of Object.values(REGION_ID_BY_SHAPE_ISO)) {
      if (regionId !== null) expect(servedRegionIds).toContain(regionId);
    }
  });

  it("throws and names the offending shape when an ADM1 shape has no join-table entry", () => {
    // Every other test in this file runs buildRegionShapes() against the real,
    // fully-mapped GEORGIA_GEO.regions, where `regionId === undefined` can
    // never happen — the branch is structurally unreachable there. This is
    // the module's central invariant (nothing may be silently unmapped), so
    // it needs its own case: force a shape out of the join table and prove
    // the module refuses to drop it silently, naming which shape it was.
    const removedEntry = REGION_ID_BY_SHAPE_ISO["GE-SK"];
    delete REGION_ID_BY_SHAPE_ISO["GE-SK"];

    try {
      expect(() => buildRegionShapes()).toThrow(/GE-SK.*Shida Kartli/);
    } finally {
      // Restoring here, not after the assertion, so a failed expect() above
      // cannot leave the mutation to leak into every later test in this file.
      REGION_ID_BY_SHAPE_ISO["GE-SK"] = removedEntry;
    }
  });
});

describe("the projection", () => {
  it("is deterministic", () => {
    expect(buildRegionShapes().map((s) => s.d)).toEqual(buildRegionShapes().map((s) => s.d));
  });

  it("keeps every point inside the viewBox", () => {
    for (const shape of buildRegionShapes()) {
      const numbers = shape.d.match(/-?\d+(\.\d+)?/g) ?? [];
      expect(numbers.length).toBeGreaterThan(0);
      for (let i = 0; i < numbers.length; i += 2) {
        const x = Number(numbers[i]);
        const y = Number(numbers[i + 1]);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(MAP_WIDTH);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(MAP_HEIGHT);
      }
    }
  });

  it("produces closed paths", () => {
    for (const shape of buildRegionShapes()) {
      expect(shape.d.startsWith("M")).toBe(true);
      expect(shape.d.endsWith("Z")).toBe(true);
    }
  });

  it("places points through the same function the rings use", () => {
    // The self-governing city dots call projectPoint directly. If a caller ever
    // reimplements the arithmetic, the dots drift off the shapes silently —
    // this pins the two to one implementation.
    const { x, y } = projectPoint(GEORGIA_GEO.bbox.lonMin, GEORGIA_GEO.bbox.latMax);
    expect(x).toBe(0);
    expect(y).toBe(0);
    const corner = projectPoint(GEORGIA_GEO.bbox.lonMax, GEORGIA_GEO.bbox.latMin);
    expect(corner.x).toBeCloseTo(MAP_WIDTH, 0);
    expect(corner.y).toBeCloseTo(MAP_HEIGHT, 0);
  });
});
