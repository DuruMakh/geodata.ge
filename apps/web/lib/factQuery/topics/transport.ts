// apps/web/lib/factQuery/topics/transport.ts
//
// The Transport pages as topic datasets. Vehicles, Vehicle age, Passengers and Freight serve Georgia's rows (each crawl
// table's rows, a list's rows of one unit, over the table's years); Regions serves Georgia's and each region's area page,
// the place the entity and each of its rows (registered vehicles by type, fuel, age and owner, and roads) a series.
// Series, names and years come from the pages' own functions (lib/explorer/transportPageData.ts, transportCrawlStates,
// transportAreaCrawlStates and their models); values are Geostat's published figures the pages' workbooks print, in each
// row's own unit (thousand vehicles, million passenger-km or tonne-km, passenger-km per person, thousand passengers or
// tonnes, km). Abkhazia and "region unknown" have no area page and are not served. The Regions index draws a map and a
// list of the area pages' figures, no table of its own. Build-time only: runtime code never imports it
// (tests/factQuery/purity.test.ts).
import { loadServedTransportData } from "../../data/transport/importTransport";
import { transportFactKey, type TransportFact } from "../../data/transport/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildTransportModel, transportCrawlStates, type TransportHeading, type TransportTopicId } from "../../explorer/transport";
import { AREA_GROUPS, buildTransportAreaModel, TRANSPORT_AREAS, transportAreaCrawlStates, transportMapId } from "../../explorer/transportAreas";
import { transportAreaFacts, transportAreaSeriesLabels, transportLabels, transportPageFacts } from "../../explorer/transportPageData";
import { regionAreaLabels, regionAreaPages } from "../../explorer/regionAreaPages";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { both, collectTopicDataset, type Cell } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { facts: readonly TransportFact[]; rows: ReadonlyMap<string, TransportFact>; ka: Presentation; en: Presentation };

const AREA_PAGES = regionAreaPages(TRANSPORT_AREAS, transportMapId);
const AREA_LABEL_IDS = AREA_PAGES.map((area) => area.id);

/** A heading's own words, without the display unit the page adds after " · " ("Passenger-km · million"), as the page's own series names cut it: the served unit is the row's own. */
const headingText = (presentation: Presentation, heading: TransportHeading) => message(presentation.messages, `transport.heading.${heading}`).split(" · ")[0]!;

/** A reviewed row as the page's workbook prints it: Geostat's published figure, in its stored unit. */
function cellOf(context: Context, indicatorId: string, year: number): Cell | undefined {
  const row = context.rows.get(transportFactKey({ indicatorId: indicatorId as TransportFact["indicatorId"], year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "official" };
}

/** Vehicles, Vehicle age, Passengers or Freight: each crawl table's rows (one unit each) over the table's years. */
function buildTopic(context: Context, section: TransportTopicId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`transport-${section}`, both(context, ({ messages }) => message(messages, `transport.page.${section}.title`)), "actual");
  const facts = transportPageFacts(context.facts, section);
  const [ka, en] = [transportLabels(context.ka, section), transportLabels(context.en, section)];
  const georgia: TopicEntity = { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "transport.area.georgia"), labelEn: message(context.en.messages, "transport.area.georgia"), parentEntityId: null };
  for (const state of transportCrawlStates(section, facts)) {
    const model = buildTransportModel(section, facts, state);
    for (const series of model.selected) {
      dataset.add(georgia, {
        seriesId: series.id, indicatorId: series.id, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: both(context, (presentation) => headingText(presentation, series.heading)),
        parentSeriesId: null, isTotal: series.reference,
      }, model.years, (year) => cellOf(context, series.id, year));
    }
  }
  return dataset.build([]);
}

/**
 * The served id of an area page's row: its measure and column without the area (`transport.registered.region_adjara_fuel_diesel`
 * is `transport.registered.fuel_diesel`, `transport.road_km.total` is `transport.road_km`); the place is the entity.
 */
const areaSeriesId = (indicatorId: string) => {
  const [prefix, measure, group] = indicatorId.split(".") as [string, string, string];
  const part = group.slice(AREA_GROUPS.find((area) => group === area || group.startsWith(`${area}_`))!.length + 1);
  return `${prefix}.${measure}${part ? `.${part}` : ""}`;
};

/** An area page's heading: registered vehicles and roads by their own words; a fuel, age or owner row's joins registered vehicles' ("Registered vehicles · By fuel"). */
const areaHeading = (presentation: Presentation, heading: TransportHeading) =>
  heading === "registered" || heading === "roads" ? headingText(presentation, heading) : `${headingText(presentation, "registered")} · ${headingText(presentation, heading)}`;

/** Regions: Georgia's and each region's area page, every crawl table's rows (registered vehicles and roads) over the table's years. */
function buildRegions(context: Context): TopicDatasetBuild {
  const dataset = collectTopicDataset("transport-regions", both(context, ({ messages }) => message(messages, "transport.page.regions.title")), "actual");
  const [areaKa, areaEn] = [regionAreaLabels(context.ka, "transport", TRANSPORT_AREAS, AREA_PAGES), regionAreaLabels(context.en, "transport", TRANSPORT_AREAS, AREA_PAGES)];
  for (const area of TRANSPORT_AREAS) {
    const country = area === "georgia";
    const entity: TopicEntity = { entityId: country ? GEORGIA_PLACE_ID : transportMapId(area), entityType: country ? "country" : "region", labelKa: areaKa[area], labelEn: areaEn[area], parentEntityId: country ? null : GEORGIA_PLACE_ID };
    const facts = transportAreaFacts(context.facts, area);
    const [ka, en] = [transportAreaSeriesLabels(context.ka.messages, area), transportAreaSeriesLabels(context.en.messages, area)];
    for (const state of transportAreaCrawlStates(area, facts)) {
      const model = buildTransportAreaModel(area, facts, state);
      for (const series of model.selected) {
        const seriesId = areaSeriesId(series.id);
        dataset.add(entity, { seriesId, indicatorId: seriesId, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: both(context, (presentation) => areaHeading(presentation, series.heading)), parentSeriesId: null, isTotal: series.reference },
          model.years, (year) => cellOf(context, series.id, year));
      }
    }
  }
  return dataset.build([]);
}

export const transportTopicAdapter: TopicAdapter = {
  family: "transport",
  sourceArchive: ["transport"],
  async build() {
    const [{ facts }, ka, en] = await Promise.all([loadServedTransportData(), getPresentation("ka", ["transport"], AREA_LABEL_IDS, AREA_LABEL_IDS), getPresentation("en", ["transport"], AREA_LABEL_IDS, AREA_LABEL_IDS)]);
    const context: Context = { facts, rows: new Map(facts.map((fact) => [transportFactKey(fact), fact])), ka, en };
    return [...(["vehicles", "vehicle-age", "passengers", "freight"] as const).map((section) => buildTopic(context, section)), buildRegions(context)];
  },
};
