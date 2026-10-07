import { describe, expect, test } from "vitest";
import { MUNICIPALITY_MAP_ARTIFACT } from "../../lib/explorer/municipalityMapData";
import { regionalMapGeometry } from "../../lib/explorer/regionalEconomyMap";
import { mapTouchTargets, pathBounds, type MapBounds } from "../../lib/explorer/mapTouchTargets";

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

  const regional = regionalMapGeometry();
  const regionalTargets = [...regional.pathByRegion].map(([id, d]) => ({ id, bounds: pathBounds(d) }));
  const markerBounds = (x: number, y: number) => ({ minX: x - 7.5, minY: y - 7.5, maxX: x + 7.5, maxY: y + 7.5 });
  const markerCodes = new Set(MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => marker.code));
  const municipalTargets = [
    ...MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.filter((shape) => !markerCodes.has(shape.code)).map((shape) => ({ id: shape.code, bounds: pathBounds(shape.d) })),
    ...MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => ({ id: marker.code, bounds: markerBounds(marker.x, marker.y) })),
  ];

  test.each([
    ["regional", regionalTargets],
    ["municipal", municipalTargets],
  ] as const)("%s disks never overlap each other or cover another disk's place", (_name, targets) => {
    const disks = mapTouchTargets(targets, 1000);
    for (const disk of disks) {
      for (const other of disks.filter((candidate) => candidate.id !== disk.id)) {
        expect(Math.hypot(other.cx - disk.cx, other.cy - disk.cy)).toBeGreaterThanOrEqual(disk.r + other.r - 0.2);
      }
      const own = centre(targets.find((target) => target.id === disk.id)!.bounds);
      expect(Math.hypot(own.x - disk.cx, own.y - disk.cy)).toBeLessThan(0.1);
    }
  });

  test("Tbilisi's region and every self-governing city marker get a larger touch target", () => {
    const regionalDisks = mapTouchTargets(regionalTargets, 1000);
    const tbilisi = regionalDisks.find((disk) => disk.id === "region.tbilisi");
    // 17x13px on a phone today; the disk is at least 24px across at 350px.
    expect(tbilisi).toBeDefined();
    expect(tbilisi!.r * 2 * (350 / 1000)).toBeGreaterThanOrEqual(24);

    // Each city marker is a 15-unit dot (about 5px on a phone); its disk is wider
    // wherever the neighbouring small municipalities leave room.
    const municipalDisks = mapTouchTargets(municipalTargets, 1000);
    for (const code of markerCodes) {
      const disk = municipalDisks.find((candidate) => candidate.id === code);
      expect(disk, code).toBeDefined();
      expect(disk!.r, code).toBeGreaterThan(7.5);
    }
    // Tbilisi and Rustavi stand apart: their dots become 16px targets on a phone.
    for (const code of ["04", "48"]) expect(municipalDisks.find((disk) => disk.id === code)!.r * 2 * (350 / 1000)).toBeGreaterThanOrEqual(15.9);
  });
});
