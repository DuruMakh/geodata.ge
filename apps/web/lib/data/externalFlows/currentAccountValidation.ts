import Decimal from "decimal.js";
import { CURRENT_ACCOUNT_FLOWS, CURRENT_ACCOUNT_PARTS, CURRENT_ACCOUNT_SERIES, CURRENT_ACCOUNT_SOURCE, CURRENT_ACCOUNT_YEARS, currentAccountFactKey, type CurrentAccountFact } from "./types";

const D = Decimal.clone({ precision: 50 });
/** NBG publishes amounts in million USD; the research package reconciles its BoP identities within one dollar. */
const TOLERANCE_USD = new D(1);

/** Every series, flow and year exactly once; net is credit minus debit; the four parts add up to the current account. */
export function validateCurrentAccountFacts(facts: readonly CurrentAccountFact[]): void {
  const byKey = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = currentAccountFactKey(fact);
    if (!CURRENT_ACCOUNT_SERIES.includes(fact.seriesId) || !CURRENT_ACCOUNT_FLOWS.includes(fact.flow) || byKey.has(key)) throw new Error(`Current account identity/flow/duplicate mismatch: ${key}`);
    if (!Number.isInteger(fact.year) || fact.year < CURRENT_ACCOUNT_YEARS.first || fact.year > CURRENT_ACCOUNT_YEARS.last) throw new Error(`Current account coverage mismatch: ${key}`);
    if (fact.unit !== "usd" || fact.basis !== "actual" || fact.sourceId !== CURRENT_ACCOUNT_SOURCE || fact.sourceUnit !== "million_usd" || !fact.sourceSheet || !/^[A-Z]+\d+$/.test(fact.sourceCells) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.vintage) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Current account source contract mismatch: ${key}`);
    if (typeof fact.valueUsd !== "string" || fact.valueUsd === "") throw new Error(`Missing current account value: ${key}`);
    const value = new D(fact.valueUsd);
    if (!value.isFinite() || value.decimalPlaces() > 20 || value.abs().gte("100000000000000000000")) throw new Error(`Current account database precision mismatch: ${key}`);
    byKey.set(key, value);
  }
  const get = (seriesId: string, flow: string, year: number) => {
    const value = byKey.get(`${seriesId}:${flow}:${year}`);
    if (!value) throw new Error(`Current account coverage mismatch: ${seriesId}:${flow}:${year}`);
    return value;
  };
  for (let year = CURRENT_ACCOUNT_YEARS.first; year <= CURRENT_ACCOUNT_YEARS.last; year++) {
    for (const seriesId of CURRENT_ACCOUNT_SERIES) if (get(seriesId, "credit", year).minus(get(seriesId, "debit", year)).minus(get(seriesId, "net", year)).abs().gt(TOLERANCE_USD)) throw new Error(`Current account net is not credit minus debit: ${seriesId}:${year}`);
    for (const flow of CURRENT_ACCOUNT_FLOWS) {
      const sum = CURRENT_ACCOUNT_PARTS.reduce((total, seriesId) => total.plus(get(seriesId, flow, year)), new D(0));
      if (sum.minus(get("ca.balance", flow, year)).abs().gt(TOLERANCE_USD)) throw new Error(`Current account parts do not add up: ${flow}:${year}`);
    }
  }
  if (byKey.size !== CURRENT_ACCOUNT_SERIES.length * CURRENT_ACCOUNT_FLOWS.length * (CURRENT_ACCOUNT_YEARS.last - CURRENT_ACCOUNT_YEARS.first + 1)) throw new Error("Current account coverage mismatch: extra rows");
}
