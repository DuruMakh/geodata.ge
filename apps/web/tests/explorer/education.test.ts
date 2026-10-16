import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadEducationFacts, shownEducationFacts, toClientEducationFact } from "../../lib/data/education/importEducation";
import { EDUCATION_HE_GROUPS, EDUCATION_SOURCES, EDUCATION_VET_FIELDS, type ClientEducationFact, type EducationFact } from "../../lib/data/education/types";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { INK } from "../../lib/explorer/colors";
import {
  EDUCATION_HUB_PATH, EDUCATION_SECTIONS, buildEducationModel, changeEducationSelection, defaultEducationState, educationCoverage, educationDefaultSelection,
  educationPeriodLabel, educationSeriesColor, educationTopicSeries, parseEducationHash, schoolYearLabel, serializeEducationHash,
} from "../../lib/explorer/education";
import {
  buildEducationPlaceModel, changeEducationPlaceSelection, educationPlaceBase, educationPlaceCoverage, educationPlaceDefaultSelection,
  educationPlaceLinkHash, educationPlaceMovedSelection, educationPlaceSeries, parseEducationPlaceHash,
} from "../../lib/explorer/educationPlaces";
import { buildEducationIndexModel } from "../../lib/explorer/educationIndex";

import { buildEducationHubCards } from "../../lib/explorer/educationHubCards";
import { buildEducationWorkbookExportModel } from "../../lib/explorer/educationWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";

let facts: ClientEducationFact[];
let served: EducationFact[];
let regions: MunicipalRegion[];
let municipalities: Municipality[];
beforeAll(async () => {
  const [loaded, municipal] = await Promise.all([loadEducationFacts(), loadServedMunicipalData()]);
  served = shownEducationFacts(loaded);
  facts = served.map(toClientEducationFact);
  ({ regions, municipalities } = municipal);
});
const span = (coverage: { min: number; max: number }) => [coverage.min, coverage.max];
const line = { mode: "line" as const, range: { kind: "all" as const } };

test("the hub lists Schools, Kindergartens, Universities and Vocational colleges", () => {
  expect(EDUCATION_HUB_PATH).toBe("/explorer/education");
  expect(EDUCATION_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["schools", "/explorer/education/schools", "common.educationSchools"],
    ["kindergartens", "/explorer/education/kindergartens", "common.educationKindergartens"],
    ["universities", "/explorer/education/universities", "common.educationUniversities"],
    ["vocational", "/explorer/education/vocational", "common.educationVocational"],
  ]);
  expect(educationPlaceBase("schools")).toBe("/explorer/education/schools");
  expect(educationPlaceBase("kindergartens")).toBe("/explorer/education/kindergartens");
});

test("a school year reads as its start year and the next year's last two digits; vocational years stay plain", () => {
  expect(schoolYearLabel(2025)).toBe("2025/26");
  expect(schoolYearLabel(2009)).toBe("2009/10");
  expect(schoolYearLabel(1999)).toBe("1999/00");
  for (const section of ["schools", "kindergartens", "universities"] as const) expect(educationPeriodLabel(section)(2009)).toBe("2009/10");
  expect(educationPeriodLabel("vocational")(2025)).toBe("2025");
});

test("each page starts on its default selection, with coverage from the facts", () => {
  expect(defaultEducationState("universities")).toEqual({ ...line, selectedIds: ["education.he_students.total"] });
  expect(defaultEducationState("vocational")).toEqual({ ...line, selectedIds: ["education.vet_admitted.total"] });
  expect(span(educationCoverage("universities", facts, educationDefaultSelection("universities")))).toEqual([2011, 2025]);
  expect(span(educationCoverage("vocational", facts, educationDefaultSelection("vocational")))).toEqual([2013, 2025]);
  expect(educationPlaceDefaultSelection("schools", "country.georgia")).toEqual(["education.pupils_national.total"]);
  expect(span(educationPlaceCoverage("schools", "country.georgia", facts, educationPlaceDefaultSelection("schools", "country.georgia")))).toEqual([2000, 2025]);
  expect(educationPlaceDefaultSelection("schools", "region.guria")).toEqual(["education.pupils.total"]);
  expect(span(educationPlaceCoverage("schools", "region.guria", facts, ["education.pupils.total"]))).toEqual([2005, 2025]);
  expect(educationPlaceDefaultSelection("kindergartens", "region.tbilisi")).toEqual(["education.kg_children.total"]);
  expect(span(educationPlaceCoverage("kindergartens", "region.tbilisi", facts, ["education.kg_children.total"]))).toEqual([2017, 2025]);
});

