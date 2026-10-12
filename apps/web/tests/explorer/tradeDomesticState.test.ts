import { expect, test } from "vitest";
import { parseTradeOverviewHash, serializeTradeOverviewHash } from "../../lib/explorer/tradeOverviewState";
import { parseTradePartnersHash, serializeTradePartnersHash } from "../../lib/explorer/tradePartnersState";
import { parseTradeProductsHash, serializeTradeProductsHash, tradeProductsCoverage } from "../../lib/explorer/tradeProductsState";
import { TRADE_CHART_INDICATORS, type ClientTradeOverviewFact } from "../../lib/data/tradeOverview/types";
import type { ClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import type { ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";

const national = ["trade.exports", "trade.domestic_exports", "trade.reexports"].flatMap(indicatorId => [2014, 2025].map(year => ({ year, indicatorId, valueUsd: 10, sourceId: "source", publicationStatus: "unspecified", role: "total", lastReviewedAt: "2026-10-10" }))) as ClientTradeOverviewFact[];
test("national domestic comparisons default to the export total and preserve an explicitly empty selection", () => {
  expect(parseTradeOverviewHash("", national).selectedIds).toEqual(["trade.exports"]);
  const state = parseTradeOverviewHash("#view=table&sel=", national);
  expect(parseTradeOverviewHash(serializeTradeOverviewHash(state), national)).toEqual(state);
  expect(state.selectedIds).toEqual([]);
});

const countries: ClientTradePartnersData = { entities: [], nationalFacts: national, facts: [[0, 2014, TRADE_CHART_INDICATORS.indexOf("trade.domestic_exports"), 1]], measures: ["trade.domestic_exports", "trade.reexports"] };
test("country links keep the domestic measure and reject unrelated imports and group views", () => {
  const state = parseTradePartnersHash("#measure=trade.reexports&tab=groups&sel=", countries);
  expect(state.measure).toBe("trade.reexports");
  expect(state.tab).toBe("countries");
  expect(parseTradePartnersHash(serializeTradePartnersHash(state, countries), countries)).toEqual(state);
  expect(parseTradePartnersHash("#measure=trade.imports", countries).measure).toBe("trade.domestic_exports");
});

const products: ClientTradeProductsData = { entities: [], years: [2020, 2021, 2022, 2023, 2024, 2025], facts: [], nationalFacts: national.filter(f => f.year >= 2020), catalogueFingerprint: "a".repeat(64), sourceBlock: "2020-2025", measures: ["trade.domestic_exports"] };
test("product links use the domestic flow and stay inside the approved product years", () => {
  const state = parseTradeProductsHash(`#measure=trade.imports&start=2014&end=2025&sel=v1.${"a".repeat(64)}.AA`, products);
  expect(state.measure).toBe("trade.domestic_exports");
  expect(tradeProductsCoverage(products, state).years).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  expect(parseTradeProductsHash(serializeTradeProductsHash(state, products), products).selectedIds).toEqual([]);
});
