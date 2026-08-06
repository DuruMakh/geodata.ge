// One-shot vendoring of Georgia's ADM1 region rings into lib/landing/georgiaGeo.ts.
//
// Source: geoBoundaries gbOpen GEO ADM1, release 9469f09.
// Licence: CC BY 3.0 (licenseSource commons.wikimedia.org). Redistribution is
// permitted with attribution — which is why this replaced GADM, whose terms
// forbid redistribution regardless of commercial intent.
//
// Run manually when the geometry needs refreshing; the output is committed.
//   npx tsx scripts/fetch-region-geometry.ts

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL =
  "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/GEO/ADM1/geoBoundaries-GEO-ADM1_simplified.geojson";

// 0.006° ≈ 1.25px of error at 1400px render width, and takes the 12 rings from
// 3,720 points to ~1,194 (~15 KB of inlined path data).
const TOLERANCE = 0.006;

type Point = [number, number];

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let index = 0;
  let maxDistance = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i]!, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [first, last];
  return simplify(points.slice(0, index + 1), tolerance)
    .slice(0, -1)
    .concat(simplify(points.slice(index), tolerance));
}

async function main(): Promise<void> {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`geoBoundaries fetch failed: ${response.status}`);
  const geojson = (await response.json()) as {
    features: Array<{
      properties: { shapeISO: string; shapeName: string };
      geometry: { type: string; coordinates: unknown };
    }>;
  };

  if (geojson.features.length !== 12) {
    throw new Error(`expected 12 ADM1 features, got ${geojson.features.length}`);
  }

  // Join on shapeISO, never shapeName: geoBoundaries spells Samtskhe–Javakheti
  // with an en dash (U+2013) and names GE-RL "Racha-Lechkhumi and Kvemo Svaneti",
  // neither of which matches the strings already in georgiaGeo.ts.
  const ringByIso = new Map<string, Point[]>();
  for (const feature of geojson.features) {
    if (feature.geometry.type !== "Polygon") {
      throw new Error(`${feature.properties.shapeISO}: expected Polygon, got ${feature.geometry.type}`);
    }
    const [outer] = feature.geometry.coordinates as Point[][];
    if (!outer) throw new Error(`${feature.properties.shapeISO}: no outer ring`);
    const simplified = simplify(outer, TOLERANCE).map(
      ([lon, lat]) => [Number(lon.toFixed(3)), Number(lat.toFixed(3))] as Point,
    );
    ringByIso.set(feature.properties.shapeISO, simplified);
  }

  const total = Array.from(ringByIso.values()).reduce((sum, ring) => sum + ring.length, 0);
  console.log(`12 rings, ${total} points after simplification at ${TOLERANCE}°`);
  for (const [iso, ring] of ringByIso) console.log(`  ${iso}  ${ring.length}`);

  const target = path.resolve(process.cwd(), "lib/landing/georgiaGeo.ts");
  const current = await readFile(target, "utf8");
  console.log(`\nRings ready. Paste into ${target} (current size ${current.length} bytes).`);
  await writeFile(
    path.resolve(process.cwd(), "region-rings.generated.json"),
    JSON.stringify(Object.fromEntries(ringByIso), null, 0),
    "utf8",
  );
  console.log("Wrote region-rings.generated.json — delete it after pasting.");
}

void main();
