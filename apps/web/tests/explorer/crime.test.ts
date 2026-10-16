import ExcelJS from "exceljs";
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedCrimeData, toClientCrimeFact } from "../../lib/data/crime/importCrime";
import { CRIME_INDICATORS, CRIME_SOURCES, type ClientCrimeFact, type CrimeSeriesBreak } from "../../lib/data/crime/types";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES, SOURCE_ID } from "../../lib/data/demography/series";
import { INK } from "../../lib/explorer/colors";
import {
  CRIME_HUB_PATH, CRIME_SECTIONS, buildCrimeModel, changeCrimeMeasure, crimeCoverage, crimeDefaultSelection, crimeMeasureFacts, crimeSeries,
  crimeSeriesColor, crimeUnitKey, defaultCrimeState, parseCrimeHash, serializeCrimeHash, type CrimeMeasure, type CrimePopulation, type CrimeSectionId,
} from "../../lib/explorer/crime";
import { buildCrimeHubCards } from "../../lib/explorer/crimeHubCards";
import { buildCrimeWorkbookExportModel } from "../../lib/explorer/crimeWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Presentation } from "../../lib/i18n/types";

let facts: ClientCrimeFact[];
let breaks: CrimeSeriesBreak[];
let population: CrimePopulation;
beforeAll(async () => {
  const served = await loadServedCrimeData();
  facts = served.facts.map(toClientCrimeFact);
  breaks = served.breaks;
  population = (await loadServedDemographyData()).facts
    .filter(f => f.seriesId === SERIES.populationTotal && f.geographyId === "country.georgia")
    .map(f => ({ year: f.year, persons: f.value }));
});

const state = (section: CrimeSectionId, selectedIds: string[], measure: CrimeMeasure = "count", range = { kind: "all" } as ReturnType<typeof defaultCrimeState>["range"]) =>
  ({ ...defaultCrimeState(section), selectedIds, measure, range });
const breakYears = (section: CrimeSectionId, selectedIds: string[], measure: CrimeMeasure, start?: number, end?: number) =>
  buildCrimeModel(section, facts, population, state(section, selectedIds, measure, start === undefined ? { kind: "all" } : { kind: "manual", start, end: end! }), breaks).breaks.map(b => b.year);

describe("sections, defaults and coverage", () => {
  test("the five sections", () => {
    expect(CRIME_HUB_PATH).toBe("/explorer/crime");
    expect(CRIME_SECTIONS).toEqual([
      { id: "recorded", href: "/explorer/crime/recorded", labelKey: "common.crimeRecorded" },
      { id: "convictions", href: "/explorer/crime/convictions", labelKey: "common.crimeConvictions" },
      { id: "prisons", href: "/explorer/crime/prisons", labelKey: "common.crimePrisons" },
      { id: "victims", href: "/explorer/crime/victims", labelKey: "common.crimeVictims" },
      { id: "road-accidents", href: "/explorer/crime/road-accidents", labelKey: "common.crimeRoadAccidents" },
    ]);
  });

  test("only the page total is selected by default", () => {
    expect(crimeDefaultSelection("recorded")).toEqual(["crime.recorded.total"]);
    expect(crimeDefaultSelection("road-accidents")).toEqual(["crime.road.accidents"]);
    expect(defaultCrimeState("convictions")).toEqual({ mode: "line", range: { kind: "all" }, measure: "count", selectedIds: ["crime.convicted.total"] });
  });

  test("coverage follows the section's count years", () => {
    const recorded = crimeCoverage("recorded", facts);
    expect([recorded.min, recorded.max]).toEqual([2015, 2025]);
    const convictions = crimeCoverage("convictions", facts);
    expect([convictions.min, convictions.max]).toEqual([2001, 2025]);
    const victims = crimeCoverage("victims", facts).years;
    expect(victims).toContain(2011);
    expect(victims).toContain(2015);
    expect(victims).not.toContain(2012);
  });

  test("the model's range resolves to the section's coverage", () => {
    const model = buildCrimeModel("recorded", facts, population, defaultCrimeState("recorded"), breaks);
    expect([model.range.start, model.range.end]).toEqual([2015, 2025]);
  });
});

