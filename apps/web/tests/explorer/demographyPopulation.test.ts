import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  buildDemographyPlaces,
  municipalityCodeForPlaceId,
  placeColor,
  placeIdForMunicipalityCode,
  placesAtLevel,
  type DemographyPlace,
} from "../../lib/explorer/demographyAreas";
import {
  DEFAULT_POPULATION_STATE,
  buildPopulationHighlights,
  buildPopulationModel,
  changeLevel,
  changeMeasure,
  chooseGeorgia,
  chooseOnMap,
  parsePopulationHash,
  populationBasisKey,
  rankPlaces,
  serializePopulationHash,
  setTabSelection,
  sparkValues,
  toggleSelected,
  type PopulationState,
} from "../../lib/explorer/demographyPopulation";
import { INK } from "../../lib/explorer/colors";
import type { ClientDemographyObservation } from "../../lib/servedRows";
import { getPresentation } from "../../lib/i18n/presentation.server";

let facts: ClientDemographyObservation[];
let places: DemographyPlace[];
let validIds: string[];

const state = (patch: Partial<PopulationState> = {}): PopulationState => ({ ...DEFAULT_POPULATION_STATE, ...patch });
const model = (patch: Partial<PopulationState> = {}, locale: "ka" | "en" = "en") =>
  buildPopulationModel({ facts, places, state: state(patch), locale });
const population = (id: string, year: number) =>
  facts.find((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === id && fact.year === year)?.value ?? null;

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
  validIds = places.map((place) => place.id);
});

