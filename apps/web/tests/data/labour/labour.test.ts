import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import { assertLabourParity, loadLabourFacts, loadServedLabourData, toClientLabourFact } from "../../../lib/data/labour/importLabour";
import { prepareLabourData } from "../../../lib/data/labour/prepareLabour";
import { LABOUR_INDICATORS, LABOUR_PUBLIC_SOURCES, LABOUR_RESEARCH_DIRECTORY, LABOUR_SOURCES, labourFactKey, labourSourceDocumentId, type LabourFact } from "../../../lib/data/labour/types";
import { labourMirrorCreateRows, loadLabourFactsFromMirror } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { validateLabourFacts } from "../../../lib/data/labour/validation";

const root = path.resolve(process.cwd(), "../..");
const records = (file: string) => parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const find = (facts: readonly LabourFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;

describe("the canonical file", () => {
  test("loads 1,014 reviewed observations", async () => {
    const facts = await loadLabourFacts();
    expect(facts).toHaveLength(1014);
    expect(facts.every(f => f.basis === "actual" && f.valueStatus === "survey_estimate")).toBe(true);
    expect(Math.min(...facts.map(f => f.year))).toBe(2017);
    expect(Math.max(...facts.map(f => f.year))).toBe(2025);
    expect(LABOUR_INDICATORS).toHaveLength(160);
    expect(new Set(facts.map(f => f.indicatorId)).size).toBe(159);
    expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(LABOUR_SOURCES));
    expect(LABOUR_PUBLIC_SOURCES).toHaveLength(14);
    expect(new Set(facts.map(labourFactKey)).size).toBe(1014);
    await expect(prepareLabourData(root, "check")).resolves.toBeUndefined();
  });

  test("keeps the anchor values", async () => {
    const facts = await loadLabourFacts();
    for (const [indicator, year, published] of [
      ["labour.jobs.all.total", 2025, "1389.7"], ["labour.jobs.all.sector_a", 2017, "289.5"], ["labour.jobs.all.sector_a", 2025, "218.3"],
      ["labour.jobs.all.sector_f", 2017, "84.3"], ["labour.jobs.all.sector_f", 2025, "122.6"], ["labour.hours.all.total", 2025, "41.0"],
      ["labour.informal.total", 2025, "28.3"], ["labour.underuse.composite", 2020, "39.5"], ["labour.underuse.composite", 2025, "27.8"],
      ["labour.neet.age_15_24.total", 2025, "17.6"], ["labour.neet.age_15_29.total", 2025, "23.4"],
    ] as const) expect(find(facts, indicator, year).publishedValue, `${indicator}:${year}`).toBe(published);
  });

  test("reconciles with the served Unemployment employed counts", async () => {
    const facts = await loadLabourFacts();
    const served = records(path.join(root, "data/imports/unemployment-annual.csv"));
    const row = (dimension: string, group: string, indicator: string, year: number) =>
      served.find(r => r.dimension === dimension && r.group_id === group && r.indicator_id === indicator && Number(r.year) === year)!;
    for (let year = 2020; year <= 2025; year++) {
      for (const [indicator, dimension, group] of [["all", "national", "georgia"], ["women", "sex", "women"], ["men", "sex", "men"]] as const) {
        const employed = row(dimension, group, "employed", year);
        expect(new Decimal(find(facts, `labour.jobs.${indicator}.total`, year).value).minus(employed.value).abs().lt("1e-6"), `${indicator} ${year}`).toBe(true);
      }
      expect(find(facts, "labour.underuse.unemployment_rate", year).publishedValue).toBe(row("national", "georgia", "unemployment_rate", year).published_value);
    }
  });

  test("serves a published zero and never a placeholder", async () => {
    const facts = await loadLabourFacts();
    expect(find(facts, "labour.jobs.all.not_identified", 2018).value).toBe("0");
    expect(facts.some(f => f.indicatorId === "labour.hours.men.sector_t")).toBe(false);
    expect(facts.every(f => /^\d+(\.\d+)?(E-?\d+)?$/.test(f.value))).toBe(true);
  });

  test("every row is the package row, plus the review date", () => {
    const canonical = records(path.join(root, "data/imports/labour-annual.csv"));
    const original = records(path.join(root, LABOUR_RESEARCH_DIRECTORY, "labour-annual.csv"));
    expect(canonical.map(({ last_reviewed_at, ...row }) => row)).toEqual(original);
    expect(new Set(canonical.map(row => row.last_reviewed_at))).toEqual(new Set(["2026-10-20"]));
    expect(fs.readFileSync(path.join(root, "data/imports/labour-annual.csv")).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });
});

describe("validation", () => {
  const copy = async () => (await loadLabourFacts()).map(f => ({ ...f }));

  test("rejects a changed, duplicate or extra observation", async () => {
    const changed = await copy();
    changed[0].value = "1286.9999";
    expect(() => validateLabourFacts(changed, root)).toThrow(/published value/);
    const duplicate = await copy();
    duplicate.push({ ...duplicate[5] });
    expect(() => validateLabourFacts(duplicate, root)).toThrow(/Duplicate/);
    const extra = await copy();
    extra.push({ ...find(extra, "labour.jobs.all.total", 2025), year: 2026 });
    expect(() => validateLabourFacts(extra, root)).toThrow(/outside the approved coverage/);
  });

  test.each([
    ["a missing observation", (facts: LabourFact[]) => { facts.pop(); }, /Incomplete/],
    ["a 2019 women row", (facts: LabourFact[]) => { facts.push({ ...find(facts, "labour.jobs.women.total", 2020), year: 2019 }); }, /outside the approved coverage/],
    ["an observation of the series without any", (facts: LabourFact[]) => { facts.push({ ...find(facts, "labour.hours.women.sector_t", 2020), indicatorId: "labour.hours.men.sector_t" }); }, /outside the approved coverage/],
    ["an unknown indicator", (facts: LabourFact[]) => { facts.push({ ...facts[0], indicatorId: "labour.jobs.all.unknown" as LabourFact["indicatorId"] }); }, /Invalid labour identity/],
    ["a wrong unit", (facts: LabourFact[]) => { facts[0].unit = "percent"; }, /source contract/],
    ["a wrong source", (facts: LabourFact[]) => { find(facts, "labour.informal.total", 2025).sourceId = "geostat_lfs_neet"; }, /source contract/],
    ["an official status", (facts: LabourFact[]) => { (facts[0] as { valueStatus: string }).valueStatus = "official"; }, /source contract/],
    ["a planned basis", (facts: LabourFact[]) => { (facts[0] as { basis: string }).basis = "planned"; }, /source contract/],
    ["a placeholder value", (facts: LabourFact[]) => { Object.assign(find(facts, "labour.informal.total", 2025), { value: "...", publishedValue: "..." }); }, /Invalid labour value/],
    ["a negative value", (facts: LabourFact[]) => { Object.assign(find(facts, "labour.informal.total", 2025), { value: "-1", publishedValue: "-1.0" }); }, /Invalid labour value/],
    ["industries that do not add up", (facts: LabourFact[]) => { Object.assign(find(facts, "labour.jobs.men.sector_f", 2022), { value: "100", publishedValue: "100.0" }); }, /do not add up to the total/],
    ["women and men that do not add up", (facts: LabourFact[]) => { Object.assign(find(facts, "labour.jobs.women.total", 2022), { value: "1", publishedValue: "1.0" }); }, /do not add up/],
    ["an altered anchor value", (facts: LabourFact[]) => { Object.assign(find(facts, "labour.hours.all.total", 2025), { value: "41.2", publishedValue: "41.2" }); }, /anchor/],
  ] as const)("rejects %s", async (_, mutate, error) => {
    const facts = await copy();
    mutate(facts);
    expect(() => validateLabourFacts(facts, root)).toThrow(error);
  });
});

describe("loading and parity", () => {
  test("rejects a stale canonical file", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "labour-"));
    try {
      for (const relative of ["data/imports/labour-annual.csv", "data/reports/labour-validation.json", path.join(LABOUR_RESEARCH_DIRECTORY, "coverage.csv")]) {
        fs.mkdirSync(path.dirname(path.join(tmp, relative)), { recursive: true });
        fs.copyFileSync(path.join(root, relative), path.join(tmp, relative));
      }
      await expect(loadLabourFacts(tmp)).resolves.toHaveLength(1014);
      fs.appendFileSync(path.join(tmp, "data/imports/labour-annual.csv"), "\n");
      await expect(loadLabourFacts(tmp)).rejects.toThrow("Labour acceptance or canonical fingerprint mismatch");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
    const facts = await loadLabourFacts();
    expect(() => assertLabourParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
    // The database writes the same figures as plain decimals: no exponent, no trailing zero.
    const plain = facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
    expect(plain.some(f => f.value !== facts.find(g => g.indicatorId === f.indicatorId && g.year === f.year)!.value)).toBe(true);
    expect(() => assertLabourParity(facts, plain)).not.toThrow();
    const changed = facts.map(f => ({ ...f }));
    Object.assign(find(changed, "labour.informal.total", 2025), { value: "28.9", publishedValue: "28.9" });
    expect(() => assertLabourParity(facts, changed)).toThrow();
    expect(() => assertLabourParity(facts, facts.slice(1))).toThrow();
  });

  test("served data and client facts carry the published number and nothing internal", async () => {
    const { facts } = await loadServedLabourData();
    expect(facts).toHaveLength(1014);
    expect(toClientLabourFact(find(facts, "labour.informal.total", 2025))).toEqual({
      year: 2025, indicatorId: "labour.informal.total", sourceId: "geostat_lfs_informal", unit: "percent", value: 28.3,
    });
    expect(facts.every(f => toClientLabourFact(f).value === Number(f.publishedValue))).toBe(true);
    expect(Object.keys(toClientLabourFact(facts[0])).sort()).toEqual(["indicatorId", "sourceId", "unit", "value", "year"]);
  });
});

