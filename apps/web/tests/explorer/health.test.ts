import { beforeAll, describe, expect, test } from "vitest";
import { loadServedHealthData, toClientHealthFact } from "../../lib/data/health/importHealth";
import { HEALTH_AREAS, HEALTH_INDICATORS, type ClientHealthFact, type HealthSeriesBreak } from "../../lib/data/health/types";
import { INK } from "../../lib/explorer/colors";
import {
  HEALTH_HUB_PATH, HEALTH_SECTIONS, buildHealthModel, changeHealthView, defaultHealthState, healthCoverage, healthDefaultSelection, healthDisplay, healthSeriesColor,
  healthViewSeries, healthViews, parseHealthHash, serializeHealthHash, type HealthState,
} from "../../lib/explorer/health";
import {
  HEALTH_DEATH_AREAS, buildHealthDeathRateMapModel, buildHealthDeathsModel, defaultHealthDeathsState, healthDeathsAreaForSlug, healthDeathsAreaHref, healthDeathsSeries,
  parseHealthDeathsHash, serializeHealthDeathsHash,
} from "../../lib/explorer/healthDeaths";

let facts: ClientHealthFact[];
let breaks: HealthSeriesBreak[];
beforeAll(async () => {
  const served = await loadServedHealthData();
  facts = served.facts.map(toClientHealthFact);
  breaks = served.breaks;
});

const withIds = (section: Parameters<typeof defaultHealthState>[0], view: HealthState["view"], selectedIds: string[], range: HealthState["range"] = { kind: "all" }): HealthState =>
  ({ mode: "line", range, view, selectedIds });
const sorted = (ids: readonly string[]) => [...ids].sort();

describe("sections and views", () => {
  test("the three sections", () => {
    expect(HEALTH_HUB_PATH).toBe("/explorer/health");
    expect(HEALTH_SECTIONS).toEqual([
      { id: "doctors-hospitals", href: "/explorer/health/doctors-hospitals", labelKey: "common.healthDoctorsHospitals" },
      { id: "illnesses", href: "/explorer/health/illnesses", labelKey: "common.healthIllnesses" },
      { id: "causes-of-death", href: "/explorer/health/causes-of-death", labelKey: "common.healthCausesOfDeath" },
    ]);
    expect(healthViews("doctors-hospitals")).toEqual(["staff", "hospitals", "beds", "visits"]);
    expect(healthViews("illnesses")).toEqual(["main"]);
  });

  test("staff nests 14 specialities under doctors and 6 groups under nurses", () => {
    const staff = healthViewSeries("doctors-hospitals", "staff");
    const parents = staff.filter(s => !s.parentId);
    expect(parents.map(s => [s.id, s.reference])).toEqual([["health.staff.doctors", true], ["health.staff.nurses", false]]);
    expect(staff.filter(s => s.parentId === "health.staff.doctors")).toHaveLength(14);
    expect(staff.filter(s => s.parentId === "health.staff.nurses")).toHaveLength(6);
    expect(staff[0].id).toBe("health.staff.doctors");
    expect(staff[15].id).toBe("health.staff.nurses");
    expect(healthViewSeries("doctors-hospitals", "hospitals").map(s => s.id)).toEqual(["health.facilities.hospitals", "health.facilities.outpatient_clinics"]);
    expect(healthViewSeries("doctors-hospitals", "beds").map(s => s.id)).toEqual(["health.facilities.beds"]);
    expect(healthViewSeries("doctors-hospitals", "visits").map(s => s.id)).toEqual(["health.visits.outpatient"]);
  });

  test("illnesses list 19 groups, then 6 single diseases, all top level", () => {
    const series = healthViewSeries("illnesses", "main");
    expect(series.filter(s => s.heading === "groups")).toHaveLength(19);
    expect(series.filter(s => s.heading === "single")).toHaveLength(6);
    expect(series.map(s => s.heading)).toEqual([...Array(19).fill("groups"), ...Array(6).fill("single")]);
    expect(series.every(s => !s.parentId && !s.reference)).toBe(true);
    expect(series.map(s => s.id)).toEqual(HEALTH_INDICATORS.filter(id => id.startsWith("health.illness.")));
  });
});

