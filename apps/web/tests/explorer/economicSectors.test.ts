import { expect, test } from "vitest";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import { DEFAULT_SECTOR_STATE, parseSectorHash, serializeSectorHash, changeSectorMeasure, buildEconomicSectorsModel, sectorColor, sectorMatchesQuery } from "../../lib/explorer/economicSectors";
import type { ServedSectorObservation } from "../../lib/data/economicSectors/types";
import { sourceIdByMeasure } from "../../lib/explorer/clientData";
const ids = registry.map(r => r.id);
const make = (seriesId: string, year: number, measure: ServedSectorObservation["measure"], value: number): ServedSectorObservation => ({
  seriesId, year, measure, value, unit: measure === "nominal" ? "gel" : "percent", valuation: seriesId === "economy.gdp_total" ? "market_prices" : "basic_prices",
  priceBasis: measure === "real_growth" ? "volume_change" : "current_prices", calculation: "published", status: "published", sourceId: "test", sourceLocator: "test", lastReviewedAt: "2026-09-11",
});
const facts = [make("economy.gdp_total",2010,"nominal",120),make("sector.a",2010,"nominal",15),make("sector.b",2010,"nominal",45),
  make("economy.gdp_total",2010,"share_of_gdp",100),make("sector.a",2010,"share_of_gdp",12.5),make("sector.b",2010,"share_of_gdp",37.5),
  make("economy.gdp_total",2011,"real_growth",-5),make("sector.a",2011,"real_growth",7.5)];
test("table rows follow end-year values rather than selection or classification order", () => {
  const model = buildEconomicSectorsModel(facts, registry, { ...DEFAULT_SECTOR_STATE, selectedIds: ["sector.a", "sector.b", "economy.gdp_total"] }, sourceIdByMeasure(facts));
  expect(model.rows.map(row => row.itemId)).toEqual(["economy.gdp_total", "sector.b", "sector.a"]);
});
test("sector hash distinguishes missing and empty selection and sanitizes input", () => {
  expect(parseSectorHash("",ids)).toEqual(DEFAULT_SECTOR_STATE);
  expect(parseSectorHash("#sel=",ids).selectedIds).toEqual([]);
  expect(parseSectorHash("#sel=sector.a,sector.a,unknown",ids).selectedIds).toEqual(["sector.a"]);
  const state = { ...DEFAULT_SECTOR_STATE, selectedIds: [], range: { kind: "manual" as const, start:2010,end:2011 } };
  expect(parseSectorHash(serializeSectorHash(state),ids)).toEqual(state);
  expect(parseSectorHash("#measure=bad&view=bad&start=2025&end=2010",ids).range).toEqual({kind:"manual",start:2010,end:2025});
});
test("measure coverage clamps manual years and preserves selection/view", () => {
  const state = { ...DEFAULT_SECTOR_STATE, mode:"table" as const, selectedIds:["sector.a"], range:{kind:"manual" as const,start:2010,end:2010} };
  const next = changeSectorMeasure(state,"real_growth",facts);
  expect(next.range).toEqual({kind:"all"});
  expect(next.selectedIds).toEqual(["sector.a"]);
  expect(next.mode).toBe("table");
  expect(buildEconomicSectorsModel(facts,registry,next,sourceIdByMeasure(facts)).years).toEqual([2011]);
});
test("shares are selection-independent and percent boundaries are correct", () => {
  const state = { ...DEFAULT_SECTOR_STATE, measure:"share_of_gdp" as const,selectedIds:["sector.a"] };
  const model = buildEconomicSectorsModel(facts,registry,state,sourceIdByMeasure(facts));
  expect(model.series[0].vals).toEqual([12.5]);
  expect(model.rows[0].valuesByYear[2010]).toBe(0.125);
  expect(model.headline?.value).toBe(100);
  const growth=buildEconomicSectorsModel(facts,registry,{...state,measure:"real_growth"},sourceIdByMeasure(facts));
  expect(growth.series[0].vals).toEqual([7.5]);
  expect(growth.rows[0].valuesByYear[2011]).toBe(0.075);
  expect(growth.headline?.value).toBe(-5);
});
test("empty and missing rows remain distinct from zero", () => {
  const model=buildEconomicSectorsModel(facts,registry,{...DEFAULT_SECTOR_STATE,measure:"real_growth",selectedIds:["sector.b"]},sourceIdByMeasure(facts));
  expect(model.series[0].vals).toEqual([null]);
  expect(model.endValues["sector.b"]).toBeNull();
  expect(model.hasData).toBe(false);
  expect(buildEconomicSectorsModel(facts,registry,{...DEFAULT_SECTOR_STATE,selectedIds:[]},sourceIdByMeasure(facts)).series).toEqual([]);
});
test("all sector colors are distinct and stable, with an ink GDP reference",()=>{
  expect(new Set(ids.map(sectorColor)).size).toBe(21);
  expect(sectorColor("economy.gdp_total")).toBe("#1E1B16");
  expect(ids.map(sectorColor).reverse()).toEqual([...ids].reverse().map(sectorColor));
});
test("a manual range remains manual after switching through a shorter full coverage",()=>{
  const history=[make("economy.gdp_total",2010,"nominal",100),make("economy.gdp_total",2025,"nominal",120),make("economy.gdp_total",2011,"real_growth",5),make("economy.gdp_total",2025,"real_growth",7.5)];
  const state={...DEFAULT_SECTOR_STATE,range:{kind:"manual" as const,start:2011,end:2025}};
  const growth=changeSectorMeasure(state,"real_growth",history);
  expect(growth.range).toEqual(state.range);
  expect(changeSectorMeasure(growth,"nominal",history).range).toEqual(state.range);
});

test("sector search matches either label or the NACE code with the shared matcher", () => {
  const ict = registry.find((row) => row.id === "sector.j")!;
  expect(sectorMatchesQuery(ict, "information")).toBe(true);
  expect(sectorMatchesQuery(ict, ict.labelKa.slice(0, 5))).toBe(true);
  expect(sectorMatchesQuery(ict, " J ")).toBe(true);
  expect(sectorMatchesQuery(ict, "")).toBe(true);
  expect(sectorMatchesQuery(ict, "no-such-sector")).toBe(false);
});
