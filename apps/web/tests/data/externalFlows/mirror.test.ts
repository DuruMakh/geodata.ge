import Decimal from "decimal.js";
import { expect, test } from "vitest";
import type { MirrorClient } from "../../../lib/db/mirrorRows";
import { moneyTransferEntities, moneyTransferFacts } from "./fixtures";

const mappings = () => import("../../../lib/db/mirrorRows");
test("mirror mapping round-trips nulls, month counts, references and exact decimals", async () => {
  const { moneyTransferEntityMirrorCreateRows, moneyTransferFactMirrorCreateRows, loadMoneyTransfersDataFromMirror } = await mappings();
  const entities = moneyTransferEntities(), facts = moneyTransferFacts();
  facts[0] = { ...facts[0], valueUsd: "1000.00000000000000000001" };
  const entityRows = moneyTransferEntityMirrorCreateRows(entities, "transfers-run");
  const factRows = moneyTransferFactMirrorCreateRows(facts, "transfers-run").map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd as string) }));
  const db = { moneyTransferEntity: { findMany: async () => entityRows }, moneyTransferFact: { findMany: async () => factRows } } as unknown as MirrorClient;
  expect(await loadMoneyTransfersDataFromMirror(db)).toEqual({ entities, facts });
  expect(entityRows[0].importRunId).toBe("transfers-run");
  expect(factRows.find(row => row.entityId === "bop.personal_transfers")?.sourceDocumentId).toBe("source.nbg_balance_of_payments_bpm6");
});
test("mirror rejects a fact linked to a different registered source", async () => {
  const { moneyTransferEntityMirrorCreateRows, moneyTransferFactMirrorCreateRows, loadMoneyTransfersDataFromMirror } = await mappings();
  const [row] = moneyTransferFactMirrorCreateRows(moneyTransferFacts(), "transfers-run");
  const db = { moneyTransferEntity: { findMany: async () => moneyTransferEntityMirrorCreateRows(moneyTransferEntities(), "transfers-run") }, moneyTransferFact: { findMany: async () => [{ ...row, valueUsd: new Decimal(row.valueUsd as string), sourceDocumentId: "source.other" }] } } as unknown as MirrorClient;
  await expect(loadMoneyTransfersDataFromMirror(db)).rejects.toThrow(/source relation/i);
});
