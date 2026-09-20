import type { SectorDefinition } from "../data/economicSectors/types";
import type {
  RegionalEconomyMeasure,
  ServedRegionalEconomyObservation,
} from "../data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../data/regionalEconomies/types";
import { INK } from "./colors";
import { sectorColor } from "./economicSectors";

export type RegionalEconomyState = {
  measure: RegionalEconomyMeasure;
  mode: "line" | "table";
  range: { kind: "all" } | { kind: "manual"; start: number; end: number };
  selectedIds: string[];
};

export type RegionalEconomySeriesDefinition = SectorDefinition;

export const DEFAULT_REGIONAL_ECONOMY_STATE: RegionalEconomyState = {
  measure: "nominal",
  mode: "line",
  range: { kind: "all" },
  selectedIds: [REGIONAL_GDP_TOTAL],
};

export function regionalEconomyDefinitions(
  registry: readonly SectorDefinition[],
): RegionalEconomySeriesDefinition[] {
  return [
    {
      id: REGIONAL_GDP_TOTAL,
      classificationCode: null,
      sortOrder: 0,
      officialName: "Total regional GDP",
      labelKa: "რეგიონის მთლიანი მშპ",
      labelEn: "Total regional GDP",
    },
    ...registry
      .filter((definition) => definition.classificationCode !== null)
      .sort((left, right) => left.sortOrder - right.sortOrder),
  ];
}

export function regionalEconomyColor(seriesId: string) {
  return seriesId === REGIONAL_GDP_TOTAL ? INK : sectorColor(seriesId);
}

export function rankRegionalEconomyDefinitions(
  definitions: readonly RegionalEconomySeriesDefinition[],
  endValues: Record<string, number | null>,
) {
  return [...definitions].sort((left, right) => {
    if (left.id === REGIONAL_GDP_TOTAL) return -1;
    if (right.id === REGIONAL_GDP_TOTAL) return 1;
    const leftValue = endValues[left.id];
    const rightValue = endValues[right.id];
    if (leftValue === null && rightValue !== null) return 1;
    if (rightValue === null && leftValue !== null) return -1;
    return (leftValue !== null && rightValue !== null ? rightValue - leftValue : 0) ||
      left.sortOrder - right.sortOrder;
  });
}

export function parseRegionalEconomyHash(
  hash: string,
  validIds: readonly string[],
): RegionalEconomyState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const start = Number(params.get("start"));
  const end = Number(params.get("end"));
  return {
    measure: params.get("measure") === "share_of_region_gdp" ? "share_of_region_gdp" : "nominal",
    mode: params.get("view") === "table" ? "table" : "line",
    range:
      params.get("range") !== "all" &&
      params.has("start") &&
      params.has("end") &&
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start > 0 &&
      end > 0
        ? { kind: "manual", start: Math.min(start, end), end: Math.max(start, end) }
        : { kind: "all" },
    selectedIds: params.has("sel")
      ? [...new Set(params.get("sel")!.split(","))].filter((id) => validIds.includes(id))
      : [REGIONAL_GDP_TOTAL],
  };
}

export function serializeRegionalEconomyHash(state: RegionalEconomyState) {
  const params = new URLSearchParams({
    measure: state.measure,
    view: state.mode,
    sel: state.selectedIds.join(","),
  });
  if (state.range.kind === "all") params.set("range", "all");
  else {
    params.set("start", String(state.range.start));
    params.set("end", String(state.range.end));
  }
  return params.toString();
}

function resolveRange(
  state: RegionalEconomyState,
  facts: readonly ServedRegionalEconomyObservation[],
) {
  const availableYears = [
    ...new Set(facts.filter((fact) => fact.measure === state.measure).map((fact) => fact.year)),
  ].sort((left, right) => left - right);
  if (availableYears.length === 0) throw new Error(`No available regional economy years for ${state.measure}`);
  const min = availableYears[0];
  const max = availableYears.at(-1)!;
  const manual = state.range.kind === "manual" && state.range.end >= min && state.range.start <= max
    ? state.range
    : null;
  return {
    availableYears,
    min,
    max,
    start: manual ? Math.max(min, manual.start) : min,
    end: manual ? Math.min(max, manual.end) : max,
  };
}

export function changeRegionalEconomyMeasure(
  state: RegionalEconomyState,
  measure: RegionalEconomyMeasure,
  facts: readonly ServedRegionalEconomyObservation[],
): RegionalEconomyState {
  const range = resolveRange({ ...state, measure }, facts);
  return {
    ...state,
    measure,
    range: state.range.kind === "all" || state.range.end < range.min || state.range.start > range.max
      ? { kind: "all" }
      : { kind: "manual", start: range.start, end: range.end },
  };
}

export function buildRegionalEconomyModel(
  facts: readonly ServedRegionalEconomyObservation[],
  registry: readonly SectorDefinition[],
  state: RegionalEconomyState,
) {
  if (new Set(facts.map((fact) => fact.regionId)).size > 1) {
    throw new Error("Regional economy workspace accepts one region at a time");
  }
  const range = resolveRange(state, facts);
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const active = facts.filter((fact) =>
    fact.measure === state.measure && fact.year >= range.start && fact.year <= range.end);
  const byCell = new Map(active.map((fact) => [`${fact.seriesId}:${fact.year}`, fact]));
  const allDefinitions = regionalEconomyDefinitions(registry);
  const endValues = Object.fromEntries(
    allDefinitions.map((definition) => [definition.id, byCell.get(`${definition.id}:${range.end}`)?.value ?? null]),
  );
  const definitions = rankRegionalEconomyDefinitions(allDefinitions, endValues);
  const selected = definitions.filter((definition) => state.selectedIds.includes(definition.id));
  const percentage = state.measure === "share_of_region_gdp";
  const rows = selected.map((definition) => ({
    itemId: definition.id,
    kaLabel: definition.labelKa,
    color: regionalEconomyColor(definition.id),
    valuesByYear: Object.fromEntries(years.map((year) => {
      const value = byCell.get(`${definition.id}:${year}`)?.value;
      return [year, value === undefined ? null : percentage ? value / 100 : value];
    })),
    preliminaryByYear: Object.fromEntries(years.map((year) => [year, false])),
  }));
  return {
    range,
    years,
    availableYears: range.availableYears,
    definitions,
    rows,
    series: selected.map((definition) => ({
      id: definition.id,
      label: definition.labelKa,
      color: regionalEconomyColor(definition.id),
      vals: years.map((year) => byCell.get(`${definition.id}:${year}`)?.value ?? null),
      planned: years.map(() => false),
      preliminary: years.map(() => false),
    })),
    endValues,
    headline: active
      .filter((fact) => fact.seriesId === REGIONAL_GDP_TOTAL)
      .sort((left, right) => left.year - right.year)
      .at(-1) ?? null,
    sourceIds: [...new Set(active.filter((fact) => state.selectedIds.includes(fact.seriesId)).map((fact) => fact.sourceId))],
    hasData: active.some((fact) => state.selectedIds.includes(fact.seriesId)),
  };
}
