import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { loadTradeOverviewFactsFromMirror, tradeOverviewMirrorCreateRows } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { tradeFixtureFacts } from "./fixtures";

test("database mappings retain native tokens, derived nulls, exact decimals and source relations", async () => {
  const facts = tradeFixtureFacts();
  const rows = tradeOverviewMirrorCreateRows(facts, "trade-run-1").map(row => ({ ...row, valueUsd: new Decimal(row.valueUsd as string) }));
  const db = { tradeOverviewFact: { findMany: async () => rows } } as unknown as Pick<Prisma.TransactionClient, "tradeOverviewFact">;
  expect(await loadTradeOverviewFactsFromMirror(db)).toEqual(facts);
  expect(rows[0].sourceDocumentId).toBe("source.geostat_trade_ftrade_1995_2026");
  expect(rows[0].importRunId).toBe("trade-run-1");
});
test("database mapping refuses a row linked to another registered source", async () => {
  const [row] = tradeOverviewMirrorCreateRows(tradeFixtureFacts(), "trade-run-1");
  const db = { tradeOverviewFact: { findMany: async () => [{ ...row, sourceDocumentId: "source.other", valueUsd: new Decimal(row.valueUsd as string) }] } } as unknown as Pick<Prisma.TransactionClient, "tradeOverviewFact">;
  await expect(loadTradeOverviewFactsFromMirror(db)).rejects.toThrow(/source relation/i);
});