describe("the series lists", () => {
  const headings = (section: CrimeSectionId) => crimeSeries(section).map(s => s.heading);
  test("every list starts with its reference and lists each served series once, in table order", () => {
    for (const { id } of CRIME_SECTIONS) {
      const list = crimeSeries(id);
      expect(list[0].reference).toBe(true);
      expect(list.filter(s => s.reference)).toHaveLength(1);
      expect(new Set(list.map(s => s.id)).size).toBe(list.length);
      // Road accidents list people killed before injured, the reverse of the table.
      if (id !== "road-accidents") expect(list.map(s => s.id)).toEqual(CRIME_INDICATORS.filter(i => list.some(s => s.id === i)));
    }
    expect(CRIME_SECTIONS.flatMap(s => crimeSeries(s.id)).map(s => s.id).sort()).toEqual([...CRIME_INDICATORS].sort());
    expect(crimeSeries("recorded")[0]).toEqual({ id: "crime.recorded.total", reference: true });
  });

  test("convictions: total, 11 types, 5 ages, 2 sexes, 7 sentences", () => {
    const expected = [undefined, ...Array(11).fill("type"), ...Array(5).fill("age"), ...Array(2).fill("sex"), ...Array(7).fill("sentence")];
    expect(headings("convictions")).toEqual(expected);
    expect(crimeSeries("convictions")).toHaveLength(26);
  });

  test("recorded, prisons, victims and road accidents", () => {
    expect(headings("recorded")).toEqual([undefined, ...Array(11).fill("type")]);
    expect(crimeSeries("prisons")).toHaveLength(7);
    expect(headings("prisons")).toEqual([undefined, "sex", "sex", "age", "age", "status", "status"]);
    expect(crimeSeries("victims")).toHaveLength(14);
    expect(headings("victims")).toEqual([undefined, ...Array(3).fill("sex"), ...Array(5).fill("age"), ...Array(5).fill("citizenship")]);
    expect(crimeSeries("road-accidents")).toHaveLength(4);
    expect(headings("road-accidents")).toEqual(["accidents", "accidents", "people", "people"]);
    expect(crimeSeries("road-accidents").map(s => s.reference)).toEqual([true, false, false, false]);
    expect(crimeSeries("road-accidents").map(s => s.id)).toEqual(["crime.road.accidents", "crime.road.accidents_drunk", "crime.road.killed", "crime.road.injured"]);
  });
});

describe("the per-100,000 view", () => {
  test("a count is divided by the population of the same year, in hundred-thousands", () => {
    const rate = (year: number) => buildCrimeModel("convictions", facts, population, state("convictions", ["crime.convicted.total"], "per100k"), breaks)
      .selected[0].valuesByYear[year];
    expect(Number(rate(2004)!.toFixed(1))).toBe(230.4);
    expect(rate(2004)).toBe(Number((9071 / 3937716 * 100000).toPrecision(15)));
    for (const year of [2001, 2002, 2003]) expect(rate(year)).toBeNull();
    const recorded = buildCrimeModel("recorded", facts, population, state("recorded", ["crime.recorded.total"], "per100k"), breaks);
    expect(recorded.selected[0].valuesByYear[2025]).toBe(Number((54134 / 3930428 * 100000).toPrecision(15)));
    expect(recorded.unitKey).toBe("crime.unitPer100k");
    expect(recorded.decimals).toBe(1);
  });

  test("crimeMeasureFacts keeps counts as they are and drops a year without population", () => {
    const counts = crimeMeasureFacts("count", facts, population);
    expect(counts).toHaveLength(facts.length);
    expect(counts.every(f => f.decimals === 0)).toBe(true);
    const rates = crimeMeasureFacts("per100k", facts, population);
    expect(rates.every(f => f.decimals === 1 && f.calculated)).toBe(true);
    expect(rates.some(f => f.year <= 2003)).toBe(false);
    expect(rates.length).toBeLessThan(facts.length);
    expect(rates.length).toBe(facts.filter(f => f.year >= 2004).length);
  });

  test("the unit follows the measure and the series", () => {
    expect(crimeUnitKey("per100k", "crime.prison.total")).toBe("crime.unitPer100k");
    expect(crimeUnitKey("count", "crime.recorded.life")).toBe("crime.unitCrimes");
    expect(crimeUnitKey("count", "crime.road.accidents")).toBe("crime.unitAccidents");
    expect(crimeUnitKey("count", "crime.road.accidents_drunk")).toBe("crime.unitAccidents");
    expect(crimeUnitKey("count", "crime.road.killed")).toBe("crime.unitPersons");
    expect(crimeUnitKey("count", "crime.convicted.total")).toBe("crime.unitPersons");
    expect(buildCrimeModel("road-accidents", facts, population, defaultCrimeState("road-accidents"), breaks).unitKey).toBe("crime.unitAccidents");
  });
});

