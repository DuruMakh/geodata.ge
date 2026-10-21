import { describe, expect, test } from "vitest";
import { MUNICIPALITY_MAP_ARTIFACT } from "../../lib/explorer/municipalityMapData";
import { regionalMapGeometry } from "../../lib/explorer/regionalEconomyMap";
import { mapTouchTargets, nearestCircle, pathBounds, type MapBounds } from "../../lib/explorer/mapTouchTargets";

const centre = (bounds: MapBounds) => ({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 });

describe("pathBounds", () => {
  test("reads absolute M/L/Z paths", () => {
    expect(pathBounds("M10 20L30 5L25.5 40Z")).toEqual({ minX: 10, minY: 5, maxX: 30, maxY: 40 });
  });
});

describe("mapTouchTargets", () => {
  test("gives small targets a 32px disk, split halfway between two small neighbours", () => {
    const unitsPerPx = 1000 / 350;
    const targets = [
      { id: "lone", bounds: { minX: 100, minY: 600, maxX: 110, maxY: 608 } },
      { id: "pair-a", bounds: { minX: 100, minY: 100, maxX: 110, maxY: 108 } },
      { id: "pair-b", bounds: { minX: 140, minY: 100, maxX: 150, maxY: 108 } },
      { id: "big", bounds: { minX: 400, minY: 0, maxX: 900, maxY: 500 } },
    ];
    expect(mapTouchTargets(targets, 1000)).toEqual([
      { id: "lone", cx: 105, cy: 604, r: Math.round(16 * unitsPerPx * 10) / 10 },
      { id: "pair-a", cx: 105, cy: 104, r: 20 },
      { id: "pair-b", cx: 145, cy: 104, r: 20 },
    ]);
  });

  test("a target already a fingertip wide gets no disk", () => {
    expect(mapTouchTargets([{ id: "big", bounds: { minX: 0, minY: 0, maxX: 80, maxY: 10 } }], 1000)).toEqual([]);
  });

  test("a city marker's disk is at least 24px across and a small neighbour gives way to it", () => {
    const unitsPerPx = 1000 / 350;
    const city = { id: "city", marker: true, bounds: { minX: 92.5, minY: 92.5, maxX: 107.5, maxY: 107.5 } };
    // 20 units (7px) from the city: half the gap would leave the city a 7px disk.
    // The village's centre falls inside the city's disk, so it keeps its own shape and no disk.
    const village = { id: "village", bounds: { minX: 115, minY: 95, maxX: 125, maxY: 105 } };
    expect(mapTouchTargets([city, village], 1000)).toEqual([{ id: "city", cx: 100, cy: 100, r: Math.round(12 * unitsPerPx * 10) / 10 }]);
    // 50 units away, the town's disk stops at the edge of the city's instead of halfway.
    const town = { id: "town", bounds: { minX: 145, minY: 95, maxX: 155, maxY: 105 } };
    const [, townDisk] = mapTouchTargets([city, town], 1000);
    expect(townDisk!.r).toBeCloseTo(50 - 12 * unitsPerPx, 1);
  });

  test("disks are sized for the map's measured width", () => {
    const lone = [{ id: "lone", bounds: { minX: 100, minY: 600, maxX: 110, maxY: 608 } }];
    // 32px on a 335px-wide map is more map units than on the 350px default.
    expect(mapTouchTargets(lone, 1000, 335)).toEqual([{ id: "lone", cx: 105, cy: 604, r: Math.round(16 * (1000 / 335) * 10) / 10 }]);
    // A 40-unit shape is 24px across on a 600px map, so it needs no disk there.
    expect(mapTouchTargets([{ id: "mid", bounds: { minX: 0, minY: 0, maxX: 40, maxY: 10 } }], 1000, 600)).toEqual([]);
    expect(mapTouchTargets([{ id: "mid", bounds: { minX: 0, minY: 0, maxX: 40, maxY: 10 } }], 1000, 335)).toHaveLength(1);
  });

  const regional = regionalMapGeometry();
  const regionalTargets = [...regional.pathByRegion].map(([id, d]) => ({ id, bounds: pathBounds(d) }));
  const markerBounds = (x: number, y: number) => ({ minX: x - 7.5, minY: y - 7.5, maxX: x + 7.5, maxY: y + 7.5 });
  const markerCodes = new Set(MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => marker.code));
  const municipalTargets = [
    ...MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.filter((shape) => !markerCodes.has(shape.code)).map((shape) => ({ id: shape.code, bounds: pathBounds(shape.d) })),
    ...MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => ({ id: marker.code, marker: true, bounds: markerBounds(marker.x, marker.y) })),
  ];
  // The map's drawn width on 320, 375 and 390px phones (20px page gutters).
  const PHONE_MAP_WIDTHS = [280, 335, 350];

  describe.each(PHONE_MAP_WIDTHS)("a %ipx-wide map", (width) => {
    const pxPerUnit = width / 1000;

    test.each([
      ["regional", regionalTargets],
      ["municipal", municipalTargets],
    ] as const)("%s disks never overlap, except two markers', and never cover another disk's place", (_name, targets) => {
      const disks = mapTouchTargets(targets, 1000, width);
      const isMarker = (id: string) => targets.some((target) => target.id === id && "marker" in target && target.marker);
      for (const disk of disks) {
        for (const other of disks.filter((candidate) => candidate.id !== disk.id)) {
          const gap = Math.hypot(other.cx - disk.cx, other.cy - disk.cy);
          if (isMarker(disk.id) && isMarker(other.id)) expect(gap, `${disk.id}/${other.id}`).toBeGreaterThan(Math.max(disk.r, other.r));
          else expect(gap, `${disk.id}/${other.id}`).toBeGreaterThanOrEqual(disk.r + other.r - 0.2);
        }
        const own = centre(targets.find((target) => target.id === disk.id)!.bounds);
        expect(Math.hypot(own.x - disk.cx, own.y - disk.cy)).toBeLessThan(0.1);
      }
    });

    test("Tbilisi's region and every self-governing city marker get a disk at least 24px across", () => {
      const tbilisi = mapTouchTargets(regionalTargets, 1000, width).find((disk) => disk.id === "region.tbilisi");
      // 17x13px on a 350px map.
      expect(tbilisi).toBeDefined();
      expect(tbilisi!.r * 2 * pxPerUnit).toBeGreaterThanOrEqual(24);

      // Each city marker is a 15-unit dot (about 5px on a phone).
      const municipalDisks = mapTouchTargets(municipalTargets, 1000, width);
      expect(markerCodes.size).toBe(5);
      for (const code of markerCodes) {
        const disk = municipalDisks.find((candidate) => candidate.id === code);
        expect(disk, code).toBeDefined();
        expect(disk!.r * 2 * pxPerUnit, code).toBeGreaterThanOrEqual(23.9);
      }
    });
  });
});

describe("nearestCircle", () => {
  const big = { id: "big", cx: 100, cy: 100, r: 15 };
  const buried = { id: "buried", cx: 104, cy: 100, r: 15 };
  const tiny = { id: "tiny", cx: 200, cy: 100, r: 4 };

  test("picks the nearest centre, so a circle drawn under another is still reachable", () => {
    expect(nearestCircle([big, buried], 98, 100)).toBe(big);
    expect(nearestCircle([big, buried], 110, 100)).toBe(buried);
  });

  test("a circle reaches at least the minimum radius and nothing beyond its reach is picked", () => {
    expect(nearestCircle([big, tiny], 210, 100)).toBeNull();
    expect(nearestCircle([big, tiny], 210, 100, 12)).toBe(tiny);
    expect(nearestCircle([big, tiny], 150, 100, 12)).toBeNull();
  });
});
