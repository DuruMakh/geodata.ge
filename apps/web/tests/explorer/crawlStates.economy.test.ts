import { beforeAll, describe, expect, it } from "vitest";
import { loadBusinessFacts, toClientBusinessFact } from "../../lib/data/business/importBusiness";
import { BUSINESS_REGIONS, type ClientBusinessFact } from "../../lib/data/business/types";
import { ECONOMIC_SECTORS, loadServedEconomicSectorsData } from "../../lib/data/economicSectors/importEconomicSectors";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import { EXPENDITURE_TYPES, loadServedExpenditureTypesData } from "../../lib/data/expenditureTypes/importExpenditureTypes";
import { GDP_EXPENDITURE, loadServedGdpExpenditureData } from "../../lib/data/gdpExpenditure/importGdpExpenditure";
import { loadServedGdpOverviewData } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadHousingFacts, toClientHousingFact } from "../../lib/data/housing/importHousing";
import { HOUSING_REGIONS, type ClientHousingFact } from "../../lib/data/housing/types";
import { loadServedRegionalEconomyData, REGIONAL_ECONOMY_REGIONS, REGIONAL_ECONOMY_SECTORS } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { BUSINESS_SECTIONS, businessCrawlStates, businessTopicSeries, type BusinessTopicId } from "../../lib/explorer/business";
import { businessAreaCrawlStates, businessAreaSeries } from "../../lib/explorer/businessAreas";
import { buildBusinessWorkbookExportModel } from "../../lib/explorer/businessWorkbook";
import { projectGdpObservation, projectRegionalObservation, projectSectorObservation, sourceIdByMeasure, sourceIdRangesBySeries } from "../../lib/explorer/clientData";
import { buildEconomicSectorsModel, sectorCrawlStates, SECTORS_PAGE_CONFIG, type SectorPageConfig } from "../../lib/explorer/economicSectors";
import { buildEconomicSectorsWorkbookExportModel } from "../../lib/explorer/economicSectorsWorkbook";
import { EXPENDITURE_TYPES_PAGE_CONFIG } from "../../lib/explorer/expenditureTypes";
import { GDP_EXPENDITURE_PAGE_CONFIG } from "../../lib/explorer/gdpExpenditure";
import { gdpCrawlStates, seriesFor } from "../../lib/explorer/gdpOverview";
import { buildGdpWorkbookExportModel } from "../../lib/explorer/gdpWorkbook";
import { HOUSING_SECTIONS, housingCrawlStates, housingTopicSeries, type HousingTopicId } from "../../lib/explorer/housing";
import { housingAreaCrawlStates, housingAreaSeries } from "../../lib/explorer/housingAreas";
import { buildHousingWorkbookExportModel } from "../../lib/explorer/housingWorkbook";
import { regionalEconomyCrawlStates, regionalEconomyDefinitions } from "../../lib/explorer/regionalEconomies";
import { buildRegionalEconomyWorkbookExportModel } from "../../lib/explorer/regionalEconomiesWorkbook";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";
import type { ClientRegionalEconomyObservation, ClientSectorObservation } from "../../lib/servedRows";

const ORIGIN = "https://fiscal.ge";
const ids = (states: readonly { selectedIds: readonly string[] }[]) => new Set(states.flatMap((state) => state.selectedIds));
const rowsOf = (model: WorkbookExportModel) => model.readable.rows.length;

let en: Presentation;
beforeAll(async () => {
  en = await getPresentation("en", ["format", "main", "workbook", "gdp", "sectors", "gdpExpenditure", "expenditureTypes", "regionalEconomies", "business", "housing"], []);
});

describe("GDP overview", () => {
  it("every indicator, nominal and per person in GEL and in US dollars: six one-series states", async () => {
    const served = (await loadServedGdpOverviewData()).facts;
    const facts = served.map(projectGdpObservation);
    const states = gdpCrawlStates(facts);
    expect(states.map(seriesFor)).toEqual(["real_usd_2015", "nominal_gel", "nominal_usd", "real_growth_percent", "per_capita_gel", "per_capita_usd"]);
    expect(new Set(states.map(seriesFor))).toEqual(new Set(facts.map((fact) => fact.seriesId)));
    for (const state of states) {
      expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
      expect(rowsOf(buildGdpWorkbookExportModel(facts, state, en, [], ORIGIN, sourceIdRangesBySeries(served)))).toBe(1);
    }
    expect(gdpCrawlStates(facts.filter((fact) => fact.seriesId !== "per_capita_usd")).map(seriesFor)).not.toContain("per_capita_usd");
  });
});

