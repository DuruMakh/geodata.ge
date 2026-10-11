import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { toClientTradeOverviewFact } from "../tradeOverview/importTradeOverview";
import type { ClientTradeOverviewFact, TradeOverviewFact } from "../tradeOverview/types";
import { packTradePartnerFacts, type ClientTradePartnersData } from "../tradePartners/importTradePartners";
import type { ClientTradeProductsData, ClientTradeProductFact } from "../tradeProducts/importTradeProducts";
import { TRADE_DOMESTIC_DOCUMENT_IDS, TRADE_DOMESTIC_MEASURES, tradeDomesticFactKey, type TradeDomesticData, type TradeDomesticEntity, type TradeDomesticFact, type TradeDomesticAcceptance } from "./types";

const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
export function validateTradeDomesticData(data: TradeDomesticData, report: TradeDomesticAcceptance): void {
  const entities = new Map(data.entities.map(entity => [entity.id, entity])), keys = new Set<string>();
  if (entities.size !== data.entities.length || data.entities.filter(e => e.kind === "country").length !== report.countryEntities || data.entities.filter(e => e.kind === "product").length !== report.productEntities || !entities.has("goods.total")) throw new Error("Domestic catalogue coverage mismatch");
  for (const fact of data.facts) {
    const entity = entities.get(fact.entityId), refs = JSON.parse(fact.sourceRefs), key = tradeDomesticFactKey(fact);
    if (!entity || keys.has(key) || !TRADE_DOMESTIC_MEASURES.some(id => id === fact.indicatorId) || !report.years.includes(fact.year) || !new Decimal(fact.valueUsd).isFinite() || fact.unit !== "usd" || fact.basis !== "actual" || fact.valueStatus !== "numeric" || fact.publicationStatus !== "unspecified" || !TRADE_DOMESTIC_DOCUMENT_IDS[fact.sourceId] || refs[0]?.[0] !== fact.sourceId || refs.length !== (fact.indicatorId === "trade.reexports" ? 2 : 1)) throw new Error("Domestic canonical coverage/value/source mismatch");
    if (entity.kind === "product" && (!report.productYears.includes(fact.year) || fact.indicatorId !== "trade.domestic_exports" || fact.sourceBlock !== "2020-2025")) throw new Error("Domestic product scope mismatch");
    if ((fact.indicatorId === "trade.reexports") !== (fact.role === "derived")) throw new Error("Domestic derivation role mismatch");
    keys.add(key);
  }
  if (data.facts.filter(f => f.role === "derived").length !== report.derivedObservations || data.facts.filter(f => f.role !== "derived").length !== report.primaryObservations) throw new Error("Domestic observation inventory mismatch");
}
export async function loadTradeDomesticData(): Promise<TradeDomesticData> {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [bytes, catalogue, reportBytes] = await Promise.all([readFile(path.join(root, "data/imports/trade-domestic-annual.csv")), readFile(path.join(root, "data/taxonomy/trade-domestic.json")), readFile(path.join(root, "data/reports/trade-domestic-validation.json"), "utf8")]);
  const report = JSON.parse(reportBytes) as TradeDomesticAcceptance;
  if (report.status !== "passed" || report.scope !== "annual_domestic_exports" || report.canonicalSha256 !== hash(bytes) || report.catalogueSha256 !== hash(catalogue)) throw new Error("Domestic export acceptance/canonical/catalogue fingerprint mismatch");
  const rows = parse(bytes, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
  const fields = ["entity_id", "year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "source_block", "last_reviewed_at"];
  if (!rows.length || rows.some(row => fields.some(field => !(field in row)))) throw new Error("Domestic canonical fields missing");
  const facts = rows.map(row => ({ entityId: row.entity_id, year: Number(row.year), indicatorId: row.indicator_id as TradeDomesticFact["indicatorId"], valueUsd: new Decimal(row.value_usd).toFixed(), unit: row.unit as "usd", basis: row.basis as "actual", valueStatus: row.value_status as "numeric", publicationStatus: row.publication_status as "unspecified", role: row.role as TradeDomesticFact["role"], sourceId: row.source_id, sourceRefs: row.source_refs, sourceValue: row.source_value || null, sourceUnit: row.source_unit || null, sourceLabel: row.source_label || null, sourceNumberFormat: row.source_number_format || null, sourceBlock: row.source_block, lastReviewedAt: row.last_reviewed_at }));
  const data = { entities: JSON.parse(catalogue.toString("utf8")) as TradeDomesticEntity[], facts };
  validateTradeDomesticData(data, report); return data;
}
export function assertTradeDomesticParity(csv: TradeDomesticData, mirror: TradeDomesticData): void {
  assertSameServedRows("Domestic export catalogue", csv.entities, mirror.entities, entity => entity.id);
  const normalize = (facts: TradeDomesticFact[]) => facts.map(f => ({ ...f, valueUsd: new Decimal(f.valueUsd).toFixed() }));
  assertSameServedRows("Domestic export facts", normalize(csv.facts), normalize(mirror.facts), tradeDomesticFactKey);
}
let served: Promise<TradeDomesticData> | null = null;
export function loadServedTradeDomesticData(): Promise<TradeDomesticData> {
  served ??= (async () => {
    const csv = await loadTradeDomesticData();
    if (resolveServedDataSource() === "csv") return csv;
    const { loadTradeDomesticDataFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadTradeDomesticDataFromDb(); assertTradeDomesticParity(csv, mirror); return mirror;
  })(); return served;
}
export function toClientTradeDomesticData(data: TradeDomesticData, national: readonly TradeOverviewFact[]): { national: ClientTradeOverviewFact[]; countries: ClientTradePartnersData; products: ClientTradeProductsData; englishLabels: Record<string, string> } {
  const nationalFacts: ClientTradeOverviewFact[] = data.facts.filter(f => f.entityId === "goods.total").map(f => ({ year: f.year, indicatorId: f.indicatorId, valueUsd: Number(f.valueUsd), sourceId: f.sourceId, publicationStatus: f.publicationStatus, role: f.role === "derived" ? "derived" : "total", lastReviewedAt: f.lastReviewedAt }));
  const countryEntities = data.entities.filter(e => e.kind === "country"), countryIds = new Set(countryEntities.map(e => e.id));
  const productEntities = data.entities.filter(e => e.kind === "product").map(e => ({ id: e.id, sourceBlock: "2020-2025" as const, code: e.code ?? "", labelKa: e.labelKa, sourceLabelEn: e.labelEn, categoryId: e.categoryId!, aliasesKa: e.aliasesKa, aliasesEn: e.aliasesEn }));
  const indices = new Map(productEntities.map((e, index) => [e.id, index]));
  const productFacts: ClientTradeProductFact[] = data.facts.filter(f => indices.has(f.entityId)).map(f => [indices.get(f.entityId)!, f.year, 0, Number(f.valueUsd)]);
  const productYears = [...new Set(productFacts.map(f => f[1]))].sort((a, b) => a - b);
  const nationalYears = new Set(nationalFacts.map(f => f.year));
  return {
    national: [...national.filter(f => f.indicatorId === "trade.exports" && nationalYears.has(f.year)).map(toClientTradeOverviewFact), ...nationalFacts],
    countries: { entities: countryEntities.map(e => ({ id: e.id, kind: "country", sourceCode: e.code, labelKa: e.labelKa })), facts: packTradePartnerFacts(countryEntities, data.facts.filter(f => countryIds.has(f.entityId))), nationalFacts, measures: TRADE_DOMESTIC_MEASURES },
    products: { entities: productEntities, years: productYears, facts: productFacts, nationalFacts: nationalFacts.filter(f => f.indicatorId === "trade.domestic_exports" && productYears.includes(f.year)), sourceBlock: "2020-2025", catalogueFingerprint: hash(JSON.stringify({ scope: "domestic-exports", entities: productEntities })), measures: ["trade.domestic_exports"] },
    englishLabels: Object.fromEntries(data.entities.map(e => [e.id, e.labelEn])),
  };
}