test("Universities lists 16 rows under each of three headings, Vocational 12 under each of two, and only the first total is the reference", () => {
  const universities = educationTopicSeries("universities");
  expect(universities).toHaveLength(48);
  expect(universities.map(s => [s.id, s.heading])).toEqual(
    (["he_students", "he_admitted", "he_graduates"] as const).flatMap(measure => EDUCATION_HE_GROUPS.map(group => [`education.${measure}.${group}`, measure])),
  );
  const vocational = educationTopicSeries("vocational");
  expect(vocational).toHaveLength(24);
  expect(vocational.map(s => [s.id, s.heading])).toEqual(
    (["vet_admitted", "vet_graduates"] as const).flatMap(measure => ["total", "women", "men", ...EDUCATION_VET_FIELDS].map(group => [`education.${measure}.${group}`, measure])),
  );
  for (const series of [universities, vocational]) {
    expect(series.filter(s => s.reference).map(s => s.id)).toEqual([series[0].id]);
    expect(series.some(s => s.id.includes(".old_"))).toBe(false);
  }
  expect(educationSeriesColor(universities[0], 0)).toBe(INK);
  expect(educationSeriesColor(universities[16], 16)).not.toBe(INK);
});

test("a place lists three headings: Georgia's 11 rows with the national split, a municipality's 5, Kindergartens' 3", () => {
  expect(educationPlaceSeries("schools", "country.georgia").map(s => [s.id, s.heading, s.reference])).toEqual([
    ["education.pupils_national.total", "pupils", true], ["education.pupils_national.public", "pupils", false], ["education.pupils_national.private", "pupils", false],
    ["education.teachers.total", "teachers", false], ["education.teachers.public", "teachers", false], ["education.teachers.private", "teachers", false],
    ["education.teachers.women", "teachers", false], ["education.teachers.men", "teachers", false],
    ["education.schools.total", "schools", false], ["education.schools.public", "schools", false], ["education.schools.private", "schools", false],
  ]);
  expect(educationPlaceSeries("schools", "55").map(s => [s.id, s.heading, s.reference])).toEqual([
    ["education.pupils.total", "pupils", true],
    ["education.teachers.total", "teachers", false], ["education.teachers.women", "teachers", false], ["education.teachers.men", "teachers", false],
    ["education.schools.total", "schools", false],
  ]);
  for (const place of ["country.georgia", "region.guria", "55"]) {
    expect(educationPlaceSeries("kindergartens", place).map(s => [s.id, s.heading, s.reference])).toEqual([
      ["education.kg_children.total", "kg_children", true], ["education.kg_staff.total", "kg_staff", false], ["education.kindergartens.total", "kindergartens", false],
    ]);
  }
});

