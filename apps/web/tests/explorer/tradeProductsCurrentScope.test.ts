import { expect, test } from "vitest";
import { loadTradeProductCatalogueFingerprint, loadTradeProductsData, toClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { buildTradeProductsModel } from "../../lib/explorer/tradeProducts";
import { buildTradeProductsWorkbookModel } from "../../lib/explorer/tradeProductsWorkbook";
import { decodeTradeProductsSelection, encodeTradeProductsSelection } from "../../lib/explorer/tradeProductsSelection";
import { DEFAULT_TRADE_PRODUCTS_STATE } from "../../lib/explorer/tradeProductsState";
import { findTradeProducts } from "../../lib/explorer/tradeProductsCatalogue";
import { tradeProductEntities, tradeProductFacts, tradeProductNationalFacts } from "../data/tradeProducts/fixtures";
import { productPresentation } from "./tradeProductsFixtures";
import { getMessages } from "../../lib/i18n/messages.server";

test("projects one source period before constructing indexed product and national facts", () => {
  const raw = { entities: tradeProductEntities(), facts: tradeProductFacts() }, national = tradeProductNationalFacts();
  national.push({ ...national[0], year: 2019 });
  const data = toClientTradeProductsData(raw, national, "a".repeat(64), "2020-2025");
  expect(data.sourceBlock).toBe("2020-2025");
  expect(data.entities.map(entity => entity.id)).toEqual(["goods.hs4.2020-2025.0101", "goods.hs4.2020-2025.2204", "goods.hs4.2020-2025.8703"]);
  expect(data.years).toEqual([2024, 2025]);
  expect(data.facts).toHaveLength(12);
  expect(data.facts.find(fact => fact[0] === 2 && fact[1] === 2025 && fact[2] === 0)).toEqual([2, 2025, 0, 200]);
  expect(data.facts.filter(fact => fact[0] === 0).every(fact => fact[3] === null)).toBe(true);
  expect(data.nationalFacts.every(fact => fact.year === 2024 || fact.year === 2025)).toBe(true);
  expect(raw.entities).toHaveLength(4); expect(raw.facts).toHaveLength(14);
});

test("the reviewed current catalogue has one entry per code and only 2020 onward observations", async () => {
  const raw = await loadTradeProductsData(), data = toClientTradeProductsData(raw, [], "a".repeat(64), "2020-2025");
  expect(data.entities).toHaveLength(1192);
  expect(new Set(data.entities.map(entity => entity.code)).size).toBe(1192);
  expect(data.entities.filter(entity => entity.code === "2203")).toHaveLength(1);
  expect(data.years).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  expect(data.facts.every(fact => fact[1] >= 2020 && data.entities[fact[0]].sourceBlock === "2020-2025")).toBe(true);
  expect(raw.entities).toHaveLength(4768); expect(raw.facts).toHaveLength(69624);
});

test("binds saved selections to the scoped catalogue without reinterpreting older catalogue bits", async () => {
  const fullFingerprint = await loadTradeProductCatalogueFingerprint(), scopedFingerprint = await loadTradeProductCatalogueFingerprint("2020-2025");
  expect(scopedFingerprint).not.toBe(fullFingerprint);
  const raw = { entities: tradeProductEntities(), facts: tradeProductFacts() };
  const full = toClientTradeProductsData(raw, [], fullFingerprint), scoped = toClientTradeProductsData(raw, [], scopedFingerprint, "2020-2025");
  expect(decodeTradeProductsSelection(encodeTradeProductsSelection(["goods.hs4.2020-2025.8703"], full), scoped).invalid).toBe(true);
  const ids = ["goods.total", "goods.hs4.2020-2025.2204"];
  expect(decodeTradeProductsSelection(encodeTradeProductsSelection(ids, scoped), scoped)).toEqual({ selectedIds: ids, invalid: false });
});

test("current search and workbook use one simple product label and the same restricted dates", async () => {
  const data = toClientTradeProductsData({ entities: tradeProductEntities(), facts: tradeProductFacts() }, tradeProductNationalFacts(), "a".repeat(64), "2020-2025");
  const presentation = { ...productPresentation(), messages: await getMessages("en", ["trade", "workbook"]) };
  const state = { ...DEFAULT_TRADE_PRODUCTS_STATE, selectedIds: ["goods.total", "goods.hs4.2020-2025.8703"] };
  const model = buildTradeProductsModel(data, state, presentation);
  expect(model.totalCount).toBe(4);
  const found = findTradeProducts({ data, model, presentation, view: "all", categoryId: null, query: "8703", selectedIds: state.selectedIds, page: 0 });
  expect(found.rows).toHaveLength(1); expect(found.rows[0].label).toBe("Motor cars · 8703");
  const workbook = buildTradeProductsWorkbookModel({ data, state, sources: [], siteOrigin: "https://fiscal.ge" }, presentation);
  expect(workbook.analysis.rows).toHaveLength(4);
  expect(workbook.readable.subtitle).toContain("2024–2025");
  expect(workbook.readable.subtitle).not.toContain(presentation.messages["trade.products.historicalNote"]);
  expect(workbook.readable.rows[1].label).toBe("Motor cars · 8703");
});
