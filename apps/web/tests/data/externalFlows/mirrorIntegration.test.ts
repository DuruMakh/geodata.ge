import { readFile, readdir } from "node:fs/promises";
import Decimal from "decimal.js";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { assertMoneyTransfersParity, loadMoneyTransfersData } from "../../../lib/data/externalFlows/importMoneyTransfers";
import { loadMoneyTransfersDataFromMirror, moneyTransferEntityMirrorCreateRows, moneyTransferFactMirrorCreateRows, type MirrorClient } from "../../../lib/db/mirrorRows";
import { MONEY_TRANSFER_SOURCES } from "../../../lib/data/externalFlows/types";

test("the complete accepted package survives database mappings and rejects a missing row", async () => {
  const csv = await loadMoneyTransfersData();
  const entities = moneyTransferEntityMirrorCreateRows(csv.entities, "run-1");
  const facts = moneyTransferFactMirrorCreateRows(csv.facts, "run-1").map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd as string) }));
  const db = { moneyTransferEntity: { findMany: async () => entities }, moneyTransferFact: { findMany: async () => facts } } as unknown as MirrorClient;
  expect(() => assertMoneyTransfersParity(csv, { entities: csv.entities, facts: csv.facts })).not.toThrow();
  assertMoneyTransfersParity(csv, await loadMoneyTransfersDataFromMirror(db));
  facts.pop();
  await expect(loadMoneyTransfersDataFromMirror(db).then(mirror => assertMoneyTransfersParity(csv, mirror))).rejects.toThrow(/does not match|parity/i);
});

test.skipIf(!process.env.MONEY_TRANSFERS_TEST_DATABASE_URL)("disposable PostgreSQL verifies migration, rollback and private-role restrictions", async () => {
  const connectionString = process.env.MONEY_TRANSFERS_TEST_DATABASE_URL!, url = new URL(connectionString);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !url.pathname.startsWith("/money_transfers_test")) throw new Error("Money transfer integration requires an explicitly named local disposable test database");
  const pool = new Pool({ connectionString, max: 1 }), client = await pool.connect();
  try {
    await client.query("BEGIN");
    const schema = `money_transfers_test_${Date.now()}`;
    await client.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}", public`);
    await client.query('CREATE TABLE "ImportRun" (id TEXT PRIMARY KEY); CREATE TABLE "SourceDocument" (id TEXT PRIMARY KEY)');
    await client.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END $$");
    const name = (await readdir("prisma/migrations")).find(value => value.endsWith("_money_transfers"))!;
    await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    await client.query('INSERT INTO "ImportRun" VALUES ($1)', ["run-test"]);
    for (const id of Object.values(MONEY_TRANSFER_SOURCES)) await client.query('INSERT INTO "SourceDocument" VALUES ($1)', [id]);
    const csv = await loadMoneyTransfersData();
    await client.query('INSERT INTO "MoneyTransferEntity" SELECT * FROM jsonb_populate_recordset(NULL::"MoneyTransferEntity", $1::jsonb)', [JSON.stringify(moneyTransferEntityMirrorCreateRows(csv.entities, "run-test"))]);
    await client.query('INSERT INTO "MoneyTransferFact" SELECT * FROM jsonb_populate_recordset(NULL::"MoneyTransferFact", $1::jsonb)', [JSON.stringify(moneyTransferFactMirrorCreateRows(csv.facts, "run-test"))]);
    const db = {
      moneyTransferEntity: { findMany: async () => (await client.query('SELECT * FROM "MoneyTransferEntity" ORDER BY id')).rows },
      moneyTransferFact: { findMany: async () => (await client.query('SELECT * FROM "MoneyTransferFact" ORDER BY "entityId", year, measure')).rows.map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd) })) },
    } as unknown as MirrorClient;
    assertMoneyTransfersParity(csv, await loadMoneyTransfersDataFromMirror(db));
    await client.query("SAVEPOINT parity_failure");
    await client.query('DELETE FROM "MoneyTransferFact" WHERE "entityId" = $1 AND year = 2025', ["transfer.italy"]);
    await expect(loadMoneyTransfersDataFromMirror(db).then(mirror => assertMoneyTransfersParity(csv, mirror))).rejects.toThrow(/does not match|parity/i);
    await client.query("ROLLBACK TO SAVEPOINT parity_failure");
    assertMoneyTransfersParity(csv, await loadMoneyTransfersDataFromMirror(db));
    const restrictions = await client.query("SELECT relrowsecurity, has_table_privilege('anon', oid, 'SELECT') AS anon_select, has_table_privilege('authenticated', oid, 'SELECT') AS authenticated_select FROM pg_class WHERE relnamespace = $1::regnamespace AND relname IN ('MoneyTransferEntity', 'MoneyTransferFact')", [schema]);
    expect(restrictions.rows).toHaveLength(2);
    for (const row of restrictions.rows) expect(row).toEqual({ relrowsecurity: true, anon_select: false, authenticated_select: false });
  } finally {
    await client.query("ROLLBACK"); client.release(); await pool.end();
  }
}, 60_000);
