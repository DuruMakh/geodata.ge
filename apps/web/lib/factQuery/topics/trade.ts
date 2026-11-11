// apps/web/lib/factQuery/topics/trade.ts
//
// The six Trade pages as topic datasets, each Georgia's (one entity). A page's national figures (total trade, exports,
// imports and balance; domestic exports and re-exports; services) are series named as its overview names them, and each
// breakdown row (a trading partner or country group, an HS4 product, a service type, a goods group or economic
// category) is a series of its measure: `trade.exports.<entity id>`, under the national figure it is part of. Series,
// years and values come from the pages' own data and models (toClientTrade*Data, the crawl states and
// buildTrade{Overview,Partners,Products}Model): the whole US dollars the pages and their workbooks carry, unit `usd`,
// where the workbooks print million or billion USD as a display scale. Products serves the HS4 block the page shows
// (2020–2025). Total trade, balance and re-exports are Fiscal.ge's sums of the published flows: status "derived", citing
// both upstream workbooks. A product or partner with no value in a flow is not a series of that flow. Build-time only:
// runtime code never imports it (tests/factQuery/purity.test.ts).
import { loadServedTradeCompositionData, toClientTradeCompositionData } from "../../data/tradeComposition/importTradeComposition";
import { loadServedTradeDomesticData, toClientTradeDomesticData } from "../../data/tradeDomestic/importTradeDomestic";
import { loadServedTradeOverviewData, toClientTradeOverviewFact } from "../../data/tradeOverview/importTradeOverview";
import type { ClientTradeOverviewFact, TradeChartIndicator } from "../../data/tradeOverview/types";
import { loadServedTradePartnersData, toClientTradePartnersData, type ClientTradePartnerEntity, type ClientTradePartnersData } from "../../data/tradePartners/importTradePartners";
import { loadServedTradeProductsData, toClientTradeProductsData, type ClientTradeProductsData } from "../../data/tradeProducts/importTradeProducts";
import { PRODUCT_SOURCE_BLOCK } from "../../data/tradeProducts/types";
import { loadServedTradeServicesData, toClientTradeServicesData } from "../../data/tradeServices/importTradeServices";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildTradeOverviewModel } from "../../explorer/tradeOverview";
import { tradeOverviewCrawlStates } from "../../explorer/tradeOverviewState";
import { buildTradePartnersModel } from "../../explorer/tradePartners";
import { tradePartnersCrawlStates } from "../../explorer/tradePartnersState";
import { buildTradeProductsModel, tradeProductLabel } from "../../explorer/tradeProducts";
import { TRADE_PRODUCT_TOTAL_ID, tradeProductsCrawlStates } from "../../explorer/tradeProductsState";
import { publicLabel } from "../../i18n/labels";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { collectTopicDataset, type Cell, type Names } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity } from "./types";

type Presentations = { ka: Presentation; en: Presentation };
type Context = Presentations & { sources: ReadonlyMap<string, string[]> };
type Dataset = ReturnType<typeof collectTopicDataset>;

/** The measures the pages state as Fiscal.ge's sums of published flows (the workbooks' formulas). */
const DERIVED: ReadonlySet<TradeChartIndicator> = new Set(["trade.turnover", "trade.balance", "trade.reexports"]);
/** Where a page's national figures sit in the reviewed CSVs: goods in the Overview's and Domestic exports' `goods.total`, services in `services.total`. */
const GOODS = "goods.total";
const SERVICES = "services.total";

const both = (presentations: Presentations, read: (presentation: Presentation) => string): Names => ({ ka: read(presentations.ka), en: read(presentations.en) });
const trade = (key: string) => (presentation: Presentation) => message(presentation.messages, `trade.${key}`);
/** A page's presentation in English with the entity names it ships (Domestic exports, Services, Composition carry their own). */
const withLabels = (context: Context, englishLabels: Readonly<Record<string, string>>): Presentations => ({ ka: context.ka, en: { ...context.en, englishLabels: { ...context.en.englishLabels, ...englishLabels } } });

function georgia(context: Context): TopicEntity {
  return { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "demography.georgia"), labelEn: message(context.en.messages, "demography.georgia"), parentEntityId: null };
}

/** A reviewed row's workbooks: every source its references name (both flows of a derived amount), by their registry ids. */
const sourceIdsOf = (sourceRefs: string) => [...new Set((JSON.parse(sourceRefs) as [string, string, string][]).map(([sourceId]) => `source.${sourceId.replaceAll("-", "_")}`))];

/** Each reviewed row's sources by entity, measure and year; the national rows under `goods.total` or `services.total`. */
function sourcesByCell(rows: readonly { entityId: string; indicatorId: string; year: number; sourceRefs: string }[]): Map<string, string[]> {
  const sources = new Map<string, string[]>();
  for (const row of rows) {
    const key = `${row.entityId}:${row.indicatorId}:${row.year}`;
    if (sources.has(key)) throw new Error(`Trade: two reviewed rows for ${key}`);
    sources.set(key, sourceIdsOf(row.sourceRefs));
  }
  return sources;
}

