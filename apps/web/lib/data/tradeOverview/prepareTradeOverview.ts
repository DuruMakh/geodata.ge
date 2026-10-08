import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { TRADE_OVERVIEW_SOURCE, TRADE_OVERVIEW_SHEET, TRADE_OVERVIEW_INDICATORS, type TradeOverviewFact, type TradeOverviewAcceptance } from "./types";
import { tradeOverviewSourceRefs, validateTradeOverviewFacts } from "./validation";

const D = Decimal.clone({ precision: 50 });
const RESEARCH = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07";
const REVIEWED_AT = "2026-10-08";
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };
type Layout = { family: string; flow: string; source_id: string; source_sheet: string; source_unit: string; year_columns: Record<string, string>; rows: { row_index: number; role: string; item_id: string; dimensions: { geography_id: string } }[] };
type Row = Record<string, string>;
const headers = ["year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "last_reviewed_at"];

export async function prepareTradeOverviewData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const readJson = async <T>(name: string): Promise<T> => JSON.parse(await fs.readFile(path.join(directory, name), "utf8"));
  const readCsv = async (name: string): Promise<Row[]> => parse(await fs.readFile(path.join(directory, name)), { columns: true, bom: true, skip_empty_lines: true });
  const sources = await readJson<Source[]>("full-source-manifest.json");
  const matching = sources.filter(source => source.source_id === TRADE_OVERVIEW_SOURCE);
  if (matching.length !== 1 || matching[0].local_file !== "official/FTrade_1995-2026.xlsx") throw new Error("Trade source inventory mismatch");
  const { bytes, sha256 } = await readVerifiedPackageFile(directory, matching[0].local_file, matching[0], "Trade source capture mismatch");
  const workbook = XLSX.read(bytes, { type: "buffer", cellNF: true });
  const sheet = workbook.Sheets[TRADE_OVERVIEW_SHEET];
  if (!sheet || sheet.A3?.v !== "(Mill. USD)") throw new Error("Trade source unit/sheet mismatch");
  const layouts = (await readJson<Layout[]>("source-layouts.json")).filter(layout => layout.family === "goods_national");
  if (layouts.length !== 2 || ["export", "import"].some(flow => layouts.filter(layout => layout.flow === flow).length !== 1)) throw new Error("Trade source layout mismatch");
  const years = Object.keys(layouts[0].year_columns).map(Number).sort((a, b) => a - b);
  const numericHeaders = Object.entries(sheet).filter(([cell, value]) => /^[A-Z]+4$/.test(cell) && value.t === "n").map(([, value]) => Number(value.v)).sort((a, b) => a - b);
  if (JSON.stringify(years) !== JSON.stringify(numericHeaders) || years[0] !== 1995 || years.at(-1) !== 2025) throw new Error("Trade source coverage mismatch");
  const coverage = (await readCsv("coverage.csv")).filter(row => row.family === "goods_national");
  const coverageKeys = new Set(coverage.map(row => `${row.flow}:${row.year}`));
  if (coverage.length !== years.length * 2 || coverageKeys.size !== coverage.length || years.some(year => ["export", "import"].some(flow => !coverageKeys.has(`${flow}:${year}`))) || coverage.some(row => row.source_id !== TRADE_OVERVIEW_SOURCE || row.source_sheet !== TRADE_OVERVIEW_SHEET || row.numeric_count !== "1" || row.source_key_count !== "1")) throw new Error("Trade reviewed coverage inventory mismatch");
  const xml = strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
  const stored = new Map<string, string>();
  for (const match of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
    const token = /<v>([^<]+)<\/v>/.exec(match[2])?.[1];
    if (address && token && sheet[address]?.t === "n") stored.set(address, token);
  }
  const primary = await readCsv("goods-national-annual.csv");
  if (primary.length !== years.length * 2) throw new Error("Trade primary coverage mismatch");
  const facts: TradeOverviewFact[] = [];
  const common = { unit: "usd" as const, basis: "actual" as const, valueStatus: "numeric" as const, publicationStatus: "unspecified" as const, sourceId: TRADE_OVERVIEW_SOURCE, lastReviewedAt: REVIEWED_AT };
  for (const row of primary) {
    const year = Number(row.year);
    const layout = layouts.find(layout => layout.flow === row.flow);
    const indicatorId = row.flow === "export" ? "trade.exports" : "trade.imports";
    if (!layout || !years.includes(year)) throw new Error("Trade primary coverage contains unsupported flow/year");
    const column = layout.year_columns[row.year];
    const sourceRow = layout.rows[0];
    if (layout.source_id !== TRADE_OVERVIEW_SOURCE || layout.source_sheet !== TRADE_OVERVIEW_SHEET || layout.source_unit !== "million_usd" || Number(sheet[`${column}4`]?.v) !== year || sourceRow.role !== "total" || sourceRow.item_id !== "goods.total" || sourceRow.dimensions.geography_id !== "georgia") throw new Error("Trade source layout contract mismatch");
    if (row.geography_id !== "georgia" || row.item_id !== "goods.total" || row.role !== "total" || row.value_status !== "numeric" || row.publication_status !== "unspecified" || row.source_id !== TRADE_OVERVIEW_SOURCE || row.source_sheet !== TRADE_OVERVIEW_SHEET || row.source_unit !== "million_usd" || row.source_block !== "1995-2025" || row.source_cell !== `${column}${sourceRow.row_index}` || row.source_label !== sheet[`A${sourceRow.row_index}`]?.v || row.source_number_format !== sheet[row.source_cell]?.z) throw new Error(`Trade source cell/metadata mismatch: ${row.year}:${row.flow}`);
    if (stored.get(row.source_cell) !== row.source_value) throw new Error(`Trade source cell value mismatch: ${row.source_cell}`);
    const value = new D(row.source_value).mul(1_000_000);
    if (!value.eq(row.value_usd)) throw new Error(`Trade USD conversion mismatch: ${row.source_cell}`);
    facts.push({ ...common, year, indicatorId, valueUsd: value.toFixed(), role: "total", sourceRefs: JSON.stringify([[row.source_id, row.source_sheet, row.source_cell]]), sourceValue: row.source_value, sourceUnit: row.source_unit, sourceLabel: row.source_label, sourceNumberFormat: row.source_number_format });
  }
  const derived = (await readCsv("derived-annual.csv")).filter(row => row.domain === "goods" && row.dimension === "national" && row.item_id === "goods.total" && ["trade_balance", "trade_turnover"].includes(row.indicator_id));
  if (derived.length !== years.length * 2) throw new Error("Trade derived coverage or duplicate mismatch");
  for (const row of derived) {
    const year = Number(row.year);
    const indicatorId = row.indicator_id === "trade_balance" ? "trade.balance" : "trade.turnover";
    if (!years.includes(year) || row.value_status !== "numeric" || row.publication_status !== "unspecified" || row.role !== "derived" || row.input_source_refs !== tradeOverviewSourceRefs(year, indicatorId)) throw new Error(`Trade derived source contract mismatch: ${row.year}:${row.indicator_id}`);
    facts.push({ ...common, year, indicatorId, valueUsd: new D(row.value_usd).toFixed(), role: "derived", sourceRefs: row.input_source_refs, sourceValue: null, sourceUnit: null, sourceLabel: null, sourceNumberFormat: null });
  }
  validateTradeOverviewFacts(facts, years);
  const researchReport = await readJson<{ status: string; unresolved_source_issues: { family: string; year: string; status: string }[] }>("prepared-validation.json");
  if (researchReport.unresolved_source_issues.some(issue => issue.family === "goods_national" && years.includes(Number(issue.year)))) throw new Error("Trade national source acceptance hold requires resolution");
  facts.sort((a, b) => a.year - b.year || TRADE_OVERVIEW_INDICATORS.indexOf(a.indicatorId) - TRADE_OVERVIEW_INDICATORS.indexOf(b.indicatorId));
  const csv = serializeBomCsvRows([headers, ...facts.map(f => [f.year, f.indicatorId, f.valueUsd, f.unit, f.basis, f.valueStatus, f.publicationStatus, f.role, f.sourceId, f.sourceRefs, f.sourceValue, f.sourceUnit, f.sourceLabel, f.sourceNumberFormat, f.lastReviewedAt])]);
  const report: TradeOverviewAcceptance = { status: "passed", scope: "national_goods_overview", years, primaryObservations: primary.length, derivedObservations: derived.length, sourceSha256: sha256, canonicalSha256: createHash("sha256").update(csv).digest("hex"), researchPackageStatus: researchReport.status, outsideScopeHoldCount: researchReport.unresolved_source_issues.length, reviewedAt: REVIEWED_AT };
  for (const [relative, content] of [["data/imports/trade-overview-annual.csv", csv], ["data/reports/trade-overview-validation.json", `${JSON.stringify(report, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("trade overview", target, content);
  }
}
