import {
  TRANSPORT_FLEET_AGES, TRANSPORT_FLEET_FUELS, TRANSPORT_FREIGHT_GROUPS, TRANSPORT_FREIGHT_MODES, TRANSPORT_INDICATORS, TRANSPORT_PASSENGER_GROUPS, TRANSPORT_PASSENGER_MODES,
  TRANSPORT_VEHICLE_TYPES, transportFactKey, transportIndicator, type ClientTransportFact, type TransportIndicator, type TransportMeasure, type TransportVehicleType,
} from "../data/transport/types";
import { INK } from "./colors";
import { MISSING, formatInUnit, type ValueUnit } from "./format";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, serializeTopicHash, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { changeUnitListSelection, parseUnitListHash, unitListCoverage } from "./unitList";

export const TRANSPORT_HUB_PATH = "/explorer/transport";
export const TRANSPORT_SECTIONS = [
  { id: "vehicles", href: "/explorer/transport/vehicles", labelKey: "common.transportVehicles" },
  { id: "vehicle-age", href: "/explorer/transport/vehicle-age", labelKey: "common.transportVehicleAge" },
  { id: "passengers", href: "/explorer/transport/passengers", labelKey: "common.transportPassengers" },
  { id: "freight", href: "/explorer/transport/freight", labelKey: "common.transportFreight" },
  { id: "regions", href: "/explorer/transport/regions", labelKey: "common.transportRegions" },
] as const;
export type TransportSectionId = typeof TRANSPORT_SECTIONS[number]["id"];
/** The four pages with a chart of national series; Regions is the map index of the area pages (transportAreas.ts). */
export type TransportTopicId = Exclude<TransportSectionId, "regions">;

/**
 * The heading a row sits under: vehicle types and each type's fuels on Vehicles, each type's age rows on Vehicle age,
 * passenger-km, passenger-km per person and passengers carried on Passengers, tonne-km and goods carried on Freight, and
 * registered vehicles, their fuel, age and owner, and roads on the area pages. Rows under one heading share one unit.
 */
export type TransportHeading =
  | "types" | "carsFuel" | "busesFuel" | "trucksFuel" | "specialFuel" | "carsAge" | "busesAge" | "trucksAge" | "specialAge"
  | "pkm" | "pkmPerPerson" | "passengers" | "tkm" | "tonnes" | "registered" | "fuel" | "age" | "owner" | "roads";
export type TransportSeriesDefinition = { id: TransportIndicator; reference: boolean; heading: TransportHeading };

const rows = (measure: TransportMeasure, groups: readonly string[], heading: TransportHeading, reference?: string): TransportSeriesDefinition[] =>
  groups.map(group => ({ id: transportIndicator(measure, group), reference: group === reference, heading }));
/** Buses have no unknown-age row; the indicator list decides which rows exist. */
const ageRows = (type: TransportVehicleType) =>
  rows("fleet", TRANSPORT_FLEET_AGES.map(age => `${type}_age_${age}`), `${type}Age`).filter(row => TRANSPORT_INDICATORS.includes(row.id));

/** The series a topic page lists, in the spec's order (§4–7); a page's total, where Geostat prints one, is the ink reference. */
export function transportTopicSeries(section: TransportTopicId): TransportSeriesDefinition[] {
  switch (section) {
    case "vehicles": return [
      ...rows("fleet", TRANSPORT_VEHICLE_TYPES, "types"),
      ...TRANSPORT_VEHICLE_TYPES.flatMap(type => rows("fleet", TRANSPORT_FLEET_FUELS[type].map(fuel => `${type}_fuel_${fuel}`), `${type}Fuel`)),
    ];
    case "vehicle-age": return TRANSPORT_VEHICLE_TYPES.flatMap(ageRows);
    case "passengers": return [
      ...rows("passenger_km", TRANSPORT_PASSENGER_MODES, "pkm", "total"),
      ...rows("passenger_km_per_person", ["total"], "pkmPerPerson", "total"),
      ...rows("passengers", TRANSPORT_PASSENGER_GROUPS, "passengers"),
    ];
    case "freight": return [...rows("tonne_km", TRANSPORT_FREIGHT_MODES, "tkm", "total"), ...rows("freight_tonnes", TRANSPORT_FREIGHT_GROUPS, "tonnes")];
  }
}