/** A value the page's model carries, in whole or exact US dollars as the page receives it; a missing one is no cell. */
function cellOf(context: Context, entityId: string, measure: TradeChartIndicator, year: number, value: number | null | undefined): Cell | undefined {
  if (value === null || value === undefined) return undefined;
  const sourceIds = context.sources.get(`${entityId}:${measure}:${year}`);
  if (!sourceIds) throw new Error(`Trade: no reviewed row for ${entityId} ${measure} ${year}`);
  return { value, unit: "usd", sourceIds, status: DERIVED.has(measure) ? "derived" : "official" };
}

/** Adds a series once: the national figure a page's overview and its breakdowns share is the overview's. One with no value in any year is not served. */
function addSeries(dataset: Dataset, added: Set<string>, entity: TopicEntity, seriesId: string, spec: { label: Names; heading: Names | null; parentSeriesId: string | null; isTotal: boolean }, years: readonly number[], cellAt: (year: number) => Cell | undefined) {
  if (added.has(seriesId) || years.every((year) => !cellAt(year))) return;
  added.add(seriesId);
  dataset.add(entity, { seriesId, indicatorId: seriesId, ...spec }, years, cellAt);
}

/**
 * A page's overview: each national figure over the page's years, named as the overview names it. Every one is the total
 * of its measure's breakdowns, where the page has them.
 */
function addOverview(context: Context, dataset: Dataset, added: Set<string>, facts: readonly ClientTradeOverviewFact[], nationalId: string, label: (id: TradeChartIndicator) => (presentation: Presentation) => string) {
  for (const state of tradeOverviewCrawlStates(facts)) {
    const model = buildTradeOverviewModel(facts, state, context.ka);
    for (const id of model.selectedIds) {
      addSeries(dataset, added, georgia(context), id, { label: both(context, label(id)), heading: null, parentSeriesId: null, isTotal: true }, model.years,
        (year) => cellOf(context, nationalId, id, year, model.valuesByIndicator[id][year]));
    }
  }
}

/**
 * A partner-shaped breakdown (trading partners and country groups, service types, countries of services trade, goods
 * groups and economic categories): every measure's rows the page's crawl tables list, each a series of its measure,
 * headed "<measure> · <kind>". The page's total row is the measure's national figure.
 */
function addPartners(context: Context, presentations: Presentations, dataset: Dataset, added: Set<string>, data: ClientTradePartnersData, nationalId: string,
  names: { measure: (measure: TradeChartIndicator) => (presentation: Presentation) => string; kind: (entity: ClientTradePartnerEntity) => (presentation: Presentation) => string; total: (presentation: Presentation) => string }) {
  const entities = new Map(data.entities.map((entity) => [entity.id, entity]));
  for (const state of tradePartnersCrawlStates(data)) {
    const model = buildTradePartnersModel(data, state, context.ka);
    const measure = both(presentations, names.measure(state.measure));
    for (const id of model.selectedIds) {
      const entity = entities.get(id);
      const values = model.valuesByEntity[id]!;
      if (!entity) {
        addSeries(dataset, added, georgia(context), state.measure, { label: both(presentations, names.total), heading: measure, parentSeriesId: null, isTotal: true }, model.years,
          (year) => cellOf(context, nationalId, state.measure, year, values[year]));
        continue;
      }
      const kind = both(presentations, names.kind(entity));
      addSeries(dataset, added, georgia(context), `${state.measure}.${id}`, {
        label: both(presentations, (presentation) => publicLabel(presentation.locale, id, entity.labelKa, presentation.englishLabels)),
        heading: { ka: `${measure.ka} · ${kind.ka}`, en: `${measure.en} · ${kind.en}` }, parentSeriesId: state.measure, isTotal: false,
      }, model.years, (year) => cellOf(context, id, state.measure, year, values[year]));
    }
  }
}

/** HS4 products: each flow's products the page's crawl tables list ("Name · code"), each a series of its flow under the flow's heading. */
function addProducts(context: Context, presentations: Presentations, dataset: Dataset, added: Set<string>, data: ClientTradeProductsData, heading: (measure: TradeChartIndicator) => (presentation: Presentation) => string) {
  const entities = new Map(data.entities.map((entity) => [entity.id, entity]));
  for (const state of tradeProductsCrawlStates(data)) {
    const model = buildTradeProductsModel(data, state, context.ka);
    const head = both(presentations, heading(state.measure));
    for (const id of model.selectedIds) {
      const entity = entities.get(id);
      const values = model.valuesByEntity[id]!;
      if (id === TRADE_PRODUCT_TOTAL_ID) {
        addSeries(dataset, added, georgia(context), state.measure, { label: both(presentations, trade("partners.total")), heading: head, parentSeriesId: null, isTotal: true }, model.years,
          (year) => cellOf(context, GOODS, state.measure, year, values[year]));
        continue;
      }
      addSeries(dataset, added, georgia(context), `${state.measure}.${id}`, { label: both(presentations, (presentation) => tradeProductLabel(entity!, presentation, !data.sourceBlock)), heading: head, parentSeriesId: state.measure, isTotal: false },
        model.years, (year) => cellOf(context, id, state.measure, year, values[year]));
    }
  }
}

