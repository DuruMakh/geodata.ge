import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { tradeProductEntities, tradeProductFacts, tradeProductNationalFacts } from "./fixtures";

vi.mock("node:fs/promises", async importOriginal => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, readFile: vi.fn(original.readFile) };
});
const loader = () => import("../../../lib/data/tradeProducts/importTradeProducts");
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation(original.readFile);
});
afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("../../../lib/db/servedDataDb"); });

test("loads the complete accepted package and exposes null-preserving indexed client facts", async () => {
  const { loadTradeProductsData, toClientTradeProductsData } = await loader();
  const data = await loadTradeProductsData();
  expect(data.entities).toHaveLength(4768); expect(data.facts).toHaveLength(69624);
  const client = toClientTradeProductsData({ entities: tradeProductEntities(), facts: tradeProductFacts() }, tradeProductNationalFacts(), "a".repeat(64));
  expect(client.entities[0].id).toBe("goods.hs4.2015-2019.8703");
  expect(client.facts[0]).toEqual([0, 2019, 0, 100]);
  expect(client.facts.some(fact => fact[3] === null)).toBe(true);
  expect(client.facts.every(fact => fact.length === 4)).toBe(true);
  expect(client.years).toEqual([2019, 2024, 2025]);
  expect(client.catalogueFingerprint).toBe("a".repeat(64));
}, 30_000);

test("client trade values are whole dollars", async () => {
  const { loadTradeProductsData, toClientTradeProductsData } = await loader();
  const { loadTradeOverviewFacts } = await import("../../../lib/data/tradeOverview/importTradeOverview");
  const [data, national] = await Promise.all([loadTradeProductsData(), loadTradeOverviewFacts()]);
  const client = toClientTradeProductsData(data, national, "a".repeat(64));
  // Each value moves by less than a dollar and a missing value stays missing.
  client.facts.forEach(([, , , value], index) => {
    const source = data.facts[index]!.valueUsd;
    if (source === null) expect(value).toBeNull();
    else { expect(Number.isInteger(value)).toBe(true); expect(Math.abs(value! - Number(source))).toBeLessThan(1); }
  });
  client.nationalFacts.forEach((fact, index) => {
    expect(Number.isInteger(fact.valueUsd)).toBe(true);
    if (fact.indicatorId === "trade.exports" || fact.indicatorId === "trade.imports") expect(fact.valueUsd).toBe(Math.round(Number(national[index]!.valueUsd)));
  });
}, 30_000);

test("a workbook total equals the sum of its rows", async () => {
  const { loadTradeProductsData, toClientTradeProductsData } = await loader();
  const { loadTradeOverviewFacts } = await import("../../../lib/data/tradeOverview/importTradeOverview");
  const { buildTradeProductsWorkbookModel } = await import("../../../lib/explorer/tradeProductsWorkbook");
  const { DEFAULT_TRADE_PRODUCTS_STATE, tradeProductsBulkSelection } = await import("../../../lib/explorer/tradeProductsState");
  const { getMessages } = await import("../../../lib/i18n/messages.server");
  const [data, national, messages] = await Promise.all([loadTradeProductsData(), loadTradeOverviewFacts(), getMessages("ka", ["workbook", "trade"])]);
  const client = toClientTradeProductsData(data, national, "a".repeat(64), "2020-2025"), presentation = { locale: "ka" as const, messages, englishLabels: {} };
  for (const measure of ["trade.exports", "trade.imports"] as const) {
    const model = buildTradeProductsWorkbookModel({ data: client, state: { ...DEFAULT_TRADE_PRODUCTS_STATE, measure, selectedIds: tradeProductsBulkSelection(client) }, sources: [], siteOrigin: "https://fiscal.ge" }, presentation);
    const totalLabel = model.readable.rows.find(row => row.kind === "total")!.label, years = model.readable.years;
    expect(years).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
    for (const year of years) {
      const rows = model.analysis.rows.filter(row => row[0] === year), total = rows.find(row => row[2] === totalLabel)![3];
      expect(rows.filter(row => row[2] !== totalLabel).reduce((sum, row) => sum + (row[3] as number | null ?? 0), 0), `${measure} ${year}`).toBe(total);
    }
  }
}, 30_000);

test.each(["trade-products-annual.csv", "trade-products-catalogue.csv", "labels.json", "trade-products-validation.json"])("rejects stale %s before serving any facts", async filename => {
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation((async (...args: Parameters<typeof readFile>) => {
    const result = await original.readFile(...args);
    if (!String(args[0]).endsWith(filename)) return result;
    let text = result.toString();
    if (filename === "trade-products-annual.csv") text = text.replace("0.0056028686687583999", "0.0056028686687583998");
    else if (filename === "trade-products-catalogue.csv") text = text.replace("goods.hs4.1995-1999.0101", "goods.hs4.1995-1999.0102");
    else if (filename === "labels.json") { const labels = JSON.parse(text); labels["goods.hs4.1995-1999.0101"].text = "Changed"; text = JSON.stringify(labels); }
    else { const report = JSON.parse(text); report.status = "requires_review"; text = JSON.stringify(report); }
    return Buffer.isBuffer(result) ? Buffer.from(text) : text;
  }) as typeof readFile);
  await expect((await loader()).loadTradeProductsData()).rejects.toThrow(/acceptance|fingerprint|catalogue/i);
}, 30_000);

test("caches the static build load and rejects an incomplete database mirror", async () => {
  const { loadServedTradeProductsData: load, loadTradeProductsData } = await loader();
  expect(load()).toBe(load()); await load();
  const csv = await loadTradeProductsData();
  vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  vi.doMock("../../../lib/db/servedDataDb", () => ({ loadTradeProductsDataFromDb: async () => ({ entities: csv.entities, facts: csv.facts.slice(1) }) }));
  vi.resetModules();
  await expect((await loader()).loadServedTradeProductsData()).rejects.toThrow(/parity|does not match/i);
}, 30_000);

test("parity rejects changed labels, category, aliases, decimal values and missing status", async () => {
  const { assertTradeProductsParity } = await loader();
  const csv = { entities: tradeProductEntities(), facts: tradeProductFacts() };
  expect(() => assertTradeProductsParity(csv, { entities: [...csv.entities].reverse(), facts: [...csv.facts].reverse() })).not.toThrow();
  for (const changed of [
    { ...csv, entities: csv.entities.map((entity, i) => i ? entity : { ...entity, labelKa: "შეცვლილი" }) },
    { ...csv, entities: csv.entities.map((entity, i) => i ? entity : { ...entity, categoryId: "other_products" as const }) },
    { ...csv, entities: csv.entities.map((entity, i) => i ? entity : { ...entity, aliasesEn: [] }) },
    { ...csv, facts: csv.facts.map((fact, i) => i ? fact : { ...fact, valueUsd: "100.00000000000000000001" }) },
    { ...csv, facts: csv.facts.map(fact => fact.valueUsd === null ? { ...fact, valueUsd: "0" } : fact) },
    { ...csv, facts: csv.facts.slice(1) },
  ]) expect(() => assertTradeProductsParity(csv, changed)).toThrow(/parity|does not match/i);
});
