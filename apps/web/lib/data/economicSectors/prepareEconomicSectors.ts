import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { strFromU8, unzipSync } from "fflate";
import { csvEscape } from "../csvEscape";
import { annualGrowthPercent, indexToGrowthPercent, sharePercent } from "./calculations";
import type { SectorDefinition, SectorObservation, SectorStatus } from "./types";
import { validateSectorObservations } from "./validation";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const GDP = "economy.gdp_total";
const measures = ["nominal", "share_of_gdp", "real_growth"] as const;
type Source = {
  role: "nominal" | "growth" | "growth_validation";
  sourceId: string; file: string; sha256: string; bytes: number;
  sheet: string; annualYears: number[]; firstAnnualColumn: string; lastAnnualColumn: string;
  headerRow: number; activityRows: [number, number]; gdpRow: number;
  unit: string; conversion?: string; preliminaryYears: number[]; releasedAt: string;
};
type Manifest = {
  reviewedAt: string; capturedOn: string; classification: string; accountingStandard: string;
  nominalReconciliationToleranceMillionGel: string; growthCheckTolerancePercentagePoints: string;
  files: Source[];
};
const years = (first: number) => Array.from({ length: 2026 - first }, (_, i) => first + i);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function prepareEconomicSectors(repositoryRoot: string) {
  const read = (file: string) => fs.readFile(path.join(repositoryRoot, file));
  const manifest: Manifest = JSON.parse((await read("docs/Raw Data/Economy/economic-sectors/source-manifest.json")).toString("utf8"));
  const registry: SectorDefinition[] = JSON.parse((await read("data/taxonomy/economic-sectors.json")).toString("utf8"));
  if (manifest.nominalReconciliationToleranceMillionGel !== "0.00000001" ||
      manifest.growthCheckTolerancePercentagePoints !== "0.0000000001" ||
      manifest.accountingStandard !== "sna_2008" || manifest.classification !== "NACE Rev. 2 / GNC 006-2016")
    throw new Error("Unreviewed sector precision/classification contract");
  if (!same(manifest.files.map(s => s.role).sort(), ["growth", "growth_validation", "nominal"]))
    throw new Error("Unexpected sector source roles");
  const activities = registry.filter(s => s.classificationCode !== null).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!same(activities.map(s => s.classificationCode), "ABCDEFGHIJKLMNOPQRST".split("")) ||
      activities.some(s => s.id !== `sector.${s.classificationCode!.toLowerCase()}`) ||
      registry.length !== 21 || registry.filter(s => s.id === GDP && s.classificationCode === null).length !== 1)
    throw new Error("Unexpected sector registry codes");

  // Verify all three original byte streams before parsing any workbook.
  const buffers = new Map<string, Buffer>();
  const sourceHashes: Record<string, string> = {};
  for (const source of manifest.files) {
    const bytes = await read(source.file);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== source.sha256 || bytes.length !== source.bytes) throw new Error(`Sector source hash mismatch: ${source.file}`);
    buffers.set(source.role, bytes);
    sourceHashes[source.file] = hash;
  }
  const sources = manifest.files.map(source => {
    const expectedUnit = { nominal: "million_gel", growth: "previous_year_100_index", growth_validation: "million_gel_constant_2019_chain_linked" }[source.role];
    const expectedSourceId = { nominal: "source.geostat_national_gdp_sna_2008", growth: "source.geostat_sector_growth", growth_validation: "source.geostat_sector_volume" }[source.role];
    if (source.unit !== expectedUnit || source.headerRow !== 2 || !same(source.activityRows, [3, 22]) || source.gdpRow !== 26 ||
        !same(source.annualYears, years(source.role === "growth" ? 2011 : 2010)) || !same(source.preliminaryYears, [2025]) ||
        source.releasedAt !== "2026-06-19" || source.sourceId !== expectedSourceId ||
        (source.role === "growth" && source.conversion !== "subtract 100 using decimal arithmetic"))
      throw new Error(`Unreviewed source mapping: ${source.role}`);
    const book = XLSX.read(buffers.get(source.role)!, { type: "buffer" });
    if (!same(book.SheetNames, [source.sheet])) throw new Error(`Unexpected source sheet: ${source.role}`);
    const sheet = book.Sheets[source.sheet];
    // These hash-verified originals each contain one worksheet. Read its numeric
    // XML text before SheetJS converts it to a binary floating-point number.
    const entries = unzipSync(buffers.get(source.role)!);
    const sheetPaths = Object.keys(entries).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
    if (sheetPaths.length !== 1) throw new Error(`Unexpected source worksheet files: ${source.role}`);
    const numericText = new Map<string, string>();
    for (const match of strFromU8(entries[sheetPaths[0]]).matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
      const value = /<v>([^<]+)<\/v>/.exec(match[2])?.[1];
      if (address && value && sheet[address]?.t === "n") numericText.set(address, value);
    }
    const text = (address: string) => String(sheet[address]?.v ?? "").trim();
    if (text("A2").replace(/\s+/g, " ") !== "NACE Rev. 2") throw new Error("Source classification mismatch");
    const rowMappings = [...activities.map((s, i) => ({ ...s, row: i + 3 })), { ...registry.find(s => s.id === GDP)!, row: 26 }];
    for (const sector of rowMappings) {
      if ((sector.classificationCode !== null && text(`A${sector.row}`) !== sector.classificationCode) || text(`B${sector.row}`) !== sector.officialName)
        throw new Error(`Source code/label mismatch: ${source.role} row ${sector.row}`);
    }
    ["(=) GDP at basic prices", "(+) Taxes on products", "(-) Subsidies on products"].forEach((label, i) => {
      if (text(`B${23 + i}`) !== label) throw new Error(`Control code/label mismatch: ${source.role}`);
    });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const notes = rows.slice(26).flat().filter((v): v is string => typeof v === "string");
    if (!notes.includes("* Revised data will be published on November 16, 2026.") || !notes.includes("Last update: 19.06.2026"))
      throw new Error(`Source preliminary note/release mismatch: ${source.role}`);
    const annual = new Map<number, { column: number; header: string; status: SectorStatus }>();
    rows[1].forEach((header, column) => {
      const match = /^(\d{4})(\*)?$/.exec(String(header));
      if (!match) return;
      const year = Number(match[1]);
      if (annual.has(year)) throw new Error(`Duplicate annual header: ${source.role} ${year}`);
      if (Boolean(match[2]) !== source.preliminaryYears.includes(year)) throw new Error(`Source preliminary header mismatch: ${source.role} ${year}`);
      annual.set(year, { column, header: String(header), status: match[2] ? "preliminary" : "published" });
    });
    if (!same([...annual.keys()], source.annualYears) ||
        XLSX.utils.encode_col([...annual.values()][0]?.column ?? 0) !== source.firstAnnualColumn ||
        XLSX.utils.encode_col([...annual.values()].at(-1)?.column ?? 0) !== source.lastAnnualColumn)
      throw new Error(`Annual coverage mismatch: ${source.role}`);
    const cell = (year: number, row: number) => {
      const header = annual.get(year);
      if (!header) throw new Error(`Missing annual input: ${source.role} ${year}`);
      const address = XLSX.utils.encode_cell({ r: row - 1, c: header.column });
      const raw = numericText.get(address);
      if (!raw || !/^[+-]?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(raw)) throw new Error(`Invalid source numeric cell: ${source.role} ${address}`);
      return { value: new D(raw).toFixed(), status: header.status, locator: `${source.sheet}!${address} [${header.header}]` };
    };
    return { source, annual, notes, rowMappings, cell };
  });
  const nominal = sources.find(s => s.source.role === "nominal")!;
  const growth = sources.find(s => s.source.role === "growth")!;
  const volume = sources.find(s => s.source.role === "growth_validation")!;
  const overview = parse(await read("data/imports/gdp-overview-annual.csv"), { columns: true, bom: true }) as Record<string, string>[];
  const facts: SectorObservation[] = [];
  const reconciliation = nominal.source.annualYears.map(year => {
    const gel = (row: number) => new D(nominal.cell(year, row).value).mul(1000000);
    const sum = activities.reduce((total, _, i) => total.plus(gel(i + 3)), new D(0));
    const basic = gel(23), taxes = gel(24), subsidies = gel(25), gdp = gel(26);
    const gvaDifference = sum.minus(basic), gdpDifference = basic.plus(taxes).minus(subsidies).minus(gdp);
    const tolerance = new D(manifest.nominalReconciliationToleranceMillionGel).mul(1000000);
    if (gvaDifference.abs().gt(tolerance)) throw new Error(`GVA reconciliation failed: ${year}`);
    if (gdpDifference.abs().gt(tolerance)) throw new Error(`GDP reconciliation failed: ${year}`);
    const reference = overview.filter(f => f.series_id === "nominal_gel" && f.year === String(year));
    // The existing overview retains SheetJS's number representation. Verify that
    // exact legacy projection without rounding the sector source or rewriting it.
    const overviewProjection = new D(String(Number(nominal.cell(year, 26).value))).mul(1000000);
    if (reference.length !== 1 || reference[0].value !== overviewProjection.toFixed()) throw new Error(`Exact overview GDP parity failed: ${year}`);
    for (const sector of nominal.rowMappings) {
      const input = nominal.cell(year, sector.row), denominator = nominal.cell(year, 26);
      const value = gel(sector.row).toFixed();
      const fact: SectorObservation = {
        seriesId: sector.id, year, measure: "nominal", value, unit: "gel",
        valuation: sector.id === GDP ? "market_prices" : "basic_prices", priceBasis: "current_prices",
        calculation: "published", status: input.status, sourceId: nominal.source.sourceId,
        sourceLocator: input.locator, lastReviewedAt: manifest.reviewedAt,
      };
      facts.push(fact, { ...fact, measure: "share_of_gdp", value: sharePercent(value, gdp.toFixed())!, unit: "percent",
        calculation: "ratio_to_gdp", status: input.status === "preliminary" || denominator.status === "preliminary" ? "preliminary" : "published",
        sourceLocator: `${input.locator}; ${denominator.locator}` });
    }
    return { year, summedSectorGvaGel: sum.toFixed(), publishedBasicPriceTotalGel: basic.toFixed(), productTaxesGel: taxes.toFixed(),
      productSubsidiesGel: subsidies.toFixed(), marketPriceGdpGel: gdp.toFixed(), gvaDifferenceGel: gvaDifference.toFixed(),
      gdpDifferenceGel: gdpDifference.toFixed(), toleranceGel: tolerance.toFixed(), overviewGdpParity: true,
      overviewRepresentationDifferenceGel: gdp.minus(reference[0].value).toFixed() };
  });
  const growthChecks = [];
  for (const year of growth.source.annualYears) {
    for (const sector of growth.rowMappings) {
      const input = growth.cell(year, sector.row), current = volume.cell(year, sector.row), previous = volume.cell(year - 1, sector.row);
      const value = indexToGrowthPercent(input.value)!;
      const calculated = annualGrowthPercent(current.value, previous.value);
      if (calculated === null) throw new Error(`Invalid growth volume denominator: ${sector.id} ${year}`);
      const difference = new D(value).minus(calculated);
      const status = current.status === "preliminary" || previous.status === "preliminary" ? "preliminary" : "published";
      if (difference.abs().gt(manifest.growthCheckTolerancePercentagePoints) || input.status !== status)
        throw new Error(`Growth check failed: ${sector.id} ${year}`);
      facts.push({ seriesId: sector.id, year, measure: "real_growth", value, unit: "percent",
        valuation: sector.id === GDP ? "market_prices" : "basic_prices", priceBasis: "volume_change", calculation: "index_to_growth",
        status: input.status, sourceId: growth.source.sourceId, sourceLocator: input.locator, lastReviewedAt: manifest.reviewedAt });
      growthChecks.push({ seriesId: sector.id, year, publishedIndex: input.value, growthPercent: value,
        currentVolume: current.value, previousVolume: previous.value, calculatedGrowthPercent: calculated,
        differencePercentagePoints: difference.toFixed(), status, indexLocator: input.locator,
        volumeLocators: `${current.locator}; ${previous.locator}` });
    }
  }
  const { missingCells } = validateSectorObservations(facts, registry);
  if (missingCells.length !== 21 || missingCells.some(f => f.year !== 2010 || f.measure !== "real_growth")) throw new Error("Unexpected sector missing cells");
  facts.sort((a, b) => (a.seriesId < b.seriesId ? -1 : a.seriesId > b.seriesId ? 1 : 0) || measures.indexOf(a.measure) - measures.indexOf(b.measure) || a.year - b.year);
  return { facts, reconciliation, validation: {
    status: "PASS", reviewedAt: manifest.reviewedAt, capturedOn: manifest.capturedOn,
    counts: Object.fromEntries(measures.map(measure => [measure, facts.filter(f => f.measure === measure).length])),
    countsByStatus: Object.fromEntries(measures.map(measure => [measure, Object.fromEntries(["published", "preliminary"].map(status => [status, facts.filter(f => f.measure === measure && f.status === status).length]))])),
    availableObservations: facts.length, fullGridObservations: 1008, missingCells,
    missingGrowthReason: "2010: no published annual index and no compatible 2009 volume input; approved growth coverage is 2011-2025.",
    coverage: registry.map(s => ({ seriesId: s.id, yearsByMeasure: Object.fromEntries(measures.map(measure => [measure, facts.filter(f => f.seriesId === s.id && f.measure === measure).map(f => f.year)])) })),
    sourceHashes, sourceVintages: sources.map(s => ({ ...s.source, notes: s.notes })),
    nominalReconciliationToleranceMillionGel: manifest.nominalReconciliationToleranceMillionGel,
    growthCheckTolerancePercentagePoints: manifest.growthCheckTolerancePercentagePoints,
    reconciliation, growthChecks,
  } };
}

