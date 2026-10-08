import { afterEach, expect, test, vi } from "vitest";
import { loadServedUnemploymentData, loadServedUnemploymentRows, loadUnemploymentFacts, resetUnemploymentCacheForTests } from "../../../lib/data/unemployment/importUnemployment";

const db = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/db/servedDataDb", () => ({ loadUnemploymentFactsFromDb: db }));
afterEach(() => { vi.unstubAllEnvs(); db.mockReset(); resetUnemploymentCacheForTests(); });
test("CSV mode does not require the database and converts values only for the numeric projection", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  const raw = await loadServedUnemploymentRows();
  const served = await loadServedUnemploymentData();
  expect(typeof raw.facts[0].value).toBe("string");
  expect(served.facts[0].value).toBe(Number(raw.facts[0].value));
  expect(db).not.toHaveBeenCalled();
});
test("db mode serves matching rows and collapses concurrent loads", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "db");
  const facts = await loadUnemploymentFacts(); db.mockResolvedValue(facts);
  const [first, second] = await Promise.all([loadServedUnemploymentRows(), loadServedUnemploymentRows()]);
  expect(first.facts).toEqual(facts); expect(second).toBe(first); expect(db).toHaveBeenCalledOnce();
});
test("db mode fails on missing mirror rows without falling back to CSV", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "db"); db.mockResolvedValue([]);
  await expect(loadServedUnemploymentData()).rejects.toThrow(/coverage/i);
});
test("db connection failures propagate and stay cached for the build", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "db"); db.mockRejectedValue(new Error("database unavailable"));
  await expect(loadServedUnemploymentRows()).rejects.toThrow("database unavailable");
  await expect(loadServedUnemploymentRows()).rejects.toThrow("database unavailable");
  expect(db).toHaveBeenCalledOnce();
});
