// apps/web/tests/factQuery/topics/crime.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedCrimeData, toClientCrimeFact } from "../../../lib/data/crime/importCrime";
import { CRIME_INDICATORS, CRIME_SOURCES, type CrimeFact } from "../../../lib/data/crime/types";
import { loadServedDemographyData } from "../../../lib/data/demography/importDemography";
import { SERIES } from "../../../lib/data/demography/series";
import { CRIME_SECTIONS, crimeCrawlStates, crimeSeries, type CrimePopulation, type CrimeSectionId } from "../../../lib/explorer/crime";
import { crimeLabels, crimePageFacts } from "../../../lib/explorer/crimePageData";
import { buildCrimeWorkbookExportModel } from "../../../lib/explorer/crimeWorkbook";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { crimeTopicAdapter } from "../../../lib/factQuery/topics/crime";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { message } from "../../../lib/i18n/messages";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale } from "../../../lib/i18n/types";
import { crimeSources } from "../../../lib/pages/crime-shared";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const SECTIONS = CRIME_SECTIONS.map((section) => section.id);

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: CrimeFact[];
let population: CrimePopulation;
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, seriesId: string, year: number) => dataset(id).facts.find((fact) => fact.entityId === GEORGIA_PLACE_ID && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && Number(row.year) === year);
const seriesOf = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);

beforeAll(async () => {
  let demography: Awaited<ReturnType<typeof loadServedDemographyData>>;
  [builds, { facts: served }, demography, csv] = await Promise.all([
    crimeTopicAdapter.build(), loadServedCrimeData(), loadServedDemographyData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/crime-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
  // As the page feeds its per-100,000 view (lib/pages/crime.tsx).
  population = demography.facts.filter((f) => f.seriesId === SERIES.populationTotal && f.geographyId === GEORGIA_PLACE_ID).map((f) => ({ year: f.year, persons: f.value }));
}, 60_000);

describe("crime topic adapter", () => {
  it("is registered, reads the crime source archive and builds the five Crime and justice pages for Georgia", () => {
    expect(TOPIC_ADAPTERS).toContain(crimeTopicAdapter);
    expect(crimeTopicAdapter).toMatchObject({ family: "crime", sourceArchive: ["crime"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "crime"));
    expect(builds.map((build) => [build.page.datasetId, build.titleEn, build.entities.length, build.series.length])).toEqual([
      ["crime-recorded", "Recorded crimes", 1, 12], ["crime-convictions", "Convictions", 1, 26], ["crime-prisons", "Prisons", 1, 7], ["crime-victims", "Victims", 1, 14], ["crime-road-accidents", "Road accidents", 1, 4],
    ]);
    for (const build of builds) expect(build.entities).toEqual([{ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null }]);
    // Every one of the 63 reviewed indicators is listed on exactly one page.
    expect(builds.flatMap((build) => build.series.map((series) => series.seriesId)).sort()).toEqual([...CRIME_INDICATORS].sort());
  });

  it("serves Geostat's published counts in each row's own unit, named and headed as the page lists them", () => {
    const recorded = rowOf("crime.recorded.total", 2024)!;
    expect(factOf("crime-recorded", "crime.recorded.total", 2024)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "crime.recorded.total", year: 2024, value: Number(recorded.published_value), basis: "actual", status: "official", sourceIds: [recorded.source_id],
    });
    const killed = rowOf("crime.road.killed", 2025)!;
    expect(factOf("crime-road-accidents", "crime.road.killed", 2025)).toMatchObject({ value: Number(killed.published_value), sourceIds: [killed.source_id] });
    expect(seriesOf("crime-recorded", "crime.recorded.total")).toMatchObject({ labelEn: "All recorded crimes", headingEn: null, isTotal: true, unit: "crimes", parentSeriesId: null });
    expect(seriesOf("crime-recorded", "crime.recorded.property")).toMatchObject({ headingEn: "Type of crime", headingKa: "დანაშაულის სახე", isTotal: false, unit: "crimes" });
    expect(seriesOf("crime-road-accidents", "crime.road.accidents")).toMatchObject({ headingEn: "Accidents", isTotal: true, unit: "accidents" });
    expect(seriesOf("crime-road-accidents", "crime.road.injured")).toMatchObject({ headingEn: "People", isTotal: false, unit: "persons" });
    const units = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units;
    expect([units.crimes, units.accidents, units.persons]).toEqual([
      { labelKa: "დანაშაული", labelEn: "crimes" }, { labelKa: "შემთხვევა", labelEn: "accidents" }, { labelKa: "ადამიანი", labelEn: "persons" },
    ]);
  });

  it("serves no rate per 100,000 people, and a year Geostat left blank as missing", () => {
    // The per-100,000 view is Fiscal.ge's division in the browser: no served value is a fraction of a count.
    for (const build of builds) for (const fact of build.facts) if (fact.value !== null) expect(Number.isInteger(fact.value), `${fact.seriesId} ${fact.year}`).toBe(true);
    for (const build of builds) expect(build.series.map((series) => series.unit).filter((unit) => !["crimes", "persons", "accidents"].includes(unit))).toEqual([]);
    // Victims by citizenship start later than the total: missing, never zero.
    const blank = dataset("crime-victims").facts.find((fact) => fact.value === null)!;
    expect(rowOf(blank.seriesId, blank.year)).toBeUndefined();
    expect(blank).toMatchObject({ sourceIds: [] });
    expect(dataset("crime-prisons").facts.filter((fact) => fact.value === null).length).toBe(18);
  });

  it("carries the 2018 registration change onto recorded crimes and the 2025 coverage change onto drunk-driving accidents", () => {
    expect(dataset("crime-recorded").breaks).toEqual([expect.objectContaining({ breakId: "registration_2018", referenceDate: "2018-01-01", seriesIds: crimeSeries("recorded").map((series) => series.id) })]);
    expect(dataset("crime-road-accidents").breaks).toEqual([expect.objectContaining({ breakId: "drunk_driving_coverage_2025", referenceDate: "2025-01-01", seriesIds: ["crime.road.accidents_drunk"] })]);
    for (const id of ["crime-convictions", "crime-prisons", "crime-victims"]) expect(dataset(id).breaks).toEqual([]);
  });
});

describe("compare and sources on the crime datasets", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const comparison = (datasetId: string, seriesId: string, fromYear: number, toYear: number): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds: [seriesId] }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };
  const published = (indicatorId: string, year: number) => Number(rowOf(indicatorId, year)!.published_value);

  it("refuses recorded crimes across the 2018 registration change and compares on either side of it", () => {
    const across = comparison("crime-recorded", "crime.recorded.total", 2017, 2018);
    expect(across).toMatchObject({ comparability: "not_comparable", absoluteChange: null, percentageChange: null });
    expect(across.caveatIds).toContain("topic_series_break");
    expect(across.reasonsEn[0]).toContain("2018-01-01: ");
    expect(comparison("crime-recorded", "crime.recorded.drugs", 2015, 2024).comparability).toBe("not_comparable");
    expect(comparison("crime-recorded", "crime.recorded.total", 2015, 2017).comparability).toBe("comparable");
    const after = comparison("crime-recorded", "crime.recorded.total", 2018, 2024);
    expect(after).toMatchObject({ comparability: "comparable", unit: "crimes", percentagePointChange: null });
    expect(after.absoluteChange).toBe(published("crime.recorded.total", 2024) - published("crime.recorded.total", 2018));
    expect(comparison("crime-road-accidents", "crime.road.accidents_drunk", 2024, 2025).comparability).toBe("not_comparable");
    expect(comparison("crime-road-accidents", "crime.road.accidents_drunk", 2015, 2024).comparability).toBe("comparable");
    expect(comparison("crime-road-accidents", "crime.road.accidents", 2024, 2025).comparability).toBe("comparable");
  });

  it("cites exactly the 7 Geostat workbooks the values are read from, resolved through get_sources", () => {
    const cited = [...new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "crime").flatMap((entry) => entry.columns.sources.flat()))].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual(CRIME_SOURCES.map((id) => `source.${id}`).sort());
    const prisons = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "crime-prisons")!;
    const response = getSources(snapshot, { sourceIds: ["source.geostat_crime_prison"], datasetId: "crime-prisons", years: [prisons.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const [source] = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(source!.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
  });
});

