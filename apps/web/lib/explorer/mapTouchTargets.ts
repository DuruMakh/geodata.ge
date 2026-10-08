// Invisible touch hit areas for map targets too small for a fingertip (owner
// decision D7, 2026-10-07). On a phone the 1000-unit map viewBox is drawn about
// 350px wide, so Tbilisi's region is 17x13px and most municipalities are under
// 24px. A target smaller than that gets a disk up to 32px across centred on
// it; the disks of two small neighbours never overlap. The maps enable the
// disks for coarse pointers only, and a first tap only previews the place.

export type MapTouchTarget = { id: string; cx: number; cy: number; r: number };
export type MapBounds = { minX: number; minY: number; maxX: number; maxY: number };

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

export function mapTouchTargets(targets: ReadonlyArray<{ id: string; bounds: MapBounds }>, viewBoxWidth: number): MapTouchTarget[] {
  const unitsPerPx = viewBoxWidth / PHONE_MAP_WIDTH_PX;
  const centres = targets.map(({ id, bounds }) => ({
    id,
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    // The long side decides. Counting every shape with one narrow side as small
    // would make most municipalities "small", and splitting the gaps between all
    // of them leaves each disk no wider than the shape it serves.
    size: Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY),
  }));
  const small = (size: number) => size < MIN_TARGET_PX * unitsPerPx;
  return centres.flatMap((centre) => {
    if (!small(centre.size)) return [];
    // Two small targets split the gap between their centres, so their disks never
    // overlap and neither reaches the other's middle. A larger neighbour is at
    // least 24px across, so a 32px disk at its edge leaves most of it tappable.
    const limits = centres
      .filter((other) => other.id !== centre.id && small(other.size))
      .map((other) => Math.hypot(other.x - centre.x, other.y - centre.y) / 2);
    const r = Math.min((DISK_DIAMETER_PX / 2) * unitsPerPx, ...limits);
    // A disk no wider than the shape itself adds nothing.
    if (r <= centre.size / 2) return [];
    const round = (value: number) => Math.round(value * 10) / 10;
    return [{ id: centre.id, cx: round(centre.x), cy: round(centre.y), r: round(r) }];
  });
}
