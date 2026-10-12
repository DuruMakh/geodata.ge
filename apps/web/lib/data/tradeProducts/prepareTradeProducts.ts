import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readTradeSourceWorksheet } from "../parsing/tradeSourceWorkbook";
import { TRADE_PRODUCT_BLOCKS, TRADE_PRODUCT_SOURCES, tradeProductFactKey, type TradeProductFact, type TradeProductsAcceptance } from "./types";
import { tradeProductsEnglishLabels, validateTradeProductsData } from "./validation";
import { readTradeProductCatalogue } from "./catalogue";

const D = Decimal.clone({ precision: 50 }), RESEARCH = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07", REVIEWED_AT = "2026-10-09";
type Row = Record<string, string>;
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };
type SourceIssue = { family: string; classification?: string; year: string };
type Cell = { cell: string; value: string; format: string; stored_value?: string };
type Layout = { family: string; flow: "export" | "import"; source_id: string; source_sheet: string; source_block: string; source_unit: string; year_columns: Record<string, string>; header_cells: Cell[]; rows: { role: string; item_id: string; dimensions: Record<string, string>; label_cells: Cell[]; code_cells: Cell[] }[] };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const fields = ["entity_id", "year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "source_block", "last_reviewed_at"];

export async function prepareTradeProductsData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH), inputSha256: Record<string, string> = {};
  const read = async (name: string) => { const bytes = await fs.readFile(path.join(directory, name)); inputSha256[name] = hash(bytes); return bytes; };
  const json = async <T>(name: string): Promise<T> => JSON.parse((await read(name)).toString("utf8"));
  const csv = async (name: string): Promise<Row[]> => parse(await read(name), { columns: true, bom: true, skip_empty_lines: true });
  const sources = await json<Source[]>("full-source-manifest.json"), layouts = await json<Layout[]>("source-layouts.json");
  const inventory = await json<{ full_manifest_sha256: string; layout_sha256: string; blocks: { source_id: string; source_sheet: string; source_block: string; year: string; source_key_count: number; identity_count: number; key_sha256: string; status_counts: Record<string, number> }[] }>("expected-observation-inventory.json");
  if (inventory.full_manifest_sha256 !== inputSha256["full-source-manifest.json"] || inventory.layout_sha256 !== inputSha256["source-layouts.json"]) throw new Error("Trade products source inventory fingerprint mismatch");
  const coverage = await csv("coverage.csv"), reconciliation = await csv("prepared-reconciliation.csv");
  await read("identity-review.csv");
  const researchReport = await json<{ status: string; unresolved_source_issues: SourceIssue[] }>("prepared-validation.json");
  const holds = await json<{ issues: SourceIssue[] }>("unresolved-source-issues.json");
  if ([...researchReport.unresolved_source_issues, ...holds.issues].some(issue => ["goods_national", "goods_products"].includes(issue.family) && (!issue.classification || issue.classification === "hs4") && Number(issue.year) >= 1995 && Number(issue.year) <= 2025)) throw new Error("Trade products source acceptance hold requires resolution");
  const catalogueBytes = await fs.readFile(path.join(repositoryRoot, "data/imports/trade-products-catalogue.csv")), entities = await readTradeProductCatalogue(repositoryRoot);
  const labels = JSON.parse(await fs.readFile(path.join(repositoryRoot, "data/localization/en/labels.json"), "utf8"));
  const nationalBytes = await fs.readFile(path.join(repositoryRoot, "data/imports/trade-overview-annual.csv"));
  const nationalReport = JSON.parse(await fs.readFile(path.join(repositoryRoot, "data/reports/trade-overview-validation.json"), "utf8"));
  if (nationalReport.status !== "passed" || nationalReport.canonicalSha256 !== hash(nationalBytes)) throw new Error("Trade products national reference acceptance mismatch");
  inputSha256["trade-overview-annual.csv"] = hash(nationalBytes);
  const nationalRows = parse(nationalBytes, { columns: true, bom: true }) as Row[], facts: TradeProductFact[] = [], sourceSha256: Record<string, string> = {};
  const expectedEntities = new Map<string, { code: string; block: string; names: Set<string> }>();
  const blockBaselines = [{ observations: 9775, entities: 1146 }, { observations: 35160, entities: 1240 }, { observations: 11105, entities: 1190 }, { observations: 13584, entities: 1192 }];
  let controlObservations = 0;
  for (const [blockIndex, sourceBlock] of TRADE_PRODUCT_BLOCKS.entries()) {
    const blockRows = await csv(`goods-products-annual/hs4-${sourceBlock}.csv`);
    const detail = blockRows.filter(row => row.role === "detail"), identities = new Set(detail.map(row => row.item_id));
    if (detail.length !== blockBaselines[blockIndex].observations || identities.size !== blockBaselines[blockIndex].entities) throw new Error(`Trade products frozen coverage/identity mismatch: ${sourceBlock}`);
    const [start, end] = sourceBlock.split("-").map(Number), years = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    for (const flow of ["export", "import"] as const) {
      const sourceId = TRADE_PRODUCT_SOURCES[sourceBlock][flow];
      const matchingSources = sources.filter(source => source.source_id === sourceId);
      const matchingLayouts = layouts.filter(layout => layout.family === "goods_products" && layout.source_id === sourceId && layout.source_block === sourceBlock && layout.flow === flow);
      if (matchingSources.length !== 1 || matchingLayouts.length !== 1) throw new Error(`Trade products source layout mismatch: ${sourceId}:${sourceBlock}`);
      const source = matchingSources[0], layout = matchingLayouts[0];
      const { bytes, sha256 } = await readVerifiedPackageFile(directory, source.local_file, source, "Trade products source capture/hash mismatch");
      sourceSha256[sourceId] = sha256;
      const { sheet, storedValues } = readTradeSourceWorksheet(bytes, layout.source_sheet);
      if (layout.source_unit !== "thousand_usd" || JSON.stringify(Object.keys(layout.year_columns).map(Number).sort((a, b) => a - b)) !== JSON.stringify(years)) throw new Error(`Trade products source unit/coverage mismatch: ${sourceId}`);
      for (const cell of [...layout.header_cells, ...layout.rows.flatMap(row => [...row.label_cells, ...row.code_cells])]) {
        if (String(sheet[cell.cell]?.v) !== cell.value || (sheet[cell.cell]?.z ?? "General") !== cell.format || (cell.stored_value !== undefined && storedValues.get(cell.cell) !== cell.stored_value)) throw new Error(`Trade products source label/code/header/format mismatch: ${sourceId}:${cell.cell}`);
      }
      const rows = blockRows.filter(row => row.flow === flow), byKey = new Map(rows.map(row => [`${row.item_id}:${row.year}`, row]));
      if (rows.length !== layout.rows.length * years.length || byKey.size !== rows.length) throw new Error(`Trade products source coverage/duplicate mismatch: ${sourceId}`);
      for (const year of years) {
        const column = layout.year_columns[String(year)], counts = { numeric: 0, blank: 0, not_applicable: 0 };
        const blocks = inventory.blocks.filter(item => item.source_id === sourceId && item.source_sheet === layout.source_sheet && item.source_block === sourceBlock && Number(item.year) === year);
        const reviewed = coverage.filter(row => row.source_id === sourceId && row.source_sheet === layout.source_sheet && row.source_block === sourceBlock && Number(row.year) === year);
        if (blocks.length !== 1 || reviewed.length !== 1 || blocks[0].source_key_count !== layout.rows.length || blocks[0].identity_count !== layout.rows.length || Number(reviewed[0].source_key_count) !== blocks[0].source_key_count || reviewed[0].key_sha256 !== blocks[0].key_sha256) throw new Error(`Trade products source year/key inventory mismatch: ${sourceId}:${year}`);
        for (const declared of layout.rows) {
          const row = byKey.get(`${declared.item_id}:${year}`), address = `${column}${declared.label_cells[0].cell.match(/\d+$/)![0]}`, cell = sheet[address];
          const status = cell?.t === "n" ? "numeric" : cell?.v === "-" ? "not_applicable" : cell?.v == null || cell.v === "" ? "blank" : null;
          const native = status === "numeric" ? storedValues.get(address) ?? null : status === "not_applicable" ? String(cell.v) : null;
          const valueUsd = status === "numeric" && native !== null ? new D(native).mul(1000).toFixed() : null;
          if (!row || !status || row.source_id !== sourceId || row.source_sheet !== layout.source_sheet || row.source_cell !== address || row.source_block !== sourceBlock || row.classification !== "hs4" || row.classification_level !== "4" || row.role !== declared.role || row.value_status !== status || row.source_value !== (native ?? "") || row.source_unit !== "thousand_usd" || row.source_label !== declared.label_cells[0].value || row.source_number_format !== (cell?.z ?? "General") || row.publication_status !== "unspecified" || (valueUsd === null ? row.value_usd !== "" : !new D(row.value_usd).eq(valueUsd))) throw new Error(`Trade products source cell/identity/value/status mismatch: ${sourceId}:${address}`);
          counts[status]++;
          if (declared.role === "total") { controlObservations++; continue; }
          if (declared.role !== "detail" || row.product_code !== declared.dimensions.product_code || row.product_label_en !== declared.dimensions.product_label_en || row.item_id !== `goods.hs4.${sourceBlock}.${row.product_code}`) throw new Error(`Trade products source product identity/role mismatch: ${sourceId}:${address}`);
          const identity = expectedEntities.get(row.item_id) ?? { code: row.product_code, block: sourceBlock, names: new Set<string>() };
          identity.names.add(row.product_label_en); expectedEntities.set(row.item_id, identity);
          facts.push({ entityId: row.item_id, year, indicatorId: flow === "export" ? "trade.exports" : "trade.imports", valueUsd, unit: "usd", basis: "actual", valueStatus: status, publicationStatus: "unspecified", role: "detail", sourceId, sourceRefs: JSON.stringify([[sourceId, layout.source_sheet, address]]), sourceValue: native, sourceUnit: "thousand_usd", sourceLabel: row.source_label, sourceNumberFormat: row.source_number_format, sourceBlock, lastReviewedAt: REVIEWED_AT });
        }
        if (Object.keys(counts).some(key => counts[key as keyof typeof counts] !== (blocks[0].status_counts[key] ?? 0))) throw new Error(`Trade products source status inventory mismatch: ${sourceId}:${year}`);
        const total = rows.find(row => row.role === "total" && Number(row.year) === year)!;
        const sum = rows.filter(row => row.role === "detail" && row.value_status === "numeric" && Number(row.year) === year).reduce((value, row) => value.plus(row.value_usd), new D(0));
        const controls = reconciliation.filter(row => row.family === "goods_products" && row.flow === flow && Number(row.year) === year && row.item_id === "goods.total" && (JSON.parse(row.source_refs) as string[][]).some(ref => ref[0] === sourceId && ref[1] === layout.source_sheet));
        const nativeNational = nationalRows.filter(row => Number(row.year) === year && row.indicator_id === (flow === "export" ? "trade.exports" : "trade.imports"));
        if (controls.length !== 1 || controls[0].status !== "pass" || controls[0].tolerance_usd !== "1" || !new D(total.value_usd).eq(controls[0].expected_usd) || !sum.eq(controls[0].actual_usd) || sum.minus(total.value_usd).abs().gt(1) || nativeNational.length !== 1 || new D(total.value_usd).minus(nativeNational[0].value_usd).abs().gt(1)) throw new Error(`Trade products source reconciliation mismatch: ${sourceId}:${year}`);
      }
    }
  }
  if (entities.length !== 4768 || expectedEntities.size !== entities.length || entities.some(entity => { const source = expectedEntities.get(entity.id); return !source || entity.code !== source.code || entity.sourceBlock !== source.block || !source.names.has(entity.sourceLabelEn); }) || controlObservations !== 62) throw new Error("Trade products catalogue/source identity mismatch");
  facts.sort((a, b) => a.entityId.localeCompare(b.entityId, "en") || a.year - b.year || a.indicatorId.localeCompare(b.indicatorId, "en"));
  if (new Set(facts.map(tradeProductFactKey)).size !== facts.length) throw new Error("Trade products duplicate source observation");
  const content = serializeBomCsvRows([fields, ...facts.map(fact => [fact.entityId, fact.year, fact.indicatorId, fact.valueUsd ?? "", fact.unit, fact.basis, fact.valueStatus, fact.publicationStatus, fact.role, fact.sourceId, fact.sourceRefs, fact.sourceValue ?? "", fact.sourceUnit, fact.sourceLabel, fact.sourceNumberFormat, fact.sourceBlock, fact.lastReviewedAt])]);
  const primaryValueStatusCounts = { numeric: 0, blank: 0, not_applicable: 0 }; facts.forEach(fact => primaryValueStatusCounts[fact.valueStatus]++);
  const report: TradeProductsAcceptance = { status: "passed", scope: "annual_goods_products", years: Array.from({ length: 31 }, (_, index) => 1995 + index), productEntities: entities.length, primaryObservations: facts.length, controlObservations, primaryValueStatusCounts, sourceSha256, inputSha256, canonicalSha256: hash(content), catalogueSha256: hash(catalogueBytes), englishLabelsSha256: hash(tradeProductsEnglishLabels(entities, labels)), reviewedAt: REVIEWED_AT, researchPackageStatus: researchReport.status, outsideScopeHoldCount: holds.issues.length };
  validateTradeProductsData({ entities, facts }, report);
  for (const [name, expected] of [["data/imports/trade-products-annual.csv", content], ["data/reports/trade-products-validation.json", JSON.stringify(report, null, 2) + "\n"]]) {
    const target = path.join(repositoryRoot, name);
    if (mode === "check") await assertGeneratedArtifactMatches("Trade products", target, expected);
    else { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, expected); }
  }
}
