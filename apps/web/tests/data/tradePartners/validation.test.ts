import { expect, test } from "vitest";
import { tradePartnerEntities, tradePartnerFacts, tradePartnersFixtureAcceptance } from "./fixtures";
const modulePath = "../../../lib/data/tradePartners/validation";

test("accepts nullable observed cells without fabricating a missing counterpart", async () => {
  const { validateTradePartnersData } = await import(modulePath);
  expect(() => validateTradePartnersData({ entities: tradePartnerEntities(), facts: tradePartnerFacts() }, tradePartnersFixtureAcceptance())).not.toThrow();
});

test.each(["amount", "reference order", "missing status", "duplicate", "identity", "role"])("rejects a changed %s even if the serving file remains parseable", async change => {
  const { validateTradePartnersData } = await import(modulePath), facts = tradePartnerFacts(), entities = tradePartnerEntities();
  if (change === "amount") facts.find(f => f.role === "derived")!.valueUsd = "999";
  if (change === "reference order") { const derived = facts.find(f => f.role === "derived")!; derived.sourceRefs = JSON.stringify(JSON.parse(derived.sourceRefs).reverse()); }
  if (change === "missing status") facts.find(f => f.valueUsd === null)!.valueUsd = "0";
  if (change === "duplicate") facts.push({ ...facts[0] });
  if (change === "identity") entities[0].sourceCode = "053";
  if (change === "role") facts[0].role = "subtotal";
  expect(() => validateTradePartnersData({ entities, facts }, tradePartnersFixtureAcceptance())).toThrow();
});
