import Decimal from "decimal.js";
import { TAX_BREAKS_REFUNDS_INDICATORS, TAX_BREAKS_REFUNDS_SOURCES, taxBreaksRefundsFactKey, type TaxBreaksRefundsFact } from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
export const TAX_BREAK_YEARS = range(2018, 2024);
export const TAX_REFUND_YEARS = range(2008, 2025);
const TOLERANCE = new D("0.01");
const VAT_PARTS = ["education", "health", "child_care", "gambling", "vehicles", "agriculture", "medicines", "other"].map(part => `tax_breaks.vat.${part}`);
const INCOME_PARTS = ["personal", "profit", "old_profit", "other"].map(part => `tax_breaks.income.${part}`);

const yearsFor = (indicatorId: string) => indicatorId === "tax_refunds.total" ? TAX_REFUND_YEARS : TAX_BREAK_YEARS;
const sourceFor = (indicatorId: string) => indicatorId === "tax_refunds.total" ? TAX_BREAKS_REFUNDS_SOURCES[1] : TAX_BREAKS_REFUNDS_SOURCES[0];

/** Every key the serving file must contain, exactly once. */
export function expectedTaxBreaksRefundsKeys(): Set<string> {
  return new Set(TAX_BREAKS_REFUNDS_INDICATORS.flatMap(id => yearsFor(id).map(year => `${id}:${year}`)));
}

/** The approved coverage, the source contract and every identity of spec §4, within 0.01 million GEL. */
export function validateTaxBreaksRefundsFacts(facts: readonly TaxBreaksRefundsFact[]): void {
  const expected = expectedTaxBreaksRefundsKeys();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = taxBreaksRefundsFactKey(fact);
    if (!expected.has(key)) throw new Error(`Tax breaks and refunds observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate tax breaks and refunds observation: ${key}`);
    const treasury = fact.indicatorId === "tax_refunds.total";
    if (fact.unit !== "gel_million" || fact.basis !== "actual" || fact.valueStatus !== "official" || fact.sourceId !== sourceFor(fact.indicatorId)
      || !fact.sourceSheet || !(treasury ? /^series\[0\]\/row\[\d+\]$/ : /^[A-Z]+\d+$/).test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid tax breaks and refunds source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid tax breaks and refunds value: ${key}`); }
    if (!value.isFinite() || value.lt(0) || value.decimalPlaces() > 30) throw new Error(`Tax breaks and refunds value outside its range or database precision: ${key}`);
    if (fact.publishedValue !== value.toSignificantDigits(15).toFixed(2)) throw new Error(`Tax breaks and refunds published value does not match its stored value: ${key}`);
    values.set(key, value);
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete tax breaks and refunds coverage: ${missing.length} missing, first ${missing[0]}`);
  const v = (id: string, year: number) => values.get(`${id}:${year}`)!;
  const sum = (ids: readonly string[], year: number) => ids.reduce((total, id) => total.plus(v(id, year)), new D(0));
  const off = (a: Decimal, b: Decimal) => a.minus(b).abs().gt(TOLERANCE);
  for (const year of TAX_BREAK_YEARS) {
    if (off(v("tax_breaks.vat.total", year).plus(v("tax_breaks.income.total", year)), v("tax_breaks.total", year))) throw new Error(`VAT and income tax breaks do not add up to the total: ${year}`);
    if (off(sum(VAT_PARTS, year), v("tax_breaks.vat.total", year))) throw new Error(`VAT parts do not add up: ${year}`);
    if (off(sum(INCOME_PARTS, year), v("tax_breaks.income.total", year))) throw new Error(`Income and profit tax parts do not add up: ${year}`);
  }
}
