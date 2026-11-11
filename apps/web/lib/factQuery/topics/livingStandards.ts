// apps/web/lib/factQuery/topics/livingStandards.ts
//
// The Living standards pages as topic datasets. Income and Spending serve Georgia's and each region's area page, the
// place the entity: each crawl table's lines (per household and per person, both Geostat's own published figures) over
// the table's years, Georgia's towns and villages lines among them. Poverty and Inequality serve Georgia's rows of each
// tab. Series, names and years come from the pages' own functions (lib/explorer/householdPageData.ts,
// povertyPageData.ts, householdCrawlStates, povertyCrawlStates and their models); values are Geostat's published
// survey estimates the pages print: GEL a month, a share of the population in %, or a Gini coefficient (a unitless
// index). The section index pages draw a map and a list of the area pages' figures, no table of their own. Build-time
// only: runtime code never imports it (tests/factQuery/purity.test.ts).
import { loadServedHouseholdData, toClientHouseholdFact } from "../../data/household/importHousehold";
import { householdFactKey, type HouseholdFact, type HouseholdMeasure } from "../../data/household/types";
import { loadServedPovertyData } from "../../data/poverty/importPoverty";
import { povertyFactKey, type PovertyFact } from "../../data/poverty/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildHouseholdModel, HOUSEHOLD_PAGE_AREAS, householdCrawlStates, sectionTotal, type HouseholdSectionId, type HouseholdSeriesDefinition } from "../../explorer/household";
import { householdAreaLabels, householdLabels, householdPageFilter } from "../../explorer/householdPageData";
import { buildPovertyModel, povertyCrawlStates, type PovertySectionId, type PovertySeriesDefinition } from "../../explorer/poverty";
import { povertyLabels, povertyPageFacts } from "../../explorer/povertyPageData";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { collectTopicDataset, type Cell, type Names } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { household: readonly HouseholdFact[]; householdRows: ReadonlyMap<string, HouseholdFact>; poverty: readonly PovertyFact[]; povertyRows: ReadonlyMap<string, PovertyFact>; ka: Presentation; en: Presentation };

const both = (context: Context, read: (presentation: Presentation) => string): Names => ({ ka: read(context.ka), en: read(context.en) });

/** A reviewed survey row as the page prints it: Geostat's published figure, in its stored unit. */
const surveyCell = (row: HouseholdFact | PovertyFact | undefined): Cell | undefined =>
  row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "survey_estimate" };

/**
 * A household line's served id: the indicator, Georgia's towns or villages when the line is theirs, then the measure
 * (`income.wages.per_household`, `income.total.settlement.urban.per_capita`).
 */
const householdSeriesId = (series: Pick<HouseholdSeriesDefinition, "indicatorId" | "areaId">, area: string, measure: HouseholdMeasure) =>
  [series.indicatorId, series.areaId === area ? null : series.areaId, measure].filter(Boolean).join(".");

/** Income or Spending: each area page's lines, per household and per person (each its own crawl table), over the table's years. */
function buildHousehold(context: Context, section: HouseholdSectionId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`living-standards-${section}`, both(context, ({ messages }) => message(messages, `household.page.${section}.title`)), "actual");
  // The page's names: its lines', and Georgia's, the towns', the villages' and the regions'.
  const names = (presentation: Presentation): Record<string, string> => ({ ...householdLabels(presentation, section), ...householdAreaLabels(presentation) });
  const [ka, en] = [names(context.ka), names(context.en)];
  for (const area of HOUSEHOLD_PAGE_AREAS) {
    const country = area === "georgia";
    const entity: TopicEntity = {
      entityId: country ? GEORGIA_PLACE_ID : area, entityType: country ? "country" : "region",
      labelKa: ka[area]!, labelEn: en[area]!, parentEntityId: country ? null : GEORGIA_PLACE_ID,
    };
    const facts = context.household.map(toClientHouseholdFact).filter(householdPageFilter(section, area));
    for (const state of householdCrawlStates(section, area, facts)) {
      const model = buildHouseholdModel(section, area, facts, state);
      const heading = both(context, ({ messages }) => message(messages, `household.measure.${state.measure}`));
      for (const series of model.selected) {
        // Georgia's towns and villages lines are the section total's: named "Total income — Towns", as both page words read.
        const label = (labels: Record<string, string>) => (series.areaId === area ? labels[series.id]! : `${labels[sectionTotal(section)]} — ${labels[series.id]}`);
        dataset.add(entity, {
          seriesId: householdSeriesId(series, area, state.measure), indicatorId: series.indicatorId, label: { ka: label(ka), en: label(en) }, heading,
          parentSeriesId: series.parentId ? householdSeriesId({ indicatorId: series.parentId as HouseholdFact["indicatorId"], areaId: area }, area, state.measure) : null, isTotal: series.reference,
        }, model.years, (year) => surveyCell(context.householdRows.get(householdFactKey({ indicatorId: series.indicatorId, areaId: series.areaId, measure: state.measure, year }))));
      }
    }
  }
  return dataset.build([]);
}

