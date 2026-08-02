import { describe, expect, it } from "vitest";
import { loadMunicipalitiesFile } from "../../../lib/data/municipal/municipalitiesFile";
import { loadMunicipalRegionsFile } from "../../../lib/data/municipal/taxonomyFiles";

const MUNICIPALITIES = "../../data/imports/municipalities.csv";
const REGIONS = "../../data/taxonomy/municipal-regions.json";

describe("municipality registry", () => {
  it("holds all 69 municipalities with unique codes", async () => {
    const municipalities = await loadMunicipalitiesFile(MUNICIPALITIES);

    expect(municipalities).toHaveLength(69);
    expect(new Set(municipalities.map((row) => row.code)).size).toBe(69);
  });

  it("assigns every municipality to a known region", async () => {
    const [municipalities, regions] = await Promise.all([
      loadMunicipalitiesFile(MUNICIPALITIES),
      loadMunicipalRegionsFile(REGIONS),
    ]);
    const regionIds = new Set(regions.map((region) => region.id));

    for (const row of municipalities) {
      expect(regionIds.has(row.regionId), `${row.displayNameKa} has unknown region ${row.regionId}`).toBe(true);
    }
  });

  it("uses every region at least once", async () => {
    const [municipalities, regions] = await Promise.all([
      loadMunicipalitiesFile(MUNICIPALITIES),
      loadMunicipalRegionsFile(REGIONS),
    ]);
    const used = new Set(municipalities.map((row) => row.regionId));

    expect([...regions.map((region) => region.id)].filter((id) => !used.has(id))).toEqual([]);
  });

  it("marks exactly the five self-governing cities", async () => {
    const municipalities = await loadMunicipalitiesFile(MUNICIPALITIES);
    const cities = municipalities.filter((row) => row.isSelfGoverningCity).map((row) => row.displayNameKa);

    expect(cities.sort()).toEqual(["ბათუმი", "თბილისი", "ქუთაისი", "რუსთავი", "ფოთი"].sort());
  });

  it("gives every municipality a distinct short display name", async () => {
    const municipalities = await loadMunicipalitiesFile(MUNICIPALITIES);
    const names = municipalities.map((row) => row.displayNameKa);

    expect(new Set(names).size).toBe(69);
    for (const name of names) {
      expect(name).not.toContain("მუნიციპალიტეტი");
    }
  });
});
