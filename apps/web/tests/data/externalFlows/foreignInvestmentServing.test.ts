import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { foreignInvestmentEntities, foreignInvestmentFacts } from "./fixtures";

vi.mock("node:fs/promises", async importOriginal => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, readFile: vi.fn(original.readFile) };
});
const loader = () => import("../../../lib/data/externalFlows/importForeignInvestment");
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation(original.readFile);
});
afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("../../../lib/db/servedDataDb"); });

test("serves every reviewed entity and fact with a null-preserving thin client payload", async () => {
  const { loadForeignInvestmentData, toClientForeignInvestmentData } = await loader();
  const data = await loadForeignInvestmentData();
  expect(data.entities).toHaveLength(107); expect(data.facts).toHaveLength(2707);
  expect(data.entities[0].id).toBe("fdi.total");
  const client = toClientForeignInvestmentData({ entities: foreignInvestmentEntities(), facts: foreignInvestmentFacts() });
  expect(client.facts.find(f => f.entityId === "fdi.region.guria" && f.year === 2015)?.valueUsd).toBeNull();
  expect(client.facts.find(f => f.entityId === "fdi.country.m49_826")?.valueUsd).toBe(-120.5);
  expect(client.facts[0]).not.toHaveProperty("sourceCells");
  expect(client.facts[0]).not.toHaveProperty("sourceSheet");
});

test.each(["foreign-investment-annual.csv", "foreign-investment.json", "labels.json", "foreign-investment-validation.json"])("rejects a stale %s fingerprint", async filename => {
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation((async (...args: Parameters<typeof readFile>) => {
    const result = await original.readFile(...args);
    if (!String(args[0]).endsWith(filename)) return result;
    let text = result.toString();
    if (filename.endsWith(".csv")) text = text.replace(",usd,", ",usd,9");
    else if (filename === "foreign-investment.json") text = text.replace('"იტალია"', '"შეცვლილი"');
    else if (filename === "labels.json") { const labels = JSON.parse(text); labels["fdi.country.m49_380"].text = "Altered label"; text = JSON.stringify(labels); }
    else { const report = JSON.parse(text); report.status = "requires_review"; text = JSON.stringify(report); }
    return Buffer.isBuffer(result) ? Buffer.from(text) : text;
  }) as typeof readFile);
  await expect((await loader()).loadForeignInvestmentData()).rejects.toThrow(/fingerprint|acceptance|catalogue/i);
});

test("shared build-time data is cached and db mode rejects incomplete data", async () => {
  const { loadServedForeignInvestmentData: load, loadForeignInvestmentData } = await loader();
  expect(load()).toBe(load()); await load();
  const csv = await loadForeignInvestmentData();
  vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  vi.doMock("../../../lib/db/servedDataDb", () => ({ loadForeignInvestmentDataFromDb: async () => ({ entities: csv.entities, facts: csv.facts.slice(1) }) }));
  vi.resetModules();
  await expect((await loader()).loadServedForeignInvestmentData()).rejects.toThrow(/does not match|parity/i);
});

test("parity compares the entire catalogue and exact values regardless of row order", async () => {
  const { assertForeignInvestmentParity } = await loader();
  const csv = { entities: foreignInvestmentEntities(), facts: foreignInvestmentFacts() };
  expect(() => assertForeignInvestmentParity(csv, { entities: [...csv.entities].reverse(), facts: [...csv.facts].reverse() })).not.toThrow();
  for (const change of [
    { ...csv, entities: csv.entities.map((e, i) => i ? e : { ...e, labelKa: "შეცვლილი" }) },
    { ...csv, facts: csv.facts.map((f, i) => i ? f : { ...f, valueUsd: "1000.00000000000000000001" }) },
    { ...csv, facts: csv.facts.map(f => f.valueUsd === null ? { ...f, valueUsd: "0" } : f) },
    { ...csv, facts: csv.facts.slice(1) },
  ]) expect(() => assertForeignInvestmentParity(csv, change)).toThrow(/does not match|parity/i);
});

test("database mode keeps the reviewed catalogue order, so the total stays first", async () => {
  const csv = await (await loader()).loadForeignInvestmentData();
  vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  vi.doMock("../../../lib/db/servedDataDb", () => ({ loadForeignInvestmentDataFromDb: async () => ({ entities: [...csv.entities].sort((a, b) => a.id.localeCompare(b.id, "en")), facts: csv.facts }) }));
  vi.resetModules();
  const served = await (await loader()).loadServedForeignInvestmentData();
  expect(served.entities.map(entity => entity.id)).toEqual(csv.entities.map(entity => entity.id));
});
