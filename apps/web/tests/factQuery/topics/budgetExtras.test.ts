// apps/web/tests/factQuery/topics/budgetExtras.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import type { SectorDefinition, ServedSectorObservation } from "../../../lib/data/economicSectors/types";
import { EXPENDITURE_TYPES, loadServedExpenditureTypesData } from "../../../lib/data/expenditureTypes/importExpenditureTypes";
import { GDP_EXPENDITURE, loadServedGdpExpenditureData } from "../../../lib/data/gdpExpenditure/importGdpExpenditure";
import { loadServedExplorerData } from "../../../lib/data/servedData";
import { loadServedTaxBreaksRefundsData, toClientTaxBreaksRefundsFact } from "../../../lib/data/taxBreaksRefunds/importTaxBreaksRefunds";
import { projectGdpFact, projectSectorObservation, sourceIdByMeasure } from "../../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { buildEconomicSectorsModel, sectorCrawlStates, sectorMeasureStates, type SectorPageConfig, type SectorState } from "../../../lib/explorer/economicSectors";
import { buildEconomicSectorsWorkbookExportModel } from "../../../lib/explorer/economicSectorsWorkbook";
import { EXPENDITURE_TYPES_PAGE_CONFIG } from "../../../lib/explorer/expenditureTypes";
import { GDP_EXPENDITURE_PAGE_CONFIG } from "../../../lib/explorer/gdpExpenditure";
import { buildTaxBreaksRefundsModel, taxBreaksRefundsCrawlStates, taxBreaksRefundsNames } from "../../../lib/explorer/taxBreaksRefunds";
import { buildTaxBreaksRefundsWorkbookExportModel } from "../../../lib/explorer/taxBreaksRefundsWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { describeCoverage } from "../../../lib/factQuery/describeCoverage";
import { getSources } from "../../../lib/factQuery/getSources";
import type { Observation } from "../../../lib/factQuery/observations";
import { queryIndicators } from "../../../lib/factQuery/queryIndicators";
import { budgetExtrasTopicAdapter } from "../../../lib/factQuery/topics/budgetExtras";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { FactQueryResponse, FactQuerySnapshot } from "../../../lib/factQuery/types";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale } from "../../../lib/i18n/types";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const DATASETS = ["expenditure-types", "tax-breaks-refunds", "economy-expenditure"];

type CsvRow = Record<string, string>;
let builds: TopicDatasetBuild[];
const csv: Record<string, CsvRow[]> = {};
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, seriesId: string, year: number) => dataset(id).facts.find((fact) => fact.entityId === GEORGIA_PLACE_ID && fact.seriesId === seriesId && fact.year === year);
const seriesOf = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);
const csvRow = (file: string, test: (row: CsvRow) => boolean) => csv[file]!.find(test)!;

beforeAll(async () => {
  const files = ["expenditure-types-annual", "tax-breaks-refunds-annual", "gdp-expenditure-annual"];
  const [built, ...texts] = await Promise.all([budgetExtrasTopicAdapter.build(), ...files.map((file) => readFile(path.resolve(process.cwd(), `../../data/imports/${file}.csv`)))]);
  builds = built;
  files.forEach((file, index) => { csv[file] = parse(texts[index]!, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]; });
}, 120_000);

