// apps/web/lib/factQuery/topics/crime.ts
//
// The Crime and justice pages as topic datasets: Recorded crimes, Convictions, Prisons, Victims and Road accidents, each
// Georgia's rows (each crawl table's rows, a list's rows of one unit, over the page's years). Series, names and years
// come from the page's own functions (lib/explorer/crimePageData.ts, crimeCrawlStates and buildCrimeModel); values are
// Geostat's published whole counts, in each row's own unit (crimes, persons, accidents). The per-100,000 view Fiscal.ge
// divides out in the browser is not served. The 2018 registration change and the 2025 drunk-driving coverage change
// (crime-series-breaks.csv) are the datasets' breaks. Build-time only: runtime code never imports it
// (tests/factQuery/purity.test.ts).
import { loadServedCrimeData, toClientCrimeFact } from "../../data/crime/importCrime";
import { crimeFactKey, type CrimeFact } from "../../data/crime/types";
import { buildCrimeModel, crimeCrawlStates, CRIME_SECTIONS, type CrimeHeading, type CrimeSectionId } from "../../explorer/crime";
import { crimeLabels, crimePageFacts } from "../../explorer/crimePageData";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { loadTopicBreaks } from "./breaks";
import { both, collectTopicDataset, type Cell } from "./collect";
import type { TopicAdapter, TopicBreak, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { facts: readonly CrimeFact[]; rows: ReadonlyMap<string, CrimeFact>; breaks: readonly TopicBreak[]; ka: Presentation; en: Presentation };

/** A reviewed row as the page's workbook prints it: Geostat's published whole count, in its stored unit. */
function cellOf(context: Context, indicatorId: string, year: number): Cell | undefined {
  const row = context.rows.get(crimeFactKey({ indicatorId: indicatorId as CrimeFact["indicatorId"], year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "official" };
}

/** One page: each crawl table of published counts (one unit each) over the page's years. */
function buildSection(context: Context, section: CrimeSectionId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`crime-${section}`, both(context, ({ messages }) => message(messages, `crime.page.${section}.title`)), "actual");
  const facts = crimePageFacts(context.facts, section).map(toClientCrimeFact);
  const [ka, en] = [crimeLabels(context.ka.messages, section), crimeLabels(context.en.messages, section)];
  const georgia: TopicEntity = { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "demography.georgia"), labelEn: message(context.en.messages, "demography.georgia"), parentEntityId: null };
  const headingOf = (heading: CrimeHeading | undefined) => (heading ? both(context, ({ messages }) => message(messages, `crime.heading.${heading}`)) : null);
  // Without a population the crawl states are the published counts' only: the per-100,000 rates are Fiscal.ge's division.
  for (const state of crimeCrawlStates(section, facts, [])) {
    const model = buildCrimeModel(section, facts, [], state, []);
    for (const series of model.selected) {
      dataset.add(georgia, { seriesId: series.id, indicatorId: series.id, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: headingOf(series.heading), parentSeriesId: null, isTotal: series.reference },
        model.years, (year) => cellOf(context, series.id, year));
    }
  }
  return dataset.build(context.breaks);
}

export const crimeTopicAdapter: TopicAdapter = {
  family: "crime",
  sourceArchive: ["crime"],
  async build() {
    const [breaks, { facts }, ka, en] = await Promise.all([loadTopicBreaks("crime-series-breaks.csv"), loadServedCrimeData(), getPresentation("ka", ["crime", "demography"], []), getPresentation("en", ["crime", "demography"], [])]);
    const context: Context = { facts, rows: new Map(facts.map((fact) => [crimeFactKey(fact), fact])), breaks, ka, en };
    return CRIME_SECTIONS.map(({ id }) => buildSection(context, id));
  },
};
