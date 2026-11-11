// apps/web/lib/factQuery/topics/energyFood.ts
//
// The Energy and food pages as topic datasets: Energy supply, Electricity, Energy use, Food self-sufficiency and Farming,
// each Georgia's rows (each crawl table's rows, a group one chart can hold, over the table's years). Series, names and
// years come from the page's own functions (lib/explorer/energyFoodPageData.ts, energyFoodCrawlStates and
// buildEnergyFoodModel); a part nested under a total keeps it as its parent, and a row is named as the page's workbook
// names it ("Imports — Natural gas"). Values are Geostat's figures as the page prints them, in each row's own unit (ktoe,
// GWh, %, million GEL, thousand tonnes or head, million litres or pieces, GEL per kg, litre or piece); an energy dash is
// the published zero the page shows, and a farming figure under a starred year is preliminary. Build-time only: runtime
// code never imports it (tests/factQuery/purity.test.ts).
import { loadServedEnergyFoodData } from "../../data/energyFood/importEnergyFood";
import { energyFoodFactKey, type EnergyFoodFact } from "../../data/energyFood/types";
import { GEORGIA_PLACE_ID } from "../../explorer/demographyAreas";
import { buildEnergyFoodModel, ENERGY_FOOD_SECTIONS, energyFoodCrawlStates, energyFoodDisplayLabels, type EnergyFoodHeading, type EnergyFoodSectionId } from "../../explorer/energyFood";
import { energyFoodLabels, energyFoodPageFacts } from "../../explorer/energyFoodPageData";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Presentation } from "../../i18n/types";
import { both, collectTopicDataset, type Cell } from "./collect";
import type { TopicAdapter, TopicDatasetBuild, TopicEntity } from "./types";

type Context = { facts: readonly EnergyFoodFact[]; rows: ReadonlyMap<string, EnergyFoodFact>; ka: Presentation; en: Presentation };

/**
 * A Farming heading's own words, without the unit the page adds after the last comma ("Harvests, thousand tonnes"): the
 * served unit is the row's own (a farm-gate price per kg, litre or piece). "Meat, milk and eggs" names no unit.
 */
function headingText(presentation: Presentation, heading: EnergyFoodHeading): string {
  const text = message(presentation.messages, `energyFood.heading.${heading}`);
  return heading === "products" ? text : text.slice(0, text.lastIndexOf(", "));
}

/** A reviewed row as the page prints it: Geostat's figure at its published precision, in its stored unit; a preliminary farming year keeps its basis. */
function cellOf(context: Context, indicatorId: string, year: number): Cell | undefined {
  const row = context.rows.get(energyFoodFactKey({ indicatorId: indicatorId as EnergyFoodFact["indicatorId"], year }));
  return row && { value: Number(row.publishedValue), unit: row.unit, sourceIds: [row.sourceId], status: "official", ...(row.valueStatus === "preliminary" ? { basis: "preliminary" as const } : {}) };
}

/** One page: each crawl table's rows (one group each) over the table's years. */
function buildSection(context: Context, section: EnergyFoodSectionId): TopicDatasetBuild {
  const dataset = collectTopicDataset(`energy-food-${section}`, both(context, ({ messages }) => message(messages, `energyFood.page.${section}.title`)));
  const facts = energyFoodPageFacts(context.facts, section);
  const [ka, en] = [energyFoodDisplayLabels(section, energyFoodLabels(context.ka, section)), energyFoodDisplayLabels(section, energyFoodLabels(context.en, section))];
  const georgia: TopicEntity = { entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: message(context.ka.messages, "demography.georgia"), labelEn: message(context.en.messages, "demography.georgia"), parentEntityId: null };
  for (const state of energyFoodCrawlStates(section, facts)) {
    const model = buildEnergyFoodModel(section, facts, state);
    for (const series of model.selected) {
      const heading = series.heading;
      dataset.add(georgia, {
        seriesId: series.id, indicatorId: series.id, label: { ka: ka[series.id]!, en: en[series.id]! }, heading: heading ? both(context, (presentation) => headingText(presentation, heading)) : null,
        parentSeriesId: series.parentId ?? null, isTotal: series.id.endsWith(".total"),
      }, model.years, (year) => cellOf(context, series.id, year));
    }
  }
  return dataset.build([]);
}

export const energyFoodTopicAdapter: TopicAdapter = {
  family: "energy-food",
  sourceArchive: ["energy-food"],
  async build() {
    const [{ facts }, ka, en] = await Promise.all([loadServedEnergyFoodData(), getPresentation("ka", ["energyFood", "demography"], []), getPresentation("en", ["energyFood", "demography"], [])]);
    const context: Context = { facts, rows: new Map(facts.map((fact) => [energyFoodFactKey(fact), fact])), ka, en };
    return ENERGY_FOOD_SECTIONS.map(({ id }) => buildSection(context, id));
  },
};
