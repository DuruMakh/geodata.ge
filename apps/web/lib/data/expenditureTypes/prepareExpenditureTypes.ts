import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { strFromU8, unzipSync } from "fflate";
import { serializeBomCsvRows } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readVerifiedPackageFile } from "../sourcePackage";
import { sharePercent } from "../economicSectors/calculations";
import type { SectorDefinition, SectorObservation } from "../economicSectors/types";
import { EXPENDITURE_TYPES_CSV_PATH, EXPENDITURE_TYPES_REGISTRY_PATH, EXPENDITURE_TYPES_SOURCE_ID } from "./types";
import { validateExpenditureTypeObservations } from "./validation";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const MANIFEST_PATH = "docs/Raw Data/Budget/expenditure-types/source-manifest.json";
const REPORT_PATH = "data/reports/expenditure-types-validation.json";
const GDP_CSV_PATH = "data/imports/national-gdp-annual-1996-2025.csv";
const measures = ["nominal", "share_of_gdp"] as const;
type RowMapping = [row: number, code: string, label: string];
type Source = {
  sourceId: string; file: string; originalFilename: string; url: string; sha256: string; bytes: number;
  sheet: string; unit: string; decimals: number; headerRow: number; annualYears: number[]; firstAnnualColumn: string; lastAnnualColumn: string;
  titles: string[]; rows: Record<string, RowMapping>; controlRows: { consumptionOfFixedCapital: RowMapping };
};
type Manifest = { reviewedAt: string; capturedOn: string; sourcePage: string; identityToleranceMillionGel: string; file: Source };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// Self-closing empty cells (`<c r="B5" s="3"/>`) must not take the next cell's value.
const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

function openSource(source: Source, bytes: Buffer) {
  const book = XLSX.read(bytes, { type: "buffer" });
  if (!same(book.SheetNames, [source.sheet])) throw new Error("Unexpected spending by type source sheet");
  const sheet = book.Sheets[source.sheet];
  // Read each number's XML text before SheetJS turns it into a binary double.
  const entries = unzipSync(bytes);
  const sheetPaths = Object.keys(entries).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (sheetPaths.length !== 1) throw new Error("Unexpected spending by type worksheet files");
  const numericText = new Map<string, string>();
  for (const match of strFromU8(entries[sheetPaths[0]]).matchAll(CELL)) {
    const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
    const value = match[2] ? /<v>([^<]+)<\/v>/.exec(match[2])?.[1] : undefined;
    if (address && value && sheet[address]?.t === "n") numericText.set(address, value);
  }
  const text = (address: string) => String(sheet[address]?.v ?? "").trim();
  const labels = Object.values(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })).map(row => String(row[0] ?? "").trim());
  if (!source.titles.every(title => labels.includes(title))) throw new Error("Spending by type source title mismatch");
  for (const [name, [row, code, label]] of [...Object.entries(source.rows), ["consumptionOfFixedCapital", source.controlRows.consumptionOfFixedCapital] as const])
    if (text(`B${row}`) !== code || text(`A${row}`) !== label) throw new Error(`Source code/label mismatch: ${name} row ${row}`);
  const first = XLSX.utils.decode_col(source.firstAnnualColumn), last = XLSX.utils.decode_col(source.lastAnnualColumn);
  const range = XLSX.utils.decode_range(sheet["!ref"]!);
  const headers = Array.from({ length: range.e.c + 1 }, (_, c) => text(XLSX.utils.encode_cell({ r: source.headerRow - 1, c })));
  const years = headers.flatMap((header, c) => /^\d{4}$/.test(header) ? [[Number(header), c] as const] : []);
  if (!same(years.map(([y]) => y), source.annualYears) || years[0][1] !== first || years.at(-1)![1] !== last) throw new Error("Spending by type annual coverage mismatch");
  const column = new Map(years);
  const cell = ([row]: RowMapping, year: number) => {
    const at = XLSX.utils.encode_cell({ r: row - 1, c: column.get(year)! });
    const raw = numericText.get(at);
    if (!raw || !/^[+-]?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(raw)) throw new Error(`Invalid source numeric cell: ${at}`);
    // The Ministry types one decimal; Excel stores some as doubles such as 24834.300000000003.
    const value = new D(raw).toDecimalPlaces(source.decimals);
    if (value.minus(raw).abs().gt("0.000000001")) throw new Error(`Source cell has more precision than ${source.decimals} decimal: ${at}`);
    return { value, locator: `${source.sheet}!${at} [${year}]` };
  };
  return { cell };
}

