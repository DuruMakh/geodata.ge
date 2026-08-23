// Editorial number formatting (DESIGN.md §11): en-US grouping, fixed decimals
// (bn: 1, mln: 0, %: 1), minus sign is "−" (U+2212), em dash "—" for missing values.

const BILLION = 1_000_000_000;
const MILLION = 1_000_000;

export const MISSING = "—";

function fixed(value: number, decimals: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Chart/table cell value in the active unit: billions with 1 decimal.
 *
 * Delegates rather than reimplements, so the two can never drift on the
 * below-threshold floor — the analysis ranking and the period comparison read
 * real amounts through here.
 */
export function formatBn(value: number | null | undefined): string {
  return formatInUnit(value, UNIT_BN);
}

export type AmountParts = { num: string; unit: string };

/** Split amount into number + Georgian unit, choosing მლრდ/მლნ by magnitude. */
export function formatAmountParts(value: number | null | undefined, signed = false): AmountParts {
  if (value === null || value === undefined) return { num: MISSING, unit: "" };
  const sign = signed ? (value >= 0 ? "+" : "−") : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 0.9995 * BILLION) return { num: sign + fixed(abs / BILLION, 1), unit: "მლრდ ₾" };

  // Three significant digits. A standalone amount carries its own unit label,
  // so precision can follow the value here — unlike a column, which shares one
  // unit across every cell and gets its decimals from unitFor instead.
  const millions = abs / MILLION;
  const decimals = millions >= 100 ? 0 : millions >= 10 ? 1 : 2;
  if (abs > 0 && Number(millions.toFixed(decimals)) === 0) {
    return { num: value < 0 ? ">−0.01" : signed ? "+<0.01" : "<0.01", unit: "მლნ ₾" };
  }
  return { num: sign + fixed(millions, decimals), unit: "მლნ ₾" };
}

/** Full amount string with unit, e.g. "26.5 მლრდ ₾". */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING;
  const parts = formatAmountParts(value);
  return `${parts.num} ${parts.unit}`;
}

/** Signed full amount string, e.g. "+2.2 მლრდ ₾". */
export function formatSignedAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING;
  const parts = formatAmountParts(value, true);
  return `${parts.num} ${parts.unit}`;
}

/** Budget per resident in whole lari, e.g. "1,335 ₾". */
export function formatPerResidentGel(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ₾`;
}

/** Percentage from a fraction, `decimals` digits (default 1); "−" minus; optional "+" for positives. */
export function formatShare(fraction: number | null | undefined, signed = false, decimals = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return MISSING;
  const value = fraction * 100;
  const prefix = signed && value > 0 ? "+" : "";
  return (prefix + value.toFixed(decimals) + "%").replace("-", "−");
}

/**
 * The scale a chart or table renders values in. Budget surfaces work in
 * billions; municipal budgets are two to three orders of magnitude smaller, so
 * billions would render a whole municipality as "0.02" and each of its
 * functions as "0.00".
 */
export type ValueUnit = { divisor: number; label: string; decimals: number };

export const UNIT_BN: ValueUnit = { divisor: BILLION, label: "მლრდ", decimals: 1 };
export const UNIT_MLN: ValueUnit = { divisor: MILLION, label: "მლნ", decimals: 0 };

/**
 * The fewest decimals (0..cap) that keep every non-zero value in `values`
 * distinguishable from zero once scaled into `base`.
 *
 * A column and a chart axis share one unit across every cell — that is what
 * makes them comparable — so the precision has to be decided once, from the
 * data, rather than per value. Derive it from everything the surface can show
 * (all series, all years), never from the current selection: the range strip
 * and the series toggles would otherwise reformat every number mid-gesture.
 *
 * The cap is 2 because a third decimal lengthens every large cell to rescue a
 * handful of small ones; formatInUnit floors whatever still rounds away.
 */
export function unitFor(values: readonly number[], base: ValueUnit, cap = 2): ValueUnit {
  let smallest = Infinity;
  for (const value of values) {
    const magnitude = Math.abs(value);
    if (magnitude > 0 && magnitude < smallest) smallest = magnitude;
  }
  if (!Number.isFinite(smallest)) return base;

  const scaled = smallest / base.divisor;
  for (let decimals = 0; decimals <= cap; decimals += 1) {
    if (Number(scaled.toFixed(decimals)) !== 0) return { ...base, decimals };
  }
  return { ...base, decimals: cap };
}

/** Cell value in the given unit. UNIT_BN is byte-identical to formatBn. */
export function formatInUnit(value: number | null | undefined, unit: ValueUnit): string {
  if (value === null || value === undefined) return MISSING;
  const scaled = value / unit.divisor;

  // A funded line must never print the same as an unfunded one. unitFor already
  // spends the decimals that keep a surface's own values apart; this catches
  // what is left below its cap (five municipalities hold amounts under 5,000 ₾)
  // rather than letting them read as "nothing was spent".
  if (value !== 0 && Number(scaled.toFixed(unit.decimals)) === 0) {
    const floor = (10 ** -unit.decimals).toFixed(unit.decimals);
    return value < 0 ? `>−${floor}` : `<${floor}`;
  }

  return fixed(scaled, unit.decimals).replace("-", "−");
}
