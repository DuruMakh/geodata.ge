import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { csvEscape } from "../../../lib/data/csvEscape";
import { periodFromKey } from "../../../lib/data/inflation/periods";
import { prepareInflation, serializeCpiFacts } from "../../../lib/data/inflation/prepareInflation";
import { loadCpiFacts, loadInflationTargets } from "../../../lib/data/inflation/importInflation";
import { INFLATION_RAW_ROOT } from "../../../lib/data/inflation/sourceFiles";
import type { CpiFact } from "../../../lib/data/inflation/types";
import { assertNoRevisions, findRevisions, recomputeHeadline, validateCpiFacts, validateTargetRows } from "../../../lib/data/inflation/validateInflation";

let facts: CpiFact[];
let lastPeriod: string;

beforeAll(async () => {
  const result = await prepareInflation({ previousFacts: null });
  facts = result.facts;
  lastPeriod = result.validation.lastPeriod;
});

const months = (from: string, to: string) => periodFromKey(to) - periodFromKey(from) + 1;

describe("prepareInflation", () => {
  it("delivers every published series over its full contiguous coverage", async () => {
    const { validation } = await prepareInflation({ previousFacts: null });
    expect(validation.firstPeriods).toEqual({
      "cpi.headline:index_2010": "2000-01",
      "cpi.headline:yoy_pct": "2004-01",
      "cpi.headline:mom_pct": "2004-01",
      "cpi.headline:avg12_pct": "2002-01",
      "cpi.core:yoy_pct": "2010-01",
      "cpi.core:mom_pct": "2010-01",
      "cpi.core_ex_tobacco:yoy_pct": "2010-01",
      "cpi.core_ex_tobacco:mom_pct": "2010-01",
    });
    expect(validation.counts["cpi.headline:index_2010"]).toBe(months("2000-01", lastPeriod));
    expect(validation.counts["cpi.core:yoy_pct"]).toBe(months("2010-01", lastPeriod));
    expect(validation.languageParity).toBe("PASS");
    expect(validation.maxRecomputeErrorPp.yoy).toBeLessThanOrEqual(0.2);
    expect(validation.maxRecomputeErrorPp.mom).toBeLessThanOrEqual(0.2);
    expect(validation.maxRecomputeErrorPp.avg12).toBeLessThanOrEqual(0.2);
    expect(facts.every((fact) => fact.status === "published" && fact.sourceLocator.length > 0)).toBe(true);
    expect(facts.some((fact) => fact.seriesId === "cpi.core" && fact.measure === "index_2010")).toBe(false);
  });

  it("matches the committed canonical CSV byte for byte", async () => {
    const committed = await fs.readFile(path.resolve(process.cwd(), "../../data/imports/cpi-national-monthly.csv"), "utf8");
    expect(serializeCpiFacts(facts)).toBe(committed);
  });

  it("round-trips through the CSV loader", async () => {
    expect(await loadCpiFacts()).toEqual(facts);
  });
});

describe("validation rules", () => {
  it("rejects a gap, a duplicate, an unpublished measure and a series ending early", () => {
    const withoutOne = facts.filter((fact) => !(fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2015-06"));
    expect(() => validateCpiFacts(withoutOne)).toThrow(/gap/);
    expect(() => validateCpiFacts([...facts, facts[0]!])).toThrow(/Duplicate/);
    expect(() => validateCpiFacts([...facts, { ...facts[0]!, seriesId: "cpi.core", measure: "index_2010" }])).toThrow(/does not publish/);
    const lastCore = facts.filter((fact) => !(fact.seriesId === "cpi.core" && fact.measure === "mom_pct" && fact.period === lastPeriod));
    expect(() => validateCpiFacts(lastCore)).toThrow(/end in different months/);
  });

  it("rejects a headline rate that disagrees with the index", () => {
    const bent = facts.map((fact) =>
      fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2020-03" ? { ...fact, value: "9.9" } : fact,
    );
    expect(() => recomputeHeadline(bent)).toThrow(/yoy differs/);
  });

  it("stops on any revision to published history and lists the month", () => {
    const revised = facts.map((fact) =>
      fact.seriesId === "cpi.headline" && fact.measure === "mom_pct" && fact.period === "2012-05" ? { ...fact, value: "0.1234" } : fact,
    );
    expect(findRevisions(facts, revised)).toEqual([`cpi.headline:mom_pct:2012-05 ${facts.find((f) => f.measure === "mom_pct" && f.period === "2012-05" && f.seriesId === "cpi.headline")!.value} → 0.1234`]);
    expect(() => assertNoRevisions(facts, revised)).toThrow(/revised published CPI history/);
    expect(() => assertNoRevisions(facts, facts.slice(1))).toThrow(/removed/);
    expect(() => assertNoRevisions(facts.slice(0, -5), facts)).not.toThrow();
  });

  it("fails prepare when the previous canonical CSV disagrees with the files", async () => {
    const revised = facts.map((fact, index) => (index === 100 ? { ...fact, value: "1" } : fact));
    await expect(prepareInflation({ previousFacts: revised })).rejects.toThrow(/revised published CPI history/);
  });

  it("accepts the reviewed target path and rejects broken ones", async () => {
    const targets = await loadInflationTargets();
    expect(targets.at(-1)).toMatchObject({ effectiveTo: null, targetPct: "3" });
    expect(() => validateTargetRows([{ ...targets[0]!, effectiveTo: null }, ...targets.slice(1)])).toThrow(/open-ended/);
    expect(() => validateTargetRows([targets[0]!, targets[2]!])).toThrow(/contiguous/);
    expect(() => validateTargetRows([{ ...targets[0]!, targetPct: "0" }])).toThrow(/target/);
  });

  it("refuses a vintage whose Georgian file carries different values", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cpi-raw-"));
    try {
      await fs.cp(INFLATION_RAW_ROOT, temp, { recursive: true });
      const vintage = (await fs.readdir(path.join(temp, "geostat-cpi"))).sort().at(-1)!;
      const dir = path.join(temp, "geostat-cpi", vintage);
      // The Georgian y/y row now names the Georgian m/m file together with that
      // file's own hash and size: every hash still verifies, but the y/y role
      // no longer carries the English y/y values.
      const manifestPath = path.join(dir, "source-manifest.csv");
      const records = parse(await fs.readFile(manifestPath, "utf8"), { bom: true, columns: true }) as Record<string, string>[];
      const yoy = records.find((row) => row.file_role === "yoy" && row.language === "ka")!;
      const mom = records.find((row) => row.file_role === "mom" && row.language === "ka")!;
      for (const field of ["local_file", "sha256", "bytes"]) yoy[field] = mom[field]!;
      const header = Object.keys(records[0]!);
      await fs.writeFile(manifestPath, [header.join(","), ...records.map((row) => header.map((field) => csvEscape(row[field]!)).join(","))].join("\n"));
      await expect(prepareInflation({ rawRoot: temp, previousFacts: null })).rejects.toThrow(/English and Georgian yoy files differ/);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});
