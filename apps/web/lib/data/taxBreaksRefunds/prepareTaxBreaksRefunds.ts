import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { serializeBomCsvRows } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readVerifiedPackageFile } from "../sourcePackage";
import {
  TAX_BREAKS_REFUNDS_CSV_PATH, TAX_BREAKS_REFUNDS_INDICATORS, TAX_BREAKS_REFUNDS_PACKAGE, TAX_BREAKS_REFUNDS_REPORT_PATH,
  type TaxBreaksRefundsAcceptance, type TaxBreaksRefundsFact, type TaxBreaksRefundsIndicator,
} from "./types";
import { validateTaxBreaksRefundsFacts } from "./validation";

export const REVIEWED_AT = "2026-10-21";
export const TAX_BREAKS_REFUNDS_CSV_HEADERS = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
// Self-closing empty cells (`<c r="B5" s="3"/>`) must not take the next cell's value.
const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
const NUMBER = /^[+-]?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/;

type RowMapping = [row: number, label: string];
type SheetMapping = { sheet: string; labelColumn: string; yearRow: number; firstYearColumn: string; rows: Record<string, RowMapping>; controlRows: Record<string, RowMapping> };
type Manifest = {
  reviewedAt: string; identityToleranceMillionGel: string;
  files: { sourceId: string; role: string; file: string; sha256: string; bytes: number }[];
  ministry: { sourceId: string; years: number[]; sheets: SheetMapping[] };
  treasury: { sourceId: string; seriesLabelKa: string; fullYears: number[]; servedFromYear: number };
};

const fact = (indicatorId: string, year: number, value: string, sourceId: string, sourceSheet: string, sourceCell: string): TaxBreaksRefundsFact => ({
  year, indicatorId: indicatorId as TaxBreaksRefundsIndicator, value, publishedValue: new D(value).toSignificantDigits(15).toFixed(2),
  unit: "gel_million", basis: "actual", valueStatus: "official", sourceId, sourceSheet, sourceCell, lastReviewedAt: REVIEWED_AT,
});

/** Every mapped row of the Ministry's Georgian workbook, read as the cell's stored number text; the control totals are checked, not served. */
function readMinistry(manifest: Manifest, bytes: Buffer): TaxBreaksRefundsFact[] {
  const { sourceId, years, sheets } = manifest.ministry;
  const book = XLSX.read(bytes, { type: "buffer" });
  const entries = unzipSync(bytes);
  const facts: TaxBreaksRefundsFact[] = [];
  const control = new Map<string, Decimal>();
  for (const mapping of sheets) {
    const index = book.SheetNames.indexOf(mapping.sheet);
    if (index < 0) throw new Error(`Tax breaks sheet missing: ${mapping.sheet}`);
    const sheet = book.Sheets[mapping.sheet];
    // Read each number's XML text before SheetJS turns it into a binary double.
    const numericText = new Map<string, string>();
    for (const match of strFromU8(entries[`xl/worksheets/sheet${index + 1}.xml`]).matchAll(CELL)) {
      const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
      const value = match[2] ? /<v>([^<]+)<\/v>/.exec(match[2])?.[1] : undefined;
      if (address && value && sheet[address]?.t === "n") numericText.set(address, value);
    }
    const first = XLSX.utils.decode_col(mapping.firstYearColumn);
    const at = (row: number, i: number) => `${XLSX.utils.encode_col(first + i)}${row}`;
    years.forEach((year, i) => { if (sheet[at(mapping.yearRow, i)]?.v !== year) throw new Error(`Tax breaks year header mismatch: ${mapping.sheet} ${year}`); });
    for (const [name, [row, label], isControl] of [
      ...Object.entries(mapping.rows).map(([n, r]) => [n, r, false] as const),
      ...Object.entries(mapping.controlRows).map(([n, r]) => [n, r, true] as const),
    ]) {
      if (String(sheet[`${mapping.labelColumn}${row}`]?.v ?? "").trim() !== label.trim()) throw new Error(`Tax breaks row label mismatch: ${mapping.sheet} ${name} row ${row}`);
      years.forEach((year, i) => {
        const address = at(row, i), raw = numericText.get(address);
        if (!raw || !NUMBER.test(raw)) throw new Error(`Tax breaks cell is not a number: ${mapping.sheet} ${address}`);
        if (isControl) control.set(`${name}:${year}`, new D(raw));
        else facts.push(fact(name, year, new D(raw).toFixed(), sourceId, mapping.sheet, address));
      });
    }
  }
  // Table 4's and Table 3's grand totals must equal the Figure 1 rows the page serves.
  const tolerance = new D(manifest.identityToleranceMillionGel);
  for (const year of years) for (const [name, id] of [["vatGrandTotal", "tax_breaks.vat.total"], ["incomeGrandTotal", "tax_breaks.income.total"]]) {
    const served = facts.find(f => f.indicatorId === id && f.year === year)!;
    if (control.get(`${name}:${year}`)!.minus(served.value).abs().gt(tolerance)) throw new Error(`Tax breaks table total differs from Figure 1: ${id} ${year}`);
  }
  return facts;
}

