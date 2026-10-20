import { beforeAll, expect, test } from "vitest";
import { loadServedScienceCultureData, toClientScienceCultureFact } from "../../lib/data/scienceCulture/importScienceCulture";
import { SCIENCE_CULTURE_INDICATORS, SCIENCE_CULTURE_REGIONS, type ClientScienceCultureFact, type ScienceCultureSeriesBreak } from "../../lib/data/scienceCulture/types";
import { INK } from "../../lib/explorer/colors";
import {
  SCIENCE_CULTURE_HUB_PATH, SCIENCE_CULTURE_SECTIONS, buildScienceCultureModel, changeScienceCultureSelection, parseScienceCultureHash, scienceCultureCoverage,
  scienceCultureDefaultSelection, scienceCultureSeriesColor, scienceCultureTopicSeries, serializeScienceCultureHash, type ScienceCultureTopicId,
} from "../../lib/explorer/scienceCulture";
import {
  MUSEUM_AREAS, buildMuseumAreaModel, changeMuseumAreaSelection, museumAreaDefaultSelection, museumAreaHref, museumAreaOfMapId,
  museumAreaSelectionHash, museumAreaSeries, museumAreaSlug, museumMapId, museumRegionHref, parseMuseumAreaHash,
} from "../../lib/explorer/scienceCultureMuseums";
import { buildMuseumRegionMapModel } from "../../lib/explorer/scienceCultureMuseumsRegionMap";
import { serializeTopicHash } from "../../lib/explorer/topicSeries";

let facts: ClientScienceCultureFact[];
let breaks: ScienceCultureSeriesBreak[];
beforeAll(async () => {
  const served = await loadServedScienceCultureData();
  facts = served.facts.map(toClientScienceCultureFact);
  breaks = served.breaks;
});
const span = (coverage: { min: number; max: number }) => [coverage.min, coverage.max];
const TOPICS: readonly ScienceCultureTopicId[] = ["research", "patents", "theatres"];
const state = (selectedIds: string[], range: { kind: "all" } | { kind: "manual"; start: number; end: number } = { kind: "all" }) => ({ mode: "line" as const, range, selectedIds });
const sc = (measure: string, group: string) => `science_culture.${measure}.${group}`;
const headingRuns = (rows: { heading: string }[]) => rows.reduce<[string, number][]>((runs, row) => {
  const last = runs.at(-1);
  if (last?.[0] === row.heading) last[1]++; else runs.push([row.heading, 1]);
  return runs;
}, []);

test("the hub lists the four pages", () => {
  expect(SCIENCE_CULTURE_HUB_PATH).toBe("/explorer/science-culture");
  expect(SCIENCE_CULTURE_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["research", "/explorer/science-culture/research", "common.scienceCultureResearch"],
    ["patents", "/explorer/science-culture/patents", "common.scienceCulturePatents"],
    ["museums", "/explorer/science-culture/museums", "common.scienceCultureMuseums"],
    ["theatres", "/explorer/science-culture/theatres", "common.scienceCultureTheatres"],
  ]);
});

test("each page starts on its default selection, with coverage from the facts", () => {
  expect(scienceCultureDefaultSelection("research")).toEqual([sc("researchers", "total")]);
  expect(scienceCultureDefaultSelection("patents")).toEqual([sc("invention_applications", "local")]);
  expect(scienceCultureDefaultSelection("theatres")).toEqual([sc("theatre_audience", "total")]);
  expect(museumAreaDefaultSelection("region_guria")).toEqual([sc("museum_visitors", "region_guria")]);
  expect(museumAreaDefaultSelection("georgia")).toEqual([sc("museum_visitors", "total")]);
  expect(span(scienceCultureCoverage("research", facts, scienceCultureDefaultSelection("research")))).toEqual([2019, 2024]);
  expect(span(scienceCultureCoverage("patents", facts, scienceCultureDefaultSelection("patents")))).toEqual([2016, 2025]);
  expect(span(scienceCultureCoverage("theatres", facts, scienceCultureDefaultSelection("theatres")))).toEqual([2006, 2025]);
  expect(span(scienceCultureCoverage("theatres", facts, [sc("theatre_staff", "total")]))).toEqual([2020, 2025]);
  const guria = parseMuseumAreaHash("", "region_guria", facts);
  expect(guria.selectedIds).toEqual(museumAreaDefaultSelection("region_guria"));
  expect(buildMuseumAreaModel("region_guria", facts, guria).range).toMatchObject({ start: 2005, end: 2025 });
});

