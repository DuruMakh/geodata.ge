import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadServedScienceCultureData, toClientScienceCultureFact } from "../../lib/data/scienceCulture/importScienceCulture";
import { SCIENCE_CULTURE_INDICATORS, SCIENCE_CULTURE_REGIONS, SCIENCE_CULTURE_SOURCES, type ClientScienceCultureFact, type ScienceCultureSeriesBreak } from "../../lib/data/scienceCulture/types";
import { INK } from "../../lib/explorer/colors";
import {
  SCIENCE_CULTURE_HUB_PATH, SCIENCE_CULTURE_SECTIONS, buildScienceCultureModel, changeScienceCultureSelection, parseScienceCultureHash, scienceCultureCoverage,
  scienceCultureDefaultSelection, scienceCultureSeriesColor, scienceCultureTopicSeries, serializeScienceCultureHash, type ScienceCultureTopicId,
} from "../../lib/explorer/scienceCulture";
import {
  MUSEUM_AREAS, buildMuseumAreaModel, changeMuseumAreaSelection, museumAreaDefaultSelection, museumAreaHref, museumAreaOfMapId,
  museumAreaSelectionHash, museumAreaSeries, museumAreaSlug, museumMapId, museumRegionHref, parseMuseumAreaHash,
} from "../../lib/explorer/scienceCultureMuseums";
import { buildScienceCultureHubCards } from "../../lib/explorer/scienceCultureHubCards";
import { buildMuseumRegionMapModel } from "../../lib/explorer/scienceCultureMuseumsRegionMap";
import { buildScienceCultureWorkbookExportModel } from "../../lib/explorer/scienceCultureWorkbook";
import { serializeTopicHash } from "../../lib/explorer/topicSeries";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Presentation } from "../../lib/i18n/types";

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

const presentation = async (locale: Locale = "en"): Promise<Presentation> => ({ locale, englishLabels: {}, messages: await getMessages(locale, ["workbook", "format", "common", "scienceCulture"]) });
const SOURCES = SCIENCE_CULTURE_SOURCES.map(sourceId => ({
  sourceId, years: Array.from({ length: 21 }, (_, i) => 2005 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-20",
  downloadHref: `/downloads/methodology/science-culture/files/${sourceId}.xlsx` as const,
}));
const base = { sources: SOURCES, siteOrigin: "https://fiscal.ge", title: "Title" };
const labelsFor = (ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, id]));
const ENGLISH: Record<string, string> = { [sc("theatre_audience", "total")]: "Audience", [sc("theatre_events", "total")]: "Events in Georgia" };

test("a theatres workbook exports audience in thousands as stored and leaves the events before 2021 blank", async () => {
  const ids = [sc("theatre_audience", "total"), sc("theatre_events", "total")];
  // Audience (thousand) and events (count) are two units: the workbook follows the selection's unit, the first row's.
  const audience = buildScienceCultureWorkbookExportModel({ ...base, facts, section: "theatres", labels: ENGLISH, state: state([ids[0]], { kind: "manual", start: 2006, end: 2025 }) }, await presentation());
  expect(audience.filename).toBe("fiscal-science-culture-theatres-2006-2025-en.xlsx");
  expect(audience.readable.unitLabel).toBe("thousand");
  expect(audience.readable.numberFormat).toBe("#,##0.0");
  expect(audience.readable.rows[0].valuesByYear[2025]).toBe(620.322);
  expect(audience.analysis.rows.find(r => r[0] === 2025)).toEqual([2025, "Audience", 620.322, "Official"]);
  expect(audience.analysis.numericFormats).toEqual({ 3: "#,##0.0" });

  const events = buildScienceCultureWorkbookExportModel({ ...base, facts, section: "theatres", labels: ENGLISH, state: state([ids[1]], { kind: "manual", start: 2006, end: 2025 }) }, await presentation());
  expect(events.readable.unitLabel).toBe("number");
  expect(events.readable.numberFormat).toBe("#,##0");
  expect(events.readable.years).toHaveLength(20);
  expect(events.readable.rows[0].label).toBe("Events — Events in Georgia");
  for (let year = 2006; year <= 2020; year++) {
    expect(events.readable.rows[0].valuesByYear[year]).toBeNull();
    expect(events.readable.rows[0].basisByYear[year]).toBeNull();
    expect(events.analysis.rows.find(r => r[0] === year)!.slice(2)).toEqual([null, "Not available"]);
  }
  expect(events.readable.rows[0].valuesByYear[2021]).toBeGreaterThan(0);
  expect(events.sources.map(s => s.title)).toEqual(["geostat_culture_theatre_events"]);

  // The Excel cell holds the exact stored number; only the number format rounds it.
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(audience));
  expect(excel.worksheets).toHaveLength(3);
  const data = excel.worksheets[1];
  const row = data.getRows(2, data.rowCount - 1)!.find(r => r.getCell(1).value === 2025)!;
  expect(row.getCell(3).value).toBe(620.322);
  expect(row.getCell(3).numFmt).toBe("#,##0.0");
});

