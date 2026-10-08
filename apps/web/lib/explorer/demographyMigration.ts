import { SERIES } from "../data/demography/series";
import type { ClientMigrationFact } from "../servedRows";
import { OTHER_COLOR } from "./colors";
import { refitRange, resolveRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

/** The three series the page reads; the mirror holds the whole migration file. */
export const MIGRATION_SERIES: readonly string[] = [
  SERIES.immigrantsByCitizenshipGroup,
  SERIES.emigrantsByCitizenshipGroup,
  SERIES.netMigration,
];

/** The reviewed groups in their fixed page order: Georgia, the four named countries, then the computed remainder. */
export const MIGRATION_GROUPS = [
  "citizenship.georgia",
  "citizenship.russian_federation",
  "citizenship.turkey",
  "citizenship.azerbaijan",
  "citizenship.ukraine",
  "citizenship.all_other_computed",
] as const;
export type MigrationGroup = (typeof MIGRATION_GROUPS)[number];

/** Section spec §7: one stable colour per group, the computed remainder in the shared "other" colour. */
export const MIGRATION_COLORS: Record<MigrationGroup, string> = {
  "citizenship.georgia": "#3D5A98",
  "citizenship.russian_federation": "#C26E4C",
  "citizenship.turkey": "#1F6E56",
  "citizenship.azerbaijan": "#A5822B",
  "citizenship.ukraine": "#7A4E8C",
  "citizenship.all_other_computed": OTHER_COLOR,
};

export const MIGRATION_SEXES = ["total", "male", "female"] as const;
export type MigrationSex = (typeof MIGRATION_SEXES)[number];
export const MIGRATION_DIRECTIONS = ["arrivals", "departures", "net"] as const;
export type MigrationDirection = (typeof MIGRATION_DIRECTIONS)[number];

export type MigrationState = {
  mode: "line" | "table";
  range: PeriodRange;
  selectedIds: MigrationGroup[];
  sex: MigrationSex;
  /** The table's direction tab; the chart always shows both directions. */
  direction: MigrationDirection;
};

export const DEFAULT_MIGRATION_STATE: MigrationState = {
  mode: "line",
  range: { kind: "all" },
  selectedIds: [...MIGRATION_GROUPS],
  sex: "total",
  direction: "arrivals",
};

export function migrationCoverage(facts: readonly ClientMigrationFact[]) {
  const years = [...new Set(facts.filter((fact) => fact.seriesId === SERIES.immigrantsByCitizenshipGroup).map((fact) => fact.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error("No migration years");
  return { min: years[0]!, max: years.at(-1)!, years };
}

function pick<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** An absent `sel` means all six groups; an explicit empty `sel=` stays empty. Unknown values fall back to the default. */
export function parseMigrationHash(hash: string, facts: readonly ClientMigrationFact[]): MigrationState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const requested = params.has("sel") ? params.get("sel")!.split(",") : [...MIGRATION_GROUPS];
  return {
    mode: params.get("view") === "table" ? "table" : "line",
    range: refitRange(parseYearRangeKeys(params), migrationCoverage(facts), { collapseToAll: true }),
    selectedIds: MIGRATION_GROUPS.filter((id) => requested.includes(id)),
    sex: pick(MIGRATION_SEXES, params.get("sex"), "total"),
    direction: pick(MIGRATION_DIRECTIONS, params.get("dir"), "arrivals"),
  };
}

export function serializeMigrationHash(state: MigrationState): string {
  const params = new URLSearchParams({ view: state.mode });
  if (state.selectedIds.length !== MIGRATION_GROUPS.length) params.set("sel", state.selectedIds.join(","));
  if (state.sex !== "total") params.set("sex", state.sex);
  if (state.direction !== "arrivals") params.set("dir", state.direction);
  writeYearRangeKeys(params, state.range);
  return params.toString();
}

type ByYear = Record<number, number | null>;

export type MigrationModel = {
  range: ResolvedPeriodRange;
  years: number[];
  selectedIds: MigrationGroup[];
  allSelected: boolean;
  /** Every group in the chosen sex, whatever is selected. Departures are positive counts here. */
  byDirection: Record<MigrationDirection, Record<MigrationGroup, ByYear>>;
  /** The sum over the selected groups; null when nothing is selected or a value is missing. */
  totals: Record<MigrationDirection, ByYear>;
  /** Geostat's published net for both sexes, for the identity check. */
  publishedNet: ByYear;
};

function sum(values: readonly (number | null)[]): number | null {
  if (!values.length || values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + value!, 0);
}

export function buildMigrationModel(facts: readonly ClientMigrationFact[], state: MigrationState): MigrationModel {
  const coverage = migrationCoverage(facts);
  const range = resolveRange(state.range, coverage);
  const years = coverage.years.filter((year) => year >= range.start && year <= range.end);
  const cell = new Map<string, number>();
  for (const fact of facts) cell.set(`${fact.seriesId}|${fact.sex}|${fact.citizenshipId}|${fact.year}`, fact.value);
  const seriesOf = (seriesId: string, group: MigrationGroup): ByYear =>
    Object.fromEntries(years.map((year) => [year, cell.get(`${seriesId}|${state.sex}|${group}|${year}`) ?? null]));
  const arrivals = Object.fromEntries(MIGRATION_GROUPS.map((group) => [group, seriesOf(SERIES.immigrantsByCitizenshipGroup, group)])) as Record<MigrationGroup, ByYear>;
  const departures = Object.fromEntries(MIGRATION_GROUPS.map((group) => [group, seriesOf(SERIES.emigrantsByCitizenshipGroup, group)])) as Record<MigrationGroup, ByYear>;
  const net = Object.fromEntries(
    MIGRATION_GROUPS.map((group) => [
      group,
      Object.fromEntries(years.map((year) => {
        const [inflow, outflow] = [arrivals[group][year], departures[group][year]];
        return [year, inflow === null || outflow === null ? null : inflow - outflow];
      })),
    ]),
  ) as Record<MigrationGroup, ByYear>;
  const byDirection = { arrivals, departures, net };
  const selectedIds = MIGRATION_GROUPS.filter((id) => state.selectedIds.includes(id));
  const totalOf = (direction: MigrationDirection): ByYear =>
    Object.fromEntries(years.map((year) => [year, sum(selectedIds.map((group) => byDirection[direction][group][year]))]));
  return {
    range,
    years,
    selectedIds,
    allSelected: selectedIds.length === MIGRATION_GROUPS.length,
    byDirection,
    totals: { arrivals: totalOf("arrivals"), departures: totalOf("departures"), net: totalOf("net") },
    publishedNet: Object.fromEntries(years.map((year) => [year, cell.get(`${SERIES.netMigration}|total|citizenship.total|${year}`) ?? null])),
  };
}

export type MigrationIndicators = {
  year: number;
  net: number | null;
  /** The sum of the yearly nets over the active range. */
  cumulativeNet: number | null;
  arrivals: number | null;
  departures: number | null;
  /** Arrivals who are not Georgian citizens, as a fraction of all arrivals. */
  foreignShare: number | null;
  sparks: { arrivals: (number | null)[]; departures: (number | null)[]; foreignShare: (number | null)[] };
};

/** The key figures: the range's end year, the chosen sex, all six groups whatever the selection. */
export function buildMigrationIndicators(facts: readonly ClientMigrationFact[], state: MigrationState): MigrationIndicators {
  const all = buildMigrationModel(facts, { ...state, selectedIds: [...MIGRATION_GROUPS] });
  const year = all.range.end;
  const share = (at: number): number | null => {
    const total = all.totals.arrivals[at] ?? null;
    const georgia = all.byDirection.arrivals["citizenship.georgia"][at] ?? null;
    return total === null || georgia === null || total === 0 ? null : (total - georgia) / total;
  };
  return {
    year,
    net: all.totals.net[year] ?? null,
    cumulativeNet: sum(all.years.map((at) => all.totals.net[at] ?? null)),
    arrivals: all.totals.arrivals[year] ?? null,
    departures: all.totals.departures[year] ?? null,
    foreignShare: share(year),
    sparks: {
      arrivals: all.years.map((at) => all.totals.arrivals[at] ?? null),
      departures: all.years.map((at) => all.totals.departures[at] ?? null),
      foreignShare: all.years.map(share),
    },
  };
}
