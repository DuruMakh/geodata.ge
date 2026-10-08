import fs from "node:fs/promises";
import { expect, test } from "vitest";

test("demography schema keeps exact decimals, a seven-part key and private access", async () => {
  const schema = await fs.readFile("prisma/schema.prisma", "utf8");
  expect(schema).toContain("model DemographyFact");
  expect(schema).toMatch(/@@id\(\[seriesId, geographyId, year, sex, ageGroup, citizenshipId, settlement\]\)/);

  const migration = await fs.readFile("prisma/migrations/20261008100000_demography/migration.sql", "utf8");
  expect(migration).toContain('ALTER TABLE "DemographyFact" ENABLE ROW LEVEL SECURITY');
  expect(migration).toContain('REVOKE ALL ON TABLE "DemographyFact" FROM anon, authenticated');
  expect(migration).toContain("DECIMAL(40,20)");
  expect(migration).toContain('PRIMARY KEY ("seriesId", "geographyId", "year", "sex", "ageGroup", "citizenshipId", "settlement")');
});