describe("series breaks", () => {
  test("the 2018 registration change, where a selected series is affected", () => {
    expect(breakYears("recorded", ["crime.recorded.total"], "count", 2015, 2025)).toEqual([2018]);
    expect(breakYears("recorded", ["crime.recorded.total"], "count", 2019, 2025)).toEqual([]);
    expect(breakYears("recorded", ["crime.recorded.total"], "count")).toEqual([2018]);
  });

  test("the census recalculation is drawn only on the per-100,000 view", () => {
    expect(breakYears("recorded", ["crime.recorded.total"], "per100k", 2015, 2025)).toEqual([2018, 2025]);
    expect(breakYears("prisons", ["crime.prison.total"], "count")).toEqual([]);
    expect(breakYears("prisons", ["crime.prison.total"], "per100k")).toEqual([2025]);
    expect(breakYears("prisons", ["crime.prison.total"], "per100k", 2025, 2025)).toEqual([]);
  });

  test("the drunk-driving coverage change applies to its own series", () => {
    expect(breakYears("road-accidents", ["crime.road.accidents_drunk"], "count")).toEqual([2025]);
    expect(breakYears("road-accidents", ["crime.road.accidents"], "count")).toEqual([]);
  });

  test("every break is labelled newCounting", () => {
    const model = buildCrimeModel("recorded", facts, population, state("recorded", ["crime.recorded.total"], "per100k"), breaks);
    expect(model.breaks.every(b => b.label === "newCounting")).toBe(true);
  });
});

describe("gaps are null, never zero", () => {
  const series = (section: CrimeSectionId, id: string) => buildCrimeModel(section, facts, population, state(section, [id]), breaks).series.find(s => s.id === id)!;
  test("victims by sex start in 2015", () => {
    const women = series("victims", "crime.victims.sex_women");
    for (const year of [2012, 2013, 2014]) expect(women.valuesByYear[year]).toBeNull();
    expect(women.valuesByYear[2015]).toBeGreaterThan(0);
  });
  test("pre-trial prisoners start in 2010", () => {
    const pretrial = series("prisons", "crime.prison.pretrial");
    for (let year = 2001; year <= 2009; year++) expect(pretrial.valuesByYear[year]).toBeNull();
    expect(pretrial.valuesByYear[2010]).not.toBeNull();
  });
  test("drunk-driving accidents have no 2002 figure", () => {
    expect(series("road-accidents", "crime.road.accidents_drunk").valuesByYear[2002]).toBeNull();
  });
});

