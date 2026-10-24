import { formatInUnit, formatPoints, UNIT_BN, UNIT_MLN } from "../../../lib/explorer/format";

// Amount formatting shared by the homepage chart chapters.

/** Billions with two decimals (one from 9.95), below one billion millions with 0 or 1 decimals. */
export function money(gel: number, l: { bnGel: string; mlnGel: string }): string {
  const a = Math.abs(gel);
  if (a >= 1e9) return `${formatInUnit(gel, { ...UNIT_BN, decimals: a >= 9.95e9 ? 1 : 2 })}\u00a0${l.bnGel}`;
  return `${formatInUnit(gel, { ...UNIT_MLN, decimals: a >= 1e8 ? 0 : 1 })}\u00a0${l.mlnGel}`;
}

/** A value in percentage points with its sign and a % mark: "−9.2%". */
export const points = (value: number, decimals = 1) => `${formatPoints(value, false, decimals)}%`;