function topicDataset(context: Context, datasetId: string, title: string, fill: (dataset: Dataset, added: Set<string>) => void): TopicDatasetBuild {
  const dataset = collectTopicDataset(datasetId, both(context, trade(title)), "actual");
  fill(dataset, new Set<string>());
  return dataset.build([]);
}

const partnerKind = (entity: ClientTradePartnerEntity) => trade(entity.kind === "country" ? "partners.countries" : "partners.groups");

export const tradeTopicAdapter: TopicAdapter = {
  family: "trade",
  sourceArchive: ["trade"],
  async build() {
    const [national, partners, products, domestic, services, composition] = await Promise.all([
      loadServedTradeOverviewData(), loadServedTradePartnersData(), loadServedTradeProductsData(), loadServedTradeDomesticData(), loadServedTradeServicesData(), loadServedTradeCompositionData(),
    ]);
    const productData = toClientTradeProductsData(products, national.facts, "", PRODUCT_SOURCE_BLOCK);
    const labelIds = [...partners.entities.map((entity) => entity.id), ...productData.entities.map((entity) => entity.id)];
    const [ka, en] = await Promise.all([getPresentation("ka", ["trade", "demography"], []), getPresentation("en", ["trade", "demography"], labelIds)]);
    const shown = new Set(productData.entities.map((entity) => entity.id));
    const context: Context = {
      ka, en,
      sources: sourcesByCell([
        ...national.facts.map((fact) => ({ ...fact, entityId: GOODS })), ...partners.facts, ...products.facts.filter((fact) => shown.has(fact.entityId)),
        ...domestic.facts, ...services.facts, ...composition.facts,
      ]),
    };
    const domesticData = toClientTradeDomesticData(domestic, national.facts);
    const servicesData = toClientTradeServicesData(services);
    const compositionData = toClientTradeCompositionData(composition, national.facts);
    const overviewLabel = (id: TradeChartIndicator) => trade(`indicator.${id}`);
    return [
      topicDataset(context, "trade-overview", "title", (dataset, added) => addOverview(context, dataset, added, national.facts.map(toClientTradeOverviewFact), GOODS, overviewLabel)),
      topicDataset(context, "trade-partners", "partners.title", (dataset, added) =>
        addPartners(context, context, dataset, added, toClientTradePartnersData(partners, national.facts), GOODS, { measure: overviewLabel, kind: partnerKind, total: trade("partners.total") })),
      topicDataset(context, "trade-products", "products.title", (dataset, added) => addProducts(context, context, dataset, added, productData, overviewLabel)),
      topicDataset(context, "trade-domestic-exports", "domestic.title", (dataset, added) => {
        const pages = withLabels(context, domesticData.englishLabels);
        addOverview(context, dataset, added, domesticData.national, GOODS, (id) => trade(id === "trade.exports" ? "domestic.totalExports" : `indicator.${id}`));
        addPartners(context, pages, dataset, added, domesticData.countries, GOODS, { measure: overviewLabel, kind: partnerKind, total: trade("partners.total") });
        addProducts(context, pages, dataset, added, domesticData.products, (measure) => (presentation) => `${overviewLabel(measure)(presentation)} · ${trade("domestic.products")(presentation)}`);
      }),
      topicDataset(context, "trade-services", "services.title", (dataset, added) => {
        const pages = withLabels(context, servicesData.englishLabels);
        const measure = (id: TradeChartIndicator) => trade(`services.indicator.${id}`);
        addOverview(context, dataset, added, servicesData.national, SERVICES, measure);
        addPartners(context, pages, dataset, added, servicesData.types, SERVICES, { measure, kind: () => trade("services.types"), total: trade("services.total") });
        addPartners(context, pages, dataset, added, servicesData.countries, SERVICES, { measure, kind: () => trade("services.countries"), total: trade("partners.total") });
      }),
      topicDataset(context, "trade-composition", "composition.title", (dataset, added) => {
        const pages = withLabels(context, compositionData.englishLabels);
        for (const classification of ["sitc", "bec"] as const) {
          addPartners(context, pages, dataset, added, compositionData[classification], GOODS, { measure: (id) => trade(`composition.indicator.${id}`), kind: () => trade(`composition.${classification}`), total: trade("composition.total") });
        }
      }),
    ];
  },
};
