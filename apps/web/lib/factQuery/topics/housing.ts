// apps/web/lib/factQuery/topics/housing.ts
//
// The Housing and construction pages as topic datasets. Building permits, Completed buildings and Home prices serve
// Georgia's rows (each crawl table's rows, a list's rows of one unit, over the table's years); Regions serves Georgia's
// and each region's area page, the place the entity and each of its rows (all buildings or residential buildings, by
// number or floor area, permitted or completed) a series. Series, names and years come from the pages' own functions
// (lib/explorer/housingPageData.ts, housingCrawlStates, housingAreaCrawlStates and their models); values are Geostat's
// published figures the pages' workbooks print, in each row's own unit (objects, m², the 2020 = 100 index, GEL per m²).
// The Regions index draws a map and a list of the area pages' figures, no table of its own. Build-time only: runtime
// code never imports it (tests/factQuery/purity.test.ts).
import { loadServedHousingData } from "../../data/housing/importHousing";
import { housingFactKey, type HousingFact } from "../../data/housing/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildHousingModel, housingCrawlStates, type HousingHeading, type HousingTopicId } from "../../explorer/housing";
import { buildHousingAreaModel, HOUSING_AREAS, housingAreaCrawlStates, housingMapId } from "../../explorer/housingAreas";
import { housingAreaFacts, housingAreaSeriesLabels, housingLabels, housingPageFacts } from "../../explorer/housingPageData";
import { regionAreaLabels, regionAreaPages } from "../../explorer/regionAreaPages";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { both, collectTopicDataset, type Cell } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { facts: readonly HousingFact[]; rows: ReadonlyMap<string, HousingFact>; ka: Presentation; en: Presentation };

const AREA_PAGES = regionAreaPages(HOUSING_AREAS, housingMapId);
const AREA_LABEL_IDS = AREA_PAGES.map((area) => area.id);

/** A heading's own words, without the display unit the page adds after " · " ("Floor area · thousand m²"), as the page's own series names cut it: the served unit is the row's own. */
const headingText = (presentation: Presentation, heading: HousingHeading) => message(presentation.messages, `housing.heading.${heading}`).split(" · ")[0]!;

/** A reviewed row as the page's workbook prints it: Geostat's published figure, in its stored unit. */
function cellOf(context: Context, indicatorId: string, year: number): Cell | undefined {
  const row = context.rows.get(housingFactKey({ indicatorId: indicatorId as HousingFact["indicatorId"], year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "official" };
}

/** Building permits, Completed buildings or Home prices: each crawl table's rows (one unit each) over the table's years. */
function buildTopic(context: Context, section: HousingTopicId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`housing-${section}`, both(context, ({ messages }) => message(messages, `housing.page.${section}.title`)), "actual");
  const facts = housingPageFacts(context.facts, section);
  const [ka, en] = [housingLabels(context.ka, section), housingLabels(context.en, section)];
  const georgia: TopicEntity = { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "housing.area.georgia"), labelEn: message(context.en.messages, "housing.area.georgia"), parentEntityId: null };
  for (const state of housingCrawlStates(section, facts)) {
    const model = buildHousingModel(section, facts, state);
    for (const series of model.selected) {
      dataset.add(georgia, {
        seriesId: series.id, indicatorId: series.id, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: both(context, (presentation) => headingText(presentation, series.heading)),
        parentSeriesId: null, isTotal: series.id.endsWith(".total"),
      }, model.years, (year) => cellOf(context, series.id, year));
    }
  }
  return dataset.build([]);
}

/**
 * The served id of an area page's row: its measure, and `.residential` for residential buildings
 * (`housing.permits_area.region_adjara_residential` is `housing.permits_area.residential`); the place is the entity.
 */
const areaSeriesId = (indicatorId: string) => {
  const [prefix, measure] = indicatorId.split(".");
  return `${prefix}.${measure}${indicatorId.endsWith("residential") ? ".residential" : ""}`;
};

/** An area page's heading, "Building permits · floor area": the heading's own words and its unit group's, both the page's. */
const areaHeading = (presentation: Presentation, heading: HousingHeading) =>
  `${headingText(presentation, heading)} · ${headingText(presentation, heading.endsWith("Area") ? "area" : "count")}`;

/** Regions: Georgia's and each region's area page, every crawl table's rows (numbers and floor areas) over the table's years. */
function buildRegions(context: Context): TopicDatasetBuild {
  const dataset = collectTopicDataset("housing-regions", both(context, ({ messages }) => message(messages, "housing.page.regions.title")), "actual");
  const [areaKa, areaEn] = [regionAreaLabels(context.ka, "housing", HOUSING_AREAS, AREA_PAGES), regionAreaLabels(context.en, "housing", HOUSING_AREAS, AREA_PAGES)];
  for (const area of HOUSING_AREAS) {
    const country = area === "georgia";
    const entity: TopicEntity = { entityId: country ? GEORGIA_PLACE_ID : housingMapId(area), entityType: country ? "country" : "region", labelKa: areaKa[area], labelEn: areaEn[area], parentEntityId: country ? null : GEORGIA_PLACE_ID };
    const facts = housingAreaFacts(context.facts, area);
    const [ka, en] = [housingAreaSeriesLabels(context.ka.messages, area), housingAreaSeriesLabels(context.en.messages, area)];
    for (const state of housingAreaCrawlStates(area, facts)) {
      const model = buildHousingAreaModel(area, facts, state);
      for (const series of model.selected) {
        const seriesId = areaSeriesId(series.id);
        dataset.add(entity, { seriesId, indicatorId: seriesId, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: both(context, (presentation) => areaHeading(presentation, series.heading)), parentSeriesId: null, isTotal: false },
          model.years, (year) => cellOf(context, series.id, year));
      }
    }
  }
  return dataset.build([]);
}

export const housingTopicAdapter: TopicAdapter = {
  family: "housing",
  sourceArchive: ["housing"],
  async build() {
    const [{ facts }, ka, en] = await Promise.all([loadServedHousingData(), getPresentation("ka", ["housing"], AREA_LABEL_IDS, AREA_LABEL_IDS), getPresentation("en", ["housing"], AREA_LABEL_IDS, AREA_LABEL_IDS)]);
    const context: Context = { facts, rows: new Map(facts.map((fact) => [housingFactKey(fact), fact])), ka, en };
    return [...(["permits", "completed", "prices"] as const).map((section) => buildTopic(context, section)), buildRegions(context)];
  },
};