describe("defaults and coverage", () => {
  test("doctors and hospitals start on staff with the doctors, 2002-2025", () => {
    const state = defaultHealthState("doctors-hospitals", facts);
    expect(state).toEqual({ mode: "line", range: { kind: "all" }, view: "staff", selectedIds: ["health.staff.doctors"] });
    const coverage = healthCoverage("doctors-hospitals", "staff", facts);
    expect([coverage.min, coverage.max]).toEqual([2002, 2025]);
    expect(healthDefaultSelection("doctors-hospitals", "hospitals", facts)).toEqual(["health.facilities.hospitals"]);
    expect(healthDefaultSelection("doctors-hospitals", "beds", facts)).toEqual(["health.facilities.beds"]);
    expect(healthDefaultSelection("doctors-hospitals", "visits", facts)).toEqual(["health.visits.outpatient"]);
  });

  test("illnesses start on the five largest groups of the latest year", () => {
    const state = defaultHealthState("illnesses", facts);
    expect(state.view).toBe("main");
    expect(state.selectedIds).toEqual(["health.illness.respiratory", "health.illness.eye", "health.illness.musculoskeletal", "health.illness.circulatory", "health.illness.urogenital"]);
    const coverage = healthCoverage("illnesses", "main", facts);
    expect([coverage.min, coverage.max]).toEqual([2002, 2025]);
  });

  test("the illness default is derived from the loaded facts, and ties follow series order", () => {
    const cell = (indicatorId: ClientHealthFact["indicatorId"], year: number, value: number): ClientHealthFact =>
      ({ year, indicatorId, areaId: "georgia", sourceId: "s", unit: "persons_thousand", value, decimals: 0 });
    const groups = healthViewSeries("illnesses", "main").filter(s => s.heading === "groups").map(s => s.id);
    // 2025 holds every group but the first, all equal except one; the first group has a larger value in 2024 only, which is not the latest year.
    const synthetic = [
      cell(groups[0], 2024, 999),
      ...groups.slice(1).map(id => cell(id, 2025, id === groups[10] ? 50 : 10)),
    ];
    expect(healthDefaultSelection("illnesses", "main", synthetic)).toEqual([groups[10], groups[1], groups[2], groups[3], groups[4]]);
  });

  test("an area page starts on All deaths; Guria runs 2014-2025", () => {
    expect(defaultHealthDeathsState().selectedIds).toEqual(["health.deaths.total"]);
    const state = parseHealthDeathsHash("", "region.guria", facts);
    expect(state.selectedIds).toEqual(["health.deaths.total"]);
    const model = buildHealthDeathsModel("region.guria", facts, state);
    expect([model.range.min, model.range.max]).toEqual([2014, 2025]);
  });
});

