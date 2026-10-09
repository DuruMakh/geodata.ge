import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { buildPopulationHighlights, buildPopulationModel } from "../../lib/explorer/demographyPopulation";
import { buildPopulationKpis, populationIndexKpis } from "../../lib/explorer/demographyPopulationKpis";
import { MISSING, formatShare } from "../../lib/explorer/format";
import type { PeriodRange } from "../../lib/explorer/periodRange";
import demographyEn from "../../lib/i18n/messages/en/demography.json";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Locale, Presentation } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";

let facts: ClientDemographyObservation[];
let places: DemographyPlace[];
const presentations = {} as Record<Locale, Presentation>;

beforeAll(async () => {
  const [{ facts: served }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.map(projectDemographyObservation);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  for (const locale of ["en", "ka"] as const) presentations[locale] = await getPresentation(locale, ["demography"], ids);
  places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentations.en.englishLabels,
    georgiaNameKa: "საქართველო",
  });
});

const kpis = (placeId: string, locale: Locale = "en", range: PeriodRange = { kind: "all" }) => {
  const model = buildPopulationModel({ facts, places, query: { selectedIds: [placeId], range }, locale });
  return buildPopulationKpis(buildPopulationHighlights(model, facts, places, placeId)!, presentations[locale].messages, locale);
};

describe("population key indicators", () => {
  test("Georgia: the hero and the three side figures", () => {
    const result = kpis(GEORGIA_PLACE_ID);
    expect(result).toMatchObject({ heroLabel: "Population · Georgia", heroValue: "3,941,103", heroBasis: "1 January 2026 · based on the 2024 census" });
    expect(result.side.map((kpi) => [kpi.label, kpi.value, kpi.unit, kpi.detail])).toEqual([
      ["Largest region", "1,369,356", "", `Tbilisi · ${formatShare(1_369_356 / 3_941_103)}`],
      ["Densest region", "2,715.7", "/km²", "Tbilisi"],
      ["Smallest municipality", "5,056", "", "Lentekhi"],
    ]);
  });

  test("the four index tiles carry the density unit in the detail line", () => {
    const tiles = populationIndexKpis(kpis(GEORGIA_PLACE_ID), "persons per km²");
    expect(tiles).toEqual([
      { label: "Population · Georgia", value: "3,941,103", detail: "1 January 2026 · based on the 2024 census" },
      { label: "Largest region", value: "1,369,356", detail: `Tbilisi · ${formatShare(1_369_356 / 3_941_103)}` },
      { label: "Densest region", value: "2,715.7", detail: "Tbilisi · persons per km²" },
      { label: "Smallest municipality", value: "5,056", detail: "Lentekhi" },
    ]);
  });

  test("a region: share of Georgia, rank, density and municipality count", () => {
    const result = kpis("region.adjara");
    expect(result.heroValue).toBe("413,214");
    expect(result.shareLine).toContain(formatShare(413_214 / 3_941_103));
    expect(result.side.map((kpi) => [kpi.label, kpi.value, kpi.unit])).toEqual([
      ["Rank among regions", "4", "/ 11"],
      ["Density", "142.5", "/km²"],
      ["Municipalities", "6", ""],
    ]);
  });

  test("a municipality: share of its region, rank among 64, share of Georgia and its region", () => {
    const result = kpis("06");
    expect(result.heroValue).toBe("246,267");
    expect(result.shareLine).toContain(formatShare(246_267 / 413_214));
    expect(result.side.map((kpi) => [kpi.label, kpi.value, kpi.unit])).toEqual([
      ["Rank among municipalities", "2", "/ 64"],
      ["Share of Georgia", formatShare(246_267 / 3_941_103), ""],
      ["Region", "413,214", ""],
    ]);
    expect(result.side[2]!.detail).toBe("Adjara");
  });

  test("a range that ends before regional data starts: the dash and the note instead of a figure, for a region and a municipality", () => {
    const note = (demographyEn as Record<string, string>)["demography.regionalFrom"]!.replace("{year}", "2015");
    expect(note).toContain("2015");
    for (const placeId of ["region.adjara", "06"]) {
      const result = kpis(placeId, "en", { kind: "manual", start: 2004, end: 2010 });
      expect(result.heroValue, placeId).toBe(MISSING);
      expect(result.unavailable, placeId).toBe(note);
      expect(result.side[0]!.value, placeId).toBe(MISSING);
      expect(result.side[0]!.detail, placeId).toBe(note);
    }
  });

  test("Georgian wording", () => {
    expect(kpis(GEORGIA_PLACE_ID, "ka").heroLabel).toBe("მოსახლეობა · საქართველო");
  });
});
