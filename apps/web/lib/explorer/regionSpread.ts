import { message } from "../i18n/messages";
import { getGroupsMessages } from "../i18n/groups.server";
import type { Locale } from "../i18n/types";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import type { PlaceEntry } from "./places/types";

/** A Regions page's card graphic: one dot per region on a shared scale, Georgia's own figure as a dashed line (all x in percent). */
export type RegionSpread = {
  points: { x: number; key: boolean }[];
  georgiaX: number | null;
  /** Georgia's name and figure, to key the dashed line, or null when the page states none. */
  georgiaLabel: string | null;
  /** The lowest and highest region: its name and its figure, `Shida Kartli` and `7.0%`. */
  low: { name: string; value: string };
  high: { name: string; value: string };
  lowX: number;
  /** The range the regions span, `7.0–17.5%`. */
  value: string;
  /** `11 regions · 2025`. */
  caption: string;
  /** The caption's two parts, `11 regions` and `2025`, for a row that sets its period apart (All data). */
  regions: string;
  period: string;
};

/** Scale room around the extremes, so no dot sits on the card's edge or under the label that names it. */
const SCALE_PADDING = 0.15;

/** The unit a figure ends with (`%`, ` ₾`), when it ends with one. */
function unitOf(value: string): string {
  return /[^\d]+$/.exec(value)?.[0] ?? "";
}

/** `7.0%` and `17.5%` read as `7.0–17.5%`; figures in different units stay whole. */
function rangeOf(low: string, high: string): string {
  const unit = unitOf(low);
  if (unit !== "" && unit === unitOf(high)) return `${low.slice(0, -unit.length)}–${high}`;
  return `${low} – ${high}`;
}

/**
 * The Regions page's figures as a spread, from the entries of that one page (`entriesForPage`): its regions and Georgia. Municipalities are
 * ignored. Null with fewer than two regions, where there is nothing to spread. The scale runs a little past the lowest and highest figure
 * (Georgia's included), and from zero where padding would otherwise cross it.
 */
export function regionSpread(entries: PlaceEntry[], regionName: (id: string) => string, locale: Locale): RegionSpread | null {
  const regions = entries.filter((entry) => entry.placeId.startsWith("region."));
  if (regions.length < 2) return null;
  const georgia = entries.find((entry) => entry.placeId === GEORGIA_PLACE_ID) ?? null;

  const numbers = [...regions, ...(georgia ? [georgia] : [])].map((entry) => entry.number);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const padding = (max - min) * SCALE_PADDING;
  const scaleMin = min >= 0 && min - padding < 0 ? 0 : min - padding;
  const scaleMax = max + padding;
  const x = (number: number) => (scaleMax === scaleMin ? 50 : ((number - scaleMin) / (scaleMax - scaleMin)) * 100);

  const lowest = regions.reduce((a, b) => (b.number < a.number ? b : a));
  const highest = regions.reduce((a, b) => (b.number > a.number ? b : a));
  const lowestNumber = lowest.number;
  const highestNumber = highest.number;
  const period = regions.map((entry) => entry.period).reduce((a, b) => (b > a ? b : a));
  const count = message(getGroupsMessages(locale), "groups.regionsN", { n: regions.length });

  return {
    points: regions.map((entry) => ({ x: x(entry.number), key: entry.number === lowestNumber || entry.number === highestNumber })),
    georgiaX: georgia ? x(georgia.number) : null,
    georgiaLabel: georgia ? `${regionName(GEORGIA_PLACE_ID)} ${georgia.value}` : null,
    low: { name: regionName(lowest.placeId), value: lowest.value },
    high: { name: regionName(highest.placeId), value: highest.value },
    lowX: x(lowestNumber),
    value: rangeOf(lowest.value, highest.value),
    caption: `${count} · ${period}`,
    regions: count,
    period,
  };
}
