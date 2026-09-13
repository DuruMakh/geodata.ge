import fs from "node:fs/promises";
import { expect, test } from "vitest";

test("sector schema keeps exact decimals, compound keys and private access", async () => {
  const schema = await fs.readFile("prisma/schema.prisma", "utf8");
  expect(schema).toContain("model EconomicSectorFact");
  expect(schema).toMatch(/@@id\(\[seriesId, measure, year\]\)/);
  const migration = await fs.readFile("prisma/migrations/20260912000000_economic_sectors/migration.sql", "utf8");
  expect(migration).toContain('ALTER TABLE "EconomicSectorFact" ENABLE ROW LEVEL SECURITY');
  expect(migration).toContain('REVOKE ALL ON TABLE "EconomicSectorFact" FROM anon, authenticated');
  expect(migration).toContain("DECIMAL(40,20)");
});
test("sector import verifies mirror through the serving mapper inside the transaction", async () => {
  const code = await fs.readFile("scripts/import-budget-facts.ts", "utf8");
  expect(code).toContain("loadEconomicSectorFactsFromMirror(tx)");
  expect(code).toContain("assertEconomicSectorParity(economicSectorFacts, mirrorEconomicSectorFacts)");
  expect(code.indexOf("tx.economicSectorFact.deleteMany()")).toBeLessThan(code.indexOf("tx.sourceDocument.deleteMany()"));
  expect(code).toContain('table: "EconomicSectorFact"');
});
