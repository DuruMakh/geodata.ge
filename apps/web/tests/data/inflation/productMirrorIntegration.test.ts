import fs from "node:fs/promises";
import { expect, test } from "vitest";

test("product mirror keeps source precision, identity keys and private access", async () => {
  const schema = await fs.readFile("prisma/schema.prisma", "utf8");
  expect(schema).toContain("model InflationProduct");
  expect(schema).toContain("model InflationProductFact");
  expect(schema).toContain("index100         Decimal?       @db.Decimal(12, 4)");
  expect(schema).toMatch(/@@id\(\[productId, measure, period\]\)/);
  const migration = await fs.readFile("prisma/migrations/20260928000000_inflation_products/migration.sql", "utf8");
  for (const table of ["InflationProduct", "InflationProductFact"]) {
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    expect(migration).toContain(`REVOKE ALL ON TABLE "${table}" FROM anon, authenticated`);
  }
  expect(migration).toContain("DECIMAL(12,4)");
});

test("product import reads back every fact before committing", async () => {
  const code = await fs.readFile("scripts/import-budget-facts.ts", "utf8");
  expect(code).toContain("loadProductFactsFromMirror(tx)");
  expect(code).toContain("assertProductParity(productData, mirrorProducts)");
  expect(code.indexOf("tx.inflationProductFact.deleteMany()"))
    .toBeLessThan(code.indexOf("tx.inflationProduct.deleteMany()"));
  expect(code.indexOf("tx.inflationProductFact.deleteMany()"))
    .toBeLessThan(code.indexOf("tx.sourceDocument.deleteMany()"));
  expect(code).toContain('table: "InflationProductFact"');
});
