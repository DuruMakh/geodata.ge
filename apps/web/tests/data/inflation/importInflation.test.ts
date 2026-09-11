import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertInflationParity, loadCpiFacts, loadInflationTargets, loadServedInflationData } from "../../../lib/data/inflation/importInflation";

describe("inflation serving", () => {
  it("rejects a changed value, locator or target in the mirror", async () => {
    const csv = { facts: await loadCpiFacts(), targets: await loadInflationTargets() };
    expect(() => assertInflationParity(csv, csv)).not.toThrow();
    expect(() => assertInflationParity(csv, { ...csv, facts: [{ ...csv.facts[0]!, value: "1" }, ...csv.facts.slice(1)] })).toThrow(/differs/);
    expect(() => assertInflationParity(csv, { ...csv, facts: [{ ...csv.facts[0]!, sourceLocator: "wrong" }, ...csv.facts.slice(1)] })).toThrow(/differs/);
    expect(() => assertInflationParity(csv, { ...csv, targets: [{ ...csv.targets[0]!, targetPct: "6" }, ...csv.targets.slice(1)] })).toThrow(/differs/);
  });

  it("serves numbers and refuses an unknown series", async () => {
    const { facts, targets } = await loadServedInflationData();
    expect(typeof facts[0]!.value).toBe("number");
    expect(targets.at(-1)!.targetPct).toBe(3);
    const temp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "cpi-csv-")), "bad.csv");
    await fs.writeFile(temp, "series_id,measure,period,value,status,source_id,source_locator,last_reviewed_at\ncpi.food,yoy_pct,2020-01,1,published,source.geostat_cpi_yoy,Georgia!D5,2026-09-12\n");
    await expect(loadCpiFacts(temp)).rejects.toThrow(/Unknown CPI series/);
  });
});
