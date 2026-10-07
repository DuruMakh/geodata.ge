import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { INK } from "../../lib/explorer/colors";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  buildDemographyPlaces,
  municipalityCodeForPlaceId,
  partsOf,
  placeColor,
  placeIdForMunicipalityCode,
  type DemographyPlace,
} from "../../lib/explorer/demographyAreas";
import {
  buildPopulationHighlights,
  buildPopulationModel,
  populationBasisKey,
  rankPlaces,
  sparkValues,
  type PopulationQuery,
} from "../../lib/explorer/demographyPopulation";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { ClientDemographyObservation } from "../../lib/servedRows";

let facts: ClientDemographyObservation[];
let places: DemographyPlace[];

const query = (patch: Partial<PopulationQuery> = {}): PopulationQuery => ({ selectedIds: [GEORGIA_PLACE_ID], range: { kind: "all" }, ...patch });
const model = (patch: Partial<PopulationQuery> = {}, locale: "ka" | "en" = "en") =>
  buildPopulationModel({ facts, places, query: query(patch), locale });
const highlights = (placeId: string, patch: Partial<PopulationQuery> = {}) =>
  buildPopulationHighlights(model({ selectedIds: [placeId], ...patch }), facts, places, placeId);
const population = (id: string, year: number) =>
  facts.find((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === id && fact.year === year)?.value ?? null;
const place = (id: string) => places.find((candidate) => candidate.id === id)!;

beforeAll(async () => {
  const [{ facts: served }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.map(projectDemographyObservation);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  const presentation = await getPresentation("en", [], ids);
  places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: "საქართველო",
  });
});