test("a saved link that mixes headings keeps the first row's heading, and ticking another heading replaces the selection", () => {
  const parsed = parseEducationPlaceHash("#sel=education.pupils.total,education.teachers.women", "schools", "region.guria", facts);
  expect(parsed).toEqual({ ...line, selectedIds: ["education.pupils.total"] });
  const ticked = changeEducationPlaceSelection(parsed, "schools", "region.guria", ["education.pupils.total", "education.teachers.women"], facts);
  expect(ticked).toEqual({ ...line, selectedIds: ["education.teachers.women"] });
  const model = buildEducationPlaceModel("schools", "region.guria", facts, ticked);
  expect([model.range.start, model.range.end]).toEqual([2016, 2025]);
  expect(model.heading).toBe("teachers");
  // A manual range is clamped to the new heading's years, never collapsed.
  const manual = changeEducationPlaceSelection({ ...parsed, range: { kind: "manual", start: 2010, end: 2025 } }, "schools", "region.guria", ["education.pupils.total", "education.teachers.women"], facts);
  expect(manual.range).toEqual({ kind: "manual", start: 2016, end: 2025 });
  // A saved link refits its years to the selection's heading.
  expect(parseEducationPlaceHash("#sel=education.teachers.total&start=2005&end=2025", "schools", "region.guria", facts).range).toEqual({ kind: "all" });
});

test("a place model reads only that place's facts; Georgia's pupils keep one decimal", () => {
  const guria = buildEducationPlaceModel("schools", "region.guria", facts, { ...line, selectedIds: ["education.pupils.total"] });
  expect([guria.range.start, guria.range.end]).toEqual([2005, 2025]);
  expect(guria.selected.map(s => [s.id, s.valuesByYear[2025], s.color])).toEqual([["education.pupils.total", 13743, INK]]);
  const georgia = buildEducationPlaceModel("schools", "country.georgia", facts, { ...line, selectedIds: ["education.pupils_national.total"] });
  expect(georgia.selected[0]).toMatchObject({ decimals: 1, unit: "persons" });
  expect(georgia.selected[0].valuesByYear[2025]).toBe(644200);
  const teachers = buildEducationPlaceModel("schools", "country.georgia", facts, { ...line, selectedIds: ["education.teachers.total", "education.teachers.women"] });
  expect(teachers.selected.map(s => s.color)).toEqual([INK, expect.not.stringMatching(INK)]);
});

test("a hash round-trips on a topic page, and Universities mixes Students and Graduates with gaps, not zeros", () => {
  const mixed = { ...line, selectedIds: ["education.he_students.total", "education.he_graduates.total"] };
  expect(parseEducationHash(`#${serializeEducationHash(mixed)}`, "universities", facts)).toEqual(mixed);
  expect(parseEducationHash("", "universities", facts)).toEqual(defaultEducationState("universities"));
  expect(changeEducationSelection(defaultEducationState("universities"), "universities", mixed.selectedIds, facts)).toEqual(mixed);
  const model = buildEducationModel("universities", facts, mixed);
  expect([model.range.start, model.range.end]).toEqual([2010, 2025]);
  const [students, graduates] = model.selected;
  expect(students.valuesByYear[2010]).toBeNull();
  expect(students.valuesByYear[2025]).toBe(195426);
  expect(graduates.valuesByYear[2024]).toBe(32494);
  expect(graduates.valuesByYear[2025]).toBeNull();
  expect(students.color).toBe(INK);
  expect(graduates.color).not.toBe(INK);
  const vocational = buildEducationModel("vocational", facts, defaultEducationState("vocational"));
  expect([vocational.range.start, vocational.range.end, vocational.selected[0].valuesByYear[2025]]).toEqual([2013, 2025, 19690]);
});

test("the Schools and Kindergartens indexes rank the latest year's places, Georgia first and unranked", () => {
  const schools = buildEducationIndexModel("schools", facts, regions, municipalities);
  expect(schools.year).toBe(2025);
  expect(schools.country).toMatchObject({ id: "country.georgia", valueGel: 644200, rank: null });
  expect(schools.regions[0]).toMatchObject({ id: "region.tbilisi", rank: 1, valueGel: 232134 });
  expect(schools.regions).toHaveLength(11);
  expect(schools.municipalities).toHaveLength(64);
  expect(schools.municipalities[0]).toMatchObject({ id: "04", rank: 1, valueGel: 232134 });
  expect(schools.regions.find(row => row.id === "region.guria")!.valueGel).toBe(13743);
  // Every registry code is on the map, Tbilisi (04) as a city marker with the region's value.
  expect([schools.map.shapes.length, schools.map.markers.length]).toEqual([60, 5]);
  const kindergartens = buildEducationIndexModel("kindergartens", facts, regions, municipalities);
  expect(kindergartens.year).toBe(2025);
  expect(kindergartens.country).toMatchObject({ id: "country.georgia", valueGel: 130337 });
  expect(kindergartens.municipalities).toHaveLength(64);
});

