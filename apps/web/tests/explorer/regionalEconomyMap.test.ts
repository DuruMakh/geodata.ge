import { describe, expect, test } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { loadRegionalEconomyFacts } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { buildRegionalEconomyMapModel } from "../../lib/explorer/regionalEconomyMap";

async function input() {
  const [regional, municipal] = await Promise.all([
    loadRegionalEconomyFacts(),
    loadServedMunicipalData(),
  ]);
  return { facts: regional.map((fact) => ({ ...fact, value: Number(fact.value) })), ...municipal };
}

describe("regional economy map model", () => {
  test("groups all verified municipality geometry into exactly eleven regions", async () => {
    const { facts, regions, municipalities } = await input();
    const model = buildRegionalEconomyMapModel({ facts, regions, municipalities });

    expect(model.year).toBe(2024);
    expect(model.firstYear).toBe(2010);
    expect(model.regions).toHaveLength(11);
    expect(model.regions[0]).toMatchObject({
      regionId: "region.tbilisi",
      totalGdpGel: 49_374_720_708.90671,
      rank: 1,
    });
    expect(model.shapes).toHaveLength(60);
    expect(model.markers).toHaveLength(5);
    expect(model.occupiedAreas).toHaveLength(2);
    expect(new Set([...model.shapes.map((shape) => shape.code), ...model.markers.map((marker) => marker.code)]).size).toBe(64);
    expect(model.regions.every((region) => region.bucket >= 0 && region.bucket <= 5)).toBe(true);
  });

  test("assigns every shape and marker the same GDP value and bucket as its region", async () => {
    const { facts, regions, municipalities } = await input();
    const model = buildRegionalEconomyMapModel({ facts, regions, municipalities });
    const byRegion = new Map(model.regions.map((region) => [region.regionId, region]));
    for (const piece of [...model.shapes, ...model.markers]) {
      expect(piece.totalGdpGel).toBe(byRegion.get(piece.regionId)?.totalGdpGel);
      expect(piece.bucket).toBe(byRegion.get(piece.regionId)?.bucket);
    }
  });

  test("fails when a municipality or latest regional total cannot be resolved", async () => {
    const { facts, regions, municipalities } = await input();
    expect(() => buildRegionalEconomyMapModel({ facts, regions, municipalities: municipalities.slice(1) }))
      .toThrow(/map geometry.*04|municipality.*04/i);
    expect(() => buildRegionalEconomyMapModel({
      facts: facts.filter((fact) => fact.regionId !== "region.guria"),
      regions,
      municipalities,
    })).toThrow(/regional GDP.*guria/i);
  });
});
