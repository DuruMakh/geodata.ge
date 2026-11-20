// apps/web/tests/factQuery/topics/livingStandards.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedHouseholdData, toClientHouseholdFact } from "../../../lib/data/household/importHousehold";
import { WAGES_REGIONS } from "../../../lib/data/wages/types";
import type { HouseholdArea, HouseholdFact } from "../../../lib/data/household/types";
import { loadServedPovertyData } from "../../../lib/data/poverty/importPoverty";
import type { PovertyFact } from "../../../lib/data/poverty/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { HOUSEHOLD_PAGE_AREAS, householdCrawlStates, householdViewSeries, type HouseholdSectionId } from "../../../lib/explorer/household";
import { householdAreaLabels, householdLabels, householdPageFilter } from "../../../lib/explorer/householdPageData";
import { buildHouseholdWorkbookExportModel, isHouseholdWorkbookSource } from "../../../lib/explorer/householdWorkbook";
import { povertyCrawlStates, povertyViewSeries, type PovertySectionId } from "../../../lib/explorer/poverty";
import { povertyLabels, povertyPageFacts } from "../../../lib/explorer/povertyPageData";
import { buildPovertyWorkbookExportModel } from "../../../lib/explorer/povertyWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { queryIndicators } from "../../../lib/factQuery/queryIndicators";
import { livingStandardsTopicAdapter } from "../../../lib/factQuery/topics/livingStandards";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import { isTopicPercentUnit } from "../../../lib/factQuery/topics/store";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { Observation } from "../../../lib/factQuery/observations";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { message } from "../../../lib/i18n/messages";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale } from "../../../lib/i18n/types";
import { loadSourcedWorkbookSources } from "../../../lib/methodology/workbookSources";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ADJARA = "region.adjara";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const HOUSEHOLD_SECTIONS = ["income", "spending"] as const satisfies readonly HouseholdSectionId[];
const POVERTY_DATASETS = { rates: "living-standards-poverty", inequality: "living-standards-inequality" } as const satisfies Record<PovertySectionId, string>;

type CsvRow = Record<string, string>;
let householdCsv: CsvRow[];
let povertyCsv: CsvRow[];
let builds: TopicDatasetBuild[];
let household: HouseholdFact[];
let poverty: PovertyFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const householdRow = (indicatorId: string, areaId: string, measure: string, year: number) =>
  householdCsv.find((row) => row.indicator_id === indicatorId && row.area_id === areaId && row.measure === measure && Number(row.year) === year)!;
const povertyRow = (indicatorId: string, groupId: string, year: number) =>
  povertyCsv.find((row) => row.indicator_id === indicatorId && row.group_id === groupId && Number(row.year) === year)!;
const readCsv = (file: string) => readFile(path.resolve(process.cwd(), `../../data/imports/${file}`)).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]);

beforeAll(async () => {
  let servedHousehold: { facts: HouseholdFact[] }, servedPoverty: { facts: PovertyFact[] };
  [builds, servedHousehold, servedPoverty, householdCsv, povertyCsv] = await Promise.all([
    livingStandardsTopicAdapter.build(), loadServedHouseholdData(), loadServedPovertyData(), readCsv("household-income-spending-annual.csv"), readCsv("poverty-annual.csv"),
  ]);
  household = servedHousehold.facts;
  poverty = servedPoverty.facts;
}, 60_000);