describe("budget-extras topic adapter", () => {
  it("is registered, reads the three pages' source archives and builds Spending by type, Tax breaks and refunds and GDP by expenditure, each Georgia's", () => {
    expect(TOPIC_ADAPTERS).toContain(budgetExtrasTopicAdapter);
    expect(budgetExtrasTopicAdapter).toMatchObject({ family: "budget-extras", sourceArchive: ["expenditure-types", "tax-breaks-refunds", "gdp-expenditure"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "budget-extras"));
    // Spending by type: 10 rows × (amount, share of GDP). Tax breaks and refunds: the list's 16 series. GDP by expenditure:
    // 16 rows in amounts and shares (no combined households and non-profits), 14 in real growth (households and
    // non-profits only together, no inventories).
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length, build.facts.length])).toEqual([
      ["expenditure-types", 1, 20, 480], ["tax-breaks-refunds", 1, 16, 288], ["economy-expenditure", 1, 46, 722],
    ]);
    for (const build of builds) {
      expect(build.entities).toEqual([{ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null }]);
      expect(build.breaks).toEqual([]);
    }
    expect(builds.map((build) => [build.titleEn, build.titleKa])).toEqual([
      ["Government spending by type", "ხარჯები ეკონომიკური კლასიფიკაციით"], ["Tax breaks and refunds", "საგადასახადო შეღავათები და დაბრუნება"], ["GDP by expenditure", "მშპ დანახარჯების მიხედვით"],
    ]);
    // The CSVs' own unit tokens: GEL amounts and % shares and growth rates; tax breaks and refunds in million GEL.
    expect(Object.fromEntries(builds.map((build) => [build.page.datasetId, [...new Set(build.series.map((series) => series.unit))]]))).toEqual({
      "expenditure-types": ["gel", "percent"], "tax-breaks-refunds": ["gel_million"], "economy-expenditure": ["gel", "percent"],
    });
    // "gel" is now annual amounts as well as monthly wages and benefits: its name is the neutral one.
    const units = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units;
    expect(units.gel).toEqual({ labelKa: "₾", labelEn: "GEL" });
    expect(units.gel_million).toEqual({ labelKa: "მლნ ლარი", labelEn: "million GEL" });
  });

  it("serves each figure as its CSV row stores it", () => {
    const wages = csvRow("expenditure-types-annual", (row) => row.series_id === "spending_type.compensation" && row.measure === "nominal" && row.year === "2025");
    expect(factOf("expenditure-types", "spending_type.compensation.nominal", 2025)).toEqual({ entityId: GEORGIA_PLACE_ID, seriesId: "spending_type.compensation.nominal", year: 2025, value: Number(wages.value), basis: "published", status: "official", sourceIds: ["source.mof_gfs_general_government_2002_2025"] });
    const share = csvRow("expenditure-types-annual", (row) => row.series_id === "spending_type.total" && row.measure === "share_of_gdp" && row.year === "2025");
    expect(factOf("expenditure-types", "spending_type.total.share_of_gdp", 2025)).toMatchObject({ value: Number(share.value), basis: "preliminary", status: "derived" });
    const vat = csvRow("tax-breaks-refunds-annual", (row) => row.indicator_id === "tax_breaks.vat.total" && row.year === "2024");
    expect(factOf("tax-breaks-refunds", "tax_breaks.vat.total", 2024)).toEqual({ entityId: GEORGIA_PLACE_ID, seriesId: "tax_breaks.vat.total", year: 2024, value: Number(vat.value), basis: "actual", status: "official", sourceIds: ["source.mof_tax_expenditure_report_2024_xlsx_ka"] });
    const refunds = csvRow("tax-breaks-refunds-annual", (row) => row.indicator_id === "tax_refunds.total" && row.year === "2025");
    expect(factOf("tax-breaks-refunds", "tax_refunds.total", 2025)).toMatchObject({ value: Number(refunds.value), sourceIds: ["source.treasury_tax_refunds_chart"] });
    const households = csvRow("gdp-expenditure-annual", (row) => row.series_id === "gdp_use.households" && row.measure === "nominal" && row.year === "2024");
    expect(factOf("economy-expenditure", "gdp_use.households.nominal", 2024)).toMatchObject({ value: Number(households.value), basis: "published", status: "official", sourceIds: ["source.geostat_gdp_use_current"] });
    const growth = csvRow("gdp-expenditure-annual", (row) => row.series_id === "gdp_use.households_npish" && row.measure === "real_growth" && row.year === "2025");
    expect(factOf("economy-expenditure", "gdp_use.households_npish.real_growth", 2025)).toMatchObject({ value: Number(growth.value), basis: "preliminary", status: "derived", sourceIds: ["source.geostat_gdp_use_growth"] });
    expect(seriesOf("expenditure-types", "spending_type.compensation.nominal")).toEqual({
      seriesId: "spending_type.compensation.nominal", labelKa: "შრომის ანაზღაურება", labelEn: "Wages and salaries", headingKa: "მიმდინარე ხარჯები", headingEn: "Running costs",
      parentSeriesId: "spending_type.total.nominal", isTotal: false, unit: "gel",
    });
    expect(seriesOf("expenditure-types", "spending_type.total.share_of_gdp")).toMatchObject({ labelEn: "Total spending", headingEn: null, parentSeriesId: null, isTotal: true, unit: "percent" });
    expect(seriesOf("economy-expenditure", "economy.gdp_total.real_growth")).toMatchObject({ labelEn: "Total GDP", isTotal: true, unit: "percent" });
    expect(seriesOf("tax-breaks-refunds", "tax_breaks.vat.medicines")).toMatchObject({ labelEn: "Medicines", headingEn: "VAT", headingKa: "დღგ", parentSeriesId: "tax_breaks.vat.total", isTotal: false });
    expect(seriesOf("tax-breaks-refunds", "tax_breaks.income.total")).toMatchObject({ parentSeriesId: "tax_breaks.total", isTotal: false });
    expect(dataset("tax-breaks-refunds").series.filter((series) => series.isTotal).map((series) => series.seriesId)).toEqual(["tax_breaks.total", "tax_refunds.total"]);
  });

  it("serves only the measures the CSVs store: every stored row once, no share of GDP the browser divides", () => {
    for (const [id, file] of [["expenditure-types", "expenditure-types-annual"], ["economy-expenditure", "gdp-expenditure-annual"]] as const) {
      const served = dataset(id).facts.filter((fact) => fact.value !== null).map((fact) => `${fact.seriesId}:${fact.year}:${fact.value}`).sort();
      expect(served, id).toEqual(csv[file]!.map((row) => `${row.series_id}.${row.measure}:${row.year}:${Number(row.value)}`).sort());
      // A share or growth rate is Fiscal.ge's calculation from the source's figures; a preliminary CSV year is preliminary.
      for (const fact of dataset(id).facts.filter((entry) => entry.value !== null)) {
        const row = csv[file]!.find((entry) => `${entry.series_id}.${entry.measure}` === fact.seriesId && Number(entry.year) === fact.year)!;
        expect([fact.status, fact.basis], `${fact.seriesId} ${fact.year}`).toEqual([row.calculation === "published" ? "official" : "derived", row.status]);
      }
    }
    // Tax breaks and refunds: the 123 stored amounts, nothing else; every other year of the list is missing, not zero.
    const taxBreaks = dataset("tax-breaks-refunds").facts;
    expect(taxBreaks.filter((fact) => fact.value !== null).map((fact) => `${fact.seriesId}:${fact.year}:${fact.value}`).sort()).toEqual(csv["tax-breaks-refunds-annual"]!.map((row) => `${row.indicator_id}:${row.year}:${Number(row.value)}`).sort());
    expect(taxBreaks.filter((fact) => fact.value !== null)).toHaveLength(123);
    expect(taxBreaks.filter((fact) => fact.value === null).every((fact) => fact.sourceIds.length === 0)).toBe(true);
    expect(new Set(taxBreaks.filter((fact) => fact.value !== null).map((fact) => `${fact.basis}:${fact.status}`))).toEqual(new Set(["actual:official"]));
    expect(dataset("tax-breaks-refunds").series.some((series) => series.unit === "percent")).toBe(false);
  });
});