const csv = (headers: string[], rows: (string | number | boolean)[][]) => "\uFEFF" + [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\n") + "\n";

export async function writeEconomicSectorsArtifacts(write: boolean, repositoryRoot = path.resolve(process.cwd(), "../..")) {
  const result = await prepareEconomicSectors(repositoryRoot);
  const canonical = csv(["series_id", "year", "measure", "value", "unit", "valuation", "price_basis", "calculation", "status", "source_id", "source_locator", "last_reviewed_at"],
    result.facts.map(f => [f.seriesId, f.year, f.measure, f.value, f.unit, f.valuation, f.priceBasis, f.calculation, f.status, f.sourceId, f.sourceLocator, f.lastReviewedAt]));
  const staging = csv(["year", "summed_sector_gva_gel", "published_basic_price_total_gel", "product_taxes_gel", "product_subsidies_gel", "market_price_gdp_gel", "gva_difference_gel", "gdp_difference_gel", "tolerance_gel", "overview_gdp_parity"],
    result.reconciliation.map(r => [r.year, r.summedSectorGvaGel, r.publishedBasicPriceTotalGel, r.productTaxesGel, r.productSubsidiesGel, r.marketPriceGdpGel, r.gvaDifferenceGel, r.gdpDifferenceGel, r.toleranceGel, r.overviewGdpParity]));
  for (const [file, content] of [
    ["data/imports/economic-sectors-annual.csv", canonical],
    ["data/staging/economic-sectors-reconciliation.csv", staging],
    ["data/reports/economic-sectors-validation.json", JSON.stringify(result.validation, null, 2) + "\n"],
  ]) {
    const target = path.join(repositoryRoot, file);
    const expected = Buffer.from(content, "utf8");
    if (write) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, expected);
    } else if (!(await fs.readFile(target)).equals(expected)) throw new Error(`Generated economic sectors artifact is stale: ${file}`);
  }
  return result.validation;
}