describe("living-standards topic adapter", () => {
  it("is registered, reads the household and poverty source archives and builds the four Living standards pages", () => {
    expect(TOPIC_ADAPTERS).toContain(livingStandardsTopicAdapter);
    expect(livingStandardsTopicAdapter).toMatchObject({ family: "living-standards", sourceArchive: ["household-income", "poverty"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "living-standards"));
    // Income: 12 lines and Georgia's towns and villages, per household and per person; Spending: 15 lines and the two.
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length])).toEqual([
      ["living-standards-income", 12, 28], ["living-standards-spending", 12, 34], ["living-standards-poverty", 1, 17], ["living-standards-inequality", 1, 6],
    ]);
  });

  it("serves Georgia and the 11 regions, each its area page, on Income and Spending, and Georgia on Poverty and Inequality", () => {
    for (const section of HOUSEHOLD_SECTIONS) {
      const entities = dataset(`living-standards-${section}`).entities;
      expect(entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID, ...WAGES_REGIONS]);
      expect(entities[0]).toEqual({ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null });
      expect(entities.find((entity) => entity.entityId === ADJARA)).toMatchObject({ entityType: "region", labelEn: "Adjara", parentEntityId: GEORGIA_PLACE_ID });
    }
    for (const id of Object.values(POVERTY_DATASETS)) expect(dataset(id).entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
  });

  it("serves Geostat's published per-household and per-person figures, in GEL a month", () => {
    for (const measure of ["per_household", "per_capita"] as const) {
      const row = householdRow("income.total", "georgia", measure, 2024);
      expect(factOf("living-standards-income", GEORGIA_PLACE_ID, `income.total.${measure}`, 2024)).toEqual({
        entityId: GEORGIA_PLACE_ID, seriesId: `income.total.${measure}`, year: 2024, value: Number(row.published_value), basis: "actual", status: "survey_estimate", sourceIds: [row.source_id],
      });
    }
    const adjara = householdRow("spending.food", ADJARA, "per_capita", 2025);
    expect(factOf("living-standards-spending", ADJARA, "spending.food.per_capita", 2025)).toMatchObject({ value: Number(adjara.published_value), sourceIds: ["geostat_household_spending_capita_region"] });
    expect(factOf("living-standards-income", GEORGIA_PLACE_ID, "income.total.settlement.rural.per_household", 2024)!.value).toBe(Number(householdRow("income.total", "settlement.rural", "per_household", 2024).published_value));
    const series = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);
    expect(series("living-standards-income", "income.total.per_capita")).toMatchObject({ labelEn: "Total income", headingEn: "Per person", headingKa: "ერთ სულზე", isTotal: true, parentSeriesId: null, unit: "gel_month" });
    expect(series("living-standards-income", "income.remittances.per_capita")).toMatchObject({ labelEn: "Money from abroad", parentSeriesId: "income.total.per_capita", isTotal: false });
    expect(series("living-standards-spending", "spending.consumption.settlement.urban.per_household")).toMatchObject({ labelEn: "Consumption spending — Towns", labelKa: "სამომხმარებლო ხარჯები, სულ — ქალაქი", parentSeriesId: null });
    expect(testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units.gel_month).toEqual({ labelKa: "ლარი თვეში", labelEn: "GEL a month" });
  });

  it("serves poverty rates in % and Gini coefficients as a unitless index, Geostat's published figures", () => {
    const rate = povertyRow("poverty.absolute", "age.0_17", 2024);
    expect(factOf("living-standards-poverty", GEORGIA_PLACE_ID, "poverty.absolute.age.0_17", 2024)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "poverty.absolute.age.0_17", year: 2024, value: Number(rate.published_value), basis: "actual", status: "survey_estimate", sourceIds: [rate.source_id],
    });
    const gini = povertyRow("gini.total_income", "georgia", 2024);
    expect(factOf("living-standards-inequality", GEORGIA_PLACE_ID, "gini.total_income", 2024)).toMatchObject({ value: Number(gini.published_value), sourceIds: ["geostat_gini"] });
    const units = (id: string) => [...new Set(dataset(id).series.map((series) => series.unit))];
    expect(units("living-standards-poverty")).toEqual(["percent"]);
    expect(units("living-standards-inequality")).toEqual(["index"]);
    expect(isTopicPercentUnit("percent")).toBe(true);
    expect(isTopicPercentUnit("index")).toBe(false);
    // The family-neutral name of the token, not the Poverty page's "Gini coefficient (0–1)".
    expect(testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units.index).toEqual({ labelKa: "ინდექსი", labelEn: "index" });
    const series = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);
    expect(series("living-standards-poverty", "poverty.absolute")).toMatchObject({ labelEn: "Georgia", headingEn: "Poverty line", isTotal: true, parentSeriesId: null });
    expect(series("living-standards-poverty", "poverty.relative_40.settlement.rural")).toMatchObject({ labelEn: "Below 40%: villages", headingKa: "ფარდობითი სიღარიბე", headingEn: "Relative poverty", parentSeriesId: "poverty.relative_40" });
    expect(series("living-standards-poverty", "poverty.international_300")).toMatchObject({ headingEn: "International lines", isTotal: false, parentSeriesId: null });
    expect(series("living-standards-inequality", "gini.total_income")).toMatchObject({ labelEn: "By total income", headingEn: "Gini coefficient", headingKa: "ჯინის კოეფიციენტი", isTotal: false });
  });

  it("serves nothing the pages do not show", () => {
    // The CSV holds every line for towns and villages; Georgia's page lists only their section totals.
    expect(householdCsv.some((row) => row.indicator_id === "income.wages" && row.area_id === "settlement.urban")).toBe(true);
    const ids = dataset("living-standards-income").series.map((series) => series.seriesId);
    expect(ids.filter((id) => id.includes("settlement"))).toEqual(["income.total.settlement.urban.per_household", "income.total.settlement.rural.per_household", "income.total.settlement.urban.per_capita", "income.total.settlement.rural.per_capita"]);
    // Towns and villages are lines of Georgia's page, not areas with a page of their own.
    for (const section of HOUSEHOLD_SECTIONS) expect(dataset(`living-standards-${section}`).entities.map((entity) => entity.entityId).filter((id) => id.includes("settlement"))).toEqual([]);
    // The regions' survey figures start in 2011; Georgia's list starts earlier.
    expect(householdCsv.some((row) => row.area_id === ADJARA && Number(row.year) < 2011)).toBe(false);
    expect(dataset("living-standards-income").facts.filter((fact) => fact.entityId === ADJARA).every((fact) => fact.year >= 2011)).toBe(true);
    // The international lines end a year before the national ones, and so does their tab: no year the tab does not print.
    expect(povertyCsv.some((row) => row.indicator_id === "poverty.international_300" && row.year === "2025")).toBe(false);
    expect(factOf("living-standards-poverty", GEORGIA_PLACE_ID, "poverty.absolute", 2025)!.value).toBe(Number(povertyRow("poverty.absolute", "georgia", 2025).published_value));
    expect(factOf("living-standards-poverty", GEORGIA_PLACE_ID, "poverty.international_300", 2025)).toBeUndefined();
    for (const id of Object.values(POVERTY_DATASETS)) expect(dataset(id).breaks).toEqual([]);
  });
});

