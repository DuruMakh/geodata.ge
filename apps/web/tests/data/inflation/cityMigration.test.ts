import fs from "node:fs/promises";
import { expect, test } from "vitest";

test("the city inflation table stays private to the service role", async () => {
  const migration = await fs.readFile("prisma/migrations/20260926000000_inflation_cities/migration.sql", "utf8");
  expect(migration).toContain('ALTER TABLE "InflationCityFact" ENABLE ROW LEVEL SECURITY');
  expect(migration).toContain('REVOKE ALL ON TABLE "InflationCityFact" FROM anon, authenticated');
});
