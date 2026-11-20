// apps/web/tests/factQuery/topics/health.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedHealthData } from "../../../lib/data/health/importHealth";
import type { HealthArea, HealthFact, HealthSeriesBreak } from "../../../lib/data/health/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { healthCrawlStates, type HealthNationalSectionId } from "../../../lib/explorer/health";
import { HEALTH_DEATH_AREAS, healthDeathsCrawlStates } from "../../../lib/explorer/healthDeaths";
import { healthAreaLabels, healthDeathRatePageData, healthDeathsAreaPageData, healthNationalPageData, healthSources } from "../../../lib/explorer/healthPageData";
import { buildHealthWorkbookExportModel } from "../../../lib/explorer/healthWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { healthTopicAdapter } from "../../../lib/factQuery/topics/health";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import { breakBetween } from "../../../lib/factQuery/topics/store";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale } from "../../../lib/i18n/types";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ADJARA = "region.adjara";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const RATE = "health.death_rate.total";
const entityOf = (area: HealthArea) => (area === "georgia" ? GEORGIA_PLACE_ID : area);

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: { facts: HealthFact[]; breaks: HealthSeriesBreak[] };
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, areaId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && row.area_id === areaId && Number(row.year) === year)!;

beforeAll(async () => {
  [builds, served, csv] = await Promise.all([
    healthTopicAdapter.build(), loadServedHealthData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/health-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("health topic adapter", () => {
  it("is registered, reads the health source archive and builds the three Health pages", () => {
    expect(TOPIC_ADAPTERS).toContain(healthTopicAdapter);
    expect(healthTopicAdapter).toMatchObject({ family: "health", sourceArchive: ["health"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "health"));
    expect(builds.map((build) => build.page.datasetId)).toEqual(["health-doctors-hospitals", "health-illnesses", "health-causes-of-death"]);
  });

  it("serves Georgia on the national pages, and Georgia and the 11 regions on Causes of death", () => {
    expect(dataset("health-doctors-hospitals").entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
    expect(dataset("health-illnesses").entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
    const deaths = dataset("health-causes-of-death").entities;
    expect(deaths.map((entity) => entity.entityId)).toEqual(HEALTH_DEATH_AREAS.map(entityOf));
    expect(deaths).toHaveLength(12);
    expect(deaths[0]).toMatchObject({ entityType: "country", labelEn: "Georgia", labelKa: "საქართველო", parentEntityId: null });
    expect(deaths.find((entity) => entity.entityId === ADJARA)).toMatchObject({ entityType: "region", parentEntityId: GEORGIA_PLACE_ID });
    expect(builds.flatMap((build) => build.entities.map((entity) => entity.entityId)).filter((id) => id === "georgia" || /abkhazia/.test(id))).toEqual([]);
    expect(dataset("health-doctors-hospitals").series).toHaveLength(22);
    expect(dataset("health-illnesses").series).toHaveLength(25);
    expect(dataset("health-causes-of-death").series).toHaveLength(22);
  });

  it("serves the CSV's published figures in their stored unit, with no display multiplier", () => {
    const doctors = rowOf("health.staff.doctors", "georgia", 2020);
    expect(factOf("health-doctors-hospitals", GEORGIA_PLACE_ID, "health.staff.doctors", 2020)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "health.staff.doctors", year: 2020, value: Number(doctors.published_value), basis: "actual", status: "official", sourceIds: [doctors.source_id],
    });
    // Beds are stored in thousand (the page draws beds), visits in thousand (the page draws million): served as stored.
    const beds = rowOf("health.facilities.beds", "georgia", 2025);
    expect(factOf("health-doctors-hospitals", GEORGIA_PLACE_ID, "health.facilities.beds", 2025)).toMatchObject({ value: Number(beds.published_value), sourceIds: [beds.source_id] });
    expect(dataset("health-doctors-hospitals").series.find((series) => series.seriesId === "health.facilities.beds")).toMatchObject({ unit: "units_thousand", headingEn: "Beds" });
    expect(dataset("health-doctors-hospitals").series.find((series) => series.seriesId === "health.visits.outpatient")).toMatchObject({ unit: "visits_thousand", headingEn: null, headingKa: null });
    const adjara = rowOf("health.deaths.total", ADJARA, 2024);
    expect(factOf("health-causes-of-death", ADJARA, "health.deaths.total", 2024)).toMatchObject({ value: Number(adjara.published_value), status: "official", sourceIds: [adjara.source_id] });
    expect(dataset("health-causes-of-death").series.find((series) => series.seriesId === "health.deaths.covid19")).toMatchObject({ parentSeriesId: "health.deaths.total", isTotal: false });
  });

  it("serves nothing a page does not show: no ended nurse groups, no COVID-19 deaths before 2020, the death rate only in the years the index prints", () => {
    const staff = dataset("health-doctors-hospitals").series.map((series) => series.seriesId);
    for (const ended of ["nurses_doctor_assistants", "nurses_lab_assistants", "nurses_xray_assistants", "nurses_other"]) expect(staff).not.toContain(`health.staff.${ended}`);
    expect(dataset("health-causes-of-death").facts.filter((fact) => fact.seriesId === "health.deaths.covid19" && fact.year < 2020).every((fact) => fact.value === null)).toBe(true);
    const { regionMap } = healthDeathRatePageData(served.facts);
    const rateYears = [...new Set(dataset("health-causes-of-death").facts.filter((fact) => fact.seriesId === RATE).map((fact) => fact.year))];
    expect(rateYears).toEqual([regionMap.year]);
    expect(dataset("health-causes-of-death").facts.filter((fact) => fact.seriesId === RATE)).toHaveLength(12);
    // A national page's rows are Georgia's only, and Causes of death never lists a national page's row.
    expect(dataset("health-causes-of-death").series.every((series) => series.seriesId.startsWith("health.deaths.") || series.seriesId === RATE)).toBe(true);
  });

  it("serves the ICD-10 2006 groups as the page lists them: the combined group to 2005, the three groups from 2006, missing on the other side", () => {
    const illnesses = dataset("health-illnesses");
    const cell = (seriesId: string, year: number) => illnesses.facts.find((fact) => fact.seriesId === seriesId && fact.year === year);
    expect(cell("health.illness.nervous_sense_organs", 2005)!.value).not.toBeNull();
    expect(cell("health.illness.nervous_sense_organs", 2006)).toMatchObject({ value: null, sourceIds: [] });
    for (const id of ["nervous", "eye", "ear"]) {
      expect(cell(`health.illness.${id}`, 2005)!.value).toBeNull();
      expect(cell(`health.illness.${id}`, 2006)!.value).not.toBeNull();
    }
    const icd = illnesses.breaks.find((entry) => entry.breakId === "icd10_groups_2006")!;
    expect(icd.seriesIds).toEqual(["health.illness.nervous_sense_organs", "health.illness.nervous", "health.illness.eye", "health.illness.ear"]);
    expect(breakBetween(illnesses.breaks, "health.illness.nervous_sense_organs", 2002, 2005, "year")).toBeNull();
    expect(breakBetween(illnesses.breaks, "health.illness.eye", 2005, 2006, "year")?.breakId).toBe("icd10_groups_2006");
  });

  it("carries the 2012 and 2020 staff breaks onto every listed staff row, and no other dataset's", () => {
    const staff = dataset("health-doctors-hospitals");
    expect(staff.breaks.map((entry) => entry.breakId)).toEqual(["staff_definitions_2012", "staff_register_2020"]);
    for (const entry of staff.breaks) expect(entry.seriesIds).toEqual(staff.series.filter((series) => series.seriesId.startsWith("health.staff.")).map((series) => series.seriesId));
    expect(dataset("health-causes-of-death").breaks).toEqual([]);
  });

  it("names its units with the site's own unit words; none is a percent", () => {
    const units = new Set(builds.flatMap((build) => build.series.map((series) => series.unit)));
    expect([...units].sort()).toEqual(["per_1000_population", "persons", "persons_thousand", "units", "units_thousand", "visits_thousand"]);
    // A shared token takes the family-neutral word: beds are counted in thousand units.
    expect(testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units.units_thousand).toEqual({ labelKa: "ათასი ერთეული", labelEn: "thousand units" });
  });
});

describe("compare across the health breaks", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const pair = (datasetId: string, seriesId: string, fromYear: number, toYear: number): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds: [seriesId] }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };

  it("refuses doctors and medical nurses across 2012 and 2020, and compares them between", () => {
    for (const seriesId of ["health.staff.doctors", "health.staff.nurses_medical"]) {
      for (const [from, to, date] of [[2011, 2012, "2012-01-01"], [2019, 2020, "2020-01-01"], [2005, 2025, "2012-01-01"]] as const) {
        const refused = pair("health-doctors-hospitals", seriesId, from, to);
        expect(refused, `${seriesId} ${from}-${to}`).toMatchObject({ comparability: "not_comparable", absoluteChange: null, percentageChange: null });
        expect(refused.caveatIds).toContain("topic_series_break");
        expect(refused.reasonsEn[0]).toContain(`${date}: `);
      }
      expect(pair("health-doctors-hospitals", seriesId, 2012, 2019).comparability).toBe("comparable");
      expect(pair("health-doctors-hospitals", seriesId, 2020, 2025).comparability).toBe("comparable");
    }
    // Hospitals are not staff: no break touches them.
    expect(pair("health-doctors-hospitals", "health.facilities.hospitals", 2005, 2025).comparability).toBe("comparable");
  });

  it("refuses the three ICD-10 groups across 2020, compares them 2006 to 2019, and compares deaths, a count of registered events", () => {
    expect(pair("health-illnesses", "health.illness.nervous", 2006, 2019).comparability).toBe("comparable");
    expect(pair("health-illnesses", "health.illness.nervous", 2019, 2020).comparability).toBe("not_comparable");
    const deaths = pair("health-causes-of-death", "health.deaths.total", 2014, 2025);
    expect(deaths).toMatchObject({ comparability: "comparable", percentagePointChange: null });
    expect(deaths.percentageChange).not.toBeNull();
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages
// feed them (lib/pages/health.tsx, health-deaths.tsx; components/health/*-explorer.tsx's useCrawlModels).

/** A model's rows, named by the page's own labels: a label is read back to its series. */
function labelReader(labels: Readonly<Record<string, string>>, entityId: string) {
  const ids = new Map<string, string>();
  for (const [id, label] of Object.entries(labels)) {
    if (ids.has(label)) throw new Error(`Two series read ${label}`);
    ids.set(label, id);
  }
  return (row: WorkbookReadableRow): ParityTarget | null => (ids.has(row.label) ? { entityId, seriesId: ids.get(row.label)! } : null);
}
function matcher() {
  const readers = new Map<WorkbookExportModel, (row: WorkbookReadableRow) => ParityTarget | null>();
  const add = (model: WorkbookExportModel, reader: (row: WorkbookReadableRow) => ParityTarget | null) => {
    readers.set(model, reader);
    return model;
  };
  return { add, match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.(row) ?? null };
}
type Matcher = ReturnType<typeof matcher>;
const presentationOf = (locale: Locale) => getPresentation(locale, ["health", "regionalEconomies", "format", "main", "workbook"], HEALTH_DEATH_AREAS, HEALTH_DEATH_AREAS);

async function nationalModels(locale: Locale, section: HealthNationalSectionId, m: Matcher) {
  const presentation = await presentationOf(locale);
  const { facts, labels } = healthNationalPageData(served, presentation.messages, section);
  const sources = await healthSources(locale, facts);
  const reader = labelReader(labels, GEORGIA_PLACE_ID);
  return healthCrawlStates(section, facts).map((state) =>
    m.add(buildHealthWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin: ORIGIN, title: section }, presentation), reader));
}

/**
 * Each area page's crawl tables, and the index's death rates (health-deaths-index.tsx): the map's regions and Georgia's
 * lead row in the map's year and Georgia's latest line, as one model of rows keyed by area.
 */
async function deathsModels(locale: Locale, areas: readonly HealthArea[], m: Matcher) {
  const presentation = await presentationOf(locale);
  const models = await Promise.all(areas.map(async (area) => {
    const { facts, labels } = healthDeathsAreaPageData(served.facts, presentation.messages, area);
    const sources = await healthSources(locale, facts);
    const reader = labelReader(labels, entityOf(area));
    return healthDeathsCrawlStates(area, facts).map((state) =>
      m.add(buildHealthWorkbookExportModel({ section: "causes-of-death", area, facts, state, labels, sources, siteOrigin: ORIGIN, title: healthAreaLabels(presentation)[area] }, presentation), reader));
  }));
  const { georgiaRates, regionMap } = healthDeathRatePageData(served.facts);
  const latest = georgiaRates.toSorted((a, b) => a.year - b.year).at(-1)!;
  const rows: WorkbookReadableRow[] = [
    ...regionMap.regions.filter((region) => areas.includes(region.regionId as HealthArea)).map((region) => ({ kind: "item" as const, parentLabel: null, label: region.regionId, change: null, valuesByYear: { [regionMap.year]: region.value }, basisByYear: {} })),
    ...(areas.includes("georgia") ? [{ kind: "item" as const, parentLabel: null, label: "georgia", change: null, valuesByYear: { [regionMap.year]: georgiaRates.find((rate) => rate.year === regionMap.year)!.value, [latest.year]: latest.value }, basisByYear: {} }] : []),
  ];
  const rateModel = { ...models[0]![0]!, filename: "index [death rate]", readable: { ...models[0]![0]!.readable, rows } } satisfies WorkbookExportModel;
  return [...models.flat(), m.add(rateModel, (row) => ({ entityId: entityOf(row.label as HealthArea), seriesId: RATE }))];
}

describe("health parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of ["doctors-hospitals", "illnesses"] as const) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        const models = await nationalModels(locale, section, m);
        // Staff, then hospitals split by unit (facilities, beds, visits); Illnesses draws its groups and single diseases in one unit.
        expect(models).toHaveLength(section === "illnesses" ? 1 : 4);
        expectWorkbookParity(dataset(`health-${section}`), models, m.match);
      });
    }
    it(`causes of death (${locale}): Georgia and Adjara`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("health-causes-of-death"), await deathsModels(locale, ["georgia", ADJARA], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
    });
  }

  it("causes of death (en): every area", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("health-causes-of-death"), await deathsModels("en", HEALTH_DEATH_AREAS, m), m.match);
  });

  it("fails when a served value differs from the page's", async () => {
    const staff = dataset("health-doctors-hospitals");
    const facts = staff.facts.map((fact): TopicFact => (fact.year === 2015 && fact.seriesId === "health.facilities.beds" ? { ...fact, value: fact.value! * 1000 } : fact));
    const m = matcher();
    const models = await nationalModels("en", "doctors-hospitals", m);
    expect(() => expectWorkbookParity({ ...staff, facts }, models, m.match)).toThrow(/2015: the page prints [\d.]+, country.georgia health.facilities.beds serves/);
  });
});
