// apps/web/tests/factQuery/topics/moneyBanks.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedMoneyBanksData } from "../../../lib/data/moneyBanks/importMoneyBanks";
import { BUSINESS_REGIONS } from "../../../lib/data/business/types";
import { MONEY_BANKS_LOAN_AREAS, type MoneyBanksFact } from "../../../lib/data/moneyBanks/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { moneyBanksCrawlStates, moneyBanksViewSeries, type MoneyBanksState, type MoneyBanksTopicId } from "../../../lib/explorer/moneyBanks";
import { moneyBanksAreaCrawlStates, moneyBanksMapId, type MoneyBanksArea } from "../../../lib/explorer/moneyBanksAreas";
import { moneyBanksAreaFacts, moneyBanksAreaSeriesLabels, moneyBanksLabels, moneyBanksPageFacts } from "../../../lib/explorer/moneyBanksPageData";
import { buildMoneyBanksWorkbookExportModel } from "../../../lib/explorer/moneyBanksWorkbook";
import { unitListCrawlStates } from "../../../lib/explorer/unitList";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import type { Observation } from "../../../lib/factQuery/observations";
import { queryIndicators } from "../../../lib/factQuery/queryIndicators";
import { moneyBanksTopicAdapter } from "../../../lib/factQuery/topics/moneyBanks";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
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
const SECTIONS = ["supply", "loans-deposits", "borrowers", "interest-rates", "bank-health"] as const satisfies readonly MoneyBanksTopicId[];

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: MoneyBanksFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && Number(row.year) === year)!;
const published = (indicatorId: string, year: number) => Number(rowOf(indicatorId, year).published_value);