/** A poverty row's served id: the indicator, then its group when it is not Georgia's (`poverty.absolute.age.0_17`). */
const povertySeriesId = (series: Pick<PovertySeriesDefinition, "indicatorId" | "groupId">) => (series.groupId === "georgia" ? series.indicatorId : `${series.indicatorId}.${series.groupId}`);

/**
 * Poverty or Inequality: each tab's rows (Georgia's; a group nests under its Georgia line) over the tab's years. A row sits
 * under its tab's name, or on Inequality under the Gini coefficient its six rows measure. A Georgia line with groups
 * under it is their total.
 */
function buildPoverty(context: Context, section: PovertySectionId): TopicDatasetBuild {
  const dataset = collectTopicDataset(section === "rates" ? "living-standards-poverty" : "living-standards-inequality", both(context, ({ messages }) => message(messages, `poverty.page.${section}.title`)), "actual");
  const facts = povertyPageFacts(context.poverty, section);
  const [ka, en] = [povertyLabels(context.ka, section), povertyLabels(context.en, section)];
  const georgia: TopicEntity = { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "demography.georgia"), labelEn: message(context.en.messages, "demography.georgia"), parentEntityId: null };
  for (const state of povertyCrawlStates(section, facts)) {
    const model = buildPovertyModel(section, facts, state);
    const heading = both(context, ({ messages }) => message(messages, state.view === "main" ? "poverty.amountHeader.index" : `poverty.tab.${state.view}`));
    const parents = new Set(model.series.flatMap((series) => (series.parentId ? [series.parentId] : [])));
    for (const series of model.selected) {
      const parent = series.parentId ? model.series.find((candidate) => candidate.id === series.parentId)! : undefined;
      dataset.add(georgia, {
        seriesId: povertySeriesId(series), indicatorId: series.indicatorId, label: { ka: ka[series.id]!, en: en[series.id]! }, heading,
        parentSeriesId: parent ? povertySeriesId(parent) : null, isTotal: parents.has(series.id),
      }, model.years, (year) => surveyCell(context.povertyRows.get(povertyFactKey({ indicatorId: series.indicatorId, groupId: series.groupId, year }))));
    }
  }
  return dataset.build([]);
}

export const livingStandardsTopicAdapter: TopicAdapter = {
  family: "living-standards",
  sourceArchive: ["household-income", "poverty"],
  async build() {
    const scopes = ["household", "poverty", "demography"] as const;
    const [{ facts: household }, { facts: poverty }, ka, en] = await Promise.all([
      loadServedHouseholdData(), loadServedPovertyData(),
      getPresentation("ka", scopes, HOUSEHOLD_PAGE_AREAS, HOUSEHOLD_PAGE_AREAS), getPresentation("en", scopes, HOUSEHOLD_PAGE_AREAS, HOUSEHOLD_PAGE_AREAS),
    ]);
    const context: Context = {
      household, householdRows: new Map(household.map((fact) => [householdFactKey(fact), fact])),
      poverty, povertyRows: new Map(poverty.map((fact) => [povertyFactKey(fact), fact])), ka, en,
    };
    return [buildHousehold(context, "income"), buildHousehold(context, "spending"), buildPoverty(context, "rates"), buildPoverty(context, "inequality")];
  },
};
