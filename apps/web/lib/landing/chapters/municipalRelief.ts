import type { MunicipalListRow } from "../../explorer/municipalData";
import { pathBounds } from "../../explorer/mapTouchTargets";
import { MUNICIPALITY_MAP_ARTIFACT } from "../../explorer/municipalityMapData";
import { publicLabel } from "../../i18n/labels";
import type { Presentation } from "../../i18n/types";
import type { MunicipalChapter, ReliefPlace } from "./types";

// Chapter 04: every municipal budget as a place on the map, and the map
// rasterised into a grid of cells the relief chart raises into dots. All of it
// is build-time work on the explorer's own map geometry.

type MapArtifact = typeof MUNICIPALITY_MAP_ARTIFACT;

const EMPTY = -1;
const OCCUPIED = -2;
const CITY_CELLS = 4;

// A path is M/L/Z polylines in viewBox units; each M starts a ring.
function parseRings(d: string): number[][] {
  return d
    .split("M")
    .slice(1)
    .map((ring) => (ring.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number))
    .filter((numbers) => numbers.length >= 2);
}

// Even-odd ray cast across every ring, so a ring inside another is a hole.
function insideRings(rings: number[][], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) {
    const count = ring.length / 2;
    for (let i = 0, j = count - 1; i < count; j = i++) {
      const xi = ring[i * 2]!;
      const yi = ring[i * 2 + 1]!;
      const xj = ring[j * 2]!;
      const yj = ring[j * 2 + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Cells in row-major order whose centre lies inside the path. */
function cellsInside(d: string, cols: number, rowCount: number, cell: number): number[] {
  const rings = parseRings(d);
  const { minX, minY, maxX, maxY } = pathBounds(d);
  const c0 = Math.max(0, Math.floor(minX / cell - 0.5));
  const c1 = Math.min(cols - 1, Math.ceil(maxX / cell - 0.5));
  const r0 = Math.max(0, Math.floor(minY / cell - 0.5));
  const r1 = Math.min(rowCount - 1, Math.ceil(maxY / cell - 0.5));
  const found: number[] = [];
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      if (insideRings(rings, (c + 0.5) * cell, (r + 0.5) * cell)) found.push(r * cols + c);
    }
  }
  return found;
}

/** The `count` cells nearest the point among those `accept` allows; ties go to the lower row, then column. */
function nearestCells(
  cols: number,
  total: number,
  cell: number,
  x: number,
  y: number,
  count: number,
  accept: (index: number) => boolean,
): number[] {
  const candidates: { index: number; distance: number }[] = [];
  for (let index = 0; index < total; index += 1) {
    if (!accept(index)) continue;
    const dx = ((index % cols) + 0.5) * cell - x;
    const dy = (Math.floor(index / cols) + 0.5) * cell - y;
    candidates.push({ index, distance: dx * dx + dy * dy });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.index - b.index);
  return candidates.slice(0, count).map((candidate) => candidate.index);
}

// A city (Batumi, Kutaisi, Poti, Rustavi) has a marker and no shape of its own:
// Tbilisi has both, so it is drawn as the area it is. On the validated artifact
// this is the same as "a marker other than 04", because
// validateMunicipalityMapArtifact requires 04 to be the only code with both.
function isCity(artifact: MapArtifact, code: string): boolean {
  return (
    artifact.cityMarkers.some((marker) => marker.code === code) &&
    !artifact.municipalityPaths.some((shape) => shape.code === code)
  );
}

/**
 * cells[r * cols + c] is the index into `codes` of the place the cell belongs to,
 * -1 for empty, -2 for an occupied area. A cell belongs to the shape that holds
 * its centre; a city takes the cells nearest its marker from the shapes around it.
 */
export function rasterizeMunicipalities(
  artifact: MapArtifact,
  codes: string[],
  cell: number,
): { cols: number; rows: number; cells: number[] } {
  const [, , width, height] = artifact.viewBox.split(" ").map(Number) as [number, number, number, number];
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const cells = new Array<number>(cols * rows).fill(EMPTY);

  codes.forEach((code, placeIndex) => {
    const shape = artifact.municipalityPaths.find((candidate) => candidate.code === code);
    if (!shape) {
      if (!isCity(artifact, code)) throw new Error(`Municipality ${code} has no map shape or marker`);
      return;
    }
    const owned = cellsInside(shape.d, cols, rows, cell).filter((index) => cells[index] === EMPTY);
    for (const index of owned) cells[index] = placeIndex;
    if (owned.length > 0) return;
    // Smaller than one cell: the cell holding its first point, or the nearest free one.
    const [x, y] = parseRings(shape.d)[0]!;
    const c = Math.min(cols - 1, Math.max(0, Math.floor(x! / cell)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(y! / cell)));
    const here = r * cols + c;
    const free = cells[here]! < 0 ? here : nearestCells(cols, cells.length, cell, x!, y!, 1, (index) => cells[index]! < 0)[0];
    if (free === undefined) throw new Error(`Municipality ${code} has no free cell`);
    cells[free] = placeIndex;
  });

  for (const area of artifact.occupiedAreas) {
    for (const index of cellsInside(area.d, cols, rows, cell)) {
      if (cells[index] === EMPTY) cells[index] = OCCUPIED;
    }
  }

  const cityPlace = codes.map((code) => isCity(artifact, code));
  const remaining = codes.map(() => 0);
  for (const owner of cells) if (owner >= 0) remaining[owner]! += 1;
  codes.forEach((code, placeIndex) => {
    if (!cityPlace[placeIndex]) return;
    const marker = artifact.cityMarkers.find((candidate) => candidate.code === code)!;
    // Nearest first, but never a place's last cell: every place keeps one.
    const candidates = nearestCells(
      cols,
      cells.length,
      cell,
      marker.x,
      marker.y,
      cells.length,
      (index) => cells[index]! >= 0 && !cityPlace[cells[index]!],
    );
    const taken: number[] = [];
    for (const index of candidates) {
      if (taken.length === CITY_CELLS) break;
      const owner = cells[index]!;
      if (remaining[owner]! <= 1) continue;
      remaining[owner]! -= 1;
      taken.push(index);
    }
    if (taken.length === 0) throw new Error(`City ${code} has no surrounding cells to take`);
    for (const index of taken) cells[index] = placeIndex;
  });

  return { cols, rows, cells };
}

export function buildMunicipalChapter(
  rows: MunicipalListRow[],
  year: number,
  presentation: Presentation,
  artifact: MapArtifact = MUNICIPALITY_MAP_ARTIFACT,
  cell = 8,
): MunicipalChapter {
  const places: ReliefPlace[] = rows
    .filter((row) => row.kind === "municipality")
    .sort((a, b) => b.valueGel - a.valueGel || a.id.localeCompare(b.id))
    .map((row, index) => {
      if (row.budgetPerResidentGel === null) throw new Error(`Municipality ${row.id} has no per-resident budget for ${year}`);
      return {
        code: row.id,
        name: publicLabel(presentation.locale, row.id, row.nameKa, presentation.englishLabels),
        totalGel: row.valueGel,
        perResidentGel: row.budgetPerResidentGel,
        rank: index + 1,
        city: isCity(artifact, row.id),
      };
    });

  return {
    year,
    totalGel: places.reduce((sum, place) => sum + place.totalGel, 0),
    places,
    grid: rasterizeMunicipalities(artifact, places.map((place) => place.code), cell),
  };
}
