// apps/web/tests/factQuery/topics/energyFood.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedEnergyFoodData } from "../../../lib/data/energyFood/importEnergyFood";
import { ENERGY_FOOD_INDICATORS, ENERGY_FOOD_SOURCES, type EnergyFoodFact } from "../../../lib/data/energyFood/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { ENERGY_FOOD_SECTIONS, energyFoodCrawlStates, energyFoodDisplayLabels, energyFoodSeries, type EnergyFoodSectionId } from "../../../lib/explorer/energyFood";
import { energyFoodLabels, energyFoodPageFacts } from "../../../lib/explorer/energyFoodPageData";
import { buildEnergyFoodWorkbookExportModel } from "../../../lib/explorer/energyFoodWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { energyFoodTopicAdapter } from "../../../lib/factQuery/topics/energyFood";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { message } from "../../../lib/i18n/messages";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale } from "../../../lib/i18n/types";
import { loadSourcedWorkbookSources } from "../../../lib/methodology/workbookSources";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const SECTIONS = ENERGY_FOOD_SECTIONS.map((section) => section.id);

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: EnergyFoodFact[];
const dataset = (section: EnergyFoodSectionId) => builds.find((build) => build.page.datasetId === `energy-food-${section}`)!;
const factOf = (section: EnergyFoodSectionId, seriesId: string, year: number) => dataset(section).facts.find((fact) => fact.entityId === GEORGIA_PLACE_ID && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && Number(row.year) === year);
const seriesOf = (section: EnergyFoodSectionId, seriesId: string) => dataset(section).series.find((entry) => entry.seriesId === seriesId);