describe("the measures over the tools", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const observations = (response: FactQueryResponse) => (response as { data: { observations: Observation[] } }).data.observations;
  const comparison = (datasetId: string, seriesId: string, fromYear: number, toYear: number): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds: [seriesId] }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };

  it("marks a share of GDP as Fiscal.ge's calculation, its preliminary year preliminary, and compares shares in percentage points", () => {
    const [published, preliminary] = observations(queryIndicators(snapshot, { datasetId: "expenditure-types", seriesIds: ["spending_type.total.share_of_gdp"], years: [2024, 2025] }));
    expect(published).toMatchObject({ year: 2024, unit: "percent", caveatIds: ["topic_general_government_scope", "topic_derived"] });
    expect(preliminary).toMatchObject({ year: 2025, caveatIds: expect.arrayContaining(["topic_derived", "topic_preliminary"]) });
    expect(observations(queryIndicators(snapshot, { datasetId: "tax-breaks-refunds", seriesIds: ["tax_refunds.total"], years: [2025] }))[0]).toMatchObject({ unit: "gel_million", caveatIds: [] });
    const share = comparison("expenditure-types", "spending_type.total.share_of_gdp", 2023, 2024);
    expect(share).toMatchObject({ comparability: "comparable", percentageChange: null });
    expect(share.percentagePointChange).toBeCloseTo(share.to.value! - share.from.value!, 9);
    expect(comparison("expenditure-types", "spending_type.total.share_of_gdp", 2024, 2025)).toMatchObject({ comparability: "limited", caveatIds: expect.arrayContaining(["topic_preliminary"]) });
    expect(comparison("expenditure-types", "spending_type.total.nominal", 2024, 2025)).toMatchObject({ comparability: "comparable", caveatIds: ["topic_general_government_scope"] });
  });

  // Full review I-1: Spending by type is general government, not the state budget, and every answer on it says so.
  it("discloses Spending by type's general-government scope on every cell, and on a search that lists it", () => {
    const response = queryIndicators(snapshot, { datasetId: "expenditure-types", seriesIds: ["spending_type.total.nominal", "spending_type.interest.nominal"], years: [2025] });
    const scope = response.meta.caveats.find((caveat) => caveat.code === "topic_general_government_scope")!;
    expect(scope).toMatchObject({ severity: "severe", affects: ["country.georgia:spending_type.total.nominal:2025", "country.georgia:spending_type.interest.nominal:2025"] });
    expect(scope.messageEn).toContain("general government");
    expect(scope.messageEn).toContain("not the state budget's expenditure");
    expect(observations(response).every((observation) => observation.caveatIds.includes("topic_general_government_scope"))).toBe(true);
    const search = describeCoverage(snapshot, { search: "government spending" });
    expect((search.data as { datasets: { datasetId: string }[] }).datasets.map((dataset) => dataset.datasetId)).toContain("expenditure-types");
    expect(search.meta.caveats.map((caveat) => [caveat.code, caveat.severity])).toEqual([["topic_general_government_scope", "severe"]]);
    // Other datasets carry no such note, and a search that does not list Spending by type carries none.
    expect(queryIndicators(snapshot, { datasetId: "tax-breaks-refunds", seriesIds: ["tax_refunds.total"], years: [2025] }).meta.caveats).toEqual([]);
    expect(describeCoverage(snapshot, { search: "pension" }).meta.caveats).toEqual([]);
  });

  it("cites the Ministry, Treasury and Geostat files the values are read from, resolved through get_sources", () => {
    const cited = [...new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "budget-extras").flatMap((entry) => entry.columns.sources.flat()))].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual(["source.geostat_gdp_use_current", "source.geostat_gdp_use_growth", "source.mof_gfs_general_government_2002_2025", "source.mof_tax_expenditure_report_2024_xlsx_ka", "source.treasury_tax_refunds_chart"]);
    const response = getSources(snapshot, { sourceIds: cited, datasetId: "expenditure-types" });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const sources = (response.data as { sources: { sourceId: string; nameKa: string; documents: { officialUrl: string; attributionKa: string | null }[] }[] }).sources;
    expect(sources.map((source) => source.sourceId).sort()).toEqual(cited);
    const publishers = { geostat: [/^https:\/\/www\.geostat\.ge\//, "საქსტატი"], mof: [/^https:\/\/mof\.ge\//, "საქართველოს ფინანსთა სამინისტრო"], treasury: [/^https:\/\/www\.treasury\.ge\//, "სახაზინო სამსახური"] } as const;
    for (const source of sources) {
      const [url, attribution] = publishers[source.sourceId.replace(/^source\.([a-z]+)_.*$/, "$1") as keyof typeof publishers];
      expect(source.documents[0], source.sourceId).toMatchObject({ officialUrl: expect.stringMatching(url), attributionKa: attribution });
      expect(source.nameKa, source.sourceId).toMatch(/\p{Script=Georgian}/u);
    }
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed as lib/pages/*.tsx and
// the explorers' useCrawlModels feed them (GDP by expenditure's share tab too: its crawl tables leave it out only because
// the list carries the GDP row it divides by). Tax breaks and refunds' % of GDP divides by GDP in the browser and is not
// served, so only the amounts' model is compared. The sectors workbooks print bn GEL and fractions of 1 for %: each row is
// read back in the served unit.

type Reader = (row: WorkbookReadableRow, index: number) => ParityTarget | null;
function matcher() {
  const readers = new Map<WorkbookExportModel, Map<WorkbookReadableRow, ParityTarget | null>>();
  return {
    add: (model: WorkbookExportModel, read: Reader, scale: number) => {
      const targets = new Map<WorkbookReadableRow, ParityTarget | null>();
      const rows = model.readable.rows.map((row, index) => {
        const scaled = { ...row, valuesByYear: Object.fromEntries(Object.entries(row.valuesByYear).map(([year, value]) => [year, value === null ? null : value * scale])) };
        targets.set(scaled, read(row, index));
        return scaled;
      });
      const scaled = { ...model, readable: { ...model.readable, rows } };
      readers.set(scaled, targets);
      return scaled;
    },
    match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.get(row) ?? null,
  };
}
type Matcher = ReturnType<typeof matcher>;

/** The served cell a row prints, if the row is labelled as the served series is. */
function target(build: TopicDatasetBuild, locale: Locale, seriesId: string, row: WorkbookReadableRow): ParityTarget | null {
  const series = build.series.find((entry) => entry.seriesId === seriesId);
  return (locale === "ka" ? series?.labelKa : series?.labelEn) === row.label ? { entityId: GEORGIA_PLACE_ID, seriesId } : null;
}

const SECTOR_PAGES: Record<string, { load: () => Promise<{ facts: ServedSectorObservation[] }>; registry: SectorDefinition[]; config: SectorPageConfig; scope: string }> = {
  "expenditure-types": { load: loadServedExpenditureTypesData, registry: EXPENDITURE_TYPES, config: EXPENDITURE_TYPES_PAGE_CONFIG, scope: "expenditureTypes" },
  "economy-expenditure": { load: loadServedGdpExpenditureData, registry: GDP_EXPENDITURE, config: GDP_EXPENDITURE_PAGE_CONFIG, scope: "gdpExpenditure" },
};

/** Each page's workbook models, with the presentation its page builds. */
async function pageModels(datasetId: string, locale: Locale, m: Matcher): Promise<WorkbookExportModel[]> {
  const build = dataset(datasetId);
  if (datasetId === "tax-breaks-refunds") {
    const facts = (await loadServedTaxBreaksRefundsData()).facts.map(toClientTaxBreaksRefundsFact);
    const gdpFacts = (await loadServedExplorerData()).gdpFacts.map(projectGdpFact);
    const presentation = await getPresentation(locale, ["taxBreaksRefunds", "format", "main", "workbook"], []);
    const { labels } = taxBreaksRefundsNames(presentation.messages);
    const states = taxBreaksRefundsCrawlStates(facts, gdpFacts);
    expect(states.map((state) => state.view)).toEqual(["amount", "gdp"]);
    return states.filter((state) => state.view === "amount").map((state) => {
      const ids = buildTaxBreaksRefundsModel(facts, state, gdpFacts).selected.map((series) => series.id);
      return m.add(buildTaxBreaksRefundsWorkbookExportModel({ facts, state, labels, sources: [], siteOrigin: ORIGIN, gdpFacts, gdpSources: [] }, presentation), (row, index) => target(build, locale, ids[index]!, row), 1);
    });
  }
  const page = SECTOR_PAGES[datasetId]!;
  const served = (await page.load()).facts, facts = served.map(projectSectorObservation), bySource = sourceIdByMeasure(served);
  const presentation = await getPresentation(locale, [page.scope as "expenditureTypes", "format", "main", "workbook"], page.registry.map((row) => row.id));
  const crawl = sectorCrawlStates(facts, page.registry, bySource, page.config);
  const states: SectorState[] = sectorMeasureStates(facts, page.registry, bySource, page.config);
  // The crawl tables are the page's measures, less GDP by expenditure's shares (the page's share tab builds that state).
  expect(crawl).toEqual(states.filter((state) => datasetId === "expenditure-types" || state.measure !== "share_of_gdp"));
  expect(states.map((state) => state.measure)).toEqual(datasetId === "expenditure-types" ? ["nominal", "share_of_gdp"] : ["nominal", "share_of_gdp", "real_growth"]);
  return states.map((state) => {
    const ids = buildEconomicSectorsModel(facts, page.registry, state, bySource, page.config).series.map((series) => series.id);
    const workbook = buildEconomicSectorsWorkbookExportModel(facts, page.registry, state, presentation, [], ORIGIN, bySource, page.config);
    return m.add(workbook, (row, index) => target(build, locale, `${ids[index]}.${state.measure}`, row), state.measure === "nominal" ? 1e9 : 100);
  });
}

describe("budget-extras parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const datasetId of DATASETS) {
      it(`${datasetId} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(datasetId), await pageModels(datasetId, locale, m), m.match);
      }, 60_000);
    }
  }

  it("fails when Tax breaks and refunds is served in GEL rather than the million GEL the CSV stores", async () => {
    const taxBreaks = dataset("tax-breaks-refunds");
    const facts = taxBreaks.facts.map((fact): TopicFact => (fact.seriesId === "tax_refunds.total" && fact.year === 2025 ? { ...fact, value: fact.value! * 1e6 } : fact));
    const m = matcher();
    const models = await pageModels("tax-breaks-refunds", "en", m);
    expect(() => expectWorkbookParity({ ...taxBreaks, facts }, models, m.match)).toThrow(/2025: the page prints [\d.e+]+, country.georgia tax_refunds.total serves/);
  }, 60_000);

  it("fails when a GDP by expenditure share is missing from what is served", async () => {
    const gdpUse = dataset("economy-expenditure");
    const facts = gdpUse.facts.filter((fact) => fact.seriesId !== "gdp_use.households.share_of_gdp");
    const m = matcher();
    const models = await pageModels("economy-expenditure", "en", m);
    expect(() => expectWorkbookParity({ ...gdpUse, facts }, models, m.match)).toThrow(/gdp_use.households.share_of_gdp is not served/);
  }, 60_000);
});
