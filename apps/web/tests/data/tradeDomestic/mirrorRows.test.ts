import { expect, test } from "vitest";
import { Prisma } from "../../../lib/generated/prisma/client";
import { loadTradeDomesticData, assertTradeDomesticParity } from "../../../lib/data/tradeDomestic/importTradeDomestic";
import { tradeDomesticEntityMirrorCreateRows, tradeDomesticFactMirrorCreateRows, loadTradeDomesticDataFromMirror } from "../../../lib/db/mirrorRows";

test("the private mirror preserves every domestic value, identity and source field", async () => {
  const data = await loadTradeDomesticData();
  const entities = tradeDomesticEntityMirrorCreateRows(data.entities, "test-run");
  const facts = tradeDomesticFactMirrorCreateRows(data.facts, "test-run").map(row => ({ ...row, valueUsd: new Prisma.Decimal(String(row.valueUsd)) }));
  const db = { tradeDomesticEntity: { findMany: async () => entities }, tradeDomesticFact: { findMany: async () => facts } } as unknown as Parameters<typeof loadTradeDomesticDataFromMirror>[0];
  const mirror = await loadTradeDomesticDataFromMirror(db);
  expect(() => assertTradeDomesticParity(data, mirror)).not.toThrow();
  const changed = { ...mirror, facts: mirror.facts.map((fact, index) => index === 0 ? { ...fact, sourceBlock: "incorrect" } : fact) };
  expect(() => assertTradeDomesticParity(data, changed)).toThrow();
  facts[0].sourceDocumentId = "unrelated-source";
  await expect(loadTradeDomesticDataFromMirror(db)).rejects.toThrow(/source relation/i);
});
