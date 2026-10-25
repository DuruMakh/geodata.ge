import { formatInUnit, formatPerResidentGel, formatPoints, formatShare, MISSING, UNIT_PERSONS } from "../../../lib/explorer/format";
import type { Locale } from "../../../lib/i18n/types";
import type { AgeingChapter, DeathsChapter, DeficitChapter, LabourSplit, MunicipalChapter, ReliefPlace, RevenueSeries, TradeChapter, WageGapChapter, YouthJobsChapter } from "../../../lib/landing/chapters/types";
import { birthsColor, birthsPer100, deathSquareToken, MIGRATION_COLORS, SEX_COLORS, TRADE_COLORS } from "./canvas";
import { billions, decimals, money, points, signedBillions, signedCount } from "./chart-format";
import { deathSquares } from "./chart-layout";
import type { TipData } from "./chart-tip";

// Tooltip content of the revenue, deficit, municipal relief, ageing, youth jobs, wages, trade and causes-of-death charts, kept apart from the engines so it can be tested.

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
  const ratio = birthsPer100(entry);
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

/**
 * Labour grid tooltip for group index `i` (0 employed, 1 unemployed, 2 outside the labour force): its share of the
 * whole age group and its count in thousands; the foot is the unemployment rate of the labour force, the labour
 * force's size, or what "outside" means.
 */
export function waffleTip(
  split: LabourSplit,
  labels: {
    employed: string;
    unemployed: string;
    outside: string;
    who: string;
    people: string;
    thousand: string;
    unemploymentRate: string;
    ofLabourForce: string;
    labourForce: string;
    neither: string;
  },
  i: number,
): TipData {
  const groups = [
    { name: labels.employed, key: "var(--ink)", value: split.employed },
    { name: labels.unemployed, key: "var(--accent)", value: split.unemployed },
    { name: labels.outside, key: "var(--control)", value: split.outside },
  ];
  const { name, key, value } = groups[i];
  const whole = split.employed + split.unemployed + split.outside;
  const thousands = (n: number) => `${formatInUnit(n, { divisor: 1, label: "", decimals: 1 })} ${labels.thousand}`;
  const foot = [
    `${labels.labourForce} — ${thousands(split.employed + split.unemployed)}`,
    `${labels.unemploymentRate} — ${points(split.rate)} ${labels.ofLabourForce}`,
    labels.neither,
  ][i];
  return {
    title: name,
    rows: [
      { key, val: points((value / whole) * 100), name: labels.who },
      { val: thousands(value), name: labels.people },
    ],
    foot,
  };
}

/**
 * Regions chart tooltip for region index `i`: its rate, and the foot says how many points it sits above or below the
 * rate of Georgia (`{diff}` in the templates), or that it equals it.
 */
export function regionTip(
  regions: YouthJobsChapter["regions"],
  national: number,
  labels: { rate: string; equal: string; higher: string; lower: string },
  i: number,
): TipData {
  const { label, rate } = regions[i];
  const diff = rate - national;
  const template = Math.abs(diff) < 0.05 ? labels.equal : diff > 0 ? labels.higher : labels.lower;
  return {
    title: label,
    rows: [{ key: "var(--ink)", val: points(rate), name: labels.rate }],
    foot: template.replace("{diff}", formatPoints(Math.abs(diff), false, 1)),
  };
}

/**
 * Wages chart tooltip for sector index `i`: men, women and the average wage in GEL (the year is in the title), and
 * women's wage as a share of men's in the foot (`{pct}` in the template).
 */
export function wageTip(
  sectors: WageGapChapter["sectors"],
  year: number,
  labels: { men: string; women: string; average: string; foot: string },
  i: number,
): TipData {
  const { label, average, women, men } = sectors[i];
  const gel = (value: number) => `${formatInUnit(value, { ...UNIT_PERSONS, decimals: 1 })} ₾`;
  return {
    title: `${label}, ${year}`,
    rows: [
      { key: SEX_COLORS.men, val: gel(men), name: labels.men },
      { key: SEX_COLORS.women, val: gel(women), name: labels.women },
      { key: "var(--ink)", val: gel(average), name: labels.average },
    ],
    foot: labels.foot.replace("{pct}", formatInUnit((women / men) * 100, { ...UNIT_PERSONS, decimals: 1 })),
  };
}

/**
 * Partners chart tooltip for partner index `i`: exports, imports and the signed balance in billions of dollars (the
 * year is in the title), and the turnover in the foot.
 */
export function tradePartnerTip(
  partners: TradeChapter["partners"],
  year: number,
  labels: { exports: string; imports: string; balance: string; turnover: string; unit: string },
  i: number,
): TipData {
  const { label, exportsUsd, importsUsd, turnoverUsd } = partners[i];
  return {
    title: `${label}, ${year}`,
    rows: [
      { key: TRADE_COLORS.exports, val: `${billions(exportsUsd, 2)} ${labels.unit}`, name: labels.exports },
      { key: TRADE_COLORS.imports, val: `${billions(importsUsd, 2)} ${labels.unit}`, name: labels.imports },
      { val: `${signedBillions(exportsUsd - importsUsd, 2)} ${labels.unit}`, name: labels.balance },
    ],
    foot: `${labels.turnover} — ${billions(turnoverUsd, 2)} ${labels.unit}`,
  };
}

/** Trade lines tooltip for year index `i`: exports and imports in billions of dollars, the larger first, and the signed balance in the foot. */
export function tradeLineTip(
  data: Pick<TradeChapter, "years" | "exports" | "imports">,
  labels: { exports: string; imports: string; balance: string; unit: string },
  i: number,
): TipData {
  const [exportsUsd, importsUsd] = [data.exports[i], data.imports[i]];
  const rows = [
    { usd: exportsUsd, key: TRADE_COLORS.exports, name: labels.exports },
    { usd: importsUsd, key: TRADE_COLORS.imports, name: labels.imports },
  ].sort((a, b) => b.usd - a.usd);
  return {
    title: String(data.years[i]),
    rows: rows.map((row) => ({ key: row.key, val: `${billions(row.usd, 1)} ${labels.unit}`, name: row.name })),
    foot: `${labels.balance}: ${signedBillions(exportsUsd - importsUsd, 1)} ${labels.unit}`,
  };
}

/**
 * Causes-of-death tooltip for group index `i`: the group's name with the year, its deaths and share of all deaths,
 * and the squares it is drawn with (`squares` holds a {count} placeholder).
 */
export function deathGroupTip(
  data: Pick<DeathsChapter, "year" | "total" | "groups">,
  labels: { people: string; ofAll: string; squares: string },
  i: number,
): TipData {
  const { label, count, kind } = data.groups[i];
  return {
    title: `${label}, ${data.year}`,
    rows: [
      { key: `var(--${deathSquareToken(kind)})`, val: decimals(count, 0), name: labels.people },
      { val: formatShare(count / data.total, false, 0), name: labels.ofAll },
    ],
    foot: labels.squares.replace("{count}", String(deathSquares(count))),
  };
}