export async function prepareExpenditureTypes(repositoryRoot: string) {
  const read = (file: string) => fs.readFile(path.join(repositoryRoot, file), "utf8");
  const manifest: Manifest = JSON.parse(await read(MANIFEST_PATH));
  const registry: SectorDefinition[] = JSON.parse(await read(EXPENDITURE_TYPES_REGISTRY_PATH));
  const source = manifest.file;
  if (manifest.identityToleranceMillionGel !== "0.05" || source.sourceId !== EXPENDITURE_TYPES_SOURCE_ID || source.unit !== "million_gel" || source.decimals !== 1)
    throw new Error("Unreviewed spending by type source contract");
  if (!same(Object.keys(source.rows), registry.map(r => r.id))) throw new Error("Source rows do not match the spending by type registry");
  const { bytes, sha256 } = await readVerifiedPackageFile(repositoryRoot, source.file, source, `Spending by type source hash mismatch: ${source.file}`);
  const { cell } = openSource(source, bytes);

  const gdpRows = parse(await read(GDP_CSV_PATH), { columns: true, bom: true }) as Record<string, string>[];
  const tolerance = new D(manifest.identityToleranceMillionGel);
  const facts: SectorObservation[] = [];
  const identities = source.annualYears.map(year => {
    const amount = (id: string) => cell(source.rows[id], year).value;
    const fixedCapital = cell(source.controlRows.consumptionOfFixedCapital, year).value;
    if (!fixedCapital.isZero()) throw new Error(`Consumption of fixed capital ${year} is not zero`);
    const parts = ["compensation", "goods_services", "interest", "subsidies", "grants", "social_benefits", "other"].map(id => amount(`spending_type.${id}`));
    const differences = {
      expense: parts.reduce((sum, part) => sum.plus(part), fixedCapital).minus(amount("spending_type.expense")),
      total: amount("spending_type.expense").plus(amount("spending_type.investment")).minus(amount("spending_type.total")),
    };
    for (const [name, difference] of Object.entries(differences))
      if (difference.abs().gt(tolerance)) throw new Error(`Spending by type identity failed: ${name} ${year}`);
    const gdp = gdpRows.filter(r => r.year === String(year));
    if (gdp.length !== 1) throw new Error(`Missing GDP for ${year}`);
    for (const id of Object.keys(source.rows)) {
      const input = cell(source.rows[id], year);
      const value = input.value.mul(1000000).toFixed();
      const fact: SectorObservation = {
        seriesId: id, year, measure: "nominal", value, unit: "gel", valuation: "market_prices", priceBasis: "current_prices",
        calculation: "published", status: "published", sourceId: source.sourceId, sourceLocator: input.locator, lastReviewedAt: manifest.reviewedAt,
      };
      facts.push(fact, {
        ...fact, measure: "share_of_gdp", value: sharePercent(value, gdp[0].gdp_current_prices_gel)!, unit: "percent", calculation: "ratio_to_gdp",
        status: gdp[0].status === "preliminary" ? "preliminary" : "published",
        sourceLocator: `${input.locator}; national-gdp-annual-1996-2025.csv [${year}]`,
      });
    }
    return { year, ...Object.fromEntries(Object.entries(differences).map(([name, d]) => [`${name}DifferenceMillionGel`, d.toFixed()])) };
  });
  validateExpenditureTypeObservations(facts, registry);
  const order = new Map(registry.map((r, i) => [r.id, i]));
  facts.sort((a, b) => order.get(a.seriesId)! - order.get(b.seriesId)! || measures.indexOf(a.measure as typeof measures[number]) - measures.indexOf(b.measure as typeof measures[number]) || a.year - b.year);
  const { rows: _rows, controlRows: _controls, ...sourceSummary } = source;
  return { facts, validation: {
    status: "PASS", reviewedAt: manifest.reviewedAt, capturedOn: manifest.capturedOn, sourcePage: manifest.sourcePage,
    counts: Object.fromEntries(measures.map(m => [m, facts.filter(f => f.measure === m).length])),
    identityToleranceMillionGel: manifest.identityToleranceMillionGel,
    preliminaryShareYears: [...new Set(facts.filter(f => f.status === "preliminary").map(f => f.year))],
    notServed: "Revenue, net operating balance, net lending/borrowing (the IMF balance stays on the Deficit page), financing, consumption of fixed capital (zero in every year).",
    sourceHashes: { [source.file]: sha256 },
    source: sourceSummary,
    identities,
  } };
}

export async function writeExpenditureTypesArtifacts(write: boolean, repositoryRoot = path.resolve(process.cwd(), "../..")) {
  const result = await prepareExpenditureTypes(repositoryRoot);
  const canonical = serializeBomCsvRows([
    ["series_id", "year", "measure", "value", "unit", "valuation", "price_basis", "calculation", "status", "source_id", "source_locator", "last_reviewed_at"],
    ...result.facts.map(f => [f.seriesId, f.year, f.measure, f.value, f.unit, f.valuation, f.priceBasis, f.calculation, f.status, f.sourceId, f.sourceLocator, f.lastReviewedAt]),
  ]);
  for (const [file, content] of [[EXPENDITURE_TYPES_CSV_PATH, canonical], [REPORT_PATH, JSON.stringify(result.validation, null, 2) + "\n"]]) {
    const target = path.join(repositoryRoot, file);
    if (write) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    } else await assertGeneratedArtifactMatches("Spending by type", target, content);
  }
  return result.validation;
}
