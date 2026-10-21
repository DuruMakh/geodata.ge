import { describe, expect, test } from "vitest";
import { EXPENDITURE_TYPES, loadServedExpenditureTypesData } from "../../lib/data/expenditureTypes/importExpenditureTypes";
import { projectSectorObservation, sourceIdByMeasure } from "../../lib/explorer/clientData";
import {
  buildEconomicSectorsModel,
  changeSectorMeasure,
  defaultSectorState,
  parseSectorHash,
  sectorColor,
  sectorTotalId,
  SECTORS_PAGE_CONFIG,
} from "../../lib/explorer/economicSectors";
import { EXPENDITURE_TYPES_PAGE_CONFIG as CONFIG } from "../../lib/explorer/expenditureTypes";

const { facts: served } = await loadServedExpenditureTypesData();
const facts = served.map(projectSectorObservation);
const sources = sourceIdByMeasure(served);
const ids = EXPENDITURE_TYPES.map(r => r.id);
const DEFAULT = ["total", "social_benefits", "investment", "compensation", "subsidies", "goods_services", "interest"].map(id => `spending_type.${id}`);

describe("spending by type on the sectors explorer", () => {
  test("opens on the total and the six named main types", () => {
    expect(defaultSectorState(CONFIG).selectedIds).toEqual(DEFAULT);
    expect(parseSectorHash("", ids, CONFIG).selectedIds).toEqual(DEFAULT);
  });

  test("offers only amounts and share of GDP; a real-growth link falls back to amounts", () => {
    expect(CONFIG.measures).toEqual(["nominal", "share_of_gdp"]);
    expect(parseSectorHash("#measure=real_growth", ids, CONFIG).measure).toBe("nominal");
    // The other pages still read every measure.
    expect(parseSectorHash("#measure=real_growth", ["economy.gdp_total"], SECTORS_PAGE_CONFIG).measure).toBe("real_growth");
  });

  test("pins total spending, not GDP", () => {
    expect(sectorTotalId(CONFIG)).toBe("spending_type.total");
    expect(sectorTotalId(SECTORS_PAGE_CONFIG)).toBe("economy.gdp_total");
  });

  test("the amount headline is total spending in the latest year", () => {
    const model = buildEconomicSectorsModel(facts, EXPENDITURE_TYPES, defaultSectorState(CONFIG), sources, CONFIG);
    expect(model.headline?.seriesId).toBe("spending_type.total");
    expect(model.headline?.year).toBe(2025);
    expect(model.headline?.value).toBe(29743800000);
    expect(model.rows.map(r => r.itemId)).toEqual(ids.filter(id => DEFAULT.includes(id)));
    expect(model.visibleIds).toEqual(ids);
  });

  test("share of GDP with only the total keeps the total and heads with its share", () => {
    const state = changeSectorMeasure({ ...defaultSectorState(CONFIG), selectedIds: ["spending_type.total"] }, "share_of_gdp", facts, CONFIG);
    expect(state.selectedIds).toEqual(["spending_type.total"]);
    const model = buildEconomicSectorsModel(facts, EXPENDITURE_TYPES, state, sources, CONFIG);
    expect(model.headline?.seriesId).toBe("spending_type.total");
    expect(model.headline?.value).toBeCloseTo(28.44, 2);
    expect(model.headline?.status).toBe("preliminary");
  });

  test("every row has its own colour", () => {
    const colours = ids.map(sectorColor);
    expect(new Set(colours).size).toBe(ids.length);
  });
});
