// apps/web/lib/factQuery/topics/budgetExtras.ts
//
// Spending by type, Tax breaks and refunds and GDP by expenditure as topic datasets, each Georgia's (one entity). Series,
// names and years come from the pages' own data and models (the sectors explorer's measure states and
// buildEconomicSectorsModel, taxBreaksRefundsCrawlStates and buildTaxBreaksRefundsModel); only the measures the reviewed
// CSVs store are served.
// - Spending by type and GDP by expenditure: each row of each measure the page offers, `<row>.<measure>` under the row's
//   list heading: the amount in GEL, the share of GDP and (GDP by expenditure) real growth in %, as the CSVs store them
//   (GDP by expenditure's shares too, which its share tab shows; its crawl tables leave them out only because the list
//   carries the GDP row). A share or a growth rate is Fiscal.ge's calculation from the source's figures (the CSV's
//   `calculation`), status "derived". Basis is the CSV's status, "published" or "preliminary", as the core Economic
//   sectors dataset's is.
// - Tax breaks and refunds: the amounts the CSV stores, in million GEL (its `gel_million`, the figure the workbook
//   prints). Its % of GDP view divides by GDP in the browser and is not served (no GDP is passed, so no such state is built).
// Build-time only: runtime code never imports it (tests/factQuery/purity.test.ts).
import type { SectorDefinition, ServedSectorObservation } from "../../data/economicSectors/types";
import { EXPENDITURE_TYPES, loadServedExpenditureTypesData } from "../../data/expenditureTypes/importExpenditureTypes";
import { GDP_EXPENDITURE, loadServedGdpExpenditureData } from "../../data/gdpExpenditure/importGdpExpenditure";
import { loadServedTaxBreaksRefundsData, toClientTaxBreaksRefundsFact } from "../../data/taxBreaksRefunds/importTaxBreaksRefunds";
import { taxBreaksRefundsFactKey, taxBreaksRefundsSourceDocumentId, type TaxBreaksRefundsFact } from "../../data/taxBreaksRefunds/types";
import { projectSectorObservation, sourceIdByMeasure } from "../../explorer/clientData";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildEconomicSectorsModel, sectorMeasureStates, sectorTotalId, type SectorPageConfig } from "../../explorer/economicSectors";
import { EXPENDITURE_TYPES_PAGE_CONFIG } from "../../explorer/expenditureTypes";
import { GDP_EXPENDITURE_PAGE_CONFIG } from "../../explorer/gdpExpenditure";
import { buildTaxBreaksRefundsModel, TAX_BREAKS_REFUNDS_DEFAULT, taxBreaksRefundsCrawlStates, taxBreaksRefundsNames } from "../../explorer/taxBreaksRefunds";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { collectTopicDataset, type Names } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { ka: Presentation; en: Presentation };

const both = (context: Context, read: (presentation: Presentation) => string): Names => ({ ka: read(context.ka), en: read(context.en) });

function georgia(context: Context): TopicEntity {
  return { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "demography.georgia"), labelEn: message(context.en.messages, "demography.georgia"), parentEntityId: null };
}

/**
 * Spending by type or GDP by expenditure: every row the page lists in each measure it offers, over the measure's years,
 * `<row>.<measure>` (the CSV's measure: `nominal`, `share_of_gdp`, `real_growth`), under the row's own list heading; the
 * unit tells the measures apart. The values are the CSV's.
 */
