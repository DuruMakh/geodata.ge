import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { prepareTaxBreaksRefunds, prepareTaxBreaksRefundsData } from "../../../lib/data/taxBreaksRefunds/prepareTaxBreaksRefunds";
import { validateTaxBreaksRefundsFacts } from "../../../lib/data/taxBreaksRefunds/validation";

const root = path.resolve(process.cwd(), "../..");
const packageDir = "docs/Raw Data/Revenue/tax-breaks-refunds";
const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true }))); });

const find = (facts: { indicatorId: string; year: number; value: string }[], id: string, year: number) =>
  facts.find(f => f.indicatorId === id && f.year === year)?.value;

test("the committed CSV and report are what the archived originals produce", async () => {
  await expect(prepareTaxBreaksRefundsData(root, "check")).resolves.toBeUndefined();
});

test("serves 105 tax-break rows for 2018-2024 and 18 refund rows for 2008-2025", async () => {
  const { facts } = await prepareTaxBreaksRefunds(root);
  expect(facts).toHaveLength(123);
  const breaks = facts.filter(f => f.indicatorId.startsWith("tax_breaks."));
  expect(breaks).toHaveLength(105);
  expect(new Set(breaks.map(f => f.year))).toEqual(new Set([2018, 2019, 2020, 2021, 2022, 2023, 2024]));
  const refunds = facts.filter(f => f.indicatorId === "tax_refunds.total");
  expect(refunds.map(f => f.year)).toEqual(Array.from({ length: 18 }, (_, i) => 2008 + i));
});

test("reads the Georgian workbook's cells and the Treasury series exactly", async () => {
  const { facts } = await prepareTaxBreaksRefunds(root);
  expect(Number(find(facts, "tax_breaks.total", 2024))).toBeCloseTo(6403.18, 2);
  expect(Number(find(facts, "tax_breaks.vat.total", 2018))).toBeCloseTo(2229.77, 2);
  // The English workbook's stale row says 406.1 here.
  expect(Number(find(facts, "tax_breaks.income.total", 2023))).toBeCloseTo(432.10, 2);
  expect(find(facts, "tax_refunds.total", 2025)).toBe("2721.10");
  expect(find(facts, "tax_refunds.total", 2008)).toBe("124");
  expect(find(facts, "tax_refunds.total", 2007)).toBeUndefined();
  expect(facts.find(f => f.indicatorId === "tax_refunds.total" && f.year === 2025)).toMatchObject({
    publishedValue: "2721.10", unit: "gel_million", sourceId: "treasury_tax_refunds_chart", sourceSheet: "newChart.xml", sourceCell: "series[0]/row[19]",
  });
});

// A copy of the package with one original replaced, optionally with the manifest's hash updated.
async function tampered(file: string, edit: (bytes: Buffer) => Buffer, rehash: boolean) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tax-breaks-refunds-"));
  temporary.push(dir);
  const manifest = JSON.parse(await fs.readFile(path.join(root, packageDir, "source-manifest.json"), "utf8"));
  for (const source of manifest.files) {
    let bytes: Buffer = await fs.readFile(path.join(root, packageDir, source.file));
    if (path.basename(source.file) === file) {
      bytes = edit(bytes);
      if (rehash) Object.assign(source, { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
    }
    await fs.mkdir(path.dirname(path.join(dir, packageDir, source.file)), { recursive: true });
    await fs.writeFile(path.join(dir, packageDir, source.file), bytes);
  }
  await fs.writeFile(path.join(dir, packageDir, "source-manifest.json"), JSON.stringify(manifest));
  return dir;
}

test("a changed byte fails the checksum before anything is parsed", async () => {
  const dir = await tampered("TER graphs GEO 2024.xlsx", bytes => Buffer.concat([bytes, Buffer.from([0])]), false);
  await expect(prepareTaxBreaksRefunds(dir)).rejects.toThrow(/source checksum mismatch/);
});

test("a new Treasury year-to-date column is refused", async () => {
  const xml = "treasury-newChart-2026-10-21.xml";
  const added = await tampered(xml, bytes => Buffer.from(bytes.toString("utf8")
    .replace('<row en="09.2026" ge="09.2026"></row>', '<row en="09.2026" ge="09.2026"></row>\n<row en="10.2026" ge="10.2026"></row>')
    .replace("<row>2103.10</row>", "<row>2103.10</row>\n<row>2300</row>")), true);
  await expect(prepareTaxBreaksRefunds(added)).rejects.toThrow(/Treasury refund categories changed/);
  const missing = await tampered(xml, bytes => Buffer.from(bytes.toString("utf8").replace('<row en="2015" ge="2015"></row>', "").replace("<row>129</row>\n\t\t\t<row>174</row>", "<row>174</row>")), true);
  await expect(prepareTaxBreaksRefunds(missing)).rejects.toThrow(/Treasury refund categories changed/);
});

test("VAT parts that miss the VAT total by 1 million are refused", async () => {
  const { facts } = await prepareTaxBreaksRefunds(root);
  const broken = facts.map(f => f.indicatorId === "tax_breaks.vat.education" && f.year === 2020 ? { ...f, value: "401.83125430563177", publishedValue: "401.83" } : f);
  expect(() => validateTaxBreaksRefundsFacts(broken)).toThrow(/VAT parts do not add up: 2020/);
});
