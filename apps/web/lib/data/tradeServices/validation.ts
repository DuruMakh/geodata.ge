import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { serializeBomCsvRows } from "../csvEscape";
import { TRADE_OVERVIEW_INDICATORS } from "../tradeOverview/types";
import { TRADE_SERVICE_IDS, TRADE_SERVICES_FIELDS, TRADE_SERVICES_INPUT_FILES, TRADE_SERVICES_RESEARCH, TRADE_SERVICES_SOURCES, tradeServicesFactKey, type TradeServicesAcceptance, type TradeServicesData } from "./types";

const D = Decimal.clone({ precision: 50 });
export const tradeServicesHash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
export const tradeServicesCatalogue = (data: TradeServicesData) => JSON.stringify(data.entities, null, 2) + "\n";
export function tradeServicesEnglishHash(labels: Record<string, string>): string {
  return tradeServicesHash(JSON.stringify(TRADE_SERVICE_IDS.map(id => [id, labels[id]])));
}
export function tradeServicesCsv(data: TradeServicesData): string {
  return serializeBomCsvRows([TRADE_SERVICES_FIELDS, ...data.facts.map(f => [f.entityId, f.year, f.indicatorId, f.valueUsd, f.unit, f.basis, f.valueStatus, f.publicationStatus, f.role, f.sourceId, f.sourceRefs, f.sourceValue, f.sourceUnit, f.sourceLabel, f.sourceNumberFormat, f.sourceBlock, f.lastReviewedAt])]);
}
export function validateTradeServicesData(data: TradeServicesData, report: TradeServicesAcceptance, englishLabels: Record<string, string>): void {
  if (report.status !== "passed" || report.scope !== "annual_services_types" || report.reviewedAt !== "2026-10-11" || JSON.stringify(report.years) !== "[2020,2021,2022,2023,2024]" || report.primaryObservations !== 130 || report.numericObservations !== 129 || report.unavailableObservations !== 1 || report.derivedObservations !== 128 || report.outsideScopeHoldCount !== 2 || report.outsideScopeHolds.length !== 2 || report.researchPackageStatus !== "requires_source_resolution") throw new Error("Services acceptance inventory mismatch");
  const entities = new Map(data.entities.map(e => [e.id, e]));
  if (entities.size !== 13 || data.entities.length !== 13 || TRADE_SERVICE_IDS.some(id => !entities.has(id))) throw new Error("Services catalogue identity inventory mismatch");
  for (const entity of data.entities) if (Object.keys(entity).length !== 4 || entity.kind !== (entity.id === "services.total" ? "national" : "service_type") || !entity.labelKa?.trim() || !entity.labelEn?.trim() || entity.labelEn !== englishLabels[entity.id]) throw new Error("Services catalogue labels/kind mismatch");
  if (tradeServicesHash(tradeServicesCatalogue(data)) !== report.catalogueSha256 || tradeServicesEnglishHash(englishLabels) !== report.englishLabelsSha256) throw new Error("Services catalogue/English fingerprint mismatch");
  if (Object.keys(report.sourceSha256).length !== 2 || Object.values(TRADE_SERVICES_SOURCES).some(id => !/^[a-f0-9]{64}$/.test(report.sourceSha256[id] ?? "")) || Object.keys(report.inputSha256).length !== TRADE_SERVICES_INPUT_FILES.length || TRADE_SERVICES_INPUT_FILES.some(name => !/^[a-f0-9]{64}$/.test(report.inputSha256[`${TRADE_SERVICES_RESEARCH}/${name}`] ?? ""))) throw new Error("Services source/input fingerprints missing");
  const holds = JSON.stringify({ status: "requires_publisher_resolution", issues: report.outsideScopeHolds }, null, 2) + "\n";
  if (tradeServicesHash(holds) !== report.inputSha256[`${TRADE_SERVICES_RESEARCH}/unresolved-source-issues.json`] || report.outsideScopeHolds.some((hold, index) => hold.year !== ["2022", "2024"][index] || hold.status !== "fail" || hold.check !== "service_country_matches_joint" || hold.item_id !== "partner.2020-2024.826")) throw new Error("Services outside-scope hold fingerprint mismatch");
  const keys = new Set<string>(), facts = new Map(data.facts.map(f => [tradeServicesFactKey(f), f]));
  for (const f of data.facts) {
    const key = tradeServicesFactKey(f), entity = entities.get(f.entityId), index = TRADE_SERVICE_IDS.findIndex(id => id === f.entityId);
    if (Object.keys(f).length !== TRADE_SERVICES_FIELDS.length || !entity || keys.has(key) || !report.years.includes(f.year) || !TRADE_OVERVIEW_INDICATORS.includes(f.indicatorId) || f.unit !== "usd" || f.basis !== "actual" || f.publicationStatus !== "unspecified" || f.lastReviewedAt !== report.reviewedAt) throw new Error(`Services canonical identity/status mismatch: ${key}`);
    keys.add(key);
    const primary = f.indicatorId === "trade.exports" || f.indicatorId === "trade.imports", unavailable = f.entityId === "services.maintenance_repair" && f.year === 2020 && f.indicatorId === "trade.exports";
    if (f.valueStatus !== (unavailable ? "not_applicable" : "numeric") || (f.valueUsd === null) !== unavailable) throw new Error(`Services missing-value mismatch: ${key}`);
    if (f.valueUsd !== null) {
      const value = new D(f.valueUsd);
      if (!value.isFinite() || value.decimalPlaces() > 20 || value.abs().gte("100000000000000000000")) throw new Error(`Services decimal precision mismatch: ${key}`);
    }
    if (primary) {
      const source = f.indicatorId === "trade.exports" ? TRADE_SERVICES_SOURCES.export : TRADE_SERVICES_SOURCES.import, row = index === 0 ? 5 : index + 6, column = String.fromCharCode(66 + f.year - 2020);
      const label = index === 0 ? (f.indicatorId === "trade.exports" ? "Export - total" : "Import - total") : entity.labelEn;
      if (f.role !== (index === 0 ? "total" : "detail") || f.sourceId !== source || f.sourceRefs !== JSON.stringify([[source, "Sheet1", `${column}${row}`]]) || f.sourceUnit !== "thousand_usd" || f.sourceBlock !== "2020-2024" || f.sourceLabel !== label || !f.sourceNumberFormat || f.sourceValue === null) throw new Error(`Services primary source metadata mismatch: ${key}`);
      if (unavailable ? f.sourceValue !== "-" : !new D(f.sourceValue).mul(1000).eq(f.valueUsd!)) throw new Error(`Services native conversion mismatch: ${key}`);
    } else {
      const exports = facts.get(`${f.entityId}:${f.year}:trade.exports`), imports = facts.get(`${f.entityId}:${f.year}:trade.imports`);
      if (!exports || !imports || exports.valueUsd === null || imports.valueUsd === null || f.role !== "derived" || [f.sourceId, f.sourceValue, f.sourceUnit, f.sourceLabel, f.sourceNumberFormat, f.sourceBlock].some(value => value !== null) || f.sourceRefs !== JSON.stringify([...JSON.parse(exports.sourceRefs), ...JSON.parse(imports.sourceRefs)])) throw new Error(`Services derivation counterparts/source mismatch: ${key}`);
      const value = f.indicatorId === "trade.balance" ? new D(exports.valueUsd).minus(imports.valueUsd) : new D(exports.valueUsd).plus(imports.valueUsd);
      if (!value.eq(f.valueUsd!)) throw new Error(`Services derivation arithmetic mismatch: ${key}`);
    }
  }
  if (data.facts.length !== 258 || data.facts.filter(f => f.role !== "derived").length !== 130 || data.facts.filter(f => f.role === "derived").length !== 128) throw new Error("Services fact inventory mismatch");
  for (const id of TRADE_SERVICE_IDS) for (const year of report.years) for (const indicator of TRADE_OVERVIEW_INDICATORS) {
    const absent = id === "services.maintenance_repair" && year === 2020 && ["trade.turnover", "trade.balance"].includes(indicator);
    if (keys.has(`${id}:${year}:${indicator}`) === absent) throw new Error("Services complete key inventory mismatch");
  }
  if (tradeServicesHash(tradeServicesCsv(data)) !== report.canonicalSha256) throw new Error("Services canonical fingerprint mismatch");
}
