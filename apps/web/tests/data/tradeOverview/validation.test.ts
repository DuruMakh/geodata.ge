import { expect, test } from "vitest";
import type { TradeOverviewFact } from "../../../lib/data/tradeOverview/types";
import { validateTradeOverviewFacts } from "../../../lib/data/tradeOverview/validation";
import { tradeFixtureFacts } from "./fixtures";

const years = [2024, 2025];

test("accepts source-backed USD amounts and a signed exports-minus-imports balance", () => {
  expect(() => validateTradeOverviewFacts(tradeFixtureFacts(), years)).not.toThrow();
});
test("rejects an omitted whole year even when all remaining totals reconcile", () => {
  expect(() => validateTradeOverviewFacts(tradeFixtureFacts().filter(f => f.year !== 2024), years)).toThrow(/coverage/i);
});
test("rejects duplicate indicator-year observations", () => {
  const facts = tradeFixtureFacts();
  expect(() => validateTradeOverviewFacts([...facts, facts[0]], years)).toThrow(/duplicate/i);
});
test.each([
  ["wrong conversion", (facts: TradeOverviewFact[]) => { facts[0].valueUsd = "81"; }, /conversion/i],
  ["swapped balance sign", (facts: TradeOverviewFact[]) => { facts[3].valueUsd = "70"; }, /identity/i],
  ["invented turnover", (facts: TradeOverviewFact[]) => { facts[2].valueUsd = "231"; }, /identity/i],
  ["wrong flow cell", (facts: TradeOverviewFact[]) => { facts[0].sourceRefs = facts[1].sourceRefs; }, /source/i],
  ["wrong year cell", (facts: TradeOverviewFact[]) => { facts[4].sourceRefs = facts[0].sourceRefs; }, /source/i],
  ["reversed derivation inputs", (facts: TradeOverviewFact[]) => { facts[2].sourceRefs = JSON.stringify(JSON.parse(facts[2].sourceRefs).reverse()); }, /source/i],
  ["wrong unit", (facts: TradeOverviewFact[]) => { facts[0].sourceUnit = "thousand_usd"; }, /unit|source/i],
  ["invented final status", (facts: TradeOverviewFact[]) => { Object.assign(facts[0], { publicationStatus: "final" }); }, /status|contract/i],
  ["missing source field", (facts: TradeOverviewFact[]) => { delete (facts[0] as Partial<TradeOverviewFact>).sourceNumberFormat; }, /source|field/i],
  ["non-finite value", (facts: TradeOverviewFact[]) => { facts[0].valueUsd = "NaN"; }, /value/i],
] as const)("rejects %s", (_name, mutate, message) => {
  const facts = tradeFixtureFacts();
  mutate(facts);
  expect(() => validateTradeOverviewFacts(facts, years)).toThrow(message);
});
test("rejects extra re-export indicators and unsupported years", () => {
  const facts = tradeFixtureFacts();
  expect(() => validateTradeOverviewFacts([...facts, { ...facts[0], indicatorId: "trade.reexports" } as unknown as TradeOverviewFact], years)).toThrow(/indicator|contract/i);
  expect(() => validateTradeOverviewFacts([...facts, { ...facts[0], year: 2026 }], years)).toThrow(/coverage/i);
});
