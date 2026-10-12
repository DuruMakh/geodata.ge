import Decimal from "decimal.js";
import { TRADE_PRODUCT_BLOCKS, TRADE_PRODUCT_SOURCES, TRADE_PRODUCT_MEASURES, tradeProductCategory, tradeProductFactKey, type TradeProductEntity, type TradeProductsData, type TradeProductsAcceptance } from "./types";

const D = Decimal.clone({ precision: 50 });
export function tradeProductsEnglishLabels(entities: readonly TradeProductEntity[], labels: Record<string, { text: string; reviewedAt: string }>): string {
  return JSON.stringify(Object.fromEntries([...entities].sort((a, b) => a.id.localeCompare(b.id, "en")).map(entity => {
    const entry = labels[entity.id];
    if (!entry?.text || !/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt)) throw new Error(`Trade product English companion missing: ${entity.id}`);
    return [entity.id, { text: entry.text, reviewedAt: entry.reviewedAt }];
  })));
}
export function validateTradeProductsData({ entities, facts }: TradeProductsData, report: TradeProductsAcceptance): void {
  if (report.status !== "passed" || report.scope !== "annual_goods_products") throw new Error("Trade products acceptance scope mismatch");
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  if (!entities.length || byId.size !== entities.length) throw new Error("Trade product catalogue identity duplicate or missing");
  for (const entity of entities) {
    if (!TRADE_PRODUCT_BLOCKS.includes(entity.sourceBlock) || !/^\d{4}$/.test(entity.code) || entity.id !== `goods.hs4.${entity.sourceBlock}.${entity.code}`) throw new Error(`Trade product catalogue identity/code mismatch: ${entity.id}`);
    if (!entity.labelKa || !/[\u10A0-\u10FF]/.test(entity.labelKa) || !entity.sourceLabelEn || entity.categoryId !== tradeProductCategory(entity.code)) throw new Error(`Trade product catalogue label/category mismatch: ${entity.id}`);
    if (![entity.aliasesKa, entity.aliasesEn].every(aliases => Array.isArray(aliases) && aliases.every(alias => typeof alias === "string" && alias.trim()))) throw new Error(`Trade product catalogue aliases mismatch: ${entity.id}`);
  }
  const years = new Set(report.years), keys = new Set<string>(), seen = new Set<string>(), counts = { numeric: 0, blank: 0, not_applicable: 0 };
  for (const fact of facts) {
    const entity = byId.get(fact.entityId), key = tradeProductFactKey(fact);
    if (!entity || !TRADE_PRODUCT_MEASURES.includes(fact.indicatorId) || keys.has(key)) throw new Error(`Trade product identity/indicator/duplicate mismatch: ${key}`);
    const [start, end] = entity.sourceBlock.split("-").map(Number);
    if (!Number.isInteger(fact.year) || !years.has(fact.year) || fact.year < start || fact.year > end || fact.sourceBlock !== entity.sourceBlock) throw new Error(`Trade product historical coverage mismatch: ${key}`);
    if (fact.unit !== "usd" || fact.basis !== "actual" || fact.publicationStatus !== "unspecified" || fact.role !== "detail" || fact.lastReviewedAt !== report.reviewedAt) throw new Error(`Trade product role/status/review mismatch: ${key}`);
    const flow = fact.indicatorId === "trade.exports" ? "export" : "import";
    const refs = JSON.parse(fact.sourceRefs) as string[][];
    if (fact.sourceId !== TRADE_PRODUCT_SOURCES[entity.sourceBlock][flow] || refs.length !== 1 || refs[0].length !== 3 || refs[0][0] !== fact.sourceId || !refs[0][1] || !/^[A-Z]+\d+$/.test(refs[0][2]) || fact.sourceUnit !== "thousand_usd" || !fact.sourceLabel || !fact.sourceNumberFormat) throw new Error(`Trade product source binding/reference mismatch: ${key}`);
    if (fact.valueStatus === "numeric") {
      if (fact.valueUsd === null || fact.sourceValue === null) throw new Error(`Trade product numeric value missing: ${key}`);
      const value = new D(fact.valueUsd);
      if (!value.isFinite() || value.decimalPlaces() > 20 || value.abs().gte("100000000000000000000") || !new D(fact.sourceValue).mul(1000).eq(value)) throw new Error(`Trade product decimal/value conversion mismatch: ${key}`);
    } else if (!["blank", "not_applicable"].includes(fact.valueStatus) || fact.valueUsd !== null || (fact.valueStatus === "blank" && fact.sourceValue !== null)) throw new Error(`Trade product missing status mismatch: ${key}`);
    keys.add(key); seen.add(entity.id); counts[fact.valueStatus]++;
  }
  if (seen.size !== entities.length || entities.length !== report.productEntities || facts.length !== report.primaryObservations || Object.keys(counts).some(key => counts[key as keyof typeof counts] !== report.primaryValueStatusCounts[key as keyof typeof counts])) throw new Error("Trade product acceptance catalogue/coverage/count mismatch");
}
