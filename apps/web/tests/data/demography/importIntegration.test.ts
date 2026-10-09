import fs from "node:fs/promises";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from "vitest";

test("demography import verifies its serving mapper before committing", async () => {
  const code = await fs.readFile("scripts/import-budget-facts.ts", "utf8");
  expect(code).toContain("loadDemographyFactsFromMirror(tx)");
  expect(code).toContain("assertDemographyParity(demographyFacts, mirrorDemographyFacts)");
  expect(code).toContain("tx.demographyFact.deleteMany()");
  expect(code.indexOf("tx.demographyFact.deleteMany()")).toBeLessThan(code.indexOf("tx.sourceDocument.deleteMany()"));
  expect(code).toContain('table: "DemographyFact"');
  expect(code).toContain('assertSubset("Demography source IDs"');
});

// Run only against a disposable local database after migrations and data:import.
const connectionString = process.env.GEODATA_TEST_DATABASE_URL;
if (connectionString && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(connectionString).hostname)) {
  throw new Error("Demography migration tests require a disposable local PostgreSQL database");
}

describe.skipIf(!connectionString)("demography mirror integrity", () => {
  let client: Client;
  beforeAll(async () => { client = new Client({ connectionString }); await client.connect(); });
  afterAll(async () => { await client.end(); });
  beforeEach(async () => { await client.query("BEGIN"); });
  afterEach(async () => { await client.query("ROLLBACK"); });

  it("mirrors the three served files", async () => {
    const { rows } = await client.query('SELECT "seriesId", count(*)::int AS n FROM "DemographyFact" GROUP BY 1 ORDER BY 1');
    expect(rows).toEqual([
      { seriesId: "demography.emigrants", n: 630 },
      { seriesId: "demography.emigrants_by_citizenship_group", n: 252 },
      { seriesId: "demography.immigrants", n: 630 },
      { seriesId: "demography.immigrants_by_citizenship_group", n: 252 },
      { seriesId: "demography.net_migration", n: 14 },
      { seriesId: "demography.population_density", n: 145 },
      { seriesId: "demography.population_total", n: 923 },
    ]);
  });

  it("rejects a source outside the registry", async () => {
    await expect(client.query('UPDATE "DemographyFact" SET "sourceDocumentId" = $1 WHERE "geographyId" = $2 AND year = 2024', ["source.unknown", "country.georgia"]))
      .rejects.toMatchObject({ code: "23503", constraint: "DemographyFact_sourceDocumentId_fkey" });
  });

  it("keeps the table private from both API roles", async () => {
    const relation = 'public."DemographyFact"';
    const grants = await client.query("SELECT role_name, has_table_privilege(role_name, $1, 'SELECT') AS allowed FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name) ORDER BY role_name", [relation]);
    expect(grants.rows).toEqual([{ role_name: "anon", allowed: false }, { role_name: "authenticated", allowed: false }]);
    const rls = await client.query("SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass", [relation]);
    expect(rls.rows).toEqual([{ relrowsecurity: true }]);
  });
});
