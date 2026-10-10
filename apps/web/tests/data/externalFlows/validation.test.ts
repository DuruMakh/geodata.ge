import { expect, test } from "vitest";
import { moneyTransferEntities, moneyTransferFacts } from "./fixtures";
const modulePath = "../../../lib/data/externalFlows/validation";

test("accepts blanks, partial months and the official estimate without inventing values", async () => {
  const { validateMoneyTransfersData } = await import(modulePath);
  expect(() => validateMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() })).not.toThrow();
});

test.each(["blank becomes zero", "partial without count", "full year with a short count", "duplicate", "unknown entity", "estimate with transfer source", "year outside coverage", "too many decimals"])("rejects %s", async change => {
  const { validateMoneyTransfersData } = await import(modulePath), facts = moneyTransferFacts(), entities = moneyTransferEntities();
  if (change === "blank becomes zero") facts.find(f => f.valueStatus === "blank")!.valueUsd = "0";
  if (change === "partial without count") facts.find(f => f.valueStatus === "partial_months")!.monthsReported = 12;
  if (change === "full year with a short count") facts[0].monthsReported = 11;
  if (change === "duplicate") facts.push({ ...facts[0] });
  if (change === "unknown entity") facts[0].entityId = "transfer.atlantis";
  if (change === "estimate with transfer source") facts.find(f => f.entityId === "bop.personal_transfers")!.sourceId = "source.nbg_money_transfers_by_countries";
  if (change === "year outside coverage") facts[0].year = 2026;
  if (change === "too many decimals") facts[0].valueUsd = "1.000000000000000000001";
  expect(() => validateMoneyTransfersData({ entities, facts })).toThrow();
});
