import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readVerifiedPackageFile } from "../sourcePackage";
import { readTradeSourceWorksheet } from "../parsing/tradeSourceWorkbook";
import { assertSameServedRows } from "../servedDataParity";
import { TRADE_COMPOSITION_IDS, TRADE_COMPOSITION_RESEARCH, TRADE_COMPOSITION_SOURCES, TRADE_COMPOSITION_YEARS, tradeCompositionFactKey, type TradeCompositionAcceptance, type TradeCompositionData, type TradeCompositionEntity, type TradeCompositionFact, type TradeCompositionReconciliation } from "./types";
import { tradeCompositionCatalogue, tradeCompositionCsv, tradeCompositionEnglishHash, tradeCompositionHash as hash, validateTradeCompositionData } from "./validation";

export { tradeCompositionCsv } from "./validation";
const D = Decimal.clone({ precision: 50 }), RESEARCH = TRADE_COMPOSITION_RESEARCH, REVIEWED = "2026-10-14";
type Row = Record<string, string>;
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };
type Token = { cell: string; value: string; format: string; stored_value?: string };
type Layout = { family: string; flow: "export" | "import"; source_id: string; source_sheet: string; source_block: string; source_unit: string; year_columns: Row; header_cells: Token[]; rows: { row_index: number; role: string; item_id: string; dimensions: Row; label_cells: Token[]; code_cells: Token[] }[] };
type Block = { source_id: string; source_sheet: string; source_block: string; family: string; flow: string; year: string; source_key_count: number; identity_count: number; key_sha256: string; metadata_sha256: string; status_counts: Record<string, number> };
const csv = (bytes: Buffer): Row[] => parse(bytes, { columns: true, bom: true, skip_empty_lines: true });
const sourceKey = (row: Row) => JSON.stringify([row.source_id, row.source_sheet, row.source_cell]);
const digest = (values: unknown[]) => hash(JSON.stringify(values.sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0)));

