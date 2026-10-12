import { expect, test } from "vitest";
import { buildTradeProductsModel } from "../../lib/explorer/tradeProducts";
import { DEFAULT_TRADE_PRODUCTS_STATE, parseTradeProductsHash, serializeTradeProductsHash } from "../../lib/explorer/tradeProductsState";
import { productData, productPresentation } from "./tradeProductsFixtures";

test("keeps the selected product's published span when the active flow has no observations", () => {
  const data = productData(), presentation = productPresentation(), id = "goods.hs4.2020-2025.8703";
  const index = data.entities.findIndex(entity => entity.id === id);
  data.facts = data.facts.filter(fact => fact[0] !== index || fact[2] === 1);
  const state = { ...DEFAULT_TRADE_PRODUCTS_STATE, selectedIds: [id] };
  expect(buildTradeProductsModel(data, { ...state, measure: "trade.imports" }, presentation).years).toEqual([2024, 2025]);
  const exports = buildTradeProductsModel(data, state, presentation);
  expect(exports.years).toEqual([2024, 2025]);
  expect(Object.values(exports.valuesByEntity[id])).toEqual([null, null]);
  const saved = serializeTradeProductsHash({ ...state, range: { kind: "manual", start: 1995, end: 2024 } }, data);
  expect(parseTradeProductsHash(saved, data).range).toEqual({ kind: "manual", start: 2024, end: 2024 });
});
