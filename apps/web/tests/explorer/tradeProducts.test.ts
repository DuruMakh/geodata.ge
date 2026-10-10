import { expect, test } from "vitest";
import { productData, productPresentation } from "./tradeProductsFixtures";

const modelPath = "../../lib/explorer/tradeProducts", statePath = "../../lib/explorer/tradeProductsState";
const modules = async () => ({ ...await import(modelPath), ...await import(statePath) }) as typeof import("../../lib/explorer/tradeProducts") & typeof import("../../lib/explorer/tradeProductsState");
test("keeps source-period identities separate with missing years as gaps", async () => {
  const { buildTradeProductsModel: build, DEFAULT_TRADE_PRODUCTS_STATE: initial } = await modules();
  const data = productData(), model = build(data, { ...initial, selectedIds: data.entities.map(entity => entity.id) }, productPresentation());
  expect(model.valuesByEntity["goods.hs4.2015-2019.8703"][2019]).toBe(100);
  expect(model.valuesByEntity["goods.hs4.2015-2019.8703"][2025]).toBeNull();
  expect(model.valuesByEntity["goods.hs4.2020-2025.8703"][2019]).toBeNull();
  expect(model.valuesByEntity["goods.hs4.2020-2025.8703"][2025]).toBe(200);
  expect(model.years).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  expect(model.ranking[0]).toMatchObject({ entityId: "goods.hs4.2020-2025.8703", valueUsd: 200, shareOfNational: 0.2, rank: 1 });
  expect(model.ranking[0].label).toContain("8703"); expect(model.ranking[0].label).toContain("2020–2025");
  expect(model.missingRanking.map(row => row.entityId)).toContain("goods.hs4.2015-2019.8703");
});
test("flow and year changes retain old selections without inventing a counterpart or changing units", async () => {
  const { buildTradeProductsModel: build, DEFAULT_TRADE_PRODUCTS_STATE: initial } = await modules();
  const data = productData(), p = productPresentation(), id = "goods.hs4.2015-2019.8703";
  const old = build(data, { ...initial, selectedIds: [id] }, p);
  const changed = build(data, { ...initial, measure: "trade.imports", selectedIds: ["goods.total", id], range: { kind: "manual", start: 2025, end: 2025 } }, p);
  expect(changed.selectedIds).toEqual(["goods.total", id]); expect(changed.valuesByEntity[id][2025]).toBeNull();
  expect(build(data, { ...initial, selectedIds: [] }, p).unit).toEqual(old.unit);
  expect(changed.ranking[0].shareOfNational).toBe(0.15);
  const zeroNational = { ...data, nationalFacts: data.nationalFacts.map(fact => ({ ...fact, valueUsd: 0 })) };
  expect(build(zeroNational, initial, p).ranking[0].shareOfNational).toBeNull();
});
test("published zero and negative amounts remain numerical and ranking ignores selected lines", async () => {
  const { buildTradeProductsModel: build, DEFAULT_TRADE_PRODUCTS_STATE: initial } = await modules();
  const data = productData(), p = productPresentation();
  const empty = build(data, { ...initial, selectedIds: [] }, p);
  expect(empty.ranking.find(row => row.entityId.endsWith(".2204"))).toMatchObject({ valueUsd: 0, rank: 2 });
  expect(empty.missingRanking.find(row => row.entityId.endsWith(".0101"))?.rank).toBeNull();
  expect(empty.ranking).toEqual(build(data, initial, p).ranking);
  const negative = { ...data, facts: data.facts.map(fact => fact[0] === 2 && fact[2] === 0 ? [fact[0], fact[1], fact[2], -10] as typeof fact : fact) };
  expect(build(negative, initial, p).ranking.find(row => row.entityId.endsWith(".2204"))?.valueUsd).toBe(-10);
});

test("fits the chart to selected observations without empty leading or trailing years", async () => {
  const { buildTradeProductsModel: build, DEFAULT_TRADE_PRODUCTS_STATE: initial } = await modules();
  const data = productData(), p = productPresentation();
  const recent = build(data, { ...initial, selectedIds: ["goods.hs4.2020-2025.8703"] }, p);
  expect(recent.years).toEqual([2024, 2025]);
  expect(recent.range).toEqual({ min: 2024, max: 2025, start: 2024, end: 2025 });
  const old = build(data, { ...initial, selectedIds: ["goods.hs4.2015-2019.8703"] }, p);
  expect(old.years).toEqual([2019]);
  expect(old.valuesByEntity["goods.hs4.2015-2019.8703"][2019]).toBe(100);
  expect(build(data, { ...initial, selectedIds: ["goods.total", "goods.hs4.2015-2019.8703"] }, p).years).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
});

test("fits to the active flow and counts published zero and negative values as observations", async () => {
  const { buildTradeProductsModel: build, DEFAULT_TRADE_PRODUCTS_STATE: initial } = await modules();
  const data = productData(), p = productPresentation(), selectedIds = ["goods.hs4.2020-2025.2204"];
  data.facts = data.facts.map(fact => fact[0] === 2 && fact[2] === 1 ? [fact[0], fact[1], fact[2], fact[1] === 2024 ? null : -10] : fact);
  expect(build(data, { ...initial, selectedIds }, p).years).toEqual([2024, 2025]);
  const imports = build(data, { ...initial, selectedIds, measure: "trade.imports" }, p);
  expect(imports.years).toEqual([2025]);
  expect(imports.valuesByEntity[selectedIds[0]][2025]).toBe(-10);
});

test("keeps internal missing years and refits a manual range that misses the selected history", async () => {
  const { buildTradeProductsModel: build, DEFAULT_TRADE_PRODUCTS_STATE: initial } = await modules();
  const data = productData(), p = productPresentation(), selectedIds = ["goods.hs4.2020-2025.8703"];
  data.years = [2019, 2020, 2024, 2025]; data.facts.push([data.entities.findIndex(entity => entity.id === selectedIds[0]), 2020, 0, 10]);
  const model = build(data, { ...initial, selectedIds }, p);
  expect(model.years).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  expect(model.valuesByEntity[selectedIds[0]][2021]).toBeNull();
  expect(build(data, { ...initial, selectedIds, range: { kind: "manual", start: 1995, end: 1999 } }, p).years).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  expect(build(data, { ...initial, selectedIds, range: { kind: "manual", start: 2023, end: 2024 } }, p).years).toEqual([2023, 2024]);
});

test("uses selected published years for entirely missing values and full coverage for empty selection", async () => {
  const { buildTradeProductsModel: build, DEFAULT_TRADE_PRODUCTS_STATE: initial } = await modules();
  const data = productData(), p = productPresentation(), id = "goods.hs4.2020-2025.0101";
  const missing = build(data, { ...initial, selectedIds: [id] }, p);
  expect(missing.years).toEqual([2024, 2025]);
  expect(Object.values(missing.valuesByEntity[id])).toEqual([null, null]);
  expect(build(data, { ...initial, selectedIds: [] }, p).years).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
});
