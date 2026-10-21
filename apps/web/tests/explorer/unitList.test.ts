import { expect, test } from "vitest";
import { buildUnitListModel, changeUnitListSelection, keepOneUnit, listLatest, listLatestByHeading, parseUnitListHash, unitListCoverage } from "../../lib/explorer/unitList";
import { topicCoverage, type TopicState } from "../../lib/explorer/topicSeries";

// Two measures in one unit (persons), plus one count of another unit.
const rows: [string, string, number[]][] = [
  ["pupils.total", "persons", [2010, 2011, 2012]],
  ["pupils.girls", "persons", [2010, 2011, 2012]],
  ["teachers.total", "persons", [2016, 2017]],
  ["teachers.women", "persons", [2016, 2017]],
  ["schools.total", "count", [2010, 2011]],
];
const facts = rows.flatMap(([indicatorId, unit, years]) => years.map(year => ({ indicatorId, year, unit })));
const definitions = rows.map(([id]) => ({ id }));
const heading = (id: string) => id.split(".")[0];

test("without groupOf, the unit is the group (Business's rule)", () => {
  expect(keepOneUnit(["pupils.total", "teachers.women"], ["pupils.total"], facts)).toEqual(["pupils.total", "teachers.women"]);
  expect(keepOneUnit(["pupils.total", "schools.total"], ["pupils.total"], facts)).toEqual(["schools.total"]);
  expect(keepOneUnit(["pupils.total"], ["pupils.total", "pupils.girls"], facts)).toEqual(["pupils.total"]);
  expect(keepOneUnit([], ["pupils.total"], facts)).toEqual([]);
  expect(keepOneUnit(["pupils.total", "schools.total"], [], facts)).toEqual(["pupils.total"]);
});

test("with groupOf, rows of one unit but another group still replace the selection", () => {
  expect(keepOneUnit(["pupils.total", "teachers.women"], ["pupils.total"], facts, heading)).toEqual(["teachers.women"]);
  expect(keepOneUnit(["pupils.total", "pupils.girls"], ["pupils.total"], facts, heading)).toEqual(["pupils.total", "pupils.girls"]);
  expect(keepOneUnit(["pupils.total", "teachers.total", "schools.total"], [], facts, heading)).toEqual(["pupils.total"]);
});

test("coverage fits the selection's group; an empty selection covers every series", () => {
  const span = (c: { min: number; max: number }) => [c.min, c.max];
  expect(span(unitListCoverage(definitions, [], facts, "none"))).toEqual([2010, 2017]);
  expect(span(unitListCoverage(definitions, ["pupils.total"], facts, "none"))).toEqual([2010, 2017]);
  expect(span(unitListCoverage(definitions, ["pupils.total"], facts, "none", heading))).toEqual([2010, 2012]);
  expect(span(unitListCoverage(definitions, ["teachers.women"], facts, "none", heading))).toEqual([2016, 2017]);
});

test("a saved link that mixes groups keeps the first row's group and refits the years", () => {
  const hash = "#sel=pupils.total,teachers.women&start=2011&end=2017";
  expect(parseUnitListHash(hash, definitions, ["pupils.total"], facts).selectedIds).toEqual(["pupils.total", "teachers.women"]);
  const state = parseUnitListHash(hash, definitions, ["pupils.total"], facts, "none", heading);
  expect(state.selectedIds).toEqual(["pupils.total"]);
  expect(state.range).toEqual({ kind: "manual", start: 2011, end: 2012 });
});

test("changing the selection keeps one group and clamps, never collapsing, the range", () => {
  const state: TopicState = { mode: "line", range: { kind: "manual", start: 2010, end: 2012 }, selectedIds: ["pupils.total"] };
  const next = changeUnitListSelection(state, definitions, ["pupils.total", "teachers.women"], facts, "none", heading);
  expect(next.selectedIds).toEqual(["teachers.women"]);
  expect(next.range).toEqual({ kind: "all" });
});

test("a list row shows its latest value up to the list's last year, and a heading whose rows stop earlier names their year", () => {
  // Students reach 2025; graduates stop at 2024, the women's row a year earlier still.
  const valued = [
    ...[2023, 2024, 2025].map(year => ({ indicatorId: "students.total", year, value: year })),
    ...[2023, 2024].map(year => ({ indicatorId: "graduates.total", year, value: year })),
    { indicatorId: "graduates.women", year: 2023, value: 1 },
  ];
  expect(listLatest(valued, "graduates.total", 2025)).toEqual({ value: 2024, year: 2024 });
  expect(listLatest(valued, "students.total", 2023)).toEqual({ value: 2023, year: 2023 });
  expect(listLatest(valued, "students.total", 2022)).toBeUndefined();
  const series = [{ id: "students.total", heading: "students" }, { id: "graduates.total", heading: "graduates" }, { id: "graduates.women", heading: "graduates" }, { id: "schools.total", heading: "schools" }];
  expect(listLatestByHeading(valued, series, 2025)).toEqual({
    "students.total": { latest: { value: 2025, year: 2025 }, headingYear: undefined },
    "graduates.total": { latest: { value: 2024, year: 2024 }, headingYear: 2024 },
    "graduates.women": { latest: { value: 1, year: 2023 }, headingYear: 2024 },
    // A heading with no value at all names no year.
    "schools.total": { latest: undefined, headingYear: undefined },
  });
  expect(listLatestByHeading(valued, series, 2024)["graduates.total"]).toEqual({ latest: { value: 2024, year: 2024 }, headingYear: undefined });
});

test("a list's model leaves a missing year a gap, takes the selection's unit and merges each series' extra fields", () => {
  const modelFacts = [
    { indicatorId: "pupils.total", year: 2010, unit: "persons", value: 5, decimals: 0 },
    { indicatorId: "pupils.total", year: 2012, unit: "persons", value: 7, decimals: 0 },
    { indicatorId: "schools.total", year: 2010, unit: "count", value: 3, decimals: 1 },
    { indicatorId: "schools.total", year: 2011, unit: "count", value: 4, decimals: 1 },
  ];
  const modelDefinitions = [{ id: "pupils.total", reference: false }, { id: "schools.total", reference: false }];
  const build = (selectedIds: string[]) => buildUnitListModel({
    definitions: modelDefinitions, facts: modelFacts, state: { mode: "line", range: { kind: "all" }, selectedIds },
    coverage: topicCoverage([2010, 2011, 2012], "none"), color: (_, index) => `c${index}`, extra: definition => ({ stroke: `s:${definition.id}` }),
  });

  const model = build(["schools.total"]);
  expect(model.years).toEqual([2010, 2011, 2012]);
  // 2011 has no pupils fact and 2012 no schools fact: both are null, not 0.
  expect(model.series[0].valuesByYear).toEqual({ 2010: 5, 2011: null, 2012: 7 });
  expect(model.series[1].valuesByYear).toEqual({ 2010: 3, 2011: 4, 2012: null });
  expect(model.series[1].endValue).toBeNull();
  // The model's unit is the selection's, and each series keeps its own unit and decimals.
  expect(model.unit).toBe("count");
  expect(model.series.map(s => [s.unit, s.decimals])).toEqual([["persons", 0], ["count", 1]]);
  expect(model.selected.map(s => s.id)).toEqual(["schools.total"]);
  // `extra` is merged into every series next to the definition and the colour.
  expect(model.series.map(s => [s.stroke, s.color])).toEqual([["s:pupils.total", "c0"], ["s:schools.total", "c1"]]);
  // With nothing selected the unit is the list's first series'.
  expect(build([]).unit).toBe("persons");
});
