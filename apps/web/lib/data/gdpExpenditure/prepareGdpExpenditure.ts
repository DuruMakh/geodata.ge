import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { strFromU8, unzipSync } from "fflate";
import { serializeBomCsvRows } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readVerifiedPackageFile } from "../sourcePackage";
import { annualGrowthPercent, indexToGrowthPercent, sharePercent } from "../economicSectors/calculations";
import type { SectorDefinition, SectorObservation, SectorStatus } from "../economicSectors/types";
import { GDP_EXPENDITURE_CSV_PATH, GDP_EXPENDITURE_GDP as GDP, GDP_EXPENDITURE_REGISTRY_PATH } from "./types";
import { validateGdpExpenditureObservations } from "./validation";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const MANIFEST_PATH = "docs/Raw Data/Economy/gdp-expenditure/source-manifest.json";
const REPORT_PATH = "data/reports/gdp-expenditure-validation.json";
const SECTORS_CSV_PATH = "data/imports/economic-sectors-annual.csv";
const measures = ["nominal", "share_of_gdp", "real_growth"] as const;
type Role = "nominal" | "growth" | "growth_validation";
type RowMapping = [row: number, code: string, label: string];
type Source = {
  role: Role; sourceId: string; file: string; originalFilename: string; url: string; sha256: string; bytes: number; releasedAt: string;
  sheet: string; unit: string; conversion?: string; annualYears: number[]; firstAnnualColumn: string; lastAnnualColumn: string;
  preliminaryYears: number[]; rows: Record<string, RowMapping>; controlRows: Record<string, RowMapping>; notes: string[];
};
type Manifest = {
  reviewedAt: string; capturedOn: string; accountingStandard: string;
  identityToleranceGel: string; growthCheckTolerancePercentagePoints: string; files: Source[];
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// Self-closing empty cells (`<c r="B5" s="3"/>`) must not take the next cell's value.
const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

function openSource(source: Source, bytes: Buffer) {
  const book = XLSX.read(bytes, { type: "buffer" });
  if (!same(book.SheetNames, [source.sheet])) throw new Error(`Unexpected source sheet: ${source.role}`);
  const sheet = book.Sheets[source.sheet];
  // Read each number's XML text before SheetJS turns it into a binary double.
  const entries = unzipSync(bytes);
  const sheetPaths = Object.keys(entries).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (sheetPaths.length !== 1) throw new Error(`Unexpected source worksheet files: ${source.role}`);
  const numericText = new Map<string, string>();
  for (const match of strFromU8(entries[sheetPaths[0]]).matchAll(CELL)) {
    const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
    const value = match[2] ? /<v>([^<]+)<\/v>/.exec(match[2])?.[1] : undefined;
    if (address && value && sheet[address]?.t === "n") numericText.set(address, value);
  }
  const text = (address: string) => String(sheet[address]?.v ?? "").trim();
  for (const [name, [row, code, label]] of [...Object.entries(source.rows), ...Object.entries(source.controlRows)])
    if (text(`A${row}`) !== code || text(`B${row}`) !== label) throw new Error(`Source code/label mismatch: ${source.role} ${name} row ${row}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const notes = rows.flat().filter((v): v is string => typeof v === "string").map(v => v.trim());
  // Edition guard: both notes identify the archived release (refresh step in docs/data-methodology/gdp-expenditure.md).
  if (!source.notes.every(note => notes.includes(note))) throw new Error(`Source release note mismatch: ${source.role}`);
  const annual = new Map<number, { column: number; header: string; status: SectorStatus }>();
  (rows[1] ?? []).forEach((header, column) => {
    const match = /^(\d{4})(\*)?$/.exec(String(header ?? "").trim());
    if (!match) return;
    const year = Number(match[1]);
    if (annual.has(year)) throw new Error(`Duplicate annual header: ${source.role} ${year}`);
    if (Boolean(match[2]) !== source.preliminaryYears.includes(year)) throw new Error(`Source preliminary header mismatch: ${source.role} ${year}`);
    annual.set(year, { column, header: String(header).trim(), status: match[2] ? "preliminary" : "published" });
  });
  const columns = [...annual.values()].map(h => XLSX.utils.encode_col(h.column));
  if (!same([...annual.keys()], source.annualYears) || columns[0] !== source.firstAnnualColumn || columns.at(-1) !== source.lastAnnualColumn)
    throw new Error(`Annual coverage mismatch: ${source.role}`);
  const address = (year: number, row: number) => XLSX.utils.encode_cell({ r: row - 1, c: annual.get(year)!.column });
  // Geostat's `…` (no data) and `x` (not applicable) rows must stay non-numeric in every annual column.
  for (const [name, [row]] of Object.entries(source.controlRows)) {
    if (name === "gdpCheck") continue;
    for (const year of annual.keys()) if (numericText.has(address(year, row))) throw new Error(`Unexpected number in ${source.role} ${name} ${year}`);
  }
  const cell = (seriesId: string, year: number) => {
    const header = annual.get(year);
    const mapping = seriesId in source.rows ? source.rows[seriesId] : source.controlRows[seriesId];
    if (!header || !mapping) throw new Error(`Missing annual input: ${source.role} ${seriesId} ${year}`);
    const at = address(year, mapping[0]);
    const raw = numericText.get(at);
    if (!raw || !/^[+-]?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(raw)) throw new Error(`Invalid source numeric cell: ${source.role} ${at}`);
    return { value: new D(raw).toFixed(), status: header.status, locator: `${source.sheet}!${at} [${header.header}]` };
  };
  return { source, notes: source.notes, cell };
}

export async function prepareGdpExpenditure(repositoryRoot: string) {
  const read = (file: string) => fs.readFile(path.join(repositoryRoot, file), "utf8");
  const manifest: Manifest = JSON.parse(await read(MANIFEST_PATH));
  const registry: SectorDefinition[] = JSON.parse(await read(GDP_EXPENDITURE_REGISTRY_PATH));
  if (manifest.identityToleranceGel !== "0.01" || manifest.growthCheckTolerancePercentagePoints !== "0.0000000001" || manifest.accountingStandard !== "sna_2008")
    throw new Error("Unreviewed GDP by expenditure tolerance/standard contract");
  if (!same(manifest.files.map(s => s.role), ["nominal", "growth", "growth_validation"])) throw new Error("Unexpected GDP by expenditure source roles");
  const expected = {
    nominal: ["source.geostat_gdp_use_current", "million_gel"],
    growth: ["source.geostat_gdp_use_growth", "previous_year_100_index"],
    growth_validation: ["source.geostat_gdp_use_volume", "million_gel_constant_2019"],
  } as const;
  const sourceHashes: Record<string, string> = {};
  const opened = new Map<Role, ReturnType<typeof openSource>>();
  // Verify every original byte stream before parsing any workbook.
  const buffers = new Map<Role, Buffer>();
  for (const source of manifest.files) {
    if (source.sourceId !== expected[source.role][0] || source.unit !== expected[source.role][1] ||
        (source.role === "growth" && source.conversion !== "subtract 100 using decimal arithmetic"))
      throw new Error(`Unreviewed source mapping: ${source.role}`);
    const { bytes, sha256 } = await readVerifiedPackageFile(repositoryRoot, source.file, source, `GDP by expenditure source hash mismatch: ${source.file}`);
    buffers.set(source.role, bytes);
    sourceHashes[source.file] = sha256;
  }
  for (const source of manifest.files) opened.set(source.role, openSource(source, buffers.get(source.role)!));
  const nominal = opened.get("nominal")!, growth = opened.get("growth")!, volume = opened.get("growth_validation")!;
  const registryIds = registry.map(r => r.id);
  const servedIds = [...new Set([...Object.keys(nominal.source.rows), ...Object.keys(growth.source.rows)])].sort();
  if (!same(servedIds, [...registryIds].sort()) || !same(Object.keys(growth.source.rows), Object.keys(volume.source.rows)))
    throw new Error("Source rows do not match the GDP by expenditure registry");
  const lastYear = Math.max(...nominal.source.annualYears);
  if (!manifest.files.every(s => Math.max(...s.annualYears) === lastYear && same(s.preliminaryYears, nominal.source.preliminaryYears)))
    throw new Error("GDP by expenditure sources must end together");

  const sectors = parse(await read(SECTORS_CSV_PATH), { columns: true, bom: true }) as Record<string, string>[];
  const tolerance = new D(manifest.identityToleranceGel);
  const facts: SectorObservation[] = [];
  const identities = nominal.source.annualYears.map(year => {
    const gel = (id: string) => new D(nominal.cell(id, year).value).mul(1000000);
    const gdp = gel(GDP);
    const sectorsGdp = sectors.filter(f => f.series_id === GDP && f.measure === "nominal" && f.year === String(year));
    if (sectorsGdp.length !== 1) throw new Error(`Missing Sectors GDP for ${year}`);
    const differences = {
      gdpByUse: gel("gdp_use.consumption").plus(gel("gdp_use.investment")).plus(gel("gdp_use.exports")).minus(gel("gdp_use.imports")).minus(gdp),
      gdpCheckRow: gel("gdpCheck").minus(gdp),
      sectorsGdp: new D(sectorsGdp[0].value).minus(gdp),
      consumption: gel("gdp_use.households").plus(gel("gdp_use.npish")).plus(gel("gdp_use.government")).minus(gel("gdp_use.consumption")),
      government: gel("gdp_use.government_individual").plus(gel("gdp_use.government_collective")).minus(gel("gdp_use.government")),
      investment: gel("gdp_use.fixed_capital").plus(gel("gdp_use.inventories")).minus(gel("gdp_use.investment")),
      exports: gel("gdp_use.exports_goods").plus(gel("gdp_use.exports_services")).minus(gel("gdp_use.exports")),
      imports: gel("gdp_use.imports_goods").plus(gel("gdp_use.imports_services")).minus(gel("gdp_use.imports")),
    };
    for (const [name, difference] of Object.entries(differences))
      if (difference.abs().gt(tolerance)) throw new Error(`GDP by expenditure identity failed: ${name} ${year}`);
    const denominator = nominal.cell(GDP, year);
    for (const id of Object.keys(nominal.source.rows)) {
      const input = nominal.cell(id, year);
      const value = gel(id).toFixed();
      const fact: SectorObservation = {
        seriesId: id, year, measure: "nominal", value, unit: "gel", valuation: "market_prices", priceBasis: "current_prices",
        calculation: "published", status: input.status, sourceId: nominal.source.sourceId, sourceLocator: input.locator, lastReviewedAt: manifest.reviewedAt,
      };
      facts.push(fact, {
        ...fact, measure: "share_of_gdp", value: sharePercent(value, gdp.toFixed())!, unit: "percent", calculation: "ratio_to_gdp",
        status: input.status === "preliminary" || denominator.status === "preliminary" ? "preliminary" : "published",
        sourceLocator: `${input.locator}; ${denominator.locator}`,
      });
    }
    return { year, ...Object.fromEntries(Object.entries(differences).map(([name, d]) => [`${name}DifferenceGel`, d.toFixed()])) };
  });

  const growthChecks = [];
  for (const year of growth.source.annualYears) {
    for (const id of Object.keys(growth.source.rows)) {
      const input = growth.cell(id, year), current = volume.cell(id, year), previous = volume.cell(id, year - 1);
      const value = indexToGrowthPercent(input.value)!;
      const calculated = annualGrowthPercent(current.value, previous.value);
      if (calculated === null) throw new Error(`Invalid growth volume denominator: ${id} ${year}`);
      const difference = new D(value).minus(calculated);
      const status = current.status === "preliminary" || previous.status === "preliminary" ? "preliminary" : "published";
      if (difference.abs().gt(manifest.growthCheckTolerancePercentagePoints) || input.status !== status)
        throw new Error(`Growth check failed: ${id} ${year}`);
      facts.push({ seriesId: id, year, measure: "real_growth", value, unit: "percent", valuation: "market_prices", priceBasis: "volume_change",
        calculation: "index_to_growth", status: input.status, sourceId: growth.source.sourceId, sourceLocator: input.locator, lastReviewedAt: manifest.reviewedAt });
      growthChecks.push({ seriesId: id, year, publishedIndex: input.value, growthPercent: value, calculatedGrowthPercent: calculated,
        differencePercentagePoints: difference.toFixed(), indexLocator: input.locator, volumeLocators: `${current.locator}; ${previous.locator}` });
    }
  }
  validateGdpExpenditureObservations(facts, registry);
  const order = new Map(registryIds.map((id, i) => [id, i]));
  facts.sort((a, b) => order.get(a.seriesId)! - order.get(b.seriesId)! || measures.indexOf(a.measure) - measures.indexOf(b.measure) || a.year - b.year);
  return { facts, validation: {
    status: "PASS", reviewedAt: manifest.reviewedAt, capturedOn: manifest.capturedOn,
    counts: Object.fromEntries(measures.map(m => [m, facts.filter(f => f.measure === m).length])),
    preliminaryYears: nominal.source.preliminaryYears,
    identityToleranceGel: manifest.identityToleranceGel,
    growthCheckTolerancePercentagePoints: manifest.growthCheckTolerancePercentagePoints,
    notServed: "Net acquisition of valuables (Geostat prints …), growth of change in inventories (x), quarterly and 2026 columns, GDP at basic prices, product taxes and subsidies.",
    sourceHashes,
    sources: manifest.files.map(({ rows: _rows, controlRows: _controls, ...source }) => source),
    identities, growthChecks,
  } };
}

export async function writeGdpExpenditureArtifacts(write: boolean, repositoryRoot = path.resolve(process.cwd(), "../..")) {
  const result = await prepareGdpExpenditure(repositoryRoot);
  const canonical = serializeBomCsvRows([
    ["series_id", "year", "measure", "value", "unit", "valuation", "price_basis", "calculation", "status", "source_id", "source_locator", "last_reviewed_at"],
    ...result.facts.map(f => [f.seriesId, f.year, f.measure, f.value, f.unit, f.valuation, f.priceBasis, f.calculation, f.status, f.sourceId, f.sourceLocator, f.lastReviewedAt]),
  ]);
  for (const [file, content] of [[GDP_EXPENDITURE_CSV_PATH, canonical], [REPORT_PATH, JSON.stringify(result.validation, null, 2) + "\n"]]) {
    const target = path.join(repositoryRoot, file);
    if (write) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    } else await assertGeneratedArtifactMatches("GDP by expenditure", target, content);
  }
  return result.validation;
}
