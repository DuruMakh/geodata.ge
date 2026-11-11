// apps/web/lib/factQuery/topics/environment.ts
//
// The Environment and climate pages as topic datasets. Greenhouse gases, Air pollution, Temperature and rain and Water
// serve Georgia's rows (each crawl table's rows, a list's rows of one unit, over the table's years). City air quality
// serves each city's page, the city the entity (`city.<slug>`, the inflation cities' ids where the city is the same):
// its stations' yearly averages and days over the daily PM10 limit are series of the station's city, and the city's
// yearly limit of a pollutant is one series across the cities (`environment.aq.pm10_limit.rustavi` is
// `environment.aq.pm10_limit` of city.rustavi). Waste and Forests serve Georgia's and each region's area page: waste
// collected, timber cut and illegal logging are one series each across the places, and the rows Geostat publishes only
// nationally (per person, protected areas, fires, area burnt) are series of Georgia. Series, names and years come from the
// pages' own functions (lib/explorer/environmentPageData.ts, environmentListCrawlStates and the topic, city and area
// models); a row is named as the page's workbook names it ("Total — Carbon monoxide (CO)"). Values are Geostat's figures
// at the precision the pages print, in each row's own unit; the per-person rows are Geostat's stored figures. The City air
// quality, Waste and Forests index pages draw cards, a map and a list of their pages' figures, no table of their own.
// Build-time only: runtime code never imports it (tests/factQuery/purity.test.ts).
import { loadServedEnvironmentData, toClientEnvironmentFact } from "../../data/environment/importEnvironment";
import { ENVIRONMENT_CITIES, environmentFactKey, type ClientEnvironmentFact, type EnvironmentFact } from "../../data/environment/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import {
  buildEnvironmentModel, environmentListCrawlStates, environmentSeriesLabel, environmentTopicSeries,
  type EnvironmentModel, type EnvironmentSeriesDefinition, type EnvironmentState, type EnvironmentTopicId,
} from "../../explorer/environment";
import { AREA_MEASURES, buildEnvironmentAreaModel, ENVIRONMENT_AREAS, environmentAreaRoutes, environmentAreaSeries, type EnvironmentAreaTopic } from "../../explorer/environmentAreas";
import { buildEnvironmentCityModel, environmentCitySeries } from "../../explorer/environmentCities";
import { environmentLabels, environmentListFacts } from "../../explorer/environmentPageData";
import { regionAreaLabels, regionAreaPages } from "../../explorer/regionAreaPages";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { collectTopicDataset, type Cell, type Names } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { facts: readonly ClientEnvironmentFact[]; rows: ReadonlyMap<string, EnvironmentFact>; ka: Presentation; en: Presentation };
type Dataset = ReturnType<typeof collectTopicDataset>;

const AREA_PAGES = regionAreaPages(ENVIRONMENT_AREAS, environmentAreaRoutes("waste").mapId);
const AREA_LABEL_IDS = AREA_PAGES.map((area) => area.id);

const both = (context: Context, read: (presentation: Presentation) => string): Names => ({ ka: read(context.ka), en: read(context.en) });
const words = (presentation: Presentation) => (key: string) => message(presentation.messages, `environment.${key}`);

