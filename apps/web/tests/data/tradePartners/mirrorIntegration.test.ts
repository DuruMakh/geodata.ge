import { readFile, readdir } from "node:fs/promises";
import Decimal from "decimal.js";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { assertTradePartnersParity, loadTradePartnersData } from "../../../lib/data/tradePartners/importTradePartners";
import { loadTradePartnersDataFromMirror, tradePartnerEntityMirrorCreateRows, tradePartnerFactMirrorCreateRows, type MirrorClient } from "../../../lib/db/mirrorRows";
import { TRADE_PARTNER_DOCUMENT_IDS } from "../../../lib/data/tradePartners/types";

test("the complete accepted package survives database mappings and rejects a missing row", async () => {
  const csv = await loadTradePartnersData();
  const entities = tradePartnerEntityMirrorCreateRows(csv.entities, "run-1");
  const facts = tradePartnerFactMirrorCreateRows(csv.facts, "run-1").map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd as string) }));
  const db = { tradePartnerEntity: { findMany: async () => entities }, tradePartnerFact: { findMany: async () => facts } } as unknown as MirrorClient;
  expect(() => assertTradePartnersParity(csv, { entities: csv.entities, facts: csv.facts })).not.toThrow();
  assertTradePartnersParity(csv, await loadTradePartnersDataFromMirror(db));
  facts.pop();
  await expect(loadTradePartnersDataFromMirror(db).then(mirror => assertTradePartnersParity(csv, mirror))).rejects.toThrow(/does not match|parity/i);
});

test.skipIf(!process.env.TRADE_PARTNERS_TEST_DATABASE_URL)("disposable PostgreSQL verifies migration, rollback and private-role restrictions", async () => {
  const connectionString = process.env.TRADE_PARTNERS_TEST_DATABASE_URL!, url = new URL(connectionString);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !url.pathname.startsWith("/trade_partners_test")) throw new Error("Trade partner integration requires an explicitly named local disposable test database");
  const pool = new Pool({ connectionString, max: 1 }), client = await pool.connect();
  try {
    await client.query("BEGIN");
    const schema = `trade_partners_test_${Date.now()}`;
    await client.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}", public`);
    await client.query('CREATE TABLE "ImportRun" (id TEXT PRIMARY KEY); CREATE TABLE "SourceDocument" (id TEXT PRIMARY KEY)');
    await client.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END $$");
    const name = (await readdir("prisma/migrations")).find(value => value.endsWith("_trade_partners"))!;
    await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    await client.query('INSERT INTO "ImportRun" VALUES ($1)', ["run-test"]);
    for (const id of Object.values(TRADE_PARTNER_DOCUMENT_IDS)) await client.query('INSERT INTO "SourceDocument" VALUES ($1)', [id]);
    const csv = await loadTradePartnersData();
    await client.query('INSERT INTO "TradePartnerEntity" SELECT * FROM jsonb_populate_recordset(NULL::"TradePartnerEntity", $1::jsonb)', [JSON.stringify(tradePartnerEntityMirrorCreateRows(csv.entities, "run-test"))]);
    await client.query('INSERT INTO "TradePartnerFact" SELECT * FROM jsonb_populate_recordset(NULL::"TradePartnerFact", $1::jsonb)', [JSON.stringify(tradePartnerFactMirrorCreateRows(csv.facts, "run-test"))]);
    const db = {
      tradePartnerEntity: { findMany: async () => (await client.query('SELECT * FROM "TradePartnerEntity" ORDER BY id')).rows },
      tradePartnerFact: { findMany: async () => (await client.query('SELECT * FROM "TradePartnerFact" ORDER BY "entityId", year, "indicatorId"')).rows.map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd) })) },
    } as unknown as MirrorClient;
    assertTradePartnersParity(csv, await loadTradePartnersDataFromMirror(db));
    await client.query("SAVEPOINT parity_failure");
    await client.query('DELETE FROM "TradePartnerFact" WHERE "entityId" = $1 AND year = 2025', ["partner.1995-2025.643"]);
    await expect(loadTradePartnersDataFromMirror(db).then(mirror => assertTradePartnersParity(csv, mirror))).rejects.toThrow(/does not match|parity/i);
    await client.query("ROLLBACK TO SAVEPOINT parity_failure");
    assertTradePartnersParity(csv, await loadTradePartnersDataFromMirror(db));
    const restrictions = await client.query("SELECT relrowsecurity, has_table_privilege('anon', oid, 'SELECT') AS anon_select, has_table_privilege('authenticated', oid, 'SELECT') AS authenticated_select FROM pg_class WHERE relnamespace = $1::regnamespace AND relname IN ('TradePartnerEntity', 'TradePartnerFact')", [schema]);
    expect(restrictions.rows).toHaveLength(2);
    for (const row of restrictions.rows) expect(row).toEqual({ relrowsecurity: true, anon_select: false, authenticated_select: false });
  } finally {
    await client.query("ROLLBACK"); client.release(); await pool.end();
  }
}, 60_000);
