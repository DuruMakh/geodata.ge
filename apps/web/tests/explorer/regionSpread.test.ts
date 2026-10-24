import { describe, expect, it } from "vitest";
import { regionSpread } from "../../lib/explorer/regionSpread";
import type { PlaceEntry } from "../../lib/explorer/places/types";

const PAGE = "/explorer/unemployment/regions";
const NAMES: Record<string, string> = {
  "country.georgia": "Georgia",
  "region.tbilisi": "Tbilisi",
  "region.adjara": "Adjara",
  "region.guria": "Guria",
  "region.imereti": "Imereti",
  "region.kakheti": "Kakheti",
  "region.mtskheta-mtianeti": "Mtskheta-Mtianeti",
  "region.racha-lechkhumi": "Racha-Lechkhumi",
  "region.samegrelo": "Samegrelo",
  "region.samtskhe-javakheti": "Samtskhe-Javakheti",
  "region.kvemo-kartli": "Kvemo Kartli",
  "region.shida-kartli": "Shida Kartli",
};
// The unemployment Regions page's latest figures, as the place index states them.
const RATES: [string, number][] = [
  ["region.tbilisi", 17.5], ["region.adjara", 16.1], ["region.guria", 14.9], ["region.imereti", 14.6], ["region.kakheti", 14.1],
  ["region.mtskheta-mtianeti", 13.8], ["region.racha-lechkhumi", 9.6], ["region.samegrelo", 9.4], ["region.samtskhe-javakheti", 8.7],
  ["region.kvemo-kartli", 8.5], ["region.shida-kartli", 7.0], ["country.georgia", 13.9],
];
const entry = (placeId: string, number: number, extra: Partial<PlaceEntry> = {}): PlaceEntry => ({
  placeId, page: PAGE, href: PAGE, value: `${number.toFixed(1)}%`, number, period: "2025", ...extra,
});
const name = (id: string) => NAMES[id] ?? id;

describe("regionSpread", () => {
  const spread = regionSpread(RATES.map(([id, n]) => entry(id, n)), name, "en")!;

  it("puts one point per region and marks Georgia apart", () => {
    expect(spread.points).toHaveLength(11);
    expect(spread.georgiaX).not.toBeNull();
    expect(spread.georgiaLabel).toBe("Georgia 13.9%");
  });

  it("marks and names the lowest and highest region", () => {
    expect(spread.points.filter((point) => point.key)).toHaveLength(2);
    expect(spread.low).toBe("Shida Kartli 7.0%");
    expect(spread.high).toBe("Tbilisi 17.5%");
    expect(spread.value).toBe("7.0–17.5%");
    expect(spread.caption).toBe("11 regions · 2025");
  });

  it("keeps every dot inside the scale, ordered by value, with padding around the extremes", () => {
    const xs = spread.points.map((point) => point.x);
    expect(Math.min(...xs)).toBeGreaterThan(0);
    expect(Math.max(...xs)).toBeLessThan(100);
    expect(spread.lowX).toBe(Math.min(...xs));
    // Georgia (13.9) sits between Mtskheta-Mtianeti (13.8) and Kakheti (14.1).
    const gx = spread.georgiaX!;
    expect(gx).toBeGreaterThan(spread.points[5].x);
    expect(gx).toBeLessThan(spread.points[4].x);
  });

  it("does not run a rate scale below zero", () => {
    const low = regionSpread([entry("region.a", 0.4), entry("region.b", 9)], name, "en")!;
    expect(low.points[0].x).toBeGreaterThan(0);
    expect(low.points[0].x).toBeLessThan(10);
  });

  it("shares the unit once in the range and falls back to both figures when units differ", () => {
    const wages = regionSpread([
      entry("region.a", 1138.5, { value: "1,138.5 ₾" }), entry("region.b", 2565, { value: "2,565.0 ₾" }),
    ], name, "ka")!;
    expect(wages.value).toBe("1,138.5–2,565.0 ₾");
    expect(wages.caption).toBe("2 რეგიონი · 2025");
    const mixed = regionSpread([
      entry("region.a", 900, { value: "900 m" }), entry("region.b", 1200000, { value: "1.2 bn" }),
    ], name, "en")!;
    expect(mixed.value).toBe("900 m – 1.2 bn");
  });

  it("ignores municipality entries and works without Georgia", () => {
    const withMunicipalities = regionSpread([
      entry("region.a", 5), entry("region.b", 9), entry("01", 100), entry("02", -50),
    ], name, "en")!;
    expect(withMunicipalities.points).toHaveLength(2);
    expect(withMunicipalities.georgiaX).toBeNull();
    expect(withMunicipalities.georgiaLabel).toBeNull();
    expect(withMunicipalities.high).toBe("region.b 9.0%");
  });

  it("returns null with fewer than two regions", () => {
    expect(regionSpread([], name, "en")).toBeNull();
    expect(regionSpread([entry("region.a", 5), entry("country.georgia", 6)], name, "en")).toBeNull();
  });

  it("centres the dots when every region has the same value", () => {
    const flat = regionSpread([entry("region.a", 5), entry("region.b", 5)], name, "en")!;
    expect(flat.points.map((point) => point.x)).toEqual([50, 50]);
  });
});