describe("display", () => {
  test("units and multipliers", () => {
    expect(healthDisplay("staff", "health.staff.doctors")).toEqual({ multiplier: 1, unitKey: "health.unitPersons" });
    expect(healthDisplay("hospitals", "health.facilities.hospitals")).toEqual({ multiplier: 1, unitKey: "health.unitUnits" });
    expect(healthDisplay("beds", "health.facilities.beds")).toEqual({ multiplier: 1000, unitKey: "health.unitBeds" });
    expect(healthDisplay("visits", "health.visits.outpatient")).toEqual({ multiplier: 0.001, unitKey: "health.unitMillionVisits" });
    expect(healthDisplay("main", "health.illness.respiratory")).toEqual({ multiplier: 1, unitKey: "health.unitThousandCases" });
    expect(healthDisplay("main", "health.illness.tuberculosis")).toEqual({ multiplier: 0.001, unitKey: "health.unitThousandCases" });
  });

  test("beds are whole beds", () => {
    const model = buildHealthModel("doctors-hospitals", facts, withIds("doctors-hospitals", "beds", ["health.facilities.beds"]), breaks);
    expect(model.selected[0].valuesByYear[2025]).toBe(15232);
    expect(model.selected[0].decimals).toBe(0);
    expect(model.decimals).toBe(0);
    expect(model.unitKey).toBe("health.unitBeds");
  });

  test("visits are millions with one decimal", () => {
    const model = buildHealthModel("doctors-hospitals", facts, withIds("doctors-hospitals", "visits", ["health.visits.outpatient"]), breaks);
    expect(model.selected[0].valuesByYear[2025]).toBe(16.760072);
    expect(model.decimals).toBe(1);
    expect(model.unitKey).toBe("health.unitMillionVisits");
  });

  test("single diseases are in thousands with three decimals, groups keep their own", () => {
    const single = buildHealthModel("illnesses", facts, withIds("illnesses", "main", ["health.illness.tuberculosis"]), breaks);
    expect(single.selected[0].valuesByYear[2025]).toBe(0.933);
    expect(single.decimals).toBe(3);
    const group = buildHealthModel("illnesses", facts, withIds("illnesses", "main", ["health.illness.respiratory", "health.illness.tuberculosis"]), breaks);
    expect(group.selected.find(s => s.id === "health.illness.respiratory")!.valuesByYear[2025]).toBe(500.359);
    expect(group.decimals).toBe(3);
    expect(group.unitKey).toBe("health.unitThousandCases");
  });

  test("the reference is drawn in ink", () => {
    expect(healthSeriesColor({ id: "health.staff.doctors", reference: true }, 0)).toBe(INK);
    expect(healthSeriesColor({ id: "health.staff.nurses", reference: false }, 1)).not.toBe(INK);
  });
});

describe("counting changes", () => {
  const staff = (ids: string[], range: HealthState["range"] = { kind: "all" }) => buildHealthModel("doctors-hospitals", facts, withIds("doctors-hospitals", "staff", ids, range), breaks);

  test("doctors over the whole span break at 2012 and 2020", () => {
    expect(staff(["health.staff.doctors"]).breaks).toEqual([{ year: 2012, label: "newCounting" }, { year: 2020, label: "newCounting" }]);
  });
  test("a range that holds no break draws none, and the first year of a range is not a break", () => {
    expect(staff(["health.staff.doctors"], { kind: "manual", start: 2021, end: 2025 }).breaks).toEqual([]);
    expect(staff(["health.staff.doctors"], { kind: "manual", start: 2020, end: 2025 }).breaks).toEqual([]);
    expect(staff(["health.staff.doctors"], { kind: "manual", start: 2019, end: 2025 }).breaks).toEqual([{ year: 2020, label: "newCounting" }]);
  });
  test("illness groups break at 2020 only; the ICD-10 split is never listed", () => {
    const model = buildHealthModel("illnesses", facts, withIds("illnesses", "main", ["health.illness.respiratory"]), breaks);
    expect(model.breaks).toEqual([{ year: 2020, label: "newCounting" }]);
    const split = buildHealthModel("illnesses", facts, withIds("illnesses", "main", ["health.illness.nervous_sense_organs", "health.illness.eye"]), breaks);
    // The combined group has no electronic-register break; the 2006 split itself is not listed, but eye (a new class) still counts from 2020.
    expect(split.breaks).toEqual([{ year: 2020, label: "newCounting" }]);
    const combined = buildHealthModel("illnesses", facts, withIds("illnesses", "main", ["health.illness.nervous_sense_organs"]), breaks);
    expect(combined.breaks).toEqual([]);
  });
  test("hospitals have none", () => {
    expect(buildHealthModel("doctors-hospitals", facts, withIds("doctors-hospitals", "hospitals", ["health.facilities.hospitals"]), breaks).breaks).toEqual([]);
  });
});