describe("the hash", () => {
  test("a selection mixing units keeps the first one's unit", () => {
    expect(parseCrimeHash("#sel=crime.road.accidents,crime.road.killed", "road-accidents", facts).selectedIds).toEqual(["crime.road.accidents"]);
    expect(parseCrimeHash("#sel=crime.road.killed,crime.road.injured", "road-accidents", facts).selectedIds).toEqual(["crime.road.killed", "crime.road.injured"]);
  });

  test("tab names the measure and an unknown one is count", () => {
    expect(parseCrimeHash("#tab=per100k", "recorded", facts).measure).toBe("per100k");
    expect(parseCrimeHash("#tab=xyz", "recorded", facts).measure).toBe("count");
    expect(parseCrimeHash("", "recorded", facts)).toEqual(defaultCrimeState("recorded"));
  });

  test("an explicit empty selection stays empty and round-trips", () => {
    const parsed = parseCrimeHash("#tab=per100k&sel=", "recorded", facts);
    expect(parsed.selectedIds).toEqual([]);
    expect(parsed.measure).toBe("per100k");
    expect(parseCrimeHash(`#${serializeCrimeHash(parsed)}`, "recorded", facts)).toEqual(parsed);
  });

  test("a selection naming nothing in the section falls back to the default", () => {
    expect(parseCrimeHash("#sel=crime.prison.total", "recorded", facts).selectedIds).toEqual(["crime.recorded.total"]);
  });

  test("the serialised hash always carries the measure and round-trips the years", () => {
    const original = state("recorded", ["crime.recorded.total", "crime.recorded.life"], "count", { kind: "manual", start: 2017, end: 2022 });
    const hash = serializeCrimeHash(original);
    expect(new URLSearchParams(hash).get("tab")).toBe("count");
    expect(parseCrimeHash(`#${hash}`, "recorded", facts)).toEqual(original);
  });

  test("changing the measure keeps the selection, range and mode", () => {
    const before = { ...state("recorded", ["crime.recorded.life"], "count", { kind: "manual", start: 2017, end: 2022 }), mode: "table" as const };
    expect(changeCrimeMeasure(before, "per100k")).toEqual({ ...before, measure: "per100k" });
  });
});

describe("colour", () => {
  test("the reference is drawn in ink, others keep a stable colour", () => {
    expect(crimeSeriesColor({ id: "crime.recorded.total", reference: true }, 0)).toBe(INK);
    expect(crimeSeriesColor({ id: "crime.recorded.life", reference: false }, 1)).not.toBe(INK);
  });
});

// The workbook and the cards read the shipped copy; the crime keys arrive with the namespace, so the test supplies the ones it needs.
const CRIME_COPY: Record<Locale, Record<string, string>> = {
  en: {
    "common.crimeRecorded": "Recorded crime", "common.crimeConvictions": "Convictions", "common.crimePrisons": "Prisons", "common.crimeVictims": "Victims", "common.crimeRoadAccidents": "Road accidents",
    "crime.series": "Series", "crime.value": "Value", "crime.unit": "Unit",
    "crime.unitCrimes": "crimes", "crime.unitPersons": "persons", "crime.unitAccidents": "accidents", "crime.unitPer100k": "per 100,000 people",
    "crime.workbook.ratesNote": "Rates per 100,000 people are calculated by fiscal.ge from Geostat's counts and Georgia's population on 1 January.",
    ...Object.fromEntries(CRIME_SECTIONS.map(s => [`crime.page.${s.id}.summary`, `Summary of ${s.id}`])),
  },
  ka: {
    "common.crimeRecorded": "რეგისტრირებული დანაშაული", "common.crimeConvictions": "მსჯავრდებულები", "common.crimePrisons": "პატიმრები", "common.crimeVictims": "დაზარალებულები", "common.crimeRoadAccidents": "საგზაო-სატრანსპორტო შემთხვევები",
    "crime.series": "სერია", "crime.value": "მნიშვნელობა", "crime.unit": "ერთეული",
    "crime.unitCrimes": "დანაშაული", "crime.unitPersons": "პირი", "crime.unitAccidents": "შემთხვევა", "crime.unitPer100k": "100 000 მოსახლეზე",
    "crime.workbook.ratesNote": "100 000 მოსახლეზე მაჩვენებლები fiscal.ge-მ გამოთვალა საქსტატის მონაცემებითა და საქართველოს მოსახლეობით 1 იანვრის მდგომარეობით.",
    ...Object.fromEntries(CRIME_SECTIONS.map(s => [`crime.page.${s.id}.summary`, `შეჯამება ${s.id}`])),
  },
};
const presentationFor = async (locale: Locale): Promise<Presentation> => ({
  locale, englishLabels: {}, messages: { ...await getMessages(locale, ["workbook", "format", "common"]), ...CRIME_COPY[locale] },
});
const sourceFor = (sourceId: string, years: number[]) => ({
  sourceId, years, title: sourceId, organization: "Geostat", retrievedAt: "2026-10-16", downloadHref: `/downloads/methodology/crime/files/${sourceId}.xlsx` as const,
});
const YEARS_2001_2025 = Array.from({ length: 25 }, (_, i) => 2001 + i);
const SOURCES = [...CRIME_SOURCES.map(id => sourceFor(id, YEARS_2001_2025)), sourceFor(SOURCE_ID.populationUnits, Array.from({ length: 23 }, (_, i) => 2004 + i))];
const LABELS: Record<string, string> = { "crime.convicted.total": "People convicted", "crime.victims.sex_women": "Women", "crime.victims.total": "Victims" };
const loadWorkbook = async (model: Parameters<typeof createWorkbookBuffer>[0]) => { const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model)); return excel; };

