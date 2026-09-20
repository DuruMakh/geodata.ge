import { expect, test } from "vitest";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import type { ServedRegionalEconomyObservation } from "../../lib/data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../../lib/data/regionalEconomies/types";
import {
  DEFAULT_REGIONAL_ECONOMY_STATE,
  buildRegionalEconomyModel,
  changeRegionalEconomyMeasure,
  parseRegionalEconomyHash,
  regionalEconomyColor,
  regionalEconomyDefinitions,
  serializeRegionalEconomyHash,
} from "../../lib/explorer/regionalEconomies";

const fact = (
  seriesId: string,
  year: number,
  measure: ServedRegionalEconomyObservation["measure"],
  value: number,
): ServedRegionalEconomyObservation => ({
  regionId: "region.imereti",
  seriesId,
  year,
  measure,
  value,
  unit: measure === "nominal" ? "gel" : "percent",
  valuation: seriesId === REGIONAL_GDP_TOTAL ? "market_prices" : "basic_prices",
  priceBasis: "current_prices",
  calculation: measure === "nominal" ? "published" : "ratio_to_region_gdp",
  status: "published",
  sourceId: measure === "nominal" ? "source" : "derived",
  sourceLocator: "Sheet!A1",
  lastReviewedAt: "2026-09-13",
});

const facts = [
  fact(REGIONAL_GDP_TOTAL, 2023, "nominal", 100),
  fact(REGIONAL_GDP_TOTAL, 2024, "nominal", 120),
  fact("sector.a", 2023, "nominal", 15),
  fact("sector.a", 2024, "nominal", 20),
  fact("sector.b", 2023, "nominal", 0),
  fact("sector.b", 2024, "nominal", 45),
  fact(REGIONAL_GDP_TOTAL, 2023, "share_of_region_gdp", 100),
  fact(REGIONAL_GDP_TOTAL, 2024, "share_of_region_gdp", 100),
  fact("sector.a", 2023, "share_of_region_gdp", 15),
  fact("sector.a", 2024, "share_of_region_gdp", 16.66666666666667),
  fact("sector.b", 2023, "share_of_region_gdp", 0),
  fact("sector.b", 2024, "share_of_region_gdp", 37.5),
];

const definitions = regionalEconomyDefinitions(registry);
const ids = definitions.map((definition) => definition.id);

test("defaults to nominal, line, full range and regional GDP only", () => {
  expect(DEFAULT_REGIONAL_ECONOMY_STATE).toEqual({
    measure: "nominal",
    mode: "line",
    range: { kind: "all" },
    selectedIds: [REGIONAL_GDP_TOTAL],
  });
});

test("hash state distinguishes absent and empty selection and round-trips safely", () => {
  expect(parseRegionalEconomyHash("", ids)).toEqual(DEFAULT_REGIONAL_ECONOMY_STATE);
  expect(parseRegionalEconomyHash("#sel=", ids).selectedIds).toEqual([]);
  expect(parseRegionalEconomyHash("#sel=sector.a,sector.a,unknown", ids).selectedIds).toEqual(["sector.a"]);
  const state = {
    ...DEFAULT_REGIONAL_ECONOMY_STATE,
    measure: "share_of_region_gdp" as const,
    mode: "table" as const,
    range: { kind: "manual" as const, start: 2023, end: 2024 },
    selectedIds: ["sector.a"],
  };
  expect(parseRegionalEconomyHash(serializeRegionalEconomyHash(state), ids)).toEqual(state);
  expect(parseRegionalEconomyHash("#measure=share_of_georgia&start=2024&end=2023", ids).range)
    .toEqual({ kind: "manual", start: 2023, end: 2024 });
});

test("builds ranked chart and table values with one percentage conversion", () => {
  const state = { ...DEFAULT_REGIONAL_ECONOMY_STATE, selectedIds: [REGIONAL_GDP_TOTAL, "sector.a", "sector.b"] };
  const nominal = buildRegionalEconomyModel(facts, registry, state);
  expect(nominal.rows.map((row) => row.itemId)).toEqual([REGIONAL_GDP_TOTAL, "sector.b", "sector.a"]);
  expect(nominal.rows[1].valuesByYear[2024]).toBe(45);
  expect(nominal.headline?.value).toBe(120);

  const share = buildRegionalEconomyModel(facts, registry, { ...state, measure: "share_of_region_gdp" });
  expect(share.series[2].vals).toEqual([15, 16.66666666666667]);
  expect(share.rows[2].valuesByYear[2024]).toBeCloseTo(1 / 6, 12);
  expect(share.headline?.value).toBe(100);
});

test("keeps zero distinct from missing and permits an explicit empty selection", () => {
  const model = buildRegionalEconomyModel(facts, registry, {
    ...DEFAULT_REGIONAL_ECONOMY_STATE,
    selectedIds: ["sector.b", "sector.c"],
  });
  expect(model.series.find((series) => series.id === "sector.b")?.vals).toEqual([0, 45]);
  expect(model.series.find((series) => series.id === "sector.c")?.vals).toEqual([null, null]);
  expect(buildRegionalEconomyModel(facts, registry, { ...DEFAULT_REGIONAL_ECONOMY_STATE, selectedIds: [] }).series).toEqual([]);
});

test("measure changes preserve mode and selection while clamping the active range", () => {
  const state = {
    ...DEFAULT_REGIONAL_ECONOMY_STATE,
    mode: "table" as const,
    selectedIds: ["sector.a"],
    range: { kind: "manual" as const, start: 2022, end: 2023 },
  };
  const next = changeRegionalEconomyMeasure(state, "share_of_region_gdp", facts);
  expect(next).toMatchObject({ measure: "share_of_region_gdp", mode: "table", selectedIds: ["sector.a"] });
  expect(next.range).toEqual({ kind: "manual", start: 2023, end: 2023 });
});

test("regional total remains first and sector colours match the national sector page", () => {
  expect(definitions).toHaveLength(21);
  expect(definitions[0].id).toBe(REGIONAL_GDP_TOTAL);
  expect(regionalEconomyColor(REGIONAL_GDP_TOTAL)).toBe("#1E1B16");
  expect(new Set(definitions.map((definition) => regionalEconomyColor(definition.id))).size).toBe(21);
});
