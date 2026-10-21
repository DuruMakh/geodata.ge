import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readVerifiedPackageFile } from "../sourcePackage";
import { parseOnce, readTradeSourceWorksheet, type TradeParseCache } from "../parsing/tradeSourceWorkbook";
import { assertSameServedRows } from "../servedDataParity";
import { TRADE_SERVICE_IDS, TRADE_SERVICES_COUNTRY_SOURCES, TRADE_SERVICES_DOCUMENT_IDS, TRADE_SERVICES_JOINT_HOLDS_SHA256, TRADE_SERVICES_RESIDUAL_IDS, TRADE_SERVICES_RESEARCH, TRADE_SERVICES_SOURCES, tradeServicesFactKey, type TradeServiceEntity, type TradeServiceFact, type TradeServicesAcceptance, type TradeServicesData } from "./types";
import { tradeServicesCatalogue, tradeServicesCsv, tradeServicesEnglishHash, tradeServicesHash as hash, validateTradeServicesData } from "./validation";

export { tradeServicesCsv } from "./validation";
const D = Decimal.clone({ precision: 50 }), RESEARCH = TRADE_SERVICES_RESEARCH, REVIEWED = "2026-10-14";
type Row = Record<string, string>;
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };
type Token = { cell: string; value: string; format: string; stored_value?: string };
type Layout = { family: string; flow: "export" | "import"; source_id: string; source_sheet: string; source_block: string; source_unit: string; year_columns: Row; header_cells: Token[]; rows: { row_index: number; role: string; item_id: string; dimensions: Row; label_cells: Token[]; code_cells: Token[] }[] };
type Block = { source_id: string; source_sheet: string; source_block: string; family: string; flow: string; year: string; source_key_count: number; identity_count: number; key_sha256: string; metadata_sha256: string; status_counts: Record<string, number> };
const csv = (bytes: Buffer): Row[] => parse(bytes, { columns: true, bom: true, skip_empty_lines: true });
const sourceKey = (row: Row) => JSON.stringify([row.source_id, row.source_sheet, row.source_cell]);
const digest = (values: unknown[]) => hash(JSON.stringify(values.sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0)));

