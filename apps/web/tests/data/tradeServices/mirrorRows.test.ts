import Decimal from "decimal.js";
import { readFile, readdir } from "node:fs/promises";
import { afterEach, expect, test, vi } from "vitest";
import { loadTradeServicesData, assertTradeServicesParity } from "../../../lib/data/tradeServices/importTradeServices";
import { TRADE_SERVICES_DOCUMENT_IDS, type TradeServiceEntity, type TradeServiceFact } from "../../../lib/data/tradeServices/types";
import { tradeServiceEntityMirrorCreateRows, tradeServiceFactMirrorCreateRows, loadTradeServicesDataFromMirror } from "../../../lib/db/mirrorRows";

async function fixture() {
  const csv = await loadTradeServicesData();
  const entities = tradeServiceEntityMirrorCreateRows(csv.entities, "services-run");
  const facts = tradeServiceFactMirrorCreateRows(csv.facts, "services-run").map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd as string) }));
  const db = { tradeServiceEntity: { findMany: async () => entities }, tradeServiceFact: { findMany: async () => facts } } as unknown as Parameters<typeof loadTradeServicesDataFromMirror>[0];
  return { csv, entities, facts, db };
}

test("round-trips all accepted identities, values, nulls, native dash and source metadata", async () => {
  const { csv, entities, facts, db } = await fixture();
  expect(entities).toHaveLength(13); expect(facts).toHaveLength(258);
  const mirror = await loadTradeServicesDataFromMirror(db);
  assertTradeServicesParity(csv, mirror);
  expect(mirror.entities).toEqual(csv.entities);
  for (const [index, fact] of mirror.facts.entries()) expect(fact).toEqual({ ...csv.facts[index], valueUsd: csv.facts[index].valueUsd === null ? null : new Decimal(csv.facts[index].valueUsd!).toFixed() });
  expect(mirror.facts.filter(f => f.role === "derived")).toHaveLength(128);
  expect(mirror.facts.find(f => f.valueStatus === "not_applicable")).toMatchObject({ entityId: "services.maintenance_repair", year: 2020, indicatorId: "trade.exports", valueUsd: null, sourceValue: "-" });
  expect(mirror.facts.some(f => new Decimal(f.valueUsd ?? 0).isNegative())).toBe(true);
  expect(entities.every(row => row.importRunId === "services-run")).toBe(true);
  for (const row of facts) {
    expect(row.importRunId).toBe("services-run");
    expect(row.sourceDocumentId).toBe(row.role === "derived" ? null : TRADE_SERVICES_DOCUMENT_IDS[row.sourceId!]);
  }
});

const factChanges: { [K in keyof TradeServiceFact]: TradeServiceFact[K] } = {
  entityId: "services.changed", year: 2019, indicatorId: "trade.balance", valueUsd: "0.00000000000000000001", unit: "changed" as "usd", basis: "planned" as "actual", valueStatus: "not_applicable", publicationStatus: "changed" as "unspecified", role: "derived", sourceId: "source.changed", sourceRefs: "[]", sourceValue: "changed", sourceUnit: "changed", sourceLabel: "changed", sourceNumberFormat: "changed", sourceBlock: "changed", lastReviewedAt: "2026-10-10",
};
test.each(Object.keys(factChanges) as (keyof TradeServiceFact)[])("rejects changed protected fact field %s", async field => {
  const { csv, db } = await fixture();
  const mirror = await loadTradeServicesDataFromMirror(db);
  const index = mirror.facts.findIndex(fact => fact.role !== "derived");
  mirror.facts[index] = { ...mirror.facts[index], [field]: factChanges[field] };
  expect(() => assertTradeServicesParity(csv, mirror)).toThrow(/parity|does not match/i);
});

test.each(["id", "kind", "labelKa", "labelEn"] as (keyof TradeServiceEntity)[])("rejects changed protected catalogue field %s", async field => {
  const { csv, db } = await fixture();
  const mirror = await loadTradeServicesDataFromMirror(db);
  mirror.entities[0] = { ...mirror.entities[0], [field]: "changed" };
  expect(() => assertTradeServicesParity(csv, mirror)).toThrow(/parity|does not match/i);
});

test("keeps all twenty decimal places without monetary rounding", async () => {
  const { csv, db, facts } = await fixture();
  csv.facts[0].valueUsd = "100.00000000000000000001";
  facts[0].valueUsd = new Decimal(csv.facts[0].valueUsd);
  const mirror = await loadTradeServicesDataFromMirror(db);
  expect(mirror.facts[0].valueUsd).toBe(csv.facts[0].valueUsd);
  assertTradeServicesParity(csv, mirror);
});

test("preserves a published numeric zero independently of the native dash", async () => {
  const { csv, db, facts } = await fixture();
  const index = csv.facts.findIndex(fact => fact.role !== "derived" && fact.valueUsd !== null);
  csv.facts[index] = { ...csv.facts[index], valueUsd: "0", sourceValue: "0" };
  facts[index] = { ...facts[index], valueUsd: new Decimal(0), sourceValue: "0" };
  const mirror = await loadTradeServicesDataFromMirror(db);
  expect(mirror.facts[index]).toMatchObject({ valueUsd: "0", valueStatus: "numeric", sourceValue: "0" });
  assertTradeServicesParity(csv, mirror);
});

