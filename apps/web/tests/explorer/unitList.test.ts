import { expect, test } from "vitest";
import { changeUnitListSelection, keepOneUnit, listLatest, listLatestByHeading, parseUnitListHash, unitListCoverage } from "../../lib/explorer/unitList";
import type { TopicState } from "../../lib/explorer/topicSeries";

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
