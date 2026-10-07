import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { EDITORIAL_PALETTE, INK, OTHER_COLOR, colorForItem } from "../../lib/explorer/colors";
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
  placeYears,
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

  test("Georgia is the only place in ink", () => {
    expect(places.filter((p) => placeColor(p).toUpperCase() === INK.toUpperCase()).map((p) => p.id)).toEqual([GEORGIA_PLACE_ID]);
  });

  test("a region and its municipalities never share a colour", () => {
    for (const region of places.filter((p) => p.level === "region")) {
      const family = [region, ...places.filter((p) => p.regionId === region.id)].map((p) => placeColor(p));
      expect(new Set(family).size, region.id).toBe(family.length);
    }
  });

  // On the registry's order, four municipalities fell on the colour of their own region.
  const CLASHED: Array<[code: string, regionId: string]> = [
    ["31", "region.imereti"],
    ["18", "region.kakheti"],
    ["35", "region.samegrelo_zemo_svaneti"],
    ["51", "region.kvemo_kartli"],
  ];

  test("the four that wore their region's colour take another colour of the palette, never the grey that \"other\" wears", () => {
    for (const [code, regionId] of CLASHED) {
      expect(place(code).regionId, code).toBe(regionId);
      expect(placeColor(place(code)), code).not.toBe(placeColor(place(regionId)));
      expect(EDITORIAL_PALETTE, code).toContain(placeColor(place(code)));
      expect(placeColor(place(code)), code).not.toBe(OTHER_COLOR);
    }
  });

  test("every other municipality keeps the colour its registry position gives it", () => {
    const moved = new Set(CLASHED.map(([code]) => code));
    const others = places.filter((p) => p.level === "municipality" && !moved.has(p.id));
    expect(others).toHaveLength(59);
    for (const other of others) expect(placeColor(other), other.id).toBe(colorForItem(other.id, other.sortOrder));
  });

  test("every region keeps the colour its registry position gives it", () => {
    for (const region of places.filter((p) => p.level === "region")) {
      expect(placeColor(region), region.id).toBe(colorForItem(region.id, region.sortOrder - 1));
    }
  });

  describe("moving off the region's colour, on registries that force each case", () => {
    const region = (id: string, sortOrder: number): MunicipalRegion => ({ id, kaLabel: id, sortOrder });
    const member = (code: string, sortId: number, regionId: string): Municipality => ({
      code, sortId, nameKa: code, displayNameKa: code, regionId, isSelfGoverningCity: false,
    });
    const build = (regions: MunicipalRegion[], municipalities: Municipality[]) =>
      buildDemographyPlaces({
        regions,
        municipalities,
        englishLabels: Object.fromEntries([GEORGIA_PLACE_ID, ...regions.map((r) => r.id), ...municipalities.map((m) => m.code)].map((id) => [id, id])),
        georgiaNameKa: "საქართველო",
      });
    const colourIn = (built: DemographyPlace[], id: string) => placeColor(built.find((p) => p.id === id)!);

    test("it walks on from its own position past colours its siblings wear and colours already given out", () => {
      // The region wears palette[3]. a and c sit on it; b wears palette[4] and d palette[6].
      const built = build(
        [region("region.t", 4)],
        [member("a", 3, "region.t"), member("b", 4, "region.t"), member("c", 17, "region.t"), member("d", 6, "region.t")],
      );
      expect(colourIn(built, "region.t")).toBe(EDITORIAL_PALETTE[3]);
      // a skips palette[4] (b's), takes palette[5]; c skips 4, 5 (a's now) and 6 (d's), takes 7; b and d stay.
      expect(["a", "b", "c", "d"].map((id) => colourIn(built, id))).toEqual([
        EDITORIAL_PALETTE[5],
        EDITORIAL_PALETTE[4],
        EDITORIAL_PALETTE[7],
        EDITORIAL_PALETTE[6],
      ]);
    });

    test("the walk wraps round the end of the palette", () => {
      const last = EDITORIAL_PALETTE.length - 1;
      const built = build([region("region.t", EDITORIAL_PALETTE.length)], [member("a", last, "region.t")]);
      expect(colourIn(built, "region.t")).toBe(EDITORIAL_PALETTE[last]);
      expect(colourIn(built, "a")).toBe(EDITORIAL_PALETTE[0]);
    });

    test("the walk never takes the grey that \"other\" wears: where that would be the next free colour, it goes on past it", () => {
      // The region wears palette[5] and a sits on it. m6 to m12 wear palette[6] to palette[12], so the grey (palette[13]) is the next free colour.
      const others = EDITORIAL_PALETTE.slice(6, 13).map((_, step) => member(`m${6 + step}`, 6 + step, "region.t"));
      const built = build([region("region.t", 6)], [member("a", 5, "region.t"), ...others]);
      expect(colourIn(built, "region.t")).toBe(EDITORIAL_PALETTE[5]);
      expect(EDITORIAL_PALETTE[13]).toBe(OTHER_COLOR);
      expect(colourIn(built, "a")).toBe(EDITORIAL_PALETTE[0]);
      expect(built.map(placeColor)).not.toContain(OTHER_COLOR);
    });

    test("the order the registry lists the municipalities in does not change the colours they are given", () => {
      // a and c both sit on the region's colour (palette[3]) and each would take palette[4] if it came first: a, the lower sort id, does.
      const regions = [region("region.t", 4)];
      const listed = [member("a", 3, "region.t"), member("c", 17, "region.t")];
      const colours = (built: DemographyPlace[]) => ["a", "c"].map((id) => colourIn(built, id));
      expect(colours(build(regions, listed))).toEqual([EDITORIAL_PALETTE[4], EDITORIAL_PALETTE[5]]);
      expect(colours(build(regions, [...listed].reverse()))).toEqual([EDITORIAL_PALETTE[4], EDITORIAL_PALETTE[5]]);
    });

    test("a region whose municipalities wear the whole palette has no colour to give, and says so", () => {
      const everyColour = EDITORIAL_PALETTE.map((_, index) => member(`m${index}`, index, "region.t"));
      expect(() => build([region("region.t", 4)], everyColour)).toThrow(/No palette colour is free/);
    });
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

describe("placeYears", () => {
  const years = (id: string, source: readonly ClientDemographyObservation[] = facts) => placeYears(source, place(id));
  const span = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, step) => first + step);

  test("a place's own years, each once and ascending: Georgia from 2004, everything else from 2015", () => {
    expect(years(GEORGIA_PLACE_ID)).toEqual(span(2004, 2026));
    expect(years("region.adjara")).toEqual(span(2015, 2026));
    expect(years("06")).toEqual(span(2015, 2026));
  });

  test("Tbilisi is the facts of region.tbilisi and of municipality 04 together, each year once", () => {
    expect(years(TBILISI_PLACE_ID)).toEqual(span(2015, 2026));
  });

  test("only the population total counts, and the order of the facts does not matter", () => {
    const density = facts.find((fact) => fact.seriesId === SERIES.populationDensity && fact.geographyId === GEORGIA_PLACE_ID)!;
    const withStray = [{ ...density, year: 1999 }, ...facts].reverse();
    expect(years(GEORGIA_PLACE_ID, withStray)).toEqual(span(2004, 2026));
  });
});

describe("ranking", () => {
  const fake = (id: string, sortOrder: number): DemographyPlace => ({
    id, level: "region", nameKa: id, nameEn: id, regionId: null, sortOrder, municipalityCount: 0, color: "#000000",
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
