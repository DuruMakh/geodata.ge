import { beforeAll, describe, expect, it } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { REGIONAL_ECONOMY_REGIONS } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { GEORGIA_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { latestYearOf, placeInKa, placeOfKa, placeTitleNameEn, type TitlePlace } from "../../lib/seo/placeTitleForms";

let places: DemographyPlace[];
let municipalRows: { code: string; displayNameKa: string; nameKa: string; isSelfGoverningCity: boolean }[];
const place = (id: string) => places.find((candidate) => candidate.id === id)!;

beforeAll(async () => {
  const municipal = await loadServedMunicipalData();
  municipalRows = municipal.municipalities;
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  const presentation = await getPresentation("en", [], ids);
  places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: "საქართველო",
  });
});

describe("Georgian and English place forms for titles", () => {
  it("gives a municipality the genitive and -ში forms of its official name", () => {
    const khashuri = place("47");
    expect(placeOfKa(khashuri)).toBe("ხაშურის მუნიციპალიტეტის");
    expect(placeInKa(khashuri)).toBe("ხაშურის მუნიციპალიტეტში");
    expect(placeTitleNameEn(khashuri)).toBe("Khashuri Municipality");
  });

  it("gives a self-governing city the short city forms", () => {
    const batumi = place("06");
    expect(placeOfKa(batumi)).toBe("ბათუმის");
    expect(placeInKa(batumi)).toBe("ბათუმში");
    expect(placeTitleNameEn(batumi)).toBe("Batumi");
  });

  it("reads Tbilisi as the region", () => {
    const tbilisi = place("region.tbilisi");
    expect(placeOfKa(tbilisi)).toBe("თბილისის");
    expect(placeInKa(tbilisi)).toBe("თბილისში");
  });

  it("gives a compound region both of its forms", () => {
    const racha = place("region.racha_lechkhumi_kvemo_svaneti");
    expect(placeOfKa(racha)).toBe("რაჭა-ლეჩხუმისა და ქვემო სვანეთის");
    expect(placeInKa(racha)).toBe("რაჭა-ლეჩხუმსა და ქვემო სვანეთში");
  });

  it("gives Georgia fixed text", () => {
    const georgia = place(GEORGIA_PLACE_ID);
    expect(placeOfKa(georgia)).toBe("საქართველოს");
    expect(placeInKa(georgia)).toBe("საქართველოში");
    expect(placeTitleNameEn(georgia)).toBe("Georgia");
  });

  it("has both forms for every regional-economy region", () => {
    for (const region of REGIONAL_ECONOMY_REGIONS) {
      const regionPlace = place(region.id);
      expect(placeOfKa(regionPlace), region.id).toMatch(/ს$/);
      expect(placeInKa(regionPlace), region.id).toMatch(/ში$/);
      expect(placeTitleNameEn(regionPlace), region.id).not.toBe("");
    }
  });

  it("gives every municipality the forms its official name or city name dictates", () => {
    expect(municipalRows).toHaveLength(64);
    for (const row of municipalRows) {
      const title: TitlePlace = {
        id: row.code,
        level: "municipality",
        nameKa: row.displayNameKa,
        nameEn: row.displayNameKa,
        officialNameKa: row.nameKa,
        selfGoverningCity: row.isSelfGoverningCity,
      };
      if (row.isSelfGoverningCity) {
        expect(row.displayNameKa, row.code).toMatch(/ი$/);
        expect(placeOfKa(title), row.code).toBe(`${row.displayNameKa.slice(0, -1)}ის`);
        expect(placeInKa(title), row.code).toBe(`${row.displayNameKa.slice(0, -1)}ში`);
      } else {
        expect(placeOfKa(title), row.code).toBe(`${row.nameKa}ს`);
        expect(placeInKa(title), row.code).toMatch(/მუნიციპალიტეტში$/);
      }
    }
  });

  it("throws for a region id with no stored form", () => {
    const unknown: TitlePlace = { id: "region.nowhere", level: "region", nameKa: "არსად", nameEn: "Nowhere" };
    expect(() => placeOfKa(unknown)).toThrow(/region\.nowhere/);
    expect(() => placeInKa(unknown)).toThrow(/region\.nowhere/);
  });

  it("rejects an official name that does not end in მუნიციპალიტეტი", () => {
    const bad: TitlePlace = { id: "47", level: "municipality", nameKa: "ხაშური", nameEn: "Khashuri", officialNameKa: "ხაშური" };
    expect(() => placeOfKa(bad)).toThrow(/მუნიციპალიტეტი/);
    expect(() => placeInKa(bad)).toThrow(/მუნიციპალიტეტი/);
  });
});

describe("latestYearOf", () => {
  it("returns the latest year among the kept facts", () => {
    expect(latestYearOf([{ year: 2023, a: "x" }, { year: 2025, a: "y" }], (fact) => fact.a === "x")).toBe(2023);
  });

  it("throws when nothing is kept", () => {
    expect(() => latestYearOf([{ year: 2023 }], () => false)).toThrow();
  });
});
