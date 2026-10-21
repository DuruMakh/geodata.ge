import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from "vitest";
import { SERVED_DATA_FILES } from "../../../lib/data/servedData";

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

  it("mirrors the served files", async () => {
    const { rows } = await client.query<{ seriesId: string; n: number }>('SELECT "seriesId", count(*)::int AS n FROM "DemographyFact" GROUP BY 1');
    // Every served demography file's rows, counted by series, so a new demography page needs no edit here.
    const counts = new Map<string, number>();
    for (const [key, file] of Object.entries(SERVED_DATA_FILES)) {
      if (!key.startsWith("demography")) continue;
      for (const row of parse(await fs.readFile(file), { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[]) {
        if (row.series_id) counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
      }
    }
    const bySeries = (a: { seriesId: string }, b: { seriesId: string }) => (a.seriesId < b.seriesId ? -1 : 1);
    expect([...rows].sort(bySeries)).toEqual([...counts].map(([seriesId, n]) => ({ seriesId, n })).sort(bySeries));
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
