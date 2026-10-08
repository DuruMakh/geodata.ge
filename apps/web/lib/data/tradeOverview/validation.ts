import Decimal from "decimal.js";
import { TRADE_OVERVIEW_INDICATORS, TRADE_OVERVIEW_SOURCE, TRADE_OVERVIEW_SHEET, tradeOverviewFactKey, type TradeOverviewFact } from "./types";

const D = Decimal.clone({ precision: 50 });

export function tradeOverviewSourceRefs(year: number, indicatorId: TradeOverviewFact["indicatorId"]): string {
  const columnNumber = year - 1993;
  const column = columnNumber <= 26 ? String.fromCharCode(64 + columnNumber) : `A${String.fromCharCode(64 + columnNumber - 26)}`;
  const exports = [TRADE_OVERVIEW_SOURCE, TRADE_OVERVIEW_SHEET, `${column}5`];
  const imports = [TRADE_OVERVIEW_SOURCE, TRADE_OVERVIEW_SHEET, `${column}20`];
  return JSON.stringify(indicatorId === "trade.exports" ? [exports] : indicatorId === "trade.imports" ? [imports] : [exports, imports]);
}

export function validateTradeOverviewFacts(facts: readonly TradeOverviewFact[], expectedYears: readonly number[]): void {
  const years = new Set(expectedYears);
  const keys = new Set<string>();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = tradeOverviewFactKey(fact);
    if (!TRADE_OVERVIEW_INDICATORS.includes(fact.indicatorId) || fact.unit !== "usd" || fact.basis !== "actual" || fact.valueStatus !== "numeric" || fact.publicationStatus !== "unspecified") throw new Error(`Invalid trade indicator/status contract: ${key}`);
    if (!Number.isInteger(fact.year) || !years.has(fact.year) || fact.year < 1995 || fact.year > 2025) throw new Error(`Trade coverage contains unsupported year: ${key}`);
    if (keys.has(key)) throw new Error(`Duplicate trade observation: ${key}`);
    keys.add(key);
    if (fact.sourceId !== TRADE_OVERVIEW_SOURCE || fact.sourceRefs !== tradeOverviewSourceRefs(fact.year, fact.indicatorId) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt) || Number.isNaN(Date.parse(`${fact.lastReviewedAt}T00:00:00Z`))) throw new Error(`Invalid trade source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.valueUsd); } catch { throw new Error(`Invalid trade value: ${key}`); }
    if (!value.isFinite() || value.decimalPlaces() > 20 || value.abs().gte("100000000000000000000")) throw new Error(`Invalid trade value or database precision: ${key}`);
    const primary = fact.indicatorId === "trade.exports" || fact.indicatorId === "trade.imports";
    if (primary) {
      const label = fact.indicatorId === "trade.exports" ? "Total Exports" : "Total Imports";
      if (fact.role !== "total" || fact.sourceUnit !== "million_usd" || fact.sourceLabel !== label || typeof fact.sourceNumberFormat !== "string" || !fact.sourceNumberFormat || typeof fact.sourceValue !== "string" || !fact.sourceValue) throw new Error(`Invalid trade source fields/unit: ${key}`);
      let native: Decimal;
      try { native = new D(fact.sourceValue); } catch { throw new Error(`Invalid trade source value: ${key}`); }
      if (!native.isFinite() || native.isNegative() || !native.mul(1_000_000).eq(value)) throw new Error(`Trade USD conversion mismatch: ${key}`);
    } else if (fact.role !== "derived" || fact.sourceValue !== null || fact.sourceUnit !== null || fact.sourceLabel !== null || fact.sourceNumberFormat !== null) throw new Error(`Invalid derived trade source fields: ${key}`);
    values.set(key, value);
  }
  if (facts.length !== years.size * TRADE_OVERVIEW_INDICATORS.length || [...years].some(year => TRADE_OVERVIEW_INDICATORS.some(id => !keys.has(`${id}:${year}`)))) throw new Error("Incomplete trade coverage: indicator/year inventory differs");
  for (const year of years) {
    const exports = values.get(`trade.exports:${year}`)!;
    const imports = values.get(`trade.imports:${year}`)!;
    if (!values.get(`trade.turnover:${year}`)!.eq(exports.plus(imports)) || !values.get(`trade.balance:${year}`)!.eq(exports.minus(imports))) throw new Error(`Trade balance/turnover identity mismatch: ${year}`);
  }
}
