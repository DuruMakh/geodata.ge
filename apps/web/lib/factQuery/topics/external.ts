// apps/web/lib/factQuery/topics/external.ts
//
// The five External flows pages as topic datasets, each Georgia's (one entity). Series, years and values come from
// the pages' own data and models (toClient*, the crawl states and build*Model), in the amounts the pages show; the %
// of GDP views divide by GDP in the browser and are not served (no GDP is passed, so no such state is built).
// - Foreign debt and Reserves: each series as NBG prints it, in million USD (the CSV's `usd_million`, the figure the
//   page's workbook prints). The latest 2026 point is a mid-year amount, not a 31 December one: it carries its date
//   (`periodEnd`).
// - Current account: each part in each of the page's three views (balance, money in, money out), `ca.goods.net`.
// - Foreign investment: the total, each tab's items (the end year's top 10 countries and Other countries, every
//   sector) under the tab's name; the By region tab's regions are places (`region.adjara`), each with its total.
// - Money from abroad: received and sent from all countries, the end year's top 10 and Other countries,
//   `transfer.total.received`. A year a country's months are partly blank is "partial" with its months, as the page marks it.
// The values are US dollars (the CSVs' `usd`); the workbooks print million or billion USD as a display scale. Other
// countries (the total less the top 10) is the pages' own sum: status "derived", citing the rows it rests on.
// Build-time only: runtime code never imports it (tests/factQuery/purity.test.ts).
import { loadServedCurrentAccountFacts, toClientCurrentAccountFacts } from "../../data/externalFlows/importCurrentAccount";
import { loadServedForeignInvestmentData, toClientForeignInvestmentData } from "../../data/externalFlows/importForeignInvestment";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../../data/externalFlows/importMoneyTransfers";
import { currentAccountFactKey, foreignInvestmentFactKey, FOREIGN_INVESTMENT_TOTAL_ID, MONEY_TRANSFER_TOTAL_ID, moneyTransferFactKey, type CurrentAccountFact, type ForeignInvestmentData, type MoneyTransfersData } from "../../data/externalFlows/types";
import { loadServedExternalPositionData, toClientExternalPositionFact } from "../../data/externalPosition/importExternalPosition";
import { externalPositionFactKey, externalPositionSourceDocumentId, type ExternalPositionFact } from "../../data/externalPosition/types";
import { buildCurrentAccountModel, currentAccountCrawlStates, FLOW_BY_TAB } from "../../explorer/currentAccount";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildExternalPositionModel, externalPositionCrawlStates, externalPositionLabels, externalPositionPageFacts, type ExternalPositionSectionId } from "../../explorer/externalPosition";
import { buildForeignInvestmentModel } from "../../explorer/foreignInvestment";
import { FOREIGN_INVESTMENT_OTHERS_ID, foreignInvestmentCrawlStates } from "../../explorer/foreignInvestmentState";
import { buildMoneyTransfersModel } from "../../explorer/moneyTransfers";
import { moneyTransfersCrawlStates, OTHER_COUNTRIES_ID } from "../../explorer/moneyTransfersState";
import { publicLabel } from "../../i18n/labels";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { both, collectTopicDataset, type Cell } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity, TopicSeriesNote } from "./types";

type Context = { ka: Presentation; en: Presentation };
type Dataset = ReturnType<typeof collectTopicDataset>;

const external = (key: string) => (presentation: Presentation) => message(presentation.messages, `external.${key}`);

function georgia(context: Context): TopicEntity {
  return { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "demography.georgia"), labelEn: message(context.en.messages, "demography.georgia"), parentEntityId: null };
}

/** Other countries' definition note: every country but the end year's top 10. */
const otherCountries = (year: number): TopicSeriesNote => ({ key: "definitions.topicOtherCountries", values: { year } });

/** Adds a place's series once: a total every tab of a page lists is served under the first tab's years, which span the others'. */
function addOnce(dataset: Dataset, added: Set<string>, ...[entity, spec, years, cellAt]: Parameters<Dataset["add"]>) {
  const key = `${entity.entityId}:${spec.seriesId}`;
  if (added.has(key)) return;
  added.add(key);
  dataset.add(entity, spec, years, cellAt);
}

/**
 * Foreign debt or Reserves: the total and its parts over the amounts' years, as NBG prints them (one decimal, million
 * USD). The latest point, a mid-year amount, carries its date.
 */