test("a link to another place carries the selection, moved to that place's rows", () => {
  const moved = (ids: string[], set: "schools" | "kindergartens", target: string) => educationPlaceMovedSelection(ids, set, target);
  // Leaving Georgia: the national pupils become the place's pupils, the ownership split its total.
  expect(moved(["education.pupils_national.total"], "schools", "region.guria")).toEqual(["education.pupils.total"]);
  expect(moved(["education.pupils_national.public", "education.pupils_national.private"], "schools", "55")).toEqual(["education.pupils.total"]);
  expect(moved(["education.teachers.public", "education.teachers.private", "education.teachers.women"], "schools", "region.guria")).toEqual(["education.teachers.total", "education.teachers.women"]);
  expect(moved(["education.teachers.men", "education.teachers.total"], "schools", "55")).toEqual(["education.teachers.total", "education.teachers.men"]);
  // Going to Georgia: the place's pupils become the national pupils; rows Georgia also lists stay.
  expect(moved(["education.pupils.total"], "schools", "country.georgia")).toEqual(["education.pupils_national.total"]);
  expect(moved(["education.teachers.women", "education.teachers.men"], "schools", "country.georgia")).toEqual(["education.teachers.women", "education.teachers.men"]);
  // Municipality code 04 is Tbilisi, the region: Georgia's split moves to its pupils there too.
  expect(moved(["education.pupils_national.public"], "schools", "04")).toEqual(moved(["education.pupils_national.public"], "schools", "region.tbilisi"));
  expect(moved(["education.pupils_national.public"], "schools", "04")).toEqual(["education.pupils.total"]);
  // Kindergartens list the same rows at every place.
  expect(moved(["education.kg_staff.total"], "kindergartens", "55")).toEqual(["education.kg_staff.total"]);
  expect(moved(["education.kg_children.total"], "kindergartens", "country.georgia")).toEqual(["education.kg_children.total"]);
  // An empty selection stays empty, as on Business.
  expect(moved([], "schools", "region.guria")).toEqual([]);
});

test("a link to another place keeps the mode and the years, with the selection moved, and the target reads it back", () => {
  const state = { mode: "table" as const, range: { kind: "manual" as const, start: 2010, end: 2020 }, selectedIds: ["education.pupils_national.public"] };
  const hash = educationPlaceLinkHash(state, "schools", "region.guria");
  expect(hash).toBe(`#${serializeEducationHash({ ...state, selectedIds: ["education.pupils.total"] })}`);
  expect(parseEducationPlaceHash(hash, "schools", "region.guria", facts)).toEqual({ ...state, selectedIds: ["education.pupils.total"] });
  // An empty selection stays empty there; Georgia's earlier years refit to the place's own (2005/06 on).
  const empty = parseEducationPlaceHash(educationPlaceLinkHash({ ...state, selectedIds: [] }, "schools", "55"), "schools", "55", facts);
  expect(empty).toEqual({ ...state, selectedIds: [] });
  const early = parseEducationPlaceHash(educationPlaceLinkHash({ ...state, range: { kind: "manual", start: 2000, end: 2003 } }, "schools", "region.guria"), "schools", "region.guria", facts);
  expect(early.mode).toBe("table");
  expect(early.selectedIds).toEqual(["education.pupils.total"]);
});