// Parity: the cells each dataset serves are the cells the page's own workbook models print, fed exactly as the page feeds
// them (lib/pages/crime.tsx; components/crime/crime-explorer.tsx's useCrawlModels), counts only: the per-100,000 tables
// are Fiscal.ge's division and are not served.

type Reader = (row: WorkbookReadableRow) => ParityTarget | null;
function matcher() {
  const readers = new Map<WorkbookExportModel, Reader>();
  const add = (model: WorkbookExportModel, reader: Reader) => {
    readers.set(model, reader);
    return model;
  };
  return { add, match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.(row) ?? null };
}
type Matcher = ReturnType<typeof matcher>;

/** A table's rows are its selected series in list order (labels repeat across headings: Victims' three "Unknown" rows); each row's label is checked. */
function rowsReader(model: WorkbookExportModel, ids: readonly string[], labels: Readonly<Record<string, string>>): Reader {
  return (row) => {
    const id = ids[model.readable.rows.indexOf(row)];
    return id !== undefined && labels[id] === row.label ? { entityId: GEORGIA_PLACE_ID, seriesId: id } : null;
  };
}

async function sectionModels(locale: Locale, section: CrimeSectionId, m: Matcher) {
  const presentation = await getPresentation(locale, ["crime", "format", "main", "workbook"], []);
  const pageFacts = crimePageFacts(served, section), facts = pageFacts.map(toClientCrimeFact);
  const [labels, sources] = [crimeLabels(presentation.messages, section), await crimeSources(locale, facts)];
  const title = message(presentation.messages, `crime.page.${section}.title`);
  const states = crimeCrawlStates(section, facts, population);
  expect(states.some((state) => state.measure === "per100k")).toBe(true);
  return states.filter((state) => state.measure === "count").map((state) => {
    const ids = crimeSeries(section).map((series) => series.id).filter((id) => state.selectedIds.includes(id));
    const model = buildCrimeWorkbookExportModel({ section, facts, population, state, labels, sources, siteOrigin: ORIGIN, title }, presentation);
    return m.add(model, rowsReader(model, ids, labels));
  });
}

describe("crime parity with the page's workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of SECTIONS) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`crime-${section}`), await sectionModels(locale, section, m), m.match);
      });
    }
  }

  it("fails when a served count is not the one the page prints", async () => {
    const recorded = dataset("crime-recorded");
    const facts = recorded.facts.map((fact): TopicFact => (fact.year === 2024 && fact.seriesId === "crime.recorded.total" ? { ...fact, value: fact.value! + 1 } : fact));
    const m = matcher();
    const models = await sectionModels("en", "recorded", m);
    expect(() => expectWorkbookParity({ ...recorded, facts }, models, m.match)).toThrow(/2024: the page prints \d+, country.georgia crime.recorded.total serves/);
  });
});
