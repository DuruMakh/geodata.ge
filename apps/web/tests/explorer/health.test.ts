import ExcelJS from "exceljs";
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedHealthData, toClientHealthFact } from "../../lib/data/health/importHealth";
import { HEALTH_AREAS, HEALTH_INDICATORS, HEALTH_SOURCES, type ClientHealthFact, type HealthSeriesBreak } from "../../lib/data/health/types";
import { INK } from "../../lib/explorer/colors";
import {
  HEALTH_HUB_PATH, HEALTH_SECTIONS, buildHealthModel, changeHealthView, defaultHealthState, healthCoverage, healthDefaultSelection, healthDisplay, healthSeriesColor,
  healthViewSeries, healthViews, keepOneHealthUnit, parseHealthHash, serializeHealthHash, type HealthState,
} from "../../lib/explorer/health";
import {
  HEALTH_DEATH_AREAS, buildHealthDeathsModel, defaultHealthDeathsState, healthDeathsAreaForSlug, healthDeathsAreaHref, healthDeathsSeries,
  parseHealthDeathsHash, serializeHealthDeathsHash,
} from "../../lib/explorer/healthDeaths";
import { buildHealthDeathRateMapModel } from "../../lib/explorer/healthDeathRateMap";
import { buildHealthHubCards } from "../../lib/explorer/healthHubCards";
import { buildHealthWorkbookExportModel } from "../../lib/explorer/healthWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Presentation } from "../../lib/i18n/types";

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
    expect(healthViews("doctors-hospitals")).toEqual(["staff", "hospitals"]);
    expect(healthViews("illnesses")).toEqual(["main"]);
  });

  test("staff lists doctors and 14 specialities, then nurses and the two groups still published, flat under two headings", () => {
    const staff = healthViewSeries("doctors-hospitals", "staff");
    expect(staff.map(s => s.heading)).toEqual([...Array(15).fill("doctors"), ...Array(3).fill("nurses")]);
    expect(staff.filter(s => s.reference).map(s => s.id)).toEqual(["health.staff.doctors"]);
    expect(staff[0].id).toBe("health.staff.doctors");
    expect(staff.slice(15).map(s => s.id)).toEqual(["health.staff.nurses", "health.staff.nurses_medical", "health.staff.nurses_midwives"]);
    expect(staff.map(s => s.id)).not.toContain("health.staff.nurses_doctor_assistants");
  });

  test("hospitals list the facilities, beds and visits under their own headings", () => {
    expect(healthViewSeries("doctors-hospitals", "hospitals").map(s => [s.id, s.heading])).toEqual([
      ["health.facilities.hospitals", "facilities"], ["health.facilities.outpatient_clinics", "facilities"], ["health.facilities.beds", "beds"], ["health.visits.outpatient", "visits"],
    ]);
  });

  test("illnesses list 19 groups, then 6 single diseases, all top level", () => {
    const series = healthViewSeries("illnesses", "main");
    expect(series.filter(s => s.heading === "groups")).toHaveLength(19);
    expect(series.filter(s => s.heading === "single")).toHaveLength(6);
    expect(series.map(s => s.heading)).toEqual([...Array(19).fill("groups"), ...Array(6).fill("single")]);
    expect(series.every(s => !s.reference)).toBe(true);
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
    expect(healthDisplay("health.staff.doctors")).toEqual({ multiplier: 1, unitKey: "health.unitPersons" });
    expect(healthDisplay("health.facilities.hospitals")).toEqual({ multiplier: 1, unitKey: "health.unitUnits" });
    expect(healthDisplay("health.facilities.outpatient_clinics")).toEqual({ multiplier: 1, unitKey: "health.unitUnits" });
    expect(healthDisplay("health.facilities.beds")).toEqual({ multiplier: 1000, unitKey: "health.unitBeds" });
    expect(healthDisplay("health.visits.outpatient")).toEqual({ multiplier: 0.001, unitKey: "health.unitMillionVisits" });
    expect(healthDisplay("health.illness.respiratory")).toEqual({ multiplier: 1, unitKey: "health.unitThousandCases" });
    expect(healthDisplay("health.illness.tuberculosis")).toEqual({ multiplier: 0.001, unitKey: "health.unitThousandCases" });
  });

  test("a tick of another unit replaces the selection; unticking keeps the rest", () => {
    const facilities = ["health.facilities.hospitals", "health.facilities.outpatient_clinics"];
    expect(keepOneHealthUnit([...facilities, "health.facilities.beds"], facilities)).toEqual(["health.facilities.beds"]);
    expect(keepOneHealthUnit(facilities, ["health.facilities.hospitals"])).toEqual(facilities);
    expect(keepOneHealthUnit(["health.facilities.hospitals"], facilities)).toEqual(["health.facilities.hospitals"]);
    // Select all from an empty list keeps the first group's unit.
    expect(keepOneHealthUnit(healthViewSeries("doctors-hospitals", "hospitals").map(s => s.id), [])).toEqual(facilities);
    // A link that mixes units keeps the unit of its first row in list order.
    expect(parseHealthHash("#tab=hospitals&sel=health.facilities.beds,health.facilities.hospitals", "doctors-hospitals", facts).selectedIds).toEqual(["health.facilities.hospitals"]);
  });

  test("beds are whole beds", () => {
    const model = buildHealthModel("doctors-hospitals", facts, withIds("doctors-hospitals", "hospitals", ["health.facilities.beds"]), breaks);
    expect(model.selected[0].valuesByYear[2025]).toBe(15232);
    expect(model.selected[0].decimals).toBe(0);
    expect(model.decimals).toBe(0);
    expect(model.unitKey).toBe("health.unitBeds");
  });

  test("visits are millions with one decimal", () => {
    const model = buildHealthModel("doctors-hospitals", facts, withIds("doctors-hospitals", "hospitals", ["health.visits.outpatient"]), breaks);
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
    const state = parseHealthHash("#tab=hospitals&sel=health.staff.doctors", "doctors-hospitals", facts);
    expect(state.view).toBe("hospitals");
    expect(state.selectedIds).toEqual(["health.facilities.hospitals"]);
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
    const next = changeHealthView(state, "doctors-hospitals", "hospitals", facts);
    expect(next.view).toBe("hospitals");
    expect(next.mode).toBe("table");
    expect(next.selectedIds).toEqual(["health.facilities.hospitals"]);
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

// The workbook and the cards read the shipped copy.
const presentationFor = async (locale: Locale): Promise<Presentation> => ({ locale, englishLabels: {}, messages: await getMessages(locale, ["workbook", "format", "health", "common"]) });
const sourceFor = (sourceId: string) => ({
  sourceId, years: Array.from({ length: 24 }, (_, i) => 2002 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-15",
  downloadHref: `/downloads/methodology/health/files/${sourceId}.xlsx` as const,
});
const SOURCES = HEALTH_SOURCES.map(sourceFor);
const loadWorkbook = async (model: Parameters<typeof createWorkbookBuffer>[0]) => { const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model)); return excel; };
const LABELS: Record<string, string> = { "health.staff.nurses": "Nurses", "health.staff.nurses_midwives": "Midwives", "health.facilities.beds": "Hospital beds", "health.deaths.total": "All deaths" };

describe("Excel workbooks", () => {
  test("a staff workbook keeps the published persons", async () => {
    const model = buildHealthWorkbookExportModel({
      section: "doctors-hospitals", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: LABELS, title: "Doctors and hospitals",
      state: withIds("doctors-hospitals", "staff", ["health.staff.nurses", "health.staff.nurses_midwives"], { kind: "manual", start: 2002, end: 2025 }),
    }, await presentationFor("en"));
    expect(model.filename).toBe("fiscal-health-doctors-hospitals-2002-2025-en.xlsx");
    expect(model.readable.years).toHaveLength(24);
    expect(model.readable.rows.map(row => row.label)).toEqual(["Nurses", "Midwives"]);
    const [nurses] = model.readable.rows;
    expect(nurses.valuesByYear[2025]).toBe(21262);
    expect(Object.values(nurses.valuesByYear).every(value => value !== null)).toBe(true);
    const analysis = model.analysis;
    expect(analysis.headers).toEqual(["Year", "Series", "Value", "Unit", "Status"]);
    expect(analysis.rows).toHaveLength(48);
    expect(analysis.rows.find(r => r[0] === 2025 && r[1] === "Nurses")).toEqual([2025, "Nurses", 21262, "persons", "Published"]);
    expect(model.sources.map(source => source.title)).toEqual(["geostat_health_nurses"]);
    const sheet = (await loadWorkbook(model)).getWorksheet(model.sheetNames[1])!;
    const rowOf = (year: number, label: string) => analysis.rows.findIndex(r => r[0] === year && r[1] === label) + 2;
    expect(sheet.getCell(rowOf(2025, "Nurses"), 3).value).toBe(21262);
    expect(sheet.getCell(rowOf(2025, "Nurses"), 3).numFmt).toBe("#,##0");
  });

  test("a beds workbook exports the thousands as published, to the decimals each year is published with", async () => {
    const model = buildHealthWorkbookExportModel({
      section: "doctors-hospitals", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: LABELS, title: "Doctors and hospitals",
      state: withIds("doctors-hospitals", "hospitals", ["health.facilities.beds"], { kind: "manual", start: 2024, end: 2025 }),
    }, await presentationFor("en"));
    expect(model.filename).toBe("fiscal-health-doctors-hospitals-hospitals-2024-2025-en.xlsx");
    const beds2025 = facts.find(f => f.indicatorId === "health.facilities.beds" && f.year === 2025)!;
    expect(beds2025.value).toBe(15.232);
    expect(model.analysis.rows.find(r => r[0] === 2025)).toEqual([2025, "Hospital beds", 15.232, "thousand beds", "Published"]);
    const sheet = (await loadWorkbook(model)).getWorksheet(model.sheetNames[1])!;
    for (const year of [2024, 2025]) {
      const fact = facts.find(f => f.indicatorId === "health.facilities.beds" && f.year === year)!;
      const row = model.analysis.rows.findIndex(r => r[0] === year) + 2;
      expect(sheet.getCell(row, 3).numFmt, String(year)).toBe(fact.decimals === 0 ? "#,##0" : `#,##0.${"0".repeat(fact.decimals)}`);
    }
    expect(sheet.getCell(model.analysis.rows.findIndex(r => r[0] === 2025) + 2, 3).numFmt).toBe("#,##0.000");
    expect(model.readable.rows[0].numberFormat).toBe("#,##0.000");
  });

  test("illnesses keep each disease in its stored unit, and the unit column says which", async () => {
    const model = buildHealthWorkbookExportModel({
      section: "illnesses", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", title: "Illnesses",
      labels: { "health.illness.respiratory": "Respiratory", "health.illness.tuberculosis": "Tuberculosis" },
      state: withIds("illnesses", "main", ["health.illness.respiratory", "health.illness.tuberculosis"], { kind: "manual", start: 2025, end: 2025 }),
    }, await presentationFor("en"));
    expect(model.filename).toBe("fiscal-health-illnesses-2025-2025-en.xlsx");
    expect(model.analysis.rows.map(r => r.slice(1, 4))).toEqual([
      ["Respiratory", 500.359, "thousand persons"],
      ["Tuberculosis", facts.find(f => f.indicatorId === "health.illness.tuberculosis" && f.year === 2025)!.value, "persons"],
    ]);
    const sheet = (await loadWorkbook(model)).getWorksheet(model.sheetNames[1])!;
    expect(sheet.getCell(2, 3).numFmt).toBe("#,##0.000");
    expect(sheet.getCell(3, 3).numFmt).toBe("#,##0");
  });

  test("an area workbook names the area in its file and cites only the 23-2 workbook", async () => {
    const model = buildHealthWorkbookExportModel({
      section: "causes-of-death", area: "region.guria", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: LABELS, title: "Guria",
      state: defaultHealthDeathsState(),
    }, await presentationFor("en"));
    expect(model.filename).toBe("fiscal-health-causes-of-death-guria-2014-2025-en.xlsx");
    expect(model.readable.years).toHaveLength(12);
    expect(model.analysis.rows[0]).toEqual([2014, "All deaths", expect.any(Number), "persons", "Published"]);
    expect(model.sources).toHaveLength(1);
    expect(model.sources[0].title).toBe("geostat_deaths_by_cause_region");
    expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/health/files/geostat_deaths_by_cause_region.xlsx");
    const ka = buildHealthWorkbookExportModel({
      section: "causes-of-death", area: "georgia", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: LABELS, title: "Georgia", state: defaultHealthDeathsState(),
    }, await presentationFor("ka"));
    expect(ka.filename).toBe("fiscal-health-causes-of-death-georgia-2014-2025.xlsx");
    expect(ka.analysis.rows.at(-1)).toEqual([2025, "All deaths", 44319, "ადამიანი", "გამოქვეყნებული"]);
  });

  test("a source the facts cite but the list lacks is an error", async () => {
    const presentation = await presentationFor("en");
    expect(() => buildHealthWorkbookExportModel({
      section: "doctors-hospitals", facts, sources: [], siteOrigin: "https://fiscal.ge", labels: LABELS, title: "x", state: defaultHealthState("doctors-hospitals", facts),
    }, presentation)).toThrow(/geostat_health_physicians/);
  });
});

describe("hub cards", () => {
  test("three cards with sparklines and the latest published values", async () => {
    const cards = buildHealthHubCards(facts, await presentationFor("en"));
    expect(cards.map(card => card.href)).toEqual(HEALTH_SECTIONS.map(s => s.href));
    expect(cards.map(card => card.index)).toEqual(["01", "02", "03"]);
    expect(cards.map(card => card.title)).toEqual(["Doctors and hospitals", "Illnesses", "Causes of death"]);
    expect(cards.map(card => card.description)).toEqual([
      "Doctors and nurses by speciality, hospitals, hospital beds and out-patient visits in Georgia.",
      "New cases of illness diagnosed each year in Georgia, by disease group and for six single diseases.",
      "What people die of in Georgia and in each region, by main group of causes, with the death rate by region.",
    ]);
    // Causes of death follows its page's line, the death rate per 1,000 people, not the count of deaths.
    expect(cards.map(card => card.footer)).toEqual(["2025 · 22,491 · 2002–2025", "2025 · 500.4 thousand · 2002–2025", "2025 · 11.3 · 2014–2025"]);
    expect(cards.map(card => card.latest?.caption)).toEqual(["Doctors", "New respiratory cases", "Deaths per 1,000 people, Georgia"]);
    expect(cards.map(card => card.series?.length)).toEqual([24, 24, 12]);
    expect(cards.map(card => card.series!.at(-1))).toEqual([22491, 500.359, 11.3]);
    expect(cards.every(card => card.comingSoon === false && card.seriesColor === INK)).toBe(true);
    const ka = buildHealthHubCards(facts, await presentationFor("ka"));
    expect(ka.map(card => card.footer)).toEqual(["2025 · 22,491 · 2002–2025", "2025 · 500.4 ათასი · 2002–2025", "2025 · 11.3 · 2014–2025"]);
  });
});

describe("workbook sources", () => {
  test("cite the fiscal.ge archive copies of the Geostat workbooks a page's values come from, in the page's language", async () => {
    const { healthSources } = await import("../../lib/pages/health-shared");
    const used = [{ sourceId: "geostat_health_physicians", year: 2003 }, { sourceId: "geostat_deaths_by_cause_region", year: 2014 }, { sourceId: "geostat_health_physicians", year: 2002 }];
    expect(await healthSources("en", used)).toEqual([
      { sourceId: "geostat_health_physicians", years: [2002, 2003], title: "Number of physicians by occupation", organization: "National Statistics Office of Georgia (Geostat)", downloadHref: "/downloads/methodology/health/files/number-of-physicians-by-occupations.xlsx", retrievedAt: "2026-10-15" },
      { sourceId: "geostat_deaths_by_cause_region", years: [2014], title: "Deaths by cause chapter and region (table 23-2)", organization: "National Statistics Office of Georgia (Geostat)", downloadHref: "/downloads/methodology/health/files/23-2-deaths-by-chapters-regions.xlsx", retrievedAt: "2026-10-15" },
    ]);
    const ka = await healthSources("ka", used);
    expect(ka.map(source => [source.title, source.organization])).toEqual([
      ["ექიმების რიცხოვნობა დაკავებული თანამდებობების მიხედვით", "საქსტატი"],
      ["გარდაცვლილთა რიცხოვნობა რეგიონების და გარდაცვალების მიზეზების ძირითადი კლასების მიხედვით", "საქსტატი"],
    ]);
    // Every served health source has an archived copy.
    const all = await healthSources("en", facts);
    expect(all.every(source => source.downloadHref.startsWith("/downloads/methodology/health/files/"))).toBe(true);
    expect(all).toHaveLength(new Set(facts.map(f => f.sourceId)).size);
  });
});