describe("places", () => {
  test("Georgia, 11 regions and 63 municipalities; Tbilisi is only a region", () => {
    expect(places).toHaveLength(75);
    expect(places.filter((place) => place.level === "country")).toHaveLength(1);
    expect(places.filter((place) => place.level === "region")).toHaveLength(11);
    expect(places.filter((place) => place.level === "municipality")).toHaveLength(63);
    expect(places.some((place) => place.id === "04")).toBe(false);
    expect(places.find((place) => place.id === TBILISI_PLACE_ID)?.municipalityCount).toBe(1);
    expect(places.find((place) => place.id === GEORGIA_PLACE_ID)?.municipalityCount).toBe(64);
    expect(places.find((place) => place.id === "11")).toMatchObject({ nameEn: "Khulo", regionId: "region.adjara" });
  });

  test("each level lists Georgia first and Tbilisi once; both lists hold the same Tbilisi", () => {
    const regions = placesAtLevel(places, "regions");
    const municipalities = placesAtLevel(places, "municipalities");
    expect(regions).toHaveLength(12);
    expect(municipalities).toHaveLength(65);
    expect(regions.filter((place) => place.id === TBILISI_PLACE_ID)).toHaveLength(1);
    expect(municipalities.filter((place) => place.id === TBILISI_PLACE_ID)).toHaveLength(1);
  });

  test("Tbilisi and municipality 04 are one place with one colour; Georgia is ink", () => {
    expect(placeIdForMunicipalityCode("04")).toBe(TBILISI_PLACE_ID);
    expect(municipalityCodeForPlaceId(TBILISI_PLACE_ID)).toBe("04");
    expect(placeIdForMunicipalityCode("11")).toBe("11");
    expect(placeColor(places.find((place) => place.id === GEORGIA_PLACE_ID)!)).toBe(INK);
    const colours = places.map(placeColor);
    expect(colours.every((colour) => /^#[0-9A-F]{6}$/i.test(colour))).toBe(true);
  });

  test("the 11 regions have pairwise distinct colours and none is the ink that Georgia wears", () => {
    const regionColours = places.filter((place) => place.level === "region").map((place) => placeColor(place).toUpperCase());
    expect(regionColours).toHaveLength(11);
    expect(new Set(regionColours).size).toBe(11);
    expect(regionColours).not.toContain(INK.toUpperCase());
  });
});

describe("hash state", () => {
  test("defaults to Georgia only, regions, population, line, full range", () => {
    expect(parsePopulationHash("", validIds)).toEqual(DEFAULT_POPULATION_STATE);
  });

  test("round-trips a full state", () => {
    const original = state({
      selectedIds: ["region.imereti", "11", GEORGIA_PLACE_ID],
      level: "municipalities",
      mode: "table",
      range: { kind: "manual", start: 2015, end: 2024 },
    });
    expect(parsePopulationHash(`#${serializePopulationHash(original)}`, validIds)).toEqual(original);
    expect(parsePopulationHash(`#${serializePopulationHash(state({ map: "density" }))}`, validIds)).toEqual(state({ map: "density" }));
  });

  test("rejects unknown ids, removes duplicates, reads 04 as Tbilisi and keeps an explicit empty selection", () => {
    expect(parsePopulationHash("#sel=region.guria,nonsense,region.guria,04", validIds).selectedIds).toEqual(["region.guria", TBILISI_PLACE_ID]);
    expect(parsePopulationHash("#sel=", validIds).selectedIds).toEqual([]);
    expect(parsePopulationHash("#sel=nonsense", validIds).selectedIds).toEqual([]);
  });

  test("unknown level, map and view fall back, and density needs the regions level", () => {
    expect(parsePopulationHash("#level=x&map=x&view=x", validIds)).toEqual(DEFAULT_POPULATION_STATE);
    expect(parsePopulationHash("#level=municipalities&map=density", validIds)).toMatchObject({ level: "municipalities", map: "population" });
    expect(parsePopulationHash("#level=regions&map=density", validIds)).toMatchObject({ level: "regions", map: "density" });
  });

  test("reads manual and open ranges", () => {
    expect(parsePopulationHash("#start=2010&end=2020", validIds).range).toEqual({ kind: "manual", start: 2010, end: 2020 });
    expect(parsePopulationHash("#range=all&start=2010&end=2020", validIds).range).toEqual({ kind: "all" });
  });
});

describe("state changes", () => {
  test("choosing on the map replaces the selection; list ticks add; the Georgia pill resets", () => {
    const picked = chooseOnMap(state({ selectedIds: [GEORGIA_PLACE_ID, "region.guria"] }), "region.imereti");
    expect(picked.selectedIds).toEqual(["region.imereti"]);
    expect(toggleSelected(picked, "region.guria").selectedIds).toEqual(["region.imereti", "region.guria"]);
    expect(toggleSelected(picked, "region.imereti").selectedIds).toEqual([]);
    expect(chooseGeorgia(picked).selectedIds).toEqual([GEORGIA_PLACE_ID]);
  });

  test("changing the level keeps the selection; municipalities turn density back into population", () => {
    const density = state({ map: "density", selectedIds: ["region.imereti"] });
    expect(changeLevel(density, "municipalities")).toMatchObject({ level: "municipalities", map: "population", selectedIds: ["region.imereti"] });
    expect(changeLevel(density, "regions").map).toBe("density");
    expect(changeMeasure(state({ level: "municipalities" }), "density").map).toBe("population");
    expect(changeMeasure(state(), "density").map).toBe("density");
  });

  test("select all and clear act on the active tab only", () => {
    const regionIds = placesAtLevel(places, "regions").map((place) => place.id);
    const mixed = state({ selectedIds: ["11"] });
    const all = setTabSelection(mixed, regionIds, true);
    expect(all.selectedIds).toEqual(["11", ...regionIds]);
    expect(setTabSelection(all, regionIds, false).selectedIds).toEqual(["11"]);
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
    expect(result.listed).toHaveLength(12);
  });

  test("Georgia first, then selected places by their end-year value", () => {
    const result = model({ selectedIds: ["region.imereti", "11", TBILISI_PLACE_ID, GEORGIA_PLACE_ID, "06"] });
    expect(result.selected.map((place) => place.id)).toEqual([GEORGIA_PLACE_ID, TBILISI_PLACE_ID, "region.imereti", "06", "11"]);
  });

  test("a place has no value before its first year and the line does not bridge or zero-fill it", () => {
    const result = model({ selectedIds: ["region.imereti"] });
    expect(result.series[0]!.vals[0]).toBeNull();
    expect(result.series[0]!.vals[result.years.indexOf(2014)]).toBeNull();
    expect(result.series[0]!.vals[result.years.indexOf(2015)]).toBe(population("region.imereti", 2015));
    expect(result.rows[0]!.valuesByYear[2010]).toBeNull();
  });

  test("labels follow the language", () => {
    expect(model({ selectedIds: ["11"] }, "ka").series[0]!.label).toBe(places.find((place) => place.id === "11")!.nameKa);
    expect(model({ selectedIds: ["11"] }, "en").series[0]!.label).toBe("Khulo");
  });

  test("a manual range is used and one outside the data shows everything", () => {
    expect(model({ range: { kind: "manual", start: 2015, end: 2024 } }).years).toHaveLength(10);
    expect(model({ range: { kind: "manual", start: 2000, end: 2030 } }).years).toHaveLength(23);
    expect(model({ range: { kind: "manual", start: 1990, end: 1995 } }).years).toHaveLength(23);
  });

  test("an empty selection has no highlights and no data", () => {
    const result = model({ selectedIds: [] });
    expect(result.firstSelected).toBeNull();
    expect(result.hasData).toBe(false);
    expect(buildPopulationHighlights(result, facts, places)).toBeNull();
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
    const list = [fake("b", 2), fake("a", 1), fake("c", 3), places.find((place) => place.id === GEORGIA_PLACE_ID)!];
    expect(rankPlaces(list, { a: 5, b: 5, c: null, [GEORGIA_PLACE_ID]: 1 }).map((place) => place.id)).toEqual([GEORGIA_PLACE_ID, "a", "b", "c"]);
  });
});

describe("highlights", () => {
  const smallest = (year: number) => {
    const entries = places
      .filter((place) => place.level === "municipality" || place.id === TBILISI_PLACE_ID)
      .map((place) => ({ place, value: population(place.id, year)! }))
      .sort((left, right) => left.value - right.value || left.place.sortOrder - right.place.sortOrder);
    return entries[0]!;
  };

  test("Georgia in 2026: the largest region, the densest region and the smallest municipality", () => {
    const result = buildPopulationHighlights(model(), facts, places);
    expect(result).toMatchObject({ kind: "country", year: 2026, persons: 3_941_103 });
    if (result?.kind !== "country") throw new Error("expected the country highlights");
    expect(result.largestRegion).toMatchObject({ value: 1_369_356 });
    expect(result.largestRegion?.place.id).toBe(TBILISI_PLACE_ID);
    expect(result.densestRegion?.place.id).toBe(TBILISI_PLACE_ID);
    expect(result.smallestMunicipality?.place.id).toBe(smallest(2026).place.id);
    expect(result.smallestMunicipality?.value).toBe(smallest(2026).value);
    expect(result.regionalFrom).toBe(2015);
  });

  test("Tbilisi in 2026 is a region with 34.7% of Georgia", () => {
    const result = buildPopulationHighlights(model({ selectedIds: [TBILISI_PLACE_ID] }), facts, places);
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    expect(result.persons).toBe(1_369_356);
    expect((result.shareOfGeorgia! * 100).toFixed(1)).toBe("34.7");
    expect(result.rank).toBe(1);
    expect(result.ofRegions).toBe(11);
    expect(result.municipalityCount).toBe(1);
    expect(result.density).not.toBeNull();
    expect(result.densityRank).toBe(1);
  });

  test("a region at the end of a 2025 range", () => {
    const result = buildPopulationHighlights(
      model({ selectedIds: ["region.imereti"], range: { kind: "manual", start: 2015, end: 2025 } }),
      facts,
      places,
    );
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    const regionIds = places.filter((place) => place.level === "region").map((place) => place.id);
    const expectedRank = [...regionIds].sort((left, right) => population(right, 2025)! - population(left, 2025)!).indexOf("region.imereti") + 1;
    expect(result.year).toBe(2025);
    expect(result.persons).toBe(population("region.imereti", 2025));
    expect(result.rank).toBe(expectedRank);
    expect(result.municipalityCount).toBe(places.filter((place) => place.regionId === "region.imereti").length);
  });

  test("a municipality at the end of a 2024 range, before the re-base", () => {
    const result = buildPopulationHighlights(
      model({ selectedIds: ["11"], range: { kind: "manual", start: 2015, end: 2024 } }),
      facts,
      places,
    );
    if (result?.kind !== "municipality") throw new Error("expected the municipality highlights");
    expect(result.persons).toBe(28_250);
    expect(result.shareOfRegion).toBeCloseTo(28_250 / population("region.adjara", 2024)!, 10);
    expect(result.regionPersons).toBe(population("region.adjara", 2024));
    expect(result.shareOfGeorgia).toBeCloseTo(28_250 / 3_694_608, 10);
    expect(result.ofMunicipalities).toBe(64);
    expect(result.region?.id).toBe("region.adjara");
  });

  test("a range that ends before 2015 has Georgia but no regional figure", () => {
    const range = { kind: "manual" as const, start: 2004, end: 2010 };
    const country = buildPopulationHighlights(model({ range }), facts, places);
    if (country?.kind !== "country") throw new Error("expected the country highlights");
    expect(country.persons).toBe(population(GEORGIA_PLACE_ID, 2010));
    expect(country.largestRegion).toBeNull();
    expect(country.smallestMunicipality).toBeNull();
    const region = buildPopulationHighlights(model({ selectedIds: ["region.imereti"], range }), facts, places);
    if (region?.kind !== "region") throw new Error("expected the region highlights");
    expect(region.persons).toBeNull();
    expect(region.rank).toBeNull();
    expect(region.regionalFrom).toBe(2015);
  });

  test("the first selected place is Georgia when it is chosen, otherwise the most populous place", () => {
    expect(buildPopulationHighlights(model({ selectedIds: ["11", "region.imereti", GEORGIA_PLACE_ID] }), facts, places)?.place.id).toBe(GEORGIA_PLACE_ID);
    expect(buildPopulationHighlights(model({ selectedIds: ["11", "region.imereti"] }), facts, places)?.place.id).toBe("region.imereti");
  });

  test("a trend is two segments across the re-base and one without it", () => {
    const across = buildPopulationHighlights(model({ range: { kind: "manual", start: 2015, end: 2026 } }), facts, places)!;
    expect(across.trend).toHaveLength(13);
    expect(across.trend[9]).toBe(3_694_608);
    expect(across.trend[10]).toBeNull();
    expect(across.trend[11]).toBe(3_930_428);
    const after = buildPopulationHighlights(model({ range: { kind: "manual", start: 2025, end: 2026 } }), facts, places)!;
    expect(after.trend).toEqual([3_930_428, 3_941_103]);
    expect(sparkValues([2023, 2024], (year) => year)).toEqual([2023, 2024]);
  });
});

describe("order independence", () => {
  // A CSV build serves the facts in file order; a database build (production) serves them in Postgres's
  // text-collation order. Nothing the model or the highlights return may depend on which one it is.
  test("the model and the highlights are the same for facts in reverse order", () => {
    const reversed = [...facts].reverse();
    expect(reversed).toHaveLength(facts.length);
    expect(reversed[0]).toBe(facts.at(-1));
    const cases: Array<[string, Partial<PopulationState>]> = [
      ["the default state", {}],
      ["Georgia, Imereti and Khulo", { selectedIds: [GEORGIA_PLACE_ID, "region.imereti", "11"] }],
      ["Imereti and Khulo to 2025", { selectedIds: ["region.imereti", "11"], range: { kind: "manual", start: 2015, end: 2025 } }],
      ["Khulo alone", { selectedIds: ["11"] }],
      ["Tbilisi alone", { selectedIds: [TBILISI_PLACE_ID] }],
    ];
    for (const [name, patch] of cases) {
      const forward = buildPopulationModel({ facts, places, state: state(patch), locale: "en" });
      const backward = buildPopulationModel({ facts: reversed, places, state: state(patch), locale: "en" });
      // `valueAt` is a closure over each build's own cells, so two builds never compare equal as functions:
      // compare what it answers for every place and year instead.
      const { valueAt: forwardAt, ...forwardRest } = forward;
      const { valueAt: backwardAt, ...backwardRest } = backward;
      expect(backwardRest, `model: ${name}`).toEqual(forwardRest);
      const cells = (at: typeof forwardAt) => places.map((place) => forward.availableYears.map((year) => at(place.id, year)));
      expect(cells(backwardAt), `valueAt: ${name}`).toEqual(cells(forwardAt));
      expect(buildPopulationHighlights(backward, reversed, places), `highlights: ${name}`).toEqual(
        buildPopulationHighlights(forward, facts, places),
      );
    }
  });
});
