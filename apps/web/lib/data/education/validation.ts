import Decimal from "decimal.js";
import {
  EDUCATION_GEORGIA, EDUCATION_HE_GROUPS, EDUCATION_INDICATORS, EDUCATION_MUNICIPALITIES, EDUCATION_OWNERSHIP_GROUPS,
  EDUCATION_REGIONS, EDUCATION_SOURCES, EDUCATION_UNITS, EDUCATION_VET_FIELDS, educationFactKey, type EducationFact, type EducationMeasure,
} from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const LAST_YEAR = 2025;
/** School years are stored as their start year; each table serves its own span. */
const NATIONAL_YEARS = range(2000, LAST_YEAR), TEACHER_YEARS = range(2006, LAST_YEAR);
const MUNICIPAL_YEARS = range(2005, LAST_YEAR), MUNICIPAL_TEACHER_YEARS = range(2016, LAST_YEAR), KG_YEARS = range(2017, LAST_YEAR);
const HE_YEARS = range(2011, LAST_YEAR), GRADUATE_YEARS = range(2010, LAST_YEAR - 1), VET_YEARS = range(2013, LAST_YEAR);
const VET_CURRENT_ONLY_FROM = 2023;
/** A vocational field's active span: Geostat prints 0 outside it and those cells produce no row. */
const VET_SPANS: Record<string, readonly [number, number]> = {
  field_agriculture_vet: [2019, 2025], field_arts_humanities: [2019, 2025], field_business_law: [2019, 2025], field_education: [2016, 2025],
  field_engineering: [2019, 2025], field_health_welfare: [2019, 2025], field_ict: [2019, 2025], field_services: [2019, 2025],
  field_social_journalism: [2020, 2025],
  old_agricultural_sciences: [2013, 2022], old_business_administration: [2013, 2022], old_engineering: [2013, 2022], old_natural_sciences: [2013, 2019],
  old_inter_directional: [2013, 2022], old_law: [2013, 2020], old_social_sciences: [2013, 2022], old_art: [2013, 2022], old_health: [2013, 2022],
};
const UNITS: Record<EducationMeasure, EducationFact["unit"]> = {
  schools: "institutions", kindergartens: "institutions", pupils_national: "persons_thousand", pupils: "persons", teachers: "persons",
  kg_children: "persons", kg_staff: "persons", he_students: "persons", he_admitted: "persons", he_graduates: "persons", vet_admitted: "persons", vet_graduates: "persons",
};
/** Geostat's own printed sums that differ from their parts, as reviewed in data/mappings/education/known-differences.csv (prepare checks the two agree). */
export const EDUCATION_KNOWN_DIFFERENCES: readonly { check: string; year: number; difference: string }[] = [
  { check: "education.kg_children.total region.samegrelo_zemo_svaneti", year: 2024, difference: "-400" },
  { check: "education.kg_children.total georgia", year: 2024, difference: "400" },
  { check: "education.pupils.total region.guria", year: 2022, difference: "205" },
];
/** What Geostat prints, as published. */
const ANCHORS: readonly (readonly [string, string, number, string])[] = [
  ["education.schools.total", EDUCATION_GEORGIA, 2025, "2292"], ["education.schools.private", EDUCATION_GEORGIA, 2025, "206"],
  ["education.pupils_national.total", EDUCATION_GEORGIA, 2025, "644.2"], ["education.pupils.total", "region.tbilisi", 2025, "232134"],
  ["education.teachers.total", EDUCATION_GEORGIA, 2025, "66328"], ["education.kindergartens.total", EDUCATION_GEORGIA, 2025, "1717"],
  ["education.kg_children.total", EDUCATION_GEORGIA, 2025, "130337"], ["education.kg_staff.total", EDUCATION_GEORGIA, 2025, "19176"],
  ["education.he_students.total", EDUCATION_GEORGIA, 2025, "195426"], ["education.he_admitted.total", EDUCATION_GEORGIA, 2025, "58554"],
  ["education.he_graduates.total", EDUCATION_GEORGIA, 2024, "32494"], ["education.vet_admitted.total", EDUCATION_GEORGIA, 2025, "19690"],
  ["education.vet_graduates.total", EDUCATION_GEORGIA, 2025, "10537"],
];
/** Table 11's own GEORGIA row for the three measures Georgia's figures are taken from elsewhere: `{ measure: { year: stored token } }`. */
export type EducationMunicipalGeorgia = Readonly<Record<"schools" | "pupils" | "teachers", ReadonlyMap<number, string>>>;
const MUNICIPAL_GEORGIA_PUPILS_2025 = "644243";

