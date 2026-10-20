import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { afterEach, expect, test } from "vitest";
import { prepareGdpExpenditure, writeGdpExpenditureArtifacts } from "../../../lib/data/gdpExpenditure/prepareGdpExpenditure";
import { readCsvRecords } from "../../../lib/data/csv";

const root = path.resolve(process.cwd(), "../..");
const manifestPath = "docs/Raw Data/Economy/gdp-expenditure/source-manifest.json";
const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true }))); });

const find = (facts: { seriesId: string; year: number; measure: string; value: string }[], seriesId: string, measure: string, year: number) =>
  facts.find(f => f.seriesId === seriesId && f.measure === measure && f.year === year)?.value;

test("the committed CSV and report are what the archived originals produce", async () => {
  await expect(writeGdpExpenditureArtifacts(false, root)).resolves.toMatchObject({ status: "PASS" });
});

test("serves 256 amounts, 256 shares and 210 growth rates from the published cells", async () => {
  const { facts, validation } = await prepareGdpExpenditure(root);
  expect(validation.counts).toEqual({ nominal: 256, share_of_gdp: 256, real_growth: 210 });
  expect(facts).toHaveLength(722);
  // Cell text read from the archived XML, not SheetJS doubles.
  expect(find(facts, "gdp_use.households", "nominal", 2025)).toBe("72267497536.51864");
  expect(Number(find(facts, "gdp_use.households", "share_of_gdp", 2025))).toBeCloseTo(69.09, 2);
  expect(Number(find(facts, "gdp_use.households_npish", "real_growth", 2025))).toBeCloseTo(8.625, 3);
  expect(Number(find(facts, "gdp_use.inventories", "nominal", 2017))).toBeLessThan(0);
  expect(Number(find(facts, "gdp_use.imports", "nominal", 2025))).toBeGreaterThan(0);
  expect(find(facts, "gdp_use.households", "real_growth", 2025)).toBeUndefined();
  expect(find(facts, "gdp_use.households_npish", "nominal", 2025)).toBeUndefined();
  expect(find(facts, "gdp_use.inventories", "real_growth", 2025)).toBeUndefined();
  expect(facts.filter(f => f.year === 2025).every(f => f.status === "preliminary")).toBe(true);
  expect(facts.some(f => f.year === 2026)).toBe(false);
});

test("GDP agrees with the Sectors page in every year", async () => {
  const { facts } = await prepareGdpExpenditure(root);
  const sectors = await readCsvRecords("../../data/imports/economic-sectors-annual.csv");
  for (let year = 2010; year <= 2025; year++) {
    const sector = sectors.find(r => r.series_id === "economy.gdp_total" && r.measure === "nominal" && r.year === String(year))!;
    expect(Math.abs(Number(find(facts, "economy.gdp_total", "nominal", year)) - Number(sector.value))).toBeLessThan(0.01);
  }
});

// A copy of the package whose one original is altered, optionally with the manifest's hash updated.
async function tampered(file: string, edit: (bytes: Buffer) => Buffer, rehash: boolean) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gdp-expenditure-"));
  temporary.push(dir);
  for (const relative of ["data/taxonomy/gdp-expenditure.json", "data/imports/economic-sectors-annual.csv", manifestPath]) {
    await fs.mkdir(path.dirname(path.join(dir, relative)), { recursive: true });
    await fs.copyFile(path.join(root, relative), path.join(dir, relative));
  }
  const manifest = JSON.parse(await fs.readFile(path.join(root, manifestPath), "utf8"));
  for (const source of manifest.files) {
    let bytes: Buffer = await fs.readFile(path.join(root, source.file));
    if (path.basename(source.file) === file) {
      bytes = edit(bytes);
      if (rehash) Object.assign(source, { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
    }
    await fs.mkdir(path.dirname(path.join(dir, source.file)), { recursive: true });
    await fs.writeFile(path.join(dir, source.file), bytes);
  }
  await fs.writeFile(path.join(dir, manifestPath), JSON.stringify(manifest));
  return dir;
}

function editSheetXml(bytes: Buffer, edit: (xml: string) => string): Buffer {
  const entries = unzipSync(bytes);
  const name = Object.keys(entries).find(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))!;
  const xml = strFromU8(entries[name]);
  const next = edit(xml);
  expect(next).not.toBe(xml);
  entries[name] = strToU8(next);
  return Buffer.from(zipSync(entries));
}

test("a changed byte fails the checksum before any workbook is read", async () => {
  const dir = await tampered("08_GDP-by-use-categories.xlsx", bytes => Buffer.concat([bytes, Buffer.from([0])]), false);
  await expect(prepareGdpExpenditure(dir)).rejects.toThrow(/source hash mismatch/);
});

test("a household amount 1 GEL off breaks the consumption identity", async () => {
  // G10 is households 2010: 3478.764418181928 + 4028.83… for the quarters; the annual cell is 17004.858932345618.
  const dir = await tampered("08_GDP-by-use-categories.xlsx",
    bytes => editSheetXml(bytes, xml => xml.replace(/(<c r="G10"[^>]*><v>)17004\.85893234561\d*/, "$117004.859932345618")), true);
  await expect(prepareGdpExpenditure(dir)).rejects.toThrow(/identity failed: consumption 2010/);
});

test("a relabelled row is refused", async () => {
  const dir = await tampered("09_Real-GDP-growth-by-categories-of-use.xlsx", bytes => bytes, true);
  const manifest = JSON.parse(await fs.readFile(path.join(dir, manifestPath), "utf8"));
  manifest.files[1].rows["gdp_use.households_npish"][2] = "Households";
  await fs.writeFile(path.join(dir, manifestPath), JSON.stringify(manifest));
  await expect(prepareGdpExpenditure(dir)).rejects.toThrow(/code\/label mismatch: growth gdp_use.households_npish/);
});