describe("gaps are nulls, never zeros", () => {
  test("nurses' sub-groups stop in 2011 while total nurses runs on", () => {
    const model = buildHealthModel("doctors-hospitals", facts, withIds("doctors-hospitals", "staff", ["health.staff.nurses", "health.staff.nurses_doctor_assistants"]), breaks);
    const assistants = model.selected.find(s => s.id === "health.staff.nurses_doctor_assistants")!, nurses = model.selected.find(s => s.id === "health.staff.nurses")!;
    for (let year = 2012; year <= 2025; year++) {
      expect(assistants.valuesByYear[year]).toBeNull();
      expect(nurses.valuesByYear[year]).toEqual(expect.any(Number));
    }
    expect(assistants.valuesByYear[2011]).toEqual(expect.any(Number));
  });
  test("the combined nervous group ends in 2005 and the three classes start in 2006", () => {
    const model = buildHealthModel("illnesses", facts, withIds("illnesses", "main", ["health.illness.nervous_sense_organs", "health.illness.nervous", "health.illness.eye", "health.illness.ear"]), breaks);
    const [combined, nervous, eye, ear] = ["nervous_sense_organs", "nervous", "eye", "ear"].map(k => model.selected.find(s => s.id === `health.illness.${k}`)!);
    for (let year = 2002; year <= 2025; year++) {
      if (year < 2006) {
        expect(combined.valuesByYear[year]).toEqual(expect.any(Number));
        for (const s of [nervous, eye, ear]) expect(s.valuesByYear[year]).toBeNull();
      } else {
        expect(combined.valuesByYear[year]).toBeNull();
        for (const s of [nervous, eye, ear]) expect(s.valuesByYear[year]).toEqual(expect.any(Number));
      }
    }
  });
  test("COVID-19 shows nothing in Guria before 2020", () => {
    const model = buildHealthDeathsModel("region.guria", facts, { mode: "line", range: { kind: "all" }, selectedIds: ["health.deaths.total", "health.deaths.covid19"] });
    const covid = model.selected.find(s => s.id === "health.deaths.covid19")!;
    for (let year = 2014; year <= 2019; year++) expect(covid.valuesByYear[year]).toBeNull();
    expect(covid.valuesByYear[2020]).toEqual(expect.any(Number));
  });
});

