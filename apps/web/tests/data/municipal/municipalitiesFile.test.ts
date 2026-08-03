import { describe, expect, it } from "vitest";
import { loadMunicipalitiesFile } from "../../../lib/data/municipal/municipalitiesFile";
import { loadMunicipalRegionsFile } from "../../../lib/data/municipal/taxonomyFiles";

const MUNICIPALITIES = "../../data/imports/municipalities.csv";
const REGIONS = "../../data/taxonomy/municipal-regions.json";
const EXCLUDED_CODES = ["05", "42", "43", "46", "64"];

describe("municipality registry", () => {
  it("holds 64 public municipalities with unique codes", async () => {
    const municipalities = await loadMunicipalitiesFile(MUNICIPALITIES);

    expect(municipalities).toHaveLength(64);
    expect(new Set(municipalities.map((row) => row.code)).size).toBe(64);
    expect(municipalities.filter((row) => EXCLUDED_CODES.includes(row.code))).toEqual([]);
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

    expect(new Set(names).size).toBe(64);
    for (const name of names) {
      expect(name).not.toContain("მუნიციპალიტეტი");
    }
  });
});
