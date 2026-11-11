// apps/web/lib/factQuery/topics/moneyBanks.ts
//
// The Money and banks pages as topic datasets. Money supply, Loans and deposits, Who borrows, Interest rates and Bank
// health serve Georgia's rows; Loans by region serves Georgia's and each region's area page, the place the entity and
// its all loans, lari and foreign-currency loans (`loans_region.total`, ...) the series. Series, names and years come
// from the pages' own functions (lib/explorer/moneyBanksPageData.ts, moneyBanksCrawlStates, moneyBanksAreaCrawlStates
// and their models); values are NBG's published figures, or Fiscal.ge's reviewed sums and shares the CSV stores
// (status "derived"), as the pages print them, in million GEL or %. Money supply's % of GDP view is the page's own
// division by GDP and is not served (spec §4); Loans and deposits' shares in foreign currency are the CSV's and are.
// Build-time only: runtime code never imports it (tests/factQuery/purity.test.ts).
import { loadServedMoneyBanksData } from "../../data/moneyBanks/importMoneyBanks";
import { MONEY_BANKS_LOAN_AREAS, moneyBanksFactKey, type MoneyBanksFact } from "../../data/moneyBanks/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildMoneyBanksModel, moneyBanksCrawlStates, moneyBanksHasTotalRow, moneyBanksViews, moneyBanksViewSeries, type MoneyBanksState, type MoneyBanksTopicId } from "../../explorer/moneyBanks";
import { buildMoneyBanksAreaModel, moneyBanksAreaCrawlStates, moneyBanksAreaSeries, moneyBanksMapId, type MoneyBanksArea } from "../../explorer/moneyBanksAreas";
import { moneyBanksAreaFacts, moneyBanksAreaSeriesLabels, moneyBanksLabels, moneyBanksPageFacts } from "../../explorer/moneyBanksPageData";
import { regionAreaLabels, regionAreaPages } from "../../explorer/regionAreaPages";
import { unitListCrawlStates } from "../../explorer/unitList";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { loadTopicBreaks } from "./breaks";
import { breaksOnServedSeries, collectTopicDataset, type Cell, type Names } from "./collect";
import type { TopicAdapter, TopicBreak, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { facts: readonly MoneyBanksFact[]; rows: ReadonlyMap<string, MoneyBanksFact>; breaks: readonly TopicBreak[]; ka: Presentation; en: Presentation };

const names = (context: Context, key: string): Names => ({ ka: message(context.ka.messages, `moneyBanks.${key}`), en: message(context.en.messages, `moneyBanks.${key}`) });

/** A reviewed row as the page prints it: its published figure, in its stored unit; a sum or share Fiscal.ge calculated is "derived". */
function cellOf(context: Context, indicatorId: string, year: number): Cell | undefined {
  const row = context.rows.get(moneyBanksFactKey({ indicatorId: indicatorId as MoneyBanksFact["indicatorId"], year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: row.valueStatus === "calculated" ? "derived" : "official" };
}

const AREA_PAGES = regionAreaPages(MONEY_BANKS_LOAN_AREAS, moneyBanksMapId);

/** Georgia or a region, named as the Loans by region pages name it. */
function areaEntity(context: Context, area: MoneyBanksArea): TopicEntity {
  const country = area === "georgia";
  const [ka, en] = [context.ka, context.en].map((presentation) => regionAreaLabels(presentation, "moneyBanks", MONEY_BANKS_LOAN_AREAS, AREA_PAGES)[area]);
  return { entityId: country ? GEORGIA_PLACE_ID : moneyBanksMapId(area), entityType: country ? "country" : "region", labelKa: ka!, labelEn: en!, parentEntityId: country ? null : GEORGIA_PLACE_ID };
}

/**
 * A topic page: each crawl table's rows (a view's rows of one unit) over the table's years, and on Loans and deposits
 * the shares in foreign currency, a view the page switches to but whose crawl tables it leaves out (its amounts list the
 * loans and deposits the shares divide).
 */
function buildTopic(context: Context, section: MoneyBanksTopicId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`money-${section}`, names(context, `page.${section}.title`), "actual");
  const facts = moneyBanksPageFacts(context.facts, section);
  const [ka, en] = [moneyBanksLabels(context.ka, section), moneyBanksLabels(context.en, section)];
  const georgia = areaEntity(context, "georgia");
  const shares: MoneyBanksState[] = moneyBanksViews(section).includes("fx_share")
    ? unitListCrawlStates(moneyBanksViewSeries(section, "fx_share"), facts).map((state) => ({ ...state, view: "fx_share" })) : [];
  // Without GDP the % of GDP view has no state: only the amounts and the reviewed shares are served.
  for (const state of [...moneyBanksCrawlStates(section, facts), ...shares]) {
    const model = buildMoneyBanksModel(section, facts, state);
    for (const series of model.selected) {
      dataset.add(georgia, {
        seriesId: series.id, indicatorId: series.id, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: series.heading ? names(context, `heading.${series.heading}`) : null,
        parentSeriesId: series.parentId ?? null, isTotal: series.reference && moneyBanksHasTotalRow(section),
      }, model.years, (year) => cellOf(context, series.id, year));
    }
  }
  return dataset.build(context.breaks);
}

/** The served id of an area page's row: `loans_region.<part>` (the place is the entity). */
const partId = (indicatorId: string) => `loans_region.${indicatorId.split(".")[2]}`;

/** Loans by region: Georgia's and each region's area page, its three loan rows over its years. */
function buildRegions(context: Context): TopicDatasetBuild {
  const dataset = collectTopicDataset("money-regions", names(context, "page.regions.title"), "actual");
  for (const area of MONEY_BANKS_LOAN_AREAS) {
    const entity = areaEntity(context, area);
    const facts = moneyBanksAreaFacts(context.facts, area);
    const [ka, en] = [moneyBanksAreaSeriesLabels(context.ka.messages, area), moneyBanksAreaSeriesLabels(context.en.messages, area)];
    for (const state of moneyBanksAreaCrawlStates(area, facts)) {
      const model = buildMoneyBanksAreaModel(area, facts, state);
      for (const series of model.selected) {
        const seriesId = partId(series.id);
        // An area's all loans is its lari plus its foreign-currency loans: the workbook's total row.
        dataset.add(entity, { seriesId, indicatorId: seriesId, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: names(context, "heading.area"), parentSeriesId: null, isTotal: series.reference },
          model.years, (year) => cellOf(context, series.id, year));
      }
    }
  }
  // A break the register names on the areas' indicators (`loans_region.region_adjara.total`) lies on the served row.
  const members = Map.groupBy(MONEY_BANKS_LOAN_AREAS.flatMap((area) => moneyBanksAreaSeries(area).map((series) => series.id)), partId);
  return dataset.build(breaksOnServedSeries(context.breaks, members));
}

export const moneyBanksTopicAdapter: TopicAdapter = {
  family: "money-banks",
  sourceArchive: ["money"],
  async build() {
    const ids = AREA_PAGES.map((area) => area.id);
    const [breaks, { facts }, ka, en] = await Promise.all([
      loadTopicBreaks("money-banks-series-breaks.csv"), loadServedMoneyBanksData(), getPresentation("ka", ["moneyBanks"], ids, ids), getPresentation("en", ["moneyBanks"], ids, ids),
    ]);
    const context: Context = { facts, rows: new Map(facts.map((fact) => [moneyBanksFactKey(fact), fact])), breaks, ka, en };
    return [buildTopic(context, "supply"), buildTopic(context, "loans-deposits"), buildTopic(context, "borrowers"), buildRegions(context), buildTopic(context, "interest-rates"), buildTopic(context, "bank-health")];
  },
};