describe("the database mirror", () => {
  const mirrorOf = (facts: readonly LabourFact[]) =>
    labourMirrorCreateRows(facts, "labour-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const db = (list: ReturnType<typeof mirrorOf>) => ({ labourFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "labourFact">;

  test("mirror rows round-trip to identical served rows", async () => {
    const facts = await loadLabourFacts();
    const rows = mirrorOf(facts);
    const mirror = await loadLabourFactsFromMirror(db(rows));
    expect(() => assertLabourParity(facts, mirror)).not.toThrow();
    expect(rows[0].importRunId).toBe("labour-run-1");
    expect(rows.every(row => row.sourceDocumentId === labourSourceDocumentId(row.sourceId))).toBe(true);
    // One changed mirrored value is not a round trip.
    const changed = rows.map(row => ({ ...row }));
    const target = changed.find(row => row.indicatorId === "labour.informal.total" && row.year === 2025)!;
    target.value = new Decimal("28.9");
    target.publishedValue = new Decimal("28.9");
    await expect(loadLabourFactsFromMirror(db(changed)).then(mirrored => assertLabourParity(facts, mirrored))).rejects.toThrow();
    await expect(loadLabourFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
  });

  test("every served source is a registered document", async () => {
    const facts = await loadLabourFacts();
    const documents = new Set(records(path.join(root, "data/sources/source-documents.csv")).map(row => row.source_id));
    for (const sourceId of new Set(facts.map(f => f.sourceId))) expect(documents.has(labourSourceDocumentId(sourceId)), sourceId).toBe(true);
  });

  test("every archived source has one source-document row with a Georgian title and the local file", () => {
    const documents = new Map(records(path.join(root, "data/sources/source-documents.csv")).map(row => [row.source_id, row]));
    const manifest = records(path.join(root, LABOUR_RESEARCH_DIRECTORY, "source-manifest.csv"));
    expect(new Set(manifest.map(row => row.source_id))).toEqual(new Set(LABOUR_PUBLIC_SOURCES));
    for (const row of manifest) {
      const document = documents.get(labourSourceDocumentId(row.source_id));
      expect(document, row.source_id).toBeDefined();
      expect(document!.source_name, row.source_id).toMatch(/^[^A-Za-z]*[ა-ჿ]/);
      expect(document!.source_url_or_file).toBe(`${LABOUR_RESEARCH_DIRECTORY}/${row.local_file}`);
      expect(fs.existsSync(path.join(root, document!.source_url_or_file)), row.source_id).toBe(true);
      expect(document!.last_reviewed_at).toBe("2026-10-20");
    }
    expect([...documents.keys()].filter(id => id.startsWith("source.geostat_lfs_detail") || /^source\.geostat_lfs_(jobs|hours|informal|underuse|neet)/.test(id))).toHaveLength(LABOUR_PUBLIC_SOURCES.length);
  });
});
