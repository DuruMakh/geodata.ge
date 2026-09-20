import fs from "node:fs/promises";
import { expect, test } from "vitest";

test("regional economy schema keeps exact decimals, compound keys and private access", async () => {
  const schema = await fs.readFile("prisma/schema.prisma", "utf8");
  expect(schema).toContain("model RegionalEconomyFact");
  expect(schema).toMatch(/@@id\(\[regionId, seriesId, measure, year\]\)/);

  const migration = await fs.readFile(
    "prisma/migrations/20260913000000_regional_economies/migration.sql",
    "utf8",
  );
  expect(migration).toContain('ALTER TABLE "RegionalEconomyFact" ENABLE ROW LEVEL SECURITY');
  expect(migration).toContain('REVOKE ALL ON TABLE "RegionalEconomyFact" FROM anon, authenticated');
  expect(migration).toContain("DECIMAL(40,20)");
});

test("regional import verifies its serving mapper before committing", async () => {
  const code = await fs.readFile("scripts/import-budget-facts.ts", "utf8");
  expect(code).toContain("loadRegionalEconomyFactsFromMirror(tx)");
  expect(code).toContain("assertRegionalEconomyParity(regionalEconomyFacts, mirrorRegionalEconomyFacts)");
  expect(code.indexOf("tx.regionalEconomyFact.deleteMany()"))
    .toBeLessThan(code.indexOf("tx.sourceDocument.deleteMany()"));
  expect(code).toContain('table: "RegionalEconomyFact"');
});