export async function buildTradeServicesData(root: string, cache?: TradeParseCache): Promise<{ data: TradeServicesData; report: TradeServicesAcceptance }> {
  const directory = path.join(root, RESEARCH), inputSha256: Record<string, string> = {}, sourceSha256: Record<string, string> = {};
  const read = async (name: string) => { const bytes = await fs.readFile(path.join(root, name)); inputSha256[name] = hash(bytes); return bytes; };
  const research = (name: string) => read(`${RESEARCH}/${name}`);
  const parsedResearch = <T>(name: string, bytes: Buffer, parse: (bytes: Buffer) => T): T => parseOnce(cache, `${name}:${inputSha256[`${RESEARCH}/${name}`]}`, () => parse(bytes));
  const independent = JSON.parse((await research("independent-verification.json")).toString()) as { status: string; input_artifact_sha256: Row };
  const verified = async (name: string) => {
    const bytes = await research(name);
    if (independent.input_artifact_sha256[name] !== hash(bytes)) throw new Error(`Services independent input fingerprint mismatch: ${name}`);
    return bytes;
  };
  if (independent.status !== "source_cells_matched") throw new Error("Services independent source evidence missing");
  const packageReport = JSON.parse((await verified("prepared-validation.json")).toString()) as { status: string; input_sha256: Row; unresolved_source_issues: Row[] };
  const frozen = async (name: string) => {
    const bytes = await research(name);
    if (packageReport.input_sha256[name] !== hash(bytes)) throw new Error(`Services frozen inventory fingerprint mismatch: ${name}`);
    return bytes;
  };
  const sources = JSON.parse((await frozen("full-source-manifest.json")).toString()) as Source[];
  const layouts = parsedResearch("source-layouts.json", await frozen("source-layouts.json"), bytes => JSON.parse(bytes.toString()) as Layout[]);
  const inventory = JSON.parse((await frozen("expected-observation-inventory.json")).toString()) as { full_manifest_sha256: string; layout_sha256: string; blocks: Block[] };
  if (inventory.full_manifest_sha256 !== inputSha256[`${RESEARCH}/full-source-manifest.json`] || inventory.layout_sha256 !== inputSha256[`${RESEARCH}/source-layouts.json`]) throw new Error("Services source/layout inventory fingerprint mismatch");
  const issues = JSON.parse((await frozen("unresolved-source-issues.json")).toString()).issues as Row[];
  const reconciliation = parsedResearch("prepared-reconciliation.csv", await verified("prepared-reconciliation.csv"), csv), coverage = csv(await verified("coverage.csv"));
  const selectedSource = (source: string) => source in TRADE_SERVICES_DOCUMENT_IDS;
  if (inputSha256[`${RESEARCH}/unresolved-source-issues.json`] !== TRADE_SERVICES_JOINT_HOLDS_SHA256) throw new Error("Services source acceptance hold fingerprint changed");
  if (packageReport.status !== "requires_source_resolution" || issues.length !== 2 || issues.some((issue, index) => issue.check !== "service_country_matches_joint" || issue.family !== "services" || issue.flow !== "import" || issue.item_id !== "partner.2020-2024.826" || issue.year !== ["2022", "2024"][index] || issue.status !== "fail")) throw new Error("Services outside-scope hold inventory changed");
  const holdKey = (row: Row) => `${row.check}:${row.flow}:${row.year}:${row.item_id}`;
  assertSameServedRows("Services unchanged outside-scope holds", issues, packageReport.unresolved_source_issues, holdKey);
  assertSameServedRows("Services unchanged failed evidence", issues, reconciliation.filter(row => row.status === "fail"), holdKey);
  const rows = parsedResearch("services-annual.csv", await verified("services-annual.csv"), csv).filter(row => selectedSource(row.source_id));
  if (rows.length !== 1455 || new Set(rows.map(sourceKey)).size !== 1455) throw new Error("Services source coverage/duplicate inventory mismatch");
  const catalogueBytes = await fs.readFile(path.join(root, "data/taxonomy/trade-services.json")), entities = JSON.parse(catalogueBytes.toString()) as TradeServiceEntity[];
  const translations = JSON.parse(await fs.readFile(path.join(root, "data/localization/en/labels.json"), "utf8")) as Record<string, { text: string; reviewedAt: string }>;
  const englishLabels = Object.fromEntries(entities.map(({ id }) => [id, translations[id]?.text]));
  if (entities.some(({ id }) => !translations[id]?.text || !translations[id]?.reviewedAt)) throw new Error("Services reviewed English label missing");
  const selectedLayouts = layouts.filter(layout => selectedSource(layout.source_id)).sort((a, b) => Number(a.source_id.endsWith("by-countries")) - Number(b.source_id.endsWith("by-countries"))), facts: TradeServiceFact[] = [];
  if (selectedLayouts.length !== 4 || Object.keys(TRADE_SERVICES_DOCUMENT_IDS).some(id => selectedLayouts.filter(l => l.source_id === id).length !== 1)) throw new Error("Services source layout inventory mismatch");
  for (const layout of selectedLayouts) {
    const countries = layout.source_id === TRADE_SERVICES_COUNTRY_SOURCES[layout.flow], dimension = countries ? "country" : "type", rowCount = countries ? layout.flow === "export" ? 150 : 115 : 13;
    const matching = sources.filter(source => source.source_id === layout.source_id), expectedFile = `official/Georgian-${layout.flow === "export" ? "Exports" : "Imports"}-of-services-by-${countries ? "countries" : "types"}.xlsx`;
    if (matching.length !== 1 || matching[0].local_file !== expectedFile || (countries ? TRADE_SERVICES_COUNTRY_SOURCES : TRADE_SERVICES_SOURCES)[layout.flow] !== layout.source_id || layout.family !== "services" || layout.source_sheet !== "Sheet1" || layout.source_unit !== "thousand_usd" || layout.source_block !== "2020-2024" || JSON.stringify(Object.keys(layout.year_columns)) !== '["2020","2021","2022","2023","2024"]' || layout.rows.length !== rowCount) throw new Error("Services source layout/manifest coverage mismatch");
    const original = await readVerifiedPackageFile(directory, matching[0].local_file, matching[0], "Services original source capture/hash mismatch");
    sourceSha256[layout.source_id] = original.sha256;
    const { sheet, storedValues } = readTradeSourceWorksheet(original.bytes, layout.source_sheet);
    for (const token of [...layout.header_cells, ...layout.rows.flatMap(row => [...row.label_cells, ...row.code_cells])]) if (String(sheet[token.cell]?.v) !== token.value || (sheet[token.cell]?.z ?? "General") !== token.format || (token.stored_value !== undefined && storedValues.get(token.cell) !== token.stored_value)) throw new Error("Services source header/label/format metadata mismatch");
    const observations = csv(await verified(`source-observations/${layout.source_id}-01-2020-2024.csv`));
    const selected = rows.filter(row => row.source_id === layout.source_id), byKey = new Map(selected.map(row => [`${row.item_id}:${row.year}`, row]));
    if (selected.length !== rowCount * 5 || observations.length !== rowCount * 5 || byKey.size !== rowCount * 5) throw new Error("Services source observation coverage inventory mismatch");
    const nativeByKey = new Map(observations.map(row => [sourceKey(row), row]));
    for (const [index, declared] of layout.rows.entries()) {
      if (declared.dimensions.dimension !== dimension || (!countries && (declared.item_id !== TRADE_SERVICE_IDS[index] || declared.row_index !== (index === 0 ? 5 : index + 6) || declared.role !== (index === 0 ? "total" : "detail") || declared.dimensions.service_id !== declared.item_id))) throw new Error("Services source identity/role inventory mismatch");
      for (const [yearText, column] of Object.entries(layout.year_columns)) {
        const year = Number(yearText), cell = `${column}${declared.row_index}`, native = sheet[cell], stored = storedValues.get(cell), row = byKey.get(`${declared.item_id}:${year}`);
        const unavailable = countries ? native?.v === "-" : declared.item_id === "services.maintenance_repair" && year === 2020 && layout.flow === "export";
        const value = unavailable ? null : native?.t === "n" && stored ? new D(stored).mul(1000).toFixed() : null;
        if (column !== String.fromCharCode((countries ? 67 : 66) + year - 2020) || Number(sheet[`${column}4`]?.v) !== year || !row || row.flow !== layout.flow || row.source_sheet !== layout.source_sheet || row.source_cell !== cell || row.source_block !== layout.source_block || row.source_unit !== layout.source_unit || row.role !== declared.role || row.publication_status !== "unspecified" || row.source_label !== declared.label_cells[0]?.value || row.source_number_format !== (native?.z ?? "General") || (!countries && (row.partner_code !== "" || row.partner_label_en !== "")) || Object.entries(declared.dimensions).filter(([key]) => !["source_group_id", "source_group_label_en"].includes(key)).some(([key, text]) => row[key] !== text)) throw new Error(`Services source cell/identity metadata mismatch: ${layout.source_id}:${cell}`);
        if (unavailable ? native?.v !== "-" || row.source_value !== "-" || row.value_usd !== "" || row.value_status !== "not_applicable" : value === null || row.source_value !== stored || row.value_status !== "numeric" || !new D(row.value_usd).eq(value)) throw new Error(`Services source cell/value conversion mismatch: ${layout.source_id}:${cell}`);
        const observation = nativeByKey.get(sourceKey(row));
        if (!observation || Object.entries(row).some(([key, text]) => observation[key] !== text)) throw new Error("Services native observation inventory metadata mismatch");
        // Country national/group totals are validation controls, not additional selectable series.
        if (!countries || ["detail", "residual"].includes(declared.role)) facts.push({ entityId: declared.role === "residual" ? TRADE_SERVICES_RESIDUAL_IDS[row.source_label] : row.item_id, year, indicatorId: layout.flow === "export" ? "trade.exports" : "trade.imports", valueUsd: value, unit: "usd", basis: "actual", valueStatus: unavailable ? "not_applicable" : "numeric", publicationStatus: "unspecified", role: declared.role as TradeServiceFact["role"], sourceId: row.source_id, sourceRefs: JSON.stringify([[row.source_id, row.source_sheet, cell]]), sourceValue: row.source_value, sourceUnit: row.source_unit, sourceLabel: row.source_label, sourceNumberFormat: row.source_number_format, sourceBlock: row.source_block, lastReviewedAt: REVIEWED });
      }
    }
    for (const year of Object.keys(layout.year_columns)) {
      const group = observations.filter(row => row.year === year), block = inventory.blocks.filter(b => b.source_id === layout.source_id && b.source_sheet === layout.source_sheet && b.year === year), covered = coverage.filter(row => row.source_id === layout.source_id && row.source_sheet === layout.source_sheet && row.year === year);
      const keys = digest(group.map(row => [row.source_id, row.source_sheet, row.source_cell])), metadata = digest(group.map(row => Object.entries(row).filter(([key]) => !["value_usd", "source_value"].includes(key)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
      const numeric = group.filter(row => row.value_status === "numeric").length;
      if (block.length !== 1 || covered.length !== 1 || group.length !== rowCount || block[0].source_key_count !== rowCount || block[0].identity_count !== rowCount || block[0].key_sha256 !== keys || block[0].metadata_sha256 !== metadata || block[0].status_counts.numeric !== numeric || (block[0].status_counts.not_applicable ?? 0) !== rowCount - numeric || covered[0].key_sha256 !== keys || Number(covered[0].source_key_count) !== rowCount || Number(covered[0].numeric_count) !== numeric || Number(covered[0].not_applicable_count) !== rowCount - numeric) throw new Error("Services reviewed coverage/inventory metadata mismatch");
      const total = group.find(row => row.role === "total")!, sum = group.filter(row => ["detail", "residual"].includes(row.role) && row.value_status === "numeric").reduce((sum, row) => sum.plus(row.value_usd), new D(0));
      const checks = reconciliation.filter(row => row.check === (countries ? "service_country_sum" : "service_type_sum") && row.flow === layout.flow && row.year === year);
      const refs = JSON.stringify(layout.rows.filter(row => row.role !== "subtotal").map(row => [layout.source_id, layout.source_sheet, `${layout.year_columns[year]}${row.row_index}`]));
      if (checks.length !== 1 || checks[0].status !== "pass" || checks[0].tolerance_usd !== "1" || checks[0].source_refs !== refs || !new D(checks[0].expected_usd).eq(total.value_usd) || !sum.eq(checks[0].actual_usd) || sum.minus(total.value_usd).abs().gt(1)) throw new Error("Services independent national/type/country reconciliation mismatch");
      if (countries) {
        const national = facts.find(f => f.entityId === "services.total" && f.year === Number(year) && f.indicatorId === (layout.flow === "export" ? "trade.exports" : "trade.imports"));
        const controls = reconciliation.filter(row => row.check === "service_country_total_matches_types" && row.flow === layout.flow && row.year === year);
        const nationalRefs = JSON.stringify([[TRADE_SERVICES_SOURCES[layout.flow], "Sheet1", `${String.fromCharCode(66 + Number(year) - 2020)}5`], [layout.source_id, "Sheet1", `${layout.year_columns[year]}5`]]);
        if (!national || controls.length !== 1 || controls[0].status !== "pass" || controls[0].tolerance_usd !== "1" || controls[0].source_refs !== nationalRefs || !new D(controls[0].expected_usd).eq(national.valueUsd!) || !new D(controls[0].actual_usd).eq(total.value_usd) || new D(national.valueUsd!).minus(total.value_usd).abs().gt(1)) throw new Error("Services country/national control mismatch");
      }
    }
  }
  for (const entity of entities) for (const year of [2020, 2021, 2022, 2023, 2024]) {
    const exports = facts.find(f => f.entityId === entity.id && f.year === year && f.indicatorId === "trade.exports"), imports = facts.find(f => f.entityId === entity.id && f.year === year && f.indicatorId === "trade.imports");
    if (!exports || !imports) {
      if (entity.kind === "national" || entity.kind === "service_type") throw new Error("Services derivation counterpart inventory incomplete");
      continue;
    }
    if (exports.valueUsd === null || imports.valueUsd === null) continue;
    for (const indicatorId of ["trade.turnover", "trade.balance"] as const) facts.push({ entityId: entity.id, year, indicatorId, valueUsd: (indicatorId === "trade.turnover" ? new D(exports.valueUsd).plus(imports.valueUsd) : new D(exports.valueUsd).minus(imports.valueUsd)).toFixed(), unit: "usd", basis: "actual", valueStatus: "numeric", publicationStatus: "unspecified", role: "derived", sourceId: null, sourceRefs: JSON.stringify([...JSON.parse(exports.sourceRefs), ...JSON.parse(imports.sourceRefs)]), sourceValue: null, sourceUnit: null, sourceLabel: null, sourceNumberFormat: null, sourceBlock: null, lastReviewedAt: REVIEWED });
  }
  facts.sort((a, b) => tradeServicesFactKey(a).localeCompare(tradeServicesFactKey(b), "en"));
  const data = { entities, facts }, report: TradeServicesAcceptance = { status: "passed", scope: "annual_services_types_and_countries", countrySourcePolicy: "published_country_totals", countryControlObservations: 40, years: [2020, 2021, 2022, 2023, 2024], primaryObservations: facts.filter(f => f.role !== "derived").length, numericObservations: facts.filter(f => f.role !== "derived" && f.valueStatus === "numeric").length, unavailableObservations: facts.filter(f => f.valueStatus === "not_applicable").length, derivedObservations: facts.filter(f => f.role === "derived").length, canonicalSha256: hash(tradeServicesCsv(data)), catalogueSha256: hash(tradeServicesCatalogue(data)), englishLabelsSha256: tradeServicesEnglishHash(englishLabels, entities.map(e => e.id)), inputSha256, sourceSha256, researchPackageStatus: packageReport.status, outsideScopeHoldCount: issues.length, outsideScopeHolds: issues, reviewedAt: REVIEWED };
  validateTradeServicesData(data, report, englishLabels);
  return { data, report };
}
export async function prepareTradeServicesData(root: string, mode: "write" | "check", cache?: TradeParseCache): Promise<void> {
  const { data, report } = await buildTradeServicesData(root, cache);
  for (const [name, content] of [["data/imports/trade-services-annual.csv", tradeServicesCsv(data)], ["data/taxonomy/trade-services.json", tradeServicesCatalogue(data)], ["data/reports/trade-services-validation.json", JSON.stringify(report, null, 2) + "\n"]]) {
    const target = path.join(root, name);
    if (mode === "check") await assertGeneratedArtifactMatches("services trade", target, content);
    else { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content); }
  }
}
