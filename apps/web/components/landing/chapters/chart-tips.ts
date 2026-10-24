import { formatPoints, formatShare, MISSING } from "../../../lib/explorer/format";
import type { DeficitChapter, RevenueSeries } from "../../../lib/landing/chapters/types";
import { money } from "./chart-format";
import type { TipData } from "./chart-tip";

// Tooltip content of the revenue and deficit charts, kept apart from the engines so it can be tested.

/** Year with a planned suffix when the year's value is planned: "2025 (გეგმა)". */
export function plannedYearText(data: Pick<RevenueSeries, "years" | "planned">, i: number, planned: string): string {
  return data.planned[i] ? `${data.years[i]} (${planned})` : String(data.years[i]);
}

/** Revenue tooltip for year index `i`: one row per band, top band first (`—` for a gap), total and tax share as the foot. */
export function revenueTip(
  data: RevenueSeries,
  labels: { bnGel: string; mlnGel: string; planned: string; total: string; taxes: string },
  colors: readonly string[],
  i: number,
): TipData {
  const rows = data.bands
    .map((band, bi) => {
      const v = band.values[i];
      return { key: colors[bi], val: v === null ? MISSING : money(v, labels), name: band.label };
    })
    .reverse();
  return {
    title: plannedYearText(data, i, labels.planned),
    rows,
    foot: `${labels.total} ${money(data.totals[i], labels)} · ${labels.taxes} ${formatShare(data.taxShare[i], false, 0)}`,
  };
}

/** Deficit tooltip for year index `i`: balance in % of GDP and in GEL; the foot says deficit or surplus. */
export function deficitTip(
  data: DeficitChapter,
  labels: { bnGel: string; mlnGel: string; imf: string; vsGdp: string; inGel: string; deficit: string; surplus: string },
  i: number,
): TipData {
  const year = data.years[i];
  const v = data.pctGdp[i];
  const projected = data.projectionFrom !== null && year >= data.projectionFrom;
  return {
    title: projected ? `${year} · ${labels.imf}` : String(year),
    rows: [
      { key: v >= 0 ? "var(--positive)" : "var(--ink)", val: `${formatPoints(v, false, 2)}%`, name: labels.vsGdp },
      { val: money(data.gel[i], labels), name: labels.inGel },
    ],
    foot: v >= 0 ? labels.surplus : labels.deficit,
  };
}