test("a place model names a listed series missing from the facts", () => {
  const without = facts.filter(f => !(f.indicatorId === "education.schools.total" && f.geographyId === "region.guria"));
  expect(() => buildEducationPlaceModel("schools", "region.guria", without, { ...line, selectedIds: ["education.pupils.total"] }))
    .toThrow("No education.schools.total facts for region.guria");
});

test("ticking a graduates row on Universities keeps a manual range clamped, neither widened nor collapsed", () => {
  const manual = { mode: "line" as const, range: { kind: "manual" as const, start: 2011, end: 2025 }, selectedIds: ["education.he_students.total"] };
  const next = changeEducationSelection(manual, "universities", ["education.he_students.total", "education.he_graduates.women"], facts);
  expect(next).toEqual({ ...manual, selectedIds: ["education.he_students.total", "education.he_graduates.women"] });
  const model = buildEducationModel("universities", facts, next);
  expect([model.range.min, model.range.start, model.range.end]).toEqual([2010, 2011, 2025]);
});

// The catalogue keys Task 7 adds; the tests hand them over directly.
const TEST_MESSAGES = {
  "education.unitPersons": "persons", "education.unitInstitutions": "institutions", "education.unitThousandPupils": "thousand pupils", "education.unitThousand": "thousand",
  "education.status.official": "Official",
  "education.page.schools.summary": "schools", "education.page.kindergartens.summary": "kindergartens", "education.page.universities.summary": "universities", "education.page.vocational.summary": "vocational",
  "common.educationSchools": "Schools", "common.educationKindergartens": "Kindergartens", "common.educationUniversities": "Universities", "common.educationVocational": "Vocational colleges",
};
const presentation = async (): Promise<Presentation> => ({ locale: "en", englishLabels: {}, messages: { ...await getMessages("en", ["workbook", "format", "common"]), ...TEST_MESSAGES } });
const SOURCES = EDUCATION_SOURCES.map(sourceId => ({
  sourceId, years: Array.from({ length: 27 }, (_, i) => 1999 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-16",
  downloadHref: `/downloads/methodology/education/files/${sourceId}.xlsx` as const,
}));
// The page hands over a label for every series it lists and for each heading.
const HEADINGS = { he_students: "Students", he_admitted: "Admitted", he_graduates: "Graduates", vet_admitted: "Admitted", vet_graduates: "Graduates", pupils: "Pupils", teachers: "Teachers", schools: "Schools", kg_children: "Children", kg_staff: "Staff", kindergartens: "Kindergartens" };
const labelsFor = (ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, id]));
const topicWorkbook = async (section: "universities" | "vocational", selectedIds: string[], start: number, end: number) =>
  buildEducationWorkbookExportModel({
    section, facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(selectedIds), headingLabels: HEADINGS, title: "Title",
    state: { mode: "table", range: { kind: "manual", start, end }, selectedIds },
  }, await presentation());
const placeWorkbook = async (set: "schools" | "kindergartens", placeId: string, scope: string, selectedIds: string[], start: number, end: number) =>
  buildEducationWorkbookExportModel({
    set, placeId, scope, facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(selectedIds), headingLabels: HEADINGS, title: "Title",
    state: { mode: "table", range: { kind: "manual", start, end }, selectedIds },
  }, await presentation());

