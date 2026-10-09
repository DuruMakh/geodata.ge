import Decimal from "decimal.js";
import { expect, test } from "vitest";
import type { MirrorClient } from "../../../lib/db/mirrorRows";
import { tradePartnerEntities, tradePartnerFacts } from "./fixtures";

const mappings = () => import("../../../lib/db/mirrorRows");
test("mirror mapping round-trips country codes, nulls, native references and exact decimals", async () => {
  const { tradePartnerEntityMirrorCreateRows, tradePartnerFactMirrorCreateRows, loadTradePartnersDataFromMirror } = await mappings();
  const entities = tradePartnerEntities(), facts = tradePartnerFacts();
  facts[0] = { ...facts[0], valueUsd: "100.00000000000000000001" };
  const entityRows = tradePartnerEntityMirrorCreateRows(entities, "partners-run");
  const factRows = tradePartnerFactMirrorCreateRows(facts, "partners-run").map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd as string) }));
  const db = { tradePartnerEntity: { findMany: async () => entityRows }, tradePartnerFact: { findMany: async () => factRows } } as unknown as MirrorClient;
  expect(await loadTradePartnersDataFromMirror(db)).toEqual({ entities, facts });
  expect(entityRows[0].importRunId).toBe("partners-run");
  expect(factRows[0].sourceDocumentId).toBe("source.geostat_trade_export_country_1995_2026");
  expect(factRows.find(row => row.entityId === "group.eu" && row.indicatorId === "trade.turnover")?.sourceDocumentId).toBe("source.geostat_trade_export__country_group_1995_2026");
});
test("mirror rejects a fact linked to a different registered source", async () => {
  const { tradePartnerEntityMirrorCreateRows, tradePartnerFactMirrorCreateRows, loadTradePartnersDataFromMirror } = await mappings();
  const [row] = tradePartnerFactMirrorCreateRows(tradePartnerFacts(), "partners-run");
  const db = { tradePartnerEntity: { findMany: async () => tradePartnerEntityMirrorCreateRows(tradePartnerEntities(), "partners-run") }, tradePartnerFact: { findMany: async () => [{ ...row, valueUsd: new Decimal(row.valueUsd as string), sourceDocumentId: "source.other" }] } } as unknown as MirrorClient;
  await expect(loadTradePartnersDataFromMirror(db)).rejects.toThrow(/source relation/i);
});