describe("sectors explorer: Sectors, GDP by expenditure, Spending by type", () => {
  const pages: [string, () => Promise<{ facts: Parameters<typeof projectSectorObservation>[0][] }>, SectorDefinition[], SectorPageConfig, string[]][] = [
    // A share of GDP divides the list's own amounts by the GDP row it lists; Spending by type lists no GDP, so its share is kept.
    ["Sectors", loadServedEconomicSectorsData, ECONOMIC_SECTORS, SECTORS_PAGE_CONFIG, ["nominal", "real_growth"]],
    ["GDP by expenditure", loadServedGdpExpenditureData, GDP_EXPENDITURE, GDP_EXPENDITURE_PAGE_CONFIG, ["nominal", "real_growth"]],
    ["Spending by type", loadServedExpenditureTypesData, EXPENDITURE_TYPES, EXPENDITURE_TYPES_PAGE_CONFIG, ["nominal", "share_of_gdp"]],
  ];
  for (const [name, load, registry, config, measures] of pages) {
    it(`${name}: one state per measure, each selecting every row its list shows`, async () => {
      const served = (await load()).facts;
      const facts: ClientSectorObservation[] = served.map(projectSectorObservation);
      const sources = sourceIdByMeasure(served);
      const states = sectorCrawlStates(facts, registry, sources, config);
      expect(states.map((state) => state.measure)).toEqual(measures);
      for (const state of states) {
        expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
        const listed = buildEconomicSectorsModel(facts, registry, { ...state, selectedIds: [] }, sources, config).visibleIds;
        expect(new Set(state.selectedIds)).toEqual(new Set(listed));
        expect(rowsOf(buildEconomicSectorsWorkbookExportModel(facts, registry, state, en, [], ORIGIN, sources, config))).toBe(listed.length);
      }
      // Every row any measure's list offers is in some state.
      const everyListed = new Set(measures.flatMap((measure) => buildEconomicSectorsModel(facts, registry, { mode: "line", measure: measure as ClientSectorObservation["measure"], range: { kind: "all" }, selectedIds: [] }, sources, config).visibleIds));
      expect(ids(states)).toEqual(everyListed);
      expect(sectorCrawlStates(facts.filter((fact) => fact.measure === "nominal"), registry, sources, config).map((state) => state.measure)).toEqual(["nominal"]);
    });
  }

  it("GDP by expenditure: households with non-profits, listed only for real growth, are in the growth state", async () => {
    const served = (await loadServedGdpExpenditureData()).facts;
    const states = sectorCrawlStates(served.map(projectSectorObservation), GDP_EXPENDITURE, sourceIdByMeasure(served), GDP_EXPENDITURE_PAGE_CONFIG);
    expect(states.find((state) => state.measure === "real_growth")!.selectedIds).toContain("gdp_use.households_npish");
    expect(states.find((state) => state.measure === "nominal")!.selectedIds).not.toContain("gdp_use.households_npish");
  });
});

describe("regional economy places", () => {
  let facts: ClientRegionalEconomyObservation[];
  beforeAll(async () => { facts = (await loadServedRegionalEconomyData()).facts.map(projectRegionalObservation); });

  it("a region: one GEL state with the total and every sector (its share only divides them by the total)", () => {
    const region = REGIONAL_ECONOMY_REGIONS.find((candidate) => candidate.id === "region.imereti")!;
    const own = facts.filter((fact) => fact.regionId === region.id);
    const states = regionalEconomyCrawlStates(own, REGIONAL_ECONOMY_SECTORS);
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ measure: "nominal", mode: "line", range: { kind: "all" } });
    expect(ids(states)).toEqual(new Set(regionalEconomyDefinitions(REGIONAL_ECONOMY_SECTORS).map((definition) => definition.id)));
    const identity = { id: region.id, labelKa: region.kaLabel, labelEn: region.id };
    expect(rowsOf(buildRegionalEconomyWorkbookExportModel(own, REGIONAL_ECONOMY_SECTORS, states[0], identity, en, [], ORIGIN))).toBe(regionalEconomyDefinitions(REGIONAL_ECONOMY_SECTORS).length);
  });

  it("a region without GEL amounts has no state", () => {
    const own = facts.filter((fact) => fact.regionId === "region.imereti" && fact.measure !== "nominal");
    expect(own.length).toBeGreaterThan(0);
    expect(regionalEconomyCrawlStates(own, REGIONAL_ECONOMY_SECTORS)).toEqual([]);
  });
});

// The list's units, in list order, as the facts give them.
const unitsInOrder = (definitions: readonly { id: string }[], facts: readonly { indicatorId: string; unit: string }[]) =>
  [...new Set(definitions.map((definition) => facts.find((fact) => fact.indicatorId === definition.id)!.unit))];

