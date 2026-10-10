import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { assertForeignInvestmentParity, loadForeignInvestmentData } from "../../../lib/data/externalFlows/importForeignInvestment";
import type { MirrorClient } from "../../../lib/db/mirrorRows";
import { foreignInvestmentEntities, foreignInvestmentFacts } from "./fixtures";

const mappings = () => import("../../../lib/db/mirrorRows");
const asDb = (entityRows: unknown[], factRows: Record<string, unknown>[]) => ({ foreignInvestmentEntity: { findMany: async () => entityRows }, foreignInvestmentFact: { findMany: async () => factRows.map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd as string) })) } }) as unknown as MirrorClient;

test("mirror mapping round-trips nulls, negative values, references and exact decimals", async () => {
  const { foreignInvestmentEntityMirrorCreateRows, foreignInvestmentFactMirrorCreateRows, loadForeignInvestmentDataFromMirror } = await mappings();
  const entities = foreignInvestmentEntities(), facts = foreignInvestmentFacts();
  facts[0] = { ...facts[0], valueUsd: "1000.00000000000000000001" };
  const entityRows = foreignInvestmentEntityMirrorCreateRows(entities, "fdi-run"), factRows = foreignInvestmentFactMirrorCreateRows(facts, "fdi-run");
  expect(await loadForeignInvestmentDataFromMirror(asDb(entityRows, factRows))).toEqual({ entities, facts });
  expect(entityRows[0].importRunId).toBe("fdi-run");
  expect(factRows.find(row => row.entityId === "fdi.total")?.sourceDocumentId).toBe("source.geostat_fdi_by_quarters");
});

test("mirror rejects a fact linked to a different registered source", async () => {
  const { foreignInvestmentEntityMirrorCreateRows, foreignInvestmentFactMirrorCreateRows, loadForeignInvestmentDataFromMirror } = await mappings();
  const [row] = foreignInvestmentFactMirrorCreateRows(foreignInvestmentFacts(), "fdi-run");
  await expect(loadForeignInvestmentDataFromMirror(asDb(foreignInvestmentEntityMirrorCreateRows(foreignInvestmentEntities(), "fdi-run"), [{ ...row, sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/i);
});

test("the complete accepted package survives database mappings and rejects a missing row", async () => {
  const { foreignInvestmentEntityMirrorCreateRows, foreignInvestmentFactMirrorCreateRows, loadForeignInvestmentDataFromMirror } = await mappings();
  const csv = await loadForeignInvestmentData();
  const factRows = foreignInvestmentFactMirrorCreateRows(csv.facts, "run-1"), db = asDb(foreignInvestmentEntityMirrorCreateRows(csv.entities, "run-1"), factRows);
  assertForeignInvestmentParity(csv, await loadForeignInvestmentDataFromMirror(db));
  factRows.pop();
  await expect(loadForeignInvestmentDataFromMirror(asDb(foreignInvestmentEntityMirrorCreateRows(csv.entities, "run-1"), factRows)).then(mirror => assertForeignInvestmentParity(csv, mirror))).rejects.toThrow(/does not match|parity/i);
});
