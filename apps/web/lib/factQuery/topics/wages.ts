// apps/web/lib/factQuery/topics/wages.ts
//
// The Wages pages as topic datasets: the Overview and Industries (Georgia; Industries' rows under each group it compares)
// and Regions (Georgia and the 11 regions: each region page's average beside Georgia's, and the index's latest national
// average). Series, places, names and years come from the pages' own functions (lib/explorer/wagesPageData.ts,
// wagesCrawlStates, buildWagesModel); values are Geostat's published figures the pages print, in GEL a month (the unit is
// GEL; a series whose name does not say "monthly" carries the monthly note in its value definition). A row the
// page prints only as unavailable (public-sector mining) has no value to serve and is not served. Build-time only:
// runtime code never imports it (tests/factQuery/purity.test.ts).
import { loadServedWagesData, toClientWagesFact } from "../../data/wages/importWages";
import { WAGES_REGIONS, wagesFactKey, type ClientWagesFact, type WagesFact } from "../../data/wages/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildWagesModel, wagesCrawlStates, wagesPlaceLatest, type WagesSectionId } from "../../explorer/wages";
import { WAGES_LABEL_IDS, wagesLabels, wagesPageFacts, wagesRegionPageData } from "../../explorer/wagesPageData";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { collectTopicDataset, type Cell, type Names, type SeriesSpec } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity, TopicSeriesNote } from "./types";

type Context = { rows: ReadonlyMap<string, WagesFact>; facts: readonly ClientWagesFact[]; ka: Presentation; en: Presentation };

const both = (context: Context, read: (presentation: Presentation) => string): Names => ({ ka: read(context.ka), en: read(context.en) });

/** A served series: the indicator, then the group and the economic section when they are not Georgia's and all activities. */
const seriesIdOf = (series: { indicatorId: string; groupId: string; sectorId: string }) =>
  [series.indicatorId, series.groupId === "georgia" ? null : series.groupId, series.sectorId === "total" ? null : series.sectorId].filter(Boolean).join(".");

/** A published figure as the page prints it; Geostat's unavailable marker is a missing cell. */
function cellOf(context: Context, series: { indicatorId: string; dimension: string; groupId: string; sectorId: string }, year: number): Cell | undefined {
  const row = context.rows.get(wagesFactKey({ ...series, year } as Parameters<typeof wagesFactKey>[0]));
  if (!row || row.publishedValue === null) return undefined;
  return { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: row.valueStatus === "survey_estimate" ? "survey_estimate" : "official" };
}

/** A monthly figure's note, for a series whose label and heading do not already say "monthly" ("Women — Construction"). */
const MONTHLY: TopicSeriesNote = { key: "definitions.topicMonthly", values: {} };
const monthlyNote = (label: Names, heading: Names | null) => (/month/i.test(`${heading?.en ?? ""} ${label.en}`) ? {} : { note: MONTHLY });

function georgia(context: Context): TopicEntity {
  return { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "demography.georgia"), labelEn: message(context.en.messages, "demography.georgia"), parentEntityId: null };
}

/** The Overview or Industries: each crawl table's rows (Industries' groups one at a time), Georgia's, over the table's years. */
function buildNational(context: Context, section: Exclude<WagesSectionId, "regions">): TopicDatasetBuild {
  const dataset = collectTopicDataset(`wages-${section}`, both(context, ({ messages }) => message(messages, `wages.page.${section}.title`)), "actual");
  const facts = wagesPageFacts(context.facts, section);
  const [ka, en] = [wagesLabels(context.ka), wagesLabels(context.en)];
  for (const state of wagesCrawlStates(section, facts)) {
    const model = buildWagesModel(section, facts, state);
    const ids = new Map(model.series.map((series) => [series.id, seriesIdOf(series)]));
    for (const series of model.selected) {
      // A row Geostat publishes only as unavailable prints dashes in every year: nothing to serve.
      if (model.years.every((year) => !cellOf(context, series, year))) continue;
      const label = { ka: ka[series.id]!, en: en[series.id]! };
      const heading = state.view === "main" ? null : both(context, ({ messages }) => message(messages, `wages.group.${state.view}`));
      const spec: SeriesSpec = {
        seriesId: ids.get(series.id)!, indicatorId: ids.get(series.id)!, label, heading,
        parentSeriesId: series.parentId ? ids.get(series.parentId)! : null, isTotal: series.reference, ...monthlyNote(label, heading),
      };
      dataset.add(georgia(context), spec, model.years, (year) => cellOf(context, series, year));
    }
  }
  return dataset.build([]);
}

/**
 * Regions: each region page's region and Georgia's average over the region's years (Georgia over every year a region page
 * or the index's latest line prints it), each place named as the pages name it. The place is the entity, the average its series.
 */
function buildRegions(context: Context): TopicDatasetBuild {
  const dataset = collectTopicDataset("wages-regions", both(context, ({ messages }) => message(messages, "wages.page.regions.title")), "actual");
  const facts = wagesPageFacts(context.facts, "regions");
  const label = both(context, ({ messages }) => message(messages, "wages.series.average"));
  const georgiaYears = new Set([wagesPlaceLatest(facts).year]);
  let georgiaSeries: { indicatorId: string; dimension: string; groupId: string; sectorId: string; id: string } | undefined;
  for (const regionId of WAGES_REGIONS) {
    const [ka, en] = [wagesRegionPageData(facts, context.ka, regionId), wagesRegionPageData(facts, context.en, regionId)];
    const entity: TopicEntity = { entityId: regionId, entityType: "region", labelKa: ka.labels[regionId]!, labelEn: en.labels[regionId]!, parentEntityId: GEORGIA_PLACE_ID };
    for (const state of wagesCrawlStates("regions", ka.facts)) {
      const model = buildWagesModel("regions", ka.facts, state);
      for (const series of model.selected) {
        if (series.dimension !== "region") {
          georgiaSeries = series;
          for (const year of model.years) georgiaYears.add(year);
          continue;
        }
        dataset.add(entity, { seriesId: series.indicatorId, indicatorId: series.indicatorId, label, heading: null, parentSeriesId: null, isTotal: false, ...monthlyNote(label, null) }, model.years, (year) => cellOf(context, series, year));
      }
    }
  }
  dataset.add(georgia(context), { seriesId: georgiaSeries!.indicatorId, indicatorId: georgiaSeries!.indicatorId, label, heading: null, parentSeriesId: null, isTotal: false, ...monthlyNote(label, null) },
    [...georgiaYears].sort((a, b) => a - b), (year) => cellOf(context, georgiaSeries!, year));
  return dataset.build([]);
}

export const wagesTopicAdapter: TopicAdapter = {
  family: "wages",
  sourceArchive: ["wages"],
  async build() {
    const scopes = ["wages", "demography"] as const;
    const [{ facts }, ka, en] = await Promise.all([loadServedWagesData(), getPresentation("ka", scopes, WAGES_LABEL_IDS, WAGES_REGIONS), getPresentation("en", scopes, WAGES_LABEL_IDS, WAGES_REGIONS)]);
    const context: Context = { rows: new Map(facts.map((fact) => [wagesFactKey(fact), fact])), facts: facts.map(toClientWagesFact), ka, en };
    return [buildNational(context, "overview"), buildNational(context, "industries"), buildRegions(context)];
  },
};
