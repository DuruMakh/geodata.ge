import { expect, test } from "vitest";
import { readTradeProductCatalogue } from "../../lib/data/tradeProducts/catalogue";
import path from "node:path";
import { productData, productPresentation } from "./tradeProductsFixtures";

const cataloguePath = "../../lib/explorer/tradeProductsCatalogue", modelPath = "../../lib/explorer/tradeProducts", statePath = "../../lib/explorer/tradeProductsState";
async function setup() {
  const catalogue = await import(cataloguePath) as typeof import("../../lib/explorer/tradeProductsCatalogue");
  const { buildTradeProductsModel } = await import(modelPath) as typeof import("../../lib/explorer/tradeProducts");
  const { DEFAULT_TRADE_PRODUCTS_STATE } = await import(statePath) as typeof import("../../lib/explorer/tradeProductsState");
  const data = productData(), presentation = productPresentation();
  return { catalogue, input: { data, model: buildTradeProductsModel(data, DEFAULT_TRADE_PRODUCTS_STATE, presentation), presentation, view: "all" as const, categoryId: null, query: "", selectedIds: ["goods.total"], page: 0 } };
}
test("finds code, both languages, source names and reviewed everyday aliases across history", async () => {
  const { catalogue: { findTradeProducts: find }, input } = await setup();
  for (const query of ["8703", "motor cars", "cars", "მანქანა", "მსუბუქი"])
    expect(find({ ...input, query }).rows.map(row => row.entityId)).toEqual(["goods.hs4.2015-2019.8703", "goods.hs4.2020-2025.8703"]);
  expect(find({ ...input, query: "wine" }).rows.map(row => row.entityId)).toEqual(["goods.hs4.2020-2025.2204"]);
  expect(find({ ...input, query: "missing product" }).totalMatches).toBe(0);
});
test("categories and Selected filter visible results without changing global selection or totals", async () => {
  const { catalogue: { findTradeProducts: find }, input } = await setup();
  const all = find(input);
  expect(all.rows[0].entityId).toBe("goods.hs4.2020-2025.8703");
  expect(all.categoryCounts.food_agriculture).toBe(2); expect(all.categoryCounts.vehicles_transport).toBe(2);
  const selectedIds = ["goods.total", "goods.hs4.2015-2019.8703", "goods.hs4.2020-2025.2204"];
  const view = find({ ...input, selectedIds, view: "selected", query: "8703" });
  expect(view.rows.map(row => row.entityId)).toEqual(["goods.hs4.2015-2019.8703"]);
  expect(input.model.totalCount).toBe(5); expect(selectedIds).toHaveLength(3);
});
test("every accepted product is reachable through bounded pages and category counts", async () => {
  const { catalogue: { findTradeProducts: find }, input } = await setup();
  const entities = await readTradeProductCatalogue(path.resolve(process.cwd(), "../.."));
  const data = { ...input.data, entities }, model = { ...input.model, ranking: [], missingRanking: entities.map(entity => ({ entityId: entity.id, label: entity.sourceLabelEn, valueUsd: null, shareOfNational: null, rank: null, color: "#000" })) };
  const presentation = { ...input.presentation, englishLabels: Object.fromEntries(entities.map(entity => [entity.id, entity.sourceLabelEn])) };
  const first = find({ ...input, data, model, presentation }), last = find({ ...input, data, model, presentation, page: 190 });
  expect(first.rows).toHaveLength(25); expect(first.totalMatches).toBe(4768); expect(first.pageCount).toBe(191);
  expect(last.rows).toHaveLength(18);
  expect(Object.values(first.categoryCounts).reduce((sum, count) => sum + count, 0)).toBe(4768);
});
