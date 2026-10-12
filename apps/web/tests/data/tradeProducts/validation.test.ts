import { expect, test } from "vitest";
import { tradeProductEntities, tradeProductFacts } from "./fixtures";

const modulePath = "../../../lib/data/tradeProducts/validation";
test("browses the publisher's Mixed goods placeholder under Other instead of metals", async () => {
  const path = "../../../lib/data/tradeProducts/types";
  const { tradeProductCategory } = await import(path);
  expect(tradeProductCategory("7700")).toBe("other_products");
  expect(tradeProductCategory("8703")).toBe("vehicles_transport");
  expect(tradeProductCategory("0101")).toBe("food_agriculture");
});
test("rejects merging historical codes and changing missing amounts to zero", async () => {
  const { validateTradeProductsData } = await import(modulePath);
  const entities = tradeProductEntities(), facts = tradeProductFacts();
  const report = { status: "passed", scope: "annual_goods_products", productEntities: 4, primaryObservations: facts.length, years: [2019, 2024, 2025], primaryValueStatusCounts: { numeric: 10, blank: 0, not_applicable: 4 }, reviewedAt: "2026-10-09" };
  expect(() => validateTradeProductsData({ entities, facts }, report)).not.toThrow();
  expect(() => validateTradeProductsData({ entities: entities.slice(1), facts }, report)).toThrow(/identity|catalogue|coverage/i);
  const altered = facts.map(fact => fact.valueStatus === "not_applicable" ? { ...fact, valueUsd: "0" } : fact);
  expect(() => validateTradeProductsData({ entities, facts: altered }, report)).toThrow(/status|missing/i);
});