const parts = (indicatorId: string) => indicatorId.split(".") as [string, EducationMeasure, string];
const MUNICIPALITIES = Object.values(EDUCATION_MUNICIPALITIES).flat();
const UNIT_IDS = Object.keys(EDUCATION_UNITS);
const EARLY_UNITS = ["unit.eredvi", "unit.tighva", "unit.kurta"];
const PLACE_TABLE_MEASURES = ["schools", "pupils", "teachers", "kindergartens", "kg_children", "kg_staff"] as const;

export function educationPeriodLabel(measure: EducationMeasure, year: number): string {
  return measure.startsWith("vet_") ? String(year) : `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

/** Cells that print nothing in a served range: no row is written for them. */
function isUnavailable(indicatorId: string, geographyId: string, year: number): boolean {
  const [, measure, group] = parts(indicatorId);
  if (measure === "teachers" && group === "private" && geographyId === EDUCATION_GEORGIA) return year === 2010;
  if (measure === "teachers" && geographyId === "unit.akhalgori") return true;
  if (["kindergartens", "kg_children", "kg_staff"].includes(measure) && geographyId === "unit.abkhazia_ar") return true;
  if (measure === "schools" || measure === "pupils") {
    if (geographyId === "unit.akhalgori") return year >= 2009;
    if (geographyId === "unit.eredvi") return year === 2008 || year >= 2011;
    if (geographyId === "unit.tighva" || geographyId === "unit.kurta") return year >= 2008;
  }
  return false;
}

/** Every key the serving package must contain, exactly once. */
export function expectedEducationKeys(): Set<string> {
  const keys = new Set<string>();
  const add = (measure: EducationMeasure, group: string, geographyId: string, years: readonly number[]) => {
    const indicatorId = `education.${measure}.${group}`;
    for (const year of years) if (!isUnavailable(indicatorId, geographyId, year)) keys.add(`${indicatorId}:${geographyId}:${year}`);
  };
  const places = [...EDUCATION_REGIONS, ...MUNICIPALITIES, ...UNIT_IDS];
  for (const measure of ["schools", "pupils_national"] as const) for (const group of EDUCATION_OWNERSHIP_GROUPS) add(measure, group, EDUCATION_GEORGIA, NATIONAL_YEARS);
  for (const group of EDUCATION_OWNERSHIP_GROUPS) add("teachers", group, EDUCATION_GEORGIA, TEACHER_YEARS);
  for (const geographyId of places) { add("schools", "total", geographyId, MUNICIPAL_YEARS); add("pupils", "total", geographyId, MUNICIPAL_YEARS); }
  for (const geographyId of [EDUCATION_GEORGIA, ...places.filter(id => !EARLY_UNITS.includes(id))]) {
    for (const group of geographyId === EDUCATION_GEORGIA ? ["women", "men"] : ["total", "women", "men"]) add("teachers", group, geographyId, MUNICIPAL_TEACHER_YEARS);
    for (const measure of ["kindergartens", "kg_children", "kg_staff"] as const) add(measure, "total", geographyId, KG_YEARS);
  }
  for (const measure of ["he_students", "he_admitted", "he_graduates"] as const) for (const group of EDUCATION_HE_GROUPS) add(measure, group, EDUCATION_GEORGIA, measure === "he_graduates" ? GRADUATE_YEARS : HE_YEARS);
  for (const measure of ["vet_admitted", "vet_graduates"] as const) {
    for (const group of ["total", "women", "men"]) add(measure, group, EDUCATION_GEORGIA, VET_YEARS);
    for (const [field, [first, last]] of Object.entries(VET_SPANS)) add(measure, field, EDUCATION_GEORGIA, range(first, last));
  }
  return keys;
}

/** Georgia's pupils are shown in thousands to one decimal; every other figure is a whole number. */
export function educationDisplayDecimals(indicatorId: string): 0 | 1 {
  return parts(indicatorId)[1] === "pupils_national" ? 1 : 0;
}

/** The workbook a fact comes from: Georgia's schools, pupils and teachers by ownership are the national tables, everything by place is table 11. */
function expectedSource(measure: EducationMeasure, group: string, geographyId: string): string {
  if (measure === "schools") return geographyId === EDUCATION_GEORGIA ? "geostat_education_schools_national" : "geostat_education_municipal";
  if (measure === "pupils_national") return "geostat_education_schools_national";
  if (measure === "teachers") return geographyId === EDUCATION_GEORGIA && EDUCATION_OWNERSHIP_GROUPS.includes(group as "total") ? "geostat_education_teachers_national" : "geostat_education_municipal";
  if (measure === "pupils") return "geostat_education_municipal";
  if (measure.startsWith("kg_") || measure === "kindergartens") return "geostat_education_kindergartens";
  return measure.startsWith("he_") ? "geostat_education_higher" : "geostat_education_vocational";
}

type Mismatch = { check: string; year: number; difference: string };
const memberOf = (region: string) => [...(EDUCATION_MUNICIPALITIES[region] ?? []), ...UNIT_IDS.filter(id => EDUCATION_UNITS[id] === region)];

/**
 * `municipalGeorgia` is table 11's own GEORGIA row, which is no fact: prepare reads it from the archived workbook. With it
 * the cross-checks against the national tables and the sums of regions to Georgia run for schools, pupils and teachers; without
 * it (a caller that only holds facts) they are skipped and everything else is checked.
 */
export function validateEducationFacts(facts: readonly EducationFact[], municipalGeorgia?: EducationMunicipalGeorgia): void {
  const expected = expectedEducationKeys();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = educationFactKey(fact);
    if (!EDUCATION_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid education identity: ${key}`);
    const [, measure, group] = parts(fact.indicatorId);
    if (fact.year > LAST_YEAR) throw new Error(`Education observation after 2025: ${key}`);
    if (!expected.has(key)) throw new Error(`Education observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate education observation: ${key}`);
    if (fact.unit !== UNITS[measure] || fact.basis !== "actual" || fact.valueStatus !== "official" || fact.sourceId !== expectedSource(measure, group, fact.geographyId)
      || !fact.sourceSheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid education source contract: ${key}`);
    if (fact.periodLabel !== educationPeriodLabel(measure, fact.year)) throw new Error(`Invalid education period label: ${key}`);
    if (fact.shown !== !group.startsWith("old_")) throw new Error(`Invalid education shown flag (only the old vocational fields are hidden): ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid education value: ${key}`); }
    if (!value.isFinite() || value.lt(0) || value.decimalPlaces() > 30) throw new Error(`Education value outside its range or database precision: ${key}`);
    // Round half-up from the value as Excel displays it (15 significant digits).
    if (fact.publishedValue !== value.toSignificantDigits(15).toFixed(educationDisplayDecimals(fact.indicatorId))) throw new Error(`Education published value does not match its stored value: ${key}`);
    values.set(key, value);
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete education coverage: ${missing.length} missing, first ${missing[0]}`);
  for (const [indicatorId, geographyId, year, published] of ANCHORS) {
    if (facts.find(f => f.indicatorId === indicatorId && f.geographyId === geographyId && f.year === year)!.publishedValue !== published) throw new Error(`Education anchor value changed: ${indicatorId}:${geographyId}:${year}`);
  }
  if (!EDUCATION_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Education source missing from the serving package");

  const indexed = new Map<string, Map<number, Decimal>>();
  for (const fact of facts) {
    const key = `${fact.indicatorId}|${fact.geographyId}`;
    if (!indexed.has(key)) indexed.set(key, new Map());
    indexed.get(key)!.set(fact.year, values.get(educationFactKey(fact))!);
  }
  const series = (indicatorId: string, geographyId: string = EDUCATION_GEORGIA): ReadonlyMap<number, Decimal> => indexed.get(`${indicatorId}|${geographyId}`) ?? new Map();

  const found: Mismatch[] = [];
  const compare = (check: string, addends: readonly ReadonlyMap<number, Decimal>[], total: ReadonlyMap<number, Decimal>, tolerance = "0", missingIsZero = false) => {
    for (const [year, value] of [...total].sort((a, b) => a[0] - b[0])) {
      // Without missingIsZero a year in which a part is unavailable (table 06 private teachers 2010/11) is not compared.
      if (!missingIsZero && !addends.every(part => part.has(year))) continue;
      const difference = addends.reduce((sum, part) => sum.plus(part.get(year) ?? 0), new D(0)).minus(value);
      if (difference.abs().gt(tolerance)) found.push({ check, year, difference: difference.toFixed() });
    }
  };
  for (const measure of ["schools", "pupils_national", "teachers"] as const) {
    compare(`${measure} public+private`, [series(`education.${measure}.public`), series(`education.${measure}.private`)], series(`education.${measure}.total`), measure === "pupils_national" ? "0.15" : "0");
  }
  const teacherPlaces = new Set(facts.filter(f => f.indicatorId === "education.teachers.women").map(f => f.geographyId));
  for (const geographyId of [...teacherPlaces].sort()) {
    const total = new Map([...series("education.teachers.total", geographyId)].filter(([year]) => MUNICIPAL_TEACHER_YEARS.includes(year)));
    compare(`teachers sex ${geographyId}`, [series("education.teachers.women", geographyId), series("education.teachers.men", geographyId)], total);
  }
  for (const measure of ["he_students", "he_admitted", "he_graduates"] as const) {
    const total = series(`education.${measure}.total`);
    for (const [name, groups] of [["ownership", ["public", "private"]], ["sex", ["women", "men"]], ["levels", ["level_bachelor", "level_master", "level_professional"]],
      ["fields", EDUCATION_HE_GROUPS.filter(g => g.startsWith("field_"))]] as const) {
      compare(`${measure} ${name}`, groups.map(g => series(`education.${measure}.${g}`)), total);
    }
  }
  for (const measure of ["vet_admitted", "vet_graduates"] as const) {
    const total = series(`education.${measure}.total`);
    compare(`${measure} sex`, ["women", "men"].map(g => series(`education.${measure}.${g}`)), total);
    // Outside its span a field prints 0, so a missing year counts as zero here.
    compare(`${measure} fields`, Object.keys(VET_SPANS).map(f => series(`education.${measure}.${f}`)), total, "0", true);
    compare(`${measure} current fields`, EDUCATION_VET_FIELDS.map(f => series(`education.${measure}.${f}`)), new Map([...total].filter(([year]) => year >= VET_CURRENT_ONLY_FROM)), "0", true);
  }
  const georgiaRow = (measure: "schools" | "pupils" | "teachers"): ReadonlyMap<number, Decimal> | undefined =>
    municipalGeorgia && new Map([...municipalGeorgia[measure]].map(([year, token]) => [year, new D(token)]));
  for (const measure of PLACE_TABLE_MEASURES) {
    for (const group of measure === "teachers" ? ["total", "women", "men"] : ["total"]) {
      const indicatorId = `education.${measure}.${group}`;
      for (const region of EDUCATION_REGIONS) {
        const members = memberOf(region);
        if (members.length) compare(`${indicatorId} ${region}`, members.map(id => series(indicatorId, id)), series(indicatorId, region), "0", true);
      }
      // Georgia's schools, pupils and teachers totals are national-table facts (or none): the table 11 row stands in for them.
      const georgia = ["schools", "pupils", "teachers"].includes(measure) && group === "total" ? georgiaRow(measure as "schools") : series(indicatorId);
      if (georgia) compare(`${indicatorId} georgia`, [...EDUCATION_REGIONS, "unit.abkhazia_ar"].map(id => series(indicatorId, id)), georgia, "0", true);
    }
  }
  const unexplained = [...found.filter(f => !EDUCATION_KNOWN_DIFFERENCES.some(k => k.check === f.check && k.year === f.year && k.difference === f.difference)),
    ...EDUCATION_KNOWN_DIFFERENCES.filter(k => !found.some(f => f.check === k.check && f.year === k.year && f.difference === k.difference))];
  if (unexplained.length) throw new Error(`The ${unexplained[0].check} parts do not add up to the total as recorded in ${unexplained[0].year} (expected the recorded difference, found ${unexplained[0].difference})`);

  if (municipalGeorgia) {
    const national = series("education.pupils_national.total");
    for (const [year, token] of municipalGeorgia.pupils) {
      if (new D(token).div(1000).toSignificantDigits(15).toFixed(1) !== national.get(year)!.toSignificantDigits(15).toFixed(1)) throw new Error(`Table 11 Georgia pupils / 1000 do not round to table 01 in ${year}`);
    }
    for (const [measure, nationalId] of [["schools", "education.schools.total"], ["teachers", "education.teachers.total"]] as const) {
      for (const [year, token] of municipalGeorgia[measure]) if (!new D(token).eq(series(nationalId).get(year)!)) throw new Error(`Table 11 Georgia ${measure} differ from the national table in ${year}`);
    }
    if (municipalGeorgia.pupils.get(2025) !== MUNICIPAL_GEORGIA_PUPILS_2025) throw new Error("Education anchor value changed: table 11 Georgia pupils 2025");
  }
}
