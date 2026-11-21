import { beforeAll, describe, expect, it } from "vitest";
import { loadServedEducationData, shownEducationFacts, toClientEducationFact } from "../../lib/data/education/importEducation";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildEducationIndexModel, type EducationIndexModel } from "../../lib/explorer/educationIndex";

let schools: EducationIndexModel;
let kindergartens: EducationIndexModel;
beforeAll(async () => {
  const [{ facts }, municipal] = await Promise.all([loadServedEducationData(), loadServedMunicipalData()]);
  const shown = shownEducationFacts(facts).map(toClientEducationFact);
  schools = buildEducationIndexModel("schools", shown, municipal.regions, municipal.municipalities);
  kindergartens = buildEducationIndexModel("kindergartens", shown, municipal.regions, municipal.municipalities);
});

describe("education index history", () => {
  it("carries Khulo's and Shuakhevi's pupils in every school year", () => {
    const [pupils] = schools.history.figures;
    expect(schools.history.figures.map((figure) => figure.id)).toEqual(["pupils"]);
    expect(pupils!.valueAt("11", 2015)).toBe(3936);
    expect(pupils!.valueAt("11", 2025)).toBe(2075);
    expect(pupils!.valueAt("10", 2015)).toBe(2410);
    expect(pupils!.valueAt("10", 2025)).toBe(1137);
  });

  it("reads Tbilisi through its region and Georgia from the national table", () => {
    const [pupils] = schools.history.figures;
    expect(pupils!.valueAt("04", 2025)).toBe(232134);
    expect(pupils!.valueAt("country.georgia", 2025)).toBe(schools.country.valueGel);
    expect(schools.history.years[0]).toBe(2000);
    expect(pupils!.valueAt("11", 2000)).toBeNull();
  });

  it("matches the list in the map's year", () => {
    const [pupils] = schools.history.figures;
    for (const row of schools.municipalities) expect(pupils!.valueAt(row.id, schools.year)).toBe(row.valueGel);
    expect(kindergartens.history.figures.map((figure) => figure.id)).toEqual(["children"]);
  });
});
