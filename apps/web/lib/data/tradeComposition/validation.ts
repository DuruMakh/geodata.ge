import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { serializeBomCsvRows } from "../csvEscape";
import { TRADE_COMPOSITION_FIELDS, TRADE_COMPOSITION_IDS, TRADE_COMPOSITION_INPUT_FILES, TRADE_COMPOSITION_RESEARCH, TRADE_COMPOSITION_SOURCES, TRADE_COMPOSITION_YEARS, tradeCompositionFactKey, type TradeCompositionAcceptance, type TradeCompositionData } from "./types";

const D = Decimal.clone({ precision: 50 });
export const tradeCompositionHash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
export const tradeCompositionCatalogue = (data: TradeCompositionData) => JSON.stringify(data.entities, null, 2) + "\n";
export const tradeCompositionEnglishHash = (labels: Record<string, string>) => tradeCompositionHash(JSON.stringify(TRADE_COMPOSITION_IDS.map(id => [id, labels[id]])));
export function tradeCompositionCsv(data: TradeCompositionData): string {
  return serializeBomCsvRows([TRADE_COMPOSITION_FIELDS, ...data.facts.map(f => [f.entityId, f.year, f.indicatorId, f.valueUsd, f.unit, f.basis, f.valueStatus, f.publicationStatus, f.role, f.sourceId, f.sourceRefs, f.sourceValue, f.sourceUnit, f.sourceLabel, f.sourceNumberFormat, f.sourceBlock, f.lastReviewedAt])]);
}
export function validateTradeCompositionData(data: TradeCompositionData, report: TradeCompositionAcceptance, englishLabels: Record<string, string>): void {
  if (report.status !== "passed" || report.scope !== "annual_goods_composition" || report.reviewedAt !== "2026-10-14" || JSON.stringify(report.years) !== JSON.stringify(TRADE_COMPOSITION_YEARS) || report.entities !== 17 || report.primaryObservations !== 884 || report.numericObservations !== 884 || report.unavailableObservations !== 0 || report.derivedObservations !== 0 || report.controlObservations !== 104 || report.outsideScopeHoldCount !== 2 || report.outsideScopeHolds.length !== 2 || report.researchPackageStatus !== "requires_source_resolution") throw new Error("Composition acceptance inventory mismatch");
  const entities = new Map(data.entities.map(e => [e.id, e]));
  if (entities.size !== 17 || data.entities.length !== 17 || TRADE_COMPOSITION_IDS.some(id => !entities.has(id))) throw new Error("Composition catalogue identity inventory mismatch");
  for (const entity of data.entities) if (Object.keys(entity).length !== 5 || !["sitc", "bec"].includes(entity.classification) || entity.id !== `trade.${entity.classification}1.${entity.sourceCode}` || !entity.labelKa?.trim() || !entity.labelEn?.trim() || entity.labelEn !== englishLabels[entity.id]) throw new Error("Composition catalogue labels/classification mismatch");
  if (tradeCompositionHash(tradeCompositionCatalogue(data)) !== report.catalogueSha256 || tradeCompositionEnglishHash(englishLabels) !== report.englishLabelsSha256) throw new Error("Composition catalogue/English fingerprint mismatch");
  const sources = Object.values(TRADE_COMPOSITION_SOURCES).flatMap(flows => Object.values(flows)), inputs = [...TRADE_COMPOSITION_INPUT_FILES.map(name => `${TRADE_COMPOSITION_RESEARCH}/${name}`), "data/imports/trade-overview-annual.csv"];
  if (Object.keys(report.sourceSha256).length !== 4 || sources.some(id => !/^[a-f0-9]{64}$/.test(report.sourceSha256[id] ?? "")) || Object.keys(report.inputSha256).length !== inputs.length || inputs.some(name => !/^[a-f0-9]{64}$/.test(report.inputSha256[name] ?? ""))) throw new Error("Composition source/input fingerprints missing");
  const holds = JSON.stringify({ status: "requires_publisher_resolution", issues: report.outsideScopeHolds }, null, 2) + "\n";
  if (tradeCompositionHash(holds) !== report.inputSha256[`${TRADE_COMPOSITION_RESEARCH}/unresolved-source-issues.json`] || report.outsideScopeHolds.some((hold, index) => hold.year !== ["2022", "2024"][index] || hold.status !== "fail" || hold.check !== "service_country_matches_joint" || hold.family !== "services" || hold.flow !== "import" || hold.item_id !== "partner.2020-2024.826")) throw new Error("Composition outside-scope hold fingerprint mismatch");
  const keys = new Set<string>();
  for (const f of data.facts) {
    const key = tradeCompositionFactKey(f), entity = entities.get(f.entityId);
    if (Object.keys(f).length !== TRADE_COMPOSITION_FIELDS.length || !entity || keys.has(key) || !report.years.includes(f.year) || !["trade.exports", "trade.imports"].includes(f.indicatorId) || f.unit !== "usd" || f.basis !== "actual" || f.publicationStatus !== "unspecified" || f.lastReviewedAt !== report.reviewedAt || f.valueStatus !== "numeric" || f.valueUsd === null || f.role !== "detail") throw new Error(`Composition canonical identity/status mismatch: ${key}`);
    keys.add(key);
    const value = new D(f.valueUsd), source = TRADE_COMPOSITION_SOURCES[entity.classification][f.indicatorId === "trade.exports" ? "export" : "import"], row = 7 + Number(entity.sourceCode) - (entity.classification === "bec" ? 1 : 0), column = f.year < 2024 ? String.fromCharCode(67 + f.year - 2000) : f.year === 2024 ? "AA" : "AB";
    if (!value.isFinite() || value.decimalPlaces() > 20 || value.abs().gte("100000000000000000000")) throw new Error(`Composition decimal precision mismatch: ${key}`);
    if (f.sourceId !== source || f.sourceRefs !== JSON.stringify([[source, `${entity.classification.toUpperCase()}-2000-2025-years`, `${column}${row}`]]) || f.sourceUnit !== "thousand_usd" || f.sourceBlock !== "2000-2025" || f.sourceLabel !== entity.labelEn || !f.sourceNumberFormat || f.sourceValue === null || !new D(f.sourceValue).mul(1000).eq(value)) throw new Error(`Composition primary source metadata/conversion mismatch: ${key}`);
  }
  if (data.facts.length !== 884) throw new Error("Composition fact inventory mismatch");
  for (const id of TRADE_COMPOSITION_IDS) for (const year of report.years) for (const indicator of ["trade.exports", "trade.imports"]) if (!keys.has(`${id}:${year}:${indicator}`)) throw new Error("Composition complete key inventory mismatch");
  for (const classification of ["sitc", "bec"] as const) {
    const counts = report.classifications[classification], count = classification === "sitc" ? 10 : 7;
    if (counts.entities !== count || counts.primaryObservations !== count * 52 || counts.controlObservations !== 52 || report.reconciliation.filter(r => r.classification === classification).length !== 52) throw new Error("Composition classification inventory mismatch");
    for (const year of report.years) for (const indicatorId of ["trade.exports", "trade.imports"] as const) {
      const rows = report.reconciliation.filter(r => r.classification === classification && r.year === year && r.indicatorId === indicatorId), sum = data.facts.filter(f => entities.get(f.entityId)?.classification === classification && f.year === year && f.indicatorId === indicatorId).reduce((sum, f) => sum.plus(f.valueUsd!), new D(0));
      if (rows.length !== 1 || !sum.eq(rows[0].detailSumUsd) || !sum.minus(rows[0].controlUsd).eq(rows[0].detailDifferenceUsd) || !new D(rows[0].controlUsd).minus(rows[0].nationalUsd).eq(rows[0].nationalDifferenceUsd) || new D(rows[0].detailDifferenceUsd).abs().gt(1) || new D(rows[0].nationalDifferenceUsd).abs().gt(1)) throw new Error("Composition reconciliation mismatch");
    }
  }
  if (report.reconciliation.length !== 104 || tradeCompositionHash(tradeCompositionCsv(data)) !== report.canonicalSha256) throw new Error("Composition canonical fingerprint/reconciliation mismatch");
}