function sectorDataset(context: Context, datasetId: string, facts: readonly ServedSectorObservation[], registry: readonly SectorDefinition[], config: SectorPageConfig): TopicDatasetBuild {
  const client = facts.map(projectSectorObservation), bySource = sourceIdByMeasure(facts);
  const rows = new Map(facts.map((fact) => [`${fact.seriesId}:${fact.measure}:${fact.year}`, fact]));
  const definitions = new Map(registry.map((definition) => [definition.id, definition]));
  const t = (key: string) => (presentation: Presentation) => message(presentation.messages, `${config.scope}.${key}`);
  const dataset = collectTopicDataset(datasetId, both(context, t("heading")));
  const total = sectorTotalId(config);
  for (const state of sectorMeasureStates(client, registry, bySource, config)) {
    const { measure } = state;
    const model = buildEconomicSectorsModel(client, registry, state, bySource, config);
    for (const series of model.series) {
      const definition = definitions.get(series.id)!;
      dataset.add(georgia(context), {
        seriesId: `${series.id}.${measure}`, indicatorId: series.id, label: { ka: definition.labelKa, en: definition.labelEn },
        heading: definition.headingKa && definition.headingEn ? { ka: definition.headingKa, en: definition.headingEn } : null,
        parentSeriesId: series.id === total ? null : `${total}.${measure}`, isTotal: series.id === total,
      }, model.years, (year) => {
        const value = series.vals[model.years.indexOf(year)];
        if (value === null || value === undefined) return undefined;
        const row = rows.get(`${series.id}:${measure}:${year}`)!;
        return { value, unit: row.unit, sourceIds: [row.sourceId], status: row.calculation === "published" ? "official" : "derived", ...(row.status === "preliminary" ? { basis: "preliminary" as const } : {}) };
      });
    }
  }
  return dataset.build([]);
}

/**
 * Tax breaks and refunds: the list's 16 series over its years, under the list's headings, in the million GEL the CSV
 * stores. Both totals are totals; a VAT or income item sits under its group's total, the group totals under tax breaks.
 */
function taxBreaksRefundsDataset(context: Context, facts: readonly TaxBreaksRefundsFact[]): TopicDatasetBuild {
  const client = facts.map(toClientTaxBreaksRefundsFact);
  const rows = new Map(facts.map((fact) => [taxBreaksRefundsFactKey(fact), fact]));
  const names = { ka: taxBreaksRefundsNames(context.ka.messages), en: taxBreaksRefundsNames(context.en.messages) };
  const dataset = collectTopicDataset("tax-breaks-refunds", both(context, ({ messages }) => message(messages, "taxBreaksRefunds.title")), "actual");
  for (const state of taxBreaksRefundsCrawlStates(client)) {
    const model = buildTaxBreaksRefundsModel(client, state, []);
    for (const series of model.selected) {
      const isTotal = TAX_BREAKS_REFUNDS_DEFAULT.includes(series.id);
      dataset.add(georgia(context), {
        seriesId: series.id, indicatorId: series.id, label: { ka: names.ka.labels[series.id]!, en: names.en.labels[series.id]! }, heading: { ka: names.ka.headings[series.heading], en: names.en.headings[series.heading] },
        parentSeriesId: isTotal ? null : series.id.endsWith(".total") ? "tax_breaks.total" : series.id.replace(/\.[^.]+$/, ".total"), isTotal,
      }, model.years, (year) => {
        if (series.valuesByYear[year] === null) return undefined;
        const row = rows.get(taxBreaksRefundsFactKey({ indicatorId: series.id, year }))!;
        return { value: Number(row.value), unit: row.unit, sourceIds: [taxBreaksRefundsSourceDocumentId(row.sourceId)], status: row.valueStatus, basis: row.basis };
      });
    }
  }
  return dataset.build([]);
}

export const budgetExtrasTopicAdapter: TopicAdapter = {
  family: "budget-extras",
  sourceArchive: ["expenditure-types", "tax-breaks-refunds", "gdp-expenditure"],
  async build() {
    const [types, taxBreaks, gdpUse, ka, en] = await Promise.all([
      loadServedExpenditureTypesData(), loadServedTaxBreaksRefundsData(), loadServedGdpExpenditureData(),
      getPresentation("ka", ["expenditureTypes", "gdpExpenditure", "taxBreaksRefunds", "demography"], []), getPresentation("en", ["expenditureTypes", "gdpExpenditure", "taxBreaksRefunds", "demography"], []),
    ]);
    const context: Context = { ka, en };
    return [
      sectorDataset(context, "expenditure-types", types.facts, EXPENDITURE_TYPES, EXPENDITURE_TYPES_PAGE_CONFIG),
      taxBreaksRefundsDataset(context, taxBreaks.facts),
      sectorDataset(context, "economy-expenditure", gdpUse.facts, GDP_EXPENDITURE, GDP_EXPENDITURE_PAGE_CONFIG),
    ];
  },
};
