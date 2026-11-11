// apps/web/lib/factQuery/topics/business.ts
//
// The Business pages as topic datasets. Sales, Jobs, Investment and profit and Firms serve Georgia's rows (each crawl
// table's rows, a list's rows of one unit, over the table's years); Regions serves Georgia's and each region's area page,
// the place the entity and each measure (`business.turnover`, ...) its series. Series, names and years come from the
// pages' own functions (lib/explorer/businessPageData.ts, businessCrawlStates, businessAreaCrawlStates and their models);
// values are Geostat's published figures the pages print, in each row's own unit (million GEL, persons, firms, %).
// The Regions index draws a map and a list of the area pages' figures, no table of its own. Build-time only: runtime
// code never imports it (tests/factQuery/purity.test.ts).
import { loadServedBusinessData } from "../../data/business/importBusiness";
import { businessFactKey, type BusinessFact } from "../../data/business/types";
import { buildBusinessModel, businessCrawlStates, businessTopicSeries, type BusinessHeading, type BusinessTopicId } from "../../explorer/business";
import { BUSINESS_AREAS, buildBusinessAreaModel, businessAreaCrawlStates, businessAreaSeries, businessMapId, type BusinessArea } from "../../explorer/businessAreas";
import { BUSINESS_AREA_LABEL_IDS, BUSINESS_SECTOR_LABEL_IDS, businessAreaFacts, businessAreaLabels, businessAreaSeriesLabels, businessLabels, businessPageFacts } from "../../explorer/businessPageData";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { loadTopicBreaks } from "./breaks";
import { breaksOnServedSeries, collectTopicDataset, type Cell, type Names } from "./collect";
import type { TopicAdapter, TopicBreak, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { facts: readonly BusinessFact[]; rows: ReadonlyMap<string, BusinessFact>; breaks: readonly TopicBreak[]; ka: Presentation; en: Presentation };

const names = (context: Context, key: string): Names => ({ ka: message(context.ka.messages, `business.${key}`), en: message(context.en.messages, `business.${key}`) });

/** A heading's name without the display unit the page adds to it ("Jobs · thousand people"): the served unit is the row's own. */
const headingNames = (context: Context, heading: BusinessHeading) => names(context, heading === "size" || heading === "industry" ? `heading.${heading}` : `measure.${heading}`);

/** A reviewed row as the page prints it: Geostat's published figure, in its stored unit. */
function cellOf(context: Context, indicatorId: string, year: number): Cell | undefined {
  const row = context.rows.get(businessFactKey({ indicatorId: indicatorId as BusinessFact["indicatorId"], year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "official" };
}

/** Georgia or a region, named as the area pages name it. */
function areaEntity(context: Context, area: BusinessArea): TopicEntity {
  const country = area === "georgia";
  return {
    entityId: country ? GEORGIA_PLACE_ID : businessMapId(area), entityType: country ? "country" : "region",
    labelKa: businessAreaLabels(context.ka)[area], labelEn: businessAreaLabels(context.en)[area], parentEntityId: country ? null : GEORGIA_PLACE_ID,
  };
}

/**
 * Sales, Jobs, Investment and profit or Firms: each crawl table's rows over the table's years. A part nested under a
 * total is named as the page's workbook names it, "Investment in fixed assets — Agriculture", and sits under its total's heading.
 */
function buildTopic(context: Context, section: BusinessTopicId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`business-${section}`, names(context, `page.${section}.title`), "actual");
  const facts = businessPageFacts(context.facts, section);
  const [ka, en] = [businessLabels(context.ka, section), businessLabels(context.en, section)];
  const definitions = businessTopicSeries(section);
  const georgia = areaEntity(context, "georgia");
  for (const state of businessCrawlStates(section, facts)) {
    const model = buildBusinessModel(section, facts, state);
    for (const series of model.selected) {
      const top = series.parentId ? definitions.find((definition) => definition.id === series.parentId)! : series;
      const label = (labels: Record<string, string>) => (series.parentId ? `${labels[series.parentId]} — ${labels[series.id]}` : labels[series.id]!);
      dataset.add(georgia, {
        seriesId: series.id, indicatorId: series.id, label: { ka: label(ka), en: label(en) }, heading: top.heading ? headingNames(context, top.heading) : null,
        parentSeriesId: series.parentId ?? null, isTotal: series.id.endsWith(".total"),
      }, model.years, (year) => cellOf(context, series.id, year));
    }
  }
  return dataset.build(context.breaks);
}

/** The served id of an area page's row: its measure, `business.turnover` (the place is the entity). */
const measureId = (indicatorId: string) => indicatorId.split(".").slice(0, 2).join(".");

/** Regions: Georgia's and each region's area page, every crawl table's rows (money, jobs, firm counts) over the table's years. */
function buildRegions(context: Context): TopicDatasetBuild {
  const dataset = collectTopicDataset("business-regions", names(context, "page.regions.title"), "actual");
  for (const area of BUSINESS_AREAS) {
    const entity = areaEntity(context, area);
    const facts = businessAreaFacts(context.facts, area);
    const [ka, en] = [businessAreaSeriesLabels(context.ka.messages, area), businessAreaSeriesLabels(context.en.messages, area)];
    for (const state of businessAreaCrawlStates(area, facts)) {
      const model = buildBusinessAreaModel(area, facts, state);
      for (const series of model.selected) {
        const seriesId = measureId(series.id);
        dataset.add(entity, { seriesId, indicatorId: seriesId, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: headingNames(context, series.heading!), parentSeriesId: null, isTotal: false },
          model.years, (year) => cellOf(context, series.id, year));
      }
    }
  }
  // A break the register names on the areas' indicators (`business.turnover.region_adjara`) lies on the served measure.
  const members = Map.groupBy(BUSINESS_AREAS.flatMap((area) => businessAreaSeries(area).map((series) => series.id)), measureId);
  return dataset.build(breaksOnServedSeries(context.breaks, members));
}

export const businessTopicAdapter: TopicAdapter = {
  family: "business",
  sourceArchive: ["business"],
  async build() {
    const ids = [...BUSINESS_SECTOR_LABEL_IDS, ...BUSINESS_AREA_LABEL_IDS];
    const [breaks, { facts }, ka, en] = await Promise.all([
      loadTopicBreaks("business-series-breaks.csv"), loadServedBusinessData(), getPresentation("ka", ["business"], ids, ids), getPresentation("en", ["business"], ids, ids),
    ]);
    const context: Context = { facts, rows: new Map(facts.map((fact) => [businessFactKey(fact), fact])), breaks, ka, en };
    return [...(["sales", "jobs", "investment-profit", "firms"] as const).map((section) => buildTopic(context, section)), buildRegions(context)];
  },
};
