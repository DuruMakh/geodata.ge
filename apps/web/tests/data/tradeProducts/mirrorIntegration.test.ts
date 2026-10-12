import Decimal from "decimal.js";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { loadTradeProductsData, assertTradeProductsParity } from "../../../lib/data/tradeProducts/importTradeProducts";
import { loadTradeProductsDataFromMirror, tradeProductEntityMirrorCreateRows, tradeProductFactMirrorCreateRows, type MirrorClient } from "../../../lib/db/mirrorRows";
import { TRADE_PRODUCT_DOCUMENT_IDS } from "../../../lib/data/tradeProducts/types";

test("the complete accepted product package survives mappings and rejects an omitted observation", async () => {
  const csv = await loadTradeProductsData();
  const entities = tradeProductEntityMirrorCreateRows(csv.entities, "run-test");
  const facts = tradeProductFactMirrorCreateRows(csv.facts, "run-test").map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd as string) }));
  const db = { tradeProductEntity: { findMany: async () => entities }, tradeProductFact: { findMany: async () => facts } } as unknown as MirrorClient;
  expect(entities).toHaveLength(4768); expect(facts).toHaveLength(69624);
  assertTradeProductsParity(csv, await loadTradeProductsDataFromMirror(db));
  facts.pop();
  await expect(loadTradeProductsDataFromMirror(db).then(mirror => assertTradeProductsParity(csv, mirror))).rejects.toThrow(/parity|does not match/i);
}, 30_000);

test.skipIf(!process.env.TRADE_PRODUCTS_TEST_DATABASE_URL)("disposable PostgreSQL verifies Products migration, rollback and private roles", async () => {
  const connectionString = process.env.TRADE_PRODUCTS_TEST_DATABASE_URL!, url = new URL(connectionString);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !url.pathname.startsWith("/trade_products_test")) throw new Error("Trade Products integration requires an explicitly named local disposable test database");
  const pool = new Pool({ connectionString, max: 1 }), client = await pool.connect();
  try {
    await client.query("BEGIN");
    const schema = `trade_products_test_${Date.now()}`;
    await client.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}", public`);
    await client.query('CREATE TABLE "ImportRun" (id TEXT PRIMARY KEY); CREATE TABLE "SourceDocument" (id TEXT PRIMARY KEY)');
    await client.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END $$");
    const name = (await readdir("prisma/migrations")).find(name => name.endsWith("_trade_products"))!;
    await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    await client.query('INSERT INTO "ImportRun" VALUES ($1)', ["run-test"]);
    for (const id of Object.values(TRADE_PRODUCT_DOCUMENT_IDS)) await client.query('INSERT INTO "SourceDocument" VALUES ($1)', [id]);
    const csv = await loadTradeProductsData();
    await client.query('INSERT INTO "TradeProductEntity" SELECT * FROM jsonb_populate_recordset(NULL::"TradeProductEntity", $1::jsonb)', [JSON.stringify(tradeProductEntityMirrorCreateRows(csv.entities, "run-test"))]);
    await client.query('INSERT INTO "TradeProductFact" SELECT * FROM jsonb_populate_recordset(NULL::"TradeProductFact", $1::jsonb)', [JSON.stringify(tradeProductFactMirrorCreateRows(csv.facts, "run-test"))]);
    const db = {
      tradeProductEntity: { findMany: async () => (await client.query('SELECT * FROM "TradeProductEntity" ORDER BY id')).rows },
      tradeProductFact: { findMany: async () => (await client.query('SELECT *, "lastReviewedAt"::text AS "reviewDate" FROM "TradeProductFact" ORDER BY "entityId", year, "indicatorId"')).rows.map(row => ({ ...row, lastReviewedAt: new Date(`${row.reviewDate}T00:00:00.000Z`), valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd) })) },
    } as unknown as MirrorClient;
    assertTradeProductsParity(csv, await loadTradeProductsDataFromMirror(db));
    await client.query("SAVEPOINT parity_failure");
    await client.query('DELETE FROM "TradeProductFact" WHERE "entityId" = $1', [csv.entities[0].id]);
    await expect(loadTradeProductsDataFromMirror(db).then(mirror => assertTradeProductsParity(csv, mirror))).rejects.toThrow(/parity|does not match/i);
    await client.query("ROLLBACK TO SAVEPOINT parity_failure");
    assertTradeProductsParity(csv, await loadTradeProductsDataFromMirror(db));
    const restrictions = await client.query("SELECT relrowsecurity, has_table_privilege('anon', oid, 'SELECT') AS anon_select, has_table_privilege('authenticated', oid, 'SELECT') AS authenticated_select FROM pg_class WHERE relnamespace = $1::regnamespace AND relname IN ('TradeProductEntity', 'TradeProductFact')", [schema]);
    expect(restrictions.rows).toHaveLength(2);
    for (const row of restrictions.rows) expect(row).toEqual({ relrowsecurity: true, anon_select: false, authenticated_select: false });
  } finally {
    await client.query("ROLLBACK"); client.release(); await pool.end();
  }
}, 120_000);
