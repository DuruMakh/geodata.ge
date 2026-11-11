// apps/web/lib/factQuery/topics/unemployment.ts
//
// The Unemployment pages as topic datasets. Overview, Age and Sex (Georgia) and Regions (Georgia, the 11 regions and the
// two historical combined groups its comparison lists) serve each crawl table's rows over the table's years, from the
// pages' own models (lib/explorer/unemploymentPageData.ts, unemploymentCrawlStates, buildUnemploymentModel): the stored
// survey estimate the model carries (a rate in %, a count in thousand persons). The four Labour Force Survey detail pages
// (jobs by industry, hours, informal jobs, young people not in work or study) serve Georgia's rows, Geostat's published
// one-decimal figures. Every value is a survey estimate. Build-time only: runtime code never imports it
// (tests/factQuery/purity.test.ts).
import { loadServedLabourData } from "../../data/labour/importLabour";
import { labourFactKey, type LabourFact } from "../../data/labour/types";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS, UNEMPLOYMENT_REGISTRY } from "../../data/unemployment/importUnemployment";
import { unemploymentObservationKey, type ServedUnemploymentObservation, type UnemploymentBreakdown, type UnemploymentIndicator } from "../../data/unemployment/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildLabourModel, labourCrawlStates, type LabourSectionId } from "../../explorer/labour";
import { labourPageData } from "../../explorer/labourPageData";
import { buildUnemploymentModel } from "../../explorer/unemployment";
import { unemploymentFactSeriesId, unemploymentSeriesLabel, unemploymentUsesIndicatorSeries } from "../../explorer/unemploymentOverview";
import { unemploymentPageFacts } from "../../explorer/unemploymentPageData";
import { UNEMPLOYMENT_REGIONS } from "../../explorer/unemploymentRegionMap";
import type { UnemploymentSectionId } from "../../explorer/unemploymentSections";
import { unemploymentCrawlStates, type UnemploymentState } from "../../explorer/unemploymentState";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { both, collectTopicDataset, type Cell, type Names, type SeriesSpec } from "./collect";
import type { TopicAdapter, TopicBreak, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { unemployment: readonly ServedUnemploymentObservation[]; rows: ReadonlyMap<string, ServedUnemploymentObservation>; labour: readonly LabourFact[]; ka: Presentation; en: Presentation };

/** A survey row as the page's model carries it: the stored estimate, in its own unit. */
const surveyCell = (row: { value: number; unit: string; sourceId: string; valueStatus: string }): Cell =>
  ({ value: row.value, unit: row.unit, sourceIds: [row.sourceId], status: row.valueStatus === "survey_estimate" ? "survey_estimate" : "official" });

/**
 * One break per change of Geostat's Labour Force Survey methodology (`methodology_epoch`) inside a served series: a year
 * whose epoch differs from the year before starts `lfs_<epoch>`. The served rows are all one epoch today (ilo19_20; the
 * pre-2010 ilo13 rows stay in the research package), so the pages' data has none; a later epoch in the CSV becomes one.
 */
export function lfsEpochBreaks(cells: readonly { seriesId: string; year: number; epoch: string }[]): TopicBreak[] {
  const bySeries = new Map<string, Map<number, string>>();
  for (const { seriesId, year, epoch } of cells) bySeries.set(seriesId, (bySeries.get(seriesId) ?? new Map()).set(year, epoch));
  const breaks = new Map<string, TopicBreak>();
  for (const [seriesId, epochs] of bySeries) {
    const years = [...epochs.keys()].sort((a, b) => a - b);
    for (const [index, year] of years.entries()) {
      const epoch = epochs.get(year)!, previous = index ? epochs.get(years[index - 1]!)! : epoch;
      if (epoch === previous) continue;
      const breakId = `lfs_${epoch}`, referenceDate = `${year}-01-01`;
      const entry = breaks.get(`${breakId}:${referenceDate}`) ?? { breakId, seriesIds: [], referenceDate, reasonEn: `Geostat's Labour Force Survey methodology changed (${previous} to ${epoch}); Geostat states the periods before and after are not comparable.` };
      if (!entry.seriesIds.includes(seriesId)) entry.seriesIds.push(seriesId);
      breaks.set(`${breakId}:${referenceDate}`, entry);
    }
  }
  return [...breaks.values()];
}

/**
 * Where a page's list row is served. On Regions a group is a place (Georgia, a region, a combined group) and the
 * indicator its series; elsewhere everything is Georgia's and a group (a sex, towns or villages, an age band, an education
 * level with its sex) suffixes the indicator: `unemployment_rate.urban`, `unemployment_rate.education.higher.women`.
 */
function servedAs(section: UnemploymentSectionId, state: UnemploymentState, groupId: string, indicatorId: UnemploymentIndicator) {
  if (section === "regions") return { entityId: groupId === "georgia" ? GEORGIA_PLACE_ID : groupId, seriesId: indicatorId };
  const sex = state.breakdown === "education" && groupId.startsWith("education.") && state.educationSex !== "total" ? `.${state.educationSex}` : "";
  return { entityId: GEORGIA_PLACE_ID, seriesId: groupId === "georgia" ? indicatorId : `${indicatorId}.${groupId}${sex}` };
}

/** Georgia or a Regions group, named as the pages' registry names it. */
function groupEntity(groupId: string): TopicEntity {
  const group = UNEMPLOYMENT_REGISTRY.find((candidate) => candidate.id === groupId)!;
  const country = groupId === "georgia";
  return { entityId: country ? GEORGIA_PLACE_ID : groupId, entityType: country ? "country" : "region", labelKa: group.labelKa, labelEn: group.labelEn, parentEntityId: country ? null : GEORGIA_PLACE_ID };
}

/** A row's own breakdown, not its table's: the Education table's Men row is a Sex row; an education level carries its sex. */
const headingOf = (context: Context, dimension: UnemploymentBreakdown, state: UnemploymentState): Names => both(context, ({ messages }) =>
  message(messages, `unemployment.breakdown.${dimension}`) + (dimension === "education" ? ` · ${message(messages, `unemployment.sex.${state.educationSex}`)}` : ""));

/**
 * Overview, Regions (the index's comparison and each region page), Age or Sex: every crawl table's listed rows over the
 * table's years. A row several tables list (Georgia's unemployment rate) is served once over every year any of them
 * prints, named as the first table names it.
 */
function buildUnemployment(context: Context, section: UnemploymentSectionId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`unemployment-${section}`, both(context, ({ messages }) => message(messages, `unemployment.page.${section}.title`)), "actual");
  const listed = new Map<string, { entity: TopicEntity; spec: SeriesSpec; cells: Map<number, Cell | undefined> }>();
  const epochs: { seriesId: string; year: number; epoch: string }[] = [];
  for (const regionId of section === "regions" ? [undefined, ...UNEMPLOYMENT_REGIONS.map((region) => region.id)] : [undefined]) {
    const { facts } = unemploymentPageFacts(context.unemployment, section, regionId);
    for (const state of unemploymentCrawlStates(facts, UNEMPLOYMENT_REGISTRY, section, regionId)) {
      // The rows and cells the page's workbook prints for the table (buildUnemploymentWorkbookExportModel).
      const model = buildUnemploymentModel(facts, UNEMPLOYMENT_REGISTRY, state);
      const byCell = new Map(model.activeFacts.map((fact) => [`${unemploymentFactSeriesId(fact, state)}:${fact.year}`, fact]));
      for (const definition of model.definitions.filter((group) => model.rows.some((row) => row.itemId === group.id))) {
        const { entityId, seriesId } = servedAs(section, state, definition.groupId, definition.indicatorId);
        const key = `${entityId}\u0000${seriesId}`;
        const known = listed.get(key);
        const entry = known ?? {
          entity: section === "regions" ? groupEntity(definition.groupId) : groupEntity("georgia"),
          spec: {
            seriesId, indicatorId: seriesId,
            label: section === "regions"
              ? both(context, ({ messages }) => message(messages, `unemployment.indicator.${definition.indicatorId}`))
              : unemploymentUsesIndicatorSeries(state)
                ? both(context, (presentation) => unemploymentSeriesLabel(definition, state, presentation))
                : both(context, ({ locale, messages }) => `${locale === "en" ? definition.labelEn : definition.labelKa} · ${message(messages, `unemployment.indicator.${definition.indicatorId}`)}`),
            heading: section === "regions" ? null : headingOf(context, model.activeFacts.find((fact) => unemploymentFactSeriesId(fact, state) === definition.id)!.dimension, state),
            // Hired and self-employed people are parts of the employed; the list's other nesting is the page's, not a sum.
            parentSeriesId: ["hired", "self_employed"].includes(definition.indicatorId) ? servedAs(section, state, definition.groupId, "employed").seriesId : null,
            isTotal: section !== "regions" && definition.groupId === "georgia" && definition.id === model.referenceId,
          },
          cells: new Map<number, Cell | undefined>(),
        };
        listed.set(key, entry);
        for (const year of model.years) {
          const fact = byCell.get(`${definition.id}:${year}`);
          const row = fact && context.rows.get(unemploymentObservationKey(fact))!;
          const cell = row && surveyCell(row);
          const before = entry.cells.get(year);
          if (entry.cells.has(year) && before?.value !== cell?.value) throw new Error(`unemployment-${section}: ${entityId} ${seriesId} ${year} differs between tables`);
          entry.cells.set(year, cell);
          if (row) epochs.push({ seriesId, year, epoch: row.methodologyEpoch });
        }
      }
    }
  }
  for (const { entity, spec, cells } of listed.values()) dataset.add(entity, spec, [...cells.keys()].sort((a, b) => a - b), (year) => cells.get(year));
  return dataset.build(lfsEpochBreaks(epochs));
}

