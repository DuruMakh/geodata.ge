import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("node:fs/promises", async importOriginal => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, readFile: vi.fn(original.readFile) };
});
const loader = () => import("../../../lib/data/externalFlows/importCurrentAccount");
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation(original.readFile);
});
afterEach(() => { vi.unstubAllEnvs(); });

test("serves all 390 reviewed facts and a thin numeric client payload", async () => {
  const { loadCurrentAccountFacts, toClientCurrentAccountFacts } = await loader();
  const facts = await loadCurrentAccountFacts();
  expect(facts).toHaveLength(390);
  const client = toClientCurrentAccountFacts(facts);
  const balance = client.find(f => f.seriesId === "ca.balance" && f.flow === "net" && f.year === 2025)!;
  expect(balance.valueUsd).toBeCloseTo(-1123241112.31, 2);
  expect(Object.keys(client[0]).sort()).toEqual(["flow", "seriesId", "valueUsd", "year"]);
});

test.each(["current-account-annual.csv", "current-account-validation.json"])("rejects a stale %s fingerprint", async filename => {
  const original = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(readFile).mockImplementation((async (...args: Parameters<typeof readFile>) => {
    const result = await original.readFile(...args);
    if (!String(args[0]).endsWith(filename)) return result;
    let text = result.toString();
    if (filename.endsWith(".csv")) text = text.replace(",usd,", ",usd,9");
    else { const report = JSON.parse(text); report.status = "requires_review"; text = JSON.stringify(report); }
    return Buffer.isBuffer(result) ? Buffer.from(text) : text;
  }) as typeof readFile);
  const { loadCurrentAccountFacts } = await loader();
  await expect(loadCurrentAccountFacts()).rejects.toThrow(/fingerprint|mismatch/i);
});