describe("Excel workbooks", () => {
  test("a convictions per-100,000 workbook leaves the years without population blank", async () => {
    const model = buildCrimeWorkbookExportModel({
      section: "convictions", facts, population, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: LABELS, title: "Convictions",
      state: state("convictions", ["crime.convicted.total"], "per100k", { kind: "manual", start: 2001, end: 2025 }),
    }, await presentationFor("en"));
    expect(model.filename).toBe("fiscal-crime-convictions-per-100k-2001-2025-en.xlsx");
    const [row] = model.readable.rows;
    for (const year of [2001, 2002, 2003]) expect(row.valuesByYear[year], String(year)).toBeNull();
    expect(row.valuesByYear[2004]).toBe(230.4);
    expect(model.readable.numberFormat).toBe("#,##0.0");
    expect(model.readable.unitLabel).toBe("per 100,000 people");
    expect(model.readable.subtitle).toContain("calculated by fiscal.ge");
    expect(model.analysis.headers).toEqual(["Year", "Series", "Value", "Unit", "Status"]);
    expect(model.analysis.rows).toHaveLength(25);
    expect(model.analysis.rows.find(r => r[0] === 2002)).toEqual([2002, "People convicted", null, "per 100,000 people", "Not available"]);
    expect(model.analysis.rows.find(r => r[0] === 2004)).toEqual([2004, "People convicted", 230.4, "per 100,000 people", "Published"]);
    // The population workbook is cited for the years it supplied, besides the convictions workbooks.
    expect(model.sources.map(source => source.title).sort()).toEqual(["geostat_crime_convicts_types", "source.geostat_municipal_population"]);
    expect(model.sources.find(source => source.title === "source.geostat_municipal_population")!.years).toEqual(Array.from({ length: 22 }, (_, i) => 2004 + i));
    const excel = await loadWorkbook(model);
    const data = excel.getWorksheet(model.sheetNames[1])!;
    const rowOf = (year: number) => model.analysis.rows.findIndex(r => r[0] === year) + 2;
    expect(data.getCell(rowOf(2002), 3).value).toBeNull();
    expect(data.getCell(rowOf(2004), 3).value).toBe(230.4);
    expect(data.getCell(rowOf(2004), 3).numFmt).toBe("#,##0.0");
    expect(String(excel.getWorksheet(model.sheetNames[0])!.getCell("A2").value)).toContain("Rates per 100,000 people are calculated by fiscal.ge");
  });

  test("the rates note is in the reader's language and only on rates", async () => {
    const input = {
      section: "convictions", facts, population, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: LABELS, title: "Convictions",
    } as const;
    const range = { kind: "manual", start: 2010, end: 2020 } as const;
    const ka = buildCrimeWorkbookExportModel({ ...input, state: state("convictions", ["crime.convicted.total"], "per100k", range) }, await presentationFor("ka"));
    expect(ka.readable.subtitle).toContain("100 000 მოსახლეზე მაჩვენებლები fiscal.ge-მ გამოთვალა");
    expect(ka.filename).toBe("fiscal-crime-convictions-per-100k-2010-2020.xlsx");
    const count = buildCrimeWorkbookExportModel({ ...input, state: state("convictions", ["crime.convicted.total"], "count", range) }, await presentationFor("en"));
    expect(count.readable.subtitle).not.toContain("calculated");
    expect(count.sources.map(source => source.title)).toEqual(["geostat_crime_convicts_types"]);
  });

  test("a victims count workbook leaves 2012-2014 blank", async () => {
    const model = buildCrimeWorkbookExportModel({
      section: "victims", facts, population, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: LABELS, title: "Victims",
      state: state("victims", ["crime.victims.sex_women"], "count", { kind: "manual", start: 2010, end: 2016 }),
    }, await presentationFor("en"));
    expect(model.filename).toBe("fiscal-crime-victims-2010-2016-en.xlsx");
    const [row] = model.readable.rows;
    for (const year of [2012, 2013, 2014]) expect(row.valuesByYear[year], String(year)).toBeNull();
    expect(row.valuesByYear[2015]).toBeGreaterThan(0);
    expect(model.readable.numberFormat).toBe("#,##0");
    const data = (await loadWorkbook(model)).getWorksheet(model.sheetNames[1])!;
    const rowOf = (year: number) => model.analysis.rows.findIndex(r => r[0] === year) + 2;
    for (const year of [2012, 2013, 2014]) expect(data.getCell(rowOf(year), 3).value, String(year)).toBeNull();
    expect(model.analysis.rows.find(r => r[0] === 2013)).toEqual([2013, "Women", null, "persons", "Not available"]);
    expect(model.analysis.rows.find(r => r[0] === 2015)![4]).toBe("Published");
    expect(model.sources.map(source => source.title)).toEqual(["geostat_crime_victims"]);
  });

  test("a value without its source link fails loudly", async () => {
    expect(() => buildCrimeWorkbookExportModel({
      section: "victims", facts, population, sources: [], siteOrigin: "https://fiscal.ge", labels: LABELS, title: "Victims", state: state("victims", ["crime.victims.total"]),
    }, { locale: "en", englishLabels: {}, messages: CRIME_COPY.en })).toThrow(/geostat_crime_victims/);
  });
});

describe("hub cards", () => {
  test("five cards with each section's default series and its latest count", async () => {
    const cards = buildCrimeHubCards(facts, await presentationFor("en"));
    expect(cards.map(card => card.href)).toEqual(CRIME_SECTIONS.map(s => s.href));
    expect(cards.map(card => card.index)).toEqual(["01", "02", "03", "04", "05"]);
    expect(cards.map(card => card.title)).toEqual(["Recorded crime", "Convictions", "Prisons", "Victims", "Road accidents"]);
    expect(cards.map(card => card.description)).toEqual(CRIME_SECTIONS.map(s => `Summary of ${s.id}`));
    expect(cards.map(card => card.footer)).toEqual([
      "2025 · 54,134 · 2015–2025", "2025 · 22,767 · 2001–2025", "2025 · 11,153 · 2001–2025", "2025 · 17,209 · 2007–2025", "2025 · 5,969 · 2001–2025",
    ]);
    expect(cards.map(card => card.series!.at(-1))).toEqual([54134, 22767, 11153, 17209, 5969]);
    expect(cards.map(card => card.series!.length)).toEqual([11, 25, 25, 19, 25]);
    expect(cards.every(card => card.comingSoon === false && card.seriesColor === INK)).toBe(true);
  });
});
