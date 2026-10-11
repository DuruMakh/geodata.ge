import { beforeAll, expect, test } from "vitest";
import { loadServedHouseholdData, toClientHouseholdFact } from "../../lib/data/household/importHousehold";
import { HOUSEHOLD_AREAS, type ClientHouseholdFact } from "../../lib/data/household/types";
import {
  buildHouseholdModel, changeHouseholdArea, changeHouseholdMeasure, changeHouseholdView, defaultHouseholdState, HOUSEHOLD_SECTIONS,
  householdCoverage, householdViewSeries, parseHouseholdHash, serializeHouseholdHash, type HouseholdState,
} from "../../lib/explorer/household";
import { LIVING_STANDARDS_HUB_PATH, LIVING_STANDARDS_SECTIONS } from "../../lib/explorer/livingStandards";
import { resolveRange } from "../../lib/explorer/periodRange";

let facts: ClientHouseholdFact[];
beforeAll(async () => { facts = (await loadServedHouseholdData()).facts.map(toClientHouseholdFact); });

test("the hub lists the four living-standards pages", () => {
  expect(LIVING_STANDARDS_HUB_PATH).toBe("/explorer/living-standards");
  expect(HOUSEHOLD_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["income", "/explorer/living-standards/income", "common.householdIncome"],
    ["spending", "/explorer/living-standards/spending", "common.householdSpending"],
  ]);
  expect(LIVING_STANDARDS_SECTIONS.map(s => s.href)).toEqual([
    "/explorer/living-standards/income", "/explorer/living-standards/spending", "/explorer/living-standards/poverty", "/explorer/living-standards/inequality",
  ]);
});

test("each page starts on parts for Georgia per household with only its total, and coverage comes from the facts", () => {
  expect(defaultHouseholdState("income")).toEqual({ mode: "line", range: { kind: "all" }, view: "parts", area: "georgia", measure: "per_household", selectedIds: ["income.total"] });
  expect(defaultHouseholdState("spending").selectedIds).toEqual(["spending.consumption"]);
  expect(householdCoverage("income", "parts", "georgia", "per_household", facts)).toMatchObject({ min: 2002, max: 2025 });
  expect(householdCoverage("income", "areas", "georgia", "per_household", facts)).toMatchObject({ min: 2002, max: 2025 });
  expect(householdCoverage("income", "parts", "region.tbilisi", "per_household", facts)).toMatchObject({ min: 2011, max: 2025 });
});

test("parts nest under their total in spec order, and areas are flat with Georgia first", () => {
  const income = householdViewSeries("income", "parts", "settlement.rural");
  expect(income.map(s => [s.id, s.reference, s.parentId])).toEqual([
    ["income.total", true, undefined],
    ...["wages", "self_employment", "agriculture_sales", "property", "pensions_assistance", "remittances", "gifts", "non_cash"].map(k => [`income.${k}`, false, "income.total"]),
    ["income.other_inflows", false, undefined],
    ["income.borrowing_dissaving", false, "income.other_inflows"],
    ["income.property_disposal", false, "income.other_inflows"],
  ]);
  expect(income.every(s => s.areaId === "settlement.rural")).toBe(true);
  expect(income.filter(s => s.parentId === "income.total")).toHaveLength(8);
  const spending = householdViewSeries("spending", "parts", "georgia");
  expect(spending.map(s => [s.id, s.reference, s.parentId])).toEqual([
    ["spending.consumption", true, undefined],
    ...["food", "clothing", "household_goods", "health", "housing_utilities", "transport", "education", "other_consumption", "non_cash"].map(k => [`spending.${k}`, false, "spending.consumption"]),
    ["spending.non_consumption", false, undefined],
    ...["saving_lending", "agriculture", "transfers", "property"].map(k => [`spending.${k}`, false, "spending.non_consumption"]),
  ]);
  const areas = householdViewSeries("income", "areas", "region.guria");
  expect(areas.map(s => s.id)).toEqual([...HOUSEHOLD_AREAS]);
  expect(areas).toHaveLength(14);
  expect(areas.map(s => s.reference)).toEqual(areas.map((_, i) => i === 0));
  expect(areas.every(s => s.indicatorId === "income.total" && s.parentId === undefined)).toBe(true);
});

