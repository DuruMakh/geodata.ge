import { formatPerResidentGel, formatPoints, formatShare, MISSING } from "../../../lib/explorer/format";
import type { Locale } from "../../../lib/i18n/types";
import type { DeficitChapter, MunicipalChapter, RevenueSeries } from "../../../lib/landing/chapters/types";
import { money } from "./chart-format";
import type { TipData } from "./chart-tip";

// Tooltip content of the revenue, deficit and municipal relief charts, kept apart from the engines so it can be tested.

/** Year with a planned suffix when the year's value is planned: "2025 (გეგმა)". */
export function plannedYearText(data: Pick<RevenueSeries, "years" | "planned">, i: number, planned: string): string {
  return data.planned[i] ? `${data.years[i]} (${planned})` : String(data.years[i]);
}

/** Revenue tooltip for year index `i`: one row per band, top band first (`—` for a gap), total and tax share as the foot. */
export function revenueTip(
  data: RevenueSeries,
  labels: { locale: Locale; planned: string; total: string; taxes: string },
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
  labels: { locale: Locale; imf: string; vsGdp: string; inGel: string; deficit: string; surplus: string },
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

/** Relief tooltip for place index `i` (budget for the year, budget per resident, rank), or -2 for an occupied area. */
export function reliefTip(
  data: MunicipalChapter,
  labels: { locale: Locale; budget: string; perResident: string; rank: string; occupied: string; occupiedNote: string },
  i: number,
): TipData {
  if (i === -2) return { title: labels.occupied, rows: [], foot: labels.occupiedNote };
  const place = data.places[i];
  return {
    title: place.name,
    rows: [
      { key: "var(--ink)", val: money(place.totalGel, labels), name: `${labels.budget}, ${data.year}` },
      { val: formatPerResidentGel(place.perResidentGel, labels.locale), name: labels.perResident },
    ],
    foot: `${labels.rank}: ${place.rank} / ${data.places.length}`,
  };
}
