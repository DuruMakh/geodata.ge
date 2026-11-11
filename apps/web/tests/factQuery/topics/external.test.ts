// apps/web/tests/factQuery/topics/external.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedCurrentAccountFacts, toClientCurrentAccountFacts } from "../../../lib/data/externalFlows/importCurrentAccount";
import { loadServedForeignInvestmentData, toClientForeignInvestmentData } from "../../../lib/data/externalFlows/importForeignInvestment";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../../../lib/data/externalFlows/importMoneyTransfers";
import { FOREIGN_INVESTMENT_TOTAL_ID, MONEY_TRANSFER_TOTAL_ID } from "../../../lib/data/externalFlows/types";
import { loadServedExternalPositionData, toClientExternalPositionFact } from "../../../lib/data/externalPosition/importExternalPosition";
import { loadServedGdpOverviewData } from "../../../lib/data/gdpOverview/importGdpOverview";
import { buildCurrentAccountModel, currentAccountCrawlStates } from "../../../lib/explorer/currentAccount";
import { buildCurrentAccountWorkbookModel } from "../../../lib/explorer/currentAccountWorkbook";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { buildExternalPositionModel, externalPositionCrawlStates, externalPositionLabels, externalPositionLatestLabel, externalPositionPageFacts, type ExternalPositionSectionId } from "../../../lib/explorer/externalPosition";
import { buildExternalPositionWorkbookExportModel } from "../../../lib/explorer/externalPositionWorkbook";
import { buildForeignInvestmentModel } from "../../../lib/explorer/foreignInvestment";
import { foreignInvestmentCrawlStates } from "../../../lib/explorer/foreignInvestmentState";
import { buildForeignInvestmentWorkbookModel } from "../../../lib/explorer/foreignInvestmentWorkbook";
import { buildMoneyTransfersModel } from "../../../lib/explorer/moneyTransfers";
import { moneyTransfersCrawlStates } from "../../../lib/explorer/moneyTransfersState";
import { buildMoneyTransfersWorkbookModel } from "../../../lib/explorer/moneyTransfersWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import type { Observation } from "../../../lib/factQuery/observations";
import { buildAllPublications } from "../../../lib/factQuery/publications";
import { queryIndicators } from "../../../lib/factQuery/queryIndicators";
import { rank, type RankData } from "../../../lib/factQuery/rank";
import { externalTopicAdapter } from "../../../lib/factQuery/topics/external";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { FactQueryResponse, FactQuerySnapshot } from "../../../lib/factQuery/types";
import { message } from "../../../lib/i18n/messages";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale, Presentation } from "../../../lib/i18n/types";
import { toolResult } from "../../../lib/mcp/result";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const EXTERNAL_DATASETS = ["external-money-from-abroad", "external-foreign-investment", "external-current-account", "external-foreign-debt", "external-reserves"];
const REGIONS = ["adjara", "guria", "imereti", "kakheti", "kvemo_kartli", "mtskheta_mtianeti", "racha_lechkhumi_kvemo_svaneti", "samegrelo_zemo_svaneti", "samtskhe_javakheti", "shida_kartli", "tbilisi"].map((id) => `region.${id}`);

type CsvRow = Record<string, string>;
let builds: TopicDatasetBuild[];
const csv: Record<string, CsvRow[]> = {};
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, seriesId: string, year: number, entityId: string = GEORGIA_PLACE_ID) => dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const seriesOf = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);

beforeAll(async () => {
  const files = ["external-position-annual", "current-account-annual", "foreign-investment-annual", "money-transfers-annual"];
  const [built, ...texts] = await Promise.all([externalTopicAdapter.build(), ...files.map((file) => readFile(path.resolve(process.cwd(), `../../data/imports/${file}.csv`)))]);
  builds = built;
  files.forEach((file, index) => { csv[file] = parse(texts[index]!, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]; });
}, 120_000);