describe("compare and query_indicators on the living-standards datasets", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const comparison = (datasetId: string, seriesId: string, fromYear: number, toYear: number, entityIds?: string[]): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds: [seriesId], ...(entityIds ? { entityIds } : {}) }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };
  const published = (row: CsvRow) => Number(row.published_value);

  it("gives a poverty rate a percentage-point change and no percentage change (R19)", () => {
    const rate = comparison("living-standards-poverty", "poverty.absolute", 2015, 2024);
    expect(rate).toMatchObject({ unit: "percent", comparability: "comparable", absoluteChange: null, percentageChange: null });
    expect(rate.percentagePointChange).toBeCloseTo(published(povertyRow("poverty.absolute", "georgia", 2024)) - published(povertyRow("poverty.absolute", "georgia", 2015)), 9);
  });

  it("gives a Gini coefficient an absolute and a percentage change, never percentage points", () => {
    const gini = comparison("living-standards-inequality", "gini.total_income", 2010, 2024);
    const [from, to] = [published(povertyRow("gini.total_income", "georgia", 2010)), published(povertyRow("gini.total_income", "georgia", 2024))];
    expect(gini).toMatchObject({ unit: "index", comparability: "comparable", percentagePointChange: null });
    expect(gini.absoluteChange).toBeCloseTo(to - from, 9);
    expect(gini.percentageChange).toBeCloseTo(((to - from) / from) * 100, 6);
  });

  it("gives a per-person amount an absolute and a percentage change", () => {
    const amount = comparison("living-standards-spending", "spending.consumption.per_capita", 2015, 2024, [ADJARA]);
    expect(amount).toMatchObject({ unit: "gel_month", comparability: "comparable", percentagePointChange: null });
    expect(amount.absoluteChange).toBeCloseTo(published(householdRow("spending.consumption", ADJARA, "per_capita", 2024)) - published(householdRow("spending.consumption", ADJARA, "per_capita", 2015)), 6);
  });

  it("names a Gini observation under its heading, in the unitless index", () => {
    const response = queryIndicators(snapshot, { datasetId: "living-standards-inequality", seriesIds: ["gini.total_expenditure"], years: [2024] });
    const [observation] = (response as { data: { observations: Observation[] } }).data.observations;
    expect(observation).toMatchObject({ entityId: GEORGIA_PLACE_ID, unit: "index", seriesLabelEn: "Gini coefficient — By total expenditure", value: published(povertyRow("gini.total_expenditure", "georgia", 2024)) });
    expect(observation!.valueDefinitionEn).toContain("index");
  });

  it("resolves the cited Geostat workbooks through get_sources", () => {
    const inequality = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "living-standards-inequality")!;
    const cited = [...new Set(inequality.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!);
    expect(cited).toEqual(["source.geostat_gini"]);
    const response = getSources(snapshot, { sourceIds: cited, datasetId: "living-standards-inequality", years: [inequality.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const [source] = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(source).toMatchObject({ sourceId: "source.geostat_gini" });
    expect(source!.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
    const income = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "living-standards-income")!;
    expect([...new Set(income.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!).sort()).toEqual(
      ["capita", "household"].flatMap((measure) => ["national", "region", "settlement"].map((area) => `source.geostat_household_income_${measure}_${area}`)).sort());
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/household-shared.tsx, household.tsx, poverty.tsx; components/household/household-explorer.tsx and
// components/poverty/poverty-explorer.tsx's useCrawlModels). The section index pages draw a map and a list of the area
// pages' figures.

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

async function householdModels(locale: Locale, section: HouseholdSectionId, areas: readonly HouseholdArea[], m: Matcher, facts = household) {
  const [presentation, sources] = await Promise.all([
    getPresentation(locale, ["household", "regionalEconomies", "format", "main", "workbook"], HOUSEHOLD_PAGE_AREAS, HOUSEHOLD_PAGE_AREAS),
    loadSourcedWorkbookSources("household-income", locale, isHouseholdWorkbookSource),
  ]);
  const areaLabels = householdAreaLabels(presentation);
  const labels: Record<string, string> = { ...householdLabels(presentation, section), ...areaLabels };
  const title = message(presentation.messages, `household.page.${section}.title`);
  return areas.flatMap((area) => {
    const pageFacts = facts.map(toClientHouseholdFact).filter(householdPageFilter(section, area));
    const definitions = householdViewSeries(section, area);
    const entityId = area === "georgia" ? GEORGIA_PLACE_ID : area;
    return householdCrawlStates(section, area, pageFacts).map((state) =>
      m.add(buildHouseholdWorkbookExportModel({ section, area, facts: pageFacts, state, labels, areaLabel: areaLabels[area], sources, siteOrigin: ORIGIN, title }, presentation), (row) => {
        const series = definitions.find((candidate) => labels[candidate.id] === row.label && (candidate.parentId ? labels[candidate.parentId] === row.parentLabel : row.parentLabel === null));
        return series ? { entityId, seriesId: [series.indicatorId, series.areaId === area ? null : series.areaId, state.measure].filter(Boolean).join(".") } : null;
      }));
  });
}

async function povertyModels(locale: Locale, section: PovertySectionId, m: Matcher) {
  const [presentation, sources] = await Promise.all([getPresentation(locale, ["poverty", "format", "main", "workbook"], []), loadSourcedWorkbookSources("poverty", locale)]);
  const facts = povertyPageFacts(poverty, section), labels = povertyLabels(presentation, section);
  const title = message(presentation.messages, `poverty.page.${section}.title`);
  return povertyCrawlStates(section, facts).map((state) =>
    m.add(buildPovertyWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin: ORIGIN, title }, presentation), (row) => {
      const series = povertyViewSeries(section, state.view).find((candidate) => labels[candidate.id] === row.label);
      return series ? { entityId: GEORGIA_PLACE_ID, seriesId: series.groupId === "georgia" ? series.indicatorId : `${series.indicatorId}.${series.groupId}` } : null;
    }));
}

describe("living-standards parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of HOUSEHOLD_SECTIONS) {
      it(`${section} (${locale}): Georgia's and Adjara's area pages`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`living-standards-${section}`), await householdModels(locale, section, ["georgia", ADJARA], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
      });
    }
    for (const [section, id] of Object.entries(POVERTY_DATASETS) as [PovertySectionId, string][]) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(id), await povertyModels(locale, section, m), m.match);
      });
    }
  }

  it.each(HOUSEHOLD_SECTIONS)("%s (en): every area page", async (section) => {
    const m = matcher();
    expectWorkbookParity(dataset(`living-standards-${section}`), await householdModels("en", section, HOUSEHOLD_PAGE_AREAS, m), m.match);
  });

  it("fails when a per-person figure is served as the per-household one", async () => {
    const income = dataset("living-standards-income");
    const perHousehold = new Map(income.facts.filter((fact) => fact.seriesId === "income.total.per_household").map((fact) => [`${fact.entityId}:${fact.year}`, fact.value]));
    const facts = income.facts.map((fact): TopicFact => (fact.seriesId === "income.total.per_capita" && fact.entityId === GEORGIA_PLACE_ID && fact.year === 2024 ? { ...fact, value: perHousehold.get(`${GEORGIA_PLACE_ID}:2024`)! } : fact));
    const m = matcher();
    const models = await householdModels("en", "income", ["georgia"], m);
    expect(() => expectWorkbookParity({ ...income, facts }, models, m.match, [GEORGIA_PLACE_ID])).toThrow(/2024: the page prints [\d.]+, country.georgia income.total.per_capita serves/);
  });

  it("fails when a stored (unrounded) Gini value is served instead of the published one", async () => {
    const inequality = dataset("living-standards-inequality");
    const stored = poverty.find((fact) => fact.indicatorId === "gini.total_income" && fact.year === 2024)!;
    expect(Number(stored.value)).not.toBe(Number(stored.publishedValue));
    const facts = inequality.facts.map((fact): TopicFact => (fact.seriesId === "gini.total_income" && fact.year === 2024 ? { ...fact, value: Number(stored.value) } : fact));
    const m = matcher();
    const models = await povertyModels("en", "inequality", m);
    expect(() => expectWorkbookParity({ ...inequality, facts }, models, m.match)).toThrow(/2024: the page prints [\d.]+, country.georgia gini.total_income serves/);
  });
});
