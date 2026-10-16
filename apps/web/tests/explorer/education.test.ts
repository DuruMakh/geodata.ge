import { beforeAll, expect, test } from "vitest";
import { loadEducationFacts, shownEducationFacts, toClientEducationFact } from "../../lib/data/education/importEducation";
import { EDUCATION_HE_GROUPS, EDUCATION_VET_FIELDS, type ClientEducationFact } from "../../lib/data/education/types";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { INK } from "../../lib/explorer/colors";
import {
  EDUCATION_HUB_PATH, EDUCATION_SECTIONS, buildEducationModel, changeEducationSelection, defaultEducationState, educationCoverage, educationDefaultSelection,
  educationPeriodLabel, educationSeriesColor, educationTopicSeries, parseEducationHash, schoolYearLabel, serializeEducationHash,
} from "../../lib/explorer/education";
import {
  buildEducationIndexModel, buildEducationPlaceModel, changeEducationPlaceSelection, educationPlaceBase, educationPlaceCoverage, educationPlaceDefaultSelection,
  educationPlaceSelectionHash, educationPlaceSeries, parseEducationPlaceHash,
} from "../../lib/explorer/educationPlaces";

let facts: ClientEducationFact[];
let regions: MunicipalRegion[];
let municipalities: Municipality[];
beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadEducationFacts(), loadServedMunicipalData()]);
  facts = shownEducationFacts(served).map(toClientEducationFact);
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
  const sel = (ids: string[]) => `#${new URLSearchParams({ sel: ids.join(",") })}`;
  // Leaving Georgia: the national pupils become the place's pupils, the ownership split its total.
  expect(educationPlaceSelectionHash(["education.pupils_national.total"], "schools", "region.guria")).toBe("");
  expect(educationPlaceSelectionHash(["education.pupils_national.public", "education.pupils_national.private"], "schools", "55")).toBe("");
  expect(educationPlaceSelectionHash(["education.teachers.public", "education.teachers.private", "education.teachers.women"], "schools", "region.guria"))
    .toBe(sel(["education.teachers.total", "education.teachers.women"]));
  expect(educationPlaceSelectionHash(["education.teachers.men", "education.teachers.total"], "schools", "55")).toBe(sel(["education.teachers.total", "education.teachers.men"]));
  // Going to Georgia: the place's pupils become the national pupils; rows Georgia also lists stay.
  expect(educationPlaceSelectionHash(["education.pupils.total"], "schools", "country.georgia")).toBe("");
  expect(educationPlaceSelectionHash(["education.teachers.women", "education.teachers.men"], "schools", "country.georgia")).toBe(sel(["education.teachers.women", "education.teachers.men"]));
  // Kindergartens list the same rows at every place.
  expect(educationPlaceSelectionHash(["education.kg_staff.total"], "kindergartens", "55")).toBe(sel(["education.kg_staff.total"]));
  expect(educationPlaceSelectionHash(["education.kg_children.total"], "kindergartens", "country.georgia")).toBe("");
  // An empty selection stays empty, as on Business.
  expect(educationPlaceSelectionHash([], "schools", "region.guria")).toBe("#sel=");
  for (const [hash, place] of [[sel(["education.teachers.total", "education.teachers.women"]), "region.guria"], ["#sel=", "55"]] as const) {
    expect(parseEducationPlaceHash(hash, "schools", place, facts).selectedIds).toEqual(hash === "#sel=" ? [] : ["education.teachers.total", "education.teachers.women"]);
  }
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