test("the lists have the expected rows under their headings, in order", () => {
  const research = scienceCultureTopicSeries("research");
  expect(research).toHaveLength(26);
  expect(headingRuns(research)).toEqual([["researchers", 3], ["degree", 4], ["field", 7], ["age", 6], ["rdStaff", 4], ["institutions", 1], ["spending", 1]]);
  expect(research.slice(0, 3).map(s => s.id)).toEqual(["total", "women", "men"].map(g => sc("researchers", g)));
  expect(research.slice(3, 7).map(s => s.id)).toEqual(["degree_doctoral", "degree_master", "degree_bachelor", "degree_short_cycle"].map(g => sc("researchers", g)));
  expect(research.slice(7, 14).map(s => s.id.split(".")[2])).toEqual(["field_natural", "field_engineering", "field_medical", "field_agricultural", "field_social", "field_humanities", "field_not_identified"]);
  expect(research.slice(14, 20).map(s => s.id.split(".")[2])).toEqual(["age_under25", "age_25_34", "age_35_44", "age_45_54", "age_55_64", "age_65_plus"]);
  expect(research.slice(20, 24).map(s => s.id)).toEqual(["total", "technicians", "support", "not_specified"].map(g => sc("rd_staff", g)));
  expect(research.slice(24).map(s => s.id)).toEqual([sc("institutions", "total"), sc("rd_spending", "total")]);

  const patents = scienceCultureTopicSeries("patents");
  expect(patents).toHaveLength(12);
  expect(headingRuns(patents)).toEqual([["inventionApplications", 3], ["inventionPatents", 3], ["utilityApplications", 3], ["utilityPatents", 3]]);
  expect(patents.map(s => s.id)).toEqual(["invention_applications", "invention_patents", "utility_applications", "utility_patents"].flatMap(m => ["local", "foreign", "international"].map(g => sc(m, g))));

  const theatres = scienceCultureTopicSeries("theatres");
  expect(theatres).toHaveLength(21);
  expect(headingRuns(theatres)).toEqual([["audience", 1], ["shows", 3], ["events", 3], ["theatres", 5], ["seats", 1], ["staff", 8]]);
  expect(theatres.slice(1, 4).map(s => s.id)).toEqual(["total", "away", "abroad"].map(g => sc("theatre_shows", g)));
  expect(theatres.slice(7, 12).map(s => s.id)).toEqual(["total", "type_drama", "type_puppet", "type_opera_ballet", "type_youth"].map(g => sc("theatres", g)));
  expect(theatres.slice(13).map(s => s.id)).toEqual(["total", "women", "men", "permanent", "contract", "age_under25", "age_25_54", "age_55_plus"].map(g => sc("theatre_staff", g)));

  const georgia = museumAreaSeries("georgia");
  expect(georgia).toHaveLength(18);
  expect(headingRuns(georgia)).toEqual([["visitors", 1], ["tours", 1], ["exhibitions", 1], ["museums", 7], ["staff", 8]]);
  expect(georgia.slice(3, 10).map(s => s.id)).toEqual(["total", "type_memorial", "type_history", "type_art", "type_reserve", "type_literature", "type_other"].map(g => sc("museums", g)));
  const guria = museumAreaSeries("region_guria");
  expect(headingRuns(guria)).toEqual([["visitors", 1], ["tours", 1], ["exhibitions", 1], ["museums", 1]]);
  expect(guria.map(s => s.id)).toEqual(["museum_visitors", "museum_tours", "museum_exhibitions", "museums"].map(m => sc(m, "region_guria")));

  // The first row of each list is the one ink reference, and every listed row is a served indicator.
  for (const list of [...TOPICS.map(scienceCultureTopicSeries), ...MUSEUM_AREAS.map(museumAreaSeries)]) {
    expect(list.filter(s => s.reference).map(s => s.id)).toEqual([list[0].id]);
    for (const s of list) expect(SCIENCE_CULTURE_INDICATORS).toContain(s.id);
  }
  for (const area of MUSEUM_AREAS.slice(1)) expect(museumAreaSeries(area)).toHaveLength(4);
});

