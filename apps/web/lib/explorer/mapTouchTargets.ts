// Invisible touch hit areas for map targets too small for a fingertip (owner
// decision D7, 2026-10-07). On a phone the 1000-unit map viewBox is drawn about
// 280–350px wide, so Tbilisi's region is 17x13px and most municipalities are under
// 24px. A target smaller than that gets a disk up to 32px across centred on
// it; the disks of two small neighbours never overlap. A city marker's disk is
// at least 24px across whatever its neighbours: a neighbour's disk gives way to
// it, and where two markers' disks overlap the tap goes to the nearer marker
// (`nearestCircle`). The maps measure their drawn width and enable the disks for
// coarse pointers only, and a first tap only previews the place.

export type MapTouchTarget = { id: string; cx: number; cy: number; r: number };
export type MapBounds = { minX: number; minY: number; maxX: number; maxY: number };
/** A place on the map; a `marker` (a city dot) always gets a disk at least 24px across. */
export type MapTargetBounds = { id: string; bounds: MapBounds; marker?: boolean };

/** The drawn width assumed until the map has been measured. */
const PHONE_MAP_WIDTH_PX = 350;
const MIN_TARGET_PX = 24;
const DISK_DIAMETER_PX = 32;

/** Bounds of an absolute `M x y L x y … Z` path, the only form the map artifacts use. */
export function pathBounds(d: string): MapBounds {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (numbers.length < 2 || numbers.length % 2 !== 0) throw new Error("Map path must contain x/y pairs");
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let index = 0; index < numbers.length; index += 2) {
    const x = numbers[index]!;
    const y = numbers[index + 1]!;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  }
  return bounds;
}

export function mapTouchTargets(targets: ReadonlyArray<MapTargetBounds>, viewBoxWidth: number, mapWidthPx = PHONE_MAP_WIDTH_PX): MapTouchTarget[] {
  const unitsPerPx = viewBoxWidth / mapWidthPx;
  const centres = targets.map(({ id, bounds, marker }) => ({
    id,
    marker: marker === true,
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    // The long side decides. Counting every shape with one narrow side as small
    // would make most municipalities "small", and splitting the gaps between all
    // of them leaves each disk no wider than the shape it serves.
    size: Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY),
  }));
  const maxR = (DISK_DIAMETER_PX / 2) * unitsPerPx;
  const minMarkerR = (MIN_TARGET_PX / 2) * unitsPerPx;
  const small = centres.filter((centre) => centre.marker || centre.size < MIN_TARGET_PX * unitsPerPx);
  const distance = (a: (typeof centres)[number], b: (typeof centres)[number]) => Math.hypot(a.x - b.x, a.y - b.y);
  // Two small targets split the gap between their centres, so their disks never
  // overlap and neither reaches the other's middle. A larger neighbour is at
  // least 24px across, so a 32px disk at its edge leaves most of it tappable.
  const halfGapR = (centre: (typeof centres)[number]) =>
    Math.min(maxR, ...small.filter((other) => other.id !== centre.id).map((other) => distance(centre, other) / 2));
  // Markers first: each keeps at least the 24px minimum.
  const markerR = new Map(small.filter((centre) => centre.marker).map((centre) => [centre.id, Math.max(minMarkerR, halfGapR(centre))]));
  const round = (value: number) => Math.round(value * 10) / 10;
  return small.flatMap((centre) => {
    const ownMarkerR = markerR.get(centre.id);
    // Any other small target gives way to a marker's disk where it is wider than half the gap.
    const r =
      ownMarkerR ??
      Math.min(
        halfGapR(centre),
        ...[...markerR].map(([id, otherR]) => distance(centre, small.find((other) => other.id === id)!) - otherR),
      );
    // A disk no wider than the shape itself adds nothing.
    if (ownMarkerR === undefined && r <= centre.size / 2) return [];
    return [{ id: centre.id, cx: round(centre.x), cy: round(centre.y), r: round(r) }];
  });
}

/**
 * The circle whose centre is nearest to (x, y) among those that reach it, each
 * reaching at least `minRadius` from its centre; null when none does. Picks
 * between overlapping touch disks, and lets a circle drawn under a larger one
 * still be tapped or hovered.
 */
export function nearestCircle<T extends { cx: number; cy: number; r: number }>(circles: readonly T[], x: number, y: number, minRadius = 0): T | null {
  let nearest: T | null = null;
  let nearestDistance = Infinity;
  for (const circle of circles) {
    const distance = Math.hypot(circle.cx - x, circle.cy - y);
    if (distance <= Math.max(circle.r, minRadius) && distance < nearestDistance) {
      nearest = circle;
      nearestDistance = distance;
    }
  }
  return nearest;
}