describe("places", () => {
  test("Georgia, 11 regions and 63 municipalities; Tbilisi is only a region", () => {
    expect(places).toHaveLength(75);
    expect(places.filter((p) => p.level === "country")).toHaveLength(1);
    expect(places.filter((p) => p.level === "region")).toHaveLength(11);
    expect(places.filter((p) => p.level === "municipality")).toHaveLength(63);
    expect(places.some((p) => p.id === "04")).toBe(false);
    expect(place(TBILISI_PLACE_ID).municipalityCount).toBe(1);
    expect(place(GEORGIA_PLACE_ID).municipalityCount).toBe(64);
    expect(place("11")).toMatchObject({ nameEn: "Khulo", regionId: "region.adjara" });
  });

  test("the parts a place is ticked with", () => {
    const ids = (id: string) => partsOf(place(id), places).map((part) => part.id).sort();
    expect(ids(GEORGIA_PLACE_ID)).toHaveLength(11);
    expect(ids(GEORGIA_PLACE_ID).every((id) => id.startsWith("region."))).toBe(true);
    expect(ids("region.adjara")).toEqual(["06", "07", "08", "09", "10", "11"]);
    expect(ids("region.racha_lechkhumi_kvemo_svaneti")).toEqual(["69", "70", "71", "72"]);
    expect(ids(TBILISI_PLACE_ID)).toEqual([]);
    expect(ids("11")).toEqual([]);
  });

  test("Tbilisi and municipality 04 are one place with one colour; Georgia is ink", () => {
    expect(placeIdForMunicipalityCode("04")).toBe(TBILISI_PLACE_ID);
    expect(municipalityCodeForPlaceId(TBILISI_PLACE_ID)).toBe("04");
    expect(placeIdForMunicipalityCode("11")).toBe("11");
    expect(placeColor(place(GEORGIA_PLACE_ID))).toBe(INK);
    expect(places.map(placeColor).every((colour) => /^#[0-9A-F]{6}$/i.test(colour))).toBe(true);
  });

  test("the 11 regions have pairwise distinct colours and none is the ink that Georgia wears", () => {
    const regionColours = places.filter((p) => p.level === "region").map((p) => placeColor(p).toUpperCase());
    expect(new Set(regionColours).size).toBe(11);
    expect(regionColours).not.toContain(INK.toUpperCase());
  });
});

describe("population model", () => {
  test("the default is Georgia over every loaded year", () => {
    const result = model();
    expect(result.years[0]).toBe(2004);
    expect(result.years.at(-1)).toBe(2026);
    expect(result.years).toHaveLength(23);
    expect(result.series.map((line) => line.id)).toEqual([GEORGIA_PLACE_ID]);
    expect(result.series[0]!.vals.at(-1)).toBe(3_941_103);
    expect(result.rows[0]).toMatchObject({ itemId: GEORGIA_PLACE_ID, kaLabel: "Georgia" });
    expect(result.rows[0]!.valuesByYear[2024]).toBe(3_694_608);
    expect(result.hasData).toBe(true);
  });

  test("Georgia first, then selected places by their end-year value", () => {
    const result = model({ selectedIds: ["region.imereti", "11", TBILISI_PLACE_ID, GEORGIA_PLACE_ID, "06"] });
    expect(result.selected.map((p) => p.id)).toEqual([GEORGIA_PLACE_ID, TBILISI_PLACE_ID, "region.imereti", "06", "11"]);
  });

  test("a place has no value before its first year and the line does not bridge or zero-fill it", () => {
    const result = model({ selectedIds: ["region.imereti"] });
    expect(result.series[0]!.vals[0]).toBeNull();
    expect(result.series[0]!.vals[result.years.indexOf(2014)]).toBeNull();
    expect(result.series[0]!.vals[result.years.indexOf(2015)]).toBe(population("region.imereti", 2015));
    expect(result.rows[0]!.valuesByYear[2010]).toBeNull();
  });

  test("labels follow the language", () => {
    expect(model({ selectedIds: ["11"] }, "ka").series[0]!.label).toBe(place("11").nameKa);
    expect(model({ selectedIds: ["11"] }, "en").series[0]!.label).toBe("Khulo");
  });

  test("a manual range is used and one outside the data shows everything", () => {
    expect(model({ range: { kind: "manual", start: 2015, end: 2024 } }).years).toHaveLength(10);
    expect(model({ range: { kind: "manual", start: 2000, end: 2030 } }).years).toHaveLength(23);
    expect(model({ range: { kind: "manual", start: 1990, end: 1995 } }).years).toHaveLength(23);
  });

  test("an empty selection has no data and no highlights for an unknown place", () => {
    const result = model({ selectedIds: [] });
    expect(result.selected).toEqual([]);
    expect(result.hasData).toBe(false);
    expect(buildPopulationHighlights(result, facts, places, "nonsense")).toBeNull();
  });

  test("a selection with no value in the range has no data", () => {
    expect(model({ selectedIds: ["region.imereti"], range: { kind: "manual", start: 2004, end: 2010 } }).hasData).toBe(false);
  });

  test("the lineage of a year in plain words", () => {
    expect([2004, 2014, 2015, 2024, 2025, 2026].map(populationBasisKey)).toEqual([
      "demography.basisRetro",
      "demography.basisRetro",
      "demography.basisPre",
      "demography.basisPre",
      "demography.basisCensus",
      "demography.basisCensus",
    ]);
  });
});

describe("ranking", () => {
  const fake = (id: string, sortOrder: number): DemographyPlace => ({
    id, level: "region", nameKa: id, nameEn: id, regionId: null, sortOrder, municipalityCount: 0,
  });

  test("ties break by registry order, missing values go last and Georgia stays first", () => {
    const list = [fake("b", 2), fake("a", 1), fake("c", 3), place(GEORGIA_PLACE_ID)];
    expect(rankPlaces(list, { a: 5, b: 5, c: null, [GEORGIA_PLACE_ID]: 1 }).map((p) => p.id)).toEqual([GEORGIA_PLACE_ID, "a", "b", "c"]);
  });
});

describe("highlights", () => {
  const smallest = (year: number) => {
    const entries = places
      .filter((p) => p.level === "municipality" || p.id === TBILISI_PLACE_ID)
      .map((p) => ({ place: p, value: population(p.id, year)! }))
      .sort((left, right) => left.value - right.value || left.place.sortOrder - right.place.sortOrder);
    return entries[0]!;
  };

  test("Georgia in 2026: the largest region, the densest region and the smallest municipality", () => {
    const result = highlights(GEORGIA_PLACE_ID);
    expect(result).toMatchObject({ kind: "country", year: 2026, persons: 3_941_103 });
    if (result?.kind !== "country") throw new Error("expected the country highlights");
    expect(result.largestRegion).toMatchObject({ value: 1_369_356 });
    expect(result.largestRegion?.place.id).toBe(TBILISI_PLACE_ID);
    expect(result.densestRegion?.place.id).toBe(TBILISI_PLACE_ID);
    expect(result.smallestMunicipality?.place.id).toBe(smallest(2026).place.id);
    expect(result.smallestMunicipality?.value).toBe(5_056);
    expect(result.regionalFrom).toBe(2015);
  });

  test("Tbilisi in 2026 is a region with 34.7% of Georgia", () => {
    const result = highlights(TBILISI_PLACE_ID);
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    expect(result.persons).toBe(1_369_356);
    expect((result.shareOfGeorgia! * 100).toFixed(1)).toBe("34.7");
    expect(result.rank).toBe(1);
    expect(result.ofRegions).toBe(11);
    expect(result.municipalityCount).toBe(1);
    expect(result.density).toBe(2715.7);
    expect(result.densityRank).toBe(1);
  });

  test("Adjara in 2026 is fourth of 11 with six municipalities", () => {
    const result = highlights("region.adjara");
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    expect(result.persons).toBe(413_214);
    expect(result.rank).toBe(4);
    expect(result.municipalityCount).toBe(6);
    expect(result.density).toBe(142.5);
  });

  test("a region at the end of a 2025 range", () => {
    const result = highlights("region.imereti", { range: { kind: "manual", start: 2015, end: 2025 } });
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    const regionIds = places.filter((p) => p.level === "region").map((p) => p.id);
    const expectedRank = [...regionIds].sort((left, right) => population(right, 2025)! - population(left, 2025)!).indexOf("region.imereti") + 1;
    expect(result.year).toBe(2025);
    expect(result.persons).toBe(population("region.imereti", 2025));
    expect(result.rank).toBe(expectedRank);
    expect(result.municipalityCount).toBe(places.filter((p) => p.regionId === "region.imereti").length);
  });

  test("Batumi in 2026 is second of 64 and Khulo at the end of 2024 is before the re-base", () => {
    const batumi = highlights("06");
    if (batumi?.kind !== "municipality") throw new Error("expected the municipality highlights");
    expect(batumi.persons).toBe(246_267);
    expect(batumi.rank).toBe(2);
    expect(batumi.ofMunicipalities).toBe(64);

    const result = highlights("11", { range: { kind: "manual", start: 2015, end: 2024 } });
    if (result?.kind !== "municipality") throw new Error("expected the municipality highlights");
    expect(result.persons).toBe(28_250);
    expect(result.shareOfRegion).toBeCloseTo(28_250 / population("region.adjara", 2024)!, 10);
    expect(result.regionPersons).toBe(population("region.adjara", 2024));
    expect(result.shareOfGeorgia).toBeCloseTo(28_250 / 3_694_608, 10);
    expect(result.region?.id).toBe("region.adjara");
  });

  test("a range that ends before 2015 has Georgia but no regional figure", () => {
    const range = { kind: "manual" as const, start: 2004, end: 2010 };
    const country = highlights(GEORGIA_PLACE_ID, { range });
    if (country?.kind !== "country") throw new Error("expected the country highlights");
    expect(country.persons).toBe(population(GEORGIA_PLACE_ID, 2010));
    expect(country.largestRegion).toBeNull();
    expect(country.smallestMunicipality).toBeNull();
    const region = highlights("region.imereti", { range });
    if (region?.kind !== "region") throw new Error("expected the region highlights");
    expect(region.persons).toBeNull();
    expect(region.rank).toBeNull();
    expect(region.regionalFrom).toBe(2015);
  });

  test("the highlights describe the place asked for, whatever else is ticked", () => {
    const wide = model({ selectedIds: [GEORGIA_PLACE_ID, "region.imereti", "11"] });
    expect(buildPopulationHighlights(wide, facts, places, "region.imereti")?.place.id).toBe("region.imereti");
    expect(buildPopulationHighlights(wide, facts, places, "11")?.place.id).toBe("11");
  });

  test("a trend is two segments across the re-base and one without it", () => {
    const across = highlights(GEORGIA_PLACE_ID, { range: { kind: "manual", start: 2015, end: 2026 } })!;
    expect(across.trend).toHaveLength(13);
    expect(across.trend[9]).toBe(3_694_608);
    expect(across.trend[10]).toBeNull();
    expect(across.trend[11]).toBe(3_930_428);
    const after = highlights(GEORGIA_PLACE_ID, { range: { kind: "manual", start: 2025, end: 2026 } })!;
    expect(after.trend).toEqual([3_930_428, 3_941_103]);
    expect(sparkValues([2023, 2024], (year) => year)).toEqual([2023, 2024]);
  });
});

describe("order independence", () => {
  // A CSV build serves the facts in file order; a database build (production) serves them in Postgres's
  // text-collation order. Nothing the model or the highlights return may depend on which one it is.
  test("the model and the highlights are the same for facts in reverse order", () => {
    const reversed = [...facts].reverse();
    expect(reversed[0]).toBe(facts.at(-1));
    const cases: Array<[string, string, Partial<PopulationQuery>]> = [
      ["the default query", GEORGIA_PLACE_ID, {}],
      ["Georgia, Imereti and Khulo", "region.imereti", { selectedIds: [GEORGIA_PLACE_ID, "region.imereti", "11"] }],
      ["Imereti and Khulo to 2025", "11", { selectedIds: ["region.imereti", "11"], range: { kind: "manual", start: 2015, end: 2025 } }],
      ["Tbilisi alone", TBILISI_PLACE_ID, { selectedIds: [TBILISI_PLACE_ID] }],
    ];
    for (const [name, placeId, patch] of cases) {
      const forward = buildPopulationModel({ facts, places, query: query(patch), locale: "en" });
      const backward = buildPopulationModel({ facts: reversed, places, query: query(patch), locale: "en" });
      // `valueAt` is a closure over each build's own cells, so two builds never compare equal as functions:
      // compare what it answers for every place and year instead.
      const { valueAt: forwardAt, ...forwardRest } = forward;
      const { valueAt: backwardAt, ...backwardRest } = backward;
      expect(backwardRest, `model: ${name}`).toEqual(forwardRest);
      const cells = (at: typeof forwardAt) => places.map((p) => forward.availableYears.map((year) => at(p.id, year)));
      expect(cells(backwardAt), `valueAt: ${name}`).toEqual(cells(forwardAt));
      expect(buildPopulationHighlights(backward, reversed, places, placeId), `highlights: ${name}`).toEqual(
        buildPopulationHighlights(forward, facts, places, placeId),
      );
    }
  });
});
