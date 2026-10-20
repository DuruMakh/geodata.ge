import Decimal from "decimal.js";
import {
  SCIENCE_CULTURE_GROUPS, SCIENCE_CULTURE_INDICATORS, SCIENCE_CULTURE_REGIONS, SCIENCE_CULTURE_SOURCES, scienceCultureFactKey,
  type ScienceCultureFact, type ScienceCultureMeasure,
} from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const LAST_YEAR = 2025;
/** First and last served year of every group of a measure (the package's coverage.csv; events are counted from 2021, the printed dashes before are not collected). */
const YEARS: Record<ScienceCultureMeasure, readonly [number, number]> = {
  researchers: [2019, 2024], rd_staff: [2019, 2024], institutions: [2019, 2024], rd_spending: [2019, 2024],
  invention_applications: [2016, LAST_YEAR], invention_patents: [2016, LAST_YEAR], utility_applications: [2016, LAST_YEAR], utility_patents: [2016, LAST_YEAR],
  museums: [2005, LAST_YEAR], museum_visitors: [2005, LAST_YEAR], museum_tours: [2005, LAST_YEAR], museum_exhibitions: [2005, LAST_YEAR], museum_staff: [2020, LAST_YEAR],
  theatres: [2006, LAST_YEAR], theatre_audience: [2006, LAST_YEAR], theatre_shows: [2006, LAST_YEAR], theatre_events: [2021, LAST_YEAR], theatre_seats: [2006, LAST_YEAR], theatre_staff: [2020, LAST_YEAR],
};
const UNITS: Record<ScienceCultureMeasure, ScienceCultureFact["unit"]> = {
  researchers: "persons", rd_staff: "persons", institutions: "count", rd_spending: "gel_million",
  invention_applications: "count", invention_patents: "count", utility_applications: "count", utility_patents: "count",
  museums: "count", museum_visitors: "persons_thousand", museum_tours: "count_thousand", museum_exhibitions: "count", museum_staff: "persons",
  theatres: "count", theatre_audience: "persons_thousand", theatre_shows: "count", theatre_events: "count", theatre_seats: "count_thousand", theatre_staff: "persons",
};
const WHOLE_UNITS: readonly ScienceCultureFact["unit"][] = ["persons", "count"];
const SOURCES: Record<ScienceCultureMeasure, string> = {
  researchers: "geostat_science_researchers", rd_staff: "geostat_science_rd_staff", institutions: "geostat_science_institutions", rd_spending: "geostat_science_institutions",
  invention_applications: "geostat_science_patents", invention_patents: "geostat_science_patents", utility_applications: "geostat_science_patents", utility_patents: "geostat_science_patents",
  museums: "geostat_culture_museums", museum_visitors: "geostat_culture_museums_regions", museum_tours: "geostat_culture_museums_regions", museum_exhibitions: "geostat_culture_museums_regions",
  museum_staff: "geostat_culture_museum_staff", theatres: "geostat_culture_theatres", theatre_audience: "geostat_culture_theatre_events", theatre_shows: "geostat_culture_theatre_events",
  theatre_events: "geostat_culture_theatre_events", theatre_seats: "geostat_culture_theatres", theatre_staff: "geostat_culture_theatre_staff",
};
const parts = (indicatorId: string) => indicatorId.split(".") as [string, ScienceCultureMeasure, string];

/** The workbook and sheet an observation must come from. */
function expectedSource(measure: ScienceCultureMeasure, group: string): { sourceId: string; sheet: string } {
  if (measure === "museums" && group.startsWith("region_")) return { sourceId: "geostat_culture_museums_count_regions", sheet: "1" };
  if (measure === "researchers") return { sourceId: SOURCES[measure], sheet: group.startsWith("age_") ? "2" : group.startsWith("field_") ? "3" : "1" };
  return { sourceId: SOURCES[measure], sheet: measure.startsWith("utility_") ? "2" : "1" };
}

/** Every key the serving package must contain, exactly once. */
export function expectedScienceCultureKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of SCIENCE_CULTURE_INDICATORS) {
    const [, measure] = parts(indicatorId);
    for (const year of range(...YEARS[measure])) keys.add(`${indicatorId}:${year}`);
  }
  return keys;
}

/** Thousands and million GEL are shown with one decimal; counts and persons as whole numbers. */
export function scienceCultureDisplayDecimals(indicatorId: string): 0 | 1 {
  return WHOLE_UNITS.includes(UNITS[parts(indicatorId)[1]]) ? 0 : 1;
}

/**
 * The research package's `KNOWN_DIFFERENCES` (prepare.py): years whose 11 regions minus Georgia's printed total differ by exactly this many
 * thousand persons, which must stay as recorded. Every other year must add up within the tolerance.
 */
const KNOWN_DIFFERENCES: Partial<Record<ScienceCultureMeasure, Record<number, string>>> = {
  museum_visitors: { 2005: "-0.013", 2013: "-0.019", 2023: "-0.030" },
};
/** Geostat rounds the regional group tours to one decimal in early years. */
const TOLERANCE: Partial<Record<ScienceCultureMeasure, string>> = { museum_tours: "0.2" };
/** What Geostat prints, as published. */
const ANCHORS: readonly (readonly [string, number, string])[] = [
  ["science_culture.researchers.total", 2024, "14046"], ["science_culture.researchers.women", 2024, "7732"],
  ["science_culture.rd_staff.total", 2024, "16191"], ["science_culture.institutions.total", 2024, "66"], ["science_culture.rd_spending.total", 2024, "242.9"],
  ["science_culture.invention_applications.local", 2025, "79"], ["science_culture.invention_patents.local", 2025, "41"], ["science_culture.invention_applications.international", 2025, "85"],
  ["science_culture.museums.total", 2025, "261"], ["science_culture.museum_visitors.total", 2025, "1998.924"], ["science_culture.museum_visitors.region_samtskhe_javakheti", 2025, "164.893"],
  ["science_culture.theatres.total", 2025, "53"], ["science_culture.theatre_audience.total", 2025, "620.322"],
];

