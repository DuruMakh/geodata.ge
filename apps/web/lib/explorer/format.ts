// Editorial number formatting (DESIGN.md §11): en-US grouping, fixed decimals
// (bn: 2, mln: 1, %: 1), minus sign is "−" (U+2212), em dash "—" for missing values.

const BILLION = 1_000_000_000;
const MILLION = 1_000_000;

export const MISSING = "—";

function fixed(value: number, decimals: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Chart/table cell value in the active unit: billions with 2 decimals. */
export function formatBn(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING;
  // Intl emits ASCII "-"; the module contract is U+2212 (sign is always leading).
  return fixed(value / BILLION, 2).replace("-", "−");
}

export type AmountParts = { num: string; unit: string };

/** Split amount into number + Georgian unit, choosing მლრდ/მლნ by magnitude. */
export function formatAmountParts(value: number | null | undefined, signed = false): AmountParts {
  if (value === null || value === undefined) return { num: MISSING, unit: "" };
  const sign = signed ? (value >= 0 ? "+" : "−") : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 0.9995 * BILLION) return { num: sign + fixed(abs / BILLION, 2), unit: "მლრდ ₾" };
  return { num: sign + fixed(abs / MILLION, 1), unit: "მლნ ₾" };
}

/** Full amount string with unit, e.g. "26.50 მლრდ ₾". */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING;
  const parts = formatAmountParts(value);
  return `${parts.num} ${parts.unit}`;
}

/** Signed full amount string, e.g. "+2.19 მლრდ ₾". */
export function formatSignedAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING;
  const parts = formatAmountParts(value, true);
  return `${parts.num} ${parts.unit}`;
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

export const UNIT_BN: ValueUnit = { divisor: BILLION, label: "მლრდ", decimals: 2 };
export const UNIT_MLN: ValueUnit = { divisor: MILLION, label: "მლნ", decimals: 1 };

/** Cell value in the given unit. UNIT_BN is byte-identical to formatBn. */
export function formatInUnit(value: number | null | undefined, unit: ValueUnit): string {
  if (value === null || value === undefined) return MISSING;
  return fixed(value / unit.divisor, unit.decimals).replace("-", "−");
}
