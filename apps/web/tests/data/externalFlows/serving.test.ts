import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { moneyTransferEntities, moneyTransferFacts } from "./fixtures";

vi.mock("node:fs/promises", async importOriginal => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, readFile: vi.fn(original.readFile) };
});
const loader = () => import("../../../lib/data/externalFlows/importMoneyTransfers");
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation(original.readFile);
});
afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("../../../lib/db/servedDataDb"); });

test("serves every reviewed entity and fact with a null-preserving thin client payload", async () => {
  const { loadMoneyTransfersData, toClientMoneyTransfersData } = await loader();
  const data = await loadMoneyTransfersData();
  expect(data.entities).toHaveLength(254); expect(data.facts).toHaveLength(9364);
  const client = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() }, { 2019: 10000 });
  expect(client.facts.find(f => f.valueStatus === "blank")?.valueUsd).toBeNull();
  expect(client.facts.find(f => f.valueStatus === "partial_months")).toMatchObject({ valueUsd: 400, monthsReported: 11 });
  expect(client.facts[0]).not.toHaveProperty("sourceCells");
  expect(client.facts[0]).not.toHaveProperty("sourceSheet");
});

test.each(["money-transfers-annual.csv", "money-transfer-countries.json", "labels.json", "money-transfers-validation.json"])("rejects a stale %s fingerprint", async filename => {
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation((async (...args: Parameters<typeof readFile>) => {
    const result = await original.readFile(...args);
    if (!String(args[0]).endsWith(filename)) return result;
    let text = result.toString();
    if (filename.endsWith(".csv")) text = text.replace(",received,", ",received,9");
    else if (filename === "money-transfer-countries.json") text = text.replace('"იტალია"', '"შეცვლილი"');
    else if (filename === "labels.json") { const labels = JSON.parse(text); labels["transfer.italy"].text = "Altered label"; text = JSON.stringify(labels); }
    else { const report = JSON.parse(text); report.status = "requires_review"; text = JSON.stringify(report); }
    return Buffer.isBuffer(result) ? Buffer.from(text) : text;
  }) as typeof readFile);
  await expect((await loader()).loadMoneyTransfersData()).rejects.toThrow(/fingerprint|acceptance|catalogue/i);
});

test("shared build-time data is cached and db mode rejects incomplete data", async () => {
  const { loadServedMoneyTransfersData: load, loadMoneyTransfersData } = await loader();
  expect(load()).toBe(load()); await load();
  const csv = await loadMoneyTransfersData();
  vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  vi.doMock("../../../lib/db/servedDataDb", () => ({ loadMoneyTransfersDataFromDb: async () => ({ entities: csv.entities, facts: csv.facts.slice(1) }) }));
  vi.resetModules();
  await expect((await loader()).loadServedMoneyTransfersData()).rejects.toThrow(/does not match|parity/i);
});

test("parity compares the entire catalogue and exact values regardless of row order", async () => {
  const { assertMoneyTransfersParity } = await loader();
  const csv = { entities: moneyTransferEntities(), facts: moneyTransferFacts() };
  expect(() => assertMoneyTransfersParity(csv, { entities: [...csv.entities].reverse(), facts: [...csv.facts].reverse() })).not.toThrow();
  for (const change of [
    { ...csv, entities: csv.entities.map((e, i) => i ? e : { ...e, labelKa: "შეცვლილი" }) },
    { ...csv, facts: csv.facts.map((f, i) => i ? f : { ...f, valueUsd: "1000.00000000000000000001" }) },
    { ...csv, facts: csv.facts.map(f => f.valueUsd === null ? { ...f, valueUsd: "0" } : f) },
    { ...csv, facts: csv.facts.map(f => f.valueStatus === "partial_months" ? { ...f, monthsReported: 12 } : f) },
    { ...csv, facts: csv.facts.slice(1) },
  ]) expect(() => assertMoneyTransfersParity(csv, change)).toThrow(/does not match|parity/i);
});