/** A page's initial selection: passenger cars, passenger cars over 10 years old, or all transport. */
export function transportDefaultSelection(section: TransportTopicId): string[] {
  return section === "vehicle-age" ? [transportIndicator("fleet", "cars_age_over_10")] : [transportTopicSeries(section)[0].id];
}

/** The fuels in the passenger cars' list, which holds every other type's fuels. */
const FUELS = TRANSPORT_FLEET_FUELS.cars;
const groupOf = (id: string) => id.split(".")[2];

/**
 * The reference is ink. A vehicle type wears one colour on every page (palette positions 0–3) and a fuel one under every
 * fuel heading and area page (positions 4–11), so a type and a fuel charted together never share a colour. An age row
 * wears its band's colour under every type. Other rows take their colour by position.
 */
export function transportSeriesColor(series: TransportSeriesDefinition, index: number): string {
  if (series.reference) return INK;
  const group = groupOf(series.id);
  const type = TRANSPORT_VEHICLE_TYPES.find(t => group === t || group.endsWith(`_${t}`));
  if (type && (series.heading === "types" || series.heading === "registered")) return topicSeriesColor(series, TRANSPORT_VEHICLE_TYPES.indexOf(type), `transport.type.${type}`);
  const fuel = /_fuel_(.+)$/.exec(group)?.[1];
  if (fuel) return topicSeriesColor(series, TRANSPORT_VEHICLE_TYPES.length + FUELS.indexOf(fuel), `transport.fuel.${fuel}`);
  const age = /_age_(.+)$/.exec(group)?.[1];
  if (age && series.heading.endsWith("Age")) return topicSeriesColor(series, TRANSPORT_FLEET_AGES.indexOf(age as typeof TRANSPORT_FLEET_AGES[number]), `transport.age.${age}`);
  return topicSeriesColor(series, index);
}

export type TransportState = TopicState;
export type TransportUnit = ClientTransportFact["unit"];

const noTransportYears = (definitions: readonly TransportSeriesDefinition[]) => `No transport years for ${definitions[0]?.id}`;

/** A list's years for its selection (all of its series' years when nothing is selected). */
export const transportListCoverage = (definitions: readonly TransportSeriesDefinition[], selectedIds: readonly string[], facts: readonly ClientTransportFact[]) =>
  unitListCoverage(definitions, selectedIds, facts, noTransportYears(definitions));

/** Reads a list's hash: a selection that mixes units keeps only its first row's unit (in list order), and the years fit that unit's coverage. */
export const parseTransportListHash = (hash: string, definitions: readonly TransportSeriesDefinition[], fallback: readonly string[], facts: readonly ClientTransportFact[]): TopicState =>
  parseUnitListHash(hash, definitions, fallback, facts, noTransportYears(definitions));

/** A list's new selection, kept to one unit; the years stay, clamped to the selection's coverage (never collapsed to "all"). */
export const changeTransportSelection = (state: TopicState, definitions: readonly TransportSeriesDefinition[], next: readonly string[], facts: readonly ClientTransportFact[]): TopicState =>
  changeUnitListSelection(state, definitions, next, facts, noTransportYears(definitions));

/** A topic page's years for its selection. */
export const transportCoverage = (section: TransportTopicId, facts: readonly ClientTransportFact[], selectedIds: readonly string[] = []) =>
  transportListCoverage(transportTopicSeries(section), selectedIds, facts);

export const parseTransportHash = (hash: string, section: TransportTopicId, facts: readonly ClientTransportFact[]): TransportState =>
  parseTransportListHash(hash, transportTopicSeries(section), transportDefaultSelection(section), facts);

/** A topic or area page's hash: the keys every topic page shares, and nothing else. */
export const serializeTransportHash = (state: TopicState) => serializeTopicHash(state);

export type TransportSeriesModel = TopicSeriesModel<TransportSeriesDefinition & { decimals: number; unit: TransportUnit }>;
/** `unit` is the selection's (the list's first series' when nothing is selected). */
export type TransportModel = { range: ResolvedPeriodRange; years: number[]; series: TransportSeriesModel[]; selected: TransportSeriesModel[]; unit: TransportUnit };