test("a Universities workbook spans 2010/11-2025/26 with school-year headers and blank cells where a series has no value", async () => {
  const ids = ["education.he_students.total", "education.he_graduates.total"];
  const model = await topicWorkbook("universities", ids, 2010, 2025);
  expect(model.filename).toBe("fiscal-education-universities-2010-11-2025-26-en.xlsx");
  expect(model.readable.unitLabel).toBe("persons");
  expect(model.readable.numberFormat).toBe("#,##0");
  expect(model.readable.years).toHaveLength(16);
  expect(model.readable.headerLabels!.columns[0]).toBe("2010/11");
  expect(model.readable.headerLabels!.columns.at(-1)).toBe("2025/26");
  expect(model.readable.subtitle).toBe("2010/11–2025/26 · persons");
  expect(model.readable.rows.map(row => [row.parentLabel, row.label, row.kind])).toEqual([["Students", ids[0], "total"], ["Graduates", ids[1], "item"]]);
  const [students, graduates] = model.readable.rows;
  expect(students.valuesByYear[2010]).toBeNull();
  expect(students.basisByYear[2010]).toBeNull();
  expect(students.valuesByYear[2025]).toBe(195426);
  expect(graduates.valuesByYear[2024]).toBe(32494);
  expect(graduates.valuesByYear[2025]).toBeNull();
  const analysis = (period: string, label: string) => model.analysis.rows.find(r => r[0] === period && r[1] === label)!;
  expect(model.analysis.rows).toHaveLength(32);
  expect(analysis("2010/11", `Students — ${ids[0]}`).slice(2)).toEqual([null, "Not available"]);
  expect(analysis("2025/26", `Students — ${ids[0]}`)).toEqual(["2025/26", `Students — ${ids[0]}`, 195426, "Official"]);
  expect(analysis("2025/26", `Graduates — ${ids[1]}`).slice(2)).toEqual([null, "Not available"]);
  expect(model.analysis.headers).not.toContain("source_cell");
  expect(model.analysis.numericFormats).toEqual({ 3: "#,##0" });
  expect(model.sources.map(s => s.title)).toEqual(["geostat_education_higher"]);
  expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/education/files/geostat_education_higher.xlsx");
  expect(model.periodLabel!(2010)).toBe("2010/11");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
  const sheet = excel.worksheets[0];
  const headerRow = [...Array(sheet.rowCount).keys()].map(i => sheet.getRow(i + 1)).find(r => r.getCell(2).value === "2010/11")!;
  expect(headerRow.getCell(3).value).toBe("2011/12");
  const row = [...Array(sheet.rowCount).keys()].map(i => sheet.getRow(i + 1)).find(r => String(r.getCell(1).value).includes(ids[0]))!;
  expect(row.getCell(2).value).toBeNull();
  expect(row.getCell(17).value).toBe(195426);
  expect(excel.worksheets[2].getCell(2, 1).value).toBe("2010/11–2025/26 · Official original sources");
  // The source covers the school years the exported values come from (students from 2011/12, graduates from 2010/11).
  expect(excel.worksheets[2].getCell(4, 1).value).toBe("2010/11–2025/26");
});

test("a Vocational workbook keeps calendar-year headers", async () => {
  const model = await topicWorkbook("vocational", ["education.vet_admitted.total", "education.vet_graduates.women"], 2013, 2025);
  expect(model.filename).toBe("fiscal-education-vocational-2013-2025-en.xlsx");
  expect(model.readable.headerLabels!.columns.slice(0, 2)).toEqual(["2013", "2014"]);
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(19690);
  expect(model.analysis.rows[0][0]).toBe("2013");
  expect(model.sources.map(s => s.title)).toEqual(["geostat_education_vocational"]);
});

test("a Guria Schools pupils workbook is whole persons and cites table 11 alone", async () => {
  const model = await placeWorkbook("schools", "region.guria", "guria", ["education.pupils.total"], 2005, 2025);
  expect(model.filename).toBe("fiscal-education-schools-guria-2005-06-2025-26-en.xlsx");
  expect(model.readable.unitLabel).toBe("persons");
  expect(model.readable.numberFormat).toBe("#,##0");
  expect(model.analysis.numericFormats).toEqual({ 3: "#,##0" });
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(13743);
  expect(model.readable.rows[0].kind).toBe("total");
  expect(model.sources.map(s => s.title)).toEqual(["geostat_education_municipal"]);
  // A count of schools is institutions, still whole numbers.
  const schools = await placeWorkbook("schools", "region.guria", "guria", ["education.schools.total"], 2005, 2025);
  expect(schools.readable.unitLabel).toBe("institutions");
  expect(schools.readable.numberFormat).toBe("#,##0");
});

