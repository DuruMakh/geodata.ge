import type { MunicipalChapter, ReliefPlace } from "../../../lib/landing/chapters/types";
import { clamp } from "./canvas";

// Pure geometry of the chapter 04 relief: a perspective camera (the same math as three.js
// PerspectiveCamera with lookAt and up = +Y), the scene laid out from the model's grid, column heights
// and picking. Ported from the design board's camUpdate / camProject / camFit and createMuni.

/** World units per grid cell: the model's cell size, so the world keeps the map's proportions. */
export const RELIEF_CELL = 8;
/** Height of the tallest column (the first place) in world units. */
export const RELIEF_MAX_HEIGHT = 270;

export type Vec3 = [number, number, number];

export type Camera = {
  fov: number;
  aspect: number;
  near: number;
  far: number;
  pos: Vec3;
  tgt: Vec3;
  /** Camera axes in world space: right, up and back (towards the camera). */
  axes: { x: Vec3; y: Vec3; z: Vec3 };
  /** Projection scale on x and y. */
  sx: number;
  sy: number;
  /** View-projection matrix, column-major as WebGL takes it. */
  M: Float32Array;
};

export function makeCam(fov: number, far = 6000): Camera {
  return {
    fov,
    aspect: 1,
    near: 1,
    far,
    pos: [0, 0, 0],
    tgt: [0, 0, 0],
    axes: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
    sx: 1,
    sy: 1,
    M: new Float32Array(16),
  };
}

/** Recompute the axes, projection and matrix after a change of position, target or aspect. */
export function camUpdate(c: Camera): void {
  let zx = c.pos[0] - c.tgt[0];
  let zy = c.pos[1] - c.tgt[1];
  let zz = c.pos[2] - c.tgt[2];
  let zl = Math.hypot(zx, zy, zz);
  if (!zl) {
    zz = 1;
    zl = 1;
  }
  zx /= zl;
  zy /= zl;
  zz /= zl;
  let xx = zz;
  let xz = -zx;
  let xl = Math.hypot(xx, xz);
  if (!xl) {
    xx = 1;
    xz = 0;
    xl = 1;
  }
  xx /= xl;
  xz /= xl;
  c.axes = { x: [xx, 0, xz], y: [zy * xz, zz * xx - zx * xz, -zy * xx], z: [zx, zy, zz] };

  const top = c.near * Math.tan((c.fov * Math.PI) / 360);
  c.sx = 1 / (c.aspect * top);
  c.sy = 1 / top;
  const C = -(c.far + c.near) / (c.far - c.near);
  const D = (-2 * c.far * c.near) / (c.far - c.near);
  const p = c.pos;
  const row = (a: Vec3) => [a[0], a[1], a[2], -(a[0] * p[0] + a[1] * p[1] + a[2] * p[2])];
  const V0 = row(c.axes.x);
  const V1 = row(c.axes.y);
  const V2 = row(c.axes.z);
  for (let j = 0; j < 4; j++) {
    c.M[j * 4] = c.sx * V0[j];
    c.M[j * 4 + 1] = c.sy * V1[j];
    c.M[j * 4 + 2] = C * V2[j] + (j === 3 ? D : 0);
    c.M[j * 4 + 3] = -V2[j];
  }
}

/** Clip-space x, y (-1..1 on screen) of world point `q`, written to `out`. */
export function camProject(c: Camera, q: Vec3, out: [number, number]): [number, number] {
  const { x, y, z } = c.axes;
  const dx = q[0] - c.pos[0];
  const dy = q[1] - c.pos[1];
  const dz = q[2] - c.pos[2];
  const cx = x[0] * dx + x[1] * dy + x[2] * dz;
  const cy = y[0] * dx + y[1] * dy + y[2] * dz;
  const cz = z[0] * dx + z[1] * dy + z[2] * dz;
  const w = -cz || 1e-6;
  out[0] = (c.sx * cx) / w;
  out[1] = (c.sy * cy) / w;
  return out;
}

/**
 * Move the camera along unit `dir` from its target to the closest distance (150..maxD) at which every
 * point stays `mx`, `my` inside the screen edges, and return that distance.
 */
export function camFit(c: Camera, dir: Vec3, pts: Vec3[], mx: number, my: number, maxD = 4000): number {
  const tmp: [number, number] = [0, 0];
  const place = (d: number) => {
    c.pos = [c.tgt[0] + dir[0] * d, c.tgt[1] + dir[1] * d, c.tgt[2] + dir[2] * d];
    camUpdate(c);
  };
  const fits = (d: number) => {
    place(d);
    for (const q of pts) {
      camProject(c, q, tmp);
      if (Math.abs(tmp[0]) > 1 - mx || Math.abs(tmp[1]) > 1 - my) return false;
    }
    return true;
  };
  let lo = 150;
  let hi = maxD;
  for (let i = 0; i < 28; i++) {
    const m = (lo + hi) / 2;
    if (fits(m)) hi = m;
    else lo = m;
  }
  place(hi);
  return hi;
}