describe("business topic pages and places", () => {
  let all: ClientBusinessFact[];
  beforeAll(async () => { all = (await loadBusinessFacts()).map(toClientBusinessFact); });
  const labelsOf = (definitions: readonly { id: string }[]) => Object.fromEntries(definitions.map((definition) => [definition.id, definition.id]));

  for (const section of BUSINESS_SECTIONS.map((entry) => entry.id).filter((id): id is BusinessTopicId => id !== "regions")) {
    it(`${section}: one state per unit, every series of the list over its unit's years`, () => {
      const definitions = businessTopicSeries(section);
      const listed = new Set(definitions.map((definition) => definition.id));
      const facts = all.filter((fact) => listed.has(fact.indicatorId));
      const states = businessCrawlStates(section, facts);
      expect(states.map((state) => facts.find((fact) => fact.indicatorId === state.selectedIds[0])!.unit)).toEqual(unitsInOrder(definitions, facts));
      expect(ids(states)).toEqual(listed);
      for (const state of states) {
        expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
        expect(new Set(state.selectedIds.map((id) => facts.find((fact) => fact.indicatorId === id)!.unit)).size).toBe(1);
        expect(rowsOf(buildBusinessWorkbookExportModel({ section, facts, state, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    });
  }

  it("firms: counts and rates are two states", () => {
    const listed = new Set(businessTopicSeries("firms").map((definition) => definition.id));
    expect(businessCrawlStates("firms", all.filter((fact) => listed.has(fact.indicatorId)))).toHaveLength(2);
  });

  it("Georgia and a region: money, jobs and firms, every series of each", () => {
    for (const area of ["georgia", BUSINESS_REGIONS[0]] as const) {
      const definitions = businessAreaSeries(area);
      const listed = new Set(definitions.map((definition) => definition.id));
      const facts = all.filter((fact) => listed.has(fact.indicatorId));
      const states = businessAreaCrawlStates(area, facts);
      expect(states).toHaveLength(3);
      expect(ids(states)).toEqual(listed);
      for (const state of states) {
        expect(rowsOf(buildBusinessWorkbookExportModel({ area, facts, state, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    }
  });

  it("a region without jobs figures has no jobs state", () => {
    const area = BUSINESS_REGIONS[0];
    const listed = new Set(businessAreaSeries(area).map((definition) => definition.id));
    const facts = all.filter((fact) => listed.has(fact.indicatorId) && fact.unit !== "persons");
    expect(businessAreaCrawlStates(area, facts).map((state) => facts.find((fact) => fact.indicatorId === state.selectedIds[0])!.unit)).toEqual(["gel", "enterprises"]);
  });
});

describe("housing topic pages and places", () => {
  let all: ClientHousingFact[];
  beforeAll(async () => { all = (await loadHousingFacts()).map(toClientHousingFact); });
  const labelsOf = (definitions: readonly { id: string }[]) => Object.fromEntries(definitions.map((definition) => [definition.id, definition.id]));

  for (const section of HOUSING_SECTIONS.map((entry) => entry.id).filter((id): id is HousingTopicId => id !== "regions")) {
    it(`${section}: one state per unit, every series of the list`, () => {
      const definitions = housingTopicSeries(section);
      const listed = new Set(definitions.map((definition) => definition.id));
      const facts = all.filter((fact) => listed.has(fact.indicatorId));
      const states = housingCrawlStates(section, facts);
      expect(states).toHaveLength(2);
      expect(states.map((state) => facts.find((fact) => fact.indicatorId === state.selectedIds[0])!.unit)).toEqual(unitsInOrder(definitions, facts));
      expect(ids(states)).toEqual(listed);
      for (const state of states) {
        expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
        expect(rowsOf(buildHousingWorkbookExportModel({ section, facts, state, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    });
  }

  it("Georgia and a region: number and floor area, every series of each", () => {
    for (const area of ["georgia", HOUSING_REGIONS[0]] as const) {
      const definitions = housingAreaSeries(area);
      const listed = new Set(definitions.map((definition) => definition.id));
      const facts = all.filter((fact) => listed.has(fact.indicatorId));
      const states = housingAreaCrawlStates(area, facts);
      expect(states).toHaveLength(2);
      expect(ids(states)).toEqual(listed);
      for (const state of states) {
        expect(rowsOf(buildHousingWorkbookExportModel({ area, facts, state, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(4);
      }
    }
  });

  it("a region without floor-area figures has no floor-area state", () => {
    const area = HOUSING_REGIONS[0];
    const listed = new Set(housingAreaSeries(area).map((definition) => definition.id));
    const facts = all.filter((fact) => listed.has(fact.indicatorId) && fact.unit !== "area");
    expect(housingAreaCrawlStates(area, facts).map((state) => facts.find((fact) => fact.indicatorId === state.selectedIds[0])!.unit)).toEqual(["count"]);
  });
});