describe("external topic adapter", () => {
  it("is registered, reads the external-flows source archive and builds the five External flows pages, each Georgia's", () => {
    expect(TOPIC_ADAPTERS).toContain(externalTopicAdapter);
    expect(externalTopicAdapter).toMatchObject({ family: "external", sourceArchive: ["external-flows"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "external"));
    // Money from abroad: 2 measures × (all countries + the 2025 top 10 + Other countries). Foreign investment: the total,
    // the 2025 top 10 countries, Other countries and 18 sectors as Georgia's series; its 11 regions are places with their
    // total. Current account: 5 series × 3 views. Foreign debt: the total and 5 parts. Reserves: the total and 3 parts.
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length])).toEqual([
      ["external-money-from-abroad", 1, 24], ["external-foreign-investment", 12, 30], ["external-current-account", 1, 15], ["external-foreign-debt", 1, 6], ["external-reserves", 1, 4],
    ]);
    for (const build of builds) {
      expect(build.entities[0]).toEqual({ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null });
      expect(build.breaks).toEqual([]);
    }
    // Foreign investment's By region tab: the 11 regions as the places every topic names them.
    const regions = dataset("external-foreign-investment").entities.slice(1);
    expect(regions.map((entity) => entity.entityId).sort()).toEqual(REGIONS);
    expect(regions.every((entity) => entity.entityType === "region" && entity.parentEntityId === GEORGIA_PLACE_ID)).toBe(true);
    expect(regions.find((entity) => entity.entityId === "region.adjara")).toMatchObject({ labelEn: expect.stringMatching(/^Adjara/), labelKa: expect.stringMatching(/^აჭარ/) });
    // The CSVs' own unit tokens: NBG's debt and reserves in million USD, the flows in USD. No % of GDP is served.
    expect(Object.fromEntries(builds.map((build) => [build.page.datasetId, [...new Set(build.series.map((series) => series.unit))]]))).toEqual({
      "external-money-from-abroad": ["usd"], "external-foreign-investment": ["usd"], "external-current-account": ["usd"], "external-foreign-debt": ["usd_million"], "external-reserves": ["usd_million"],
    });
    const unitNames = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units;
    expect(unitNames.usd_million).toEqual({ labelKa: "მლნ აშშ დოლარი", labelEn: "million USD" });
  });

  it("serves each page's figure as its CSV row carries it", () => {
    const debt = csv["external-position-annual"]!.find((row) => row.indicator_id === "ext_debt.total" && row.year === "2025")!;
    expect(factOf("external-foreign-debt", "ext_debt.total", 2025)).toEqual({ entityId: GEORGIA_PLACE_ID, seriesId: "ext_debt.total", year: 2025, value: Number(debt.published_value), basis: "actual", status: "official", sourceIds: ["source.nbg_gross_external_debt_bpm6"] });
    const goods = csv["current-account-annual"]!.find((row) => row.series_id === "ca.goods" && row.flow === "credit" && row.year === "2025")!;
    expect(factOf("external-current-account", "ca.goods.credit", 2025)).toMatchObject({ value: Number(goods.value_usd), status: "official", sourceIds: [goods.source_id] });
    const usa = csv["foreign-investment-annual"]!.find((row) => row.entity_id === "fdi.country.m49_840" && row.year === "2024")!;
    expect(factOf("external-foreign-investment", "fdi.country.m49_840", 2024)).toMatchObject({ value: Number(usa.value_usd), status: "official", sourceIds: ["source.geostat_fdi_by_countries"] });
    const adjara = csv["foreign-investment-annual"]!.find((row) => row.entity_id === "fdi.region.adjara" && row.year === "2024")!;
    expect(factOf("external-foreign-investment", "fdi.total", 2024, "region.adjara")).toMatchObject({ value: Number(adjara.value_usd), sourceIds: ["source.geostat_fdi_by_regions"] });
    const russia = csv["money-transfers-annual"]!.find((row) => row.entity_id === "transfer.russian_federation" && row.measure === "received" && row.year === "2025")!;
    expect(factOf("external-money-from-abroad", "transfer.russian_federation.received", 2025)).toMatchObject({ value: Number(russia.value_usd), status: "official", sourceIds: [russia.source_id] });
    expect(seriesOf("external-current-account", "ca.goods.credit")).toMatchObject({ labelEn: "Goods", headingEn: "Money in", headingKa: "შემოსული", parentSeriesId: "ca.balance.credit", isTotal: false });
    expect(seriesOf("external-current-account", "ca.balance.net")).toMatchObject({ labelEn: "Current account", headingEn: "Balance", parentSeriesId: null, isTotal: true });
    expect(seriesOf("external-money-from-abroad", "transfer.others.sent")).toMatchObject({ labelEn: "Other countries", labelKa: "სხვა ქვეყნები", headingEn: "Sent", parentSeriesId: "transfer.total.sent" });
    expect(seriesOf("external-foreign-investment", "fdi.sector.a")).toMatchObject({ headingEn: "By sector", parentSeriesId: FOREIGN_INVESTMENT_TOTAL_ID });
    expect(seriesOf("external-foreign-debt", "ext_debt.government")).toMatchObject({ labelEn: "Government", labelKa: "მთავრობა", headingEn: null, parentSeriesId: "ext_debt.total" });
  });

  it("dates the one latest Foreign debt and Reserves point, from the CSV, and no other cell", () => {
    const dated = (id: string) => dataset(id).facts.filter((fact) => fact.periodEnd !== undefined);
    const csvDate = (prefix: string) => [...new Set(csv["external-position-annual"]!.filter((row) => row.indicator_id.startsWith(prefix) && !row.period_end.endsWith("-12-31")).map((row) => `${row.year} ${row.period_end}`))];
    expect(csvDate("ext_debt.")).toEqual(["2026 2026-06-30"]);
    expect(csvDate("reserves.")).toEqual(["2026 2026-09-30"]);
    expect(dated("external-foreign-debt").map((fact) => [fact.seriesId, fact.year, fact.periodEnd])).toEqual(dataset("external-foreign-debt").series.map((series) => [series.seriesId, 2026, "2026-06-30"]));
    expect(dated("external-reserves").map((fact) => [fact.seriesId, fact.year, fact.periodEnd])).toEqual(dataset("external-reserves").series.map((series) => [series.seriesId, 2026, "2026-09-30"]));
    for (const id of ["external-money-from-abroad", "external-foreign-investment", "external-current-account"]) expect(dated(id), id).toEqual([]);
    // Every year before 2026 is a 31 December amount.
    expect(dataset("external-foreign-debt").facts.filter((fact) => fact.year < 2026).every((fact) => fact.periodEnd === undefined)).toBe(true);
  });

  it("marks Money from abroad's partial-month year partial with its months, and Other countries as the page's sum", () => {
    const partial = dataset("external-money-from-abroad").facts.filter((fact) => fact.status === "partial");
    // The 2019 countries with blank months are all outside the 2025 top 10, so the page marks Other countries 2019 partial
    // with the fewest months any of them reports.
    const fewest = (measure: string) => Math.min(...csv["money-transfers-annual"]!.filter((row) => row.measure === measure && row.value_status === "partial_months").map((row) => Number(row.months_reported)));
    expect(partial.map((fact) => [fact.seriesId, fact.year, fact.monthsReported])).toEqual([["transfer.others.received", 2019, fewest("received")], ["transfer.others.sent", 2019, fewest("sent")]]);
    expect(fewest("received")).toBe(5);
    for (const build of builds) for (const fact of build.facts.filter((entry) => entry.value !== null)) {
      const others = fact.seriesId.startsWith("transfer.others.") || fact.seriesId === "fdi.others";
      expect(fact.status, `${build.page.datasetId} ${fact.seriesId} ${fact.year}`).toBe(fact.status === "partial" ? "partial" : others ? "derived" : "official");
      if (fact.status !== "partial") expect(fact.monthsReported).toBeUndefined();
    }
    // Other countries cites the rows it is worked out from.
    expect(factOf("external-foreign-investment", "fdi.others", 2024)!.sourceIds).toEqual(["source.geostat_fdi_by_quarters", "source.geostat_fdi_by_countries"]);
    expect(factOf("external-money-from-abroad", "transfer.others.received", 2024)!.sourceIds).toEqual(["source.nbg_money_transfers_by_countries"]);
  });

  it("serves only what the pages list: the 2025 top 10 countries, no BOP estimate, no exchange rate", () => {
    const transfers = dataset("external-money-from-abroad").series.filter((series) => series.headingEn === "Received" && !series.isTotal && series.seriesId !== "transfer.others.received");
    expect(transfers).toHaveLength(10);
    expect(dataset("external-money-from-abroad").series.some((series) => series.seriesId.startsWith("bop."))).toBe(false);
    expect(dataset("external-foreign-investment").series.filter((series) => series.headingEn === "By country").map((series) => series.seriesId)).toHaveLength(11);
    expect(dataset("external-foreign-investment").series.some((series) => series.seriesId.startsWith("fdi.region."))).toBe(false);
    for (const build of builds) expect(build.series.some((series) => /exchange|rate|gel/i.test(`${series.seriesId} ${series.labelEn} ${series.unit}`)), build.page.datasetId).toBe(false);
    expect([Math.min(...dataset("external-foreign-debt").facts.map((fact) => fact.year)), Math.min(...dataset("external-reserves").facts.map((fact) => fact.year))]).toEqual([2006, 1995]);
  });
});

