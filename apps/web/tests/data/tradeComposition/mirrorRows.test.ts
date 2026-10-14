import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { loadTradeCompositionData, assertTradeCompositionParity } from "../../../lib/data/tradeComposition/importTradeComposition";
import type { TradeCompositionEntity, TradeCompositionFact } from "../../../lib/data/tradeComposition/types";
import { tradeCompositionEntityMirrorCreateRows, tradeCompositionFactMirrorCreateRows, loadTradeCompositionDataFromMirror } from "../../../lib/db/mirrorRows";
import { loadSourceDocuments } from "../../../lib/data/sources";
import { readFile } from "node:fs/promises";

const documentIds: Record<string, string> = {
  "geostat_trade_export-sitc-2000-2026": "source.geostat_trade_export_sitc_2000_2026",
  "geostat_trade_import-sitc-2000-2026": "source.geostat_trade_import_sitc_2000_2026",
  "geostat_trade_export-bec-2000-2026": "source.geostat_trade_export_bec_2000_2026",
  "geostat_trade_import-bec-2000-2026": "source.geostat_trade_import_bec_2000_2026",
};
async function fixture() {
  const csv = await loadTradeCompositionData();
  const entities = tradeCompositionEntityMirrorCreateRows(csv.entities, "composition-run");
  const facts = tradeCompositionFactMirrorCreateRows(csv.facts, "composition-run").map(row => ({ ...row, valueUsd: row.valueUsd === null ? null : new Decimal(row.valueUsd as string) }));
  const db = { tradeCompositionEntity: { findMany: async () => entities }, tradeCompositionFact: { findMany: async () => facts } } as unknown as Parameters<typeof loadTradeCompositionDataFromMirror>[0];
  return { csv, entities, facts, db };
}

test("round-trips exact decimals and every provenance field", async () => {
  const { csv, entities, facts, db } = await fixture();
  expect(entities).toHaveLength(17); expect(facts).toHaveLength(884);
  const mirror = await loadTradeCompositionDataFromMirror(db);
  expect(() => assertTradeCompositionParity(csv, mirror)).not.toThrow();
  expect(mirror.entities).toEqual(csv.entities);
  for (const [index, fact] of mirror.facts.entries()) expect(fact).toEqual({ ...csv.facts[index], valueUsd: new Decimal(csv.facts[index].valueUsd!).toFixed() });
  expect(entities.every(row => row.importRunId === "composition-run")).toBe(true);
  for (const row of facts) {
    expect(row.importRunId).toBe("composition-run");
    expect(row.sourceDocumentId).toBe(documentIds[row.sourceId!]);
  }
});

test("all four composition bindings are a subset of the registered captured sources", async () => {
  const { facts } = await fixture();
  const registered = await loadSourceDocuments("../../data/sources/source-documents.csv");
  const manifest = JSON.parse(await readFile("../../docs/Raw Data/Trade/geostat-external-trade/2026-10-07/full-source-manifest.json", "utf8")) as { source_id: string; dataset_title: string; local_file: string }[];
  expect(new Set(facts.map(row => row.sourceId))).toEqual(new Set(Object.keys(documentIds)));
  for (const [sourceId, documentId] of Object.entries(documentIds)) {
    const source = registered.find(row => row.sourceId === documentId);
    const captured = manifest.find(row => row.source_id === sourceId)!;
    expect(source).toMatchObject({ sourceName: captured.dataset_title, sourceUrlOrFile: `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/${captured.local_file}`, lastReviewedAt: "2026-10-14" });
  }
});

const factChanges: { [K in keyof TradeCompositionFact]: TradeCompositionFact[K] } = {
  entityId: "trade.sitc1.changed", year: 1999, indicatorId: "trade.imports", valueUsd: "0.00000000000000000001", unit: "changed" as "usd", basis: "planned" as "actual", valueStatus: "not_applicable", publicationStatus: "changed" as "unspecified", role: "derived" as "detail", sourceId: "source.changed", sourceRefs: "[]", sourceValue: "changed", sourceUnit: "changed", sourceLabel: "changed", sourceNumberFormat: "changed", sourceBlock: "changed" as "2000-2025", lastReviewedAt: "2026-10-10",
};
test.each(Object.keys(factChanges) as (keyof TradeCompositionFact)[])("rejects changed protected fact field %s", async field => {
  const { csv, db } = await fixture();
  const mirror = await loadTradeCompositionDataFromMirror(db);
  // Pick exports so changing the indicator to imports always changes the field.
  const index = mirror.facts.findIndex(f => f.indicatorId === "trade.exports");
  mirror.facts[index] = { ...mirror.facts[index], [field]: factChanges[field] };
  expect(() => assertTradeCompositionParity(csv, mirror)).toThrow(/parity|does not match/i);
});

test.each(["id", "classification", "sourceCode", "labelKa", "labelEn"] as (keyof TradeCompositionEntity)[])("rejects changed protected catalogue field %s", async field => {
  const { csv, db } = await fixture();
  const mirror = await loadTradeCompositionDataFromMirror(db);
  mirror.entities[0] = { ...mirror.entities[0], [field]: "changed" };
  expect(() => assertTradeCompositionParity(csv, mirror)).toThrow(/parity|does not match/i);
});

test.each(["facts", "entities"] as const)("rejects omitted and duplicate %s rows", async table => {
  const { csv, db } = await fixture();
  const mirror = await loadTradeCompositionDataFromMirror(db);
  const rows = mirror[table];
  rows.pop();
  expect(() => assertTradeCompositionParity(csv, mirror)).toThrow();
  rows.push(rows[0] as never);
  expect(() => assertTradeCompositionParity(csv, mirror)).toThrow();
});

test.each(["100.00000000000000000001", "0", "-12.34567890123456789012", null])("preserves exact decimal, zero, negative or missing value %s", async value => {
  const { csv, facts, db } = await fixture();
  csv.facts[0].valueUsd = value;
  facts[0].valueUsd = value === null ? null : new Decimal(value);
  const mirror = await loadTradeCompositionDataFromMirror(db);
  expect(mirror.facts[0].valueUsd).toBe(value);
  assertTradeCompositionParity(csv, mirror);
});

test("rejects wrong source bindings and reference identities", async () => {
  const { facts, db } = await fixture();
  const row = facts[0], original = row.sourceDocumentId;
  row.sourceDocumentId = "source.other";
  await expect(loadTradeCompositionDataFromMirror(db)).rejects.toThrow(/source relation/i);
  row.sourceDocumentId = original;
  row.sourceRefs = "[]";
  await expect(loadTradeCompositionDataFromMirror(db)).rejects.toThrow(/source relation/i);
});
