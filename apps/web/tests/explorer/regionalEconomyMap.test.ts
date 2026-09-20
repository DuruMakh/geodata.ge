import { describe, expect, test } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { loadRegionalEconomyFacts } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { buildRegionalEconomyMapModel } from "../../lib/explorer/regionalEconomyMap";

async function input() {
  const [regional, municipal] = await Promise.all([
    loadRegionalEconomyFacts(),
    loadServedMunicipalData(),
  ]);
  return { facts: regional.map((fact) => ({ ...fact, value: Number(fact.value) })), regions: municipal.regions };
}

describe("regional economy map model", () => {
  test("builds exactly eleven region-level map paths without municipality pieces", async () => {
    const { facts, regions } = await input();
    const model = buildRegionalEconomyMapModel({ facts, regions });
    const candidate = model as unknown as {
      regions: Array<{ regionId: string; pathD?: string; bucket: number }>;
      shapes?: unknown[];
      markers?: unknown[];
    };

    expect(model.year).toBe(2024);
    expect(model.firstYear).toBe(2010);
    expect(model.regions).toHaveLength(11);
    expect(model.regions[0]).toMatchObject({
      regionId: "region.tbilisi",
      totalGdpGel: 49_374_720_708.90671,
      rank: 1,
    });
    expect(candidate.regions.every((region) => typeof region.pathD === "string" && region.pathD.length > 0)).toBe(true);
    expect(new Set(candidate.regions.map((region) => region.regionId))).toHaveLength(11);
    expect("shapes" in candidate).toBe(false);
    expect("markers" in candidate).toBe(false);
    expect(model.occupiedAreas).toHaveLength(2);
    expect(model.regions.every((region) => region.bucket >= 0 && region.bucket <= 5)).toBe(true);
  });

  test("assigns one unique path, GDP value, and bucket to every published region", async () => {
    const { facts, regions } = await input();
    const model = buildRegionalEconomyMapModel({ facts, regions });
    const mapRegions = model.regions as Array<(typeof model.regions)[number] & { pathD?: string }>;

    expect(new Set(mapRegions.map((region) => region.pathD))).toHaveLength(11);
    expect(mapRegions.every((region) => Number.isFinite(region.totalGdpGel) && region.totalGdpGel > 0)).toBe(true);
    expect(mapRegions.every((region) => region.bucket >= 0 && region.bucket <= 5)).toBe(true);
  });

  test("projects the regional boundaries across the visible map area", async () => {
    const { facts, regions } = await input();
    const model = buildRegionalEconomyMapModel({ facts, regions });
    const coordinates = model.regions.flatMap((region) =>
      [...region.pathD.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((match) => [Number(match[1]), Number(match[2])]),
    );
    const xs = coordinates.map(([x]) => x!);
    const ys = coordinates.map(([, y]) => y!);

    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(700);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(300);
  });

  test("fails when a latest regional total cannot be resolved", async () => {
    const { facts, regions } = await input();
    expect(() => buildRegionalEconomyMapModel({
      facts: facts.filter((fact) => fact.regionId !== "region.guria"),
      regions,
    })).toThrow(/regional GDP.*guria/i);
  });
});