beforeAll(async () => {
  [builds, { facts: served }, csv] = await Promise.all([
    energyFoodTopicAdapter.build(), loadServedEnergyFoodData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/energy-food-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("energy-food topic adapter", () => {
  it("is registered, reads the energy-food source archive and builds the five Energy and food pages for Georgia", () => {
    expect(TOPIC_ADAPTERS).toContain(energyFoodTopicAdapter);
    expect(energyFoodTopicAdapter).toMatchObject({ family: "energy-food", sourceArchive: ["energy-food"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "energy-food"));
    expect(builds.map((build) => [build.page.datasetId, build.titleEn, build.entities.length, build.series.length])).toEqual([
      ["energy-food-energy-supply", "Energy supply", 1, 17], ["energy-food-electricity", "Electricity", 1, 14], ["energy-food-energy-use", "Energy use", 1, 14],
      ["energy-food-food-self-sufficiency", "Food self-sufficiency", 1, 12], ["energy-food-farming", "Farming", 1, 41],
    ]);
    for (const build of builds) expect(build.entities).toEqual([{ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null }]);
    for (const build of builds) expect(build.breaks).toEqual([]);
  });

  it("serves Geostat's figures as the page prints them, in each row's own unit, a part under its total", () => {
    const supply = rowOf("energy.supply.total", 2024)!;
    expect(factOf("energy-supply", "energy.supply.total", 2024)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "energy.supply.total", year: 2024, value: Number(supply.published_value), basis: "published", status: "official", sourceIds: [supply.source_id],
    });
    expect(factOf("farming", "farming.price.milk", 2024)!.value).toBe(Number(rowOf("farming.price.milk", 2024)!.published_value));
    const units = (section: EnergyFoodSectionId) => Object.fromEntries(dataset(section).series.map((series) => [series.seriesId, series.unit]));
    expect(units("electricity")["electricity.production.total"]).toBe("gwh");
    expect(units("food-self-sufficiency")["food.self_sufficiency.wheat"]).toBe("percent");
    expect(units("farming")).toMatchObject({ "farming.output.total": "million_gel", "farming.harvest.wheat": "thousand_tonnes", "farming.livestock.cattle": "thousand_head", "farming.products.milk": "million_litres", "farming.products.eggs": "million_pieces", "farming.price.wheat": "gel_per_kg", "farming.price.milk": "gel_per_litre", "farming.price.eggs": "gel_per_piece" });
    // A part keeps its total as its parent and is named as the workbook names it: an imports part carries "Imports".
    expect(seriesOf("energy-supply", "energy.supply.total")).toMatchObject({ labelEn: "Domestic supply", parentSeriesId: null, isTotal: true, headingEn: null });
    expect(seriesOf("energy-supply", "energy.supply.natural_gas")).toMatchObject({ labelEn: "Natural gas", parentSeriesId: "energy.supply.total", isTotal: false });
    expect(seriesOf("energy-supply", "energy.imports.natural_gas")).toMatchObject({ labelEn: "Imports — Natural gas", labelKa: expect.stringContaining(" — "), parentSeriesId: "energy.imports.total", isTotal: false });
    // A Farming heading without the unit the page adds after its last comma; "Meat, milk and eggs" names none.
    expect(seriesOf("farming", "farming.harvest.wheat")).toMatchObject({ headingEn: "Harvests", headingKa: "მოსავალი" });
    expect(seriesOf("farming", "farming.price.milk")).toMatchObject({ headingEn: "Farm-gate prices", labelEn: "Milk, per litre" });
    expect(seriesOf("farming", "farming.products.milk")).toMatchObject({ headingEn: "Meat, milk and eggs" });
    const units2 = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units;
    expect(units2.gel_per_litre).toEqual({ labelKa: "ლარი 1 ლიტრზე", labelEn: "GEL per litre" });
    expect(units2.million_pieces).toEqual({ labelKa: "მლნ ცალი", labelEn: "million pieces" });
    expect(units2.million_gel).toEqual(units2.gel_million);
  });

  it("serves every reviewed indicator on its page, an energy dash as the zero the page shows and 2025 farm output as preliminary", () => {
    const servedIds = new Set(builds.flatMap((build) => build.series.map((series) => series.seriesId)));
    expect(ENERGY_FOOD_INDICATORS.filter((id) => !servedIds.has(id))).toEqual([]);
    expect(rowOf("energy.imports.crude_oil", 2021)!.value_status).toBe("no_flow");
    expect(factOf("energy-supply", "energy.imports.crude_oil", 2021)).toMatchObject({ value: 0, basis: "published", sourceIds: [rowOf("energy.imports.crude_oil", 2021)!.source_id] });
    expect(rowOf("farming.output.total", 2025)!.value_status).toBe("preliminary");
    expect(factOf("farming", "farming.output.total", 2025)).toMatchObject({ value: Number(rowOf("farming.output.total", 2025)!.published_value), basis: "preliminary" });
    expect(factOf("farming", "farming.output.total", 2024)!.basis).toBe("published");
    // A year Geostat printed nothing for is missing, never zero: wind plants before their first year.
    const wind = csv.filter((row) => row.indicator_id === "electricity.production.wind").map((row) => Number(row.year));
    const before = Math.min(...wind) - 1;
    expect(factOf("electricity", "electricity.production.wind", before)).toMatchObject({ value: null, sourceIds: [] });
  });
});

describe("compare and sources on the energy-food datasets", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const comparison = (section: EnergyFoodSectionId, seriesId: string, fromYear: number, toYear: number): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId: `energy-food-${section}`, seriesIds: [seriesId] }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };
  const published = (indicatorId: string, year: number) => Number(rowOf(indicatorId, year)!.published_value);

  it("gives a self-sufficiency ratio's change in percentage points and an amount's as a percentage (R19)", () => {
    const wheat = comparison("food-self-sufficiency", "food.self_sufficiency.wheat", 2015, 2024);
    expect(wheat).toMatchObject({ comparability: "comparable", unit: "percent", percentageChange: null });
    expect(wheat.percentagePointChange).toBeCloseTo(published("food.self_sufficiency.wheat", 2024) - published("food.self_sufficiency.wheat", 2015), 9);
    const supply = comparison("energy-supply", "energy.supply.total", 2013, 2024);
    expect(supply).toMatchObject({ comparability: "comparable", unit: "ktoe", percentagePointChange: null });
    expect(supply.absoluteChange).toBeCloseTo(published("energy.supply.total", 2024) - published("energy.supply.total", 2013), 9);
  });

  it("cites exactly the 31 Geostat workbooks the values are read from, resolved through get_sources", () => {
    const cited = [...new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "energy-food").flatMap((entry) => entry.columns.sources.flat()))].map((index) => snapshot.topics.sourceIds[index]!).sort();
    // The efficiency workbook only cross-checks the balances' totals.
    expect(cited).toEqual(ENERGY_FOOD_SOURCES.filter((id) => id !== "geostat_energy_efficiency").map((id) => `source.${id}`).sort());
    const farming = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "energy-food-farming")!;
    const own = [...new Set(farming.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!).sort();
    const response = getSources(snapshot, { sourceIds: own, datasetId: "energy-food-farming", years: [farming.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const sources = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(sources.map((source) => source.sourceId).sort()).toEqual(own);
    for (const source of sources) expect(source.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
  });
});

// Parity: the cells each dataset serves are the cells the page's own workbook models print, fed exactly as the page feeds
// them (lib/pages/energy-food.tsx; components/energy-food/energy-food-explorer.tsx's useCrawlModels).

type Reader = (row: WorkbookReadableRow) => ParityTarget | null;

async function sectionModels(locale: Locale, section: EnergyFoodSectionId) {
  const [presentation, sources] = await Promise.all([
    getPresentation(locale, ["energyFood", "format", "main", "workbook"], []),
    loadSourcedWorkbookSources("energy-food", locale, (row) => ENERGY_FOOD_SOURCES.includes(row.source_id)),
  ]);
  const facts = energyFoodPageFacts(served, section), labels = energyFoodLabels(presentation, section), title = message(presentation.messages, `energyFood.page.${section}.title`);
  const shown = energyFoodDisplayLabels(section, labels);
  const readers = new Map<WorkbookExportModel, Reader>();
  const models = energyFoodCrawlStates(section, facts).map((state) => {
    const model = buildEnergyFoodWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin: ORIGIN, title }, presentation);
    // A table's rows are its selected series in list order, each named as the workbook names it, which is checked.
    const listed = energyFoodSeries(section).filter((definition) => state.selectedIds.includes(definition.id));
    readers.set(model, (row) => {
      const definition = listed[model.readable.rows.indexOf(row)];
      return definition && shown[definition.id] === row.label ? { entityId: GEORGIA_PLACE_ID, seriesId: definition.id } : null;
    });
    return model;
  });
  return { models, match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.(row) ?? null };
}

describe("energy-food parity with the page's workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of SECTIONS) {
      it(`${section} (${locale}): Georgia`, async () => {
        const { models, match } = await sectionModels(locale, section);
        expectWorkbookParity(dataset(section), models, match);
      });
    }
  }

  it("fails when a served figure is not the one the page prints", async () => {
    const farming = dataset("farming");
    const facts = farming.facts.map((fact): TopicFact => (fact.year === 2024 && fact.seriesId === "farming.price.milk" ? { ...fact, value: fact.value! + 0.01 } : fact));
    const { models, match } = await sectionModels("en", "farming");
    expect(() => expectWorkbookParity({ ...farming, facts }, models, match)).toThrow(/2024: the page prints [\d.]+, country.georgia farming.price.milk serves/);
  });
});