test("a link mixing units keeps the first row in list order, with the years clamped to its coverage (Review Focus 2)", () => {
  const link = (...ids: string[]) => `#sel=${ids.join(",")}`;
  const researchers = sc("researchers", "total");
  const spending = sc("rd_spending", "total");
  expect(parseScienceCultureHash(link(researchers, spending), "research", facts).selectedIds).toEqual([researchers]);
  expect(parseScienceCultureHash(link(spending, researchers), "research", facts).selectedIds).toEqual([researchers]);
  // All the people headings are one unit and chart together.
  const people = [researchers, sc("researchers", "degree_doctoral"), sc("rd_staff", "technicians")];
  expect(parseScienceCultureHash(link(...people), "research", facts).selectedIds).toEqual(people);
  // All four patent headings are counts and chart together.
  const patents = [sc("invention_applications", "local"), sc("utility_patents", "foreign")];
  expect(parseScienceCultureHash(link(...patents), "patents", facts).selectedIds).toEqual(patents);
  // Theatre shows, events and theatres chart together; audience (thousand) does not join them.
  const counts = [sc("theatre_shows", "total"), sc("theatre_events", "total"), sc("theatres", "total")];
  expect(parseScienceCultureHash(link(...counts), "theatres", facts).selectedIds).toEqual(counts);
  expect(parseScienceCultureHash(link(sc("theatre_audience", "total"), sc("theatre_seats", "total"), sc("theatre_shows", "total")), "theatres", facts).selectedIds)
    .toEqual([sc("theatre_audience", "total"), sc("theatre_seats", "total")]);
  // The staff rows start in 2020: a staff-only link clamps the years.
  const staff = parseScienceCultureHash("#sel=science_culture.theatre_staff.total&start=2006&end=2023", "theatres", facts);
  expect(staff.range).toEqual({ kind: "manual", start: 2020, end: 2023 });
  // The default applies without a selection in the hash, and an explicit empty selection stays empty.
  expect(parseScienceCultureHash("", "research", facts).selectedIds).toEqual([researchers]);
  const empty = state([]);
  expect(parseScienceCultureHash(`#${serializeScienceCultureHash(empty)}`, "research", facts)).toEqual(empty);
  expect(serializeScienceCultureHash(empty)).toBe(serializeTopicHash(empty));
});

test("ticking a row of another unit replaces the selection, and the years stay clamped to the new unit", () => {
  const theatres = scienceCultureTopicSeries("theatres");
  const audience = state([sc("theatre_audience", "total")], { kind: "manual", start: 2008, end: 2024 });
  expect(changeScienceCultureSelection(audience, theatres, [...audience.selectedIds, sc("theatre_staff", "total")], facts))
    .toEqual({ ...audience, selectedIds: [sc("theatre_staff", "total")], range: { kind: "manual", start: 2020, end: 2024 } });
  expect(changeScienceCultureSelection(audience, theatres, [...audience.selectedIds, sc("theatre_seats", "total")], facts).selectedIds)
    .toEqual([sc("theatre_audience", "total"), sc("theatre_seats", "total")]);
  const guria = state([sc("museum_visitors", "region_guria")]);
  expect(changeMuseumAreaSelection("region_guria", guria, [...guria.selectedIds, sc("museums", "region_guria")], facts).selectedIds).toEqual([sc("museums", "region_guria")]);
});

test("a year without a value is null in the model, never zero, and a published zero stays zero (Review Focus 1)", () => {
  const events = buildScienceCultureModel("theatres", facts, state([sc("theatre_events", "total")]), breaks);
  const series = events.selected[0];
  expect(events.years[0]).toBe(2006);
  expect(events.years.at(-1)).toBe(2025);
  expect(events.unit).toBe("count");
  for (let year = 2006; year <= 2020; year++) expect(series.valuesByYear[year]).toBeNull();
  expect(series.valuesByYear[2021]).not.toBeNull();
  const field = buildScienceCultureModel("research", facts, state([sc("researchers", "field_not_identified")]), breaks).selected[0];
  expect(field.valuesByYear[2022]).toBe(0);
  expect(field.valuesByYear[2021]).toBeGreaterThan(0);
  expect(buildScienceCultureModel("research", facts, state([sc("rd_spending", "total")]), breaks).unit).toBe("gel");
  expect(buildScienceCultureModel("research", facts, state([]), breaks).unit).toBe("persons");
});

test("the theatre audience break is drawn only when the range crosses 2021 (Review Focus 4)", () => {
  const audience = [sc("theatre_audience", "total")];
  expect(buildScienceCultureModel("theatres", facts, state(audience), breaks).breaks).toEqual([{ year: 2021, label: "newCounting" }]);
  expect(buildScienceCultureModel("theatres", facts, state(audience, { kind: "manual", start: 2021, end: 2025 }), breaks).breaks).toEqual([]);
  expect(buildScienceCultureModel("theatres", facts, state(audience, { kind: "manual", start: 2006, end: 2020 }), breaks).breaks).toEqual([]);
  expect(buildScienceCultureModel("theatres", facts, state([sc("theatre_seats", "total")]), breaks).breaks).toEqual([]);
  expect(buildScienceCultureModel("theatres", facts, state([]), breaks).breaks).toEqual([]);
  expect(buildScienceCultureModel("research", facts, state([sc("researchers", "total")]), breaks).breaks).toEqual([]);
});

