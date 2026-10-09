import Decimal from "decimal.js";
import { TRADE_OVERVIEW_INDICATORS } from "../tradeOverview/types";
import { TRADE_PARTNER_GROUP_IDS, TRADE_PARTNER_SOURCES, tradePartnerFactKey, type TradePartnerEntity, type TradePartnersData, type TradePartnersAcceptance } from "./types";

const D = Decimal.clone({ precision: 50 });
export function tradePartnersEnglishLabels(entities: readonly TradePartnerEntity[], labels: Record<string, { text: string; reviewedAt: string }>): string {
  return JSON.stringify(Object.fromEntries([...entities].sort((a, b) => a.id.localeCompare(b.id, "en")).map(entity => {
    const entry = labels[entity.id];
    if (!entry?.text || !/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt)) throw new Error(`Trade partner English companion missing: ${entity.id}`);
    return [entity.id, { text: entry.text, reviewedAt: entry.reviewedAt }];
  })));
}
export function validateTradePartnersData({ entities, facts }: TradePartnersData, report: TradePartnersAcceptance): void {
  if (report.status !== "passed" || report.scope !== "annual_goods_partners") throw new Error("Trade partners acceptance scope mismatch");
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));
  if (!entities.length || entityMap.size !== entities.length) throw new Error("Trade partner catalogue identity duplicate or missing");
  for (const entity of entities) {
    if (!entity.labelKa || !/[\u10A0-\u10FF]/.test(entity.labelKa)) throw new Error(`Missing reviewed trade partner label: ${entity.id}`);
    if (entity.kind === "country") {
      if (!entity.sourceCode || !/^\d{3}$/.test(entity.sourceCode) || entity.id !== `partner.1995-2025.${entity.sourceCode}`) throw new Error(`Trade partner catalogue code mismatch: ${entity.id}`);
    } else if (entity.kind !== "group" || entity.sourceCode !== null || !TRADE_PARTNER_GROUP_IDS.some(id => id === entity.id)) throw new Error(`Trade group identity mismatch: ${entity.id}`);
  }
  const years = new Set(report.years), cells = new Map<string, (typeof facts)[number]>();
  const statuses = { numeric: 0, blank: 0, not_applicable: 0 };
  for (const fact of facts) {
    const entity = entityMap.get(fact.entityId), key = tradePartnerFactKey(fact);
    if (!entity || !TRADE_OVERVIEW_INDICATORS.includes(fact.indicatorId) || cells.has(key)) throw new Error(`Trade partner identity/indicator/duplicate mismatch: ${key}`);
    if (!Number.isInteger(fact.year) || !years.has(fact.year) || fact.year < 1995 || fact.year > 2025 || fact.sourceBlock !== "1995-2025") throw new Error(`Trade partner coverage mismatch: ${key}`);
    if (fact.unit !== "usd" || fact.basis !== "actual" || fact.publicationStatus !== "unspecified" || fact.lastReviewedAt !== report.reviewedAt) throw new Error(`Trade partner status/review contract mismatch: ${key}`);
    const primary = fact.indicatorId === "trade.exports" || fact.indicatorId === "trade.imports";
    const flow = fact.indicatorId === "trade.imports" ? "import" : "export";
    if (fact.sourceId !== TRADE_PARTNER_SOURCES[entity.kind][flow]) throw new Error(`Trade partner source binding mismatch: ${key}`);
    const refs = JSON.parse(fact.sourceRefs) as string[][];
    if (!Array.isArray(refs) || refs.some(ref => !Array.isArray(ref) || ref.length !== 3 || ref[1] !== "1995-2025-years" || !/^[A-Z]+\d+$/.test(ref[2]))) throw new Error(`Trade partner source reference mismatch: ${key}`);
    if (fact.valueStatus === "numeric") {
      if (fact.valueUsd === null) throw new Error(`Missing numeric trade partner value: ${key}`);
      const value = new D(fact.valueUsd);
      if (!value.isFinite() || value.decimalPlaces() > 20 || value.abs().gte("100000000000000000000")) throw new Error(`Trade partner database precision mismatch: ${key}`);
    } else if (!primary || !["blank", "not_applicable"].includes(fact.valueStatus) || fact.valueUsd !== null) throw new Error(`Trade partner missing status mismatch: ${key}`);
    if (primary) {
      if (fact.role !== (entity.kind === "country" ? "detail" : "subtotal") || refs.length !== 1 || refs[0][0] !== fact.sourceId || fact.sourceUnit !== "thousand_usd" || !fact.sourceLabel || !fact.sourceNumberFormat) throw new Error(`Trade partner primary role/source mismatch: ${key}`);
      if (fact.valueStatus === "numeric" && (fact.sourceValue === null || !new D(fact.sourceValue).mul(1000).eq(fact.valueUsd!))) throw new Error(`Trade partner USD conversion mismatch: ${key}`);
      if (fact.valueStatus === "blank" && fact.sourceValue !== null) throw new Error(`Trade partner blank source mismatch: ${key}`);
      statuses[fact.valueStatus]++;
    } else if (fact.role !== "derived" || refs.length !== 2 || fact.sourceValue !== null || fact.sourceUnit !== null || fact.sourceLabel !== null || fact.sourceNumberFormat !== null) throw new Error(`Trade partner derived metadata mismatch: ${key}`);
    cells.set(key, fact);
  }
  for (const entity of entities) for (const year of years) {
    const e = cells.get(`${entity.id}:trade.exports:${year}`), i = cells.get(`${entity.id}:trade.imports:${year}`);
    if (!e && !i) throw new Error(`Trade partner primary coverage missing: ${entity.id}:${year}`);
    for (const id of ["trade.turnover", "trade.balance"] as const) {
      const derived = cells.get(`${entity.id}:${id}:${year}`);
      if (e?.valueUsd !== null && e?.valueUsd !== undefined && i?.valueUsd !== null && i?.valueUsd !== undefined) {
        const wanted = id === "trade.turnover" ? new D(e.valueUsd).plus(i.valueUsd) : new D(e.valueUsd).minus(i.valueUsd);
        const refs = JSON.stringify([JSON.parse(e.sourceRefs)[0], JSON.parse(i.sourceRefs)[0]]);
        if (!derived || !new D(derived.valueUsd!).eq(wanted) || derived.sourceRefs !== refs) throw new Error(`Trade partner derivation/source order mismatch: ${entity.id}:${year}:${id}`);
      } else if (derived) throw new Error(`Trade partner missing counterpart used in derivation: ${entity.id}:${year}`);
    }
  }
  if (entities.filter(e => e.kind === "country").length !== report.countryEntities || entities.filter(e => e.kind === "group").length !== report.groupEntities || facts.filter(f => f.role === "derived").length !== report.derivedObservations || facts.filter(f => f.role !== "derived").length !== report.primaryObservations || Object.keys(statuses).some(key => statuses[key as keyof typeof statuses] !== report.primaryValueStatusCounts[key as keyof typeof statuses])) throw new Error("Trade partner acceptance counts mismatch");
}
