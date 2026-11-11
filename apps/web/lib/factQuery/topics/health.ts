// apps/web/lib/factQuery/topics/health.ts
//
// The Health pages as topic datasets: Doctors and hospitals and Illnesses (Georgia, every row of each view over the view's
// years), and Causes of death (Georgia and the 11 regions, each with its area page's deaths by cause, and the death rate
// the index's map and latest line print). Series, places, names and years come from the pages' own functions
// (lib/explorer/healthPageData.ts and the crawl and coverage functions); values are the reviewed CSV's published figures
// in the unit they are stored in, as the pages' workbooks print them (no display multiplier). Build-time only: runtime
// code never imports it (tests/factQuery/purity.test.ts).
import { loadServedHealthData } from "../../data/health/importHealth";
import { healthFactKey, type HealthArea, type HealthFact, type HealthSeriesBreak } from "../../data/health/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { healthCoverage, healthCrawlStates, healthSeriesCoverage, healthViewSeries, type HealthNationalSectionId } from "../../explorer/health";
import { HEALTH_DEATH_AREAS, healthDeathsCrawlStates, healthDeathsSeries } from "../../explorer/healthDeaths";
import { healthAreaLabels, healthDeathRatePageData, healthDeathsAreaPageData, healthNationalPageData } from "../../explorer/healthPageData";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { loadTopicBreaks } from "./breaks";
import { collectTopicDataset, span, type Cell, type Names } from "./collect";
import type { TopicAdapter, TopicBreak, TopicDatasetBuild, TopicEntity } from "./types";

const DEATHS_TOTAL = "health.deaths.total";
const RATE = "health.death_rate.total";
/** A heading the page names with the unit it draws in ("Visits · million"), which is not the unit served: no heading. */
const DISPLAY_UNIT_HEADINGS: readonly string[] = ["visits"];

/** A row's total, when it is a part of one: a doctors' or nurses' group of its staff, a cause of all deaths. */
function parentOf(id: string): string | null {
  if (id.startsWith("health.staff.doctors_")) return "health.staff.doctors";
  if (id.startsWith("health.staff.nurses_")) return "health.staff.nurses";
  return id.startsWith("health.deaths.") && id !== DEATHS_TOTAL ? DEATHS_TOTAL : null;
}
const TOTALS = new Set(["health.staff.doctors", "health.staff.nurses", DEATHS_TOTAL]);

/** The served rows and counting changes as the pages read them, the reviewed break register and both languages. */
type Context = { served: { facts: readonly HealthFact[]; breaks: readonly HealthSeriesBreak[] }; cells: ReadonlyMap<string, HealthFact>; breaks: readonly TopicBreak[]; ka: Presentation; en: Presentation };

const names = (context: Context, key: string): Names => ({ ka: message(context.ka.messages, `health.${key}`), en: message(context.en.messages, `health.${key}`) });

/** Georgia or a region, named as the causes-of-death pages name it. */
function areaEntity(context: Context, area: HealthArea): TopicEntity {
  const country = area === "georgia";
  return {
    entityId: country ? GEORGIA_PLACE_ID : area, entityType: country ? "country" : "region",
    labelKa: healthAreaLabels(context.ka)[area], labelEn: healthAreaLabels(context.en)[area], parentEntityId: country ? null : GEORGIA_PLACE_ID,
  };
}

/** A reviewed row as the page prints it: its published figure, in its stored unit. */
function cellOf(context: Context, indicatorId: string, area: HealthArea, year: number): Cell | undefined {
  const row = context.cells.get(healthFactKey({ indicatorId: indicatorId as HealthFact["indicatorId"], areaId: area, year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "official" };
}

/** Doctors and hospitals or Illnesses: each crawl table's rows (a view's rows of one unit), over the view's years. */
function buildNational(context: Context, section: HealthNationalSectionId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`health-${section}`, names(context, `page.${section}.title`), "actual");
  const [ka, en] = [healthNationalPageData(context.served, context.ka.messages, section), healthNationalPageData(context.served, context.en.messages, section)];
  const georgia = areaEntity(context, "georgia");
  for (const state of healthCrawlStates(section, ka.facts)) {
    const definitions = healthViewSeries(section, state.view);
    const coverage = healthCoverage(section, state.view, ka.facts);
    for (const id of state.selectedIds) {
      const heading = definitions.find((definition) => definition.id === id)!.heading!;
      dataset.add(georgia, {
        seriesId: id, indicatorId: id, label: { ka: ka.labels[id]!, en: en.labels[id]! },
        heading: DISPLAY_UNIT_HEADINGS.includes(heading) ? null : names(context, `heading.${heading}`), parentSeriesId: parentOf(id), isTotal: TOTALS.has(id),
      }, span([coverage.min, coverage.max]), (year) => cellOf(context, id, "georgia", year));
    }
  }
  return dataset.build(context.breaks);
}

/** Causes of death: each area page's causes over the area's years, and the death rate in the years the index prints it. */
function buildCausesOfDeath(context: Context): TopicDatasetBuild {
  const dataset = collectTopicDataset("health-causes-of-death", names(context, "page.causes-of-death.title"), "actual");
  const rates = healthDeathRatePageData(context.served.facts);
  // The map shows every region's rate in its year, beside Georgia's; the latest line Georgia's latest year.
  const rateYears = (area: HealthArea) => area === "georgia"
    ? [...new Set([rates.regionMap.year, rates.georgiaRates.toSorted((a, b) => a.year - b.year).at(-1)!.year])].sort((a, b) => a - b)
    : rates.regionMap.regions.some((region) => region.regionId === area) ? [rates.regionMap.year] : [];
  for (const area of HEALTH_DEATH_AREAS) {
    const entity = areaEntity(context, area);
    const [ka, en] = [healthDeathsAreaPageData(context.served.facts, context.ka.messages, area), healthDeathsAreaPageData(context.served.facts, context.en.messages, area)];
    for (const state of healthDeathsCrawlStates(area, ka.facts)) {
      const coverage = healthSeriesCoverage(ka.facts, area, healthDeathsSeries(), `No causes-of-death years for ${area}`);
      for (const id of state.selectedIds) {
        dataset.add(entity, { seriesId: id, indicatorId: id, label: { ka: ka.labels[id]!, en: en.labels[id]! }, heading: null, parentSeriesId: parentOf(id), isTotal: TOTALS.has(id) },
          span([coverage.min, coverage.max]), (year) => cellOf(context, id, area, year));
      }
    }
    const years = rateYears(area);
    if (years.length) {
      dataset.add(entity, { seriesId: RATE, indicatorId: RATE, label: names(context, `series.${RATE}`), heading: null, parentSeriesId: null, isTotal: false }, years, (year) => cellOf(context, RATE, area, year));
    }
  }
  return dataset.build(context.breaks);
}

export const healthTopicAdapter: TopicAdapter = {
  family: "health",
  sourceArchive: ["health"],
  async build() {
    const [breaks, served, ka, en] = await Promise.all([
      loadTopicBreaks("health-series-breaks.csv"), loadServedHealthData(),
      getPresentation("ka", ["health"], HEALTH_DEATH_AREAS, HEALTH_DEATH_AREAS), getPresentation("en", ["health"], HEALTH_DEATH_AREAS, HEALTH_DEATH_AREAS),
    ]);
    const context: Context = { served, cells: new Map(served.facts.map((fact) => [healthFactKey(fact), fact])), breaks, ka, en };
    return [buildNational(context, "doctors-hospitals"), buildNational(context, "illnesses"), buildCausesOfDeath(context)];
  },
};