test("an area page reads its own hash and links to another area carry the selection moved there (Review Focus 3)", () => {
  expect(museumAreaSelectionHash([sc("museum_staff", "total")], "region_guria")).toBe("");
  expect(museumAreaSelectionHash([sc("museum_tours", "region_guria")], "georgia")).toBe("#sel=science_culture.museum_tours.total");
  expect(museumAreaSelectionHash([sc("museums", "type_art"), sc("museum_visitors", "total")], "region_imereti")).toBe("");
  expect(museumAreaSelectionHash([sc("museum_exhibitions", "total")], "region_guria")).toBe("#sel=science_culture.museum_exhibitions.region_guria");
  expect(museumAreaSelectionHash([sc("museums", "region_guria"), sc("museum_visitors", "region_guria")], "georgia")).toBe(`#${new URLSearchParams({ sel: "science_culture.museums.total,science_culture.museum_visitors.total" })}`);
  expect(museumAreaSelectionHash([sc("museum_staff", "women"), sc("museums", "type_art")], "georgia")).toBe(`#${new URLSearchParams({ sel: "science_culture.museum_staff.women,science_culture.museums.type_art" })}`);
  expect(museumAreaSelectionHash([], "region_guria")).toBe("");
  expect(museumAreaSelectionHash(museumAreaDefaultSelection("region_guria"), "georgia")).toBe("");
  // The moved selection parses on the target page.
  expect(parseMuseumAreaHash(museumAreaSelectionHash([sc("museum_tours", "region_guria")], "region_imereti"), "region_imereti", facts).selectedIds).toEqual([sc("museum_tours", "region_imereti")]);
  expect(parseMuseumAreaHash("#sel=science_culture.museum_staff.total", "region_guria", facts).selectedIds).toEqual([]);
  expect(parseMuseumAreaHash("#sel=science_culture.museum_visitors.total,science_culture.museum_staff.total", "georgia", facts).selectedIds).toEqual([sc("museum_visitors", "total")]);
  // A region's early gaps and Georgia's staff years.
  expect(buildMuseumAreaModel("georgia", facts, state([sc("museum_staff", "total")])).range).toMatchObject({ start: 2020, end: 2025 });
});

test("area routes and map ids", () => {
  expect(MUSEUM_AREAS).toEqual(["georgia", ...SCIENCE_CULTURE_REGIONS]);
  expect(MUSEUM_AREAS).toHaveLength(12);
  expect(museumAreaSlug("region_guria")).toBe("guria");
  expect(museumAreaHref("georgia")).toBe("/explorer/science-culture/museums/georgia");
  expect(museumMapId("georgia")).toBe("georgia");
  expect(museumMapId("region_guria")).toBe("region.guria");
  for (const area of MUSEUM_AREAS) expect(museumAreaOfMapId(museumMapId(area))).toBe(area);
  expect(museumRegionHref("region.guria")).toBe("/explorer/science-culture/museums/guria");
});

test("the Museums map ranks the eleven regions by visitors in the latest year", () => {
  const map = buildMuseumRegionMapModel(facts);
  expect(map.year).toBe(2025);
  expect(map.regions).toHaveLength(11);
  expect(map.regions[0]).toMatchObject({ regionId: "region.tbilisi", rank: 1 });
});

test("colours: the reference is ink; a staff group keeps one colour on both pages; rows charted together are told apart", () => {
  const color = (list: ReturnType<typeof scienceCultureTopicSeries>, id: string) => {
    const index = list.findIndex(s => s.id === id);
    return scienceCultureSeriesColor(list[index], index);
  };
  const patents = scienceCultureTopicSeries("patents");
  const theatres = scienceCultureTopicSeries("theatres");
  const georgia = museumAreaSeries("georgia");
  expect(color(patents, sc("invention_applications", "local"))).toBe(INK);
  // All four patent headings chart together, so each of the 12 rows has its own colour.
  expect(new Set(patents.map((s, i) => scienceCultureSeriesColor(s, i))).size).toBe(12);
  for (const group of ["total", "women", "age_55_plus"]) expect(color(theatres, sc("theatre_staff", group))).toBe(color(georgia, sc("museum_staff", group)));
  const people = scienceCultureTopicSeries("research").slice(0, 14);
  expect(new Set(people.map((s, i) => scienceCultureSeriesColor(s, i))).size).toBe(14);
  const staff = theatres.slice(13);
  expect(new Set(staff.map(s => color(theatres, s.id))).size).toBe(8);
});

test("every topic and museum area model builds over its full coverage", () => {
  for (const section of TOPICS) {
    const model = buildScienceCultureModel(section, facts, state(scienceCultureTopicSeries(section).map(s => s.id)), breaks);
    expect(model.series).toHaveLength(scienceCultureTopicSeries(section).length);
    expect(model.years.length).toBeGreaterThan(0);
  }
  for (const area of MUSEUM_AREAS) {
    const model = buildMuseumAreaModel(area, facts, state(museumAreaSeries(area).map(s => s.id)));
    expect(model.series).toHaveLength(museumAreaSeries(area).length);
    expect(model.years.length).toBeGreaterThan(0);
  }
});
