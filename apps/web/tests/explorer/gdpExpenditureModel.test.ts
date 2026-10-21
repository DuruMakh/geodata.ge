import { describe, expect, test } from "vitest";
import { loadServedGdpExpenditureData, GDP_EXPENDITURE } from "../../lib/data/gdpExpenditure/importGdpExpenditure";
import { projectSectorObservation, sourceIdByMeasure } from "../../lib/explorer/clientData";
import {
  buildEconomicSectorsModel,
  changeSectorMeasure,
  defaultSectorState,
  DEFAULT_SECTOR_STATE,
  parseSectorHash,
  SECTORS_PAGE_CONFIG,
  sectorColor,
} from "../../lib/explorer/economicSectors";
import { GDP_EXPENDITURE_PAGE_CONFIG as CONFIG } from "../../lib/explorer/gdpExpenditure";

const { facts: served } = await loadServedGdpExpenditureData();
const facts = served.map(projectSectorObservation);
const sources = sourceIdByMeasure(served);
const ids = GDP_EXPENDITURE.map(r => r.id);

describe("GDP by expenditure on the sectors explorer", () => {
  test("opens on GDP and the five main parts", () => {
    expect(defaultSectorState(CONFIG).selectedIds).toEqual([
      "economy.gdp_total", "gdp_use.households", "gdp_use.government", "gdp_use.investment", "gdp_use.exports", "gdp_use.imports",
    ]);
    expect(parseSectorHash("", ids, CONFIG).selectedIds).toEqual(CONFIG.defaultSelectedIds);
  });

  test("real growth carries households to the combined series and back", () => {
    const growth = changeSectorMeasure(defaultSectorState(CONFIG), "real_growth", facts, CONFIG);
    expect(growth.selectedIds).toEqual([
      "economy.gdp_total", "gdp_use.households_npish", "gdp_use.government", "gdp_use.investment", "gdp_use.exports", "gdp_use.imports",
    ]);
    expect(changeSectorMeasure(growth, "nominal", facts, CONFIG).selectedIds).toEqual(CONFIG.defaultSelectedIds);
  });

  test("a deep link to households' growth lands on the combined series", () => {
    const parsed = parseSectorHash("#measure=real_growth&sel=gdp_use.households,gdp_use.npish,gdp_use.inventories", ids, CONFIG);
    expect(changeSectorMeasure(parsed, parsed.measure, facts, CONFIG).selectedIds).toEqual(["gdp_use.households_npish"]);
  });

  test("lists only the rows a measure has, in registry order", () => {
    const growth = buildEconomicSectorsModel(facts, GDP_EXPENDITURE, { ...defaultSectorState(CONFIG), measure: "real_growth" }, sources, CONFIG);
    expect(growth.visibleIds).not.toContain("gdp_use.households");
    expect(growth.visibleIds).not.toContain("gdp_use.npish");
    expect(growth.visibleIds).not.toContain("gdp_use.inventories");
    expect(growth.visibleIds).toHaveLength(14);
    const nominal = buildEconomicSectorsModel(facts, GDP_EXPENDITURE, defaultSectorState(CONFIG), sources, CONFIG);
    expect(nominal.visibleIds).toEqual(ids.filter(id => id !== "gdp_use.households_npish"));
    expect(nominal.rows.map(r => r.itemId)).toEqual(CONFIG.defaultSelectedIds);
  });

  test("the share headline is households' share in the latest year", () => {
    const share = buildEconomicSectorsModel(facts, GDP_EXPENDITURE, { ...defaultSectorState(CONFIG), measure: "share_of_gdp" }, sources, CONFIG);
    expect(share.headline?.seriesId).toBe("gdp_use.households");
    expect(share.headline?.year).toBe(2025);
    expect(share.headline?.value).toBeCloseTo(69.09, 2);
  });

  test("negative inventories stay negative values, not gaps", () => {
    const model = buildEconomicSectorsModel(facts, GDP_EXPENDITURE, { ...defaultSectorState(CONFIG), selectedIds: ["gdp_use.inventories"] }, sources, CONFIG);
    expect(model.rows[0].valuesByYear[2017]).toBeLessThan(0);
  });

  test("every row has its own colour; the combined households line wears households'", () => {
    const colours = ids.filter(id => id !== "gdp_use.households_npish").map(sectorColor);
    expect(new Set(colours).size).toBe(colours.length);
    expect(sectorColor("gdp_use.households_npish")).toBe(sectorColor("gdp_use.households"));
  });

  test("the Sectors defaults are unchanged", () => {
    expect(defaultSectorState(SECTORS_PAGE_CONFIG)).toEqual(DEFAULT_SECTOR_STATE);
    expect(SECTORS_PAGE_CONFIG).toMatchObject({ scope: "sectors", ranked: true, listEveryRow: true, highlights: true, shareHeadlineId: null, defaultSelectedIds: ["economy.gdp_total"] });
  });
});