describe("the dated point, the partial year and the sources over the tools", () => {
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

  it("answers the 2026 debt with its date, in query_indicators, compare, rank and the CSV, never as a whole year", () => {
    const [latest, december] = ([2026, 2025] as const).map((year) => observations(queryIndicators(snapshot, { datasetId: "external-foreign-debt", seriesIds: ["ext_debt.total"], years: [year] }))[0]!);
    expect(latest).toMatchObject({ year: 2026, periodEnd: "2026-06-30", value: 28166.2, unit: "usd_million" });
    expect(december).not.toHaveProperty("periodEnd");
    const text = toolResult(queryIndicators(snapshot, { datasetId: "external-reserves", seriesIds: ["reserves.total"], years: [2025, 2026] })).content[0]!.text;
    expect(text).toContain("2026-09-30");
    const change = comparison("external-foreign-debt", "ext_debt.total", 2025, 2026);
    expect(change.to).toMatchObject({ year: 2026, periodEnd: "2026-06-30" });
    expect(change.from).not.toHaveProperty("periodEnd");
    // Ruling R30: a year-end to mid-year change is not an annual change; year end to year end stays comparable.
    expect(latest).toMatchObject({ caveatIds: ["topic_dated_period"], valueDefinitionEn: expect.stringContaining("it is the position on 2026-06-30, not at year end"), valueDefinition: expect.stringContaining("2026-06-30") });
    expect(december).toMatchObject({ caveatIds: [] });
    expect(change).toMatchObject({ comparability: "limited", caveatIds: ["topic_dated_period"] });
    expect(comparison("external-reserves", "reserves.total", 2025, 2026)).toMatchObject({ comparability: "limited", caveatIds: ["topic_dated_period"] });
    expect(comparison("external-foreign-debt", "ext_debt.total", 2024, 2025)).toMatchObject({ comparability: "comparable", caveatIds: [] });
    const changes = rank(snapshot, { datasetId: "external-foreign-debt", dimension: "series", parentSeriesId: "ext_debt.total", measure: "value", metric: "percentage_change", fromYear: 2025, toYear: 2026 });
    if (changes.kind !== "ranking") throw new Error(JSON.stringify(changes));
    const changeEntries = (changes.data as RankData).entries;
    expect(changeEntries.length).toBeGreaterThan(0);
    for (const entry of changeEntries) expect(entry.caveatIds, entry.seriesId).toContain("topic_dated_period");
    expect(toolResult(compare(snapshot, { target: { dataset: "topic", datasetId: "external-foreign-debt", seriesIds: ["ext_debt.total"] }, fromYear: 2025, toYear: 2026, measure: "value" })).content[0]!.text).toContain("2025→2026-06-30");
    const ranking = rank(snapshot, { datasetId: "external-foreign-debt", dimension: "series", parentSeriesId: "ext_debt.total", measure: "value", metric: "value", year: 2026 });
    if (ranking.kind !== "ranking") throw new Error(JSON.stringify(ranking));
    expect((ranking.data as RankData).entries[0]).toMatchObject({ seriesId: "ext_debt.banks", periodEnd: "2026-06-30" });
    const file = buildAllPublications(snapshot).find((entry) => entry.fileName === "topics/external-foreign-debt.csv")!;
    const rows = parse(file.bytes, { bom: true, columns: true }) as CsvRow[];
    expect(rows.filter((row) => row.period_end !== "").map((row) => `${row.series_id} ${row.year} ${row.period_end}`)).toEqual(dataset("external-foreign-debt").series.map((series) => `${series.seriesId} 2026 2026-06-30`));
  });

  it("states a partial transfer year's months in the observation and limits a change into it", () => {
    const [row] = observations(queryIndicators(snapshot, { datasetId: "external-money-from-abroad", seriesIds: ["transfer.others.received"], years: [2019] }));
    expect(row).toMatchObject({ caveatIds: ["topic_partial_period"], valueDefinitionEn: expect.stringContaining("it covers 5 months of the year") });
    expect(comparison("external-money-from-abroad", "transfer.others.received", 2018, 2019)).toMatchObject({ comparability: "limited", caveatIds: expect.arrayContaining(["topic_partial_period"]) });
    // Other countries says what it leaves out: every country but the end year's top 10, each one in the reviewed import file.
    for (const [datasetId, seriesId, file] of [["external-money-from-abroad", "transfer.others.sent", "money-transfers-annual.csv"], ["external-foreign-investment", "fdi.others", "foreign-investment-annual.csv"]] as const) {
      const end = snapshot.topics.datasets.find((entry) => entry.page.datasetId === datasetId)!.lastYear;
      const [other] = observations(queryIndicators(snapshot, { datasetId, seriesIds: [seriesId], years: [end] }));
      expect(other!.valueDefinitionEn, seriesId).toContain(`Other countries are every country except the ${end} top 10 this dataset lists; each country's amount is in the reviewed import file data/imports/${file}.`);
      expect(other!.valueDefinition, seriesId).toContain(`${end} წლის ათი უმსხვილესი ქვეყნისა`);
    }
    expect(observations(queryIndicators(snapshot, { datasetId: "external-money-from-abroad", seriesIds: ["transfer.total.sent"], years: [2025] }))[0]!.valueDefinitionEn).not.toContain("Other countries");
    // The total of 2019 is a full year.
    expect(comparison("external-money-from-abroad", "transfer.total.received", 2018, 2019)).toMatchObject({ comparability: "comparable", caveatIds: [] });
  });

  it("cites the NBG and Geostat workbooks the values are read from, resolved through get_sources", () => {
    const cited = [...new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "external").flatMap((entry) => entry.columns.sources.flat()))].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual([
      "source.geostat_fdi_by_countries", "source.geostat_fdi_by_quarters", "source.geostat_fdi_by_regions", "source.geostat_fdi_by_sectors",
      "source.nbg_balance_of_payments_bpm6", "source.nbg_gross_external_debt_bpm6", "source.nbg_money_transfers_by_countries", "source.nbg_official_reserve_assets",
    ]);
    const response = getSources(snapshot, { sourceIds: cited, datasetId: "external-foreign-debt" });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const sources = (response.data as { sources: { sourceId: string; nameKa: string; nameEn: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(sources.map((source) => source.sourceId).sort()).toEqual(cited);
    for (const source of sources) {
      const nbg = source.sourceId.startsWith("source.nbg_");
      expect(source.documents[0], source.sourceId).toMatchObject({ officialUrl: nbg ? expect.stringMatching(/^https:\/\/(www\.)?nbg\.gov\.ge\//) : expect.stringMatching(/^https:\/\/www\.geostat\.ge\//), attributionKa: nbg ? "საქართველოს ეროვნული ბანკი" : "საქსტატი" });
      expect(source.nameKa, source.sourceId).toMatch(/\p{Script=Georgian}/u);
    }
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed as lib/pages/external.tsx
// and components/external/*'s useCrawlModels feed them. The % of GDP crawl states divide by GDP in the browser and are
// not served, so only the amounts' models are compared (each test checks that the states left out are exactly those).
// The flows' workbooks print million or billion USD as a display scale: each row is read back in USD by the scale its
// unit names. Foreign debt and Reserves print million USD, the unit served.

type Reader = (row: WorkbookReadableRow, index: number) => ParityTarget | null;
function matcher() {
  const readers = new Map<WorkbookExportModel, Map<WorkbookReadableRow, ParityTarget | null>>();
  return {
    add: (model: WorkbookExportModel, read: Reader, scaleOf: (unitLabel: string) => number) => {
      const scale = scaleOf(model.readable.unitLabel);
      expect(scale, model.readable.unitLabel).not.toBeNaN();
      const targets = new Map<WorkbookReadableRow, ParityTarget | null>();
      const rows = model.readable.rows.map((row, index) => {
        const usd = { ...row, valuesByYear: Object.fromEntries(Object.entries(row.valuesByYear).map(([year, value]) => [year, value === null ? null : value * scale])) };
        targets.set(usd, read(row, index));
        return usd;
      });
      const scaled = { ...model, readable: { ...model.readable, rows } };
      readers.set(scaled, targets);
      return scaled;
    },
    match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.get(row) ?? null,
  };
}
type Matcher = ReturnType<typeof matcher>;

const SCOPES = ["external", "main", "format", "workbook"] as const;
const flowScale = (presentation: Presentation) => (unitLabel: string) =>
  unitLabel === message(presentation.messages, "external.unit.billion") ? 1e9 : unitLabel === message(presentation.messages, "external.unit.million") ? 1e6 : NaN;
/** The served cell a row prints, if the row is labelled as the served series is. */
function target(build: TopicDatasetBuild, locale: Locale, entityId: string, seriesId: string, row: WorkbookReadableRow): ParityTarget | null {
  const series = build.series.find((entry) => entry.seriesId === seriesId);
  const label = entityId === GEORGIA_PLACE_ID ? (locale === "ka" ? series?.labelKa : series?.labelEn) : build.entities.find((entity) => entity.entityId === entityId)?.[locale === "ka" ? "labelKa" : "labelEn"];
  return label === row.label ? { entityId, seriesId } : null;
}

async function gdpOf() {
  const { facts } = await loadServedGdpOverviewData();
  return facts.filter((fact) => fact.seriesId === "nominal_usd").map((fact) => ({ year: fact.year, valueUsd: fact.value, preliminary: fact.status === "preliminary" }));
}

/** Each page's amounts workbook models, with the presentation its page builds. */
async function pageModels(datasetId: string, locale: Locale, m: Matcher): Promise<WorkbookExportModel[]> {
  const build = dataset(datasetId);
  switch (datasetId) {
    case "external-money-from-abroad": {
      const data = toClientMoneyTransfersData(await loadServedMoneyTransfersData());
      const presentation = await getPresentation(locale, SCOPES, data.entities.map((entity) => entity.id));
      return moneyTransfersCrawlStates(data).map((state) => {
        const ids = buildMoneyTransfersModel(data, state, presentation).selectedIds;
        return m.add(buildMoneyTransfersWorkbookModel({ data, state, sources: [], siteOrigin: ORIGIN }, presentation), (row, index) => target(build, locale, GEORGIA_PLACE_ID, `${ids[index]}.${state.measure}`, row), flowScale(presentation));
      });
    }
    case "external-foreign-investment": {
      const data = toClientForeignInvestmentData(await loadServedForeignInvestmentData());
      const presentation = await getPresentation(locale, SCOPES, data.entities.map((entity) => entity.id));
      return foreignInvestmentCrawlStates(data).map((state) => {
        const ids = buildForeignInvestmentModel(data, state, presentation).selectedIds;
        return m.add(buildForeignInvestmentWorkbookModel({ data, state, sources: [], siteOrigin: ORIGIN }, presentation), (row, index) => {
          const id = ids[index]!;
          return state.dimension === "region" && id !== FOREIGN_INVESTMENT_TOTAL_ID ? target(build, locale, id.replace(/^fdi\./, ""), FOREIGN_INVESTMENT_TOTAL_ID, row) : target(build, locale, GEORGIA_PLACE_ID, id, row);
        }, flowScale(presentation));
      });
    }
    case "external-current-account": {
      const facts = toClientCurrentAccountFacts(await loadServedCurrentAccountFacts()), gdp = await gdpOf();
      const presentation = await getPresentation(locale, SCOPES, []);
      const states = currentAccountCrawlStates(facts, gdp);
      expect(states.filter((state) => state.unit !== "usd").map((state) => state.unit)).toEqual(["gdp", "gdp", "gdp"]);
      const flows = { balance: "net", in: "credit", out: "debit" } as const;
      return states.filter((state) => state.unit === "usd").map((state) => {
        const ids = buildCurrentAccountModel(facts, gdp, state, presentation).selectedIds;
        return m.add(buildCurrentAccountWorkbookModel({ facts, gdp, state, sources: [], siteOrigin: ORIGIN }, presentation), (row, index) => target(build, locale, GEORGIA_PLACE_ID, `${ids[index]}.${flows[state.tab]}`, row), flowScale(presentation));
      });
    }
    default: {
      const section = datasetId.replace(/^external-/, "") as ExternalPositionSectionId;
      const facts = externalPositionPageFacts((await loadServedExternalPositionData()).facts, section).map(toClientExternalPositionFact), gdp = await gdpOf();
      const presentation = await getPresentation(locale, SCOPES, []);
      const labels = externalPositionLabels(section, presentation.messages);
      const states = externalPositionCrawlStates(section, facts, gdp);
      expect(states.map((state) => state.view)).toEqual(["amount", "gdp"]);
      return states.filter((state) => state.view === "amount").map((state) => {
        const model = buildExternalPositionModel(section, facts, state, gdp);
        const workbook = buildExternalPositionWorkbookExportModel({ section, facts, state, labels, sources: [], siteOrigin: ORIGIN, gdp, latestLabel: model.latest.latestPeriod ? externalPositionLatestLabel(model.latest, presentation.messages) : undefined }, presentation);
        return m.add(workbook, (row, index) => target(build, locale, GEORGIA_PLACE_ID, model.selected[index]!.id, row), (unitLabel) => (unitLabel === message(presentation.messages, "external.position.unitMlnUsd") ? 1 : NaN));
      });
    }
  }
}

describe("external parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const datasetId of EXTERNAL_DATASETS) {
      it(`${datasetId} (${locale}): Georgia${datasetId === "external-foreign-investment" ? " and the regions" : ""}`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(datasetId), await pageModels(datasetId, locale, m), m.match);
      }, 60_000);
    }
  }

  it("fails when Foreign debt is served in US dollars rather than the million USD the page prints", async () => {
    const debt = dataset("external-foreign-debt");
    const facts = debt.facts.map((fact): TopicFact => (fact.seriesId === "ext_debt.total" && fact.year === 2025 ? { ...fact, value: fact.value! * 1e6 } : fact));
    const m = matcher();
    const models = await pageModels("external-foreign-debt", "en", m);
    expect(() => expectWorkbookParity({ ...debt, facts }, models, m.match)).toThrow(/2025: the page prints [\d.e+]+, country.georgia ext_debt.total serves/);
  }, 60_000);

  it("fails when Other countries is not the page's own total less its top 10", async () => {
    const transfers = dataset("external-money-from-abroad");
    const facts = transfers.facts.map((fact): TopicFact => (fact.seriesId === "transfer.others.received" && fact.year === 2024 ? { ...fact, value: fact.value! + 1000 } : fact));
    const m = matcher();
    const models = await pageModels("external-money-from-abroad", "en", m);
    expect(() => expectWorkbookParity({ ...transfers, facts }, models, m.match)).toThrow(/2024: the page prints [\d.e+]+, country.georgia transfer.others.received serves/);
  }, 60_000);

  it("names the total of Money from abroad as the page does", () => {
    expect(seriesOf("external-money-from-abroad", `${MONEY_TRANSFER_TOTAL_ID}.received`)).toMatchObject({ isTotal: true, headingEn: "Received", parentSeriesId: null });
  });
});
