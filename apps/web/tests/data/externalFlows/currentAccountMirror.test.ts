import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { assertCurrentAccountParity, loadCurrentAccountFacts } from "../../../lib/data/externalFlows/importCurrentAccount";
import type { MirrorClient } from "../../../lib/db/mirrorRows";

const mappings = () => import("../../../lib/db/mirrorRows");
const asDb = (factRows: Record<string, unknown>[]) => ({ currentAccountFact: { findMany: async () => factRows.map(row => ({ ...row, valueUsd: new Decimal(row.valueUsd as string) })) } }) as unknown as MirrorClient;

test("the complete package round-trips through the mirror mapping with exact decimals", async () => {
  const { currentAccountFactMirrorCreateRows, loadCurrentAccountFactsFromMirror } = await mappings();
  const csv = await loadCurrentAccountFacts();
  const rows = currentAccountFactMirrorCreateRows(csv, "run-1");
  expect(rows[0]).toMatchObject({ importRunId: "run-1", sourceDocumentId: "source.nbg_balance_of_payments_bpm6" });
  assertCurrentAccountParity(csv, await loadCurrentAccountFactsFromMirror(asDb(rows)));
  expect(() => assertCurrentAccountParity(csv, csv.map((fact, index) => index === 0 ? { ...fact, valueUsd: new Decimal(fact.valueUsd).plus("0.01").toFixed() } : fact))).toThrow(/does not match|parity/i);
  rows.pop();
  await expect(loadCurrentAccountFactsFromMirror(asDb(rows)).then(mirror => assertCurrentAccountParity(csv, mirror))).rejects.toThrow(/does not match|parity/i);
});

test("the mirror rejects a fact linked to a different source", async () => {
  const { currentAccountFactMirrorCreateRows, loadCurrentAccountFactsFromMirror } = await mappings();
  const [row] = currentAccountFactMirrorCreateRows(await loadCurrentAccountFacts(), "run-1");
  await expect(loadCurrentAccountFactsFromMirror(asDb([{ ...row, sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/i);
});