/**
 * The years (the selection's unit's coverage), values, colours and units of a list of series. A year Geostat left blank
 * ("…", or a column a year does not print) is null, never zero; a nil cell ("-") is 0. Shared by the topic and area pages.
 */
export function buildTransportSeriesModel(
  definitions: readonly TransportSeriesDefinition[], facts: readonly ClientTransportFact[], state: TopicState,
  color: (definition: TransportSeriesDefinition, index: number) => string = transportSeriesColor,
): TransportModel {
  const byCell = new Map(facts.map(f => [transportFactKey(f), f]));
  const first = new Map<string, ClientTransportFact>();
  for (const fact of facts) if (!first.has(fact.indicatorId)) first.set(fact.indicatorId, fact);
  const model = buildTopicModel({ range: state.range, coverage: transportListCoverage(definitions, state.selectedIds, facts), selectedIds: state.selectedIds, color,
    definitions: definitions.map(definition => ({ ...definition, decimals: first.get(definition.id)?.decimals ?? 1, unit: first.get(definition.id)!.unit })),
    value: (definition, year) => byCell.get(transportFactKey({ indicatorId: definition.id, year }))?.value });
  return { ...model, unit: (model.selected[0] ?? model.series[0]).unit };
}

export const buildTransportModel = (section: TransportTopicId, facts: readonly ClientTransportFact[], state: TransportState): TransportModel =>
  buildTransportSeriesModel(transportTopicSeries(section), facts, state);

/** Reads a `transport.*` message. */
export type TransportTranslate = (key: string, values?: Record<string, string | number>) => string;

/** How a unit reads in charts, tables and lists: Geostat's published figure, whole km per person, one decimal otherwise. */
export function transportValueUnit(unit: TransportUnit): ValueUnit {
  return { divisor: 1, label: "", decimals: unit === "pkmPerPerson" ? 0 : 1 };
}

const UNIT_KEYS: Record<TransportUnit, string> = {
  vehicles: "unitThousandVehicles", pkm: "unitMillionPkm", pkmPerPerson: "unitPkmPerPerson", passengers: "unitThousandPassengers",
  tkm: "unitMillionTkm", tonnes: "unitThousandTonnes", km: "unitKm",
};

/** The unit's name beside a chart or table. */
export function transportUnitLabel(unit: TransportUnit, t: TransportTranslate): string {
  return t(UNIT_KEYS[unit]);
}

/** A tooltip or list value with its unit, since every unit is in thousands or millions. */
export function transportValueLabel(value: number | null | undefined, unit: TransportUnit, t: TransportTranslate): string {
  return value == null ? MISSING : `${formatInUnit(value, transportValueUnit(unit))} ${transportUnitLabel(unit, t)}`;
}

/**
 * Headings whose rows repeat one another's names in one unit: a fuel under each vehicle type, an age row under each type, and
 * an area page's fuel, age and owner rows (fuel and age both have "Unknown").
 */
const NAMED_BY_HEADING: ReadonlySet<TransportHeading> = new Set(["carsFuel", "busesFuel", "trucksFuel", "specialFuel", "carsAge", "busesAge", "trucksAge", "specialAge", "fuel", "age", "owner"]);

/**
 * A series' name outside the list (chart, table, workbook): a fuel or age row carries its heading's text before the unit;
 * types, modes and groups keep their own name.
 */
export function transportSeriesLabel(series: Pick<TransportSeriesDefinition, "id" | "heading">, labels: Readonly<Record<string, string>>, t: TransportTranslate): string {
  return NAMED_BY_HEADING.has(series.heading) ? `${labels[series.id]} — ${t(`heading.${series.heading}`).split(" · ")[0]}` : labels[series.id];
}

/**
 * A latest-value line's figure, from Geostat's thousands (vehicles) or millions (passenger-km, tonne-km): kept in
 * thousands, or shown in millions to two decimals or billions to one.
 */
export function transportLatestValue(value: number, scale: "thousand" | "million" | "billion", t: TransportTranslate): string {
  const unit: ValueUnit = scale === "thousand" ? { divisor: 1, label: "", decimals: 1 } : { divisor: 1000, label: "", decimals: scale === "million" ? 2 : 1 };
  return `${formatInUnit(value, unit)} ${t(`unit${scale[0].toUpperCase()}${scale.slice(1)}`)}`;
}
