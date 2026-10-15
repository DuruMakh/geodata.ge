import Decimal from "decimal.js";
import { EXTERNAL_POSITION_INDICATORS, EXTERNAL_POSITION_SOURCES, externalPositionFactKey, type ExternalPositionFact, type ExternalPositionIndicator } from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
/** Year-end values to 2025 and one latest point filed under 2026: no year-end 2026 value exists yet. */
const LATEST_YEAR = 2026;
const DEBT_YEARS = range(2006, LATEST_YEAR);
const RESERVES_YEARS = range(1995, LATEST_YEAR);
const LATEST_PERIOD = { ext_debt: "2026-06-30", reserves: "2026-09-30" } as const;
const SHEETS = { ext_debt: "ED-GEO-Tb1", reserves: "GIR (eng) " } as const;
const DEBT_GROUPS: readonly ExternalPositionIndicator[] = ["ext_debt.government", "ext_debt.central_bank", "ext_debt.banks", "ext_debt.companies", "ext_debt.intercompany"];
const RESERVE_PARTS: readonly ExternalPositionIndicator[] = ["reserves.fx", "reserves.gold", "reserves.sdr"];
/** The five debt groups add up to the total to within rounding of the published cells. */
const DEBT_TOLERANCE = new D("0.05");
/** The two reserve parts left out (IMF position, other assets) make up the gap; the observed range is -2.5 to +13.1. */
const RESERVES_TOLERANCE = new D(30);
/** Gold is NBG's published zero until 2023 and positive from 2024. */
const FIRST_GOLD_YEAR = 2024;
/** What NBG shows, as published. */
const ANCHORS: readonly (readonly [ExternalPositionIndicator, number, string])[] = [
  ["ext_debt.total", 2025, "27046.9"], ["ext_debt.government", 2025, "9202.9"], ["reserves.total", 2025, "6159.3"],
  ["reserves.total", 1995, "196.2"], ["reserves.total", 2026, "8166.9"], ["ext_debt.total", 2026, "28166.2"],
];

const familyOf = (indicatorId: string) => (indicatorId.startsWith("ext_debt.") ? "ext_debt" : "reserves");
const sourceFor = (indicatorId: string) => (familyOf(indicatorId) === "ext_debt" ? EXTERNAL_POSITION_SOURCES[0] : EXTERNAL_POSITION_SOURCES[1]);

/** Every key the serving package must contain, exactly once. */
export function expectedExternalPositionKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of EXTERNAL_POSITION_INDICATORS) for (const year of familyOf(indicatorId) === "ext_debt" ? DEBT_YEARS : RESERVES_YEARS) keys.add(`${indicatorId}:${year}`);
  return keys;
}

export function validateExternalPositionFacts(facts: readonly ExternalPositionFact[]): void {
  const expected = expectedExternalPositionKeys();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = externalPositionFactKey(fact);
    if (!EXTERNAL_POSITION_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid external position identity: ${key}`);
    if (!expected.has(key)) throw new Error(`External position observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate external position observation: ${key}`);
    const family = familyOf(fact.indicatorId);
    if (fact.unit !== "usd_million" || fact.basis !== "actual" || fact.valueStatus !== "official" || fact.sourceId !== sourceFor(fact.indicatorId) || fact.sourceSheet !== SHEETS[family]
      || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid external position source contract: ${key}`);
    if (fact.periodEnd !== (fact.year === LATEST_YEAR ? LATEST_PERIOD[family] : `${fact.year}-12-31`)) throw new Error(`Unexpected external position period end: ${key} ${fact.periodEnd}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid external position value: ${key}`); }
    if (!value.isFinite() || value.lt(0) || value.decimalPlaces() > 30) throw new Error(`External position value outside its range or database precision: ${key}`);
    // Round half-up from the value as Excel displays it (15 significant digits).
    if (fact.publishedValue !== value.toSignificantDigits(15).toFixed(1)) throw new Error(`External position published value does not match its stored value: ${key}`);
    values.set(key, value);
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete external position coverage: ${missing.length} missing, first ${missing[0]}`);
  const v = (indicatorId: string, year: number) => values.get(`${indicatorId}:${year}`)!;
  for (const year of DEBT_YEARS) {
    if (DEBT_GROUPS.reduce((sum, id) => sum.plus(v(id, year)), new D(0)).minus(v("ext_debt.total", year)).abs().gt(DEBT_TOLERANCE)) throw new Error(`External position debt groups differ from total debt: ${year}`);
  }
  for (const year of RESERVES_YEARS) {
    if (year < FIRST_GOLD_YEAR ? !v("reserves.gold", year).isZero() : !v("reserves.gold", year).gt(0)) throw new Error(`External position gold is not as published: ${year}`);
    if (v("reserves.total", year).minus(RESERVE_PARTS.reduce((sum, id) => sum.plus(v(id, year)), new D(0))).abs().gt(RESERVES_TOLERANCE)) throw new Error(`External position reserves residual is too large: ${year}`);
  }
  for (const [indicatorId, year, published] of ANCHORS) if (facts.find(f => f.indicatorId === indicatorId && f.year === year)!.publishedValue !== published) throw new Error(`External position anchor value changed: ${indicatorId}:${year}`);
  if (!EXTERNAL_POSITION_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("External position source missing from the serving package");
}
