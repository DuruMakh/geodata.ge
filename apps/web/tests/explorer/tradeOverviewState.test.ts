import { expect, test } from "vitest";
import { tradeFixtureFacts } from "../data/tradeOverview/fixtures";
import { DEFAULT_TRADE_OVERVIEW_STATE, parseTradeOverviewHash, serializeTradeOverviewHash } from "../../lib/explorer/tradeOverviewState";
const facts = tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) }));
test("defaults to all loaded years and only the removable total", () => {
  expect(parseTradeOverviewHash("", facts)).toEqual(DEFAULT_TRADE_OVERVIEW_STATE);
  expect(parseTradeOverviewHash("#sel=trade.exports", facts).selectedIds).toEqual(["trade.exports"]);
});
test("explicit empty selection survives serialization with table mode and years", () => {
  const state = parseTradeOverviewHash("#sel=&view=table&start=2025&end=2025", facts);
  expect(state.selectedIds).toEqual([]);
  expect(parseTradeOverviewHash(serializeTradeOverviewHash(state), facts)).toEqual(state);
});
test("unknown and duplicate indicators are removed without restoring the total", () => {
  expect(parseTradeOverviewHash("#sel=trade.balance,trade.balance,unknown", facts).selectedIds).toEqual(["trade.balance"]);
  expect(parseTradeOverviewHash("#sel=unknown", facts).selectedIds).toEqual([]);
});
test("ranges use loaded coverage and tolerate reversed, partial and invalid bounds", () => {
  expect(parseTradeOverviewHash("#start=2025&end=2024", facts).range).toEqual({ kind: "all" });
  expect(parseTradeOverviewHash("#start=2000&end=2024", facts).range).toEqual({ kind: "manual", start: 2024, end: 2024 });
  expect(parseTradeOverviewHash("#start=2000&end=2001", facts).range).toEqual({ kind: "all" });
  expect(parseTradeOverviewHash("#start=oops&end=2025", facts).range).toEqual({ kind: "all" });
});