test("a Georgia pupils workbook is in thousands to one decimal, with every cell Geostat's published value and no drift", async () => {
  const id = "education.pupils_national.total";
  const model = await placeWorkbook("schools", "country.georgia", "georgia", [id], 2000, 2025);
  expect(model.filename).toBe("fiscal-education-schools-georgia-2000-01-2025-26-en.xlsx");
  expect(model.readable.unitLabel).toBe("thousand pupils");
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.analysis.numericFormats).toEqual({ 3: "#,##0.0" });
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(644.2);
  // Every cell, in both sheets, is the published one-decimal value Geostat prints.
  const published = served.filter(f => f.indicatorId === id && f.geographyId === "country.georgia");
  expect(published).toHaveLength(26);
  for (const fact of published) {
    expect(model.readable.rows[0].valuesByYear[fact.year]).toBe(Number(fact.publishedValue));
    expect(model.analysis.rows.find(r => r[0] === `${fact.year}/${String((fact.year + 1) % 100).padStart(2, "0")}`)![2]).toBe(Number(fact.publishedValue));
  }
  expect(model.sources.map(s => s.title)).toEqual(["geostat_education_schools_national"]);
  // The other Georgia rows are not in thousands: teachers stay whole persons.
  const teachers = await placeWorkbook("schools", "country.georgia", "georgia", ["education.teachers.total"], 2016, 2025);
  expect(teachers.readable.numberFormat).toBe("#,##0");
  expect(teachers.sources.map(s => s.title)).toEqual(["geostat_education_teachers_national"]);
  const none = await placeWorkbook("schools", "region.guria", "guria", [], 2005, 2025);
  expect(none.readable.rows).toEqual([]); expect(none.analysis.rows).toEqual([]); expect(none.sources).toEqual([]);
});

test("a Guria Schools teachers workbook names the total alone and the parts under their heading, in both sheets", async () => {
  const ids = ["education.teachers.total", "education.teachers.women", "education.teachers.men"];
  const model = buildEducationWorkbookExportModel({
    set: "schools", placeId: "region.guria", scope: "guria", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", title: "Title",
    labels: { "education.teachers.total": "Teachers", "education.teachers.women": "Women", "education.teachers.men": "Men" }, headingLabels: HEADINGS,
    state: { mode: "table", range: { kind: "manual", start: 2016, end: 2025 }, selectedIds: ids },
  }, await presentation());
  expect(model.readable.rows.map(row => [row.parentLabel, row.label])).toEqual([[null, "Teachers"], ["Teachers", "Women"], ["Teachers", "Men"]]);
  expect(new Set(model.analysis.rows.map(row => row[1]))).toEqual(new Set(["Teachers", "Teachers — Women", "Teachers — Men"]));
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  for (const sheet of excel.worksheets) sheet.eachRow(row => row.eachCell(cell => expect(String(cell.value)).not.toContain("Teachers — Teachers")));
});

test("the hub has four cards: Georgia's headline series with their latest school-year values and years", async () => {
  const cards = buildEducationHubCards(facts, await presentation());
  expect(cards.map(card => card.href)).toEqual(EDUCATION_SECTIONS.map(section => section.href));
  expect(cards.map(card => card.title)).toEqual(["Schools", "Kindergartens", "Universities", "Vocational colleges"]);
  expect(cards.map(card => card.footer)).toEqual([
    "2025/26 · 644.2 thousand · 2000/01–2025/26", "2025/26 · 130,337 · 2017/18–2025/26", "2025/26 · 195,426 · 2011/12–2025/26", "2025 · 19,690 · 2013–2025",
  ]);
  expect(cards.map(card => card.series?.length)).toEqual([26, 9, 15, 13]);
  expect(cards[0].series!.at(-1)).toBe(644200);
  expect(cards.map(card => card.index)).toEqual(["01", "02", "03", "04"]);
  expect(cards.every(card => card.seriesColor === INK && !card.comingSoon)).toBe(true);
});