test("a theatres workbook of audience and events blanks the events cells before 2021 when both are exported", async () => {
  // Audience and events differ in unit, so a mixed link keeps one; the events row alone covers 2006–2025 because the audience rows set the coverage.
  const ids = [sc("theatre_shows", "total"), sc("theatre_events", "total")];
  const model = buildScienceCultureWorkbookExportModel({ ...base, facts, section: "theatres", labels: labelsFor(ids), state: state(ids, { kind: "manual", start: 2006, end: 2025 }) }, await presentation());
  const events = model.readable.rows[1];
  expect(model.readable.rows.map(r => r.label)).toEqual([`Shows — ${ids[0]}`, `Events — ${ids[1]}`]);
  expect(model.readable.years[0]).toBe(2006);
  for (let year = 2006; year <= 2020; year++) expect(events.valuesByYear[year]).toBeNull();
  expect(events.valuesByYear[2021]).not.toBeNull();
  expect(model.analysis.rows).toHaveLength(40);
});

test("a Guria museums workbook is named for the area and cites only the by-region source", async () => {
  const id = sc("museum_visitors", "region_guria");
  const model = buildScienceCultureWorkbookExportModel({ ...base, facts, area: "region_guria", labels: { [id]: "Visitors" }, state: state([id], { kind: "manual", start: 2005, end: 2025 }) }, await presentation());
  expect(model.filename).toBe("fiscal-science-culture-museums-guria-2005-2025-en.xlsx");
  expect(model.readable.unitLabel).toBe("thousand");
  expect(model.readable.rows.map(r => r.label)).toEqual(["Visitors"]);
  expect(model.readable.rows[0].kind).toBe("total");
  expect(model.sources.map(s => s.title)).toEqual(["geostat_culture_museums_regions"]);
  expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/science-culture/files/geostat_culture_museums_regions.xlsx");
  const ka = await buildScienceCultureWorkbookExportModel({ ...base, facts, area: "region_guria", labels: { [id]: "Visitors" }, state: state([id]) }, await presentation("ka"));
  expect(ka.filename).toBe("fiscal-science-culture-museums-guria-2005-2025.xlsx");
  const empty = buildScienceCultureWorkbookExportModel({ ...base, facts, section: "research", labels: {}, state: state([]) }, await presentation());
  expect(empty.readable.rows).toEqual([]); expect(empty.analysis.rows).toEqual([]); expect(empty.sources).toEqual([]);
});

test("a research workbook exports million GEL as stored and persons as whole numbers", async () => {
  const spending = sc("rd_spending", "total");
  const model = buildScienceCultureWorkbookExportModel({ ...base, facts, section: "research", labels: { [spending]: "Spending on research and development" }, state: state([spending]) }, await presentation());
  expect(model.filename).toBe("fiscal-science-culture-research-2019-2024-en.xlsx");
  expect(model.readable.unitLabel).toBe("million GEL");
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.rows[0].label).toBe("Spending — Spending on research and development");
  expect(model.readable.rows[0].valuesByYear[2024]).toBe(facts.find(f => f.indicatorId === spending && f.year === 2024)!.value);
  const people = buildScienceCultureWorkbookExportModel({ ...base, facts, section: "research", labels: labelsFor([sc("researchers", "total")]), state: state([sc("researchers", "total")]) }, await presentation());
  expect(people.readable.numberFormat).toBe("#,##0");
  expect(people.readable.rows[0].valuesByYear[2024]).toBe(14046);
});

test("the hub has four cards with each default series' latest value and years", async () => {
  const cards = buildScienceCultureHubCards(facts, await presentation());
  expect(cards.map(card => card.href)).toEqual(SCIENCE_CULTURE_SECTIONS.map(section => section.href));
  expect(cards.map(card => card.title)).toEqual(["Research", "Patents", "Museums", "Theatres"]);
  expect(cards.map(card => card.footer)).toEqual(["2024 · 14,046 · 2019–2024", "2025 · 79 · 2016–2025", "2025 · 1,998.9 · 2005–2025", "2025 · 620.3 · 2006–2025"]);
  expect(cards.map(card => card.series!.length)).toEqual([6, 10, 21, 20]);
  expect(cards[3].series!.at(-1)).toBe(620.322);
  expect(cards.every(card => card.seriesColor === INK && !card.comingSoon)).toBe(true);
  expect(cards.map(card => card.index)).toEqual(["01", "02", "03", "04"]);
});
