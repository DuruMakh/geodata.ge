// apps/web/lib/factQuery/topics/scienceCulture.ts
//
// The Science and culture pages as topic datasets. Research, Patents and Theatres serve Georgia's rows (each crawl table's
// rows, a list's rows of one unit, over the table's years); Museums serves Georgia's and each region's area page, the place
// the entity: its visitors, group tours, exhibitions and museums are one series each across the places
// (`science_culture.museum_visitors.adjara` is `science_culture.museum_visitors` of region.adjara), and Georgia's museum
// types and museum staff, which Geostat publishes only nationally, are series of Georgia. Series, names and years come
// from the pages' own functions (lib/explorer/scienceCulturePageData.ts, scienceCultureCrawlStates, museumAreaCrawlStates
// and their models); values are Geostat's figures at the precision the pages' workbooks print, in each row's own unit
// (persons, counts, thousands, million GEL). The theatre audience's 2021 change (science-culture-series-breaks.csv) is a
// break. The Museums index draws a map and a list of the area pages' figures, no table of its own. Build-time only:
// runtime code never imports it (tests/factQuery/purity.test.ts).
import { loadServedScienceCultureData } from "../../data/scienceCulture/importScienceCulture";
import { scienceCultureFactKey, type ScienceCultureFact } from "../../data/scienceCulture/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { regionAreaLabels, regionAreaPages } from "../../explorer/regionAreaPages";
import { buildScienceCultureSeriesModel, scienceCultureCrawlStates, scienceCultureTopicSeries, type ScienceCultureHeading, type ScienceCultureTopicId } from "../../explorer/scienceCulture";
import { AREA_MEASURES, buildMuseumAreaModel, isAreaGroup, MUSEUM_AREAS, museumAreaCrawlStates, museumAreaSeries, museumMapId } from "../../explorer/scienceCultureMuseums";
import { museumAreaFacts, scienceCultureLabels, scienceCulturePageFacts } from "../../explorer/scienceCulturePageData";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { loadTopicBreaks } from "./breaks";
import { breaksOnServedSeries, collectTopicDataset, type Cell, type Names } from "./collect";
import type { TopicAdapter, TopicBreak, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { facts: readonly ScienceCultureFact[]; rows: ReadonlyMap<string, ScienceCultureFact>; breaks: readonly TopicBreak[]; ka: Presentation; en: Presentation };

const AREA_PAGES = regionAreaPages(MUSEUM_AREAS, museumMapId);
const AREA_LABEL_IDS = AREA_PAGES.map((area) => area.id);

const both = (context: Context, read: (presentation: Presentation) => string): Names => ({ ka: read(context.ka), en: read(context.en) });

/** A heading's own words, without the display unit the page adds after " · " ("Visitors · thousand"), as the page's own series names cut it: the served unit is the row's own. */
const headingOf = (context: Context, heading: ScienceCultureHeading) => both(context, ({ messages }) => message(messages, `scienceCulture.heading.${heading}`).split(" · ")[0]!);

/** A reviewed row as the page's workbook prints it: Geostat's figure at its published precision, in its stored unit. */
function cellOf(context: Context, indicatorId: string, year: number): Cell | undefined {
  const row = context.rows.get(scienceCultureFactKey({ indicatorId: indicatorId as ScienceCultureFact["indicatorId"], year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "official" };
}

/** Research, Patents or Theatres: each crawl table's rows (one unit each) over the table's years. */
function buildTopic(context: Context, section: ScienceCultureTopicId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`science-culture-${section}`, both(context, ({ messages }) => message(messages, `scienceCulture.page.${section}.title`)), "actual");
  const definitions = scienceCultureTopicSeries(section);
  const facts = scienceCulturePageFacts(context.facts, section);
  const [ka, en] = [scienceCultureLabels(context.ka.messages, definitions), scienceCultureLabels(context.en.messages, definitions)];
  const georgia: TopicEntity = { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "scienceCulture.area.georgia"), labelEn: message(context.en.messages, "scienceCulture.area.georgia"), parentEntityId: null };
  for (const state of scienceCultureCrawlStates(section, facts)) {
    const model = buildScienceCultureSeriesModel(definitions, facts, state);
    for (const series of model.selected) {
      dataset.add(georgia, { seriesId: series.id, indicatorId: series.id, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: headingOf(context, series.heading), parentSeriesId: null, isTotal: series.reference },
        model.years, (year) => cellOf(context, series.id, year));
    }
  }
  return dataset.build(context.breaks);
}

/** The served id of an area page's row: a measure every area lists, without the area (`science_culture.museums.kakheti` is `science_culture.museums`); a row only Georgia lists keeps its id. */
const areaSeriesId = (indicatorId: string) => {
  const [prefix, measure, group] = indicatorId.split(".") as [string, string, string];
  return AREA_MEASURES.has(measure) && isAreaGroup(group) ? `${prefix}.${measure}` : indicatorId;
};

/** Museums: Georgia's and each region's area page, every crawl table's rows over the table's years. */
function buildMuseums(context: Context): TopicDatasetBuild {
  const dataset = collectTopicDataset("science-culture-museums", both(context, ({ messages }) => message(messages, "scienceCulture.page.museums.title")), "actual");
  const [areaKa, areaEn] = [regionAreaLabels(context.ka, "scienceCulture", MUSEUM_AREAS, AREA_PAGES), regionAreaLabels(context.en, "scienceCulture", MUSEUM_AREAS, AREA_PAGES)];
  // A break on an area measure holds for the served series only when it names every area's indicator.
  const members = new Map<string, string[]>();
  for (const area of MUSEUM_AREAS) {
    const country = area === "georgia";
    const entity: TopicEntity = { entityId: country ? GEORGIA_PLACE_ID : museumMapId(area), entityType: country ? "country" : "region", labelKa: areaKa[area], labelEn: areaEn[area], parentEntityId: country ? null : GEORGIA_PLACE_ID };
    const definitions = museumAreaSeries(area);
    const facts = museumAreaFacts(context.facts, area);
    const [ka, en] = [scienceCultureLabels(context.ka.messages, definitions), scienceCultureLabels(context.en.messages, definitions)];
    for (const state of museumAreaCrawlStates(area, facts)) {
      const model = buildMuseumAreaModel(area, facts, state);
      for (const series of model.selected) {
        const seriesId = areaSeriesId(series.id);
        members.set(seriesId, [...(members.get(seriesId) ?? []), series.id]);
        dataset.add(entity, { seriesId, indicatorId: seriesId, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: headingOf(context, series.heading), parentSeriesId: null, isTotal: series.reference },
          model.years, (year) => cellOf(context, series.id, year));
      }
    }
  }
  return dataset.build(breaksOnServedSeries(context.breaks, members));
}

export const scienceCultureTopicAdapter: TopicAdapter = {
  family: "science-culture",
  sourceArchive: ["science-culture"],
  async build() {
    const [breaks, { facts }, ka, en] = await Promise.all([
      loadTopicBreaks("science-culture-series-breaks.csv"), loadServedScienceCultureData(),
      getPresentation("ka", ["scienceCulture"], AREA_LABEL_IDS, AREA_LABEL_IDS), getPresentation("en", ["scienceCulture"], AREA_LABEL_IDS, AREA_LABEL_IDS),
    ]);
    const context: Context = { facts, rows: new Map(facts.map((fact) => [scienceCultureFactKey(fact), fact])), breaks, ka, en };
    return [buildTopic(context, "research"), buildTopic(context, "patents"), buildMuseums(context), buildTopic(context, "theatres")];
  },
};
