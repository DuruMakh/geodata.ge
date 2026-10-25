import { formatAmountParts, formatPoints } from "../../../lib/explorer/format";
import type { Locale } from "../../../lib/i18n/types";

// Amount formatting shared by the homepage chart chapters.

/** The explorer's amount (formatAmountParts) with three significant digits in billions too (2.11, 27.7), unit kept on the line. */
export function money(gel: number, l: { locale: Locale }): string {
  const { num, unit } = formatAmountParts(gel, false, l.locale, true);
  return `${num}\u00a0${unit}`;
}

/** A value in percentage points with its sign and a % mark: "−9.2%". */
export const points = (value: number, decimals = 1) => `${formatPoints(value, false, decimals)}%`;
