import { beforeEach, expect, test, vi } from "vitest";
import { assertTradeOverviewParity, loadServedTradeOverviewData, loadTradeOverviewFacts, toClientTradeOverviewFact } from "../../../lib/data/tradeOverview/importTradeOverview";
import { tradeFixtureFacts } from "./fixtures";

beforeEach(() => { vi.unstubAllEnvs(); vi.stubEnv("GEODATA_DATA_SOURCE", "csv"); vi.resetModules(); });
test("loads the complete accepted canonical subset and exposes numbers only to the client", async () => {
  const facts = await loadTradeOverviewFacts();
  expect(facts).toHaveLength(124);
  const latest = facts.find(f => f.year === 2025 && f.indicatorId === "trade.balance")!;
  expect(latest.valueUsd).toBe("-11360708279.6124982");
  // Only what the trade pages read (platform review U21-15).
  expect(toClientTradeOverviewFact(latest)).toEqual({ year: 2025, indicatorId: "trade.balance", valueUsd: -11360708279.612497 });
});
test("reuses the same validated build-time data promise", async () => {
  const { loadServedTradeOverviewData: load } = await import("../../../lib/data/tradeOverview/importTradeOverview");
  expect(load()).toBe(load());
  expect((await load()).facts).toHaveLength(124);
});
test("mirror parity is order independent and compares exact amounts and source tokens", () => {
  const facts = tradeFixtureFacts();
  expect(() => assertTradeOverviewParity(facts, [...facts].reverse())).not.toThrow();
  for (const field of ["valueUsd", "sourceValue", "sourceRefs", "publicationStatus", "lastReviewedAt"] as const) {
    const changed = facts.map((f, i) => i === 0 ? { ...f, [field]: field === "valueUsd" ? "80.00000001" : "changed" } : f);
    expect(() => assertTradeOverviewParity(facts, changed)).toThrow();
  }
  expect(() => assertTradeOverviewParity(facts, facts.filter(f => f.year !== 2024))).toThrow(/coverage|parity/i);
});
test("database mode refuses a mismatched mirror instead of falling back to canonical CSV", async () => {
  const csv = await loadTradeOverviewFacts();
  vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  vi.doMock("../../../lib/db/servedDataDb", () => ({ loadTradeOverviewFactsFromDb: async () => csv.slice(4) }));
  vi.resetModules();
  const { loadServedTradeOverviewData: load } = await import("../../../lib/data/tradeOverview/importTradeOverview");
  await expect(load()).rejects.toThrow(/coverage|parity/i);
  await expect(load()).rejects.toThrow(/coverage|parity/i);
  vi.doUnmock("../../../lib/db/servedDataDb");
});
test("CSV serving exposes the accepted subset without loading preparation", async () => {
  expect((await loadServedTradeOverviewData()).facts).toHaveLength(124);
});
