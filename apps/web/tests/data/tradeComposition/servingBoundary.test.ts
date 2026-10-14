import { afterEach, expect, test, vi } from "vitest";
import { loadTradeCompositionData, toClientTradeCompositionData } from "../../../lib/data/tradeComposition/importTradeComposition";
import { loadTradeOverviewFacts } from "../../../lib/data/tradeOverview/importTradeOverview";

vi.mock("../../../lib/data/tradeComposition/prepareTradeComposition", () => {
  throw new Error("Serving composition must not load raw-source preparation");
});
vi.mock("../../../lib/data/parsing/tradeSourceWorkbook", () => {
  throw new Error("Serving composition must not parse raw workbooks");
});

test("serves only accepted files without raw-source imports", async () => {
  expect((await loadTradeCompositionData()).facts).toHaveLength(884);
});

test("projects separate classifications and restricted national references", async () => {
  const data = await loadTradeCompositionData();
  const client = toClientTradeCompositionData(data, await loadTradeOverviewFacts());
  expect(client.sitc.entities).toHaveLength(10);
  expect(client.bec.entities).toHaveLength(7);
  expect(client.sitc.entities.map(e => e.sourceCode)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  expect(client.bec.entities.map(e => e.sourceCode)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  for (const [classification, count] of [["sitc", 520], ["bec", 364]] as const) {
    const view = client[classification];
    expect(view).toMatchObject({ dataset: "composition", classification });
    expect(view.measures).toEqual(["trade.exports", "trade.imports"]);
    expect(view.facts).toHaveLength(count);
    expect(view.facts.every(f => f.length === 4 && [1, 2].includes(f[2]))).toBe(true);
    expect(view.entities.every(e => e.kind === "commodity_group")).toBe(true);
    expect(view.nationalFacts).toHaveLength(52);
    expect(view.nationalFacts.every(f => f.year >= 2000 && f.year <= 2025 && ["trade.exports", "trade.imports"].includes(f.indicatorId))).toBe(true);
    const first = data.facts.find(f => f.entityId === view.entities[0].id)!;
    expect(view.facts[0]).toEqual([0, first.year, first.indicatorId === "trade.exports" ? 1 : 2, Number(first.valueUsd)]);
  }
  expect(Object.keys(client.englishLabels)).toHaveLength(17);
  expect(client.englishLabels["trade.sitc1.0"]).toBe("Food and live animals");
});

afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("../../../lib/db/servedDataDb"); });

test("CSV serving caches accepted data and leaves the database unloaded", async () => {
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  vi.doMock("../../../lib/db/servedDataDb", () => { throw new Error("CSV must not load database code"); });
  const { loadServedTradeCompositionData } = await import("../../../lib/data/tradeComposition/importTradeComposition");
  const first = loadServedTradeCompositionData();
  expect(loadServedTradeCompositionData()).toBe(first);
  expect((await first).facts).toHaveLength(884);
});

test.each([false, true])("DB serving verifies every accepted field (mismatch=%s)", async mismatch => {
  const csv = await loadTradeCompositionData();
  if (mismatch) csv.facts[0].sourceLabel = "changed";
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  vi.doMock("../../../lib/db/servedDataDb", () => ({ loadTradeCompositionDataFromDb: async () => csv }));
  const { loadServedTradeCompositionData } = await import("../../../lib/data/tradeComposition/importTradeComposition");
  if (mismatch) await expect(loadServedTradeCompositionData()).rejects.toThrow(/parity|does not match/i);
  else expect(await loadServedTradeCompositionData()).toBe(csv);
});

test("DB failures propagate and stay cached", async () => {
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  const read = vi.fn(async () => { throw new Error("database unavailable"); });
  vi.doMock("../../../lib/db/servedDataDb", () => ({ loadTradeCompositionDataFromDb: read }));
  const { loadServedTradeCompositionData } = await import("../../../lib/data/tradeComposition/importTradeComposition");
  await expect(loadServedTradeCompositionData()).rejects.toThrow("database unavailable");
  await expect(loadServedTradeCompositionData()).rejects.toThrow("database unavailable");
  expect(read).toHaveBeenCalledOnce();
});
