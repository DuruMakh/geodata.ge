import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { serializeBomCsvRows } from "../csvEscape";
import { TRADE_OVERVIEW_INDICATORS } from "../tradeOverview/types";
import { TRADE_SERVICE_IDS, TRADE_SERVICES_COUNTRY_SOURCES, TRADE_SERVICES_DOCUMENT_IDS, TRADE_SERVICES_FIELDS, TRADE_SERVICES_INPUT_FILES, TRADE_SERVICES_JOINT_HOLDS_SHA256, TRADE_SERVICES_RESIDUAL_IDS, TRADE_SERVICES_RESEARCH, TRADE_SERVICES_SOURCES, tradeServicesFactKey, type TradeServicesAcceptance, type TradeServicesData } from "./types";

const D = Decimal.clone({ precision: 50 });
export const tradeServicesHash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
export const tradeServicesCatalogue = (data: TradeServicesData) => JSON.stringify(data.entities, null, 2) + "\n";
export function tradeServicesEnglishHash(labels: Record<string, string>, ids: readonly string[] = TRADE_SERVICE_IDS): string {
  return tradeServicesHash(JSON.stringify([...ids].sort().map(id => [id, labels[id]])));
}
export function tradeServicesCsv(data: TradeServicesData): string {
  return serializeBomCsvRows([TRADE_SERVICES_FIELDS, ...data.facts.map(f => [f.entityId, f.year, f.indicatorId, f.valueUsd, f.unit, f.basis, f.valueStatus, f.publicationStatus, f.role, f.sourceId, f.sourceRefs, f.sourceValue, f.sourceUnit, f.sourceLabel, f.sourceNumberFormat, f.sourceBlock, f.lastReviewedAt])]);
}
export function validateTradeServicesData(data: TradeServicesData, report: TradeServicesAcceptance, englishLabels: Record<string, string>): void {
  if (report.status !== "passed" || report.scope !== "annual_services_types_and_countries" || report.countrySourcePolicy !== "published_country_totals" || report.countryControlObservations !== 40 || report.reviewedAt !== "2026-10-14" || JSON.stringify(report.years) !== "[2020,2021,2022,2023,2024]" || report.primaryObservations !== 1415 || report.numericObservations !== 1400 || report.unavailableObservations !== 15 || report.derivedObservations !== 1142 || report.outsideScopeHoldCount !== 2 || report.outsideScopeHolds.length !== 2 || report.researchPackageStatus !== "requires_source_resolution") throw new Error("Services acceptance inventory mismatch");
  const entities = new Map(data.entities.map(e => [e.id, e]));
  if (entities.size !== 166 || data.entities.length !== 166 || TRADE_SERVICE_IDS.some(id => !entities.has(id)) || data.entities.filter(e => e.kind === "country").length !== 149 || Object.values(TRADE_SERVICES_RESIDUAL_IDS).some(id => entities.get(id)?.kind !== "residual")) throw new Error("Services catalogue identity inventory mismatch");
  for (const entity of data.entities) {
    const kind = entity.id === "services.total" ? "national" : (TRADE_SERVICE_IDS as readonly string[]).includes(entity.id) ? "service_type" : /^partner\.2020-2024\.\d{3}$/.test(entity.id) ? "country" : "residual";
    if (Object.keys(entity).length !== 4 || entity.kind !== kind || !entity.labelKa?.trim() || !entity.labelEn?.trim() || entity.labelEn !== englishLabels[entity.id]) throw new Error("Services catalogue labels/kind mismatch");
  }
  if (tradeServicesHash(tradeServicesCatalogue(data)) !== report.catalogueSha256 || tradeServicesEnglishHash(englishLabels, [...entities.keys()]) !== report.englishLabelsSha256) throw new Error("Services catalogue/English fingerprint mismatch");
  if (Object.keys(report.sourceSha256).length !== 4 || Object.keys(TRADE_SERVICES_DOCUMENT_IDS).some(id => !/^[a-f0-9]{64}$/.test(report.sourceSha256[id] ?? "")) || Object.keys(report.inputSha256).length !== TRADE_SERVICES_INPUT_FILES.length || TRADE_SERVICES_INPUT_FILES.some(name => !/^[a-f0-9]{64}$/.test(report.inputSha256[`${TRADE_SERVICES_RESEARCH}/${name}`] ?? ""))) throw new Error("Services source/input fingerprints missing");
  const holds = JSON.stringify({ status: "requires_publisher_resolution", issues: report.outsideScopeHolds }, null, 2) + "\n";
  if (tradeServicesHash(holds) !== TRADE_SERVICES_JOINT_HOLDS_SHA256 || tradeServicesHash(holds) !== report.inputSha256[`${TRADE_SERVICES_RESEARCH}/unresolved-source-issues.json`] || report.outsideScopeHolds.some((hold, index) => hold.year !== ["2022", "2024"][index] || hold.status !== "fail" || hold.check !== "service_country_matches_joint" || hold.item_id !== "partner.2020-2024.826")) throw new Error("Services outside-scope hold fingerprint mismatch");
  const keys = new Set<string>(), sourceCells = new Set<string>(), facts = new Map(data.facts.map(f => [tradeServicesFactKey(f), f]));
  for (const f of data.facts) {
    const key = tradeServicesFactKey(f), entity = entities.get(f.entityId), index = TRADE_SERVICE_IDS.findIndex(id => id === f.entityId);
    if (Object.keys(f).length !== TRADE_SERVICES_FIELDS.length || !entity || keys.has(key) || !report.years.includes(f.year) || !TRADE_OVERVIEW_INDICATORS.includes(f.indicatorId) || f.unit !== "usd" || f.basis !== "actual" || f.publicationStatus !== "unspecified" || f.lastReviewedAt !== report.reviewedAt) throw new Error(`Services canonical identity/status mismatch: ${key}`);
    keys.add(key);
    const primary = f.indicatorId === "trade.exports" || f.indicatorId === "trade.imports", countries = entity.kind === "country" || entity.kind === "residual";
    const unavailable = primary && (countries ? f.sourceValue === "-" : f.entityId === "services.maintenance_repair" && f.year === 2020 && f.indicatorId === "trade.exports");
    if (f.valueStatus !== (unavailable ? "not_applicable" : "numeric") || (f.valueUsd === null) !== unavailable) throw new Error(`Services missing-value mismatch: ${key}`);
    if (f.valueUsd !== null) {
      const value = new D(f.valueUsd);
      if (!value.isFinite() || value.decimalPlaces() > 20 || value.abs().gte("100000000000000000000")) throw new Error(`Services decimal precision mismatch: ${key}`);
    }
    if (primary) {
      const flow = f.indicatorId === "trade.exports" ? "export" : "import", source = (countries ? TRADE_SERVICES_COUNTRY_SOURCES : TRADE_SERVICES_SOURCES)[flow], row = index === 0 ? 5 : index + 6, column = String.fromCharCode((countries ? 67 : 66) + f.year - 2020);
      const label = index === 0 ? (f.indicatorId === "trade.exports" ? "Export - total" : "Import - total") : entity.labelEn;
      const refs = JSON.parse(f.sourceRefs) as string[][], countryRow = Number(refs[0]?.[2]?.slice(1));
      const countryReference = refs.length === 1 && refs[0]?.[0] === source && refs[0]?.[1] === "Sheet1" && refs[0]?.[2] === `${column}${countryRow}` && countryRow >= 8 && countryRow <= (flow === "export" ? 157 : 122);
      const expectedRole = entity.kind === "residual" ? "residual" : index === 0 ? "total" : "detail";
      const labelMatches = entity.kind === "residual" ? TRADE_SERVICES_RESIDUAL_IDS[f.sourceLabel!] === entity.id : f.sourceLabel === label;
      if (f.role !== expectedRole || f.sourceId !== source || (countries ? !countryReference : f.sourceRefs !== JSON.stringify([[source, "Sheet1", `${column}${row}`]])) || sourceCells.has(f.sourceRefs) || f.sourceUnit !== "thousand_usd" || f.sourceBlock !== "2020-2024" || !labelMatches || !f.sourceNumberFormat || f.sourceValue === null) throw new Error(`Services primary source metadata mismatch: ${key}`);
      sourceCells.add(f.sourceRefs);
      if (unavailable ? f.sourceValue !== "-" : !new D(f.sourceValue).mul(1000).eq(f.valueUsd!)) throw new Error(`Services native conversion mismatch: ${key}`);
    } else {
      const exports = facts.get(`${f.entityId}:${f.year}:trade.exports`), imports = facts.get(`${f.entityId}:${f.year}:trade.imports`);
      if (!exports || !imports || exports.valueUsd === null || imports.valueUsd === null || f.role !== "derived" || [f.sourceId, f.sourceValue, f.sourceUnit, f.sourceLabel, f.sourceNumberFormat, f.sourceBlock].some(value => value !== null) || f.sourceRefs !== JSON.stringify([...JSON.parse(exports.sourceRefs), ...JSON.parse(imports.sourceRefs)])) throw new Error(`Services derivation counterparts/source mismatch: ${key}`);
      const value = f.indicatorId === "trade.balance" ? new D(exports.valueUsd).minus(imports.valueUsd) : new D(exports.valueUsd).plus(imports.valueUsd);
      if (!value.eq(f.valueUsd!)) throw new Error(`Services derivation arithmetic mismatch: ${key}`);
    }
  }
  if (data.facts.length !== 2557 || data.facts.filter(f => f.role !== "derived").length !== 1415 || data.facts.filter(f => f.role !== "derived" && f.valueStatus === "numeric").length !== 1400 || data.facts.filter(f => f.role === "derived").length !== 1142) throw new Error("Services fact inventory mismatch");
  for (const id of TRADE_SERVICE_IDS) for (const year of report.years) for (const indicator of TRADE_OVERVIEW_INDICATORS) {
    const absent = id === "services.maintenance_repair" && year === 2020 && ["trade.turnover", "trade.balance"].includes(indicator);
    if (keys.has(`${id}:${year}:${indicator}`) === absent) throw new Error("Services complete key inventory mismatch");
  }
  for (const entity of data.entities) {
    for (const indicator of ["trade.exports", "trade.imports"] as const) {
      const count = data.facts.filter(f => f.entityId === entity.id && f.indicatorId === indicator).length;
      if (count !== 0 && count !== report.years.length) throw new Error("Services country flow coverage mismatch");
    }
    for (const year of report.years) {
      const inputs = ["trade.exports", "trade.imports"].map(indicator => facts.get(`${entity.id}:${year}:${indicator}`));
      const numericInputs = inputs.every(f => f && f.valueUsd !== null);
      for (const indicator of ["trade.turnover", "trade.balance"]) if (keys.has(`${entity.id}:${year}:${indicator}`) !== numericInputs) throw new Error("Services complete derivation inventory mismatch");
    }
  }
  if (tradeServicesHash(tradeServicesCsv(data)) !== report.canonicalSha256) throw new Error("Services canonical fingerprint mismatch");
}
