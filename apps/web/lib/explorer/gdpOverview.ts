import type { ClientGdpObservation, SourceIdRanges } from "../servedRows";
import { refitRange, resolveRange } from "./periodRange";
export type GdpIndicator = "real" | "nominal" | "growth" | "per_capita";
export type GdpState = {
  indicator: GdpIndicator;
  currency: "gel" | "usd";
  mode: "line" | "table";
  range: { kind: "all" } | { kind: "manual"; start: number; end: number };
};
export const DEFAULT_GDP_STATE: GdpState = {
  indicator: "real",
  currency: "gel",
  mode: "line",
  range: { kind: "all" },
};
export function seriesFor(state: GdpState) {
  return state.indicator === "real"
    ? "real_usd_2015"
    : state.indicator === "growth"
      ? "real_growth_percent"
      : `${state.indicator}_${state.currency}`;
}
export function resolveGdpRange(
  state: GdpState,
  facts: ClientGdpObservation[],
) {
  const years = facts
    .filter((f) => f.seriesId === seriesFor(state))
    .map((f) => f.year)
    .sort((a, b) => a - b);
  return resolveRange(state.range, { min: years[0], max: years.at(-1)! });
}
export function changeGdpIndicator(
  state: GdpState,
  indicator: GdpIndicator,
  facts: ClientGdpObservation[],
): GdpState {
  const next = { ...state, indicator },
    { min, max } = resolveGdpRange(next, facts);
  return { ...next, range: refitRange(state.range, { min, max }, { collapseToAll: true }) };
}
/** The newest run that starts at or before `year`. */
export function sourceIdForYear(
  ranges: SourceIdRanges,
  seriesId: string,
  year: number,
): string | undefined {
  return ranges[seriesId]?.find((run) => year >= run.fromYear)?.sourceId;
}

export function buildGdpOverviewModel(
  facts: ClientGdpObservation[],
  state: GdpState,
  sourceIdRanges: SourceIdRanges,
) {
  const available = facts
    .filter((f) => f.seriesId === seriesFor(state))
    .sort((a, b) => a.year - b.year);
  const range = resolveGdpRange(state, facts);
  const selected = available.filter(
    (f) => f.year >= range.start && f.year <= range.end,
  );
  const points = selected.map((f) => ({
    ...f,
    value: state.indicator === "growth" ? f.value / 100 : f.value,
  }));
  return {
    range,
    points,
    years: points.map((p) => p.year),
    availableYears: available.map((p) => p.year),
    preliminaryYears: selected
      .filter((f) => f.status === "preliminary")
      .map((f) => f.year),
    sourceIds: [
      ...new Set(
        selected
          .map((f) => sourceIdForYear(sourceIdRanges, f.seriesId, f.year))
          .filter((id): id is string => id !== undefined),
      ),
    ],
    headline: points.at(-1) ?? null,
  };
}
export function parseGdpHash(hash: string): GdpState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const indicator = p.get("indicator"),
    view = p.get("view"),
    currency = p.get("currency");
  const start = Number(p.get("start")),
    end = Number(p.get("end"));
  return {
    indicator: (["real", "nominal", "growth", "per_capita"].includes(
      indicator ?? "",
    )
      ? indicator
      : "real") as GdpIndicator,
    mode: view === "table" ? "table" : "line",
    currency: currency === "usd" ? "usd" : "gel",
    range:
      p.get("range") !== "all" &&
      p.has("start") &&
      p.has("end") &&
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start > 0 &&
      end > 0
        ? {
            kind: "manual",
            start: Math.min(start, end),
            end: Math.max(start, end),
          }
        : { kind: "all" },
  };
}
export function serializeGdpHash(state: GdpState) {
  const p = new URLSearchParams({
    indicator: state.indicator,
    view: state.mode,
    currency: state.currency,
  });
  if (state.range.kind === "all") p.set("range", "all");
  else {
    p.set("start", String(state.range.start));
    p.set("end", String(state.range.end));
  }
  return p.toString();
}