export async function buildTradeCompositionData(root: string): Promise<{ data: TradeCompositionData; report: TradeCompositionAcceptance }> {
  const directory = path.join(root, RESEARCH), inputSha256: Row = {}, sourceSha256: Row = {};
  const read = async (name: string) => { const bytes = await fs.readFile(path.join(root, name)); inputSha256[name] = hash(bytes); return bytes; };
  const research = (name: string) => read(`${RESEARCH}/${name}`);
  const independent = JSON.parse((await research("independent-verification.json")).toString()) as { status: string; input_artifact_sha256: Row };
  const verified = async (name: string) => { const bytes = await research(name); if (independent.input_artifact_sha256[name] !== hash(bytes)) throw new Error(`Composition independent input fingerprint mismatch: ${name}`); return bytes; };
  if (independent.status !== "source_cells_matched") throw new Error("Composition independent source evidence missing");
  const packageReport = JSON.parse((await verified("prepared-validation.json")).toString()) as { status: string; input_sha256: Row; unresolved_source_issues: Row[] };
  const frozen = async (name: string) => { const bytes = await research(name); if (packageReport.input_sha256[name] !== hash(bytes)) throw new Error(`Composition frozen inventory fingerprint mismatch: ${name}`); return bytes; };
  const sources = JSON.parse((await frozen("full-source-manifest.json")).toString()) as Source[];
  const layouts = JSON.parse((await frozen("source-layouts.json")).toString()) as Layout[];
  const inventory = JSON.parse((await frozen("expected-observation-inventory.json")).toString()) as { full_manifest_sha256: string; layout_sha256: string; blocks: Block[] };
  if (inventory.full_manifest_sha256 !== inputSha256[`${RESEARCH}/full-source-manifest.json`] || inventory.layout_sha256 !== inputSha256[`${RESEARCH}/source-layouts.json`]) throw new Error("Composition source/layout inventory fingerprint mismatch");
  const issues = JSON.parse((await frozen("unresolved-source-issues.json")).toString()).issues as Row[];
  const reconciliation = csv(await verified("prepared-reconciliation.csv")), coverage = csv(await verified("coverage.csv"));
  const selectedSource = (source: string) => Object.values(TRADE_COMPOSITION_SOURCES).some(flows => Object.values(flows).some(id => id === source));
  const affectsSubset = (row: Row) => row.family?.startsWith("goods") || row.item_id === "goods.total" || row.item_id?.startsWith("goods.sitc1.") || row.item_id?.startsWith("goods.bec1.") || selectedSource(row.source_id) || JSON.parse(row.source_refs || "[]").some((ref: string[]) => selectedSource(ref[0]));
  if ([...issues, ...packageReport.unresolved_source_issues, ...reconciliation.filter(row => row.status === "fail")].some(affectsSubset)) throw new Error("Composition subset source acceptance hold requires resolution");
  if (packageReport.status !== "requires_source_resolution" || issues.length !== 2 || issues.some((issue, index) => issue.check !== "service_country_matches_joint" || issue.family !== "services" || issue.flow !== "import" || issue.item_id !== "partner.2020-2024.826" || issue.year !== ["2022", "2024"][index] || issue.status !== "fail")) throw new Error("Composition outside-scope hold inventory changed");
  const holdKey = (row: Row) => `${row.check}:${row.flow}:${row.year}:${row.item_id}`;
  assertSameServedRows("Composition unchanged outside-scope holds", issues, packageReport.unresolved_source_issues, holdKey);
  assertSameServedRows("Composition unchanged failed evidence", issues, reconciliation.filter(row => row.status === "fail"), holdKey);
  const national = csv(await read("data/imports/trade-overview-annual.csv"));
  const entities = JSON.parse(await fs.readFile(path.join(root, "data/taxonomy/trade-composition.json"), "utf8")) as TradeCompositionEntity[];
  const translations = JSON.parse(await fs.readFile(path.join(root, "data/localization/en/labels.json"), "utf8")) as Record<string, { text: string; reviewedAt: string }>;
  const englishLabels = Object.fromEntries(TRADE_COMPOSITION_IDS.map(id => [id, translations[id]?.text]));
  if (TRADE_COMPOSITION_IDS.some(id => !translations[id]?.text || !translations[id]?.reviewedAt)) throw new Error("Composition reviewed English label missing");
  const facts: TradeCompositionFact[] = [], checks: TradeCompositionReconciliation[] = [];
  if (layouts.filter(layout => selectedSource(layout.source_id)).length !== 4) throw new Error("Composition source layout inventory mismatch");
  for (const classification of ["sitc", "bec"] as const) {
    const rows = csv(await verified(`goods-products-annual/${classification}1-2000-2025.csv`)), count = classification === "sitc" ? 10 : 7;
    if (rows.length !== (count + 1) * 52 || new Set(rows.map(sourceKey)).size !== rows.length) throw new Error("Composition source coverage/duplicate inventory mismatch");
    for (const flow of ["export", "import"] as const) {
      const sourceId = TRADE_COMPOSITION_SOURCES[classification][flow], matchingLayouts = layouts.filter(l => l.source_id === sourceId), matching = sources.filter(source => source.source_id === sourceId);
      const expectedFile = `official/${flow === "export" ? "Export" : "Import"}-${classification.toUpperCase()}${flow === "import" && classification === "bec" ? "-" : "_"}2000-2026.xlsx`;
      const layout = matchingLayouts[0];
      if (matchingLayouts.length !== 1 || matching.length !== 1 || matching[0].local_file !== expectedFile || layout.flow !== flow || layout.family !== "goods_products" || layout.source_sheet !== `${classification.toUpperCase()}-2000-2025-years` || layout.source_unit !== "thousand_usd" || layout.source_block !== "2000-2025" || JSON.stringify(Object.keys(layout.year_columns)) !== JSON.stringify(TRADE_COMPOSITION_YEARS.map(String)) || layout.rows.length !== count + 1) throw new Error("Composition source layout/manifest coverage mismatch");
      const original = await readVerifiedPackageFile(directory, matching[0].local_file, matching[0], "Composition original source capture/hash mismatch"); sourceSha256[sourceId] = original.sha256;
      const { sheet, storedValues } = readTradeSourceWorksheet(original.bytes, layout.source_sheet);
      for (const token of [...layout.header_cells, ...layout.rows.flatMap(row => [...row.label_cells, ...row.code_cells])]) if (String(sheet[token.cell]?.v) !== token.value || (sheet[token.cell]?.z ?? "General") !== token.format || (token.stored_value !== undefined && storedValues.get(token.cell) !== token.stored_value)) throw new Error("Composition source header/label/format metadata mismatch");
      if (!layout.header_cells.some(token => token.cell === "A3" && token.value === "(Thsd. USD)")) throw new Error("Composition source unit header mismatch");
      const observations = csv(await verified(`source-observations/${sourceId}-02-2000-2025.csv`)), selected = rows.filter(row => row.source_id === sourceId), byKey = new Map(selected.map(row => [`${row.item_id}:${row.year}`, row])), nativeByKey = new Map(observations.map(row => [sourceKey(row), row]));
      if (selected.length !== (count + 1) * 26 || observations.length !== selected.length || byKey.size !== selected.length || nativeByKey.size !== observations.length) throw new Error("Composition source observation coverage inventory mismatch");
      const values = new Map<string, string>();
      for (const [index, declared] of layout.rows.entries()) {
        const code = String(index - (classification === "sitc" ? 1 : 0)), itemId = index === 0 ? "goods.total" : `goods.${classification}1.2000-2025.${code}`, entity = entities.find(e => e.id === `trade.${classification}1.${code}`);
        const dimensions = index === 0 ? { classification: `${classification}1`, classification_level: "1" } : { classification: `${classification}1`, classification_level: "1", product_code: code, product_label_en: entity?.labelEn };
        if (declared.item_id !== itemId || declared.row_index !== (index === 0 ? 5 : index + 6) || declared.role !== (index === 0 ? "total" : "detail") || JSON.stringify(Object.entries(declared.dimensions).sort()) !== JSON.stringify(Object.entries(dimensions).sort()) || declared.label_cells.length !== 1 || declared.label_cells[0].cell !== `B${declared.row_index}` || declared.label_cells[0].value !== (index === 0 ? `Total ${flow === "export" ? "Exports" : "Imports"}` : entity?.labelEn) || declared.code_cells.length !== (index === 0 ? 0 : 1) || (index > 0 && (declared.code_cells[0].cell !== `A${declared.row_index}` || declared.code_cells[0].value !== code || declared.code_cells[0].stored_value !== code))) throw new Error("Composition source identity/code/role inventory mismatch");
        for (const [yearText, column] of Object.entries(layout.year_columns)) {
          const year = Number(yearText), cell = `${column}${declared.row_index}`, native = sheet[cell], stored = storedValues.get(cell), row = byKey.get(`${itemId}:${year}`), expectedColumn = year < 2024 ? String.fromCharCode(67 + year - 2000) : year === 2024 ? "AA" : "AB";
          const value = native?.t === "n" && stored ? new D(stored).mul(1000).toFixed() : null;
          if (column !== expectedColumn || Number(sheet[`${column}4`]?.v) !== year || !row || row.flow !== flow || row.source_sheet !== layout.source_sheet || row.source_cell !== cell || row.source_block !== layout.source_block || row.source_unit !== layout.source_unit || row.role !== declared.role || row.publication_status !== "unspecified" || row.source_label !== declared.label_cells[0].value || row.source_number_format !== (native?.z ?? "General") || row.product_code !== (index === 0 ? "" : code) || row.product_label_en !== (index === 0 ? "" : entity?.labelEn) || Object.entries(dimensions).some(([key, text]) => row[key] !== text)) throw new Error(`Composition source cell/identity metadata mismatch: ${sourceId}:${cell}`);
          if (value === null || row.source_value !== stored || row.value_status !== "numeric" || !new D(row.value_usd).eq(value)) throw new Error(`Composition source cell/value conversion mismatch: ${sourceId}:${cell}`);
          const observation = nativeByKey.get(sourceKey(row));
          if (!observation || Object.entries(observation).some(([key, text]) => text !== (key === "family" ? "goods_products" : row[key] ?? "")) || Object.entries(row).some(([key, text]) => observation[key] !== text)) throw new Error("Composition native observation inventory metadata mismatch");
          values.set(`${itemId}:${year}`, value);
          if (index > 0) facts.push({ entityId: entity!.id, year, indicatorId: flow === "export" ? "trade.exports" : "trade.imports", valueUsd: value, unit: "usd", basis: "actual", valueStatus: "numeric", publicationStatus: "unspecified", role: "detail", sourceId, sourceRefs: JSON.stringify([[sourceId, layout.source_sheet, cell]]), sourceValue: stored!, sourceUnit: row.source_unit, sourceLabel: row.source_label, sourceNumberFormat: row.source_number_format, sourceBlock: "2000-2025", lastReviewedAt: REVIEWED });
        }
      }
      for (const year of Object.keys(layout.year_columns)) {
        const group = observations.filter(row => row.year === year), block = inventory.blocks.filter(b => b.source_id === sourceId && b.source_sheet === layout.source_sheet && b.year === year), covered = coverage.filter(row => row.source_id === sourceId && row.source_sheet === layout.source_sheet && row.year === year);
        const keys = digest(group.map(row => [row.source_id, row.source_sheet, row.source_cell])), metadata = digest(group.map(row => Object.entries(row).filter(([key]) => !["value_usd", "source_value"].includes(key)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
        if (block.length !== 1 || covered.length !== 1 || group.length !== count + 1 || block[0].source_key_count !== count + 1 || block[0].identity_count !== count + 1 || block[0].key_sha256 !== keys || block[0].metadata_sha256 !== metadata || JSON.stringify(block[0].status_counts) !== JSON.stringify({ numeric: count + 1 }) || block[0].family !== "goods_products" || block[0].flow !== flow || block[0].source_block !== "2000-2025" || covered[0].key_sha256 !== keys || Number(covered[0].source_key_count) !== count + 1 || Number(covered[0].identity_count) !== count + 1 || Number(covered[0].numeric_count) !== count + 1 || covered[0].blank_count !== "0" || covered[0].not_applicable_count !== "0" || covered[0].family !== "goods_products" || covered[0].flow !== flow || covered[0].source_block !== "2000-2025") throw new Error("Composition reviewed coverage/inventory metadata mismatch");
        const total = values.get(`goods.total:${year}`)!, sum = layout.rows.slice(1).reduce((sum, row) => sum.plus(values.get(`${row.item_id}:${year}`)!), new D(0)), indicatorId = flow === "export" ? "trade.exports" : "trade.imports";
        const anchors = national.filter(row => row.year === year && row.indicator_id === indicatorId && row.role === "total" && row.value_status === "numeric" && row.unit === "usd");
        const detailRefs = JSON.stringify(layout.rows.map(row => [sourceId, layout.source_sheet, `${layout.year_columns[year]}${row.row_index}`]));
        const sums = reconciliation.filter(row => row.check === "published_detail_sum" && row.flow === flow && row.year === year && row.source_refs === detailRefs);
        const anchorRefs = anchors.length === 1 ? JSON.stringify([...JSON.parse(anchors[0].source_refs), [sourceId, layout.source_sheet, `${layout.year_columns[year]}5`]]) : "";
        const totals = reconciliation.filter(row => row.check === "published_total_matches_anchor" && row.flow === flow && row.year === year && row.source_refs === anchorRefs);
        if (anchors.length !== 1 || sums.length !== 1 || totals.length !== 1 || sums[0].family !== "goods_products" || totals[0].family !== "goods_national" || [sums[0], totals[0]].some(row => row.item_id !== "goods.total" || row.status !== "pass" || row.tolerance_usd !== "1" || !new D(row.actual_usd).minus(row.expected_usd).eq(row.difference_usd)) || !new D(sums[0].expected_usd).eq(total) || !sum.eq(sums[0].actual_usd) || !new D(totals[0].actual_usd).eq(total) || !new D(totals[0].expected_usd).eq(anchors[0].value_usd) || sum.minus(total).abs().gt(1) || new D(total).minus(anchors[0].value_usd).abs().gt(1)) throw new Error("Composition independent detail/control/national reconciliation mismatch");
        checks.push({ classification, indicatorId, year: Number(year), detailSumUsd: sum.toFixed(), controlUsd: total, nationalUsd: new D(anchors[0].value_usd).toFixed(), detailDifferenceUsd: sum.minus(total).toFixed(), nationalDifferenceUsd: new D(total).minus(anchors[0].value_usd).toFixed() });
      }
    }
  }
  facts.sort((a, b) => tradeCompositionFactKey(a).localeCompare(tradeCompositionFactKey(b), "en"));
  const data = { entities, facts }, report: TradeCompositionAcceptance = { status: "passed", scope: "annual_goods_composition", years: TRADE_COMPOSITION_YEARS, entities: entities.length, primaryObservations: facts.length, numericObservations: facts.length, unavailableObservations: 0, derivedObservations: 0, controlObservations: checks.length, classifications: { sitc: { entities: 10, primaryObservations: 520, controlObservations: 52 }, bec: { entities: 7, primaryObservations: 364, controlObservations: 52 } }, reconciliation: checks, canonicalSha256: hash(tradeCompositionCsv(data)), catalogueSha256: hash(tradeCompositionCatalogue(data)), englishLabelsSha256: tradeCompositionEnglishHash(englishLabels), inputSha256, sourceSha256, researchPackageStatus: packageReport.status, outsideScopeHoldCount: issues.length, outsideScopeHolds: issues, reviewedAt: REVIEWED };
  validateTradeCompositionData(data, report, englishLabels); return { data, report };
}
export async function prepareTradeCompositionData(root: string, mode: "write" | "check"): Promise<void> {
  const { data, report } = await buildTradeCompositionData(root);
  for (const [name, content] of [["data/imports/trade-composition-annual.csv", tradeCompositionCsv(data)], ["data/taxonomy/trade-composition.json", tradeCompositionCatalogue(data)], ["data/reports/trade-composition-validation.json", JSON.stringify(report, null, 2) + "\n"]]) {
    const target = path.join(root, name);
    if (mode === "check") await assertGeneratedArtifactMatches("goods composition", target, content);
    else { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content); }
  }
}
