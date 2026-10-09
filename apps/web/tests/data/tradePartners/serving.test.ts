import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { tradePartnerEntities, tradePartnerFacts, tradePartnerNationalFacts } from "./fixtures";

vi.mock("node:fs/promises", async importOriginal => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, readFile: vi.fn(original.readFile) };
});
const loader = () => import("../../../lib/data/tradePartners/importTradePartners");
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation(original.readFile);
});
afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("../../../lib/db/servedDataDb"); });

test("serves all reviewed entities and facts with a null-preserving thin client payload", async () => {
  const { loadTradePartnersData, toClientTradePartnersData } = await loader();
  const data = await loadTradePartnersData();
  expect(data.entities).toHaveLength(217); expect(data.facts).toHaveLength(22992);
  const client = toClientTradePartnersData({ entities: tradePartnerEntities(), facts: tradePartnerFacts() }, tradePartnerNationalFacts());
  expect(client.facts.find(f => f.entityId.endsWith(".530"))?.valueUsd).toBeNull();
  expect(client.facts[0]).not.toHaveProperty("sourceRefs");
  expect(client.facts[0]).not.toHaveProperty("sourceValue");
  expect(client.nationalFacts).toHaveLength(8);
});

test.each(["trade-partners-annual.csv", "trade-partners.json", "labels.json", "trade-partners-validation.json"])("rejects a stale %s fingerprint", async filename => {
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation((async (...args: Parameters<typeof readFile>) => {
    const result = await original.readFile(...args);
    if (!String(args[0]).endsWith(filename)) return result;
    let text = result.toString();
    if (filename.endsWith(".csv")) text = text.replace("749443386.58028818", "749443386.58028819");
    else if (filename === "trade-partners.json") text = text.replace('"sourceCode": "031"', '"sourceCode": "032"');
    else if (filename === "labels.json") { const labels = JSON.parse(text); labels["group.eu"].text = "Altered label"; text = JSON.stringify(labels); }
    else { const report = JSON.parse(text); report.status = "requires_review"; text = JSON.stringify(report); }
    return Buffer.isBuffer(result) ? Buffer.from(text) : text;
  }) as typeof readFile);
  await expect((await loader()).loadTradePartnersData()).rejects.toThrow(/fingerprint|acceptance|catalogue/i);
});

test("shared build-time data is cached and db mode rejects incomplete data", async () => {
  const { loadServedTradePartnersData: load, loadTradePartnersData } = await loader();
  expect(load()).toBe(load()); await load();
  const csv = await loadTradePartnersData();
  vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  vi.doMock("../../../lib/db/servedDataDb", () => ({ loadTradePartnersDataFromDb: async () => ({ entities: csv.entities, facts: csv.facts.slice(1) }) }));
  vi.resetModules();
  await expect((await loader()).loadServedTradePartnersData()).rejects.toThrow(/does not match|parity/i);
});

test("parity compares the entire catalogue and exact values regardless of row order", async () => {
  const { assertTradePartnersParity } = await loader();
  const csv = { entities: tradePartnerEntities(), facts: tradePartnerFacts() };
  expect(() => assertTradePartnersParity(csv, { entities: [...csv.entities].reverse(), facts: [...csv.facts].reverse() })).not.toThrow();
  for (const change of [
    { ...csv, entities: csv.entities.map((e, i) => i ? e : { ...e, labelKa: "შეცვლილი" }) },
    { ...csv, entities: csv.entities.map((e, i) => i ? e : { ...e, sourceCode: "642" }) },
    { ...csv, facts: csv.facts.map((f, i) => i ? f : { ...f, valueUsd: "100.00000000000000000001" }) },
    { ...csv, facts: csv.facts.map(f => f.valueUsd === null ? { ...f, valueUsd: "0" } : f) },
    { ...csv, facts: csv.facts.slice(1) },
  ]) expect(() => assertTradePartnersParity(csv, change)).toThrow(/does not match|parity/i);
});