function positionDataset(context: Context, facts: readonly ExternalPositionFact[], section: ExternalPositionSectionId): TopicDatasetBuild {
  const pageFacts = externalPositionPageFacts(facts, section), client = pageFacts.map(toClientExternalPositionFact);
  const rows = new Map(pageFacts.map((fact) => [externalPositionFactKey(fact), fact]));
  const dataset = collectTopicDataset(`external-${section}`, both(context, external(`${section === "foreign-debt" ? "debt" : "reserves"}.title`)), "actual");
  const labels = { ka: externalPositionLabels(section, context.ka.messages), en: externalPositionLabels(section, context.en.messages) };
  for (const state of externalPositionCrawlStates(section, client, [])) {
    const model = buildExternalPositionModel(section, client, state, []);
    const total = model.series[0]!.id;
    for (const series of model.selected) {
      dataset.add(georgia(context), { seriesId: series.id, indicatorId: series.id, label: { ka: labels.ka[series.id]!, en: labels.en[series.id]! }, heading: null, parentSeriesId: series.reference ? null : total, isTotal: series.reference }, model.years, (year): Cell | undefined => {
        if (series.valuesByYear[year] === null) return undefined;
        const row = rows.get(externalPositionFactKey({ indicatorId: series.id, year }))!;
        return { value: Number(row.publishedValue), unit: row.unit, sourceIds: [externalPositionSourceDocumentId(row.sourceId)], status: "official", ...(row.periodEnd.endsWith("-12-31") ? {} : { periodEnd: row.periodEnd }) };
      });
    }
  }
  return dataset.build([]);
}

/** Current account: the five series of each view (balance, money in, money out) in US dollars, `<series>.<flow>`, under the view's name. */
function currentAccountDataset(context: Context, facts: readonly CurrentAccountFact[]): TopicDatasetBuild {
  const client = toClientCurrentAccountFacts(facts);
  const rows = new Map(facts.map((fact) => [currentAccountFactKey(fact), fact]));
  const dataset = collectTopicDataset("external-current-account", both(context, external("account.title")), "actual");
  for (const state of currentAccountCrawlStates(client, [])) {
    const model = buildCurrentAccountModel(client, [], state, context.ka);
    const flow = FLOW_BY_TAB[state.tab];
    for (const id of model.selectedIds) {
      dataset.add(georgia(context), {
        seriesId: `${id}.${flow}`, indicatorId: id, label: both(context, external(`account.series.${id}`)), heading: both(context, external(`account.tab.${state.tab}`)),
        parentSeriesId: id === "ca.balance" ? null : `ca.balance.${flow}`, isTotal: id === "ca.balance",
      }, model.years, (year) => {
        const value = model.valuesById[id][year];
        if (value === null) return undefined;
        const row = rows.get(currentAccountFactKey({ seriesId: id, flow, year }))!;
        return { value, unit: row.unit, sourceIds: [row.sourceId], status: "official" };
      });
    }
  }
  return dataset.build([]);
}

/**
 * Foreign investment: each tab's list (the total, the end year's top 10 countries and Other countries, every sector) in
 * US dollars, under the tab's name. The By region tab's regions are places: each region's total, `fdi.total`.
 */
function foreignInvestmentDataset(context: Context, data: ForeignInvestmentData): TopicDatasetBuild {
  const client = toClientForeignInvestmentData(data);
  const rows = new Map(data.facts.map((fact) => [foreignInvestmentFactKey(fact), fact]));
  const entities = new Map(data.entities.map((entity) => [entity.id, entity]));
  const dataset = collectTopicDataset("external-foreign-investment", both(context, external("investment.title")), "actual");
  const added = new Set<string>();
  const label = (id: string) => (presentation: Presentation) =>
    id === FOREIGN_INVESTMENT_OTHERS_ID ? message(presentation.messages, "external.investment.otherCountries") : publicLabel(presentation.locale, id, entities.get(id)!.labelKa, presentation.englishLabels);
  const country = georgia(context);
  /** A region of the By region tab, as the place ids every topic uses name it (`fdi.region.adjara` is `region.adjara`). */
  const region = (id: string): TopicEntity => ({ entityId: id.replace(/^fdi\./, ""), entityType: "region", labelKa: label(id)(context.ka), labelEn: label(id)(context.en), parentEntityId: GEORGIA_PLACE_ID });
  for (const state of foreignInvestmentCrawlStates(client)) {
    const model = buildForeignInvestmentModel(client, state, context.ka);
    const listed = model.selectedIds.filter((id) => id !== FOREIGN_INVESTMENT_TOTAL_ID && id !== FOREIGN_INVESTMENT_OTHERS_ID);
    for (const id of model.selectedIds) {
      const total = id === FOREIGN_INVESTMENT_TOTAL_ID, others = id === FOREIGN_INVESTMENT_OTHERS_ID, place = !total && state.dimension === "region";
      const entity = place ? region(id) : country;
      const seriesId = place ? FOREIGN_INVESTMENT_TOTAL_ID : id;
      addOnce(dataset, added, entity, {
        seriesId, indicatorId: seriesId, label: both(context, label(seriesId)), heading: total || place ? null : both(context, external(`investment.tab.${state.dimension}`)),
        parentSeriesId: total || place ? null : FOREIGN_INVESTMENT_TOTAL_ID, isTotal: total || place,
        ...(others ? { note: otherCountries(model.range.end) } : {}),
      }, model.years, (year) => {
        const value = model.valuesByEntity[id]![year];
        if (value === null || value === undefined) return undefined;
        // Other countries is the total less the top 10: it rests on the total's row and each listed country's.
        const inputs = others ? [FOREIGN_INVESTMENT_TOTAL_ID, ...listed] : [id];
        const sourceIds = [...new Set(inputs.flatMap((input) => { const row = rows.get(foreignInvestmentFactKey({ entityId: input, year })); return row?.valueUsd == null ? [] : [row.sourceId]; }))];
        return { value, unit: "usd", sourceIds, status: others ? "derived" : "official" };
      });
    }
  }
  return dataset.build([]);
}

