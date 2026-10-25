import { formatInUnit, formatPerResidentGel, formatPoints, formatShare, MISSING, UNIT_PERSONS } from "../../../lib/explorer/format";
import type { Locale } from "../../../lib/i18n/types";
import type { AgeingChapter, DeficitChapter, MunicipalChapter, ReliefPlace, RevenueSeries } from "../../../lib/landing/chapters/types";
import { birthsColor, MIGRATION_COLORS, SEX_COLORS } from "./canvas";
import { money, signedCount } from "./chart-format";
import type { TipData } from "./chart-tip";

// Tooltip content of the revenue, deficit, municipal relief and ageing charts, kept apart from the engines so it can be tested.

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

const persons = (n: number) => formatInUnit(n, UNIT_PERSONS);
const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);

/** Pyramid tooltip for age index `i` (youngest first): men's and women's share of everyone with counts, both sexes in the first year. */
export function pyramidTip(
  data: AgeingChapter["pyramid"],
  labels: { men: string; women: string; years: string; bothSexes: string },
  i: number,
): TipData {
  const total = sum(data.men) + sum(data.women);
  const baseTotal = sum(data.baseMen) + sum(data.baseWomen);
  const share = (n: number, of: number) => formatShare(n / of, false, 2);
  return {
    title: `${data.ages[i]} ${labels.years}`,
    rows: [
      { key: SEX_COLORS.men, val: share(data.men[i], total), name: `${labels.men} · ${persons(data.men[i])}` },
      { key: SEX_COLORS.women, val: share(data.women[i], total), name: `${labels.women} · ${persons(data.women[i])}` },
      { key: "var(--ink)", val: share(data.baseMen[i] + data.baseWomen[i], baseTotal), name: `${labels.bothSexes}, ${data.baseYear}` },
    ],
    foot: `${labels.bothSexes}, ${data.year}: ${share(data.men[i] + data.women[i], total)}`,
  };
}

/** Net migration tooltip for year index `i`: the signed balance (teal above zero, accent below), and which way more people moved. */
export function migrationTip(
  data: AgeingChapter["migration"],
  labels: { net: string; moreArrived: string; moreLeft: string },
  i: number,
): TipData {
  const net = data.net[i];
  return {
    title: String(data.years[i]),
    rows: [{ key: net >= 0 ? MIGRATION_COLORS.arrivals : MIGRATION_COLORS.departures, val: signedCount(net), name: labels.net }],
    foot: net >= 0 ? labels.moreArrived : labels.moreLeft,
  };
}

/**
 * Births map tooltip for place index `i`, or -2 for an occupied area: births per 100 deaths in its class colour,
 * births, deaths and the natural increase or decrease; a place without figures says so.
 */
export function birthsTip(
  data: AgeingChapter["births"],
  places: readonly ReliefPlace[],
  labels: { perHundred: string; births: string; deaths: string; increase: string; decrease: string; balanced: string; noData: string; occupied: string },
  i: number,
): TipData {
  const entry = i === -2 ? null : data.places[i];
  if (!entry) return { title: i === -2 ? labels.occupied : places[i].name, rows: [{ val: labels.noData }] };
  const ratio = (entry.births / entry.deaths) * 100;
  const change = entry.births - entry.deaths;
  return {
    title: places[i].name,
    rows: [
      { key: birthsColor(ratio), val: persons(ratio), name: labels.perHundred },
      { val: persons(entry.births), name: labels.births },
      { val: persons(entry.deaths), name: labels.deaths },
    ],
    foot: change > 0 ? `${labels.increase}: +${persons(change)}` : change < 0 ? `${labels.decrease}: ${persons(-change)}` : labels.balanced,
  };
}
