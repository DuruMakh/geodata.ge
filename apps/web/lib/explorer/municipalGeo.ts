import { GEORGIA_GEO } from "../landing/georgiaGeo";

// Region choropleth geometry for /explorer/municipalities.
//
// The map is REGION grain, not municipality grain: no openly-licensed ADM2
// geometry matches the 64-unit served registry (the 2026-08-02 serving-layer
// spec §4.3 records why), so a municipality-level map is a later spec. The rule
// that survives at this grain is the same one: every shape resolves to a region
// or to an explicit no-data reason, and every region resolves to exactly one
// shape. tests/explorer/municipalGeo.test.ts asserts both directions.

export type RegionShape = {
  shapeIso: string;
  regionId: string | null;
  noDataReason: "occupied_territory" | null;
  nameKa: string;
  d: string;
};

/**
 * Keyed on geoBoundaries `shapeISO`, never `shapeName`: geoBoundaries spells
 * Samtskhe–Javakheti with an en dash (U+2013) and names GE-RL "Racha-Lechkhumi
 * and Kvemo Svaneti", neither of which matches georgiaGeo.ts. A name join would
 * fail silently on exactly those two.
 *
 * `null` means the shape is drawn with no data. GE-AB (აფხაზეთი) is the only
 * one: its sole municipal body is excluded from public serving, so the region
 * is not part of the municipal taxonomy at all.
 */
export const REGION_ID_BY_SHAPE_ISO: Record<string, string | null> = {
  "GE-TB": "region.tbilisi",
  "GE-AJ": "region.adjara",
  "GE-GU": "region.guria",
  "GE-IM": "region.imereti",
  "GE-KA": "region.kakheti",
  "GE-MM": "region.mtskheta_mtianeti",
  "GE-RL": "region.racha_lechkhumi_kvemo_svaneti",
  "GE-SZ": "region.samegrelo_zemo_svaneti",
  "GE-SJ": "region.samtskhe_javakheti",
  "GE-KK": "region.kvemo_kartli",
  "GE-SK": "region.shida_kartli",
  "GE-AB": null,
};

const BBOX = GEORGIA_GEO.bbox;

// Equirectangular with a cos(midLat) correction so Georgia is not stretched
// east-west. The derived height at 1000px wide is 509, which is the viewBox the
// confirmed design reference uses.
const MID_LAT_RAD = (((BBOX.latMin + BBOX.latMax) / 2) * Math.PI) / 180;
const KX = Math.cos(MID_LAT_RAD);

export const MAP_WIDTH = 1000;
const SCALE = MAP_WIDTH / ((BBOX.lonMax - BBOX.lonMin) * KX);
export const MAP_HEIGHT = Math.round((BBOX.latMax - BBOX.latMin) * SCALE);
export const MAP_VIEWBOX = `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Project one [lon, lat] into viewBox space. Everything placed on the map goes
 * through this — shapes AND the self-governing city dots. Do not reimplement the
 * arithmetic at a call site: a second copy drifts the moment the projection
 * changes, and nothing fails when it does.
 */
export function projectPoint(lon: number, lat: number): { x: number; y: number } {
  return {
    x: Number(clamp((lon - BBOX.lonMin) * KX * SCALE, 0, MAP_WIDTH).toFixed(1)),
    y: Number(clamp((BBOX.latMax - lat) * SCALE, 0, MAP_HEIGHT).toFixed(1)),
  };
}

/** Project a [lon, lat] ring into an SVG path. Rounded to 1dp — sub-pixel. */
export function projectRing(ring: ReadonlyArray<readonly [number, number]>): string {
  const points = ring.map(([lon, lat]) => {
    const { x, y } = projectPoint(lon, lat);
    return `${x} ${y}`;
  });
  return `M${points.join("L")}Z`;
}

/**
 * Every ADM1 shape, projected and joined. Call this on the server: it returns
 * path strings, so the index page ships ~15 KB of `d` attributes instead of the
 * ~40 KB coordinate table.
 */
export function buildRegionShapes(): RegionShape[] {
  return GEORGIA_GEO.regions.map((region) => {
    const regionId = REGION_ID_BY_SHAPE_ISO[region.iso];
    if (regionId === undefined) {
      throw new Error(`unmapped ADM1 shape ${region.iso} (${region.en}) — every shape must resolve`);
    }

    return {
      shapeIso: region.iso,
      regionId,
      noDataReason: regionId === null ? ("occupied_territory" as const) : null,
      nameKa: region.ka,
      d: projectRing(region.ring),
    };
  });
}