/** The Treasury chart's one series: whole years only, from the first served year; the year-to-date column is checked, never read. */
function readTreasury(manifest: Manifest, bytes: Buffer): TaxBreaksRefundsFact[] {
  const { sourceId, seriesLabelKa, fullYears, servedFromYear } = manifest.treasury;
  const xml = bytes.toString("utf8");
  const categories = [...(/<categories>([\s\S]*?)<\/categories>/.exec(xml)?.[1] ?? "").matchAll(/<row en="([^"]*)"/g)].map(m => m[1]);
  const series = [...xml.matchAll(/<item ge="([^"]*)"[^>]*>([\s\S]*?)<\/item>/g)];
  const expectedYears = fullYears.map(String);
  if (categories.length !== expectedYears.length + 1 || expectedYears.some((year, i) => categories[i] !== year) || !/^\d{2}\.\d{4}$/.test(categories.at(-1)!))
    throw new Error("Treasury refund categories changed");
  if (series.length !== 1 || series[0][1] !== seriesLabelKa) throw new Error("Treasury refund series changed");
  const values = [...series[0][2].matchAll(/<row>([^<]*)<\/row>/g)].map(m => m[1].trim());
  if (values.length !== categories.length || values.some(value => !NUMBER.test(value))) throw new Error("Treasury refund values changed");
  return fullYears.flatMap((year, i) => year < servedFromYear ? [] : [fact("tax_refunds.total", year, values[i], sourceId, "newChart.xml", `series[0]/row[${i + 1}]`)]);
}

/** Reads the archived package into the served observations, after every file passes its checksum. */
export async function prepareTaxBreaksRefunds(repositoryRoot: string): Promise<{ facts: TaxBreaksRefundsFact[] }> {
  const directory = path.join(repositoryRoot, TAX_BREAKS_REFUNDS_PACKAGE);
  const manifest: Manifest = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  const bytesById = new Map<string, Buffer>();
  for (const source of manifest.files) {
    const { bytes } = await readVerifiedPackageFile(directory, source.file, source, `Tax breaks and refunds source checksum mismatch: ${source.file}`);
    bytesById.set(source.sourceId, bytes);
  }
  const facts = [...readMinistry(manifest, bytesById.get(manifest.ministry.sourceId)!), ...readTreasury(manifest, bytesById.get(manifest.treasury.sourceId)!)];
  validateTaxBreaksRefundsFacts(facts);
  facts.sort((a, b) => TAX_BREAKS_REFUNDS_INDICATORS.indexOf(a.indicatorId) - TAX_BREAKS_REFUNDS_INDICATORS.indexOf(b.indicatorId) || a.year - b.year);
  return { facts };
}

/** Writes, or in check mode compares, the canonical CSV and its acceptance report. */
export async function prepareTaxBreaksRefundsData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const { facts } = await prepareTaxBreaksRefunds(repositoryRoot);
  const csv = serializeBomCsvRows([TAX_BREAKS_REFUNDS_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  const years = facts.map(f => f.year);
  const acceptance: TaxBreaksRefundsAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [[TAX_BREAKS_REFUNDS_CSV_PATH, csv], [TAX_BREAKS_REFUNDS_REPORT_PATH, `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("tax-breaks-refunds", target, content);
  }
}
