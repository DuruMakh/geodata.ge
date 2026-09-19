import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

// Run only against a disposable local database after migrations and data:import.
const connectionString = process.env.GEODATA_TEST_DATABASE_URL;
if (connectionString && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(connectionString).hostname)) {
  throw new Error("Debt migration tests require a disposable local PostgreSQL database");
}

describe.skipIf(!connectionString)("debt mirror source integrity", () => {
  let client: Client;
  beforeAll(async () => { client = new Client({ connectionString }); await client.connect(); });
  afterAll(async () => { await client.end(); });
  beforeEach(async () => { await client.query("BEGIN"); });
  afterEach(async () => { await client.query("ROLLBACK"); });

  it("normalizes the existing source IDs while preserving nullable gaps", async () => {
    const { rows } = await client.query('SELECT "sourceId" FROM "GovernmentDebtFact"');
    expect(rows).toHaveLength(126);
    expect(rows.some(row => row.sourceId === null)).toBe(true);
    expect(rows.every(row => row.sourceId === null || row.sourceId.startsWith("source.mof_"))).toBe(true);
  });

  it("rejects a source outside the registry", async () => {
    await expect(client.query('UPDATE "GovernmentDebtFact" SET "sourceId" = $1 WHERE year = 2013 AND "seriesId" = $2', ["source.mof_unknown", "debt.stock.total"]))
      .rejects.toMatchObject({ code: "23503", constraint: "GovernmentDebtFact_sourceId_fkey" });
  });

  it("allows a missing source on an unavailable rate", async () => {
    const result = await client.query('UPDATE "GovernmentDebtFact" SET "sourceId" = NULL WHERE year = 2015 AND "seriesId" = $1 RETURNING "sourceId"', ["debt.rate.domestic"]);
    expect(result.rows).toEqual([{ sourceId: null }]);
  });

  it("prevents deleting a source still cited by debt facts", async () => {
    await expect(client.query('DELETE FROM "SourceDocument" WHERE id = $1', ["source.mof_public_debt_bulletin_n25"]))
      .rejects.toMatchObject({ code: "23503", constraint: "GovernmentDebtFact_sourceId_fkey" });
  });
});