/** A reviewed row as the page's workbook prints it: Geostat's figure at its published precision, in its stored unit. */
function cellOf(context: Context, indicatorId: string, year: number): Cell | undefined {
  const row = context.rows.get(environmentFactKey({ indicatorId, year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "official" };
}

/**
 * One page's list for one place: each crawl table's rows (one unit each) over the table's years. `servedId` names the
 * series a row is served as (an area or city row without its place); a row is named as the page's workbook names it and
 * sits under its heading's own words, without the unit the page adds after " · ". A total is the page's reference row or a
 * pollutant's total, which Air pollution lists flat beside its two sources under the pollutant's heading.
 */
function addList(
  context: Context, dataset: Dataset, entity: TopicEntity, series: readonly EnvironmentSeriesDefinition[],
  build: (facts: readonly ClientEnvironmentFact[], state: EnvironmentState) => EnvironmentModel, servedId: (indicatorId: string) => string = (id) => id,
) {
  const facts = environmentListFacts(context.facts, series);
  const ids = series.map((item) => item.id);
  const [ka, en] = [environmentLabels(context.ka, ids), environmentLabels(context.en, ids)];
  for (const state of environmentListCrawlStates(series, facts)) {
    const model = build(facts, state);
    for (const row of model.selected) {
      const seriesId = servedId(row.id);
      dataset.add(entity, {
        seriesId, indicatorId: seriesId, label: { ka: environmentSeriesLabel(row, ka, words(context.ka)), en: environmentSeriesLabel(row, en, words(context.en)) },
        heading: both(context, (presentation) => words(presentation)(`heading.${row.heading}`).split(" · ")[0]!), parentSeriesId: null, isTotal: row.reference || row.id.endsWith(".total"),
      }, model.years, (year) => cellOf(context, row.id, year));
    }
  }
}

const georgia = (context: Context): TopicEntity => ({ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: words(context.ka)("area.georgia"), labelEn: words(context.en)("area.georgia"), parentEntityId: null });

/** Greenhouse gases, Air pollution, Temperature and rain or Water: Georgia's list. */
function buildTopic(context: Context, section: EnvironmentTopicId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`environment-${section}`, both(context, (presentation) => words(presentation)(`page.${section}.title`)), "actual");
  addList(context, dataset, georgia(context), environmentTopicSeries(section), (facts, state) => buildEnvironmentModel(section, facts, state));
  return dataset.build([]);
}

/** A city's yearly limit of a pollutant without the city (`environment.aq.pm10_limit.rustavi` is `environment.aq.pm10_limit`); a station's row keeps its id. */
const citySeriesId = (indicatorId: string) => {
  const [prefix, topic, measure] = indicatorId.split(".") as [string, string, string];
  return measure.endsWith("_limit") ? `${prefix}.${topic}.${measure}` : indicatorId;
};

/** City air quality: each city's page, its stations' rows and its limits. */
function buildAirQuality(context: Context): TopicDatasetBuild {
  const dataset = collectTopicDataset("environment-air-quality", both(context, (presentation) => words(presentation)("page.air-quality.title")), "actual");
  for (const city of ENVIRONMENT_CITIES) {
    const entity: TopicEntity = { entityId: `city.${city}`, entityType: "city", labelKa: words(context.ka)(`city.${city}`), labelEn: words(context.en)(`city.${city}`), parentEntityId: GEORGIA_PLACE_ID };
    addList(context, dataset, entity, environmentCitySeries(city, context.facts), (facts, state) => buildEnvironmentCityModel(city, facts, state), citySeriesId);
  }
  return dataset.build([]);
}

/** Waste or Forests: Georgia's and each region's area page; a measure every area lists is served without the area. */
function buildAreas(context: Context, topic: EnvironmentAreaTopic): TopicDatasetBuild {
  const dataset = collectTopicDataset(`environment-${topic}`, both(context, (presentation) => words(presentation)(`page.${topic}.title`)), "actual");
  const [areaKa, areaEn] = [regionAreaLabels(context.ka, "environment", ENVIRONMENT_AREAS, AREA_PAGES), regionAreaLabels(context.en, "environment", ENVIRONMENT_AREAS, AREA_PAGES)];
  for (const area of ENVIRONMENT_AREAS) {
    const country = area === "georgia";
    const entity: TopicEntity = { entityId: country ? GEORGIA_PLACE_ID : environmentAreaRoutes(topic).mapId(area), entityType: country ? "country" : "region", labelKa: areaKa[area], labelEn: areaEn[area], parentEntityId: country ? null : GEORGIA_PLACE_ID };
    const servedId = (indicatorId: string) => AREA_MEASURES.find((measure) => indicatorId === `${measure}.${area}`) ?? indicatorId;
    addList(context, dataset, entity, environmentAreaSeries(topic, area, context.facts), (facts, state) => buildEnvironmentAreaModel(topic, area, facts, state), servedId);
  }
  return dataset.build([]);
}

export const environmentTopicAdapter: TopicAdapter = {
  family: "environment",
  sourceArchive: ["environment"],
  async build() {
    const [served, ka, en] = await Promise.all([loadServedEnvironmentData(), getPresentation("ka", ["environment"], AREA_LABEL_IDS, AREA_LABEL_IDS), getPresentation("en", ["environment"], AREA_LABEL_IDS, AREA_LABEL_IDS)]);
    const context: Context = { facts: served.map(toClientEnvironmentFact), rows: new Map(served.map((fact) => [environmentFactKey(fact), fact])), ka, en };
    return [
      buildTopic(context, "greenhouse-gases"), buildTopic(context, "air-pollution"), buildAirQuality(context), buildTopic(context, "climate"), buildTopic(context, "water"),
      buildAreas(context, "waste"), buildAreas(context, "forests"),
    ];
  },
};