beforeAll(async () => {
  [builds, { facts: served }, csv] = await Promise.all([
    moneyBanksTopicAdapter.build(), loadServedMoneyBanksData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/money-banks-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("money and banks topic adapter", () => {
  it("is registered, reads the money source archive and builds the six Money and banks pages", () => {
    expect(TOPIC_ADAPTERS).toContain(moneyBanksTopicAdapter);
    expect(moneyBanksTopicAdapter).toMatchObject({ family: "money-banks", sourceArchive: ["money"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "money-banks"));
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length])).toEqual([
      ["money-supply", 1, 4], ["money-loans-deposits", 1, 10], ["money-borrowers", 1, 23], ["money-regions", 12, 3], ["money-interest-rates", 1, 7], ["money-bank-health", 1, 5],
    ]);
  });

  it("serves Georgia on the topic pages, and Georgia and the 11 regions, each its area page, on Loans by region", () => {
    for (const section of SECTIONS) expect(dataset(`money-${section}`).entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
    const regions = dataset("money-regions").entities;
    expect(regions.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID, ...BUSINESS_REGIONS.map((region) => region.replace("region_", "region."))]);
    expect(regions[0]).toEqual({ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null });
    expect(regions.find((entity) => entity.entityId === ADJARA)).toMatchObject({ entityType: "region", labelEn: "Adjara", parentEntityId: GEORGIA_PLACE_ID });
  });

  it("serves NBG's published figures in million GEL or %, and Fiscal.ge's reviewed sums and shares as derived", () => {
    const m3 = rowOf("money.m3", 2025);
    expect(factOf("money-supply", GEORGIA_PLACE_ID, "money.m3", 2025)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "money.m3", year: 2025, value: 57680.2, basis: "actual", status: "official", sourceIds: [m3.source_id],
    });
    expect(dataset("money-supply").series.map((series) => [series.seriesId, series.unit, series.isTotal])).toEqual([["money.m3", "gel_million", true], ["money.m2", "gel_million", false], ["money.m1", "gel_million", false], ["money.m0", "gel_million", false]]);
    expect(rowOf("deposits.total", 2025).value_status).toBe("calculated");
    expect(factOf("money-loans-deposits", GEORGIA_PLACE_ID, "deposits.total", 2025)).toMatchObject({ value: published("deposits.total", 2025), status: "derived" });
    expect(factOf("money-loans-deposits", GEORGIA_PLACE_ID, "loans.fx_share", 2025)).toMatchObject({ value: 41.9, status: "derived" });
    expect(dataset("money-loans-deposits").series.find((series) => series.seriesId === "loans.gel")).toMatchObject({ labelEn: "Loans in lari", parentSeriesId: "loans.total", unit: "gel_million" });
    expect(dataset("money-borrowers").series.find((series) => series.seriesId === "households.purpose.home")).toMatchObject({ headingEn: "What households borrow for" });
    expect(factOf("money-interest-rates", GEORGIA_PLACE_ID, "rates.policy", 2025)).toMatchObject({ value: 8, sourceIds: ["nbg_policy_rate"] });
    expect(factOf("money-bank-health", GEORGIA_PLACE_ID, "banks.npl_ratio", 2025)!.value).toBe(2.5);
    expect(factOf("money-regions", ADJARA, "loans_region.total", 2025)).toMatchObject({ value: published("loans_region.region_adjara.total", 2025), status: "derived" });
    expect(factOf("money-regions", ADJARA, "loans_region.gel", 2025)).toMatchObject({ value: published("loans_region.region_adjara.gel", 2025), status: "official" });
    expect(dataset("money-regions").series.map((series) => [series.seriesId, series.labelEn, series.headingEn, series.isTotal])).toEqual([
      ["loans_region.total", "All loans", "Loans", true], ["loans_region.gel", "In lari", "Loans", false], ["loans_region.fx", "In foreign currency", "Loans", false],
    ]);
  });

  it("serves nothing the pages do not show: no % of GDP, not NBG's own M3 and M2 to GDP", () => {
    const ids = builds.flatMap((build) => build.series.map((series) => series.seriesId));
    expect(served.some((fact) => fact.indicatorId === "money.m3_to_gdp")).toBe(true);
    expect(ids.filter((id) => id.includes("to_gdp"))).toEqual([]);
    // Money supply's every cell is an amount: the page's own division by GDP is not served.
    expect(new Set(dataset("money-supply").series.map((series) => series.unit))).toEqual(new Set(["gel_million"]));
    expect(dataset("money-supply").facts.filter((fact) => fact.value !== null).every((fact) => fact.value === published(fact.seriesId, fact.year))).toBe(true);
    // Deposits of people and companies start after the totals: missing, never zero.
    const first = Math.min(...csv.filter((row) => row.indicator_id === "deposits.legal_entities").map((row) => Number(row.year)));
    expect(factOf("money-loans-deposits", GEORGIA_PLACE_ID, "deposits.legal_entities", first - 1)).toMatchObject({ value: null, sourceIds: [] });
  });

  it("carries the six reviewed breaks onto the series they name, the loans by region one onto the area pages' rows", () => {
    const breaks = (id: string) => dataset(id).breaks.map((entry) => [entry.breakId, entry.referenceDate, entry.seriesIds.length]);
    expect(breaks("money-bank-health")).toEqual([["fsi_method_2022", "2022-01-01", 2], ["fsi_ifrs_2023", "2023-01-01", 5]]);
    expect(breaks("money-borrowers")).toEqual([["loans_activity_2014", "2014-06-01", 11], ["loans_overdue_2015", "2015-12-01", 23], ["loans_sector_2022", "2022-09-01", 17], ["loans_microbanks_2025", "2025-01-01", 23]]);
    expect(dataset("money-regions").breaks).toEqual([expect.objectContaining({ breakId: "loans_microbanks_2025", seriesIds: expect.arrayContaining(["loans_region.total", "loans_region.gel", "loans_region.fx"]) })]);
    for (const id of ["money-supply", "money-loans-deposits", "money-interest-rates"]) expect(dataset(id).breaks).toEqual([]);
  });
});

describe("query, compare and sources on the money and banks datasets", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const comparison = (datasetId: string, seriesId: string, fromYear: number, toYear: number, entityIds?: string[]): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds: [seriesId], ...(entityIds ? { entityIds } : {}) }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };

  it("gives an interest rate and a bank ratio a percentage-point change and no percentage change (R19)", () => {
    const rate = comparison("money-interest-rates", "rates.policy", 2015, 2025);
    expect(rate).toMatchObject({ unit: "percent", comparability: "comparable", absoluteChange: null, percentageChange: null });
    expect(rate.percentagePointChange).toBeCloseTo(published("rates.policy", 2025) - published("rates.policy", 2015), 9);
    const share = comparison("money-loans-deposits", "deposits.fx_share", 2010, 2025);
    expect(share).toMatchObject({ percentageChange: null });
    expect(share.percentagePointChange).toBeCloseTo(published("deposits.fx_share", 2025) - published("deposits.fx_share", 2010), 9);
    expect(share.caveatIds).toContain("topic_derived");
    const loans = comparison("money-loans-deposits", "loans.total", 2010, 2025);
    expect(loans).toMatchObject({ unit: "gel_million", percentagePointChange: null });
    expect(loans.percentageChange).not.toBeNull();
  });

  it("refuses bad loans across the FSI file change and IFRS review, and compares on either side", () => {
    const across = comparison("money-bank-health", "banks.npl_ratio", 2021, 2022);
    expect(across).toMatchObject({ comparability: "not_comparable", percentagePointChange: null });
    expect(across.caveatIds).toContain("topic_series_break");
    expect(across.reasonsEn[0]).toContain("2022-01-01: ");
    expect(comparison("money-bank-health", "banks.npl_ratio", 2022, 2023).comparability).toBe("not_comparable");
    expect(comparison("money-bank-health", "banks.npl_ratio", 2015, 2021).comparability).toBe("comparable");
    expect(comparison("money-bank-health", "banks.npl_ratio", 2023, 2025).comparability).toBe("comparable");
    // The FSI file change touches bad loans and return on equity only; return on assets crosses only the IFRS review.
    expect(comparison("money-bank-health", "banks.roa", 2021, 2022).comparability).toBe("comparable");
    expect(comparison("money-bank-health", "banks.roa", 2022, 2023).comparability).toBe("not_comparable");
  });

  it("refuses a loan industry across June 2014 and a region's loans across the 2025 microbanks change", () => {
    expect(comparison("money-borrowers", "borrowers.industry.trade", 2013, 2014).comparability).toBe("not_comparable");
    expect(comparison("money-borrowers", "borrowers.industry.trade", 2016, 2021).comparability).toBe("comparable");
    expect(comparison("money-regions", "loans_region.total", 2024, 2025, [ADJARA]).comparability).toBe("not_comparable");
    expect(comparison("money-regions", "loans_region.fx", 2015, 2024, [ADJARA]).comparability).toBe("comparable");
  });

  it("marks a reviewed sum derived in an answer", () => {
    const response = queryIndicators(snapshot, { datasetId: "money-regions", seriesIds: ["loans_region.total"], entityIds: [ADJARA], years: [2025] });
    const [observation] = (response as { data: { observations: Observation[] } }).data.observations;
    expect(observation).toMatchObject({ entityId: ADJARA, unit: "gel_million", value: published("loans_region.region_adjara.total", 2025), caveatIds: ["topic_derived"] });
  });

  it("resolves the cited NBG workbooks through get_sources, each listed once", () => {
    const health = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "money-bank-health")!;
    const cited = [...new Set(health.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual(["source.nbg_fsi", "source.nbg_fsi_archive"]);
    expect(snapshot.sources.filter((source) => source.sourceId === "source.nbg_fsi")).toHaveLength(1);
    const response = getSources(snapshot, { sourceIds: cited, datasetId: "money-bank-health", years: [health.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const { sources } = response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionKa: string | null }[] }[] };
    expect(sources.map((source) => source.sourceId).sort()).toEqual(cited);
    for (const source of sources) expect(source.documents[0], source.sourceId).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionKa: "საქართველოს ეროვნული ბანკი" });
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/moneyBanks.tsx, money-banks-area.tsx; components/money-banks/money-banks-explorer.tsx and
// money-banks-area-explorer.tsx's useCrawlModels). Loans and deposits' shares in foreign currency have no crawl table
// (the page leaves them out, its amounts listing what they divide): their model is the one the page's Excel download
// builds on that view. % of GDP has no state without GDP, and is not served.

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
const presentationOf = (locale: Locale, ids: readonly string[]) => getPresentation(locale, ["moneyBanks", "regionalEconomies", "format", "main", "workbook"], ids, ids);
const byLabel = (ids: readonly string[], labels: Readonly<Record<string, string>>, target: (id: string) => ParityTarget): Reader =>
  (row) => { const id = ids.find((candidate) => labels[candidate] === row.label); return id ? target(id) : null; };

async function topicModels(locale: Locale, section: MoneyBanksTopicId, m: Matcher) {
  const [presentation, sources] = await Promise.all([presentationOf(locale, []), loadSourcedWorkbookSources("money", locale)]);
  const facts = moneyBanksPageFacts(served, section), labels = moneyBanksLabels(presentation, section), title = message(presentation.messages, `moneyBanks.page.${section}.title`);
  const shares: MoneyBanksState[] = section === "loans-deposits" ? unitListCrawlStates(moneyBanksViewSeries(section, "fx_share"), facts).map((state) => ({ ...state, view: "fx_share" })) : [];
  return [...moneyBanksCrawlStates(section, facts), ...shares].map((state) =>
    m.add(buildMoneyBanksWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin: ORIGIN, title }, presentation), byLabel(state.selectedIds, labels, (id) => ({ entityId: GEORGIA_PLACE_ID, seriesId: id }))));
}