test("choosing a region that starts later narrows a chosen range, and choosing Georgia again keeps those years", () => {
  const start: HouseholdState = { ...defaultHouseholdState("income"), range: { kind: "manual", start: 2011, end: 2016 } };
  const guria = changeHouseholdArea(start, "income", "region.guria", facts);
  expect(guria.area).toBe("region.guria");
  expect(resolveRange(guria.range, householdCoverage("income", "parts", "region.guria", "per_household", facts))).toMatchObject({ start: 2019, end: 2025 });
  const back = changeHouseholdArea(guria, "income", "georgia", facts);
  expect(back.range).toEqual({ kind: "manual", start: 2019, end: 2025 });
  expect(resolveRange(back.range, householdCoverage("income", "parts", "georgia", "per_household", facts))).toMatchObject({ start: 2019, end: 2025 });
  // "All" stays "all", so a later data year still widens the view.
  expect(changeHouseholdArea(defaultHouseholdState("income"), "income", "region.guria", facts).range).toEqual({ kind: "all" });
});

test("changing area or measure keeps the selection, and changing the tab selects the new reference", () => {
  const state: HouseholdState = { ...defaultHouseholdState("income"), selectedIds: ["income.total", "income.wages"] };
  expect(changeHouseholdArea(state, "income", "region.adjara", facts)).toMatchObject({ area: "region.adjara", selectedIds: ["income.total", "income.wages"] });
  expect(changeHouseholdMeasure(state, "income", "per_capita", facts)).toMatchObject({ measure: "per_capita", selectedIds: ["income.total", "income.wages"] });
  expect(changeHouseholdView(state, "income", "areas", facts)).toMatchObject({ view: "areas", selectedIds: ["georgia"] });
  expect(changeHouseholdView({ ...state, view: "areas", selectedIds: ["georgia"] }, "income", "parts", facts).selectedIds).toEqual(["income.total"]);
});

test("the hash round-trips, writes the area only on parts and keeps an explicit empty selection", () => {
  const state: HouseholdState = { mode: "table", view: "parts", area: "region.adjara", measure: "per_capita", range: { kind: "manual", start: 2014, end: 2020 }, selectedIds: ["income.total", "income.remittances"] };
  const hash = serializeHouseholdHash(state);
  expect(hash).toContain("area=region.adjara");
  expect(hash).toContain("per=person");
  expect(parseHouseholdHash(`#${hash}`, "income", facts)).toEqual(state);
  expect(serializeHouseholdHash(defaultHouseholdState("income"))).not.toContain("area=");
  expect(serializeHouseholdHash(defaultHouseholdState("income"))).toContain("per=household");
  expect(serializeHouseholdHash({ ...state, view: "areas", selectedIds: ["georgia", "region.adjara"] })).not.toContain("area=");
  expect(parseHouseholdHash("#tab=parts&sel=", "income", facts).selectedIds).toEqual([]);
  expect(parseHouseholdHash("#area=region.mars", "income", facts)).toMatchObject({ area: "georgia", view: "parts", measure: "per_household", selectedIds: ["income.total"] });
  expect(parseHouseholdHash("#tab=unknown&per=nonsense", "income", facts)).toMatchObject({ view: "parts", measure: "per_household" });
  expect(parseHouseholdHash("#tab=areas&area=region.adjara&sel=georgia,region.adjara,income.wages", "income", facts)).toMatchObject({ view: "areas", area: "georgia", selectedIds: ["georgia", "region.adjara"] });
  const areas = serializeHouseholdHash(defaultHouseholdState("spending"));
  expect(parseHouseholdHash(`#${areas}`, "spending", facts)).toEqual(defaultHouseholdState("spending"));
});

test("the model carries published values for the chosen measure", () => {
  const perHousehold = buildHouseholdModel("income", facts, defaultHouseholdState("income"));
  expect(perHousehold.selected[0].endValue).toBe(2025.8);
  expect(perHousehold.years).toEqual(Array.from({ length: 24 }, (_, i) => 2002 + i));
  const perPerson = buildHouseholdModel("income", facts, { ...defaultHouseholdState("income"), measure: "per_capita" });
  expect(perPerson.selected[0].endValue).toBe(630.7);
  expect(buildHouseholdModel("spending", facts, defaultHouseholdState("spending")).selected[0].endValue).toBe(1438.7);
  expect(perHousehold.series.filter(s => s.parentId === "income.total")).toHaveLength(8);
  expect(perHousehold.series[0].color).not.toBe(perHousehold.series[1].color);
});

test("a region's missing early years are null in the areas model", () => {
  const model = buildHouseholdModel("income", facts, { ...defaultHouseholdState("income"), view: "areas", selectedIds: ["georgia", "region.guria"] });
  const guria = model.series.find(s => s.id === "region.guria")!;
  expect(guria.valuesByYear[2018]).toBeNull();
  expect(guria.valuesByYear[2019]).not.toBeNull();
  expect(model.selected.map(s => s.id)).toEqual(["georgia", "region.guria"]);
});