describe("hash", () => {
  test("a link from another view drops what it cannot show", () => {
    const state = parseHealthHash("#tab=beds&sel=health.staff.doctors", "doctors-hospitals", facts);
    expect(state.view).toBe("beds");
    expect(state.selectedIds).toEqual(["health.facilities.beds"]);
  });
  test("an unknown tab is staff", () => {
    const state = parseHealthHash("#tab=xyz", "doctors-hospitals", facts);
    expect(state.view).toBe("staff");
    expect(state.selectedIds).toEqual(["health.staff.doctors"]);
  });
  test("the illness page ignores tab and never writes it", () => {
    expect(parseHealthHash("#tab=beds", "illnesses", facts).view).toBe("main");
    const hash = serializeHealthHash(defaultHealthState("illnesses", facts), "illnesses");
    expect(new URLSearchParams(hash).has("tab")).toBe(false);
    expect(new URLSearchParams(serializeHealthHash(defaultHealthState("doctors-hospitals", facts), "doctors-hospitals")).get("tab")).toBe("staff");
  });
  test("round trip keeps selection, mode, range and an explicit empty selection", () => {
    const state: HealthState = { mode: "table", range: { kind: "manual", start: 2010, end: 2020 }, view: "hospitals", selectedIds: ["health.facilities.hospitals", "health.facilities.outpatient_clinics"] };
    expect(parseHealthHash(serializeHealthHash(state, "doctors-hospitals"), "doctors-hospitals", facts)).toEqual(state);
    const empty = { ...state, selectedIds: [] };
    const hash = serializeHealthHash(empty, "doctors-hospitals");
    expect(new URLSearchParams(hash).get("sel")).toBe("");
    expect(parseHealthHash(hash, "doctors-hospitals", facts).selectedIds).toEqual([]);
    const illnessState = defaultHealthState("illnesses", facts);
    expect(sorted(parseHealthHash(serializeHealthHash(illnessState, "illnesses"), "illnesses", facts).selectedIds)).toEqual(sorted(illnessState.selectedIds));
  });
  test("changing view selects the new default, keeps mode, and refits the range without collapsing it", () => {
    const state: HealthState = { mode: "table", range: { kind: "manual", start: 2002, end: 2025 }, view: "staff", selectedIds: ["health.staff.nurses"] };
    const next = changeHealthView(state, "doctors-hospitals", "beds", facts);
    expect(next.view).toBe("beds");
    expect(next.mode).toBe("table");
    expect(next.selectedIds).toEqual(["health.facilities.beds"]);
    expect(next.range).toEqual({ kind: "manual", start: 2002, end: 2025 });
  });
  test("an area page drops ids from another page and keeps an explicit empty selection", () => {
    expect(parseHealthDeathsHash("#sel=health.staff.doctors", "region.guria", facts).selectedIds).toEqual(["health.deaths.total"]);
    const state = parseHealthDeathsHash("#sel=health.deaths.cancer,health.staff.doctors&view=table", "region.guria", facts);
    expect(state.selectedIds).toEqual(["health.deaths.cancer"]);
    expect(state.mode).toBe("table");
    const empty = parseHealthDeathsHash("#sel=", "region.guria", facts);
    expect(empty.selectedIds).toEqual([]);
    expect(parseHealthDeathsHash(serializeHealthDeathsHash(empty), "region.guria", facts).selectedIds).toEqual([]);
    const full = { mode: "line" as const, range: { kind: "manual" as const, start: 2016, end: 2022 }, selectedIds: ["health.deaths.total", "health.deaths.covid19"] };
    expect(parseHealthDeathsHash(serializeHealthDeathsHash(full), "region.guria", facts)).toEqual(full);
  });
});

describe("causes of death", () => {
  test("areas, slugs and series", () => {
    expect(HEALTH_DEATH_AREAS).toBe(HEALTH_AREAS);
    expect(healthDeathsAreaHref("georgia")).toBe("/explorer/health/causes-of-death/regions/georgia");
    expect(healthDeathsAreaHref("region.racha_lechkhumi_kvemo_svaneti")).toBe("/explorer/health/causes-of-death/regions/racha_lechkhumi_kvemo_svaneti");
    for (const area of HEALTH_AREAS) expect(healthDeathsAreaForSlug(healthDeathsAreaHref(area).split("/").pop()!)).toBe(area);
    expect(healthDeathsAreaForSlug("nowhere")).toBeNull();
    const series = healthDeathsSeries();
    expect(series).toHaveLength(21);
    expect(series[0]).toEqual({ id: "health.deaths.total", reference: true });
    expect(series.slice(1).every(s => !s.reference)).toBe(true);
    expect(series.map(s => s.id)).toEqual(HEALTH_INDICATORS.filter(id => id.startsWith("health.deaths.")));
  });
  test("the death-rate map is the latest year with all 11 regions, ranked high to low", () => {
    const map = buildHealthDeathRateMapModel(facts);
    expect(map.year).toBe(2025);
    expect(map.regions).toHaveLength(11);
    expect(map.regions[0].regionId).toBe("region.racha_lechkhumi_kvemo_svaneti");
    expect(map.regions[0].rank).toBe(1);
    expect(map.regions[0].value).toBe(19.7);
    expect(map.regions.map(r => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(map.regions.map(r => r.value)).toEqual([...map.regions.map(r => r.value)].sort((a, b) => b - a));
    expect(map.firstYear).toBe(2014);
  });
});