async function areaModels(locale: Locale, areas: readonly MoneyBanksArea[], m: Matcher) {
  const ids = areas.map((area) => moneyBanksMapId(area));
  const [presentation, sources] = await Promise.all([presentationOf(locale, ids), loadSourcedWorkbookSources("money", locale, (row) => row.source_id === "nbg_loans_regions_lreg")]);
  return areas.flatMap((area) => {
    const facts = moneyBanksAreaFacts(served, area), labels = moneyBanksAreaSeriesLabels(presentation.messages, area);
    const entityId = area === "georgia" ? GEORGIA_PLACE_ID : moneyBanksMapId(area);
    return moneyBanksAreaCrawlStates(area, facts).map((state) =>
      m.add(buildMoneyBanksWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin: ORIGIN, title: area }, presentation),
        byLabel(state.selectedIds, labels, (id) => ({ entityId, seriesId: `loans_region.${id.split(".")[2]}` }))));
  });
}

describe("money and banks parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of SECTIONS) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`money-${section}`), await topicModels(locale, section, m), m.match);
      });
    }
    it(`regions (${locale}): Georgia's and Adjara's area pages`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("money-regions"), await areaModels(locale, ["georgia", "region_adjara"], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
    });
  }

  it("regions (en): every area page", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("money-regions"), await areaModels("en", MONEY_BANKS_LOAN_AREAS, m), m.match);
  });

  it("fails when a served rate is the stored figure, not the one the page prints", async () => {
    const rates = dataset("money-interest-rates");
    const stored = Number(rowOf("rates.loans_total", 2025).value);
    expect(stored).not.toBe(published("rates.loans_total", 2025));
    const facts = rates.facts.map((fact): TopicFact => (fact.year === 2025 && fact.seriesId === "rates.loans_total" ? { ...fact, value: stored } : fact));
    const m = matcher();
    const models = await topicModels("en", "interest-rates", m);
    expect(() => expectWorkbookParity({ ...rates, facts }, models, m.match)).toThrow(/2025: the page prints [\d.]+, country.georgia rates.loans_total serves/);
  });
});