test("rejects a native fact bound to another document or source reference", async () => {
  const { facts, db } = await fixture();
  const native = facts.find(f => f.role !== "derived")!;
  const original = native.sourceDocumentId;
  native.sourceDocumentId = "source.other";
  await expect(loadTradeServicesDataFromMirror(db)).rejects.toThrow(/source relation/i);
  native.sourceDocumentId = original;
  native.sourceRefs = "[]";
  await expect(loadTradeServicesDataFromMirror(db)).rejects.toThrow(/source relation/i);
});

test("rejects a changed derivation counterpart and an omitted observation", async () => {
  const { csv, facts, db } = await fixture();
  const derived = facts.find(f => f.role === "derived")!;
  const original = derived.sourceRefs;
  derived.sourceRefs = JSON.stringify(JSON.parse(original).reverse());
  await expect(loadTradeServicesDataFromMirror(db).then(mirror => assertTradeServicesParity(csv, mirror))).rejects.toThrow(/parity|does not match/i);
  derived.sourceRefs = original;
  facts.pop();
  await expect(loadTradeServicesDataFromMirror(db).then(mirror => assertTradeServicesParity(csv, mirror))).rejects.toThrow(/parity|does not match/i);
});

test("the existing importer checks complete Services parity inside its transaction and reports both tables", async () => {
  const script = await readFile("scripts/import-budget-facts.ts", "utf8");
  const transactionStart = script.indexOf("await prisma.$transaction(");
  const parity = script.indexOf("assertTradeServicesParity(tradeServices, mirrorTradeServices)");
  expect(transactionStart).toBeGreaterThan(-1);
  expect(parity).toBeGreaterThan(transactionStart);
  expect(parity).toBeLessThan(script.indexOf("return { importRunId: run.id"));
  expect(script).toContain("loadTradeServicesDataFromMirror(tx)");
  expect(script.indexOf("tx.tradeServiceFact.deleteMany()")).toBeLessThan(script.indexOf("tx.tradeServiceEntity.deleteMany()"));
  expect(script.indexOf("tx.tradeServiceEntity.deleteMany()")).toBeLessThan(script.indexOf("tx.sourceDocument.deleteMany()"));
  expect(script.indexOf("tx.tradeServiceEntity.createMany(")).toBeLessThan(script.indexOf("tx.tradeServiceFact.createMany("));
  expect(script).toContain('table: "TradeServiceEntity"'); expect(script).toContain('table: "TradeServiceFact"');
  expect(script).toContain('assertSubset("Services source IDs", Object.values(TRADE_SERVICES_DOCUMENT_IDS), sourceIds)');
});

test("a mocked transaction rejects mismatched Services data before its commit boundary", async () => {
  const { csv, db, facts } = await fixture();
  const previous = { importRunId: "previous-run", facts: csv.facts };
  let committed = previous;
  const transaction = async (callback: () => Promise<typeof previous>) => { const pending = await callback(); committed = pending; };
  facts.pop();
  await expect(transaction(async () => {
    const mirror = await loadTradeServicesDataFromMirror(db);
    assertTradeServicesParity(csv, mirror);
    return { importRunId: "services-run", facts: mirror.facts };
  })).rejects.toThrow(/parity|does not match/i);
  expect(committed).toBe(previous);
});

test("the generated migration adds only private Services tables with exact nullable decimals", async () => {
  const directory = (await readdir("prisma/migrations")).find(name => name.endsWith("_trade_services"));
  expect(directory).toBeDefined();
  const sql = await readFile(`prisma/migrations/${directory}/migration.sql`, "utf8");
  expect(sql.match(/CREATE TABLE /g)).toHaveLength(2);
  expect(sql).toContain('"valueUsd" DECIMAL(40,20),');
  expect(sql).toContain('PRIMARY KEY ("entityId","indicatorId","year")');
  for (const table of ["TradeServiceEntity", "TradeServiceFact"]) {
    expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    expect(sql).toContain(`REVOKE ALL ON TABLE "${table}" FROM PUBLIC, anon, authenticated`);
  }
  expect(sql).not.toMatch(/CREATE POLICY|DROP TABLE|ALTER TABLE "(?!TradeService)/);
});

afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("../../../lib/db/servedDataDb"); });
test("CSV serving caches acceptance-checked data and leaves the database unloaded", async () => {
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  const dbLoad = vi.fn(); vi.doMock("../../../lib/db/servedDataDb", () => ({ loadTradeServicesDataFromDb: dbLoad }));
  const { loadServedTradeServicesData } = await import("../../../lib/data/tradeServices/importTradeServices");
  const first = loadServedTradeServicesData();
  expect(loadServedTradeServicesData()).toBe(first);
  expect((await first).facts).toHaveLength(258);
  expect(dbLoad).not.toHaveBeenCalled();
});
test.each([false, true])("DB serving verifies complete accepted parity (mismatch=%s)", async mismatch => {
  const { csv } = await fixture();
  if (mismatch) csv.facts[0].sourceLabel = "changed";
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  const dbLoad = vi.fn(async () => csv); vi.doMock("../../../lib/db/servedDataDb", () => ({ loadTradeServicesDataFromDb: dbLoad }));
  const { loadServedTradeServicesData } = await import("../../../lib/data/tradeServices/importTradeServices");
  if (mismatch) await expect(loadServedTradeServicesData()).rejects.toThrow(/parity|does not match/i);
  else expect(await loadServedTradeServicesData()).toBe(csv);
  expect(dbLoad).toHaveBeenCalledOnce();
});
