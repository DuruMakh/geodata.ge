import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { afterEach, expect, test } from "vitest";
import { prepareExpenditureTypes, writeExpenditureTypesArtifacts } from "../../../lib/data/expenditureTypes/prepareExpenditureTypes";

const root = path.resolve(process.cwd(), "../..");
const manifestPath = "docs/Raw Data/Budget/expenditure-types/source-manifest.json";
const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true }))); });

type Row = { seriesId: string; year: number; measure: string; value: string; status: string };
const find = (facts: Row[], seriesId: string, measure: string, year: number) =>
  facts.find(f => f.seriesId === `spending_type.${seriesId}` && f.measure === measure && f.year === year);

test("the committed CSV and report are what the archived original produces", async () => {
  await expect(writeExpenditureTypesArtifacts(false, root)).resolves.toMatchObject({ status: "PASS" });
});

test("serves ten types for 2002-2025 in GEL and as a share of GDP", async () => {
  const { facts, validation } = await prepareExpenditureTypes(root);
  expect(validation.counts).toEqual({ nominal: 240, share_of_gdp: 240 });
  expect(facts).toHaveLength(480);
  expect(find(facts, "compensation", "nominal", 2025)?.value).toBe("3599200000");
  expect(find(facts, "compensation", "nominal", 2002)?.value).toBe("222200000");
  expect(find(facts, "total", "nominal", 2025)?.value).toBe("29743800000");
  // A float-noise cell (24834.300000000003) is read at the file's one-decimal precision.
  expect(find(facts, "expense", "nominal", 2025)?.value).toBe("24834300000");
  expect(Number(find(facts, "total", "share_of_gdp", 2025)?.value)).toBeCloseTo(28.44, 2);
  // Amounts are the Ministry's; only shares lean on the preliminary 2025 GDP.
  expect(find(facts, "total", "nominal", 2025)?.status).toBe("published");
  expect(find(facts, "total", "share_of_gdp", 2025)?.status).toBe("preliminary");
  expect(find(facts, "total", "share_of_gdp", 2024)?.status).toBe("published");
  // Real zeros stay zeros, not gaps.
  expect(find(facts, "grants", "nominal", 2003)?.value).toBe("0");
  expect(find(facts, "other", "nominal", 2002)?.value).toBe("0");
  expect(facts.some(f => f.year === 2001 || f.year === 2026)).toBe(false);
});

// A copy of the package whose original is altered, optionally with the manifest's hash updated.
async function tampered(edit: (bytes: Buffer) => Buffer, rehash: boolean) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "expenditure-types-"));
  temporary.push(dir);
  for (const relative of ["data/taxonomy/expenditure-types.json", "data/imports/national-gdp-annual-1996-2025.csv"]) {
    await fs.mkdir(path.dirname(path.join(dir, relative)), { recursive: true });
    await fs.copyFile(path.join(root, relative), path.join(dir, relative));
  }
  const manifest = JSON.parse(await fs.readFile(path.join(root, manifestPath), "utf8"));
  const bytes = edit(await fs.readFile(path.join(root, manifest.file.file)));
  if (rehash) Object.assign(manifest.file, { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
  await fs.mkdir(path.dirname(path.join(dir, manifest.file.file)), { recursive: true });
  await fs.writeFile(path.join(dir, manifest.file.file), bytes);
  await fs.mkdir(path.dirname(path.join(dir, manifestPath)), { recursive: true });
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

test("a changed byte fails the checksum before the workbook is read", async () => {
  const dir = await tampered(bytes => Buffer.concat([bytes, Buffer.from([0])]), false);
  await expect(prepareExpenditureTypes(dir)).rejects.toThrow(/source hash mismatch/);
});

test("wages 0.1 million GEL off break the running-costs identity", async () => {
  // C20 is compensation of employees 2002: 222.2.
  const dir = await tampered(bytes => editSheetXml(bytes, xml => xml.replace(/(<c r="C20"[^>]*><v>)222\.2[0-9]*/, "$1222.3")), true);
  await expect(prepareExpenditureTypes(dir)).rejects.toThrow(/identity failed: expense 2002/);
});

test("a non-zero consumption of fixed capital is refused", async () => {
  const dir = await tampered(bytes => editSheetXml(bytes, xml => xml.replace(/(<c r="C22"[^>]*><v>)0(<\/v>)/, "$15$2")), true);
  await expect(prepareExpenditureTypes(dir)).rejects.toThrow(/consumption of fixed capital 2002/i);
});

test("a cell with more precision than the file's one decimal is refused", async () => {
  const dir = await tampered(bytes => editSheetXml(bytes, xml => xml.replace(/(<c r="C20"[^>]*><v>)222\.2[0-9]*/, "$1222.25")), true);
  await expect(prepareExpenditureTypes(dir)).rejects.toThrow(/precision/);
});

test("a relabelled row is refused", async () => {
  const dir = await tampered(bytes => bytes, true);
  const manifest = JSON.parse(await fs.readFile(path.join(dir, manifestPath), "utf8"));
  manifest.file.rows["spending_type.interest"][2] = "Interest paid";
  await fs.writeFile(path.join(dir, manifestPath), JSON.stringify(manifest));
  await expect(prepareExpenditureTypes(dir)).rejects.toThrow(/code\/label mismatch: spending_type.interest/);
});