/** A Labour Force Survey detail page: its one crawl table's rows (every row with a published figure), Georgia's, over the page's years. */
function buildLabour(context: Context, section: LabourSectionId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`unemployment-${section}`, both(context, ({ messages }) => message(messages, `labour.page.${section}.title`)), "actual");
  const [ka, en] = [labourPageData(context.labour, context.ka.messages, section), labourPageData(context.labour, context.en.messages, section)];
  const rows = new Map(ka.served.map((fact) => [labourFactKey(fact), fact]));
  const georgia = groupEntity("georgia");
  for (const state of labourCrawlStates(section, ka.facts)) {
    const model = buildLabourModel(section, ka.facts, state);
    for (const series of model.selected) {
      const [, table, group] = series.id.split(".");
      dataset.add(georgia, {
        seriesId: series.id, indicatorId: series.id, label: { ka: ka.labels[series.id]!, en: en.labels[series.id]! },
        heading: { ka: ka.headingLabels[series.heading]!, en: en.headingLabels[series.heading]! },
        // An industry's jobs are part of its heading's total; hours and shares are not sums.
        parentSeriesId: table === "jobs" && !series.id.endsWith(".total") ? `labour.jobs.${group}.total` : null, isTotal: series.id.endsWith(".total"),
      }, model.years, (year) => {
        const row = rows.get(labourFactKey({ indicatorId: series.id, year }));
        return row && surveyCell({ ...row, value: Number(row.publishedValue) });
      });
    }
  }
  return dataset.build([]);
}

export const unemploymentTopicAdapter: TopicAdapter = {
  family: "unemployment",
  sourceArchive: ["unemployment"],
  async build() {
    const scopes = ["unemployment", "labour"] as const;
    const groups = UNEMPLOYMENT_GROUPS.map((group) => group.id), regions = UNEMPLOYMENT_REGIONS.map((region) => region.id);
    const [{ facts: unemployment }, { facts: labour }, ka, en] = await Promise.all([
      loadServedUnemploymentData(), loadServedLabourData(), getPresentation("ka", scopes, groups, regions), getPresentation("en", scopes, groups, regions),
    ]);
    const context: Context = { unemployment, rows: new Map(unemployment.map((fact) => [unemploymentObservationKey(fact), fact])), labour, ka, en };
    return [
      ...(["overview", "regions", "age", "gender"] as const).map((section) => buildUnemployment(context, section)),
      ...(["industries", "hours", "informal", "young-people"] as const).map((section) => buildLabour(context, section)),
    ];
  },
};
