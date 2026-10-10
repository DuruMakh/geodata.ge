import Decimal from "decimal.js";
import { expect, test } from "vitest";
import type { MirrorClient } from "../../../lib/db/mirrorRows";
import { tradeProductEntities, tradeProductFacts } from "./fixtures";

const mappings = () => import("../../../lib/db/mirrorRows");
test("retains exact decimal and unavailable status through the mirror mappings", async () => {
  const { tradeProductEntityMirrorCreateRows, tradeProductFactMirrorCreateRows, loadTradeProductsDataFromMirror } = await mappings();
  const entities = tradeProductEntities(), facts = tradeProductFacts();
  facts[0] = { ...facts[0], valueUsd: "100.00000000000000000001" };
  const entityRows = tradeProductEntityMirrorCreateRows(entities, "products-run");
  const factRows = tradeProductFactMirrorCreateRows(facts, "products-run").map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd as string) }));
  const db = { tradeProductEntity: { findMany: async () => entityRows }, tradeProductFact: { findMany: async () => factRows } } as unknown as MirrorClient;
  const mirror = await loadTradeProductsDataFromMirror(db);
  expect(mirror).toEqual({ entities, facts });
  expect(mirror.facts[0].valueUsd).toBe("100.00000000000000000001");
  expect(mirror.facts.find(fact => fact.valueStatus === "not_applicable")?.valueUsd).toBeNull();
  expect(entityRows[0].importRunId).toBe("products-run");
  expect(factRows[0].sourceDocumentId).toBe("source.geostat_trade_export_product_by_4_digit_2015_2026");
});
test("rejects an observation attached to a different source document", async () => {
  const { tradeProductEntityMirrorCreateRows, tradeProductFactMirrorCreateRows, loadTradeProductsDataFromMirror } = await mappings();
  const [row] = tradeProductFactMirrorCreateRows(tradeProductFacts(), "products-run");
  const db = { tradeProductEntity: { findMany: async () => tradeProductEntityMirrorCreateRows(tradeProductEntities(), "products-run") }, tradeProductFact: { findMany: async () => [{ ...row, valueUsd: new Decimal(row.valueUsd as string), sourceDocumentId: "source.other" }] } } as unknown as MirrorClient;
  await expect(loadTradeProductsDataFromMirror(db)).rejects.toThrow(/source relation/i);
});
