import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readTradeSourceWorksheet } from "../parsing/tradeSourceWorkbook";
import { TRADE_PARTNER_SOURCES, TRADE_PARTNER_GROUP_IDS, tradePartnerFactKey, type TradePartnerEntity, type TradePartnerFact, type TradePartnersAcceptance } from "./types";
import { tradePartnersEnglishLabels, validateTradePartnersData } from "./validation";

const D = Decimal.clone({ precision: 50 }), RESEARCH = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07", REVIEWED_AT = "2026-10-08";
type Row = Record<string, string>;
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };
type SourceIssue = { family: string; year: string };
type LayoutRow = { row_index: number; role: string; item_id: string; dimensions: Record<string, string>; label_cells: { cell: string; value: string; format: string }[]; code_cells: { cell: string; value: string; format: string; stored_value: string }[] };
type Layout = { family: string; flow: "export" | "import"; source_id: string; source_sheet: string; source_unit: string; year_columns: Record<string, string>; rows: LayoutRow[] };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const fields = ["entity_id", "year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "source_block", "last_reviewed_at"];

export async function prepareTradePartnersData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH), inputSha256: Record<string, string> = {};
  const read = async (name: string) => { const bytes = await fs.readFile(path.join(directory, name)); inputSha256[name] = hash(bytes); return bytes; };
  const json = async <T>(name: string): Promise<T> => JSON.parse((await read(name)).toString("utf8"));
  const csv = async (name: string): Promise<Row[]> => parse(await read(name), { columns: true, bom: true, skip_empty_lines: true });
  const sources = await json<Source[]>("full-source-manifest.json"), layouts = await json<Layout[]>("source-layouts.json");
  const inventory = await json<{ full_manifest_sha256: string; layout_sha256: string; blocks: { source_id: string; source_sheet: string; source_block: string; year: string; source_key_count: number; identity_count: number; key_sha256: string; status_counts: Record<string, number> }[] }>("expected-observation-inventory.json");
  if (inventory.full_manifest_sha256 !== inputSha256["full-source-manifest.json"] || inventory.layout_sha256 !== inputSha256["source-layouts.json"]) throw new Error("Trade source inventory fingerprint mismatch");
  const coverage = await csv("coverage.csv"); await read("identity-review.csv");
  const researchReport = await json<{ status: string; unresolved_source_issues: SourceIssue[] }>("prepared-validation.json");
  const holds = await json<{ issues: SourceIssue[] }>("unresolved-source-issues.json");
  const reconciliation = await csv("prepared-reconciliation.csv");
  const countryRows = await csv("goods-countries-annual.csv"), groupRows = await csv("goods-country-groups-annual.csv");
  const catalogueBytes = await fs.readFile(path.join(repositoryRoot, "data/taxonomy/trade-partners.json"));
  const entities = JSON.parse(catalogueBytes.toString("utf8")) as TradePartnerEntity[];
  const labels = JSON.parse(await fs.readFile(path.join(repositoryRoot, "data/localization/en/labels.json"), "utf8"));
  const nationalBytes = await fs.readFile(path.join(repositoryRoot, "data/imports/trade-overview-annual.csv"));
  const nationalReport = JSON.parse(await fs.readFile(path.join(repositoryRoot, "data/reports/trade-overview-validation.json"), "utf8"));
  if (nationalReport.status !== "passed" || nationalReport.canonicalSha256 !== hash(nationalBytes)) throw new Error("Trade national reference acceptance mismatch");
  inputSha256["trade-overview-annual.csv"] = hash(nationalBytes);
  const nationalRows = parse(nationalBytes, { columns: true, bom: true }) as Row[];
  const expectedEntities = new Map([...countryRows.filter(r => r.role === "detail"), ...groupRows.filter(r => r.role === "subtotal")].map(row => [row.item_id, row]));
  if (entities.length !== 217 || expectedEntities.size !== entities.length || entities.some(e => { const row = expectedEntities.get(e.id); return !row || e.kind !== (row.role === "detail" ? "country" : "group") || e.sourceCode !== (row.role === "detail" ? row.partner_code : null); })) throw new Error("Trade catalogue/source identity or code mismatch");
  const facts: TradePartnerFact[] = [], sourceSha256: Record<string, string> = {};
  const years = Array.from({ length: 31 }, (_, index) => 1995 + index);
  if ([...researchReport.unresolved_source_issues, ...holds.issues].some(issue => ["goods_countries", "goods_country_groups", "goods_national"].includes(issue.family) && years.includes(Number(issue.year)))) throw new Error("Trade partner source acceptance hold requires resolution");
  for (const kind of ["country", "group"] as const) for (const flow of ["export", "import"] as const) {
    const sourceId = TRADE_PARTNER_SOURCES[kind][flow], family = kind === "country" ? "goods_countries" : "goods_country_groups";
    const matchingSources = sources.filter(s => s.source_id === sourceId), matchingLayouts = layouts.filter(l => l.family === family && l.flow === flow);
    if (matchingSources.length !== 1 || matchingLayouts.length !== 1) throw new Error(`Trade source layout inventory mismatch: ${sourceId}`);
    const source = matchingSources[0], layout = matchingLayouts[0];
    const { bytes, sha256 } = await readVerifiedPackageFile(directory, source.local_file, source, "Trade source capture/hash mismatch");
    sourceSha256[sourceId] = sha256;
    const { sheet, storedValues: stored } = readTradeSourceWorksheet(bytes, layout.source_sheet);
    if (sheet.A3?.v !== "(Thsd. USD)" || layout.source_id !== sourceId || layout.source_unit !== "thousand_usd" || JSON.stringify(Object.keys(layout.year_columns).map(Number).sort((a, b) => a - b)) !== JSON.stringify(years)) throw new Error(`Trade source unit/coverage mismatch: ${sourceId}`);
    for (const declaredRow of layout.rows) {
      for (const label of declaredRow.label_cells) if (String(sheet[label.cell]?.v) !== label.value || (sheet[label.cell]?.z ?? "General") !== label.format) throw new Error(`Trade source label/format mismatch: ${sourceId}:${label.cell}`);
      for (const code of declaredRow.code_cells) if (String(sheet[code.cell]?.v) !== code.value || (sheet[code.cell]?.z ?? "General") !== code.format || stored.get(code.cell) !== code.stored_value) throw new Error(`Trade source identity/code cell mismatch: ${sourceId}:${code.cell}`);
    }
    const rows = (kind === "country" ? countryRows : groupRows).filter(row => row.source_id === sourceId), byKey = new Map(rows.map(row => [`${row.item_id}:${row.year}`, row]));
    if (rows.length !== layout.rows.length * years.length || byKey.size !== rows.length) throw new Error(`Trade source coverage/duplicate mismatch: ${sourceId}`);
    const coverageRows = coverage.filter(row => row.source_id === sourceId);
    if (coverageRows.length !== years.length || new Set(coverageRows.map(row => row.year)).size !== years.length) throw new Error(`Trade source coverage inventory mismatch: ${sourceId}`);
    for (const year of years) {
      const column = layout.year_columns[String(year)], block = inventory.blocks.filter(b => b.source_id === sourceId && b.source_sheet === layout.source_sheet && Number(b.year) === year);
      if (Number(sheet[`${column}4`]?.v) !== year || block.length !== 1 || block[0].source_key_count !== layout.rows.length || block[0].source_block !== "1995-2025") throw new Error(`Trade source year/inventory coverage mismatch: ${sourceId}:${year}`);
      const reviewedCoverage = coverageRows.find(row => Number(row.year) === year);
      if (!reviewedCoverage || reviewedCoverage.family !== family || reviewedCoverage.flow !== flow || reviewedCoverage.source_sheet !== layout.source_sheet || reviewedCoverage.source_block !== "1995-2025" || Number(reviewedCoverage.identity_count) !== block[0].identity_count || Number(reviewedCoverage.source_key_count) !== block[0].source_key_count || reviewedCoverage.key_sha256 !== block[0].key_sha256) throw new Error(`Trade reviewed coverage mismatch: ${sourceId}:${year}`);
      const counts = { numeric: 0, blank: 0, not_applicable: 0 };
      for (const declaredRow of layout.rows) {
        const row = byKey.get(`${declaredRow.item_id}:${year}`), cell = `${column}${declaredRow.row_index}`, native = sheet[cell];
        const status = native?.t === "n" ? "numeric" : native?.v == null ? "blank" : "not_applicable";
        const sourceValue = status === "numeric" ? stored.get(cell)! : status === "blank" ? null : String(native.v);
        const usd = status === "numeric" ? new D(sourceValue!).mul(1000).toFixed() : null;
        if (!row || row.flow !== flow || row.role !== declaredRow.role || row.source_sheet !== layout.source_sheet || row.source_block !== "1995-2025" || row.source_cell !== cell || row.source_unit !== "thousand_usd" || row.source_label !== declaredRow.label_cells[0]?.value || row.source_number_format !== (native?.z ?? "General") || row.value_status !== status || row.publication_status !== "unspecified" || row.source_value !== (sourceValue ?? "") || (usd === null ? row.value_usd !== "" : !new D(row.value_usd).eq(usd)) || Object.entries(declaredRow.dimensions).some(([key, value]) => row[key] !== value)) throw new Error(`Trade source cell/status/metadata mismatch: ${sourceId}:${cell}`);
        counts[status]++;
        if (declaredRow.role !== (kind === "country" ? "detail" : "subtotal")) continue;
        if (kind === "group" && !TRADE_PARTNER_GROUP_IDS.some(id => id === row.item_id)) throw new Error(`Trade group source identity mismatch: ${row.item_id}`);
        facts.push({ entityId: row.item_id, year, indicatorId: flow === "export" ? "trade.exports" : "trade.imports", valueUsd: usd, unit: "usd", basis: "actual", valueStatus: status, publicationStatus: "unspecified", role: kind === "country" ? "detail" : "subtotal", sourceId, sourceRefs: JSON.stringify([[sourceId, layout.source_sheet, cell]]), sourceValue, sourceUnit: "thousand_usd", sourceLabel: row.source_label, sourceNumberFormat: row.source_number_format, sourceBlock: "1995-2025", lastReviewedAt: REVIEWED_AT });
      }
      if (Object.keys(counts).some(key => counts[key as keyof typeof counts] !== (block[0].status_counts[key] ?? 0) || Number(reviewedCoverage[`${key}_count`]) !== counts[key as keyof typeof counts])) throw new Error(`Trade source status inventory mismatch: ${sourceId}:${year}`);
    }
  }
  for (const flow of ["export", "import"] as const) for (const year of years) {
    const controls = reconciliation.filter(r => r.family === "goods_countries" && r.flow === flow && Number(r.year) === year);
    const primary = countryRows.filter(r => r.flow === flow && Number(r.year) === year);
    for (const control of controls) {
      const total = primary.find(r => r.item_id === control.item_id && r.role !== "detail")!;
      const members = primary.filter(r => r.role === "detail" && (control.item_id === "goods.total" || r.source_group_id === control.item_id) && r.value_status === "numeric");
      const sum = members.reduce((value, r) => value.plus(r.value_usd), new D(0));
      if (!total || control.status !== "pass" || !new D(total.value_usd).eq(control.expected_usd) || !sum.eq(control.actual_usd) || sum.minus(total.value_usd).abs().gt(control.tolerance_usd)) throw new Error(`Trade source reconciliation mismatch: ${flow}:${year}:${control.item_id}`);
    }
    if (controls.length !== 4) throw new Error(`Trade source reconciliation coverage mismatch: ${flow}:${year}`);
    const countryTotal = primary.find(r => r.role === "total")!, groupTotal = groupRows.find(r => r.flow === flow && Number(r.year) === year && r.role === "total")!;
    const national = nationalRows.filter(r => Number(r.year) === year && r.indicator_id === (flow === "export" ? "trade.exports" : "trade.imports"));
    const tolerance = controls.find(r => r.item_id === "goods.total")!.tolerance_usd;
    if (new D(countryTotal.value_usd).minus(groupTotal.value_usd).abs().gt(tolerance) || national.length !== 1 || new D(countryTotal.value_usd).minus(national[0].value_usd).abs().gt(tolerance)) throw new Error(`Trade group national source reconciliation mismatch: ${flow}:${year}`);
  }
  const primary = new Map(facts.map(fact => [tradePartnerFactKey(fact), fact]));
  for (const entity of entities) for (const year of years) {
    const e = primary.get(`${entity.id}:trade.exports:${year}`), i = primary.get(`${entity.id}:trade.imports:${year}`);
    if (e?.valueUsd == null || i?.valueUsd == null) continue;
    for (const indicatorId of ["trade.turnover", "trade.balance"] as const) facts.push({ ...e, indicatorId, valueUsd: (indicatorId === "trade.turnover" ? new D(e.valueUsd).plus(i.valueUsd) : new D(e.valueUsd).minus(i.valueUsd)).toFixed(), role: "derived", sourceRefs: JSON.stringify([JSON.parse(e.sourceRefs)[0], JSON.parse(i.sourceRefs)[0]]), sourceValue: null, sourceUnit: null, sourceLabel: null, sourceNumberFormat: null });
  }
  facts.sort((a, b) => a.entityId.localeCompare(b.entityId, "en") || a.year - b.year || a.indicatorId.localeCompare(b.indicatorId, "en"));
  const content = serializeBomCsvRows([fields, ...facts.map(f => [f.entityId, f.year, f.indicatorId, f.valueUsd ?? "", f.unit, f.basis, f.valueStatus, f.publicationStatus, f.role, f.sourceId, f.sourceRefs, f.sourceValue ?? "", f.sourceUnit ?? "", f.sourceLabel ?? "", f.sourceNumberFormat ?? "", f.sourceBlock, f.lastReviewedAt])]);
  const statusCounts = { numeric: 0, blank: 0, not_applicable: 0 };
  facts.filter(f => f.role !== "derived").forEach(f => statusCounts[f.valueStatus]++);
  const report: TradePartnersAcceptance = { status: "passed", scope: "annual_goods_partners", years, countryEntities: entities.filter(e => e.kind === "country").length, groupEntities: entities.filter(e => e.kind === "group").length, primaryObservations: facts.filter(f => f.role !== "derived").length, derivedObservations: facts.filter(f => f.role === "derived").length, primaryValueStatusCounts: statusCounts, sourceSha256, inputSha256, canonicalSha256: hash(content), catalogueSha256: hash(catalogueBytes), englishLabelsSha256: hash(tradePartnersEnglishLabels(entities, labels)), reviewedAt: REVIEWED_AT, researchPackageStatus: researchReport.status, outsideScopeHoldCount: holds.issues.length };
  validateTradePartnersData({ entities, facts }, report);
  const outputs = [["data/imports/trade-partners-annual.csv", content], ["data/reports/trade-partners-validation.json", JSON.stringify(report, null, 2) + "\n"]] as const;
  for (const [name, expected] of outputs) {
    const target = path.join(repositoryRoot, name);
    if (mode === "check") await assertGeneratedArtifactMatches("Trade partners", target, expected);
    else { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, expected); }
  }
}
