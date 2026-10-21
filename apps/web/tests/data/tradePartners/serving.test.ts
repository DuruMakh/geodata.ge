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
  // Each fact is [entity index, year, measure index, value]: nothing the page does not read.
  expect(client.facts[0]).toHaveLength(4);
  expect(client.facts.find(f => client.entities[f[0]]!.id.endsWith(".530"))?.[3]).toBeNull();
  expect(client.nationalFacts).toHaveLength(8);
});

test("the real client payload stays under 1 MB of JSON", async () => {
  const { loadTradePartnersData, toClientTradePartnersData } = await loader();
  const client = toClientTradePartnersData(await loadTradePartnersData(), []);
  expect(client.facts).toHaveLength(22992);
  expect(JSON.stringify(client).length).toBeLessThan(1_000_000);
});

test("client trade values are whole dollars", async () => {
  const { loadTradePartnersData, toClientTradePartnersData } = await loader();
  const { loadTradeOverviewFacts } = await import("../../../lib/data/tradeOverview/importTradeOverview");
  const [data, national] = await Promise.all([loadTradePartnersData(), loadTradeOverviewFacts()]);
  const client = toClientTradePartnersData(data, national), flows = ["trade.exports", "trade.imports"];
  // A missing value stays missing; a published flow moves by less than a dollar.
  client.facts.forEach(([, , , value], index) => {
    const source = data.facts[index]!;
    if (source.valueUsd === null) return expect(value).toBeNull();
    expect(Number.isInteger(value)).toBe(true);
    if (flows.includes(source.indicatorId)) expect(Math.abs(value! - Number(source.valueUsd))).toBeLessThan(1);
  });
  client.nationalFacts.forEach((fact, index) => {
    expect(Number.isInteger(fact.valueUsd)).toBe(true);
    if (flows.includes(fact.indicatorId)) expect(fact.valueUsd).toBe(Math.round(Number(national[index]!.valueUsd)));
  });
});

test("turnover and balance follow the rounded flows, as the workbook's formulas state", async () => {
  const { loadTradePartnersData, toClientTradePartnersData } = await loader();
  const { loadTradeOverviewFacts } = await import("../../../lib/data/tradeOverview/importTradeOverview");
  const { TRADE_CHART_INDICATORS } = await import("../../../lib/data/tradeOverview/types");
  const [data, national] = await Promise.all([loadTradePartnersData(), loadTradeOverviewFacts()]);
  const client = toClientTradePartnersData(data, national);
  const rows = [...client.facts.map(([entity, year, measure, value]) => ({ key: `${entity}:${year}`, indicator: TRADE_CHART_INDICATORS[measure]!, value })), ...client.nationalFacts.map(fact => ({ key: `national:${fact.year}`, indicator: fact.indicatorId, value: fact.valueUsd }))];
  const amount = new Map(rows.map(row => [`${row.key}:${row.indicator}`, row.value]));
  const derived = rows.filter(row => row.value !== null && (row.indicator === "trade.turnover" || row.indicator === "trade.balance"));
  expect(derived.length).toBeGreaterThan(10_000);
  for (const row of derived) {
    const exports = amount.get(`${row.key}:trade.exports`)!, imports = amount.get(`${row.key}:trade.imports`)!;
    expect(row.value, `${row.key} ${row.indicator}`).toBe(row.indicator === "trade.turnover" ? exports + imports : exports - imports);
  }
});

test("a workbook total equals the sum of its rows", async () => {
  const { loadTradePartnersData, toClientTradePartnersData } = await loader();
  const { loadTradeOverviewFacts } = await import("../../../lib/data/tradeOverview/importTradeOverview");
  const { buildTradePartnersWorkbookModel } = await import("../../../lib/explorer/tradePartnersWorkbook");
  const { DEFAULT_TRADE_PARTNERS_STATE } = await import("../../../lib/explorer/tradePartnersState");
  const { getMessages } = await import("../../../lib/i18n/messages.server");
  const [data, national, messages] = await Promise.all([loadTradePartnersData(), loadTradeOverviewFacts(), getMessages("ka", ["workbook", "trade"])]);
  const client = toClientTradePartnersData(data, national), presentation = { locale: "ka" as const, messages, englishLabels: {} };
  const selectedIds = ["goods.total", ...client.entities.filter(entity => entity.kind === "country").map(entity => entity.id)];
  for (const measure of ["trade.exports", "trade.imports"] as const) {
    const model = buildTradePartnersWorkbookModel({ data: client, state: { ...DEFAULT_TRADE_PARTNERS_STATE, measure, selectedIds }, sources: [], siteOrigin: "https://fiscal.ge" }, presentation);
    const totalLabel = model.readable.rows.find(row => row.kind === "total")!.label, years = model.readable.years;
    expect(years.length).toBeGreaterThan(30);
    for (const year of years) {
      const rows = model.analysis.rows.filter(row => row[0] === year), total = rows.find(row => row[2] === totalLabel)![3];
      expect(rows.filter(row => row[2] !== totalLabel).reduce((sum, row) => sum + (row[3] as number | null ?? 0), 0), `${measure} ${year}`).toBe(total);
    }
  }
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