/** CSS-pixel position in a W x H stage of clip-space point `ndc` (y down). */
export function toScreen(ndc: [number, number], W: number, H: number): [number, number] {
  return [(ndc[0] * 0.5 + 0.5) * W, (-ndc[1] * 0.5 + 0.5) * H];
}

/** World x of grid column `c` and world z of grid row `r`: the grid is centred on the origin. */
export const worldX = (c: number, cols: number) => (c - (cols - 1) / 2) * RELIEF_CELL;
export const worldZ = (r: number, rows: number) => (r - (rows - 1) / 2) * RELIEF_CELL;

/** Column height per place: its total over the first (largest) place's, times RELIEF_MAX_HEIGHT. */
export function columnHeights(places: ReliefPlace[]): number[] {
  const cap = places[0]?.totalGel ?? 0;
  return places.map((place) => (cap > 0 ? (place.totalGel / cap) * RELIEF_MAX_HEIGHT : 0));
}

export type ReliefScene = {
  cols: number;
  rows: number;
  /** The model's cells: place index, -1 empty, -2 occupied area. */
  cells: number[];
  /** 1 for a place cell whose neighbour above, below, left or right is not the same place. */
  border: Uint8Array;
  /** Mean column and row of each place's cells, where its column stands. */
  centers: { c: number; r: number }[];
  heights: number[];
};

export function reliefScene(data: MunicipalChapter): ReliefScene {
  const { cols, rows, cells } = data.grid;
  const owner = (r: number, c: number) => (r < 0 || c < 0 || r >= rows || c >= cols ? -1 : cells[r * cols + c]);
  const border = new Uint8Array(cols * rows);
  const sums = data.places.map(() => ({ c: 0, r: 0, n: 0 }));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const own = cells[r * cols + c];
      if (own < 0) continue;
      if (owner(r - 1, c) !== own || owner(r + 1, c) !== own || owner(r, c - 1) !== own || owner(r, c + 1) !== own) border[r * cols + c] = 1;
      sums[own].c += c;
      sums[own].r += r;
      sums[own].n += 1;
    }
  }
  return {
    cols,
    rows,
    cells,
    border,
    centers: sums.map((s) => ({ c: s.c / Math.max(1, s.n), r: s.r / Math.max(1, s.n) })),
    heights: columnHeights(data.places),
  };
}

/**
 * What the pointer at (px, py) in a W x H stage is over: a place whose column passes within 7 px
 * (columns under 8 world units are too short to aim at), else the nearest non-empty cell within
 * `cellPx` — a place index or -2 for an occupied area — else -1.
 */
export function pickPlace(cam: Camera, scene: ReliefScene, W: number, H: number, px: number, py: number, cellPx: number): number {
  const { cols, rows, cells, centers, heights } = scene;
  const pj: [number, number] = [0, 0];
  let best = -1;
  let bestD = Infinity;
  centers.forEach((center, i) => {
    const top = heights[i];
    if (top < 8) return;
    const x = worldX(center.c, cols);
    const z = worldZ(center.r, rows);
    const [ax, ay] = toScreen(camProject(cam, [x, 0, z], pj), W, H);
    const [bx, by] = toScreen(camProject(cam, [x, top, z], pj), W, H);
    const vx = bx - ax;
    const vy = by - ay;
    const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
    const d = Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    if (d < 7 && d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best >= 0) return best;

  let nearest = -1;
  bestD = Infinity;
  for (let k = 0; k < cells.length; k++) {
    if (cells[k] === -1) continue;
    const [sx, sy] = toScreen(camProject(cam, [worldX(k % cols, cols), 0, worldZ(Math.floor(k / cols), rows)], pj), W, H);
    const d = (sx - px) * (sx - px) + (sy - py) * (sy - py);
    if (d < bestD) {
      bestD = d;
      nearest = cells[k];
    }
  }
  return bestD <= cellPx * cellPx ? nearest : -1;
}

/** Left edge of a `width` px label beside a column at screen x `sx`: 6 px right of it, or left when it would pass W - 8. */
export function labelX(sx: number, width: number, W: number): { x: number; flipped: boolean } {
  return sx + 6 + width > W - 8 ? { x: sx - 6 - width, flipped: true } : { x: sx + 6, flipped: false };
}
