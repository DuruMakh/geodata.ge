// apps/web/lib/factQuery/topics/internet.ts
//
// The Internet and technology pages as topic datasets. Internet users, Shopping and services online and Phones and
// computers serve Georgia's rows (each crawl table's rows: a heading's groups of people, the online activities or the
// public services); Internet at home serves Georgia's and each region's area page, the place the entity, its own homes
// with internet and with a computer a series, and Georgia's towns and villages series of Georgia. Series, names and years
// come from the pages' own functions (lib/explorer/internetPageData.ts, internetCrawlStates, internetAreaCrawlStates and
// their models); values are Geostat's survey shares as the pages' workbooks print them (one decimal), in per cent. The
// Internet at home index draws a map and a list of the area pages' figures, no table of its own. Build-time only:
// runtime code never imports it (tests/factQuery/purity.test.ts).
import { loadServedInternetData } from "../../data/internet/importInternet";
import { internetFactKey, type InternetFact } from "../../data/internet/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildInternetModel, internetCrawlStates, type InternetHeading, type InternetTopicId } from "../../explorer/internet";
import { buildInternetAreaModel, INTERNET_AREAS, internetAreaCrawlStates, internetMapId } from "../../explorer/internetAreas";
import { internetAreaFacts, internetLabels, internetPageFacts } from "../../explorer/internetPageData";
import { regionAreaLabels, regionAreaPages } from "../../explorer/regionAreaPages";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { collectTopicDataset, type Cell, type Names } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { facts: readonly InternetFact[]; rows: ReadonlyMap<string, InternetFact>; ka: Presentation; en: Presentation };

const AREA_PAGES = regionAreaPages(INTERNET_AREAS, internetMapId);
const AREA_LABEL_IDS = AREA_PAGES.map((area) => area.id);

const both = (context: Context, read: (presentation: Presentation) => string): Names => ({ ka: read(context.ka), en: read(context.en) });

/** A heading in full: the measure and, after " · ", the people it is a share of ("% of internet users aged 15+"), which the unit alone does not say. */
const headingOf = (context: Context, heading: InternetHeading) => both(context, ({ messages }) => message(messages, `internet.heading.${heading}`));

/** A reviewed row as the page's workbook prints it: Geostat's share to one decimal, in per cent. */
function cellOf(context: Context, indicatorId: string, year: number): Cell | undefined {
  const row = context.rows.get(internetFactKey({ indicatorId: indicatorId as InternetFact["indicatorId"], year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "survey_estimate" };
}

/** Internet users, Shopping and services online or Phones and computers: each crawl table's rows (one heading each) over the table's years. */
function buildTopic(context: Context, section: InternetTopicId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`internet-${section}`, both(context, ({ messages }) => message(messages, `internet.page.${section}.title`)), "actual");
  const facts = internetPageFacts(context.facts, section);
  const [ka, en] = [internetLabels(context.ka, section), internetLabels(context.en, section)];
  const georgia: TopicEntity = { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "internet.area.georgia"), labelEn: message(context.en.messages, "internet.area.georgia"), parentEntityId: null };
  for (const state of internetCrawlStates(section, facts)) {
    const model = buildInternetModel(section, facts, state);
    for (const series of model.selected) {
      dataset.add(georgia, { seriesId: series.id, indicatorId: series.id, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: headingOf(context, series.heading), parentSeriesId: null, isTotal: series.reference },
        model.years, (year) => cellOf(context, series.id, year));
    }
  }
  return dataset.build([]);
}

/**
 * An area page's row, served: the place's own homes with internet or with a computer (`internet.homes_internet`, the
 * place the entity) under the region pages' "Share of homes", named as a region's page names them; Georgia's towns and
 * villages (`internet.homes_internet.urban`) under their measure's heading, named as Georgia's page names them.
 */
function areaRow(context: Context, indicatorId: string): { seriesId: string; label: Names; heading: Names; isTotal: boolean } {
  const [prefix, measure, group] = indicatorId.split(".") as [string, InternetHeading, string];
  if (group === "urban" || group === "rural") {
    return { seriesId: `${prefix}.${measure}.${group}`, label: both(context, ({ messages }) => message(messages, `internet.series.group.${group}`)), heading: headingOf(context, measure), isTotal: false };
  }
  const kind = measure === "homes_internet" ? "internet" : "computer";
  return { seriesId: `${prefix}.${measure}`, label: both(context, ({ messages }) => message(messages, `internet.series.area.${kind}`)), heading: headingOf(context, "homes"), isTotal: true };
}

/** Internet at home: Georgia's and each region's area page, every row of its one crawl table over the table's years. */
function buildHomes(context: Context): TopicDatasetBuild {
  const dataset = collectTopicDataset("internet-homes", both(context, ({ messages }) => message(messages, "internet.page.homes.title")), "actual");
  const [areaKa, areaEn] = [regionAreaLabels(context.ka, "internet", INTERNET_AREAS, AREA_PAGES), regionAreaLabels(context.en, "internet", INTERNET_AREAS, AREA_PAGES)];
  for (const area of INTERNET_AREAS) {
    const country = area === "georgia";
    const entity: TopicEntity = { entityId: country ? GEORGIA_PLACE_ID : internetMapId(area), entityType: country ? "country" : "region", labelKa: areaKa[area], labelEn: areaEn[area], parentEntityId: country ? null : GEORGIA_PLACE_ID };
    const facts = internetAreaFacts(context.facts, area);
    for (const state of internetAreaCrawlStates(area, facts)) {
      const model = buildInternetAreaModel(area, facts, state);
      for (const series of model.selected) {
        const { seriesId, ...row } = areaRow(context, series.id);
        dataset.add(entity, { seriesId, indicatorId: seriesId, ...row, parentSeriesId: null }, model.years, (year) => cellOf(context, series.id, year));
      }
    }
  }
  return dataset.build([]);
}

export const internetTopicAdapter: TopicAdapter = {
  family: "internet",
  sourceArchive: ["internet"],
  async build() {
    const [{ facts }, ka, en] = await Promise.all([loadServedInternetData(), getPresentation("ka", ["internet"], AREA_LABEL_IDS, AREA_LABEL_IDS), getPresentation("en", ["internet"], AREA_LABEL_IDS, AREA_LABEL_IDS)]);
    const context: Context = { facts, rows: new Map(facts.map((fact) => [internetFactKey(fact), fact])), ka, en };
    return [buildHomes(context), ...(["users", "online", "devices"] as const).map((section) => buildTopic(context, section))];
  },
};
