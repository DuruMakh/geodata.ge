import { beforeAll, expect, test } from "vitest";
import { loadPovertyFacts, toClientPovertyFact } from "../../lib/data/poverty/importPoverty";
import type { ClientPovertyFact } from "../../lib/data/poverty/types";
import { buildPovertyModel, changePovertyView, defaultPovertyState, parsePovertyHash, povertyCoverage, povertyViewSeries, serializePovertyHash } from "../../lib/explorer/poverty";

let facts: ClientPovertyFact[];
beforeAll(async () => { facts = (await loadPovertyFacts()).map(toClientPovertyFact); });

test("each page starts with only its reference selected and coverage taken from the facts", () => {
  expect(defaultPovertyState("rates")).toEqual({ mode: "line", range: { kind: "all" }, view: "absolute", selectedIds: ["poverty.absolute|georgia"] });
  expect(defaultPovertyState("inequality")).toEqual({ mode: "line", range: { kind: "all" }, view: "main", selectedIds: ["gini.total_income|georgia"] });
  expect(povertyCoverage("rates", "absolute", facts)).toMatchObject({ min: 2004, max: 2025 });
  expect(povertyCoverage("rates", "relative", facts)).toMatchObject({ min: 2004, max: 2025 });
  expect(povertyCoverage("rates", "international", facts)).toMatchObject({ min: 2004, max: 2024 });
  expect(povertyCoverage("inequality", "main", facts)).toMatchObject({ min: 2006, max: 2025 });
});

test("absolute and relative groups nest under their Georgia line", () => {
  const absolute = povertyViewSeries("rates", "absolute");
  expect(absolute.map(s => s.groupId)).toEqual(["georgia", "settlement.urban", "settlement.rural", "age.0_17", "age.18_64", "age.65_plus", "sex.female", "sex.male"]);
  expect(absolute.slice(1).every(s => s.parentId === "poverty.absolute|georgia" && !s.reference)).toBe(true);
  const relative = povertyViewSeries("rates", "relative");
  expect(relative.map(s => [s.id, s.reference, s.parentId])).toEqual([
    ["poverty.relative_60|georgia", true, undefined],
    ["poverty.relative_60|settlement.urban", false, "poverty.relative_60|georgia"],
    ["poverty.relative_60|settlement.rural", false, "poverty.relative_60|georgia"],
    ["poverty.relative_40|georgia", false, undefined],
    ["poverty.relative_40|settlement.urban", false, "poverty.relative_40|georgia"],
    ["poverty.relative_40|settlement.rural", false, "poverty.relative_40|georgia"],
  ]);
  expect(povertyViewSeries("rates", "international").map(s => s.indicatorId)).toEqual(["poverty.international_300", "poverty.international_420", "poverty.international_830"]);
  expect(povertyViewSeries("inequality", "main").map(s => s.indicatorId)).toEqual(["gini.total_income", "gini.cash_inflows", "gini.total_inflows", "gini.consumption_expenditure", "gini.cash_expenditure", "gini.total_expenditure"]);
});

test("switching to international clamps a range ending 2025 to 2024, and switching back keeps it", () => {
  const start = { ...defaultPovertyState("rates"), range: { kind: "manual" as const, start: 2010, end: 2025 } };
  const international = changePovertyView(start, "rates", "international", facts);
  expect(international).toMatchObject({ view: "international", range: { kind: "manual", start: 2010, end: 2024 }, selectedIds: ["poverty.international_300|georgia"] });
  const back = changePovertyView(international, "rates", "absolute", facts);
  expect(back).toMatchObject({ view: "absolute", range: { kind: "manual", start: 2010, end: 2024 }, selectedIds: ["poverty.absolute|georgia"] });
});

test("the hash round-trips, drops another tab's series and keeps an explicit empty selection", () => {
  const state = { mode: "table" as const, view: "relative" as const, range: { kind: "manual" as const, start: 2012, end: 2020 }, selectedIds: ["poverty.relative_60|georgia", "poverty.relative_40|settlement.rural"] };
  const hash = serializePovertyHash(state, "rates");
  expect(parsePovertyHash(`#${hash}`, "rates", facts)).toEqual(state);
  expect(parsePovertyHash("#tab=absolute&sel=", "rates", facts).selectedIds).toEqual([]);
  expect(parsePovertyHash("#tab=international&sel=poverty.relative_60|settlement.rural", "rates", facts).selectedIds).toEqual([]);
  expect(parsePovertyHash("#tab=unknown", "rates", facts)).toMatchObject({ view: "absolute", selectedIds: ["poverty.absolute|georgia"] });
  const inequality = serializePovertyHash(defaultPovertyState("inequality"), "inequality");
  expect(inequality).not.toContain("tab=");
  expect(parsePovertyHash(`#${inequality}`, "inequality", facts)).toEqual(defaultPovertyState("inequality"));
});

test("the model carries published values and the view's precision", () => {
  const rates = buildPovertyModel("rates", facts, defaultPovertyState("rates"));
  expect(rates.selected[0].endValue).toBe(7.1);
  expect(rates.decimals).toBe(1);
  expect(rates.years).toEqual(Array.from({ length: 22 }, (_, i) => 2004 + i));
  const inequality = buildPovertyModel("inequality", facts, defaultPovertyState("inequality"));
  expect(inequality.selected[0].endValue).toBe(0.34);
  expect(inequality.decimals).toBe(2);
});
