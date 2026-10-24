import { describe, expect, it } from "vitest";
import {
  camFit,
  camProject,
  camUpdate,
  columnHeights,
  labelX,
  makeCam,
  pickPlace,
  RELIEF_MAX_HEIGHT,
  reliefScene,
  toScreen,
  worldX,
  worldZ,
  type Vec3,
} from "../../../components/landing/chapters/relief-math";
import type { MunicipalChapter, ReliefPlace } from "../../../lib/landing/chapters/types";

const place = (code: string, totalGel: number, rank: number): ReliefPlace => ({
  code,
  name: code,
  totalGel,
  perResidentGel: 1000,
  rank,
  city: false,
});

// 5 x 3 grid: place 0 owns the middle 3 x 1 strip, place 1 one cell below it, -2 the right column.
//  -1  -1  -1  -1  -2
//  -1   0   0   0  -2
//  -1  -1   1  -1  -2
const chapter: MunicipalChapter = {
  year: 2025,
  totalGel: 3e9,
  places: [place("04", 2e9, 1), place("06", 1e9, 2)],
  grid: { cols: 5, rows: 3, cells: [-1, -1, -1, -1, -2, -1, 0, 0, 0, -2, -1, -1, 1, -1, -2] },
};

// Clip-space position of world point q through the column-major matrix M, divided by w.
function throughMatrix(M: Float32Array, q: Vec3): [number, number] {
  const x = M[0] * q[0] + M[4] * q[1] + M[8] * q[2] + M[12];
  const y = M[1] * q[0] + M[5] * q[1] + M[9] * q[2] + M[13];
  const w = M[3] * q[0] + M[7] * q[1] + M[11] * q[2] + M[15];
  return [x / w, y / w];
}

function camera(aspect = 1.6) {
  const cam = makeCam(16, 12000);
  cam.aspect = aspect;
  cam.pos = [0, 900, 1100];
  camUpdate(cam);
  return cam;
}

describe("camera", () => {
  it("projects the look-at target to the centre and keeps screen right and up", () => {
    const cam = camera();
    const [cx, cy] = camProject(cam, [0, 0, 0], [0, 0]);
    expect(cx).toBeCloseTo(0, 9);
    expect(cy).toBeCloseTo(0, 9);
    expect(camProject(cam, [50, 0, 0], [0, 0])[0]).toBeGreaterThan(0);
    expect(camProject(cam, [0, 50, 0], [0, 0])[1]).toBeGreaterThan(0);
  });

  it("builds the matrix the GPU uses so it agrees with camProject", () => {
    const cam = camera();
    for (const q of [[120, 0, -40], [-300, 80, 200], [10, 270, 0]] as Vec3[]) {
      const [mx, my] = throughMatrix(cam.M, q);
      const [px, py] = camProject(cam, q, [0, 0]);
      expect(mx).toBeCloseTo(px, 6);
      expect(my).toBeCloseTo(py, 6);
    }
  });

  it("fits the points inside the margins at the closest such distance", () => {
    const cam = camera();
    const dir: Vec3 = [0, 640 / Math.hypot(640, 760), 760 / Math.hypot(640, 760)];
    const pts: Vec3[] = [[-500, 0, -270], [500, 0, -270], [-500, 0, 270], [500, 0, 270], [0, 270, 0]];
    const d = camFit(cam, dir, pts, 0.06, 0.11, 12000);
    const inside = (q: Vec3) => {
      const [x, y] = camProject(cam, q, [0, 0]);
      return Math.abs(x) <= 1 - 0.06 && Math.abs(y) <= 1 - 0.11;
    };
    expect(pts.every(inside)).toBe(true);
    camFit(cam, dir, pts, 0.06, 0.11, d * 0.97);
    expect(pts.every(inside)).toBe(false);
  });
});

describe("columnHeights", () => {
  it("gives the first place the full height and scales the others by its total", () => {
    expect(columnHeights([place("04", 2e9, 1), place("06", 5e8, 2), place("20", 0, 3)])).toEqual([RELIEF_MAX_HEIGHT, RELIEF_MAX_HEIGHT / 4, 0]);
  });

  it("caps at places[0], whatever its total", () => {
    expect(columnHeights([place("04", 4e9, 1), place("06", 1e9, 2)])[1]).toBe(RELIEF_MAX_HEIGHT / 4);
    expect(columnHeights([place("04", 0, 1), place("06", 0, 2)])).toEqual([0, 0]);
  });
});

describe("reliefScene", () => {
  const scene = reliefScene(chapter);

  it("centres each place on the mean of its cells and takes its height", () => {
    expect(scene.centers).toEqual([
      { c: 2, r: 1 },
      { c: 2, r: 2 },
    ]);
    expect(scene.heights).toEqual([RELIEF_MAX_HEIGHT, RELIEF_MAX_HEIGHT / 2]);
  });

  it("marks a place cell as border when a neighbour belongs elsewhere or is off the grid", () => {
    // The strip's middle cell touches place 1 below; every cell of the 3 x 1 strip is a border.
    expect([...scene.border.slice(5, 10)]).toEqual([0, 1, 1, 1, 0]);
    // Empty and occupied cells are never borders.
    expect(scene.border[0]).toBe(0);
    expect(scene.border[4]).toBe(0);
  });

  it("lays the grid out around the origin, one cell per 8 world units", () => {
    expect(worldX(0, 5)).toBe(-16);
    expect(worldX(4, 5)).toBe(16);
    expect(worldZ(1, 3)).toBe(0);
  });
});

describe("pickPlace", () => {
  const scene = reliefScene(chapter);
  const W = 800;
  const H = 500;
  const cam = camera(W / H);
  const screen = (q: Vec3) => toScreen(camProject(cam, q, [0, 0]), W, H);

  it("picks a column by any point along it, and the nearest cell otherwise", () => {
    const [x, y] = screen([worldX(2, 5), RELIEF_MAX_HEIGHT * 0.8, worldZ(1, 3)]);
    expect(pickPlace(cam, scene, W, H, x, y, 12)).toBe(0);
    const [ox, oy] = screen([worldX(4, 5), 0, worldZ(0, 3)]);
    expect(pickPlace(cam, scene, W, H, ox, oy, 12)).toBe(-2);
  });

  it("finds nothing far from every column and cell", () => {
    expect(pickPlace(cam, scene, W, H, 5, 5, 12)).toBe(-1);
  });
});

describe("toScreen and labelX", () => {
  it("maps clip space to CSS pixels with y down", () => {
    expect(toScreen([0, 0], 800, 500)).toEqual([400, 250]);
    expect(toScreen([-1, 1], 800, 500)).toEqual([0, 0]);
  });

  it("puts a label right of its column, or left of it when it would cross the edge", () => {
    expect(labelX(100, 120, 800)).toEqual({ x: 106, flipped: false });
    expect(labelX(700, 120, 800)).toEqual({ x: 574, flipped: true });
  });
});
