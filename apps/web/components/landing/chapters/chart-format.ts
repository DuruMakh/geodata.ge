import { formatAmountParts, formatInUnit, formatPoints, UNIT_PERSONS } from "../../../lib/explorer/format";
import type { Locale } from "../../../lib/i18n/types";

// Amount formatting shared by the homepage chart chapters.

/** The explorer's amount (formatAmountParts) with three significant digits in billions too (2.11, 27.7), unit kept on the line. */
export function money(gel: number, l: { locale: Locale }): string {
  const { num, unit } = formatAmountParts(gel, false, l.locale, true);
  return `${num}\u00a0${unit}`;
}

/** A value in percentage points with its sign and a % mark: "−9.2%". */
export const points = (value: number, decimals = 1) => `${formatPoints(value, false, decimals)}%`;

/** A count with its sign and en-US grouping: "+17,127", "−39,207". */
export const signedCount = (value: number) => formatPoints(value, true, 0);

/** A count given in thousand persons, the way the labour grids print it: "1.39 mln" from a thousand up, else whole thousands ("224 thousand"). */
export function labourCount(thousands: number, l: { thousand: string; million: string }): string {
  if (thousands >= 999.5) return `${formatInUnit(thousands, { divisor: 1000, label: "", decimals: 2 })} ${l.million}`;
  return `${formatInUnit(thousands, UNIT_PERSONS)} ${l.thousand}`;
}