type Sum = { measure: ScienceCultureMeasure; label: string; total: string; parts: readonly string[] };
const ids = (measure: ScienceCultureMeasure, groups: readonly string[]) => groups.map(group => `science_culture.${measure}.${group}`);
const groupsStartingWith = (measure: ScienceCultureMeasure, prefix: string) => (SCIENCE_CULTURE_GROUPS[measure] as readonly string[]).filter(group => group.startsWith(prefix));
const total = (measure: ScienceCultureMeasure) => `science_culture.${measure}.total`;
const regions = (measure: ScienceCultureMeasure): Sum => ({ measure, label: "regions", total: total(measure), parts: ids(measure, SCIENCE_CULTURE_REGIONS) });
const staff = (measure: "museum_staff" | "theatre_staff"): Sum[] => [
  { measure, label: "sexes", total: total(measure), parts: ids(measure, ["women", "men"]) },
  { measure, label: "contracts", total: total(measure), parts: ids(measure, ["permanent", "contract"]) },
  { measure, label: "age groups", total: total(measure), parts: ids(measure, groupsStartingWith(measure, "age_")) },
];
/** Each group of parts must add up to its total in every served year (the research package's checks). */
const SUMS: readonly Sum[] = [
  { measure: "researchers", label: "sexes", total: total("researchers"), parts: ids("researchers", ["women", "men"]) },
  ...(["degree_", "age_", "field_"] as const).map(prefix => ({
    measure: "researchers" as const, label: `${prefix.slice(0, -1)}s`, total: total("researchers"), parts: ids("researchers", groupsStartingWith("researchers", prefix)),
  })),
  { measure: "rd_staff", label: "sexes", total: total("rd_staff"), parts: ids("rd_staff", ["women", "men"]) },
  { measure: "rd_staff", label: "categories", total: total("rd_staff"), parts: [total("researchers"), ...ids("rd_staff", ["technicians", "support", "not_specified"])] },
  { measure: "museums", label: "types", total: total("museums"), parts: ids("museums", groupsStartingWith("museums", "type_")) },
  regions("museums"), regions("museum_visitors"), regions("museum_tours"), regions("museum_exhibitions"),
  ...staff("museum_staff"), ...staff("theatre_staff"),
  { measure: "theatres", label: "types", total: total("theatres"), parts: ids("theatres", groupsStartingWith("theatres", "type_")) },
];

export function validateScienceCultureFacts(facts: readonly ScienceCultureFact[]): void {
  const expected = expectedScienceCultureKeys();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = scienceCultureFactKey(fact);
    if (!SCIENCE_CULTURE_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid science and culture identity: ${key}`);
    const [, measure, group] = parts(fact.indicatorId);
    if (fact.year > LAST_YEAR) throw new Error(`Science and culture observation after 2025: ${key}`);
    if (!expected.has(key)) throw new Error(`Science and culture observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate science and culture observation: ${key}`);
    const source = expectedSource(measure, group);
    if (fact.unit !== UNITS[measure] || fact.basis !== "actual" || fact.valueStatus !== "official" || fact.sourceId !== source.sourceId
      || fact.sourceSheet !== source.sheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid science and culture source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid science and culture value: ${key}`); }
    if (!value.isFinite() || value.lt(0) || value.decimalPlaces() > 30) throw new Error(`Science and culture value outside its range or database precision: ${key}`);
    if (WHOLE_UNITS.includes(fact.unit) && value.decimalPlaces() > 0) throw new Error(`Science and culture value must be a whole number: ${key}`);
    // Round half-up from the value as Excel displays it (15 significant digits), at the larger of the display precision and the stored decimals.
    const places = Math.max(scienceCultureDisplayDecimals(fact.indicatorId), value.decimalPlaces());
    if (fact.publishedValue !== value.toSignificantDigits(15).toFixed(places)) throw new Error(`Science and culture published value does not match its stored value: ${key}`);
    values.set(key, value);
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete science and culture coverage: ${missing.length} missing, first ${missing[0]}`);
  for (const [indicatorId, year, published] of ANCHORS) if (facts.find(f => f.indicatorId === indicatorId && f.year === year)!.publishedValue !== published) throw new Error(`Science and culture anchor value changed: ${indicatorId}:${year}`);

  for (const sum of SUMS) {
    const tolerance = TOLERANCE[sum.measure] ?? "0";
    const recorded = sum.label === "regions" ? KNOWN_DIFFERENCES[sum.measure] ?? {} : {};
    for (const year of range(...YEARS[sum.measure])) {
      const difference = sum.parts.reduce((all, id) => all.plus(values.get(`${id}:${year}`)!), new D(0)).minus(values.get(`${sum.total}:${year}`)!);
      const failed = year in recorded ? !difference.eq(recorded[year]) : difference.abs().gt(tolerance);
      if (failed) throw new Error(`The science and culture ${sum.measure} ${sum.label} do not add up to the total in ${year} as recorded`);
    }
  }
  if (!SCIENCE_CULTURE_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Science and culture source missing from the serving package");
}