/**
 * Money from abroad: received and sent, each the all-country total, the end year's top 10 countries and Other countries
 * in US dollars, `<entity>.<measure>`, under the measure's name. A year the page marks partial (months the source left
 * blank) is "partial" with the months it carries; Other countries' other years are the page's sum, "derived".
 */
function moneyTransfersDataset(context: Context, data: MoneyTransfersData): TopicDatasetBuild {
  const client = toClientMoneyTransfersData(data);
  const rows = new Map(data.facts.map((fact) => [moneyTransferFactKey(fact), fact]));
  const entities = new Map(client.entities.map((entity) => [entity.id, entity]));
  const dataset = collectTopicDataset("external-money-from-abroad", both(context, external("money.title")), "actual");
  const label = (id: string) => (presentation: Presentation) =>
    id === OTHER_COUNTRIES_ID ? message(presentation.messages, "external.money.otherCountries") : publicLabel(presentation.locale, id, entities.get(id)!.labelKa, presentation.englishLabels);
  for (const state of moneyTransfersCrawlStates(client)) {
    const model = buildMoneyTransfersModel(client, state, context.ka);
    const { measure } = state;
    const listed = model.series.map((series) => series.id).filter((id) => id !== MONEY_TRANSFER_TOTAL_ID && id !== OTHER_COUNTRIES_ID);
    for (const id of model.selectedIds) {
      const total = id === MONEY_TRANSFER_TOTAL_ID, others = id === OTHER_COUNTRIES_ID;
      dataset.add(georgia(context), {
        seriesId: `${id}.${measure}`, indicatorId: id, label: both(context, label(id)), heading: both(context, external(`measure.${measure}`)), parentSeriesId: total ? null : `${MONEY_TRANSFER_TOTAL_ID}.${measure}`, isTotal: total,
        ...(others ? { note: otherCountries(model.range.end) } : {}),
      }, model.years, (year) => {
        const value = model.valuesByEntity[id]![year];
        if (value === null || value === undefined) return undefined;
        const inputs = others ? [MONEY_TRANSFER_TOTAL_ID, ...listed] : [id];
        const sourceIds = [...new Set(inputs.flatMap((input) => { const row = rows.get(moneyTransferFactKey({ entityId: input, measure, year })); return row?.valueUsd == null ? [] : [row.sourceId]; }))];
        const months = model.partialMonths[id]?.[year];
        // A fact carries one status: a partial Other countries year is "partial" in place of "derived".
        return { value, unit: "usd", sourceIds, ...(months === undefined ? { status: others ? "derived" : "official" } : { status: "partial", monthsReported: months }) };
      });
    }
  }
  return dataset.build([]);
}

export const externalTopicAdapter: TopicAdapter = {
  family: "external",
  sourceArchive: ["external-flows"],
  async build() {
    const [position, currentAccount, investment, transfers] = await Promise.all([loadServedExternalPositionData(), loadServedCurrentAccountFacts(), loadServedForeignInvestmentData(), loadServedMoneyTransfersData()]);
    const labelIds = [...investment.entities, ...toClientMoneyTransfersData(transfers).entities].map((entity) => entity.id);
    const [ka, en] = await Promise.all([getPresentation("ka", ["external", "demography"], []), getPresentation("en", ["external", "demography"], labelIds)]);
    const context: Context = { ka, en };
    return [
      moneyTransfersDataset(context, transfers),
      foreignInvestmentDataset(context, investment),
      currentAccountDataset(context, currentAccount),
      positionDataset(context, position.facts, "foreign-debt"),
      positionDataset(context, position.facts, "reserves"),
    ];
  },
};
