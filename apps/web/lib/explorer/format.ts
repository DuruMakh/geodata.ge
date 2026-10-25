import type { Locale } from "../i18n/types";
import kaFormat from "../i18n/messages/ka/format.json";
import enFormat from "../i18n/messages/en/format.json";

const formatMessages = { ka: kaFormat, en: enFormat };

// Editorial number formatting (DESIGN.md §11): en-US grouping, fixed decimals
// (bn: 1, mln: 0, %: 1), minus sign is "−" (U+2212), em dash "—" for missing values.

const BILLION = 1_000_000_000;
const MILLION = 1_000_000;

export const MISSING = "—";

const numberFormatters = new Map<number, Intl.NumberFormat>();

function fixed(value: number, decimals: number): string {
  let formatter = numberFormatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormatters.set(decimals, formatter);
  }
  return formatter.format(value);
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

/** Split amount into number and localized unit, choosing magnitude from the value. */
export function formatAmountParts(value: number | null | undefined, signed = false, locale: Locale = "ka"): AmountParts {
  if (value === null || value === undefined) return { num: MISSING, unit: "" };
  // An unfunded line is plain zero lari, unsigned — never "0.00 მლნ ₾".
  if (value === 0) return { num: "0", unit: formatMessages[locale]["format.gel"] };
  const sign = signed ? (value >= 0 ? "+" : "−") : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 0.9995 * BILLION) return { num: sign + fixed(abs / BILLION, 1), unit: formatMessages[locale]["format.bnGel"] };

  // Three significant digits. A standalone amount carries its own unit label,
  // so precision can follow the value here — unlike a column, which shares one
  // unit across every cell and gets its decimals from unitFor instead.
  const millions = abs / MILLION;
  const decimals = millions >= 100 ? 0 : millions >= 10 ? 1 : 2;
  if (abs > 0 && Number(millions.toFixed(decimals)) === 0) {
    return { num: value < 0 ? ">−0.01" : signed ? "+<0.01" : "<0.01", unit: formatMessages[locale]["format.mlnGel"] };
  }
  return { num: sign + fixed(millions, decimals), unit: formatMessages[locale]["format.mlnGel"] };
}

/** Full amount string with unit, e.g. "26.5 მლრდ ₾". */
export function formatAmount(value: number | null | undefined, locale: Locale = "ka"): string {
  if (value === null || value === undefined) return MISSING;
  const parts = formatAmountParts(value, false, locale);
  return `${parts.num} ${parts.unit}`;
}

/** Signed full amount string, e.g. "+2.2 მლრდ ₾". */
export function formatSignedAmount(value: number | null | undefined, locale: Locale = "ka"): string {
  if (value === null || value === undefined) return MISSING;
  const parts = formatAmountParts(value, true, locale);
  return `${parts.num} ${parts.unit}`;
}

/** Budget per resident in whole lari, e.g. "1,335 ₾". */
export function formatPerResidentGel(value: number | null | undefined, locale: Locale = "ka"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return `${fixed(value, 0)} ${formatMessages[locale]["format.gel"]}`;
}

/** Percentage from a fraction, `decimals` digits (default 1); "−" minus; optional "+" for positives. */
export function formatShare(fraction: number | null | undefined, signed = false, decimals = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return MISSING;
  return formatSignedFixed(fraction * 100, signed, decimals) + "%";
}

// Rounds a displayed decimal as Excel and Geostat do: a last-digit 5 goes away from zero
// (0.95 → 1.0, −0.95 → −1.0). toFixed rounds the binary value instead, so (0.95).toFixed(1) is
// "0.9" but (10.25).toFixed(1) is "10.3". While the value counted in units of its last shown
// decimal stays below 1e9 (every percentage and point the site shows), twelve significant digits
// first drop the noise arithmetic adds (a fraction × 100 turns 1.65 into 1.6499999999999999); that
// leaves at least three digits below the last shown one, and a value within half a unit of the
// twelfth significant digit of a tie is treated as the tie. Beyond that the value keeps every
// digit, since twelve would cut digits it shows. Intl then rounds the decimal.
function decimalFixed(value: number, decimals: number): string {
  return fixed(Math.abs(value) * 10 ** decimals < 1e9 ? Number(value.toPrecision(12)) : value, decimals);
}

/**
 * `value` rounded to `decimals` the way it is displayed (1.65 → 1.7); −0 comes back as 0. Meant for
 * percentages and points; see decimalFixed for the noise trim and its limit.
 */
export function roundForDisplay(value: number, decimals: number): number {
  return Number(decimalFixed(value, decimals).replaceAll(",", "")) + 0;
}

/**
 * Whole percentages of `values` (each at least 0) that add up to exactly 100, by largest remainder: every share
 * is rounded down, then the shares with the largest remainders get one more point each (an equal remainder goes to
 * the earlier value). All zeros stay zeros.
 */
export function wholePercents(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((value) => (value / total) * 100);
  const whole = exact.map((share) => Math.floor(share));
  const byRemainder = exact.map((_, index) => index).sort((a, b) => exact[b]! - whole[b]! - (exact[a]! - whole[a]!) || a - b);
  let missing = 100 - whole.reduce((sum, share) => sum + share, 0);
  for (let cursor = 0; missing > 0 && byRemainder.length > 0; cursor += 1, missing -= 1) {
    whole[byRemainder[cursor % byRemainder.length]!]! += 1;
  }
  return whole;
}

/** A calculated value for a workbook cell, rounded as the page shows it (`roundForDisplay`); a gap stays null. */
export function roundShown(value: number | null, decimals: number): number | null {
  return value === null ? null : roundForDisplay(value, decimals);
}

// Any negative value keeps its minus (−0.0%); the digits get the same en-US
// grouping as every other figure, so a mover reads "+4,565.1%".
function formatSignedFixed(value: number, signed: boolean, decimals: number): string {
  const prefix = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  return prefix + decimalFixed(Math.abs(value), decimals);
}

/** Percentage-point difference, `decimals` digits (default 1); "−" minus; optional "+" for positives. */
export function formatPoints(points: number | null | undefined, signed = false, decimals = 1): string {
  if (points === null || points === undefined || !Number.isFinite(points)) return MISSING;
  return formatSignedFixed(points, signed, decimals);
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

/** Population: whole persons in cells, tooltips and Excel; density at the one decimal Geostat publishes. */
export const UNIT_PERSONS: ValueUnit = { divisor: 1, label: "", decimals: 0 };
export const UNIT_DENSITY: ValueUnit = { divisor: 1, label: "", decimals: 1 };

/**
 * The chart-axis unit for persons: thousands, labelled in the page language. One decimal keeps the
 * axis quantum at 100 persons, so a small municipality still gets round gridlines.
 */
export function thousandsUnit(locale: Locale): ValueUnit {
  return { divisor: 1_000, label: formatMessages[locale]["format.thousands"], decimals: 1 };
}

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

export function unitsFor(locale: Locale): { bn: ValueUnit; mln: ValueUnit } {
  return {
    bn: { ...UNIT_BN, label: formatMessages[locale]["format.bn"] },
    mln: { ...UNIT_MLN, label: formatMessages[locale]["format.mln"] },
  };
}

export function formatDisplayDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ka-GE", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(isoDate + "T00:00:00Z"));
}
